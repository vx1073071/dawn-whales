# 10虾分层并行架构方案

## 1. 虾分工总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PM 协调虾 (WorkBuddy)                        │
│                    契约定义 · 方案整合 · 守护循环 · 验收               │
├─────────────────────────────────────────────────────────────────────┤
│  数据层   │  行情数据虾(MARKET)  │  账户数据虾(ACCOUNT)              │
│  (2只)    │  WS行情 · 缓存 · K线  │  持仓 · 订单 · 资金 · 历史成交     │
├─────────────────────────────────────────────────────────────────────┤
│  券商层   │                    券商适配虾(BROKER)                     │
│  (1只)    │         Futu/Moomoo/IB · OpenDBaseAdapter · 连接管理      │
├─────────────────────────────────────────────────────────────────────┤
│  引擎层   │ 策略虾 │ 风控虾  │  执行虾  │  自动化虾                    │
│  (4只)    │(STRAT)│ (RISK) │  (EXEC)  │  (AUTO)                     │
│           │NL解析 │ 仓位限制│  下单   │  Cron调度                   │
│           │策略引擎│ 熔断  │  撤单   │  条件触发                    │
│           │条件触发│ 回撤  │  重试   │  闭环执行                    │
├─────────────────────────────────────────────────────────────────────┤
│  UI层     │        交易UI虾(UI-TRADE)  │  监控UI虾(UI-MONITOR)        │
│  (2只)    │  订单簿 · 持仓 · 条件规则   │  绩效面板 · 系统监控 · 图表    │
├─────────────────────────────────────────────────────────────────────┤
│  基础设施  │                    QA/测试虾 (QA)                        │
│  (1只)    │      测试质量 · 性能基准 · CI/CD · 代码审计                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 各虾详细职责

### 2.1 行情数据虾 (MARKET-DATA)

**代码目录**: `electron/data/market/`, `electron/engine/ws-market-data.ts`

**核心职责**:
- WebSocket 行情数据接收与分发
- 行情数据缓存 (L1/L2 报价)
- K线数据管理与历史回溯
- 实时数据流处理

**契约输出**:
- `IMarketDataProvider` — 行情数据获取接口
- `IQuoteSnapshot` — 报价快照数据结构
- `ICandleData` — K线数据结构

**契约输入**:
- `IBrokerConnection` — 券商连接状态

---

### 2.2 账户数据虾 (ACCOUNT-DATA)

**代码目录**: `electron/data/account/`, `electron/engine/unified-account-manager.ts`

**核心职责**:
- 多券商账户数据聚合
- 持仓数据统一管理
- 订单历史与成交记录
- 资金变动追踪

**契约输出**:
- `IAccountDataProvider` — 账户数据获取接口
- `IPositionData` — 持仓数据结构
- `IOrderHistory` — 订单历史结构

**契约输入**:
- `IBrokerConnection` — 券商连接状态
- `IMarketDataProvider` — 实时价格更新

---

### 2.3 券商适配虾 (BROKER)

**代码目录**: `electron/broker/`

**核心职责**:
- Futu OpenD 适配
- Moomoo 适配
- IB Gateway 适配
- 统一连接管理

**契约输出**:
- `IBrokerConnection` — 统一券商连接接口
- `IBrokerAdapter` — 券商适配器接口

**契约输入**:
- 无（底层基础设施）

---

### 2.4 策略引擎虾 (STRATEGY)

**代码目录**: `electron/engine/nl-parser.ts`, `electron/engine/strategy-engine.ts`, `electron/engine/condition-engine.ts`

**核心职责**:
- 自然语言策略解析 (NL Parser)
- 策略引擎执行
- 条件触发引擎 (ConditionEngine)
- 策略回测框架

**契约输出**:
- `IStrategyEngine` — 策略执行接口
- `INLParser` — NL 解析接口
- `ISignal` — 交易信号结构
- `IConditionRule` — 条件规则结构

**契约输入**:
- `IMarketDataProvider` — 行情数据
- `IAccountDataProvider` — 账户数据

---

### 2.5 风控引擎虾 (RISK)

**代码目录**: `electron/engine/risk-engine-v3.ts`, `electron/engine/risk-strategy-integrator.ts`

**核心职责**:
- RiskEngine v3 风控检查
- 仓位限制执行
- 熔断机制
- 回撤监控

**契约输出**:
- `IRiskEngine` — 风控引擎接口
- `IRiskCheckResult` — 风控检查结果

**契约输入**:
- `IAccountDataProvider` — 账户/持仓数据
- `ISignal` — 交易信号
- `IOrderResult` — 订单结果

---

### 2.6 交易执行虾 (EXEC)

**代码目录**: `electron/engine/trade-executor.ts`, `electron/ipc/trade-executor-ipc.ts`

**核心职责**:
- 交易信号执行
- 订单创建与发送
- 执行重试机制
- 模拟/实盘模式切换

**契约输出**:
- `ITradeExecutor` — 交易执行接口
- `IOrderResult` — 订单执行结果

**契约输入**:
- `ISignal` — 交易信号
- `IRiskCheckResult` — 风控检查结果
- `IBrokerConnection` — 券商连接
- `IAccountDataProvider` — 账户数据

---

### 2.7 自动化虾 (AUTO)

**代码目录**: `electron/engine/cron-scheduler.ts`, `electron/engine/condition-watcher.ts`, `electron/engine/closed-loop-executor.ts`

**核心职责**:
- CronScheduler 定时调度
- ConditionWatcher 条件监听
- ClosedLoopExecutor 闭环执行
- RebalanceEngine 再平衡

**契约输出**:
- `IAutomationEngine` — 自动化引擎接口
- `ICronTask` — 定时任务结构

**契约输入**:
- `IStrategyEngine` — 策略引擎
- `ITradeExecutor` — 交易执行
- `IRiskEngine` — 风控引擎
- `IMarketDataProvider` — 行情数据
- `ITradingCalendar` — 交易日历

---

### 2.8 交易UI虾 (UI-TRADE)

**代码目录**: `src/components/trading/`

**核心职责**:
- 订单面板 (OrderPanel)
- 持仓面板 (PositionMonitorPanel)
- 条件规则面板 (ConditionRulePanel)
- 券商选择器 (BrokerSelector)

**契约输入**:
- `ITradeExecutor` IPC 接口
- `IAutomationEngine` IPC 接口
- `IAccountDataProvider` IPC 接口

---

### 2.9 监控UI虾 (UI-MONITOR)

**代码目录**: `src/components/dashboard/`, `src/components/monitoring/`

**核心职责**:
- 系统健康面板 (SystemHealthPanel)
- 绩效仪表盘 (PerformanceDashboard)
- 交易日历视图 (TradingCalendarView)
- 实时图表

**契约输入**:
- `IAccountDataProvider` IPC 接口
- `IPerformanceTracker` IPC 接口
- `IMarketDataProvider` IPC 接口

---

### 2.10 QA/测试虾 (QA)

**代码目录**: `tests/`, `.github/workflows/`

**核心职责**:
- 测试质量守护
- 性能基准测试
- CI/CD 配置
- 代码审计

**契约输入**:
- 所有虾的代码变更

---

## 3. 代码目录隔离规则

```
electron/
  data/
    market/           ← 行情数据虾独占
    account/          ← 账户数据虾独占
  broker/
    futu-opend.ts     ← 券商适配虾独占
    moomoo-adapter.ts ← 券商适配虾独占
    ib-adapter.ts     ← 券商适配虾独占
    opend-base-adapter.ts ← 券商适配虾独占
  engine/
    nl-parser.ts      ← 策略虾独占
    strategy-engine.ts ← 策略虾独占
    condition-engine.ts ← 策略虾独占
    condition-watcher.ts ← 自动化虾独占
    risk-engine-v3.ts ← 风控虾独占
    risk-strategy-integrator.ts ← 风控虾独占
    trade-executor.ts ← 执行虾独占
    cron-scheduler.ts ← 自动化虾独占
    closed-loop-executor.ts ← 自动化虾独占
    trading-calendar.ts ← 自动化虾独占 (交易日历)
    position-monitor.ts ← 账户数据虾独占 (持仓监控)
    performance-tracker.ts ← 监控UI虾独占 (绩效追踪)
  ipc/
    trade-executor-ipc.ts ← 执行虾 + 交易UI虾共享
    broker-ipc.ts     ← 券商适配虾独占
    market-data-ipc.ts ← 行情数据虾独占
    account-ipc.ts    ← 账户数据虾独占
src/
  components/
    trading/          ← 交易UI虾独占
    dashboard/        ← 监控UI虾独占
    monitoring/       ← 监控UI虾独占
  hooks/
    useTrade.ts       ← 交易UI虾独占
    useMarketData.ts  ← 行情数据虾独占
    useAccount.ts     ← 账户数据虾独占
    useAutomation.ts  ← 自动化虾独占
tests/
  market/             ← 行情数据虾测试
  account/            ← 账户数据虾测试
  broker/             ← 券商适配虾测试
  strategy/           ← 策略虾测试
  risk/               ← 风控虾测试
  executor/           ← 执行虾测试
  automation/         ← 自动化虾测试
  ui-trading/         ← 交易UI虾测试
  ui-monitor/         ← 监控UI虾测试
  integration/        ← QA虾独占 (集成测试)
  performance/        ← QA虾独占 (性能测试)
contracts/            ← PM虾管理 (契约接口)
```

---

## 4. 契约接口定义 (PM虾管理)

### 4.1 核心契约文件

```
contracts/
  index.ts              ← 契约总出口
  broker-contracts.ts   ← 券商层契约
  data-contracts.ts     ← 数据层契约
  engine-contracts.ts   ← 引擎层契约
  ui-contracts.ts       ← UI层契约
```

### 4.2 契约使用规则

1. **各虾只import自己的契约**，不直接访问其他虾的实现代码
2. **契约变更必须经PM虾审批**，变更后广播到chat-bridge
3. **契约版本化**：每个契约文件顶部标注版本号，如 `// Contract v1.2`
4. **mock实现**：各虾基于契约开发mock实现，用于独立测试

---

## 5. 测试分片脚本

### 5.1 package.json 新增脚本

```json
{
  "scripts": {
    "test:market": "vitest run tests/market/",
    "test:account": "vitest run tests/account/",
    "test:broker": "vitest run tests/broker/",
    "test:strategy": "vitest run tests/strategy/",
    "test:risk": "vitest run tests/risk/",
    "test:executor": "vitest run tests/executor/",
    "test:automation": "vitest run tests/automation/",
    "test:ui-trading": "vitest run tests/ui-trading/",
    "test:ui-monitor": "vitest run tests/ui-monitor/",
    "test:integration": "vitest run tests/integration/",
    "test:performance": "vitest run tests/performance/",
    "test:all": "vitest run --reporter=verbose",
    "test:ci": "vitest run --reporter=junit --outputFile=./test-results/junit.xml"
  }
}
```

### 5.2 各虾测试归属

| 虾 | 测试目录 | 命令 |
|---|---|---|
| 行情数据虾 | `tests/market/` | `npm run test:market` |
| 账户数据虾 | `tests/account/` | `npm run test:account` |
| 券商适配虾 | `tests/broker/` | `npm run test:broker` |
| 策略虾 | `tests/strategy/` | `npm run test:strategy` |
| 风控虾 | `tests/risk/` | `npm run test:risk` |
| 执行虾 | `tests/executor/` | `npm run test:executor` |
| 自动化虾 | `tests/automation/` | `npm run test:automation` |
| 交易UI虾 | `tests/ui-trading/` | `npm run test:ui-trading` |
| 监控UI虾 | `tests/ui-monitor/` | `npm run test:ui-monitor` |
| QA虾 | `tests/integration/` + `tests/performance/` | `npm run test:integration` |

---

## 6. 并行工作流程

### 6.1 每轮启动流程 (5分钟)

```
T+0   PM虾: 定义/更新契约接口
T+1   PM虾: 广播契约变更到chat-bridge
T+2   各虾: 阅读契约，确认理解
T+3   各虾: 基于契约更新mock实现
T+5   各虾: 开始并行编码
```

### 6.2 每轮提交流程 (连续)

```
各虾完成 → git commit (独立目录, 无冲突)
        → npm run test:<自己的分片>
        → 测试通过 → git push
        → PM虾收到通知 → 执行全量守护循环
```

### 6.3 契约变更流程

```
某虾需要契约变更
        → 在chat-bridge提出变更请求
        → PM虾评估影响范围
        → PM虾更新contracts/并广播
        → 受影响虾更新mock实现
        → 继续编码
```

---

## 7. 资源分配

基于用户配置 (24核心 / 64GB内存):

| 虾 | CPU (编译峰值) | 内存 (编译峰值) | 常态CPU | 常态内存 |
|---|---|---|---|---|
| 行情数据虾 | 1.5核 | 400MB | <5% | 200MB |
| 账户数据虾 | 1.5核 | 400MB | <5% | 200MB |
| 券商适配虾 | 1.5核 | 400MB | <5% | 200MB |
| 策略虾 | 1.5核 | 400MB | <5% | 200MB |
| 风控虾 | 1.5核 | 400MB | <5% | 200MB |
| 执行虾 | 1.5核 | 400MB | <5% | 200MB |
| 自动化虾 | 1.5核 | 400MB | <5% | 200MB |
| 交易UI虾 | 1.5核 | 400MB | <5% | 200MB |
| 监控UI虾 | 1.5核 | 400MB | <5% | 200MB |
| QA虾 | 3核 | 800MB | 10% | 400MB |
| **总计** | **18核** | **5.2GB** | **55%** | **2.4GB** |

**结论**: 24核心轻松支撑10只虾同时编译，64GB内存仅用8%。

---

## 8. 预期效率提升

### 8.1 与4虾模式对比

| 指标 | 4虾旧模式 | 10虾新模式 | 提升 |
|---|---|---|---|
| 单轮代码产出 | ~3000L | ~8000L | **2.7x** |
| 单轮测试产出 | +100 | +300 | **3.0x** |
| 单轮等待时间 | ~30min | ~5min | **-83%** |
| 单轮总时间 | 120min | 60min | **2.0x** |
| **单位时间产出** | **25 L/min** | **133 L/min** | **5.3x** |

### 8.2 R33 10虾目标

| 虾 | R33 目标产出 | 代码 | 测试 |
|---|---|---|---|
| 行情数据虾 | WS行情性能优化 + 缓存层 | +400L | +15 |
| 账户数据虾 | PositionMonitor完善 + 持仓同步 | +500L | +20 |
| 券商适配虾 | IB适配器 mock→真实骨架 | +400L | +15 |
| 策略虾 | NL Parser 扩展 + StrategyEngine优化 | +500L | +25 |
| 风控虾 | RiskEngine v3 性能优化 | +300L | +15 |
| 执行虾 | TradeExecutor 重试机制完善 | +300L | +15 |
| 自动化虾 | ClosedLoopExecutor骨架 + RebalanceEngine | +600L | +30 |
| 交易UI虾 | PositionMonitorPanel完善 + 订单面板 | +400L | +15 |
| 监控UI虾 | PerformanceDashboard骨架 + SystemHealth | +400L | +15 |
| QA虾 | 性能基准 + CI配置 + 代码审计 | +200L | +30 |
| **总计** | | **+4000L** | **+215** |

---

## 9. 实施路线图

### Phase 1: 基础设施 (R33 前30分钟)
- [ ] 创建 `contracts/` 目录 + 契约骨架
- [ ] 创建 `tests/` 子目录 + 迁移现有测试
- [ ] 修改 `package.json` 添加分片脚本
- [ ] 各虾确认代码目录归属

### Phase 2: 契约先行 (R33)
- [ ] PM虾定义核心契约接口
- [ ] 各虾基于契约开发mock实现
- [ ] 第一次10虾并行执行

### Phase 3: 稳定运行 (R34+)
- [ ] 根据R33经验调整契约
- [ ] 各虾独立轮次 (完成即开始下一轮)
- [ ] CI/CD 自动分片测试

---

## 10. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| 契约定义不完善 | 中 | 高 | PM虾每轮前5分钟专门审阅契约 |
| 目录边界模糊 | 低 | 中 | 明确代码目录归属规则，冲突时PM裁定 |
| 10虾同时编译CPU满载 | 低 | 低 | 24核心仅用到75%，有余量 |
| 某虾blocker影响全局 | 中 | 中 | 分片测试隔离，全量测试在PM守护循环执行 |
| 契约频繁变更 | 中 | 中 | 契约版本化，变更需审批 |

---

*文档版本: v1.0*  
*创建时间: 2026-06-06 11:57*  
*作者: PM(WorkBuddy)*
