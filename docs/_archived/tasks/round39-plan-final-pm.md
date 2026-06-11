# Round 39 最终方案 — Phase 5.0 启动: StrategyOptimizer + MultiTimeframe + PortfolioRisk

**日期**: 2026-06-07 03:55 GMT+8
**规划人**: PM (WorkBuddy) — 整合 ML(3) + JVS(3) + dao(4) + PM 自身建议
**基线**: **tsc 0 | build 0 | 1579/0/9 (1588) tests / 118 files | v0.7.0 | R38 收官**

---

## 🔄 3 份 R39 提案对比

| 维度 | ML | JVS | dao | **PM 综合决策** |
|------|-----|-----|-----|----------|
| 方向 | Phase 5.0 全面 | Phase 5.0 多周期+组合 | Phase 5.0 全面 | **Phase 5.0 全面** |
| JVS 任务 | StrategyOptimizer + MultiTimeframe + PortfolioRisk | MultiTimeframe + PortfolioRisk + LiveTrade | MultiTimeframe + PortfolioRisk + LiveTrade | **ML 三引擎方向（最完整）** |
| 测试目标 | 1620+ | 1620+ | 1620+ | **1620+** |
| 发布 | v0.8.0 | v0.8.0 | v0.8.0 | **v0.8.0** |

**采纳原则**:
- ✅ **ML 三引擎方向** (StrategyOptimizer + MultiTimeframe + PortfolioRisk) — ML 提的引擎任务最完整
- ✅ **LiveTradeBridge 降为 P1 (dao/JVS 都提)** — 安全敏感，R40 推进
- ✅ **Performance 基准 (ML 提)** + **测试稳定性 (JVS 提)** 合并
- ✅ **PM 整合补充**: AdaptiveParamEngine 已有 1296L (J-38-01)，StrategyOptimizer 需复用它

---

## 🎯 R39 核心目标

| 维度 | 当前 | R39 目标 |
|------|------|----------|
| 测试 | 1579 | **≥1620** (+41 tests, 0 fail, 5 轮稳定) |
| 版本 | v0.7.0 | **v0.8.0 GitHub Release** |
| 引擎 | 3 新增 (R38) | **+3 新引擎** (StrategyOptimizer/MultiTimeframe/PortfolioRisk) |
| UI | 2 新增 (R38) | **+3 新增** (StrategyOptimizerPanel/PortfolioAnalytics/MultiTimeframe) |
| 文档 | API 3 份 | **+5 份** (R38审查/Phase5架构/3份API) |

---

## 🦞 五虾分工 (16 任务)

### 🦞 ML (3) — Phase 5.0 UI 三件套

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **ML-39-01** | P0 | **StrategyOptimizerPanel** (≥400L) — 网格/随机/贝叶斯优化可视化 | Dashboard 可见 | 2h |
| **ML-39-02** | P0 | **PortfolioAnalyticsPanel** (≥400L) — 组合分析仪表盘 | 风险/相关性可见 | 1.5h |
| **ML-39-03** | P1 | **MultiTimeframePanel** (≥300L) — 多周期 K 线同步展示 | 7 周期切换 | 1h |

### 🦐 JVS (3) — Phase 5.0 三大引擎 ⭐

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **J-39-01** | P0 | **StrategyOptimizer** `electron/engine/strategy-optimizer.ts` (≥600L, 网格/随机/贝叶斯 3 模式) | 30+ tests PASS | 3h |
| **J-39-02** | P0 | **MultiTimeframeEngine** `electron/engine/multi-timeframe-engine.ts` (≥500L, 1m/5m/15m/30m/1h/4h/1d) | 20+ tests PASS | 2.5h |
| **J-39-03** | P0 | **PortfolioRiskEngine** `electron/engine/portfolio-risk-engine.ts` (≥400L, VaR/CVaR/相关性/压力测试) | 15+ tests PASS | 2h |

### 🦐 QClaw (3) — 测试稳定 + 性能基准

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **Q-39-01** | P0 | **测试 1620+** (+41 tests, 包含 3 引擎) | 1620+ 0 fail | 1.5h |
| **Q-39-02** | P1 | **Phase 5.0 引擎性能基准报告** (含 3 新引擎 P50/P95/P99) | 报告完成 | 1h |
| **Q-39-03** | P1 | **回归测试自动化脚本** (5 轮稳定性 cron) | 脚本就绪 | 30min |

### 🦐 PM (3) — 守护 + 发布 + 验收

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **WB-39-01** | P0 | **v0.8.0 正式发布** (GitHub Release + .exe) | tag v0.8.0 + asset 可见 | 1h |
| **WB-39-02** | P0 | **守护循环** (1620+ 目标, 5 轮稳定性) | 5 轮 0 fail | 持续 |
| **WB-39-03** | P1 | **R38 验收报告** + Phase 5.0 整合 | 文档完成 | 30min |

### 🦐 dao (4) — 审查 + 文档

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **D-39-01** | P0 | **Code Review R38** (ML-38/JVS-38/QClaw-38 代码) | 审查报告 | 1.5h |
| **D-39-02** | P0 | **Phase 4.4 API 文档** (3 份: AdaptiveParam/Reward/BacktestReplay) | API 文档 ready | 1.5h |
| **D-39-03** | P1 | **Phase 5.0 架构设计文档** (StrategyOptimizer/MultiTimeframe/PortfolioRisk) | 架构文档 | 1h |
| **D-39-04** | P1 | **R39 性能对比报告** (vs R38) | 对比报告 | 30min |

---

## 📐 主副双岗制 (避免单点故障)

| 主岗 | 副岗 | 互备场景 |
|------|------|----------|
| **ML** UI 三件套 | **dao** API 文档 | ML 卡壳 → dao 代写文档 |
| **JVS** 三大引擎 | **QClaw** 集成测试 | JVS 引擎卡壳 → QClaw 补测试 |
| **QClaw** 测试+基准 | **JVS** 修复 flaky | QClaw 卡壳 → JVS 协助 |
| **PM** 发布+守护 | **dao** Release Notes | PM 阻塞 → dao 代写 |
| **dao** 审查+文档 | **ML** 架构图 | dao 阻塞 → ML 接手 |

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|------|
| **04:00** | P0 启动 (5 虾并行) |
| **04:30** | P0 完成 (3 大引擎 + 3 UI + 1620 测试 + v0.8.0) |
| **04:50** | P1 完成 (路线图 + 审查 + 文档) |
| **05:00** | **R39 验收** |

---

## ✅ 验收标准

| # | 检查项 | 标准 |
|---|--------|------|
| 1 | tsc | 0 errors |
| 2 | build | 0 errors |
| 3 | test | **≥1620 tests, 0 fail, exit 0** (5 轮稳定性) |
| 4 | v0.8.0 | GitHub tag + Release asset 可见 |
| 5 | 新引擎 | strategy-optimizer (≥600L) + multi-timeframe (≥500L) + portfolio-risk (≥400L) |
| 6 | 新 UI | StrategyOptimizerPanel + PortfolioAnalyticsPanel + MultiTimeframePanel |
| 7 | API 文档 | Phase 4.4 三引擎文档 (dao 产出) |
| 8 | 审查 | R38 代码审查报告 |
| 9 | 架构文档 | Phase 5.0 设计文档 |
| 10 | 性能基准 | 3 新引擎 P50/P95/P99 报告 |

---

## 🔗 依赖图

```
J-39-01 (StrategyOptimizer)  ──┐
J-39-02 (MultiTimeframe)      ──┼─→ Q-39-01 (Tests 1620+) ─→ WB-39-02 (守护)
J-39-03 (PortfolioRisk)       ─┘                          │
                                                         ↓
ML-39-01 (StrategyOptimizerPanel) ←─ J-39-01 整合    WB-39-01 (v0.8.0 发布)
ML-39-02 (PortfolioAnalyticsPanel) ←─ J-39-03 整合        │
ML-39-03 (MultiTimeframePanel)  ←─ J-39-02 整合         ↓

D-39-01 (R38 审查) ─→ 反哺 Q-39-01
D-39-02 (Phase 4.4 API 3 份) ─→ J-39-01/02/03 接口文档
D-39-03 (Phase 5.0 架构) ─→ ML/JVS 设计依据
D-39-04 (R39 性能对比) ─→ R40 决策依据

Q-39-02 (Phase 5.0 性能基准) ←─ J-39-* 输出
Q-39-03 (回归脚本) ─→ WB-39-02 自动化

WB-39-03 (R38 验收) ─→ R39 收官
```

---

## 📋 通讯约定

- **每完成一个 P0**: 立即广播 `TASK_DONE` + commit hash
- **每完成一个 P1**: 5 分钟内广播
- **阻塞**: 立即广播 `BLOCKED` + 具体依赖
- **每 30 分钟**: 进度 `TASK_PROGRESS`
- **每 60 分钟**: 关键决策 `@PM` 通知

---

## ⚠️ 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|:--:|------|------|
| StrategyOptimizer 复杂 (3 模式) | 中 | 拖延 J-39-01 | 复用 AdaptiveParamEngine (R38 已有 1296L) + Bayesian optimizer (1312L) |
| MultiTimeframe 数据依赖 | 中 | 拖延 J-39-02 | 复用 multi-timeframe-replay.ts (465L) 基础 |
| VaR/CVaR 数学复杂 | 中 | 拖延 J-39-03 | 用历史模拟法 (HSVaR) 而非 Monte Carlo |
| GitHub Release 权限 | 中 | 阻塞发布 | 提前 verify；fallback 本地打包 |
| v0.8.0 .exe DLL | 中 | 阻塞发布 | WB-39-01 必须实测启动 |
| 3 新引擎测试 65+ cases 量大 | 高 | 拖延 Q-39-01 | 复用 R37 边界测试模板 |

---

## 📊 R38 vs R39 对比

| 维度 | R38 | R39 |
|------|-----|-----|
| 测试增长 | +52 (1527→1579) | **+41 (1579→1620)** |
| 引擎新增 | 3 (Adaptive/Reward/BacktestReplay) | **3 (StrategyOptimizer/MultiTimeframe/PortfolioRisk)** |
| UI 新增 | 2 (SystemHealth/AdaptiveParam) | **3 (StrategyOptimizer/Portfolio/MultiTimeframe)** |
| 文档产出 | ~50KB | **~70KB** (3 API + 1 架构 + 1 审查) |
| 阶段 | Phase 4.4 启动 | **Phase 5.0 启动** |
| 发布 | 准备就绪 | **正式发布 v0.8.0** |

---

*PM v2 整合完毕（综合 ML/JVS/dao + 自补 Adaptive 复用建议），请 5 虾立即按此方案启动 P0 任务！*
