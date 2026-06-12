// ── R119 #19 useBrokerData Hook — 券商IPC数据获取（mock→real桥接）─────
// 所有券商UI组件从这个hook获取数据，自动降级到mock

import { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════ Types ═══════════

export interface BrokerDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdate: number | null;
  source: 'ipc' | 'mock' | 'none';
}

export interface UseBrokerDataOptions<T> {
  channel: string;        // IPC channel name (e.g. 'broker:getAggregatedPositions')
  params?: Record<string, unknown>;
  mockData?: T;            // fallback when IPC unavailable
  pollInterval?: number;   // ms, 0 = no polling
  enabled?: boolean;       // default true
}

// ═══════════ IPC Check ═══════════

function hasIpc(): boolean {
  try {
    return typeof window !== 'undefined' && !!(window as any).electronAPI;
  } catch { return false; }
}

// ═══════════ Hook ═══════════

export function useBrokerData<T = unknown>({
  channel, params, mockData, pollInterval = 0, enabled = true,
}: UseBrokerDataOptions<T>): BrokerDataState<T> & { refetch: () => void } {
  const [state, setState] = useState<BrokerDataState<T>>({
    data: null, loading: true, error: null, lastUpdate: null, source: 'none',
  });
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchData = useCallback(async () => {
    if (!mountedRef.current || !enabled) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    if (hasIpc()) {
      try {
        const api = (window as any).electronAPI;
        const result = await api.invoke(channel, params || {});
        if (mountedRef.current) {
          setState({
            data: result as T, loading: false, error: null,
            lastUpdate: Date.now(), source: 'ipc',
          });
        }
      } catch (err: any) {
        // IPC failed, fall back to mock
        if (mountedRef.current) {
          if (mockData != null) {
            setState({
              data: mockData, loading: false, error: null,
              lastUpdate: Date.now(), source: 'mock',
            });
          } else {
            setState(prev => ({
              ...prev, loading: false,
              error: err?.message || 'IPC调用失败',
            }));
          }
        }
      }
    } else {
      // No IPC available (browser dev / testing)
      if (mountedRef.current) {
        setState({
          data: mockData || null, loading: false, error: null,
          lastUpdate: Date.now(), source: mockData != null ? 'mock' : 'none',
        });
      }
    }
  }, [channel, JSON.stringify(params)]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  // Polling
  useEffect(() => {
    if (pollInterval > 0 && enabled) {
      timerRef.current = setInterval(fetchData, pollInterval);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pollInterval, enabled, fetchData]);

  return { ...state, refetch: fetchData };
}

// ═══════════ Subscribe Hook (for real-time push via WS) ═══════════

export interface SubscribeState<T> {
  data: T | null;
  connected: boolean;
  error: string | null;
  source: 'ws' | 'mock' | 'none';
}

export function useBrokerSubscribe<T = unknown>({
  channel, params, mockData, enabled = true,
}: UseBrokerDataOptions<T>): SubscribeState<T> {
  const [state, setState] = useState<SubscribeState<T>>({
    data: null, connected: false, error: null, source: 'none',
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    if (hasIpc()) {
      try {
        const api = (window as any).electronAPI;
        // Subscribe to push channel
        const unsub = api.on(channel, (data: T) => {
          if (mountedRef.current) {
            setState({ data, connected: true, error: null, source: 'ws' });
          }
        });
        // Initial subscribe
        api.invoke(channel + ':subscribe', params || {}).catch(() => {
          // Fall back to mock
          if (mountedRef.current && mockData != null) {
            setState({ data: mockData, connected: false, error: null, source: 'mock' });
          }
        });

        return () => {
          mountedRef.current = false;
          if (typeof unsub === 'function') unsub();
        };
      } catch {
        // Fallback
        if (mountedRef.current && mockData != null) {
          setState({ data: mockData, connected: false, error: null, source: 'mock' });
        }
      }
    } else if (mockData != null) {
      setState({ data: mockData, connected: false, error: null, source: 'mock' });
    }

    return () => { mountedRef.current = false; };
  }, [channel, JSON.stringify(params), enabled]);

  return state;
}

// ═══════════ Broker Connection Status Hook ═══════════

export interface BrokerConnectionStatus {
  brokerId: string;
  brokerName: string;
  status: 'connected' | 'connecting' | 'stale' | 'disconnected';
  latency?: number;
  lastUpdate?: number;
}

export function useBrokerConnections(pollInterval = 5000) {
  return useBrokerData<BrokerConnectionStatus[]>({
    channel: 'broker:getConnectionStatus',
    pollInterval,
    mockData: [
      { brokerId: 'binance', brokerName: 'Binance', status: 'connected', latency: 12, lastUpdate: Date.now() },
      { brokerId: 'okx', brokerName: 'OKX', status: 'connected', latency: 45, lastUpdate: Date.now() },
      { brokerId: 'bybit', brokerName: 'Bybit', status: 'stale', latency: 350, lastUpdate: Date.now() - 10000 },
      { brokerId: 'futu', brokerName: 'Futu', status: 'disconnected' },
    ],
  });
}
