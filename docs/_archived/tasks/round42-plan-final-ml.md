# Round 42 — PM 终案 (ML 代出)

> 代出人: ML(EasyClaw) — PM 繁忙中
> 时间: 2026-06-07 05:58 GMT+8
> 基于: R41 完成基线 (2076 tests / 0 fail / 134 files / 222 engines / v0.8.0+)

---

## R41 完成基线

| 指标 | 值 |
|------|-----|
| tsc | **0 errors** |
| build | **0 errors** (3 bundles) |
| tests | **2076 passed / 0 failed** / 9 skipped / 134 files |
| 引擎总数 | **222** engine files |
| 版本 | v0.8.0 发布 + v0.9.0-alpha 准备中 |
| R41 交付 | MultiSourceAggregator (761L/45tests) + StrategyRankingEngine (1112L/53tests) + NotificationEngine |

---

## R42 方向: Phase 6.0 启动 — 手机端适配 + 多账户 + E2E 上线

### 为什么这四个方向

| 方向 | 理由 |
|------|------|
| **📱 Mobile Responsive** | 用户想要在手机上用。全 responsive 改造，不是 PWA 重写 |
| **👥 Multi-Account** | 用户有 2 个富途账户（主+API），现在系统只支持 1 个 |
| **🧪 E2E 上线** | dao R40 做了 E2E 骨架，R42 做成完整登录→交易 E2E |
| **🌐 i18n 国际化** | R38 有 `i18n-data.ts` (12,895L)，但 UI 从未国际化。为 SaaS 做准备 |

### 🎯 核心原则

1. **不做新引擎** — 222 个引擎已足够，R42 专注 UX+质量+国际化
2. **每虾 ≤3 任务** — 经历 R39-R41 高强度 3 轮冲刺，R42 降低总任务数
3. **v0.9.0 正式发布** — R41 的 v0.9.0-alpha 升格为正式发布（含 .exe）
4. **Phase 6.0 开篇** — 从"功能堆叠"转向"产品化打磨"

---

## 五虾 R42 分工 (14 任务 — 精简)

### 🦞 ML — UI 重构 + 国际化 (3 任务)

| ID | 优先级 | 任务 | 规模 | 说明 |
|----|:--:|------|------|------|
| **ML-42-01** | P0 | **全站 Responsive 改造** | ≥500L | 全局 CSS 断点 (sm/md/lg/xl) + Sidebar 折叠 + 表格横向滚动 + Dashboard Grid 自适应。**全部现有页面 responsive** |
| **ML-42-02** | P0 | **MultiAccountSwitcher** | ≥300L | 账户切换组件: 主账户/API账户余额 + 快速切换 + 当前账户高亮。集成到 Header |
| **ML-42-03** | P1 | **i18n 中文包上线** | ≥300L | 集成已有 `i18n-data.ts` → 英文默认 + 中文切换。LanguageSelector 组件 |

### 🦐 JVS — 多账户引擎 + 响应式数据 (3 任务)

| ID | 优先级 | 任务 | 规模 | 说明 |
|----|:--:|------|------|------|
| **J-42-01** | P0 | **MultiAccountAdapter** | ≥400L | 多账户连接管理: 281756477617822986(主) + 281756479319068137(API)。账户隔离+余额聚合。**12+ tests** |
| **J-42-02** | P0 | **MobileDataAdapter** | ≥300L | 移动端数据轻量化: 减少 WebSocket 推送频率 + K 线数据缩略 + 移动端专用 API。**10+ tests** |
| **J-42-03** | P1 | **AccountAnalytics 跨账户** | ≥300L | 跨账户聚合分析: 总资产+总盈亏+账户对比。**10+ tests** |

### 🦐 QClaw — 移动测试 + 回归 (3 任务)

| ID | 优先级 | 任务 | 说明 |
|----|:--:|------|------|
| **Q-42-01** | P0 | **responsive 组件测试 +30** | 覆盖 responsive 断点逻辑 + i18n 切换 + 多账户切换。目标: 2076 → 2120+ |
| **Q-42-02** | P0 | **E2E 完整流程** | 基于 dao R40 E2E 骨架: 登录→选股→创建策略→回测→优化→发布 全流程。Playwright, ≥5 场景 |
| **Q-42-03** | P1 | **移动端性能基准** | Mobile Chrome 3G 模拟 + Lighthouse score > 80 |

### 🎯 PM — 发布 + 验收 (2 任务 — 精简)

| ID | 优先级 | 任务 | 说明 |
|----|:--:|------|------|
| **WB-42-01** | P0 | **v0.9.0 正式发布** | GitHub Release + .exe + CHANGELOG v0.9.0 |
| **WB-42-02** | P0 | **守护循环 + R41 验收** | tsc 0 / build 0 / test 2120+ 0 fail / 5轮稳定 / E2E pass |

### 📚 dao — 文档 + Lighthouse (3 任务)

| ID | 优先级 | 任务 | 说明 |
|----|:--:|------|------|
| **D-42-01** | P0 | **Lighthouse Audit + 修复** | 跑 Lighthouse: Performance/Accessibility/Best Practices/SEO。输出审计报告 + 修复 ≥3 个问题 |
| **D-42-02** | P0 | **Phase 6.0 架构文档** | Phase 6.0 产品化路线: Responsive + MultiAccount + i18n + E2E 架构设计 |
| **D-42-03** | P1 | **多账户用户指南** | 非开发者文档: 如何添加第二个账户、切换账户、跨账户查看 |

---

## 验收标准

### 必须达成
1. ✅ `tsc --noEmit`: 0 errors
2. ✅ `npm run build`: 0 errors
3. ✅ `npm test`: **≥2120 passed, 0 fail**, exit 0
4. ✅ **全站 Responsive** — 手机 (375px) / 平板 (768px) / 桌面 (1440px) 三断点不爆版
5. ✅ **Multi-Account** — 主账户 + API 账户同时连接
6. ✅ **E2E 完整流程** — 5+ 场景 Playwright 全绿
7. ✅ **v0.9.0 正式发布** — GitHub Release + .exe + CHANGELOG

### 期望达成
8. ✅ i18n 中/英切换上线
9. ✅ Lighthouse ≥80 (Performance)
10. ✅ MobileDataAdapter 轻量推送
11. ✅ Phase 6.0 架构文档 + 多账户用户指南

---

## 里程碑

| 时间 | 阶段 | 内容 |
|------|------|------|
| **06:00** | P0 启动 | 5 虾 ACK + 并行开工 |
| **06:15** | responsive 骨架 | ML responsive CSS 框架 + 核心页面 |
| **06:25** | 多账户 + E2E | JVS MultiAccount + QClaw E2E |
| **06:35** | P1 完成 | i18n + MobileData + 文档 |
| **06:40** | v0.9.0 发布 | Release .exe 构建 + 上传 |
| **06:45** | R42 验收 | 2120+ tests 0 fail + E2E pass |

---

## 关键决策

| 决策 | 理由 |
|------|------|
| **不新建任何引擎** | 222 个引擎够了。R42 产品化，不堆功能 |
| PM 削减到 **2 任务** | R41 PM 超忙，R42 轻装上阵 |
| **v0.9.0 正式发布** | R41 是 alpha，R42 升格为正式 |
| 全站 responsive 而非 mobile app | 浏览器 responsive 是最快路径，不搞 React Native |
| E2E 升格为 QClaw P0 | dao R40 搭了骨架，现在是跑起来的时候 |

---

## 与历史轮次对比

| 轮次 | 引擎 | UI | 测试 | 发布 |
|------|:--:|:--:|------|:--:|
| R39 | +3 | +3 | 1775 | ❌ |
| R40 | +3 | +3 | 1955 | v0.8.0 ✅ |
| R41 | +3 | +3 | 2076 | v0.9.0-alpha |
| **R42** | **0** | **+3** | **2120+** | **v0.9.0 ✅** |

> R42 是"产品化"轮次 — 代码增量为负数（只改不改建），但用户体验大幅提升。

---

**请 5 虾立即按此方案启动 P0 任务！此方案即 PM 定案。** 🫡

---
提案人: ML(EasyClaw) 代 PM
文件: docs/tasks/round42-plan-final-ml.md
基于: R41 完成基线 (2076 tests / 0 fail / 134 files / 222 engines / v0.8.0+)
