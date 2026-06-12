# DAWN WHALES 行情功能深度学习 + PM建议
> 时间: 2026-06-12 09:58
> 背景: R1-R4 多券商接入项目刚完成, 16家券商全部接入
> 方向: 行情(Quotes)相关功能深度分析与增强建议

---

## 一、当前行情能力盘点 (R4交付后)

### 已有
| 能力 | 实现 | 覆盖 |
|------|------|------|
| 单券商行情 | IBrokerAdapter.getQuote() → 实时快照 | 16家 |
| 单券商K线 | IBrokerAdapter.getKlines() | 16家 |
| 单券商推送 | subscribeMarketData() WS/polling | 15家(RH Crypto polling) |
| 跨券商聚合 | QuoteAggregator.getCrossBrokerQuotes() | ✅ |
| 套利扫描 | QuoteAggregator.scanArbitrageOpportunities() | ✅ |
| 前端Watchlist | WatchlistV2 (5家实时对比) | ✅ |
| 前端聚合面板 | AggregatedPortfolio (跨券商持仓) | ✅ |
| 代码标准化 | CodeNormalizer (BTCUSDT↔BTC-USDT) | ✅ |

### 缺失 (高价值)
| 功能 | 价值 | 难度 |
|------|------|------|
| 🟡 **深度行情 (OrderBook)** | 流动性分析, 精准下单 | 低(已有接口) |
| 🟡 **逐笔成交 (Tick)** | 高频策略, 量价分析 | 中 |
| 🔴 **跨券商最优执行 (Smart Routing Lite)** | NBBO最佳买卖价 | 中 |
| 🔴 **历史行情回放 (Replay)** | 策略回测, QA测试 | 高 |
| 🔴 **波动率曲面 (Vol Surface)** | 期权定价, 风控 | 高 |
| 🟢 **Top Gainers/Losers** | 发现热点, 市场扫描 | 低 |
| 🟡 **市场深度热力图** | 流动性可视化 | 中 |
| 🟢 **跨所价差警报** | 套利实时通知 | 低 |

---

## 二、深度行情 (OrderBook) — P0 建议

### 为什么必须做
- **所有16家券商都提供深度行情API** (Binance/OKX提供L2, Futu OpenD提供L10档)
- 当前只有"最新价"行情, 没有买卖盘数据, 无法做**流动性感知下单**
- 大单在薄盘券商会被滑点吃掉收益

### 建议实现
```typescript
// 扩展 IBrokerAdapter
interface IBrokerAdapter {
  getOrderBook(symbol: string, depth?: number): Promise<OrderBook>;
  subscribeOrderBook(symbol: string, callback: DataCallback): Promise<void>;
  // 已有: getQuote / subscribeMarketData ...
}

interface OrderBook {
  symbol: string;
  bids: [price: number, size: number][];
  asks: [price: number, size: number][];
  timestamp: number;
}
```

### 优先级: P0 (R5, ~3天)
- Binance/OKX/Bybit/Bitget 深度行情API已成熟
- 福途/老虎/IBKR也支持
- 前端: OrderBook面板 (买卖挂单瀑布图)

---

## 三、跨券商最优执行 (Smart Routing) — P0 建议

### 场景
用户在WatchlistV2看到BTC在Binance卖98,234, 在Bybit卖98,230。下单时应该自动选最优价格吗？

### 当前问题
- `SmartOrderRouter.routeAuto()` 已设计但未与真实行情联动
- 缺少 **NBBO (National Best Bid and Offer)** 概念

### 建议实现
```typescript
// SmartOrderRouter 增强
interface SmartOrderRouter {
  // 获取NBBO: 跨所有券商找到最优买价和卖价
  getNBBO(symbol: string): Promise<{ bestBid: { price: number; brokerId: string }; bestAsk: { price: number; brokerId: string } }>;

  // 流动性加权下单: 大单按各券商深度自动拆分
  routeSplit(symbol: string, side: OrderSide, qty: number): Promise<TaggedOrderResult[]>;

  // 延迟感知路由: 优先ping最低的券商
  routeByLatency(symbol: string, order: OrderRequest): Promise<TaggedOrderResult>;
}
```

### 优先级: P0 (R6, ~5天)

---

## 四、Top Gainers/Losers + 市场扫描 — P1 建议

### 场景
"给我看今天涨幅最大的20个币" "哪个股票放量了？"

### 建议
```typescript
interface MarketScanner {
  getTopGainers(brokerId: string, market: Market, limit: number): Promise<Quote[]>;
  getTopLosers(brokerId: string, market: Market, limit: number): Promise<Quote[]>;
  getMostActive(brokerId: string, market: Market, limit: number): Promise<Quote[]>;
  scanVolumeBreakout(brokerId: string, threshold: number): Promise<Quote[]>;
}
```

### 优先级: P1 (R7, ~3天)
- Binance有 `/api/v3/ticker/24hr` 全量
- 前端: Market Scanner 页

---

## 五、跨所价差警报 — P1 建议

### 场景
"BTC在Binance和Bybit之间价差超过0.1%时推通知"

### 已有基础
- `QuoteAggregator.scanArbitrageOpportunities(thresholdPct)` ✅
- 缺少: **实时推送通知** (当前只在UI显示)

### 建议
```typescript
// BrokerEventBus 增强
interface BrokerEventBus {
  onArbitrageAlert(callback: (opp: ArbitrageOpportunity) => void): void;
}
```
→ 价差>阈值 → 系统通知/Telegram/飞书推送

### 优先级: P1 (R7, ~2天)

---

## 六、行情数据缓存与去重 — P2 建议

### 当前问题
16家券商同时推送行情时, 相同标的(如BTC)会有16份数据。每秒可能产生100+条行情更新, 全部推给前端会卡顿。

### 建议
```typescript
class QuoteCache {
  // TTL 1秒: 相同价格不重复推送
  // 变更>0.01%才推送: 过滤噪音
  // 合并窗口: 100ms内合并同一标的所有报价
}
```

### 优先级: P2 (R8, ~2天)

---

## 七、行情回放 — P2 建议

### 场景
回测引擎需要历史tick数据, 但实际交易所不提供免费tick历史。

### 建议
- 自建tick数据库: WebSocket行情→按秒聚合→SQLite存储
- 回放接口: `QuoteReplay.replay(symbol, startTime, endTime, speed)`

### 优先级: P2 (R9+, ~5天)

---

## 八、建议路线图 (供PM参考)

| Round | 功能 | 工时 | 优先级 |
|-------|------|------|--------|
| **R5** | 深度行情 (OrderBook API+UI) | 24h (3天) | P0 |
| **R6** | 智能路由 (NBBO+流动性拆分+延迟路由) | 40h (5天) | P0 |
| **R7** | 市场扫描 + 价差警报推送 | 40h (5天) | P1 |
| **R8** | 行情缓存优化 (去重+合并+噪音过滤) | 16h (2天) | P2 |
| **R9+** | 行情回放 + tick数据库 | 40h (5天) | P2 |

---

## 九、给PM的关键建议

1. **优先做深度行情 (OrderBook)** — 做市商/大单用户必须, 所有16家券商都支持, API成熟
2. **智能路由是核心竞争力** — DAWN WHALES 16家券商接入的价值在于"跨券商最优执行", 没有智能路由就是浪费了多券商能力
3. **价差警报做移动端推送** — Telegram/飞书通知, 让用户不用盯盘也能收到套利机会
4. **行情缓存必须做** — 16家并发推送对前端是压力, 不缓存会有UI卡顿
5. **不要贪多** — R5深度行情 + R6智能路由 就够了, R7/R8/R9可以排后

---

**总结**: 行情是交易平台的核心。当前已有基础行情(K线+Ticker+推送), 下一步**必须做深度行情**和**智能路由**, 才能真正释放16家券商接入的价值。
