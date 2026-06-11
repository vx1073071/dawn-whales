<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# AdaptiveParamEngine API 文档

**Phase**: 4.4 R38  
**文件**: `electron/engine/adaptive-param-engine.ts` (1296 行)  
**作者**: JVS  
**审查**: dao (92%)  

---

## 概述

AdaptiveParamEngine 根据历史表现数据自动调整策略参数，支持 5 种优化方法和 3 种适应模式。

---

## 类型定义

### OptimizationMethod

```typescript
type OptimizationMethod =
  | 'grid_search'      // 网格搜索（穷举）
  | 'random_search'    // 随机搜索
  | 'gradient_descent' // 梯度下降
  | 'bayesian'         // 贝叶斯优化
  | 'genetic';         // 遗传算法
```

### AdaptationMode

```typescript
type AdaptationMode = 'conservative' | 'balanced' | 'aggressive';
// conservative: rate=0.1 (慢速稳定)
// balanced:     rate=0.3 (平衡)
// aggressive:   rate=0.5 (快速激进)
```

### ParamRange

```typescript
interface ParamRange {
  name: string;     // 参数名
  min: number;      // 最小值
  max: number;      // 最大值
  step: number;     // 步长
  current: number;  // 当前值
}
```

### OptimizationResult

```typescript
interface OptimizationResult {
  method: OptimizationMethod;
  bestParams: Record<string, number>;
  bestFitness: number;
  iterations: number;
  durationMs: number;
  history: {
    iteration: number;
    fitness: number;
    params: Record<string, number>;
  }[];
}
```

### PerformanceRecord

```typescript
interface PerformanceRecord {
  timestamp: number;
  params: Record<string, number>;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  winRate: number;
  totalReturn: number;
  tradeCount: number;
}
```

### AdaptationConfig

```typescript
interface AdaptationConfig {
  method: OptimizationMethod;    // 优化方法
  mode: AdaptationMode;          // 适应模式
  maxIterations: number;         // 最大迭代次数 (default: 200)
  lookbackPeriod: number;        // 回看周期 (default: 50)
  adaptationRate: number;        // 适应速率 0-1 (default: 0.3)
  minImprovement: number;        // 最小改进阈值 (default: 0.01)
  cooldownPeriod: number;        // 冷却期秒数 (default: 60)
}
```

### AdaptationLogEntry

```typescript
interface AdaptationLogEntry {
  timestamp: number;
  oldParams: Record<string, number>;
  newParams: Record<string, number>;
  improvement: number;
}
```

---

## AdaptiveParamEngine 类

### 构造函数

```typescript
constructor(config?: Partial<AdaptationConfig>)
```

### 核心方法

#### setParamRanges(ranges)
设置参数范围。

```typescript
setParamRanges(ranges: ParamRange[]): void
```

#### addPerformanceRecord(record)
添加表现记录。

```typescript
addPerformanceRecord(record: PerformanceRecord): void
```

#### optimize()
执行参数优化。

```typescript
async optimize(): Promise<OptimizationResult>
```

#### adapt()
执行自适应调整。

```typescript
async adapt(): Promise<AdaptationLogEntry | null>
```

#### getCurrentParams()
获取当前参数。

```typescript
getCurrentParams(): Record<string, number>
```

#### getBestParams()
获取最优参数。

```typescript
getBestParams(): Record<string, number>
```

#### getAdaptationLog()
获取适应日志。

```typescript
getAdaptationLog(): AdaptationLogEntry[]
```

#### getPerformanceHistory()
获取表现历史。

```typescript
getPerformanceHistory(): PerformanceRecord[]
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
- 时间复杂度: O(maxIterations)

### Gradient Descent (梯度下降)
- 数值梯度估计
- 适合连续参数空间
- 学习率: 0.01, 动量: 0.9

### Bayesian (贝叶斯优化)
- 探索率: 0.3, 开发率: 0.7
- 适合昂贵评估函数

### Genetic (遗传算法)
- 种群大小: 40, 精英数: 5
- 变异率: 0.15, 交叉率: 0.7

---

## 适应度函数

```typescript
fitness = sharpe * 0.4 + sortino * 0.2 - drawdown * 0.25 + winRate * 0.1 + return * 0.05
```

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `optimization:start` | 优化开始 | `{ method }` |
| `optimization:progress` | 迭代进度 | `{ iteration, fitness }` |
| `optimization:complete` | 优化完成 | `OptimizationResult` |
| `adaptation:start` | 适应开始 | `{ oldParams }` |
| `adaptation:complete` | 适应完成 | `AdaptationLogEntry` |
| `adaptation:rejected` | 适应拒绝 | `{ reason }` |

---

**文档生成**: dao  
**时间**: 2026-06-07T04:11:00+08:00
