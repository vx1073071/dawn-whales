# DAWN WHALES Changelog

## [0.6.0] - 2026-06-06

### Sprint 1 Complete
- **Tests**: 116/116 pass (5 files), exit 0
- **Build**: 0 errors, 0 warnings
- **.exe**: DAWN WHALES Setup 0.6.0.exe

### R24 (ML)
- Electron .exe packaging (dist:win) verified
- DashboardPage WebSocket real-time quote integration
- package.json test script standardized (vitest run)
- vite.config.ts excludes legacy main() tests

### R24 (JVS)
- preload.ts trade(16) + ws(10) API bridge
- RiskDashboardPage (541 lines) + AlertCenterPage (473 lines)
- WS-Trade bridge engine

### R24 (QClaw)
- TradeExecutor expanded tests (48/48 pass)
- RiskEngine v2 validation

### R25 (JVS)
- WS-Trade E2E: 21 tests pass
- Risk/Alert realtime data integration
- Moomoo Adapter (412 lines, IBrokerAdapter implementation)
- Multi-Broker Design doc (277 lines)

### R25 (ML)
- E2E core scenarios expanded: 30/30 pass
- Trade Dashboard route + Sidebar navigation
- TradeDashboard IPC integration (real broker data)
- Logo white corners removed (PNG transparency)
- System tray icon + window icon from logo (was code-drawn diamond)

### R22-R23
- TradeDashboardPage UI (360 lines)
- Strategy Backtest Pipeline tests (10/10)
- useWebSocketQuotes hook
- Trade Execution Engine (1638 lines)

### v0.5.0 (R20-R21)
- Electron startup fixed (CJS interop patch)
- AlertCenter IPC stubs (8 monitor functions)
- Test coverage: 92.9% → 97.9%

### v0.4.0 (R18-R19)
- Strategy Engine + NL Parser integration
- strategy:execute IPC handler (NL → Strategy → Backtest)
- 38/38 integration tests

### v0.3.0 (R16-R17)
- Notification system
- K-line period selector
- Asset allocation bar charts
- Strategy marketplace publish
- Sidebar balance display
- 15 strategy templates
- Custom app icon

### v0.2.0 (R14-R15)
- Backtest engine (6 indicators, 5 strategies)
- Strategy engine (real-time signals, stop-loss/take-profit)
- NL parser (5 pattern matches, 8 templates)
- Risk engine (7 checks, daily loss limit, alerts)
- Database (7 tables, K-line cache)
- IPC layer (25 handlers, event push)
- CI/CD (GitHub Actions build + release)
- Auto-updater (electron-updater, 4h check)

### v0.1.0 (R1-R13)
- Initial Electron + React + TypeScript scaffold
- Landing page (dawnwhales.io)
- GitHub Pages deployment
- Project architecture docs
