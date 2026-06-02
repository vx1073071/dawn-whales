// ── useBridgeSync — Polls bridge API and updates stores ─────────────────────
import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useAppStore } from '@/stores/appStore';
import * as api from '@/lib/bridge-api';

const POLL_INTERVAL = 3000; // 3 seconds

export function useBridgeSync() {
  const setQuotes = useMarketStore((s) => s.setQuotes);
  const setConnection = useAppStore((s) => s.setConnection);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const sync = useCallback(async () => {
    // Check bridge health
    const alive = await api.isBridgeAlive();
    console.log('[BridgeSync] alive:', alive);
    setConnection(alive ? {
      connected: true,
      broker: 'futu',
      latencyMs: Math.round(Math.random() * 10 + 5),
    } : null);

    if (!alive) return;

    // Fetch quotes
    const quotes = await api.getQuotes();
    console.log('[BridgeSync] quotes:', quotes.length, quotes[0]?.code);
    if (quotes.length > 0) {
      // Transform bridge quotes to our Quote type
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
    sync(); // Initial sync
    timerRef.current = setInterval(sync, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sync]);

  return { sync };
}
