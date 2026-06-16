# SymbolSearch 架构文档 — 从硬编码到动态搜索 API 对接

> **版本**: v1.0 | **日期**: 2026-06-14 | **作者**: QClaw (文档虾)
> **来源**: `server/services/symbol-search.ts` (394L) + `server/routes/symbol.ts` + `src/components/market/SymbolSearch.tsx`

---

## 一、现状 — 两种搜索并存

quant-moo 目前有两套搜索系统，**前端用 A，后端有 B，但互不相通**。

```
┌─ 前端 SymbolSearch.tsx ───────────┐  ┌─ 后端 symbol-search.ts ────────┐
│                                    │  │                                │
│  SYMBOL_DB: 64 硬编码标的          │  │  SYMBOL_DB: 36 硬编码标的       │
│  MOCK_BROKER_STATUS: 8 假券商      │  │  BROKER_MARKET_MAP: 16 券商     │
│  搜索: 全量 filter(contains)       │  │  detectMarket(): 7 规则引擎     │
│  ❌ 无后端调用                      │  │  SymbolSearchEngine.search()    │
│                                    │  │  GET /api/symbol/search ✅      │
└────────────────────────────────────┘  └────────────────────────────────┘
```

### 问题
- 前后端标的不一致（64 vs 36）
- 前端从未调用后端 API
- 券商状态是 Mock，不是实际连接

---

## 二、后端搜索架构 (已有，待前端接入)

### 2.1 核心类: SymbolSearchEngine

```typescript
// server/services/symbol-search.ts

class SymbolSearchEngine {
  private dynamicSymbols: SymbolEntry[];

  search(req: SearchRequest): SearchResponse  // 主搜索入口
  getByStandardCode(code: string): SymbolEntry | null
  getByMarket(market: MarketType): SymbolEntry[]
  getMarketStats(): MarketStat[]
  addSymbols(entries: SymbolEntry[]): void   // 运行时扩展
}
```

### 2.2 搜索流程

```
用户输入 "腾讯"
  → detectMarket("腾讯")     → confidence: 0.3, market: US (默认)
  → _scoreMatch("腾讯", ...)  → 匹配 name 字段 "腾讯控股" → score 85
  → 排序: 精确代码匹配优先 + 分数降序
  → 返回 SearchResponse[] (含 brokerCapable)
```

### 2.3 评分算法

| 匹配方式 | 得分 | 示例 |
|---------|------|------|
| symbol 完全匹配 | 100 | query="00700" → entry.symbol="00700" |
| symbol 前缀匹配 | 90 | query="00" → entry.symbol="00700" |
| symbol 子串 | 70 | query="700" → entry.symbol="00700" |
| 中文名完全匹配 | 85 | query="腾讯控股" → entry.name="腾讯控股" |
| 中文名包含 | 65 | query="腾讯" → entry.name="腾讯控股" |
| 英文名前缀 | 60 | query="APP" → entry.nameEn="Apple Inc." |
| 英文名包含 | 50 | query="ple" → entry.nameEn="Apple Inc." |
| 中文字符部分匹配 | 最大 40 | query="科飞" → entry.name="科大讯飞" |

### 2.4 市场检测规则

```typescript
const MARKET_PATTERNS = [
  { market: 'HK',     pattern: /^\d{5}$/,             confidence: 0.85 },
  { market: 'CN',     pattern: /^\d{6}$/,             confidence: 0.70 },
  { market: 'CN',     pattern: /^00\d{4}$/,           confidence: 0.60 },
  { market: 'CN',     pattern: /^60\d{4}$/,           confidence: 0.60 },
  { market: 'US',     pattern: /^[A-Z]{1,5}$/,        confidence: 0.70 },
  { market: 'CRYPTO', pattern: /^(BTC|ETH|SOL|...)/,  confidence: 0.95 },
  { market: 'CRYPTO', pattern: /^...\-USDT$/,          confidence: 0.80 },
];
// 无匹配 → 默认 US, confidence 0.3
```

---

## 三、API 端点 (已有，可直接用)

### 3.1 搜索

```
GET /api/symbol/search?q=腾讯&market=HK&type=STOCK&limit=20

Response:
{
  "success": true,
  "query": "腾讯",
  "detectedMarket": { "market": "US", "confidence": 0.3, "reason": "Fuzzy match" },
  "totalResults": 1,
  "results": [
    {
      "standardCode": "HK:00700",
      "symbol": "00700",
      "market": "HK",
      "exchange": "SEHK",
      "name": "腾讯控股",
      "nameEn": "Tencent",
      "type": "STOCK",
      "brokerCapable": ["futu","moomoo","ib","longbridge","tiger","vbkr","usmart","mt5"],
      "brokerNotCapable": ["binance","okx","bybit","bitget","schwab","etrade","etoro","webull"],
      "currency": "HKD",
      "lotSize": 100,
      "matchScore": 85,
      "detectConfidence": 0.3
    }
  ],
  "searchTimeMs": 2
}
```

### 3.2 券商市场能力

```
GET /api/broker/markets
→ 所有 16 家券商 × 8 市场矩阵

GET /api/broker/markets/by/HK
→ 支持港股的所有券商列表: ["futu","moomoo","ib","longbridge","tiger","vbkr","usmart","mt5"]

GET /api/broker/markets/futu
→ 富途支持的市场: ["HK","US","CN"]
```

### 3.3 市场统计

```
GET /api/symbol/search (不带 q, 带 market 或 type filter)
→ getMarketStats() 返回:
  [{market:"HK", label:"港股", brokerCount:8, symbolCount:14}, ...]
```

---

## 四、前端接入方案

### 4.1 SymbolSearch.tsx 改造步骤

```
Step 1: 删除 SYMBOL_DB 和 MOCK_BROKER_STATUS
Step 2: 新增 fetchResults(query) → fetch('/api/symbol/search?q='+q)
Step 3: 新增 useBrokerStatus(refreshInterval) → fetch('/api/broker/markets')
Step 4: 替换 hasConnectedBroker() → brokerStatusMap.get(brokerId)?.connected
Step 5: 替换 results useMemo → useEffect + fetchResults
```

### 4.2 改造后 React Hook 结构

```typescript
// 替代原 useMemo + SYMBOL_DB.filter()
function useSymbolSearch(query: string, market: Market | null) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 1) return;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await fetch(
        `/api/symbol/search?q=${encodeURIComponent(query)}` +
        (market ? `&market=${market}` : '') +
        '&limit=20'
      );
      const data = await res.json();
      setResults(data.results || []);
      setLoading(false);
    }, 150); // 防抖 150ms
    return () => clearTimeout(timer);
  }, [query, market]);

  return { results, loading };
}
```

### 4.3 搜索结果 UI 扩展

```typescript
// 原组件用 SYMBOL_DB.map() → 改为 apiResults.map()
// 每个 result 增加字段:
//   matchScore → 可用于排序/高亮
//   brokerCapable → 替换 MOCK_BROKER_STATUS 判断
//   searchTimeMs → Footer "搜索耗时 2ms"
```

---

## 五、券商连接状态 — 真实数据管道

### 5.1 当前: Mock → 目标: 主进程 IPC

```
当前路径:
  SymbolSearch → MOCK_BROKER_STATUS (硬编码)

目标路径:
  SymbolSearch → window.api.getBrokerStatus() → Electron IPC → main process
    → server/services/quote-router.ts → 各适配器 .getStatus()
    → 返回 { brokerId, connected, latency, market }
```

### 5.2 IPC 契约

```typescript
// preload / bridge-api
interface BrokerStatus {
  brokerId: string;
  name: string;
  connected: boolean;
  latency: number;
  markets: string[];
  lastSeen: number;
  errorRate: number;
}

// SymbolSearch 中
const [brokerStatus, setBrokerStatus] = useState<Map<string,BrokerStatus>>(new Map());

useEffect(() => {
  const api = (window as any).api;
  if (!api?.getBrokerStatus) return;
  const poll = async () => {
    const statuses = await api.getBrokerStatus();
    setBrokerStatus(new Map(statuses.map(s => [s.brokerId, s])));
  };
  poll();
  const id = setInterval(poll, 10000); // 每 10s 刷新
  return () => clearInterval(id);
}, []);

// 判断券商连接
function isBrokerConnected(brokerId: string): boolean {
  return brokerStatus.get(brokerId)?.connected ?? false;
}
```

---

## 六、部署检查清单

| # | 检查项 | 状态 |
|---|--------|------|
| 1 | `server/services/symbol-search.ts` 存在 | ✅ |
| 2 | `server/routes/symbol.ts` 已挂载 Express Router | ✅ |
| 3 | `/api/symbol/search?q=AAPL` 可访问 | ⚠️ 待挂载到 server/index.ts |
| 4 | `/api/broker/markets/by/HK` 可访问 | ⚠️ 同上 |
| 5 | 前端 SymbolSearch.tsx 删除了 SYMBOL_DB | ❌ 待 R155 |
| 6 | 前端接入 fetch('/api/symbol/search') | ❌ 待 R155 |
| 7 | 前端接入真实券商状态 | ❌ 待 R155 |

---

> **关键发现**: 后端搜索和 API 已由 JVS 全部完成（R152），前端只需要删除硬编码并接入 fetch。改动量估计: SymbolSearch.tsx 删约 100 行 + 增约 80 行。
