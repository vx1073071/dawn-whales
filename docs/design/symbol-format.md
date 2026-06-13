# Symbol Format — 代码标准化规格 & 券商市场映射表

> **版本**: v1.0 | **日期**: 2026-06-13 | **作者**: QClaw (文档虾)
> **源码参考**: `server/services/symbol-search.ts` | `server/services/code-normalizer.ts`

---

## 第一部分: 代码标准化规格

### 1.1 标准格式

Dawn Whales 所有内部代码使用 **统一标准化格式**:

```
格式: <MARKET>.<CODE>

MARKET:
  HK  = 港股
  US  = 美股
  SH  = 沪市A股
  SZ  = 深市A股
  CC  = 加密货币
  SG  = 新加坡
  JP  = 日本
  EU  = 欧洲
  UK  = 英国
```

### 1.2 格式规则表

| 市场 | 标准化格式 | 示例 | 备注 |
|------|-----------|------|------|
| 港股 | `HK.` + 5位代码 (补齐0) | `HK.00700` | 腾讯 → HK.00700 |
| 美股 | `US.` + 原始代码 (大写) | `US.AAPL` | BRK.B 保持 |
| A股沪 | `SH.` + 6位代码 | `SH.600519` | 贵州茅台 |
| A股深 | `SZ.` + 6位代码 | `SZ.000001` | 平安银行 |
| 加密货币 | `CC.` + 大写代码 | `CC.BTCUSD` | 含 USD/USDT 后缀 |
| 新加坡 | `SG.` + 原始代码 | `SG.D05` | DBS |
| 日本 | `JP.` + 4位代码 | `JP.7203` | 丰田 |
| 欧洲 | `EU.` + 原始代码 | `EU.AIR` | Airbus |
| 英国 | `UK.` + 原始代码 | `UK.HSBA` | HSBC |

### 1.3 智能输入识别

| 用户输入 | 识别逻辑 | 标准化结果 |
|---------|---------|-----------|
| `0700` | 1-4 位纯数字 → 港股 (补齐5位) | `HK.00700` |
| `00700` | 5 位纯数字 → 港股 | `HK.00700` |
| `700` | 1-4 位纯数字 → 港股 (补齐5位) | `HK.00700` |
| `1` | 1 位纯数字 → 港股 (补齐5位) | `HK.00001` |
| `9988` | 4 位纯数字 → 港股 (补齐5位) | `HK.09988` |
| `600519` | 6 位纯数字，6 开头 → 沪市A股 | `SH.600519` |
| `000001` | 6 位纯数字，0 开头 → 深市A股 | `SZ.000001` |
| `300750` | 6 位纯数字，3 开头 → 深市(创业板) | `SZ.300750` |
| `688981` | 6 位纯数字，68 开头 → 沪市(科创板) | `SH.688981` |
| `AAPL` | 纯字母，1-5 字符 → 美股 | `US.AAPL` |
| `TSLA` | 纯字母，1-5 字符 → 美股 | `US.TSLA` |
| `BRK.B` | 字母+.+字母 → 美股 | `US.BRK.B` |
| `BTC` | 已知加密货币 → CC | `CC.BTCUSD` |
| `ETH` | 已知加密货币 → CC | `CC.ETHUSD` |
| `腾讯` | 中文名称 → 搜索引擎匹配 | `HK.00700` |
| `特斯拉` | 中文名称 → 搜索引擎匹配 | `US.TSLA` |
| `Tencent` | 英文名称 → 搜索引擎匹配 | `HK.00700` |
| `恒生` | 指数名称 → 搜索引擎匹配 | `HK.HSI` |

### 1.4 各券商格式转换表

标准化代码 → 各券商原生格式:

| 标准化 | 富途 | IBKR | Tiger | 华盛 | 盈立 | E*TRADE | eToro | Binance |
|--------|------|------|-------|------|------|---------|-------|---------|
| `HK.00700` | `HK.00700` | `700` | `00700` | `00700.HK` | `00700` | — | — | — |
| `US.AAPL` | `US.AAPL` | `AAPL` | `AAPL` | `AAPL.US` | — | `AAPL` | `AAPL` | — |
| `SH.600519` | `SH.600519` | `600519` | `600519` | `600519.SH` | `600519` | — | — | — |
| `SZ.000001` | `SZ.000001` | — | `000001` | `000001.SZ` | `000001` | — | — | — |
| `CC.BTCUSD` | — | `BTC` | — | — | — | — | `BTC` | `BTCUSDT` |
| `CC.ETHUSD` | — | `ETH` | — | — | — | — | `ETH` | `ETHUSDT` |
| `SG.D05` | — | `D05` | `D05` | — | — | — | — | — |
| `JP.7203` | — | `7203` | `7203` | — | — | — | — | — |
| `UK.HSBA` | — | `HSBA` | — | — | — | — | `HSBA.L` | — |
| `EU.AIR` | — | `AIR` | — | — | — | — | `AIR.PA` | — |

### 1.5 检测市场函式 `detectMarket()`

```typescript
function detectMarket(symbol: string): Market {
  // 标准化后
  const prefix = symbol.split('.')[0].toUpperCase();
  
  switch (prefix) {
    case 'HK': return 'HK';
    case 'US': return 'US';
    case 'SH': case 'SZ': return 'CN';
    case 'CC': return 'CRYPTO';
    case 'SG': return 'SG';
    case 'JP': return 'JP';
    case 'UK': return 'UK';
    case 'EU': return 'EU';
    default:
      // 回退启发式
      if (/^\d{1,5}$/.test(symbol)) return 'HK';
      if (/^[A-Z]{1,5}$/.test(symbol)) return 'US';
      throw new InvalidSymbolError(symbol);
  }
}
```

---

## 第二部分: 券商市场映射表

### 2.1 完整覆盖矩阵

| 券商 | HK 港股 | US 美股 | CN A股 | CRYPTO 加密 | SG 新 | JP 日 | UK 英 | EU 欧 | 接入方式 |
|------|--------|--------|--------|------------|-------|-------|-------|-------|---------|
| **富途** | ✅ L2 | ✅ L1 | ✅ L2 | ❌ | ❌ | ❌ | ❌ | ❌ | OpenD |
| **IBKR** | ✅ L1 | ✅ L2 | ✅ L1 | ✅ | ✅ | ✅ | ✅ | ✅ | TWS/Gateway |
| **Tiger** | ✅ L1 | ✅ L1 | ✅ L1 | ❌ | ✅ | ✅ | ❌ | ❌ | OpenAPI |
| **Webull** | ✅ L1 | ✅ L1 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | OAuth2 |
| **eToro** | ❌ | ✅ L1 | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | OAuth2 |
| **E\*TRADE** | ❌ | ✅ L2 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | OAuth1.0a |
| **Schwab** | ❌ | ✅ L1 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | OAuth2 PKCE |
| **Binance** | ❌ | ❌ | ❌ | ✅ L2 | ❌ | ❌ | ❌ | ❌ | API Key |
| **OKX** | ❌ | ❌ | ❌ | ✅ L1 | ❌ | ❌ | ❌ | ❌ | API Key |
| **华盛** | ✅ L1 | ✅ L2 | ✅ L2 | ❌ | ❌ | ❌ | ❌ | ❌ | OpenAPI |
| **盈立** | ✅ L1 | ✅ L2 | ✅ L1 | ❌ | ❌ | ❌ | ❌ | ❌ | OpenAPI |
| **MT5** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | MetaApi |
| **Moomoo** | ✅ L1 | ✅ L1 | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | OpenD |
| **Alpaca** | ❌ | ✅ L1 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | OAuth2 |
| **Robinhood** | ❌ | ✅ L1 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | OAuth2 |

- L1 = Level 1 基础行情 (bid/ask/last/volume)
- L2 = Level 2 深度行情 (order book, tick-by-tick, depth)

### 2.2 行情源质量评估

| 券商 | 小数位精度 | Tick 密度 | 断连率 (日均) | 平均延迟 | 综合评分 |
|------|----------|----------|-------------|--------|---------|
| 富途 (HK) | 3 位 | ~3 tick/s | < 1% | 45ms | ⭐⭐⭐⭐⭐ |
| 富途 (US) | 2 位 | ~2 tick/s | < 1% | 120ms | ⭐⭐⭐⭐ |
| Binance | 2-8 位 | ~10 tick/s | < 0.5% | 30ms | ⭐⭐⭐⭐⭐ |
| IBKR | 2-4 位 | ~1 tick/s | 2% | 80ms | ⭐⭐⭐⭐ |
| E\*TRADE | 2 位 | ~0.5 tick/s | 1% | 150ms | ⭐⭐⭐ |
| OKX | 1-8 位 | ~8 tick/s | < 1% | 40ms | ⭐⭐⭐⭐ |
| Webull | 2-4 位 | ~1 tick/s | 3% | 200ms | ⭐⭐⭐ |
| Tiger | 2 位 | ~1 tick/s | 2% | 100ms | ⭐⭐⭐ |
| eToro | 2 位 | ~0.5 tick/s | 5% | 300ms | ⭐⭐ |

### 2.3 按市场分组的行情源优先级

#### 港股 (HK)
```
Priority 0: 富途      (L2, 45ms, 3位精度)
Priority 1: 华盛      (L1, 120ms, 2位)
Priority 2: 盈立      (L1, 200ms, 2位)
Priority 3: Tiger     (L1, 100ms, 2位)
Priority 4: IBKR      (L1, 80ms, 2位)
Priority 5: Webull    (L1, 200ms, 2位)
```

#### 美股 (US)
```
Priority 0: IBKR      (L2, 80ms, 4位)
Priority 1: E*TRADE   (L2, 150ms, 2位)
Priority 2: Webull    (L1, 200ms, 4位)
Priority 3: eToro     (L1, 300ms, 2位)  ← 延迟最高，降级使用
Priority 4: 富途      (L1, 120ms, 2位)
Priority 5: Tiger     (L1, 100ms, 2位)
Priority 6: 盈立      (L1, 200ms, 2位)
Priority 7: Schwab    (L1, 180ms, 2位)
Priority 8: Alpaca    (L1, 150ms, 2位)
Priority 9: Robinhood (L1, 200ms, 2位)
```

#### A股 (CN)
```
Priority 0: 富途      (L2, 45ms, 3位)
Priority 1: 华盛      (L2, 120ms, 2位)
Priority 2: 盈立      (L1, 200ms, 2位)
Priority 3: Tiger     (L1, 100ms, 2位)
Priority 4: IBKR      (L1, 80ms, 2位)
```

#### 加密货币 (CRYPTO)
```
Priority 0: Binance   (L2, 30ms, 8位)   ← 最佳加密源
Priority 1: OKX       (L1, 40ms, 8位)
Priority 2: eToro     (L1, 300ms, 2位)   ← 降级备选
```

#### 新加坡 (SG)
```
Priority 0: IBKR      (L1, 80ms)
Priority 1: Tiger     (L1, 100ms)
Priority 2: Moomoo    (L1, 150ms)
```

#### 日本 (JP)
```
Priority 0: IBKR      (L1, 80ms)
Priority 1: Tiger     (L1, 100ms)
```

#### 欧洲 (EU)
```
Priority 0: IBKR      (L1, 100ms)
Priority 1: eToro     (L1, 350ms)  ← 高延迟降级
```

#### 英国 (UK)
```
Priority 0: IBKR      (L1, 80ms)
Priority 1: eToro     (L1, 350ms)
```

---

## 第三部分: 搜索 API 集成

### 3.1 搜索请求格式
```
GET /api/symbol/search?q=<query>&market=<optional_market_filter>

q: 代码/名称/简称 (中文/英文/拼音)
market: HK | US | CN | CRYPTO | SG | JP | UK | EU (可选过滤器)

示例:
  GET /api/symbol/search?q=腾讯
  GET /api/symbol/search?q=AAPL
  GET /api/symbol/search?q=BTC
  GET /api/symbol/search?q=00700&market=HK
```

### 3.2 搜索响应格式
```json
{
  "query": "腾讯",
  "results": [
    {
      "symbol": "HK.00700",
      "name": "腾讯控股",
      "nameCN": "腾讯控股",
      "nameEN": "Tencent Holdings Ltd",
      "market": "HK",
      "assetType": "STOCK",
      "availableBrokers": [
        { "broker": "futu",    "status": "connected" },
        { "broker": "huasheng","status": "connected" },
        { "broker": "yingli",  "status": "connected" },
        { "broker": "tiger",   "status": "disconnected" },
        { "broker": "ibkr",    "status": "disconnected" }
      ],
      "quotedBroker": "futu",
      "lastPrice": 385.60
    }
  ],
  "totalHits": 1
}
```

### 3.3 搜索结果 UI 展示
```
搜索框输入 "腾讯"
──────────────────────────────────
  🏷  HK.00700  腾讯控股
      腾讯控股有限公司 · 港股
      💰 385.60 HKD
      
      可用券商: 🟢富途 🟢华盛 🟢盈立 🔴Tiger 🔴IBKR
      行情源:    富途
      [+ 加入自选]
──────────────────────────────────
```

---

## 第四部分: 错误码 & 边界情况

| 场景 | 错误码 | 搜索行为 |
|------|--------|---------|
| 输入 `zxcvasdf` | `NO_MATCH` | 搜索结果显示 "未找到匹配标的" |
| 输入 `<3 字符` | `QUERY_TOO_SHORT` | 提示 "请输入至少 3 个字符" |
| 搜索结果 > 100 | `TOO_MANY` | 仅返回前 50 + 提示 "请添加市场过滤" |
| 标的已过期 (退市) | — | 标注 "已退市"，仍可搜索但不提供行情 |
| 无券商连接该市场 | `NO_BROKER` | UI 显示 "该市场暂无已连接券商" + 引导连接 |
| 中英文混合 "腾讯0700" | — | 优先按中文搜索，匹配后忽略数字部分 |

---

> **设计审查**: 待 PM 确认富途 L2 是否是港股唯一深度行情源
> **维护**: 券商增删时同步更新本表
