# IPC Bridge V2 — Full Channel Reference

> 📄 **R119-R120** | QClaw (document-shrimp) | 2026-06-12
>
> All IPC channels spanning electron/broker/ ↔ src/ renderer, covering R109-R120.

---

## Architecture

```
Renderer (React UI)            Main Process (Electron)           External
┌─────────────────────┐       ┌──────────────────────────┐     ┌──────────┐
│ src/components/     │  IPC  │ electron/broker/         │ WS  │ FutuOpenD│
│ src/lib/chart/      │◄─────►│ BrokerManagerV2          │────►│ Binance   │
│ src/hooks/          │       │  ├─ CryptoAdapterBase     │ REST│ OKX       │
└─────────────────────┘       │  ├─ OAuthBrokerBase       │     │ Schwab    │
                              │  ├─ DirectAdapterBase     │     │ ...14 more│
                              │  └─ BridgeAdapterBase     │     └──────────┘
                              └──────────────────────────┘
```

---

## Channel Categories

### 1. Broker Connection (R109-R111)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `broker:connect` | renderer→main | `{ brokerId: string, config?: BrokerConfig }` | R109 |
| `broker:connectMany` | renderer→main | `{ brokerIds: string[] }` | R109 |
| `broker:disconnect` | renderer→main | `{ brokerId: string }` | R109 |
| `broker:disconnectAll` | renderer→main | `void` | R109 |
| `broker:getStatus` | renderer→main | `{ brokerId: string }` → `BrokerConnectionStatus` | R109 |
| `broker:getAllStatuses` | renderer→main | `void` → `Record<BrokerType, BrokerConnectionStatus>` | R109 |
| `broker:getSubscriptions` | renderer→main | `{ brokerId?: string }` → `{ brokerId: string, codes: string[] }[]` | R109 |
| `broker:statusUpdate` | main→renderer | `{ brokerId: string, status: BrokerConnectionStatus }` | R109 |

### 2. Quote Subscriptions (R110-R115)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `quote:subscribe` | renderer→main | `{ brokerId: string, codes: string[] }` | R110 |
| `quote:unsubscribe` | renderer→main | `{ brokerId: string, codes: string[] }` | R110 |
| `quote:push` | main→renderer | `TaggedQuoteInfo` | R110 |
| `quote:aggregated` | main→renderer | `{ symbol: string, quotes: TaggedQuoteInfo[] }` | R110 |

### 3. OrderBook & Depth (R114)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `depth:subscribe` | renderer→main | `{ brokerId: string, symbol: string }` | R114 |
| `depth:unsubscribe` | renderer→main | `{ brokerId: string, symbol: string }` | R114 |
| `depth:snapshot` | main→renderer | `OrderBookSnapshot` | R114 |
| `depth:delta` | main→renderer | `OrderBookDelta` | R114 |
| `depth:cbbo` | main→renderer | `CBBO` | R116 |

### 4. Tick Data (R114)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `tick:subscribe` | renderer→main | `{ brokerId: string, symbol: string }` | R114 |
| `tick:push` | main→renderer | `TickInfo` | R114 |
| `tick:batch` | main→renderer | `TickInfo[]` | R114 |

### 5. Kline & Indicators (R113)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `chart:getKlines` | renderer→main | `KlineRequest` → `KlineResponse` | R113 |
| `chart:calcIndicator` | renderer→main | `IndicatorRequest` → `IndicatorResult` | R113 |
| `chart:calcMultiIndicator` | renderer→main | `IndicatorRequest[]` → `IndicatorResult[]` | R113 |

### 6. Scanner & FundFlow (R115)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `scanner:run` | renderer→main | `MarketScannerQuery` → `ScanResultSet` | R115 |
| `scanner:savePreset` | renderer→main | `{ preset: PresetScan }` | R115 |
| `scanner:getPresets` | renderer→main | `void` → `PresetScan[]` | R115 |
| `fundflow:get` | renderer→main | `FundFlowRequest` → `FundFlowResponse` | R115 |
| `fundflow:push` | main→renderer | `FundFlowSnapshot` | R115 |

### 7. Alerts (R115)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `alert:create` | renderer→main | `IpcAlertCreateRequest` → `AlertRule` | R115 |
| `alert:update` | renderer→main | `IpcAlertUpdateRequest` | R115 |
| `alert:delete` | renderer→main | `{ alertId: string }` | R115 |
| `alert:history` | renderer→main | `IpcAlertHistoryRequest` → `IpcAlertHistoryResponse` | R115 |
| `alert:triggered` | main→renderer | `AlertEvent` | R115 |

### 8. Signal Provider (R120)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `broker:getSignalProviders` | renderer→main | `IpcSignalProvidersRequest` → `IpcSignalProvidersResponse` | R120 |
| `broker:getTradeHistory` | renderer→main | `IpcTradeHistoryRequest` → `IpcTradeHistoryResponse` | R120 |
| `broker:subscribeProvider` | renderer→main | `IpcSubscribeProviderRequest` → `IpcSubscribeProviderResponse` | R120 |

### 9. Portfolio (R120)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `broker:getPortfolioSummary` | renderer→main | `IpcPortfolioRequest` → `PortfolioSummary` | R120 |
| `broker:getBrokerAllocation` | renderer→main | `{ brokerId: string }` → `BrokerAllocation` | R120 |
| `broker:portfolioUpdate` | main→renderer | `PortfolioSummary` (push on change) | R120 |

### 10. Arbitrage (R116)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `arbitrage:sweep` | renderer→main | `{ symbols: string[], brokers: string[] }` → `ArbitrageOpportunity[]` | R116 |
| `arbitrage:subscribe` | renderer→main | `{ symbols: string[] }` | R116 |
| `arbitrage:opportunity` | main→renderer | `ArbitrageOpportunity` | R116 |

### 11. Drawing Tools (R113)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `drawing:save` | renderer→main | `{ symbol: string, timeframe: Timeframe, drawings: DrawingState[] }` | R113 |
| `drawing:load` | renderer→main | `{ symbol: string, timeframe: Timeframe }` → `DrawingState[]` | R113 |
| `drawing:delete` | renderer→main | `{ symbol: string, timeframe: Timeframe, drawingId: string }` | R113 |

### 12. Security (R119)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `broker:storeCredential` | renderer→main | `{ brokerId: string, credential: StoredCredential }` | R119 |
| `broker:hasCredential` | renderer→main | `{ brokerId: string }` → `boolean` | R119 |
| `broker:deleteCredential` | renderer→main | `{ brokerId: string }` | R119 |

### 13. Performance (R121)

| Channel | Direction | Payload | Added |
|---------|-----------|---------|-------|
| `perf:getBaseline` | renderer→main | `void` → `PerfBaseline` | R121 |
| `perf:runBenchmark` | renderer→main | `{ benchmarkId: string }` → `BenchmarkResult` | R121 |

---

## Total Channels: 49

| Category | Count |
|----------|-------|
| Broker Connection | 8 |
| Quote Subscriptions | 4 |
| OrderBook & Depth | 5 |
| Tick Data | 3 |
| Kline & Indicators | 3 |
| Scanner & FundFlow | 5 |
| Alerts | 5 |
| Signal Provider | 3 |
| Portfolio | 3 |
| Arbitrage | 3 |
| Drawing Tools | 3 |
| Security | 3 |
| Performance | 2 |
| **Total** | **50** |

---

## Error Handling Convention

All request-response channels follow:

```typescript
// Success
ipcMain.handle('channel:name', async (_, req) => {
  try {
    const result = await service.process(req);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err.message, code: err.code };
  }
});

// Push (fire-and-forget, no error envelope)
mainWindow.webContents.send('channel:push', data);
```

---

## Data Flow: Lifecycle of a Quote

```
1. User types "HK.00700" in KLineChartPro
2. KLineChartPro → IPC: depth:subscribe { brokerId: 'futu-default', symbol: 'HK.00700' }
3. BrokerManagerV2.subscribe('futu-default', ['HK.00700'])
4. FutuOpenD → WS: subscribe depth QUOTA-SUB|HK.00700|ORDER_BOOK
5. FutuOpenD → WS push: Qot_UpdateOrderBook (bid/ask arrays)
6. QuoteAggregator.parseOrderBook(rawData) → OrderBookSnapshot
7. BrokerEventBus.emit('depth:snapshot', snapshot)
8. mainWindow.webContents.send('depth:snapshot', snapshot)
9. OrderBookWaterfall.tsx → useState → render waterfall chart
```

---

> **Channel Count**: 50 channels across 13 categories
> **V1 → V2 Migration**: Removed `broker:switch`, `broker:setActive`; Added `broker:connectMany`, depth/scanner/alert channels
> **Author**: QClaw · **Date**: 2026-06-12
