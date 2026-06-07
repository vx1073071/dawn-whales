/**
 * SignalFeed + CopyTradePanel — ML-53-02 [P0]
 * R53: v1.1.0-beta Social Trading — Signal Feed + Copy Trade UI
 *
 * Features:
 * - Real-time signal feed with BUY/SELL/HOLD filtering
 * - Verified-only filter + confidence threshold
 * - One-click copy-trade activation from signal
 * - Copy trade config: fixed $ / proportional % / Kelly fraction
 * - Active copy-trade monitoring with P&L / win rate
 * - Pause / Resume / Stop controls
 * - Skeleton loading + empty states
 * - Responsive layout
 */

import React, { useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface FeedSignal {
  id: string;
  traderId: string;
  traderName: string;
  traderAvatar: string;
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: string;
  strategyName: string;
  verified: boolean;
}

export interface CopyTradeConfig {
  traderId: string;
  traderName: string;
  mode: 'fixed' | 'proportional' | 'kelly';
  amount: number;
  maxPositionSize: number;
  stopLoss: boolean;
  maxDrawdownLimit: number;
}

export interface ActiveCopyTrade {
  id: string;
  config: CopyTradeConfig;
  startDate: string;
  totalPnl: number;
  totalPnlPercent: number;
  winRate: number;
  totalTrades: number;
  currentPosition: number;
  status: 'active' | 'paused' | 'stopped';
}

export interface SignalFeedProps {
  signals: FeedSignal[];
  isLoading?: boolean;
  onCopyTrade?: (signal: FeedSignal) => void;
  onSignalClick?: (signalId: string) => void;
  onFilterChange?: (filter: SignalFilter) => void;
  className?: string;
}

export interface CopyTradePanelProps {
  activeTrades: ActiveCopyTrade[];
  availableTraders: Array<{ id: string; name: string; avatar: string }>;
  onStartCopy: (config: CopyTradeConfig) => void;
  onStopCopy: (tradeId: string) => void;
  onPauseCopy: (tradeId: string) => void;
  onResumeCopy: (tradeId: string) => void;
  className?: string;
}

export interface SignalFilter {
  direction?: 'BUY' | 'SELL' | 'ALL' | 'HOLD';
  minConfidence?: number;
  verifiedOnly?: boolean;
}

// ── Mock data ───────────────────────────────────────────────────────────

const mockSignals: FeedSignal[] = [
  { id: 'fs-01', traderId: 't-001', traderName: 'AlphaSeeker', traderAvatar: '', symbol: 'AAPL', direction: 'BUY', confidence: 0.88, price: 195.20, stopLoss: 188.00, takeProfit: 210.00, timestamp: '2026-06-08T03:15:00Z', strategyName: 'Momentum Swing', verified: true },
  { id: 'fs-02', traderId: 't-002', traderName: 'BetaWave', traderAvatar: '', symbol: 'TSLA', direction: 'SELL', confidence: 0.72, price: 248.50, stopLoss: 260.00, timestamp: '2026-06-08T03:12:00Z', strategyName: 'Mean Reversion', verified: true },
  { id: 'fs-03', traderId: 't-003', traderName: 'GammaQuant', traderAvatar: '', symbol: 'NVDA', direction: 'BUY', confidence: 0.94, price: 142.80, stopLoss: 135.00, takeProfit: 158.00, timestamp: '2026-06-08T03:10:00Z', strategyName: 'Earnings Surprise', verified: true },
  { id: 'fs-04', traderId: 't-004', traderName: 'DeltaTrader', traderAvatar: '', symbol: 'QQQ', direction: 'BUY', confidence: 0.65, price: 498.20, timestamp: '2026-06-08T03:05:00Z', strategyName: 'Trend Following', verified: false },
  { id: 'fs-05', traderId: 't-001', traderName: 'AlphaSeeker', traderAvatar: '', symbol: 'MSFT', direction: 'HOLD', confidence: 0.55, price: 448.50, timestamp: '2026-06-08T02:45:00Z', strategyName: 'Momentum Swing', verified: true },
  { id: 'fs-06', traderId: 't-005', traderName: 'EpsilonEdge', traderAvatar: '', symbol: 'BTC', direction: 'BUY', confidence: 0.81, price: 68420.00, stopLoss: 66000.00, timestamp: '2026-06-08T02:30:00Z', strategyName: 'Crypto Momentum', verified: false },
];

const mockActiveTrades: ActiveCopyTrade[] = [
  { id: 'ct-001', config: { traderId: 't-001', traderName: 'AlphaSeeker', mode: 'proportional', amount: 20, maxPositionSize: 50000, stopLoss: true, maxDrawdownLimit: 15 }, startDate: '2026-05-15', totalPnl: 3850, totalPnlPercent: 12.8, winRate: 64, totalTrades: 47, currentPosition: 34200, status: 'active' },
  { id: 'ct-002', config: { traderId: 't-003', traderName: 'GammaQuant', mode: 'fixed', amount: 500, maxPositionSize: 25000, stopLoss: true, maxDrawdownLimit: 10 }, startDate: '2026-06-01', totalPnl: -420, totalPnlPercent: -1.7, winRate: 55, totalTrades: 12, currentPosition: 24800, status: 'paused' },
];

const defaultTraders: Array<{ id: string; name: string; avatar: string }> = [
  { id: 't-001', name: 'AlphaSeeker', avatar: '' },
  { id: 't-003', name: 'GammaQuant', avatar: '' },
];

// ── SignalFeed Component ─────────────────────────────────────────────────

const SignalFeed: React.FC<SignalFeedProps> = ({
  signals = mockSignals,
  isLoading = false,
  onCopyTrade,
  onSignalClick,
  onFilterChange,
  className = '',
}) => {
  const [filter, setFilter] = useState<SignalFilter>({ direction: 'ALL', minConfidence: 0, verifiedOnly: false });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleFilter = useCallback((update: Partial<SignalFilter>) => {
    const next = { ...filter, ...update };
    setFilter(next);
    onFilterChange?.(next);
  }, [filter, onFilterChange]);

  const filteredSignals = useMemo(() => signals.filter((s) => {
    if (filter.direction && filter.direction !== 'ALL' && s.direction !== filter.direction) return false;
    if ((filter.minConfidence ?? 0) > 0 && s.confidence < (filter.minConfidence ?? 0)) return false;
    if (filter.verifiedOnly && !s.verified) return false;
    return true;
  }), [signals, filter]);

  const relativeTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const dirColor: Record<string, string> = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#f59e0b' };

  if (isLoading) {
    return (
      <div className="signal-feed skeleton-loading">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="signal-row skeleton" style={{ height: 72 }} />
        ))}
      </div>
    );
  }

  return (
    <div className={`signal-feed ${className}`}>
      {/* Filter Bar */}
      <div className="signal-filter-bar">
        <div className="signal-filter-tabs">
          {(['ALL', 'BUY', 'SELL'] as const).map((d) => (
            <button
              key={d}
              className={`signal-filter-tab ${filter.direction === d ? 'active' : ''}`}
              onClick={() => handleFilter({ direction: d })}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="signal-filter-options">
          <label className="signal-filter-checkbox">
            <input
              type="checkbox"
              checked={filter.verifiedOnly}
              onChange={(e) => handleFilter({ verifiedOnly: e.target.checked })}
            />
            Verified only
          </label>
          <select
            className="signal-filter-select"
            value={filter.minConfidence}
            onChange={(e) => handleFilter({ minConfidence: Number(e.target.value) })}
          >
            <option value={0}>All Confidence</option>
            <option value={0.7}>≥70%</option>
            <option value={0.8}>≥80%</option>
            <option value={0.9}>≥90%</option>
          </select>
        </div>
      </div>

      {/* Signal List */}
      <div className="signal-list">
        {filteredSignals.length === 0 ? (
          <div className="signal-empty">
            <span className="signal-empty-icon">📡</span>
            <p>No signals match your filters</p>
          </div>
        ) : (
          filteredSignals.map((signal) => (
            <div
              key={signal.id}
              className={`signal-row ${expandedId === signal.id ? 'expanded' : ''}`}
              onClick={() => onSignalClick?.(signal.id)}
            >
              <div className="signal-main">
                <div className="signal-trader">
                  <div
                    className="signal-avatar"
                    style={{ backgroundColor: dirColor[signal.direction] + '20' }}
                  >
                    {signal.traderAvatar ? (
                      <img src={signal.traderAvatar} alt="" />
                    ) : (
                      signal.traderName.charAt(0)
                    )}
                  </div>
                  <div className="signal-trader-info">
                    <span className="signal-trader-name">
                      {signal.traderName}
                      {signal.verified && <span className="signal-verified">✓</span>}
                    </span>
                    <span className="signal-strategy">{signal.strategyName}</span>
                  </div>
                </div>

                <div className="signal-core">
                  <span className="signal-symbol">{signal.symbol}</span>
                  <span
                    className="signal-badge"
                    style={{
                      backgroundColor: dirColor[signal.direction] + '15',
                      color: dirColor[signal.direction],
                      borderColor: dirColor[signal.direction] + '30',
                    }}
                  >
                    {signal.direction} {Math.round(signal.confidence * 100)}%
                  </span>
                </div>

                <div className="signal-price-section">
                  <span className="signal-price">${signal.price.toLocaleString()}</span>
                  <span className="signal-time">{relativeTime(signal.timestamp)}</span>
                </div>

                <div className="signal-actions">
                  <button
                    className="signal-btn-detail"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(expandedId === signal.id ? null : signal.id);
                    }}
                  >
                    {expandedId === signal.id ? '−' : '+'}
                  </button>
                  <button
                    className="signal-btn-copy"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyTrade?.(signal);
                    }}
                  >
                    Copy Trade
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === signal.id && (
                <div className="signal-details">
                  <div className="signal-detail-grid">
                    {signal.stopLoss && (
                      <div className="signal-detail-item">
                        <span className="signal-detail-label">Stop Loss</span>
                        <span className="text-red">${signal.stopLoss.toLocaleString()}</span>
                      </div>
                    )}
                    {signal.takeProfit && (
                      <div className="signal-detail-item">
                        <span className="signal-detail-label">Take Profit</span>
                        <span className="text-green">${signal.takeProfit.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="signal-detail-item">
                      <span className="signal-detail-label">Confidence</span>
                      <span>{Math.round(signal.confidence * 100)}%</span>
                    </div>
                    <div className="signal-detail-item">
                      <span className="signal-detail-label">Time</span>
                      <span>{new Date(signal.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ── CopyTradePanel Component ─────────────────────────────────────────────

const CopyTradePanel: React.FC<CopyTradePanelProps> = ({
  activeTrades = mockActiveTrades,
  availableTraders = defaultTraders,
  onStartCopy,
  onStopCopy,
  onPauseCopy,
  onResumeCopy,
  className = '',
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<CopyTradeConfig>({
    traderId: '',
    traderName: '',
    mode: 'proportional',
    amount: 10,
    maxPositionSize: 50000,
    stopLoss: true,
    maxDrawdownLimit: 15,
  });

  const handleStart = useCallback(() => {
    if (!config.traderId) return;
    onStartCopy(config);
    setShowConfig(false);
  }, [config, onStartCopy]);

  const totalPnl = useMemo(() => activeTrades.reduce((sum, t) => sum + t.totalPnl, 0), [activeTrades]);
  const activeCount = activeTrades.filter((t) => t.status === 'active').length;
  const avgWinRate = activeTrades.length > 0
    ? Math.round(activeTrades.reduce((s, t) => s + t.winRate, 0) / activeTrades.length)
    : 0;

  return (
    <div className={`copy-trade-panel ${className}`}>
      {/* Header */}
      <div className="copy-trade-header">
        <h3 className="copy-trade-title">Copy Trading</h3>
        <button className="copy-btn-new" onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? 'Cancel' : '+ New Copy'}
        </button>
      </div>

      {/* Summary Bar */}
      <div className="copy-summary">
        <div className="copy-summary-item">
          <span className="copy-summary-label">Active Copies</span>
          <span className="copy-summary-value">{activeCount}</span>
        </div>
        <div className="copy-summary-item">
          <span className="copy-summary-label">Total P&amp;L</span>
          <span className={`copy-summary-value ${totalPnl >= 0 ? 'text-green' : 'text-red'}`}>
            {totalPnl > 0 ? '+' : ''}${totalPnl.toLocaleString()}
          </span>
        </div>
        <div className="copy-summary-item">
          <span className="copy-summary-label">Win Rate</span>
          <span className="copy-summary-value">
            {avgWinRate > 0 ? `${avgWinRate}%` : '--'}
          </span>
        </div>
      </div>

      {/* Config Form */}
      {showConfig && (
        <div className="copy-config-form">
          <h4 className="copy-config-title">New Copy Trade</h4>

          <div className="copy-config-field">
            <label>Trader</label>
            <select
              value={config.traderId}
              onChange={(e) =>
                setConfig({
                  ...config,
                  traderId: e.target.value,
                  traderName: availableTraders.find((t) => t.id === e.target.value)?.name || '',
                })
              }
            >
              <option value="">Select trader...</option>
              {availableTraders.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="copy-config-field">
            <label>Mode</label>
            <div className="copy-mode-options">
              {(['fixed', 'proportional', 'kelly'] as const).map((m) => (
                <button
                  key={m}
                  className={`copy-mode-btn ${config.mode === m ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, mode: m })}
                >
                  {m === 'fixed' ? 'Fixed ($)' : m === 'proportional' ? 'Proportional (%)' : 'Kelly'}
                </button>
              ))}
            </div>
          </div>

          <div className="copy-config-field">
            <label>
              {config.mode === 'fixed'
                ? 'Amount (USD)'
                : config.mode === 'proportional'
                  ? 'Allocation (%)'
                  : 'Kelly Fraction'}
            </label>
            <input
              type="number"
              value={config.amount}
              onChange={(e) => setConfig({ ...config, amount: Number(e.target.value) })}
              min={1}
              max={config.mode === 'proportional' ? 100 : config.mode === 'kelly' ? 1 : 1000000}
            />
          </div>

          <div className="copy-config-field">
            <label>Max Position Size (USD)</label>
            <input
              type="number"
              value={config.maxPositionSize}
              onChange={(e) => setConfig({ ...config, maxPositionSize: Number(e.target.value) })}
            />
          </div>

          <div className="copy-config-field">
            <label>Max Drawdown Limit (%)</label>
            <input
              type="number"
              value={config.maxDrawdownLimit}
              onChange={(e) => setConfig({ ...config, maxDrawdownLimit: Number(e.target.value) })}
              min={1}
              max={50}
            />
          </div>

          <div className="copy-config-field copy-config-check">
            <label>
              <input
                type="checkbox"
                checked={config.stopLoss}
                onChange={(e) => setConfig({ ...config, stopLoss: e.target.checked })}
              />
              Auto Stop-Loss
            </label>
          </div>

          <button className="copy-btn-start" onClick={handleStart} disabled={!config.traderId}>
            Start Copy Trading
          </button>
        </div>
      )}

      {/* Active Trades */}
      <div className="copy-active-list">
        {activeTrades.length === 0 ? (
          <div className="copy-empty">
            <span className="copy-empty-icon">🔄</span>
            <p>No active copy trades</p>
            <p className="copy-empty-hint">
              Select a trader's signal and click "Copy Trade" to start
            </p>
          </div>
        ) : (
          activeTrades.map((trade) => (
            <div key={trade.id} className={`copy-trade-card ${trade.status}`}>
              <div className="copy-card-header">
                <span className="copy-card-trader">{trade.config.traderName}</span>
                <span className={`copy-card-status status-${trade.status}`}>{trade.status}</span>
              </div>
              <div className="copy-card-stats">
                <div className="copy-card-stat">
                  <span className="copy-card-label">P&amp;L</span>
                  <span className={trade.totalPnl >= 0 ? 'text-green' : 'text-red'}>
                    {trade.totalPnl > 0 ? '+' : ''}{trade.totalPnlPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="copy-card-stat">
                  <span className="copy-card-label">Win Rate</span>
                  <span>{trade.winRate}%</span>
                </div>
                <div className="copy-card-stat">
                  <span className="copy-card-label">Trades</span>
                  <span>{trade.totalTrades}</span>
                </div>
                <div className="copy-card-stat">
                  <span className="copy-card-label">Position</span>
                  <span>${trade.currentPosition.toLocaleString()}</span>
                </div>
              </div>
              <div className="copy-card-meta">
                <span>
                  {trade.config.mode}
                  {' · '}
                  {trade.config.mode === 'fixed' ? '$' + trade.config.amount : trade.config.amount + '%'}
                </span>
                <span>Since {new Date(trade.startDate).toLocaleDateString()}</span>
              </div>
              <div className="copy-card-actions">
                {trade.status === 'active' && (
                  <button className="copy-card-btn pause" onClick={() => onPauseCopy(trade.id)}>
                    Pause
                  </button>
                )}
                {trade.status === 'paused' && (
                  <button className="copy-card-btn resume" onClick={() => onResumeCopy(trade.id)}>
                    Resume
                  </button>
                )}
                {trade.status !== 'stopped' && (
                  <button className="copy-card-btn stop" onClick={() => onStopCopy(trade.id)}>
                    Stop
                  </button>
                )}
                {trade.status === 'stopped' && (
                  <span className="copy-card-stopped">Stopped</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
export { SignalFeed, CopyTradePanel };
export default SignalFeed;

// ── CSS-in-JS Styles (inject via style tag) ──────────────────────────────

export const SIGNAL_COPY_STYLES = `
.signal-feed { max-width: 720px; margin: 0 auto; }
.signal-filter-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.signal-filter-tabs { display: flex; gap: 4px; }
.signal-filter-tab { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: transparent; color: var(--text-secondary, #94a3b8); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.signal-filter-tab:hover { color: var(--text-primary, #e2e8f0); }
.signal-filter-tab.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.signal-filter-options { display: flex; gap: 12px; align-items: center; font-size: 13px; }
.signal-filter-checkbox { display: flex; align-items: center; gap: 6px; color: var(--text-secondary, #94a3b8); cursor: pointer; user-select: none; }
.signal-filter-select { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: var(--card-bg, rgba(255,255,255,0.05)); color: var(--text-primary, #e2e8f0); font-size: 12px; }
.signal-list { display: flex; flex-direction: column; gap: 8px; }
.signal-row { border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); background: var(--card-bg, rgba(255,255,255,0.05)); overflow: hidden; transition: border-color 0.15s; }
.signal-row:hover { border-color: #3b82f640; }
.signal-row.skeleton { animation: shimmer 1.5s infinite; background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%); background-size: 200% 100%; }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.signal-main { display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; }
.signal-trader { display: flex; align-items: center; gap: 10px; min-width: 160px; }
.signal-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #3b82f6; flex-shrink: 0; }
.signal-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.signal-trader-info { display: flex; flex-direction: column; min-width: 0; }
.signal-trader-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.signal-verified { color: #22c55e; font-size: 12px; margin-left: 4px; }
.signal-strategy { font-size: 11px; color: var(--text-secondary, #94a3b8); }
.signal-core { display: flex; align-items: center; gap: 10px; flex: 1; }
.signal-symbol { font-size: 16px; font-weight: 700; }
.signal-badge { padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; border: 1px solid; white-space: nowrap; }
.signal-price-section { display: flex; flex-direction: column; align-items: flex-end; min-width: 80px; }
.signal-price { font-size: 15px; font-weight: 600; }
.signal-time { font-size: 11px; color: var(--text-secondary, #94a3b8); }
.signal-actions { display: flex; gap: 6px; flex-shrink: 0; }
.signal-btn-detail { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--border-color, rgba(255,255,255,0.15)); background: transparent; color: var(--text-secondary, #94a3b8); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.signal-btn-copy { padding: 6px 14px; border-radius: 7px; border: none; background: #3b82f6; color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.signal-btn-copy:hover { background: #2563eb; }
.signal-details { padding: 0 16px 14px; border-top: 1px solid var(--border-color, rgba(255,255,255,0.06)); }
.signal-detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; padding-top: 12px; }
.signal-detail-item { display: flex; flex-direction: column; gap: 2px; }
.signal-detail-label { font-size: 11px; color: var(--text-secondary, #94a3b8); text-transform: uppercase; letter-spacing: 0.5px; }
.signal-empty { text-align: center; padding: 36px; color: var(--text-secondary, #94a3b8); }
.signal-empty-icon { font-size: 28px; display: block; margin-bottom: 8px; }
.signal-empty p { margin: 0; }

/* Copy Trade Panel */
.copy-trade-panel { max-width: 720px; margin: 0 auto; }
.copy-trade-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.copy-trade-title { font-size: 18px; font-weight: 700; margin: 0; }
.copy-btn-new { padding: 8px 18px; border-radius: 8px; border: 1px solid #3b82f6; background: transparent; color: #3b82f6; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.copy-btn-new:hover { background: #3b82f6; color: #fff; }
.copy-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
.copy-summary-item { display: flex; flex-direction: column; padding: 14px; background: var(--card-bg, rgba(255,255,255,0.05)); border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); }
.copy-summary-label { font-size: 11px; color: var(--text-secondary, #94a3b8); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
.copy-summary-value { font-size: 20px; font-weight: 700; }
.copy-config-form { padding: 20px; background: var(--card-bg, rgba(255,255,255,0.05)); border-radius: 12px; border: 1px solid #3b82f640; margin-bottom: 16px; }
.copy-config-title { font-size: 15px; font-weight: 600; margin: 0 0 16px 0; }
.copy-config-field { margin-bottom: 14px; }
.copy-config-field label { display: block; font-size: 12px; font-weight: 500; color: var(--text-secondary, #94a3b8); margin-bottom: 6px; }
.copy-config-field input[type="number"], .copy-config-field select { width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: rgba(255,255,255,0.05); color: var(--text-primary, #e2e8f0); font-size: 14px; box-sizing: border-box; }
.copy-mode-options { display: flex; gap: 6px; }
.copy-mode-btn { flex: 1; padding: 8px; border-radius: 7px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: transparent; color: var(--text-secondary, #94a3b8); font-size: 12px; cursor: pointer; transition: all 0.15s; }
.copy-mode-btn.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.copy-config-check label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.copy-btn-start { width: 100%; padding: 12px; border-radius: 10px; border: none; background: #22c55e; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; margin-top: 4px; }
.copy-btn-start:hover:not(:disabled) { background: #16a34a; }
.copy-btn-start:disabled { background: #374151; cursor: not-allowed; }
.copy-active-list { display: flex; flex-direction: column; gap: 12px; }
.copy-trade-card { padding: 16px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); background: var(--card-bg, rgba(255,255,255,0.05)); }
.copy-trade-card.active { border-left: 3px solid #22c55e; }
.copy-trade-card.paused { border-left: 3px solid #f59e0b; }
.copy-trade-card.stopped { border-left: 3px solid #6b7280; }
.copy-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.copy-card-trader { font-size: 15px; font-weight: 600; }
.copy-card-status { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 6px; text-transform: uppercase; }
.status-active { background: rgba(34,197,94,0.15); color: #22c55e; }
.status-paused { background: rgba(245,158,11,0.15); color: #f59e0b; }
.status-stopped { background: rgba(107,114,128,0.15); color: #6b7280; }
.copy-card-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 10px; }
.copy-card-stat { display: flex; flex-direction: column; align-items: center; }
.copy-card-label { font-size: 10px; color: var(--text-secondary, #94a3b8); text-transform: uppercase; letter-spacing: 0.5px; }
.copy-card-stat > span:last-child { font-size: 14px; font-weight: 600; margin-top: 2px; }
.copy-card-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary, #94a3b8); margin-bottom: 10px; }
.copy-card-actions { display: flex; gap: 8px; }
.copy-card-btn { padding: 6px 14px; border-radius: 7px; border: 1px solid var(--border-color, rgba(255,255,255,0.15)); background: transparent; color: var(--text-secondary, #94a3b8); font-size: 12px; cursor: pointer; transition: all 0.15s; }
.copy-card-btn:hover { color: var(--text-primary, #e2e8f0); }
.copy-card-btn.pause:hover { border-color: #f59e0b; color: #f59e0b; }
.copy-card-btn.resume:hover { border-color: #22c55e; color: #22c55e; }
.copy-card-btn.stop:hover { border-color: #ef4444; color: #ef4444; }
.copy-card-stopped { font-size: 12px; color: #6b7280; }
.copy-empty { text-align: center; padding: 40px 20px; color: var(--text-secondary, #94a3b8); }
.copy-empty-icon { font-size: 32px; display: block; margin-bottom: 12px; }
.copy-empty p { margin: 0; }
.copy-empty-hint { font-size: 12px; margin-top: 4px !important; }

.text-green { color: #22c55e; }
.text-red { color: #ef4444; }

/* Responsive */
@media (max-width: 768px) {
  .signal-main { flex-wrap: wrap; }
  .signal-trader { min-width: 120px; }
  .signal-core { flex: 0 0 auto; }
  .signal-price-section { min-width: auto; }
  .signal-actions { margin-left: auto; }
  .copy-summary { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 480px) {
  .signal-main { padding: 10px 12px; }
  .signal-trader { min-width: 100px; }
  .signal-symbol { font-size: 14px; }
  .signal-btn-copy { padding: 4px 10px; font-size: 11px; }
  .copy-summary { grid-template-columns: 1fr; }
  .copy-card-stats { grid-template-columns: repeat(2, 1fr); }
  .copy-mode-options { flex-direction: column; }
}
`;
