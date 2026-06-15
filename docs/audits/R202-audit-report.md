# 🦐 R202 审计报告 — AI信号推送引擎+每日因子简报+推送管线

> **PM Claw** | 2026-06-15 R202 | Phase 1 第一轮
> **状态**: 🟡 启动审计 | **上一轮**: R201 | **下一轮**: R203 (等Owner通知)

---

## 1. R201 完成状态验收

### R201 交付物检查

| # | 虾 | 交付物 | 文件 | 行数 | Commit | 验收 |
|---|---|--------|------|:----:|--------|:----:|
| 1 | 🦐 JVS | StrategyMatchEngine | `server/services/StrategyMatchEngine.ts` | 383L | 204b97e3 | ✅ 持仓→3推荐→1U |
| 2 | 🦐 JVS | MarketStateEngine | `server/services/MarketStateEngine.ts` | 301L | 204b97e3 | ✅ 4态→场景包→1U |
| 3 | 🦐 JVS | AIDegradationChain | `server/services/AIDegradationChain.ts` | 284L | 204b97e3 | ✅ 4级+30s+用户1U |
| 4 | 🦐 ML | BillingCard×7 | `src/components/wallet/BillingCard.tsx` | ~192L | 00c6286f | ✅ 7卡片+9语言 |
| 5 | 🦐 ML | WeeklyRankingPage | `src/components/wallet/WeeklyRankingPage.tsx` | ~480L | 00c6286f | ✅ Top20+3级入口 |
| 6 | 🦐 autoclaw | Pipeline文档 | `docs/design/strategy-match-pipeline-R201.md` | 9.9KB | — | ✅ 8节完整 |
| 7 | 🦐 QClaw | 7话术×9语言 | `docs/design/ai-services-user-copy-r201-q07.md` | ~300L | a941063f | ✅ 504条目 |
| 8 | 🦐 youdao | E2E测试 | — | — | — | ⏳ R202继续 |

### R201 验收标准

| 标准 | 状态 | 说明 |
|------|:----:|------|
| 策略匹配: 持仓→3推荐模板→扣1U | ✅ | StrategyMatchEngine 12模板+因子画像 |
| 市场状态: 4态分类→场景推荐→扣1U | ✅ | MarketStateEngine 9信号+8场景包 |
| 降级链: 4级+30s超时+用户始终付1U | ✅ | AIDegradationChain V4Pro折→原→Flash→MiniMax |
| 7 AI卡片+龙虎榜免费周报+9语言i18n | ✅ | BillingCard.tsx + WeeklyRankingPage.tsx |
| 完整管线: 点击→扣费→AI→渲染 | ✅ | autoclaw pipeline文档8节 |
| E2E≥14个测试 | ⏳ | youdao R202继续 |

---

## 2. R202 任务分配确认

| # | 虾 | 任务 | 工时 | 状态 |
|---|---|------|:----:|:----:|
| 1 | 🦐 JVS | AI因子信号推送引擎(SignalPushEngine) | 8h | ⏳ |
| 2 | 🦐 JVS | AI每日因子简报引擎(DailyBriefingEngine) | 6h | ⏳ |
| 3 | 🦐 ML | AI每日简报UI(DailyBriefingCard) | 5h | ⏳ |
| 4 | 🦐 ML | AI信号推送通知组件(SignalPushPopup) | 5h | ⏳ |
| 5 | 🦐 autoclaw | 因子信号→推送→计费完整管线 | 4h | ⏳ |
| 6 | 🦐 QClaw | 信号推送+简报用户话术 | 2h | ⏳ |
| 7 | 🦐 youdao | 推送/简报/降级链集成测试 | 6h | ⏳ |
| 8 | 🦐 Claw | R202审计+chat-bridge广播 | 2h | ✅ 进行中 |

---

## 3. R202 代码差距分析

### 3.1 SignalPushEngine.ts — ❌ 不存在 (JVS#1)

**需新建**。设计要点:

| 要素 | 规格 |
|------|------|
| 输入 | 因子IC值变化事件 (factorId, symbol, prevIC, currentIC, threshold) |
| 触发规则 | 因子IC突破阈值(如IC从负→正或IC变化>0.05) |
| 推送队列 | 优先级队列 + 去重(同因子+同资产1h内不重推) |
| 限频 | ≤50条/用户/日 |
| 吞吐 | 100条/秒不丢 |
| 计费 | `AI_FACTOR_SIGNAL_PUSH`, 0.5U/条, 批量扣费 |
| 降级 | 通过R201 AIDegradationChain调用DeepSeek |
| 输出 | `SignalPushResult { signalId, factorId, symbol, direction, ic, message, costUSDT: 0.5 }` |

**可复用**:
- `AIDegradationChain.ts` (4级降级+用户1U)
- `factor-billing-gateway.ts` 已有 `AI_FACTOR_SIGNAL_PUSH`(0.5U) 触点配置
- `billing-service.ts` hold/settle/refund 管道

**难点🔴**:
- 100条/秒吞吐要求 → 需要内存队列+批量flush，不可逐条DB写入
- 批量计费0.5U/条 → 需要按批扣费而非逐条扣费
- 去重窗口1h → 需要滑动窗口数据结构

### 3.2 DailyBriefingEngine.ts — ❌ 不存在 (JVS#2)

**需新建**。设计要点:

| 要素 | 规格 |
|------|------|
| 输入 | 用户订阅+因子IC数据(日更) |
| 生成 | Top5因子IC排名 + 异常检测(IC突变>2σ) + DeepSeek市场建议 |
| 频率 | 每天1次(用户订阅后自动生成) |
| 计费 | `AI_DAILY_BRIEFING`, 1U/次 |
| 降级 | 通过AIDegradationChain调用DeepSeek |
| 输出 | `DailyBriefingResult { date, topFactors, anomalies, aiInsight, costUSDT: 1 }` |

**可复用**:
- `MarketStateEngine.ts` (R201 J2, 市场状态判断)
- `factor-billing-gateway.ts` 已有 `AI_DAILY_BRIEFING`(1U) 触点配置
- `AIDegradationChain.ts` (4级降级)

**难点🟡**:
- DeepSeek prompt设计: 需要将Top5 IC+异常→自然语言市场建议
- 异常检测算法: 2σ阈值是否合适？需考虑因子IC分布特性

### 3.3 DailyBriefingCard.tsx — ❌ 不存在 (ML#3)

**需新建**。设计要点:
- 简报卡片: 日期+Top5因子IC+异常标记+AI建议摘要
- 订阅开关: 开→每天1U自动扣费
- 历史查看: 7天/30天简报历史
- 7天趋势图: IC排名变化mini chart
- 可复用: BillingCard.tsx (R201 ML) 的卡片模式 + FeeDeductionToastV3 (R200)

### 3.4 SignalPushPopup.tsx — ❌ 不存在 (ML#4)

**需新建**。设计要点:
- 实时弹窗: 因子名+符号+方向+IC值+0.5U标签
- 一键下单: 从弹窗直接下单(需API Key, R211才完整)
- 历史列表: 已接收推送历史+已读标记
- 可复用: antd Notification API + BillingCard计费模式

### 3.5 SignalPushPipeline — ❌ 不存在 (autoclaw#5)

**需新建**。桥接链路:
```
因子IC计算 → 阈值触发 → SignalPushEngine.enqueue() → 推送队列
→ 批量计费0.5U/条(billing-service.hold→settle) → 通知前端
→ 一键下单 → 执行服务费(ExecutionFeeEngine) → 完整闭环
```

---

## 4. 前置代码审计 (R202关键依赖)

### 4.1 factor-billing-gateway.ts — ✅ 已有23触点

R202相关触点已存在:

| 触点 | 价格 | freeUses | refundWindow | 状态 |
|------|:----:|:--------:|:------------:|:----:|
| AI_FACTOR_SIGNAL_PUSH | 0.5U | 0 | 0h | ✅ JVS可直接用 |
| AI_DAILY_BRIEFING | 1U | 0 | 0h | ✅ JVS可直接用 |

**结论**: JVS无需在factor-billing-gateway中新增触点，直接引用即可。

### 4.2 ai-billing.ts — ⚠️ 仍只有4个AIServiceType

| 当前 | R202需求 | 差距 |
|------|---------|------|
| 4个 (DRAW_LINES/CHAT/PARAM_FILL/PATTERN_RECOG) | +2个 (SIGNAL_PUSH/DAILY_BRIEFING) | ❌ 需扩展 |

**建议**: JVS在R202#1/#2中扩展ai-billing.ts, 新增:
- `AI_SIGNAL_PUSH` (0.5U/条)
- `AI_DAILY_BRIEFING` (1U/次)

> 注意: ai-billing.ts 和 factor-billing-gateway.ts 是两套独立计费系统。前者是server-side管道, 后者是electron-side管道。R202的推送/简报引擎在server端, 应扩展ai-billing.ts。

### 4.3 AIDegradationChain.ts (R201) — ✅ 4级降级已就绪

R202 JVS#1/#2 直接复用, 无需修改。接口:
```typescript
degrade<T>(prompt: string, options?: DegradationOptions): Promise<DegradationResult<T>>
```

### 4.4 ai-orchestrator.ts — ⚠️ MODEL_CHAIN仍3级

R201 JVS新建了AIDegradationChain.ts(4级), 但ai-orchestrator.ts中的MODEL_CHAIN仍为3级硬编码。
- R202引擎应直接使用AIDegradationChain, 绕过ai-orchestrator的MODEL_CHAIN
- 或JVS同步更新ai-orchestrator.ts中的MODEL_CHAIN为4级

**建议**: R202引擎直接调用 `AIDegradationChain.degrade()`, 不经过 `AIOrchestrator.executeAI()`, 因为后者仍是3级链。

### 4.5 BillingCard.tsx (R201) — ✅ 可复用

ML R202#3/#4 可复用BillingCard的:
- 静默扣费流程 (4-state: idle→loading→done/error)
- 9语言i18n (BI18N对象)
- 余额检查 + 不足警告
- compact模式

---

## 5. 依赖关系与执行顺序

```
🥇 JVS#1 SignalPushEngine (8h) ←─ 独立, 基于AIDegradationChain
🥇 JVS#2 DailyBriefingEngine (6h) ←─ 独立, 基于AIDegradationChain+MarketStateEngine
🥇 QClaw#6 用户话术 (2h) ←─ 独立
🥇 ML#3 DailyBriefingCard (5h) ←─ 可先mock, 后接IPC
🥇 ML#4 SignalPushPopup (5h) ←─ 可先mock, 后接IPC
🥉 autoclaw#5 SignalPushPipeline (4h) ←─ 等JVS#1完成
🏁 youdao#7 集成测试 (6h) ←─ 等JVS#1+#2完成
```

---

## 6. R202 验收标准对照

| # | 验收标准 | 对应任务 | 前置依赖 | 当前状态 |
|---|---------|---------|---------|:--------:|
| 1 | 信号推送: IC触发→弹窗→0.5U/条→一键下单→执行服务费 | JVS#1+ML#4+autoclaw#5 | ai-billing扩展 | ❌ |
| 2 | 每日简报: 每天1U→Top5+异常+建议→DeepSeek生成 | JVS#2+ML#3 | ai-billing扩展 | ❌ |
| 3 | 推送队列: 100条/秒不丢+去重+限频50条/日 | JVS#1 | 无 | ❌ |
| 4 | 降级链正常: 4级降级(V4Pro折→原→Flash→MiniMax) | 继承R201 | AIDegradationChain | ✅ |

---

## 7. 风险与建议

| 风险 | 级别 | 建议 |
|------|:----:|------|
| 100条/秒吞吐+批量计费0.5U/条实现复杂 | 🔴 高 | JVS#1优先实现内存队列+定时flush(每5s), 批量hold→settle; P0先确保不丢, 性能可后续优化 |
| ai-billing.ts 4→6 AIServiceType需同步 | 🟡 中 | JVS在R202#1/#2中扩展, 新增SIGNAL_PUSH+DAILY_BRIEFING |
| ai-orchestrator.ts MODEL_CHAIN仍3级 | 🟡 中 | R202引擎直接调用AIDegradationChain, 绕过ai-orchestrator; 后续统一 |
| SignalPushPopup一键下单需API Key(R211) | 🟢 低 | R202只做UI+事件触发, 下单功能标记"即将支持" |
| youdao R201 E2E测试未完成 | 🟡 中 | R202#7一起补R201+R202测试 |

---

## 8. R201→R202 差距摘要

| 文件 | R201状态 | R202变化 |
|------|---------|---------|
| SignalPushEngine.ts | ❌ 不存在 | 🆕 JVS#1 新建 (8h) |
| DailyBriefingEngine.ts | ❌ 不存在 | 🆕 JVS#2 新建 (6h) |
| DailyBriefingCard.tsx | ❌ 不存在 | 🆕 ML#3 新建 (5h) |
| SignalPushPopup.tsx | ❌ 不存在 | 🆕 ML#4 新建 (5h) |
| SignalPushPipeline | ❌ 不存在 | 🆕 autoclaw#5 新建 (4h) |
| ai-billing.ts | ⚠️ 4 AIServiceType | 📝 +2个 (SIGNAL_PUSH+DAILY_BRIEFING) |
| factor-billing-gateway.ts | ✅ 23触点含#18+#20 | ✅ 无变化, 直接引用 |
| AIDegradationChain.ts | ✅ R201完成4级 | ✅ 复用, 无变化 |
| StrategyMatchEngine.ts | ✅ R201完成383L | ✅ 无变化 |
| MarketStateEngine.ts | ✅ R201完成301L | ✅ JVS#2可引用(市场状态) |
| BillingCard.tsx | ✅ R201完成 | ✅ ML复用卡片模式 |
| WeeklyRankingPage.tsx | ✅ R201完成 | ✅ 无变化 |

---

*PM Claw | 2026-06-15 R202 审计报告*
