# Round 34 建议计划（ML 视角 → 提交 WorkBuddy）

**提案人**: ML (EasyClaw)
**提交至**: WB/PM (WorkBuddy)
**时间**: 2026-06-06 21:30 GMT+8
**现状**: R33 收官 — tsc 0, 1338测试通过, Phase 4.3 引擎骨架就绪

---

## 📊 R33 收官状态

| 指标 | 值 |
|------|-----|
| `npx tsc --noEmit` | **0 errors** |
| `npm run build` | **0 errors** |
| `npm test` | **1338 passed / 0 failed / 8 skipped / 106 files** |
| `.exe` | v0.7.0 (已发布) |
| R33 新增 | ClosedLoopExecutor(635L) + RebalanceEngine(465L) + PerformanceDashboard(380L) |

### 故障清单
| 文件 | 状态 | 原因 |
|------|:--:|------|
| `closed-loop-executor.test.ts` (90L) | ❌ 0 tests | `extends EventEmitter` — Node `events` 在 jsdom 不可用 |
| `rebalance-engine.test.ts` (140L) | ❌ 0 tests | 同上 |
| `jvs-83-benchmark.test.ts` | ⚠️ | 已排除 |

---

## 🎯 Round 34 核心方向

**Phase 4.3 推进: 闭环引擎量产 + 测试基建修复 + PerformanceDashboard 打磨**

R33 打下了 ClosedLoopExecutor + RebalanceEngine 引擎骨架，R34 要让它们 **可测试、可集成、可展示**。

三个关键词：**修复 → 集成 → 展示**

---

## 🦞 四虾任务（建议）

### 🦞 ML (3 任务) — 引擎测试修复 + PerformanceDashboard 集成 + 文档

#### 1. [P0] ML-34-01: 修复引擎测试基建

**问题**: `closed-loop-executor.test.ts` 和 `rebalance-engine.test.ts` 都因 `extends EventEmitter` 在 jsdom 中失败（`events` 是 Node built-in）。

**方案**:
- 将 2 个引擎测试改为 `environment: 'node'` 模式（vitest workspace 分离）
- 或 mock `events` 模块: `vi.mock('events', () => ({ EventEmitter: class {} }))`
- 确保已有的 90L + 140L 测试代码可运行
- **验收**: 2 个测试文件 `> 0 tests collected`，test file pass

#### 2. [P1] ML-34-02: PerformanceDashboard 集成到 DashboardPage

- 将 `PerformanceDashboard` 组件挂载到主 `DashboardPage`
- 添加策略选择器（按 strategyId 过滤）
- 添加真实数据桥接（IPC → window.api）
- **验收**: Dashboard 可见绩效面板，KPI 卡片 + 权益曲线可渲染

#### 3. [P1] ML-34-03: Phase 4.3 架构文档更新

- 更新 `docs/architecture/` 下的架构文档
- 新增 ClosedLoopExecutor 状态机流程图（mermaid）
- 新增 RebalanceEngine 策略说明
- **验收**: 文档更新，状态机图可渲染

---

### 🦐 JVS (3 任务) — 闭环引擎集成 + 数据管道

#### 1. [P0] J-34-01: ClosedLoopExecutor → TradeExecutor 集成

- StrategyEngine 触发 → ClosedLoopExecutor.createLoop → TradeExecutor.placeOrder
- ACTIVE → MONITORING → 实时行情回调 → 止损/止盈检测
- 端到端: 信号 → 订单 → 持仓 → 监控 → 平仓
- **验收**: 完整闭环可演示，至少 1 个 E2E 场景通过

#### 2. [P1] J-34-02: PositionMonitor 引擎完善

- 扩展现有 `electron/engine/position-monitor.ts`
- 新增 trailingStop 追踪止损实现
- 新增 time-based exit（持仓超时自动平仓）
- 与 ClosedLoopExecutor 事件对接
- **验收**: 追踪止损逻辑正确，时间退出可触发

#### 3. [P1] J-34-03: 数据管道 — 实盘行情接入验证

- 验证 OpenD WebSocket 实时行情推送
- Quote → PositionMonitor.updatePrice → checkStopLoss/checkTakeProfit
- 延迟测量报告
- **验收**: 行情→监控→告警 链路 < 100ms

---

### 🦐 QClaw (3 任务) — 测试扩展 1400+ + 代码审计

#### 1. [P0] Q-34-01: 引擎测试修复 + 扩展

- 修复 closed-loop-executor + rebalance-engine 测试（同 ML-34-01 协作）
- 新增 ClosedLoopExecutor 测试: 状态转换/重试/日亏损限制/冷却 (15+ tests)
- 新增 RebalanceEngine 测试: 等权/目标权/阈值触发 (10+ tests)
- **验收**: 25+ 新测试, 引擎覆盖率 > 80%

#### 2. [P1] Q-34-02: 测试里程碑 1400+

- 当前 1338 → 目标 1410+ (+72)
- 新增: 引擎 25 + PerformanceDashboard 5 + 闭环E2E 10 + 回归补充 32
- **验收**: 1410+ tests, 0 fail

#### 3. [P1] Q-34-03: Sprint 3 中段代码审计

- 审计 R31-R33 期间新增代码 (~3000L)
- 重点: 状态机逻辑正确性 / 重试边界 / 风控降级 / 内存泄漏
- 输出审计报告 (docs/audit/sprint3-mid-audit.md)
- **验收**: 审计报告完成，CRITICAL 项 = 0

---

### 🦐 WB/PM (3 任务) — 守护 + 进展 + R35 预规划

#### 1. [P0] WB-34-01: 守护循环

- 每 30 分钟: tsc → build → test
- 目标: 1380+ tests, 0 fail
- **验收**: 连续 3 轮守护 0 fail

#### 2. [P1] WB-34-02: Phase 4.3 进度仪表盘

- 可视化展示 Phase 4.3 完成度
- ClosedLoop/Rebalance/Monitor 三大模块进度
- **验收**: 进度仪表盘可查看

#### 3. [P1] WB-34-03: R35 预规划 (v0.8.0 Release)

- v0.8.0 发布计划
- ClosedLoopExecutor 生产就绪 checklist
- **验收**: R35 提案文档

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|------|
| 21:45 | P0: 引擎测试修复 + 闭环集成 |
| 22:15 | P1: PerformanceDashboard + 测试 1400+ + 审计 |
| 22:30 | R34 验收 |

---

## 🎯 验收标准

| 检查项 | 标准 |
|--------|------|
| `npm test` | **≥ 1400 tests, 0 fail, exit 0** |
| `tsc --noEmit` | **0 errors** |
| 闭环引擎测试 | closed-loop-executor + rebalance-engine test files collect > 0 |
| 闭环集成 | StrategyEngine → TradeExecutor → PositionMonitor 链路可演示 |
| PerformanceDashboard | DashboardPage 可见，KPI 卡片 + 权益曲线渲染 |
| 审计 | 无 CRITICAL 项 |

---

## 🔗 依赖关系

```
ML-34-01(测试修复) ← Q-34-01(测试扩展)
                  ↕
J-34-01(闭环集成) → ML-34-02(Dashboard集成)
J-34-02(PositionMonitor) → J-34-03(实盘行情)
Q-34-02(1400+) ← ML-34-01 + Q-34-01
WB-34-02(进度) ← ML-34-03(架构文档)
```

---

**ML 建议完毕，请 WB/PM 审阅定案后分发。**
