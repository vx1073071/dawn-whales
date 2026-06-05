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

// ─── IPC Availability Check ──────────────────────────────────────────────────

function isIpcAvailable(): boolean {
  try {
    return !!(window as any).api?.monitor?.getActive;
  } catch {
    return false;
  }
}

// ─── Mock Data Generator ─────────────────────────────────────────────────────

function generateMockAlerts(): SmartAlert[] {
  const now = Date.now();
  const mockAlerts: SmartAlert[] = [
    {
      id: 'mock-001',
      level: 'critical',
      source: 'risk',
      category: 'Risk Limit',
      title: 'Position Size Exceeds Risk Limit',
      message: 'Position in AAPL has exceeded the configured maximum position size of $500,000. Current position value: $623,450. Immediate review required.',
      status: 'active',
      createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
      data: { symbol: 'AAPL', positionValue: 623450, limit: 500000, utilization: 1.247 },
    },
    {
      id: 'mock-002',
      level: 'critical',
      source: 'market',
      category: 'Market Alert',
      title: 'Flash Crash Detected — SPY -5.2%',
      message: 'SPY has dropped 5.2% in the last 3 minutes. This may indicate a flash crash event. All correlated positions are at elevated risk.',
      status: 'active',
      createdAt: new Date(now - 2 * 60 * 1000).toISOString(),
      data: { symbol: 'SPY', changePercent: -5.2, timeframe: '3m', volume: 12500000 },
    },
    {
      id: 'mock-003',
      level: 'warning',
      source: 'system',
      category: 'System Health',
      title: 'High Memory Usage Detected',
      message: 'Application memory usage has reached 87% of available RAM. Consider closing unused browser windows or restarting the application.',
      status: 'active',
      createdAt: new Date(now - 15 * 60 * 1000).toISOString(),
      data: { memoryPercent: 87, totalMB: 16384, usedMB: 14254 },
    },
    {
      id: 'mock-004',
      level: 'warning',
      source: 'strategy',
      category: 'Strategy Alert',
      title: 'Strategy Drawdown Exceeds Threshold',
      message: 'Mean Reversion Alpha strategy has reached a drawdown of 8.3%, exceeding the configured 7% warning threshold.',
      status: 'active',
      createdAt: new Date(now - 32 * 60 * 1000).toISOString(),
      data: { strategyId: 'strat-042', drawdown: 0.083, threshold: 0.07, peakEquity: 1250000, currentEquity: 1146250 },
    },
    {
      id: 'mock-005',
      level: 'info',
      source: 'broker',
      category: 'Broker Status',
      title: 'Broker Connection Re-established',
      message: 'Connection to Interactive Brokers has been restored after a 45-second interruption. All pending orders have been verified.',
      status: 'active',
      createdAt: new Date(now - 48 * 60 * 1000).toISOString(),
      data: { broker: 'IB', downtimeSeconds: 45, pendingOrders: 3 },
    },
    {
      id: 'mock-006',
      level: 'warning',
      source: 'data',
      category: 'Data Quality',
      title: 'Stale Quote Data — TSLA',
      message: 'TSLA quote data has not been updated for 120 seconds. This may indicate a data feed issue. Last known price: $248.32.',
      status: 'active',
      createdAt: new Date(now - 8 * 60 * 1000).toISOString(),
      data: { symbol: 'TSLA', staleSeconds: 120, lastPrice: 248.32 },
    },
    {
      id: 'mock-007',
      level: 'critical',
      source: 'risk',
      category: 'Portfolio Risk',
      title: 'Portfolio Beta Exceeds Limit',
      message: 'Overall portfolio beta has reached 1.85, exceeding the configured maximum of 1.5. Market exposure is elevated.',
      status: 'active',
      createdAt: new Date(now - 22 * 60 * 1000).toISOString(),
      data: { beta: 1.85, limit: 1.5, topContributors: ['TSLA', 'NVDA', 'AMD'] },
    },
    {
      id: 'mock-008',
      level: 'info',
      source: 'system',
      category: 'System Update',
      title: 'Database Backup Completed',
      message: 'Scheduled database backup completed successfully. Size: 2.4 GB. Duration: 12 seconds.',
      status: 'acknowledged',
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      acknowledgedAt: new Date(now - 1.5 * 60 * 60 * 1000).toISOString(),
      data: { sizeMB: 2457, durationSeconds: 12 },
    },
  ];
  return mockAlerts;
}

function generateMockStats(): AlertStats {
  return {
    total: 8,
    active: 7,
    byLevel: { info: 2, warning: 3, critical: 3 },
    bySource: { market: 1, risk: 2, system: 2, strategy: 1, broker: 1, data: 1 },
    last1h: 5,
    last24h: 8,
  };
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

const STATS_REFRESH_INTERVAL = 30000; // 30 seconds

// ─── Helper Functions ────────────────────────────────────────────────────────

function getLevelColor(level: AlertLevel): string {
  switch (level) {
    case 'critical':
      return 'border-red-500/70 bg-red-500/5';
    case 'warning':
      return 'border-amber-500/70 bg-amber-500/5';
    case 'info':
      return 'border-sky-500/70 bg-sky-500/5';
    default:
      return 'border-gray-500/70 bg-gray-500/5';
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
      return 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30';
    case 'info':
      return 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30';
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
      return `${base} bg-violet-500/20 text-violet-400`;
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
      return `${base} bg-amber-500/20 text-amber-400`;
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

    if (diffSeconds < 10) return 'just now';
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
  return text.slice(0, maxLength) + '…';
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

interface StatsBarProps {
  stats: AlertStats | null;
  loading: boolean;
  ipcConnected: boolean;
}

const StatsBar: React.FC<StatsBarProps> = ({ stats, loading, ipcConnected }) => {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-gray-800/40 backdrop-blur-md rounded-xl p-4 border border-gray-700/40 animate-pulse"
          >
            <div className="h-4 bg-gray-700/60 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-700/60 rounded w-16" />
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
      borderColor: 'border-gray-600/40',
      icon: '📊',
      glow: '',
    },
    {
      label: 'Active',
      value: stats.active,
      color: stats.active > 0 ? 'text-orange-400' : 'text-emerald-400',
      borderColor: stats.active > 0 ? 'border-orange-500/40' : 'border-emerald-500/40',
      icon: '⚡',
      glow: stats.active > 0 ? 'shadow-orange-500/10' : '',
    },
    {
      label: 'Critical',
      value: stats.byLevel?.critical ?? 0,
      color: (stats.byLevel?.critical ?? 0) > 0 ? 'text-red-400' : 'text-gray-500',
      borderColor: (stats.byLevel?.critical ?? 0) > 0 ? 'border-red-500/40' : 'border-gray-700/40',
      icon: '🚨',
      glow: (stats.byLevel?.critical ?? 0) > 0 ? 'shadow-red-500/10' : '',
    },
    {
      label: 'Last 1 Hour',
      value: stats.last1h,
      color: stats.last1h > 0 ? 'text-cyan-400' : 'text-gray-500',
      borderColor: stats.last1h > 0 ? 'border-cyan-500/40' : 'border-gray-700/40',
      icon: '🕐',
      glow: '',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statItems.map((item) => (
        <div
          key={item.label}
          className={`bg-gray-800/40 backdrop-blur-md rounded-xl p-4 border ${item.borderColor} transition-all duration-300 hover:scale-[1.02] hover:bg-gray-800/60 shadow-lg ${item.glow}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{item.label}</span>
            <span className="text-base opacity-70">{item.icon}</span>
          </div>
          <div className={`text-3xl font-bold tabular-nums ${item.color}`}>{item.value}</div>
        </div>
      ))}
      {!ipcConnected && (
        <div className="col-span-full">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 text-amber-400 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>Running in offline mode — displaying mock data. IPC connection unavailable.</span>
          </div>
        </div>
      )}
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
    'bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 appearance-none cursor-pointer min-w-[130px] transition-colors';

  return (
    <div className="flex items-center justify-between mb-4 gap-4 flex-wrap bg-gray-800/20 backdrop-blur-sm rounded-xl p-4 border border-gray-700/30">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-gray-500 text-[11px] font-semibold uppercase tracking-wider">Level</label>
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
          <label className="text-gray-500 text-[11px] font-semibold uppercase tracking-wider">Source</label>
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
          <label className="text-gray-500 text-[11px] font-semibold uppercase tracking-wider">Status</label>
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

        <div className="h-6 w-px bg-gray-700/50 mx-1 hidden sm:block" />

        <span className="text-gray-500 text-sm tabular-nums">
          {alertCount} alert{alertCount !== 1 ? 's' : ''}
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
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 backdrop-blur-sm ${
          hasActive && !processing
            ? 'bg-blue-600/80 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 border border-blue-500/30'
            : 'bg-gray-800/40 text-gray-600 cursor-not-allowed border border-gray-700/30'
        }`}
      >
        {processing ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Processing…
          </span>
        ) : (
          '✓ Acknowledge All'
        )}
      </button>

      <button
        onClick={onAcknowledgeAllCritical}
        disabled={!hasCritical || processing}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 backdrop-blur-sm ${
          hasCritical && !processing
            ? 'bg-red-600/80 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 border border-red-500/30'
            : 'bg-gray-800/40 text-gray-600 cursor-not-allowed border border-gray-700/30'
        }`}
      >
        🚨 Acknowledge Critical
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

  return (
    <div
      className={`border-l-4 rounded-lg bg-gray-800/50 backdrop-blur-md transition-all duration-200 hover:bg-gray-800/70 ${borderClasses} ${
        expanded ? 'ring-1 ring-gray-600/50 shadow-lg' : ''
      }`}
    >
      {/* Main Card Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Icon + Content */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-lg flex-shrink-0 mt-0.5">{levelIcon}</span>
            <div className="flex-1 min-w-0">
              {/* Title Row */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-white font-semibold text-sm truncate">{alert.title}</h3>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${levelBadgeClasses}`}>
                  {alert.level}
                </span>
              </div>

              {/* Message */}
              <p className="text-gray-400 text-sm mb-2 leading-relaxed">
                {expanded ? alert.message : truncateText(alert.message, 120)}
              </p>

              {/* Meta Row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={sourceBadgeClasses}>{alert.source}</span>
                <span className={statusBadgeClasses}>{alert.status}</span>
                {alert.category && (
                  <span className="text-gray-600 text-xs px-1.5 py-0.5 bg-gray-800/60 rounded">
                    {alert.category}
                  </span>
                )}
                <span className="text-gray-500 text-xs ml-auto tabular-nums">
                  {formatTimestamp(alert.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isActive && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title="Acknowledge this alert"
              >
                Ack
              </button>
            )}
            {(isActive || isAcknowledged) && (
              <button
                onClick={() => onResolve(alert.id)}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title="Resolve this alert"
              >
                Resolve
              </button>
            )}
            {isActive && (
              <button
                onClick={() => onSuppress(alert.id)}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-600/15 text-gray-400 hover:bg-gray-600/25 border border-gray-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title="Suppress this alert"
              >
                Suppress
              </button>
            )}
            <button
              onClick={handleToggleExpand}
              className="px-2 py-1.5 rounded-md text-xs font-medium bg-gray-700/30 text-gray-500 hover:bg-gray-700/50 hover:text-gray-300 border border-gray-700/30 transition-all"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-gray-700/40 p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Alert ID</span>
              <p className="text-gray-300 text-xs font-mono mt-0.5 select-all">{alert.id}</p>
            </div>
            {alert.relatedEntityId && (
              <div>
                <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Related Entity</span>
                <p className="text-gray-300 text-xs font-mono mt-0.5 select-all">{alert.relatedEntityId}</p>
              </div>
            )}
            {alert.acknowledgedAt && (
              <div>
                <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Acknowledged</span>
                <p className="text-gray-300 text-xs mt-0.5 tabular-nums">{formatTimestamp(alert.acknowledgedAt)}</p>
              </div>
            )}
            {alert.resolvedAt && (
              <div>
                <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Resolved</span>
                <p className="text-gray-300 text-xs mt-0.5 tabular-nums">{formatTimestamp(alert.resolvedAt)}</p>
              </div>
            )}
          </div>

          {alert.data && (
            <div>
              <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold block mb-1">
                Data Payload
              </span>
              <pre className="bg-gray-950/60 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto max-h-64 overflow-y-auto border border-gray-800/50">
                {JSON.stringify(alert.data, null, 2)}
              </pre>
            </div>
          )}

          {!alert.data && (
            <div className="text-gray-600 text-xs italic">No additional data available for this alert.</div>
          )}
        </div>
      )}
    </div>
  );
};

const EmptyState: React.FC<{ hasFilters: boolean }> = ({ hasFilters }) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-20 h-20 rounded-full bg-gray-800/40 backdrop-blur-md flex items-center justify-center mb-4 border border-gray-700/40">
        <span className="text-4xl">{hasFilters ? '🔍' : '✅'}</span>
      </div>
      <h3 className="text-xl font-semibold text-gray-300 mb-2">
        {hasFilters ? 'No Matching Alerts' : 'All Clear'}
      </h3>
      <p className="text-gray-500 text-sm text-center max-w-md leading-relaxed">
        {hasFilters
          ? 'No alerts match your current filter criteria. Try adjusting the filters above to see more results.'
          : 'No active alerts to display. The system is running smoothly.'}
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
          className="border-l-4 border-gray-700/50 rounded-lg bg-gray-800/40 backdrop-blur-md p-4 animate-pulse"
        >
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-gray-700/60 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-gray-700/60 rounded w-48 mb-2" />
              <div className="h-3 bg-gray-700/60 rounded w-full mb-1" />
              <div className="h-3 bg-gray-700/60 rounded w-3/4 mb-3" />
              <div className="flex gap-2">
                <div className="h-5 bg-gray-700/60 rounded w-16" />
                <div className="h-5 bg-gray-700/60 rounded w-14" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Toast Notifications ─────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const bgMap: Record<Toast['type'], string> = {
          success: 'bg-emerald-600/90 border-emerald-500/40',
          error: 'bg-red-600/90 border-red-500/40',
          info: 'bg-blue-600/90 border-blue-500/40',
        };

        return (
          <div
            key={toast.id}
            className={`${bgMap[toast.type]} backdrop-blur-md text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 min-w-[280px] animate-slide-in border pointer-events-auto`}
          >
            <span className="text-sm flex-1">{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-white/60 hover:text-white text-xs transition-colors"
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
  const [ipcAvailable, setIpcAvailable] = useState(true);
  const toastIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const pushHandlerRef = useRef<((...args: any[]) => void) | null>(null);

  // ─── Toast Management ──────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `toast-${++toastIdRef.current}`;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── IPC Helpers ───────────────────────────────────────────────────────────

  const api = useMemo(() => {
    try {
      return (window as any).api;
    } catch {
      return null;
    }
  }, []);

  const monitor = useMemo(() => api?.monitor ?? null, [api]);

  // ─── Fetch Active Alerts (used on mount and for real-time refresh) ─────────

  const fetchActiveAlerts = useCallback(async (): Promise<SmartAlert[]> => {
    if (!monitor?.getActive) {
      return generateMockAlerts();
    }
    try {
      const result = await monitor.getActive();
      if (result?.success && Array.isArray(result.data)) {
        return result.data;
      }
      return [];
    } catch (err) {
      console.warn('[AlertCenter] getActive() failed, using mock data:', err);
      return generateMockAlerts();
    }
  }, [monitor]);

  // ─── Fetch Filtered Alerts via query() ─────────────────────────────────────

  const fetchFilteredAlerts = useCallback(async (): Promise<SmartAlert[]> => {
    const hasFilters = filters.level !== 'all' || filters.source !== 'all' || filters.status !== 'all';

    // If no filters, use getActive() for efficiency
    if (!hasFilters) {
      return fetchActiveAlerts();
    }

    if (!monitor?.query) {
      // Mock: filter mock data
      const mockAlerts = generateMockAlerts();
      return mockAlerts.filter((a) => {
        if (filters.level !== 'all' && a.level !== filters.level) return false;
        if (filters.source !== 'all' && a.source !== filters.source) return false;
        if (filters.status !== 'all' && a.status !== filters.status) return false;
        return true;
      });
    }

    try {
      const query: Record<string, any> = { limit: 200 };
      if (filters.level !== 'all') query.level = filters.level;
      if (filters.source !== 'all') query.source = filters.source;
      if (filters.status !== 'all') query.status = filters.status;

      const result = await monitor.query(query);
      if (result?.success && Array.isArray(result.data)) {
        return result.data;
      }
      return [];
    } catch (err) {
      console.warn('[AlertCenter] query() failed, using mock data:', err);
      return generateMockAlerts();
    }
  }, [filters.level, filters.source, filters.status, monitor, fetchActiveAlerts]);

  // ─── Fetch Stats ───────────────────────────────────────────────────────────

  const fetchStats = useCallback(async (): Promise<AlertStats | null> => {
    if (!monitor?.stats) {
      return generateMockStats();
    }
    try {
      const result = await monitor.stats();
      if (result?.success && result.data) {
        return result.data;
      }
      return generateMockStats();
    } catch (err) {
      console.warn('[AlertCenter] stats() failed, using mock stats:', err);
      return generateMockStats();
    }
  }, [monitor]);

  // ─── Load All Data ─────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    const [alertData, statsData] = await Promise.all([
      fetchFilteredAlerts(),
      fetchStats(),
    ]);
    setAlerts(alertData);
    setStats(statsData);
    setLoading(false);
  }, [fetchFilteredAlerts, fetchStats]);

  // ─── Initial Mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    const available = isIpcAvailable();
    setIpcAvailable(available);

    if (!available) {
      console.warn('[AlertCenter] IPC unavailable — loading mock data');
      setAlerts(generateMockAlerts());
      setStats(generateMockStats());
      setLoading(false);
      return;
    }

    loadAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Reload when filters change ─────────────────────────────────────────────

  const prevFiltersRef = useRef(filters);
  useEffect(() => {
    if (
      prevFiltersRef.current.level !== filters.level ||
      prevFiltersRef.current.source !== filters.source ||
      prevFiltersRef.current.status !== filters.status
    ) {
      prevFiltersRef.current = filters;
      if (ipcAvailable) {
        loadAll();
      }
    }
  }, [filters, ipcAvailable, loadAll]);

  // ─── Real-time Push Listener ───────────────────────────────────────────────

  useEffect(() => {
    if (!ipcAvailable || !api?.on) return;

    const handler = (...args: any[]) => {
      const newAlert = args[0] as SmartAlert;
      if (!newAlert || !newAlert.id) return;

      // Update alert list: replace if exists, prepend if new
      setAlerts((prev) => {
        const existingIndex = prev.findIndex((a) => a.id === newAlert.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newAlert;
          return updated;
        }
        return [newAlert, ...prev];
      });

      // Refresh stats on push event
      fetchStats().then((s) => {
        if (s) setStats(s);
      });

      // Show toast for critical active alerts
      if (newAlert.level === 'critical' && newAlert.status === 'active') {
        addToast(`🚨 Critical: ${newAlert.title}`, 'error');
      } else if (newAlert.status === 'active') {
        addToast(`New alert: ${newAlert.title}`, 'info');
      }
    };

    pushHandlerRef.current = handler;

    try {
      api.on('monitor:alert-push', handler);
    } catch (err) {
      console.error('[AlertCenter] Failed to register push listener:', err);
    }

    return () => {
      try {
        if (api.off && pushHandlerRef.current) {
          api.off('monitor:alert-push', pushHandlerRef.current);
          pushHandlerRef.current = null;
        }
      } catch {
        // Silently ignore cleanup errors
      }
    };
  }, [ipcAvailable, api, fetchStats, addToast]);

  // ─── Periodic Stats Refresh (30s) ──────────────────────────────────────────

  useEffect(() => {
    if (!ipcAvailable) return;

    const interval = setInterval(() => {
      fetchStats().then((s) => {
        if (s) setStats(s);
      });
    }, STATS_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [ipcAvailable, fetchStats]);

  // ─── Client-side Filter (for already-fetched data as fallback) ─────────────

  const filteredAlerts = useMemo(() => {
    // If we used IPC query(), data is already filtered server-side.
    // But if we loaded via getActive(), apply client-side filter too.
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
  const hasFilters =
    filters.level !== 'all' || filters.source !== 'all' || filters.status !== 'all';

  // ─── Alert Actions (IPC calls) ─────────────────────────────────────────────

  const handleAcknowledge = useCallback(
    async (alertId: string) => {
      setProcessingIds((prev) => new Set(prev).add(alertId));
      try {
        if (monitor?.acknowledge) {
          const result = await monitor.acknowledge(alertId);
          if (result?.success) {
            setAlerts((prev) =>
              prev.map((a) =>
                a.id === alertId
                  ? {
                      ...a,
                      status: 'acknowledged' as AlertStatus,
                      acknowledgedAt: new Date().toISOString(),
                    }
                  : a
              )
            );
            addToast('Alert acknowledged', 'success');
          } else {
            addToast('Failed to acknowledge alert', 'error');
          }
        } else {
          // Mock fallback: update locally
          setAlerts((prev) =>
            prev.map((a) =>
              a.id === alertId
                ? {
                    ...a,
                    status: 'acknowledged' as AlertStatus,
                    acknowledgedAt: new Date().toISOString(),
                  }
                : a
            )
          );
          addToast('Alert acknowledged (offline)', 'success');
        }
        // Refresh stats
        const s = await fetchStats();
        if (s) setStats(s);
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
    [monitor, addToast, fetchStats]
  );

  const handleResolve = useCallback(
    async (alertId: string) => {
      setProcessingIds((prev) => new Set(prev).add(alertId));
      try {
        if (monitor?.resolve) {
          const result = await monitor.resolve(alertId);
          if (result?.success) {
            setAlerts((prev) =>
              prev.map((a) =>
                a.id === alertId
                  ? {
                      ...a,
                      status: 'resolved' as AlertStatus,
                      resolvedAt: new Date().toISOString(),
                    }
                  : a
              )
            );
            addToast('Alert resolved', 'success');
          } else {
            addToast('Failed to resolve alert', 'error');
          }
        } else {
          setAlerts((prev) =>
            prev.map((a) =>
              a.id === alertId
                ? {
                    ...a,
                    status: 'resolved' as AlertStatus,
                    resolvedAt: new Date().toISOString(),
                  }
                : a
            )
          );
          addToast('Alert resolved (offline)', 'success');
        }
        const s = await fetchStats();
        if (s) setStats(s);
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
    [monitor, addToast, fetchStats]
  );

  const handleSuppress = useCallback(
    async (alertId: string) => {
      setProcessingIds((prev) => new Set(prev).add(alertId));
      try {
        if (monitor?.suppress) {
          const result = await monitor.suppress(alertId);
          if (result?.success) {
            setAlerts((prev) =>
              prev.map((a) =>
                a.id === alertId ? { ...a, status: 'suppressed' as AlertStatus } : a
              )
            );
            addToast('Alert suppressed', 'info');
          } else {
            addToast('Failed to suppress alert', 'error');
          }
        } else {
          setAlerts((prev) =>
            prev.map((a) =>
              a.id === alertId ? { ...a, status: 'suppressed' as AlertStatus } : a
            )
          );
          addToast('Alert suppressed (offline)', 'info');
        }
        const s = await fetchStats();
        if (s) setStats(s);
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
    [monitor, addToast, fetchStats]
  );

  // ─── Bulk Actions ──────────────────────────────────────────────────────────

  const handleAcknowledgeAll = useCallback(async () => {
    setBulkProcessing(true);
    try {
      if (monitor?.acknowledgeAll) {
        const result = await monitor.acknowledgeAll();
        if (result?.success) {
          const count = result.data?.acknowledged ?? 0;
          addToast(`${count} alert(s) acknowledged`, 'success');
          await loadAll();
        } else {
          addToast('Failed to acknowledge all alerts', 'error');
        }
      } else {
        // Mock fallback
        const count = alerts.filter((a) => a.status === 'active').length;
        setAlerts((prev) =>
          prev.map((a) =>
            a.status === 'active'
              ? { ...a, status: 'acknowledged' as AlertStatus, acknowledgedAt: new Date().toISOString() }
              : a
          )
        );
        addToast(`${count} alert(s) acknowledged (offline)`, 'success');
      }
    } catch (error) {
      console.error('[AlertCenter] Acknowledge all failed:', error);
      addToast('Failed to acknowledge all alerts', 'error');
    } finally {
      setBulkProcessing(false);
    }
  }, [monitor, alerts, addToast, loadAll]);

  const handleAcknowledgeAllCritical = useCallback(async () => {
    setBulkProcessing(true);
    try {
      if (monitor?.acknowledgeAll) {
        const result = await monitor.acknowledgeAll('critical');
        if (result?.success) {
          const count = result.data?.acknowledged ?? 0;
          addToast(`${count} critical alert(s) acknowledged`, 'success');
          await loadAll();
        } else {
          addToast('Failed to acknowledge critical alerts', 'error');
        }
      } else {
        const count = alerts.filter((a) => a.level === 'critical' && a.status === 'active').length;
        setAlerts((prev) =>
          prev.map((a) =>
            a.level === 'critical' && a.status === 'active'
              ? { ...a, status: 'acknowledged' as AlertStatus, acknowledgedAt: new Date().toISOString() }
              : a
          )
        );
        addToast(`${count} critical alert(s) acknowledged (offline)`, 'success');
      }
    } catch (error) {
      console.error('[AlertCenter] Acknowledge all critical failed:', error);
      addToast('Failed to acknowledge critical alerts', 'error');
    } finally {
      setBulkProcessing(false);
    }
  }, [monitor, alerts, addToast, loadAll]);

  // ─── Refresh Handler ───────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    if (ipcAvailable) {
      await loadAll();
    } else {
      setAlerts(generateMockAlerts());
      setStats(generateMockStats());
      setLoading(false);
    }
    addToast('Alerts refreshed', 'info');
  }, [ipcAvailable, loadAll, addToast]);

  // ─── Source Breakdown (for stats bar enrichment) ───────────────────────────

  const sourceBreakdown = useMemo(() => {
    if (!stats?.bySource) return [];
    return Object.entries(stats.bySource)
      .filter(([_, count]) => count > 0)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 4);
  }, [stats]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/5 via-transparent to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm shadow-lg shadow-blue-500/20">
                🛡
              </span>
              Alert Center
            </h1>
            <p className="text-gray-500 text-sm mt-1 ml-10">
              Unified monitoring & alert management
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div className="flex items-center gap-1.5 text-xs">
              <div
                className={`w-2 h-2 rounded-full ${
                  ipcAvailable ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-500 shadow-sm shadow-amber-500/50'
                }`}
              />
              <span className={ipcAvailable ? 'text-emerald-500' : 'text-amber-500'}>
                {ipcAvailable ? 'Live' : 'Offline'}
              </span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 text-gray-300 hover:bg-gray-700/60 hover:text-white transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar stats={stats} loading={loading} ipcConnected={ipcAvailable} />

        {/* Source Breakdown (compact) */}
        {stats && sourceBreakdown.length > 0 && (
          <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
            <span className="font-semibold uppercase tracking-wider">By source:</span>
            {sourceBreakdown.map(([source, count]) => (
              <span key={source} className="flex items-center gap-1">
                <span className={getSourceBadgeClasses(source as AlertSource)}>{source}</span>
                <span className="tabular-nums">{count as number}</span>
              </span>
            ))}
          </div>
        )}

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
        <div ref={listRef} className="space-y-2.5">
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

        {/* Footer info */}
        {!loading && filteredAlerts.length > 0 && (
          <div className="mt-6 text-center text-gray-600 text-xs">
            Showing {filteredAlerts.length} of {alerts.length} total alerts
            {ipcAvailable && ' • Auto-refresh every 30s'}
          </div>
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
