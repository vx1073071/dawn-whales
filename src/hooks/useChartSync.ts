// ── R122-M01 useChartSync — 统一接入 ChartStore 的 hook ──────────────────
// PM: 所有 chart/broker 组件通过此 hook 读取全局状态
// 优先级: prop > store (props override store for isolated usage)

import { useCallback, useRef } from 'react';
import { useChartStore, Market } from '../store/ChartStore';
import type { Timeframe } from '../lib/chart/types';

export interface ChartSyncOptions {
  /** If true, do NOT read from store (isolated mode) */
  isolated?: boolean;
  /** If provided, overrides store symbol */
  symbolOverride?: string;
  /** If provided, overrides store timeframe */
  timeframeOverride?: Timeframe;
  /** If provided, overrides store market */
  marketOverride?: Market;
}

export interface ChartSyncResult {
  /** Effective symbol: prop override > store > 'BTC-USDT' */
  symbol: string;
  /** Effective timeframe */
  timeframe: Timeframe;
  /** Effective market */
  market: Market;
  /** Current connected brokers */
  connectedBrokers: string[];
  /** Active indicator IDs */
  activeIndicators: string[];
  /** Set global symbol (all panels react) */
  setSymbol: (s: string) => void;
  /** Set global timeframe */
  setTimeframe: (tf: Timeframe) => void;
  /** Set global market */
  setMarket: (m: Market) => void;
  /** Set connected brokers */
  setConnectedBrokers: (ids: string[]) => void;
  /** Toggle an indicator */
  toggleIndicator: (id: string) => void;
  /** Set active indicators */
  setActiveIndicators: (ids: string[]) => void;
  /** The store itself (for selectors) */
  store: ReturnType<typeof useChartStore>;
}

/**
 * Unified hook for chart/broker components to sync with global ChartStore.
 * Components call: const { symbol, timeframe, ... } = useChartSync({ symbolOverride: props.symbol })
 */
export function useChartSync(opts: ChartSyncOptions = {}): ChartSyncResult {
  const store = useChartStore();
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const symbol = opts.symbolOverride ?? (opts.isolated ? 'BTC-USDT' : store.symbol);
  const timeframe = (opts.timeframeOverride ?? (opts.isolated ? 'D' as Timeframe : store.timeframe)) as Timeframe;
  const market = opts.marketOverride ?? (opts.isolated ? 'crypto' as Market : store.market);

  const setSymbol = useCallback((s: string) => {
    if (!optsRef.current.isolated) store.setSymbol(s);
  }, [store]);

  const setTimeframe = useCallback((tf: Timeframe) => {
    if (!optsRef.current.isolated) store.setTimeframe(tf);
  }, [store]);

  const setMarket = useCallback((m: Market) => {
    if (!optsRef.current.isolated) store.setMarket(m);
  }, [store]);

  return {
    symbol,
    timeframe,
    market,
    connectedBrokers: opts.isolated ? [] : store.connectedBrokers,
    activeIndicators: opts.isolated ? [] : store.activeIndicators,
    setSymbol,
    setTimeframe,
    setMarket,
    setConnectedBrokers: opts.isolated ? () => {} : store.setConnectedBrokers,
    toggleIndicator: opts.isolated ? () => {} : store.toggleIndicator,
    setActiveIndicators: opts.isolated ? () => {} : store.setActiveIndicators,
    store,
  };
}

// ── Clickable symbol helper ──
// Usage: <span className="cursor-pointer hover:text-blue-400" onClick={() => store.setSymbol(code)}>{code}</span>

export function makeSymbolClickable(
  text: string,
  _setSymbol: (s: string) => void,
  _className = 'cursor-pointer hover:text-[#58a6ff] transition-colors'
): string {
  // Returns the symbol text — caller should wrap in onClick
  // This is a marker function; actual rendering is in the component
  return text;
}
