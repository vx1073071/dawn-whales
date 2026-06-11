<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# RebalanceEngine API 文档

**Phase**: 4.3 R36  
**文件**: `electron/engine/rebalance-engine.ts` (428 行)  
**作者**: ML  
**审查**: dao  

---

## 概述

RebalanceEngine 实现投资组合自动再平衡，根据目标权重调整持仓。

**核心功能**:
- 五种再平衡策略
- 四种触发方式
- 约束引擎（交易大小/持仓数/换手率）
- 定期自动再平衡
- 漂移计算与校正

---

## 类型定义

### RebalanceMode

```typescript
type RebalanceMode = 'threshold' | 'periodic' | 'drift' | 'signal' | 'manual';
```

### RebalanceStrategy

```typescript
type RebalanceStrategy = 'equal_weight' | 'target_weight' | 'risk_parity' | 'minimum_variance' | 'custom';
```

### TriggerType

```typescript
type TriggerType = 'periodic' | 'threshold' | 'signal' | 'manual';
```

### TargetWeight

```typescript
interface TargetWeight {
  code: string;
  weight: number;  // 0-1 (百分比)
}
```

### Position

```typescript
interface Position {
  code: string;
  quantity: number;
  currentPrice: number;
  marketValue: number;
  weight: number;  // 当前权重 (0-1)
}
```

### RebalanceOrder

```typescript
interface RebalanceOrder {
  code: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  targetQuantity: number;
  currentQuantity: number;
  price: number;
  reason: string;
  estimatedCost: number;
}
```

### RebalanceResult

```typescript
interface RebalanceResult {
  timestamp: number;
  totalValue: number;
  orders: RebalanceOrder[];
  beforeWeights: Map<string, number>;
  afterWeights: Map<string, number>;
  driftBefore: number;
  driftAfter: number;
  driftCorrected: number;
  totalCost: number;
  triggerType: TriggerType;
  strategy: RebalanceStrategy;
}
```

### RebalanceConfig

```typescript
interface RebalanceConfig {
  mode: RebalanceMode;
  strategy: RebalanceStrategy;
  thresholdPct: number;        // 漂移超过此百分比触发再平衡
  periodicIntervalDays: number; // 定期模式间隔天数
  minRebalanceAmount: number;  // 最小交易金额
  maxSlippagePct: number;
  autoExecute: boolean;
  requireConfirmation: boolean;
  constraints: ConstraintConfig;
}
```

### ConstraintConfig

```typescript
interface ConstraintConfig {
  minTradeSize: number;        // 最小交易金额
  maxTradeSize: number;        // 最大交易金额
  maxPositions: number;        // 最大持仓数
  maxTurnoverPct: number;      // 最大换手率
  cashBufferPct: number;       // 现金缓冲百分比
  allowPartialRebalance: boolean;  // 允许部分再平衡
}
```

**默认配置**:
```typescript
{
  mode: 'threshold',
  strategy: 'target_weight',
  thresholdPct: 5,           // 5% 漂移触发
  periodicIntervalDays: 30,  // 30 天定期再平衡
  minRebalanceAmount: 100,
  maxSlippagePct: 0.5,
  autoExecute: false,
  requireConfirmation: true,
  constraints: {
    minTradeSize: 100,
    maxTradeSize: 100000,
    maxPositions: 20,
    maxTurnoverPct: 30,
    cashBufferPct: 5,
    allowPartialRebalance: true,
  },
}
```

### RebalanceStats

```typescript
interface RebalanceStats {
  totalRebalances: number;
  avgDriftBefore: number;
  avgDriftAfter: number;
  avgOrdersPerRebalance: number;
  lastRebalanceTime: number;
  totalRebalanceCost: number;
  avgTurnoverPct: number;
  rebalancesByStrategy: Record<RebalanceStrategy, number>;
  rebalancesByTrigger: Record<TriggerType, number>;
}
```

---

## RebalanceEngine 类

### 构造函数

```typescript
constructor(config?: Partial<RebalanceConfig>)
```

**示例**:
```typescript
const engine = new RebalanceEngine({
  mode: 'threshold',
  strategy: 'equal_weight',
  thresholdPct: 3,            // 3% 漂移触发
  periodicIntervalDays: 7,    // 每周再平衡
  constraints: {
    maxPositions: 10,
    maxTurnoverPct: 20,
    cashBufferPct: 10,
  },
});
```

---

### 目标管理

#### setTargets(targets)

设置目标权重。

```typescript
setTargets(targets: TargetWeight[]): void
```

**注意**: 权重总和会自动归一化到 1.0

**示例**:
```typescript
engine.setTargets([
  { code: 'HK.00700', weight: 0.3 },
  { code: 'HK.09988', weight: 0.3 },
  { code: 'US.AAPL', weight: 0.4 },
]);
```

#### setEqualWeights(codes)

设置等权重。

```typescript
setEqualWeights(codes: string[]): void
```

**示例**:
```typescript
engine.setEqualWeights(['HK.00700', 'HK.09988', 'US.AAPL']);
// 每个权重 33.33%
```

#### setCustomWeights(weights)

设置自定义权重。

```typescript
setCustomWeights(weights: Record<string, number>): void
```

**示例**:
```typescript
engine.setCustomWeights({
  'HK.00700': 0.4,
  'HK.09988': 0.35,
  'US.AAPL': 0.25,
});
```

#### getTargets()

获取目标权重。

```typescript
getTargets(): TargetWeight[]
```

---

### 持仓管理

#### updatePositions(positions)

更新持仓。

```typescript
updatePositions(positions: Position[]): void
```

**示例**:
```typescript
engine.updatePositions([
  {
    code: 'HK.00700',
    quantity: 200,
    currentPrice: 180.5,
    marketValue: 36100,
    weight: 0.35,
  },
]);
```

#### getPositions()

获取所有持仓。

```typescript
getPositions(): Position[]
```

#### getPosition(code)

获取指定持仓。

```typescript
getPosition(code: string): Position | undefined
```

---

### 再平衡逻辑

#### shouldRebalance(triggerType?)

检查是否应该再平衡。

```typescript
shouldRebalance(triggerType?: TriggerType): boolean
```

**触发条件**:
- `periodic`: 距离上次再平衡 >= `periodicIntervalDays`
- `threshold`: 漂移 > `thresholdPct`
- `signal`: 外部信号触发（始终返回 true）
- `manual`: 手动触发（始终返回 true）

#### calculateDrift()

计算当前漂移百分比。

```typescript
calculateDrift(): number
```

**公式**:
```
drift = (Σ|currentWeight - targetWeight| / n) * 100
```

#### calculateRebalanceOrders(totalValue)

计算再平衡订单。

```typescript
calculateRebalanceOrders(totalValue: number): RebalanceOrder[]
```

**约束检查**:
1. **最小交易大小**: 跳过 < `minTradeSize` 的订单
2. **最大交易大小**: 部分再平衡或跳过
3. **最大持仓数**: 跳过新开仓
4. **最大换手率**: 如果超过则跳过整个再平衡

**示例**:
```typescript
const orders = engine.calculateRebalanceOrders(100000);
// 返回需要执行的订单列表
```

#### executeRebalance(totalValue, triggerType?)

执行再平衡。

```typescript
executeRebalance(totalValue: number, triggerType?: TriggerType): RebalanceResult
```

**流程**:
1. 记录再平衡前权重
2. 计算订单
3. 模拟订单执行
4. 更新持仓权重
5. 计算漂移校正
6. 记录历史

**返回值**: `RebalanceResult` 包含完整执行结果

**触发事件**: `rebalance:executed`

**示例**:
```typescript
const result = engine.executeRebalance(100000, 'threshold');
console.log(`
  订单数：${result.orders.length}
  漂移校正：${result.driftCorrected.toFixed(2)}%
  总成本：${result.totalCost}
`);
```

---

### 定期再平衡

#### startPeriodicRebalance()

启动定期再平衡。

```typescript
startPeriodicRebalance(): void
```

**间隔**: `periodicIntervalDays` 天

**触发事件**: `rebalance:triggered`

#### stopPeriodicRebalance()

停止定期再平衡。

```typescript
stopPeriodicRebalance(): void
```

---

### 查询方法

#### getRebalanceHistory(limit?)

获取再平衡历史。

```typescript
getRebalanceHistory(limit?: number): RebalanceResult[]
```

#### getStats()

获取统计信息。

```typescript
getStats(): RebalanceStats
```

**统计内容**:
- 总再平衡次数
- 平均漂移（前后）
- 平均订单数
- 总成本
- 平均换手率
- 按策略分类
- 按触发方式分类

---

### 控制方法

#### updateConfig(config)

更新配置。

```typescript
updateConfig(config: Partial<RebalanceConfig>): void
```

#### getConfig()

获取配置。

```typescript
getConfig(): RebalanceConfig
```

#### clearHistory()

清空历史。

```typescript
clearHistory(): void
```

#### destroy()

销毁引擎。

```typescript
destroy(): void
```

---

## 再平衡策略

### Equal Weight (等权重)

```typescript
strategy: 'equal_weight'
// 每个资产权重 = 1 / n
```

### Target Weight (目标权重)

```typescript
strategy: 'target_weight'
// 使用 setTargets() 设置的权重
```

### Risk Parity (风险平价)

```typescript
strategy: 'risk_parity'
// 简化实现：等权重
// 实际应基于波动率倒数加权
```

### Minimum Variance (最小方差)

```typescript
strategy: 'minimum_variance'
// 简化实现：等权重
// 实际应基于协方差矩阵优化
```

### Custom (自定义)

```typescript
strategy: 'custom'
// 使用 setCustomWeights() 设置的权重
```

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `targets:updated` | 目标权重更新 | `TargetWeight[]` |
| `rebalance:executed` | 再平衡执行完成 | `RebalanceResult` |
| `rebalance:triggered` | 再平衡触发 | `{ triggerType }` |
| `config:updated` | 配置更新 | `RebalanceConfig` |
| `history:cleared` | 历史清空 | - |

---

## 使用示例

### 基础用法

```typescript
import { RebalanceEngine } from './rebalance-engine';

const engine = new RebalanceEngine({
  mode: 'threshold',
  strategy: 'equal_weight',
  thresholdPct: 5,
  constraints: {
    maxPositions: 10,
    cashBufferPct: 5,
  },
});

// 设置目标
engine.setEqualWeights(['HK.00700', 'HK.09988', 'US.AAPL']);

// 更新持仓
engine.updatePositions([
  {
    code: 'HK.00700',
    quantity: 200,
    currentPrice: 180.5,
    marketValue: 36100,
    weight: 0.4,
  },
  {
    code: 'HK.09988',
    quantity: 100,
    currentPrice: 100.0,
    marketValue: 10000,
    weight: 0.3,
  },
  {
    code: 'US.AAPL',
    quantity: 50,
    currentPrice: 180.0,
    marketValue: 9000,
    weight: 0.3,
  },
]);

// 检查是否需要再平衡
if (engine.shouldRebalance()) {
  const totalValue = 55100;
  const result = engine.executeRebalance(totalValue);
  
  console.log(`再平衡完成:`);
  console.log(`  订单数：${result.orders.length}`);
  console.log(`  漂移校正：${result.driftCorrected.toFixed(2)}%`);
  console.log(`  总成本：${result.totalCost}`);
}
```

### 定期再平衡

```typescript
const engine = new RebalanceEngine({
  mode: 'periodic',
  strategy: 'target_weight',
  periodicIntervalDays: 30,  // 每月再平衡
});

// 设置目标权重
engine.setTargets([
  { code: 'HK.00700', weight: 0.4 },
  { code: 'US.AAPL', weight: 0.6 },
]);

// 启动定期再平衡
engine.startPeriodicRebalance();

// 监听触发事件
engine.on('rebalance:triggered', ({ triggerType }) => {
  console.log(`${triggerType} 再平衡触发`);
  const result = engine.executeRebalance(portfolioValue);
});
```

### 阈值再平衡

```typescript
const engine = new RebalanceEngine({
  mode: 'threshold',
  thresholdPct: 3,  // 3% 漂移触发
});

// 监控漂移
setInterval(() => {
  const drift = engine.calculateDrift();
  console.log(`当前漂移：${drift.toFixed(2)}%`);
  
  if (drift > 3) {
    console.log('漂移超过阈值，触发再平衡');
    engine.executeRebalance(portfolioValue);
  }
}, 60000);  // 每分钟检查
```

---

## 约束引擎

### 最小交易大小

```typescript
constraints: {
  minTradeSize: 100,  // 小于 100 元的订单跳过
}
```

### 最大交易大小

```typescript
constraints: {
  maxTradeSize: 100000,  // 大于 10 万的订单
  allowPartialRebalance: true,  // 部分再平衡
}
```

### 最大持仓数

```typescript
constraints: {
  maxPositions: 20,  // 最多 20 个持仓
}
```

### 最大换手率

```typescript
constraints: {
  maxTurnoverPct: 30,  // 换手率不超过 30%
}
```

### 现金缓冲

```typescript
constraints: {
  cashBufferPct: 5,  // 保留 5% 现金
}
```

---

## 验收标准

- ✅ 代码行数：428 行
- ✅ 单元测试：18 tests (JVS-37-02)
- ✅ EventEmitter 集成
- ✅ 五种再平衡策略
- ✅ 四种触发方式
- ✅ 约束引擎完整
- ✅ 定期再平衡
- ✅ 漂移计算
- ✅ TypeScript 严格模式

---

**文档生成**: dao  
**时间**: 2026-06-07T02:34:00+08:00  
**版本**: v0.8.0-alpha
