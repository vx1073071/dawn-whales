/**
 * R221 JVS#6: BrokerConnectionIndicator — BrokerManagerV2 连接状态可视化
 *
 * Displays per-broker connection status as color-coded LED indicators
 * (🟢 GREEN = connected, 🟡 YELLOW = connecting, 🔴 RED = disconnected).
 *
 * Integrates with BrokerManagerV2 via broker:health-check-all IPC.
 * Shows:
 *   - Broker name + type badge
 *   - LED status light (animated on connecting)
 *   - Latency (ms)
 *   - Last heartbeat time
 *   - Error count
 *   - Subscriptions count
 *
 * v2.3.0 CRYSTAL — >=150L
 */

import { useEffect, useState, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────

export interface BrokerConnectionInfo {
  brokerId: string;
  brokerName: string;
  brokerType?: string;
  connected: boolean;
  status: 'GREEN' | 'YELLOW' | 'RED';
  statusText: string;
  latencyMs: number;
  lastHeartbeat: number;
  errors: number;
  subscriptions?: number;
}

export interface BrokerConnectionIndicatorProps {
  /** Broker info to display */
  brokers: BrokerConnectionInfo[];
  /** Called when user clicks a broker row */
  onBrokerClick?: (brokerId: string) => void;
  /** Called on manual refresh */
  onRefresh?: () => void;
  /** Compact mode (hide extra details) */
  compact?: boolean;
  /** Max height before scroll */
  maxHeight?: number;
}

// ── Status Colors ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; dot: string; pulse: boolean }> = {
  GREEN: { bg: '#064e3b', dot: '#10b981', pulse: false },
  YELLOW: { bg: '#78350f', dot: '#f59e0b', pulse: true },
  RED: { bg: '#450a0a', dot: '#ef4444', pulse: false },
};

// ── Component ────────────────────────────────────────────────────────

export function BrokerConnectionIndicator({
  brokers,
  onBrokerClick,
  onRefresh,
  compact = false,
  maxHeight = 400,
}: BrokerConnectionIndicatorProps) {
  const [pulse, setPulse] = useState(0);

  // Animate YELLOW (connecting) dots
  useEffect(() => {
    const hasConnecting = brokers.some(b => b.status === 'YELLOW');
    if (!hasConnecting) return;
    const timer = setInterval(() => setPulse(p => p + 1), 800);
    return () => clearInterval(timer);
  }, [brokers]);

  const connectedCount = brokers.filter(b => b.connected).length;
  const totalCount = brokers.length;

  return (
    <div style={{
      background: '#0f172a',
      borderRadius: 8,
      border: '1px solid #1e293b',
      padding: compact ? 8 : 12,
      maxHeight: compact ? undefined : maxHeight,
      overflowY: 'auto',
      fontFamily: 'monospace',
      fontSize: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        padding: '0 4px',
      }}>
        <div style={{ color: '#94a3b8', fontWeight: 600 }}>
          🏦 券商连接 ({connectedCount}/{totalCount})
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#10b981', fontSize: 10 }}>🟢 {connectedCount}</span>
          <span style={{ color: '#f59e0b', fontSize: 10 }}>🟡 {totalCount - connectedCount - brokers.filter(b => b.status === 'RED').length}</span>
          <span style={{ color: '#ef4444', fontSize: 10 }}>🔴 {brokers.filter(b => b.status === 'RED').length}</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                color: '#94a3b8',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 10,
                padding: '2px 6px',
              }}
            >
              🔄 刷新
            </button>
          )}
        </div>
      </div>

      {/* Broker rows */}
      {brokers.length === 0 && (
        <div style={{ color: '#475569', textAlign: 'center', padding: 16 }}>
          暂无已连接券商
        </div>
      )}

      {brokers.map(broker => {
        const colors = STATUS_COLORS[broker.status] || STATUS_COLORS.RED;
        const isPulsing = colors.pulse && pulse % 2 === 0;

        return (
          <div
            key={broker.brokerId}
            onClick={() => onBrokerClick?.(broker.brokerId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: compact ? '4px 4px' : '6px 8px',
              marginBottom: 2,
              borderRadius: 6,
              background: colors.bg,
              cursor: onBrokerClick ? 'pointer' : 'default',
              gap: 8,
              opacity: isPulsing ? 0.7 : 1,
              transition: 'opacity 0.3s',
            }}
          >
            {/* LED dot */}
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: colors.dot,
              boxShadow: `0 0 ${isPulsing ? 12 : 6}px ${colors.dot}`,
              flexShrink: 0,
            }} />

            {/* Broker name */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#e2e8f0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {broker.brokerName}
              </div>
              {!compact && (
                <div style={{ color: '#64748b', fontSize: 10 }}>
                  {broker.brokerType || broker.brokerId}
                </div>
              )}
            </div>

            {/* Status */}
            <div style={{
              fontSize: 10,
              color: broker.status === 'GREEN' ? '#10b981' : broker.status === 'YELLOW' ? '#f59e0b' : '#ef4444',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
              {broker.statusText}
            </div>

            {/* Latency */}
            {!compact && broker.latencyMs > 0 && (
              <div style={{ color: '#64748b', fontSize: 10, whiteSpace: 'nowrap', width: 48, textAlign: 'right' }}>
                {broker.latencyMs}ms
              </div>
            )}

            {/* Subscriptions */}
            {!compact && broker.subscriptions !== undefined && broker.subscriptions > 0 && (
              <div style={{ color: '#475569', fontSize: 10, whiteSpace: 'nowrap' }}>
                📡{broker.subscriptions}
              </div>
            )}

            {/* Error count */}
            {broker.errors > 0 && (
              <div style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
              }}>
                {broker.errors > 9 ? '!' : broker.errors}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hook: fetch broker connection health from IPC.
 * Polls every 5 seconds for live status updates.
 */
export function useBrokerHealth(pollIntervalMs: number = 5000): {
  brokers: BrokerConnectionInfo[];
  refresh: () => Promise<void>;
  loading: boolean;
} {
  const [brokers, setBrokers] = useState<BrokerConnectionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const api = (window as any).api;
      if (!api?.broker) return;
      const resp = await api.broker.invoke('broker:health-check-all');
      if (resp?.success) {
        setBrokers(resp.healthList || []);
      }
    } catch (err) {
      console.warn('[useBrokerHealth] IPC unavailable:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(timer);
  }, [refresh, pollIntervalMs]);

  return { brokers, refresh, loading };
}
