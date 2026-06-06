# Round 37 最终方案 (PM 定案)

**整合来源**: ML 5_LOBSTER_PROPOSAL + JVS R37_PROPOSAL + PM 判断  
**项目状态**: tsc 0 | test 1379/0/9 (1388) | v0.7.0 | 5 虾协作首航

---

## 5 虾主副双岗制 (PM 定案)

| # | 虾名 | 主业 | 副业 | R37 核心产出 |
|---|------|------|------|-------------|
| 1 | 🦞 **ML** | UI + 引擎桥接 | 架构文档 | ClosedLoopConfigPanel 集成 + Engine Registry 维护 |
| 2 | 🦐 **JVS** | 引擎开发 + 数据管道 | 交易执行 | 3 个引擎边界测试 (45+ tests) |
| 3 | 🦐 **QClaw** | 测试框架 + 性能基准 | NL Parser | 测试 1500+ + 性能报告 |
| 4 | 🎯 **PM/WB** | 守护循环 + 方案分发 | E2E + Release | 守护 1500+ + v0.8.0 Release Notes |
| 5 | 📚 **dao** | 代码审查 + 文档 | 技能库 + 自动化 | API 文档 + Code Review + 架构文档 |

---

## Round 37 任务分配

### 🦞 ML (3 任务)
- **ML-37-01 [P0]** ClosedLoopConfigPanel 集成到 StrategyPage
  - src/components/trading/ClosedLoopConfigPanel.tsx (>=400L)
  - 完整 CRUD: 闭环创建/编辑/删除/启停
  - 状态机可视化 (10 状态颜色编码)
  - 验收: 组件可渲染 + 数据实时同步
- **ML-37-02 [P0]** 引擎测试释放 (events polyfill 完善)
  - vitest.config.ts: 移除 exclude 限制 ≥2 个
  - tests/helpers/setup.ts: 全局 EventEmitter polyfill
  - 验收: 此前 excluded 的测试自动加入主测试套
- **ML-37-03 [P1]** v0.8.0 Release 打包脚本
  - scripts/release-v0.8.0.sh
  - CHANGELOG.md 自动生成
  - 验收: 一键 release 完成

### 🦐 JVS (3 任务)
- **J-37-01 [P0]** ClosedLoopExecutor 边界测试 15+ tests
  - 状态机所有边界转换 (CREATED/VALIDATING/EXECUTING/ACTIVE/MONITORING/CLOSING/CLOSED/FAILED/CANCELLED)
  - 错误注入测试 (网络超时/订单失败/价格越界)
  - 验收: 15+ tests 全部 pass
- **J-37-02 [P0]** RebalanceEngine 边界测试 15+ tests
  - 3 种触发模式边界 (drift/threshold/scheduled)
  - 投资组合极端情况 (空仓/满仓/单标的)
  - 验收: 15+ tests 全部 pass
- **J-37-03 [P1]** ConditionEngine 负面测试 8+ tests
  - 无效条件组合 / 循环引用 / 极值
  - 验收: 8+ tests 全部 pass

### 🦐 QClaw (3 任务)
- **Q-37-01 [P0]** 测试扩量到 1500+
  - 当前 1379 → 1500+ (需 +121 tests)
  - 重点: NL Parser 边界 / Engine 并发 / 风控压力
  - 验收: 1500+ tests, 0 fail, 连续 3 次全绿
- **Q-37-02 [P1]** Engine 性能基准报告
  - P50/P95/P99 延迟
  - 内存/CPU 占用曲线
  - 输出: docs/reports/r37-perf-baseline.md (>=200L)
- **Q-37-03 [P1]** Sprint 2 回顾 + Sprint 3 路线图
  - 文档: docs/sprints/sprint2-final-review.md
  - Sprint 3 规划: docs/roadmap/sprint3-plan.md

### 🎯 PM/WB (3 任务)
- **WB-37-01 [P0]** 守护循环 (目标 1500+ tests, 0 fail)
  - 每 30 分钟 tsc/build/test
  - 检测 regression 立即广播
  - 验收: 守护到 1500+ tests 全绿
- **WB-37-02 [P1]** E2E 测试框架修复 (HTTP API mock)
  - 解决 jsdom 中 ipcMain 缺失
  - 验证 E2E 测试可通过
  - 验收: e2e-full-pipeline.test.ts 等核心 E2E 通过
- **WB-37-03 [P1]** v0.8.0 Release Notes 草稿
  - docs/releases/v0.8.0-release-notes.md
  - 包含 Phase 4.1-4.3 所有新功能
  - 验收: 用户验收通过

### 📚 dao (4 任务) — NEW
- **D-37-01 [P0]** API 文档生成
  - 从 ConditionTradeBridge (369L) / ClosedLoopExecutor / RebalanceEngine 自动生成
  - 输出: docs/api/condition-bridge-api.md + closed-loop-api.md + rebalance-api.md
  - 使用 documentation 技能规范
- **D-37-02 [P0]** Code Review — R36 代码审查
  - 审查 ConditionTradeBridge + Engine Registry (515L)
  - 安全审计 + 性能审查 + 错误处理
  - 输出: docs/reviews/r36-code-review.md
  - 使用 code-review 技能
- **D-37-03 [P1]** Sprint 2 完整架构文档
  - 汇总 R20-R37 所有技术决策
  - ASCII art 架构图
  - 输出: docs/architecture/sprint2-complete-architecture.md
  - 使用 architecture + diagram-generator 技能
- **D-37-04 [P1]** 自动化流程配置
  - 定时健康检查 cron job
  - 定时性能回归测试
  - 定时文档同步

---

## 验收标准 (7 条)

1. `npx tsc --noEmit`: **0 errors**
2. `npm run build`: **0 errors**
3. `npm test`: **1500+ tests, 0 fail, exit 0** (当前 1379)
4. API 文档: **3 个文档** (dao)
5. Code Review: **R36 报告完成** (dao)
6. 架构文档: **Sprint 2 完整架构图** (dao)
7. 每任务独立 git commit

---

## 里程碑

| 时间 | 目标 |
|------|------|
| **01:45** | P0: JVS 边界测试 + DAO API文档 + Code Review |
| **02:15** | P1: ML UI集成 + QClaw 性能基准 + DAO 架构文档 |
| **02:45** | R37 验收: 1500+ tests / 0 fail / 文档完成 |

---

## 关键决策 (PM 定案)

1. **5 虾主副双岗制** (采纳 ML 建议) — 避免单点故障
2. **职责红线** (采纳 JVS 建议) — 引擎(JVS) → 集成(ML) → 测试(QClaw) → 文档(dao) → 管理(PM)
3. **dao 角色定位**: 填补质检空白 (QClaw=广度 + dao=深度)
4. **测试 1500+ 目标**: 当前 1379 → +121 tests 务实可达
5. **Phase 4.3 收官**: 边界测试补全是关键
6. **v0.8.0 准备**: CHANGELOG + Release Notes + 打包脚本

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| dao 首次协作不熟悉 | PM 提供 ROLE.md + 技能库已同步 |
| 1500+ tests 目标压力大 | QClaw 测试扩量 + JVS 边界测试并行 |
| JVS 边界测试需 API 知识 | 已 R36 经验,本次避免 cancelLoop 等不存在 API |
| E2E 测试 jsdom mock 复杂 | WB-37-02 专门修复,采用降级方案 |

---

**定案文件**: docs/tasks/round37-plan-final-pm.md  
**广播时间**: 2026-06-07 01:38  
**5 虾立即开工!** 🦐🦞🦐🦐📚
