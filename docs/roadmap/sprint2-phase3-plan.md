# Sprint 2 Phase 3: Multi-Broker Support

> **Status:** Planning  
> **Author:** Engineering Team  
> **Last Updated:** 2026-06-06  
> **Sprint:** Sprint 2 (Phase 3)  
> **Duration:** 4 weeks  

---

## 1. Overview

This document outlines the technical plan for evolving the Dawn Whales platform from a single-broker (Futu OpenD) architecture to a multi-broker unified trading platform. The target brokers are:

| Broker | Protocol | Primary Markets | Priority |
|--------|----------|-----------------|----------|
| Futu OpenD | OpenD TCP | HK / US / A-share | Existing (baseline) |
| moomoo OpenD | OpenD TCP (compatible) | SG / HK / US | Phase 3A |
| Interactive Brokers (IB) | IB Gateway / TWS API | Global (NYSE, NASDAQ, CME, LSE, HKEX, etc.) | Phase 3B |

### 1.1 Goals

- Enable simultaneous connection to multiple brokers
- Provide a unified `IBrokerAdapter` interface that abstracts broker-specific differences
- Allow users to route orders to any connected broker from a single UI
- Aggregate positions, P&L, and account data across brokers with currency normalization

### 1.2 Non-Goals

- Smart order routing (SOR) across brokers (deferred to Phase 4)
- Broker-side algorithmic execution
- Cross-broker margin optimization

---

## 2. Current Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Renderer (React)                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │ OrderPanel │  │ QuoteBoard │  │ AccountSummary │  │
│  └─────┬──────┘  └─────┬──────┘  └───────┬────────┘  │
│        └───────────────┼──────────────────┘           │
│                        │ WebSocket (IPC)              │
├────────────────────────┼─────────────────────────────┤
│                   Electron Main                       │
│                        │                              │
│  ┌─────────────────────▼──────────────────────────┐   │
│  │            BrokerManager                        │   │
│  │  - lifecycle management                        │   │
│  │  - adapter registry                            │   │
│  └─────────────────────┬──────────────────────────┘   │
│                        │                              │
│  ┌─────────────────────▼──────────────────────────┐   │
│  │         IBrokerAdapter (interface)              │   │
│  └─────────────────────┬──────────────────────────┘   │
│                        │                              │
│  ┌─────────────────────▼──────────────────────────┐   │
│  │          FutuOpenDClient                        │   │
│  │   (electron/broker/futu-opend.ts)              │   │
│  └────────────────────────────────────────────────┘   │
│                                                       │
│  ┌────────────────────────────────────────────────┐   │
│  │         WS Market Data Engine                   │   │
│  │   (unified tick streaming to renderer)          │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### 2.1 Existing Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `FutuOpenDClient` | `electron/broker/futu-opend.ts` | TCP connection to Futu OpenD, quote subscription, order placement, account queries |
| `BrokerManager` | `electron/broker/broker-manager.ts` | Adapter lifecycle (connect/disconnect), health checks, adapter registry |
| `IBrokerAdapter` | `electron/broker/ibroker-adapter.ts` | Interface contract: `connect()`, `disconnect()`, `subscribeQuote()`, `placeOrder()`, `cancelOrder()`, `getAccountInfo()`, `getPositions()` |
| `WSMarketDataEngine` | `electron/market/ws-engine.ts` | Fan-out tick data from any adapter to connected WebSocket clients in the renderer |

### 2.2 IBrokerAdapter Interface (current)

```typescript
// electron/broker/ibroker-adapter.ts

export interface IBrokerAdapter {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'error';

  // Connection lifecycle
  connect(config: BrokerConfig): Promise<void>;
  disconnect(): Promise<void>;

  // Market data
  subscribeQuote(symbols: string[]): Promise<void>;
  unsubscribeQuote(symbols: string[]): Promise<void>;
  onQuote(cb: (tick: QuoteTick) => void): void;

  // Trading
  placeOrder(order: NewOrder): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  getOpenOrders(): Promise<OpenOrder[]>;

  // Account
  getAccountInfo(): Promise<AccountInfo>;
  getPositions(): Promise<Position[]>;
  getFunds(): Promise<FundsInfo>;
}
```

---

## 3. Phase 3A: moomoo Adapter (Week 1–2)

### 3.1 Background

moomoo is Futu's international brand. The moomoo OpenD gateway is wire-compatible with Futu OpenD — it uses the same protobuf-based TCP protocol with different default configuration. This means we can reuse the majority of the existing `FutuOpenDClient` logic with a thin adaptation layer.

### 3.2 Key Differences: Futu vs. moomoo

| Aspect | Futu OpenD | moomoo OpenD |
|--------|------------|--------------|
| Default TCP port | 11111 | 11211 |
| Primary markets | HK, US, A-share (via Stock Connect) | SG, HK, US |
| Market hours (local) | HK 09:30–16:00 HKT | SG 09:00–17:00 SGT |
| Base currency | HKD | SGD / USD |
| Default trading permissions | HK stocks, US stocks | SG stocks, HK stocks, US stocks |
| Subscription quota | Same tier-based system | Same tier-based system |
| OpenD binary | `FutuOpenD` | `moomooOpenD` (or `FutuOpenD` with moomoo config) |

### 3.3 Implementation Plan

#### File: `electron/broker/moomoo-adapter.ts`

```typescript
// electron/broker/moomoo-adapter.ts

import { FutuOpenDClient } from './futu-opend';
import { IBrokerAdapter, BrokerConfig, QuoteTick, NewOrder, OrderResult, 
         AccountInfo, Position, FundsInfo, OpenOrder } from './ibroker-adapter';

export interface MoomooConfig extends BrokerConfig {
  port?: number;            // default: 11211
  host?: string;            // default: '127.0.0.1'
  trdEnv?: 'SIMULATE' | 'REAL';
  currency?: 'SGD' | 'HKD' | 'USD';
}

export class MoomooAdapter implements IBrokerAdapter {
  readonly brokerId = 'moomoo';
  readonly brokerName = 'moomoo';
  
  private client: FutuOpenDClient;
  private _status: IBrokerAdapter['status'] = 'disconnected';

  constructor() {
    // Reuse FutuOpenDClient with moomoo-specific defaults
    this.client = new FutuOpenDClient({
      port: 11211,
      // Override market defaults
      defaultMarkets: ['SG', 'HK', 'US'],
    });
  }

  get status() { return this._status; }

  async connect(config: MoomooConfig): Promise<void> {
    this._status = 'connecting';
    try {
      await this.client.connect({
        host: config.host ?? '127.0.0.1',
        port: config.port ?? 11211,
        trdEnv: config.trdEnv ?? 'REAL',
      });
      this._status = 'connected';
    } catch (err) {
      this._status = 'error';
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
    this._status = 'disconnected';
  }

  // Delegate to underlying client — protocol-compatible
  async subscribeQuote(symbols: string[]): Promise<void> {
    return this.client.subscribeQuote(symbols);
  }

  async unsubscribeQuote(symbols: string[]): Promise<void> {
    return this.client.unsubscribeQuote(symbols);
  }

  onQuote(cb: (tick: QuoteTick) => void): void {
    this.client.onQuote(cb);
  }

  async placeOrder(order: NewOrder): Promise<OrderResult> {
    // moomoo may use different security code format for SG stocks
    const normalizedOrder = this.normalizeOrder(order);
    return this.client.placeOrder(normalizedOrder);
  }

  async cancelOrder(orderId: string): Promise<void> {
    return this.client.cancelOrder(orderId);
  }

  async getOpenOrders(): Promise<OpenOrder[]> {
    return this.client.getOpenOrders();
  }

  async getAccountInfo(): Promise<AccountInfo> {
    const raw = await this.client.getAccountInfo();
    return this.normalizeCurrency(raw);
  }

  async getPositions(): Promise<Position[]> {
    const raw = await this.client.getPositions();
    return raw.map(p => this.normalizePosition(p));
  }

  async getFunds(): Promise<FundsInfo> {
    const raw = await this.client.getFunds();
    return this.normalizeCurrency(raw);
  }

  // --- Private helpers ---

  private normalizeOrder(order: NewOrder): NewOrder {
    // SG stock codes use different prefix convention
    // e.g., moomoo uses "SG.DBS" while Futu internal may differ
    return { ...order };
  }

  private normalizeCurrency<T extends { currency?: string }>(obj: T): T {
    // Normalize SGD/HKD/USD reporting
    return obj;
  }

  private normalizePosition(pos: Position): Position {
    // Ensure market field is populated correctly for SG positions
    return pos;
  }
}
```

#### BrokerManager Registration

```typescript
// In broker-manager.ts — add moomoo registration

import { MoomooAdapter } from './moomoo-adapter';

export class BrokerManager {
  private adapters: Map<string, IBrokerAdapter> = new Map();

  registerMoomoo(config: MoomooConfig): void {
    const adapter = new MoomooAdapter();
    this.adapters.set('moomoo', adapter);
  }

  // ... existing connect/disconnect lifecycle
}
```

### 3.4 Market Hour Configuration

```typescript
// electron/broker/market-hours.ts

export const MARKET_HOURS: Record<string, MarketSession[]> = {
  // Futu
  'futu:HK': [
    { open: '09:30', close: '12:00', tz: 'Asia/Hong_Kong' },
    { open: '13:00', close: '16:00', tz: 'Asia/Hong_Kong' },
  ],
  'futu:US': [
    { open: '09:30', close: '16:00', tz: 'America/New_York' },
  ],
  // moomoo
  'moomoo:SG': [
    { open: '09:00', close: '12:00', tz: 'Asia/Singapore' },
    { open: '13:00', close: '17:00', tz: 'Asia/Singapore' },
  ],
  'moomoo:HK': [
    { open: '09:30', close: '12:00', tz: 'Asia/Hong_Kong' },
    { open: '13:00', close: '16:00', tz: 'Asia/Hong_Kong' },
  ],
  'moomoo:US': [
    { open: '09:30', close: '16:00', tz: 'America/New_York' },
  ],
  // IB
  'ib:US': [
    { open: '09:30', close: '16:00', tz: 'America/New_York' },
  ],
  'ib:EU': [
    { open: '08:00', close: '16:30', tz: 'Europe/London' },
  ],
};
```

### 3.5 Week 1–2 Deliverables

| Week | Deliverable | Acceptance Criteria |
|------|------------|---------------------|
| 1 | moomoo adapter: connect + quotes | Can connect to moomoo OpenD on port 11211 and stream real-time quotes for SG/HK/US symbols |
| 2 | moomoo adapter: orders + positions + funds | Full IBrokerAdapter compliance; can place/cancel orders, query positions and funds |
| 2 | BrokerManager integration | moomoo adapter registered and lifecycle-managed alongside Futu |
| 2 | Unit tests | >80% coverage on `moomoo-adapter.ts` with mocked OpenD responses |

---

## 4. Phase 3B: IB (Interactive Brokers) Adapter (Week 2–3)

### 4.1 Background

Interactive Brokers provides a fundamentally different API from Futu/moomoo. IB uses a TCP socket protocol with request/response patterns identified by numeric request IDs. The two connection endpoints are:

| Endpoint | Port | Use Case |
|----------|------|----------|
| IB Gateway | 4001 (live) / 4002 (paper) | Lightweight, headless — preferred for automated trading |
| TWS (Trader Workstation) | 7496 (live) / 7497 (paper) | Full GUI application |

### 4.2 API Comparison: OpenD vs IB

| Feature | Futu/moomoo OpenD | IB API |
|---------|-------------------|--------|
| Protocol | Protobuf over TCP | Custom binary/text over TCP |
| Request identification | Sequential protocol IDs | Numeric `reqId` per request |
| Market data push | Callback-based (Qt signal style) | Callback-based (`tickPrice`, `tickSize`) |
| Order placement | Single `placeOrder` call | `placeOrder(orderId, contract, order)` with separate `orderStatus` callback |
| Account data | Snapshot queries | `reqAccountUpdates` with continuous push |
| Position data | Snapshot query | `reqPositions` with continuous push |
| Connection limit | 1 client per OpenD instance | 1 client per TWS/Gateway (8 for TWS with multiple client IDs) |
| Rate limits | Subscription quota | 60 messages/sec, 6000 messages/5min |
| Reconnection | Auto-reconnect supported | Must re-subscribe everything after reconnect |

### 4.3 NPM Package Selection

| Package | Pros | Cons | Recommendation |
|---------|------|------|----------------|
| `@stoqey/ib` | TypeScript-native, active maintenance, Promise-based | Smaller community | **Primary choice** |
| `ibapi` | Close to official Python API, well-documented | JavaScript (not TS), callback-heavy | Fallback |
| Custom TCP client | Full control | High implementation cost, must maintain protocol | Not recommended |

### 4.4 Implementation Plan

#### File: `electron/broker/ib-adapter.ts`

```typescript
// electron/broker/ib-adapter.ts

import { IBApi, Contract, Order as IBOrder, OrderState } from '@stoqey/ib';
import { IBrokerAdapter, BrokerConfig, QuoteTick, NewOrder, OrderResult,
         AccountInfo, Position, FundsInfo, OpenOrder } from './ibroker-adapter';

export interface IBConfig extends BrokerConfig {
  port?: number;            // default: 4001 (Gateway live)
  host?: string;            // default: '127.0.0.1'
  clientId?: number;        // default: 0
  account?: string;         // IB account ID (e.g., 'U1234567')
}

export class IBAdapter implements IBrokerAdapter {
  readonly brokerId = 'ib';
  readonly brokerName = 'Interactive Brokers';

  private ib: IBApi;
  private _status: IBrokerAdapter['status'] = 'disconnected';
  private nextReqId = 1;
  private nextOrderId = 1;
  private quoteCallbacks: Map<number, (tick: QuoteTick) => void> = new Map();
  private accountData: Partial<AccountInfo> = {};
  private positionData: Map<string, Position> = new Map();

  constructor() {
    this.ib = new IBApi({
      // Connection options
    });
    this.setupEventHandlers();
  }

  get status() { return this._status; }

  // --- Connection ---

  async connect(config: IBConfig): Promise<void> {
    this._status = 'connecting';
    return new Promise((resolve, reject) => {
      this.ib.on('connected', () => {
        this._status = 'connected';
        // Request managed accounts
        this.ib.reqManagedAccts();
        resolve();
      });
      this.ib.on('error', (err) => {
        this._status = 'error';
        reject(err);
      });
      this.ib.connect(config.host ?? '127.0.0.1', config.port ?? 4001, config.clientId ?? 0);
    });
  }

  async disconnect(): Promise<void> {
    this.ib.disconnect();
    this._status = 'disconnected';
  }

  // --- Market Data ---

  async subscribeQuote(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
      const reqId = this.nextReqId++;
      const contract = this.symbolToContract(symbol);
      this.ib.reqMktData(reqId, contract, '', false, false, []);
    }
  }

  async unsubscribeQuote(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
      // Cancel market data subscription
      // Map symbol back to reqId via tracking map
    }
  }

  onQuote(cb: (tick: QuoteTick) => void): void {
    // Wire up tickPrice / tickSize / tickGeneric callbacks
    this.ib.on('tickPrice', (reqId, tickType, price) => {
      const tick = this.buildQuoteTick(reqId, tickType, price);
      if (tick) cb(tick);
    });
  }

  // --- Trading ---

  async placeOrder(order: NewOrder): Promise<OrderResult> {
    const orderId = this.nextOrderId++;
    const contract = this.symbolToContract(order.symbol);
    const ibOrder: IBOrder = {
      action: order.side === 'BUY' ? 'BUY' : 'SELL',
      totalQuantity: order.quantity,
      orderType: this.mapOrderType(order.type),
      lmtPrice: order.limitPrice ?? undefined,
      auxPrice: order.auxPrice ?? undefined,
      tif: order.tif ?? 'DAY',
    };

    return new Promise((resolve, reject) => {
      this.ib.once('orderStatus', (id, status, filled, remaining, 
                                    avgFillPrice, permId, parentId,
                                    lastFillPrice, clientId, whyHeld, mktCapPrice) => {
        if (id === orderId) {
          resolve({
            orderId: String(orderId),
            status: this.mapOrderStatus(status),
            filledQty: filled,
            avgPrice: avgFillPrice,
          });
        }
      });
      this.ib.placeOrder(orderId, contract, ibOrder);
    });
  }

  async cancelOrder(orderId: string): Promise<void> {
    this.ib.cancelOrder(parseInt(orderId, 10));
  }

  async getOpenOrders(): Promise<OpenOrder[]> {
    return new Promise((resolve) => {
      const orders: OpenOrder[] = [];
      this.ib.on('openOrder', (orderId, contract, order, orderState) => {
        orders.push(this.mapOpenOrder(orderId, contract, order, orderState));
      });
      this.ib.once('openOrderEnd', () => resolve(orders));
      this.ib.reqOpenOrders();
    });
  }

  // --- Account ---

  async getAccountInfo(): Promise<AccountInfo> {
    return new Promise((resolve) => {
      this.ib.once('accountDownloadEnd', () => {
        resolve(this.accountData as AccountInfo);
      });
      this.ib.reqAccountUpdates(true, this.getAccount());
    });
  }

  async getPositions(): Promise<Position[]> {
    return new Promise((resolve) => {
      const positions: Position[] = [];
      this.ib.on('position', (account, contract, pos, avgCost) => {
        positions.push({
          symbol: contract.symbol,
          exchange: contract.exchange,
          quantity: pos,
          avgCost: avgCost,
          market: contract.primaryExch,
        });
      });
      this.ib.once('positionEnd', () => resolve(positions));
      this.ib.reqPositions();
    });
  }

  async getFunds(): Promise<FundsInfo> {
    // Extract from account data collected via reqAccountUpdates
    return {
      cash: this.accountData.cash ?? 0,
      buyingPower: this.accountData.buyingPower ?? 0,
      equity: this.accountData.equity ?? 0,
      currency: 'USD',
    } as FundsInfo;
  }

  // --- Private helpers ---

  private setupEventHandlers(): void {
    this.ib.on('accountValue', (key, value, currency, account) => {
      this.processAccountValue(key, value, currency);
    });
  }

  private symbolToContract(symbol: string): Contract {
    // Parse symbol like "AAPL" or "AAPL:NASDAQ" into IB Contract
    const [ticker, exchange] = symbol.split(':');
    return {
      symbol: ticker,
      secType: 'STK',
      exchange: exchange ?? 'SMART',
      currency: 'USD',
    };
  }

  private mapOrderType(type: string): string {
    const typeMap: Record<string, string> = {
      'MARKET': 'MKT',
      'LIMIT': 'LMT',
      'STOP': 'STP',
      'STOP_LIMIT': 'STP LMT',
      'TRAILING_STOP': 'TRAIL',
    };
    return typeMap[type] ?? type;
  }

  private mapOrderStatus(status: string): string {
    // IB status: Submitted, Filled, Cancelled, Inactive, etc.
    return status;
  }

  private mapOpenOrder(orderId: number, contract: Contract, 
                       order: IBOrder, state: OrderState): OpenOrder {
    return {
      orderId: String(orderId),
      symbol: contract.symbol,
      side: order.action === 'BUY' ? 'BUY' : 'SELL',
      quantity: order.totalQuantity,
      filledQty: 0,
      type: order.orderType,
      status: state.status,
    };
  }

  private processAccountValue(key: string, value: string, currency: string): void {
    if (currency !== 'BASE' && currency !== 'USD') return;
    const numValue = parseFloat(value);
    switch (key) {
      case 'NetLiquidation':
        this.accountData.equity = numValue;
        break;
      case 'TotalCashValue':
        this.accountData.cash = numValue;
        break;
      case 'BuyingPower':
        this.accountData.buyingPower = numValue;
        break;
    }
  }

  private getAccount(): string {
    // Return configured account or first managed account
    return '';
  }

  private buildQuoteTick(reqId: number, tickType: number, price: number): QuoteTick | null {
    // Map IB tick types to our QuoteTick format
    // tickType 1 = bid, 2 = ask, 4 = last
    return null; // placeholder
  }
}
```

### 4.5 IB-Specific Features

#### Complex Order Types

```typescript
// Bracket order example
async placeBracketOrder(symbol: string, quantity: number, 
                         entry: number, takeProfit: number, stopLoss: number) {
  const parentId = this.nextOrderId++;
  const contract = this.symbolToContract(symbol);

  // Parent: limit buy
  this.ib.placeOrder(parentId, contract, {
    action: 'BUY',
    totalQuantity: quantity,
    orderType: 'LMT',
    lmtPrice: entry,
    transmit: false,  // Don't send yet — wait for children
  });

  // Child 1: take profit (limit sell)
  const tpId = this.nextOrderId++;
  this.ib.placeOrder(tpId, contract, {
    action: 'SELL',
    totalQuantity: quantity,
    orderType: 'LMT',
    lmtPrice: takeProfit,
    parentId: parentId,
    transmit: false,
  });

  // Child 2: stop loss
  const slId = this.nextOrderId++;
  this.ib.placeOrder(slId, contract, {
    action: 'SELL',
    totalQuantity: quantity,
    orderType: 'STP',
    auxPrice: stopLoss,
    parentId: parentId,
    transmit: true,  // Now send the entire bracket
  });
}

// OCO (One-Cancels-Other) group
async placeOCOOrder(symbol: string, quantity: number,
                     limitPrice: number, stopPrice: number) {
  const ocaGroup = `OCA_${Date.now()}`;
  const contract = this.symbolToContract(symbol);

  // OCO leg 1: limit sell
  this.ib.placeOrder(this.nextOrderId++, contract, {
    action: 'SELL',
    totalQuantity: quantity,
    orderType: 'LMT',
    lmtPrice: limitPrice,
    ocaGroup,
    ocaType: 1,  // Cancel all remaining with block
  });

  // OCO leg 2: stop sell
  this.ib.placeOrder(this.nextOrderId++, contract, {
    action: 'SELL',
    totalQuantity: quantity,
    orderType: 'STP',
    auxPrice: stopPrice,
    ocaGroup,
    ocaType: 1,
  });
}
```

#### Options Chain Support

```typescript
// Request options chain data
async getOptionsChain(underlying: string, expiry: string): Promise<OptionContract[]> {
  return new Promise((resolve) => {
    const contracts: OptionContract[] = [];
    const reqId = this.nextReqId++;
    
    const contract: Contract = {
      symbol: underlying,
      secType: 'OPT',
      exchange: 'SMART',
      currency: 'USD',
      // expiry format: 'YYYYMMDD'
      lastTradeDateOrContractMonth: expiry,
    };

    this.ib.on('contractDetails', (id, details) => {
      if (id === reqId) {
        contracts.push({
          symbol: details.contract.localSymbol,
          strike: details.contract.strike,
          right: details.contract.right,  // 'C' or 'P'
          expiry: details.contract.lastTradeDateOrContractMonth,
        });
      }
    });

    this.ib.once('contractDetailsEnd', (id) => {
      if (id === reqId) resolve(contracts);
    });

    this.ib.reqContractDetails(reqId, contract);
  });
}
```

### 4.6 Rate Limiting Strategy

| Limit Type | IB Constraint | Our Strategy |
|------------|--------------|--------------|
| Message rate | 60 msg/sec | Token bucket with 55 msg/sec cap (safety margin) |
| Order rate | ~10 orders/sec sustained | Queue with 8 orders/sec throughput |
| Historical data | 60 requests / 10 min | Request scheduler with backoff |
| Market data lines | Max 50 simultaneous | Batch subscription, round-robin priority |

```typescript
// electron/broker/ib-rate-limiter.ts

export class IBRateLimiter {
  private tokenBucket: number = 55;
  private maxTokens: number = 55;
  private refillRate: number = 55; // tokens per second

  async acquire(): Promise<void> {
    if (this.tokenBucket > 0) {
      this.tokenBucket--;
      return;
    }
    // Wait for next refill
    await this.waitForRefill();
  }

  private async waitForRefill(): Promise<void> {
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (this.tokenBucket > 0) {
          this.tokenBucket--;
          clearInterval(interval);
          resolve();
        }
      }, 1000 / this.refillRate);
    });
  }
}
```

### 4.7 Week 2–3 Deliverables

| Week | Deliverable | Acceptance Criteria |
|------|------------|---------------------|
| 2 | IB adapter: connect + quotes | Connect to IB Gateway on port 4001, stream real-time quotes for US equities |
| 3 | IB adapter: orders + positions | Place/cancel orders, query positions and account data |
| 3 | Rate limiter + error handling | Token bucket implemented, graceful handling of IB error codes |
| 3 | Unit tests | >80% coverage on `ib-adapter.ts` with mocked IB API |

---

## 5. Phase 3C: Unified Account Management (Week 3–4)

### 5.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UnifiedAccountManager                     │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │  Futu Adapter  │  │ moomoo Adapter │  │   IB Adapter   │ │
│  │  (connected)   │  │  (connected)   │  │  (connected)   │ │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘ │
│          │                    │                    │          │
│          ▼                    ▼                    ▼          │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              Position Aggregator                     │     │
│  │  - Group by underlying (e.g., AAPL across brokers)  │     │
│  │  - Sum quantities, weighted avg cost                │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │             Currency Normalizer                       │     │
│  │  - All values → USD (real-time FX rates)            │     │
│  │  - Source: IB forex data or free FX API             │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              Risk Manager                            │     │
│  │  - Per-broker position limits                       │     │
│  │  - Cross-broker exposure limits                     │     │
│  │  - Concentration alerts                             │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 UnifiedAccountManager Class

```typescript
// electron/broker/unified-account-manager.ts

export interface AggregatedPosition {
  symbol: string;
  totalQuantity: number;
  weightedAvgCost: number;
  marketValue: number;
  unrealizedPnL: number;
  currency: string;           // normalized to USD
  brokerBreakdown: BrokerPosition[];
}

export interface BrokerPosition {
  brokerId: string;
  quantity: number;
  avgCost: number;
  marketValue: number;
  unrealizedPnL: number;
  originalCurrency: string;
}

export interface PortfolioSummary {
  totalEquity: number;          // USD
  totalCash: number;            // USD
  totalBuyingPower: number;     // USD
  totalUnrealizedPnL: number;   // USD
  totalRealizedPnL: number;     // USD
  positions: AggregatedPosition[];
  brokerSummaries: BrokerSummary[];
}

export interface BrokerSummary {
  brokerId: string;
  brokerName: string;
  status: 'connected' | 'disconnected' | 'error';
  equity: number;
  cash: number;
  buyingPower: number;
  positionCount: number;
  currency: string;
}

export class UnifiedAccountManager {
  private brokerManager: BrokerManager;
  private fxRates: Map<string, number> = new Map();
  private riskLimits: RiskLimits;

  constructor(brokerManager: BrokerManager, riskLimits: RiskLimits) {
    this.brokerManager = brokerManager;
    this.riskLimits = riskLimits;
    this.initFxRates();
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const adapters = this.brokerManager.getConnectedAdapters();
    const allPositions: Position[] = [];
    const brokerSummaries: BrokerSummary[] = [];

    for (const adapter of adapters) {
      const [positions, funds, accountInfo] = await Promise.all([
        adapter.getPositions(),
        adapter.getFunds(),
        adapter.getAccountInfo(),
      ]);

      allPositions.push(...positions.map(p => ({
        ...p,
        _brokerId: adapter.brokerId,
        _originalCurrency: funds.currency,
      })));

      brokerSummaries.push({
        brokerId: adapter.brokerId,
        brokerName: adapter.brokerName,
        status: adapter.status,
        equity: this.toUSD(accountInfo.equity, funds.currency),
        cash: this.toUSD(funds.cash, funds.currency),
        buyingPower: this.toUSD(funds.buyingPower, funds.currency),
        positionCount: positions.length,
        currency: funds.currency,
      });
    }

    const aggregatedPositions = this.aggregatePositions(allPositions);

    return {
      totalEquity: brokerSummaries.reduce((sum, b) => sum + b.equity, 0),
      totalCash: brokerSummaries.reduce((sum, b) => sum + b.cash, 0),
      totalBuyingPower: brokerSummaries.reduce((sum, b) => sum + b.buyingPower, 0),
      totalUnrealizedPnL: aggregatedPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0),
      totalRealizedPnL: 0, // TODO: aggregate from trade history
      positions: aggregatedPositions,
      brokerSummaries,
    };
  }

  private aggregatePositions(positions: any[]): AggregatedPosition[] {
    const grouped = new Map<string, any[]>();
    
    for (const pos of positions) {
      const key = pos.symbol;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(pos);
    }

    const result: AggregatedPosition[] = [];
    for (const [symbol, group] of grouped) {
      const totalQuantity = group.reduce((sum, p) => sum + p.quantity, 0);
      const weightedAvgCost = group.reduce(
        (sum, p) => sum + p.avgCost * p.quantity, 0
      ) / totalQuantity;

      result.push({
        symbol,
        totalQuantity,
        weightedAvgCost,
        marketValue: 0, // TODO: needs current price
        unrealizedPnL: 0, // TODO: needs current price
        currency: 'USD',
        brokerBreakdown: group.map(p => ({
          brokerId: p._brokerId,
          quantity: p.quantity,
          avgCost: p.avgCost,
          marketValue: 0,
          unrealizedPnL: 0,
          originalCurrency: p._originalCurrency,
        })),
      });
    }

    return result;
  }

  private toUSD(amount: number, currency: string): number {
    if (currency === 'USD') return amount;
    const rate = this.fxRates.get(currency) ?? 1;
    return amount * rate;
  }

  private async initFxRates(): Promise<void> {
    // Fetch from IB forex or free API
    // SGD/USD, HKD/USD, CNY/USD, etc.
    this.fxRates.set('SGD', 0.74);
    this.fxRates.set('HKD', 0.128);
    this.fxRates.set('CNY', 0.138);
  }
}
```

### 5.3 Risk Limits Configuration

```typescript
// electron/broker/risk-limits.ts

export interface RiskLimits {
  // Per-broker limits
  maxPositionValuePerBroker: number;    // USD
  maxOrdersPerMinutePerBroker: number;

  // Cross-broker limits  
  maxTotalPositionValue: number;        // USD
  maxSingleSymbolExposure: number;      // USD
  maxConcentrationPct: number;          // % of portfolio in single name

  // Order validation
  maxOrderValueUSD: number;
  requireConfirmationAboveUSD: number;
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionValuePerBroker: 500_000,
  maxOrdersPerMinutePerBroker: 10,
  maxTotalPositionValue: 1_000_000,
  maxSingleSymbolExposure: 200_000,
  maxConcentrationPct: 25,
  maxOrderValueUSD: 50_000,
  requireConfirmationAboveUSD: 10_000,
};
```

### 5.4 UI Changes

#### Sidebar Broker Selector

```
┌──────────────────────────────────────┐
│  Dawn Whales                  ⚙️     │
├──────────────────────────────────────┤
│                                      │
│  📊 Dashboard                        │
│                                      │
│  ── Brokers ─────────────────────    │
│  🟢 Futu (HK)              $45,230  │
│  🟢 moomoo (SG)            $32,100  │
│  🟡 IB (US)                $78,500  │
│                                      │
│  ── Portfolio ───────────────────    │
│  Total Equity             $155,830   │
│  Total P&L (Today)        +$1,245    │
│                                      │
│  ── Quick Trade ────────────────     │
│  Broker: [moomoo ▾]                  │
│  Symbol: [________]                  │
│  Side:   [BUY ▾]  Qty: [____]       │
│  [  Place Order  ]                   │
│                                      │
└──────────────────────────────────────┘
```

#### Cross-Broker Portfolio View

| Symbol | Futu Qty | moomoo Qty | IB Qty | Total | Avg Cost | Current | P&L |
|--------|----------|-----------|--------|-------|----------|---------|-----|
| AAPL | — | — | 100 | 100 | $172.50 | $178.30 | +$580 |
| 9988.HK | 200 | — | — | 200 | HK$85.20 | HK$88.50 | +HK$660 |
| D05.SI | — | 300 | — | 300 | S$28.10 | S$29.00 | +S$270 |
| MSFT | — | — | 50 | 50 | $410.00 | $418.20 | +$410 |

### 5.5 Order Routing Logic

```typescript
// When user places an order from the UI:
async function routeOrder(order: NewOrder, targetBroker: string): Promise<OrderResult> {
  // 1. Get the target adapter
  const adapter = brokerManager.getAdapter(targetBroker);
  if (!adapter || adapter.status !== 'connected') {
    throw new Error(`Broker ${targetBroker} is not connected`);
  }

  // 2. Validate against risk limits
  const validation = await riskManager.validate(order, adapter);
  if (!validation.passed) {
    throw new RiskLimitError(validation.message);
  }

  // 3. Convert to broker-native format and place
  return adapter.placeOrder(order);
}
```

### 5.6 Week 3–4 Deliverables

| Week | Deliverable | Acceptance Criteria |
|------|------------|---------------------|
| 3 | UnifiedAccountManager | Aggregates positions and funds across all connected brokers |
| 3 | Currency normalization | All values displayed in USD with configurable base currency |
| 4 | UI: broker selector + portfolio view | Sidebar shows all brokers; cross-broker portfolio table works |
| 4 | Risk limits engine | Order validation against per-broker and cross-broker limits |
| 4 | Integration tests | Full multi-broker scenario: connect 3 brokers, aggregate data, route orders |

---

## 6. Technical Risks & Mitigations

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| 1 | **IB API complexity** — async callbacks, request ID management, non-obvious error codes | High | High | Use `@stoqey/ib` (Promise-based wrapper); build a request ID tracker; create error code → user-friendly message mapping |
| 2 | **Currency conversion accuracy** — stale FX rates lead to incorrect P&L | Medium | Medium | Use IB real-time forex data as primary source; free FX API as fallback; show "FX rate as of" timestamp |
| 3 | **Market hour differences** — orders placed outside market hours may queue or reject | Medium | High | Centralized `MarketHours` service with timezone-aware open/close checks; show market status (🟢 open / 🔴 closed / 🟡 pre-market) per broker |
| 4 | **Order type compatibility** — IB supports bracket/OCO/trailing but OpenD may not | Medium | Medium | Define a `SupportedOrderTypes` matrix per broker; UI disables unsupported types; adapter translates or rejects gracefully |
| 5 | **Rate limiting per broker** — IB strict 60 msg/sec; OpenD subscription quotas | High | Medium | Per-adapter rate limiter; global message queue with priority (orders > quotes > account queries) |
| 6 | **Reconnection handling** — IB requires full re-subscription after disconnect | High | Medium | Implement `ReconnectManager` that tracks all active subscriptions and re-issues them on reconnect; show reconnection status in UI |
| 7 | **Port conflicts** — multiple OpenD instances on same machine | Low | Medium | Config validation at startup; auto-detect available ports; clear error messages with fix instructions |

### 6.1 Order Type Compatibility Matrix

| Order Type | Futu | moomoo | IB | UI Display |
|-----------|------|--------|----|-----------|
| Market (MKT) | ✅ | ✅ | ✅ | Always available |
| Limit (LMT) | ✅ | ✅ | ✅ | Always available |
| Stop (STP) | ✅ | ✅ | ✅ | Always available |
| Stop Limit (STP LMT) | ✅ | ✅ | ✅ | Always available |
| Trailing Stop | ❌ | ❌ | ✅ | Only when IB selected |
| Bracket | ❌ | ❌ | ✅ | Only when IB selected |
| OCO | ❌ | ❌ | ✅ | Only when IB selected |
| Iceberg | ❌ | ❌ | ✅ | Only when IB selected |
| VWAP | ❌ | ❌ | ✅ | Only when IB selected |

---

## 7. Testing Strategy

### 7.1 Test Layers

```
┌─────────────────────────────────────────────────┐
│              E2E Tests (Playwright)              │
│  Multi-broker scenario: connect, trade, verify  │
├─────────────────────────────────────────────────┤
│          Integration Tests (Jest)                │
│  Adapter + BrokerManager + UnifiedAccountMgr    │
├─────────────────────────────────────────────────┤
│            Unit Tests (Jest)                     │
│  Per-adapter with mocked broker connections     │
└─────────────────────────────────────────────────┘
```

### 7.2 Unit Tests

Each adapter gets its own test suite with mocked network connections:

| Test Suite | Scope | Target Coverage |
|-----------|-------|-----------------|
| `moomoo-adapter.test.ts` | Connect, quote, order, position, error handling | >80% |
| `ib-adapter.test.ts` | Connect, quote, order types, account, positions, rate limiting | >80% |
| `unified-account-manager.test.ts` | Aggregation, FX conversion, position grouping | >90% |
| `risk-limits.test.ts` | Limit validation, edge cases | >90% |
| `ib-rate-limiter.test.ts` | Token bucket, burst handling, backoff | >90% |
| `market-hours.test.ts` | Timezone handling, DST transitions | >85% |

### 7.3 Integration Tests

| Scenario | Description |
|----------|-------------|
| Multi-broker connect | Connect Futu + moomoo + IB simultaneously via BrokerManager |
| Cross-broker quote stream | Subscribe to same symbol on different brokers, verify unified tick delivery |
| Order routing | Place order on each broker, verify correct adapter receives it |
| Position aggregation | Seed positions across brokers, verify aggregation math |
| Failover | Kill one broker connection, verify others continue and UI updates |
| Reconnection | Disconnect/reconnect IB, verify all subscriptions restored |

### 7.4 E2E Tests

| Scenario | Steps |
|----------|-------|
| Full workflow | Launch app → Connect 3 brokers → View portfolio → Place order on moomoo → Verify position appears → Check cross-broker P&L |
| Risk limit block | Set max position limit → Attempt to exceed → Verify order rejected with clear message |
| Market hours gate | Outside market hours → Attempt order → Verify queued/rejected with market status shown |

---

## 8. Milestones & Timeline

```
Week 1 (Day 1-5)
├── Day 1-2: moomoo-adapter.ts scaffold + OpenD connection
├── Day 3-4: Quote subscription + WS engine integration
├── Day 5:   Unit tests for connect + quote flows
│
│  ✅ Milestone: moomoo adapter basic (connect + quotes)

Week 2 (Day 6-10)
├── Day 6-7:  moomoo order placement + cancellation
├── Day 8:    moomoo account/positions/funds queries
├── Day 9:    BrokerManager integration + market hours service
├── Day 10:   Full moomoo unit test suite
│
│  ✅ Milestone: moomoo full (quotes + orders + positions)

Week 3 (Day 11-15)
├── Day 11-12: ib-adapter.ts scaffold + IB Gateway connection
├── Day 13:    reqMktData + tick-to-QuoteTick mapping
├── Day 14:    Rate limiter implementation
├── Day 15:    Unit tests for connect + quote + rate limiter
│
│  ✅ Milestone: IB adapter basic (connect + quotes)

Week 4 (Day 16-20)
├── Day 16-17: IB order placement (market, limit, stop, bracket)
├── Day 18:    IB account + positions + funds
├── Day 19:    UnifiedAccountManager + UI broker selector
├── Day 20:    Integration + E2E test pass
│
│  ✅ Milestone: IB full + unified account manager
```

### 8.1 Definition of Done (Phase 3)

- [ ] moomoo adapter: full `IBrokerAdapter` compliance, tested
- [ ] IB adapter: full `IBrokerAdapter` compliance, tested
- [ ] BrokerManager: manages 3+ simultaneous broker connections
- [ ] UnifiedAccountManager: cross-broker aggregation with USD normalization
- [ ] UI: broker selector in sidebar, per-broker summary, cross-broker portfolio table
- [ ] Risk limits: configurable, validated on every order
- [ ] All adapters: reconnection handling, error recovery
- [ ] Test coverage: unit >80%, integration scenarios pass, E2E happy path passes
- [ ] Documentation: adapter setup guides for each broker

---

## 9. Dependencies & Prerequisites

| Dependency | Required For | Status |
|-----------|-------------|--------|
| moomoo OpenD installed & running | Phase 3A | ⬜ To verify |
| IB Gateway or TWS installed & running | Phase 3B | ⬜ To verify |
| IB paper trading account | Phase 3B testing | ⬜ To set up |
| `@stoqey/ib` npm package | Phase 3B | ⬜ To install |
| Existing `IBrokerAdapter` interface | All phases | ✅ Defined |
| Existing `BrokerManager` | All phases | ✅ Implemented |
| Existing `WSMarketDataEngine` | All phases | ✅ Implemented |

---

## 10. Open Questions

| # | Question | Owner | Status |
|---|---------|-------|--------|
| 1 | Should we support multiple accounts within the same broker (e.g., 2 IB accounts)? | Architecture | Open |
| 2 | FX rate source: IB forex (requires IB connection) vs. free API (less accurate)? | Data | Open |
| 3 | Should cross-broker P&L be calculated per-symbol or per-broker? | Product | Open |
| 4 | Do we need to handle corporate actions (splits, dividends) across brokers? | Backend | Deferred |
| 5 | Should the broker selector persist across app restarts (auto-reconnect)? | UX | Open |

---

*Document generated for Sprint 2 Phase 3 planning. Subject to revision as implementation progresses.*
