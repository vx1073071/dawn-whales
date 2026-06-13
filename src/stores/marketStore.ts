import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Quote, Kline, KlinePeriod } from '@/lib/types';

// ── R155 #3 #4: Cross-market defaults + localStorage persistence ──
const DEFAULT_WATCHLIST = [
  'US.AAPL', 'US.NVDA', 'US.SPY',      // 美股
  'HK.00700', 'HK.09988', 'HK.01810',   // 港股
  'CRYPTO.BTC-USDT', 'CRYPTO.ETH-USDT', // 加密货币
];

// ── R155 #9: Tagged watchlist entry (backward-compatible with string[]) ──
export interface WatchlistEntry {
  code: string;
  brokerId?: string;    // preferred broker for this symbol
  addedAt?: number;     // timestamp when added
}

interface MarketStore {
  watchlist: string[];
  /** R155: per-symbol broker bindings (tagged metadata) */
  watchlistMeta: Record<string, WatchlistEntry>;
  quotes: Record<string, Quote>;
  currentSymbol: string | null;
  klines: Record<string, Kline[]>;
  klinePeriod: KlinePeriod;

  addWatch: (code: string, brokerId?: string) => void;
  removeWatch: (code: string) => void;
  setWatchBroker: (code: string, brokerId: string) => void;
  setQuotes: (quotes: Quote[]) => void;
  setCurrentSymbol: (code: string) => void;
  setKlines: (code: string, klines: Kline[]) => void;
  setKlinePeriod: (period: KlinePeriod) => void;
}

export const useMarketStore = create<MarketStore>()(
  persist(
    (set, _get) => ({
      watchlist: DEFAULT_WATCHLIST,
      watchlistMeta: {},
      quotes: {},
      currentSymbol: null,
      klines: {},
      klinePeriod: 'daily',

      addWatch: (code, brokerId) => set((s) => {
        const meta = { ...s.watchlistMeta };
        meta[code] = { code, brokerId, addedAt: Date.now() };
        return {
          watchlist: [...new Set([...s.watchlist, code])],
          watchlistMeta: meta,
        };
      }),
      removeWatch: (code) => set((s) => {
        const meta = { ...s.watchlistMeta };
        delete meta[code];
        return {
          watchlist: s.watchlist.filter((c) => c !== code),
          watchlistMeta: meta,
        };
      }),
      setWatchBroker: (code, brokerId) => set((s) => {
        const meta = { ...s.watchlistMeta };
        meta[code] = { ...(meta[code] || { code }), brokerId };
        return { watchlistMeta: meta };
      }),
      setQuotes: (quotes) =>
        set((s) => {
          const next = { ...s.quotes };
          for (const q of quotes) next[q.code] = q;
          return { quotes: next };
        }),
      setCurrentSymbol: (code) => set({ currentSymbol: code }),
      setKlines: (code, klines) => set((s) => ({ klines: { ...s.klines, [code]: klines } })),
      setKlinePeriod: (period) => set({ klinePeriod: period }),
    }),
    {
      name: 'dw-market-store', // localStorage key
      partialize: (state) => ({
        watchlist: state.watchlist,
        watchlistMeta: state.watchlistMeta,
        klinePeriod: state.klinePeriod,
      }), // persist watchlist + meta + period
    },
  ),
);
