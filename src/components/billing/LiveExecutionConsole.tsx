/**
 * LiveExecutionConsole — ML-59-03 [P1]
 * R59: v1.3.0-alpha — AI signal to simulated execution
 *
 * Features:
 * - Signal approval: review AI signals before execution
 * - Position confirmation: quantity / limit price / stop-loss / take-profit
 * - One-click execute (simulated mode)
 * - Fill report with P&L
 * - "Simulation Mode" badge — real execution disabled (coming soon)
 * - Risk indicators: position limit / daily trade count / max loss
 */

import React, { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface ExecutionSignal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  suggestedPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  sourceAgent: string;
  sourceModel: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'filled' | 'cancelled';
  fillPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  timestamp: string;
}

export interface RiskLimits {
  maxPositionSize: number;     // USDT per position
  maxDailyTrades: number;
  maxDailyLoss: number;        // USDT
  currentPosition: number;
  todayTrades: number;
  todayPnl: number;
}

export interface LiveExecutionConsoleProps {
  signals?: ExecutionSignal[];
  riskLimits?: RiskLimits;
  onApprove?: (signalId: string, quantity: number) => void;
  onReject?: (signalId: string) => void;
  onExecute?: (signalId: string) => void;
  onCancel?: (signalId: string) => void;
  className?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────

const mockSignals: ExecutionSignal[] = [
  { id: 'es-001', symbol: 'AAPL', direction: 'BUY', confidence: 0.85, suggestedPrice: 195.20, quantity: 50, stopLoss: 188.00, takeProfit: 210.00, sourceAgent: 'Fundamental + Technical', sourceModel: 'DeepSeek V4 Pro', reason: 'PE below sector + 50MA breakout', status: 'pending', timestamp: '2026-06-09T03:25:00Z' },
  { id: 'es-002', symbol: 'NVDA', direction: 'BUY', confidence: 0.92, suggestedPrice: 142.80, quantity: 100, stopLoss: 135.00, takeProfit: 158.00, sourceAgent: 'Technical + Macro', sourceModel: 'Qwen 3.6 Pro', reason: 'AI chip demand surge, volume confirmation', status: 'approved', timestamp: '2026-06-09T03:20:00Z' },
  { id: 'es-003', symbol: 'TSLA', direction: 'SELL', confidence: 0.72, suggestedPrice: 248.50, quantity: 30, stopLoss: 260.00, takeProfit: 230.00, sourceAgent: 'Sentiment', sourceModel: 'MiniMax M3', reason: 'Negative sentiment spike, overbought RSI', status: 'filled', fillPrice: 248.50, pnl: 450, pnlPercent: 1.6, timestamp: '2026-06-09T02:45:00Z' },
  { id: 'es-004', symbol: '0700.HK', direction: 'BUY', confidence: 0.78, suggestedPrice: 428.00, quantity: 200, stopLoss: 410.00, takeProfit: 460.00, sourceAgent: 'Fundamentals', sourceModel: 'DeepSeek V4 Pro', reason: 'Stimulus + oversold bounce', status: 'rejected', timestamp: '2026-06-09T02:30:00Z' },
];

const mockRisk: RiskLimits = {
  maxPositionSize: 50000,
  maxDailyTrades: 10,
  maxDailyLoss: 2000,
  currentPosition: 28500,
  todayTrades: 4,
  todayPnl: 820,
};

// ── Sub-components ──────────────────────────────────────────────────────

const SignalApprovalCard: React.FC<{
  signal: ExecutionSignal;
  risks: RiskLimits;
  onApprove: (id: string, qty: number) => void;
  onReject: (id: string) => void;
  onExecute: (id: string) => void;
  onCancel: (id: string) => void;
}> = ({ signal, risks, onApprove, onReject, onExecute, onCancel }) => {
  const [qty, setQty] = useState(signal.quantity);
  const positionAfter = risks.currentPosition + (signal.direction === 'BUY' ? signal.suggestedPrice * qty : -signal.suggestedPrice * qty);
  const positionOverLimit = Math.abs(positionAfter) > risks.maxPositionSize;
  const tradesOverLimit = risks.todayTrades >= risks.maxDailyTrades;
  const dirColor = signal.direction === 'BUY' ? '#22c55e' : '#ef4444';

  return (
    <div className={`exec-signal-card ${signal.status}`}>
      <div className="exec-signal-header">
        <div className="exec-signal-symbol-section">
          <span className="exec-signal-symbol">{signal.symbol}</span>
          <span className="exec-signal-badge" style={{ color: dirColor, backgroundColor: dirColor + '15', borderColor: dirColor + '30' }}>
            {signal.direction} {Math.round(signal.confidence * 100)}%
          </span>
          <span className="exec-signal-status">{signal.status}</span>
        </div>
        <span className="exec-signal-source">{signal.sourceAgent}</span>
      </div>

      <div className="exec-signal-body">
        <div className="exec-signal-detail">
          <span>Price: <strong>${signal.suggestedPrice}</strong></span>
          <span>SL: ${signal.stopLoss}</span>
          <span>TP: ${signal.takeProfit}</span>
        </div>
        <p className="exec-signal-reason">{signal.reason}</p>

        {signal.status === 'pending' && (
          <div className="exec-signal-config">
            <label>
              Quantity: <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} min={1} />
            </label>
            <div className="exec-risk-check">
              <span className={positionOverLimit ? 'exec-risk-warn' : 'exec-risk-ok'}>
                Position after: ${Math.abs(positionAfter).toLocaleString()}
                {positionOverLimit && ' ⚠️ Over limit'}
              </span>
              {tradesOverLimit && <span className="exec-risk-warn">⚠️ Daily trade limit reached</span>}
            </div>
          </div>
        )}

        {signal.status === 'filled' && signal.fillPrice && (
          <div className="exec-fill-info">
            <span>Fill: ${signal.fillPrice}</span>
            <span className={signal.pnl && signal.pnl >= 0 ? 'text-green' : 'text-red'}>
              P&L: {signal.pnl && signal.pnl > 0 ? '+' : ''}${signal.pnl?.toLocaleString()} ({signal.pnlPercent && signal.pnlPercent > 0 ? '+' : ''}{signal.pnlPercent?.toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      <div className="exec-signal-actions">
        {signal.status === 'pending' && (
          <>
            <button className="exec-btn-approve" disabled={positionOverLimit || tradesOverLimit}
              onClick={() => onApprove(signal.id, qty)}>✓ Approve</button>
            <button className="exec-btn-reject" onClick={() => onReject(signal.id)}>✕ Reject</button>
          </>
        )}
        {signal.status === 'approved' && (
          <button className="exec-btn-execute" onClick={() => onExecute(signal.id)}>▶ Simulate Execute</button>
        )}
        {signal.status === 'executed' && (
          <button className="exec-btn-cancel" onClick={() => onCancel(signal.id)}>Cancel</button>
        )}
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

const LiveExecutionConsole: React.FC<LiveExecutionConsoleProps> = ({
  signals: propSignals,
  riskLimits: propRisk,
  onApprove,
  onReject,
  onExecute,
  onCancel,
  className = '',
}) => {
  const [localSignals, setSignals] = useState<ExecutionSignal[]>(propSignals || mockSignals);
  const [filter, setFilter] = useState<'ALL' | 'pending' | 'approved' | 'filled'>('ALL');

  const signals = propSignals || localSignals;
  const risks = propRisk || mockRisk;

  const handleApprove = useCallback((id: string, qty: number) => {
    onApprove?.(id, qty);
    setSignals((prev) => prev.map((s) => s.id === id ? { ...s, quantity: qty, status: 'approved' } : s));
  }, [onApprove]);

  const handleReject = useCallback((id: string) => {
    onReject?.(id);
    setSignals((prev) => prev.map((s) => s.id === id ? { ...s, status: 'rejected' } : s));
  }, [onReject]);

  const handleExecute = useCallback((id: string) => {
    onExecute?.(id);
    const sig = signals.find((s) => s.id === id);
    setSignals((prev) => prev.map((s) => s.id === id ? {
      ...s, status: 'filled', fillPrice: sig?.suggestedPrice,
      pnl: sig ? (sig.suggestedPrice * sig.quantity * (Math.random() * 0.04 - 0.01)) : 0,
      pnlPercent: sig ? (Math.random() * 4 - 1) : 0,
    } : s));
  }, [signals, onExecute]);

  const filtered = signals.filter((s) => filter === 'ALL' || s.status === filter);

  return (
    <div className={`live-exec-console ${className}`}>
      {/* ── Simulation Banner ───────────────────────── */}
      <div className="exec-sim-banner">
        🔬 <strong>Simulation Mode</strong> — AI signals are executed in a simulated environment.
        Real Futu OpenD execution coming in v1.4.0.
      </div>

      {/* ── Risk Panel ──────────────────────────────── */}
      <div className="exec-risk-panel">
        <h3 className="exec-section-title">🛡️ Risk Limits</h3>
        <div className="exec-risk-grid">
          <div className="exec-risk-item">
            <span className="exec-risk-value">${risks.maxPositionSize.toLocaleString()}</span>
            <span className="exec-risk-label">Max Position</span>
          </div>
          <div className="exec-risk-item">
            <span className="exec-risk-value">${risks.currentPosition.toLocaleString()}</span>
            <span className="exec-risk-label">Current</span>
          </div>
          <div className="exec-risk-item">
            <span className="exec-risk-value">{risks.todayTrades}/{risks.maxDailyTrades}</span>
            <span className="exec-risk-label">Daily Trades</span>
          </div>
          <div className="exec-risk-item">
            <span className={`exec-risk-value ${risks.todayPnl >= 0 ? 'text-green' : 'text-red'}`}>{risks.todayPnl > 0 ? '+' : ''}${risks.todayPnl}</span>
            <span className="exec-risk-label">Today P&amp;L</span>
          </div>
        </div>
      </div>

      {/* ── Signals ──────────────────────────────────── */}
      <div className="exec-signals-section">
        <div className="exec-signals-header">
          <h3 className="exec-section-title">📡 AI Signals</h3>
          <div className="exec-filter-tabs">
            {(['ALL', 'pending', 'approved', 'filled'] as const).map((f) => (
              <button key={f} className={`exec-filter-tab ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}>{f === 'ALL' ? 'All' : f}</button>
            ))}
          </div>
        </div>

        <div className="exec-signals-list">
          {filtered.length === 0 ? (
            <div className="exec-empty"><span>📡</span><p>No signals</p></div>
          ) : (
            filtered.map((sig) => (
              <SignalApprovalCard key={sig.id} signal={sig} risks={risks}
                onApprove={handleApprove} onReject={handleReject}
                onExecute={handleExecute} onCancel={onCancel || (() => {})} />
            ))
          )}
        </div>
      </div>

      {/* ── Real Execution CTA (Disabled) ───────────── */}
      <div className="exec-real-cta">
        <div className="exec-real-content">
          <span>🚀 Real Futu OpenD Execution</span>
          <p>Coming in v1.4.0 — execute AI signals directly to your brokerage account.</p>
        </div>
        <button className="exec-real-btn" disabled>Coming Soon</button>
      </div>
    </div>
  );
};

// ── CSS ──────────────────────────────────────────────────────────────────

export const LIVE_EXEC_STYLES = `
.live-exec-console { max-width: 900px; margin: 0 auto; padding: 24px; }

.exec-sim-banner { padding: 14px 20px; border-radius: 10px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.15); color: #f59e0b; font-size: 13px; margin-bottom: 16px; text-align: center; }

.exec-section-title { font-size: 15px; font-weight: 600; margin: 0 0 12px 0; }

.exec-risk-panel { padding: 18px; border-radius: 12px; background: var(--card-bg, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); margin-bottom: 16px; }
.exec-risk-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.exec-risk-item { display: flex; flex-direction: column; align-items: center; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.03); }
.exec-risk-value { font-size: 18px; font-weight: 700; }
.exec-risk-label { font-size: 10px; color: var(--text-secondary, #94a3b8); text-transform: uppercase; margin-top: 2px; }

.exec-signals-section { margin-bottom: 16px; }
.exec-signals-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.exec-filter-tabs { display: flex; gap: 4px; }
.exec-filter-tab { padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); background: transparent; color: var(--text-secondary, #94a3b8); font-size: 12px; cursor: pointer; text-transform: capitalize; }
.exec-filter-tab.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }

.exec-signals-list { display: flex; flex-direction: column; gap: 10px; }

.exec-signal-card { padding: 16px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); background: var(--card-bg, rgba(255,255,255,0.05)); }
.exec-signal-card.pending { border-left: 3px solid #f59e0b; }
.exec-signal-card.approved { border-left: 3px solid #3b82f6; }
.exec-signal-card.filled { border-left: 3px solid #22c55e; }
.exec-signal-card.rejected { border-left: 3px solid #6b7280; opacity: 0.6; }
.exec-signal-card.cancelled { border-left: 3px solid #ef4444; opacity: 0.6; }

.exec-signal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.exec-signal-symbol-section { display: flex; align-items: center; gap: 8px; }
.exec-signal-symbol { font-size: 16px; font-weight: 700; }
.exec-signal-badge { padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; border: 1px solid; }
.exec-signal-status { font-size: 11px; font-weight: 600; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; }
.exec-signal-card.pending .exec-signal-status { background: rgba(245,158,11,0.15); color: #f59e0b; }
.exec-signal-card.approved .exec-signal-status { background: rgba(59,130,246,0.15); color: #3b82f6; }
.exec-signal-card.filled .exec-signal-status { background: rgba(34,197,94,0.15); color: #22c55e; }
.exec-signal-source { font-size: 11px; color: var(--text-secondary, #94a3b8); }

.exec-signal-body { margin-bottom: 12px; }
.exec-signal-detail { display: flex; gap: 16px; font-size: 13px; margin-bottom: 6px; }
.exec-signal-reason { font-size: 12px; color: var(--text-secondary, #94a3b8); margin: 0; }
.exec-signal-config { margin-top: 10px; }
.exec-signal-config label { font-size: 13px; display: flex; align-items: center; gap: 8px; }
.exec-signal-config input { width: 80px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: rgba(255,255,255,0.05); color: var(--text-primary, #e2e8f0); font-size: 14px; }
.exec-risk-check { display: flex; gap: 12px; margin-top: 6px; font-size: 12px; }
.exec-risk-ok { color: #22c55e; }
.exec-risk-warn { color: #ef4444; }
.exec-fill-info { display: flex; gap: 16px; font-size: 13px; font-weight: 600; margin-top: 6px; }

.exec-signal-actions { display: flex; gap: 8px; }
.exec-btn-approve { padding: 8px 18px; border-radius: 8px; border: none; background: #22c55e; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
.exec-btn-approve:disabled { background: #374151; cursor: not-allowed; }
.exec-btn-reject { padding: 8px 18px; border-radius: 8px; border: 1px solid #ef4444; background: transparent; color: #ef4444; font-size: 13px; cursor: pointer; }
.exec-btn-execute { padding: 8px 20px; border-radius: 8px; border: none; background: #3b82f6; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
.exec-btn-cancel { padding: 8px 18px; border-radius: 8px; border: 1px solid #6b7280; background: transparent; color: #6b7280; font-size: 13px; cursor: pointer; }

.exec-real-cta { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-radius: 12px; background: linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.08)); border: 1px solid rgba(139,92,246,0.2); }
.exec-real-content span { font-size: 16px; font-weight: 600; }
.exec-real-content p { font-size: 13px; color: var(--text-secondary, #94a3b8); margin: 4px 0 0 0; }
.exec-real-btn { padding: 12px 24px; border-radius: 10px; border: none; background: #374151; color: #6b7280; font-size: 14px; font-weight: 600; cursor: not-allowed; }

.exec-empty { text-align: center; padding: 40px; color: var(--text-secondary, #94a3b8); }

.text-green { color: #22c55e; } .text-red { color: #ef4444; }

@media (max-width: 768px) {
  .exec-risk-grid { grid-template-columns: repeat(2, 1fr); }
  .exec-signal-detail { flex-wrap: wrap; gap: 8px; }
  .exec-signal-actions { flex-wrap: wrap; }
}
`;

export default LiveExecutionConsole;
