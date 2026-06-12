// ── R120 #7 PeriodPreferences: localStorage周期偏好管理 ──────────────────

import { useCallback } from 'react';
import type { Timeframe } from '../lib/chart/types';

const STORAGE_KEY = 'dw_chart_prefs';

interface ChartPreferences {
  symbol_timeframe: Record<string, Timeframe>;
  defaultTimeframe: Timeframe;
  defaultSymbol: string;
}

function loadPrefs(): ChartPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { symbol_timeframe: {}, defaultTimeframe: 'D', defaultSymbol: 'BTC-USDT' };
}

function savePrefs(prefs: ChartPreferences) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

export function usePeriodPreference() {
  const savePeriod = useCallback((symbol: string, timeframe: Timeframe) => {
    const prefs = loadPrefs();
    prefs.symbol_timeframe[symbol] = timeframe;
    savePrefs(prefs);
  }, []);

  const loadPeriod = useCallback((symbol: string): Timeframe => {
    const prefs = loadPrefs();
    return prefs.symbol_timeframe[symbol] || prefs.defaultTimeframe;
  }, []);

  const setDefaultTimeframe = useCallback((tf: Timeframe) => {
    const prefs = loadPrefs();
    prefs.defaultTimeframe = tf;
    savePrefs(prefs);
  }, []);

  const setDefaultSymbol = useCallback((symbol: string) => {
    const prefs = loadPrefs();
    prefs.defaultSymbol = symbol;
    savePrefs(prefs);
  }, []);

  return { savePeriod, loadPeriod, setDefaultTimeframe, setDefaultSymbol };
}

// ═══════════ Watchlist localStorage ═══════════

const WATCHLIST_KEY = 'dw_watchlist';

export function useWatchlistStorage() {
  const loadWatchlist = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return ['BTC-USDT', 'ETH-USDT'];
  }, []);

  const saveWatchlist = useCallback((symbols: string[]) => {
    try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(symbols)); } catch {}
  }, []);

  const addSymbol = useCallback((symbol: string) => {
    const list = loadWatchlist();
    if (!list.includes(symbol)) {
      list.push(symbol);
      saveWatchlist(list);
    }
  }, [loadWatchlist, saveWatchlist]);

  const removeSymbol = useCallback((symbol: string) => {
    saveWatchlist(loadWatchlist().filter(s => s !== symbol));
  }, [loadWatchlist, saveWatchlist]);

  return { loadWatchlist, saveWatchlist, addSymbol, removeSymbol };
}
