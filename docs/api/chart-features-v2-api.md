# Chart Features v2 — R113-R120 Type System

> 📄 **R113-R120** | QClaw (document-shrimp) | 2026-06-12
>
> Covers: KlineBar, IndicatorEngine, DrawingTools, DepthTypes, ScannerTypes, PatternRecognition

---

## Table of Contents

1. [Kline & Core Types](#1-kline--core-types)
2. [Indicator System](#2-indicator-system)
3. [Drawing Tools](#3-drawing-tools)
4. [Depth & OrderBook](#4-depth--orderbook)
5. [Scanner & FundFlow](#5-scanner--fundflow)
6. [Pattern Recognition](#6-pattern-recognition)
7. [Chart Bridge & IPC](#7-chart-bridge--ipc)

---

## 1. Kline & Core Types

**File**: `src/lib/chart/types.ts` (962L)

### KlineBar

```typescript
export interface KlineBar {
  time: number;        // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;   // HK stocks
}
```

### Timeframes

```
1s | 1m | 5m | 15m | 30m | 1h | 4h | D | W | M | Q | Y
```

12 timeframes total. UI helper `ALL_TIMEFRAMES` array + `TIMEFRAME_LABELS` (中文).

### Adjustment & Candle Types

- `AdjustType`: `'none'` | `'pre'` | `'post'`
- `CandleType`: `'candle'` | `'hollow'` | `'heikin-ashi'` | `'line'` | `'area'` | `'renko'` | `'kagi'`

### Chart Theme

```typescript
interface ChartTheme {
  background: string;
  textColor: string;
  gridColor: string;
  upColor: string;     // '#22c55e'
  downColor: string;   // '#ef4444'
  crosshairColor: string;
}
```

Pre-built themes: `CHART_THEME_DARK` (default), `CHART_THEME_LIGHT`.

---

## 2. Indicator System

**File**: `src/lib/chart/indicator-engine.ts` (Engine, 500+L)
**File**: `src/lib/chart/types.ts` (TypeDefs)

### IndicatorDef

```typescript
interface IndicatorDef {
  id: string;                    // e.g. 'ma', 'macd', 'rsi'
  name: string;                  // 中文名称
  category: 'overlay' | 'sub';  // overlay=叠加在主图, sub=子图
  group?: string;                // 趋势/动量/波动/量价
  params: IndicatorParams;
  priority?: number;             // display order
}
```

### 20 Core Indicators (P0)

| ID | Name | Category | Group |
|----|------|----------|-------|
| `ma` | MA 移动平均 | overlay | 趋势 |
| `ema` | EMA 指数平均 | overlay | 趋势 |
| `boll` | BOLL 布林带 | overlay | 趋势 |
| `sar` | SAR 抛物线 | overlay | 趋势 |
| `vwap` | VWAP 均价 | overlay | 趋势 |
| `ichimoku` | 一目均衡 | overlay | 趋势 |
| `macd` | MACD | sub | 动量 |
| `rsi` | RSI 相对强弱 | sub | 动量 |
| `kdj` | KDJ 随机指标 | sub | 动量 |
| `cci` | CCI 商品通道 | sub | 动量 |
| `wr` | WR 威廉指标 | sub | 动量 |
| `mom` | MOM 动量线 | sub | 动量 |
| `roc` | ROC 变动率 | sub | 动量 |
| `atr` | ATR 真实波幅 | sub | 波动 |
| `bb_width` | 布林带宽 | sub | 波动 |
| `squeeze` | SQZ 挤压 | sub | 波动 |
| `obv` | OBV 能量潮 | sub | 量价 |
| `mfi` | MFI 资金流量 | sub | 量价 |
| `dmi` | DMI 趋向 | sub | 趋势 |
| `bias` | BIAS 乖离率 | sub | 趋势 |

### IndicatorResult

```typescript
interface IndicatorResult {
  indicatorId: string;
  type: 'overlay' | 'separator';  // 分离器指标(DMI/ADX)需要type字段
  values: (number | null)[];
  label?: string;
  color?: string;
}
```

### Extended (80+)

`EXTENDED_INDICATOR_REFS` in `types.ts` lists 80+ additional indicators including TRIX, BBI, ARBR, PSY, VR, OBV-MA, EMV, WVAD, etc.

### IPC

```typescript
interface IndicatorRequest {
  symbol: string;
  indicatorId: string;
  bars: KlineBar[];
  params?: Record<string, number>;
}
```

---

## 3. Drawing Tools

**Files**: `src/lib/chart/drawing-types.ts` (22KB), `src/lib/chart/drawing-tools.ts`

### 68 Drawing Tools (P0 20 + P1 48)

#### P0 (20 tools)

| Category | Tools |
|----------|-------|
| 线段/射线 | Line, Ray, Arrow, ExtendedLine |
| 水平线 | HorizontalLine, HorizontalRay |
| 通道 | ParallelChannel, LinearRegression |
| 趋势 | TrendLine, TrendAngle |
| 斐波那契 | FibonacciRetracement, FibonacciExtension, FibonacciTimeZone, FibonacciArc, FibonacciFan |
| 标注 | Text, Note, Callout |
| 形状 | Rectangle |

#### P1 (48 tools)

Includes: GannFan, Pitchfork, ElliottWave, Cycles, XABCD Pattern, Measurement tools, etc.

### DrawingState

```typescript
interface DrawingState {
  tool: DrawingToolType;
  points: Point[];           // anchor points
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  fillColor?: string;
  opacity?: number;
  text?: string;
  fontSize?: number;
  locked?: boolean;
  visible?: boolean;
}
```

---

## 4. Depth & OrderBook

**File**: `src/lib/chart/depth-types.ts` (602L, 16KB)

### OrderBookSnapshot

```typescript
interface OrderBookSnapshot {
  brokerId: string;
  symbol: string;
  bids: OrderBookLevel[];   // buy side, sorted by price DESC
  asks: OrderBookLevel[];   // sell side, sorted by price ASC
  timestamp: number;
  updateId?: number;
}
```

### OrderBookLevel

```typescript
interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount?: number;
}
```

### BrokerQueueInfo

```typescript
interface BrokerQueueInfo {
  bidBrokers: { brokerId: string; volume: number }[];  // top N buy brokers
  askBrokers: { brokerId: string; volume: number }[];  // top N sell brokers
}
```

### TickInfo

```typescript
interface TickInfo {
  time: number;
  price: number;
  volume: number;
  direction: 'buy' | 'sell' | 'neutral';
  type?: 'auction' | 'trade';  // 集合竞价 vs 连续交易
}
```

### CBBO (Consolidated Best Bid/Offer)

```typescript
interface CBBO {
  symbol: string;
  bestBid: { price: number; brokerId: string; quantity: number };
  bestAsk: { price: number; brokerId: string; quantity: number };
  spread: number;
  spreadPct: number;
  timestamp: number;
  brokerCount: number;  // 参与CBBO的券商数量
}
```

---

## 5. Scanner & FundFlow

**File**: `src/lib/chart/scanner-types.ts` (547L, 15KB)

### MarketScannerQuery

```typescript
interface MarketScannerQuery {
  name?: string;
  market?: 'HK' | 'US' | 'CN' | 'all';
  conditions: ScanCondition[];
  logic?: 'AND' | 'OR';
  sort?: ScanSort;
  limit?: number;
  minVolume?: number;
  minTurnover?: number;
}
```

### 11 Preset Scanners

| ID | Name | Market |
|----|------|--------|
| `breakout_volume` | 放量突破 | All |
| `oversold_reversal` | 超跌反弹 | All |
| `gap_up` | 跳空高开 | All |
| `new_high` | 创历史新高 | All |
| `volume_spike` | 成交量异动 | All |
| `hk_leaders` | 港股龙头 | HK |
| `us_tech` | 美股科技 | US |
| `a_blue_chip` | A股蓝筹 | CN |
| `small_cap_breakout` | 小盘突破 | All |
| `dividend_play` | 高股息 | All |
| `momentum_leaders` | 动量领先 | All |

### FundFlow

```typescript
interface FundFlowSnapshot {
  symbol: string;
  superLargeNet: number;   // 特大单净流入
  largeNet: number;        // 大单净流入
  mediumNet: number;       // 中单净流入
  smallNet: number;        // 小单净流入
  totalNet: number;        // 总净流入
  timestamp: number;
}
```

### Alert System

| AlertType | Description |
|-----------|-------------|
| `price` | 价格突破 |
| `volume` | 成交量异动 |
| `indicator` | 指标触发 |
| `pattern` | 形态完成 |
| `fund_flow` | 资金流向 |
| `arbitrage` | 套利机会 |
| `news` | 新闻事件 |
| `circuit_breaker` | 熔断 |

4 notification channels: `system` | `telegram` | `feishu` | `email` | `sound`

---

## 6. Pattern Recognition

**Files**: `src/lib/chart/pattern-recognition.ts` (492L) + `pattern-detectors.ts` (791L)

### 20 Chart Patterns

**Bullish (10)**:
| Pattern | 中文 |
|---------|------|
| Double Bottom | W底 |
| Head & Shoulders Bottom | 头肩底 |
| Rounding Bottom | 圆底 |
| V Bottom | V形底 |
| Inverted V | 倒V |
| Triple Bottom | 三重底 |
| Ascending Triangle | 上升三角形 |
| Flag (Bull) | 上升旗形 |
| Wedge (Falling, Reversal) | 楔形反转 |
| Broadening Bottom | 扩张底部 |

**Bearish (10)**:
| Pattern | 中文 |
|---------|------|
| Double Top | M顶 |
| Head & Shoulders Top | 头肩顶 |
| Rounding Top | 圆顶 |
| Inverted V | 倒V顶 |
| Triple Top | 三重顶 |
| Descending Triangle | 下降三角形 |
| Flag (Bear) | 下降旗形 |
| Wedge (Rising, Reversal) | 楔形反转 |
| Broadening Top | 扩张顶部 |
| Diamond Top | 钻石顶 |

### 31 Candlestick Patterns

Includes: Doji, Hammer, HangingMan, Engulfing, MorningStar, EveningStar, ThreeWhiteSoldiers, ThreeBlackCrows, etc.

### Algorithm

- **ZigZag** extreme point detection
- **Geometric matching** (neckline, slope, ratio validation)
- **Tolerance**: 3% for price proximity, 10% for time symmetry
- **Confidence**: 0-1 based on geometric precision

---

## 7. Chart Bridge & IPC

**File**: `src/lib/chart/broker-chart-bridge.ts`

Connects `src/lib/chart/` engines to `electron/broker/` data.

### Data Flow

```
electron/broker/ (V2 adapters, BrokerManagerV2)
    ↓ IPC
src/lib/chart/broker-chart-bridge.ts
    ↓ type-safe bridges
src/lib/chart/ engines (orderbook, depth, cbbo, scanner, fund-flow, pattern)
    ↓ React hooks
src/components/chart/ (KLineChartPro, OrderBookWaterfall, CBBOPanel, etc.)
```

### New IPC Channels (R114-R115)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `depth:subscribe` | renderer → main | Subscribe to depth feed |
| `depth:unsubscribe` | renderer → main | Unsubscribe |
| `scanner:run` | renderer → main | Execute scanner query |
| `scanner:save` | renderer → main | Save preset scanner |
| `fundflow:get` | renderer → main | Get fund flow data |
| `alert:create` | renderer → main | Create alert rule |
| `alert:history` | renderer → main | Get alert history |

---

## Integration Examples

### Display OrderBook in UI

```typescript
import { OrderBookEngine } from '../../lib/chart/orderbook-engine';

const engine = new OrderBookEngine();
engine.subscribe('HK.00700', (snapshot: OrderBookSnapshot) => {
  // Render waterfall chart
  setBids(snapshot.bids);
  setAsks(snapshot.asks);
});
```

### Run Scanner Query

```typescript
import type { MarketScannerQuery } from '../../lib/chart/scanner-types';

const query: MarketScannerQuery = {
  market: 'HK',
  conditions: [
    { field: 'changePct', operator: 'gt', value: 5 },
    { field: 'volume', operator: 'gt', value: 10000000 },
  ],
  logic: 'AND',
  limit: 20,
};
```

### Detect Patterns

```typescript
import { detectAllPatterns } from '../../lib/chart/pattern-recognition';

const patterns = detectAllPatterns(klines, {
  zigzagThreshold: 0.05,  // 5% reversal threshold
  minBars: 20,
});
// patterns: ChartPattern[] with type, confidence, key points
```

---

## Files Reference

| File | Size | Round |
|------|------|-------|
| `src/lib/chart/types.ts` | 962L | R113 |
| `src/lib/chart/drawing-types.ts` | ~650L | R113 |
| `src/lib/chart/drawing-tools.ts` | ~500L | R113 |
| `src/lib/chart/indicator-engine.ts` | ~500L | R113 |
| `src/lib/chart/depth-types.ts` | 602L | R114 |
| `src/lib/chart/scanner-types.ts` | 547L | R115 |
| `src/lib/chart/pattern-recognition.ts` | 492L | R114 + R119 |
| `src/lib/chart/pattern-detectors.ts` | 791L | R119 |
| `src/lib/chart/broker-ui-types.ts` | 520L | R120 |

---

> **TSC**: `npx tsc --noEmit` EXIT:0 — All chart types compile cleanly.
> **Author**: QClaw · **Rounds**: R113-R120
