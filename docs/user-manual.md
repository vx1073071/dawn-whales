# Dawn Whales User Manual v2.2.0

> **Version**: v2.3.0 | **Last Updated**: 2026-06-14
> **Covers**: Wallet, Marketplace, AI, Trading, Quotes — Complete Operation Guide
> **Update Notes**: R152-R154 (search bar, real-time quotes, broker priority, market status indicators)

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Wallet & Balance](#2-wallet--balance)
3. [Trading Fees](#3-trading-fees)
4. [Market & Real-time Quotes](#4-market--real-time-quotes)
5. [Creator Marketplace](#5-creator-marketplace)
6. [AI Features](#6-ai-features)
7. [Trading Agents (TA)](#7-trading-agents-ta)
8. [Order Types](#8-order-types)
9. [Fee Feedback & Protection](#9-fee-feedback--protection)
10. [Monthly Spending Report](#10-monthly-spending-report)
11. [Settings & Preferences](#11-settings--preferences)
12. [Security](#12-security)

---

## 1. Getting Started

### System Requirements
- Windows 10+ / macOS 12+ / Ubuntu 20.04+
- 8GB RAM minimum, 16GB recommended
- Internet connection (for AI features and real-time data)

### First Launch
1. Install Dawn Whales from the official download page
2. Launch the desktop application
3. Go to Wallet → Deposit USDT to start using paid features
4. All AI features are pay-per-use — check pricing before clicking
5. Connect your broker to start trading

> 💡 New to Dawn Whales? See the **Onboarding Guide** (Help → Getting Started) for a 5-minute walkthrough.

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
│  [📊 Monthly Report]                         │
└──────────────────────────────────────────────┘
```

### Insufficient Balance

```
If you try to buy a 49.9 USDT strategy but only have 30 USDT:

  ⚠ Insufficient Balance
  You need 19.9 USDT more (including fees).
  
  [💳 Deposit USDT] → One-click jump to deposit page
```

This check runs before every paid action (purchase, AI, TA). No deduction attempt if balance is too low.

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
- **FeePreview component** on every order entry — shows estimated fee before you confirm
- Fee is shown **before you confirm** every trade
- All fees are recorded in your transaction history
- Fees are non-refundable except when: broker rejects order / you cancel before fill / order expires unfilled

### Withdrawal Fee Preview
```
When you go to Withdraw, you'll see:
  Amount: 100 USDT
  Fee (0.1%): 0.10 USDT → min 2 USDT → 2.00 USDT
  You receive: 98.00 USDT

  [Confirm Withdrawal]
```
The fee and arrival amount are shown in real-time as you type the withdrawal amount.

---

## 4. Market & Real-time Quotes

### Search for Symbols

Use the global search bar (Ctrl+K or ⌘+K) to find any trading instrument:

```
Search supports:
  📝 Name:     "腾讯" → HK.00700 Tencent
  🔢 Code:     "00700" or "700" → HK.00700
  🔤 Ticker:   "AAPL" → US.AAPL
  💱 Crypto:   "BTC" → CC.BTCUSD
  🇨🇳 Chinese:  "茅台" → SH.600519
  🌐 English:  "Tesla" → US.TSLA
```

**Smart detection**:
The search engine automatically identifies the market from your input:
- 1-5 digit number → Hong Kong (e.g., `9988` → HK.09988)
- 6-digit, starts with 6 → Shanghai A-share (e.g., `600519`)
- 6-digit, starts with 0 or 3 → Shenzhen A-share (e.g., `000001`)
- Letters only → US (e.g., `MSFT`)
- Chinese characters → full-text name search

### Search Results

```
Each result shows:
  🏷  Symbol code        (e.g., HK.00700)
  📛  Name CN + EN       (腾讯控股 / Tencent)
  🏛  Market             (港股 label)
  💰  Last price         (385.60 HKD)

  Available Brokers:     🟢Futu 🟢Huasheng 🔴Tiger 🔴IBKR
                         (green = connected, red = disconnected)
  Quote Source:          富途
  
  [+ Add to Watchlist]
```

> If a broker shows 🔴: click the symbol → you'll be guided to connect that broker first.

### Real-time Quote Display

```
Watchlist Panel:
┌──────────────────────────────────────────────┐
│  📈 My Watchlist           Source: 富途       │
│                                              │
│  HK.00700  腾讯         385.60  +2.30 (+0.6%)│
│  US.AAPL   Apple Inc    195.80  -0.45 (-0.2%)│
│  CC.BTCUSD Bitcoin    65000.00 +1200 (+1.9%)│
│  SH.600519 贵州茅台     1680.00  +5.00 (+0.3%)│
│                                              │
│  Last updated: 14:32:05 HKT                   │
└──────────────────────────────────────────────┘
```

### Quote Source Indicator

Every watchlist item shows its data source at the bottom-right:

```
  Source: 富途           ← green = healthy (< 50ms)
  Source: Tiger          ← yellow = moderate (50-200ms)
  Source: eToro          ← red = slow (> 500ms)
```

Color codes:
- 🟢 Green: < 50ms — optimal
- 🟡 Yellow: 50-200ms — acceptable
- 🟠 Orange: 200-500ms — degraded
- 🔴 Red: > 500ms — consider switching source

### Market Status Indicator

```
Top of Market/Watchlist page:

  🇭🇰 港股: 交易中 09:30-16:00    ← green indicator
  🇺🇸 美股: 已收盘 16:00-04:00+1  ← gray, next open in 5h

  (Only shown for markets in your watchlist)
```

Markets auto-detect their trading status:
- **交易中** (Trading) — green, live quotes updating
- **已收盘** (Closed) — gray, last closing price shown
- **盘前** (Pre-market) — blue, pre-market quotes if available
- **盘后** (After-hours) — orange, after-hours quotes if available

### Switching Quote Sources

If you prefer a different data source for a symbol:

```
1. Right-click a symbol → "Change Quote Source"
2. Available sources listed: 富途 (45ms) | Tiger (100ms) | IBKR (80ms)
3. Click to switch → new source used immediately
4. Switch is persistent (survives restart)

⚠ Manual override disables auto-failover for this symbol
```

### Broker Priority Settings

Go to Settings → Broker Priority to customize which data source Dawn Whales uses first:

```
┌──────────────────────────────────────────────────┐
│  ⚙️ Broker Priority                                │
│                                                  │
│  Market: [🇭🇰 Hong Kong  ▾]                       │
│                                                  │
│  Drag to reorder (top = highest priority):       │
│                                                  │
│  ☰ 1. 富途         45ms   L2 Depth   🟢 Healthy │
│  ☰ 2. 华盛          120ms  L1 Quote   🟢 Healthy │
│  ☰ 3. 盈立          200ms  L1 Quote   🟢 Healthy │
│  ☰ 4. Tiger         100ms  L1 Quote   🟡 120ms  │
│  ☰ 5. IBKR          80ms   L1 Quote   🔴 Offline │
│                                                  │
│  Changes take effect immediately.                │
│  Drag IBKR up if you prefer it over others.      │
│  Disable a broker: toggle the switch OFF.        │
└──────────────────────────────────────────────────┘
```

Changes auto-save. The quote router uses your custom priority ordering for all symbols in that market.

### K-line Chart Data

```
Open any symbol → click "Chart" tab:

  Period: [1m] [5m] [15m] [30m] [1h] [Day] [Week] [Month]
  
  Data comes from the assigned quote source.
  Cache: 30 seconds — same symbol won't fetch repeat K-lines.
  
  Offline mode: charts load from indexedDB cache.
```

---

## 5. Creator Marketplace

### Tip Live Preview

```
When you tip a creator:

  Creator: @topTrader (L2 — 80% share)
  
  Select Amount: [9.9] [19.9] [49.9] [99.9] [Custom]
  
  You selected: 49.9 USDT
  
  Platform share (20%): 9.98 USDT
  Creator receives:    39.92 USDT
  
  [💝 Send Tip]
```

The platform share updates in real-time as you select the amount. The creator's level is fetched automatically — no manual lookup needed.

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

### Creator Progress Bar

```
Creator Dashboard:

  Current Level: 🟢 L1 (70% share)
  Total Sales: 47 / 100 to L2
  [████████████████░░░░░░░░░░░░] 47% to next level
  
  📈 You need 53 more sales to reach 🔵 L2 (80% share)
```

The progress bar updates after every sale. You can see exactly how close you are to the next tier.
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

## 9. Fee Feedback & Protection

### Deduction Toast
Every time USDT is deducted, a toast notification appears:

```
┌─────────────────────────────────┐
│  💰 Deducted 1.00 USDT          │
│  AI Auto-Drawing                │
│  [View Details]                 │  ← disappears after 2 seconds
└─────────────────────────────────┘
```

The toast is visible but non-intrusive (silent deduction ≠ invisible). Click "View Details" to see the transaction record.

### Refund Visual Feedback
When a fee is refunded (e.g., broker rejection, AI failure):

```
┌─────────────────────────────────┐
│  ↩ Refunded 2.00 USDT           │
│  Trade rejected by broker       │
│  Balance: 1,250.00 → 1,252.00   │  ← green balance update animation
│  [Why refunded?]                │
└─────────────────────────────────┘
```

A green animation shows your balance updating. Click "Why refunded?" for the specific reason.

### FeePreview Component
All order/transaction entry points include a unified **FeePreview** component:

```
  Order: Buy 100 AAPL @ $185.00 = $18,500.00
  Fee (0.1%):   18.50 USDT
  Total Deduction: $18,500.00 + 18.50 USDT
  
  [Place Order]
```

This appears on: Market orders, Strategy entries, Copy trade entries, AI purchases.

### Unified Billing System (v17.6)
All fees go through a single entry point: `billing-service.ts`. There are no longer separate billing pipelines for different features. This ensures:
- One source of truth for all fee calculations
- Consistent deduction/refund logic
- Single transaction history
- No orphaned billing code from old versions (old engines marked `@deprecated`)

---

## 10. Monthly Spending Report

Every month, you can review your spending:

```
📊 June 2026 Spending Report

  💰 Total Spent:     87.50 USDT
  🎨 AI Features:      32.00 USDT (36.6%)
  🛒 Marketplace:      49.90 USDT (57.0%)
  📊 Trading Fees:      5.60 USDT (6.4%)
  ──────────────────────────────
  
  Category Breakdown:
  AI Draw:         5 × 1.00 =  5.00 USDT
  AI Chat:        15 × 1.00 = 15.00 USDT
  AI Optimize:     8 × 1.50 = 12.00 USDT
  Strategy Buy:    1 × 49.90 = 49.90 USDT
  Stock Trades:    2 × 0.10 =  5.60 USDT (avg fee: 2.80)
  
  📈 vs Last Month: +12.50 USDT (16.7% increase)
  
  [Export CSV] [View All Months]
```

Access: Wallet → Monthly Report (or click "📊 Monthly Report" on the wallet page).

The report auto-generates on the 1st of each month and is available anytime.

---

## 11. Settings & Preferences

### Language
Dawn Whales supports 8 languages: 🇨🇳 简体中文 | 🇺🇸 English | 🇯🇵 日本語 | 🇰🇷 한국어 | 🇪🇸 Español | 🇫🇷 Français | 🇩🇪 Deutsch | 🇷🇺 Русский

Go to Settings → Language to change.

### Notifications
Configure notifications for:
- Wallet balance low (below threshold)
- Trade executed or failed
- AI analysis complete
- **Subscription renewal reminder** (24h before expiry, with auto-renew toggle)
- Health check alerts (red status)

### Subscription Renewal
```
When a signal subscription is about to expire:

  ⏰ Subscription Expiring
  "Crypto Momentum Signals" expires in 24 hours.
  
  [🔄 Auto-Renew: ON]  ← toggle on/off
  [Renew Now] [Manage]
```
The reminder appears 24 hours before expiry. Auto-renew is ON by default. You can cancel at any time — the subscription stays active until the end of the current billing period.

### Broker Connection
Go to Settings → Broker to connect your trading accounts.

### Broker Priority & Quote Health

Configure which broker Dawn Whales uses first for quotes. Drag to reorder — changes apply immediately.

```
Settings → Broker Priority:

  Market: [🇭🇰 Hong Kong ▾] [🇺🇸 US] [🇨🇳 A-Share] [💱 Crypto]
  
  ☰ 富途          45ms   🟢   L2 Depth
  ☰ Tiger         100ms  🟡   L1 Quote
  ☰ IBKR          80ms   🔴   Offline
  
  Each market has independent priority ordering.
  Disable a broker: toggle the switch OFF — it won't be used.
```

### Quote Health Dashboard

Monitor all your connected quote sources:

```
Settings → Connection Health:

  Broker     Status    Latency    Error Rate    Uptime
  ─────────────────────────────────────────────────
  富途       🟢 Healthy   45ms       0.1%       99.8%
  Tiger      🟡 Warning  120ms       2.3%       98.1%
  Binance    🟢 Healthy   30ms       0.0%       99.9%
  IBKR       🔴 Offline    —          —          —
  
  [Test Connection] [Refresh All]
```

Color codes: 🟢 Healthy (< 50ms) | 🟡 Warning (50-200ms) | 🟠 Degraded (200-500ms) | 🔴 Offline (> 500ms or disconnected)

### Market Hours Display

Settings → Display → Show Market Hours — toggle on/off:

```
When enabled, the watchlist header shows:

  🇭🇰 HK  09:30-16:00  ▮▮▮▮▮░░░░  (trading, 3h 28m remaining)
  🇺🇸 US  09:30-16:00  ░░░░░░░░░░  (closed, opens in 9h)
```

Auto-detects holidays and early closures based on your connected brokers.

---

## 12. Security

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

> **Version History**:
> - v2.3.0 (2026-06-14) — R152-R154 integration: search bar, real-time quotes, broker priority, market status, quote source indicator
> - v2.2.0 (2026-06-13) — R149-R151 integration: unified billing, fee preview, toast feedback, creator progress, monthly report, subscription renewal
> - v2.1.0 (2026-06-13) — Initial complete manual with wallet, marketplace, AI, TA, trading
