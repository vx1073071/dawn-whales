# Round 38 最终方案 v2 — Phase 4.4 自主决策引擎 + v0.8.0 发布

**日期**: 2026-06-07 02:59 GMT+8
**规划人**: PM (WorkBuddy) — 整合 ML(3) + JVS(3) + QClaw(3) + dao(4) + PM 自身建议
**基线**: **tsc 0 | build 0 | 1527/0/9 (1536) tests / 115 files | v0.7.0 | 5 虾全勤**

---

## 🔄 4 份提案对比

| 维度 | ML | JVS | QClaw | dao | **PM 综合决策** |
|------|-----|-----|-------|-----|----------|
| 方向 | Phase 5.0 + Dashboard 2.0 | **Phase 4.4 自主决策** | Phase 4.4 收尾 | Phase 4.4 自主决策 | **Phase 4.4 自主决策 + v0.8.0** |
| 核心引擎 | Dashboard | 自适应参数+RL | 性能基准 | 设计审查 | **JVS 方向（PM 采纳）** |
| 测试目标 | 1550+ | 1550+ | 1550+ | 1550+ | **1550+** |
| 发布 | v0.8.0 | v0.8.0 | v0.8.0 | v0.8.0 | **v0.8.0** |

**采纳原则**:
- ✅ **JVS 方向为 R38 核心**（自主决策引擎，差异化价值高）
- ✅ **K线回放降为 P1**（JVS 已提；backtest-replay.ts 已存在 299L）
- ✅ **ML 自主学习UI 保留**（与 JVS 自适应参数形成闭环）
- ✅ **QClaw 性能基准升级为 P0**（支撑自适应决策）
- ✅ **dao 4 任务全保留**（审查+文档是 PM 互补）
- ✅ **v0.8.0 发布保留**（Sprint 3 收官必备）

---

## 🎯 R38 核心目标

| 维度 | 当前 | R38 目标 |
|------|------|----------|
| 测试 | 1527 | **≥1550** (+23 tests, 0 fail, 5 轮稳定) |
| 版本 | v0.7.0 | **v0.8.0 GitHub Release** |
| 引擎 | 6 套件恢复 | **+3 新引擎** (Adaptive/Reward/Dashboard) |
| Dashboard | 静态卡片 | **SystemHealthPanel 实时** |
| 文档 | API 3 份 | **+4 文档** (R37审查/Phase4.4设计/RL/CHANGELOG) |
| K线 | backtest-replay 299L | **+自适应参数+Reward 引擎** |

---

## 🦞 五虾分工 (16 任务)

### 🦞 ML (3) — 自主决策 UI + v0.8.0

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **ML-38-01** | P0 | **SystemHealthPanel 集成** — 替换 Dashboard 静态卡片，实时显示引擎状态 | Dashboard 实时心跳 | 1.5h |
| **ML-38-02** | P0 | **StrategyPage 自学习 UI** (≥400L) — 策略参数自适应调整面板 | UI 集成可调 | 2h |
| **ML-38-03** | P1 | **Phase 5.0 路线图** — `docs/roadmap/phase5.0-plan.md` | 文档完成 | 30min |

### 🦐 JVS (3) — Phase 4.4 自主决策核心引擎 ⭐

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **J-38-01** | P0 | **自适应参数调整引擎** `electron/engine/adaptive-param-engine.ts` (≥500L) | 15+ tests PASS | 2.5h |
| **J-38-02** | P0 | **强化学习 Reward 引擎** `electron/engine/reward-engine.ts` (≥400L, PnL+Sharpe based) | 10+ tests PASS | 2h |
| **J-38-03** | P1 | **K线回放引擎完善** (基于 backtest-replay.ts 加 倍速/断点续播) (≥300L) | 8+ tests PASS | 1.5h |

### 🦐 QClaw (3) — 性能基准 + 自主决策测试

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **Q-38-01** | P0 | **测试 1550+** (+23 tests, 包含 Adaptive/Reward 引擎测试) | 1550+ 0 fail | 1.5h |
| **Q-38-02** | P0 | **引擎性能基准报告** (≥300L, Condition/ClosedLoop/Rebalance/Adaptive P50/P95/P99) | 报告完成 | 1.5h |
| **Q-38-03** | P1 | **Sprint 2 回顾 + Sprint 3 路线图** (≥100L) | 文档完成 | 30min |

### 🦐 PM (3) — 守护 + 发布管理

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **WB-38-01** | P0 | **v0.8.0 正式发布** (release script + CHANGELOG + Git tag + GitHub Release) | tag v0.8.0 可见 | 1h |
| **WB-38-02** | P0 | **守护循环** (1550+ 目标, 5 轮稳定性) | 5 轮 0 fail | 持续 |
| **WB-38-03** | P1 | **R37 验收 + Phase 4.4 整合** | 文档完成 | 30min |

### 🦐 dao (4) — 审查 + 文档 + 技能库

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **D-38-01** | P0 | **Code Review R37 代码** (ML-37/JVS-37/QClaw-37) | 审查报告 | 1.5h |
| **D-38-02** | P0 | **Phase 4.4 设计文档审查** (≥50行审查报告) | 报告完成 | 1h |
| **D-38-03** | P1 | **v0.8.0 Release Notes 完善** (基于 CHANGELOG) | 文档完成 | 30min |
| **D-38-04** | P1 | **技能库更新** (添加 reinforcement-learning/adaptive-systems 技能索引) | 索引完成 | 30min |

---

## 📐 主副双岗制 (避免单点故障)

| 主岗 | 副岗 | 互备场景 |
|------|------|----------|
| **ML** v0.8.0 UI | **dao** Release Notes | ML UI 卡壳 → dao 接手文档 |
| **JVS** 自主决策引擎 | **QClaw** 集成测试 | JVS 引擎卡壳 → QClaw 补测试 |
| **QClaw** 测试+基准 | **JVS** 多周期回测 | QClaw 测 flaky → JVS 协助定位 |
| **PM** 发布+守护 | **dao** CHANGELOG | PM 阻塞 → dao 代写 |
| **dao** 审查+文档 | **ML** 路线图 | dao 阻塞 → ML 接手 |

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|------|
| **03:05** | P0 启动 (5 虾并行) |
| **03:30** | P0 完成 (v0.8.0 发布 + 3 引擎 + 1550 测试) |
| **03:50** | P1 完成 (路线图 + 审查 + Release Notes) |
| **04:00** | **R38 验收** |

---

## ✅ 验收标准

| # | 检查项 | 标准 |
|---|--------|------|
| 1 | tsc | 0 errors |
| 2 | build | 0 errors |
| 3 | test | **≥1550 tests, 0 fail, exit 0** (5 轮稳定性) |
| 4 | v0.8.0 | GitHub tag + Release asset 可见 |
| 5 | 新引擎 | adaptive-param-engine.ts (≥500L) + reward-engine.ts (≥400L) |
| 6 | SystemHealthPanel | Dashboard 实时引擎心跳可见 |
| 7 | 性能基准 | P50/P95/P99 报告 (≥300L) |
| 8 | CHANGELOG | Phase 4.1-4.3 全部变更汇总 |
| 9 | 审查 | R37 + Phase 4.4 两份报告 |
| 10 | 文档 | API 3 份 + 架构图 + Release Notes + Phase 5 路线图 |

---

## 🔗 依赖图

```
J-38-01 (Adaptive Param)  ──┐
J-38-02 (Reward)          ──┼─→ Q-38-01 (Tests 1550+) ─→ WB-38-02 (守护)
J-38-03 (K线回放 P1)       ─┘                          │
                                                         ↓
ML-38-01 (Dashboard) ──→ Q-38-02 (基准)         WB-38-01 (v0.8.0 发布)
ML-38-02 (自学习UI)  ──→ 整合 J-38-01 接口        │
                                                        ↓
ML-38-03 (Phase 5 路线图)                       D-38-03 (Release Notes)
                                                        │
D-38-01 (R37 审查) ──→ 反哺 Q-38-01 (测试补全)        │
D-38-02 (Phase 4.4 设计审查)                       D-38-04 (技能库)
D-38-04 (技能库) ──→ 增强 dao 知识库

WB-38-03 (R37 验收 + 整合) ──→ R38 收官
```

---

## 📋 通讯约定

- **每完成一个 P0**: 立即广播 `TASK_DONE` + commit hash
- **每完成一个 P1**: 5 分钟内广播
- **阻塞**: 立即广播 `BLOCKED` + 具体依赖
- **每 30 分钟**: 进度 `TASK_PROGRESS` (即使 0%)
- **每 60 分钟**: 关键决策 `@PM` 通知

---

## ⚠️ 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|:--:|------|------|
| Adaptive/Reward 引擎设计复杂 | 中 | 拖延 J-38-01/02 | 复用 ClosedLoopExecutor 状态机 + Bayesian optimizer (已存在 244L) |
| GitHub Release 权限 | 中 | 阻塞发布 | 提前 verify；fallback 本地打包 |
| v0.8.0 .exe DLL 缺失 | 中 | 阻塞发布 | WB-38-01 必须实测启动 |
| 性能基准压测耗时 | 低 | 拖延 Q-38-02 | 用现有 benchmark.ts 框架 |
| 审查报告质量 | 低 | 反哺测试 | dao 用 r36-code-review.md 模板 |

---

## 📊 与 R37 对比

| 维度 | R37 | R38 |
|------|-----|-----|
| 测试增长 | +148 (1379→1527) | **+23 (1527→1550)** |
| 引擎新增 | events shim (恢复6) | **+2 新引擎** (Adaptive/Reward) |
| 文档产出 | 58.1KB | **~50KB** (审查+基准+路线图) |
| 阶段 | Phase 4.3 收尾 | **Phase 4.4 启动** |
| 发布 | 准备 | **正式发布** |

---

*PM v2 整合完毕（采纳 JVS 方向），请 5 虾立即按此方案启动 P0 任务！*
