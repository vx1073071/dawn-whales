# Dawn Whales Trading Agent (TA) Billing Rules v17.6

> **Round**: R147 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: SPECIFICATION — v17.6 Final
> **Covers**: TA standard/advanced/flagship pricing, round definition, no-charge-on-failure, pipeline

---

## Overview

Three tiers of Trading Agents (TA) are available for automated strategy execution. All follow the same billing principle: **deduct per round, refund if execution fails**.

### Core Rules
```
1. Pay BEFORE execution starts
2. Pay PER ROUND (not per trade within a round)
3. EXECUTION FAILURE = FULL REFUND (order rejected/timeout/network error)
4. SIGNAL ANALYSIS ONLY = still charged (analysis was delivered)
```

---

## 1. TA Pricing Table

| TA Tier | Price per Round | Capabilities | Failure Refund |
|---------|----------------|-------------|---------------|
| **Standard Agent** | **1.0 USDT** | Execute 1 strategy with default risk settings | ✅ Full refund |
| **Advanced Agent** | **1.5 USDT** | Execute 1 strategy with custom risk + position sizing | ✅ Full refund |
| **Flagship Agent** | **2.0 USDT** | Execute multi-strategy with dynamic risk + rebalancing | ✅ Full refund |

### Comparison

| Feature | Standard (1.0U) | Advanced (1.5U) | Flagship (2.0U) |
|---------|----------------|-----------------|-----------------|
| Single strategy | ✅ | ✅ | ✅ |
| Multi-strategy | ❌ | ❌ | ✅ (up to 8) |
| Default risk | ✅ | ❌ (custom) | ❌ (dynamic) |
| Custom risk params | ❌ | ✅ | ✅ |
| Custom position sizing | ❌ | ✅ | ✅ |
| Rebalancing | ❌ | ❌ | ✅ |
| Porfolio optimization | ❌ | ❌ | ✅ |
| Max strategies/round | 1 | 1 | 8 |
| Avg execution time | < 2 sec | < 5 sec | < 15 sec |

---

## 2. What Is a "Round"?

### Definition
> **A TA round = one complete execution of the agent's strategy from signal evaluation to order placement (or rejection).**

### Round Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    TA ROUND LIFECYCLE                        │
│                                                             │
│  [DEDUCT]  User pays 1.0/1.5/2.0 USDT                        │
│     │                                                       │
│     ▼                                                       │
│  [ANALYZE] TA evaluates market signals against strategy      │
│     │                                                       │
│     ├─→ No signal generated → "No trade opportunity"        │
│     │   ⚠ STILL CHARGED (analysis was performed)            │
│     │                                                       │
│     └─→ Signal generated →                                  │
│           │                                                 │
│           ▼                                                 │
│  [EXECUTE] TA places order via broker                        │
│     │                                                       │
│     ├─→ Order FILLED → Round complete ✅                    │
│     │                                                       │
│     ├─→ Order REJECTED by broker → 💰 REFUND               │
│     │   (insufficient margin, symbol halted, etc.)           │
│     │                                                       │
│     ├─→ Order TIMEOUT (30s) → 💰 REFUND                     │
│     │                                                       │
│     ├─→ Network error → 💰 REFUND                            │
│     │                                                       │
│     └─→ Strategy error → 💰 REFUND                          │
│                                                             │
│  One round = one deduction or one refund.                    │
│  Multiple trades within one round = one charge.               │
└─────────────────────────────────────────────────────────────┘
```

### Examples

```
Example 1: Standard Agent, success
  User clicks "Run TA Standard"
  → Deduct 1.0 USDT
  → TA analyzes → generates BUY signal for AAPL
  → Places limit order → FILLED
  → ✅ Charged 1.0 USDT

Example 2: Standard Agent, no signal
  User clicks "Run TA Standard"
  → Deduct 1.0 USDT
  → TA analyzes → no signal (market conditions don't match)
  → Returns "No trade opportunity at this time"
  → ⚠ STILL charged 1.0 USDT (analysis was valid and delivered)

Example 3: Advanced Agent, broker rejection
  User clicks "Run TA Advanced"
  → Deduct 1.5 USDT
  → TA analyzes → generates signal
  → Places order → BROKER REJECTS: "Insufficient margin"
  → 💰 REFUND 1.5 USDT
  → ⚠ NOT charged

Example 4: Flagship Agent, partial
  User clicks "Run TA Flagship"
  → Deduct 2.0 USDT
  → TA runs 5 strategies
  → 3 strategies place orders (filled)
  → 2 strategies reject (network timeout)
  → All 5 are part of ONE round → 2 rejections don't cancel the 3 fills
  → ⚠ Charged 2.0 USDT (round was partially successful = charged)
  → Only refund if ALL strategies fail
```

---

## 3. Refund Rules

### Charged (No Refund)

| Scenario | Reason |
|----------|--------|
| Order filled | Execution succeeded — core service delivered |
| No signal generated | Analysis was performed — the answer "don't trade" is valid advice |
| Partial strategy execution (Flagship) | Some strategies executed — round was productive |
| User cancels after analysis | Analysis already consumed |

### Refunded

| Scenario | Reason |
|----------|--------|
| Broker rejects order | Execution never happened (no value delivered) |
| Order times out (30s) | Execution could not complete |
| Network error to broker | Execution attempt failed |
| Strategy logic error | TA crashed mid-execution |
| ALL Flagship strategies fail | Entire round produced zero value |
| Insufficient broker margin | Could not execute despite signal |

---

## 4. TA Billing Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                    TA BILLING PIPELINE                            │
│                                                                  │
│  POST /api/ta/execute                                             │
│  { userId, strategyId, taTier: "advanced" }                      │
│                                                                  │
│  Step 1: Determine price                                          │
│    standard → price = 1.0 U (100 cents)                           │
│    advanced → price = 1.5 U (150 cents)                           │
│    flagship → price = 2.0 U (200 cents)                           │
│                                                                  │
│  Step 2: Balance check                                            │
│    wallet_balance >= price? → NO → "Insufficient balance"         │
│                                                                  │
│  Step 3: Silent deduct                                            │
│    POST /api/billing/ai-deduct                                    │
│    { category: "ta_execute", amount: 1.5,                        │
│      key: SHA256("ta|standard|round_123|user_abc") }              │
│    → Balance: -1.5 USDT                                           │
│                                                                  │
│  Step 4: Execute TA                                               │
│    signal = analyze(strategy, marketData)                         │
│    if signal:                                                      │
│      order = placeOrder(signal)                                   │
│      if order.rejected: → go to Step 5 (refund)                   │
│      if order.filled: → return success                            │
│    else:                                                          │
│      return "No trade signal"                                     │
│                                                                  │
│  Step 5: Refund (if execution failed)                             │
│    POST /api/billing/ai-refund                                    │
│    { category: "ta_refund", amount: 1.5,                         │
│      key: SHA256("ta_refund|round_123|user_abc") }                │
│    → Balance: +1.5 USDT                                           │
│                                                                  │
│  Ledger categories:                                               │
│    ta_execute  (debit: user pays)                                  │
│    ta_refund   (credit: user gets refund)                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. TA vs AI Billing

TA and AI billing share the **same unified deduction pipeline** from R141 but use **different ledger categories**:

| Aspect | AI Billing | TA Billing |
|--------|-----------|-----------|
| **Ledger category** | `ai_*` (ai_draw, ai_chat, etc.) | `ta_execute` / `ta_refund` |
| **Refund trigger** | AI call fails (timeout, invalid response) | Execution fails (broker reject, timeout) |
| **Price tiers** | Flat: 1.0 / 1.5 / 2.0 U | Flat: 1.0 / 1.5 / 2.0 U |
| **Deduction timing** | Before AI API call | Before TA execution |
| **Shared pipeline** | ✅ Same POST /api/billing/ai-deduct | ✅ Same POST /api/billing/ai-deduct |
| **Idempotency key** | `SHA256("ai|type|sessionId|user")` | `SHA256("ta|tier|roundId|user")` |

---

## 6. TA Round Counter

Each user has a per-session round counter:

```
Session:
  userId: user_abc
  roundsThisSession: 3
  tiersUsed:
    standard: 2  → 2.0 U spent
    advanced: 1  → 1.5 U spent
  totalSpentSession: 3.5 U

Session display: "TA Rounds: 3 | Spent: 3.50 USDT"
```

---

## 7. Failure Recovery

### Broker Rejection Recovery

```
If order is rejected:
  1. TA logs rejection reason (e.g., "Margin: insufficient")
  2. TA marks round as failed
  3. Billing service issues refund
  4. User sees: "TA execution failed: Insufficient margin. 1.5 USDT refunded."
  5. User can top up margin and retry
```

### Timeout Recovery

```
If broker doesn't respond within 30s:
  1. TA aborts the request
  2. TA logs timeout
  3. Billing service issues refund
  4. User sees: "TA execution timed out. 1.5 USDT refunded."
  5. Status of order on broker side: UNKNOWN
     → User checks broker separately
```

---

> **Related**: `docs/design/order-types.md`, `docs/design/ai-billing-rules.md`, `docs/api/billing-api.md`
