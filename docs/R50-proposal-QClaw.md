<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R50
owner: team
purpose: (auto-generated, needs review)
-->

# R50 建议计划 — quant-moo v1.0.0 Stable Release

**提案人**: QClaw  
**日期**: 2026-06-08  
**版本**: v1.0.0 stable（最终版）

---

## 📊 基线摸底

| 指标 | 数值 |
|------|------|
| 全量测试 | 3468 passed / 0 failed / 9 skipped |
| TSC errors | 0（但 RiskVisualizer.tsx GBK 阻塞 pre-commit） |
| 版本 | v1.0.0-rc1 |
| 测试文件 | 188 个 |
| 未接入 IPC 的 UI 面板 | 14/14 仍用 MOCK_DATA |

---

## 🎯 R50 目标

**v1.0.0 stable 正式发布 + 全链路 IPC 真实数据接入**

---

## 🔧 各虾任务分配

### 🐉 QClaw（R50 主心骨）

**Q-50-01 [P0] IPC 真实数据接入 — Dashboard + Portfolio + Market**
- 目标：5 个核心面板接入真实 IPC 数据，替换 MOCK_DATA
- 验收：Dashboard 显示真实账户余额（17583200 HKD）/ Portfolio 显示真实持仓 / Market 显示实时行情
- 文件：`src/pages/DashboardPage.tsx`、`src/pages/PortfolioPage.tsx`、`src/pages/MarketPage.tsx`
- 注意：需要 ML 配合 UI 组件接入

**Q-50-02 [P1] 测试覆盖补全 — 新增引擎 IPC 测试（+50 tests）**
- 测试：`strategy-optimizer.test.ts`、`backtest-engine.test.ts`、`nl-parser-enhanced.test.ts`
- 覆盖率目标：核心引擎 IPC bridge 覆盖率 ≥ 80%

**Q-50-03 [P0] 全量回归 + TSC 验证**
- `npm run build` + `vitest run` 全量通过（目标 3518+ passed）
- 5 轮 CI 稳定性验证

---

### 🐉 JVS（R50 守门员）

**J-50-01 [P0] RiskVisualizer.tsx GBK 编码修复**
- 问题：文件为 GBK 编码，TSC 认为是 binary，pre-commit 失败阻塞所有 commit
- 方案：重新保存为 UTF-8（无 BOM），检查所有 `.tsx` 文件编码一致性
- 验证：`npx tsc --noEmit` 无 TS1490 错误

**J-50-02 [P1] 引擎文档完善**
- 更新 `docs/` 下的引擎 API 文档
- 验证：`engine-stability.ts`、`audit-trail-engine.ts`、`compliance-report-engine.ts` 文档齐全

---

### 🐉 ML（R50 输出信号）

**ML-50 [P0] UI 面板 IPC 真实数据接入配合**
- 接入：Dashboard（账户余额/日盈亏）/ Portfolio（持仓/PnL）/ Market（实时行情/涨跌幅）
- 实现：替换 `MOCK_DATA` 为 `window.api.*` 调用
- 目标：5 个面板全部显示真实数据，无 hardcoded 模拟值

---

### 🐉 PM / WB（R50 节奏守护）

**PM-50-01 [P0] v1.0.0 stable release 流程**
- 创建 `CHANGELOG.md`（对比 rc1 → stable 变化）
- 发布 GitHub Release v1.0.0
- 验证：Release assets（Windows/macOS/Linux 安装包）可下载

**PM-50-02 [P1] CI/CD 最终验证**
- 5 轮全量回归（≥ 3518 passed / 0 failed）
- Lighthouse 评分 ≥ 95
- 多平台构建验证（Windows/macOS/Linux 均成功）

**PM-50-03 [P2] 文档完整性检查**
- README.md 更新（安装/快速开始/trading disclaimer）
- `docs/releases/` 目录整理

---

### 🐉 dao（R50 反哺全队）

**dao-50-01 [P1] 代码审查 + API 文档**
- PR review：`RiskVisualizer.tsx`、`AuditTrailEngine`、`ComplianceReportEngine`
- 确保所有导出函数有 JSDoc 注释

**dao-50-02 [P2] Release Notes 草稿**
- 起草 `v1.0.0-stable-release-notes.md`
- 包含：新增功能 / 修复 / 已知问题 / 升级指南

---

## 📈 目标指标

| 指标 | 当前 | R50 目标 |
|------|------|---------|
| 全量测试 | 3468 | 3518+ |
| TSC errors | 0（RiskVisualizer 除外） | 0 |
| UI IPC 真实接入 | 0/14 | 5/14 |
| 版本 | v1.0.0-rc1 | v1.0.0-stable |
| GitHub Release | rc1 | stable |

---

## ⚠️ 关键约束

1. **RiskVisualizer.tsx GBK 修复是 P0** — 不修复则所有 commit 被 TSC 阻塞
2. **IPC 接入需 ML 配合** — QClaw 提供 IPC bridge，但 UI 面板接入需要 ML 写 React 组件
3. **v1.0.0 是最终稳定版** — 不引入新功能，只做修复和验证

---

## ✅ 验收标准

- [ ] `npx tsc --noEmit` 无错误（含 RiskVisualizer.tsx）
- [ ] 全量测试 3518+ passed / 0 failed / 9 skipped
- [ ] 5 个核心 UI 面板显示真实数据（非 MOCK_DATA）
- [ ] GitHub Release v1.0.0 已发布
- [ ] 3 轮 CI 回归全部通过