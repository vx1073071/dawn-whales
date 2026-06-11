<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: QClaw
purpose: (auto-generated, needs review)
-->

# i18n 硬编码中文最终统计报告

**扫描时间**: 2026-06-10 | **轮次**: R88 | **基线目标**: <10000

---

## 总览

| 区域 | CN chars | 文件数 | 占比 |
|------|:---:|:---:|:---:|
| `src/` (前端) | 6,417 | 162 | 47% |
| `electron/` (引擎) | 7,152 | 205 | 53% |
| **合计** | **13,569** | **367** | 100% |

对比: R87 基线 ~15,963 → R88 当前 **13,569** (-15%)

---

## Top 15 文件

| # | 文件 | CN | 类型 |
|---|------|:---:|------|
| 1 | `electron/engine/analysis/technical-indicators.ts` | 630 | 技术指标标签 |
| 2 | `electron/engine/portfolio/rebalance-engine.ts` | 461 | 再平衡日志 |
| 3 | `electron/engine/agents/nl-parser.ts` | 446 | NL解析模板 |
| 4 | `src/components/billing/onboarding/OnboardingFullKit.tsx` | 284 | 引导文案 |
| 5 | `electron/engine/analysis/strategy-templates.ts` | 280 | 策略描述 |
| 6 | `electron/engine/agents/nlp-sentiment-engine.ts` | 235 | 情绪词典 |
| 7 | `src/components/billing/core/LandingPageV18.tsx` | 231 | 落地页营销 |
| 8 | `src/components/billing/core/HelpCenter.tsx` | 211 | FAQ内容 |
| 9 | `electron/engine/risk/risk-engine.ts` | 198 | 风控标签 |
| 10 | `electron/engine/core/i18n-engine.ts` | 192 | i18n引擎本身 |
| 11 | `electron/data/marketplace-service.ts` | 174 | 市场数据 |
| 12 | `src/components/dashboard/AIDailyDigestPanel.tsx` | 162 | AI日报 |
| 13 | `electron/data/data-provider.ts` | 140 | 数据提供 |
| 14 | `src/components/ai/AIAssistantPanel.tsx` | 137 | AI助手 |
| 15 | `electron/engine/agents/ai-report-generator.ts` | 132 | AI报告 |

---

## 分类分析

| 类别 | CN chars | 占比 | 迁移复杂度 |
|------|:---:|:---:|:---:|
| 策略模板文案 | ~2,500 | 18% | 🔴 高 (数据逻辑) |
| 技术指标标签 | ~1,800 | 13% | 🔴 高 (算法输出) |
| UI文案/引导 | ~3,500 | 26% | 🟡 中 (可t()) |
| 情绪/关键词词典 | ~1,500 | 11% | 🔴 高 (内置词典) |
| 日志/错误消息 | ~2,000 | 15% | 🟢 低 (应英文化) |
| Mock/演示数据 | ~2,269 | 17% | 🟢 低 (可删除) |

---

## 建议

1. **日志/错误消息** (~2,000): 直接英文化，不经过 i18n
2. **Mock/演示数据** (~2,269): 删除或标记为 dev-only
3. **UI文案/引导** (~3,500): 使用 t() 迁移
4. **策略/指标/词典** (~5,800): 保留原样 (算法数据，非 UI)

**可实现硬编码中文 <10000** (移除日志+Mock后 ~9,300)

---

**R88 最终统计: 13,569 CN chars**
