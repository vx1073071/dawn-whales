<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: team
purpose: (auto-generated, needs review)
-->

# Dawn Whales Architecture Guide

> Version: 1.10.0-rc.2 | Last updated: 2026-06-11

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Product Architecture](#product-architecture)
4. [Electron Main Process](#electron-main-process)
5. [Engine Layer](#engine-layer)
6. [Frontend Layer](#frontend-layer)
7. [Data Flow](#data-flow)
8. [IPC Architecture](#ipc-architecture)
9. [WebSocket Layer](#websocket-layer)
10. [Payment & Billing](#payment--billing)
11. [Strategy System](#strategy-system)
12. [Condition Engine](#condition-engine)
13. [Testing Architecture](#testing-architecture)
14. [Build & Deployment](#build--deployment)
15. [i18n System](#i18n-system)
16. [Security Model](#security-model)

---

## Overview

Dawn Whales is a USDT P2P copy-trading desktop application built with Electron + React + TypeScript. It enables cryptocurrency traders to create, share, and subscribe to automated trading strategies.

### Three-Product Split (v1.10.0)

| Product | URL/Entry | Tech | Purpose |
|---------|-----------|------|---------|
| **Landing Page** | dawnwhales.com | Static HTML | Marketing + download |
| **Desktop App** | Electron main | React + TS + Vite | Creator + user entry point |
| **Server** | Single VPS | `/api/*` + `/admin/*` | API + admin dashboard |

### Key Architecture Rules

- DeepSeek API key only on server
- Desktop app never stores AI keys, wallet keys, or billing logic
- Admin panel URL is private (not public-facing)
- Desktop app calls server APIs via JWT authentication

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Desktop App                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ React UI     │  │ IPC Bridge   │  │ Main Process │  │
│  │ (Renderer)   │◄─┤              ├─►│              │  │
│  │              │  │ preload.ts   │  │ engine/      │  │
│  │ src/         │  │ contextBridge│  │ websocket/   │  │
│  └──────────────┘  └──────────────┘  │ strategy/    │  │
│                                       │ payment/     │  │
│                                       └──────┬───────┘  │
└──────────────────────────────────────────────┼──────────┘
                                               │ JWT
                                      ┌────────▼─────────┐
                                      │    Server (VPS)   │
                                      │  /api/*  (REST)   │
                                      │  /admin/* (Web)   │
                                      │  DeepSeek AI      │
                                      └──────────────────┘
```

---

## Product Architecture

### Directory Structure

```
dawn-whales/
├── electron/              # Main process (Node.js)
│   ├── main/              # Entry point, window management
│   ├── engine/            # Trading engine
│   │   ├── core/          # Condition engine, signal engine
│   │   ├── data/          # Kline processor, realtime aggregator
│   │   └── analysis/      # Strategy marketplace API
│   ├── websocket/         # WebSocket manager (market data)
│   ├── strategy/          # Strategy execution
│   ├── broker/            # Broker integration
│   ├── payment/           # USDT payment processing
│   ├── ipc-handlers/      # IPC handler registration
│   ├── ipc/               # IPC channel definitions
│   ├── workers/           # Worker threads
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Shared utilities
│   └── data/              # Data layer
├── src/                   # Renderer process (React)
│   ├── components/        # React components
│   ├── stores/            # State management (Zustand)
│   ├── hooks/             # Custom React hooks
│   ├── i18n/              # Internationalization config
│   ├── locales/           # Translation files (8 languages)
│   ├── lib/               # Utility libraries
│   ├── types/             # Frontend type definitions
│   ├── styles/            # CSS/SCSS
│   ├── stories/           # Storybook stories
│   └── opend/             # OpenD Futu integration
├── tests/                 # Test files (vitest)
├── e2e/                   # E2E tests (Playwright)
├── docs/                  # Documentation
├── scripts/               # Build & utility scripts
└── public/                # Static assets
```

---

## Electron Main Process

### Entry Point

`electron/main/main.ts` handles:
- Window creation and lifecycle
- IPC handler registration
- WebSocket connection management
- Strategy engine initialization

### Key Modules

| Module | File | Responsibility |
|--------|------|----------------|
| Main | `electron/main/main.ts` | App lifecycle, window management |
| IPC Handlers | `electron/main/ipc-handlers.ts` | Channel registration |
| IPC Condition | `electron/main/ipc-handlers-condition.ts` | Condition engine IPC |

---

## Engine Layer

The engine layer (`electron/engine/`) is the core of the trading system.

### Sub-modules

| Sub-module | Directory | Purpose |
|------------|-----------|---------|
| **Core** | `engine/core/` | Condition engine, signal processing |
| **Data** | `engine/data/` | Kline processing, realtime aggregation |
| **Analysis** | `engine/analysis/` | Strategy marketplace API |

### Condition Engine

`electron/engine/core/condition-engine.ts`

The condition engine evaluates trading conditions and generates signals.

**Key exports:**
- `getConditionEngine()` — Singleton factory
- `evaluateCondition(condition, marketData)` — Evaluate a single condition
- `registerCondition(id, config)` — Register new condition type

### Kline Processor

`electron/engine/data/kline-processor.ts`

Processes raw K-line (candlestick) data from market feeds.

**Key exports:**
- `getKLineProcessor()` — Singleton factory for kline processing
- `processKline(data)` — Process single kline tick
- `aggregateKlines(klines, interval)` — Aggregate to higher timeframe

### Realtime Aggregator

`electron/engine/data/realtime-aggregator.ts`

Aggregates real-time market data from multiple sources.

**Key exports:**
- `getRealtimeAggregator()` — Singleton factory
- Emits `update` events with symbol + data payload
- `handleQuoteUpdate(clientId, quote)` — Process incoming quote

---

## Frontend Layer

### Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.x | UI framework |
| Vite | 6.x | Build tool |
| TypeScript | 5.x | Type safety |
| Zustand | — | State management |
| react-i18next | — | Internationalization |
| Tailwind CSS | — | Styling |

### Component Structure

```
src/components/
├── common/          # Shared UI components
│   └── LanguageSwitcher.tsx
├── dashboard/       # Dashboard views
├── market/          # Market data views
├── strategy/        # Strategy editor/listing
├── trading/         # Trading panels
├── wallet/          # Wallet management
└── settings/        # Settings page
```

### State Management

Zustand stores in `src/stores/`:
- Each store manages a domain (market, strategy, wallet, etc.)
- Stores communicate via IPC to main process for data persistence

---

## Data Flow

### Market Data Flow

```
WebSocket Server (market feed)
    │
    ▼
websocket-manager.ts (connection, reconnection, heartbeat)
    │
    ▼
realtime-aggregator.ts (normalize, deduplicate, aggregate)
    │
    ▼
condition-engine.ts (evaluate conditions against data)
    │
    ▼
IPC → Renderer (React state update → UI render)
```

### User Action Flow

```
User clicks "Create Strategy"
    │
    ▼
React Component → IPC call
    │
    ▼
electron/strategy/ (validate, persist)
    │
    ▼
electron/engine/analysis/strategy-marketplace-api.ts
    │
    ▼
Server API (JWT auth) → Database
    │
    ▼
IPC response → React state update → UI refresh
```

---

## IPC Architecture

### Channel Pattern

```typescript
// Definition (electron/ipc/channels.ts)
export const IPC_CHANNELS = {
  STRATEGY_CREATE: 'strategy:create',
  STRATEGY_LIST: 'strategy:list',
  MARKET_SUBSCRIBE: 'market:subscribe',
  // ...
};

// Handler (electron/main/ipc-handlers.ts)
ipcMain.handle(IPC_CHANNELS.STRATEGY_CREATE, async (_event, params) => {
  return strategyService.create(params);
});

// Renderer (via preload contextBridge)
window.electronAPI.strategyCreate(params);
```

### Security

- `contextBridge` exposes only whitelisted APIs
- No `nodeIntegration` in renderer
- All IPC handlers validate input parameters
- `webSecurity: true` enforced

---

## WebSocket Layer

`electron/websocket/websocket-manager.ts`

### Features

- Auto-reconnection with exponential backoff
- Heartbeat monitoring
- Multiple concurrent connections (market data, broker feeds)
- Message queuing during disconnection

### Connection Lifecycle

```
init() → connect() → onOpen → subscribe(symbols)
    │
    ├── onMessage → parse → emit to aggregator
    ├── onClose → reconnect(backoff)
    └── onError → log → reconnect(backoff)
```

---

## Payment & Billing

`electron/payment/`

### Supported Operations

| Operation | Fee | Description |
|-----------|-----|-------------|
| Subscription | 0% | Free tier + paid tiers |
| P2P Transfer | 0.3% × 2 | Sender + receiver |
| Withdrawal | 0.1% | USDT withdrawal |
| Auto-trade (Standard) | 0.1% | Per trade execution |
| Auto-trade (Advanced) | 0.02% | Futures maker |
| Auto-trade (Flagship) | 0.04% | Futures taker |

### Currency

All pricing in USDT (1 USDT ≈ 7.2 CNY).

### Creator Revenue Split

| Tier | Creator Share |
|------|---------------|
| L1 (Standard) | 70% |
| L2 (Advanced) | 80% |
| L3 (Flagship) | 90% |

---

## Strategy System

`electron/strategy/`

### Strategy Lifecycle

```
Draft → Review → Published → Subscribed → Running → Paused → Archived
```

### Strategy Marketplace

`electron/engine/analysis/strategy-marketplace-api.ts`

- Create/list/update/delete strategy listings
- Price validation: 1-1000 USDT
- Category support: trend, mean-reversion, momentum, etc.
- Market filter: A-share, HK, US

---

## Condition Engine

`electron/engine/core/condition-engine.ts`

### Condition Types

| Type | Description | Example |
|------|-------------|---------|
| Price | Price level cross | `price > 100` |
| Volume | Volume threshold | `volume > 10000` |
| Indicator | Technical indicator | `RSI > 70` |
| Time | Time-based trigger | `time >= 09:30` |
| Custom | User-defined logic | Complex expressions |

### Evaluation Pipeline

```
Raw Condition → Parse → Validate → Evaluate(marketData) → Signal
                                                              │
                                                              ▼
                                                     Buy/Sell/Hold
```

---

## Testing Architecture

### Framework

| Tool | Purpose | Config |
|------|---------|--------|
| Vitest | Unit + Integration tests | `vitest.config.ts` |
| Playwright | E2E tests | `playwright.config.ts` |
| @storybook/react | Component testing/docs | `.storybook/` |

### Test Configuration

```typescript
// vitest.config.ts key settings
{
  environment: 'jsdom',
  pool: 'forks',
  poolOptions: { forks: { singleFork: true, isolate: false } },
  testTimeout: 30000,
  hookTimeout: 10000,
  // 21 excluded files (meta-tests + unfixable)
}
```

### Test Categories

| Category | Files | Description |
|----------|-------|-------------|
| Unit | ~250 | Individual function/module tests |
| Integration | ~50 | Cross-module integration |
| Gate-check | ~30 | Quality gates (coverage, i18n, build) |
| E2E | ~12 | Full user workflow (Playwright) |
| Meta-tests | 18 | Excluded: recursive vitest/tsc/build |

### Running Tests

```bash
# Full suite
node --no-warnings node_modules/vitest/vitest.mjs run

# With coverage
node --no-warnings node_modules/vitest/vitest.mjs run --coverage

# Single file
node --no-warnings node_modules/vitest/vitest.mjs run tests/condition-engine.test.ts

# E2E (Playwright)
npx playwright test
```

### Test Metrics (R93 Baseline)

| Metric | Value |
|--------|-------|
| Total test files | 347 |
| Passed files | 275 |
| Failed files | 72 |
| Total test cases | ~5,500 |
| Passed cases | ~5,318 |
| Failed cases | ~194 |
| Duration | ~57s |

---

## Build & Deployment

### Build Pipeline

```bash
# Development
npm run dev          # Vite dev server + Electron

# Production build
npm run build        # Vite build → dist/

# Electron package
npm run package      # electron-builder → installer

# Type check
npx tsc --noEmit     # TypeScript compilation check
```

### Build Tools

| Tool | Purpose |
|------|---------|
| Vite | Frontend bundling |
| electron-builder | Electron packaging |
| TypeScript | Type checking |
| ESLint | Code quality |

### Release Process

1. All tests pass (0 failures)
2. TSC: 0 errors
3. Build: success
4. i18n: < 10,000 hardcoded chars
5. EngineError: ≥ 50% standardized
6. npm audit: 0 critical/high
7. Tag: `v1.10.0`

---

## i18n System

### Framework

- **Library**: react-i18next + i18next
- **Config**: `src/i18n/index.ts`
- **Languages**: 8 (zh-CN, zh-TW, en, ja, ko, fr, it, de)
- **Switcher**: `src/components/common/LanguageSwitcher.tsx`

### Translation Structure

```
src/locales/
├── zh-CN.json
├── zh-TW.json
├── en.json
├── ja.json
├── ko.json
├── fr.json
├── it.json
└── de.json
```

### Usage

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('dashboard.title')}</h1>;
}
```

---

## Security Model

### Threat Model

| Threat | Mitigation |
|--------|------------|
| API key exposure | Keys only on server |
| Wallet key theft | Wallet operations server-side |
| Code injection | `webSecurity: true`, CSP headers |
| XSS | React auto-escaping, no `dangerouslySetInnerHTML` |
| CSRF | JWT with short expiry |
| Man-in-middle | HTTPS only, certificate pinning |

### Electron Security

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- No remote module
- Preload script with contextBridge (whitelisted APIs only)

### Admin Panel Security

- Separate URL (not public)
- 2FA required
- Rate limiting
- Audit logging

---

*This document is maintained as part of R93 D-01. For contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).*
