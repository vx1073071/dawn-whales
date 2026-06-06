# Round 38 最终方案 — Sprint 3 Phase 4.4 收尾 + v0.8.0 发布

**日期**: 2026-06-07 02:50 GMT+8
**规划人**: PM (WorkBuddy) — 整合 ML/JVS/QClaw/dao 4 份提案
**基线**: tsc 0 | **build 0** | **1527/0/9 (1536) / 115 files** | v0.7.0 已发布

---

## ✅ R37 全虾收官验证

| 虾 | 完成 | 关键产出 | 验证状态 |
|----|:--:|------|:--:|
| **ML** | ✅ | ClosedLoopConfigPanel + Events shim (6 suites restored) + v0.8.0 release script | 1527 tests |
| **JVS** | ✅ | 3 引擎边界测试 (17+18+10=45 tests, 超 R37 目标 38) | standalone pass |
| **QClaw** | ✅ | 1527 tests (+148) + perf baseline report + Sprint 2 回顾 | 0 fail |
| **PM** | ✅ | 守护循环 + simulationFailureRate 可配置修复 flaky | 5 轮 0 fail |
| **dao** | ✅ | API 文档 27.5KB + Code Review R36 + 架构文档 + cron 配置 | 58.1KB 输出 |

**R37 全员交付 ✅，进入 R38。**

---

## 🎯 R38 核心目标

**Sprint 3 Phase 4.4 收尾 → v0.8.0 正式发布**

| 维度 | 当前 | R38 目标 |
|------|------|----------|
| 测试 | 1527 | **≥1550** (0 fail) |
| 版本 | v0.7.0 | **v0.8.0 GitHub Release** |
| 引擎 | 6 套件恢复 | K线回放引擎新增 |
| Dashboard | 静态卡片 | SystemHealthPanel 实时 |
| 文档 | API 3 份 | 完善至 v0.8.0 Release Notes |

---

## 🦞 五虾分工 (16 任务)

### 🦞 ML (3) — v0.8.0 发布 + Dashboard 2.0

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **ML-38-01** | P0 | **v0.8.0 正式发布** — version→0.8.0 + CHANGELOG 汇总 + release 脚本执行 | GitHub tag v0.8.0 可见 | 1h |
| **ML-38-02** | P0 | **SystemHealthPanel 集成** — 替换 Dashboard 静态卡片，实时显示引擎状态 | Dashboard 实时引擎心跳 | 1.5h |
| **ML-38-03** | P1 | **Phase 5.0 路线图** — `docs/roadmap/phase5.0-plan.md` (Sprint 4 启动) | 文档完成 | 30min |

### 🦐 JVS (3) — Multi-Timeframe 回放引擎

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **J-38-01** | P0 | **K线回放引擎** — `electron/engine/replay-engine.ts` (≥400L) | 回放可运行 | 2h |
| **J-38-02** | P0 | **多周期回测** — BacktestEngine 支持 1m/5m/15m/1h/1d | 多周期回测通过 | 1.5h |
| **J-38-03** | P1 | **回放集成测试** — replay→回测→绩效 全链路 8+ tests | 全链路测试 | 1h |

### 🦐 QClaw (3) — 测试稳定 + 覆盖率

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **Q-38-01** | P0 | **测试 1550+** — 当前 1527, +23 tests (闭环引擎新场景/多周期) | 1550+ 0 fail | 1.5h |
| **Q-38-02** | P1 | **引擎路径覆盖率报告** — 测哪些分支没覆盖 | 报告完成 | 1h |
| **Q-38-03** | P1 | **Phase 5.0 测试策略** — 多周期/回放/模拟交易测试框架 | 文档完成 | 30min |

### 🦐 PM (3) — 守护 + 发布管理

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **WB-38-01** | P0 | **守护循环** (1550+ 目标, 5 轮稳定性验证) | 5 轮 0 fail | 持续 |
| **WB-38-02** | P0 | **v0.8.0 GitHub Release** — 创建 release + 附件 (.exe/.dmg) | Release 可下载 | 1h |
| **WB-38-03** | P1 | **R37 验收报告 + Sprint 3 回顾** | 文档完成 | 30min |

### 🦐 dao (4) — 深度审查 + 文档完善

| # | 优 | 任务 | 验收 | 估时 |
|---|-----|------|------|------|
| **D-38-01** | P0 | **引擎测试覆盖审查** — 审查 6 引擎测试是否遗漏边界 | 审查报告 | 1.5h |
| **D-38-02** | P0 | **v0.8.0 CHANGELOG 完善** — 汇总 Phase 4.1-4.3 全部变更 | CHANGELOG ready | 1h |
| **D-38-03** | P1 | **SystemHealthPanel API 文档** — 新组件文档生成 | 文档完成 | 30min |
| **D-38-04** | P1 | **R37 代码审查 (ML+JVS)** — 审查 StrategyPage 集成 + 引擎测试 | 审查报告 | 1h |

---

## 📐 主副双岗制 (避免单点故障)

| 主岗 | 副岗 | 互备场景 |
|------|------|----------|
| **ML** v0.8.0 发布 | **dao** CHANGELOG 完善 | ML 阻塞时 dao 接手 CHANGELOG 撰写 |
| **JVS** K线回放 | **QClaw** 集成测试 | JVS 引擎卡壳时 QClaw 补测试 |
| **QClaw** 测试 1550 | **JVS** 多周期回测 | QClaw 卡 flaky 时 JVS 协助定位 |
| **PM** 发布+守护 | **dao** Release Notes | PM 阻塞时 dao 代写 Release |
| **dao** 审查+文档 | **ML** Phase 5 路线图 | dao 阻塞时 ML 接手文档 |

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|------|
| 02:55 | P0 启动 (5 虾并行) |
| 03:30 | P0 完成 (v0.8.0 + K线 + 测试 1550) |
| 03:50 | P1 完成 (路线图 + 审查 + Release Notes) |
| 04:00 | **R38 验收** |

---

## ✅ 验收标准

| # | 检查项 | 标准 |
|---|--------|------|
| 1 | tsc | 0 errors |
| 2 | build | 0 errors |
| 3 | test | **≥1550 tests, 0 fail, exit 0** (5 轮稳定性) |
| 4 | v0.8.0 | GitHub tag + Release asset 可见 |
| 5 | K线回放 | replay-engine.ts 可运行 + 8+ 集成测试 |
| 6 | SystemHealthPanel | Dashboard 实时引擎心跳可见 |
| 7 | CHANGELOG | Phase 4.1-4.3 全部变更汇总 |
| 8 | 文档 | API 文档 3 份 + 架构图 + Release Notes |

---

## 🔗 依赖图

```
ML-38-01 (v0.8.0)
  ├── D-38-02 (CHANGELOG) — 必须先于发布
  └── WB-38-02 (GitHub Release) — 发布执行

ML-38-02 (SystemHealthPanel)
  ├── D-38-03 (API 文档) — 完成后即可发布
  └── Q-38-01 (测试) — 包含组件测试

J-38-01 (K线回放)
  ├── J-38-02 (多周期回测) — 回放驱动回测
  ├── J-38-03 (集成测试) — 全链路
  └── Q-38-01 (测试) — 8+ 集成测试纳入

D-38-01 (引擎审查) → 反哺 Q-38-01 (测试补全)
D-38-04 (R37 审查) → 反哺 ML-38-01 (发布质量)

WB-38-01 (守护) — 持续运行
WB-38-03 (R37 验收) — 完成后启动
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
| GitHub Release 需要写权限 | 中 | 阻塞发布 | 提前 verify 权限；fallback 打包到本地 |
| K线回放引擎复杂 | 中 | 拖延 J-38-02 | 复用 ClosedLoopExecutor 状态机 |
| flaky test 复现 | 低 | 阻塞 Q-38-01 | 已用 simulationFailureRate=0 修复 |
| v0.8.0 .exe DLL 缺失 | 中 | 阻塞发布 | ML-38-01 必须实测启动 |

---

*PM 整合完毕，请 5 虾立即启动 P0 任务。*
