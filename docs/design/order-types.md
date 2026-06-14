# TradingEasy Order Types Guide v1.0

> **Round**: R147 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: USER GUIDE — Production Ready
> **Covers**: 4 order types, per-scenario defaults, limit/market/conditional mechanisms

---

## Overview

TradingEasy supports **4 order types** with intelligent defaults per trading scenario. Users can override defaults based on their needs.

---

## 1. Four Order Types

| # | Order Type | How It Works | Best For |
|---|-----------|-------------|----------|
| 1 | **Limit Order** | Buy/sell at specified price (or better). Won't execute if price not met. | Precise entry/exit |
| 2 | **Market Order** | Buy/sell at best available price. Executes immediately. | Speed over price precision |
| 3 | **Conditional Order** | Order placed when trigger condition is met (price crosses level). | Automated entry/exit |
| 4 | **Stop Order** | Becomes market order when stop price is hit. Primarily for risk management. | Loss protection |

---

## 2. Scenario-Based Defaults

### Smart Defaults

TradingEasy automatically selects the most appropriate order type for each scenario:

| Scenario | Default Order Type | Rationale | Overridable? |
|----------|-------------------|-----------|-------------|
| **Strategy Entry** | Limit Order | You want to enter at your calculated price, not chase the market | ✅ Yes → switch to Market |
| **Copy Trade Entry** | Market Order | Must match the copied trader's entry immediately; slippage is acceptable cost of following | ✅ Yes → switch to Limit |
| **Stop Loss** | Stop Order → Market | Loss protection must execute. Price precision matters less than execution certainty | ❌ No (locked) |
| **Take Profit** | Limit Order | You want to exit at your profit target, not a penny less | ✅ Yes → switch to Market |
| **Manual Trade** | Limit Order | Human traders prefer price control by default | ✅ Yes → switch to any type |

### Why Each Default?

```
Strategy Entry → Limit:
  "I calculated my entry at $150. I'll wait for the market to come to me."

Copy Trade → Market:
  "The trader I'm copying just bought at $150 — I need to be in at ~$150,
   even if it's $150.20. Slippage of 0.1% is cheaper than missing the trade."

Stop Loss → Market (locked):
  "My position is losing money fast. EXECUTE NOW. Price is secondary."
  This is intentionally NOT overridable — safety over flexibility.

Take Profit → Limit:
  "My target is $175. I want exactly $175, not $174.80."
```

---

## 3. Limit Order

### Mechanism

```
Limit BUY:  "Buy at price ≤ X"
  Example: Buy 100 AAPL LIMIT $150
  → Will fill at $150.00 or lower
  → Will NOT fill if price > $150.00

Limit SELL: "Sell at price ≥ X"
  Example: Sell 100 AAPL LIMIT $175
  → Will fill at $175.00 or higher
  → Will NOT fill if price < $175.00
```

### Configurable Parameters

| Parameter | Description | Default | Options |
|-----------|-------------|---------|----|
| Limit Price | Target execution price | Market ± buffer | Any positive number |
| Time in Force | How long the order stays active | GTC (Good Till Cancelled) | GTC / Day / IOC / FOK |
| Price Offset | ± ticks from reference price | 2 ticks (strategy entry) | 1-20 ticks |

### TIF (Time in Force) Options

| TIF | Behavior | Use Case |
|-----|----------|----------|
| **GTC** | Active until filled or cancelled (or 90 days max) | Strategy entries waiting for setup |
| **Day** | Active until market close today | Intraday trades |
| **IOC** | Immediate or Cancel — fill whatever possible now, cancel rest | Large orders wanting partial fills |
| **FOK** | Fill or Kill — fill entire quantity now or cancel entirely | Must have complete fill |

### Limit Order UI

```
┌──────────────────────────────────────────┐
│  📊 Place Order — AAPL                    │
│                                          │
│  Order Type:  [Limit ▼]                  │
│                                          │
│  Side:       [Buy]                       │
│  Quantity:   [100]  shares               │
│  Limit Price: [$150.00]                  │
│                                          │
│  Time in Force: [GTC ▼]                  │
│  ───────────────────────────────         │
│                                          │
│  Market: $150.25    Your price: < $150   │
│                                          │
│  Estimated fee: 15.00 USDT (0.1%)       │
│  Balance after: 85.00 USDT               │
│                                          │
│  [Place Limit Order]                     │
└──────────────────────────────────────────┘
```

---

## 4. Market Order

### Mechanism

```
Market BUY:  "Buy at best available price immediately"
  Example: Buy 100 AAPL MARKET
  → Fills at closest ask (e.g., $150.30)
  → Slippage possible in fast markets

Market SELL: "Sell at best available price immediately"
  Example: Sell 100 AAPL MARKET
  → Fills at closest bid (e.g., $150.10)
```

### Slippage Protection

```
When placing a market order, user can set max slippage:

  Max Slippage: [0.5%]  ← Won't execute if fill price deviates > 0.5% from last price

Example:
  Last price: $150.00
  Max slippage: 0.5% (tolerance: $149.25 - $150.75)
  If best ask is $151.50 → REJECTED (1.0% slippage exceeds 0.5%)

Use case: Copy trader places market buy — but won't chase if price spiked 2%.
```

### Market Order UI

```
┌──────────────────────────────────────────┐
│  📊 Copy Trade Entry — AAPL              │
│                                          │
│  Order Type:  [Market ▼]  ⚡Fastest      │
│                                          │
│  Side:       [Buy]                       │
│  Quantity:   [100]  shares               │
│                                          │
│  Max Slippage: [0.5% ▼]  🔒 Default     │
│  ───────────────────────────────         │
│                                          │
│  Est. fill: ~$150.25 (last: $150.00)    │
│                                          │
│  Estimated fee: 15.00 USDT               │
│                                          │
│  [Copy Trade Now]                        │
└──────────────────────────────────────────┘
```

---

## 5. Conditional Order

### Mechanism

```
"I want to buy AAPL, but only if the price drops to $145 first."

Trigger Price: $145.00 (when this is crossed → order activates)
Actual Order:  Buy 100 AAPL LIMIT $145.00

Types of conditions:
  Last Price ≥ X  → Trigger when price rises to X
  Last Price ≤ X  → Trigger when price falls to X
```

### Use Case: Automated Entry

```
Trader identifies a support level at $142 on AAPL.
They want to buy if price dips to test support.

Conditional Order:
  Condition: AAPL last price ≤ $143.00
  Action: Buy 100 AAPL LIMIT $142.50
  Expiry: GTC (max 90 days)

When AAPL hits $143.00 → limit order at $142.50 is placed automatically.
```

### Conditional Order UI

```
┌──────────────────────────────────────────┐
│  🎯 Conditional Order — AAPL             │
│                                          │
│  Condition:                              │
│    When:  [Last Price ▼]  [≤ ▼]         │
│    Price: [$143.00]                      │
│                                          │
│  Then Place:                             │
│    Side:       [Buy ▼]                   │
│    Type:       [Limit ▼]                 │
│    Quantity:   [100]                      │
│    Limit Price: [$142.50]                │
│                                          │
│  Expiry:  [GTC ▼]                        │
│  ───────────────────────────────         │
│                                          │
│  Status: Waiting for trigger...          │
│  Condition: AAPL ≤ $143.00              │
│  Current: $150.25 (price above trigger)  │
│                                          │
│  [Place Conditional Order]               │
└──────────────────────────────────────────┘
```

---

## 6. Stop Order (Stop Loss)

### Mechanism

```
Stop BUY (stop entry):  "If price rises to X, buy at market"
  Used for breakout entries (rare)

Stop SELL (stop loss):  "If price falls to X, sell at market"
  Used for loss protection — LOCKED TO MARKET ORDER

Stop Loss Behavior:
  1. Monitor price
  2. When last price ≤ stop price → trigger
  3. Immediately place MARKET SELL order
  4. Execute at best available price
  
  ⚠ Stop Loss is ALWAYS market order — no limit option.
    Rationale: you want OUT, not a price negotiation.
```

### Stop Loss UI

```
┌──────────────────────────────────────────┐
│  🛑 Stop Loss — AAPL Position            │
│                                          │
│  Position:    100 AAPL @ $150.00         │
│  Current P&L: +$25.00 (+0.17%)           │
│                                          │
│  Stop Price:  [$142.50]  ▼              │
│    (-5.0% from entry)                    │
│    Current: $150.25 (7.75 away)         │
│                                          │
│  Order Type:  🔒 Market (locked)          │
│  ───────────────────────────────         │
│                                          │
│  If AAPL drops to $142.50:               │
│  → Sell 100 AAPL at best market price    │
│  → Estimated loss: ≤$750 (5%)            │
│                                          │
│  [Set Stop Loss]                         │
└──────────────────────────────────────────┘
```

---

## 7. Take Profit

### Mechanism

```
Take Profit (Limit Sell): "When price reaches my target, sell at that price"

  1. Monitor price
  2. When last price ≥ take profit price → trigger
  3. Place LIMIT SELL at take profit price
  4. Wait for fill

  Default: Limit order (you want your target, not less)
  Overridable: Can switch to Market for certainty
```

---

## 8. Order Type Override Rules

### When Users Can Override

| Scenario | Default | Can Switch To | Cannot Switch To |
|----------|---------|--------------|-----------------|
| Strategy Entry | Limit | Market, Conditional | — |
| Copy Trade | Market | Limit, Conditional | — |
| Stop Loss | Market | — | **None (locked!)** |
| Take Profit | Limit | Market | — |
| Manual | Limit | Market, Conditional, Stop | — |

### Why Stop Loss is Locked

```
1. Stop loss is RISK MANAGEMENT, not optimization
2. Adding a limit to a stop order means "I want to sell at $142.50,
   but only if someone buys at that price" → you might never get filled
3. In a crash (price gaps down from $145 to $140), a limit stop at $142.50
   does NOTHING — price skipped past your limit
4. Market stop: you get filled at $140 (bad, but OUT)
   Limit stop: you never get filled (WORSE, losing position keeps losing)
```

---

## 9. Fee Calculation by Order Type

| Order Type | Fee Charged On | When Charged |
|-----------|---------------|-------------|
| Limit | Total notional (price × qty) when filled | On fill confirmation |
| Market | Total notional at execution price | Immediately (before broker send) |
| Conditional | Total notional when activated + filled | On trigger activation |
| Stop | Total notional at execution price | On stop trigger |

### Refund Rules

```
All order types:
  If order is REJECTED by broker → fee refunded
  If order is CANCELLED (user cancelled) → fee refunded
  If order is partially filled → fee on filled portion only
  If order expires unfilled → fee refunded

Limit/Market:
  If order is placed but immediately rejected (balance check fail) → NO fee deducted
```

---

> **Related**: `docs/design/ta-billing-rules.md`, `docs/design/fee-structure.md`, `docs/api/billing-api.md`
