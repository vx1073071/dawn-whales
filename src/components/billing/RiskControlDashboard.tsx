/**
 * RiskControlDashboard — ML-60-03 [P0]
 * R60: v1.3.0 GA — Real-time risk monitoring & visualization
 *
 * Features:
 * - Position utilization gauge (0-100% with color zones)
 * - Margin ratio indicator with warning thresholds
 * - Slippage protection config display
 * - Max daily loss tracker with progress bar
 * - Circuit breaker status (active/triggered/disabled)
 * - Day trade counter vs limit
 * - Real-time P&L with auto-refresh
 * - Active alerts panel (breach warnings)
 * - Historical risk events log
 * - Risk score composite metric
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type CircuitState = 'active' | 'triggered' | 'disabled';

export interface RiskDashboardData {
  // Position
  totalAssets: number;
  marketValue: number;
  cashBalance: number;
  frozenCash: number;
  positionUtilization: number;  // 0-100
  marginRatio: number;          // 0-100

  // Daily limits
  dayPnl: number;
  dayPnlPercent: number;
  maxDailyLoss: number;
  maxDailyLossUsed: number;     // 0-100
  dayTrades: number;
  maxDailyTrades: number;
  maxPositionSize: number;

  // Slippage
  slippageTolerance: number;     // basis points
  maxSlippageCost: number;

  // Circuit breaker
  circuitState: CircuitState;
  circuitTriggerReason?: string;
  circuitTriggeredAt?: string;
  circuitCooldownMin: number;

  // Composite
  riskScore: number;             // 0-100
  riskLevel: RiskLevel;

  // Alerts
  activeAlerts: RiskAlert[];
}

export interface RiskAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface RiskEvent {
  id: string;
  type: string;
  description: string;
  severity: RiskLevel;
  value: string;
  timestamp: string;
}

export interface RiskControlDashboardProps {
  data?: RiskDashboardData;
  events?: RiskEvent[];
  onAcknowledge?: (alertId: string) => void;
  onDismissAlert?: (alertId: string) => void;
  onRefresh?: () => void;
  onResetCircuit?: () => void;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockAlerts: RiskAlert[] = [
  { id: 'al-01', level: 'warning', message: 'Position utilization approaching 45% — review allocation', timestamp: '2026-06-09T04:10:00Z', acknowledged: false },
  { id: 'al-02', level: 'info', message: 'Daily trade count 8/20 — 60% remaining', timestamp: '2026-06-09T04:01:00Z', acknowledged: true },
  { id: 'al-03', level: 'warning', message: 'NVDA slippage 12bps — above 10bps threshold', timestamp: '2026-06-09T03:55:00Z', acknowledged: false },
  { id: 'al-04', level: 'critical', message: 'Margin ratio 32% approaching 35% warning zone', timestamp: '2026-06-09T03:30:00Z', acknowledged: false },
];

const mockEvents: RiskEvent[] = [
  { id: 'ev-01', type: 'Position Limit', description: 'TSLA SELL rejected — would exceed max position', severity: 'medium', value: '$7,455 > $50,000 limit', timestamp: '2026-06-09T03:30:00Z' },
  { id: 'ev-02', type: 'Slippage Alert', description: 'NVDA fill 12bps above limit price', severity: 'low', value: '12bps (limit 10bps)', timestamp: '2026-06-09T03:55:00Z' },
  { id: 'ev-03', type: 'Circuit Check', description: 'All circuit breakers healthy — no triggers', severity: 'low', value: 'Active', timestamp: '2026-06-09T04:11:00Z' },
  { id: 'ev-04', type: 'Margin Warning', description: 'Margin ratio dropped to 32%', severity: 'medium', value: '32% (warning 35%)', timestamp: '2026-06-09T03:30:00Z' },
  { id: 'ev-05', type: 'Daily Loss', description: 'Day P&L within safe zone', severity: 'low', value: '+$820 / $50,000 max', timestamp: '2026-06-09T04:10:00Z' },
];

const mockData: RiskDashboardData = {
  totalAssets: 1760000, marketValue: 1180000, cashBalance: 580000, frozenCash: 0,
  positionUtilization: 67.0, marginRatio: 32.0,
  dayPnl: 820, dayPnlPercent: 0.05, maxDailyLoss: 50000, maxDailyLossUsed: 0,
  dayTrades: 8, maxDailyTrades: 20, maxPositionSize: 500000,
  slippageTolerance: 10, maxSlippageCost: 500,
  circuitState: 'active', circuitCooldownMin: 30,
  riskScore: 38, riskLevel: 'low',
  activeAlerts: mockAlerts,
};

// ── Helpers ─────────────────────────────────────────────────────────────

const levelColor: Record<string, string> = {
  low: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  critical: 'text-red-600 bg-red-50 border-red-200',
};

const alertLevelBg: Record<string, string> = {
  info: 'bg-blue-50 border-blue-200', warning: 'bg-amber-50 border-amber-200', critical: 'bg-red-50 border-red-200',
};

const circuitColor: Record<CircuitState, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  triggered: 'bg-red-100 text-red-700 border-red-300 animate-pulse',
  disabled: 'bg-gray-100 text-gray-500 border-gray-300',
};

// ── Circular Gauge ──────────────────────────────────────────────────────

const CircularGauge: React.FC<{ value: number; max: number; label: string; unit: string; size?: number }> = ({
  value, max, label, unit, size = 110,
}) => {
  const pct = Math.min(value / max * 100, 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const gaugeColor = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981';

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size * 0.75} viewBox="0 0 100 70">
        <circle cx="50" cy="55" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle cx="50" cy="55" r={radius} fill="none" stroke={gaugeColor} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 55)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        <text x="50" y="52" textAnchor="middle" className="text-lg font-bold" fill="#1e293b">{value}</text>
        <text x="50" y="66" textAnchor="middle" className="text-[9px]" fill="#94a3b8">{unit}</text>
      </svg>
      <span className="text-[10px] font-semibold text-slate-500 mt-1">{label}</span>
    </div>
  );
};

// ── Progress Bar ────────────────────────────────────────────────────────

const ProgressBar: React.FC<{
  value: number; max: number; label: string; colorClass?: string; showPct?: boolean; warningPct?: number; dangerPct?: number;
}> = ({ value, max, label, colorClass = 'bg-emerald-500', showPct = true, warningPct = 70, dangerPct = 90 }) => {
  const pct = Math.min(value / max * 100, 100);
  const barColor = pct >= dangerPct ? 'bg-red-500' : pct >= warningPct ? 'bg-amber-500' : colorClass;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-slate-500 font-medium">{label}</span>
        {showPct && <span className={`text-[10px] font-bold ${pct >= dangerPct ? 'text-red-600' : pct >= warningPct ? 'text-amber-600' : 'text-slate-600'}`}>{pct.toFixed(1)}%</span>}
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ── Risk Control Dashboard ──────────────────────────────────────────────

const RiskControlDashboard: React.FC<RiskControlDashboardProps> = ({
  data: inputData,
  events: inputEvents,
  onAcknowledge,
  onDismissAlert,
  onRefresh,
  onResetCircuit,
  className = '',
}) => {
  const [data] = useState<RiskDashboardData>(inputData ?? mockData);
  const [events] = useState<RiskEvent[]>(inputEvents ?? mockEvents);
  const [alerts, setAlerts] = useState<RiskAlert[]>(inputData?.activeAlerts ?? mockAlerts);
  const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleTimeString());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-refresh
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setLastRefresh(new Date().toLocaleTimeString());
      onRefresh?.();
    }, 8000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [onRefresh]);

  const handleRefresh = useCallback(() => {
    setLastRefresh(new Date().toLocaleTimeString());
    onRefresh?.();
  }, [onRefresh]);

  const handleAcknowledge = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    onAcknowledge?.(id);
  }, [onAcknowledge]);

  const handleDismiss = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    onDismissAlert?.(id);
  }, [onDismissAlert]);

  return (
    <div className={`risk-control-dashboard ${className}`}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-800">🛡 Risk Control Dashboard</h2>
          <span className="text-[10px] text-slate-400">Updated {lastRefresh}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ── Top Row: Gauges ── */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {/* Risk Score */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center">
          <span className="text-[10px] text-slate-400 font-semibold mb-2">RISK SCORE</span>
          <div className="relative w-24 h-24 mb-2">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#riskGradient)" strokeWidth="10"
                strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * (1 - data.riskScore / 100)}
                strokeLinecap="round" />
              <defs>
                <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-800">{data.riskScore}</span>
              <span className="text-[10px] text-slate-400">/100</span>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${levelColor[data.riskLevel]}`}>
            {data.riskLevel.toUpperCase()}
          </span>
        </div>

        {/* Position Utilization */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center">
          <CircularGauge value={data.positionUtilization} max={100} label="Position Util" unit="%" />
        </div>

        {/* Margin Ratio */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center">
          <CircularGauge value={data.marginRatio} max={100} label="Margin Ratio" unit="%" />
        </div>

        {/* Circuit Breaker */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <span className="text-[10px] text-slate-400 font-semibold">CIRCUIT BREAKER</span>
          <div className="flex flex-col items-center mt-2">
            <span className={`text-sm font-bold px-4 py-2 rounded-full border-2 mt-1 ${circuitColor[data.circuitState]}`}>
              {data.circuitState === 'active' ? '🟢 ACTIVE' : data.circuitState === 'triggered' ? '🔴 TRIGGERED' : '⚫ DISABLED'}
            </span>
            {data.circuitTriggerReason && (
              <p className="text-[10px] text-red-500 mt-2 text-center">{data.circuitTriggerReason}</p>
            )}
            {data.circuitState === 'triggered' && onResetCircuit && (
              <button onClick={onResetCircuit} className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 mt-2 px-3 py-1 bg-blue-50 rounded-lg transition-colors">
                Reset Circuit
              </button>
            )}
            <span className="text-[10px] text-slate-400 mt-2">Cooldown: {data.circuitCooldownMin} min</span>
          </div>
        </div>
      </div>

      {/* ── Limits Row ── */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-3">📊 Position Limits</h3>
          <ProgressBar value={data.marketValue} max={data.totalAssets} label="Market Value / Total" warningPct={50} dangerPct={80} />
          <ProgressBar value={data.positionUtilization} max={100} label="Position Utilization" colorClass="bg-blue-500" warningPct={60} dangerPct={80} />
          <ProgressBar value={data.marginRatio} max={100} label="Margin Ratio" colorClass="bg-purple-500" warningPct={35} dangerPct={50} />
          <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
            <div>
              <span className="text-slate-400">Cash</span>
              <div className="font-bold text-slate-700">${data.cashBalance.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-slate-400">Frozen</span>
              <div className="font-bold text-slate-700">${data.frozenCash.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-3">📉 Daily Limits</h3>
          <ProgressBar value={data.dayTrades} max={data.maxDailyTrades} label="Day Trades" colorClass="bg-cyan-500" warningPct={70} dangerPct={90} />
          <ProgressBar value={Math.abs(data.dayPnl < 0 ? -data.dayPnl : 0)} max={data.maxDailyLoss} label="Daily Loss Used" colorClass="bg-red-500" showPct={false} />
          <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
            <div>
              <span className="text-slate-400">Day P&L</span>
              <div className={`font-bold ${data.dayPnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {data.dayPnl >= 0 ? '+' : ''}${data.dayPnl.toLocaleString()} ({data.dayPnlPercent >= 0 ? '+' : ''}{data.dayPnlPercent.toFixed(2)}%)
              </div>
            </div>
            <div>
              <span className="text-slate-400">Max Single Position</span>
              <div className="font-bold text-slate-700">${data.maxPositionSize.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slippage + Active Alerts ── */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Slippage Panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-3">📏 Slippage Protection</h3>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-500">Tolerance</span>
            <span className="text-xs font-bold text-slate-700">{data.slippageTolerance} bps</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
            <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400" style={{ width: `${Math.min(data.slippageTolerance / 50 * 100, 100)}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-3">
            <span>0 bps</span><span>25 bps</span><span>50 bps</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-400">Max Cost / Trade</span>
            <span className="font-bold text-slate-700">${data.maxSlippageCost.toLocaleString()}</span>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-3">🔔 Active Alerts ({alerts.length})</h3>
          <div className="space-y-2 max-h-[140px] overflow-y-auto">
            {alerts.map(alert => (
              <div key={alert.id} className={`rounded-lg border px-3 py-2 flex items-start justify-between ${alertLevelBg[alert.level]} ${alert.acknowledged ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold uppercase ${
                      alert.level === 'critical' ? 'text-red-600' : alert.level === 'warning' ? 'text-amber-600' : 'text-blue-600'
                    }`}>
                      {alert.level}
                    </span>
                    {!alert.acknowledged && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                  </div>
                  <p className="text-xs text-slate-700">{alert.message}</p>
                  <span className="text-[9px] text-slate-400">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="flex gap-1 ml-2">
                  {!alert.acknowledged && (
                    <button onClick={() => handleAcknowledge(alert.id)} className="text-[10px] text-blue-500 hover:text-blue-600 font-medium">
                      ✓
                    </button>
                  )}
                  <button onClick={() => handleDismiss(alert.id)} className="text-[10px] text-slate-400 hover:text-red-500">
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">✅ No active alerts</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Risk Events Log ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-700 mb-3">📜 Risk Events Log</h3>
        <div className="space-y-2 max-h-[180px] overflow-y-auto">
          {events.map(event => (
            <div key={event.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${levelColor[event.severity]}`}>
                  {event.severity.toUpperCase()}
                </span>
                <div>
                  <div className="text-xs font-semibold text-slate-700">{event.type}</div>
                  <div className="text-[10px] text-slate-400">{event.description}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-slate-700">{event.value}</div>
                <div className="text-[9px] text-slate-400">{new Date(event.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RiskControlDashboard;
