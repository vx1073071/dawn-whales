# R26 Demo Script — Sprint 1 Final Demo

**Version**: v0.6.0
**Duration**: ~10 minutes (10 scenes × ≤1 min)
**Presenter**: PM/WB
**Date**: 2026-06-06

---

## Scene Flow

```
Onboarding → Dashboard → Market → Strategy → Backtest → Trade → Risk → Alert → Settings → Portfolio → (Bonus: Multi-Broker)
```

---

## Scene 1: Onboarding (45s)

**Goal**: First-time user experience

1. Launch app → Onboarding page shows
2. Step 1: "Connect Broker" → Enter OpenD host/port
3. Step 2: "Set Risk Preferences" → Default config
4. Step 3: "Ready to Trade" → Land on Dashboard
5. Note: onboarding only shows first launch

**Expected result**: 3-step flow, localStorage remembers completion

---

## Scene 2: Dashboard (60s)

**Goal**: Real-time market overview

1. Dashboard loads with sidebar (account balance, today PnL)
2. Top bar shows: Futu OpenD ✅ Connected, memory usage
3. Quote cards for watchlist stocks (WS real-time push)
4. Click a stock → navigates to Market page
5. Emergency Stop button visible in top bar

**Expected result**: Real-time WS quotes flowing, green/red indicators

---

## Scene 3: Market (60s)

**Goal**: Stock search + K-line chart

1. Search "TQQQ" → auto-complete shows US.TQQQ
2. Click "Add to Watchlist" → appears in sidebar
3. K-line chart loads (daily, 200 candles)
4. Switch period: daily → hourly → 5-min
5. "Remove from Watchlist" → watchlist updates live

**Expected result**: Search works, chart renders, period switching smooth

---

## Scene 4: Strategy Creation (60s)

**Goal**: NL → Strategy pipeline

1. Click "New Strategy" → Natural Language tab
2. Type: "如果TQQQ价格低于50天均线的95%，就买入100股，止损设置为买入价的-5%"
3. Click "Parse" → form fills: symbol=US.TQQQ, buy=MA50 crossover, SL=-5%
4. Switch to Template tab → select "MA Crossover"
5. Adjust params: fast=10, slow=50, takeProfit=10%

**Expected result**: NL parsing → template form → both populated correctly

---

## Scene 5: Backtest (60s)

**Goal**: Backtest pipeline

1. With strategy selected, click "Run Backtest"
2. Select period: daily, 2 years, initial capital $100,000
3. Click "Run" → progress bar → results display
4. Results show: total return, Sharpe, max drawdown, win rate
5. Equity curve chart renders
6. Click "Save Result" → persists to DB

**Expected result**: Backtest completes < 5s, metrics + chart render

---

## Scene 6: Trade Dashboard (60s)

**Goal**: Real-time trading overview

1. Navigate to Trade Dashboard (IPC real data, no mock)
2. Positions table: US.TQQQ (2,000 shares) + US.NVDA (100 shares)
3. Day PnL column updates with WS quotes
4. Quick actions: "Buy 100" / "Sell 50" buttons per position
5. "New Order" button → switches to Trade Execution

**Expected result**: Live position data, PnL updates, no mock fallback

---

## Scene 7: Trade Execution (60s)

**Goal**: Order placement pipeline

1. Select order type: Market / Limit / Stop / Stop-Limit
2. Select side: BUY
3. Enter: US.TQQQ, quantity 100
4. Click "Place Order" → confirmation dialog
5. Confirm → order sent → appears in Trade History
6. Risk engine validates (confidence, duplicate, position limits)

**Expected result**: Order placed, risk check passes/fails, history updated

---

## Scene 8: Risk Dashboard (45s)

**Goal**: Risk monitoring

1. Navigate to Risk Dashboard
2. 7 risk indicators visible: daily loss, margin, concentration, volatility, etc.
3. Green/yellow/red status per indicator
4. Real-time unrealized PnL + margin usage
5. Emergency Stop button prominently displayed
6. Click Emergency Stop → confirmation → all strategies halted

**Expected result**: All 7 indicators reactive, Emergency Stop works

---

## Scene 9: Alert Center (30s)

**Goal**: Alert history

1. Navigate to Alert Center
2. Alert list: strategy signals, risk warnings, order confirmations
3. Each alert: type icon + timestamp + message
4. Click an alert → marks as acknowledged
5. Filter by type: Signal / Risk / Order

**Expected result**: Alert list populated, filtering works

---

## Scene 10: Settings (30s)

**Goal**: Configuration

1. Navigate to Settings
2. OpenD Connection: host 127.0.0.1, port 11111 → Connect/Disconnect button
3. Risk Config: max daily loss, max position %, blacklist stocks
4. System Info: version 0.6.0, platform, node version
5. Check for Updates button (shows "up to date" or triggers update)

**Expected result**: Settings persists, connection toggle works

---

## Scene 11 (Bonus): Portfolio + Multi-Broker (30s)

**Goal**: Asset overview

1. Navigate to Portfolio
2. Total assets: cash + market value
3. Asset allocation bar chart (by sector/stock)
4. Position breakdown table
5. *(R26 target)* BrokerSelector: "Futu" / "Moomoo" dropdown
6. *(R26 target)* Cross-broker aggregation

**Expected result**: Portfolio data correct, broker switching shows different data

---

## Recording Checklist

- [ ] Scene 1: Onboarding
- [ ] Scene 2: Dashboard
- [ ] Scene 3: Market
- [ ] Scene 4: Strategy
- [ ] Scene 5: Backtest
- [ ] Scene 6: Trade Dashboard
- [ ] Scene 7: Trade Execution
- [ ] Scene 8: Risk Dashboard
- [ ] Scene 9: Alert Center
- [ ] Scene 10: Settings
- [ ] (Bonus) Scene 11: Portfolio + Multi-Broker

**Output Format**: GIF or MP4 per scene, compiled into `docs/demo/sprint1-demo-r26.md`

---

## Recording Tips

1. **Cursor visible**: Show mouse movements clearly
2. **Slow clicks**: 0.5s pause before each click so viewers can follow
3. **Narrate or caption**: Add text captions for each action if no voice
4. **720p minimum**: Record at 1280×720 or higher
5. **Dark theme**: App uses #0d1117 background — ensure recording contrast
6. **Clean desktop**: Close other apps, hide taskbar if possible
7. **Fresh profile**: Clear localStorage before recording for onboarding scene
