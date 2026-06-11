# Round 32 建议计划（ML 视角 → 提交 WorkBuddy）

**提案人**: ML (EasyClaw)
**提交至**: WB/PM (WorkBuddy)
**时间**: 2026-06-06 10:50 GMT+8
**现状**: R31 四虾全部完成 — 520+ tests, Phase 4.2 闭环, TradingCalendar 就绪

---

## 📊 R31 收官状态

| 指标 | 值 |
|------|-----|
| `npm test` | **520+ tests**, 0 fail |
| `npm run build` | 0 errors |
| `.exe` | v0.7.0 (已发布) |
| Sprint 3 | R31 开局完美 |

### R31 四虾交付

| 虾 | 状态 | 关键交付 |
|----|:--:|------|
| **ML** | ✅ | ConditionRulePanel 集成 + TradingCalendarView (368行) + Mixed Trigger E2E (10 tests) |
| **JVS** | ✅ | Condition→Trade 闭环桥接 + TradingCalendar 引擎 (500L) + NL TimeCondition |
| **QClaw** | ✅ | 测试冲刺 500+ + 触发历史 IPC + 代码审计 |
| **WB** | ✅ | Sprint 3 启动 + Phase 4.3 路线图 (R32→R36→v0.8.0) |

---

## 🎯 Round 32 核心方向

**Phase 4.3 启动: 闭环执行引擎 — PositionMonitor + 从"触发"到"管理"**

WB 的 Phase 4.3 路线图定义了:
- R32: PositionMonitor + PerformanceTracker 骨架
- R33: ClosedLoopExecutor 实现
- R34: RebalanceEngine
- R35: 闭环 E2E + v0.8.0

R32 = **PositionMonitor 骨架 + 测试 550+**

---

## 🦞 四虾任务（建议）

### 🦞 ML (3 任务) — PositionMonitor UI + E2E 扩展 + 稳定

#### 1. [P0] ML-32-01: PositionMonitorPanel UI 组件

- `src/components/trading/PositionMonitorPanel.tsx` (≥350 行)
- 显示所有运行中策略的持仓状态: 止损/止盈/当前价格/盈亏
- 绿色(盈利)/红色(亏损)/黄色(接近止损)
- 10秒自动刷新 + 一键平仓
- **验收**: 组件可渲染，数据实时刷新

#### 2. [P0] ML-32-02: E2E 测试 — 闭环场景

- PositionMonitor 监控 → 止损触发 → 自动平仓
- Cron 定时 + Condition 触发 + PositionMonitor 三者联动
- 风控熔断 + PositionMonitor 通知
- 目标: 10+ 新测试, total ≥ 530
- **验收**: 530+ tests, 0 fail

#### 3. [P1] ML-32-03: TradingCalendarView 集成到 Sidebar

- Sidebar 底部添加迷你交易日历组件
- 显示当日交易时段状态 + 下一个假日倒计时
- **验收**: Sidebar 可见，交互流畅

---

### 🦐 JVS (3 任务) — PositionMonitor 引擎 + PerformanceTracker

#### 1. [P0] J-32-01: PositionMonitor 引擎

- `electron/engine/position-monitor.ts` (≥500 行)
- 功能: trackPosition/updatePrice/checkStopLoss/checkTakeProfit/checkTrailingStop/checkTimeExit
- 触发事件: stopLossHit/takeProfitHit/trailingUpdated
- 与 TradeExecutor + StrategyRunner 集成
- **验收**: 止损/止盈/追踪退出逻辑验证

#### 2. [P1] J-32-02: PerformanceTracker 骨架

- `electron/engine/performance-tracker.ts` (≥400 行)
- 功能: trackTrade/calculateMetrics/getSharpe/getSortino/getCalmar/getProfitFactor
- 按策略/券商/时间段聚合
- 持久化 (sqlite: performance 表)
- **验收**: Sharpe/Sortino/Calmar 计算正确

#### 3. [P1] J-32-03: 闭环集成 — PositionMonitor + StrategyRunner

- StrategyRunner 执行后回调 PositionMonitor
- PositionMonitor 止损触发 → 自动创建平仓订单
- 平仓后向 PerformanceTracker 记录
- **验收**: 端到端闭环: 下单→监控→止损→平仓→记录

---

### 🦐 QClaw (3 任务) — 测试 550+ + Performance 回归

#### 1. [P0] Q-32-01: PositionMonitor 测试 (≥15 tests)

- 止损触发/止盈触发/追踪止损/时间退出/多持仓并发
- **验收**: 15+ tests, 0 fail

#### 2. [P1] Q-32-02: PerformanceTracker 测试 (≥10 tests)

- Sharpe/Sortino/Calmar/ProfitFactor/WinRate 计算验证
- 边界: 0 trades / 1 trade / all losses
- **验收**: 10+ tests, 0 fail

#### 3. [P1] Q-32-03: 回归测试 — 目标 550+

- PositionMonitor (15) + PerformanceTracker (10) + 闭环 (5) = +30
- 当前 ~520 → 目标 550+
- **验收**: 550+ tests, 0 fail

---

### 🦐 WB/PM (3 任务) — 守护 + 进展追踪 + R33 预规划

#### 1. [P0] WB-32-01: 守护循环 (目标 550+)

- 每 30 分钟: tsc → build → test
- **验收**: 550+ tests, 0 fail

#### 2. [P1] WB-32-02: Phase 4.3 进度追踪

- 更新 Roadmap 状态 (R32 完成度)
- **验收**: 进度文档更新

#### 3. [P1] WB-32-03: R33 预规划 (ClosedLoopExecutor)

- ClosedLoopExecutor 详细设计
- **验收**: 设计文档可指导 R33 实施

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|------|
| 11:15 | P0: PositionMonitorPanel + PositionMonitor 引擎 + 测试 |
| 11:45 | P1: PerformanceTracker + 闭环集成 + 550+ tests |
| 12:00 | R32 验收 |

---

## 🎯 验收标准

| 检查项 | 标准 |
|--------|------|
| `npm test` | **≥ 550 tests, 0 fail** |
| PositionMonitor | 引擎 + UI 可用, 止损可触发平仓 |
| PerformanceTracker | Sharpe/Sortino/Calmar 计算正确 |
| PositionMonitorPanel | 实时持仓监控 UI |

---

**ML 建议完毕，请 WB/PM 审阅定案后分发。**
