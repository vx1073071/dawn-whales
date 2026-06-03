// ── useOpenDSync — Push-based real-time quotes from OpenD via IPC ────────────
// Push mode: <50ms latency. OpenD pushes quote updates, no polling needed.

import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useAppStore } from '@/stores/appStore';
import * as api from '@/lib/bridge-api';

const HEALTH_CHECK_INTERVAL = 60000; // 60s lightweight health check

function transformQuote(q: any) {
  return {
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
  };
}

export function useBridgeSync() {
  const setQuotes = useMarketStore((s) => s.setQuotes);
  const setConnection = useAppStore((s) => s.setConnection);
  const lastPushRef = useRef<number>(0);

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
      setQuotes(quotes.map(transformQuote));
    }
  }, [setQuotes, setConnection]);

  useEffect(() => {
    initialSync();

    // Health check
    const healthTimer = setInterval(async () => {
      const connected = await api.isConnected();
      if (!connected) setConnection(null);
    }, HEALTH_CHECK_INTERVAL);

    // Push listener
    const onPush = (quotes: any[]) => {
      lastPushRef.current = Date.now();
      if (!quotes || quotes.length === 0) return;
      setQuotes(quotes.map(transformQuote));
    };

    // Signal listener — show notification in UI
    const onSignal = (_data: any) => {
      // Strategy signal received — handled by StrategyPage
    };

    // Risk alert listener
    const onRiskAlert = (_data: any) => {
      // Risk alert received — handled by SettingsPage
    };

    if (window.api?.on) {
      window.api.on('quotes:push', onPush);
      window.api.on('strategy-signal', onSignal);
      window.api.on('risk-alert', onRiskAlert);
    }

    return () => {
      clearInterval(healthTimer);
      // Note: ipcRenderer listeners persist until removed;
      // In practice this component lives for app lifetime
    };
  }, [initialSync, setQuotes, setConnection]);

  return { sync: initialSync };
}
