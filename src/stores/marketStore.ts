import { create } from 'zustand';
import type { Quote, Kline, KlinePeriod } from '@/lib/types';

interface MarketStore {
  watchlist: string[];
  quotes: Record<string, Quote>;
  currentSymbol: string | null;
  klines: Record<string, Kline[]>;
  klinePeriod: KlinePeriod;

  addWatch: (code: string) => void;
  removeWatch: (code: string) => void;
  setQuotes: (quotes: Quote[]) => void;
  setCurrentSymbol: (code: string) => void;
  setKlines: (code: string, klines: Kline[]) => void;
  setKlinePeriod: (period: KlinePeriod) => void;
}

export const useMarketStore = create<MarketStore>((set) => ({
  watchlist: ['US.TQQQ', 'US.SOXL', 'US.QQQ', 'US.SPY', 'US.AAPL', 'US.NVDA', 'US.SQQQ', 'US.SOXS'],
  quotes: {},
  currentSymbol: null,
  klines: {},
  klinePeriod: 'daily',

  addWatch: (code) => set((s) => ({ watchlist: [...new Set([...s.watchlist, code])] })),
  removeWatch: (code) => set((s) => ({ watchlist: s.watchlist.filter((c) => c !== code) })),
  setQuotes: (quotes) =>
    set((s) => {
      const next = { ...s.quotes };
      for (const q of quotes) next[q.code] = q;
      return { quotes: next };
    }),
  setCurrentSymbol: (code) => set({ currentSymbol: code }),
  setKlines: (code, klines) => set((s) => ({ klines: { ...s.klines, [code]: klines } })),
  setKlinePeriod: (period) => set({ klinePeriod: period }),
}));
