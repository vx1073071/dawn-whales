// ── useOpenDSync — Push-based real-time quotes from OpenD via IPC ────────────
// Push mode: <50ms latency. OpenD pushes quote updates, no polling needed.

import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useAppStore } from '@/stores/appStore';
import * as api from '@/lib/bridge-api';

const INITIAL_SYNC_INTERVAL = 60000; // Health check every 60s (lightweight)

export function useBridgeSync() {
  const setQuotes = useMarketStore((s) => s.setQuotes);
  const setConnection = useAppStore((s) => s.setConnection);
  const lastPushRef = useRef<number>(0);

  // Initial sync: check connection + pull first batch
  const initialSync = useCallback(async () => {
    const connected = await api.isConnected();
    setConnection(connected ? {
      connected: true,
      broker: 'futu',
      latencyMs: 0,
    } : null);

    if (!connected) return;

    const quotes = await api.getQuotes();
    if (quotes.length > 0) {
      const transformed = quotes.map((q: any) => ({
        code: q.code || '',
        name: q.name || q.code || '',
        market: 'US' as const,
        price: q.price || 0,
        prevClose: q.prevClose || 0,
        open: q.open || 0,
        high: q.high || 0,
        low: q.low || 0,
        volume: q.volume || 0,
        turnover: q.amount || 0,
        change: q.change || 0,
        changePct: q.changePct || 0,
        amplitude: q.amplitude || 0,
        updateTime: q.updateTime || new Date().toISOString(),
      }));
      setQuotes(transformed);
    }
  }, [setQuotes, setConnection]);

  useEffect(() => {
    // Initial sync
    initialSync();

    // Lightweight health check
    const healthTimer = setInterval(async () => {
      const connected = await api.isConnected();
      if (!connected) {
        setConnection(null);
      }
    }, INITIAL_SYNC_INTERVAL);

    // Push mode: listen for real-time quote updates from OpenD
    const onPush = (quotes: any[]) => {
      lastPushRef.current = Date.now();
      if (!quotes || quotes.length === 0) return;

      const transformed = quotes.map((q: any) => ({
        code: q.code || '',
        name: q.name || q.code || '',
        market: 'US' as const,
        price: q.price || 0,
        prevClose: q.prevClose || 0,
        open: q.open || 0,
        high: q.high || 0,
        low: q.low || 0,
        volume: q.volume || 0,
        turnover: q.amount || 0,
        change: q.change || 0,
        changePct: q.changePct || 0,
        amplitude: q.amplitude || 0,
        updateTime: q.updateTime || new Date().toISOString(),
      }));
      setQuotes(transformed);
    };

    // Register push listener via preload API
    if (window.api?.on) {
      window.api.on('quotes:push', onPush);
    }

    return () => {
      clearInterval(healthTimer);
      // Note: ipcRenderer.on listeners persist until removed; in practice
      // this component lives for the app lifetime so cleanup is minimal
    };
  }, [initialSync, setQuotes, setConnection]);

  return { sync: initialSync };
}
