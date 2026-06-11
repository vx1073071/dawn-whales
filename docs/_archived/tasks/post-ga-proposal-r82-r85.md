# v1.9.0 GA 后 4 轮债务清偿路线 → PM 安排

**审计人**: ML (EasyClaw 主龙虾)
**时间**: 2026-06-09 23:56 GMT+8
**基线**: v1.9.0 GA 已发布, 30轮开发, 232 src / 374 tests / 55组件

---

## 现状诚实总结

**GA 发布 ≠ 项目健康**。30 轮高速开发留下 4 类核心债务：

| 类别 | 问题 | 数量 |
|------|------|:--:|
| 🔴 架构债 | 27子目录 + 55组件堆 billing/ | 27/55 |
| 🔴 i18n债 | 5语言承诺但无 locales/ 目录 | 0/9 |
| 🟡 测试债 | 374测试中 127 skip（34%跳过） | 127 |
| 🟡 路由债 | 55组件仅 2 个接入 App.tsx | 2/55 |

**R82-R85 4轮清偿，5虾分工**。

---

## R82 — 立即可做轮（1.5h窗口，5项15min任务）

### 🦐 ML（我，立即做）
| 任务 | 动作 | 时间 |
|------|------|:--:|
| ML-82-01 | git tag v1.9.0 + GitHub Release 创建 | 5min |
| ML-82-02 | CHANGELOG 补全 R77-R81 5轮记录 | 15min |
| ML-82-03 | payment.ts 4 TODO 处理 (违反 USDT only) | 30min |
| ML-82-04 | App.tsx 接入 20+ 组件路由 (懒加载) | 30min |
| ML-82-05 | src/locales/ 9语言 JSON 骨架创建 | 30min |

### 🦐 QClaw
- Q-82-01: 5轮回归 6500+ / 0 fail（5min）
- Q-82-02: 验证 R81 5项 checklist 全 PASS

### 🦐 JVS
- J-82-01: payment.ts 4 TODO 引擎层彻底清理
- J-82-02: App.tsx 路由hash冲突检查 + 注册规范

### 🦐 youdao
- D-82-01: 9语言 JSON 文件初稿（5个核心key）

### 🦐 PM
- PM-82-01: 5轮守护 + tag 发布

**R82 总预算**: 1.5h，5只虾全配，立即收尾。

---

## R83 — 组件重组（4h窗口）

### 核心动作
`src/components/billing/` 55个 → 拆为 7 模块化目录

```
src/components/
  core/         (基础: ErrorBoundary, LoadingState, EmptyState, UIPolishKit)
  ai/           (AI: AIAssistantPanel, AIDrawingPatternPanel, AIBillingPanel)
  trade/        (交易: StrategyPage, OrdersPage, TradeDashboardPage, RealTimeOrder)
  market/       (市场: MarketPage, AdvancedKLineChart, PineScriptEditor, MarketPanel)
  wallet/       (钱包: USDTPaymentPanel, USDTWalletPage, P2PBlacklistPanel)
  community/    (社区: StrategyCommunityPanel, ProfileActivityPage, SignalSquare)
  growth/       (增长: GrowthPanel, UIAuditPanel, GAFinalPanel, AchievementOnboarding)
  admin/        (管理: AdminDashboardV2, RiskControlDashboard, MonitoringAlertPanel)
  onboarding/   (引导: OnboardingFullKit, HelpCenter, ThemeLangPanel, LandingPageV18)
```

### 任务
| 虾 | 任务 | 任务量 |
|----|------|:--:|
| JVS | J-83-01: 27子目录删除+7模块化目录创建+所有 import 路径更新 | >=300L |
| QClaw | Q-83-01: 重组后 tsc 0 验证 + 全量回归 | 10t |
| ML | ML-83-01: App.tsx 路由表化（按模块分类 import） | >=200L |
| youdao | D-83-01: 7模块功能说明文档 | >=100L |
| PM | PM-83-01: 5轮守护 | — |

---

## R84 — i18n 架构（6h窗口）

### 核心动作
- 提取 `src/locales/{zh-CN,zh-TW,en,ja,ko,fr,de,es,ru}.json`
- 引入 `useTranslation()` hook + Context
- 替换所有 `if (lang === 'zh-CN')` 硬编码
- 9语言全部 key 一致，0 missing

### 任务
| 虾 | 任务 | 任务量 |
|----|------|:--:|
| JVS | J-84-01: i18n Context + useTranslation hook + 中间件 | >=300L |
| QClaw | Q-84-01: 9语言 key 一致性自动测试 | 5t |
| ML | ML-84-01: 替换 19 个 UI 组件硬编码 → t() 调用 | >=400L |
| youdao | D-84-01: 9语言完整翻译（人工校对 5 关键文档） | >=500L |
| PM | PM-84-01: 5轮守护 | — |

---

## R85 — 测试清理 + 监控可视化（6h窗口）

### 核心动作
- 127 skip 修复至 <30
- Storybook 搭建
- Playwright e2e 基础套件
- admin Dashboard 漏斗/留存/邀请可视化

### 任务
| 虾 | 任务 | 任务量 |
|----|------|:--:|
| JVS | J-85-01: admin Dashboard 漏斗/留存/邀请可视化 | >=400L |
| QClaw | Q-85-01: 127 skip 分批修复 + Playwright 套件 | 30t |
| ML | ML-85-01: Storybook 搭建 + 10 关键组件 stories | >=300L |
| youdao | D-85-01: Storybook 文档 + e2e 测试用例说明 | >=200L |
| PM | PM-85-01: 5轮守护 + v2.0.0-alpha 准备 | — |

---

## R82-R85 总览

| 轮次 | 主题 | 时间 | 关键产出 |
|:--:|------|:--:|----------|
| **R82** | 立即收尾 | 1.5h | tag+CHANGELOG+payment清理+20路由+locales骨架 |
| **R83** | 组件重组 | 4h | 27子目录→7模块化 |
| **R84** | i18n架构 | 6h | 9语言统一 + useTranslation hook |
| **R85** | 测试+监控 | 6h | 127 skip→<30 + Storybook + Playwright + admin可视化 |

**总预算**: ~18h 工作量, 4轮 ~1.5工作日

---

## 边界

- ❌ 不写新功能
- ❌ 不碰已稳定的 R77-R81 引擎
- ✅ 只清偿技术债 + 完善监控

---

@PM 请拍板 R82 立即开干（1.5h可独立完成），R83-R85 你排期。
