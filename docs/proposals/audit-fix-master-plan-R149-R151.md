# Dawn Whales 5虾审计修复方案 R149-R151

> **制定**: Claw (PM/64001) | **日期**: 2026-06-13
> **范围**: 5虾审计合并 31 项问题 → 3 轮完整修复
> **基准**: v17.6 永久锁 + 人类使用习惯

---

## 0. 依赖关系

```
R149(P0代码修复)
  ↓
R150(P1路由+UX)
  ↓
R151(P2打磨+架构)
```

---

## R149: 计费代码致命修复 — P0全部12项 (32h)

> 本轮修的是钱算错的 bug，不能等

| 🦐 | # | 任务 | 文件 | 工时 |
|---|----|------|------|------|
| **Claw(PM)** | 1 | **修复 fee-calculator.ts CreatorTier 费率** — 改为 5 类资产类型映射，删除 CreatorTier 旧 map | `electron/engine/data/fee-calculator.ts` | 2h |
| | 2 | **修复 auto-trade-billing-v2.ts** — 删除 taker/maker/stop 分离，统一按资产类型，加 `@deprecated` | `electron/engine/analysis/auto-trade-billing-v2.ts` | 2h |
| | 3 | **加最低手续费 floor** — `Math.max(fee, minFee)` 到 fee-calculator 和 trade-detail | `fee-calculator.ts` + `trade-detail.ts` | 1h |
| | 11 | **修复 ta-billing.ts SQL bug** — 6 占位符 5 参数 | `server/services/ta-billing.ts` | 1h |
| **JVS(引擎)** | 5 | **修复 fee-calculator-v2.ts AI 价格** — 删除 `ai_call: 0.009` channel，AI 走 ai-billing.ts | `server/services/fee-calculator-v2.ts` | 2h |
| | 6 | **修复 tip.ts 等级条件** — minSubscribers→minTotalSales，100/1000 | `server/services/tip.ts` | 2h |
| | 12 | **解决 tip.ts vs creator-level.ts 冲突** — 统一到 creator-level.ts，tip.ts 调用它 | `tip.ts` + `creator-level.ts` | 2h |
| | 10 | **标记旧引擎为 deprecated** — auto-trade-billing-v2.ts + ai-usage-billing-contract.ts | `electron/engine/` | 1h |
| **ML(前端)** | 4 | **删除 AIBillingPanel freeRemaining** — 移除所有 free 逻辑，改纯按次显示 | `src/components/billing/ai/AIBillingPanel.tsx` | 3h |
| | 7 | **修复 PointsTopUpPage 法币违规** — 删除法币入口，加 @deprecated 标记 | `src/components/billing/` | 1h |
| | 8 | **统一新旧钱包为 WalletFullPage** — 标记旧 billing/wallet 为 @deprecated | `src/components/wallet/` | 3h |
| **QClaw(文档)** | — | **重写 fee-schedule.md → v17.6** — 消除 10+ 处冲突 | `docs/reference/fee-schedule.md` | 3h |
| | — | **更新所有过时文档标记** [DEPRECATED] | `docs/` | 2h |
| | — | **v17.6 变更日志** — 记录从 v15→v17.6 所有变更 | `docs/design/v17.6-changelog.md` | 2h |
| **youdao(测试)** | 1-12 | **P0 全量回归测试** — 费率/最低费/等级/免费轮违规全覆盖 | `tests/billing-p0-regression/` | 4h |
| | — | **ta-billing.ts SQL 验证** — 修复后跑全量 TA 扣费测试 | `tests/ta-billing/` | 2h |
| | — | **creator-level 一致性测试** — tip.ts 和 creator-level.ts 统一后验证 | `tests/creator-level/` | 2h |

---

## R150: 路由接入+用户体验关键修复 — P0路由+P1全部10项 (28h)

> 本轮让用户能"找到钱包"且"钱花得明白"

| 🦐 | # | 任务 | 文件 | 工时 |
|---|----|------|------|------|
| **ML(前端)** | 9 | **新增 wallet 路由到 Sidebar** — SidebarView 类型 + App.tsx lazy import | `src/App.tsx` + `src/components/layout/` | 2h |
| | 13 | **余额检查前置** — 点击购买/AI→先查余额→不足引导充值 | 全局 interceptor | 2h |
| | 14 | **扣费轻量反馈 Toast** — "已扣 X USDT" 2秒消失，可点查看详情 | `src/components/billing/core/FeeDeductionToast.tsx` | 2h |
| | 15 | **FeePreview 组件** — 所有下单入口统一显示预估手续费 | `src/components/billing/core/FeePreview.tsx` | 2h |
| | 16 | **余额不足补救路径** — "还差 X USDT" + 一键跳转充值 | 全局 Modal | 1h |
| **Claw(PM)** | 17 | **提现费用预览** — WithdrawPanel 加实时 fee 计算 | `src/components/wallet/WalletFullPage.tsx` | 1h |
| | 18 | **打赏抽成实时预览** — 选金额→自动查等级→显示平台抽+创作者到手 | `src/components/wallet/WalletFullPage.tsx` | 2h |
| | 20 | **打赏等级自动查询** — 替换手动 Select 为自动调 API | `WalletFullPage.tsx` | 1h |
| | 23 | **合并 WalletPage + WalletFullPage** — 单一完整入口 | `src/components/wallet/` | 2h |
| **JVS(引擎)** | 19 | **移除 3 文件 @ts-nocheck** — 修复所有 TSC 错误 | `billing-service.ts` + `fee-calculator-v2.ts` + `tip.ts` | 3h |
| | 21 | **确认转账最低费** — 若保留则文档化，若删除则改代码 | `fee-calculator-v2.ts` | 1h |
| | 19 | **充值地址服务端化** — API `GET /api/wallet/deposit-address/:userId` | `server/routes/wallet.ts` | 2h |
| **QClaw(文档)** | — | **用户首次使用引导文档** — 钱包/市场/AI 三步上手 | `docs/user-guide-first-time.md` | 3h |
| **youdao(测试)** | — | **P1 全量 E2E** — 路由可达+扣费反馈+余额不足路径 | `tests/e2e-p1/` | 4h |
| | — | **@ts-nocheck 移除后 TSC 验证** | `tests/tsc/` | 1h |

---

## R151: 架构统一+打磨提升 — P2全部9项 (22h)

> 本轮清理遗留代码+提升用户体验细节

| 🦐 | # | 任务 | 文件 | 工时 |
|---|----|------|------|------|
| **Claw(PM)** | 24 | **统一三套计费系统** — v1 删除，v2→v17.6，所有扣费走 billing-service | `electron/engine/` + `server/services/` | 3h |
| | 29 | **修复提现分拆绕过冷钱包** — 加同用户24h窗口累计检查 | `server/services/risk-engine.ts` | 1h |
| | 31 | **统一费率数据源** — 创建 `src/constants/fees.ts` | `src/constants/fees.ts` | 1h |
| **ML(前端)** | 25 | **AI 画线接扣费** — AIDrawingPatternPanel 点击前调 billing | `src/components/billing/ai/AIDrawingPatternPanel.tsx` | 2h |
| | 26 | **信号订阅续费提醒 UI** — 到期前 24h 弹窗+自动续费 toggle | `src/components/wallet/MarketplaceHub.tsx` | 2h |
| | 27 | **创作者等级进度条** — "还差 53 笔到 L2" + 进度条 | `src/components/wallet/CreatorDashboard.tsx` | 1h |
| | 30 | **退款视觉反馈** — 绿色动效+余额更新+"为什么会退费?" | `src/components/` | 1h |
| **JVS(引擎)** | 28 | **月度消费报告 API** — `GET /api/wallet/report/:userId/:month` | `server/routes/wallet.ts` | 2h |
| | — | **AI 健康检查 cron** — 每日自动跑 | `server/services/ai-workflow.ts` | 1h |
| **QClaw(文档)** | — | **最终用户手册更新** — 整合 R149-R151 所有变更 | `docs/user-manual.md` | 2h |
| **youdao(测试)** | — | **P2 全量回归** — 冷钱包绕过+统一系统+月度报告 | `tests/e2e-p2/` | 3h |
| | — | **最终 31 项验证清单** — 逐项打勾确认 | `tests/final-31-check/` | 2h |

---

## 工时汇总

| 轮次 | 主题 | 工时 | 修复项 | 关键交付 |
|------|------|------|--------|---------|
| R149 | 致命代码修复 | 32h | P0:1-12 (12项) | 费率正确/等级修复/SQL修复/AI价格 |
| R150 | 路由+UX修复 | 28h | P0:4,8,9 + P1:13-22 (13项) | 钱包可访问/扣费有反馈/费用可预览 |
| R151 | 打磨+架构 | 22h | P2:23-31 (9项) | 统一系统/冷钱包防绕过/月度报告 |
| **合计** | | **82h** | **31项全部** | |

每虾每轮: ~5-8h → 3-5 个 production-ready 任务 ✅

---

## 每虾总工时

| 🦐 | R149 | R150 | R151 | 合计 |
|---|------|------|------|------|
| Claw(PM) | 6h | 6h | 5h | 17h |
| JVS(引擎) | 7h | 6h | 3h | 16h |
| ML(前端) | 7h | 9h | 6h | 22h |
| QClaw(文档) | 7h | 3h | 2h | 12h |
| youdao(测试) | 8h | 5h | 5h | 18h |

---

## 验收标准

| 标准 | 目标 |
|------|------|
| 费率代码与 v17.6 100% 一致 | 所有 fee 文件无旧版值 |
| 钱包路由可访问 | Sidebar 有 Wallet 入口 |
| 扣费有反馈 | 每次扣费有 Toast + 可查明细 |
| 旧引擎标记 @deprecated | v1/v2 不再被引用 |
| @ts-nocheck 从计费文件移除 | billing-service/tip/fee-calculator-v2 |
| TSC: 0 error | 全项目 |
| 测试全 pass | 31 项每人验证 |

---

*方案制定: Claw (PM/64001) | 2026-06-13*
