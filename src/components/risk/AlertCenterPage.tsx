import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  source: string;
  acknowledged: boolean;
}

interface AlertStats {
  total: number;
  active: number;
  critical: number;
  warning: number;
  info: number;
  acknowledged: number;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-001',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    severity: 'critical',
    title: 'Position Size Exceeded',
    message: 'BTC/USDT position exceeds 20% of portfolio. Current allocation: 23.4%.',
    source: 'position-monitor',
    acknowledged: false,
  },
  {
    id: 'alert-002',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    severity: 'critical',
    title: 'Stop Loss Triggered',
    message: 'ETH/USDT hit stop loss at $2,180. Position closed with -4.2% loss.',
    source: 'order-engine',
    acknowledged: false,
  },
  {
    id: 'alert-003',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    severity: 'warning',
    title: 'Drawdown Warning',
    message: 'Portfolio drawdown reached 8.3%, approaching 15% max threshold.',
    source: 'risk-engine',
    acknowledged: false,
  },
  {
    id: 'alert-004',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    severity: 'warning',
    title: 'High VIX Detected',
    message: 'VIX index at 28.7, nearing threshold of 30. Consider reducing exposure.',
    source: 'vix-monitor',
    acknowledged: false,
  },
  {
    id: 'alert-005',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    severity: 'info',
    title: 'Rebalance Completed',
    message: 'Automated rebalance executed. 3 positions adjusted to target weights.',
    source: 'rebalance-engine',
    acknowledged: true,
  },
  {
    id: 'alert-006',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    severity: 'info',
    title: 'Kelly Fraction Updated',
    message: 'Kelly fraction recalculated: 0.18 (was 0.22). Win rate adjusted.',
    source: 'kelly-engine',
    acknowledged: true,
  },
  {
    id: 'alert-007',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    severity: 'warning',
    title: 'Latency Spike',
    message: 'Order execution latency exceeded 500ms average over last 5 minutes.',
    source: 'network-monitor',
    acknowledged: false,
  },
];

const MOCK_STATS: AlertStats = {
  total: 7,
  active: 5,
  critical: 2,
  warning: 3,
  info: 2,
  acknowledged: 2,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getSeverityStyles(severity: string) {
  switch (severity) {
    case 'critical':
      return {
        border: 'border-l-red-500',
        bg: 'bg-red-900/20 hover:bg-red-900/30',
        badge: 'bg-red-500/20 text-red-400 border border-red-700',
        icon: '🔴',
        glow: 'shadow-red-500/10',
      };
    case 'warning':
      return {
        border: 'border-l-yellow-500',
        bg: 'bg-yellow-900/20 hover:bg-yellow-900/30',
        badge: 'bg-yellow-500/20 text-yellow-400 border border-yellow-700',
        icon: '🟡',
        glow: 'shadow-yellow-500/10',
      };
    default:
      return {
        border: 'border-l-blue-500',
        bg: 'bg-blue-900/20 hover:bg-blue-900/30',
        badge: 'bg-blue-500/20 text-blue-400 border border-blue-700',
        icon: '🔵',
        glow: 'shadow-blue-500/10',
      };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AlertCenterPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'critical'>('all');
  const [acknowledging, setAcknowledging] = useState<Set<string>>(new Set());

  const api = (window as any).api;

  const fetchData = useCallback(async () => {
    try {
      let activeAlerts: Alert[];
      let alertStats: AlertStats;

      if (api?.monitor?.getActive) {
        activeAlerts = await api.monitor.getActive();
      } else {
        activeAlerts = MOCK_ALERTS;
      }

      if (api?.monitor?.stats) {
        alertStats = await api.monitor.stats();
      } else {
        alertStats = MOCK_STATS;
      }

      // Also fetch critical for enrichment
      if (api?.monitor?.getCritical) {
        try {
          const critical = await api.monitor.getCritical();
          // Merge critical alerts that might not be in active list
          const criticalIds = new Set(activeAlerts.map((a) => a.id));
          for (const ca of critical) {
            if (!criticalIds.has(ca.id)) {
              activeAlerts = [...activeAlerts, ca];
            }
          }
        } catch {
          // Non-fatal, continue with what we have
        }
      }

      // Sort: unacknowledged first, then by timestamp descending
      activeAlerts.sort((a, b) => {
        if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setAlerts(activeAlerts);
      setStats(alertStats);
      setLastUpdate(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch alerts');
      setAlerts(MOCK_ALERTS);
      setStats(MOCK_STATS);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Listen for push events
  useEffect(() => {
    if (!api?.on) return;

    const unsubscribe = api.on('monitor:alert-push', (newAlert: Alert) => {
      setAlerts((prev) => {
        const exists = prev.some((a) => a.id === newAlert.id);
        if (exists) {
          return prev.map((a) => (a.id === newAlert.id ? newAlert : a));
        }
        return [newAlert, ...prev];
      });
      // Refresh stats
      if (api?.monitor?.stats) {
        api.monitor.stats().then(setStats).catch(() => {});
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [api]);

  const acknowledgeAlert = async (id: string) => {
    setAcknowledging((prev) => new Set(prev).add(id));
    try {
      if (api?.monitor?.acknowledge) {
        await api.monitor.acknowledge(id);
      }
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
      );
    } catch (err: any) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setAcknowledging((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const acknowledgeAll = async () => {
    try {
      if (api?.monitor?.acknowledgeAll) {
        await api.monitor.acknowledgeAll();
      }
      setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    } catch (err: any) {
      console.error('Failed to acknowledge all:', err);
    }
  };

  // ─── Filtered Alerts ─────────────────────────────────────────────────────

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'active') return !a.acknowledged;
    if (filter === 'critical') return a.severity === 'critical';
    return true;
  });

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading alerts…</p>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Alert Center</h1>
          <p className="text-gray-400 text-sm mt-1">
            {lastUpdate ? `Updated ${formatTime(lastUpdate.toISOString())}` : 'Not yet updated'}
            {error && <span className="text-yellow-400 ml-2">⚠ {error}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={acknowledgeAll}
            disabled={unacknowledgedCount === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              unacknowledgedCount > 0
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Acknowledge All ({unacknowledgedCount})
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-gray-400 text-xs mt-1">Total</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats.active}</p>
            <p className="text-gray-400 text-xs mt-1">Active</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.critical}</p>
            <p className="text-gray-400 text-xs mt-1">Critical</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats.warning}</p>
            <p className="text-gray-400 text-xs mt-1">Warning</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.info}</p>
            <p className="text-gray-400 text-xs mt-1">Info</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.acknowledged}</p>
            <p className="text-gray-400 text-xs mt-1">Acknowledged</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'active', 'critical'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Critical'}
            {f === 'active' && unacknowledgedCount > 0 && (
              <span className="ml-2 bg-yellow-500 text-gray-900 text-xs px-1.5 py-0.5 rounded-full">
                {unacknowledgedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
            <p className="text-gray-400 text-lg">No alerts matching filter</p>
            <p className="text-gray-500 text-sm mt-2">All systems nominal</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const styles = getSeverityStyles(alert.severity);
            const isAcking = acknowledging.has(alert.id);

            return (
              <div
                key={alert.id}
                className={`rounded-lg border-l-4 ${styles.border} ${styles.bg} ${
                  alert.acknowledged ? 'opacity-50' : ''
                } shadow-lg ${styles.glow} transition-all duration-200`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg">{styles.icon}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${styles.badge}`}
                        >
                          {alert.severity.toUpperCase()}
                        </span>
                        <h3 className="text-white font-semibold text-sm truncate">
                          {alert.title}
                        </h3>
                      </div>
                      <p className="text-gray-300 text-sm ml-8">{alert.message}</p>
                      <div className="flex items-center gap-4 mt-2 ml-8">
                        <span className="text-gray-500 text-xs">
                          {formatFullTime(alert.timestamp)}
                        </span>
                        <span className="text-gray-600 text-xs">•</span>
                        <span className="text-gray-500 text-xs">{alert.source}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          disabled={isAcking}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            isAcking
                              ? 'bg-gray-700 text-gray-500 cursor-wait'
                              : 'bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-700'
                          }`}
                        >
                          {isAcking ? '…' : 'Acknowledge'}
                        </button>
                      )}
                      {alert.acknowledged && (
                        <span className="px-3 py-1.5 rounded text-xs font-medium bg-green-900/20 text-green-500 border border-green-800">
                          ✓ Resolved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-600 text-xs">
        Auto-refresh every 30s • Push events enabled •{' '}
        {alerts.length} alert{alerts.length !== 1 ? 's' : ''} loaded
      </div>
    </div>
  );
}
