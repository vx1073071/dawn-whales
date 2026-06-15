# TradingEasy Creator Guide v17.9

> **Round**: R144+R210 | **Author**: QClaw/Claw | **Date**: 2026-06-15
> **Status**: GUIDE — v17.9 Final
> **Covers**: Listing, pricing, levels, revenue split, income, withdrawal, AI auto-review

---

## Welcome, Creator!

This guide explains everything you need to create, sell, and earn on the TradingEasy Creator Marketplace.

---

## 1. Getting Started

### What You Can Sell

| Product | Pricing | Best For |
|---------|---------|----------|
| **Strategy Template** | One-time purchase | Standalone strategies with proven backtests |
| **Strategy Combo** | One-time purchase (bundled) | Offering 2-5 related strategies at a discount |
| **Signal Subscription** | Monthly (auto-renew) | Ongoing signal delivery with active trading |
| **Tips/打赏** | One-time (any amount ≥ 9.9) | Community appreciation (passive income) |

### Minimum Price
All products must be priced **≥ 9.9 USDT**.

---

## 2. Creator Levels

Your level determines your **revenue split**. Higher level = more of your sales go to you.

| Level | Requirement | Your Split | Platform Split | Badge |
|-------|-------------|-----------|----------------|-------|
| **L1 · 新手** | 0-99 total sales | **70%** | 30% | 🟢 New Creator |
| **L2 · 进阶** | 100-999 total sales | **80%** | 20% | 🔵 Advanced Creator |
| **L3 · 旗舰** | 1000+ total sales | **90%** | 10% | 🟣 Top Creator |

### Level Progression

```
Level is calculated on TOTAL CUMULATIVE SALES across all products:
  - Every template purchase = 1 sale
  - Every combo purchase = 1 sale (regardless of how many templates inside)
  - Every subscription payment = 1 sale (counts each month)
  - Tips do NOT count toward sales (they are appreciation, not a product)

Example:
  Month 1: Sell 50 templates → 50 total → L1 (70%)
  Month 2: Sell 40 templates + 10 combos → 100 total → L2 UPGRADE! (80%)
  Month 3: Continue selling → 150 total → L2 (80%)
  ...
  Eventually: 1000 total → L3 UPGRADE! (90%)
```

### Upgrade Timing

```
Upgrades happen AUTOMATICALLY when the sale completes:
  1. Buyer purchases your product
  2. Total sales incremented: totalSales += 1
  3. IF totalSales reaches 100: immediate upgrade to L2
  4. IF totalSales reaches 1000: immediate upgrade to L3

No review needed. No KYC. No approval.
```

### Critical Edge Cases

| Total Sales | Level | Platform Takes |
|-------------|-------|---------------|
| 0 | L1 | 30% |
| 99 | L1 | 30% ← NOT L2 yet! |
| **100** | **L2** | **20%** ← NOW upgraded |
| 500 | L2 | 20% |
| 999 | L2 | 20% ← NOT L3 yet! |
| **1000** | **L3** | **10%** ← NOW upgraded |
| 5000 | L3 | 10% |

---

## 3. Publishing a Strategy Template

### Step 1: Prepare Your Template

```
Required files:
  ├── strategy.ts         Core logic (TypeScript)
  ├── parameters.ts       Editable parameters with ranges
  ├── risk.ts             Risk management rules
  └── backtest.json       Historical performance data

Optional files:
  ├── icon.png            200×200 template icon
  ├── banner.png          1200×400 promotional banner
  └── screenshots/        1-3 preview images
```

### Step 2: Upload & Configure

```
POST /api/market/templates/create

{
  "name": "Golden Cross Momentum",
  "description": "EMA 50/200 crossover strategy with RSI confirmation...",
  "price": 49.90,
  "category": "trend",
  "tags": ["golden-cross", "ema", "rsi"],
  "files": { ... },
  "backtestSummary": {
    "winRate": 0.62,
    "sharpeRatio": 1.45,
    "maxDrawdown": 0.15,
    "totalReturn": 0.85,
    "testPeriod": { "from": "2024-01-01", "to": "2025-12-31" }
  }
}
```

### Step 3: AI Auto-Review

Templates go through **AI automated review** (1 USDT per review, non-refundable):

- **Cost**: 1 USDT per review, charged when you click "Submit for Review"
- **Refund policy**: **No refund** — whether your strategy passes or not, the 1U is charged
- **What you get**: 8-point checklist with **specific modification suggestions** for every failed item
- **Re-review**: Each re-review costs 1 USDT, unlimited times
- **Appeals**: **No appeals process** — fix the issues and re-submit

**8-Point AI Review Checklist**:

| # | Check | Standard | Feedback if Failed |
|---|-------|----------|-------------------|
| 1 | Plain-language description | Strategy name + description must be jargon-free | "Contains term XXX, suggest changing to YYY" |
| 2 | Stop-loss rule | Must include stop-loss condition (%) | "Missing stop-loss, please add stop-loss % rule" |
| 3 | Applicable markets | Must specify markets (🇭🇰🇺🇸🪙 etc.) | "No market specified, please choose specific markets" |
| 4 | Invalidation check | Must include invalidation criteria | "Missing invalidation condition, add when to abandon" |
| 5 | Factor validity | All factors must exist in 258-factor library, weights sum=100% | "Factor XXX not in library / weights sum to XX%" |
| 6 | Parameter reasonability | Stop-loss > 0.5% / position < 100% / backtest period ≥ 1yr | "Stop-loss 0.3% too low, suggest ≥ 0.5%" |
| 7 | Backtest robustness | Annual return > 0 / max drawdown < 50% / Sharpe > 0 | "Max drawdown XX% > 50%, strategy risk too high" |
| 8 | No plagiarism | Cosine similarity < 90% vs existing strategies | "Similarity XX% with strategy YYY, please differentiate" |

Approval is **automatic** if all 8 checks pass. If any fail, you receive specific suggestions for each failed item — fix and re-submit (1 USDT per attempt).

### Step 4: Go Live

Once approved, your template appears in the marketplace immediately.

---

## 4. Revenue & Earnings

### How Much You Earn Per Sale

| Product | Price | L1 (70%) | L2 (80%) | L3 (90%) |
|---------|-------|----------|----------|----------|
| Template | 49.9 U | 34.93 U | 39.92 U | 44.91 U |
| Combo | 89.9 U | 62.93 U | 71.92 U | 80.91 U |
| Subscription (monthly) | 29.9 U | 20.93 U | 23.92 U | 26.91 U |
| Tip | 10.0 U | 7.00 U | 8.00 U | 9.00 U |

### Earnings Calculation

```
Monthly Earnings = Σ(product_price × creator_split%)

Example (L2 creator, active month):
  50 template sales @ 49.9 U × 80% = 50 × 39.92 = 1,996.00 U
  10 combo sales   @ 89.9 U × 80% = 10 × 71.92 =   719.20 U
  30 subscribers   @ 29.9 U × 80% = 30 × 23.92 =   717.60 U
  5 tips           @ 19.9 U × 80% =  5 × 15.92 =    79.60 U
  ────────────────────────────────────────────────────────
  Total: 3,512.40 U
```

### Where Does Your Money Go?

```
Sale completed → Revenue split:
  ├─ Your share: immediately credited to your creator wallet
  ├─ Platform share: transferred to platform fee wallet
  └─ Full transaction recorded in ledger (auditable)

You can withdraw your earnings anytime via POST /api/wallet/withdraw
```

---

## 5. Pricing Strategy

### Recommended Pricing by Category

| Category | Recommended Range | Why |
|----------|------------------|-----|
| Simple trend strategy | 9.9 - 29.9 U | Lower complexity, faster impulse buy |
| Multi-indicator strategy | 29.9 - 69.9 U | Moderate complexity |
| AI/ML strategy | 49.9 - 199.9 U | Higher perceived value |
| Combo (2+) | 29.9 - 199.9 U | Discount vs buying individually |
| Subscription | 9.9 - 99.9 U/month | Over-deliver signals to justify ongoing cost |

### Tips for Pricing

1. **Start lower** (L1 phase): 9.9-19.9 U — build sales volume first
2. **Raise after L2**: More buyers = social proof = can command higher
3. **Combos**: Price 20-30% below sum of individual templates
4. **Subscription**: Price at a point where 1 trade = 1 month's subscription

---

## 6. Withdrawing Your Earnings

### How to Cash Out

```
1. Go to Wallet → Creator Earnings
2. Click "Withdraw"
3. Enter:
   - Amount (from your creator wallet balance)
   - TRC-20 / ERC-20 withdrawal address
4. Confirm → Amount sent to your on-chain wallet

Fees:
  - Withdrawal fee: 0.1%, min 2 USDT
  - Network fee: platform covers gas
  - Cold wallet (> 100,000 U): manual processing, 1-4 hours
  - Hot wallet (≤ 100,000 U): automatic, ~3 minutes (TRC-20) / ~3 min (ERC-20)
```

---

## 7. Best Practices for Creators

### 7.1 Build Social Proof
- Provide **detailed backtest data** (win rate, Sharpe, drawdown)
- Add **screenshots** showing strategy in action
- Respond to buyer questions (future feature)

### 7.2 Keep Strategies Updated
- Version your templates (1.0.0 → 1.1.0)
- Current buyers get updates for free
- Announce updates to attract new buyers

### 7.3 Leverage Combos
- Bundle complementary strategies
- Think: "Trend following" + "Momentum filter" + "Risk manager" = Complete System
- Combos increase average order value

### 7.4 Signal Subscription Success
- Post regular update notes with each signal
- Track and share your signal performance
- Be transparent about win/loss rates

---

## 8. Creator Dashboard

### What You Can See
```
Creator Dashboard:
├── Total sales (across all products)
├── Current level (L1/L2/L3) + next upgrade at
├── Monthly revenue breakdown
│   ├── Template sales: 1,996.00 U
│   ├── Combo sales:     719.20 U
│   ├── Subscriptions:   717.60 U
│   └── Tips:             79.60 U
├── Active subscribers: 30
├── Wallet balance: 3,512.40 U (available to withdraw)
├── Sales history (last 30 days chart)
└── Top performing products
```

---

## 9. FAQ

**Q: Can I change my template price after publishing?**
A: Yes. New price applies to future purchases only. Existing buyers keep their version.

**Q: Do tips count toward my level progression?**
A: No. Tips are appreciation, not product sales. Only template/combo/subscription purchases count.

**Q: What if someone buys my template and resells it?**
A: Templates are licensed per user. Reselling is prohibited. Report violations to admin.

**Q: How often are subscription payments processed?**
A: Monthly, on the same day of month as the initial subscription. Auto-deducted at 00:00 UTC.

**Q: What happens when my subscriber runs out of balance?**
A: Subscription status changes to SUSPENDED. Signal delivery pauses. When they recharge, it auto-resumes.

**Q: Can I be demoted from L2 to L1?**
A: No. Levels only go UP based on cumulative sales. No demotion.

---

> **Related**: `docs/design/marketplace-guide.md`, `docs/design/withdraw-risk-control.md`, `docs/design/transfer-vs-tip.md`
