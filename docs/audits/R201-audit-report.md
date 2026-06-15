# 🦐 R201 审计报告 — AI策略匹配+市场状态+降级链+7AI卡片+龙虎榜周报

> **PM Claw** | 2026-06-15 R201 | Phase 0 第二轮
> **状态**: 🟡 启动审计 | **上一轮**: R200 | **下一轮**: R202 (等Owner通知)

---

## 1. R201 任务分配确认

| # | 虾 | 任务 | 工时 | 状态 |
|---|---|------|:----:|:----:|
| 1 | 🦐 JVS | AI策略匹配引擎(StrategyMatchEngine) | 6h | ⏳ 待认领 |
| 2 | 🦐 JVS | AI市场状态引擎(MarketStateEngine) | 5h | ⏳ 待认领 |
| 3 | 🦐 JVS | 降级链重构(AIDegradationChain) 4级 | 4h | ⏳ 待认领 |
| 4 | 🦐 ML | 7新AI计费卡片组件(BillingCard×7) | 5h | ⏳ 待认领 |
| 5 | 🦐 ML | 龙虎榜免费周报UI(WeeklyRankingPage) | 4h | ⏳ 待认领 |
| 6 | 🦐 autoclaw | AI策略匹配→计费管线桥接 | 3h | ⏳ 待认领 |
| 7 | 🦐 QClaw | 7新AI功能用户话术 | 2h | ⏳ 待认领 |
| 8 | 🦐 youdao | 降级链+2引擎E2E测试 | 5h | ⏳ 待认领 |
| 9 | 🦐 Claw | R201审计+chat-bridge广播 | 2h | ✅ 进行中 |

---

## 2. R200 完成状态继承

| 虾 | R200交付物 | 状态 | R201影响 |
|---|-----------|:----:|---------|
| JVS | billing-service.ts 3 EntryType + ExecutionFeeEngine(246L) + CreatorReviewBilling(218L) | ✅ 完成 | R201#3降级链需引用billing-service |
| ML | WalletBalanceBar(~400L) + FeeDeductionToastV3(~290L) | ✅ 完成 | R201#4计费卡片复用WalletBalanceBar |
| autoclaw | 收费目录txt + wallet-architecture.md | ⚠️ 需确认 | R201#6管线桥接需wallet-architecture |
| QClaw | R200话术(心跳补发后) | ⚠️ 补发完成 | R201#7继续7新话术 |
| youdao | 服务端计费管道E2E测试 | ⏳ 进行中 | R201#8继续E2E |
| Claw | R200审计+广播 | ✅ 完成 | R201#9本审计 |

---

## 3. 现有代码深度审计 (R201起点)

### 3.1 ai-fallback.ts — ⚠️ 需3级→4级升级

| 审计项 | 当前值 | R201需求 | 差距 |
|--------|--------|---------|------|
| MODEL_REGISTRY 条目 | 3个 (V4Pro/V4Flash/MiniMax) | 4个 (+V4Pro原价档) | ❌ 缺1个 |
| AIModelId 类型 | 3值联合类型 | 4值联合类型 | ❌ 需扩展 |
| 降级链顺序 | V4Pro→V4Flash→MiniMax | V4Pro(折)→V4Pro(原)→V4Flash→MiniMax | ❌ 需重构 |
| 平台差价承担 | 无逻辑 | 平台承担降级差价 | ❌ 需新增 |
| 用户收费 | 无差异化 | 用户始终付1U不管降级到哪 | ❌ 需锁定 |
| 超时 | 30s(V4Pro/MiniMax) 15s(Flash) | 30s统一 | ⚠️ Flash仅15s |
| 冷却机制 | MAX_FAILURES=5, COOLDOWN_MS=60s | 保持不变 | ✅ 合规 |
| 错误分类 | classifyError() 已有 | 保持不变 | ✅ 合规 |

**关键差距**:
- 当前 `AIModelId = 'deepseek-v4-pro' | 'deepseek-v4-flash' | 'minimax-m3'` — 只有3个
- 需要新增 `'deepseek-v4-pro-full'` 作为优先级1（原价档），插入到 V4Pro(折,p=0) 和 V4Flash(p=1) 之间
- 升级后: V4Pro(折,p=0) → V4Pro(原,p=1) → V4Flash(快,p=2) → MiniMax(p=3)

**JVS#3 行动项**:
1. 扩展 `AIModelId` 为4值联合类型
2. 在 `MODEL_REGISTRY` 中插入 `deepseek-v4-pro-full` (priority: 1, costPer1KTokens: 0.0015)
3. 新建 `AIDegradationChain.ts` 从 ai-fallback.ts 重构
4. 实现平台差价承担逻辑（用户付1U，实际模型成本差由平台吃）

### 3.2 ai-billing.ts — ⚠️ 需4→22 AIServiceType

| 审计项 | 当前值 | R201需求 | 差距 |
|--------|--------|---------|------|
| AIServiceType 枚举 | 4个 (DRAW_LINES/CHAT/PARAM_FILL/PATTERN_RECOG) | 22个 | ❌ 缺18个 |
| AI_PRICE_TABLE | 4项，全部1U | 22项差异化 | ❌ 需大量扩展 |
| customPriceUSDT | 已支持 | 保持 | ✅ 合规 |
| idempotencyKey | 已支持 | 保持 | ✅ 合规 |
| AIBillRequest | 已完善 | 需扩展serviceType | ⚠️ 类型需扩展 |
| AIBillResult | 已完善 | 保持 | ✅ 合规 |

**v17.9 完整22项 AIServiceType 清单**:

| # | ServiceType | 价格 | 已有? | R201新增? |
|---|------------|:----:|:-----:|:---------:|
| 1 | AI_DRAW_LINES | 1U | ✅ | — |
| 2 | AI_CHAT | 1U | ✅ | — |
| 3 | AI_PARAM_FILL | 1U | ✅ | — |
| 4 | AI_PATTERN_RECOG | 1U | ✅ | — |
| 5 | AI_STRATEGY_MATCH | 1U | ❌ | ✅ R201#1 |
| 6 | AI_MARKET_STATE | 1U | ❌ | ✅ R201#2 |
| 7 | AI_GENERATE_COMBO | 2U | ❌ | R202 |
| 8 | AI_BACKTEST_READ | 1U | ❌ | R202 |
| 9 | AI_OPTIMIZE_SUGGEST | 1.5U | ❌ | R202 |
| 10 | AI_HEALTH_CHECK | 1U | ❌ | R202 |
| 11 | TA_STANDARD | 1U | ❌ | R203 |
| 12 | TA_ADVANCED | 1.5U | ❌ | R203 |
| 13 | TA_FLAGSHIP | 2U | ❌ | R203 |
| 14 | AI_MULTI_FACTOR_BACKTEST | 1U | ❌ | R204 |
| 15 | AI_FACTOR_DIAGNOSIS | 1U | ❌ | R204 |
| 16 | AI_FACTOR_OPTIMIZE | 1.5U | ❌ | R204 |
| 17 | AI_ALT_DATA_UNLOCK | 2U | ❌ | R204 |
| 18 | DAILY_BRIEF_AI | 1U | ❌ | R206 |
| 19 | ARBITRAGE_SCAN | 1U | ❌ | R206 |
| 20 | SIGNAL_PUSH_AI | 0.5U | ❌ | R206 |
| 21 | STRESS_TEST_AI | 1U | ❌ | R207 |
| 22 | ATTRIBUTION_AI | 1U | ❌ | R207 |

**R201 最小扩展** (JVS#1/#2需新增的2个ServiceType):
```typescript
AI_STRATEGY_MATCH = 'AI_STRATEGY_MATCH'   // 1U — 策略匹配引擎
AI_MARKET_STATE = 'AI_MARKET_STATE'       // 1U — 市场状态引擎
```

> **建议**: JVS 在 R201 中仅新增 #5/#6 两个 AIServiceType。22项完整扩展在 R202-R207 各轮逐步添加，避免一次性改太大出问题。

### 3.3 ai-orchestrator.ts — ⚠️ 降级链需对齐4级

| 审计项 | 当前值 | R201需求 | 差距 |
|--------|--------|---------|------|
| MODEL_CHAIN | 3级 (V4Pro→V4Flash→MiniMax) | 4级 | ❌ 需扩展 |
| AIModel 类型 | 3值 | 4值 | ❌ 需扩展 |
| executeAI() 管道 | bill→validate→fallback→refund | 保持 | ✅ 合规 |
| token 限制 | 4K input | 保持 | ✅ 合规 |
| 超时 | 30s per model | 保持 | ✅ 合规 |
| customPrice | 已支持 | 保持 | ✅ 合规 |
| drawlineCache | 1h TTL | 保持 | ✅ 合规 |
| 10项价格表(注释) | 已列出 | 需更新为14项 | ⚠️ 注释需更新 |

**关键问题**: `MODEL_CHAIN` 硬编码为3级数组，需要 JVS#3 在重构降级链时同步修改此文件。

### 3.4 StrategyMatchEngine.ts — ❌ 不存在 (JVS#1)

**需新建**。设计要点:
- 输入: 用户持仓数据(股票代码+数量+成本)
- 流程: 持仓分析 → 因子画像 → 模板库匹配 → DeepSeek对话精排 → 输出3推荐
- 计费: AI_STRATEGY_MATCH, 1U/次, 扣费→匹配→退费(失败)
- 依赖: ai-orchestrator.ts (执行AI调用) + billing-service.ts (扣费)
- 输出: `StrategyMatchResult { recommendations: StrategyTemplate[]; matchScore: number; reasoning: string }`

### 3.5 MarketStateEngine.ts — ❌ 不存在 (JVS#2)

**需新建**。设计要点:
- 输入: 市场数据(指数+成交量+波动率+板块轮动)
- 4态分类: 🐂牛市 / 🐻熊市 / ↔️震荡 / 😱恐慌
- 每态关联场景包推荐(策略模板+因子组合)
- 计费: AI_MARKET_STATE, 1U/次
- 输出: `MarketStateResult { state: 'bull'|'bear'|'sideways'|'panic'; confidence: number; scenePackage: ScenePackage }`

### 3.6 前端组件 — ❌ 7+1 不存在 (ML#4+#5)

| 组件 | 说明 | 依赖 |
|------|------|------|
| StrategyMatchBillingCard | "不知道选啥?AI帮你匹配" | ai-orchestrator IPC |
| MarketStateBillingCard | "市场啥状态?1U看透" | ai-orchestrator IPC |
| DailyBriefBillingCard | 每日简报AI摘要 | ai-orchestrator IPC |
| ArbitrageScanBillingCard | 套利扫描 | ai-orchestrator IPC |
| SignalPushBillingCard | 信号推送 | ai-orchestrator IPC |
| StressTestBillingCard | 压力测试AI | ai-orchestrator IPC |
| AttributionBillingCard | 绩效归因AI | ai-orchestrator IPC |
| WeeklyRankingPage | 龙虎榜免费周报 | 因子IC数据 |

**复用点**: ML 可复用 R200 的 WalletBalanceBar(余额展示) + FeeDeductionToastV3(静默扣款) 模式。

### 3.7 策略匹配管线 — ❌ 不存在 (autoclaw#6)

**需新建** `StrategyMatchPipeline.ts`，桥接:
1. 用户点击"AI策略匹配"按钮
2. → IPC到server
3. → ai-orchestrator.billAIService() 扣1U
4. → StrategyMatchEngine.match() 执行匹配
5. → 返回3推荐模板
6. → 前端渲染结果 + FeeDeductionToastV3展示扣费

---

## 4. R201 验收标准对照

| # | 验收标准 | 对应任务 | 前置依赖 | 当前状态 |
|---|---------|---------|---------|:--------:|
| 1 | 策略匹配: 持仓→3推荐模板+扣1U | JVS#1 | ai-billing扩展AI_STRATEGY_MATCH | ❌ |
| 2 | 市场状态: 4态分类+场景推荐+扣1U | JVS#2 | ai-billing扩展AI_MARKET_STATE | ❌ |
| 3 | 降级链: 4级+30s超时+用户始终付1U | JVS#3 | ai-fallback.ts重构 | ❌ |
| 4 | 7个BillingCard: 静默扣款+余额+9语言 | ML#4 | WalletBalanceBar+FeeDeductionToastV3 | ❌ |
| 5 | WeeklyRankingPage: Top20 IC+3级入口+免费 | ML#5 | 因子IC数据源 | ❌ |
| 6 | 管线桥接: 点击→扣1U→AI→渲染 完整链路 | autoclaw#6 | JVS#1+ML#4 | ❌ |
| 7 | 7条话术: ≤25字+9语言 | QClaw#7 | 无 | ❌ |
| 8 | ≥14个E2E测试: 4级降级+2引擎扣费 | youdao#8 | JVS#1+#2+#3 | ❌ |

---

## 5. 依赖关系图

```
JVS#3 (降级链4级) ←── 独立，无阻塞
JVS#1 (策略匹配) ←── 依赖: ai-billing扩展AI_STRATEGY_TYPE (JVS自做)
JVS#2 (市场状态) ←── 依赖: ai-billing扩展AI_MARKET_STATE (JVS自做)
ML#4  (7计费卡片) ←── 依赖: ai-orchestrator IPC定义 (可先mock)
ML#5  (龙虎榜周报) ←── 独立，无阻塞
autoclaw#6 (管线桥接) ←── 依赖: JVS#1 + ML#4 (最后做)
QClaw#7 (用户话术) ←── 独立，无阻塞
youdao#8 (E2E测试) ←── 依赖: JVS#1+#2+#3 (最后做)
```

**建议执行顺序**:
1. 🥇 JVS#3 (降级链) — 无依赖，立即开始
2. 🥇 ML#5 (龙虎榜) — 无依赖，立即开始
3. 🥇 QClaw#7 (话术) — 无依赖，立即开始
4. 🥈 JVS#1+#2 (2引擎) — 依赖ai-billing扩展，JVS自做
5. 🥈 ML#4 (7卡片) — 可先mock，后接IPC
6. 🥉 autoclaw#6 (管线桥接) — 等JVS#1+ML#4
7. 🏁 youdao#8 (E2E) — 等JVS全部完成

---

## 6. 风险与建议

| 风险 | 级别 | 建议 |
|------|:----:|------|
| ai-fallback.ts 3级→4级改动面大，影响ai-orchestrator.ts | 🔴 高 | JVS#3 先在新建的 AIDegradationChain.ts 中实现4级，保持 ai-fallback.ts 兼容，渐进替换 |
| ai-billing.ts 4→22 AIServiceType 一次性改完风险高 | 🟡 中 | R201仅新增2个(#5/#6)，其余18个在R202-R207逐步添加 |
| StrategyMatchEngine+MarketStateEngine 需DeepSeek Prompt设计 | 🔴 高 | JVS#1/#2 需设计专用system prompt + few-shot examples，不可只做空壳 |
| ML#4 7个卡片组件量大(5h) | 🟡 中 | 可先做2个核心(策略匹配+市场状态)，其余5个复用模板 |
| autoclaw#6 依赖JVS#1+ML#4完成 | 🟡 中 | 管线桥接排最后，等前序完成 |
| youdao#8 测试依赖全部引擎 | 🟢 低 | 正常流程，排最后无风险 |
| QClaw R200路由遗漏再犯 | 🟡 中 | PM已在本轮广播中明确QClaw任务#7，并要求认领回复READY |

---

## 7. R200→R201 差距摘要

| 文件 | R200状态 | R201变化 |
|------|---------|---------|
| ai-fallback.ts | ✅ 3级链存在 | ⚠️ 需重构为4级 |
| ai-billing.ts | ✅ 4 AIServiceType | ⚠️ 需新增2个(STRATEGY_MATCH/MARKET_STATE) |
| ai-orchestrator.ts | ✅ 管道存在 | ⚠️ MODEL_CHAIN需3→4 |
| billing-service.ts | ✅ R200已补全3 EntryType | ✅ 无变化 |
| ExecutionFeeEngine.ts | ✅ R200新建246L | ✅ 无变化 |
| CreatorReviewBilling.ts | ✅ R200新建218L | ✅ 无变化 |
| WalletBalanceBar.tsx | ✅ R200新建~400L | ✅ 复用 |
| FeeDeductionToastV3.tsx | ✅ R200新建~290L | ✅ 复用 |
| StrategyMatchEngine.ts | ❌ 不存在 | 🆕 JVS#1 新建 |
| MarketStateEngine.ts | ❌ 不存在 | 🆕 JVS#2 新建 |
| AIDegradationChain.ts | ❌ 不存在 | 🆕 JVS#3 从ai-fallback.ts重构 |
| BillingCard×7.tsx | ❌ 不存在 | 🆕 ML#4 新建 |
| WeeklyRankingPage.tsx | ❌ 不存在 | 🆕 ML#5 新建 |
| StrategyMatchPipeline.ts | ❌ 不存在 | 🆕 autoclaw#6 新建 |

---

## 8. R201 启动状态

- ✅ Chat-bridge R201广播已发送 (22:32)
- ✅ 审计报告已完成 (本文档)
- ⏳ 等待6虾认领回复 READY
- ⏳ R202及后续轮次等 Owner 通知启动
- ⚠️ R200遗留: autoclaw收费目录+wallet-architecture需确认, youdao E2E测试进行中

---

*PM Claw | 2026-06-15 R201 审计报告*
