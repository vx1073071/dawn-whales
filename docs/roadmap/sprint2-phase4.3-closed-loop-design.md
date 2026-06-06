# ClosedLoopExecutor 详细设计文档

**文档版本**: v1.0  
**规划日期**: 2026-06-06  
**设计人**: PM (WorkBuddy)  
**对应任务**: WB-32-03 (R32) / R34 实现  
**状态**: 设计阶段  

---

## 1. 概述

### 1.1 什么是 ClosedLoopExecutor

ClosedLoopExecutor（闭环执行引擎）是 DAWN WHALES 自动化交易体系的最高层协调器。它建立在 ConditionEngine、StrategyRunner、TradeExecutor、PositionMonitor、RiskEngine 之上，实现**从信号产生到持仓管理再到绩效追踪的完整闭环**。

### 1.2 为什么需要它

当前体系的状态（Phase 4.2 完成后）：

```
信号产生 → 条件触发 → 自动下单 ✅
                ↓
            持仓后管理 ❌ (空白)
                ↓
            止损止盈 ❌ (手动)
                ↓
            仓位再平衡 ❌ (缺失)
                ↓
            绩效追踪 ❌ (薄弱)
```

ClosedLoopExecutor 填补上述空白，实现：

```
信号产生 → 条件触发 → 自动下单 → 持仓监控 → 止损止盈 → 绩效追踪 → 再平衡
    ↑___________________________________________________________________________↓
                                    (闭环)
```

### 1.3 核心职责

1. **执行模式管理**: 支持 Immediate（立即执行）、Triggered（条件触发）、Scheduled（定时调度）三种模式
2. **风控前置**: 在执行任何操作前，先通过 RiskEngine 进行全维度检查
3. **持仓后管理**: 订单成交后，自动将持仓纳入 PositionMonitor 监控
4. **止损止盈委托**: 根据策略配置，自动设置止损止盈条件
5. **执行重试**: 下单失败时，根据策略进行智能重试
6. **状态持久化**: 所有闭环执行状态持久化到 SQLite，支持重启恢复
7. **事件驱动**: 通过 EventEmitter 向 UI 推送实时状态更新

---

## 2. 架构设计

### 2.1 组件位置

```
electron/
  engine/
    closed-loop-executor.ts      # 闭环执行引擎主类 (>=600L)
    position-monitor.ts          # 持仓监控 (R32 骨架/R33 实现)
    performance-tracker.ts       # 绩效追踪 (R32 骨架/R33 实现)
    rebalance-engine.ts          # 再平衡引擎 (R35 实现)
    trade-executor.ts            # 已有: 下单执行
    strategy-runner.ts           # 已有: 策略执行
    risk-engine-v3.ts            # 已有: 风控引擎
    condition-engine.ts          # 已有: 条件引擎
```

### 2.2 组件关系图

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ClosedLoopExecutor                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Immediate  │  │  Triggered  │  │  Scheduled  │  │   Monitor   │ │
│  │    Mode     │  │    Mode     │  │    Mode     │  │    Mode     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         └─────────────────┴─────────────────┘                │        │
│                           │                                  │        │
│                    ┌──────▼──────┐                    ┌──────▼──────┐ │
│                    │  Pre-Flight │                    │  Position   │ │
│                    │ Risk Check  │                    │   Monitor   │ │
│                    └──────┬──────┘                    └──────┬──────┘ │
│                           │                                  │        │
│                    ┌──────▼──────┐                    ┌──────▼──────┐ │
│                    │  Strategy   │                    │  StopLoss/  │ │
│                    │   Runner    │                    │ TakeProfit  │ │
│                    └──────┬──────┘                    └──────┬──────┘ │
│                           │                                  │        │
│                    ┌──────▼──────┐                    ┌──────▼──────┐ │
│                    │   Trade     │                    │ Performance │ │
│                    │  Executor   │                    │   Tracker   │ │
│                    └──────┬──────┘                    └─────────────┘ │
│                           │                                          │
│                    ┌──────▼──────┐                                   │
│                    │   Retry     │                                   │
│                    │   Engine    │                                   │
│                    └─────────────┘                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.3 与现有引擎的集成点

| 依赖引擎 | 集成方式 | 用途 |
|---------|---------|------|
| ConditionEngine | 事件订阅 | Triggered 模式下监听条件触发 |
| StrategyRunner | 直接调用 | 执行策略评估和信号生成 |
| TradeExecutor | 直接调用 | 执行实际下单 |
| RiskEngine v3 | 直接调用 | 执行前风控检查 |
| PositionMonitor | 事件订阅 + 调用 | 持仓监控、止损止盈 |
| CronScheduler | 事件订阅 | Scheduled 模式下定时触发 |
| TradingCalendar | 直接调用 | 判断是否在交易时段 |

---

## 3. 状态机设计

### 3.1 闭环执行单元状态机

每个闭环执行单元（ClosedLoopUnit）拥有独立的状态机：

```
                    ┌─────────────┐
         ┌─────────│   CREATED   │◄────────┐
         │         │  (已创建)    │         │
         │         └──────┬──────┘         │
         │                │ start()         │
         │                ▼                 │
         │         ┌─────────────┐          │
         │    ┌────│  VALIDATING │────┐     │
         │    │    │  (风控检查中) │    │     │
         │    │    └──────┬──────┘    │     │
         │    │           │           │     │
         │ reject      pass       warn      │
         │    │           │           │     │
         │    ▼           ▼           ▼     │
         │ ┌──────┐  ┌─────────┐  ┌────────┐│
         │ │REJECT│  │EXECUTING│  │PENDING ││
         │ │ (拒绝)│  │(执行中)  │  │(等待中)││
         │ └──┬───┘  └────┬────┘  └───┬────┘│
         │    │           │           │     │
         │    │      success     resume()  │
         │    │           │           │     │
         │    │           ▼           │     │
         │    │    ┌─────────────┐    │     │
         │    │    │   ACTIVE    │    │     │
         │    │    │  (持仓中)   │    │     │
         │    │    └──────┬──────┘    │     │
         │    │           │           │     │
         │    │    ┌──────┼──────┐    │     │
         │    │    │      │      │    │     │
         │    │    ▼      ▼      ▼    │     │
         │    │ ┌────┐ ┌────┐ ┌────┐ │     │
         │    │ │SL  │ │TP  │ │TE  │ │     │
         │    │ │Hit │ │Hit │ │Hit │ │     │
         │    │ └──┬─┘ └──┬─┘ └──┬─┘ │     │
         │    │    │      │      │    │     │
         │    │    └──────┼──────┘    │     │
         │    │           ▼           │     │
         │    │    ┌─────────────┐    │     │
         │    └───►│  CLOSING    │────┘     │
         │         │  (平仓中)    │          │
         │         └──────┬──────┘          │
         │                │                  │
         │           success              │
         │                │                  │
         │                ▼                  │
         │         ┌─────────────┐          │
         └────────►│  COMPLETED  │──────────┘
                   │  (已完成)   │  restart()
                   └─────────────┘

         ┌──────────────────────────────────┐
         │           ERROR PATH             │
         │  any state ──error()──► ERROR    │
         │  ERROR ──recover()──► CREATED    │
         │  ERROR ──abort()──► ABORTED      │
         └──────────────────────────────────┘

States:
  CREATED    - 单元已创建，尚未启动
  VALIDATING - 正在执行前置风控检查
  REJECTED   - 风控检查未通过，执行被拒绝
  EXECUTING  - 正在执行下单操作
  PENDING    - 风控发出警告，等待人工确认
  ACTIVE     - 订单已成交，持仓监控中
  CLOSING    - 止损/止盈/时间退出触发，正在平仓
  COMPLETED  - 闭环执行完成（止盈/止损/平仓/时间退出）
  ERROR      - 执行过程中发生错误
  ABORTED    - 用户手动中止
```

### 3.2 状态转换规则

| 当前状态 | 事件 | 下一状态 | 触发条件 |
|---------|------|---------|---------|
| CREATED | start() | VALIDATING | 用户启动闭环执行 |
| VALIDATING | risk_pass | EXECUTING | RiskEngine 返回 pass |
| VALIDATING | risk_reject | REJECTED | RiskEngine 返回 reject |
| VALIDATING | risk_warn | PENDING | RiskEngine 返回 warn（需人工确认）|
| PENDING | confirm() | EXECUTING | 用户确认继续 |
| PENDING | cancel() | ABORTED | 用户取消 |
| EXECUTING | order_filled | ACTIVE | 订单全部成交 |
| EXECUTING | order_partial | EXECUTING | 订单部分成交，继续等待 |
| EXECUTING | order_failed | ERROR | 下单失败（重试耗尽）|
| ACTIVE | stop_loss_hit | CLOSING | 价格触及止损线 |
| ACTIVE | take_profit_hit | CLOSING | 价格触及止盈线 |
| ACTIVE | time_exit_hit | CLOSING | 持仓时间超过最大持仓时间 |
| ACTIVE | manual_close | CLOSING | 用户手动平仓 |
| CLOSING | close_filled | COMPLETED | 平仓订单成交 |
| CLOSING | close_failed | ERROR | 平仓失败 |
| ERROR | recover() | CREATED | 错误恢复，重新开始 |
| ERROR | abort() | ABORTED | 放弃执行 |
| COMPLETED | restart() | CREATED | 重新开始新一轮闭环 |
| any | error() | ERROR | 任何状态都可能因错误转入 ERROR |
| any | abort() | ABORTED | 任何状态都可被用户中止 |

---

## 4. 执行模式详细设计

### 4.1 Immediate Mode（立即执行模式）

**场景**: 用户手动触发，立即执行一次完整的闭环交易。

**流程**:

```
用户点击 "立即执行" 
        │
        ▼
┌───────────────┐
│  1. 风控检查   │ ◄── RiskEngine.preFlightCheck()
│   (Pre-Flight) │
└───────┬───────┘
        │ pass
        ▼
┌───────────────┐
│ 2. 策略评估    │ ◄── StrategyRunner.evaluate()
│ (Strategy Eval)│
└───────┬───────┘
        │ signal
        ▼
┌───────────────┐
│ 3. 下单执行    │ ◄── TradeExecutor.placeOrder()
│ (Place Order)  │
└───────┬───────┘
        │ filled
        ▼
┌───────────────┐
│ 4. 持仓监控    │ ◄── PositionMonitor.track()
│  (Track Pos)   │     + 自动设置止损止盈
└───────┬───────┘
        │ SL/TP/TE
        ▼
┌───────────────┐
│ 5. 平仓执行    │ ◄── TradeExecutor.closePosition()
│ (Close Pos)    │
└───────┬───────┘
        │ filled
        ▼
┌───────────────┐
│ 6. 绩效记录    │ ◄── PerformanceTracker.record()
│ (Record Perf)  │
└───────────────┘
```

**配置示例**:

```typescript
const immediateConfig: ClosedLoopConfig = {
  mode: 'immediate',
  symbol: 'AAPL',
  strategy: 'momentum_breakout',
  quantity: 100,
  side: 'BUY',
  stopLoss: { type: 'percent', value: 3 },      // 3% 止损
  takeProfit: { type: 'percent', value: 5 },    // 5% 止盈
  timeExit: { type: 'duration', value: 86400 }, // 最大持仓 24h
  riskCheck: true,                              // 启用风控前置
  retry: { maxAttempts: 3, backoffMs: 1000 },   // 重试 3 次
};
```

### 4.2 Triggered Mode（条件触发模式）

**场景**: 当市场条件满足时，自动执行闭环交易。

**流程**:

```
注册条件监听
        │
        ▼
┌───────────────┐
│ ConditionWatcher │ ◄── 监听 price/indicator/volume 条件
│   (Monitor)    │
└───────┬───────┘
        │ condition met
        ▼
┌───────────────┐
│ TradingCalendar │ ◄── 检查是否在交易时段
│  (Time Check)  │
└───────┬───────┘
        │ isTradingHours
        ▼
┌───────────────┐
│  风控检查      │ ◄── RiskEngine.preFlightCheck()
│ (Pre-Flight)  │
└───────┬───────┘
        │ pass
        ▼
┌───────────────┐
│  策略评估      │ ◄── StrategyRunner.evaluate()
│ (Strategy Eval)│
└───────┬───────┘
        │ signal
        ▼
┌───────────────┐
│  下单执行      │ ◄── TradeExecutor.placeOrder()
│ (Place Order)  │
└───────┬───────┘
        │ filled
        ▼
┌───────────────┐
│  持仓监控      │ ◄── PositionMonitor.track()
│  (Track Pos)   │
└───────┬───────┘
        │ SL/TP/TE
        ▼
┌───────────────┐
│  平仓执行      │ ◄── TradeExecutor.closePosition()
│ (Close Pos)    │
└───────┬───────┘
        │ filled
        ▼
┌───────────────┐
│  绩效记录      │ ◄── PerformanceTracker.record()
│ (Record Perf)  │
└───────┬───────┘
        │
        ▼
    回到监听状态 (循环)
```

**配置示例**:

```typescript
const triggeredConfig: ClosedLoopConfig = {
  mode: 'triggered',
  condition: {
    type: 'price',
    symbol: 'TSLA',
    trigger: 'crosses_above',
    value: 250,
  },
  strategy: 'breakout_long',
  quantity: 50,
  side: 'BUY',
  stopLoss: { type: 'atr', multiplier: 2 },     // 2x ATR 止损
  takeProfit: { type: 'rr', ratio: 2 },          // 1:2 盈亏比
  maxPositions: 3,                               // 最多同时 3 个持仓
  cooldownMs: 300000,                            // 触发冷却 5 分钟
};
```

### 4.3 Scheduled Mode（定时调度模式）

**场景**: 在特定时间自动执行闭环交易（如开盘策略、尾盘平仓）。

**流程**:

```
注册 Cron 任务
        │
        ▼
┌───────────────┐
│ CronScheduler  │ ◄── cron expression: "30 9 * * 1-5" (开盘)
│  (Schedule)    │
└───────┬───────┘
        │ trigger
        ▼
┌───────────────┐
│ TradingCalendar │ ◄── 确认是交易日
│ (Trading Day)  │
└───────┬───────┘
        │ isTradingDay
        ▼
┌───────────────┐
│  风控检查      │ ◄── RiskEngine.preFlightCheck()
│ (Pre-Flight)  │
└───────┬───────┘
        │ pass
        ▼
┌───────────────┐
│  策略评估      │ ◄── StrategyRunner.evaluate()
│ (Strategy Eval)│
└───────┬───────┘
        │ signal
        ▼
┌───────────────┐
│  下单执行      │ ◄── TradeExecutor.placeOrder()
│ (Place Order)  │
└───────┬───────┘
        │ filled
        ▼
┌───────────────┐
│  持仓监控      │ ◄── PositionMonitor.track()
│  (Track Pos)   │
└───────┬───────┘
        │ SL/TP/TE
        ▼
┌───────────────┐
│  平仓执行      │ ◄── TradeExecutor.closePosition()
│ (Close Pos)    │
└───────┬───────┘
        │ filled
        ▼
┌───────────────┐
│  绩效记录      │ ◄── PerformanceTracker.record()
│ (Record Perf)  │
└───────────────┘
        │
        ▼
    等待下一次调度
```

**配置示例**:

```typescript
const scheduledConfig: ClosedLoopConfig = {
  mode: 'scheduled',
  cron: '30 9 * * 1-5',                          // 每个工作日 9:30
  timezone: 'America/New_York',
  strategy: 'opening_momentum',
  symbol: 'SPY',
  quantity: 100,
  side: 'BUY',
  stopLoss: { type: 'percent', value: 2 },
  takeProfit: { type: 'percent', value: 4 },
  timeExit: { type: 'time', value: '15:45' },    // 15:45 强制平仓
};
```

---

## 5. 风控前置集成

### 5.1 Pre-Flight 检查流程

在每一步执行前，ClosedLoopExecutor 都会调用 RiskEngine 进行 Pre-Flight 检查：

```typescript
interface PreFlightCheck {
  // 1. 账户风险检查
  accountRisk: {
    marginUtilization: number;      // 保证金使用率 < 80%?
    availableFunds: number;         // 可用资金充足?
    maxDrawdown: number;            // 当前回撤 < 阈值?
  };

  // 2. 持仓风险检查
  positionRisk: {
    totalPositions: number;         // 总持仓数 < maxPositions?
    symbolExposure: number;         // 单标的暴露 < 限制?
    sectorExposure: number;         // 行业暴露 < 限制?
  };

  // 3. 策略风险检查
  strategyRisk: {
    dailyTradeCount: number;        // 当日交易次数 < 限制?
    consecutiveLosses: number;      // 连续亏损次数 < 限制?
    winRate7d: number;              // 近7日胜率 > 阈值?
  };

  // 4. 市场风险检查
  marketRisk: {
    vixLevel: number;               // VIX < 阈值?
    marketStatus: 'open' | 'closed'; // 市场是否开放?
    circuitBreaker: boolean;        // 熔断是否触发?
  };
}
```

### 5.2 风控结果处理

| RiskEngine 返回 | 处理逻辑 |
|----------------|---------|
| `PASS` | 继续执行下一步 |
| `WARN` | 暂停执行，推送警告到 UI，等待用户确认（PENDING 状态）|
| `REJECT` | 拒绝执行，记录原因，转入 REJECTED 状态 |

### 5.3 持仓中的持续风控

当闭环单元处于 ACTIVE 状态时，ClosedLoopExecutor 每 30 秒调用一次 RiskEngine 的持续风控检查：

```typescript
interface OngoingRiskCheck {
  // 1. 动态止损调整
  trailingStopUpdate: {
    currentPrice: number;
    highestPrice: number;
    trailingPercent: number;
    newStopPrice: number;
  };

  // 2. 市场异常检测
  marketAnomaly: {
    flashCrash: boolean;            // 闪崩检测
    liquidityDrop: boolean;         // 流动性骤降
    spreadWiden: boolean;           // 价差扩大
  };

  // 3. 熔断触发
  circuitBreaker: {
    portfolioDrop: number;          // 组合跌幅
    dailyLossLimit: number;         // 日亏损限额
    triggered: boolean;
  };
}
```

---

## 6. 重试机制设计

### 6.1 重试策略

ClosedLoopExecutor 支持三种重试策略：

| 策略 | 适用场景 | 行为 |
|------|---------|------|
| **Fixed** | 网络抖动 | 固定间隔重试（如每次 1 秒）|
| **Exponential** | 服务端限流 | 指数退避（1s, 2s, 4s, 8s...）|
| **Adaptive** | 市场波动 | 根据市场状态动态调整（高波动时增加间隔）|

### 6.2 重试配置

```typescript
interface RetryConfig {
  maxAttempts: number;              // 最大重试次数 (默认 3)
  strategy: 'fixed' | 'exponential' | 'adaptive';
  baseDelayMs: number;              // 基础延迟 (默认 1000ms)
  maxDelayMs: number;               // 最大延迟 (默认 30000ms)
  retryableErrors: string[];        // 可重试的错误码
  fatalErrors: string[];            // 致命错误（不重试）
}

// 默认配置
const defaultRetry: RetryConfig = {
  maxAttempts: 3,
  strategy: 'exponential',
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [
    'NETWORK_TIMEOUT',
    'RATE_LIMITED',
    'BROKER_DISCONNECTED',
    'ORDER_PENDING',
  ],
  fatalErrors: [
    'INSUFFICIENT_FUNDS',
    'SYMBOL_NOT_FOUND',
    'MARKET_CLOSED',
    'RISK_REJECTED',
  ],
};
```

### 6.3 重试状态机

```
第一次尝试 ──► 失败 ──► 等待 1s ──► 第二次尝试
                                   │
                              失败 ──► 等待 2s ──► 第三次尝试
                                                  │
                                             失败 ──► ERROR 状态
                                                  │
                                             成功 ──► 继续流程
```

---

## 7. 数据模型

### 7.1 ClosedLoopUnit（闭环执行单元）

```typescript
interface ClosedLoopUnit {
  id: string;                       // 唯一标识 (UUID)
  status: ClosedLoopStatus;         // 当前状态
  mode: 'immediate' | 'triggered' | 'scheduled';
  
  // 配置
  config: ClosedLoopConfig;         // 闭环配置
  
  // 时间戳
  createdAt: Date;
  startedAt?: Date;                 // 开始执行时间
  activatedAt?: Date;               // 持仓激活时间
  completedAt?: Date;               // 完成时间
  
  // 执行记录
  preFlightResult?: RiskCheckResult; // 风控检查结果
  strategySignal?: StrategySignal;   // 策略信号
  entryOrder?: OrderRecord;          // 入场订单
  exitOrder?: OrderRecord;           // 出场订单
  position?: PositionRecord;         // 持仓记录
  
  // 性能数据
  pnl?: PnLRecord;                  // 盈亏记录
  performance?: PerformanceMetrics;  // 绩效指标
  
  // 重试记录
  retryCount: number;
  retryHistory: RetryRecord[];
  
  // 错误记录
  error?: ErrorRecord;
}
```

### 7.2 ClosedLoopConfig（闭环配置）

```typescript
interface ClosedLoopConfig {
  // 基础配置
  mode: 'immediate' | 'triggered' | 'scheduled';
  symbol: string;
  strategy: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  
  // 条件配置 (triggered 模式)
  condition?: ConditionConfig;
  
  // 定时配置 (scheduled 模式)
  cron?: string;
  timezone?: string;
  
  // 止损配置
  stopLoss?: {
    type: 'percent' | 'price' | 'atr' | 'trailing';
    value: number;
    atrPeriod?: number;             // ATR 周期 (type=atr 时使用)
    trailingPercent?: number;       // 追踪止损百分比
  };
  
  // 止盈配置
  takeProfit?: {
    type: 'percent' | 'price' | 'rr';
    value: number;
    rrRatio?: number;               // 盈亏比 (type=rr 时使用)
  };
  
  // 时间退出配置
  timeExit?: {
    type: 'duration' | 'time' | 'session';
    value: number | string;
  };
  
  // 风控配置
  riskCheck: boolean;
  maxPositions?: number;
  cooldownMs?: number;
  
  // 重试配置
  retry?: RetryConfig;
  
  // 高级配置
  dryRun?: boolean;                 // 模拟模式
  paperTrading?: boolean;           // 模拟盘模式
  autoConfirmWarn?: boolean;        // 自动确认警告
}
```

### 7.3 SQLite 表结构

```sql
-- 闭环执行单元表
CREATE TABLE closed_loop_units (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  activated_at INTEGER,
  completed_at INTEGER,
  preflight_result_json TEXT,
  strategy_signal_json TEXT,
  entry_order_json TEXT,
  exit_order_json TEXT,
  position_json TEXT,
  pnl_json TEXT,
  performance_json TEXT,
  retry_count INTEGER DEFAULT 0,
  retry_history_json TEXT DEFAULT '[]',
  error_json TEXT,
  updated_at INTEGER NOT NULL
);

-- 闭环执行历史表 (归档)
CREATE TABLE closed_loop_history (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  symbol TEXT NOT NULL,
  strategy TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  entry_price REAL,
  exit_price REAL,
  pnl REAL,
  pnl_percent REAL,
  duration_ms INTEGER,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  INDEX idx_symbol (symbol),
  INDEX idx_strategy (strategy),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- 闭环事件日志表
CREATE TABLE closed_loop_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id TEXT NOT NULL,
  event_type TEXT NOT NULL,          -- 'status_change', 'risk_check', 'order', 'error'
  event_data_json TEXT,
  timestamp INTEGER NOT NULL,
  INDEX idx_unit_id (unit_id),
  INDEX idx_timestamp (timestamp)
);
```

---

## 8. IPC 接口设计

### 8.1 Renderer → Main（调用）

```typescript
// 创建并启动闭环执行
ipcRenderer.invoke('closedLoop:create', config: ClosedLoopConfig): Promise<string>

// 启动已创建的闭环执行
ipcRenderer.invoke('closedLoop:start', unitId: string): Promise<void>

// 暂停闭环执行
ipcRenderer.invoke('closedLoop:pause', unitId: string): Promise<void>

// 恢复闭环执行
ipcRenderer.invoke('closedLoop:resume', unitId: string): Promise<void>

// 中止闭环执行
ipcRenderer.invoke('closedLoop:abort', unitId: string): Promise<void>

// 确认警告并继续
ipcRenderer.invoke('closedLoop:confirm', unitId: string): Promise<void>

// 获取单个闭环单元状态
ipcRenderer.invoke('closedLoop:get', unitId: string): Promise<ClosedLoopUnit>

// 获取所有闭环单元列表
ipcRenderer.invoke('closedLoop:list', filters?: ClosedLoopFilter): Promise<ClosedLoopUnit[]>

// 获取闭环执行历史
ipcRenderer.invoke('closedLoop:history', options?: HistoryOptions): Promise<ClosedLoopHistory[]>

// 获取闭环统计
ipcRenderer.invoke('closedLoop:stats', timeRange?: TimeRange): Promise<ClosedLoopStats>

// 更新闭环配置
ipcRenderer.invoke('closedLoop:update', unitId: string, config: Partial<ClosedLoopConfig>): Promise<void>

// 删除闭环单元
ipcRenderer.invoke('closedLoop:remove', unitId: string): Promise<void>
```

### 8.2 Main → Renderer（事件推送）

```typescript
// 状态变更事件
ipcRenderer.on('closedLoop:status', (unitId: string, status: ClosedLoopStatus, prevStatus: ClosedLoopStatus) => {})

// 风控检查事件
ipcRenderer.on('closedLoop:risk', (unitId: string, result: RiskCheckResult) => {})

// 订单事件
ipcRenderer.on('closedLoop:order', (unitId: string, order: OrderRecord) => {})

// 持仓事件
ipcRenderer.on('closedLoop:position', (unitId: string, position: PositionRecord) => {})

// 盈亏事件
ipcRenderer.on('closedLoop:pnl', (unitId: string, pnl: PnLRecord) => {})

// 错误事件
ipcRenderer.on('closedLoop:error', (unitId: string, error: ErrorRecord) => {})

// 完成事件
ipcRenderer.on('closedLoop:completed', (unitId: string, summary: ExecutionSummary) => {})
```

---

## 9. 事件设计

### 9.1 内部事件（EventEmitter）

```typescript
// ClosedLoopExecutor 内部事件
interface ClosedLoopEvents {
  'unit:created': (unit: ClosedLoopUnit) => void;
  'unit:started': (unitId: string) => void;
  'unit:statusChanged': (unitId: string, newStatus: ClosedLoopStatus, oldStatus: ClosedLoopStatus) => void;
  'unit:riskChecked': (unitId: string, result: RiskCheckResult) => void;
  'unit:strategyEvaluated': (unitId: string, signal: StrategySignal) => void;
  'unit:orderPlaced': (unitId: string, order: OrderRecord) => void;
  'unit:positionOpened': (unitId: string, position: PositionRecord) => void;
  'unit:positionUpdated': (unitId: string, position: PositionRecord) => void;
  'unit:stopLossTriggered': (unitId: string, price: number) => void;
  'unit:takeProfitTriggered': (unitId: string, price: number) => void;
  'unit:timeExitTriggered': (unitId: string, reason: string) => void;
  'unit:positionClosed': (unitId: string, pnl: PnLRecord) => void;
  'unit:completed': (unitId: string, summary: ExecutionSummary) => void;
  'unit:error': (unitId: string, error: Error) => void;
  'unit:aborted': (unitId: string, reason: string) => void;
  'unit:retrying': (unitId: string, attempt: number, maxAttempts: number) => void;
  
  // 全局事件
  'global:statsUpdated': (stats: GlobalStats) => void;
  'global:circuitBreaker': (reason: string) => void;
}
```

### 9.2 事件流向

```
┌─────────────────┐
│ ClosedLoopUnit  │
│  (状态变更)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  EventEmitter   │────►│   IPC Bridge    │
│   (内部事件)     │     │  (推送到 UI)     │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│   SQLite DB     │
│   (事件日志)     │
└─────────────────┘
```

---

## 10. UI 组件设计

### 10.1 ClosedLoopConfigPanel（闭环配置面板）

```
┌─────────────────────────────────────────┐
│  闭环执行配置                             │
├─────────────────────────────────────────┤
│  执行模式: ○ 立即  ○ 条件触发  ○ 定时    │
│                                         │
│  标的: [AAPL                    ] [🔍]  │
│  策略: [动量突破 ▼]                      │
│  方向: ○ 买入  ○ 卖出                   │
│  数量: [100    ] 股                      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐       │
│  │   止损设置   │  │   止盈设置   │       │
│  │ 类型: [百分比▼]│  │ 类型: [百分比▼]│       │
│  │ 值:   [3   ]% │  │ 值:   [5   ]% │       │
│  │ 追踪: ☑ 启用  │  │ 盈亏比: 1:2   │       │
│  └─────────────┘  └─────────────┘       │
│                                         │
│  时间退出: [持仓24小时后自动平仓 ▼]        │
│                                         │
│  风控前置: ☑ 启用                        │
│  最大持仓: [3    ]                       │
│  冷却时间: [5    ] 分钟                  │
│                                         │
│  重试策略: [指数退避 ▼] 最多 [3] 次       │
│                                         │
│  [🚀 启动闭环执行]  [💾 保存配置]         │
└─────────────────────────────────────────┘
```

### 10.2 ClosedLoopMonitorPanel（闭环监控面板）

```
┌─────────────────────────────────────────┐
│  闭环执行监控                    [🔄刷新] │
├─────────────────────────────────────────┤
│  运行中 (2) │ 已完成 (15) │ 失败 (1)    │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🟢 AAPL 动量突破  [ACTIVE]      │    │
│  │    持仓: 100股 @ $175.50        │    │
│  │    当前: $178.20 (+1.54%)       │    │
│  │    止损: $170.23 | 止盈: $184.28│    │
│  │    已持仓: 2h 15m               │    │
│  │    [📊 详情] [⏹ 平仓]           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🟡 TSLA 突破做多  [PENDING]     │    │
│  │    风控警告: 保证金使用率 78%    │    │
│  │    [✅ 确认继续] [❌ 取消]       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🔴 SPY 开盘策略  [ERROR]        │    │
│  │    错误: 网络超时 (重试 3/3)     │
│  │    [🔄 重试] [🗑️ 删除]           │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

---

## 11. 测试策略

### 11.1 单元测试（>=30 tests）

```typescript
describe('ClosedLoopExecutor', () => {
  // 状态机测试
  describe('状态机', () => {
    it('CREATED → start() → VALIDATING');
    it('VALIDATING → risk_pass → EXECUTING');
    it('VALIDATING → risk_reject → REJECTED');
    it('VALIDATING → risk_warn → PENDING → confirm() → EXECUTING');
    it('EXECUTING → order_filled → ACTIVE');
    it('ACTIVE → stop_loss_hit → CLOSING → close_filled → COMPLETED');
    it('ACTIVE → take_profit_hit → CLOSING → close_filled → COMPLETED');
    it('ACTIVE → time_exit_hit → CLOSING → close_filled → COMPLETED');
    it('any → error() → ERROR → recover() → CREATED');
    it('any → abort() → ABORTED');
  });

  // 执行模式测试
  describe('执行模式', () => {
    it('Immediate Mode: 立即执行完整闭环');
    it('Triggered Mode: 条件触发后执行闭环');
    it('Scheduled Mode: 定时触发后执行闭环');
    it('混合模式: triggered + scheduled 同时存在');
  });

  // 风控前置测试
  describe('风控前置', () => {
    it('risk_pass: 继续执行');
    it('risk_reject: 拒绝执行并记录原因');
    it('risk_warn: 暂停等待人工确认');
    it('autoConfirmWarn: 自动确认警告');
  });

  // 重试机制测试
  describe('重试机制', () => {
    it('固定间隔重试');
    it('指数退避重试');
    it('自适应重试');
    it('致命错误不重试');
    it('重试次数达到上限后转 ERROR');
  });

  // 止损止盈测试
  describe('止损止盈', () => {
    it('百分比止损触发');
    it('价格止损触发');
    it('ATR 止损触发');
    it('追踪止损更新');
    it('百分比止盈触发');
    it('盈亏比止盈触发');
  });

  // 持久化测试
  describe('持久化', () => {
    it('状态变更写入 SQLite');
    it('重启后恢复未完成的闭环单元');
    it('历史记录归档');
  });

  // 并发测试
  describe('并发', () => {
    it('同时运行多个闭环单元');
    it('maxPositions 限制生效');
    it('cooldown 冷却期生效');
  });
});
```

### 11.2 E2E 测试（>=10 tests）

```typescript
describe('ClosedLoop E2E', () => {
  it('完整闭环: immediate → filled → active → SL → closed');
  it('完整闭环: triggered → condition met → filled → active → TP → closed');
  it('完整闭环: scheduled → cron trigger → filled → active → TE → closed');
  it('风控拒绝: risk reject → 不执行');
  it('风控警告: risk warn → 人工确认 → 继续执行');
  it('重试成功: order failed → retry → success');
  it('重试失败: order failed → retry exhausted → error');
  it('并发限制: 3 个 active → 第 4 个被拒绝');
  it('冷却期: 刚完成 → 冷却期内新触发被拒绝');
  it('熔断: circuit breaker → 所有闭环暂停');
});
```

---

## 12. 实现计划

### 12.1 R34 实现计划（ClosedLoopExecutor）

| 阶段 | 内容 | 预计代码 | 预计测试 |
|------|------|---------|---------|
| Day 1 | 骨架 + 状态机 + 配置模型 | 200L | 10 tests |
| Day 2 | Immediate Mode + 风控前置集成 | 200L | 8 tests |
| Day 3 | Triggered Mode + ConditionEngine 集成 | 150L | 6 tests |
| Day 4 | Scheduled Mode + CronScheduler 集成 | 100L | 4 tests |
| Day 5 | 重试机制 + 错误处理 | 100L | 6 tests |
| Day 6 | SQLite 持久化 + 事件系统 | 100L | 4 tests |
| Day 7 | IPC 接口 + UI 集成 + E2E | 150L | 10 tests |
| **合计** | | **~1000L** | **48 tests** |

### 12.2 依赖关系

```
R32 (当前): 清场 + PositionMonitor 骨架
    │
    ▼
R33: PositionMonitor 完整实现 + PerformanceTracker + RebalanceEngine
    │
    ▼
R34: ClosedLoopExecutor 实现 (本设计文档)
    │
    ▼
R35: 全管线 E2E + 集成测试
    │
    ▼
R36: Phase 4.3 验收 + v0.8.0 发布
```

---

## 13. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 状态机过于复杂 | 维护困难 | 使用状态模式，每个状态独立类 |
| 与 RiskEngine 循环依赖 | 死锁 | 通过事件解耦，避免直接回调 |
| 高频事件影响性能 | UI 卡顿 | 事件批处理 + throttle |
| 持久化影响执行延迟 | 执行慢 | 异步写入 + WAL 模式 |
| 并发单元过多 | 内存溢出 | maxConcurrentUnits 限制 + LRU |

---

## 14. 附录

### 14.1 相关文档

- `docs/roadmap/sprint2-phase4.3-plan.md` — Phase 4.3 总体规划
- `docs/roadmap/sprint2-phase4.2-plan.md` — Phase 4.2 条件触发引擎规划
- `electron/engine/trade-executor.ts` — 交易执行引擎
- `electron/engine/strategy-runner.ts` — 策略自动执行引擎
- `electron/engine/risk-engine-v3.ts` — 风控引擎 v3
- `electron/engine/condition-engine.ts` — 条件触发引擎

### 14.2 术语表

| 术语 | 说明 |
|------|------|
| ClosedLoop | 闭环 — 从信号到持仓管理到绩效追踪的完整流程 |
| Pre-Flight | 前置检查 — 执行操作前的风控检查 |
| SL | Stop Loss — 止损 |
| TP | Take Profit — 止盈 |
| TE | Time Exit — 时间退出 |
| ATR | Average True Range — 平均真实波幅 |
| RR | Risk/Reward — 盈亏比 |

---

*文档完成时间: 2026-06-06 11:30*  
*作者: PM (WorkBuddy)*  
*状态: 设计完成，等待 R34 实现*
