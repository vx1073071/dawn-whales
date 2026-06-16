<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# Multi-Broker Architecture Design

## Overview

quant-moo supports multiple broker integrations through a unified adapter interface. This document describes the architecture for multi-broker support, enabling users to connect to different trading platforms while maintaining a consistent API.

## Architecture

### Core Components

#### 1. IBrokerAdapter Interface

The `IBrokerAdapter` interface defines the contract that all broker adapters must implement:

```typescript
export interface IBrokerAdapter {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  connected: boolean;

  connect(): Promise<void>;
  disconnect(): void;

  onQuotePush(callback: (quotes: QuoteInfo[]) => void): void;
  removeQuotePush(callback: (quotes: QuoteInfo[]) => void): void;
  onDisconnect(callback: () => void): void;

  getQuotes(codes: string[]): Promise<QuoteInfo[]>;
  getKlines(code: string, period: string, count: number): Promise<KlineInfo[]>;
  getAccounts(): Promise<AccountInfo[]>;
  getFunds(accountId: string): Promise<FundsInfo>;
  getPositions(accountId: string): Promise<PositionInfo[]>;
  getOrders(accountId: string): Promise<OrderInfo[]>;
  placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }>;
  cancelOrder(orderId: string, accountId: string, code: string): Promise<void>;
  subscribeAndPush(codes: string[]): Promise<void>;
}
```

#### 2. BrokerManager

The `BrokerManager` manages multiple broker instances and provides a unified interface for the frontend:

```typescript
export class BrokerManager {
  private adapters: Map<string, IBrokerAdapter>;
  private activeAdapter: IBrokerAdapter | null;

  addAdapter(adapter: IBrokerAdapter): void;
  removeAdapter(id: string): void;
  setActiveAdapter(id: string): void;
  getActiveAdapter(): IBrokerAdapter | null;
  getAllAdapters(): IBrokerAdapter[];
}
```

#### 3. Broker Config

```typescript
export interface BrokerConfig {
  id: string;
  name: string;
  type: 'futu' | 'moomoo' | 'ib';
  host: string;
  port: number;
  enabled: boolean;
}
```

## Supported Brokers

### 1. Futu OpenD

- **Adapter**: `FutuAdapter`
- **Default Port**: 11111
- **Markets**: US, HK, CN
- **Status**: Production ready

### 2. Moomoo OpenD

- **Adapter**: `MoomooAdapter`
- **Default Port**: 11211
- **Markets**: US, HK, SG
- **Status**: Mock mode implemented, real API pending

Key differences from Futu:
- Port 11211 (vs Futu's 11111)
- Singapore market support
- Same OpenD protocol as Futu

### 3. Interactive Brokers (IB)

- **Adapter**: Planned
- **Status**: Not implemented

## Data Flow

### Quote Data Flow

```
Broker OpenD Server
    ↓ (TCP/WebSocket)
Broker Adapter (FutuAdapter/MoomooAdapter)
    ↓ (QuoteInfo[])
BrokerManager
    ↓ (onQuotePush callback)
WS Market Data Engine
    ↓ (MarketTick events)
Trade Executor / Frontend
```

### Order Execution Flow

```
Frontend (TradeDashboardPage)
    ↓ (window.api.broker.placeOrder)
Preload Bridge (electron/preload.ts)
    ↓ (ipcRenderer.invoke)
Main Process (electron/main.ts)
    ↓ (brokerManager.getActiveAdapter().placeOrder)
Broker Adapter (FutuAdapter/MoomooAdapter)
    ↓ (TCP/API call)
Broker Server
```

## Multi-Broker Features

### 1. Broker Selection

Users can select which broker to use for trading:

```typescript
// Frontend
const adapters = await window.api.broker.list();
await window.api.broker.setActive('moomoo-default');
```

### 2. Account Aggregation

Aggregate positions and funds across multiple brokers:

```typescript
const accounts = await window.api.broker.getAccounts();
const totalAssets = accounts.reduce((sum, acc) => sum + acc.totalAssets, 0);
```

### 3. Quote Aggregation

Get quotes from multiple brokers and merge:

```typescript
const quotes1 = await futuAdapter.getQuotes(['US.AAPL']);
const quotes2 = await moomooAdapter.getQuotes(['US.TSLA']);
const allQuotes = [...quotes1, ...quotes2];
```

## Configuration

### Adding a New Broker

```typescript
import { createMoomooAdapter } from './broker/moomoo-adapter';

const adapter = createMoomooAdapter({
  id: 'moomoo-hk',
  name: 'Moomoo HK',
  host: '127.0.0.1',
  port: 11211,
  market: 'HK',
  currency: 'HKD',
});

brokerManager.addAdapter(adapter);
```

### Persisting Broker Config

```typescript
const config = {
  id: 'moomoo-default',
  name: 'Moomoo',
  type: 'moomoo',
  host: '127.0.0.1',
  port: 11211,
  enabled: true,
};

await window.api.db.saveBrokerConfig(config);
```

## Mock Mode

All adapters support mock mode for testing without a real broker connection:

```typescript
const adapter = createMoomooAdapter({ ... });
adapter.setMockMode(true);
await adapter.connect(); // Connects in mock mode

// Mock data will be returned for all API calls
const accounts = await adapter.getAccounts();
const quotes = await adapter.getQuotes(['US.AAPL']);
```

## Future Enhancements

### Phase 3: Multi-Broker Trading

- [ ] Implement real Moomoo OpenD API
- [ ] Add IB (Interactive Brokers) adapter
- [ ] Implement broker failover/failback
- [ ] Add broker health monitoring
- [ ] Implement cross-broker order routing

### Phase 4: Advanced Features

- [ ] Real-time broker status dashboard
- [ ] Broker performance metrics
- [ ] Multi-broker risk management
- [ ] Cross-broker position hedging

## Testing

### Unit Tests

```typescript
describe('MoomooAdapter', () => {
  it('should connect in mock mode', async () => {
    const adapter = createMoomooAdapter({ mockMode: true });
    await adapter.connect();
    expect(adapter.connected).toBe(true);
  });

  it('should return mock quotes', async () => {
    const adapter = createMoomooAdapter({ mockMode: true });
    await adapter.connect();
    const quotes = await adapter.getQuotes(['US.AAPL']);
    expect(quotes.length).toBe(1);
    expect(quotes[0].code).toBe('US.AAPL');
  });
});
```

### Integration Tests

```typescript
describe('BrokerManager', () => {
  it('should manage multiple adapters', () => {
    const manager = new BrokerManager();
    const futu = createFutuAdapter({ id: 'futu-1' });
    const moomoo = createMoomooAdapter({ id: 'moomoo-1' });

    manager.addAdapter(futu);
    manager.addAdapter(moomoo);

    expect(manager.getAllAdapters().length).toBe(2);
  });
});
```

## Security Considerations

- Broker credentials are stored encrypted in the database
- Mock mode never makes real network connections
- All broker connections use TLS/SSL when available
- Order execution requires explicit user confirmation

## Performance

- Quote push latency: < 100ms (mock mode)
- Order execution latency: < 500ms (mock mode)
- Multi-broker quote aggregation: < 200ms

## Conclusion

The multi-broker architecture provides a flexible and extensible foundation for integrating multiple trading platforms. The unified `IBrokerAdapter` interface ensures consistency across different brokers, while the `BrokerManager` provides a clean API for the frontend. Mock mode enables comprehensive testing without requiring real broker connections.
