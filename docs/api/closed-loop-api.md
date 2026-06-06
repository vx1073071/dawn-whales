# ClosedLoopExecutor API 文档

**Phase**: 4.3 R36  
**文件**: `electron/engine/closed-loop-executor.ts` (515 行)  
**作者**: ML  
**审查**: dao  

---

## 概述

ClosedLoopExecutor 实现策略信号到交易执行的完整闭环，支持三种执行模式和多种风控机制。

**核心功能**:
- 信号接收与预检查
- 闭环执行（IDLE → CREATED → EXECUTING → ACTIVE → CLOSED）
- 持仓监控与风控
- 自动重试机制
- 止损/止盈/追踪止损

---

## 类型定义

### SignalType

```typescript
type SignalType = 'BUY' | 'SELL' | 'HOLD';
```

### LoopState (状态机)

```typescript
type LoopState = 
  | 'IDLE' | 'CREATED' | 'VALIDATING' | 'VALIDATED' 
  | 'EXECUTING' | 'ACTIVE' | 'MONITORING' | 'ADJUSTING' 
  | 'CLOSING' | 'CLOSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
```

**状态流转**:
```
IDLE → CREATED → VALIDATING → VALIDATED → EXECUTING → ACTIVE → 
MONITORING → ADJUSTING → CLOSING → CLOSED → COMPLETED/FAILED/CANCELLED
```

### ExecutionMode

```typescript
type ExecutionMode = 'immediate' | 'triggered' | 'scheduled';
```

- `immediate`: 立即执行
- `triggered`: 等待触发条件
- `scheduled`: 定时执行（CronScheduler）

### RetryStrategy

```typescript
type RetryStrategy = 'fixed' | 'exponential' | 'adaptive';
```

### Signal

```typescript
interface Signal {
  id: string;
  strategyId: string;
  code: string;
  type: SignalType;
  price: number;
  timestamp: number;
  confidence: number;
  metadata?: Record<string, any>;
}
```

### Order

```typescript
interface Order {
  id: string;
  signalId: string;
  code: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: OrderStatus;
  filledPrice?: number;
  filledQuantity?: number;
  timestamp: number;
  filledAt?: number;
  error?: string;
  retryCount: number;
  lastRetryAt?: number;
}
```

### Position

```typescript
interface Position {
  code: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  trailingStopPct?: number;
  highestPrice?: number;
  entryTime: number;
  maxHoldingMinutes?: number;
}
```

### ExecutorConfig

```typescript
interface ExecutorConfig {
  enabled: boolean;
  autoExecute: boolean;
  maxPositionSize: number;
  maxDailyOrders: number;
  cooldownMinutes: number;
  requireConfirmation: boolean;
  riskCheckEnabled: boolean;
  executionMode: ExecutionMode;
  retryStrategy: RetryStrategy;
  maxRetries: number;
  retryDelayMs: number;
  retryMultiplier: number;
  stopLoss: StopLossConfig;
  takeProfit: TakeProfitConfig;
  maxHoldingMinutes: number;
  maxDailyLossPct: number;
  maxDrawdownPct: number;
}
```

**默认配置**:
```typescript
{
  enabled: true,
  autoExecute: false,
  maxPositionSize: 1000,
  maxDailyOrders: 50,
  cooldownMinutes: 1,
  requireConfirmation: true,
  riskCheckEnabled: true,
  executionMode: 'immediate',
  retryStrategy: 'fixed',
  maxRetries: 3,
  retryDelayMs: 1000,
  retryMultiplier: 2,
  stopLoss: { enabled: true, pct: 5 },
  takeProfit: { enabled: true, pct: 10 },
  maxHoldingMinutes: 0,
  maxDailyLossPct: 3,
  maxDrawdownPct: 15,
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  success: boolean;
  orderId?: string;
  signal?: Signal;
  order?: Order;
  error?: string;
  riskCheckPassed?: boolean;
  riskReason?: string;
  state?: LoopState;
}
```

### ExecutorStats

```typescript
interface ExecutorStats {
  totalSignals: number;
  executedOrders: number;
  successRate: number;
  totalPnl: number;
  winRate: number;
  avgPnl: number;
  maxDrawdown: number;
  totalRetries: number;
  dailyLossPct: number;
  peakEquity: number;
  currentDrawdownPct: number;
  loopsCompleted: number;
  loopsFailed: number;
}
```

### LoopUnit

```typescript
interface LoopUnit {
  id: string;
  signalId: string;
  code: string;
  state: LoopState;
  entryPrice: number;
  exitPrice?: number;
  pnl: number;
  pnlPct: number;
  createdAt: number;
  closedAt?: number;
  orders: Order[];
  exitReason?: string;
}
```

---

## ClosedLoopExecutor 类

### 构造函数

```typescript
constructor(config?: Partial<ExecutorConfig>)
```

**示例**:
```typescript
const executor = new ClosedLoopExecutor({
  executionMode: 'immediate',
  maxPositionSize: 5000,
  stopLoss: { enabled: true, pct: 3, trailing: true, trailingPct: 2 },
  takeProfit: { enabled: true, pct: 8 },
  maxDailyLossPct: 2,
});
```

---

### 核心方法

#### addSignal(signal)

添加策略信号，自动执行预检查和闭环创建。

```typescript
addSignal(signal: Signal): ExecutionResult
```

**流程**:
1. 信号添加到队列
2. 预检查（Pre-flight Check）
3. 创建 LoopUnit
4. 根据 executionMode 执行:
   - `immediate`: 立即执行 `executeLoop()`
   - `triggered`: 等待外部触发
   - `scheduled`: 等待 CronScheduler

**返回值**:
- `success: true`: 信号接收成功
- `riskCheckPassed: true`: 风控检查通过
- `state`: 当前循环状态

**触发事件**:
- `signal:received`: 收到信号
- `signal:rejected`: 信号被拒绝
- `loop:executing`: 循环开始执行
- `loop:active`: 循环激活
- `order:filled`: 订单成交

**示例**:
```typescript
executor.addSignal({
  id: 'sig-001',
  strategyId: 'ma-cross',
  code: 'HK.00700',
  type: 'BUY',
  price: 180.5,
  timestamp: Date.now(),
  confidence: 0.85,
  metadata: { positionSize: 200 },
});
```

---

#### executeLoop(loop, signal)

执行闭环。

```typescript
executeLoop(loop: LoopUnit, signal: Signal): ExecutionResult
```

**流程**:
1. 更新状态为 `EXECUTING`
2. 创建订单
3. 模拟订单执行
4. 更新持仓
5. 设置止损/止盈

#### triggerLoop(loopId)

触发已验证的循环。

```typescript
triggerLoop(loopId: string): ExecutionResult
```

**条件**:
- Loop 必须存在
- Loop 状态必须为 `VALIDATED`

---

### 持仓管理

#### updatePrice(code, currentPrice)

更新标的价格，自动检查风控条件。

```typescript
updatePrice(code: string, currentPrice: number): void
```

**自动检查**:
- 止损触发：`currentPrice <= stopLoss`
- 止盈触发：`currentPrice >= takeProfit`
- 追踪止损触发：`currentPrice <= trailingStop`
- 时间退出：`holdingMinutes >= maxHoldingMinutes`

**触发事件**: `position:updated`

#### closePosition(code, reason)

平仓。

```typescript
closePosition(code: string, reason: string): void
```

**退出原因**:
- `stop_loss_hit`: 止损触发
- `take_profit_hit`: 止盈触发
- `trailing_stop_hit`: 追踪止损触发
- `time_exit`: 时间退出

**触发事件**:
- `loop:closed`: 闭环关闭
- `position:closed`: 持仓关闭

---

### 风控检查

#### preflightCheck(signal)

预检查（内部方法）。

```typescript
private preflightCheck(signal: Signal): { passed: boolean; reason: string }
```

**检查项**:
1. **持仓大小**: `positionSize <= maxPositionSize`
2. **最大持仓数**: `positions.size < 20`
3. **每日订单限制**: `dailyOrderCount < maxDailyOrders`
4. **每日损失限制**: `dailyLossPct > -maxDailyLossPct`
5. **最大回撤**: `drawdownPct < maxDrawdownPct`
6. **冷却期**: `now - lastOrderTime > cooldownMinutes`

---

### 查询方法

#### getSignals(limit?)

获取信号列表。

```typescript
getSignals(limit?: number): Signal[]
```

#### getOrders(limit?)

获取订单列表。

```typescript
getOrders(limit?: number): Order[]
```

#### getPositions()

获取所有持仓。

```typescript
getPositions(): Position[]
```

#### getLoops(state?)

获取循环列表。

```typescript
getLoops(state?: LoopState): LoopUnit[]
```

#### getLoop(loopId)

获取指定循环。

```typescript
getLoop(loopId: string): LoopUnit | undefined
```

#### getStats()

获取执行统计。

```typescript
getStats(): ExecutorStats
```

---

### 控制方法

#### enable()

启用执行器。

```typescript
enable(): void
```

#### disable()

禁用执行器。

```typescript
disable(): void
```

#### resetDailyCount()

重置每日计数。

```typescript
resetDailyCount(): void
```

#### clearHistory()

清空历史。

```typescript
clearHistory(): void
```

#### updateConfig(config)

更新配置。

```typescript
updateConfig(config: Partial<ExecutorConfig>): void
```

#### getConfig()

获取配置。

```typescript
getConfig(): ExecutorConfig
```

---

### 监控方法

#### startMonitoring(intervalMs?)

启动持仓监控。

```typescript
startMonitoring(intervalMs?: number): void
```

**默认间隔**: 5000ms (5 秒)

**监控内容**:
- 时间退出检查
- 止损/止盈触发

#### stopMonitoring()

停止监控。

```typescript
stopMonitoring(): void
```

#### destroy()

销毁执行器。

```typescript
destroy(): void
```

---

## 重试机制

支持三种重试策略：

### Fixed (固定延迟)

```typescript
retryStrategy: 'fixed'
delay = retryDelayMs  // 每次都是 1000ms
```

### Exponential (指数退避)

```typescript
retryStrategy: 'exponential'
delay = retryDelayMs * (retryMultiplier ^ (attempt - 1))
// 第 1 次：1000ms, 第 2 次：2000ms, 第 3 次：4000ms
```

### Adaptive (自适应)

```typescript
retryStrategy: 'adaptive'
delay = retryDelayMs * (1 + attempt * 0.5)
// 第 1 次：1500ms, 第 2 次：2000ms, 第 3 次：2500ms
```

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `signal:received` | 收到信号 | `Signal` |
| `signal:rejected` | 信号被拒绝 | `{ signal, reason }` |
| `loop:executing` | 循环开始执行 | `{ loop, order }` |
| `loop:active` | 循环激活 | `{ loop, order }` |
| `loop:state_change` | 状态变更 | `{ loop, oldState, newState }` |
| `loop:closed` | 闭环关闭 | `{ loop, reason }` |
| `loop:failed` | 循环失败 | `{ loop, order }` |
| `order:filled` | 订单成交 | `Order` |
| `position:updated` | 持仓更新 | `Position` |
| `position:closed` | 持仓关闭 | `{ code, reason }` |

---

## 使用示例

### 基础用法

```typescript
import { ClosedLoopExecutor } from './closed-loop-executor';

const executor = new ClosedLoopExecutor({
  executionMode: 'immediate',
  maxPositionSize: 5000,
  stopLoss: { enabled: true, pct: 5 },
  takeProfit: { enabled: true, pct: 10 },
});

// 监听事件
executor.on('order:filled', (order) => {
  console.log(`✅ 订单成交：${order.id} @ ${order.filledPrice}`);
});

executor.on('position:closed', ({ code, reason }) => {
  console.log(`📊 持仓关闭：${code} (${reason})`);
});

// 添加信号
executor.addSignal({
  id: 'sig-001',
  strategyId: 'ma-cross',
  code: 'HK.00700',
  type: 'BUY',
  price: 180.5,
  timestamp: Date.now(),
  confidence: 0.85,
});

// 更新价格（模拟行情推送）
executor.updatePrice('HK.00700', 185.0);

// 获取统计
const stats = executor.getStats();
console.log(`胜率：${stats.winRate.toFixed(2)}%`);
```

### 触发模式

```typescript
const executor = new ClosedLoopExecutor({
  executionMode: 'triggered',  // 等待触发
});

// 添加信号（状态变为 VALIDATED）
const result = executor.addSignal({
  id: 'sig-002',
  strategyId: 'breakout',
  code: 'HK.09988',
  type: 'BUY',
  price: 100.0,
  timestamp: Date.now(),
  confidence: 0.9,
});

// 手动触发
executor.triggerLoop(result.orderId);
```

### 监控模式

```typescript
// 启动监控（每 5 秒检查一次）
executor.startMonitoring(5000);

// 停止监控
executor.stopMonitoring();
```

---

## 验收标准

- ✅ 代码行数：515 行
- ✅ 单元测试：18 tests (JVS-37-02)
- ✅ EventEmitter 集成
- ✅ 状态机完整（13 个状态）
- ✅ 三种执行模式
- ✅ 三种重试策略
- ✅ 止损/止盈/追踪止损
- ✅ 预检查风控
- ✅ 持仓监控
- ✅ TypeScript 严格模式

---

**文档生成**: dao  
**时间**: 2026-06-07T02:32:00+08:00  
**版本**: v0.8.0-alpha
