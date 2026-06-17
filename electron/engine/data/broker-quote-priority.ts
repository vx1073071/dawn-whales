// R256 Claw(PM)代工: Broker-Aware Quote Priority Engine
// 用户接入券商API → 默认券商行情 → 可切换到DW行情
//
// Priority logic:
//   1. 用户接了券商API → broker source (priority=1)
//   2. Binance WS → crypto specific (priority=2 for crypto only)
//   3. Yahoo Finance WS → global fallback (priority=3)
//   4. Google Finance → backup (priority=4)
//   5. Investing.com RSS → last resort (priority=5, 15min delay)

import type { DataSourceId, SourcePriority, SourceHealth, DataPoint } from '../multi-source-aggregator/types';

// ── Detect connected brokers ──
export interface BrokerConnection {
  brokerId: 'futu' | 'ib' | 'binance' | 'other';
  connected: boolean;
  apiKey?: string;
  markets: string[];
  latency: number;
}

export function detectConnectedBrokers(): BrokerConnection[] {
  // TODO JVS: detect actual broker API connections
  // Check: futu-ws-adapter.ts connection status
  // Check: ibkr-broker-adapter.ts connection status
  // Check: BinanceRealtimeAdapter.ts connection status
  return [];
}

// ── Resolve priority for a given market/symbol ──
export function resolveSourcePriority(
  brokers: BrokerConnection[],
  market: string,
  symbol: string
): SourcePriority {
  // Crypto → Binance has highest priority
  if (market === 'CRYPTO') {
    const binanceConnected = brokers.some(b => b.brokerId === 'binance' && b.connected);
    if (binanceConnected) {
      return {
        brokerConnected: true,
        brokerSourceId: 'binance',
        fallbackOrder: ['binance', 'yahoo', 'google', 'investing'],
      };
    }
  }

  // Equity → check user's broker
  const futuConnected = brokers.some(b => b.brokerId === 'futu' && b.connected && b.markets.includes(market));
  const ibConnected = brokers.some(b => b.brokerId === 'ib' && b.connected && b.markets.includes(market));

  if (futuConnected) {
    return {
      brokerConnected: true,
      brokerSourceId: 'futu',
      fallbackOrder: ['futu', 'yahoo', 'google', 'investing'],
    };
  }
  if (ibConnected) {
    return {
      brokerConnected: true,
      brokerSourceId: 'ib',
      fallbackOrder: ['ib', 'yahoo', 'google', 'investing'],
    };
  }

  // No broker → use DW sources
  return {
    brokerConnected: false,
    brokerSourceId: 'yahoo' as DataSourceId,
    fallbackOrder: ['yahoo', 'google', 'investing'],
  };
}

// ── Switch between broker and DW sources ──
export interface QuoteSourceSwitchState {
  currentSource: DataSourceId;
  brokerAvailable: boolean;
  userPreference: 'auto' | 'broker' | 'dw';
}

let quoteSourceState: QuoteSourceSwitchState = {
  currentSource: 'yahoo',
  brokerAvailable: false,
  userPreference: 'auto',
};

export function getQuoteSourceState(): QuoteSourceSwitchState {
  return { ...quoteSourceState };
}

export function setQuoteSourcePreference(pref: 'auto' | 'broker' | 'dw'): void {
  quoteSourceState.userPreference = pref;
}

export function updateQuoteSource(brokers: BrokerConnection[]): void {
  const hasBroker = brokers.some(b => b.connected);
  quoteSourceState.brokerAvailable = hasBroker;

  if (quoteSourceState.userPreference === 'broker' && hasBroker) {
    const b = brokers.find(b => b.connected)!;
    quoteSourceState.currentSource = b.brokerId as DataSourceId;
  } else if (quoteSourceState.userPreference === 'dw') {
    quoteSourceState.currentSource = 'yahoo';
  } else {
    // auto mode
    quoteSourceState.currentSource = hasBroker
      ? (brokers.find(b => b.connected)!.brokerId as DataSourceId)
      : 'yahoo';
  }
}
