# StrategyRankingEngine API 文档

**Phase**: 5.0 R41  
**文件**: `electron/engine/strategy-ranking-engine.ts` (503 行)  
**作者**: JVS  
**审查**: 待审查  

---

## 概述

StrategyRankingEngine 多维度策略排名引擎，支持 8 个维度的加权评分和 S/A/B/C/D 分级。

---

## 类型定义

### StrategyMetrics

```typescript
interface StrategyMetrics {
  strategyId: string;
  name: string;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  calmar: number;
  sortino: number;
  profitFactor: number;
  avgHoldingDays: number;
}
```

### RankingDimension

```typescript
type RankingDimension =
  | 'sharpe'
  | 'return'
  | 'drawdown'
  | 'winRate'
  | 'calmar'
  | 'sortino'
  | 'profitFactor'
  | 'consistency';
```

### RankingConfig

```typescript
interface RankingConfig {
  dimensions: RankingDimension[];
  weights: Record<string, number>;    // dimension -> weight (sum to 1)
  minTrades: number;
  minHistoryDays: number;
}
```

### StrategyRank

```typescript
interface StrategyRank {
  strategyId: string;
  name: string;
  rank: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  score: number;                      // 0-100
  dimensionScores: Record<RankingDimension, number>;
  metrics: StrategyMetrics;
}
```

### RankingResult

```typescript
interface RankingResult {
  rankings: StrategyRank[];
  totalStrategies: number;
  calculatedAt: number;
  config: RankingConfig;
}
```

---

## StrategyRankingEngine 类

### 构造函数

```typescript
constructor(config?: Partial<RankingConfig>)
```

### 核心方法

#### rankStrategies(metrics)
对策略进行排名。

```typescript
rankStrategies(metrics: StrategyMetrics[]): RankingResult
```

#### getTopStrategies(metrics, n?)
获取前 N 名策略。

```typescript
getTopStrategies(metrics: StrategyMetrics[], n?: number): StrategyRank[]
```

#### compareStrategies(metrics, id1, id2)
对比两个策略。

```typescript
compareStrategies(
  metrics: StrategyMetrics[],
  id1: string,
  id2: string
): { winner: string; details: Record<RankingDimension, { id1: number; id2: number; winner: string }> }
```

### 配置方法

#### setConfig(config)
更新排名配置。

```typescript
setConfig(config: Partial<RankingConfig>): void
```

#### getConfig()
获取当前配置。

```typescript
getConfig(): RankingConfig
```

#### setWeights(weights)
设置维度权重。

```typescript
setWeights(weights: Record<string, number>): void
```

---

## 排名维度

| 维度 | 说明 | 默认权重 |
|-----|------|---------|
| sharpe | 夏普比率 | 0.20 |
| return | 总收益率 | 0.15 |
| drawdown | 最大回撤（负向） | 0.15 |
| winRate | 胜率 | 0.10 |
| calmar | 卡尔玛比率 | 0.10 |
| sortino | 索提诺比率 | 0.10 |
| profitFactor | 利润因子 | 0.10 |
| consistency | 一致性 | 0.10 |

---

## 分级标准

| 等级 | 分数范围 | 说明 |
|-----|---------|------|
| S | 90-100 | 顶级策略 |
| A | 75-89 | 优秀策略 |
| B | 60-74 | 良好策略 |
| C | 40-59 | 一般策略 |
| D | 0-39 | 较差策略 |

---

## 评分计算

```typescript
// 维度评分（归一化到 0-100）
dimensionScore = normalize(value, min, max) * 100

// 综合评分
totalScore = Σ(dimensionScore * weight)

// 分级
tier = getTier(totalScore)
```

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `ranking:complete` | 排名完成 | `RankingResult` |
| `ranking:updated` | 排名更新 | `RankingResult` |
| `config:changed` | 配置变更 | `RankingConfig` |

---

## 使用示例

```typescript
import { StrategyRankingEngine } from './strategy-ranking-engine';

const engine = new StrategyRankingEngine({
  dimensions: ['sharpe', 'return', 'drawdown', 'winRate'],
  weights: {
    sharpe: 0.3,
    return: 0.25,
    drawdown: 0.25,
    winRate: 0.2,
  },
  minTrades: 10,
  minHistoryDays: 30,
});

const metrics: StrategyMetrics[] = [
  {
    strategyId: 's1',
    name: 'MA Cross',
    sharpe: 1.5,
    totalReturn: 0.25,
    maxDrawdown: -0.10,
    winRate: 0.60,
    tradeCount: 50,
    calmar: 2.5,
    sortino: 1.8,
    profitFactor: 1.5,
    avgHoldingDays: 5,
  },
  // ... more strategies
];

const result = engine.rankStrategies(metrics);
console.log(`Top strategy: ${result.rankings[0].name} (${result.rankings[0].tier})`);
```

---

**文档生成**: dao  
**时间**: 2026-06-07T05:37:00+08:00
