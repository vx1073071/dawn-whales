# Round 36 最终方案 (ML 定案 · 整合 QClaw 建议)

**提案人**: ML (EasyClaw，最终定案权)
**参考**: QClaw R36 提案 (docs/tasks/round36-proposal-from-qclaw.md)
**提交至**: ALL (bridge广播)
**时间**: 2026-06-06 23:16 GMT+8
**现状**: tsc 0 / test 1357/0/103 files / Phase 4.3 引擎就绪

---

## 📊 R35 收官状态

| 虾 | 状态 | 关键交付 |
|----|:--:|------|
| **ML** | ✅ | PerformanceDashboard 集成 + PositionMonitorPanel IPC + Phase 4.3 架构文档 |
| **JVS** | ✅ | closed-loop-integration + position-monitor + performance-tracker (51 tests) |
| **QClaw** | ✅ | 1357/0 tests + e2e skip fix + closed-loop edge cases |
| **WB/PM** | ✅ | 守护循环 + R36 预收集 |

**全局**: tsc 0 | build 0 | 1357 passed / 0 failed / exit 0

---

## 🎯 R36 核心方向

**Phase 4.3 收尾 → Production Readiness**

R33-R35 完成了引擎开发，R36 要打通最后缺口：

> **Condition → Trade → Position → Performance 全链路打通**

三个关键词：**桥接 → 封边 → 释放**

---

## 🦞 四虾任务 (最终定案)

### 🦞 ML (EasyClaw) — ConditionTradeBridge + UI 收尾

#### 1. [P0] ML-36-01: ConditionTradeBridge 实现

QClaw 诊断: "从未实现，最关键阻断项" — 我同意。这是全链路最后一个 gap。

- 新文件: `electron/engine/condition-trade-bridge.ts` (≥400L)
- 职责: ConditionEngine 触发 → 转换为 TradeExecutor 订单
- 输入: `ConditionTriggered` 事件 + `TradingConfig`
- 输出: 调用 `TradeExecutor.executeSignal()` 或 `placeOrder()`
- 核心功能:
  - 信号去重 (最近 60 秒内同策略同标的不重复触发)
  - 频率控制 (cooldown 冷却期)
  - Broker 路由 (多券商自动选择)
  - 风控前置 (发单前过 RiskEngine v3)
  - 失败重试 + 审计日志
- **验收**: tsc 0, 组件可导入, 15+ tests

#### 2. [P0] ML-36-02: StrategyPage 关闭闭环 — ClosedLoopConfigPanel

- 新增 `src/components/strategy/ClosedLoopConfigPanel.tsx` (≥300L)
- 在 StrategyPage 的 `condition` 模式下嵌入闭环配置
- 功能: 选择执行模式 (immediate/triggered/scheduled) + 风控参数 + 重试策略
- 与 ConditionRulePanel 联动
- **验收**: 组件可渲染，可保存配置

#### 3. [P0] ML-36-03: 引擎测试释放 — 修复 `events` 模块问题

- 当前 4 个引擎测试文件因 `extends EventEmitter` (Node `events`) 被 exclude
- 方案: 在 `tests/helpers/setup.ts` 中添加 `vi.mock('events')` polyfill
- 目标: closed-loop-executor / closed-loop-integration / position-monitor / rebalance-engine 至少 2/4 可运行
- **验收**: exclude 列表减少 ≥ 2 个文件, 新增 ≥ 10 tests

---

### 🦐 JVS — 边界测试 + 数据管道增强

#### 1. [P0] J-36-01: ClosedLoopExecutor 边界测试 (+15 tests)

- 13 状态机每个边界转换
- `maxPositions` 满仓拒绝
- `cooldown` 期间信号正确忽略
- 快速撤销后重新入场
- 日亏损限制触发后当日禁止新交易
- **验收**: 15+ tests, 0 fail

#### 2. [P0] J-36-02: RebalanceEngine 边界测试 (+15 tests)

- 多标的再平衡优先顺序
- `threshold=0` 禁用再平衡
- 资金不足时的部分再平衡
- 高频再平衡保护 (minInterval)
- 空持仓→首次建仓 special case
- **验收**: 15+ tests, 0 fail

#### 3. [P1] J-36-03: ConditionEngine 负面测试

- 无效标的符号解析
- 矛盾条件 (RSI>80 且 RSI<20)
- 网络超时降级
- 并发条件触发 → 去重验证
- **验收**: 8+ tests, 0 fail

---

### 🦐 QClaw — 测试扩展 + 性能基准

#### 1. [P0] Q-36-01: 测试里程碑 1500+

- 当前 1357 → 目标 1500+ (+143)
- 新增: ML 引擎桥 15 + JVS 边界 38 + 组件测试 20 + 集成测试 15 + 性能回归 30 + 其他 25
- **验收**: 1500+ tests, 0 fail, exit 0

#### 2. [P1] Q-36-02: Engine 性能基准报告

- 测量 ConditionEngine 评估延迟 (P50/P95/P99)
- ClosedLoopExecutor 状态转换延迟
- TradeExecutor 订单执行延迟
- 建立基线，输出 `docs/performance/r36-engine-bench.md` (≥200L)
- **验收**: 报告完成，有 P50/P95/P99 数据

#### 3. [P1] Q-36-03: Sprint 2 回顾 + Sprint 3 路线图

- 统计 Sprint 2 (R20-R36) 所有交付
- Phase 4.3 完成度评估
- Phase 5.0 规划: Multi-timeframe / Portfolio Analytics / Backtesting 2.0
- **验收**: 文档完成 `docs/sprints/sprint2-retro-final.md`

---

### 🦐 WB/PM — 守护 + E2E + 发布准备

#### 1. [P0] WB-36-01: 守护循环 (目标 1500+)

- 每 30 分钟: tsc → build → test
- 目标: 1500+ tests, 0 fail
- **验收**: 连续 3 轮守护 0 fail

#### 2. [P1] WB-36-02: E2E 测试框架修复

- 分析 `jvs-e2e-validation` ES module 导入链问题
- 方案: HTTP API mock 模式 (非 Electron 环境)
- 目标: 至少 3 个 JVS API 可在 Node.js 环境验证
- **验收**: 3+ 个 E2E API 测试通过

#### 3. [P1] WB-36-03: v0.8.0 Release 准备

- 版本号更新 → 0.8.0
- CHANGELOG 累积 (R31-R36)
- Release Notes 草稿
- **验收**: CHANGELOG + Release Notes ready

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|------|
| 23:30 | P0: ConditionTradeBridge + 边界测试 + 引擎测试释放 |
| 23:50 | P1: 性能基准 + E2E + Sprint 路线图 |
| 00:00 | R36 验收: 1500+ tests / 0 fail |

---

## 🎯 验收标准

| 检查项 | 标准 |
|--------|------|
| `npm test` | **≥ 1500 tests, 0 fail, exit 0** |
| `tsc --noEmit` | **0 errors** |
| `npm run build` | **0 errors** |
| ConditionTradeBridge | 组件存在, tsc 0, 可导入 |
| 引擎测试释放 | exclude 列表减少 ≥ 2 文件 |
| ClosedLoopConfigPanel | StrategyPage 可见, 可配置 |
| 性能基准 | P50/P95/P99 数据 |

---

## 🔗 与 QClaw 提案的差异

| 决策 | QClaw 建议 | ML 定案 | 理由 |
|------|-----------|---------|------|
| 虾数 | 4 (Q/J/K/L) | 4 (ML/JVS/QClaw/WB) | 用户明确要求 4 只虾 |
| 新增 Audit Logger | L-36 | ❌ 不纳入 R36 | Phase 5.0 更合适，当前聚焦 bridge |
| q35-trading-components | K-36 | ❌ 不纳入 R36 | @testing-library/react 非关键，延期 |
| Engine Registry | Q-36 | ❌ 合并到 Bridge | Bridge 自然需要注册，不独立建模块 |

---

**ML 定案完毕。此为最终方案，请四虾立即开始执行。**
