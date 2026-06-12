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
  const [symbol, setSymbol] = useState(() => {
    try { return localStorage.getItem('dw_symbol') || 'BTC-USDT'; } catch { return 'BTC-USDT'; }
  });
  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    try { return (localStorage.getItem('dw_tf') as Timeframe) || 'D'; } catch { return 'D'; }
  });
  const [market, setMarketState] = useState<'crypto' | 'us' | 'hk' | 'forex'>(() => {
    try { return (localStorage.getItem('dw_market') as any) || 'crypto'; } catch { return 'crypto'; }
  });
  const [connectedBrokers, setConnectedBrokers] = useState<string[]>([]);
  const [activeIndicators, setActiveIndicatorsState] = useState<string[]>(() => {
    try { const saved = localStorage.getItem('dw_indicators'); return saved ? JSON.parse(saved) : ['ma', 'boll']; }
    catch { return ['ma', 'boll']; }
  });

  // --- persisted setters ---
  const setSymbolPersisted = useCallback((s: string) => {
    setSymbol(s); try { localStorage.setItem('dw_symbol', s); } catch {}
  }, []);
  const setTimeframePersisted = useCallback((tf: Timeframe) => {
    setTimeframe(tf); try { localStorage.setItem('dw_tf', tf); } catch {}
  }, []);
  const setMarket = useCallback((m: 'crypto' | 'us' | 'hk' | 'forex') => {
    setMarketState(m); try { localStorage.setItem('dw_market', m); } catch {}
  }, []);

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
      symbol, setSymbol: setSymbolPersisted,
      timeframe, setTimeframe: setTimeframePersisted,
      market, setMarket,
      connectedBrokers, setConnectedBrokers,
      activeIndicators, setActiveIndicators, toggleIndicator,
    }}>
      {children}
    </ChartContext.Provider>
  );
}
