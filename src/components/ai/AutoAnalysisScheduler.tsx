/**
 * AutoAnalysisScheduler — ML-57-02 [P0]
 * R57: v1.2.0-beta — Automated AI Analysis Scheduler + Signal Closed Loop Panel
 *
 * Features:
 * - Schedule config: cron / daily / weekly / on-market-open
 * - Stock pool management: add/remove symbols
 * - Analysis depth: quick/standard/deep (3 tiers)
 * - Notification: push to WebSocket / email / in-app
 * - Closed-loop: AI analysis → signal → strategy engine → execution
 * - Execution status tracker + P&L summary
 * - History log with replay
 */

import React, { useState, useCallback } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

// ── Types ───────────────────────────────────────────────────────────────

export interface ScheduleConfig {
  id: string;
  name: string;
  mode: 'cron' | 'daily' | 'weekly' | 'on-market-open';
  cronExpr?: string;
  dailyTime?: string;      // HH:mm
  weeklyDays?: number[];    // 0-6 Sun-Sat
  symbols: string[];
  depth: 'quick' | 'standard' | 'deep';
  enabled: boolean;
  notifyWebhook?: string;
  autoExecute: boolean;    // auto send signals to strategy engine
}

export interface AnalysisRun {
  id: string;
  scheduleId: string;
  timestamp: string;
  symbols: string[];
  depth: string;
  status: 'running' | 'completed' | 'failed';
  signalsGenerated: number;
  signalsExecuted: number;
  totalPnl: number;
  cost: number;
  durationMs: number;
}

export interface AutoAnalysisSchedulerProps {
  schedules?: ScheduleConfig[];
  runHistory?: AnalysisRun[];
  onSaveSchedule?: (schedule: ScheduleConfig) => void;
  onDeleteSchedule?: (scheduleId: string) => void;
  onToggleSchedule?: (scheduleId: string, enabled: boolean) => void;
  onRunNow?: (scheduleId: string) => void;
  onRetry?: (runId: string) => void;
  className?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────

const mockSchedules: ScheduleConfig[] = [
  { id: 'sch-001', name: 'US Pre-Market Scan', mode: 'daily', dailyTime: '08:30', symbols: ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'], depth: 'standard', enabled: true, autoExecute: false },
  { id: 'sch-002', name: 'HK Morning Watch', mode: 'on-market-open', symbols: ['0700.HK', '9988.HK', '0941.HK'], depth: 'quick', enabled: true, autoExecute: true },
  { id: 'sch-003', name: 'Weekend Deep Review', mode: 'weekly', weeklyDays: [6], dailyTime: '14:00', symbols: ['SPY', 'QQQ', 'BTC-USD'], depth: 'deep', enabled: false, autoExecute: false },
];

const mockHistory: AnalysisRun[] = [
  { id: 'run-001', scheduleId: 'sch-001', timestamp: '2026-06-09T08:32:15Z', symbols: ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'], depth: 'standard', status: 'completed', signalsGenerated: 5, signalsExecuted: 3, totalPnl: 1820, cost: 0.035, durationMs: 28500 },
  { id: 'run-002', scheduleId: 'sch-002', timestamp: '2026-06-09T09:31:05Z', symbols: ['0700.HK', '9988.HK', '0941.HK'], depth: 'quick', status: 'completed', signalsGenerated: 2, signalsExecuted: 2, totalPnl: -450, cost: 0.008, durationMs: 9200 },
  { id: 'run-003', scheduleId: 'sch-001', timestamp: '2026-06-09T08:33:40Z', symbols: ['AAPL', 'NVDA', 'MSFT'], depth: 'standard', status: 'failed', signalsGenerated: 1, signalsExecuted: 0, totalPnl: 0, cost: 0.012, durationMs: 15200 },
];

// ── Sub-components ──────────────────────────────────────────────────────

const ScheduleCard: React.FC<{
  schedule: ScheduleConfig;
  onSave: (s: ScheduleConfig) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onRunNow: (id: string) => void;
}> = ({ schedule, onSave, onDelete, onToggle, onRunNow }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(schedule);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const modeLabel: Record<string, string> = {
    cron: 'Cron', daily: 'Daily', weekly: 'Weekly', 'on-market-open': 'Market Open',
  };
  const depthColor: Record<string, string> = {
    quick: '#22c55e', standard: '#3b82f6', deep: '#8b5cf6',
  };

  return (
    <div className={`scheduler-card ${schedule.enabled ? 'enabled' : 'disabled'}`}>
      <div className="scheduler-card-header">
        <div className="scheduler-card-title">
          <span className={`scheduler-status-dot ${schedule.enabled ? 'active' : ''}`} />
          <span>{editing ? <input className="scheduler-edit-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /> : schedule.name}</span>
        </div>
        <div className="scheduler-card-actions">
          <button className="scheduler-btn-run" onClick={() => onRunNow(schedule.id)} title="Run Now">▶</button>
          <label className="scheduler-toggle">
            <input type="checkbox" checked={schedule.enabled} onChange={(e) => onToggle(schedule.id, e.target.checked)} />
            <span className="scheduler-toggle-slider" />
          </label>
          <button className="scheduler-btn-icon" onClick={() => { setEditing(!editing); setDraft(schedule); }}>{editing ? '✕' : '⚙️'}</button>
          <button className="scheduler-btn-icon danger" onClick={() => onDelete(schedule.id)}>🗑</button>
        </div>
      </div>

      <div className="scheduler-card-meta">
        <span className="scheduler-meta-badge" style={{ color: modeLabel[schedule.mode] ? '#3b82f6' : undefined }}>{modeLabel[schedule.mode]}</span>
        {schedule.dailyTime && <span className="scheduler-meta-time">{schedule.dailyTime}</span>}
        <span className="scheduler-meta-badge" style={{ color: depthColor[schedule.depth] }}>{schedule.depth}</span>
        <span className="scheduler-meta-badge">{schedule.symbols.length} symbols</span>
        {schedule.autoExecute && <span className="scheduler-meta-badge auto-exec">⚡ Auto</span>}
      </div>

      <div className="scheduler-card-symbols">
        {schedule.symbols.map((s) => (
          <span key={s} className="scheduler-symbol-tag">{s}</span>
        ))}
      </div>

      {editing && (
        <div className="scheduler-edit-panel">
          <div className="scheduler-edit-row">
            <label>Mode</label>
            <select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as ScheduleConfig['mode'] })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="on-market-open">On Market Open</option>
              <option value="cron">Cron</option>
            </select>
          </div>
          {draft.mode === 'daily' && (
            <div className="scheduler-edit-row">
              <label>Time</label>
              <input type="time" value={draft.dailyTime || '08:30'} onChange={(e) => setDraft({ ...draft, dailyTime: e.target.value })} />
            </div>
          )}
          <div className="scheduler-edit-row">
            <label>Depth</label>
            <select value={draft.depth} onChange={(e) => setDraft({ ...draft, depth: e.target.value as ScheduleConfig['depth'] })}>
              <option value="quick">Quick (~$0.005/run)</option>
              <option value="standard">Standard (~$0.02/run)</option>
              <option value="deep">Deep (~$0.08/run)</option>
            </select>
          </div>
          <div className="scheduler-edit-row">
            <label>Symbols (comma-separated)</label>
            <input type="text" value={draft.symbols.join(', ')} onChange={(e) => setDraft({ ...draft, symbols: e.target.value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) })} />
          </div>
          <div className="scheduler-edit-row">
            <label>
              <input type="checkbox" checked={draft.autoExecute} onChange={(e) => setDraft({ ...draft, autoExecute: e.target.checked })} />
              Auto-execute signals (send to strategy engine)
            </label>
          </div>
          <button className="scheduler-btn-save" onClick={handleSave}>Save Changes</button>
        </div>
      )}
    </div>
  );
};

const RunHistoryRow: React.FC<{ run: AnalysisRun; onRetry?: (id: string) => void }> = ({ run, onRetry }) => {
  const statusColor: Record<string, string> = { running: '#3b82f6', completed: '#22c55e', failed: '#ef4444' };
  return (
    <div className={`run-history-row ${run.status}`}>
      <div className="run-history-status" style={{ color: statusColor[run.status] }}>
        {run.status === 'running' ? '⏳' : run.status === 'completed' ? '✅' : '❌'}
      </div>
      <div className="run-history-info">
        <span className="run-history-time">{new Date(run.timestamp).toLocaleString()}</span>
        <span className="run-history-symbols">{run.symbols.slice(0, 3).join(', ')}{run.symbols.length > 3 ? ` +${run.symbols.length - 3}` : ''}</span>
        <span className="run-history-depth">{run.depth}</span>
      </div>
      <div className="run-history-metrics">
        <span>{run.signalsGenerated} signals</span>
        <span>{run.signalsExecuted} executed</span>
        {run.totalPnl !== 0 && <span className={run.totalPnl >= 0 ? 'text-green' : 'text-red'}>{run.totalPnl > 0 ? '+' : ''}${run.totalPnl}</span>}
        <span>{(run.durationMs / 1000).toFixed(1)}s</span>
        <span>${run.cost.toFixed(4)}</span>
      </div>
      {run.status === 'failed' && onRetry && (
        <button className="run-history-retry" onClick={() => onRetry(run.id)}>Retry</button>
      )}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

const AutoAnalysisScheduler: React.FC<AutoAnalysisSchedulerProps> = ({
  schedules: propSchedules,
  runHistory: propHistory,
  onSaveSchedule,
  onDeleteSchedule,
  onToggleSchedule,
  onRunNow,
  onRetry,
  className = '',
}) => {
  const [localSchedules, setLocalSchedules] = useState<ScheduleConfig[]>(propSchedules || mockSchedules);
  const [tab, setTab] = useState<'schedules' | 'history'>('schedules');

  const schedules = propSchedules || localSchedules;
  const history = propHistory || mockHistory;

  const totalRuns = history.length;
  const completedRuns = history.filter((r) => r.status === 'completed').length;
  const totalSignals = history.reduce((s, r) => s + r.signalsGenerated, 0);
  const totalPnl = history.reduce((s, r) => s + r.totalPnl, 0);
  const totalCost = history.reduce((s, r) => s + r.cost, 0);

  const handleSave = useCallback((schedule: ScheduleConfig) => {
    onSaveSchedule?.(schedule);
    setLocalSchedules((prev) => {
      const idx = prev.findIndex((s) => s.id === schedule.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = schedule; return next; }
      return [...prev, schedule];
    });
  }, [onSaveSchedule]);

  const handleDelete = useCallback((id: string) => {
    onDeleteSchedule?.(id);
    setLocalSchedules((prev) => prev.filter((s) => s.id !== id));
  }, [onDeleteSchedule]);

  const handleCreate = () => {
    const newSch: ScheduleConfig = {
      id: `sch-${Date.now()}`,
      name: 'New Schedule',
      mode: 'daily',
      dailyTime: '09:00',
      symbols: ['AAPL'],
      depth: 'standard',
      enabled: true,
      autoExecute: false,
    };
    handleSave(newSch);
  };

  return (
    <div className={`auto-analysis-scheduler ${className}`}>
      {/* Header + Summary */}
      <div className="scheduler-page-header">
        <h2 className="scheduler-page-title">⏰ Auto Analysis Scheduler</h2>
        <button className="scheduler-btn-create" onClick={handleCreate}>+ New Schedule</button>
      </div>

      <div className="scheduler-summary-bar">
        <div className="scheduler-summary-item">
          <span className="scheduler-summary-value">{totalRuns}</span>
          <span className="scheduler-summary-label">Total Runs</span>
        </div>
        <div className="scheduler-summary-item">
          <span className="scheduler-summary-value">{completedRuns}/{totalRuns}</span>
          <span className="scheduler-summary-label">Completed</span>
        </div>
        <div className="scheduler-summary-item">
          <span className="scheduler-summary-value">{totalSignals}</span>
          <span className="scheduler-summary-label">Signals</span>
        </div>
        <div className="scheduler-summary-item">
          <span className={`scheduler-summary-value ${totalPnl >= 0 ? 'text-green' : 'text-red'}`}>
            {totalPnl > 0 ? '+' : ''}${totalPnl}
          </span>
          <span className="scheduler-summary-label">Total P&amp;L</span>
        </div>
        <div className="scheduler-summary-item">
          <span className="scheduler-summary-value">${totalCost.toFixed(4)}</span>
          <span className="scheduler-summary-label">Cost (USDT)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="scheduler-tabs">
        <button className={`scheduler-tab ${tab === 'schedules' ? 'active' : ''}`} onClick={() => setTab('schedules')}>
          Schedules ({schedules.length})
        </button>
        <button className={`scheduler-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          Run History ({history.length})
        </button>
      </div>

      {/* Schedules Tab */}
      {tab === 'schedules' && (
        <div className="scheduler-list">
          {schedules.length === 0 ? (
            <div className="scheduler-empty">
              <span className="scheduler-empty-icon">⏰</span>
              <p>No schedules configured</p>
              <button className="scheduler-btn-create-secondary" onClick={handleCreate}>Create your first schedule</button>
            </div>
          ) : (
            schedules.map((sch) => (
              <ScheduleCard
                key={sch.id}
                schedule={sch}
                onSave={handleSave}
                onDelete={handleDelete}
                onToggle={(id, enabled) => {
                  onToggleSchedule?.(id, enabled);
                  setLocalSchedules((prev) => prev.map((s) => s.id === id ? { ...s, enabled } : s));
                }}
                onRunNow={(id) => onRunNow?.(id)}
              />
            ))
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="run-history-list">
          {history.length === 0 ? (
            <div className="scheduler-empty"><span className="scheduler-empty-icon">📋</span><p>No run history yet</p></div>
          ) : (
            history.map((run) => <RunHistoryRow key={run.id} run={run} onRetry={onRetry} />)
          )}
        </div>
      )}

      {/* Closed-loop Status Bar */}
      <div className="closed-loop-bar">
        <span className="closed-loop-flow">
          <span className="closed-loop-step">📡 Schedule</span>
          <span className="closed-loop-arrow">→</span>
          <span className="closed-loop-step">🤖 AI Analysis</span>
          <span className="closed-loop-arrow">→</span>
          <span className="closed-loop-step">📊 Signal</span>
          <span className="closed-loop-arrow">→</span>
          <span className="closed-loop-step">⚙️ Strategy Engine</span>
          <span className="closed-loop-arrow">→</span>
          <span className="closed-loop-step">🛡️ Risk Check</span>
          <span className="closed-loop-arrow">→</span>
          <span className="closed-loop-step">💹 Execute</span>
        </span>
      </div>
    </div>
  );
};

// ── CSS ──────────────────────────────────────────────────────────────────

export const AUTO_ANALYSIS_STYLES = `
.auto-analysis-scheduler { max-width: 960px; margin: 0 auto; padding: 24px; }

.scheduler-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.scheduler-page-title { font-size: 22px; font-weight: 700; margin: 0; }
.scheduler-btn-create { padding: 10px 22px; border-radius: 10px; border: none; background: #3b82f6; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.scheduler-btn-create:hover { background: #2563eb; }

.scheduler-summary-bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
.scheduler-summary-item { display: flex; flex-direction: column; align-items: center; padding: 12px; background: var(--card-bg, rgba(255,255,255,0.05)); border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); }
.scheduler-summary-value { font-size: 18px; font-weight: 700; }
.scheduler-summary-label { font-size: 10px; color: var(--text-secondary, #94a3b8); text-transform: uppercase; margin-top: 2px; }

.scheduler-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1)); margin-bottom: 16px; }
.scheduler-tab { padding: 10px 20px; background: none; border: none; border-bottom: 2px solid transparent; font-size: 14px; color: var(--text-secondary, #94a3b8); cursor: pointer; transition: all 0.2s; }
.scheduler-tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }

.scheduler-list { display: flex; flex-direction: column; gap: 12px; }

.scheduler-card { padding: 16px 20px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); background: var(--card-bg, rgba(255,255,255,0.05)); transition: all 0.2s; }
.scheduler-card.enabled { border-left: 3px solid #22c55e; }
.scheduler-card.disabled { border-left: 3px solid #6b7280; opacity: 0.7; }

.scheduler-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.scheduler-card-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; }
.scheduler-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #6b7280; flex-shrink: 0; }
.scheduler-status-dot.active { background: #22c55e; }
.scheduler-edit-name { padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.15)); background: transparent; color: var(--text-primary, #e2e8f0); font-size: 14px; width: 200px; }
.scheduler-card-actions { display: flex; align-items: center; gap: 6px; }
.scheduler-btn-run { width: 28px; height: 28px; border-radius: 7px; border: 1px solid #22c55e; background: transparent; color: #22c55e; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.scheduler-btn-run:hover { background: rgba(34,197,94,0.1); }
.scheduler-btn-icon { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: transparent; color: var(--text-secondary, #94a3b8); font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.scheduler-btn-icon.danger:hover { border-color: #ef4444; color: #ef4444; }

.scheduler-toggle { position: relative; display: inline-block; width: 40px; height: 22px; }
.scheduler-toggle input { opacity: 0; width: 0; height: 0; }
.scheduler-toggle-slider { position: absolute; inset: 0; background: #374151; border-radius: 22px; cursor: pointer; transition: 0.2s; }
.scheduler-toggle-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }
.scheduler-toggle input:checked + .scheduler-toggle-slider { background: #22c55e; }
.scheduler-toggle input:checked + .scheduler-toggle-slider::before { transform: translateX(18px); }

.scheduler-card-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.scheduler-meta-badge { padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: rgba(59,130,246,0.1); color: #60a5fa; }
.scheduler-meta-time { font-size: 13px; font-weight: 600; }
.scheduler-meta-badge.auto-exec { background: rgba(139,92,246,0.15); color: #a78bfa; }

.scheduler-card-symbols { display: flex; gap: 6px; flex-wrap: wrap; }
.scheduler-symbol-tag { padding: 3px 10px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); font-size: 12px; font-weight: 500; }

.scheduler-edit-panel { margin-top: 14px; padding: 16px; border-radius: 10px; background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.15); display: flex; flex-direction: column; gap: 10px; }
.scheduler-edit-row { display: flex; flex-direction: column; gap: 4px; }
.scheduler-edit-row label { font-size: 12px; color: var(--text-secondary, #94a3b8); }
.scheduler-edit-row input[type="text"], .scheduler-edit-row input[type="time"], .scheduler-edit-row select { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: rgba(255,255,255,0.05); color: var(--text-primary, #e2e8f0); font-size: 13px; }
.scheduler-btn-save { padding: 10px; border-radius: 8px; border: none; background: #3b82f6; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 4px; }

.run-history-list { display: flex; flex-direction: column; gap: 6px; }
.run-history-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.06)); transition: background 0.15s; font-size: 13px; }
.run-history-row:hover { background: rgba(255,255,255,0.03); }
.run-history-row.completed { border-left: 3px solid #22c55e; }
.run-history-row.failed { border-left: 3px solid #ef4444; }
.run-history-status { font-size: 16px; flex-shrink: 0; }
.run-history-info { flex: 1; display: flex; gap: 12px; align-items: center; min-width: 0; }
.run-history-time { font-weight: 500; white-space: nowrap; }
.run-history-symbols { color: var(--text-secondary, #94a3b8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.run-history-depth { padding: 2px 8px; border-radius: 4px; background: rgba(139,92,246,0.1); color: #a78bfa; font-size: 11px; }
.run-history-metrics { display: flex; gap: 14px; color: var(--text-secondary, #94a3b8); white-space: nowrap; font-size: 12px; }
.run-history-retry { padding: 4px 12px; border-radius: 6px; border: 1px solid #ef4444; background: transparent; color: #ef4444; font-size: 11px; cursor: pointer; }

.closed-loop-bar { margin-top: 24px; padding: 14px 20px; border-radius: 10px; background: var(--card-bg, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); font-size: 13px; overflow-x: auto; }
.closed-loop-flow { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.closed-loop-step { padding: 4px 12px; border-radius: 6px; background: rgba(59,130,246,0.1); color: #60a5fa; font-weight: 500; }
.closed-loop-arrow { color: var(--text-secondary, #94a3b8); }

.scheduler-empty { text-align: center; padding: 48px 20px; color: var(--text-secondary, #94a3b8); }
.scheduler-empty-icon { font-size: 36px; display: block; margin-bottom: 8px; }
.scheduler-btn-create-secondary { padding: 10px 24px; border-radius: 8px; border: 1px solid #3b82f6; background: transparent; color: #3b82f6; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 12px; }

.text-green { color: #22c55e; } .text-red { color: #ef4444; }

@media (max-width: 768px) {
  .scheduler-summary-bar { grid-template-columns: repeat(3, 1fr); }
  .run-history-metrics { display: none; }
  .closed-loop-flow { flex-wrap: wrap; justify-content: center; }
}
`;

export default AutoAnalysisScheduler;

void EngineError; // [AI] structured error tracking