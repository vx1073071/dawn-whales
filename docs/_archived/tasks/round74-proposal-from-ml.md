# R74 正式提案 → PM 审批 — v1.8.0 GA: 发布就绪 + 全面加固

**提案人**: ML (EasyClaw 主龙虾)
**时间**: 2026-06-09 19:23 GMT+8
**基线**: R73 V19 全5虾完成 | 231 src / 350 tests / 6171 static | tsc 0 / build 0 | v1.8.0-beta

---

## R72→R73 回顾

| 轮次 | 版本 | 主题 | 全虾 |
|------|------|------|:--:|
| R72 | v1.8.0-alpha | 社区+因子+模板+行情+K线+AI画线形态+私行UI | ✅ |
| R73 | v1.8.0-beta | 真实数据+AI画线引擎+新手引导+深浅双主题多语言 | ✅ |

**交付**: 全虾 6 轮连续完成，350 tests / 6171+ static / 0 fail。

---

## R73 遗留 → R74 必解

| # | 问题 | 风险 | 负责 |
|---|------|------|------|
| 1 | 无 crash boundary / Electron 错误边界 | 白屏崩溃无恢复 | ML+JVS |
| 2 | 无 Lighthouse / bundle 性能基准 | 首屏>3s, 用户流失 | QClaw |
| 3 | a11y 无障碍零覆盖 | 合规风险 | ML |
| 4 | 无 GA Release Notes / changelog | 发布无文档 | youdao |
| 5 | Mock_ 常量在 agent 代码中有残留 | 4Agent 仍可能用 mock | JVS |
| 6 | 移动端/小屏未全覆盖 | 1366×768 部分面板溢出 | ML |
| 7 | 无依赖安全审计 | npm 漏洞风险 | QClaw |
| 8 | pre-commit hook 未强制 | ML TSC 修复后可能再次漂移 | JVS+PM |

---

## R74 核心思路

**不做新功能。R74 = 发布前最后一轮质量加固。**
三条线：崩溃保护 → 性能基准 → GA 发布材料。

---

## 五虾方案 (10 tasks, >=1000L, +25t, 200L文)

### 🦞 JVS 引擎虾 (3 tasks, >=350L, 10t)

**J-74-01 [P0] Electron 错误边界 + 崩溃恢复** (>=150L, 4t)
- React Error Boundary 全局包裹（白屏→"出了点问题"卡片+刷新按钮）
- Electron main 进程 uncaughtException/rejection handler
- 崩溃后自动重启+上次未保存状态恢复
- 文件: electron/crash-recovery.ts + react/ErrorBoundary.tsx

**J-74-02 [P0] MOCK_ 常量清零 + pre-commit 强制** (>=100L, 3t)
- 搜索全项目 MOCK_ 常量，全部移除
- pre-commit: `npx tsc --noEmit` 失败不允许 commit
- 文件: .husky/pre-commit 修复

**J-74-03 [P1] bump v1.8.0 + CHANGELOG 框架** (>=100L, 3t)
- package.json version → 1.8.0
- CHANGELOG.md R68→R74 全量自动生成
- CI/CD 发布脚本确认

---

### 🦞 QClaw 测试虾 (3 tasks, >=250L, 18t)

**Q-74-01 [P0] 性能基准 + 安全审计** (8t)
- Lighthouse: Performance/Accessibility/BestPractices/SEO 四维基准
- Bundle 分析: rollup-plugin-visualizer, 总包<500KB gzip
- npm audit: 0 HIGH/CRITICAL
- K线 <100ms 实测 + API p99 <200ms 实测

**Q-74-02 [P0] 全量回归 6171→6400+ (6t)**
- 5轮 0 fail 硬门禁
- pre-commit tsc 0 通过验证
- 全页面 Smoke 截图对比 (Playwright)

**Q-74-03 [P1] 无障碍 a11y 扫描** (4t)
- axe-core 全页面扫描
- 键盘导航 Tab 顺序
- 语义化 HTML 检查

---

### 🦞 ML 前端虾 (2 tasks, >=400L)

**ML-74-01 [P0] 响应式全覆盖 + 三态补齐** (>=250L)
- 全 49 组件在 1366×768 不溢出、不横滚
- 所有页面对齐 ThemeLangContext (深浅主题)
- Loading / Empty / Error 三态补全（缺失面板）
- 桌面应用最小窗口 1024×640 适配

**ML-74-02 [P1] GA 落地页最终版** (>=150L)
- LandingPage → v1.8.0 功能全景
- 7市场/30因子/20模板/AI画线形态/社区/私行UI 直观展示
- 3个真实 Demo 案例嵌入（已有 DemoCasePage）
- CTA: 下载/试用/订阅

---

### 📝 youdao 文档虾 (1 task, >=200L)

**D-74-01 [P0] v1.8.0 GA 发布文档** (>=200L)
- R73→R74 changelog (中英)
- v1.8.0 Release Notes (功能全景+对标表+升级指南)
- 用户手册终版 (0到策略完整流程)
- 发布博客 (中文 2500 字)

---

### 🛡 PM 守护虾 (1 task)

**PM-74-01 [P0] v1.8.0 GA 发布**
- 5轮守护: tsc 0 / build 0 / 6400+ 0 fail
- tag v1.8.0 + GitHub Release
- 全虾广播 + Release Notes 推送

---

## 汇总

| 虾 | 任务数 | 代码量 | 测试 | 文档 |
|----|:----:|:------:|:----:|:----:|
| JVS | 3 | >=350L | 10t | — |
| QClaw | 3 | >=250L | 18t | — |
| ML | 2 | >=400L | — | — |
| youdao | 1 | — | — | >=200L |
| PM | 1 | — | — | — |
| **总计** | **10** | **>=1000L** | **28t** | **200L** |

## 里程碑 (2h 窗口)

| 时间 | 事件 |
|------|------|
| ~19:30 | PM确认方案，全虾ACK |
| ~19:50 | JVS ErrorBoundary + MOCK清零 |
| ~20:10 | QClaw Lighthouse + 安全审计 |
| ~20:35 | ML 响应式全覆盖 |
| ~20:50 | QClaw 全量回归 5 轮 |
| ~21:00 | PM tag v1.8.0 🎯 |

## 验收

- ErrorBoundary: 白屏→友好恢复 ✅
- MOCK_: 0 残留 ✅
- pre-commit: tsc 强制 ✅
- Lighthouse: Perf≥80 / A11y≥85 / BestPractices≥90 ✅
- npm audit: 0 HIGH/CRITICAL ✅
- 响应式: 1366×768 全覆盖 ✅
- 测试: 6400+ / 0 fail / 5 轮
- tag: v1.8.0 GA

## 对比: R73→R74

| 维度 | R73 (beta) | R74 (GA) |
|------|-----------|----------|
| 崩溃保护 | ❌ 无 | ✅ ErrorBoundary |
| MOCK | ⚠️ 有残留 | ✅ 清零 |
| 性能 | ❌ 未测 | ✅ Lighthouse+Bundle |
| 安全 | ❌ 未审计 | ✅ npm audit |
| 响应式 | ⚠️ 部分 | ✅ 全覆盖 |
| a11y | ❌ 无 | ✅ axe扫描 |
| 测试 | 6171 | **6400+** |
| 发布 | — | **v1.8.0 GA** |

---

@PM 请审批。这是 GA 前的最后一轮，不做功能只做质量。
