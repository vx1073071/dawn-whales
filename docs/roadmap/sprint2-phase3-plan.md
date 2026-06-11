<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: PM
purpose: (auto-generated, needs review)
-->

# Sprint 2 Phase 3: Multi-Broker Support — Technical Plan

> **Author:** Engineering Team
> **Created:** 2026-06-06
> **Status:** Draft — Pending Review
> **Estimated Duration:** 4 weeks (Week 1–4)
> **Goal:** Evolve from single Futu OpenD to a unified multi-broker platform supporting Futu, moomoo, and Interactive Brokers.

---

## 1. Overview

### 1.1 Current State

Dawn Whales currently operates with a **single broker backend**: Futu OpenD. All market data, order routing, and account management flow through a single `FutuOpenDClient` instance. This limits users to Futu-supported markets and a single account.

### 1.2 Target State

A unified multi-broker architecture where:

- **Futu OpenD** remains the primary broker for US/HK markets.
- **moomoo OpenD** is added as a secondary broker (Singapore/HK focus, API-compatible with Futu).
- **Interactive Brokers (IB)** is integrated for advanced users requiring global exchange access, options chains, and complex order types.

All three brokers operate behind a single `IBrokerAdapter` interface, managed by `BrokerManager`, with unified streaming via the existing WS Market Data Engine.

### 1.3 Timeline

| Phase | Scope | Weeks |
|-------|-------|-------|
| Phase 3A | moomoo Adapter | Week 1–2 |
| Phase 3B | IB Adapter | Week 2–3 |
| Phase 3C | Unified Account Management & UI | Week 3–4 |

### 1.4 Success Criteria

- All three brokers connect, authenticate, and stream quotes concurrently.
- Cross-broker position aggregation displays correctly in the portfolio view.
- Order routing respects per-broker market hours and instrument eligibility.
- No regression in single-broker (Futu-only) mode.

---

## 2. Current Architecture Analysis

### 2.1 Core Components

```
┌─────────────────────────────────────────────────┐
│                  Renderer (React)                │
│  ┌───────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ Sidebar   │  │ MarketPanel  │  │ OrderForm│  │
│  └─────┬─────┘  └──────┬───────┘  └────┬─────┘  │
│        │               │               │         │
│  ┌─────┴───────────────┴───────────────┴──────┐  │
│  │          preload.ts — broker: namespace     │  │
│  └─────────────────────┬───────────────────────┘  │
└────────────────────────┼─────────────────────────┘
                         │ IPC
┌────────────────────────┼─────────────────────────┐
│                  Main Process (Electron)          │
│  ┌─────────────────────┴───────────────────────┐  │
│  │              BrokerManager                   │  │
│  │  ┌──────────────┐  ┌─────────────────────┐  │  │
│  │  │FutuOpenDClient│  │ WS Market Data Eng. │  │  │
│  │  │(futu-opend.ts)│  │ (ws-engine.ts)      │  │  │
│  │  └──────────────┘  └─────────────────────┘  │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 2.2 Key Files

| File | Role | Lines (approx) |
|------|------|----------------|
| `electron/broker/futu-opend.ts` | Futu OpenD client, implements `IBrokerAdapter` | ~480 |
| `electron/broker/broker-manager.ts` | Lifecycle management for broker instances | ~220 |
| `electron/broker/types.ts` | `IBrokerAdapter` interface and shared types | ~150 |
| `electron/market/ws-engine.ts` | Unified WS streaming engine | ~350 |
| `preload/index.ts` | Exposes `broker:` namespace to renderer | ~90 |

### 2.3 IBrokerAdapter Interface (Current)

```typescript
// electron/broker/types.ts
export interface IBrokerAdapter {
  readonly id: string;
  readonly name: string;
  readonly status: BrokerStatus;

  connect(config: BrokerConfig): Promise<void>;
  disconnect(): Promise<void>;

  // Market Data
  subscribeQuote(symbols: string[]): Promise<QuoteSubscription>;
  unsubscribeQuote(subId: string): Promise<void>;
  getSnapshot(symbol: string): Promise<QuoteSnapshot>;

  // Trading
  placeOrder(order: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  getOpenOrders(): Promise<Order[]>;
  getOrderHistory(filter?: OrderFilter): Promise<Order[]>;

  // Account
  getAccountInfo(): Promise<AccountInfo>;
  getPositions(): Promise<Position[]>;
  getPnL(): Promise<PnLSummary>;
}
```

### 2.4 BrokerManager Lifecycle

```typescript
// electron/broker/broker-manager.ts (simplified)
class BrokerManager {
  private adapters: Map<string, IBrokerAdapter> = new Map();

  async registerAdapter(adapter: IBrokerAdapter): Promise<void> { ... }
  async connectAll(): Promise<void> { ... }
  async disconnectAll(): Promise<void> { ... }
  getAdapter(brokerId: string): IBrokerAdapter { ... }
  listAdapters(): BrokerSummary[] { ... }
}
```

### 2.5 preload.ts Broker Namespace

The renderer accesses broker functionality through a namespaced IPC bridge:

```typescript
// preload/index.ts
contextBridge.exposeInMainWorld('broker', {
  connect: (brokerId: string, config: any) => ipcRenderer.invoke('broker:connect', brokerId, config),
  getQuote: (symbol: string) => ipcRenderer.invoke('broker:getQuote', symbol),
  placeOrder: (order: any) => ipcRenderer.invoke('broker:placeOrder', order),
  // ... additional methods
});
```

---

## 3. Phase 3A: moomoo Adapter (Week 1–2)

### 3.1 moomoo OpenD Integration

moomoo (Moomoo Technologies Inc.) is a subsidiary of Futu and uses the **same OpenD gateway protocol**. This means the wire format, message types, and SDK structure are nearly identical, with differences primarily in:

- Default connection port
- Market data subscriptions and available instruments
- Account and currency configurations

#### Implementation Approach

Create `electron/broker/moomoo-adapter.ts` that extends a shared `OpenDBaseAdapter` class, which itself is a refactor of the existing `FutuOpenDClient`.

```typescript
// electron/broker/moomoo-adapter.ts
import { OpenDBaseAdapter } from './opend-base';
import { IBrokerAdapter } from './types';

export class MoomooAdapter extends OpenDBaseAdapter implements IBrokerAdapter {
  readonly id = 'moomoo';
  readonly name = 'moomoo';

  protected defaultPort = 11211;
  protected supportedMarkets = ['SG', 'HK', 'US'];
  protected baseCurrencies = ['SGD', 'HKD', 'USD'];

  constructor() {
    super();
  }

  // Override market hours for SG market
  getMarketHours(market: string): MarketHours {
    if (market === 'SG') {
      return { open: '09:00', close: '17:00', timezone: 'Asia/Singapore' };
    }
    return super.getMarketHours(market);
  }
}
```

#### Shared Base Class Refactor

Extract common OpenD logic from `FutuOpenDClient` into `OpenDBaseAdapter`:

```typescript
// electron/broker/opend-base.ts
export abstract class OpenDBaseAdapter implements IBrokerAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  protected abstract defaultPort: number;
  protected abstract supportedMarkets: string[];

  private connection: OpenDConnection | null = null;

  async connect(config: BrokerConfig): Promise<void> {
    const port = config.port ?? this.defaultPort;
    this.connection = await OpenDConnection.create({
      host: config.host ?? '127.0.0.1',
      port,
    });
    // ... shared connection logic
  }

  async disconnect(): Promise<void> { /* shared */ }
  async subscribeQuote(symbols: string[]): Promise<QuoteSubscription> { /* shared */ }
  async placeOrder(order: OrderRequest): Promise<OrderResult> { /* shared */ }
  // ... all shared OpenD methods
}
```

### 3.2 Key Differences from Futu

| Aspect | Futu OpenD | moomoo OpenD |
|--------|-----------|--------------|
| Default Port | 11111 | 11211 |
| Primary Markets | US, HK | SG, HK, US |
| Market Hours (SG) | N/A | 09:00–17:00 SGT |
| Base Currency | USD/HKD | SGD/HKD/USD |
| Symbol Prefix | US., HK. | SG., HK., US. |
| Binary Name | FutuOpenD | MoomooOpenD |
| Config Path | `~/.futu/` | `~/.moomoo/` |
| Auth Method |牛牛号 + 密码 | moomoo UID + 密码 |

### 3.3 Implementation Tasks

| # | Task | File(s) | Est. Lines | Priority |
|---|------|---------|-----------|----------|
| 1 | Extract `OpenDBaseAdapter` from `FutuOpenDClient` | `electron/broker/opend-base.ts`, `electron/broker/futu-opend.ts` | ~300 | P0 |
| 2 | Refactor `FutuOpenDClient` to extend `OpenDBaseAdapter` | `electron/broker/futu-opend.ts` | ~80 (net reduction) | P0 |
| 3 | Create `MoomooAdapter` class | `electron/broker/moomoo-adapter.ts` | ~120 | P0 |
| 4 | Add moomoo market hours definitions | `electron/broker/market-hours.ts` | ~40 | P1 |
| 5 | Add SG symbol prefix mapping | `electron/broker/symbol-mapper.ts` | ~30 | P1 |
| 6 | Register moomoo adapter in `BrokerManager` | `electron/broker/broker-manager.ts` | ~15 | P0 |
| 7 | Add moomoo config schema | `electron/broker/config-schema.ts` | ~25 | P1 |
| 8 | Update preload broker namespace for multi-broker | `preload/index.ts` | ~20 | P1 |
| 9 | Unit tests for `MoomooAdapter` | `tests/broker/moomoo-adapter.test.ts` | ~150 | P1 |
| 10 | Integration test: dual OpenD connection | `tests/broker/dual-opend.test.ts` | ~100 | P2 |

**Estimated Total:** ~880 lines of new/modified code

---

## 4. Phase 3B: IB Adapter (Week 2–3)

### 4.1 IB Gateway/TWS Integration

Interactive Brokers provides programmatic access via the **IB API** (also known as TWS API). We use the `ibapi` npm package (or `@stoqey/ib` as a modern TypeScript wrapper) to connect to either:

- **IB Gateway** (lightweight, headless) — Port `4001` (live) / `4002` (paper)
- **TWS (Trader Workstation)** — Port `7496` (live) / `7497` (paper)

#### Architecture: Async Callback with Request IDs

Unlike OpenD's synchronous request-response, IB uses an **asynchronous callback model** where each request is assigned a unique `reqId`, and responses arrive via event callbacks:

```typescript
// electron/broker/ib-adapter.ts
import { IBApi, Contract, Order as IBOrder } from '@stoqey/ib';
import { IBrokerAdapter, QuoteSubscription, OrderRequest, OrderResult } from './types';

export class IBAdapter implements IBrokerAdapter {
  readonly id = 'ib';
  readonly name = 'Interactive Brokers';

  private api: IBApi;
  private nextReqId = 1;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();

  async connect(config: BrokerConfig): Promise<void> {
    const port = config.port ?? 4001;
    this.api = new IBApi({ port });

    return new Promise((resolve, reject) => {
      this.api.on('connected', () => resolve());
      this.api.on('error', (err) => reject(err));
      this.api.connect();
    });
  }

  async getSnapshot(symbol: string): Promise<QuoteSnapshot> {
    const reqId = this.nextReqId++;
    const contract = this.symbolToContract(symbol);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, { resolve, reject });
      this.api.reqMktData(reqId, contract, '', false, false, []);
      // Timeout after 10s
      setTimeout(() => reject(new Error(`Snapshot timeout for ${symbol}`)), 10000);
    });
  }

  private symbolToContract(symbol: string): Contract {
    // Parse "US.AAPL" → { symbol: "AAPL", exchange: "SMART", currency: "USD" }
    const [market, ticker] = symbol.split('.');
    return {
      symbol: ticker,
      exchange: 'SMART',
      currency: market === 'US' ? 'USD' : market === 'HK' ? 'HKD' : 'SGD',
      secType: 'STK',
    };
  }
}
```

### 4.2 IB-Specific Features

#### 4.2.1 Multiple Exchange Support

IB provides access to global exchanges:

| Exchange | Code | Instruments |
|----------|------|-------------|
| NYSE | NYSE | US Equities |
| NASDAQ | NASDAQ | US Equities, ETFs |
| CME | CME | Futures, Options on Futures |
| HKEX | SEHK | HK Equities |
| SGX | SGX | Singapore Equities, Futures |
| LSE | LSE | UK Equities |
| TSE | TSE | Japan Equities |

#### 4.2.2 Options Chain Data

```typescript
async getOptionsChain(underlying: string, expiry?: string): Promise<OptionsChain> {
  const reqId = this.nextReqId++;
  const contract = this.symbolToContract(underlying);

  return new Promise((resolve, reject) => {
    this.pendingRequests.set(reqId, { resolve, reject });
    this.api.reqSecDefOptParams(reqId, contract.symbol, '', 'STK', contract.conId);
  });
}
```

#### 4.2.3 Complex Order Types

| Order Type | IB API Method | Description |
|-----------|---------------|-------------|
| Bracket Order | `placeOrder` x3 | Parent + TP + SL as linked orders |
| OCO (One-Cancels-Other) | `ocaGroup` field | Group two orders, filling one cancels the other |
| Trailing Stop | `trailingPercent` / `trailStopPrice` | Dynamic stop price that follows the market |
| Iceberg | `displaySize` | Show only partial quantity to the market |
| VWAP | `algoStrategy = 'Vwap'` | Algorithmic execution benchmarked to VWAP |

#### 4.2.4 Margin Requirements

```typescript
async getMarginRequirements(): Promise<MarginInfo> {
  const reqId = this.nextReqId++;
  return new Promise((resolve, reject) => {
    this.pendingRequests.set(reqId, { resolve, reject });
    this.api.reqAccountSummary(reqId, 'All', 'NetLiquidation,MaintMarginReq,InitMarginReq');
  });
}
```

### 4.3 Implementation Tasks

| # | Task | File(s) | Est. Lines | Priority |
|---|------|---------|-----------|----------|
| 1 | Create `IBAdapter` class skeleton | `electron/broker/ib-adapter.ts` | ~80 | P0 |
| 2 | Implement IB connection & auth flow | `electron/broker/ib-adapter.ts` | ~100 | P0 |
| 3 | Implement request ID manager & callback router | `electron/broker/ib-req-manager.ts` | ~120 | P0 |
| 4 | Symbol-to-Contract mapper (multi-exchange) | `electron/broker/ib-contract-mapper.ts` | ~90 | P0 |
| 5 | Market data subscription (tick-level) | `electron/broker/ib-adapter.ts` | ~80 | P0 |
| 6 | Order placement with complex types | `electron/broker/ib-order-builder.ts` | ~150 | P1 |
| 7 | Options chain data retrieval | `electron/broker/ib-adapter.ts` | ~60 | P1 |
| 8 | Margin & account summary | `electron/broker/ib-adapter.ts` | ~50 | P1 |
| 9 | IB market hours (multi-exchange) | `electron/broker/market-hours.ts` | ~60 | P1 |
| 10 | Register IB adapter in `BrokerManager` | `electron/broker/broker-manager.ts` | ~15 | P0 |
| 11 | IB-specific error code mapping | `electron/broker/ib-errors.ts` | ~80 | P2 |
| 12 | Unit tests for `IBAdapter` | `tests/broker/ib-adapter.test.ts` | ~200 | P1 |
| 13 | Integration test: IB Gateway connection | `tests/broker/ib-gateway.test.ts` | ~120 | P2 |

**Estimated Total:** ~1,205 lines of new code

---

## 5. Phase 3C: Unified Account Management (Week 3–4)

### 5.1 Architecture

#### 5.1.1 UnifiedAccountManager

```typescript
// electron/account/unified-account-manager.ts
import { IBrokerAdapter, Position, PnLSummary, AccountInfo } from '../broker/types';

interface UnifiedPosition {
  symbol: string;
  totalQty: number;
  avgCost: number;          // Normalized to USD
  marketValue: number;      // Normalized to USD
  unrealizedPnL: number;    // Normalized to USD
  breakdown: PositionBreakdown[];
}

interface PositionBreakdown {
  brokerId: string;
  qty: number;
  avgCost: number;          // Local currency
  currency: string;
  marketValue: number;      // Local currency
}

interface UnifiedPortfolio {
  totalValue: number;        // USD
  totalPnL: number;          // USD
  positions: UnifiedPosition[];
  brokerAccounts: AccountInfo[];
  lastUpdated: Date;
}

export class UnifiedAccountManager {
  private adapters: Map<string, IBrokerAdapter>;
  private fxRates: Map<string, number>;  // e.g., { 'SGD': 0.74, 'HKD': 0.128 }

  constructor(adapters: Map<string, IBrokerAdapter>) {
    this.adapters = adapters;
    this.fxRates = new Map();
  }

  async refreshFxRates(): Promise<void> {
    // Fetch from a reliable FX API or use broker-provided rates
  }

  async getUnifiedPortfolio(): Promise<UnifiedPortfolio> {
    const allPositions = await Promise.all(
      Array.from(this.adapters.entries()).map(async ([id, adapter]) => {
        const positions = await adapter.getPositions();
        return positions.map(p => ({ ...p, brokerId: id }));
      })
    );

    return this.aggregatePositions(allPositions.flat());
  }

  private aggregatePositions(positions: (Position & { brokerId: string })[]): UnifiedPortfolio {
    const grouped = new Map<string, PositionBreakdown[]>();

    for (const pos of positions) {
      const key = pos.symbol;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({
        brokerId: pos.brokerId,
        qty: pos.qty,
        avgCost: pos.avgCost,
        currency: pos.currency,
        marketValue: pos.marketValue,
      });
    }

    // Merge and normalize to USD
    const unified: UnifiedPosition[] = [];
    for (const [symbol, breakdowns] of grouped) {
      let totalQty = 0;
      let totalCostUSD = 0;
      let totalValueUSD = 0;

      for (const b of breakdowns) {
        const fxRate = this.fxRates.get(b.currency) ?? 1;
        totalQty += b.qty;
        totalCostUSD += b.avgCost * b.qty * fxRate;
        totalValueUSD += b.marketValue * fxRate;
      }

      unified.push({
        symbol,
        totalQty,
        avgCost: totalQty > 0 ? totalCostUSD / totalQty : 0,
        marketValue: totalValueUSD,
        unrealizedPnL: totalValueUSD - totalCostUSD,
        breakdown: breakdowns,
      });
    }

    const totalValue = unified.reduce((sum, p) => sum + p.marketValue, 0);
    const totalPnL = unified.reduce((sum, p) => sum + p.unrealizedPnL, 0);

    return {
      totalValue,
      totalPnL,
      positions: unified,
      brokerAccounts: [], // Populated separately
      lastUpdated: new Date(),
    };
  }
}
```

#### 5.1.2 Currency Normalization

All P&L and position values are normalized to **USD** as the base display currency. FX rates are refreshed every 60 seconds from the broker's market data feed or an external API.

```typescript
// electron/account/fx-normalizer.ts
export class FxNormalizer {
  private rates: Map<string, number> = new Map([
    ['USD', 1.0],
    ['HKD', 0.1282],
    ['SGD', 0.7407],
    ['CNY', 0.1379],
  ]);

  normalize(amount: number, fromCurrency: string): number {
    const rate = this.rates.get(fromCurrency);
    if (!rate) throw new Error(`Unknown currency: ${fromCurrency}`);
    return amount * rate;
  }

  async refreshRates(): Promise<void> {
    // Fetch live FX rates
  }
}
```

### 5.2 UI Changes

#### 5.2.1 Broker Selector in Sidebar

```
┌──────────────────────────┐
│  ☰ Dawn Whales           │
│  ─────────────────────── │
│  📊 Portfolio            │
│  ┌────────────────────┐  │
│  │ ▼ All Brokers      │  │  ← New dropdown
│  │   ├ Futu           │  │
│  │   ├ moomoo         │  │
│  │   └ IB             │  │
│  └────────────────────┘  │
│                          │
│  AAPL   $189.25  +1.2%  │
│  BABA   $78.50   -0.5%  │
│  D05.SG $12.30   +0.8%  │  ← SG symbols from moomoo
│  ...                     │
└──────────────────────────┘
```

#### 5.2.2 Per-Broker Account Summary

A new `BrokerAccountCard` component shows per-broker metrics:

- Net Liquidation Value
- Day P&L
- Buying Power
- Margin Utilization (IB only)
- Connection Status indicator (🟢/🔴)

#### 5.2.3 Cross-Broker Portfolio View

The existing portfolio table gains new columns:

| Symbol | Total Qty | Avg Cost (USD) | Mkt Value (USD) | P&L | Brokers |
|--------|-----------|----------------|-----------------|-----|---------|
| AAPL | 150 | $172.30 | $28,387.50 | +$2,545.50 | Futu (100), IB (50) |
| 0700.HK | 400 | HK$320.00 | $6,528.00 | +$256.00 | Futu (200), moomoo (200) |

#### 5.2.4 Broker-Specific Order Routing

When placing an order, the user selects which broker to route through. The order form validates:

- Instrument availability on the selected broker
- Market hours for the target exchange
- Sufficient buying power / margin

### 5.3 Implementation Tasks

| # | Task | File(s) | Est. Lines | Priority |
|---|------|---------|-----------|----------|
| 1 | Create `UnifiedAccountManager` | `electron/account/unified-account-manager.ts` | ~200 | P0 |
| 2 | Create `FxNormalizer` | `electron/account/fx-normalizer.ts` | ~60 | P0 |
| 3 | Add unified portfolio IPC channel | `electron/ipc/account-channels.ts` | ~40 | P0 |
| 4 | Broker selector component | `src/components/Sidebar/BrokerSelector.tsx` | ~80 | P0 |
| 5 | Broker account card component | `src/components/Portfolio/BrokerAccountCard.tsx` | ~100 | P1 |
| 6 | Update portfolio table with broker column | `src/components/Portfolio/PortfolioTable.tsx` | ~50 | P1 |
| 7 | Broker selection in order form | `src/components/Order/OrderForm.tsx` | ~60 | P0 |
| 8 | Order routing validation logic | `electron/trading/order-router.ts` | ~90 | P0 |
| 9 | Connection status indicators | `src/components/Sidebar/BrokerStatusDot.tsx` | ~30 | P2 |
| 10 | Update preload for account APIs | `preload/index.ts` | ~25 | P0 |
| 11 | E2E test: multi-broker portfolio | `tests/e2e/multi-broker.test.ts` | ~150 | P1 |
| 12 | E2E test: cross-broker order routing | `tests/e2e/order-routing.test.ts` | ~120 | P1 |

**Estimated Total:** ~1,005 lines of new/modified code

---

## 6. Data Flow Diagrams

### 6.1 Quote Data Flow (Per Broker)

```
┌────────────┐    ┌────────────┐    ┌────────────┐
│ Futu OpenD │    │moomoo OpenD│    │ IB Gateway │
│  :11111    │    │  :11211    │    │  :4001     │
└─────┬──────┘    └─────┬──────┘    └─────┬──────┘
      │                 │                 │
      ▼                 ▼                 ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Futu    │    │  moomoo  │    │   IB     │
│  Adapter │    │  Adapter │    │  Adapter │
└────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │
     ▼               ▼               ▼
┌────────────────────────────────────────────┐
│           BrokerManager                    │
│  (routes subscriptions, normalizes data)   │
└────────────────────┬───────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────┐
│          WS Market Data Engine             │
│  (unified streaming to renderer via WS)    │
└────────────────────┬───────────────────────┘
                     │ WebSocket
                     ▼
┌────────────────────────────────────────────┐
│              Renderer (React)              │
│  MarketPanel / Watchlist / Chart           │
└────────────────────────────────────────────┘
```

### 6.2 Order Routing Flow

```
User clicks "Buy AAPL 100 @ Market"
         │
         ▼
┌─────────────────────┐
│   OrderForm (UI)    │  Select broker: [Futu ▼]
└─────────┬───────────┘
          │ IPC: broker:placeOrder
          ▼
┌─────────────────────┐
│   OrderRouter       │  Validates: market hours, buying power, instrument
│   (Main Process)    │
└─────────┬───────────┘
          │ routes to selected adapter
          ▼
┌─────────────────────┐
│  Selected Adapter   │  Futu / moomoo / IB
│  .placeOrder()      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Broker Backend    │  OpenD / IB Gateway
└─────────┬───────────┘
          │ confirmation
          ▼
┌─────────────────────┐
│   OrderRouter       │  Emits order:update event
└─────────┬───────────┘
          │ IPC push
          ▼
┌─────────────────────┐
│  Renderer (UI)      │  Order status toast + table update
└─────────────────────┘
```

### 6.3 Position Aggregation Flow

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Futu    │  │  moomoo  │  │    IB    │
│  Adapter │  │  Adapter │  │  Adapter │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │              │
     │ getPositions()│              │
     ▼              ▼              ▼
┌────────────────────────────────────────────┐
│        UnifiedAccountManager               │
│                                            │
│  1. Fetch positions from all adapters      │
│  2. Group by symbol                        │
│  3. Normalize currencies to USD via FxNorm │
│  4. Calculate aggregated P&L               │
│  5. Return UnifiedPortfolio                │
└────────────────────┬───────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────┐
│        Renderer — Portfolio View           │
│  Total: $125,430  P&L: +$3,210 (+2.6%)    │
└────────────────────────────────────────────┘
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

| Adapter | Test File | Scope | Est. Tests |
|---------|-----------|-------|-----------|
| `OpenDBaseAdapter` | `tests/broker/opend-base.test.ts` | Shared OpenD logic | 15 |
| `FutuOpenDClient` | `tests/broker/futu-opend.test.ts` | Futu-specific overrides | 10 |
| `MoomooAdapter` | `tests/broker/moomoo-adapter.test.ts` | moomoo port, markets, hours | 12 |
| `IBAdapter` | `tests/broker/ib-adapter.test.ts` | IB connection, req IDs, callbacks | 20 |
| `UnifiedAccountManager` | `tests/account/unified-account.test.ts` | Aggregation, FX, P&L | 18 |
| `FxNormalizer` | `tests/account/fx-normalizer.test.ts` | Currency conversion | 8 |
| `OrderRouter` | `tests/trading/order-router.test.ts` | Routing, validation | 12 |

### 7.2 Integration Tests

| Scenario | Description | Est. Tests |
|----------|-------------|-----------|
| Dual OpenD | Futu + moomoo connect simultaneously, no port conflict | 5 |
| IB Gateway | Connect to paper account, subscribe to quotes | 6 |
| BrokerManager lifecycle | Start all, stop all, handle individual failures | 8 |
| WS Engine | Unified streaming from 3 adapters | 5 |

### 7.3 E2E Tests

| Scenario | Steps | Est. Tests |
|----------|-------|-----------|
| Multi-broker portfolio | Connect 3 brokers → View unified portfolio | 3 |
| Cross-broker order | Place order via Futu, verify in Futu account only | 4 |
| Broker failover | Kill one OpenD → UI shows disconnected → Reconnect | 3 |
| Currency normalization | Hold same stock on Futu (USD) and moomoo (SGD) → Verify unified P&L | 2 |

### 7.4 Test Infrastructure

```typescript
// tests/helpers/mock-broker-adapter.ts
export class MockBrokerAdapter implements IBrokerAdapter {
  readonly id: string;
  readonly name: string;
  status: BrokerStatus = 'disconnected';

  private mockPositions: Position[] = [];
  private mockQuotes: Map<string, QuoteSnapshot> = new Map();

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  // Configurable mock data
  setMockPositions(positions: Position[]): void { this.mockPositions = positions; }
  setMockQuote(symbol: string, quote: QuoteSnapshot): void { this.mockQuotes.set(symbol, quote); }

  // IBrokerAdapter implementation
  async connect(): Promise<void> { this.status = 'connected'; }
  async disconnect(): Promise<void> { this.status = 'disconnected'; }
  async getPositions(): Promise<Position[]> { return this.mockPositions; }
  async getSnapshot(symbol: string): Promise<QuoteSnapshot> {
    const q = this.mockQuotes.get(symbol);
    if (!q) throw new Error(`No mock quote for ${symbol}`);
    return q;
  }
  // ... remaining methods with sensible defaults
}
```

---

## 8. Technical Risks

| # | Risk | Probability | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | **IB API callback complexity** — Async callbacks with request IDs can lead to race conditions and memory leaks if requests are never resolved. | High | High | Implement `IBReqManager` with automatic timeout (10s default) and cleanup. Use `Map<reqId, Promise>` pattern with guaranteed resolution. |
| 2 | **moomoo OpenD binary availability** — moomoo OpenD may not be available on all platforms or may require separate licensing. | Medium | High | Verify binary distribution for Windows/macOS/Linux in Week 1. Fallback: run moomoo in a Docker container. |
| 3 | **Port conflicts** — Running Futu OpenD (11111) and moomoo OpenD (11211) simultaneously may conflict with firewall rules or other services. | Low | Medium | Make ports configurable via settings UI. Add port check on startup with clear error messages. |
| 4 | **FX rate staleness** — Using stale FX rates for P&L calculation can mislead users. | Medium | Medium | Refresh FX rates every 60s. Display "last updated" timestamp. Warn if rate is >5min old. |
| 5 | **IB paper vs live confusion** — Users may accidentally connect to live trading when intending paper. | Medium | High | Require explicit confirmation modal when connecting to live IB port (4001/7496). Show prominent "LIVE" / "PAPER" badge. |
| 6 | **OpenD base class refactor breaks existing Futu** — Extracting shared logic could introduce regressions. | Medium | High | Maintain 100% backward compatibility with existing Futu test suite. Run full regression after refactor before proceeding. |
| 7 | **Memory usage with 3 concurrent connections** — Three broker connections + streaming may increase memory significantly. | Low | Medium | Profile memory usage in Week 3. Implement connection pooling and lazy subscription (only subscribe when UI panel is visible). |
| 8 | **Symbol format inconsistency** — Futu uses `US.AAPL`, IB uses `AAPL@SMART`, moomoo uses `SG.D05`. | High | Medium | Implement `SymbolMapper` class that normalizes all formats to internal canonical form. Comprehensive mapping tests. |

---

## 9. Milestones

| Week | Deliverable | Acceptance Criteria |
|------|------------|-------------------|
| **Week 1** | `OpenDBaseAdapter` refactor + `MoomooAdapter` skeleton | ① Futu tests pass unchanged after refactor ② `MoomooAdapter` compiles and connects to moomoo OpenD on port 11211 ③ Code review approved |
| **Week 2** | moomoo complete + IB Adapter skeleton | ① moomoo subscribes to SG/HK quotes successfully ② `IBAdapter` connects to IB Gateway paper account ③ BrokerManager manages Futu + moomoo simultaneously |
| **Week 3** | IB complete + UnifiedAccountManager | ① IB subscribes to US/HK quotes, places paper orders ② `UnifiedAccountManager` aggregates positions from 2+ brokers ③ FX normalization displays correct USD values |
| **Week 4** | UI integration + E2E testing + release | ① Broker selector in sidebar functional ② Portfolio view shows cross-broker positions ③ All E2E tests pass ④ No regression in Futu-only mode ⑤ Performance: <500ms portfolio refresh with 3 brokers |

---

## 10. Dependencies

### 10.1 External Dependencies

| Dependency | Type | Version | Purpose | Risk |
|-----------|------|---------|---------|------|
| `@stoqey/ib` | npm package | ^0.8.x | IB API TypeScript wrapper | Medium — community-maintained, may have edge-case bugs |
| `futu-opend` | Binary | Latest | Futu market data & trading | Low — first-party, well-maintained |
| `moomoo-opend` | Binary | Latest | moomoo market data & trading | Medium — newer, less battle-tested |
| IB Gateway / TWS | Desktop app | Latest | IB connectivity | Low — official IB software |

### 10.2 Internal Dependencies

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| `IBrokerAdapter` interface | `electron/broker/types.ts` | ✅ Stable | May need minor extensions for IB-specific fields |
| `BrokerManager` | `electron/broker/broker-manager.ts` | ✅ Stable | Supports multi-adapter registration |
| `WS Market Data Engine` | `electron/market/ws-engine.ts` | ✅ Stable | Broker-agnostic streaming |
| `preload.ts broker:` namespace | `preload/index.ts` | ⚠️ Needs update | Must support broker-specific routing |
| `MarketPanel` component | `src/components/Market/` | ⚠️ Needs update | Display multi-broker quotes |
| `OrderForm` component | `src/components/Order/` | ⚠️ Needs update | Broker selection dropdown |
| `PortfolioTable` component | `src/components/Portfolio/` | ⚠️ Needs update | Cross-broker columns |

### 10.3 Dependency Graph

```
Phase 3A (moomoo)  ──────┐
                          ├──▶ Phase 3C (Unified Account)
Phase 3B (IB)      ──────┘
         ▲                    │
         │                    ▼
    OpenDBaseAdapter      UI Integration
    (refactor from        + E2E Testing
     FutuOpenDClient)
```

**Critical Path:** Phase 3A (OpenD refactor) → Phase 3B (IB, parallel) → Phase 3C (Unified Account) → UI + E2E

---

## 11. Appendix

### 11.1 File Structure (Post-Implementation)

```
electron/
├── broker/
│   ├── types.ts                    # IBrokerAdapter interface
│   ├── opend-base.ts              # NEW: Shared OpenD logic
│   ├── futu-opend.ts             # REFACTOR: extends OpenDBaseAdapter
│   ├── moomoo-adapter.ts         # NEW: moomoo adapter
│   ├── ib-adapter.ts             # NEW: IB adapter
│   ├── ib-req-manager.ts         # NEW: IB request ID manager
│   ├── ib-contract-mapper.ts     # NEW: Symbol → IB Contract
│   ├── ib-order-builder.ts       # NEW: Complex order types
│   ├── ib-errors.ts              # NEW: IB error code mapping
│   ├── broker-manager.ts         # UPDATE: register new adapters
│   ├── market-hours.ts           # UPDATE: add SG, multi-exchange
│   ├── symbol-mapper.ts          # NEW: canonical symbol normalization
│   └── config-schema.ts          # UPDATE: moomoo + IB config
├── account/
│   ├── unified-account-manager.ts # NEW: cross-broker aggregation
│   └── fx-normalizer.ts          # NEW: currency conversion
├── trading/
│   └── order-router.ts           # NEW: broker-aware order routing
├── market/
│   └── ws-engine.ts              # MINOR UPDATE: multi-source streaming
└── ipc/
    └── account-channels.ts       # NEW: unified portfolio IPC

src/components/
├── Sidebar/
│   ├── BrokerSelector.tsx        # NEW
│   └── BrokerStatusDot.tsx       # NEW
├── Portfolio/
│   ├── BrokerAccountCard.tsx     # NEW
│   └── PortfolioTable.tsx        # UPDATE: broker columns
└── Order/
    └── OrderForm.tsx             # UPDATE: broker selection

tests/
├── broker/
│   ├── opend-base.test.ts        # NEW
│   ├── moomoo-adapter.test.ts    # NEW
│   ├── ib-adapter.test.ts        # NEW
│   ├── dual-opend.test.ts        # NEW
│   └── ib-gateway.test.ts        # NEW
├── account/
│   ├── unified-account.test.ts   # NEW
│   └── fx-normalizer.test.ts     # NEW
├── trading/
│   └── order-router.test.ts      # NEW
├── helpers/
│   └── mock-broker-adapter.ts    # NEW
└── e2e/
    ├── multi-broker.test.ts      # NEW
    └── order-routing.test.ts     # NEW
```

### 11.2 Estimated Effort Summary

| Phase | New Files | Modified Files | Est. New Lines | Est. Modified Lines |
|-------|-----------|----------------|---------------|-------------------|
| 3A — moomoo | 4 | 4 | ~545 | ~120 |
| 3B — IB | 6 | 2 | ~1,085 | ~75 |
| 3C — Unified | 8 | 5 | ~855 | ~150 |
| Testing | 10 | 0 | ~950 | 0 |
| **Total** | **28** | **11** | **~3,435** | **~345** |

### 11.3 Open Questions

1. **moomoo API compatibility**: Need to confirm that moomoo OpenD's `TrdMarket` enum includes SG market code. If not, a custom mapping layer is required.
2. **IB rate limits**: IB imposes pacing limits (max 60 requests/10s for market data). Need to implement a request throttler in `IBReqManager`.
3. **Unified order ID format**: Should we prefix order IDs with broker ID (e.g., `futu:12345`, `ib:67890`) to avoid collisions in the UI?
4. **FX data source**: Use broker-provided FX rates or an external API (e.g., ECB, exchangerate-api.com)?

---

*End of Document*
