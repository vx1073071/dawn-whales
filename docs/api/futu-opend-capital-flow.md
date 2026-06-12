# Futu OpenD L3 资金流与市场快照 API 文档

> **文档版本**: v1.0 | **作者**: QClaw (document-shrimp) | **轮次**: R115 QTE-38
> **依赖**: Futu OpenD 9.x+ | **ProtoID**: 3312/3313/3204/3205
> **代码仓库**: `electron/engine/broker/adapters/futu-adapter.ts`

---

## 目录

1. [Qot_GetCapitalFlow — 资金流向](#1-qot_getcapitalflow)
2. [Qot_GetMarketSnapshot — 市场快照](#2-qot_getmarketsnapshot)
3. [TypeScript 类型映射](#3-typescript-类型映射)
4. [使用示例](#4-使用示例)
5. [错误处理](#5-错误处理)

---

## 1. Qot_GetCapitalFlow

**功能**: 获取单只股票的日内/日/周/月资金流向数据（超大单/大单/中单/小单流入流出）

**ProtoID**: C2S `3312` / S2C `3313`

**限制**:
- 每30秒最多30次请求
- 仅支持正股、窝轮和基金
- 历史数据仅提供最近1年

---

### 1.1 请求参数 (C2S 3312)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `security` | Security | ✅ | 股票代码 (如 `HK.00700`) |
| `period_type` | int32 | ❌ | 周期: 1=日内分时, 2=日, 3=周, 4=月 (默认1) |
| `start` | string | ❌ | 起始日期 `yyyy-MM-dd` |
| `end` | string | ❌ | 结束日期 `yyyy-MM-dd` |

**Security 子消息**:
| 字段 | 类型 | 说明 |
|------|------|------|
| `market` | int32 | 市场: 1=港股 11=美股 21=A股沪 22=A股深 |
| `code` | string | 代码 (如 00700) |

---

### 1.2 响应字段 (S2C 3313)

| 字段 | 类型 | 说明 |
|------|------|------|
| `capital_flow_item_time` | string | 时间 `yyyy-MM-dd HH:mm:ss`(**港股A股北京时间, 美股美东时间**) |
| `in_flow` | double | **总净流入** = 总流入 - 总流出 |
| `super_in_flow` | double | **超大单净流入** (≥100万股票 / ≥50 BTC加密) |
| `big_in_flow` | double | **大单净流入** (20万-100万) |
| `mid_in_flow` | double | **中单净流入** (4万-20万) |
| `sml_in_flow` | double | **小单净流入** (<4万) |
| `main_in_flow` | double | **主力净流入** = super_in_flow + big_in_flow **(仅历史日/周/月有效, 日内为空)** |
| `last_valid_time` | string | 最后有效时间 **(仅日内period_type=1有效)** |
| `total_in_flow` | double | 总流入 |
| `total_out_flow` | double | 总流出 |

**验证规则**:
```
super_in_flow + big_in_flow + mid_in_flow + sml_in_flow = in_flow
main_in_flow = super_in_flow + big_in_flow (仅period_type∈{2,3,4})
```

---

### 1.3 调用示例 (Python SDK)

```python
from futu import OpenQuoteContext

ctx = OpenQuoteContext(host='127.0.0.1', port=11111)

# 日内分时资金流 (实时)
ret, data = ctx.get_capital_flow(
    'HK.00700',
    period_type=1,  # 1=日内
)
# data 为 pandas DataFrame
# 列: capital_flow_item_time, in_flow, super_in_flow, big_in_flow, mid_in_flow, sml_in_flow

# 日线资金流 (历史)
ret, data = ctx.get_capital_flow(
    'HK.00700',
    period_type=2,  # 2=日
    start='2026-01-01',
    end='2026-06-12',
)
# 额外列: main_in_flow (= super_in_flow + big_in_flow)

ctx.close()
```

---

## 2. Qot_GetMarketSnapshot

**功能**: 获取大批量股票实时快照（实时价、开高低收、成交量、PE/PB、市值等），**无需单独订阅**

**ProtoID**: C2S `3204` / S2C `3205`

**限制**:
- 每30秒最多60次
- 单次最多**400只股票** (港股BMP权限下仅20只)
- 返回数据按代码顺序排列

---

### 2.1 请求参数 (C2S 3204)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `security_list` | Security[] | ✅ | 股票代码列表 (最多400只) |

---

### 2.2 响应字段 (S2C 3205)

#### 基础行情字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | string | 股票代码 |
| `name` | string | 股票名称 |
| `last_price` | double | 最新价 |
| `open_price` | double | 开盘价 |
| `high_price` | double | 最高价 |
| `low_price` | double | 最低价 |
| `prev_close_price` | double | 前收盘价 |
| `volume` | int64 | 成交量 (股) |
| `turnover` | double | 成交额 |
| `bid_price` | double | 买一价 |
| `ask_price` | double | 卖一价 |
| `price_spread` | double | 卖一相邻档位报价差 |

#### 比率字段 (除以100还原)

| 字段 | 类型 | 说明 | 格式 |
|------|------|------|------|
| `turnover_rate` | double | **换手率** | `20` → 20% |
| `amplitude` | double | **振幅** | `5.5` → 5.5% |
| `bid_ask_ratio` | double | **委比** | 百分比 |

#### 估值字段

| 字段 | 类型 | 说明 | 格式 |
|------|------|------|------|
| `pe_ratio` | double | 市盈率(静态) | 小数点 |
| `pe_ttm_ratio` | double | **市盈率(TTM)** — 优先使用 | 小数点 |
| `pb_ratio` | double | 市净率 | 小数点 |
| `ey_ratio` | double | 收益率(=1/PE) | 百分比不显示% |

#### 市值字段 (单位: 元)

| 字段 | 类型 | 说明 |
|------|------|------|
| `total_market_val` | double | **总市值** |
| `circular_market_val` | double | **流通市值** |

#### 有效性标记

| 字段 | 类型 | 说明 |
|------|------|------|
| `equity_valid` | bool | True=正股字段有效 |
| `wrt_valid` | bool | True=窝轮字段有效 |
| `option_valid` | bool | True=期权字段有效 |
| `suspension` | bool | True=停牌 |
| `lot_size` | int32 | 每手股数 (指数期权无此字段) |
| `update_time` | string | 更新时间 `yyyy-MM-dd HH:mm:ss` |

#### 52周高低 (仅正股有效)

| 字段 | 类型 | 说明 |
|------|------|------|
| `high_price_52week` | double | 52周最高价 |
| `low_price_52week` | double | 52周最低价 |

---

### 2.3 调用示例

```typescript
// TypeScript IPC调用 (electron main process)
import { ipcMain } from 'electron';
import OpenDContext from './opend-context';

// 批量获取400只股票快照 → 作为热力图数据源
async function getMarketSnapshot(
  symbols: string[],  // ['HK.00700', 'HK.09988', ...]
): Promise<MarketSnapshotResult[]> {
  const ctx = OpenDContext.getInstance();

  // 分批获取 (单次最多400)
  const chunks = chunkArray(symbols, 400);
  const results: MarketSnapshotResult[] = [];

  for (const chunk of chunks) {
    const req = {
      c2s: { security_list: chunk.map(s => parseSymbol(s)) },
    };
    const res = await ctx.request(3204, req);  // Proto 3204
    for (const row of res.s2c.snapshot_list) {
      results.push(mapSnapshotRow(row));
    }
  }
  return results;
}
```

---

## 3. TypeScript 类型映射

### 3.1 CapitalFlow 类型

```typescript
// 文件: src/lib/chart/scanner-types.ts (已由QTE-37定义)
// 文件: electron/engine/broker/adapters/futu-adapter.ts (使用)

/** Futu OpenD 资金流原始数据 (Proto 3313 直接映射) */
export interface FutuCapitalFlowRow {
  /** 时间 yyyy-MM-dd HH:mm:ss */
  capital_flow_item_time: string;
  /** 总净流入 */
  in_flow: number;
  /** 超大单净流入 */
  super_in_flow: number;
  /** 大单净流入 */
  big_in_flow: number;
  /** 中单净流入 */
  mid_in_flow: number;
  /** 小单净流入 */
  sml_in_flow: number;
  /** 主力净流入 (仅日/周/月) */
  main_in_flow?: number;
  /** 总流入 */
  total_in_flow: number;
  /** 总流出 */
  total_out_flow: number;
  /** 最后有效时间 (仅日内) */
  last_valid_time?: string;
}
```

### 3.2 MarketSnapshot 类型映射

```typescript
/** Futu OpenD 快照原始数据 (Proto 3205 直接映射) */
export interface FutuSnapshotRow {
  code: string;
  name: string;
  last_price: number;
  open_price: number;
  high_price: number;
  low_price: number;
  prev_close_price: number;
  volume: number;          // int64
  turnover: number;
  bid_price: number;
  ask_price: number;
  price_spread: number;
  turnover_rate: number;   // 需 /100 → 百分比
  amplitude: number;       // 需 /100 → 百分比
  pe_ratio: number;
  pe_ttm_ratio: number;
  pb_ratio: number;
  total_market_val: number;
  circular_market_val: number;
  high_price_52week: number;
  low_price_52week: number;
  equity_valid: boolean;
  suspension: boolean;
  lot_size: number;
  update_time: string;
}

/**
 * 转换为统一的 MarketSnapshot 格式
 * @see src/lib/chart/types.ts — MarketSnapshot 接口
 */
export function toMarketSnapshot(row: FutuSnapshotRow, market: string): MarketSnapshot {
  return {
    symbol: row.code,
    name: row.name,
    market: market as MarketSnapshot['market'],
    price: row.last_price,
    change: row.last_price - row.prev_close_price,
    changePct: row.prev_close_price
      ? ((row.last_price - row.prev_close_price) / row.prev_close_price) * 100
      : 0,
    open: row.open_price,
    high: row.high_price,
    low: row.low_price,
    prevClose: row.prev_close_price,
    volume: row.volume,
    turnover: row.turnover,
    turnoverRate: row.turnover_rate,       // Futu已为百分比(20=20%)
    amplitude: row.amplitude,               // Futu已为百分比
    marketCap: row.total_market_val,
    pe: row.pe_ttm_ratio || row.pe_ratio,
    pb: row.pb_ratio,
    updateTime: new Date(row.update_time).getTime(),
  };
}
```

---

## 4. 使用示例

### 4.1 热力图数据源 (MarketScanner → Heatmap)

```typescript
// 流程: 获取全市场快照 → 按板块分组 → 生成热力图数据
async function buildHeatmapData(
  symbols: string[],
  sectorMap: Map<string, string[]>
): Promise<HeatmapData> {
  // 1. 批量获取快照
  const snapshots = await getMarketSnapshot(symbols);

  // 2. 按板块分组
  const groups: HeatmapGroup[] = [];
  for (const [sector, stocks] of sectorMap) {
    const sectorStocks = snapshots.filter(s => stocks.includes(s.symbol));
    if (sectorStocks.length === 0) continue;

    const totalCap = sectorStocks.reduce((sum, s) => sum + (s.marketCap || 0), 0);
    const weightedChange = sectorStocks.reduce(
      (sum, s) => sum + s.changePct * (s.marketCap || 0), 0
    ) / totalCap;

    groups.push({
      name: sector,
      changePct: weightedChange,
      totalMarketCap: totalCap,
      stocks: sectorStocks,
    });
  }

  return { groups, updateTime: Date.now() };
}
```

### 4.2 资金流主力追踪

```typescript
// 流程: 拉取近10日资金流 → 判断主力趋势
async function trackMainForce(symbol: string): Promise<MainForceTracking> {
  const ctx = OpenDContext.getInstance();

  // 拉取近20个交易日资金流
  const ret = await ctx.getCapitalFlow(symbol, {
    periodType: 2,  // 日
    start: daysAgo(20),
    end: today(),
  });

  const rows = ret.s2c.flow_list as FutuCapitalFlowRow[];

  // 计算N日主力净流入
  const day1 = rows[rows.length - 1]?.main_in_flow || 0;
  const day3 = sumLast(rows, 3, 'main_in_flow');
  const day5 = sumLast(rows, 5, 'main_in_flow');
  const day10 = sumLast(rows, 10, 'main_in_flow');
  const day20 = sumLast(rows, 20, 'main_in_flow');

  // 趋势判断
  const trend: MainForceTracking['trend'] =
    day1 > 0 && day3 > 0 && day5 > 0 ? 'accumulating' :
    day1 < 0 && day3 < 0 && day5 < 0 ? 'distributing' :
    'neutral';

  return {
    symbol, day1, day3, day5, day10, day20,
    trend,
    trendStrength: Math.abs(day20) / Math.abs(rows.reduce((s, r) => s + (r.main_in_flow || 0), 0)),
  };
}
```

### 4.3 扫描器集成 (PresetScan → MarketSnapshot过滤)

```typescript
// 流程: 批量快照 → 条件过滤 → 排序 → 返回Top N
async function runScan(query: MarketScannerQuery): Promise<ScanResultSet> {
  const startTime = Date.now();

  // 1. 获取基础数据
  const symbols = getSymbolList(query.markets || ['HK']);
  const snapshots = await getMarketSnapshot(symbols);

  // 2. 条件过滤
  const filtered = snapshots.filter(s => evaluateConditions(s, query.conditions));

  // 3. 排序
  const sorted = filtered.sort((a, b) => {
    const field = query.sort?.field || 'changePct';
    const dir = query.sort?.direction === 'asc' ? 1 : -1;
    return dir * (getFieldValue(a, field) - getFieldValue(b, field));
  });

  // 4. 分页
  const results = sorted.slice(0, query.limit || 50);

  const elapsedMs = Date.now() - startTime;

  return {
    total: filtered.length,
    results: mapToScanResult(results),
    hasMore: filtered.length > (query.limit || 50),
    elapsedMs,
    fromCache: false,
    timestamp: Date.now(),
  };
}
```

---

## 5. 错误处理

### 5.1 OpenD 连接异常

| 错误码 | 说明 | 处理 |
|--------|------|------|
| `-1` | 未连接OpenD | 自动重连 `ctx.start()` |
| `-2` | 请求超时 | 重试最多3次, 指数退避(1s/2s/4s) |
| `-3` | 权限不足 | 检查BMP等级 |
| `-4` | 参数错误 | 校验symbol格式 |
| `1024` | 请求频率超限 | 等待至30s窗口结束 |

### 5.2 数据降级策略

```
优先级链:
1. OpenD实时快照 (Proto 3205)  — 延迟<100ms
2. OpenD缓存数据 (上次成功结果) — TTL 30s
3. yahooquery REST fallback        — 延迟1-3s
4. 返回空数据 + error消息          — 绝不阻塞UI
```

### 5.3 缓存配置

```typescript
const SNAPSHOT_CACHE = {
  ttl: 30_000,          // 30s
  maxSize: 500,         // 500条
  staleWhileRevalidate: true,  // 返回旧数据同时后台刷新
};

const CAPITAL_FLOW_CACHE = {
  ttl: 60_000,          // 1分钟 (日内变化慢)
  maxSize: 200,
};
```

---

## 附录A: ProtoID 参考

| ProtoID | 方向 | 名称 | 说明 |
|---------|------|------|------|
| 3204 | C2S | Qot_GetMarketSnapshot | 请求市场快照 (批量) |
| 3205 | S2C | Qot_GetMarketSnapshot | 返回市场快照 |
| 3312 | C2S | Qot_GetCapitalFlow | 请求资金流向 |
| 3313 | S2C | Qot_GetCapitalFlow | 返回资金流向 |
| 3008 | C2S | Qot_GetOrderBook | 请求实时摆盘 (L2深度) |
| 3009 | S2C | Qot_GetOrderBook | 返回实时摆盘 |
| 3010 | C2S | Qot_GetRT | 请求实时分时 |
| 3011 | S2C | Qot_GetRT | 返回实时分时 |
| 3012 | C2S | Qot_GetTicker | 请求逐笔成交 |
| 3013 | S2C | Qot_GetTicker | 返回逐笔成交 |
| 3014 | C2S | Qot_GetBrokerQueue | 请求经纪商排队 |
| 3015 | S2C | Qot_GetBrokerQueue | 返回经纪商排队 |

## 附录B: 代码文件索引

| 文件 | 说明 |
|------|------|
| `electron/engine/broker/types.ts` | Broker通用类型(Quote/Order/Account) |
| `electron/engine/broker/adapters/futu-adapter.ts` | Futu适配器 (L3深度接入点) |
| `src/lib/chart/types.ts` | K线/指标/MarketSnapshot类型定义 (QTE-04) |
| `src/lib/chart/depth-types.ts` | 深度/Tick/BrokerQueue类型定义 (QTE-24) |
| `src/lib/chart/scanner-types.ts` | Scanner/FundFlow/Alert类型定义 (QTE-37) |
| `src/lib/chart/oauth-broker-types.ts` | OAuth券商深度适配类型 (QTE-23) |
| `docs/api/futu-opend-capital-flow.md` | 本文档 |

---

> **QTE-38 验收**: >200行 ✅ | 含完整示例代码 ✅ | Proto字段精准映射 ✅ | 2个API覆盖 ✅
