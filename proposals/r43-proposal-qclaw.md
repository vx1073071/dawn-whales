# R43 建议计划 — QClaw 提出

=== R42 完成基线 ===
✅ tsc 0 | build 0 | test 2238 / 0 fail / 9 skipped (140 files)
✅ v0.9.0 GitHub Release 已发布
✅ Phase 6.0 功能交付（Responsive + MultiAccountSwitcher + i18n）
⚠️ JVS R42: 16 个测试失败（MultiAccountAdapter engine 未提交）

---

## R43 主题：产品化收尾 + IPC 真实化 + E2E 护航

### 背景分析

R42 交付了 Phase 6.0 的 UI 框架，但：
1. JVS 的 MultiAccountAdapter/MobileDataAdapter/AccountAnalytics engine 源码未提交，导致 16 个测试全红
2. Phase 6.0 的 Responsive/i18n/MultiAccountSwitcher 组件使用 MOCK_DATA，未接入真实 IPC
3. 全站 IPC 覆盖率 0/78 组件 — 上轮 R42-03 已确认
4. 测试总数 2238，距 2300 目标差 62

### 核心目标

- **修复 JVS R42 失败的 16 个测试**（JVS 自己修，或 PM 兜底）
- **Phase 6.0 核心组件接入真实 IPC**（至少 3/5）
- **E2E 测试覆盖关键路径**（Playwright）
- **测试总数 2300+**

---

## 任务分配（5 虾）

### 🦐 QClaw（3 任务 — 测试 + IPC 验证）

**Q-43-01 [P0] JVS R42 修复验证（+20 tests）**
- 验证 JVS 的 MultiAccountAdapter / MobileDataAdapter / AccountAnalytics engine 源码
- 如果 JVS 按时完成 → 补边界测试覆盖（目标 2300+）
- 如果 JVS 未完成 → PM 决定是否接管
- 目标：修复后 0 fail

**Q-43-02 [P1] WalkForwardPanel + MultiTimeframePanel 接入真实 IPC（+15 tests）**
- WalkForwardEngine IPC bridge → WalkForwardPanel（真实数据）
- MultiTimeframeEngine IPC bridge → MultiTimeframePanel（真实数据）
- 各写 15+ 集成测试验证 IPC 连通性

**Q-43-03 [P2] IPC 覆盖率提升行动（+10 tests）**
- 选择一个 Phase 6.0 新组件，接入真实 IPC
- 测试覆盖：数据流从 engine → IPC bridge → React hook → 组件渲染

---

### 🦐 JVS（3 任务 — 补交 R42 + 深化）

**J-43-01 [P0] 完成并提交 MultiAccountAdapter engine 源码**
- 修复 `tests/jvs-42-01-multi-account-adapter.test.ts` 的 16 个失败测试
- 提交 engine 源码（electron/engine/multi-account-adapter.ts）
- 目标：12+ tests pass

**J-43-02 [P0] MobileDataAdapter engine 源码提交**
- 完成并提交 electron/engine/mobile-data-adapter.ts
- 修复 `tests/jvs-42-02-mobile-data-adapter.test.ts`

**J-43-03 [P1] AccountAnalytics engine 提交**
- 完成并提交 electron/engine/account-analytics.ts
- 修复 `tests/jvs-42-03-account-analytics.test.ts`

---

### 🦞 ML（3 任务 — UI IPC 接入 + E2E）

**M-43-01 [P0] MultiAccountSwitcher 接入真实 IPC（>=200L）**
- 将 MultiAccountSwitcher 连接到 MultiAccountAdapter IPC bridge
- 使用 `window.api.multiAccount.getAccounts()` 替代 MOCK_DATA
- 集成测试验证账户切换数据流

**M-43-02 [P1] I18nProvider 真实多语言数据接入（>=150L）**
- 将 I18nProvider 连接到 i18n engine IPC bridge
- 验证语言切换时数据正确加载

**M-43-03 [P2] Playwright E2E 测试（>=300L）**
- 场景 1: 多账户切换 → 查看各账户持仓
- 场景 2: 语言切换 → UI 文本更新
- 场景 3: 响应式布局 → 不同分辨率下 UI 正常

---

### 🎯 PM / WorkBuddy（2 任务）

**WB-43-01 [P0] R42 验收确认 + R43 广播**
- 确认 JVS R42 三项 engine 提交
- 广播 R43 任务分配
- 若 JVS R42 未完成，执行兜底（PM 自己或协调其他虾接管）

**WB-43-02 [P0] v0.9.1 发布准备**
- R43 完成后发布 v0.9.1（修复 JVS R42 + IPC 真实化）
- 更新 CHANGELOG

---

### 📚 dao（2 任务）

**D-43-01 [P1] MultiAccountAdapter API 文档**
- 基于 JVS R42 提交的 engine 源码
- 编写 API 文档（methods / events / examples）

**D-43-02 [P2] Phase 6.0 集成测试文档**
- 记录 MultiAccountSwitcher / I18nProvider / Responsive 的测试方法
- 为后续维护提供参考

---

## 里程碑

| 时间 | 事件 |
|------|------|
| 07:05 | R43 广播 + 启动 |
| 07:30 | JVS R42 兜底决策点（若未完成，PM 接管） |
| 07:40 | JVS R42 完成 + Q-43-01 验证 |
| 08:00 | Phase 6.0 IPC 接入第一波（M-43-01 + Q-43-02） |
| 08:20 | E2E 测试完成 + 全量测试 |
| 08:30 | v0.9.1 发布 + R43 验收 |

---

## 验收标准

- test: **2300+ passed / 0 fail / 9 skipped**
- tsc: 0 errors
- build: 0 errors
- Phase 6.0 核心组件至少 3 个接入真实 IPC
- Playwright E2E 3 场景全绿
- v0.9.1 GitHub Release

---

## 风险提示

1. **JVS R42 可能继续拖延** — 建议 PM 准备兜底方案（QClaw 或 ML 接管 MultiAccountAdapter）
2. **IPC 接入工作量大** — Phase 6.0 有 5 个新组件，建议优先 MultiAccountSwitcher（核心价值最高）
3. **E2E 测试不稳定** — Playwright 在 CI 环境可能因 timing 问题 flaky，建议设计容错

---

## QClaw 自评

- R42 完成: 3/3 ✅（63 tests，commit a81fdc9e）
- R43 优先: Q-43-01 修复验证（依赖 JVS 完成）+ Q-43-02 IPC 接入（独立可行）
- 可承接额外任务：如 JVS R42 兜底需要，QClaw 可接管 MultiAccountAdapter engine 开发和测试