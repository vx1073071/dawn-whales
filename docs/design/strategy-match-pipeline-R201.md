# AI策略匹配计费管道 — StrategyMatchPipeline v1.0

> **Round**: R201 | **Author**: autoclaw | **Date**: 2026-06-16
> **Status**: DESIGN DOCUMENT — 配合 JVS StrategyMatchEngine + ML BillingCardUI
> **Covers**: 3推荐模型 | 前置定价策略 | 费率不变式 | 管线图 | 降级链 | 计费契约

---

## 一、定价原则：前置固定价，平台扛波动

### 核心不变式

```
┌─────────────────────────────────────────────────────────────┐
│  🔒 用户价格: 永远 1U/次                                    │
│  🔒 无论底层跑哪个模型 (V4Pro/V4Flash/MiniMax)             │
│  🔒 无论降级到第几层 (1→4 始终 1U)                         │
│  🔒 无论实际 token 消耗多少 (4096→256 也 1U)               │
│  🔒 失败退费 (模型全部不可用 或 输出不可解析)              │
└─────────────────────────────────────────────────────────────┘
```

**为什么是"前置固定价"？**

| 维度 | 逻辑 |
|------|------|
| 🧠 **用户认知** | "AI帮我匹配策略=1U" — 一句话讲得清。没人想算"你用了多少token" |
| 💰 **平台承压** | 低成本模型时平台多赚，高成本时少赚 — 用户不受影响，平台平滑波动 |
| 📊 **降级透明** | 对用户永远"AI在帮你算" — 不知道/不需要知道具体哪个模型 |
| 🔧 **运营灵活** | 平台可以随时调模型组合，用户价格稳定，不影响留存 |

---

## 二、计费管线全图

```
┌─────────────────────────────────────────────────────────────────┐
│                    用户视角 (永远 1U)                            │
│                                                                  │
│  "我持有腾讯+美团+比亚迪"  →  点"AI帮我匹配策略"  →  1U扣了     │
│            ↓                                                    │
│  AI分析10秒  →  推荐"港股息防御组合(L1)" + "南向资金跟投(L2)"   │
│            ↓                                                    │
│  点了"采纳策略" → 白嫖不走交易=1U; 策略执行走#23再扣执行费       │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    计费管线 (系统视角)                           │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │ 1. 扣费          │ ← billAIService(userId, 'AI_STRATEGY_MATCH',│
│  │    attemptAccess  │           1.0, idempotencyKey)             │
│  │    检查余额       │                                           │
│  └────────┬─────────┘                                           │
│           │ ✅ 余额充足                                          │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ 2. 冻结          │ ← hold = { userId, touchpoint, sessionId, │
│  │    HOLD 1U        │     amount: 100, holdAt: now, status }    │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────┐           │
│  │ 3. AI 分析 (AIDegradationChain 4-tier)            │           │
│  │                                                    │           │
│  │  ┌──────────────────────────────┐                 │           │
│  │  │ Tier 1: DeepSeek V4 Pro (折) │ → ✅ 成功       │           │
│  │  │ Tier 2: DeepSeek V4 Pro (原) │ (跳过)          │           │
│  │  │ Tier 3: DeepSeek V4 Flash    │ (跳过)          │           │
│  │  │ Tier 4: MiniMax-M3           │ (跳过)          │           │
│  │  └──────────────────────────────┘                 │           │
│  │                                                    │           │
│  │  实际成本: $0.0003/token → $0.06 (1次调用)      │           │
│  │  用户付费: 1U = $1.00                              │           │
│  │  平台毛利: $0.94 (~94%)                            │           │
│  └─────────┬────────────────────────────────────────┘           │
│            │                                                      │
│            ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ 4. 结算          │ ← settle(sessionId)                        │
│  │    写审计日志     │    writeAudit({ touchpoint, amount, status })│
│  │    更新余额       │    deductBalance 1U                        │
│  └──────────────────┘                                           │
│                                                                  │
│  ✳️ 如果AI全部失败 → refund(sessionId) → 退1U                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、3个推荐模型与流程

### 模型1 — 持仓分析 (Portfolio Snapshot Scan)

```
输入: 用户当前持仓 (symbol + 仓位% + 成本价)
处理:
  1. 对每只持仓调用 factorCompute(symbol, 'SECTOR', 'PE_RATIO', 'MOMENTUM_12M', ...)
  2. 构建持仓画像: { 板块集中度, PE中位数, 动量中位数, 波动率中位数 }
  3. 诊断:
     - 板块集中度 > 70%→ "你70%在科技 = 科技跌20%你就凉→建议增加反周期仓位"
     - PE中位数 > 30 → "你买的都挺贵→建议看看低估值的"
     - 动量 < -0.1 → "你持仓在减速→可以考虑减仓信号"
输出: 持仓诊断报告 (3-5条问题 + 每个问题配1-2个推荐策略)
```

### 模型2 — 因子画像 (Factor Persona Matching)

```
输入: 用户交易偏好 (问卷/行为推断)
  - 风险承受: 低/中/高
  - 持有周期: 日内/周/月/季度
  - 偏好市场: HK/US/Crypto/JP/...
  - 偏好品类: 成长/价值/高息/动�/...

处理:
  1. 构建用户画像向量: [riskScore, holdPeriod, marketPreference, factorStyle]
  2. 遍历 298 因子库, 计算匹配度得分
     - 用户偏好"价值+长持+港股" → HK_PB_RATIO = 0.92, HK_DIVIDEND_YIELD = 0.88
     - 用户偏好"动量+短线+Crypto" → CRYPTO_MVRV_Z = 0.94, BTC_MOMENTUM_12M = 0.91
  3. 选 Top-5 匹配因子
  4. 对每个因子, 查找其所属的官方策略模板 (88个模板库)

输出: Top-3 策略推荐 (每种含: 策略名 + 匹配原因 + 预期胜率 + 一键采纳按钮)
```

### 模型3 — 相似度匹配 (Similarity-Based Strategy Recommender)

```
输入: 用户当前持仓 + Top-5 匹配因子

处理:
  1. 计算持仓向量与88个策略模板的余弦相似度
  2. 过滤: 相似度 < 0.3 不推荐 (太不相关)
  3. 排序
  4. 去重: 同一策略避免出现在模型2和模型3的结果中

输出:
  - 相似度 > 0.7 → "高度匹配" → 直接推荐
  - 相似度 0.5-0.7 → "相关策略" → 作为备选
  - 相似度 0.3-0.5 → "探索推荐" → 标记为"你可能也想看"
```

### 综合流程 (3模型 → 1回答)

```
User Request
    │
    ├─→ Model 1: 持仓诊断 ──→ 诊断报告 (3-5条)
    │
    ├─→ Model 2: 因子画像 ──→ Top-3 匹配策略
    │
    └─→ Model 3: 相似度计算 ──→ 补充推荐 (去重)
                │
                ▼
        ┌──────────────┐
        │  汇总 & 格式化│
        │  - 诊断 (先)  │
        │  - 推荐 (后)  │
        │  - 理由 (含)  │
        └──────┬───────┘
               ▼
        返回用户 (1U 已扣除)
```

---

## 四、计费契约 (API Contract)

### 4.1 attemptAccess

```typescript
// BillingTouchpoint #22: AI_STRATEGY_MATCH
const result = await factorBillingGateway.attemptAccess(userId, BillingTouchpoint.AI_STRATEGY_MATCH);

// TOUCHPOINT_CONFIG:
// AI_STRATEGY_MATCH: { costUSDT: 1.0, freeUses: 0, refundWindowHours: 1 }

// 返回值:
{
  sessionId: "billing-sess-abc123",   // 唯一会话ID
  granted: true,                       // 扣费成功
  costUSDT: 1.0,                       // 固定 1U
  holdExpiresAt: "2026-06-16T03:00Z"  // 1小时超时自动退
}

// 如果余额不足:
{ granted: false, reason: "INSUFFICIENT_BALANCE", requiredUSDT: 1.0, balanceUSDT: 0.5 }
```

### 4.2 settle

```typescript
// AI分析成功后调用 (无论降级到哪个模型)
await factorBillingGateway.settle(sessionId, {
  modelUsed: 'deepseek-v4-pro',  // 实际使用的模型 (审计用)
  tierAttempted: 1,               // 第几层成功 (审计用)
  tokensUsed: 2048,               // 实际token消耗 (成本核算)
  actualCostUSD: 0.06,            // 平台实际成本 (成本核算)
  recommendations: [
    { strategyId: 'S088', factorIds: ['HK_DIVIDEND_YIELD', 'HK_PB_RATIO'], matchScore: 0.92 },
    { strategyId: 'S042', factorIds: ['MOMENTUM_12M', 'CMF'], matchScore: 0.85 },
  ]
});
```

### 4.3 refund

```typescript
// 只在以下情况退费:
// 1. 所有4层模型全部失败 (all models timeout/error)
// 2. AI返回结果不可解析 (malformed JSON, 空推荐)
// 3. hold超时 (1小时) → 自动退

await factorBillingGateway.refund(sessionId, {
  reason: 'ALL_MODELS_FAILED | PARSE_ERROR | HOLD_TIMEOUT',
  errors: ['V4Pro timeout 30s ↑', 'V4Flash 503', 'MiniMax-M3 timeout'],
});
```

---

## 五、降级链计费契约

### 5.1 4-Tier Chain (R201升级)

```
┌──────────────────────────────────────────────┐
│  旧 (R145, 3-tier):                          │
│    V4Pro(折) → V4Flash → MiniMax-M3         │
│                                               │
│  新 (R201, 4-tier):                          │
│    Tier1: V4Pro(折) → Tier2: V4Pro(原)      │
│    → Tier3: V4Flash → Tier4: MiniMax-M3      │
└──────────────────────────────────────────────┘
```

### 5.2 成本-收入对照表

| Tier | 模型 | 用户价 | 平台成本/次 | 平台毛利 | 备注 |
|------|------|:------:|:----------:|:-------:|------|
| 1 | V4Pro (折扣) | 1U | ~$0.06 | ~94% | 大部分情况 |
| 2 | V4Pro (原价) | 1U | ~$0.10 | ~90% | 折扣额度用完 |
| 3 | V4Flash | 1U | ~$0.03 | ~97% | 降级但利润更高 |
| 4 | MiniMax-M3 | 1U | ~$0.01 | ~99% | 最后防线 |
| — | 全部失败 | 0U (退费) | ~$0.01 | 0% | 极低概率 |

**关键**: 降级时利润反而更高 (Flash/MiniMax比V4Pro便宜得多)，用户完全不受影响 = 双赢。

### 5.3 超时策略

```
每层 timeout = 30s
总超时 = 30s × 4 = 120s (2分钟)

超时后: 返回 "AI分析超时，请稍后重试。本次未扣费。"
       + refund(sessionId)
```

---

## 六、与23-Touchpoint管线的对齐

```
#22 AI_STRATEGY_MATCH  (本管线)
  ↓
#2  attemptAccess → hold 1U
  ↓
#3  AIDegradationChain (4-tier)
  ↓
#4  settle / refund
  ↓
#24 AUDIT_LOG: writeAudit({ timestamp, touchpoint, userId, amount, modelUsed, tokens })
```

| 计费触点 | Touchpoint ID | 固定价 | 备注 |
|----------|:------------:|:------:|------|
| 策略匹配 | #22 | 1U | 本管线 |
| 市场状态 | #23 | 1U | MarketStateEngine (同样逻辑，独立引擎) |
| 每日简报 | #24 | 1U | 略 |
| 套利扫描 | #25 | 2U | 略 |
| 信号推送 | #26 | 0.5U | 略 |
| 压力测试 | #27 | 2U | 略 |
| 持仓归因 | #28 | 1.5U | 略 |
| 创作者审核 | #29 | 1U (不退) | 独立不退费管线 |

---

## 七、BillingCard UI 计费信息 (供ML使用)

每个 AI 功能卡片需要包含以下计费元信息:

```typescript
interface BillingCardMeta {
  touchpointId: number;
  title: string;          // "AI策略匹配"
  priceUSDT: number;      // 1
  priceLabel: string;     // "1U/次"
  silentDeduct: boolean;  // true — 不弹窗静默扣
  refundable: boolean;    // true — 失败退费
  degradationInfo: string;// "4层AI保障, 价格不变"
  triggerLabel: string;   // "AI帮我匹配策略"
  helpText: string;       // "AI分析你的持仓/偏好, 从88个策略模板中推荐最匹配的3个"
}
```

---

## 八、前置定价策略总结

| 规则 | 值 |
|------|-----|
| 用户固定价 | **1U/次** (永远不变) |
| 免费额度 | **0次** (无免费) |
| 退费条件 | 所有4层模型失败 或 返回不可解析 |
| 不退费条件 | 推荐返回成功 (即使用户不满意推荐结果) |
| 降级时价格 | **不变** (永远1U) |
| 扣费时机 | **先行扣费** (attemptAccess → 冻结 → settle) |
| 超时退费 | **1小时** (HOLD_TIMEOUT) |
| 幂等键格式 | `SHA256("AI_STRATEGY_MATCH丨" + userId + "丨" + Date.now())` |
| 审计日志 | 记录: touchpoint, userId, amount, modelUsed, tierAttempted, tokensUsed, recommendations |

---

> **维护**: 本文档需与 `server/services/ai-billing.ts` + `electron/engine/factors/factor-billing-gateway.ts` 同步更新。
> **下一版**: R202+ 如引入多轮对话策略匹配需新计费模型。
