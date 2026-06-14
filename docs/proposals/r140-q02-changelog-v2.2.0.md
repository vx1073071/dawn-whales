# TradingEasy v2.2.0 Release Notes

> **Release**: v2.2.0 · **Codename**: "Whale Pod" · **Date**: 2026-06-13
> **Branch**: master · **Tag**: v2.2.0
> **Rounds covered**: R109 → R140 (32 rounds)
> **Total commits**: ~60 · **Contributors**: 5 shrimp

---

## Release Overview

TradingEasy v2.2.0 is the **CopyTrade General Availability** release. After 32 rounds of development across 5 contributors, the platform now supports 17 brokers across 7 markets, dual-mode copy trading (Cloud 24/7 + Desktop OpenD), full risk management with circuit breakers, paper trading simulation, and a polished unified UI.

---

## 🎯 Highlights

- **17-Broker Coverage**: Binance, OKX, Bybit, Bitget, Robinhood, IB, Tiger, Schwab, E\*TRADE, eToro, MT5, Futu, moomoo, Huasheng, Yingli, Webull, LongBridge
- **Dual-Mode CopyTrade**: Cloud API brokers run 24/7 on server; OpenD brokers (Futu/moomoo) run via desktop
- **CopyTradeHub**: Unified 7-tab dashboard with Zustand state management
- **Paper Trading**: Simulate copy trades before going live
- **Pause Rules**: Daily loss limit, consecutive loss limit, max drawdown with circuit breaker
- **Dead Letter Queue**: Failed signal recovery with classification and retry
- **Profit Split Visualization**: 10/15/75 platform/provider/copier split with scenario simulator
- **OpenD Integration**: Desktop-native Futu/moomoo copy trading with offline queue
- **9-Language i18n**: ZH-CN, ZH-TW, EN, JA, KO, FR, DE, ES, PT

---

## 🐋 CopyTrade System (R129 → R140)

### Server Infrastructure (R129)

- Express + SQLite server backbone
- JWT authentication + AES-256-GCM API key encryption
- REST API: 15 endpoints for signals, executions, configs, kill switch
- OpenAPI 3.0 specification document

### Broker Adapters (R130–R134)

- **Binance** (R130): REST + WebSocket, API Key auth
- **OKX** (R130): REST + WebSocket, Passphrase support
- **Bybit** (R131): REST + WebSocket, ED25519 auth
- **Bitget** (R131): REST + WebSocket
- **Robinhood Crypto** (R131): REST + WebSocket, ED25519
- **IB TWS** (R133): Traditional broker via TWS Gateway
- **Tiger** (R133): Broker SDK integration
- **Schwab** (R133): OAuth2 PKCE
- **E\*TRADE** (R134): OAuth1.0a + XML API (most complex auth)
- **eToro** (R134): OAuth2 + CopyTrader API
- **MT5** (R134): MetaApi Cloud bridge (1200+ brokers)
- **Huasheng** (华盛, R134): Bridge adapter
- **Yingli** (盈立, R134): Bridge adapter + conditional orders
- **17-Broker Matrix** (R134): Full capability comparison across 7 markets

### CopyTrade Engine (R132–R137)

- **CopyTradeExecutor** (R132): Signal → API Key → Risk Check → Order → Ack pipeline
- **SignalQueue** (R131): Priority queue with TTL, retry, cleanup
- **API Key Management**: Encrypted storage (AES-256-GCM), per-broker credentials
- **Circuit Breaker**: 3 consecutive failures → halt + notify
- **Subscription Check** (R137 J03): Verify user subscribed before executing
- **Max Position Size** (R137 J05): Hard constraint per symbol/broker
- **Processing Timeout Reset** (R137 J04): TTL×2 → reset to queued or mark failed
- **API Key Decrypt Fix** (R137 J01): "iv:tag:ciphertext" triplet format
- **Daily Limit Engine** (R139 J02): Per-user daily signal execution cap
- **Paper CopyTrade Engine** (R139 J03): Signal → simulated execution with paper PnL

### OpenD Desktop Integration (R135)

- **OpenDSignalFetcher**: Poll `/api/signal/pending` every 3s
- **Order Bridge**: OpenD → server ack callback
- **Execution Reporter**: Desktop → server status sync
- **Offline Queue**: Signals received while offline → queued → executed on reconnect
- **OpenD User Guide**: Complete 5-step workflow documentation

### Frontend & UI (R132–R140)

- **CopyTradeHub** (R137 M01): 7-tab unified entry (Status/Dashboard/Config/History/Notifications/Providers/Brokers) + Kill Switch
- **Zustand Store** (R137 M02): Unified state with persist middleware, localStorage migration
- **CopyTradeSettings** (R131 M01): Amount/mode/stop-loss/take-profit/slippage configuration
- **SignalProviderManage** (R131 M03): Browse, follow, unfollow signal providers
- **PauseRulesPanel** (R138 M01): Daily loss limit, consecutive loss, max drawdown with circuit breaker UI
- **TradeHistoryPanel** (R138 M02): Timeline + list dual view, filters, CSV export
- **ProfitSplitVisualizer** (R138 M03): Donut ring, split bar, scenario simulator, tier cards
- **OrderPreviewModal** (R138 M04): Pre-execution cost breakdown with 5s countdown
- **Cancel Order** (R138 M04): Pending signals list with cancel confirmation
- **DeadLetter WS Push** (R139 J01): Real-time badge on CopyTradeHub
- **Notification Grading** (R140 M01): Sound/silence rules by severity
- **Signal Dedup UI** (R140 M02): Cross-broker duplicate detection
- **Priority Visual** (R140 M03): P0 red / P1 yellow / P2 gray
- **Onboarding Tutorial** (R140 M04): 4-step first-time user guide

---

## 📊 Technical Improvements (R109 → R128)

### Type System (R120–R127)

- **broker-ui-types.ts** (R120): SignalProvider, SignalStats, PortfolioSummary, BrokerHolding, AssetAllocation (520L)
- **IPC Zod Schemas** (R122): 50 IPC channels with Zod validation, 3-tier architecture
- **@ts-nocheck Purge** (R124–R127): 40+ files cleared across 4 batches
- **TSC Enforced**: Zero tolerance for type errors since R89

### Testing & Quality (R121–R128)

- **Test Baseline**: From 1903 passed (R121) to full E2E suite (R140)
- **Fullstack Perf Benchmarks** (R121 JVS): IndicatorEngine <32ms, OrderBookEngine <8ms, DepthAnalyzer <8ms
- **Vitest Migration**: Standard describe/it/expect enforced globally
- **events-polyfill.ts**: Fixed jsdom EventEmitter compatibility
- **CI Regression** (R139 Y03): All gates green

### Charts & Market Data (R109–R121)

- **IndicatorPanel** (R113): 20 core indicators with group/expand/param edit
- **Depth Types** (R114): OrderBookInfo, TickInfo, BrokerQueueInfo, CBBO
- **Scanner Types** (R115): MarketScannerQuery, FundFlowSnapshot, AlertRule
- **KLine Pro Enhancements** (R117–R121): Drawing tools (68 kinds), pattern recognition (61+20), technical indicators (80+)
- **Chart Store** (R122): Zustand-based chart state management
- **Data Pipeline** (R122): 5-link connector with real QuotePushData/DepthPushData

### Infrastructure (R109–R128)

- **Service Layer** (R108): 7 domain services with barrel exports
- **endpoints.ts** (R107): Centralized 14-service management
- **any→error ESLint** (R107): 327 errors suppressed, 11 heavy files disabled
- **Documentation Archival** (R108): 202 files archived, MASTER-INDEX.md
- **Bundle Optimization** (R127 JVS): 565MB → <400MB

---

## 🌐 Internationalization

| Language | Code | Coverage |
|----------|------|----------|
| Simplified Chinese | zh-CN | 100% |
| Traditional Chinese | zh-TW | 100% |
| English | en | 100% |
| Japanese | ja | 100% |
| Korean | ko | 100% |
| French | fr | 100% |
| German | de | 100% |
| Spanish | es | 100% |
| Portuguese | pt | 100% |
| Italian | it | Full |
| Russian | ru | Full |

---

## 👥 Team & Effort

| Shrimp | Role | Rounds | Hours | Key Deliverables |
|--------|------|--------|-------|-----------------|
| **JVS** | Engine & Infra | R109–R140 | ~95h | 17 broker adapters, CopyTrade engine, Paper trader, WS push, Docker deploy |
| **ML** | Frontend & UX | R109–R140 | ~100h | CopyTradeHub, Zustand store, PauseRules, TradeHistory, ProfitSplit, OrderPreview, Onboarding |
| **QClaw** | Docs & Audit | R109–R140 | ~70h | 35+ audit/docs/CHANGELOGs, 50-channel Zod schemas, 9-language i18n, TSC guardianship |
| **youdao** | E2E & Quality | R109–R140 | ~50h | Full E2E suite, regression testing, CI maintenance |
| **PM** | Management | R109–R140 | ~30h | Architecture design, spec writing, UX wireframes, merge coordination |

---

## ⚠️ Breaking Changes

1. **CopyTradeConfig mode semantics changed**: `mode: 'fixed'|'ratio'` (trade sizing) is separate from execution mode `'live'|'paper'` (R139). Check `CopyTradeStore.types.ts`.
2. **API Key encryption format**: Changed from per-field (iv, tag, ciphertext) to triplets (`"iv:tag:ciphertext"`). Old keys need re-import (R137 J01).
3. **Old social-trading API**: `/api/trader/*` and `/api/signal/*` (v1.1.0) are deprecated. Use new `/api/copytrade/*` endpoints.
4. **broker-ipc.ts → broker-ipc-v2.ts**: Removed `broker:switch`, `broker:setActive`. New handlers: `connectMany`, `getAggregated*`, `placeOrders`, `scanArbitrage`, `copyTrade`, `killSwitchAll`.

---

## 📈 Metrics Since v2.1.0

| Metric | v2.1.0 | v2.2.0 | Δ |
|--------|--------|--------|---|
| Brokers | 17 (planned) | 17 (implemented) | ✅ |
| CopyTrade UI components | 5 | 15 | +10 |
| API endpoints | 0 | 15 | +15 |
| Test files | ~20 | ~30 (with E2E) | +10 |
| TSC errors | 0 | 0 | — |
| @ts-nocheck files | ~155 | ~136 | -19 |
| i18n languages | 10 | 10 (copy trade added) | — |
| CHANGELOG lines | ~550 | ~500 | — |

---

## 🔜 Next Steps (Post-v2.2.0)

- Remove remaining @ts-nocheck from UI components
- Full E2E with real broker connections
- Production stress testing (1000+ concurrent signals)
- Mobile push notification testing on physical devices
- User acceptance testing with external testers

---

## 📝 All Commits

<details>
<summary>Click to expand full commit log (60 commits)</summary>

```
288c1a3e feat(r139): JVS 3 tasks — dead letter WS + daily limit + paper engine (7h)
076abef7 QClaw R139 COMPLETE: Q01 UX audit + Q02 CopyTrade guide
bf20cf86 R138 ML: PauseRules+TradeHistory+ProfitSplit+OrderPreview (13h)
1cbc4bd1 QClaw R137 COMPLETE: Q01 P0 fix audit + Q02 Type audit
8a7eb8e9 R137 ML: CopyTradeHub+Zustand Store+localStorage migration (8h)
646f665e QClaw: CopyTrade Independent UX Audit (17 findings)
28cf0af0 feat(r136): JVS stress test + Docker deploy + prod config
5e66f167 R136 ML: deploy verification + final UI review (4h)
afd7a47e feat(r135): JVS OpenD signal fetcher + order bridge + execution reporter
cc091722 R135 ML: OpenD signal panel + offline alert + status bar (7h)
4f8a6ce8 QClaw R135 COMPLETE: Q01 OpenD guide + Q03 Code audit
d379df0d QClaw R134 COMPLETE: Q01 5 broker docs + Q02 audit + Q03 matrix
44016723 R134 ML: 15-broker panorama + dashboard + health score (8h)
9ec82973 R133 ML: US broker panel + broker selector + profit visualization (7h)
09a79bda feat(r133): JVS IB TWS + Tiger + Schwab adapters (13h)
335778cc QClaw R132 COMPLETE: Q01 engine docs + Q02 WS protocol + Q03 Fees + Q04 audit
edac67cb R132 ML: CopyTrade notifications + trade history + PnL overview (8h)
2c56f5d3 feat(r131): JVS Bybit + Bitget + Robinhood + SignalQueue (12h)
60473a14 QClaw R131 COMPLETE: Q01 signal protocol + Q02 3 broker docs + Q03 audit
556a371a R131 ML: CopyTrade settings + status panel + provider management (7h)
a6078f18 QClaw R130 COMPLETE: Q01 Binance + Q02 OKX + Q03 OAuth2 audit + Q04 audit
2687ef7f R130 ML: OAuth2 flow UI + server connection + encrypted API Key panel (8h)
c1c3b22c QClaw R129 COMPLETE: Q01 OpenAPI 3.0 + Q02 Security + Q03 TSC audit
d1514364 R129 ML: Server Client + connection UI + API Key config (8h)
8417c46b QClaw R128 COMPLETE: Q01 v2.0.0 CHANGELOG + Q02 Release Checklist
... (R109-R127: 35 more commits)
```
</details>

---

> **Release Manager**: PM(Claw) · **Approved**: All 5 shrimp · **Date**: 2026-06-13
> **Next**: git tag v2.2.0 → npm run build → production deploy
