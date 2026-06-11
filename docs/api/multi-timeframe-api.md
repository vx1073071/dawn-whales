<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# MultiTimeframeEngine API 文档

**Phase**: 5.0 R39  
**文件**: `electron/engine/multi-timeframe-engine.ts` (656 行)  
**作者**: JVS  
**审查**: dao (96%)  

---

## 概述

MultiTimeframeEngine 多周期信号融合引擎，支持 7 个时间周期和 3 种融合模式。

---

## 类型定义

### TimeframeKey

```typescript
type TimeframeKey = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
```

### SignalDirection

```typescript
type SignalDirection = 'BUY' | 'SELL' | 'HOLD';
```

### FusionMode

```typescript
type FusionMode = 'majority' | 'weighted' | 'any';
```

### TimeframeSignal

```typescript
interface TimeframeSignal {
  timeframe: TimeframeKey;
  symbol: string;
  direction: SignalDirection;
  strength: number; // 0-100
  timestamp: number;
  strategy?: string;
  metadata?: Record<string, any>;
}
```

### TimeframeConfig

```typescript
interface TimeframeConfig {
  timeframe: TimeframeKey;
  weight: number; // 0-1, importance in fusion
  enabled: boolean;
  minStrength: number; // minimum signal strength to consider
  stalenessMs: number; // max age of signal before considered stale
}
```

### FusionConfig

```typescript
interface FusionConfig {
  mode: FusionMode;
  minTimeframes: number; // minimum timeframes needed for valid fusion
  majorityThreshold: number; // 0.5-1.0, fraction needed for majority
  anyThreshold: number; // minimum strength for 'any' mode
  enableStalenessCheck: boolean;
  defaultStalenessMs: number;
}
```

### FusionResult

```typescript
interface FusionResult {
  symbol: string;
  direction: SignalDirection;
  confidence: number; // 0-100
  strength: number; // 0-100
  contributingTimeframes: TimeframeKey[];
  fusedAt: number;
  mode: FusionMode;
  details: {
    timeframe: TimeframeKey;
    direction: SignalDirection;
    strength: number;
    weight: number;
    isStale: boolean;
  }[];
}
```

### TimeframeStats

```typescript
interface TimeframeStats {
  timeframe: TimeframeKey;
  signalCount: number;
  avgStrength: number;
  lastSignalAt: number;
  staleCount: number;
  directionDistribution: Record<SignalDirection, number>;
}
```

---

## MultiTimeframeEngine 类

### 构造函数

```typescript
constructor(config?: EngineConfig)
```

### 信号输入

#### submitSignal(signal)
提交单个周期信号。

```typescript
submitSignal(signal: TimeframeSignal): void
```

#### submitBatch(signals)
批量提交信号。

```typescript
submitBatch(signals: TimeframeSignal[]): void
```

### 融合方法

#### fuse(symbol)
融合指定标的的信号。

```typescript
fuse(symbol: string): FusionResult | null
```

#### fuseAll()
融合所有标的的信号。

```typescript
fuseAll(): FusionResult[]
```

### 查询方法

#### getSignals(symbol)
获取指定标的的信号。

```typescript
getSignals(symbol: string): Map<TimeframeKey, TimeframeSignal>
```

#### getFusionHistory(symbol, limit?)
获取融合历史。

```typescript
getFusionHistory(symbol: string, limit?: number): FusionResult[]
```

#### getTimeframeStats(timeframe)
获取周期统计。

```typescript
getTimeframeStats(timeframe: TimeframeKey): TimeframeStats
```

#### getAllStats()
获取所有周期统计。

```typescript
getAllStats(): TimeframeStats[]
```

### 配置方法

#### setFusionConfig(config)
设置融合配置。

```typescript
setFusionConfig(config: Partial<FusionConfig>): void
```

#### setTimeframeConfig(timeframe, config)
设置周期配置。

```typescript
setTimeframeConfig(timeframe: TimeframeKey, config: Partial<TimeframeConfig>): void
```

#### enableTimeframe(timeframe, enabled)
启用/禁用周期。

```typescript
enableTimeframe(timeframe: TimeframeKey, enabled: boolean): void
```

#### setTimeframeWeight(timeframe, weight)
设置周期权重。

```typescript
setTimeframeWeight(timeframe: TimeframeKey, weight: number): void
```

### 管理方法

#### clearSignals(symbol?)
清除信号。

```typescript
clearSignals(symbol?: string): void
```

#### clearHistory(symbol?)
清除历史。

```typescript
clearHistory(symbol?: string): void
```

#### reset()
重置引擎。

```typescript
reset(): void
```

---

## 融合模式

### Majority (多数投票)
- >50% 周期同向触发
- 适合趋势确认
- `majorityThreshold` 控制阈值

### Weighted (加权融合)
- 高周期权重更大
- 适合稳健策略
- 权重和为 1.0

### Any (任一触发)
- 任一周期满足阈值触发
- 适合敏感策略
- `anyThreshold` 控制强度

---

## 默认配置

```typescript
// 周期权重
'1m':  0.05  // 最低权重
'5m':  0.10
'15m': 0.15
'30m': 0.15
'1h':  0.20
'4h':  0.20
'1d':  0.15  // 日级较高权重

// 陈旧检测
'1m':  120_000ms    // 2 分钟
'5m':  300_000ms    // 5 分钟
'15m': 900_000ms    // 15 分钟
'30m': 1_800_000ms  // 30 分钟
'1h':  3_600_000ms  // 1 小时
'4h':  14_400_000ms // 4 小时
'1d':  86_400_000ms // 1 天
```

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `signal:received` | 信号接收 | `TimeframeSignal` |
| `fusion:result` | 融合完成 | `FusionResult` |
| `fusion:insufficient` | 信号不足 | `{ symbol, count }` |
| `config:updated` | 配置更新 | `{ config }` |
| `timeframe:enabled` | 周期启用 | `{ timeframe }` |
| `timeframe:disabled` | 周期禁用 | `{ timeframe }` |

---

**文档生成**: dao  
**时间**: 2026-06-07T04:47:00+08:00
