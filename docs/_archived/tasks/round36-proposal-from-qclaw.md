# Round 36 提案 — QClaw
> 时间: 2026-06-06 23:14 GMT+8 | 状态: 已提交待确认
> 上轮: R35 (1357 tests / 0 failed ✅) | 分支: master

---

## 一、诊断：当前状态

**Phase 4.3 架构已设计（ML R35），但集成度不足：**

| 组件 | 状态 | 说明 |
|------|------|------|
| ConditionEngine | ✅ 完成 | 条件解析/评估/触发 |
| ClosedLoopExecutor | ✅ 完成 | 状态机/信号分发 |
| RebalanceEngine | ✅ 完成 | 再平衡/阈值触发 |
| PositionMonitor | ✅ 完成 | 持仓监控/止损止盈 |
| PerformanceTracker | ✅ 完成 | 绩效归因 |
| **ConditionTradeBridge** | ❌ 从未实现 | ConditionEngine → TradeExecutor 桥梁 |
| **Engine Registry** | ❌ 从未实现 | 全局单例管理 |
| **StrategyPage UI** | ⚠️ 部分 | ClosedLoop/Rebalance 控制面板 |

**已跳过测试（需 E2E 环境）：**
- `jvs-e2e-validation.test.ts` — 103 lines removed (ES module / Node.js 不兼容)

---

## 二、R36 主题：**Production Readiness — Phase 4.3 收尾**

打通 Condition → Trade → Position → Performance 全链路最后ー公里。

---

## 三、任务分配（4 虾）

### Q-36（QClaw）— 全链路引擎集成

**P0: ConditionTradeBridge 实现**（从未实现，最关键阻断项）
- 职责：从 ConditionEngine 接收触发信号，转换为 TradeExecutor 可执行的订单
- 输入：`ConditionTriggered` 事件 + `TradingConfig`
- 输出：调用 `TradeExecutor.executeSignal()` 或 `TradeExecutor.placeOrder()`
- 需处理：信号去重、频率控制（cooldown）、 broker 路由
- 测试：+20 tests（正常路径 + 错误处理 + 去重）

**P0: Engine Registry 实现**
- 全局 `EngineRegistry` 单例，统一管理所有 engine 实例
- 解决循环依赖：ConditionEngine ↔ TradeExecutor ↔ RiskEngine
- 提供 `getEngine(name)` 接口

**P1: ConditionWatcher E2E 集成**
- 接入 WebSocket 实时行情
- 连接 ConditionEngine 条件评估循环
- 集成到 `LiveMonitorPage`

---

### J-36（JVS）— 边界测试 + 组件验证

**P0: ClosedLoopExecutor 边界测试（+15 tests）**
- 13 状态机的每个边界转换
- `maxPositions` 满仓拒绝
- `cooldown` 期间信号忽略
- 快速撤销后重新入场

**P0: RebalanceEngine 边界测试（+15 tests）**
- 多标的再平衡优先顺序
- `threshold=0` 禁用再平衡
- 资金不足时的部分再平衡
- 高频再平衡保护（minInterval）

**P1: ConditionEngine 负面测试**
- 无效标的符号解析
- 矛盾条件（RSI>80 且 RSI<20）
- 网络超时降级

---

### K-36（K lobster）— 测试覆盖 + 性能基准

**P0: q35-trading-components 移出 vitest exclude**
- 安装 `@testing-library/react` + `@testing-library/user-event`
- 为 `ClosedLoopPanel` / `RebalancePanel` / `PositionMonitorPanel` 写单元测试
- 目标：逐步消除 `exclude` 列表

**P0: PerformanceTracker 集成测试（+15 tests）**
- 多交易绩效对比
- 收益率归因（选股 vs 时机 vs 风险控制）
- Benchmark 超额收益计算

**P1: Engine 性能基准测试**
- 测量 ConditionEngine 评估延迟（P50/P95/P99）
- ClosedLoopExecutor 状态转换延迟
- TradeExecutor 订单执行延迟
- 建立基线，防性能回归

---

### L-36（Lobster）— 监控 + 文档 + 清理

**P0: Audit Logger 实现**
- 全链路操作审计：信号触发/订单执行/持仓变更/资金变动
- 格式：`{timestamp, agent, action, details, correlationId}`
- 输出到 `logs/audit/` + Electron IPC 上报
- 测试：+15 tests（正常写/错误恢复/日志轮转）

**P0: E2E 测试框架修复**
- 分析 `jvs-e2e-validation` 跳过原因（ES module 导入链）
- 方案 A：在 Electron main 进程运行完整导入测试
- 方案 B：将集成测试改为纯 HTTP API mock 模式
- 目标：至少 5 个 JVS API 可在 Node.js 环境验证

**P1: Sprint 2 路线图文档**
- Phase 4.3 → Phase 5.0 规划
- Phase 5 主题：Multi-timeframe / Portfolio Analytics / Backtesting
- 基于现有 `sprint2-phase3-plan.md` 和 `phase4.3-closed-loop-architecture.md` 整合

---

## 四、验收标准

```
npm test          → 1400+ tests / 0 failed
tsc --noEmit     → 0 errors
npm run build    → 0 errors
Audit logger     → logs/audit/ 有输出文件
E2E framework    → jvs-e2e-validation 可在 Electron 环境运行
```

---

## 五、风险与依赖

| 风险 | 影响 | 缓解 |
|------|------|------|
| ConditionTradeBridge 改变 TradeExecutor 接口 | 中 | 先写测试再改实现 |
| Audit Logger 影响性能 | 低 | 异步写盘，不阻塞主线程 |
| E2E 测试 ES module 问题复杂 | 高 | 优先方案 B（HTTP mock） |
