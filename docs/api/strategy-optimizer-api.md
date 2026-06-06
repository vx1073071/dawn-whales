# StrategyOptimizer API 文档

**Phase**: 5.0 R39  
**文件**: `electron/engine/strategy-optimizer.ts` (814 行)  
**作者**: JVS  
**审查**: dao (94%)  

---

## 概述

StrategyOptimizer 多目标策略参数优化引擎，支持 3 种优化模式和 5 种优化目标。

---

## 类型定义

### OptimizationMode

```typescript
type OptimizationMode = 'grid_search' | 'random_search' | 'bayesian';
```

### OptimizationObjective

```typescript
type OptimizationObjective = 'sharpe' | 'return' | 'drawdown' | 'win_rate' | 'composite';
```

### OptimizationStatus

```typescript
type OptimizationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';
```

### ParamSpec

```typescript
interface ParamSpec {
  name: string;
  min: number;
  max: number;
  step: number;
  default: number;
  description?: string;
}
```

### ObjectiveWeights

```typescript
interface ObjectiveWeights {
  sharpe: number;     // weight for Sharpe ratio (higher is better)
  return: number;     // weight for total return (higher is better)
  drawdown: number;   // weight for max drawdown (lower is better, penalty)
  winRate: number;    // weight for win rate (higher is better)
}
```

### OptimizationConfig

```typescript
interface OptimizationConfig {
  mode: OptimizationMode;
  objectives: OptimizationObjective;
  weights: ObjectiveWeights;
  maxIterations: number;
  maxEvaluations: number;
  randomSeed?: number;
  convergenceThreshold: number;
  earlyStopIterations: number;
  parallelEvaluations: number;
}
```

### EvalResult

```typescript
interface EvalResult {
  params: Record<string, number>;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  fitness: number;
  evaluationTimeMs: number;
}
```

### OptimizationResult

```typescript
interface OptimizationResult {
  mode: OptimizationMode;
  status: OptimizationStatus;
  bestParams: Record<string, number>;
  bestFitness: number;
  bestEvaluation: EvalResult;
  totalEvaluations: number;
  totalIterations: number;
  durationMs: number;
  history: EvalResult[];
  paretoFront: EvalResult[];
  convergenceReached: boolean;
  statistics: {
    meanFitness: number;
    stdFitness: number;
    minFitness: number;
    maxFitness: number;
    improvementRate: number;
  };
}
```

---

## StrategyOptimizer 类

### 构造函数

```typescript
constructor(config?: Partial<OptimizationConfig>)
```

### 配置方法

#### setParamSpecs(specs)
设置参数规格。

```typescript
setParamSpecs(specs: ParamSpec[]): void
```

#### setEvaluateFunction(fn)
设置回测评估函数。

```typescript
setEvaluateFunction(fn: (params: Record<string, number>) => EvalResult): void
```

#### setConfig(config)
更新优化配置。

```typescript
setConfig(config: Partial<OptimizationConfig>): void
```

### 核心方法

#### start()
开始优化。

```typescript
async start(): Promise<OptimizationResult>
```

#### pause()
暂停优化。

```typescript
pause(): void
```

#### resume()
恢复优化。

```typescript
resume(): Promise<OptimizationResult>
```

#### cancel()
取消优化。

```typescript
cancel(): void
```

#### getProgress()
获取优化进度。

```typescript
getProgress(): OptimizationProgress
```

#### getResult()
获取优化结果。

```typescript
getResult(): OptimizationResult | null
```

#### getHeatmapData(paramX, paramY)
获取热力图数据。

```typescript
getHeatmapData(paramX: string, paramY: string): HeatmapData
```

#### reset()
重置引擎状态。

```typescript
reset(): void
```

---

## 优化算法

### Grid Search (网格搜索)
- 穷举所有参数组合
- 适合参数空间小的场景
- 时间复杂度: O(Π(range/step))

### Random Search (随机搜索)
- 随机采样参数空间
- 适合参数空间大的场景
- 时间复杂度: O(maxEvaluations)

### Bayesian (贝叶斯优化)
- 简化版代理模型
- 探索率: 0.3, 开发率: 0.7
- 适合昂贵评估函数

---

## 适应度函数

```typescript
fitness = weights.sharpe * sharpe + weights.return * return - weights.drawdown * drawdown + weights.winRate * winRate
```

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `config:params` | 参数设置 | `{ specs }` |
| `optimization:start` | 优化开始 | `{ mode }` |
| `optimization:progress` | 进度更新 | `OptimizationProgress` |
| `optimization:complete` | 优化完成 | `OptimizationResult` |
| `optimization:cancelled` | 优化取消 | `{ reason }` |
| `optimization:error` | 优化错误 | `{ error }` |

---

**文档生成**: dao  
**时间**: 2026-06-07T04:46:00+08:00
