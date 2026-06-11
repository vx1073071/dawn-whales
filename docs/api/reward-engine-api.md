<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# RewardEngine API 文档

**Phase**: 4.4 R38  
**文件**: `electron/engine/reward-engine.ts` (655 行)  
**作者**: JVS  
**审查**: dao (94%)  

---

## 概述

RewardEngine 计算交易动作的奖励值，支持 RL 策略优化。支持 5 种奖励类型和 3 种奖励塑形模式。

---

## 类型定义

### RewardType

```typescript
type RewardType =
  | 'pnl'               // 纯盈亏奖励
  | 'sharpe'            // 夏普比率奖励
  | 'risk_adjusted'     // 风险调整奖励
  | 'drawdown_penalty'  // 回撤惩罚
  | 'composite';        // 复合奖励 (多目标加权)
```

### RewardShaping

```typescript
type RewardShaping =
  | 'sparse'           // 稀疏奖励 (仅终端)
  | 'dense'            // 密集奖励 (每步)
  | 'potential_based'; // 势能奖励
```

### TradeAction

```typescript
interface TradeAction {
  action: 'buy' | 'sell' | 'hold';
  code: string;
  quantity: number;
  price: number;
  timestamp: number;
  strategyId: string;
}
```

### MarketState

```typescript
interface MarketState {
  code: string;
  price: number;
  volume: number;
  rsi?: number;
  trend: 'up' | 'down' | 'sideways';
  volatility: number;
  timestamp: number;
}
```

### RewardResult

```typescript
interface RewardResult {
  action: string;
  reward: number;
  components: Record<string, number>;
  shaping: RewardShaping;
  timestamp: number;
}
```

### RewardConfig

```typescript
interface RewardConfig {
  type: RewardType;
  shaping: RewardShaping;
  pnlWeight: number;            // default: 1.0
  sharpeWeight: number;         // default: 0.5
  drawdownPenalty: number;      // default: -0.5
  transactionCostPenalty: number; // default: -0.01
  holdPenalty: number;          // default: -0.001
  gamma: number;                // discount factor, default: 0.99
}
```

### EpisodeResult

```typescript
interface EpisodeResult {
  episodeId: string;
  totalReward: number;
  steps: number;
  avgReward: number;
  bestAction: string;
  worstAction: string;
  rewards: RewardResult[];
}
```

---

## RewardEngine 类

### 构造函数

```typescript
constructor(config?: Partial<RewardConfig>)
```

### 核心方法

#### startEpisode(strategyId)
开始新 episode。

```typescript
startEpisode(strategyId: string): string // returns episodeId
```

#### recordAction(action, marketState)
记录交易动作并计算奖励。

```typescript
recordAction(action: TradeAction, market: MarketState): RewardResult
```

#### endEpisode()
结束当前 episode。

```typescript
endEpisode(): EpisodeResult
```

#### getEpisodeHistory()
获取 episode 历史。

```typescript
getEpisodeHistory(): EpisodeResult[]
```

#### getAverageReward(n?)
获取最近 n 个 episode 的平均奖励。

```typescript
getAverageReward(n?: number): number
```

#### getBestEpisode()
获取最佳 episode。

```typescript
getBestEpisode(): EpisodeResult | null
```

#### reset()
重置引擎状态。

```typescript
reset(): void
```

---

## 奖励计算

### PnL Reward
```
reward = (exitPrice - entryPrice) * quantity / entryPrice
```

### Sharpe Reward
```
reward = mean(returns) / stddev(returns) * sqrt(252)
```

### Risk-Adjusted Reward
```
reward = pnl - drawdownPenalty * maxDrawdown
```

### Composite Reward
```
reward = pnlWeight * pnlReward + sharpeWeight * sharpeReward + drawdownPenalty * drawdown + transactionCostPenalty * trades + holdPenalty * holdSteps
```

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `episode:start` | Episode 开始 | `{ episodeId, strategyId }` |
| `action:rewarded` | 动作奖励计算 | `RewardResult` |
| `episode:end` | Episode 结束 | `EpisodeResult` |
| `episode:best` | 新最佳 Episode | `EpisodeResult` |

---

**文档生成**: dao  
**时间**: 2026-06-07T04:12:00+08:00
