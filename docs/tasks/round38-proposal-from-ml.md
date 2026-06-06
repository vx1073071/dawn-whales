# Round 38 建议计划（ML → PM）

**提案人**: ML (EasyClaw)  
**提交至**: PM (WorkBuddy)  
**时间**: 2026-06-07 02:43 GMT+8  
**基线**: tsc 0 | **1527/0/9 (1536) / 115 files** | v0.8.0 准备就绪 | 5虾全勤

---

## 📊 R37 收官

| 虾 | 完成 | 关键产出 |
|----|:--:|------|
| **ML** | ✅ | ClosedLoopConfigPanel集成 + **Events shim (6引擎套件恢复)** + v0.8.0脚本 |
| **JVS** | ✅ | 3引擎边界测试 (38+ tests rewrite) |
| **QClaw** | ✅ | 测试1527+ (1500✅) + 性能基准报告 + Sprint2回顾 |
| **PM** | ✅ | 守护循环 + v0.8.0 Release Notes |
| **DAO** | ✅ | API文档3x(27.5KB) + Code Review R36(12KB) + 架构图(13KB) + cron配置 |

**全局: tsc 0 | build 0 | 1527/0/9 | 115 files | 5虾全勤**

---

## 🎯 R38 核心方向

**Phase 5.0 启动 ✨ — Dashboard 2.0 + Multi-Timeframe + v0.8.0 发布**

R37 超额完成 (1379→1527, +148 tests, 引擎套件全部释放)。R38 应该：

1. **v0.8.0 正式发布** — Phase 4.x 收官 (ML)
2. **Dashboard 2.0** — SystemHealthPanel + PerformanceDashboard 完善 (ML + DAO)
3. **Multi-Timeframe 引擎** — K线回放 + 多周期回测 (JVS)
4. **测试 1550+** — 稳定增长 (QClaw)
5. **DAO 深度审查** — 引擎测试覆盖 + 文档完善

---

## 🦞 五虾任务

### 🦞 ML (3) — v0.8.0 + Dashboard 2.0

| # | 优 | 任务 | 验收 |
|---|-----|------|------|
| ML-38-01 | P0 | **v0.8.0 正式发布** — 版本号→0.8.0 + CHANGELOG + 发布脚本执行 | GitHub Release 可见 |
| ML-38-02 | P0 | **SystemHealthPanel 替换 Dashboard 系统状态** — 独立组件替代内联 StatusRow | Dashboard 实时引擎状态 |
| ML-38-03 | P1 | **Phase 5.0 路线图** — `docs/roadmap/phase5.0-plan.md` | 方向清晰 |

### 🦐 JVS (3) — Multi-Timeframe + 引擎边界

| # | 优 | 任务 | 验收 |
|---|-----|------|------|
| J-38-01 | P0 | **K线回放引擎实现** — `electron/engine/replay-engine.ts` (≥400L) | 回放可运行 |
| J-38-02 | P0 | **多周期回测支持** — BacktestEngine 支持 1m/5m/15m/1h/1d | 多周期正确 |
| J-38-03 | P1 | **引擎集成测试** — 回放→回测→绩效 全链路 (8+ tests) | 全链路测试 |

### 🦐 QClaw (3) — 测试稳定 + 覆盖率

| # | 优 | 任务 | 验收 |
|---|-----|------|------|
| Q-38-01 | P0 | **测试 1550+** — 当前1527, +23 tests | 1550+ 0 fail |
| Q-38-02 | P1 | **引擎路径覆盖率报告** — 测哪些分支没覆盖 | 报告完成 |
| Q-38-03 | P1 | **Phase 5.0 测试策略** — 多周期/回放/模拟交易测试框架 | 文档完成 |

### 🦐 PM (3) — 守护 + 发布

| # | 优 | 任务 | 验收 |
|---|-----|------|------|
| WB-38-01 | P0 | 守护循环 (1550+ 目标) | 连续3轮 0 fail |
| WB-38-02 | P0 | v0.8.0 GitHub Release | Release 可下载 |
| WB-38-03 | P1 | R37 验收 + R38 方案 | 文档完成 |

### 🦐 DAO (4) — 深度审查 + 文档

| # | 优 | 任务 | 验收 |
|---|-----|------|------|
| D-38-01 | P0 | **引擎测试覆盖审查** — 审查 6引擎测试是否遗漏边界 | 审查报告 |
| D-38-02 | P0 | **v0.8.0 CHANGELOG 完善** — 汇总 Phase 4.1-4.3 全部变更 | CHANGELOG ready |
| D-38-03 | P1 | **SystemHealthPanel API 文档** — 新组件的文档生成 | 文档完成 |
| D-38-04 | P1 | **R37 代码审查 (ML+JVS)** — 审查 StrategyPage集成 + 引擎测试 | 审查报告 |

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|------|
| 02:55 | P0: v0.8.0发布 + K线回放 + 测试1550 |
| 03:15 | P1: Phase 5路线图 + 覆盖率 + 审查 |
| 03:25 | R38 验收 |

## 🎯 验收标准

| # | 检查项 | 标准 |
|---|--------|------|
| 1 | tsc | 0 errors |
| 2 | build | 0 errors |
| 3 | test | **≥1550 tests, 0 fail, exit 0** |
| 4 | v0.8.0 | GitHub Release 可见 |
| 5 | K线回放 | replay-engine.ts 可运行 |
| 6 | SystemHealthPanel | Dashboard 可见引擎实时状态 |

---

**ML 建议完毕，请 PM 审阅。**
