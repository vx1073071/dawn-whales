# Changelog

All notable changes to DAWN WHALES · 道鲸 are documented in this file.

## [0.2.0] - 2026-06-03

### 🆕 New Features

**Core Engines (from scratch)**
- **Backtest Engine** (300 lines): 6 technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR), 5 strategy types, bar-by-bar replay with commission + slippage, full performance metrics (Sharpe, drawdown, win rate, profit factor), equity curve generation
- **Strategy Engine** (350 lines): Real-time signal evaluation on quote push, stop-loss/take-profit enforcement, auto-trade pipeline with risk check, position tracking
- **NL Parser** (250 lines): 5 pattern matchers (MA cross, RSI, MACD, momentum, Bollinger), stop-loss/take-profit extraction, 8 pre-built strategy templates, symbol detection (30+ tickers)
- **Risk Engine** (150 lines): 7 pre-trade checks (frequency, qty, price, value, blacklist, daily loss, concentration), trading hours detection, alert system

**Database**
- 7 tables: strategies, backtest_runs, trades, kline_cache, signal_log, watchlist, settings
- K-line cache reduces OpenD requests, 10x backtest speedup
- Transaction-batched writes

**IPC Layer**
- 30 handlers (up from 18)
- Real-time push events: quotes:push, strategy-signal, risk-alert, order-update, notification

**Frontend Pages (all wired to real backend)**
- **StrategyPage**: NL/template/form creation → backtest → equity curve → live trading
- **MarketPage**: Search 24 popular stocks, add/remove watchlist, K-line charts
- **OrdersPage**: Real-time orders, cancel, strategy trade log
- **SettingsPage**: OpenD connection, risk config sliders, system info
- **PortfolioPage**: Real funds, positions, asset allocation bar chart, auto-refresh
- **MarketplacePage**: Browse strategies, publish modal, revenue split display
- **Header**: Connection status with pulse animation, emergency stop
- **StatusBar**: Push mode indicator, memory usage, watchlist count
- **Sidebar**: Real account balance + today PnL

**Infrastructure**
- **OpenD Auto-Reconnect**: Exponential backoff (1s → 30s, 50 attempts), auto re-subscribe push
- **Auto-Updater**: electron-updater + GitHub Releases, check on launch + every 4 hours
- **CI/CD**: GitHub Actions build → test → package → release
- **Notification Toasts**: Global system for signals, alerts, orders
- **Onboarding**: 3-step wizard (connect → watchlist → first strategy)
- **Unit Tests**: 38 tests (NL parser + backtest engine), run with `npm test`

### 📊 Code Stats
- +3,500 lines of new code
- 20 files modified/created
- 9 commits

---

## [0.1.0] - 2026-06-03

### Initial Release
- Electron 33 + React 18 + TypeScript skeleton
- 9 page UI shells
- OpenD TCP client (protobuf protocol)
- Push mode real-time quotes (<50ms)
- TradingView Lightweight Charts K-line
- SQLite database (basic schema)
- Landing page + GitHub Pages
- Windows NSIS installer (.exe)
