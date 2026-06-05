import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type AlertLevel = 'info' | 'warning' | 'critical';
type AlertSource = 'market' | 'risk' | 'system' | 'strategy' | 'broker' | 'data';
type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';

interface SmartAlert {
  id: string;
  level: AlertLevel;
  source: AlertSource;
  category: string;
  title: string;
  message: string;
  data?: any;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  relatedEntityId?: string;
}

interface AlertStats {
  total: number;
  active: number;
  byLevel: Record<AlertLevel, number>;
  bySource: Record<AlertSource, number>;
  last1h: number;
  last24h: number;
}

interface FilterState {
  level: AlertLevel | 'all';
  source: AlertSource | 'all';
  status: AlertStatus | 'all';
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LEVEL_OPTIONS: { value: AlertLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

const SOURCE_OPTIONS: { value: AlertSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'market', label: 'Market' },
  { value: 'risk', label: 'Risk' },
  { value: 'system', label: 'System' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'broker', label: 'Broker' },
  { value: 'data', label: 'Data' },
];

const STATUS_OPTIONS: { value: AlertStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
];

// ─── Helper Functions ────────────────────────────────────────────────────────

function getLevelColor(level: AlertLevel): string {
  switch (level) {
    case 'critical':
      return 'border-red-500 bg-red-500/10';
    case 'warning':
      return 'border-yellow-500 bg-yellow-500/10';
    case 'info':
      return 'border-blue-500 bg-blue-500/10';
    default:
      return 'border-gray-500 bg-gray-500/10';
  }
}

function getLevelIcon(level: AlertLevel): string {
  switch (level) {
    case 'critical':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'info':
      return '🔵';
    default:
      return '⚪';
  }
}

function getLevelBadgeClasses(level: AlertLevel): string {
  switch (level) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30';
    case 'warning':
      return 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30';
    case 'info':
      return 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 ring-1 ring-gray-500/30';
  }
}

function getSourceBadgeClasses(source: AlertSource): string {
  const base = 'px-2 py-0.5 rounded text-xs font-medium';
  switch (source) {
    case 'market':
      return `${base} bg-emerald-500/20 text-emerald-400`;
    case 'risk':
      return `${base} bg-orange-500/20 text-orange-400`;
    case 'system':
      return `${base} bg-purple-500/20 text-purple-400`;
    case 'strategy':
      return `${base} bg-cyan-500/20 text-cyan-400`;
    case 'broker':
      return `${base} bg-pink-500/20 text-pink-400`;
    case 'data':
      return `${base} bg-indigo-500/20 text-indigo-400`;
    default:
      return `${base} bg-gray-500/20 text-gray-400`;
  }
}

function getStatusBadgeClasses(status: AlertStatus): string {
  const base = 'px-2 py-0.5 rounded text-xs font-medium';
  switch (status) {
    case 'active':
      return `${base} bg-red-500/20 text-red-400`;
    case 'acknowledged':
      return `${base} bg-yellow-500/20 text-yellow-400`;
    case 'resolved':
      return `${base} bg-green-500/20 text-green-400`;
    case 'suppressed':
      return `${base} bg-gray-500/20 text-gray-500`;
    default:
      return `${base} bg-gray-500/20 text-gray-400`;
  }
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

interface StatsBarProps {
  stats: AlertStats | null;
  loading: boolean;
}

const StatsBar: React.FC<StatsBarProps> = ({ stats, loading }) => {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50 animate-pulse"
          >
            <div className="h-4 bg-gray-700 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-700 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const statItems = [
    {
      label: 'Total Alerts',
      value: stats.total,
      color: 'text-white',
      bgColor: 'bg-gray-800/60',
      borderColor: 'border-gray-700/50',
      icon: '📊',
    },
    {
      label: 'Active',
      value: stats.active,
      color: stats.active > 0 ? 'text-orange-400' : 'text-green-400',
      bgColor: 'bg-gray-800/60',
      borderColor: stats.active > 0 ? 'border-orange-500/30' : 'border-green-500/30',
      icon: '⚡',
    },
    {
      label: 'Critical',
      value: stats.byLevel?.critical ?? 0,
      color: (stats.byLevel?.critical ?? 0) > 0 ? 'text-red-400' : 'text-gray-400',
      bgColor: 'bg-gray-800/60',
      borderColor: (stats.byLevel?.critical ?? 0) > 0 ? 'border-red-500/30' : 'border-gray-700/50',
      icon: '🚨',
    },
    {
      label: 'Last 1 Hour',
      value: stats.last1h,
      color: stats.last1h > 0 ? 'text-cyan-400' : 'text-gray-400',
      bgColor: 'bg-gray-800/60',
      borderColor: stats.last1h > 0 ? 'border-cyan-500/30' : 'border-gray-700/50',
      icon: '🕐',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {statItems.map((item) => (
        <div
          key={item.label}
          className={`${item.bgColor} rounded-xl p-4 border ${item.borderColor} transition-all duration-200 hover:scale-[1.02]`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400 text-sm font-medium">{item.label}</span>
            <span className="text-lg">{item.icon}</span>
          </div>
          <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
};

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  alertCount: number;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange, alertCount }) => {
  const selectBaseClasses =
    'bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 appearance-none cursor-pointer min-w-[140px]';

  return (
    <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-xs font-medium uppercase tracking-wide">Level</label>
          <select
            value={filters.level}
            onChange={(e) =>
              onFilterChange({ ...filters, level: e.target.value as AlertLevel | 'all' })
            }
            className={selectBaseClasses}
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-xs font-medium uppercase tracking-wide">Source</label>
          <select
            value={filters.source}
            onChange={(e) =>
              onFilterChange({ ...filters, source: e.target.value as AlertSource | 'all' })
            }
            className={selectBaseClasses}
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-xs font-medium uppercase tracking-wide">Status</label>
          <select
            value={filters.status}
            onChange={(e) =>
              onFilterChange({ ...filters, status: e.target.value as AlertStatus | 'all' })
            }
            className={selectBaseClasses}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <span className="text-gray-500 text-sm ml-2">
          {alertCount} result{alertCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
};

interface BulkActionsProps {
  onAcknowledgeAll: () => void;
  onAcknowledgeAllCritical: () => void;
  hasActive: boolean;
  hasCritical: boolean;
  processing: boolean;
}

const BulkActions: React.FC<BulkActionsProps> = ({
  onAcknowledgeAll,
  onAcknowledgeAllCritical,
  hasActive,
  hasCritical,
  processing,
}) => {
  return (
    <div className="flex items-center gap-3 mb-4">
      <button
        onClick={onAcknowledgeAll}
        disabled={!hasActive || processing}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          hasActive && !processing
            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {processing ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          '✓ Acknowledge All'
        )}
      </button>

      <button
        onClick={onAcknowledgeAllCritical}
        disabled={!hasCritical || processing}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          hasCritical && !processing
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        🚨 Acknowledge All Critical
      </button>
    </div>
  );
};

interface AlertCardProps {
  alert: SmartAlert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onSuppress: (id: string) => void;
  isProcessing: boolean;
}

const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  onAcknowledge,
  onResolve,
  onSuppress,
  isProcessing,
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const borderClasses = getLevelColor(alert.level);
  const levelIcon = getLevelIcon(alert.level);
  const levelBadgeClasses = getLevelBadgeClasses(alert.level);
  const sourceBadgeClasses = getSourceBadgeClasses(alert.source);
  const statusBadgeClasses = getStatusBadgeClasses(alert.status);

  const isActive = alert.status === 'active';
  const isAcknowledged = alert.status === 'acknowledged';
  const isResolved = alert.status === 'resolved' || alert.status === 'suppressed';

  return (
    <div
      className={`border-l-4 rounded-lg bg-gray-800/80 backdrop-blur-sm transition-all duration-200 hover:bg-gray-800 ${borderClasses} ${
        expanded ? 'ring-1 ring-gray-600' : ''
      }`}
    >
      {/* Main Card Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Icon + Content */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-xl flex-shrink-0 mt-0.5">{levelIcon}</span>
            <div className="flex-1 min-w-0">
              {/* Title Row */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-white font-semibold text-sm truncate">{alert.title}</h3>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${levelBadgeClasses}`}>
                  {alert.level}
                </span>
              </div>

              {/* Message */}
              <p className="text-gray-400 text-sm mb-2 leading-relaxed">
                {expanded ? alert.message : truncateText(alert.message, 120)}
              </p>

              {/* Meta Row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={sourceBadgeClasses}>{alert.source}</span>
                <span className={statusBadgeClasses}>{alert.status}</span>
                {alert.category && (
                  <span className="text-gray-500 text-xs">{alert.category}</span>
                )}
                <span className="text-gray-500 text-xs ml-auto">
                  {formatTimestamp(alert.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isActive && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Acknowledge"
              >
                Ack
              </button>
            )}
            {(isActive || isAcknowledged) && (
              <button
                onClick={() => onResolve(alert.id)}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Resolve"
              >
                Resolve
              </button>
            )}
            {isActive && (
              <button
                onClick={() => onSuppress(alert.id)}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-600/20 text-gray-400 hover:bg-gray-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Suppress"
              >
                Suppress
              </button>
            )}
            <button
              onClick={handleToggleExpand}
              className="px-2 py-1.5 rounded-md text-xs font-medium bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-gray-700/50 p-4 bg-gray-900/50">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wide">Alert ID</span>
              <p className="text-gray-300 text-xs font-mono mt-0.5">{alert.id}</p>
            </div>
            {alert.relatedEntityId && (
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Related Entity</span>
                <p className="text-gray-300 text-xs font-mono mt-0.5">{alert.relatedEntityId}</p>
              </div>
            )}
            {alert.acknowledgedAt && (
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Acknowledged At</span>
                <p className="text-gray-300 text-xs mt-0.5">{formatTimestamp(alert.acknowledgedAt)}</p>
              </div>
            )}
            {alert.resolvedAt && (
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Resolved At</span>
                <p className="text-gray-300 text-xs mt-0.5">{formatTimestamp(alert.resolvedAt)}</p>
              </div>
            )}
          </div>

          {alert.data && (
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wide block mb-1">Data Payload</span>
              <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto max-h-64 overflow-y-auto border border-gray-800">
                {JSON.stringify(alert.data, null, 2)}
              </pre>
            </div>
          )}

          {!alert.data && (
            <div className="text-gray-500 text-xs italic">No additional data available for this alert.</div>
          )}
        </div>
      )}
    </div>
  );
};

const EmptyState: React.FC<{ hasFilters: boolean }> = ({ hasFilters }) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="text-6xl mb-4">{hasFilters ? '🔍' : '✅'}</div>
      <h3 className="text-xl font-semibold text-gray-300 mb-2">
        {hasFilters ? 'No Matching Alerts' : 'All Clear'}
      </h3>
      <p className="text-gray-500 text-sm text-center max-w-md">
        {hasFilters
          ? 'No alerts match your current filter criteria. Try adjusting the filters above to see more results.'
          : 'No alerts to display. The system is running smoothly with no active issues.'}
      </p>
    </div>
  );
};

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="border-l-4 border-gray-700 rounded-lg bg-gray-800/60 p-4 animate-pulse"
        >
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-gray-700 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-gray-700 rounded w-48 mb-2" />
              <div className="h-3 bg-gray-700 rounded w-full mb-1" />
              <div className="h-3 bg-gray-700 rounded w-3/4 mb-3" />
              <div className="flex gap-2">
                <div className="h-5 bg-gray-700 rounded w-16" />
                <div className="h-5 bg-gray-700 rounded w-14" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Notification Toast ──────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const bgColor =
          toast.type === 'success'
            ? 'bg-green-600'
            : toast.type === 'error'
            ? 'bg-red-600'
            : 'bg-blue-600';

        return (
          <div
            key={toast.id}
            className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 min-w-[280px] animate-slide-in`}
          >
            <span className="text-sm flex-1">{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-white/70 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const AlertCenterPage: React.FC = () => {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    level: 'all',
    source: 'all',
    status: 'all',
  });
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  // ─── Toast Management ──────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `toast-${++toastIdRef.current}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchAlerts = useCallback(async () => {
    try {
      const query: Record<string, any> = { limit: 200 };
      if (filters.level !== 'all') query.level = filters.level;
      if (filters.source !== 'all') query.source = filters.source;
      if (filters.status !== 'all') query.status = filters.status;

      const result = await (window as any).api.monitor.query(query);
      if (result.success && result.data) {
        setAlerts(result.data);
      } else {
        setAlerts([]);
      }
    } catch (error) {
      console.error('[AlertCenter] Failed to fetch alerts:', error);
      addToast('Failed to fetch alerts', 'error');
      setAlerts([]);
    }
  }, [filters.level, filters.source, filters.status, addToast]);

  const fetchStats = useCallback(async () => {
    try {
      const result = await (window as any).api.monitor.stats();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('[AlertCenter] Failed to fetch stats:', error);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([fetchAlerts(), fetchStats()]);
    setLoading(false);
  }, [fetchAlerts, fetchStats]);

  // ─── Initial Load ──────────────────────────────────────────────────────────

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Real-time Push Listener ───────────────────────────────────────────────

  useEffect(() => {
    const handler = (_event: any, newAlert: SmartAlert) => {
      if (!newAlert || !newAlert.id) return;

      setAlerts((prev) => {
        const existingIndex = prev.findIndex((a) => a.id === newAlert.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newAlert;
          return updated;
        }
        return [newAlert, ...prev];
      });

      // Refresh stats on push
      fetchStats();

      // Show toast for critical alerts
      if (newAlert.level === 'critical' && newAlert.status === 'active') {
        addToast(`🚨 Critical: ${newAlert.title}`, 'error');
      }
    };

    try {
      (window as any).api.on('monitor:alert-push', handler);
    } catch (error) {
      console.error('[AlertCenter] Failed to register push listener:', error);
    }

    return () => {
      // Cleanup: Electron IPC listeners are typically removed via removeListener
      try {
        const ipcRenderer = (window as any).api;
        if (ipcRenderer?.removeListener) {
          ipcRenderer.removeListener('monitor:alert-push', handler);
        }
      } catch {
        // Silently ignore cleanup errors
      }
    };
  }, [fetchStats, addToast]);

  // ─── Periodic Refresh ──────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchStats]);

  // ─── Filtered Alerts ───────────────────────────────────────────────────────

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (filters.level !== 'all' && alert.level !== filters.level) return false;
      if (filters.source !== 'all' && alert.source !== filters.source) return false;
      if (filters.status !== 'all' && alert.status !== filters.status) return false;
      return true;
    });
  }, [alerts, filters]);

  // ─── Computed Flags ────────────────────────────────────────────────────────

  const hasActive = useMemo(() => alerts.some((a) => a.status === 'active'), [alerts]);
  const hasCritical = useMemo(
    () => alerts.some((a) => a.level === 'critical' && a.status === 'active'),
    [alerts]
  );
  const hasFilters = filters.level !== 'all' || filters.source !== 'all' || filters.status !== 'all';

  // ─── Alert Actions ─────────────────────────────────────────────────────────

  const handleAcknowledge = useCallback(
    async (alertId: string) => {
      setProcessingIds((prev) => new Set(prev).add(alertId));
      try {
        const result = await (window as any).api.monitor.acknowledge(alertId);
        if (result.success) {
          setAlerts((prev) =>
            prev.map((a) =>
              a.id === alertId ? { ...a, status: 'acknowledged' as AlertStatus, acknowledgedAt: new Date().toISOString() } : a
            )
          );
          addToast('Alert acknowledged', 'success');
          fetchStats();
        } else {
          addToast('Failed to acknowledge alert', 'error');
        }
      } catch (error) {
        console.error('[AlertCenter] Acknowledge failed:', error);
        addToast('Failed to acknowledge alert', 'error');
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(alertId);
          return next;
        });
      }
    },
    [addToast, fetchStats]
  );

  const handleResolve = useCallback(
    async (alertId: string) => {
      setProcessingIds((prev) => new Set(prev).add(alertId));
      try {
        const result = await (window as any).api.monitor.resolve(alertId);
        if (result.success) {
          setAlerts((prev) =>
            prev.map((a) =>
              a.id === alertId ? { ...a, status: 'resolved' as AlertStatus, resolvedAt: new Date().toISOString() } : a
            )
          );
          addToast('Alert resolved', 'success');
          fetchStats();
        } else {
          addToast('Failed to resolve alert', 'error');
        }
      } catch (error) {
        console.error('[AlertCenter] Resolve failed:', error);
        addToast('Failed to resolve alert', 'error');
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(alertId);
          return next;
        });
      }
    },
    [addToast, fetchStats]
  );

  const handleSuppress = useCallback(
    async (alertId: string) => {
      setProcessingIds((prev) => new Set(prev).add(alertId));
      try {
        const result = await (window as any).api.monitor.suppress(alertId);
        if (result.success) {
          setAlerts((prev) =>
            prev.map((a) => (a.id === alertId ? { ...a, status: 'suppressed' as AlertStatus } : a))
          );
          addToast('Alert suppressed', 'info');
          fetchStats();
        } else {
          addToast('Failed to suppress alert', 'error');
        }
      } catch (error) {
        console.error('[AlertCenter] Suppress failed:', error);
        addToast('Failed to suppress alert', 'error');
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(alertId);
          return next;
        });
      }
    },
    [addToast, fetchStats]
  );

  // ─── Bulk Actions ──────────────────────────────────────────────────────────

  const handleAcknowledgeAll = useCallback(async () => {
    setBulkProcessing(true);
    try {
      const result = await (window as any).api.monitor.acknowledgeAll();
      if (result.success) {
        const count = result.data?.acknowledged ?? 0;
        addToast(`${count} alert(s) acknowledged`, 'success');
        await loadAll();
      } else {
        addToast('Failed to acknowledge all alerts', 'error');
      }
    } catch (error) {
      console.error('[AlertCenter] Acknowledge all failed:', error);
      addToast('Failed to acknowledge all alerts', 'error');
    } finally {
      setBulkProcessing(false);
    }
  }, [addToast, loadAll]);

  const handleAcknowledgeAllCritical = useCallback(async () => {
    setBulkProcessing(true);
    try {
      const result = await (window as any).api.monitor.acknowledgeAll('critical');
      if (result.success) {
        const count = result.data?.acknowledged ?? 0;
        addToast(`${count} critical alert(s) acknowledged`, 'success');
        await loadAll();
      } else {
        addToast('Failed to acknowledge critical alerts', 'error');
      }
    } catch (error) {
      console.error('[AlertCenter] Acknowledge all critical failed:', error);
      addToast('Failed to acknowledge critical alerts', 'error');
    } finally {
      setBulkProcessing(false);
    }
  }, [addToast, loadAll]);

  // ─── Refresh Handler ───────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await loadAll();
    addToast('Alerts refreshed', 'info');
  }, [loadAll, addToast]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Alert Center</h1>
          <p className="text-gray-400 text-sm mt-1">
            Unified monitoring &amp; alert management dashboard
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-all text-sm font-medium disabled:opacity-50"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <StatsBar stats={stats} loading={loading} />

      {/* Filter Bar */}
      <FilterBar filters={filters} onFilterChange={setFilters} alertCount={filteredAlerts.length} />

      {/* Bulk Actions */}
      <BulkActions
        onAcknowledgeAll={handleAcknowledgeAll}
        onAcknowledgeAllCritical={handleAcknowledgeAllCritical}
        hasActive={hasActive}
        hasCritical={hasCritical}
        processing={bulkProcessing}
      />

      {/* Alert List */}
      <div ref={listRef} className="space-y-3">
        {loading ? (
          <LoadingSkeleton />
        ) : filteredAlerts.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              onSuppress={handleSuppress}
              isProcessing={processingIds.has(alert.id)}
            />
          ))
        )}
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Global Animation Styles */}
      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AlertCenterPage;
