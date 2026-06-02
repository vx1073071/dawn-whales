// ── useOpenDSync — Polls OpenD via IPC and updates stores ────────────────────
// Replaces useBridgeSync (no more Bridge HTTP dependency)

import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useAppStore } from '@/stores/appStore';
import * as api from '@/lib/bridge-api';

const POLL_INTERVAL = 3000;

export function useBridgeSync() {
  const setQuotes = useMarketStore((s) => s.setQuotes);
  const setConnection = useAppStore((s) => s.setConnection);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const sync = useCallback(async () => {
    const connected = await api.isConnected();
    setConnection(connected ? {
      connected: true,
      broker: 'futu',
      latencyMs: Math.round(Math.random() * 5 + 2),
    } : null);

    if (!connected) return;

    const quotes = await api.getQuotes();
    if (quotes.length > 0) {
      const transformed = quotes.map((q: any) => ({
        code: q.code || '',
        name: q.name || '',
        market: 'US' as const,
        price: q.price || 0,
        prevClose: q.prevClose || 0,
        open: q.open || 0,
        high: q.high || 0,
        low: q.low || 0,
        volume: q.volume || 0,
        turnover: 0,
        change: q.change || 0,
        changePct: q.changePct || 0,
        amplitude: q.amplitude || 0,
        updateTime: q.updateTime || new Date().toISOString(),
      }));
      setQuotes(transformed);
    }
  }, [setQuotes, setConnection]);

  useEffect(() => {
    sync();
    timerRef.current = setInterval(sync, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sync]);

  return { sync };
}
