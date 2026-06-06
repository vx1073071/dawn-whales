# Sprint 2 Phase 4.3 规划 — 闭环执行引擎

**规划日期**: 2026-06-06  
**规划人**: PM (WorkBuddy)  
**对应轮次**: R33 — R36  
**前置条件**: Phase 4.2 完成 (ConditionEngine + ConditionWatcher + Triggers + TradingCalendar)

---

## 1. 背景与目标

### 1.1 当前状态 (Phase 4.2 完成后)

| 组件 | 状态 | 功能 |
|------|------|------|
| ConditionEngine | ✅ | 条件触发核心 (above/below/crosses) |
| ConditionWatcher | ✅ | WS 行情 → 条件评估 → 触发 |
| Price/Indicator/Volume Triggers | ✅ | 3 种触发器 |
| RiskEngine v3 | ✅ | 跨券商风控 + 熔断 |
| RiskStrategyIntegrator | ✅ | 策略-风控深度集成 |
| StrategyRunner | ✅ | dry-run + live-run 自动执行 |
| CronScheduler | ✅ | 定时任务调度 |
| TradeExecutor | ✅ | 下单执行 (paper/real) |
| TradingCalendar | 🔄 R31 | 交易日历引擎 |

### 1.2 Phase 4.3 要解决的问题

Phase 4.2 实现了"条件触发 → 自动下单"，但以下关键环节仍缺失：

1. **持仓后管理空白**: 订单执行后，无人监控持仓盈亏、止损止盈
2. **手动止损依赖**: 用户必须手动设置止损单，无法自动化
3. **仓位再平衡缺失**: 投资组合偏离目标权重后，无自动调整机制
4. **绩效追踪薄弱**: 仅记录交易历史，无系统级 P&L 分析

### 1.3 Phase 4.3 目标

**从"自动下单"到"闭环管理"** — 订单执行后，系统自动监控、止损止盈、再平衡、绩效追踪。

---

## 2. 架构设计

### 2.1 新增核心组件

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 4.3 闭环执行引擎                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │  Position    │───▶│  ClosedLoop  │───▶│  Rebalance   │     │
│  │  Monitor     │    │  Executor    │    │  Engine      │     │
│  │  (持仓监控)   │    │  (闭环执行)   │    │  (再平衡)     │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         │                   │                   │              │
│         ▼                   ▼                   ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │  Performance │    │  Order       │    │  Target      │     │
│  │  Tracker     │◀───│  Manager     │◀───│  Allocator   │     │
│  │  (绩效追踪)   │    │  (订单管理)   │    │  (目标配置)   │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              UnifiedAccountManager (已有)                │   │
│  │              TradeExecutor (已有)                        │   │
│  │              RiskEngine v3 (已有)                        │   │
│  │              WS Market Data (已有)                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
TradeExecutor.placeOrder() → 订单成交
    │
    ▼
PositionMonitor.addPosition() → 开始监控
    │
    ├── 价格变动 → 检查止损止盈 → 触发 ClosedLoopExecutor
    │                                    │
    │                                    ▼
    │                           TradeExecutor.placeOrder(平仓)
    │                                    │
    │                                    ▼
    │                           PositionMonitor.removePosition()
    │
    ├── 定时触发 (CronScheduler) → RebalanceEngine.evaluate()
    │                                    │
    │                                    ▼
    │                           TargetAllocator.getTargetWeights()
    │                                    │
    │                                    ▼
    │                           RebalanceEngine.generateOrders()
    │                                    │
    │                                    ▼
    │                           RiskEngine.check() → TradeExecutor
    │
    └── PerformanceTracker.record() ← 所有成交事件
                │
                ▼
        实时 P&L / 胜率 / Sharpe / 最大回撤
```

---

## 3. 组件详细设计

### 3.1 PositionMonitor — 持仓监控引擎

**文件**: `electron/engine/position-monitor.ts` (预计 >=500 行)  
**职责**: 追踪所有持仓，实时监控盈亏，检测止损止盈条件

**核心数据结构**:
```typescript
interface MonitoredPosition {
  positionId: string;
  symbol: string;
  broker: BrokerType;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  
  // 止损止盈配置
  stopLoss?: { type: 'price' | 'percent'; value: number };
  takeProfit?: { type: 'price' | 'percent'; value: number };
  trailingStop?: { distance: number; highestPrice: number };
  
  // 时间限制
  maxHoldTime?: number; // 毫秒
  entryTime: number;
  
  // 状态
  status: 'ACTIVE' | 'STOP_LOSS_TRIGGERED' | 'TAKE_PROFIT_TRIGGERED' 
        | 'TRAILING_STOP_TRIGGERED' | 'TIME_EXIT' | 'MANUAL_CLOSE';
  
  // 关联
  strategyId?: string;
  conditionId?: string;
}
```

**核心方法**:
```typescript
class PositionMonitor extends EventEmitter {
  // 持仓管理
  addPosition(position: MonitoredPosition): void;
  updatePosition(positionId: string, updates: Partial<MonitoredPosition>): void;
  removePosition(positionId: string): void;
  getPosition(positionId: string): MonitoredPosition | undefined;
  getAllPositions(): MonitoredPosition[];
  getPositionsByStrategy(strategyId: string): MonitoredPosition[];
  getPositionsBySymbol(symbol: string): MonitoredPosition[];
  
  // 监控控制
  startMonitoring(): void;
  stopMonitoring(): void;
  
  // 止损止盈配置
  setStopLoss(positionId: string, config: StopLossConfig): void;
  setTakeProfit(positionId: string, config: TakeProfitConfig): void;
  setTrailingStop(positionId: string, distance: number): void;
  setMaxHoldTime(positionId: string, durationMs: number): void;
  
  // 价格更新 (由 WS 行情驱动)
  onPriceUpdate(symbol: string, price: number): void;
  
  // 事件
  events: {
    'stop-loss-triggered': (position: MonitoredPosition) => void;
    'take-profit-triggered': (position: MonitoredPosition) => void;
    'trailing-stop-triggered': (position: MonitoredPosition) => void;
    'time-exit-triggered': (position: MonitoredPosition) => void;
    'position-updated': (position: MonitoredPosition) => void;
  }
}
```

**止损止盈触发逻辑**:
```
价格更新 → 遍历该 symbol 的所有持仓
    │
    ├── LONG 持仓:
    │   ├── 当前价 <= 止损价 → emit 'stop-loss-triggered'
    │   ├── 当前价 >= 止盈价 → emit 'take-profit-triggered'
    │   └── 追踪止损: 当前价 < (最高价 - distance) → emit 'trailing-stop-triggered'
    │
    ├── SHORT 持仓:
    │   ├── 当前价 >= 止损价 → emit 'stop-loss-triggered'
    │   ├── 当前价 <= 止盈价 → emit 'take-profit-triggered'
    │   └── 追踪止损: 当前价 > (最低价 + distance) → emit 'trailing-stop-triggered'
    │
    └── 时间检查: now - entryTime >= maxHoldTime → emit 'time-exit-triggered'
```

**验收标准**:
- [ ] 支持 LONG/SHORT 双向持仓监控
- [ ] 支持 price/percent 两种止损止盈配置
- [ ] 支持追踪止损 (trailing stop)
- [ ] 支持最大持仓时间限制
- [ ] 与 WS 行情实时联动 (< 100ms 延迟)
- [ ] >=20 个单元测试，0 fail

---

### 3.2 ClosedLoopExecutor — 闭环执行引擎

**文件**: `electron/engine/closed-loop-executor.ts` (预计 >=600 行)  
**职责**: 监听 PositionMonitor 触发事件，自动执行平仓订单

**核心设计**:
```typescript
interface ClosedLoopConfig {
  // 全局默认配置
  defaultStopLoss?: StopLossConfig;
  defaultTakeProfit?: TakeProfitConfig;
  defaultTrailingStop?: number;
  defaultMaxHoldTime?: number;
  
  // 执行模式
  mode: 'AUTOMATIC' | 'CONFIRMATION' | 'DRY_RUN';
  
  // 风控前置
  requireRiskCheck: boolean;
  
  // 冷却期 (避免频繁触发)
  cooldownMs: number;
  
  // 滑点容忍
  maxSlippage: number; // 百分比
}

class ClosedLoopExecutor extends EventEmitter {
  constructor(
    positionMonitor: PositionMonitor,
    tradeExecutor: TradeExecutor,
    riskEngine: RiskEngineV3,
    config: ClosedLoopConfig
  );
  
  // 启动/停止
  start(): void;
  stop(): void;
  
  // 配置管理
  updateConfig(config: Partial<ClosedLoopConfig>): void;
  getConfig(): ClosedLoopConfig;
  
  // 事件处理 (内部)
  private handleStopLoss(position: MonitoredPosition): Promise<void>;
  private handleTakeProfit(position: MonitoredPosition): Promise<void>;
  private handleTrailingStop(position: MonitoredPosition): Promise<void>;
  private handleTimeExit(position: MonitoredPosition): Promise<void>;
  
  // 执行平仓
  private executeClose(position: MonitoredPosition, reason: string): Promise<OrderResult>;
  
  // 事件
  events: {
    'stop-loss-executed': (position: MonitoredPosition, order: OrderResult) => void;
    'take-profit-executed': (position: MonitoredPosition, order: OrderResult) => void;
    'trailing-stop-executed': (position: MonitoredPosition, order: OrderResult) => void;
    'time-exit-executed': (position: MonitoredPosition, order: OrderResult) => void;
    'execution-failed': (position: MonitoredPosition, error: Error) => void;
  }
}
```

**执行流程**:
```
PositionMonitor 'stop-loss-triggered'
    │
    ▼
ClosedLoopExecutor.handleStopLoss()
    │
    ├── 检查 cooldown (避免重复触发)
    ├── 检查 mode:
    │   ├── AUTOMATIC → 直接执行平仓
    │   ├── CONFIRMATION → 发送通知，等待用户确认
    │   └── DRY_RUN → 记录日志，不执行
    │
    ├── 如需风控检查:
    │   └── RiskEngine.check() → 拒绝则记录原因
    │
    ├── 构建平仓订单 (反向 side, 相同 quantity)
    ├── 计算限价 (当前价 ± maxSlippage 容忍)
    ├── TradeExecutor.placeOrder()
    ├── 订单成交后:
    │   ├── PositionMonitor.removePosition()
    │   ├── PerformanceTracker.recordExit()
    │   └── emit 'stop-loss-executed'
    │
    └── 执行失败:
        └── emit 'execution-failed' → 重试机制 (最多 3 次)
```

**验收标准**:
- [ ] 支持 AUTOMATIC/CONFIRMATION/DRY_RUN 三种模式
- [ ] 止损止盈时间退出全部自动执行
- [ ] cooldown 机制防止重复触发
- [ ] 风控前置检查
- [ ] 执行失败重试 (最多 3 次)
- [ ] >=25 个单元测试，0 fail

---

### 3.3 RebalanceEngine — 再平衡引擎

**文件**: `electron/engine/rebalance-engine.ts` (预计 >=400 行)  
**职责**: 定期评估投资组合权重，生成调仓订单

**核心数据结构**:
```typescript
interface RebalanceConfig {
  strategyId: string;
  
  // 目标权重
  targetWeights: { symbol: string; weight: number; broker?: BrokerType }[];
  
  // 再平衡触发条件
  trigger: {
    type: 'SCHEDULED' | 'THRESHOLD' | 'MANUAL';
    // SCHEDULED: cron 表达式
    cronExpression?: string;
    // THRESHOLD: 偏离阈值 (%)
    deviationThreshold?: number;
  };
  
  // 执行参数
  execution: {
    mode: 'IMMEDIATE' | 'TWAP' | 'VWAP';  // 立即 / 时间加权 / 成交量加权
    maxOrderSize?: number;  // 单笔最大订单
    maxSlippage: number;
  };
  
  // 约束
  constraints: {
    minOrderValue: number;
    excludeSymbols?: string[];
    maxTurnoverPerDay?: number;
  };
}

interface RebalanceResult {
  rebalanceId: string;
  timestamp: number;
  beforeWeights: { symbol: string; weight: number; value: number }[];
  afterWeights: { symbol: string; weight: number; value: number }[];
  orders: OrderPlan[];
  executed: boolean;
  totalValue: number;
}
```

**核心方法**:
```typescript
class RebalanceEngine extends EventEmitter {
  constructor(
    unifiedAccountManager: UnifiedAccountManager,
    tradeExecutor: TradeExecutor,
    riskEngine: RiskEngineV3,
    tradingCalendar: TradingCalendar
  );
  
  // 配置管理
  addRebalanceConfig(config: RebalanceConfig): void;
  removeRebalanceConfig(strategyId: string): void;
  updateRebalanceConfig(strategyId: string, updates: Partial<RebalanceConfig>): void;
  getRebalanceConfig(strategyId: string): RebalanceConfig | undefined;
  
  // 启动/停止
  start(): void;
  stop(): void;
  
  // 评估与执行
  evaluate(strategyId: string): Promise<RebalanceResult>;
  evaluateAll(): Promise<RebalanceResult[]>;
  
  // 偏离度计算
  calculateDeviation(strategyId: string): { symbol: string; currentWeight: number; targetWeight: number; deviation: number }[];
  
  // 生成调仓订单
  private generateOrders(config: RebalanceConfig, currentHoldings: Position[]): OrderPlan[];
  
  // 事件
  events: {
    'rebalance-evaluated': (result: RebalanceResult) => void;
    'rebalance-executed': (result: RebalanceResult) => void;
    'rebalance-skipped': (strategyId: string, reason: string) => void;
  }
}
```

**再平衡流程**:
```
CronScheduler 触发 / 手动触发 / 偏离阈值触发
    │
    ▼
RebalanceEngine.evaluate(strategyId)
    │
    ├── 检查 TradingCalendar: 是否交易时段?
    │   └── 否 → emit 'rebalance-skipped' (非交易时段)
    │
    ├── UnifiedAccountManager.getAllPositions()
    │
    ├── calculateDeviation(): 当前权重 vs 目标权重
    │   └── 最大偏离 < deviationThreshold? 
    │       └── 是 → emit 'rebalance-skipped' (偏离不足)
    │
    ├── generateOrders(): 计算调仓订单
    │   ├── 卖出超配仓位
    │   ├── 买入低配仓位
    │   └── 应用约束 (minOrderValue, maxOrderSize)
    │
    ├── RiskEngine.check() 批量风控检查
    │
    ├── 执行模式:
    │   ├── IMMEDIATE → 一次性全部下单
    │   ├── TWAP → 拆单，时间加权平均
    │   └── VWAP → 拆单，成交量加权平均
    │
    └── emit 'rebalance-executed'
```

**验收标准**:
- [ ] 支持 SCHEDULED / THRESHOLD / MANUAL 三种触发
- [ ] 支持 IMMEDIATE / TWAP / VWAP 三种执行模式
- [ ] 偏离度计算准确
- [ ] 约束条件正确应用
- [ ] 非交易时段自动跳过
- [ ] >=15 个单元测试，0 fail

---

### 3.4 PerformanceTracker — 绩效追踪引擎

**文件**: `electron/engine/performance-tracker.ts` (预计 >=400 行)  
**职责**: 追踪每笔交易的完整生命周期，计算绩效指标

**核心数据结构**:
```typescript
interface TradeRecord {
  tradeId: string;
  strategyId?: string;
  symbol: string;
  broker: BrokerType;
  
  // 入场
  entryOrderId: string;
  entryTime: number;
  entryPrice: number;
  entryQuantity: number;
  entrySide: 'BUY' | 'SELL';
  
  // 出场
  exitOrderId?: string;
  exitTime?: number;
  exitPrice?: number;
  exitQuantity?: number;
  exitSide?: 'BUY' | 'SELL';
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP' | 
               'TIME_EXIT' | 'MANUAL' | 'REBALANCE' | 'STRATEGY';
  
  // 绩效
  realizedPnl?: number;
  realizedPnlPct?: number;
  holdingPeriodMs?: number;
  maxUnrealizedPnl?: number;
  maxUnrealizedDrawdown?: number;
}

interface PerformanceSummary {
  strategyId?: string;
  period: { start: number; end: number };
  
  // 基础统计
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // P&L
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  
  // 风险调整
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  calmarRatio: number;
  
  // 效率
  avgHoldingPeriodMs: number;
  avgSlippage: number;
}
```

**核心方法**:
```typescript
class PerformanceTracker {
  // 记录
  recordEntry(order: OrderResult): TradeRecord;
  recordExit(tradeId: string, order: OrderResult, reason: string): TradeRecord;
  recordUnrealizedPnl(tradeId: string, currentPrice: number): void;
  
  // 查询
  getTrade(tradeId: string): TradeRecord | undefined;
  getTradesByStrategy(strategyId: string): TradeRecord[];
  getTradesBySymbol(symbol: string): TradeRecord[];
  getTradesByPeriod(start: number, end: number): TradeRecord[];
  
  // 汇总
  getPerformanceSummary(options?: { strategyId?: string; period?: { start: number; end: number } }): PerformanceSummary;
  getDailyPnl(strategyId?: string): { date: string; pnl: number; trades: number }[];
  getMonthlyPnl(strategyId?: string): { month: string; pnl: number; trades: number }[];
  
  // 实时更新 (由 PositionMonitor 驱动)
  updateRealtimePnl(symbol: string, price: number): void;
}
```

**验收标准**:
- [ ] 完整记录每笔交易的生命周期
- [ ] 支持多种出场原因分类
- [ ] 计算 Sharpe / Sortino / Calmar / Profit Factor
- [ ] 支持日/月 P&L 汇总
- [ ] 与 PositionMonitor 实时联动
- [ ] >=15 个单元测试，0 fail

---

## 4. 与现有系统的集成

### 4.1 集成关系图

```
┌────────────────────────────────────────────────────────────┐
│                      main.ts 集成点                         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  // 初始化                                                   │
│  const positionMonitor = new PositionMonitor();             │
│  const closedLoopExecutor = new ClosedLoopExecutor(         │
│    positionMonitor, tradeExecutor, riskEngine, config       │
│  );                                                         │
│  const rebalanceEngine = new RebalanceEngine(               │
│    unifiedAccountManager, tradeExecutor, riskEngine,        │
│    tradingCalendar                                          │
│  );                                                         │
│  const performanceTracker = new PerformanceTracker();       │
│                                                             │
│  // 事件链                                                   │
│  tradeExecutor.on('order-filled', (order) => {              │
│    positionMonitor.addPosition(order);                      │
│    performanceTracker.recordEntry(order);                   │
│  });                                                        │
│                                                             │
│  positionMonitor.on('stop-loss-triggered', (pos) => {       │
│    closedLoopExecutor.handleStopLoss(pos);                  │
│  });                                                        │
│                                                             │
│  closedLoopExecutor.on('stop-loss-executed', (pos, order) => {│
│    performanceTracker.recordExit(pos.id, order, 'STOP_LOSS');│
│  });                                                        │
│                                                             │
│  // IPC 暴露                                                 │
│  ipcMain.handle('position:list', ...)                       │
│  ipcMain.handle('position:setStopLoss', ...)                │
│  ipcMain.handle('rebalance:evaluate', ...)                  │
│  ipcMain.handle('performance:summary', ...)                 │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 4.2 IPC 接口新增

| IPC Channel | 方向 | 参数 | 返回 |
|-------------|------|------|------|
| `position:list` | renderer→main | `{ strategyId?, symbol? }` | `MonitoredPosition[]` |
| `position:setStopLoss` | renderer→main | `{ positionId, config }` | `boolean` |
| `position:setTakeProfit` | renderer→main | `{ positionId, config }` | `boolean` |
| `position:setTrailingStop` | renderer→main | `{ positionId, distance }` | `boolean` |
| `closedLoop:getConfig` | renderer→main | `{}` | `ClosedLoopConfig` |
| `closedLoop:updateConfig` | renderer→main | `{ config }` | `boolean` |
| `rebalance:evaluate` | renderer→main | `{ strategyId }` | `RebalanceResult` |
| `rebalance:addConfig` | renderer→main | `{ config }` | `boolean` |
| `rebalance:removeConfig` | renderer→main | `{ strategyId }` | `boolean` |
| `performance:summary` | renderer→main | `{ strategyId?, period? }` | `PerformanceSummary` |
| `performance:dailyPnl` | renderer→main | `{ strategyId? }` | `DailyPnl[]` |

---

## 5. UI 组件规划

### 5.1 PositionMonitorPanel

**文件**: `src/components/trading/PositionMonitorPanel.tsx` (预计 >=400 行)

- 持仓列表: symbol / quantity / entryPrice / currentPrice / unrealizedPnl
- 止损止盈配置: 可编辑的输入框
- 追踪止损开关 + 距离设置
- 最大持仓时间设置
- 实时盈亏百分比 (红色/绿色)
- 持仓状态指示 (ACTIVE / 已触发止损等)

### 5.2 ClosedLoopConfigPanel

**文件**: `src/components/trading/ClosedLoopConfigPanel.tsx` (预计 >=300 行)

- 全局模式切换: AUTOMATIC / CONFIRMATION / DRY_RUN
- 默认止损止盈配置
- 冷却期设置
- 滑点容忍设置
- 风控前置开关

### 5.3 RebalancePanel

**文件**: `src/components/trading/RebalancePanel.tsx` (预计 >=350 行)

- 再平衡策略列表
- 目标权重配置 (可拖拽调整)
- 触发条件设置 (定时 / 偏离阈值)
- 执行模式选择 (IMMEDIATE / TWAP / VWAP)
- 偏离度可视化 (当前 vs 目标)
- 一键再平衡按钮

### 5.4 PerformanceDashboard

**文件**: `src/components/trading/PerformanceDashboard.tsx` (预计 >=400 行)

- 核心指标卡片: 总收益 / 胜率 / Sharpe / 最大回撤
- 日/月 P&L 折线图
- 交易分布饼图 (盈亏比)
- 持仓时间分布
- 策略对比表格

---

## 6. R33 — R36 任务分解

### R33: PositionMonitor + PerformanceTracker 骨架

**JVS**:
- [P0] J-33-01: PositionMonitor 核心实现 (>=500L)
- [P0] J-33-02: PerformanceTracker 核心实现 (>=400L)
- [P1] J-33-03: PositionMonitorPanel UI (>=400L)

**ML**:
- [P0] ML-33-01: main.ts 集成 PositionMonitor + PerformanceTracker
- [P0] ML-33-02: PerformanceDashboard UI (>=400L)
- [P1] ML-33-03: IPC handlers 实现

**QClaw**:
- [P0] Q-33-01: PositionMonitor 测试 (>=20 tests)
- [P0] Q-33-02: PerformanceTracker 测试 (>=15 tests)
- [P1] Q-33-03: 测试扩量至 530+

**PM/WB**:
- [P0] WB-33-01: R33 方案广播 + 守护循环
- [P1] WB-33-02: ClosedLoopExecutor 详细设计文档

---

### R34: ClosedLoopExecutor 实现

**JVS**:
- [P0] J-34-01: ClosedLoopExecutor 核心实现 (>=600L)
- [P0] J-34-02: ClosedLoopExecutor 与 TradeExecutor 集成
- [P1] J-34-03: ClosedLoopConfigPanel UI (>=300L)

**ML**:
- [P0] ML-34-01: main.ts 集成 ClosedLoopExecutor
- [P0] ML-34-02: 止损止盈通知 UI (Toast/Alert)
- [P1] ML-34-03: 闭环执行 E2E 测试 (>=10 tests)

**QClaw**:
- [P0] Q-34-01: ClosedLoopExecutor 测试 (>=25 tests)
- [P0] Q-34-02: 执行失败重试场景测试
- [P1] Q-34-03: DRY_RUN 模式验证测试

**PM/WB**:
- [P0] WB-34-01: R34 方案广播 + 守护循环
- [P1] WB-34-02: RebalanceEngine 详细设计文档

---

### R35: RebalanceEngine 实现

**JVS**:
- [P0] J-35-01: RebalanceEngine 核心实现 (>=400L)
- [P0] J-35-02: TargetAllocator 模块 (>=200L)
- [P1] J-35-03: RebalancePanel UI (>=350L)

**ML**:
- [P0] ML-35-01: main.ts 集成 RebalanceEngine + CronScheduler
- [P0] ML-35-02: 偏离度可视化组件
- [P1] ML-35-03: TWAP/VWAP 执行模拟

**QClaw**:
- [P0] Q-35-01: RebalanceEngine 测试 (>=15 tests)
- [P0] Q-35-02: 约束条件边界测试
- [P1] Q-35-03: 全管线集成测试 (>=10 tests)

**PM/WB**:
- [P0] WB-35-01: R35 方案广播 + 守护循环
- [P1] WB-35-02: Phase 4.4 (v0.8.0) 规划

---

### R36: Phase 4.3 验收 + 全管线闭环 E2E

**JVS**:
- [P0] J-36-01: PositionMonitor + ClosedLoopExecutor + RebalanceEngine 端到端联调
- [P0] J-36-02: 全管线闭环 E2E 测试辅助函数
- [P1] J-36-03: 性能优化 (PositionMonitor 批量价格更新)

**ML**:
- [P0] ML-36-01: 全管线闭环 E2E 测试 (>=15 tests)
  - NL 创建策略 → 条件触发 → 下单 → 持仓监控 → 止损止盈 → 绩效追踪
- [P0] ML-36-02: v0.8.0 Release 准备
- [P1] ML-36-03: 闭环执行演示脚本

**QClaw**:
- [P0] Q-36-01: 全管线 E2E 测试 (>=15 tests)
- [P0] Q-36-02: 测试扩量至 600+
- [P1] Q-36-03: 并发压力测试 (多策略 + 多持仓 + 同时触发)

**PM/WB**:
- [P0] WB-36-01: R36 方案广播 + 守护循环
- [P0] WB-36-02: Phase 4.3 验收报告
- [P0] WB-36-03: v0.8.0 GitHub Release

---

## 7. 里程碑时间线

| 时间 | 里程碑 | 关键交付 |
|------|--------|---------|
| R33 | PositionMonitor + PerformanceTracker | 持仓监控 + 绩效追踪骨架 |
| R34 | ClosedLoopExecutor | 自动止损止盈闭环 |
| R35 | RebalanceEngine | 投资组合再平衡 |
| R36 | Phase 4.3 验收 + v0.8.0 | 全管线闭环 E2E + 版本发布 |

---

## 8. 验收标准

### 8.1 引擎级验收

| 组件 | 代码行 | 测试数 | 关键功能 |
|------|--------|--------|---------|
| PositionMonitor | >=500 | >=20 | LONG/SHORT 监控、止损止盈、追踪止损、时间退出 |
| ClosedLoopExecutor | >=600 | >=25 | 三种模式、风控前置、重试机制、cooldown |
| RebalanceEngine | >=400 | >=15 | 三种触发、三种执行、偏离度计算、约束应用 |
| PerformanceTracker | >=400 | >=15 | 生命周期记录、Sharpe/Sortino/Calmar、日/月 P&L |

### 8.2 系统级验收

- [ ] `npm test`: >= 600 tests, 0 fail
- [ ] `tsc --noEmit`: 0 errors
- [ ] `npm run build`: 0 errors
- [ ] 全管线闭环 E2E: NL → 策略 → 条件触发 → 下单 → 持仓监控 → 止损止盈 → 绩效追踪
- [ ] v0.8.0 .exe 可用

### 8.3 性能验收

- [ ] PositionMonitor 价格更新延迟 < 100ms
- [ ] ClosedLoopExecutor 触发到下单延迟 < 500ms
- [ ] RebalanceEngine 评估 < 1s (100 个持仓以内)
- [ ] PerformanceTracker 查询 < 200ms

---

## 9. 风险与缓解措施

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| PositionMonitor 与 WS 行情耦合过紧导致性能问题 | 中 | 高 | 批量更新 + 抽样频率控制 |
| ClosedLoopExecutor 自动止损在极端行情下频繁触发 | 中 | 高 | cooldown + 最小触发间隔 + 熔断联动 |
| RebalanceEngine 调仓订单过多导致风控拒绝 | 低 | 中 | 批量风控检查 + 优先级排序 |
| 绩效追踪数据量大导致内存问题 | 中 | 中 | 定期归档 + 数据库持久化 |
| 全管线 E2E 测试复杂度高 | 高 | 中 | 分阶段测试 +  Mock 辅助 |

---

## 10. 依赖关系

```
R33: PositionMonitor + PerformanceTracker
    ├── 依赖: TradeExecutor (已有)
    ├── 依赖: WS Market Data (已有)
    └── 依赖: UnifiedAccountManager (已有)

R34: ClosedLoopExecutor
    ├── 依赖: PositionMonitor (R33)
    ├── 依赖: TradeExecutor (已有)
    ├── 依赖: RiskEngine v3 (已有)
    └── 依赖: TradingCalendar (R31)

R35: RebalanceEngine
    ├── 依赖: UnifiedAccountManager (已有)
    ├── 依赖: TradeExecutor (已有)
    ├── 依赖: RiskEngine v3 (已有)
    ├── 依赖: TradingCalendar (R31)
    └── 依赖: CronScheduler (已有)

R36: 全管线闭环 E2E
    ├── 依赖: 所有 R33-R35 组件
    ├── 依赖: ConditionEngine (R30)
    ├── 依赖: StrategyRunner (R29)
    └── 依赖: NL Parser (已有)
```

---

*Phase 4.3 规划完成。等待 R33 启动指令。*
