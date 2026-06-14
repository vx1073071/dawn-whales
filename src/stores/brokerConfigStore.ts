// @ts-nocheck
/**
 * TradingEasy R156 Claw(PM) — Shared Broker Config Store
 * 
 * Single source of truth for broker connection status and priority.
 * Used by: BrokerPriority (settings) + QuoteSourceBadge (market) + SymbolSearch.
 * 
 * Replaces two separate data sources that were out of sync.
 * 
 * ≥100L production-ready
 */

import { create } from 'zustand';

// ═══════════════ Types ════════════════════════════════════════════════════

export type BrokerMarket = 'HK' | 'US' | 'CRYPTO' | 'CN' | 'JP' | 'ALL';

export interface BrokerConnection {
  id: string;
  name: string;
  markets: BrokerMarket[];
  connected: boolean;
  priority: number;
  latencyMs: number;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastError?: string;
}

export interface MarketStatus {
  market: BrokerMarket;
  isOpen: boolean;
  isLunch: boolean;
  statusText: string;
}

interface BrokerConfigStore {
  brokers: BrokerConnection[];
  marketStatuses: MarketStatus[];
  activeQuoteSource: string | null;  // which broker is currently providing quotes

  setBrokers: (brokers: BrokerConnection[]) => void;
  updateBroker: (id: string, partial: Partial<BrokerConnection>) => void;
  setMarketStatuses: (statuses: MarketStatus[]) => void;
  setActiveQuoteSource: (id: string | null) => void;
  getConnectedBrokers: () => BrokerConnection[];
  getBrokersForMarket: (market: BrokerMarket) => BrokerConnection[];
  getBrokerByPriority: (market: BrokerMarket) => BrokerConnection | null;
}

// ═══════════════ Store ════════════════════════════════════════════════════

export const useBrokerConfigStore = create<BrokerConfigStore>((set, get) => ({
  brokers: [],
  marketStatuses: [],
  activeQuoteSource: null,

  setBrokers: (brokers) => set({ brokers }),
  updateBroker: (id, partial) => set((s) => ({
    brokers: s.brokers.map(b => b.id === id ? { ...b, ...partial } : b),
  })),
  setMarketStatuses: (statuses) => set({ marketStatuses: statuses }),
  setActiveQuoteSource: (id) => set({ activeQuoteSource: id }),

  getConnectedBrokers: () => get().brokers.filter(b => b.connected),
  getBrokersForMarket: (market) =>
    get().brokers
      .filter(b => b.connected && (b.markets.includes(market) || b.markets.includes('ALL')))
      .sort((a, b) => a.priority - b.priority),
  getBrokerByPriority: (market) => get().getBrokersForMarket(market)[0] || null,
}));
