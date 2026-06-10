import { useState, useEffect, useRef, useCallback } from 'react';

// ── ML-23-02: WebSocket Real-time Quote Hook ───────────────────────────────
// Integrates with electron/engine/ws-market-data.ts via window.api
// Provides real-time price updates for Dashboard/Market/Portfolio pages

interface WsQuote {
  code: string;
  price: number;
  bid: number;
  ask: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: number;
  source: 'ws' | 'opend' | 'fallback';
}

interface UseWsQuotesOptions {
  /** Symbols to subscribe */
  symbols: string[];
  /** Update interval for fallback mode (ms), default 5000 */
  fallbackIntervalMs?: number;
  /** Whether WebSocket is enabled */
  enabled?: boolean;
}

interface UseWsQuotesResult {
  /** Map of code → latest quote */
  quotes: Map<string, WsQuote>;
  /** Whether WebSocket is connected */
  connected: boolean;
  /** Connection source: 'ws' | 'opend' | 'polling' */
  source: string;
  /** Error message if any */
  error: string | null;
  /** Manually refresh via fallback */
  refresh: () => void;
  /** Subscribe to additional symbols */
  subscribe: (symbols: string[]) => void;
  /** Unsubscribe from symbols */
  unsubscribe: (symbols: string[]) => void;
}

export function useWebSocketQuotes(options: UseWsQuotesOptions): UseWsQuotesResult {
  const { symbols, fallbackIntervalMs = 5000, enabled = true } = options;
  const [quotes, setQuotes] = useState<Map<string, WsQuote>>(new Map());
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState<string>('polling');
  const [error, _setError] = useState<string | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const listenerRef = useRef<(() => void) | null>(null);

  // WebSocket connection via Electron IPC
  const connectWs = useCallback(async () => {
    try {
      const w = (window as any);
      const api = w?.api ?? w?.electron?.api;

      if (!api?.ws) return false;

      // Connect if not connected
      const status = await api.ws.getStatus?.().catch(() => null);
      if (!status?.connected) {
        await api.ws.connect?.().catch(() => {});
      }

      // Subscribe to symbols
      if (symbols.length > 0) {
        await api.ws.subscribe?.(symbols).catch(() => {});
      }

      // Listen for real-time updates
      if (listenerRef.current) listenerRef.current();
      listenerRef.current = api.ws.onQuote?.((quote: WsQuote) => {
        setQuotes(prev => {
          const next = new Map(prev);
          next.set(quote.code, { ...quote, source: 'ws' });
          return next;
        });
      });

      setConnected(true);
      setSource('ws');
      return true;
    } catch (e) {
      return false;
    }
  }, [symbols]);

  // Fallback: poll via OpenD / bridge-api
  const pollFallback = useCallback(async () => {
    try {
      const w = (window as any);
      const api = w?.api ?? w?.electron?.api;

      if (api?.getQuotes) {
        const result = await api.getQuotes(symbols);
        if (result?.success && Array.isArray(result.quotes)) {
          setQuotes(prev => {
            const next = new Map(prev);
            result.quotes.forEach((q: unknown) => {
              next.set(q.code, {
                code: q.code,
                price: q.price ?? q.last,
                bid: q.bid ?? 0,
                ask: q.ask ?? 0,
                change: q.change ?? 0,
                changePct: q.changePct ?? 0,
                volume: q.volume ?? 0,
                timestamp: Date.now(),
                source: 'opend',
              });
            });
            return next;
          });
          setSource('opend');
          return;
        }
      }

      // Last resort: mark as polling with empty data
      setSource('polling');
    } catch (e) {
      setSource('polling');
    }
  }, [symbols]);

  // Subscribe to new symbols
  const subscribe = useCallback(async (newSymbols: string[]) => {
    const w = (window as any);
    const api = w?.api ?? w?.electron?.api;

    const toAdd = newSymbols.filter(s => !subscribedRef.current.has(s));
    if (toAdd.length === 0) return;

    toAdd.forEach(s => subscribedRef.current.add(s));

    if (api?.ws?.subscribe && connected) {
      await api.ws.subscribe(toAdd).catch(() => {});
    }
  }, [connected]);

  // Unsubscribe
  const unsubscribe = useCallback(async (removeSymbols: string[]) => {
    const w = (window as any);
    const api = w?.api ?? w?.electron?.api;

    removeSymbols.forEach(s => subscribedRef.current.delete(s));

    if (api?.ws?.unsubscribe && connected) {
      await api.ws.unsubscribe(removeSymbols).catch(() => {});
    }
  }, [connected]);

  // Manual refresh (for polling fallback)
  const refresh = useCallback(() => {
    pollFallback();
  }, [pollFallback]);

  // Initialize
  useEffect(() => {
    if (!enabled || symbols.length === 0) {
      setConnected(false);
      setSource('polling');
      return;
    }

    // Track subscribed symbols
    symbols.forEach(s => subscribedRef.current.add(s));

    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    // Try WebSocket first, fall back to polling
    connectWs().then(success => {
      if (!success) {
        // Start polling fallback
        setSource('polling');
        pollFallback();
        fallbackTimer = setInterval(pollFallback, fallbackIntervalMs);
      }
    }).catch(() => {
      setSource('polling');
      pollFallback();
      fallbackTimer = setInterval(pollFallback, fallbackIntervalMs);
    });

    return () => {
      if (listenerRef.current) listenerRef.current();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [symbols.join(','), enabled]);

  return { quotes, connected, source, error, refresh, subscribe, unsubscribe };
}
