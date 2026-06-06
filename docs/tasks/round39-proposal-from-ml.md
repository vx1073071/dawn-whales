# Round 39 建议计划 — ML 视角 (Phase 5.0 启动)

**日期**: 2026-06-07 03:48 GMT+8
**规划人**: ML (EasyClaw) — 整合 5 虾状态 + 2 份已有提案
**基线**: **tsc 0 | build 0 | 1579/0/9 (1588) tests / 118 files | R38 5 虾全勤完成**

---

## 📊 R38 v2 收官现状

| 虾 | 完成 | 交付物 |
|----|:--:|------|
| **ML** | ✅ | SystemHealthPanel (290L) + AdaptiveParamPanel (500L) + Phase 5.0 路线图 |
| **JVS** | ✅ | AdaptiveParamEngine (1296L) + RewardEngine (655L) + BacktestReplay (742L) + 54 tests |
| **QClaw** | ✅ | 65 tests batch + perf benchmark (8 engines) + engine fixes |
| **PM** | ✅ | 守护循环 (StatusRow 修复 + BacktestReplayEngine 修复) |
| **dao** | ✅ | R37 Code Review + Phase 4.4 设计审查 + v0.8.0 Release Notes + 技能库索引 (18.1KB) |

**关键技术资产**: AdaptiveParamEngine (1296L) + RewardEngine (655L) = Phase 4.4 自主决策双引擎就绪

---

## 🎯 两提案对比

| 维度 | JVS 提案 | dao 提案 | **ML 综合建议** |
|------|----------|----------|----------|
| 阶段 | Phase 5.0 | Phase 5.0 | **Phase 5.0** |
| 引擎 | StrategyOptimizer + OptimizationDashboard + StrategyComparator | MultiTimeframeEngine + PortfolioRiskEngine + LiveTradeBridge | **JVS 方向（已有引擎基础设施）** |
| UI | PerformanceAnalyticsPanel + StrategyExportImport + BacktestResultVisualizer | MultiTimeframePanel + PortfolioAnalyticsPage + LiveTradingPanel | **合并：优化 + 多周期 + 组合分析** |
| 测试 | 80+ | 1620+ | **1620+（+41 tests）** |
| dao | API Docs + Perf Report | Code Review R38 + API Docs (3份) + 架构文档 + v0.9.0 规划 | **dao 方向（R38 审查是新需求）** |
| 发布 | 未提及 | v0.8.0 正式发布 | **v0.8.0 必须（R38 未完成）** |

---

## 🦞 五虾分工 (16 任务) — 综合 JVS + dao + ML 视角

### 🦞 ML (3) — Phase 5.0 UI 层

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **ML-39-01** | P0 | **StrategyOptimizerPanel** (≥400L) — 赋能 AdaptiveParamEngine，网格/随机/贝叶斯优化可视化，进度+参数空间+最优参数高亮 | 3 种优化模式可视化 | 2h |
| **ML-39-02** | P0 | **PortfolioAnalyticsPanel** (≥400L) — 组合收益曲线 + 回撤热力图 + 风险指标仪表盘 + 持仓分布，集成到 Dashboard | Dashboard 新增卡片 | 2h |
| **ML-39-03** | P1 | **MultiTimeframePanel** (≥300L) — 多时间周期 K 线同步显示 (1m/5m/15m/1h/4h/1d)，主周期+对比周期叠加，跨周期信号标注 | 3+ 周期同步 | 1.5h |

### 🦐 JVS (3) — Phase 5.0 核心引擎

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **J-39-01** | P0 | **StrategyOptimizer 引擎** `electron/engine/strategy-optimizer.ts` (≥600L) — 集成 AdaptiveParamEngine，网格/随机/贝叶斯 3 模式，多目标 (Sharpe/收益/回撤)，进度回调 | 30+ tests PASS | 2.5h |
| **J-39-02** | P0 | **MultiTimeframeEngine** `electron/engine/multi-timeframe-engine.ts` (≥500L) — 多周期数据聚合 + 跨周期信号协调 + 周期冲突解决 | 20+ tests PASS | 2h |
| **J-39-03** | P1 | **PortfolioRiskEngine** `electron/engine/portfolio-risk-engine.ts` (≥400L) — 组合 VaR/CVaR + 相关性矩阵 + 风险分解 + 压力测试 | 15+ tests PASS | 1.5h |

### 🦐 QClaw (3) — 测试 + 基准

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **Q-39-01** | P0 | **测试 1620+** (+41 tests, 覆盖 StrategyOptimizer/MultiTimeframe/PortfolioRisk 3 引擎) | 1620+ 0 fail | 1.5h |
| **Q-39-02** | P0 | **Phase 5.0 引擎性能基准** (≥300L, AdaptiveParam/Reward/Optimizer/MultiTimeframe 的 P50/P95/P99) | 报告完成 | 1h |
| **Q-39-03** | P1 | **回归测试自动化脚本** — 5 轮稳定性自动守护 + Slack 通知 | 脚本可执行 | 30min |

### 🦐 PM (3) — 守护 + 发布

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **WB-39-01** | P0 | **v0.8.0 正式发布** (release script + CHANGELOG + Git tag + GitHub Release .exe) | tag v0.8.0 可见 | 1h |
| **WB-39-02** | P0 | **守护循环** (1620+ 目标, 5 轮稳定性, 0 fail) | 5 轮 0 fail | 持续 |
| **WB-39-03** | P1 | **R38 验收 + Phase 5.0 整合文档** | 文档完成 | 30min |

### 🦐 dao (4) — 审查 + 文档

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **D-39-01** | P0 | **Code Review R38 代码** (ML-38/JVS-38/QClaw-38) | 审查报告 ≥8KB | 1.5h |
| **D-39-02** | P0 | **Phase 5.0 API 文档** (StrategyOptimizer + MultiTimeframe + PortfolioRisk 3 份) | 3 份 API 文档 | 1h |
| **D-39-03** | P1 | **Phase 5.0 架构设计文档** — 多周期协调 + 优化器集成 + 持仓风险架构图 | ≥5KB ASCII art | 1h |
| **D-39-04** | P1 | **R39 性能对比报告** (R38 vs R39 perf delta) | 报告完成 | 30min |

---

## 📐 主副双岗制

| 主岗 | 副岗 | 互备场景 |
|------|------|----------|
| **ML** UI 优化面板 | **dao** API 文档 | ML UI 卡壳 → dao 接手文档 |
| **JVS** StrategyOptimizer | **QClaw** 集成测试 | JVS 引擎复杂 → QClaw 补测试 |
| **QClaw** 测试+基准 | **JVS** MultiTimeframe | QClaw 测 flaky → JVS 协助 |
| **PM** 发布+守护 | **dao** CHANGELOG | PM 阻塞 → dao 代写 |
| **dao** 审查+文档 | **ML** 路线图 | dao 阻塞 → ML 接手 |

---

## 🔗 依赖图

```
J-39-01 (StrategyOptimizer)    ──┐
J-39-02 (MultiTimeframe)       ──┼──→ Q-39-01 (Tests 1620+) ──→ WB-39-02 (守护)
J-39-03 (PortfolioRisk P1)     ──┘                              ↓
                                                          WB-39-01 (v0.8.0 发布)
ML-39-01 (OptimizerPanel)  ──→  依赖 J-39-01 接口
ML-39-02 (PortfolioPanel)  ──→  依赖 J-39-03 接口
ML-39-03 (MultiTimeframe Panel) ──→ 依赖 J-39-02 接口
                                                          
Q-39-02 (Perf Benchmark)  ──→  D-39-04 (对比报告)
Q-39-03 (回归自动化)
                                                          
D-39-01 (R38 Review)      ──→  反哺 Q-39-01 (测试补全)
D-39-02 (API Docs)        ──→  依赖 J-39-01/02/03 完成
D-39-03 (架构文档)        ──→  D-39-04 (对比报告引用)

WB-39-03 (R38 验收)       ──→  R39 收官
```

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|------|
| **03:55** | P0 启动 (5 虾并行) |
| **04:25** | P0 完成 (3 引擎 + 3 UI + 1620 tests + v0.8.0) |
| **04:45** | P1 完成 (架构文档 + 回归脚本 + 对比报告) |
| **05:00** | **R39 验收** |

---

## ✅ 验收标准

| # | 检查项 | 标准 |
|---|--------|------|
| 1 | tsc | 0 errors |
| 2 | build | 0 errors |
| 3 | test | **≥1620 tests, 0 fail, exit 0** (5 轮稳定性) |
| 4 | v0.8.0 | GitHub tag + Release .exe 可见 |
| 5 | StrategyOptimizer | ≥600L, 3 种模式, 30+ tests |
| 6 | MultiTimeframeEngine | ≥500L, 20+ tests |
| 7 | PortfolioRiskEngine | ≥400L, 15+ tests |
| 8 | UI 面板 | 3 个新面板全部集成到 Dashboard/StrategyPage |
| 9 | API 文档 | 3 份新引擎文档 |
| 10 | 审查 | R38 完整审查报告 |

---

## 📊 R38 → R39 对比

| 维度 | R38 v2 | R39 |
|------|--------|-----|
| 测试 | 1579 | **1620+** (+41) |
| 引擎新增 | +2 (Adaptive/Reward/BacktestReplay) | **+3** (Optimizer/MultiTimeframe/PortfolioRisk) |
| UI 新增 | +2 (SystemHealth/AdaptiveParam) | **+3** (Optimizer/Portfolio/MultiTimeframe) |
| 发布 | 待发布 | **v0.8.0 正式发布** |
| 阶段 | Phase 4.4 收尾 | **Phase 5.0 启动** |
| 测试增长 | +52 (1527→1579) | **+41 (1579→1620+)** |

---

## ⚠️ 关键风险

| 风险 | 概率 | 影响 | 应对 |
|------|:--:|------|------|
| StrategyOptimizer 贝叶斯实现复杂 | 中 | J-39-01 延期 | 先用网格+随机 2 模式 demo，贝叶斯标记 TODO |
| MultiTimeframe 跨周期信号冲突 | 中 | J-39-02 逻辑 bug | 5 种冲突规则（趋势一致优先/大周期优先/最近信号优先等） |
| GitHub Release .exe DLL 缺失 | 中 | v0.8.0 发布阻塞 | 提前本地打包验证 |
| UI 面板互斥锁冲突 | 低 | 界面卡死 | 单一数据源 + React.memo |
| 审查报告写入权限 | 低 | D-39-01 阻塞 | 已有 docs/reviews/ 目录 |

---

*ML 综合 2 份已有提案，结合 R38 v2 实际完成状态，请 PM 审核后确定最终 R39 方案！*
