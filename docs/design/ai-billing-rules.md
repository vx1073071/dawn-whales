# TradingEasy AI Billing Rules v17.6

> **Round**: R145 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: SPECIFICATION — v17.6 Final, Locked by Owner
> **Covers**: Silent deduction, failure refund, 10+ AI pricing items, degradation chain, DeepSeek prompt templates

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

### Notes
- All prices **flat 1 USDT per use** across all features
- No feature has a discount, free tier, or volume pricing
- No bundle / package / monthly subscription for AI
- Price locked by v17.6, requires owner approval to change

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

Refund:
  ai_refund           — All AI refunds use this category
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
