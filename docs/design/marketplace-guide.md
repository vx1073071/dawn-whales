# quant-moo Creator Marketplace v17.6

> **Round**: R144 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: SPECIFICATION — v17.6 Final
> **Covers**: 4 product types (templates/combos/subscriptions/tips), pricing, purchase flow

---

## Overview

The Creator Marketplace lets strategy creators monetize their work through **4 product types**. All products have a **minimum price of 9.9 USDT** and revenue is split according to the creator's level (L1/L2/L3).

---

## 1. Four Product Types

| # | Product | Pricing Model | Buyer Gets | Payment |
|---|---------|--------------|-----------|---------|
| 1 | **Strategy Template** | One-time purchase | Strategy code + parameters + backtest | One-time deduction |
| 2 | **Strategy Combo** | One-time purchase | Bundle of 2-5 templates | One-time deduction |
| 3 | **Signal Subscription** | Monthly (auto-renew) | Live trading signals for 30 days | Monthly deduction |
| 4 | **Tip/打赏** | One-time (any amount ≥ 9.9 U) | Appreciation + visibility | One-time deduction |

---

## 2. Strategy Templates

### What It Is
A pre-configured trading strategy that buyers can import, customize, and run. Templates include strategy logic, parameters, risk settings, and backtest results.

### Template Package

```
Strategy Template:
├── metadata.json        # Name, description, version, category, tags
├── strategy.ts          # Core strategy logic
├── parameters.ts        # Configurable parameters with ranges
├── risk.ts              # Risk management rules
├── backtest.json        # Historical backtest results (read-only)
├── icon.png             # Template icon (200×200)
└── banner.png           # Banner image (1200×400)
```

### Template Listing

| Field | Required | Description |
|-------|----------|-------------|
| name | ✅ | Template name (3-50 chars) |
| description | ✅ | What it does and how it works (50-500 chars) |
| price | ✅ | ≥ 9.9 USDT |
| category | ✅ | trend / momentum / mean-rev / arbitrage / custom |
| version | ✅ | Semantic version (e.g., 1.0.0) |
| creatorId | ✅ | Creator's user ID |
| backtestSummary | ✅ | { winRate, sharpe, maxDrawdown, totalReturn } |
| tags | Optional | Up to 5 tags for search |
| previewImages | Optional | Up to 3 screenshots |

### Purchase Flow

```
Buyer                           Server                       Creator
─────                           ──────                       ───────

1. Browse marketplace
   GET /api/market/templates?category=trend&sort=popular

2. View detail
   GET /api/market/templates/:id
   ← { name, desc, price, backtest, creator { name, level, totalSales } }

3. Purchase
   POST /api/market/templates/:id/buy
   ← Create order + validate
   
4. Deduct balance
   POST /api/billing/deduct
   { category: "template_purchase", amount: 49.9 }
   
5. Release template
   Template code delivered to buyer's library
   
6. Split revenue
   Platform: 49.9 × 0.20 = 9.98 U (L2)
   Creator:  49.9 × 0.80 = 39.92 U
   
7. Update sales count
   creator.totalSales += 1
   IF totalSales >= 100: level = L2
   IF totalSales >= 1000: level = L3
                                     ← Creator wallet +39.92 U
                                     ← Creator level may upgrade
```

### API: `GET /api/market/templates`

```
Query: ?category=trend&sort=popular&page=1&limit=20
Response:
{
  "items": [
    {
      "id": "tpl_abc123",
      "name": "Golden Cross Momentum",
      "description": "EMA 50/200 crossover with RSI filter...",
      "price": 49.90,
      "category": "trend",
      "creator": {
        "id": "user_xyz",
        "name": "CryptoWhale",
        "badge": "L2",
        "totalSales": 234,
        "totalRevenue": 8340.50
      },
      "backtest": {
        "winRate": 0.62,
        "sharpeRatio": 1.45,
        "maxDrawdown": 0.15,
        "totalReturn": 0.85
      },
      "rating": 4.7,
      "purchases": 892,
      "tags": ["golden-cross", "ema", "rsi"],
      "createdAt": "2026-05-01T00:00:00Z"
    }
  ],
  "total": 128,
  "page": 1,
  "pages": 7
}
```

---

## 3. Strategy Combos

### What It Is
A curated bundle of 2-5 strategy templates sold as a package. Combos offer a **higher value** (bundle is cheaper than buying individually) to incentivize bulk purchases.

### Combo Rules

```
- 2-5 templates per combo
- Combo price ≥ 9.9 USDT
- Combo price should be < sum of individual prices (discount)
- Creator = same creator for all templates in combo
- Creator level applies to combo sale
- Each template's sales count increments when combo is sold
```

### Combo Package

```
Strategy Combo:
├── metadata.json        # Combo name, description, key idea
├── templates[]          # Array of template references
│   ├── tpl_abc123       # Template 1
│   └── tpl_def456       # Template 2
├── combo_strategy.ts    # Optional: how templates work together
└── banner.png           # Combo promotional image
```

### Example

```
"Trend Trading Starter Pack" (L2 creator)
├── Golden Cross Momentum      (buy alone: 49.9 U)
├── MACD Divergence Hunter      (buy alone: 39.9 U)
└── Bollinger Band Reversal     (buy alone: 29.9 U)
                                Total individually: 119.7 U
Combo price: 89.9 U (25% discount!)

Buyer pays: 89.9 U
Platform (L2: 20%): 17.98 U
Creator (L2: 80%): 71.92 U
```

---

## 4. Signal Subscriptions

### What It Is
A monthly subscription to a creator's live trading signals. Subscribers receive real-time trade recommendations from the creator's strategy during the paid period.

### Subscription Rules

```
- Billing: Monthly (30 days), auto-renew
- Minimum: 9.9 USDT/month
- First charge: Immediately on subscribe
- Renewal: Same date next month, automatically
- Balance insufficient: Suspend subscription, notify user
- Recharge: Subscription auto-resumes when balance is sufficient
- Cancel: Stops at end of current billing period
- Creator level split: L1:70% / L2:80% / L3:90% of each payment
```

### Signal Subscription Lifecycle

```
State Machine:

  [INACTIVE] ──subscribe──▶ [ACTIVE]
                                │
                         ┌──────┼──────┐
                         ▼             ▼
                  [SUSPENDED]    [CANCELLED]
                  (low balance)   (user canceled)
                         │             ▲
                         │             │
                   recharge   ┌────────┘
                         │    │
                         ▼    │
                     [ACTIVE] │
                              │
  [ACTIVE] ───pay──▶ [INACTIVE]
```

### Subscription Payment Flow

```
Day 0: User subscribes to "CryptoWhale Signals" at 29.9 U/month
       → Deduct 29.9 U → Platform 5.98 U (L2:20%) + Creator 23.92 U
       → Status: ACTIVE, next_payment: Day 30

Day 29: System sends notification: "Subscription renews tomorrow"

Day 30: Auto-renew attempt
       IF balance >= 29.9:
         → Deduct 29.9 U → Extend to Day 60
       ELSE:
         → Status: SUSPENDED
         → Signal delivery paused
         → User notified: "Subscription suspended due to insufficient balance"

Day 35: User deposits 50 U
        → Balance now 50 U → >= 29.9 renewal price
        → Auto-resume: Deduct 29.9 U → Status: ACTIVE
        → next_payment: Day 65

Day 40: User clicks "Cancel Subscription"
        → Status will become INACTIVE on Day 65
        → Remaining 25 days still active
```

### API Endpoints

```
POST   /api/signals/:creatorId/subscribe     { price: 29.90 }
GET    /api/signals/my-subscriptions          List active + history
POST   /api/signals/:subscriptionId/cancel    Cancel (effective at period end)
GET    /api/signals/:subscriptionId/status    Current status + next payment
```

---

## 5. Tips / 打赏

### What It Is
One-time payment to a creator as appreciation. Tips are **not a purchase** — they're a way to support creators whose content you value.

### Rules

```
- Minimum: 9.9 USDT
- Predefined amounts: [9.9, 19.9, 49.9, 99.9] + custom
- Sender pays: exact tip amount (NO extra fee on sender!)
- Creator receives: tip × (1 - platform_split%)
- Platform split:
    L1 creator: 30%
    L2 creator: 20%
    L3 creator: 10%
- NOT a transfer! Separate pipeline!
```

### Tip Flow

```
1. User views creator profile
2. Clicks "💝 Tip"
3. Selects amount (9.9 / 19.9 / 49.9 / 99.9)
4. Sees breakdown:
   "Creator receives: 8.00 U (L2, 80%)"
   "Platform fee: 2.00 U (20%)"
5. Confirms → Balance deducted
6. Creator receives instant credit
```

---

## 6. Unified Purchase Flow

All purchases go through the same billing pipeline:

```
Any marketplace buy (template/combo/subscription/tip):

1. Validate product exists + minimum price (≥ 9.9 U)
2. Create order record
3. Generate idempotency key: SHA256("marketplace_buy|productId|buyerId|timestamp")
4. Call POST /api/billing/deduct
   { category: "marketplace_purchase", amount, key }
5. Lookup creator level
6. Calculate split: platform = amount × split; creator = amount - platform
7. Record double-entry ledger:
   - buyer debit (category: marketplace_purchase)
   - creator credit (category: marketplace_income)
   - platform credit (category: marketplace_fee)
8. Deliver product to buyer
9. Increment creator salesCount
10. Check creator level upgrade (100/1000 thresholds)
11. Return success
```

---

## 7. Pricing Rules

| Rule | Details |
|------|---------|
| Minimum price | All 4 products: **≥ 9.9 USDT** |
| Creator sets price | Free to choose any price ≥ 9.9 |
| Price changes | Affects new purchases only; existing subscriptions keep old price |
| Discounts | Combos can offer bundled discount |
| Platform never discounts | Only creators set prices |
| FX | All prices in USDT only |

---

## 8. ID & Taxonomy

### Product IDs
```
Template:    tpl_{uuid8}     e.g., tpl_a1b2c3d4
Combo:       cmb_{uuid8}     e.g., cmb_e5f6g7h8
Subscription: sub_{uuid8}    e.g., sub_i9j0k1l2
Tip:         tip_{uuid8}     e.g., tip_m3n4o5p6
```

### Ledger Categories
```
Template purchase:    marketplace_purchase     (buyer), marketplace_income (creator), marketplace_fee (platform)
Combo purchase:       combo_purchase           (buyer), combo_income (creator), combo_fee (platform)
Subscription payment: subscription_payment      (subscriber), subscription_income (creator), subscription_fee (platform)
Tip:                  tip_out                   (sender), tip_income (creator), tip_platform_fee (platform)
```

---

> **Related**: `docs/design/creator-guide.md`, `docs/design/transfer-vs-tip.md`, `docs/api/billing-api.md`
