# quant-moo v2.0.0 — Architecture & IPC Reference

**Last updated:** 2026-06-13 (R128 final)
**Target:** v2.0.0 — Production Release Candidate

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        quant-moo v2.0.0                        │
│                    AI-Powered Investment Platform                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐     ┌──────────────────────┐           │
│  │   Electron Main     │     │   Native Modules     │           │
│  │   (main.ts)         │────▶│   - better-sqlite3   │           │
│  │                     │     │   - keytar (pending)  │           │
│  │  ┌───────────────┐  │     └──────────────────────┘           │
│  │  │ ipc-setup.ts  │  │                                         │
│  │  │  - Broker IPC │  │     ┌──────────────────────┐           │
│  │  │  - Chart IPC  │  │     │   Broker Adapters    │           │
│  │  │  - Trade IPC  │  │     │   - Futu (OpenD)     │           │
│  │  │  - SQLite IPC │  │     │   - Binance (REST)   │           │
│  │  │  - DataPipe   │  │────▶│   - OKX (REST)       │           │
│  │  └───────────────┘  │     │   - Bybit (REST)     │           │
│  │                     │     │   - Bitget (REST)    │           │
│  │  ┌───────────────┐  │     │   - Tiger (Bridge)   │           │
│  │  │ browser.ts    │  │     │   - Longbridge(Brdg) │           │
│  │  │  - CSP        │  │     │   - ... 9 more       │           │
│  │  │  - sandbox:✓  │  │     └──────────────────────┘           │
│  │  │  - Security   │  │                                         │
│  │  └───────────────┘  │     ┌──────────────────────┐           │
│  └─────────────────────┘     │   External APIs      │           │
│           │                  │   - Market Data      │           │
│           │ IPC              │   - News/Analysis    │           │
│           ▼                  └──────────────────────┘           │
│  ┌─────────────────────┐                                         │
│  │   Preload (IPC)     │                                         │
│  │   preload.ts        │                                         │
│  │   contextBridge     │                                         │
│  │   sandbox:true      │                                         │
│  └─────────────────────┘                                         │
│           │                                                      │
│           │ contextBridge API                                    │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │   Renderer (React 18 + Vite 6)                          │    │
│  │   sandbox:true, nodeIntegration:false                   │    │
│  │                                                         │    │
│  │   Components:     Engines:     Services:                │    │
│  │   - KLineChartPro - Indicators - bridge-api             │    │
│  │   - OrderBook     - Depth      - i18n (9 locales)       │    │
│  │   - MarketScanner - Pattern    - Theme (CSS vars)       │    │
│  │   - DOMLadder     - Drawing    - Price Locale           │    │
│  │   - CBBOPanel     - WS Pool    - Data Pipeline          │    │
│  │   - Arbitrage     - Microstruct - Notification          │    │
│  │   - ... 100+ more              - SignalShare            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 2. IPC Channel Map (v2.0.0)

### Broker Channels

| Channel | Direction | Parameters | Returns |
|---------|-----------|------------|---------|
| `broker:connect` | invoke | `BrokerConfig` | `{ connected, brokerId }` |
| `broker:disconnect` | invoke | — | `{ disconnected }` |
| `broker:getAccounts` | invoke | — | `BrokerAccount[]` |
| `broker:getFunds` | invoke | `accountId` | `FundInfo` |
| `broker:getPositions` | invoke | `accountId` | `PositionInfo[]` |
| `broker:getQuotes` | invoke | `string[]` | `QuoteInfo[]` |
| `broker:getKlines` | invoke | `code, period, count` | `KlineBar[]` |
| `broker:subscribe` | invoke | `string[]` | `{ subscribed }` |
| `broker:placeOrder` | invoke | `OrderRequest` | `OrderResult` |
| `broker:cancelOrder` | invoke | `orderId` | `{ cancelled }` |
| `broker:list-factories` | invoke | — | `FactoryInfo[]` |
| `broker:quote-push` | push | `TaggedQuoteInfo` | — |
| `broker:ws-message` | push | `{ brokerId, data }` | — |

### Database Channels (R128 sandbox:true)

| Channel | Direction | Parameters | Returns |
|---------|-----------|------------|---------|
| `db:all` | invoke | `sql, params?` | `{ success, data }` |
| `db:get` | invoke | `sql, params?` | `{ success, data }` |
| `db:run` | invoke | `sql, params?` | `{ success, data }` |
| `db:exec` | invoke | `sql` | `{ success }` |
| `db:query` | invoke | `{ sql, type, params? }` | `{ success, data }` |

### Data Pipeline (R122)

| Channel | Direction | Parameters | Returns |
|---------|-----------|------------|---------|
| `pipeline:quote-aggregate` | invoke | `QuoteInfo[]` | `KlineBar[]` |
| `pipeline:depth-stream` | invoke | `string[]` | `OrderBookSnapshot` |
| `pipeline:tick-stream` | invoke | `string[]` | `TickRecord[]` |
| `pipeline:cbbo-stream` | invoke | `string[]` | `CBBOUpdate` |
| `pipeline:alert-stream` | invoke | `AlertConfig` | `AlertEvent[]` |

### Chart & Indicator (R113-R120)

| Channel | Direction | Parameters | Returns |
|---------|-----------|------------|---------|
| `indicator:compute` | invoke | `IndicatorRequest` | `IndicatorResult` |
| `chart:data-push` | push | `ChartUpdate` | — |
| `chart:ws-pool-status` | invoke | — | `WSPoolStatus` |
| `quote:diff-push` | push | `DifferentialUpdate` | — |

### Signal & Trading (R124)

| Channel | Direction | Parameters | Returns |
|---------|-----------|------------|---------|
| `signal:share` | invoke | `SignalShareRequest` | `ShareLink` |
| `signal:get-shared` | invoke | `token` | `SignalData` |
| `signal:copy-trade` | invoke | `CopyTradeConfig` | `CopyTradeResult` |
| `signal:stop-copy` | invoke | `copyId` | `{ stopped }` |

## 3. Security Architecture (R127)

```
Layer 1: BrowserWindow sandbox
  ├── sandbox: true          ✅ R128
  ├── contextIsolation: true ✅
  ├── nodeIntegration: false ✅
  └── webSecurity: true      ✅

Layer 2: CSP Headers
  ├── default-src 'self'
  ├── script-src 'self' 'unsafe-inline' (+ 'unsafe-eval' dev only)
  ├── connect-src 'self' ws://127.0.0.1:* wss://*
  ├── frame-src 'none'
  └── object-src 'none'

Layer 3: IPC Security
  ├── Input sanitization     ✅ ipc-input-sanitizer.ts
  ├── Rate limiting          ✅ ipc-hardening.ts
  ├── Channel whitelist      ✅ preload.ts
  └── Schema validation      ✅ IPC_SCHEMA_COVERAGE

Layer 4: Supply Chain
  ├── npm audit: 0 vulns     ✅
  ├── DOMPurify XSS          ✅
  ├── No eval in production  ✅ (CSP blocks)
  └── TLS for all APIs       ✅

Layer 5: Data
  ├── SQLite local only      ✅
  ├── Broker creds local     ✅
  ├── Zero telemetry         ✅
  └── No cloud backup        ✅
```

## 4. Build Process

```
1. vite build
   ├── Renderer: src/ → dist/
   ├── Main: electron/ → dist-electron/main.cjs (586KB)
   └── Preload: electron/preload.ts → dist-electron/preload.cjs (15KB)

2. electron-builder
   └── Packages app + asar → quant-moo Setup.exe (<400MB)

3. Release
   └── git tag v2.0.0 + CHANGELOG
```

## 5. Key Metrics (v2.0.0)

| Metric | Target | Actual |
|--------|--------|--------|
| TSC errors | 0 | ✅ 0 |
| npm audit | 0 | ✅ 0 |
| Build size | <400MB | ✅  |
| Startup time | <3s | ✅ |
| @ts-nocheck count | 0 |  |
| sandbox:true | ✅ | ✅ |
| CSP enforcement | ✅ | ✅ |
| IPC channels | documented | ✅ |
| Languages (i18n) | 9 | ✅ |
| Server components | >100 | ✅ |
| Engine modules | >150 | ✅ |

## 6. Environment

- Node.js: v24.16.0
- Electron: 34.5.4
- TypeScript: 5.9.3
- React: 18.3.x
- Vite: 6.4.3
- better-sqlite3: latest
- DOMPurify: latest
