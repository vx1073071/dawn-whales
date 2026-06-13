# Dawn Whales User Manual v2.1.0

> **Version**: v2.1.0 | **Last Updated**: 2026-06-13
> **Covers**: Wallet, Marketplace, AI, Trading — Complete Operation Guide

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Wallet & Balance](#2-wallet--balance)
3. [Trading Fees](#3-trading-fees)
4. [Creator Marketplace](#4-creator-marketplace)
5. [AI Features](#5-ai-features)
6. [Trading Agents (TA)](#6-trading-agents-ta)
7. [Order Types](#7-order-types)
8. [Settings & Preferences](#8-settings--preferences)
9. [Security](#9-security)

---

## 1. Getting Started

### System Requirements
- Windows 10+ / macOS 12+ / Ubuntu 20.04+
- 8GB RAM minimum, 16GB recommended
- Internet connection (for AI features and real-time data)

### First Launch
1. Install Dawn Whales from the official download page
2. Launch the desktop application
3. First-time users get **3 free AI analyses** (registration bonus)
4. Go to Wallet → Deposit USDT to unlock all paid features
5. Connect your broker to start trading

### Navigation
```
Sidebar:
  📊 Dashboard    — Portfolio overview, P&L summary
  📈 Market       — Charts, watchlists, scanners
  💼 Portfolio    — Holdings, allocations, performance
  🤖 AI           — AI drawing, analysis, optimization
  🛒 Marketplace  — Browse and buy strategies
  🎨 Creator      — Publish your own strategies
  💰 Wallet       — Balance, deposit, withdraw, transfer
  ⚙️ Settings     — Preferences, API keys, notifications
```

---

## 2. Wallet & Balance

### USDT Wallet
All Dawn Whales paid features use **USDT (internal credits)**. This is NOT on-chain USDT — it's your internal balance.

### Deposit USDT

```
Step 1: Go to Wallet → Deposit
Step 2: Select network: TRC-20 (recommended, 0 fees) or ERC-20 (platform covers gas)
Step 3: Send USDT to the displayed wallet address
Step 4: Wait for blockchain confirmation:
  - TRC-20: ~3 minutes (20 confirmations)
  - ERC-20: ~5 minutes (12 confirmations)

⚠ IMPORTANT: Do NOT submit a transaction hash manually!
   The platform monitors the blockchain automatically.
   Your balance updates when confirmations are met.
```

### Deposit Fees
| Network | Fee | Minimum | Processing |
|---------|-----|---------|-----------|
| TRC-20 | **0%** (free) | 10 USDT | ~3 min |
| ERC-20 | **0%** (platform subsidized) | 10 USDT | ~5 min |

### Withdraw USDT

```
Step 1: Go to Wallet → Withdraw
Step 2: Enter withdrawal USDT address (TRC-20 or ERC-20)
Step 3: Enter amount (minimum withdrawal: 2 USDT equivalent)
Step 4: Confirm

Fee: 0.1% (minimum 2 USDT)

Processing:
  - ≤ 100,000 USDT: Automatic (~3 minutes, hot wallet)
  - > 100,000 USDT: Manual review (~1-4 hours, cold wallet)

Speed:
  - First withdrawal: Automatic
  - Repeat to same address (24h): Automatic
  - New address: Automatic on first use
```

### Transfer to Another User

```
Step 1: Go to Wallet → Transfer
Step 2: Enter recipient's username or ID
Step 3: Enter amount (minimum: 10 USDT)
Step 4: Confirm

Fee: Sender pays 0.3%, receiver pays 0.3%
Example: Send 100 USDT → Sender pays 100.30 USDT, receiver gets 99.70 USDT

⚠ Transfer ≠ Tip! Transfer has fixed fees. Tips use creator level splits.
```

### Check Balance & History

```
Wallet Page:
┌──────────────────────────────────────────────┐
│  💰 My Wallet                                 │
│                                              │
│  Balance: 1,250.00 USDT                      │
│                                              │
│  [Deposit]  [Withdraw]  [Transfer]           │
│                                              │
│  Recent Transactions:                        │
│  06-13  Deposit (TRC-20)      +500.00 USDT   │
│  06-13  AI Chat               -1.00 USDT     │
│  06-12  Marketplace Purchase   -49.90 USDT   │
│  06-12  Transfer to @traderX  -100.30 USDT   │
│                                              │
│  [View All Transactions]                     │
└──────────────────────────────────────────────┘
```

---

## 3. Trading Fees

### Fee Table (v17.6)

When you place a trade through Dawn Whales, you pay:

| Asset Type | Fee Rate | Minimum Fee | Example |
|-----------|---------|------------|---------|
| Stocks / ETFs | 0.1% | 2 USDT | Buy $5,000 → 5 USDT |
| Futures (non-crypto) | 0.1% | 2 USDT | Buy $3,000 → 3 USDT |
| Options (non-crypto) | 0.1% | 2 USDT | Buy $1,000 → 2 USDT (minimum) |
| Crypto Spot | 0.1% | 2 USDT | Buy $1,000 → 2 USDT (minimum) |
| Crypto Contracts | 0.02% | 0.5 USDT | Buy $10,000 → 2 USDT |

### Fee Visibility
- Fee is shown **before you confirm** every trade
- Fee is displayed in the order placement UI
- All fees are recorded in your transaction history
- Fees are non-refundable except when: broker rejects order / you cancel before fill / order expires unfilled

---

## 4. Creator Marketplace

### Buying Strategies

```
Step 1: Go to Marketplace
Step 2: Browse or search by category (trend/momentum/arbitrage/etc.)
Step 3: Click a strategy to view details (backtest, creator info, price)
Step 4: Click "Buy" → confirm → balance deducted → strategy added to your library

Products available:
  - Templates: One-time purchase, strategy code + parameters
  - Combos: Bundled 2-5 templates at a discount
  - Subscriptions: Monthly signal delivery (auto-renew)
  - Tips: Send appreciation to creators
```

### After Purchase
- Strategy appears in "My Library"
- Import into your trading dashboard
- Run backtests, optimize, or deploy with a Trading Agent

### Selling as a Creator

```
Step 1: Go to Creator Dashboard
Step 2: Upload strategy (code + parameters + backtest)
Step 3: Set price (minimum 9.9 USDT)
Step 4: Publish → automatic review → live on marketplace

Creator Levels:
  🟢 L1 (0-99 sales):    You earn 70% of each sale
  🔵 L2 (100-999 sales):  You earn 80% of each sale
  🟣 L3 (1000+ sales):    You earn 90% of each sale

Levels upgrade AUTOMATICALLY when you reach the sales threshold.
No KYC, no manual review, no demotion.
```

---

## 5. AI Features

### Overview
Dawn Whales has **10 AI-powered features** — all pay-per-use with silent deduction.

### AI Pricing Table

| # | Feature | Price | What It Does |
|---|---------|-------|-------------|
| 1 | Auto-Drawing + Patterns | 1 USDT | AI draws support/resistance/trend lines on chart |
| 2 | AI Chat | 1 USDT | Ask AI about strategies, markets, analysis |
| 3 | Parameter Fill | 1 USDT | AI recommends strategy parameters |
| 4 | Strategy Portfolio | 2 USDT | AI selects strategies + allocates weights |
| 5 | Backtest Reading | 1 USDT | AI interprets backtest results in plain language |
| 6 | Strategy Optimization | 1.5 USDT | AI suggests parameter improvements |
| 7 | Health Check | 1 USDT | AI scans all strategies for issues |

### AI Rules
```
✅ Silent deduction — no popup, click = pay
✅ Failure = full refund
✅ No free tiers, no subscriptions, no discounts
✅ Maximum 500 K-line candles per analysis
✅ Timeout: 30 seconds per request
```

### Using AI Auto-Drawing

```
On any chart page:
1. Click [🤖 AI Draw] button
2. 1 USDT silently deducted
3. AI analyzes chart (1-3 seconds)
4. Drawings appear on chart (trend lines, support/resistance, patterns)
5. Controls: [💾 Save] [✕ Clear] [👁 Hide/Show]

Confidence levels:
  🟢 ≥70%: High confidence — bold lines
  🟡 50-69%: Medium — dashed lines
  🟠 30-49%: Low — faint overlay
  ⚫ <30%: Not displayed
```

### AI Workflow Loop

```
Recommended flow for strategy development:

  1. Fill params (1U) → Choose framework, get AI recommendations
  2. Run backtest → Test the strategy
  3. Read results (1U) → AI explains performance
  4. Optimize (1.5U) → AI suggests improvements
  5. Re-backtest → Verify improvements
  6. Build portfolio (2U) → AI combines strategies
  7. Deploy → Start trading
  8. Health check (1U/day) → Monitor all strategies

Total one-time cost: ~6.5 USDT
Monthly monitoring: ~30 USDT (daily health checks)
```

---

## 6. Trading Agents (TA)

### What They Are
Trading Agents automatically execute your strategies. Choose the tier based on your needs.

| Tier | Price/Round | Best For |
|------|-----------|----------|
| **Standard** | 1.0 USDT | Single strategy, default settings |
| **Advanced** | 1.5 USDT | Single strategy, custom risk + position sizing |
| **Flagship** | 2.0 USDT | Multi-strategy (up to 8), dynamic risk, rebalancing |

### Running a TA

```
Step 1: Go to Strategies → Select a strategy
Step 2: Click "Run TA" → Select tier
Step 3: 1.0/1.5/2.0 USDT silently deducted
Step 4: TA analyzes market → places order if signal generated
Step 5: Result: Executed or "No trade opportunity"

⚠ No charge if execution FAILS (broker rejection, timeout, network error)
⚠ Charged even if no signal is generated (analysis was performed)
```

---

## 7. Order Types

### Four Order Types

| Type | How It Works | Default For |
|------|-------------|------------|
| **Limit** | Buy at ≤ price / Sell at ≥ price | Strategy entry, take profit, manual |
| **Market** | Execute immediately at best price | Copy trading entry |
| **Conditional** | Place when trigger price is hit | Automated breakouts |
| **Stop** | Becomes market order at stop price | 🔒 Stop loss (locked!) |

### Stop Loss is Special

```
⚠ STOP LOSS IS ALWAYS MARKET ORDER — YOU CANNOT CHANGE IT

Why? Because in a crash:
  - Market stop: FILLS (you get out, even at a worse price)
  - Limit stop: NEVER FILLS (price gaps past your limit, loss keeps growing)

A filled stop at -10% is better than an unfilled stop at -50%.
```

---

## 8. Settings & Preferences

### Language
Dawn Whales supports 8 languages: 🇨🇳 简体中文 | 🇺🇸 English | 🇯🇵 日本語 | 🇰🇷 한국어 | 🇪🇸 Español | 🇫🇷 Français | 🇩🇪 Deutsch | 🇷🇺 Русский

Go to Settings → Language to change.

### Notifications
Configure notifications for:
- Wallet balance low (below threshold)
- Trade executed or failed
- AI analysis complete
- Subscription renewal
- Health check alerts (red status)

### Broker Connection
Go to Settings → Broker to connect your trading accounts.

---

## 9. Security

### Your Wallet Security
- All balances stored server-side (never trust client)
- Double-entry accounting for every transaction
- HMAC-SHA256 checksums prevent database tampering
- Each transaction has a unique idempotency key

### Best Practices
```
✅ Keep your login credentials private
✅ Verify wallet address before withdrawing
✅ Check fees before confirming any transaction
✅ Review trade details before execution
✅ Use strong, unique passwords
```

### Getting Help
- In-app: Help → Support Chat
- Documentation: All design docs in `docs/design/`
- FAQ: See common questions at the end of this manual

---

## FAQ

**Q: Why was I charged 1 USDT when my AI analysis showed no patterns?**
A: The AI analysis was performed and completed successfully. The result was "no significant patterns detected" — which is valid analysis output. You paid for the analysis, not for patterns.

**Q: I got charged but the trade was rejected. Will I get a refund?**
A: If the broker rejected your order, YES — you will be refunded automatically. The fee is only charged on successful executions.

**Q: My subscription auto-renewed but I didn't want it to.**
A: You can cancel a subscription at any time. It will remain active until the end of the current billing period. Go to Wallet → Subscriptions to manage.

**Q: Can I transfer USDT between users?**
A: Yes, but note that transfers have 0.3% fee on both sender and receiver sides. Use Tips if you want to support a creator instead — no sender fee, and the creator gets their level-based split.

**Q: I deposited USDT but it hasn't shown up in my balance.**
A: Wait for blockchain confirmations (TRC-20: ~3 min, ERC-20: ~5 min). Do NOT manually submit a transaction hash. If it's been more than 30 minutes, contact support.

**Q: Can I withdraw my entire balance?**
A: Yes, subject to the 0.1% withdrawal fee (minimum 2 USDT). Withdrawals over 100,000 USDT require manual review (~1-4 hours).

---

> **Version History**: v2.1.0 (2026-06-13) — Initial complete manual with wallet, marketplace, AI, TA, trading
