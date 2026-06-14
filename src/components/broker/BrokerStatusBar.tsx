/**
 * TradingEasy R123 J01 — BrokerStatusBar
 * 
 * Top-bar persistent component showing broker connection status.
 * Green (connected) / Yellow (connecting/reconnecting) / Red (disconnected).
 * On disconnect: auto desktop notification.
 */

import React, { useEffect, useState, useCallback } from 'react';

// ═══════════ Types ════════════════════════════════════════

export interface BrokerStatus {
  brokerId: string;
  brokerName: string;
  brokerType: string;
  connected: boolean;
  connecting?: boolean;
  latencyMs?: number;
  lastConnectedAt?: number;
  error?: string;
}

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

// ═══════════ Hook: useBrokerStatus ═══════════════════════

export function useBrokerStatus(refreshMs = 5000) {
  const [statuses, setStatuses] = useState<BrokerStatus[]>([]);
  const [overallState, setOverallState] = useState<ConnectionState>('disconnected');

  const fetchStatus = useCallback(async () => {
    try {
      const api = (window as any).api;
      if (!api?.broker?.getStatus) return;
      const result = await api.broker.getStatus();
      if (result?.success && result.statuses) {
        setStatuses(result.statuses);
        computeOverall(result.statuses);
      }
    } catch {
      // Silent fail — retries next interval
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, refreshMs);
    return () => clearInterval(timer);
  }, [fetchStatus, refreshMs]);

  // Listen for disconnect events
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.on) return;

    const unsub = api.on('ws:disconnected', () => {
      setOverallState('disconnected');
      notifyDisconnect('Connection lost');
    });
    const unsubRe = api.on('ws:reconnecting', () => setOverallState('reconnecting'));
    const unsubCon = api.on('ws:connected', () => setOverallState('connected'));

    return () => { unsub?.(); unsubRe?.(); unsubCon?.(); };
  }, []);

  function computeOverall(stats: BrokerStatus[]) {
    if (stats.length === 0) {
      setOverallState('disconnected');
      return;
    }
    const anyConnected = stats.some(s => s.connected);
    const anyConnecting = stats.some(s => s.connecting);
    if (anyConnected) setOverallState('connected');
    else if (anyConnecting) setOverallState('connecting');
    else setOverallState('disconnected');
  }

  function notifyDisconnect(msg: string) {
    try {
      (window as any).api?.pushEvent?.('notify:desktop', {
        title: 'Broker Disconnected',
        body: msg,
      });
    } catch {}
  }

  return { statuses, overallState, fetchStatus };
}

// ═══════════ BrokerStatusBar Component ═══════════════════

const STATE_CONFIG: Record<ConnectionState, { bg: string; dot: string; label: string }> = {
  connected: { bg: 'bg-[#0d3320]', dot: 'bg-[#22c55e]', label: '已连接' },
  connecting: { bg: 'bg-[#332a0d]', dot: 'bg-[#f59e0b] animate-pulse', label: '连接中' },
  reconnecting: { bg: 'bg-[#332a0d]', dot: 'bg-[#f59e0b] animate-pulse', label: '重连中' },
  disconnected: { bg: 'bg-[#330d17]', dot: 'bg-[#ef4444]', label: '未连接' },
};

export const BrokerStatusBar: React.FC = () => {
  const { statuses, overallState } = useBrokerStatus();
  const config = STATE_CONFIG[overallState];
  const [expanded, setExpanded] = useState(false);

  const connectedCount = statuses.filter(s => s.connected).length;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 text-[11px] ${config.bg} border-b border-[#21262d]`}>
      {/* Overall indicator */}
      <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className={`inline-block w-2 h-2 rounded-full ${config.dot}`} />
        <span className="text-[#8b949e]">{config.label}</span>
        {statuses.length > 0 && (
          <span className="text-[#484f58]">
            ({connectedCount}/{statuses.length})
          </span>
        )}
      </div>

      {/* Per-broker chips */}
      {expanded && (
        <div className="flex items-center gap-1.5 ml-2">
          {statuses.map(s => (
            <span
              key={s.brokerId}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${
                s.connected
                  ? 'bg-[#0d3320] border-[#22c55e40] text-[#3fb950]'
                  : 'bg-[#330d17] border-[#ef444440] text-[#f85149]'
              }`}
              title={s.error || ''}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${s.connected ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
              {s.brokerName || s.brokerId}
              {s.latencyMs != null && <span className="text-[#484f58]">{s.latencyMs}ms</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
