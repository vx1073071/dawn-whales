# R28 Sprint Plan — QClaw Proposal
**Proposer:** QClaw
**Date:** 2026-06-06
**Based on:** Sprint 1–2 completed, 259 tests green, feature/strategy-optimize clean

---

## 背景

Sprint 1–2 完成情况：
- Sprint 1：726/726 ✅，feature/strategy-optimize 分支干净
- R27：259/259 测试 ✅，多券商架构 + NL Parser + Strategy Engine 已有基础

**当前架构现状：**
- `electron/engine/` 含 10 个核心模块（backtest-engine / backtest-enhancer / walk-forward / parameter-scanner / nl-parser / strategy-engine / trade-executor / risk-engine 等）
- 多券商：IBrokerAdapter + FutuAdapter + MoomooAdapter + BrokerManager ✅
- NL Parser：规则引擎 + LLM fallback ✅，但没有完整测试
- Walk-Forward：WFA 实现存在，无测试
- Parameter Scanner：参数网格搜索存在，无测试
- Backtest Enhancer：回测增强存在，无测试

---

## R28 目标

**主题：回测基础设施 + NL Parser 深度集成**

核心方向：把策略从"能写"变成"能验证"，让 walk-forward analysis + 参数扫描成为策略上生产前的标准步骤。

---

## 任务分配建议

### JVS — J-28-01 / J-28-02 / J-28-03

**主题：Walk-Forward Analysis Engine 完整实现**

当前 `walk-forward.ts` 有 WFA 结构，但缺少：
1. **J-28-01**: 完善 WFA `run()` 实现——滚动窗口生成、IS/OOS 分割、参数传递、衰减比计算
2. **J-28-02**: Walk-Forward HTML 可视化报告——多窗口 sharpe 对比图、参数热力图（ECharts）、IS vs OOS 衰减分析
3. **J-28-03**: Walk-Forward 与 BacktestEngine 集成——真实 K 线数据喂入、结果持久化到 SQLite

**验收标准：**
- `runWFA()` 输出完整 WindowResult[]，decayRatio 计算正确
- HTML 报告在 StrategyPage 可查看
- 端到端测试覆盖 walk-forward.ts

---

### ML — ML-28-01 / ML-28-02 / ML-28-03

**主题：Parameter Scanner + 策略优化工作流**

`parameter-scanner.ts` 已定义接口，需完善：
1. **ML-28-01**: 完整实现 `runScan()` —— 网格生成 + 并行回测调用 + 结果排序
2. **ML-28-02**: Parameter Scan UI 面板 —— ParamRange 输入表单 + Top-10 结果表格 + 热力图（ECharts）
3. **ML-28-03**: "策略优化向导" —— NL Parser → Backtest → Parameter Scan → Walk-Forward → 一键生成最优参数，流水线 UI

**验收标准：**
- 参数扫描 100 组参数 < 5 秒（用 Mock 数据）
- UI 面板可在 StrategyPage 触发
- 与 Walk-Forward 结果联动

---

### QClaw — Q-28-01 / Q-28-02 / Q-28-03

**主题：NL Parser 深度测试 + Risk Engine v3 规划**

1. **Q-28-01**: NL Parser 端到端测试扩展（从 42 扩展到 80+ tests）—— LLM fallback 路径、combined 策略类型、完整 parseNaturalLanguage 输出验证
2. **Q-28-02**: Risk Engine v3 规划文档 —— 基于 R26 场景验证结果，设计 v3 接口（考虑 multi-broker 账户聚合风险、组合 Greeks、VaR 计算）
3. **Q-28-03**: Backtest Enhancer 测试（20+ tests）—— `addMetrics()` / `compareStrategies()` / `exportReport()` 覆盖

**验收标准：**
- NL Parser 80+ tests，all passing
- Risk Engine v3 规划文档 5000+ 字，涵盖接口设计、API 变更说明
- Backtest Enhancer 20+ tests，all passing

---

### WorkBuddy — W-28-01 / W-28-02 / W-28-03

**主题：Trade Executor v2 + 策略执行仪表盘**

1. **W-28-01**: Trade Executor v2——基于 R27 IB Adapter，完成订单簿模拟、订单状态机（pending/filled/cancelled/rejected）、部分成交模拟
2. **W-28-02**: Strategy Execution Dashboard——展示当前运行中策略、实时持仓、PnL 曲线、信号历史
3. **W-28-03**: 策略执行日志 + 告警面板——TradeExecutor 的每笔成交记录日志、RiskEngine 告警历史、按券商分组查看

**验收标准：**
- TradeExecutor v2 支持市价单/限价单/止损单三种订单类型
- Dashboard 可实时刷新（每 5 秒）
- 日志可导出 CSV

---

## 任务优先级矩阵

| Task | Impact | Effort | Priority |
|------|--------|--------|----------|
| J-28-01 Walk-Forward run() | 高（核心功能） | 中 | P0 |
| ML-28-01 Parameter Scan run() | 高（核心功能） | 中 | P0 |
| Q-28-01 NL Parser 测试扩展 | 高（质量保障） | 低 | P0 |
| W-28-01 TradeExecutor v2 | 高（执行完整性） | 高 | P0 |
| J-28-02 WFA 可视化 | 中（用户体验） | 中 | P1 |
| ML-28-02 ParamScan UI | 中（用户体验） | 中 | P1 |
| Q-28-02 RiskEngine v3 规划 | 中（长期价值） | 低 | P1 |
| W-28-02 Execution Dashboard | 中（用户体验） | 中 | P1 |
| J-28-03 WFA 集成测试 | 中（质量保障） | 低 | P2 |
| ML-28-03 策略优化向导 | 低（长期价值） | 高 | P2 |
| Q-28-03 Backtest Enhancer 测试 | 中（质量保障） | 低 | P2 |
| W-28-03 执行日志面板 | 低（运营价值） | 低 | P2 |

---

## 技术约束

1. 所有新页面/组件必须使用 React + TypeScript
2. 新增测试必须与现有测试套件集成（`npm test` 全量通过）
3. 多券商订单路由：Futu/Moomoo/IB 的 placeOrder 必须通过 BrokerManager 统一入口
4. Walk-Forward 和 Parameter Scan 使用相同 BacktestEngine 实例，避免重复初始化

---

## 成功标准

- Sprint 结束后：`npm test` 稳定 300+ tests，全部通过
- Walk-Forward + Parameter Scan 可以在 StrategyPage 中串联使用
- TradeExecutor v2 支持至少 3 种订单类型
- Risk Engine v3 规划文档被 PM 接受，作为 R29 实施蓝图
