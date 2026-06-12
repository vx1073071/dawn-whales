// ── R120 #20 ChartContext — 全局图表状态共享 ────────────────────────────
// 所有chart组件通过此context同步 symbol/timeframe/market/connectedBrokers

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Timeframe } from '../lib/chart/types';

// ═══════════ Types ═══════════

export interface ChartContextValue {
  symbol: string;
  setSymbol: (s: string) => void;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  market: 'crypto' | 'us' | 'hk' | 'forex';
  setMarket: (m: 'crypto' | 'us' | 'hk' | 'forex') => void;
  connectedBrokers: string[];
  setConnectedBrokers: (ids: string[]) => void;
  activeIndicators: string[];
  setActiveIndicators: (ids: string[]) => void;
  toggleIndicator: (id: string) => void;
}

// ═══════════ Context ═══════════

const ChartContext = createContext<ChartContextValue | null>(null);

export function useChartContext() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error('useChartContext must be used within ChartContextProvider');
  return ctx;
}

export function useChartContextSafe() {
  return useContext(ChartContext);
}

// ═══════════ Provider ═══════════

export function ChartContextProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbol] = useState('BTC-USDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('D');
  const [market, setMarket] = useState<'crypto' | 'us' | 'hk' | 'forex'>('crypto');
  const [connectedBrokers, setConnectedBrokers] = useState<string[]>([]);
  const [activeIndicators, setActiveIndicatorsState] = useState<string[]>(['ma', 'boll']);

  const setActiveIndicators = useCallback((ids: string[]) => {
    setActiveIndicatorsState(ids);
    try { localStorage.setItem('dw_indicators', JSON.stringify(ids)); } catch {}
  }, []);

  const toggleIndicator = useCallback((id: string) => {
    setActiveIndicatorsState(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem('dw_indicators', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <ChartContext.Provider value={{
      symbol, setSymbol,
      timeframe, setTimeframe,
      market, setMarket,
      connectedBrokers, setConnectedBrokers,
      activeIndicators, setActiveIndicators, toggleIndicator,
    }}>
      {children}
    </ChartContext.Provider>
  );
}
