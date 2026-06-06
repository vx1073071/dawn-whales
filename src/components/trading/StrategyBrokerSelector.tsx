// ── StrategyBrokerSelector Component ────────────────────────────────────────
// Per-strategy broker binding dropdown with connection status indicators.
// Task J-27-03: Strategy → Broker Binding
//
// Allows users to assign a specific broker to a strategy, or leave it on
// the active (default) broker.  Shows real-time connection status per broker.

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface BrokerConfig {
  id: string;
  name: string;
  type: 'futu' | 'moomoo' | 'ib' | 'longbridge';
  host: string;
  port: number;
  enabled: boolean;
}

interface BrokerStatus {
  connected: boolean;
  activeId?: string;
  brokers: BrokerConfig[];
}

export interface StrategyBrokerSelectorProps {
  /** The strategy this selector is bound to. */
  strategyId: string;
  /** Currently assigned broker ID (undefined = use active broker). */
  currentBrokerId?: string;
  /** Callback when user picks a different broker. */
  onBrokerChange: (brokerId: string) => void;
  /** Optional className override. */
  className?: string;
  /** Auto-refresh interval in ms (default 15 000). Set 0 to disable. */
  refreshInterval?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getStatusDot(connected: boolean, isActive: boolean): string {
  if (connected && isActive) return 'bg-green-400 shadow-green-400/50 shadow-sm';
  if (connected) return 'bg-green-500/60';
  if (isActive) return 'bg-yellow-400 shadow-yellow-400/50 shadow-sm';
  return 'bg-gray-500';
}

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'futu':       return 'bg-emerald-600/30 text-emerald-300 border-emerald-600/40';
    case 'moomoo':     return 'bg-orange-600/30 text-orange-300 border-orange-600/40';
    case 'ib':         return 'bg-red-600/30 text-red-300 border-red-600/40';
    case 'longbridge': return 'bg-violet-600/30 text-violet-300 border-violet-600/40';
    default:           return 'bg-gray-600/30 text-gray-300 border-gray-600/40';
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function StrategyBrokerSelector({
  strategyId,
  currentBrokerId,
  onBrokerChange,
  className = '',
  refreshInterval = 15_000,
}: StrategyBrokerSelectorProps) {
  const [brokers, setBrokers] = useState<BrokerConfig[]>([]);
  const [brokerStatus, setBrokerStatus] = useState<BrokerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Fetch broker data ──────────────────────────────────────────────

  const fetchBrokers = useCallback(async () => {
    try {
      const api = (window as any).api;
      if (!api?.broker) {
        setError('Broker API unavailable');
        setLoading(false);
        return;
      }

      const [brokerList, status]: [BrokerConfig[], BrokerStatus] = await Promise.all([
        api.broker.list(),
        api.broker.getStatus(),
      ]);

      setBrokers(brokerList);
      setBrokerStatus(status);
      setError('');
    } catch (err: any) {
      console.error('[StrategyBrokerSelector] fetch error:', err);
      setError(err.message || 'Failed to load brokers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrokers();
    if (refreshInterval > 0) {
      const iv = setInterval(fetchBrokers, refreshInterval);
      return () => clearInterval(iv);
    }
  }, [fetchBrokers, refreshInterval]);

  // ── Click-outside to close dropdown ────────────────────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Selection handler ──────────────────────────────────────────────

  const handleSelect = (brokerId: string) => {
    onBrokerChange(brokerId);
    setOpen(false);
  };

  // ── Derive display values ──────────────────────────────────────────

  const activeBrokerId = brokerStatus?.activeId ?? '';
  const effectiveBrokerId = currentBrokerId || '';
  const isUsingActive = !effectiveBrokerId;

  const selectedBroker = brokers.find((b) => b.id === effectiveBrokerId);
  const selectedLabel = isUsingActive
    ? `跟随默认 (${brokers.find((b) => b.id === activeBrokerId)?.name || activeBrokerId || '无'})`
    : selectedBroker?.name || effectiveBrokerId;

  const selectedConnected = isUsingActive
    ? (brokerStatus?.connected ?? false)
    : (brokerStatus?.connected && activeBrokerId === effectiveBrokerId) || false;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={loading}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          bg-gray-800 border border-gray-600 hover:border-gray-500
          text-sm text-gray-200 transition-all
          focus:outline-none focus:ring-2 focus:ring-blue-500/50
          disabled:opacity-50 disabled:cursor-not-allowed
          min-w-[200px] justify-between
        `}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 truncate">
          {/* Status dot */}
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusDot(selectedConnected, !isUsingActive)}`}
            title={selectedConnected ? '已连接' : '未连接'}
          />
          <span className="truncate">{selectedLabel}</span>
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Error tooltip */}
      {error && (
        <div className="absolute z-50 mt-1 w-full px-3 py-2 text-xs text-red-300 bg-red-900/60 border border-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute z-40 mt-1 w-full min-w-[260px] bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden"
          role="listbox"
        >
          {/* Strategy info header */}
          <div className="px-3 py-2 border-b border-gray-700 bg-gray-900/50">
            <p className="text-[11px] text-gray-400 uppercase tracking-wider">策略券商绑定</p>
            <p className="text-xs text-gray-500 truncate mt-0.5" title={strategyId}>
              {strategyId}
            </p>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto py-1">
            {/* Option: Use active broker */}
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`
                w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                transition-colors hover:bg-gray-700/60
                ${isUsingActive ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300'}
              `}
              role="option"
              aria-selected={isUsingActive}
            >
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusDot(brokerStatus?.connected ?? false, true)}`}
              />
              <span className="flex-1 truncate">跟随默认券商</span>
              {isUsingActive && (
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Separator */}
            {brokers.length > 0 && (
              <div className="border-t border-gray-700 my-1" />
            )}

            {/* Broker options */}
            {brokers.map((broker) => {
              const isSelected = effectiveBrokerId === broker.id;
              const isConnected = brokerStatus?.connected && brokerStatus.activeId === broker.id;

              return (
                <button
                  key={broker.id}
                  type="button"
                  onClick={() => handleSelect(broker.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                    transition-colors hover:bg-gray-700/60
                    ${isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300'}
                  `}
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* Connection dot */}
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusDot(!!isConnected, isSelected)}`}
                    title={isConnected ? '已连接' : '未连接'}
                  />

                  {/* Broker info */}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{broker.name}</span>
                    <span className="block text-[11px] text-gray-500 truncate">
                      {broker.host}:{broker.port}
                    </span>
                  </span>

                  {/* Type badge */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${getTypeBadgeColor(broker.type)}`}>
                    {broker.type.toUpperCase()}
                  </span>

                  {/* Check mark */}
                  {isSelected && (
                    <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}

            {/* Empty state */}
            {!loading && brokers.length === 0 && (
              <div className="px-3 py-4 text-center text-gray-500 text-xs">
                暂无可用券商
              </div>
            )}

            {/* Loading indicator */}
            {loading && (
              <div className="flex items-center justify-center py-3 gap-2 text-gray-400 text-xs">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
                <span>加载中…</span>
              </div>
            )}
          </div>

          {/* Footer: refresh button */}
          <div className="border-t border-gray-700 px-2 py-1.5 bg-gray-900/50">
            <button
              type="button"
              onClick={fetchBrokers}
              disabled={loading}
              className="w-full text-xs text-gray-400 hover:text-gray-200 py-1 rounded transition-colors disabled:opacity-40"
            >
              {loading ? '刷新中…' : '刷新列表'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
