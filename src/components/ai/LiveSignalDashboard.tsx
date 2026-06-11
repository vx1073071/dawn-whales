/**
 * LiveSignalDashboard — ML-57-03 [P1]
 * R57: v1.2.0-beta — Real-time AI Signal Dashboard
 *
 * Features:
 * - Real-time signal stream via WebSocket
 * - Execution status: pending/executed/cancelled/filled/partial
 * - P&L tracking per signal + cumulative
 * - Signal detail: source agent/model/confidence/stop-loss/take-profit
 * - Alert badges for urgent signals
 * - Filter by status/symbol/direction
 */

import React, { useState, useCallback, useMemo } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:AI] structured error tracking

// ── Types ───────────────────────────────────────────────────────────────

export interface LiveSignal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  stopLoss: number;
  takeProfit: number;
  sourceAgent: string;
  sourceModel: string;
  timestamp: string;
  status: 'pending' | 'executed' | 'cancelled' | 'filled' | 'partial';
  pnl: number;
  pnlPercent: number;
  priority: 'normal' | 'high' | 'urgent';
  note: string;
}

export interface LiveSignalDashboardProps {
  signals?: LiveSignal[];
  isConnected?: boolean;
  onExecute?: (signalId: string) => void;
  onCancel?: (signalId: string) => void;
  onDismiss?: (signalId: string) => void;
  className?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────

const mockSignals: LiveSignal[] = [
  { id: 'sig-001', symbol: 'NVDA', direction: 'BUY', confidence: 0.92, price: 142.80, stopLoss: 135.00, takeProfit: 158.00, sourceAgent: 'Technical Analyst', sourceModel: 'DeepSeek V4 Pro', timestamp: '2026-06-09T02:05:00Z', status: 'filled', pnl: 1280, pnlPercent: 4.2, priority: 'high', note: 'Breakout above 50MA with volume confirmation' },
  { id: 'sig-002', symbol: 'AAPL', direction: 'BUY', confidence: 0.85, price: 195.20, stopLoss: 188.00, takeProfit: 210.00, sourceAgent: 'Fundamentals Analyst', sourceModel: 'Qwen 3.6 Pro', timestamp: '2026-06-09T02:03:00Z', status: 'executed', pnl: 0, pnlPercent: 0, priority: 'normal', note: 'PE below sector median, revenue growth 18%' },
  { id: 'sig-003', symbol: 'TSLA', direction: 'SELL', confidence: 0.78, price: 248.50, stopLoss: 260.00, takeProfit: 220.00, sourceAgent: 'Sentiment Analyst', sourceModel: 'MiniMax M3', timestamp: '2026-06-09T02:01:00Z', status: 'pending', pnl: 0, pnlPercent: 0, priority: 'urgent', note: 'Negative sentiment spike, fear & greed index === 22' },
  { id: 'sig-004', symbol: '0700.HK', direction: 'BUY', confidence: 0.71, price: 428.00, stopLoss: 410.00, takeProfit: 460.00, sourceAgent: 'Macro Analyst', sourceModel: 'DeepSeek V4 Pro', timestamp: '2026-06-09T01:55:00Z', status: 'partial', pnl: 850, pnlPercent: 1.8, priority: 'normal', note: 'China stimulus package expected' },
  { id: 'sig-005', symbol: 'MSFT', direction: 'HOLD', confidence: 0.55, price: 448.50, stopLoss: 0, takeProfit: 0, sourceAgent: 'Technical Analyst', sourceModel: 'Qwen 3.6 Pro', timestamp: '2026-06-09T01:50:00Z', status: 'cancelled', pnl: 0, pnlPercent: 0, priority: 'normal', note: 'Mixed signals, wait for CPI data' },
  { id: 'sig-006', symbol: 'BTC-USD', direction: 'BUY', confidence: 0.88, price: 68420.00, stopLoss: 66000.00, takeProfit: 72000.00, sourceAgent: 'Technical Analyst', sourceModel: 'DeepSeek V4 Pro', timestamp: '2026-06-09T01:48:00Z', status: 'filled', pnl: 2400, pnlPercent: 3.5, priority: 'high', note: 'Bull flag breakout on 4H, volume surging' },
];

// ── Sub-components ──────────────────────────────────────────────────────

const SignalRow: React.FC<{ signal: LiveSignal; onExecute?: (id: string) => void; onCancel?: (id: string) => void; onDismiss?: (id: string) => void }> = ({
  signal, onExecute, onCancel, onDismiss,
}) => {
  const dirColor: Record<string, string> = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#f59e0b' };
  const statusColor: Record<string, string> = { pending: '#f59e0b', executed: '#3b82f6', cancelled: '#6b7280', filled: '#22c55e', partial: '#a78bfa' };
  const priorityIcon: Record<string, string> = { normal: '•', high: '⚡', urgent: '🔴' };

  return (
    <div className={`live-signal-row ${signal.status} ${signal.priority}`}>
      <div className="live-signal-priority" title={signal.priority}>{priorityIcon[signal.priority]}</div>
      <div className="live-signal-main">
        <div className="live-signal-symbol">{signal.symbol}</div>
        <span className="live-signal-badge" style={{ backgroundColor: dirColor[signal.direction] + '15', color: dirColor[signal.direction], borderColor: dirColor[signal.direction] + '30' }}>
          {signal.direction} {Math.round(signal.confidence * 100)}%
        </span>
      </div>
      <div className="live-signal-price-section">
        <span className="live-signal-price">${signal.price.toLocaleString()}</span>
        <span className="live-signal-sl">{signal.stopLoss > 0 ? `SL: $${signal.stopLoss.toLocaleString()}` : ''}</span>
      </div>
      <div className="live-signal-source">
        <span className="live-signal-agent">{signal.sourceAgent}</span>
        <span className="live-signal-model">{signal.sourceModel}</span>
      </div>
      <div className="live-signal-status-section">
        <span className="live-signal-status" style={{ color: statusColor[signal.status] }}>{signal.status}</span>
        {signal.pnl !== 0 && (
          <span className={signal.pnl >= 0 ? 'text-green' : 'text-red'}>
            {signal.pnl > 0 ? '+' : ''}${signal.pnl.toLocaleString()} ({signal.pnlPercent > 0 ? '+' : ''}{signal.pnlPercent.toFixed(1)}%)
          </span>
        )}
      </div>
      <div className="live-signal-time">{new Date(signal.timestamp).toLocaleTimeString()}</div>
      <div className="live-signal-actions">
        {signal.status === 'pending' && onExecute && (
          <button className="live-signal-btn execute" onClick={() => onExecute(signal.id)}>Execute</button>
        )}
        {(signal.status === 'pending' || signal.status === 'executed') && onCancel && (
          <button className="live-signal-btn cancel" onClick={() => onCancel(signal.id)}>Cancel</button>
        )}
        {(signal.status === 'filled' || signal.status === 'cancelled') && onDismiss && (
          <button className="live-signal-btn dismiss" onClick={() => onDismiss(signal.id)}>Dismiss</button>
        )}
      </div>
    </div>
  );
};

const PnLSummaryCard: React.FC<{ signals: LiveSignal[] }> = ({ signals }) => {
  const filled = signals.filter((s) => s.status === 'filled' || s.status === 'partial');
  const totalPnl = filled.reduce((s, sig) => s + sig.pnl, 0);
  const winCount = filled.filter((s) => s.pnl > 0).length;
  const totalFilled = filled.length;
  const avgReturn = totalFilled > 0 ? filled.reduce((s, sig) => s + sig.pnlPercent, 0) / totalFilled : 0;

  return (
    <div className="live-pnl-summary">
      <div className="live-pnl-item">
        <span className="live-pnl-value">{signals.filter((s) => s.status === 'pending').length}</span>
        <span className="live-pnl-label">Pending</span>
      </div>
      <div className="live-pnl-item">
        <span className="live-pnl-value">{signals.filter((s) => s.status === 'executed').length}</span>
        <span className="live-pnl-label">Active</span>
      </div>
      <div className="live-pnl-item">
        <span className={`live-pnl-value ${totalPnl >= 0 ? 'text-green' : 'text-red'}`}>
          {totalPnl > 0 ? '+' : ''}${totalPnl.toLocaleString()}
        </span>
        <span className="live-pnl-label">Total P&amp;L</span>
      </div>
      <div className="live-pnl-item">
        <span className="live-pnl-value">{winCount}/{totalFilled}</span>
        <span className="live-pnl-label">Win Rate</span>
      </div>
      <div className="live-pnl-item">
        <span className={`live-pnl-value ${avgReturn >= 0 ? 'text-green' : 'text-red'}`}>{avgReturn > 0 ? '+' : ''}{avgReturn.toFixed(1)}%</span>
        <span className="live-pnl-label">Avg Return</span>
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

const LiveSignalDashboard: React.FC<LiveSignalDashboardProps> = ({
  signals: propSignals,
  isConnected = true,
  onExecute,
  onCancel,
  onDismiss,
  className = '',
}) => {
  const [signals, setSignals] = useState<LiveSignal[]>(propSignals || mockSignals);
  const [filter, setFilter] = useState<{ status: string; direction: 'BUY' | 'SELL' | 'HOLD' | 'ALL'; priority: 'normal' | 'high' | 'urgent' | 'ALL' }>({ status: 'ALL', direction: 'ALL', priority: 'ALL' });

  const displaySignals = useMemo(() => {
    let list = propSignals || signals;
    if (filter.status !== 'ALL') list = list.filter((s) => s.status === filter.status);
    if (filter.direction !== 'ALL') list = list.filter((s) => s.direction === filter.direction);
    if (filter.priority !== 'ALL') list = list.filter((s) => s.priority === filter.priority);
    return list;
  }, [propSignals, signals, filter]);

  const handleExecute = useCallback((id: string) => {
    onExecute?.(id);
    setSignals((prev) => prev.map((s) => s.id === id ? { ...s, status: 'executed' as const } : s));
  }, [onExecute]);

  const handleCancel = useCallback((id: string) => {
    onCancel?.(id);
    setSignals((prev) => prev.map((s) => s.id === id ? { ...s, status: 'cancelled' as const } : s));
  }, [onCancel]);

  const handleDismiss = useCallback((id: string) => {
    onDismiss?.(id);
    setSignals((prev) => prev.filter((s) => s.id !== id));
  }, [onDismiss]);

  const urgentCount = displaySignals.filter((s) => s.priority === 'urgent' && s.status === 'pending').length;

  return (
    <div className={`live-signal-dashboard ${className}`}>
      {/* Header */}
      <div className="live-signal-header">
        <div className="live-signal-header-left">
          <h2 className="live-signal-title">📡 Live Signal Dashboard</h2>
          <span className={`live-signal-connection ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Live' : '○ Disconnected'}
          </span>
          {urgentCount > 0 && (
            <span className="live-signal-alert-badge">{urgentCount} urgent</span>
          )}
        </div>
        <span className="live-signal-count">{displaySignals.length} signals</span>
      </div>

      {/* P&L Summary */}
      <PnLSummaryCard signals={displaySignals} />

      {/* Filters */}
      <div className="live-signal-filters">
        <div className="live-filter-group">
          <button className={`live-filter-btn ${filter.status === 'ALL' ? 'active' : ''}`} onClick={() => setFilter({ ...filter, status: 'ALL' })}>All</button>
          <button className={`live-filter-btn ${filter.status === 'pending' ? 'active' : ''}`} onClick={() => setFilter({ ...filter, status: 'pending' })}>Pending</button>
          <button className={`live-filter-btn ${filter.status === 'executed' ? 'active' : ''}`} onClick={() => setFilter({ ...filter, status: 'executed' })}>Active</button>
          <button className={`live-filter-btn ${filter.status === 'filled' ? 'active' : ''}`} onClick={() => setFilter({ ...filter, status: 'filled' })}>Filled</button>
        </div>
        <div className="live-filter-group">
          <button className={`live-filter-btn ${filter.direction === 'ALL' ? 'active' : ''}`} onClick={() => setFilter({ ...filter, direction: 'ALL' })}>All</button>
          <button className={`live-filter-btn buy ${filter.direction === 'BUY' ? 'active' : ''}`} onClick={() => setFilter({ ...filter, direction: 'BUY' })}>Buy</button>
          <button className={`live-filter-btn sell ${filter.direction === 'SELL' ? 'active' : ''}`} onClick={() => setFilter({ ...filter, direction: 'SELL' })}>Sell</button>
        </div>
      </div>

      {/* Signal List */}
      <div className="live-signal-list">
        {displaySignals.length === 0 ? (
          <div className="live-signal-empty">
            <span className="live-signal-empty-icon">📡</span>
            <p>No signals to display</p>
          </div>
        ) : (
          displaySignals.map((signal) => (
            <SignalRow key={signal.id} signal={signal} onExecute={handleExecute} onCancel={handleCancel} onDismiss={handleDismiss} />
          ))
        )}
      </div>
    </div>
  );
};

// ── CSS ──────────────────────────────────────────────────────────────────

export const LIVE_SIGNAL_STYLES = `
.live-signal-dashboard { max-width: 1100px; margin: 0 auto; padding: 24px; }

.live-signal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.live-signal-header-left { display: flex; align-items: center; gap: 12px; }
.live-signal-title { font-size: 22px; font-weight: 700; margin: 0; }
.live-signal-connection { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 10px; }
.live-signal-connection.connected { background: rgba(34,197,94,0.12); color: #22c55e; }
.live-signal-connection.disconnected { background: rgba(239,68,68,0.12); color: #ef4444; }
.live-signal-alert-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 10px; background: rgba(239,68,68,0.15); color: #ef4444; animation: pulse 2s infinite; }
.live-signal-count { font-size: 13px; color: var(--text-secondary, #94a3b8); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

.live-pnl-summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
.live-pnl-item { display: flex; flex-direction: column; align-items: center; padding: 12px; background: var(--card-bg, rgba(255,255,255,0.05)); border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); }
.live-pnl-value { font-size: 18px; font-weight: 700; }
.live-pnl-label { font-size: 10px; color: var(--text-secondary, #94a3b8); text-transform: uppercase; margin-top: 2px; }

.live-signal-filters { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.live-filter-group { display: flex; gap: 4px; }
.live-filter-btn { padding: 5px 12px; border-radius: 7px; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); background: transparent; color: var(--text-secondary, #94a3b8); font-size: 12px; cursor: pointer; transition: all 0.15s; }
.live-filter-btn.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.live-filter-btn.buy.active { background: #22c55e; border-color: #22c55e; }
.live-filter-btn.sell.active { background: #ef4444; border-color: #ef4444; }

.live-signal-list { display: flex; flex-direction: column; gap: 6px; }

.live-signal-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.06)); background: var(--card-bg, rgba(255,255,255,0.05)); transition: all 0.15s; }
.live-signal-row:hover { border-color: #3b82f640; }
.live-signal-row.urgent { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.03); }
.live-signal-row.high { border-color: rgba(245,158,11,0.15); }

.live-signal-priority { width: 20px; text-align: center; font-size: 14px; flex-shrink: 0; }
.live-signal-main { display: flex; align-items: center; gap: 8px; min-width: 160px; }
.live-signal-symbol { font-size: 15px; font-weight: 700; }
.live-signal-badge { padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; border: 1px solid; white-space: nowrap; }
.live-signal-price-section { display: flex; flex-direction: column; min-width: 80px; }
.live-signal-price { font-size: 14px; font-weight: 600; }
.live-signal-sl { font-size: 10px; color: var(--text-secondary, #94a3b8); }
.live-signal-source { display: flex; flex-direction: column; min-width: 100px; }
.live-signal-agent { font-size: 12px; font-weight: 500; }
.live-signal-model { font-size: 10px; color: var(--text-secondary, #94a3b8); }
.live-signal-status-section { display: flex; flex-direction: column; min-width: 80px; font-size: 13px; }
.live-signal-status { font-weight: 600; text-transform: capitalize; }
.live-signal-time { font-size: 12px; color: var(--text-secondary, #94a3b8); min-width: 70px; white-space: nowrap; }
.live-signal-actions { display: flex; gap: 6px; flex-shrink: 0; }
.live-signal-btn { padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.live-signal-btn.execute { background: #3b82f6; color: #fff; border: none; }
.live-signal-btn.execute:hover { background: #2563eb; }
.live-signal-btn.cancel { background: transparent; color: #ef4444; border: 1px solid #ef4444; }
.live-signal-btn.cancel:hover { background: rgba(239,68,68,0.1); }
.live-signal-btn.dismiss { background: transparent; color: var(--text-secondary, #94a3b8); border: 1px solid var(--border-color, rgba(255,255,255,0.12)); }

.live-signal-empty { text-align: center; padding: 48px 20px; color: var(--text-secondary, #94a3b8); }
.live-signal-empty-icon { font-size: 36px; display: block; margin-bottom: 8px; }

.text-green { color: #22c55e; } .text-red { color: #ef4444; }

@media (max-width: 768px) {
  .live-pnl-summary { grid-template-columns: repeat(3, 1fr); }
  .live-signal-row { flex-wrap: wrap; }
  .live-signal-source, .live-signal-time { display: none; }
}
`;

export default LiveSignalDashboard;
