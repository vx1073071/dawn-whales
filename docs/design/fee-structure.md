# TradingEasy Fee Structure v17.6

> **Round**: R142 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: SPECIFICATION — v17.6 Final, Locked by Owner
> **Covers**: 5 asset class fees, minimums, examples, fee routing, refund rules

---

## Overview

TradingEasy charges a **per-trade fee** for orders placed through the platform. Fees are deducted in USDT from the user's wallet **before** the order is sent to the broker. If the order fails, the fee is **refunded** to the wallet.

### Core Rules (v17.6)
- **SaaS不收费**: No subscription, no monthly fee
- **按次计费**: Per-trade only
- **纯USDT**: No fiat currencies
- **下单前扣**: Deducted before order execution
- **失败退费**: Refunded on execution failure

---

## 1. Five Asset Classes — Fee Table

| # | Asset Class | Rate | Minimum Fee | Applies To |
|---|------------|------|-------------|------------|
| 1 | **股票 / ETF** | **0.1%** | **2 USDT** | US stocks, HK stocks, A-shares |
| 2 | **期货 (非加密)** | **0.1%** | **2 USDT** | CME, HKFE, SGX futures |
| 3 | **期权 (非加密)** | **0.1%** | **2 USDT** | US options, HK options (not crypto options) |
| 4 | **加密现货** | **0.1%** | **2 USDT** | BTC, ETH, SOL, etc. spot |
| 5 | **加密合约** | **0.02%** | **0.5 USDT** | BTC-PERP, ETH-PERP, etc. |

---

## 2. Fee Calculation Formula

```
For each order:
  notional = price × quantity
  fee = MAX(notional × rate, minimum_fee)

Where:
  rate = 0.001 for classes 1-4      (0.1%)
  rate = 0.0002 for class 5         (0.02%)
  minimum_fee = 200 cents for 1-4   (2.00 USDT)
  minimum_fee = 50 cents for 5      (0.50 USDT)

All calculations in USDT cents (integer).
```

### Code Reference (fee-calculator.ts)

```typescript
type AssetClass = 'stock_etf' | 'futures_non_crypto' | 'options_non_crypto' | 'crypto_spot' | 'crypto_perp';

interface FeeConfig {
  class: AssetClass;
  rate: number;       // e.g., 0.001 for 0.1%
  minFeeCents: number; // e.g., 200 for 2.00 USDT
}

const FEE_SCHEDULE: Record<AssetClass, FeeConfig> = {
  stock_etf:          { class: 'stock_etf',          rate: 0.001,  minFeeCents: 200 },
  futures_non_crypto:  { class: 'futures_non_crypto',  rate: 0.001,  minFeeCents: 200 },
  options_non_crypto:  { class: 'options_non_crypto',  rate: 0.001,  minFeeCents: 200 },
  crypto_spot:         { class: 'crypto_spot',         rate: 0.001,  minFeeCents: 200 },
  crypto_perp:         { class: 'crypto_perp',         rate: 0.0002, minFeeCents: 50 },
};

function calculateFee(assetClass: AssetClass, notionalUsdt: number): { feeUsdt: number; feeCents: number; rate: number } {
  const config = FEE_SCHEDULE[assetClass];
  if (!config) throw new Error(`Unknown asset class: ${assetClass}`);

  const notionalCents = Math.round(notionalUsdt * 100);
  const rawFeeCents = Math.round(notionalCents * config.rate);
  const feeCents = Math.max(rawFeeCents, config.minFeeCents);

  return {
    feeUsdt: Number((feeCents / 100).toFixed(2)),
    feeCents,
    rate: config.rate,
  };
}
```

---

## 3. Detailed Examples

### Class 1: 股票/ETF (0.1%, min 2 USDT)

| Order | Notional | Raw Fee | Actual Fee | Notes |
|-------|----------|---------|------------|-------|
| Buy 100 AAPL @ $150 | $15,000.00 | $15.00 | **$15.00** | Above min |
| Buy 10 AAPL @ $150 | $1,500.00 | $1.50 | **$2.00** | Min triggers |
| Buy 1 AAPL @ $150 | $150.00 | $0.15 | **$2.00** | Min triggers |
| Sell 500 0700 @ HK$400 | HK$200,000 | HK$200 | **USDT equivalent** | FX converted |
| Buy 1000 平安 @ ¥50 | ¥50,000 | ¥50 | **USDT equivalent** | FX converted |

### Class 2: 期货 (0.1%, min 2 USDT)

| Order | Notional | Raw Fee | Actual Fee |
|-------|----------|---------|------------|
| ES 1 contract @ 4500 | $225,000 | $225.00 | **$225.00** |
| MES 1 contract @ 4500 | $22,500 | $22.50 | **$22.50** |
| NQ 1 contract @ 18000 | $360,000 | $360.00 | **$360.00** |

### Class 3: 期权 (0.1%, min 2 USDT)

| Order | Notional | Raw Fee | Actual Fee |
|-------|----------|---------|------------|
| Buy 10 AAPL calls @ $5.00 | $5,000 | $5.00 | **$5.00** |
| Buy 1 AAPL call @ $0.50 | $50 | $0.05 | **$2.00** (min) |
| Sell 10 SPX puts @ $10.00 | $10,000 | $10.00 | **$10.00** |

### Class 4: 加密现货 (0.1%, min 2 USDT)

| Order | Notional | Raw Fee | Actual Fee |
|-------|----------|---------|------------|
| Buy 1 BTC @ $65,000 | $65,000 | $65.00 | **$65.00** |
| Buy 0.01 BTC @ $65,000 | $650 | $0.65 | **$2.00** (min) |
| Buy 100 SOL @ $150 | $15,000 | $15.00 | **$15.00** |

### Class 5: 加密合约 (0.02%, min 0.5 USDT)

| Order | Notional | Raw Fee | Actual Fee |
|-------|----------|---------|------------|
| BTC-PERP 1 contract @ $65,000 | $65,000 | $13.00 | **$13.00** |
| BTC-PERP 0.1 @ $65,000 | $6,500 | $1.30 | **$1.30** |
| ETH-PERP 10 @ $3,500 | $35,000 | $7.00 | **$7.00** |
| BTC-PERP 0.01 @ $65,000 | $650 | $0.13 | **$0.50** (min) |

---

## 4. Fee Routing Logic

```
┌────────────────────────────────────────────────────────────────┐
│                     Fee Routing Engine                          │
│                                                                 │
│  Order comes in:                                                │
│    { symbol, quantity, price, orderType, brokerId }            │
│                                                                 │
│  Step 1: Identify asset class                                   │
│    ├─ Symbol ends with -PERP, -USD → crypto_perp               │
│    ├─ Symbol in crypto list → crypto_spot                       │
│    ├─ Symbol ends with option suffix → options_non_crypto       │
│    ├─ Broker = futures broker → futures_non_crypto              │
│    └─ Default → stock_etf                                      │
│                                                                 │
│  Step 2: Lookup fee config                                      │
│    const config = FEE_SCHEDULE[assetClass]                      │
│                                                                 │
│  Step 3: Compute notional                                       │
│    notional = price × quantity                                  │
│                                                                 │
│  Step 4: Calculate fee                                          │
│    fee = MAX(notional × rate, minFee)                           │
│                                                                 │
│  Step 5: Generate idempotency key                               │
│    key = SHA256("trade_fee|" + orderId + "|" + userId)          │
│                                                                 │
│  Step 6: Deduct from wallet                                     │
│    POST /api/deduct                                             │
│    { category: "trade_fee", amount: fee, key: ... }            │
│                                                                 │
│  Step 7: On deduction success → send order to broker            │
│          On deduction failure → reject order (insufficient)     │
│          On broker failure → POST /api/refund                   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Asset Class Detection Algorithm

```typescript
function detectAssetClass(symbol: string, brokerId: string): AssetClass {
  // 1. Crypto perpetuals
  if (/-(PERP|USD[MTS]?)$/i.test(symbol)) return 'crypto_perp';

  // 2. Crypto spot (prefix-based)
  if (/^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|DOT|AVAX|MATIC|LINK|UNI|ATOM)/i.test(symbol)) {
    return 'crypto_spot';
  }

  // 3. Options (suffix-based)
  if (/\d{6}[CP]\d+$/i.test(symbol)) return 'options_non_crypto';

  // 4. Futures brokers
  const futuresBrokers = ['ib', 'tws', 'mt5', 'ctp'];
  if (futuresBrokers.some(b => brokerId.toLowerCase().includes(b))) {
    // Further check: futures symbols typically have month codes
    if (/[FGHJKMNQUVXZ]\d{2}$/i.test(symbol)) return 'futures_non_crypto';
  }

  // 5. Default
  return 'stock_etf';
}
```

---

## 5. Refund Rules

| Scenario | Refund? | Logic |
|----------|---------|-------|
| Broker rejects order | ✅ **Yes** | Full fee refunded |
| Order partially filled | ❌ **No** | Fee charged on executed portion |
| Network error (order unknown status) | ✅ **Yes** | Refund; let broker sort it out |
| User cancels order (before fill) | ✅ **Yes** | Canceled orders = no fee |
| AI analysis fails | ✅ **Yes** | AI-specific refund |
| Insufficient balance at deduction | ❌ **N/A** | Order blocked before reaching broker |

### Refund Idempotency
```
Refund uses: SHA256("refund|" + originalEntryId + "|" + userId)
If refund is called twice → second call returns 409 DUPLICATE_REQUEST
```

---

## 6. Multi-Currency Handling

All fees are computed and charged in **USDT**. For non-USDT orders:

```
1. Convert order notional to USDT
   HK stocks: notional_hkd × USDHKD rate
   A-shares:  notional_cny × USDCNY rate
   US stocks: notional_usd (no conversion)

2. Calculate fee in USDT

3. Deduct from USDT wallet

4. Display fee breakdown to user:
   "Fee: 5.00 USDT (0.1% × 5,000 USD notional)"
```

### FX Rate Source
- Server maintains hourly-updated FX rates
- Source: exchange rate API (or configurable provider)
- Display only — all calculations in USDT
- Rates cached with 1-hour TTL

---

## 7. Fee Display Components

### Pre-Order Fee Preview
```
┌─────────────────────────────────────┐
│  Order Summary                       │
│  Symbol: AAPL                        │
│  Side: BUY                           │
│  Quantity: 100 shares                │
│  Price: $150.00                      │
│  Notional: $15,000.00                │
│  ─────────────────────               │
│  Platform Fee:  15.00 USDT (0.1%)   │
│  Wallet Balance: 105.50 USDT         │
│  After Fee:      90.50 USDT          │
│  ─────────────────────               │
│  [Confirm Order]                     │
└─────────────────────────────────────┘
```

### Insufficient Balance Warning
```
┌─────────────────────────────────────┐
│  ⚠️ Insufficient Balance            │
│  Required: 15.00 USDT               │
│  Available: 8.50 USDT               │
│  Shortfall: 6.50 USDT               │
│  ─────────────────────               │
│  [Deposit USDT]  [Cancel]           │
└─────────────────────────────────────┘
```

### Successful Deduction
```
┌─────────────────────────────────────┐
│  ✅ Order Submitted                  │
│  Fee deducted: 15.00 USDT           │
│  New balance:   90.50 USDT          │
│  Order ID: ORD-abc123               │
└─────────────────────────────────────┘
```

---

## 8. Fee Calculation Edge Cases

| Case | Handling |
|------|----------|
| Notional = 0 | Error: invalid order |
| Notional < min_fee / rate | Charge minimum fee |
| Very large notional (> 10M USDT) | Standard rate applies |
| Multiple legs (spread) | Each leg charged separately |
| Partial fill | Fee on filled quantity (if order modified) |
| Hidden/iceberg orders | Fee on total submitted quantity |

---

> **Related**: `docs/reference/fee-schedule.md` (legacy v1.12.0), `docs/api/billing-api.md`, `server/fee-calculator.ts`
