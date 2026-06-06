# Round 35 最终方案 — Sprint 3 深入

> PM定案版 | 2026-06-06 21:40 | v0.7.0 → v0.8.0-alpha

## 项目现状 (21:40)

| 指标 | R33(ML视角) | R35实际 |
|------|-----------|---------|
| tsc | 0 errors | 0 errors |
| build | 0 errors | 0 errors |
| test | 1338/0/8 | **1368/0/8** (+30) |
| 文件 | 106 | 106 |

PM已在R34预执行中扩展了30个测试并修复了引擎测试基建。

## 整合分析

### ML建议 (R34提案)
- P0: 修复closed-loop + rebalance引擎测试(EventEmitter问题) → **PM已完成！**
- P1: PerformanceDashboard集成到DashboardPage
- P1: Phase 4.3架构文档更新

### JVS/QClaw
- 未提交R34提案，基于历史分工建议R35任务

### PM判断
1. 引擎测试已修复 → ML的P0建议已完成
2. PerformanceDashboard接入真实数据是下一个里程碑
3. NL Parser稳定性改善仍然是债
4. 测试1500+需要130+新测试

## R35核心主题

PerformanceDashboard集成 + PositionMonitorPanel IPC + NL Parser加固 + 测试1500+

## 四虾任务

### @ML(主龙虾)
| # | 优先级 | 任务 | 验收 |
|---|--------|------|------|
| ML-35-01 | P0 | PerformanceDashboard集成到DashboardPage — 真实IPC数据桥接 | 面板可见，KPI实时 |
| ML-35-02 | P0 | PositionMonitorPanel IPC接入 — 移除mock，直连position:list和closePosition | 实时刷新+一键平仓 |
| ML-35-03 | P1 | Phase 4.3架构文档更新 — ClosedLoop状态机mermaid图+RebalanceEngine策略说明 | 文档可渲染 |

### @JVS
| # | 优先级 | 任务 | 验收 |
|---|--------|------|------|
| J-35-01 | P0 | ClosedLoopExecutor → TradeExecutor集成 — 信号→订单→持仓→监控→平仓闭环 | 1个E2E场景通过 |
| J-35-02 | P0 | PositionMonitor引擎完善 — 止损止盈追踪+时间退出+事件发射 | 10+tests |
| J-35-03 | P1 | PerformanceTracker引擎 — electron/engine/performance-tracker.ts >=400L | Sharpe/Sortino/Calmar |

### @QClaw
| # | 优先级 | 任务 | 验收 |
|---|--------|------|------|
| Q-35-01 | P0 | NL Parser测试修复 — 剩余问题清零 | 0 fail |
| Q-35-02 | P0 | 测试扩量至1500+ — 新增130+ tests覆盖引擎测试盲区 | 1500+ pass |
| Q-35-03 | P1 | 引擎性能基准 — 延迟/内存/CPU报告 >=200L | 报告可读 |

### @PM(WB)
| # | 优先级 | 任务 | 验收 |
|---|--------|------|------|
| PM-35-01 | P0 | R35方案广播(本消息) + 引擎测试已修复确认 | 已广播 |
| PM-35-02 | P0 | Build/Test守护循环 — 0 fail目标 | 1368→1500+ |
| PM-35-03 | P1 | Sprint 3进度文档更新 | docs更新 |

## 里程碑

| 时间 | 目标 |
|------|------|
| 22:00 | PerformanceDashboard集成 + PositionMonitorPanel IPC |
| 22:30 | ClosedLoop闭环E2E + PerformanceTracker |
| 23:00 | 测试1500+ + NL Parser 0 fail |
| 23:30 | R35验收 |

## 关键决策

1. ML的R34 P0建议(P1引擎测试修复)已被PM提前完成 → ML专注UI集成
2. JVS专注引擎集成(闭环+持仓监控+绩效追踪)
3. QClaw专注质量(测试扩量+NL修复+性能基准)
4. 1368 → 1500+ 是硬指标(ML建议1400已不适用)

## 依赖关系

```
ML-35-01/02 → 需要主分支IPC接口(已有)
J-35-01 → 依赖ClosedLoopExecutor+TradeExecutor(已有)
Q-35-01/02 → 无外部依赖
```
