// ── R122-M01 ChartStore (Zustand) — 全局图表状态共享 ───────────────────
// PM: 替换原 ChartContext (React Context) → Zustand store
// 要求: 所有 15 个 chart 组件通过此 store 同步 symbol/timeframe/indicators

import { create } from 'zustand';
import type { Timeframe } from '../lib/chart/types';

export type Market = 'crypto' | 'us' | 'hk' | 'forex';
export type ChartTab = 'kline' | 'depth' | 'tick' | 'footprint' | 'heatmap' | 'scanner' | 'replay';

export interface ChartState {
  // ── Core state ──
  symbol: string;
  timeframe: Timeframe;
  market: Market;
  activeTab: ChartTab;
  connectedBrokers: string[];
  activeIndicators: string[];

  // ── Actions ──
  setSymbol: (s: string) => void;
  setTimeframe: (tf: Timeframe) => void;
  setMarket: (m: Market) => void;
  setActiveTab: (tab: ChartTab) => void;
  setConnectedBrokers: (ids: string[]) => void;
  setActiveIndicators: (ids: string[]) => void;
  toggleIndicator: (id: string) => void;

  // ── Cross-broker state ──
  selectedBroker: string | null;
  setSelectedBroker: (id: string | null) => void;
}

// ── localStorage helpers ──
const loadStr = (key: string, fallback: string): string => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};
const loadJSON = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};

export const useChartStore = create<ChartState>((set) => ({
  // ── Initial state from localStorage ──
  symbol: loadStr('dw_symbol', 'BTC-USDT'),
  timeframe: (loadStr('dw_tf', 'D') as Timeframe),
  market: (loadStr('dw_market', 'crypto') as Market),
  activeTab: (loadStr('dw_tab', 'kline') as ChartTab),
  connectedBrokers: [],
  activeIndicators: loadJSON<string[]>('dw_indicators', ['ma', 'boll']),
  selectedBroker: null,

  // ── Persisted actions ──
  setSymbol: (s) => { set({ symbol: s }); try { localStorage.setItem('dw_symbol', s); } catch {} },
  setTimeframe: (tf) => { set({ timeframe: tf }); try { localStorage.setItem('dw_tf', tf); } catch {} },
  setMarket: (m) => { set({ market: m }); try { localStorage.setItem('dw_market', m); } catch {} },
  setActiveTab: (tab) => { set({ activeTab: tab }); try { localStorage.setItem('dw_tab', tab); } catch {} },
  setConnectedBrokers: (ids) => set({ connectedBrokers: ids }),
  setActiveIndicators: (ids) => {
    set({ activeIndicators: ids });
    try { localStorage.setItem('dw_indicators', JSON.stringify(ids)); } catch {}
  },
  toggleIndicator: (id) => set((state) => {
    const next = state.activeIndicators.includes(id)
      ? state.activeIndicators.filter((x) => x !== id)
      : [...state.activeIndicators, id];
    try { localStorage.setItem('dw_indicators', JSON.stringify(next)); } catch {}
    return { activeIndicators: next };
  }),
  setSelectedBroker: (id) => set({ selectedBroker: id }),
}));

// ── Selectors (for performance) ──
export const selectSymbol = (s: ChartState) => s.symbol;
export const selectTimeframe = (s: ChartState) => s.timeframe;
export const selectMarket = (s: ChartState) => s.market;
export const selectActiveIndicators = (s: ChartState) => s.activeIndicators;
export const selectConnectedBrokers = (s: ChartState) => s.connectedBrokers;
