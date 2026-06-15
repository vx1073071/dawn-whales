# TradingEasy AI Billing Rules v17.9

> **Round**: R145+R184+R200 | **Author**: QClaw/Claw | **Date**: 2026-06-15
> **Status**: SPECIFICATION — v17.9 Final, Locked by Owner
> **Covers**: Silent deduction, failure refund, 21 AI pricing items, degradation chain, DeepSeek prompt templates, strategy execution fee (积分扣费), creator review (1U/no-refund)

---

## Overview

All AI-powered features in TradingEasy follow a **unified pay-per-use model**: deduct before calling, refund on failure, no free tiers, no subscriptions.

### Core Principles

```
1. DEDUCT FIRST → then call AI
2. SILENT deduction (no popup, no confirmation)
3. FAIL → REFUND (full amount, automatic)
4. No free tiers, no monthly plans
5. Pure per-use pricing
```

---

## 1. AI Pricing Table

| # | Feature | Price | Category | Input Limit | Round |
|---|---------|-------|----------|-------------|-------|
| 1 | AI Auto-Drawing + Pattern Recognition | **1 USDT** | `ai_draw_lines` | 500 candles (4KB) | R145 |
| 2 | AI Chat / Strategy Q&A | **1 USDT** | `ai_chat` | 2KB text | R145 |
| 3 | AI Parameter Fill (strategy) | **1 USDT** | `ai_param_fill` | Framework + 200 candles | R145 |
| 4 | AI Fundamental Analysis | **1 USDT** | `ai_fundamental` | Financial data | Future |
| 5 | AI Technical Analysis (full) | **1 USDT** | `ai_technical` | 500 candles | Future |
| 6 | AI Sentiment Analysis | **1 USDT** | `ai_sentiment` | News/articles | Future |
| 7 | AI Macro Analysis | **1 USDT** | `ai_macro` | Economic indicators | Future |
| 8 | AI Strategy Backtest Review | **1 USDT** | `ai_backtest_review` | Backtest report | Future |
| 9 | AI Risk Assessment | **1 USDT** | `ai_risk` | Portfolio data | Future |
| 10 | AI Market Scanner | **1 USDT** | `ai_scanner` | Scanner parameters | Future |
| 11 | Multi-Factor Backtest | **1 USDT** | `factor_multi_backtest` | Factor combo + turnover | R184 |
| 12 | Factor Deep Diagnosis | **1 USDT** | `factor_deep_diagnosis` | IC decay + crowding | R184 |
| 13 | AI Factor Param Optimize | **1.5 USDT** | `factor_param_optimize` | Auto-tune params | R184 |
| 14 | Alt-Data Factor Unlock | **2 USDT** | `factor_alt_data_unlock` | On-chain/News/Satellite | R184 |
| 15 | AI Strategy Match | **1 USDT** | `ai_strategy_match` | Portfolio + preferences | R200 |
| 16 | AI Market State | **1 USDT** | `ai_market_state` | Bull/Bear/Range/Panic | R200 |
| 17 | AI Daily Briefing | **1 USDT** | `ai_daily_briefing` | Top5 factors + anomaly | R201 |
| 18 | AI Arbitrage Scan | **2 USDT** | `ai_arbitrage_scan` | AH/ADR/ETF premium | R207 |
| 19 | AI Factor Signal Push | **0.5 USDT** | `ai_factor_signal_push` | Factor trigger + push | R201 |
| 20 | AI Stress Test | **2 USDT** | `ai_stress_test` | Monte Carlo + scenarios | R207 |
| 21 | AI Portfolio Attribution | **1.5 USDT** | `ai_portfolio_attribution` | Brinson + factor P&L | R207 |
| 22 | AI Creator Strategy Review | **1 USDT** | `ai_creator_review` | 8-point auto-checklist | R210 |

### Notes
- All prices **flat per use** (1/1.5/2 USDT depending on feature)
- No feature has a discount, free tier, or volume pricing
- No bundle / package / monthly subscription for AI
- Factor deep services: factor itself is free (name/result/signal/IC), only deep services are paid
- Price locked by v17.9, requires owner approval to change

---

## 1.5 Strategy Execution Fee (积分扣费)

> **v17.8 新增**: 策略执行服务费 — 从USDT积分中扣除，非交易所真USDT

交易在交易所执行（用户API Key委托），交易所收自己的手续费。我们另收"策略执行服务费"。

| Asset | Execution Fee | Minimum (积分) |
|-------|:---:|:---:|
| Stock / ETF | 0.1% | 2 |
| Futures (non-crypto) | 0.02% | 0.5 |
| Options (non-crypto) | 0.04% | 1 |
| Crypto Spot | 0.1% | 2 |
| Crypto Futures | 0.02% | 0.5 |

**Ledger category**: `execution_fee` / **Refund category**: `execution_fee_refund`

```
User triggers strategy execution → Check 积分 balance ≥ fee estimate → Freeze 积分
  → Send order via API Key to exchange → Exchange executes
  ├─ Filled → Deduct 积分 by actual amount → Unfreeze remainder
  ├─ Cancelled → Unfreeze all 积分, no charge
  ├─ Rejected → Unfreeze all 积分, no charge
  └─ Timeout → Unfreeze all 积分, no charge
```

---

## 1.6 Creator Strategy Review (1U/次, 不退费)

> **v17.9 修正**: 创作者审核是特殊计费项，**不适用通用"失败退费"规则**

| 规则 | 说明 |
|------|------|
| 价格 | **1 USDT/次** (v17.8原1.5U→v17.9降为1U) |
| 扣费时机 | 创作者点击"提交审核"→ 立即扣1U |
| 审核不通过 | **不退费**，给出8项逐条具体修改建议 |
| 再次审核 | **每次1U**，不管多少次审核都是1U |
| 申诉 | **不存在申诉**，无申诉通道 |
| 失败退费 | 仅AI服务本身异常(超时/网络错误/模型无响应)才退费 |
| Ledger category | `ai_creator_review` (不通过也settled, 不走refund) |

```
Creator submits strategy → Deduct 1U → AI auto-review (8-point checklist)
  ├─ All 8 pass → Settled → Auto-list on marketplace
  ├─ Some fail → Settled (NO refund) → Return 8-item feedback with specific fix suggestions
  └─ AI service error (timeout/network) → Refund 1U → "审核服务异常，1U已退回"
```

---

## 2. Unified Deduction Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                   AI BILLING PIPELINE                              │
│                                                                   │
│  User clicks AI feature                                           │
│  │                                                                │
│  ▼                                                                │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ STEP 1: Pre-Check                                        │    │
│  │   - Feature type valid?                                   │    │
│  │   - Input within limits? (500 candles / 2KB text / etc.)  │    │
│  │   - Wallet balance >= price?                              │    │
│  │   ↓ NO → Return error "Insufficient balance: need X USDT" │    │
│  └────────────────────────┬─────────────────────────────────┘    │
│                           │ YES                                  │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ STEP 2: Silent Deduct                                    │    │
│  │   ──────────────────────────────────────                 │    │
│  │   POST /api/billing/ai-deduct                             │    │
│  │   {                                                       │    │
│  │     category: "ai_param_fill",                            │    │
│  │     userId: "user_abc",                                   │    │
│  │     amount: 1.00,                                         │    │
│  │     key: SHA256("ai|param_fill|session_123|user_abc")     │    │
│  │   }                                                       │    │
│  │   → Balance: -1.00 USDT (SILENT — no popup)               │    │
│  │   → Insert ledger_entry (type=debit, category=ai_xxx)     │    │
│  │   → Insert idempotency_key                                │    │
│  └────────────────────────┬─────────────────────────────────┘    │
│                           │ SUCCESS                              │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ STEP 3: Call DeepSeek V4 Pro                             │    │
│  │   - Send prompt with K-line data / query                  │    │
│  │   - Wait up to 30 seconds                                 │    │
│  │   - Parse structured JSON response                        │    │
│  └────────────────────────┬─────────────────────────────────┘    │
│                           │                                      │
│              ┌────────────┼────────────┐                         │
│              ▼            ▼            ▼                         │
│         SUCCESS       FAILURE      TIMEOUT                       │
│              │            │            │                         │
│              ▼            ▼            ▼                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Return result │ │ STEP 4:      │ │ STEP 4:      │            │
│  │ to user       │ │ REFUND       │ │ REFUND       │            │
│  │               │ │ ─────────   │ │ ─────────   │            │
│  │ ✅ User sees  │ │ POST /api/  │ │ POST /api/  │            │
│  │   AI output   │ │  billing/   │ │  billing/   │            │
│  │               │ │  ai-refund  │ │  ai-refund  │            │
│  │ Cost: 1 USDT  │ │ +1.00 USDT  │ │ +1.00 USDT  │            │
│  │ (not refunded)│ │             │ │             │            │
│  │               │ │ ❌ User sees│ │ ❌ User sees│            │
│  │               │ │ "Analysis   │ │ "Analysis   │            │
│  │               │ │ failed, 1U  │ │ timed out,  │            │
│  │               │ │ refunded"   │ │ 1U refunded"│            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Silent Deduction

### What "Silent" Means

```
✅ CORRECT (silent):
   User clicks "AI Draw" → instant deduction → result appears
   No dialog, no confirmation, no "are you sure?"

❌ WRONG (non-silent):
   User clicks "AI Draw" → dialog "This will cost 1 USDT. Continue?"
   → User clicks Confirm → deduction → result appears
```

### Rationale
- AI features are **instant actions**, not purchases
- Clicking the button IS the confirmation
- Popups add friction that degrades UX
- Balance is visible on screen; user can check before clicking

### Balance Display

```
Always show remaining balance in the AI UI:

[🤖 AI Draw]  Wallet: 23.50 USDT  (23 uses remaining)
[🤖 AI Chat]                                  ▼
┌────────────────────────────────────────────┐
│  AI Strategy Assistant                      │
│                                            │
│  You: "What's the best RSI setting for..." │
│                                            │
│  [Send]  Cost: 1 USDT  Balance: 23.50 U   │
└────────────────────────────────────────────┘
```

---

## 4. Refund Rules

### When Refund Is Triggered

| Scenario | Refund? | Reason |
|----------|---------|--------|
| AI returns valid result | ❌ No | Service delivered |
| AI returns invalid JSON | ✅ Yes | `ai_invalid_response` |
| AI times out (>30s) | ✅ Yes | `ai_timeout` |
| Network error calling AI | ✅ Yes | `ai_network_error` |
| AI returns error status | ✅ Yes | `ai_provider_error` |
| AI returns empty result | ✅ Yes | `ai_empty_response` |
| User cancels mid-analysis | ❌ No | Deduction happened; AI call was made |

### Refund Implementation

```typescript
async function refundAICharge(
  userId: string,
  originalEntryId: string,
  amountCents: number,
  reason: string
): Promise<void> {
  const key = crypto.createHash('sha256')
    .update(`ai_refund|${originalEntryId}|${userId}`)
    .digest('hex');

  // Double-entry: credit back to user
  db.transaction(() => {
    // 1. Credit user wallet (increase balance)
    db.prepare(`
      UPDATE wallets SET
        balance_usdt = balance_usdt + ?,
        checksum = ?,
        version = version + 1,
        updated_at = datetime('now')
      WHERE user_id = ? AND version = ?
    `).run(amountCents, newChecksum, userId, currentVersion);

    // 2. Ledger: credit entry
    db.prepare(`
      INSERT INTO ledger_entries (id, wallet_id, type, amount_cents, category, description, status, created_at)
      VALUES (?, ?, 'credit', ?, 'ai_refund', ?, 'confirmed', datetime('now'))
    `).run(uuid(), walletId, amountCents, `Refund: ${reason}`);

    // 3. Idempotency key
    db.prepare(`
      INSERT INTO idempotency_keys (key, wallet_id, entry_id, status, expires_at, created_at)
      VALUES (?, ?, ?, 'committed', datetime('now', '+24 hours'), datetime('now'))
    `).run(key, walletId, entryId);

    // 4. Mark original entry as refunded
    db.prepare(`
      UPDATE ledger_entries SET
        description = description || ' [REFUNDED: ' || ? || ']'
      WHERE id = ?
    `).run(reason, originalEntryId);
  })();
}
```

---

## 5. Degradation Chain

### 4-Tier Fallback

```
Tier 1: DeepSeek V4 Pro (discounted rate)
  ├─ Primary model
  ├─ Best accuracy, lowest cost to platform
  └─ If fails: → Tier 2

Tier 2: DeepSeek V4 Pro (full price)
  ├─ Same model, higher cost
  ├─ Used only when Tier 1 quota/API unavailable
  └─ If fails: → Tier 3

Tier 3: DeepSeek V4 Flash
  ├─ Faster, slightly lower accuracy
  ├─ Acceptable for less complex analysis
  └─ If fails: → Tier 4

Tier 4: MiniMax-M3
  ├─ Last resort
  ├─ Lowest cost, acceptable quality
  └─ If fails: → Refund user
```

### Fallback Logic

```typescript
const AI_MODELS = [
  { name: 'deepseek-v4-pro',       baseUrl: '...', cost: 'discounted', timeout: 30000 },
  { name: 'deepseek-v4-pro',       baseUrl: '...', cost: 'full',       timeout: 30000 },
  { name: 'deepseek-v4-flash',     baseUrl: '...', cost: 'flash',      timeout: 20000 },
  { name: 'minimax-m3',           baseUrl: '...', cost: 'fallback',    timeout: 15000 },
];

async function callAIWithFallback(prompt: string): Promise<AIResponse> {
  for (const model of AI_MODELS) {
    try {
      const result = await callModel(model, prompt);
      logAICall(model.name, { success: true, cost: model.cost });
      return result;
    } catch (err) {
      logAICall(model.name, { success: false, error: err.message });
      continue; // Try next tier
    }
  }
  // All tiers failed
  throw new AIAllTiersFailedError('All AI models unavailable');
}
```

### Transparent to User
- User always pays **1 USDT** regardless of which tier was used
- Platform absorbs the higher cost of fallback tiers
- AI always responds within 30 seconds or refunds

---

## 6. AI Categories (Ledger)

```
Ledger categories for AI:

  ai_draw_lines      — Auto-drawing + pattern recognition
  ai_chat             — AI strategy chat/Q&A
  ai_param_fill       — Parameter auto-fill
  ai_fundamental      — Fundamental analysis
  ai_technical        — Technical analysis
  ai_sentiment        — Sentiment analysis
  ai_macro            — Macro analysis
  ai_backtest_review  — Backtest review
  ai_risk             — Risk assessment
  ai_scanner          — Market scanner
  factor_multi_backtest   — Multi-factor backtest (v17.7)
  factor_deep_diagnosis   — Factor deep diagnosis (v17.7)
  factor_param_optimize   — AI factor param optimization (v17.7)
  factor_alt_data_unlock  — Alt-data factor unlock (v17.7)
  ai_strategy_match       — AI strategy match (v17.8)
  ai_market_state         — AI market state recognition (v17.8)
  ai_daily_briefing       — AI daily factor briefing (v17.8)
  ai_arbitrage_scan       — AI cross-market arbitrage scan (v17.8)
  ai_factor_signal_push   — AI factor signal push (v17.8)
  ai_stress_test          — AI strategy stress test (v17.8)
  ai_portfolio_attribution — AI portfolio attribution (v17.8)
  ai_creator_review       — AI creator strategy review (v17.9, 1U/no-refund, give modification suggestions)
  execution_fee           — Strategy execution service fee (v17.8, 积分扣费)

Refund:
  ai_refund           — All AI refunds use this category
  execution_fee_refund — Strategy execution fee refund (v17.8)
```

---

## 7. Monitoring & Limits

### Platform Limits

| Limit | Value | Behavior |
|-------|-------|----------|
| Max input tokens per request | 4,000 tokens | Truncate if exceeded |
| Max K-line candles per draw | 500 candles | Select last 500 if more |
| Max chat message length | 2,000 characters | Truncate with warning |
| Timeout per AI call | 30 seconds | Refund on timeout |
| Max retry attempts | 2 | After 3 total failures (original + 2 retry) → refund |

### Cost Monitoring

| Metric | Alert |
|--------|-------|
| AI refund rate > 10% | WARNING: AI service quality issue |
| Tier 1 unavailable > 5 min | WARNING: DeepSeek API issues |
| Tier 4 usage > 50% of calls | WARNING: Primary models severely degraded |
| Daily AI spend > 500 USDT | INFO: High usage day |

---

> **Related**: `docs/design/ai-drawlines.md`, `docs/api/billing-api.md`, `docs/design/wallet-architecture.md`
