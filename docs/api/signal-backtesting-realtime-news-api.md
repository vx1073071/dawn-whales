# DAWN WHALES 引擎文档: Signal Backtesting + Realtime News

**版本**: v1.9.0-alpha
**日期**: 2026-06-09
**轮次**: R78 — 引擎补全

---

# 第一部分: Signal Backtesting 信号回测引擎

## 概述

`signal-backtesting.ts` 将策略信号与真实历史 K 线对齐，计算 BUY→SELL 闭环收益。从 27 行 stub 补全为完整引擎。

## 数据流

```
策略信号流 → [BUY@T1, SELL@T2, ...]
                  ↓
历史K线数据   → [T1 开盘价, T2 收盘价, ...]
                  ↓
          PnL 计算 (含手续费)
                  ↓
      SignalBacktestResult
```

## API 参考

### `signalBacktest(signals, kline, options?): SignalBacktestResult`

```typescript
interface SignalBacktestOptions {
  /** 单笔手续费率 (默认 0.001 = 0.1%) */
  commissionRate?: number;
  /** 最小持有周期 (K线根数) */
  minHoldingBars?: number;
  /** 初始资金 */
  initialCapital?: number;
}

interface SignalTrade {
  entryTime: number;      // 入场时间戳
  exitTime: number;       // 出场时间戳
  entryPrice: number;     // 入场价
  exitPrice: number;      // 出场价
  direction: 'LONG' | 'SHORT';
  quantity: number;
  pnl: number;            // 单笔盈亏 (USDT)
  pnlPct: number;         // 单笔盈亏%
  commission: number;     // 手续费
  holdingBars: number;    // 持仓 K 线数
}

interface SignalBacktestResult {
  /** 总盈亏 (USDT) */
  pnl: number;
  /** 总盈亏% */
  pnlPct: number;
  /** 胜率 (0-1) */
  winRate: number;
  /** 盈亏比 (总盈利/总亏损绝对值) */
  profitFactor: number;
  /** 最大回撤% */
  maxDrawdown: number;
  /** 夏普比率 */
  sharpe: number;
  /** 卡玛比率 */
  calmar: number;
  /** 总交易次数 */
  totalTrades: number;
  /** 盈利交易次数 */
  winningTrades: number;
  /** 亏损交易次数 */
  losingTrades: number;
  /** 平均盈利% */
  avgWinPct: number;
  /** 平均亏损% */
  avgLossPct: number;
  /** 最大单笔盈利% */
  maxWinPct: number;
  /** 最大单笔亏损% */
  maxLossPct: number;
  /** 逐笔交易详情 */
  trades: SignalTrade[];
  /** 逐日净值曲线 */
  equityCurve: { time: number; value: number }[];
}
```

### 使用示例

```typescript
import { signalBacktest } from './signal-backtesting';

// 策略信号
const signals = [
  { time: 1700000000, type: 'BUY', symbol: 'AAPL', price: 180 },
  { time: 1700100000, type: 'SELL', symbol: 'AAPL', price: 190 },
];

// 历史K线 (日线)
const kline = [
  { time: 1700000000, open: 180, close: 185, high: 186, low: 179 },
  { time: 1700086400, open: 185, close: 190, high: 192, low: 184 },
];

const result = signalBacktest(signals, kline, {
  commissionRate: 0.001, // 0.1%
  initialCapital: 10000,
});

console.log(`PnL: ${result.pnl} USDT`);
console.log(`Win Rate: ${(result.winRate * 100).toFixed(1)}%`);
console.log(`Sharpe: ${result.sharpe.toFixed(2)}`);
console.log(`Max DD: ${result.maxDrawdown.toFixed(1)}%`);
```

### 核心算法

**1. 信号对齐**: BUY 信号匹配下一个 K 线开盘价；SELL 信号匹配当前 K 线收盘价。

**2. PnL 计算**:
```
LONG:  pnl = (exitPrice - entryPrice) × quantity - commission
SHORT: pnl = (entryPrice - exitPrice) × quantity - commission
```

**3. 净值曲线**: 初始资金 + 逐笔累计盈亏，用于计算最大回撤。

**4. 夏普比率**: `(年化收益 - 无风险利率) / 年化波动率`

**5. 最大回撤**: `max((峰值净值 - 当前净值) / 峰值净值)`

### 边界处理

| 场景 | 处理 |
|------|------|
| 无信号 | 返回空结果 (0 PnL, 0 trades) |
| 只有 BUY 无 SELL | 最后 BUY 保留为未平仓，不参与 PnL |
| 连续同向信号 | 忽略重复信号 (BUY→BUY 只保留第一个) |
| K 线不足 | 信号对齐失败时返回 null trade，标记 `incomplete: true` |
| 空 K 线 | 抛出 `InvalidInputError` |

---

# 第二部分: Realtime News 实时新闻引擎

## 概述

`realtime-news.ts` 从 NewsAPI + 东方财富双源聚合实时财经新闻，去重排序并打分情绪。从 40 行 stub 补全为完整引擎。

## 架构

```
NewsAPI ──→ ┐
             ├──→ 聚合器 (去重/合并/排序) ──→ RealtimeNewsItem[]
东方财富 ──→ ┘                                      │
                                                    ├──→ 情绪打分 (-100~+100)
                                                    ├──→ 标的关联 (symbols[])
                                                    └──→ WebSocket 推送
```

## API 参考

### `fetchRealtimeNews(symbols?, options?): Promise<RealtimeNewsItem[]>`

```typescript
interface RealtimeNewsOptions {
  /** 每数据源最大条数 (默认 20) */
  limit?: number;
  /** 时间范围 (默认 24h) */
  sinceMs?: number;
  /** 关键词过滤 (可选) */
  keywords?: string[];
  /** 是否启用情绪打分 (默认 true) */
  sentiment?: boolean;
}

interface RealtimeNewsItem {
  /** 唯一 ID (source+url hash) */
  id: string;
  /** 数据源 */
  source: 'NewsAPI' | 'eastmoney';
  /** 标题 */
  title: string;
  /** 摘要 */
  summary: string;
  /** 原文 URL */
  url: string;
  /** 关联标的 */
  symbols: string[];
  /** 情绪分 (-100=极空 → +100=极多) */
  sentiment: number;
  /** 情绪标签 */
  sentimentLabel: 'positive' | 'negative' | 'neutral';
  /** 发布时间戳 */
  timestamp: number;
  /** 是否重复 (与已有新闻去重) */
  isDuplicate: boolean;
}

interface NewsStreamCallback {
  (item: RealtimeNewsItem): void;
}
```

### `subscribeNewsStream(symbols, callback): () => void`

```typescript
// 订阅 AAPL 实时新闻推送
const unsubscribe = subscribeNewsStream(['AAPL'], (news) => {
  console.log(`[${news.sentimentLabel}] ${news.title}`);
  console.log(`  情绪分: ${news.sentiment}`);
});

// 取消订阅
unsubscribe();
```

### 使用示例

```typescript
import { fetchRealtimeNews, subscribeNewsStream } from './realtime-news';

// 拉取最近 4 小时 AAPL 相关新闻
const news = await fetchRealtimeNews(['AAPL'], {
  limit: 10,
  sinceMs: 4 * 3600 * 1000,
  sentiment: true,
});

news.forEach(item => {
  console.log(`[${item.source}] ${item.title}`);
  console.log(`  情绪: ${item.sentiment} (${item.sentimentLabel})`);
  console.log(`  标的: ${item.symbols.join(', ')}`);
});
```

### 双源聚合规则

| 优先级 | 数据源 | 用途 | 延迟 |
|--------|--------|------|------|
| 1 | NewsAPI | 全球英文财经新闻 | ~15min |
| 2 | 东方财富 | A股/港股中文新闻 | ~5min |

**去重**: 标题相似度 > 85% → 标记为重复，保留先到的。

**合并**: 同一标的的多源新闻合并为一条，`source` 字段记录主要来源。

### 情绪打分算法

```
正向词库: 上涨, 突破, 利好, 回购, 增持, 盈利增长, 超预期 ...
负向词库: 下跌, 破位, 利空, 减持, 亏损, 预警, 不及预期 ...

情绪分 = (正向词命中数 - 负向词命中数) / (总命中数 + 1) × 100
边界: -100 (完全负面) ~ +100 (完全正面)
0 = 中性或无法判断
```

### 数据源配置

```typescript
// .env
NEWSAPI_KEY=your_newsapi_key
EASTMONEY_ENABLED=true  // 东方财富 (港股)

// API 地址
const NEWSAPI_URL = 'https://newsapi.org/v2/everything';
const EASTMONEY_URL = 'https://push2.eastmoney.com/api/news';
```

### 边界处理

| 场景 | 处理 |
|------|------|
| NewsAPI 不可用 | 自动降级，仅用东方财富 |
| 东方财富不可用 | 自动降级，仅用 NewsAPI |
| 双源均不可用 | 返回空数组 + 日志告警 |
| 速率限制 (429) | 退避重试 (1s/2s/4s) |
| 无相关新闻 | 返回空数组 (非错误) |
| 符号格式不一致 | 自动标准化 (BABA.N → BABA) |

---

## 数据源对比

| 维度 | NewsAPI | 东方财富 |
|------|---------|----------|
| 覆盖市场 | 全球 (英文) | A股/港股 (中文) |
| 免费层 | 100 req/day | 无限制 |
| 延迟 | ~15min | ~5min |
| 情绪分析 | ❌ 无 | ❌ 无 (我们自研) |
| 标的关联 | 需手动解析 | 有标的标签 |

---

**R78 引擎补全: 2 个 stub → 完整引擎 + 完整文档。与 JVS 代码同步。**
