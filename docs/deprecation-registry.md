# 🔖 过时文档注册表

> **创建**: 2026-06-13 | **维护**: QClaw | **用途**: 记录所有已被 v17.6 取代的文档

---

## 已标记 [DEPRECATED] 的文档

| # | 文件 | 废弃原因 | 替代文档 |
|---|------|---------|---------|
| 1 | `docs/reference/fee-schedule.md` | v1.11.0 费率表 (taker/maker/stop) | `docs/reference/fee-schedule.md` (已重写为 v17.6) |
| 2 | `docs/guides/ai-pricing-guide.md` | taker/maker/stop 费率 + 免费 AI + 辩论/竞技场 | `docs/reference/fee-schedule.md` + `docs/design/ai-billing-rules.md` |
| 3 | `docs/user-manual-v1.9.0-ga.md` | 旧版用户手册 (辩论附加费, 订阅者升级) | `docs/user-manual.md` (v2.1.0) |

## 确认仍为历史参考的文档（保留但不再更新）

以下文档引用了旧版本号或旧模型，但作为项目历史记录保留:

| 文件 | 状态 |
|------|------|
| `docs/proposals/r128-q01-changelog-v2.0.0.md` | 历史 CHANGELOG |
| `docs/proposals/r136-q01-changelog-v2.1.0.md` | 历史 CHANGELOG |
| `docs/quality/v1.11.0-quality-report.md` | 历史质量报告 |
| `docs/quality/v1.12.0-audit.md` | 历史审计 |
| `docs/retrospective/r89-r101-complete.md` | 历史复盘 |
| `docs/release/v1.10.0.md` | 历史发布 |
| `docs/roadmap/v1.10.0-roadmap-r89-r94.md` | 历史路线图 |
| `docs/plans/R91-R94-master-plan.md` | 历史计划 |
| `docs/api/broker-*.md` | 引用旧版本号的 API 文档 |

## 已确认废弃的代码文件（应标记 @deprecated）

| 文件 | 原因 | 替代 |
|------|------|------|
| `electron/engine/analysis/auto-trade-billing-v2.ts` | taker/maker/stop 分离 + Futu免费 | `server/services/fee-calculator-v2.ts` |
| `electron/engine/agents/ai-usage-billing-contract.ts` | 免费轮/月费上限/辩论附加费/竞技场 | `server/services/ai-billing.ts` |
| `electron/engine/analysis/billing-wallet-server.ts` | 旧版钱包 | `server/services/billing-service.ts` |

---

> 此注册表在每次发现过时文档/代码时更新。
> 标记 [DEPRECATED] 的文档在顶部有醒目标识 + 替代文档链接。
