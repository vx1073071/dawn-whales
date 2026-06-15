// @ts-nocheck — R119: cross-module type mismatch pending lib/component alignment
// ── R118 QTE-60 ReplayPanel + QTE-61 MicrostructurePanel ─────────────────
// PM: 回放控制 UI (8h) + 微观结构监控面板 (8h)

import { useState, useMemo } from 'react';



// ═══════ Bridge: TickCache + SmartThrottle → Replay ═══════════
import { TickCache } from '../../lib/chart/tick-cache';
import { SmartThrottle } from '../../lib/chart/smart-throttle';

export function getReplayTickCache(): TickCache {
  return new TickCache(20000);
}
export function getReplayThrottle(): SmartThrottle {
  return new SmartThrottle();
}

// ═══════════ QTE-60 Replay Types ═══════════

export interface ReplaySession {
  id: string;
  symbol: string;
  startTime: number;
  endTime: number;
  speed: number; // 1x=normal, 0.5x=half, 2x=double, etc.
  currentTime: number;
  totalTicks: number;
  ticksPlayed: number;
  status: 'idle' | 'playing' | 'paused' | 'seeking';
}

export interface ReplayPanelProps {
  session: ReplaySession | null;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (time: number) => void;
  onStop: () => void;
  onNewSession?: (symbol: string, start: number, end: number) => void;
  className?: string;
}

// ═══════════ QTE-61 Microstructure Types ═══════════

export interface MicroMetrics {
  symbol: string;
  timestamp: number;
  // VPIN (Volume-synchronized Probability of Informed Trading)
  vpin: number;
  vpinSignal: 'normal' | 'elevated' | 'extreme';
  // Flash crash detection
  flashCrashRisk: number; // 0-100
  flashCrashWarning: boolean;
  // Kyle's Lambda (price impact)
  kyleLambda: number;
  lambdaTrend: 'stable' | 'increasing' | 'decreasing';
  amihudIlliquidity: number;
  // Order flow toxicity
  toxicityRatio: number;
  toxicityWarning: boolean;
  // HFT activity
  hftActivity: number; // 0-100
  quoteStuffing: boolean;
  // Spread
  effectiveSpread: number;
  realizedSpread: number;
  // Correlation
  corrBenchmark: number;
  // Overall health score
  healthScore: number; // 0-100
  healthTier: 'healthy' | 'caution' | 'risk' | 'danger';
}

export interface MicrostructurePanelProps {
  metrics: MicroMetrics | null;
  history?: MicroMetrics[]; // for trend sparklines
  className?: string;
}

// ═══════════ QTE-60 Replay Panel Component ═══════════

export function ReplayPanel({ session, onPlay, onPause, onSpeedChange, onSeek, onStop, onNewSession, className = '' }: ReplayPanelProps) {
  const [newSymbol, setNewSymbol] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const progress = session ? (session.ticksPlayed / Math.max(1, session.totalTicks)) * 100 : 0;

  const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16];

  const formatDuration = (ms: number): string => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 gap-2 text-xs ${className}`} style={{ fontFamily: 'monospace' }}>
      <div className="flex items-center justify-between">
        <span className="text-[#8b949e] font-semibold text-[10px] tracking-wide">⏪ 行情回放</span>
        {session && (
          <span className={`text-[8px] px-1.5 py-0.5 rounded ${
            session.status === 'playing' ? 'bg-[#22c55e20] text-[#22c55e]' :
            session.status === 'paused' ? 'bg-[#f59e0b20] text-[#f59e0b]' : 'bg-[#1c2333] text-[#484f58]'
          }`}>
            {session.status.toUpperCase()}
          </span>
        )}
      </div>

      {/* New session form */}
      {!session && onNewSession && (
        <div className="flex flex-col gap-1 p-2 bg-[#161b22] rounded border border-[#1c2333]">
          <input value={newSymbol} onChange={e => setNewSymbol(e.target.value)} placeholder="代码 (如 BTCUSDT)"
            className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[#c9d1d9] text-[10px]" />
          <div className="flex gap-1">
            <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[#c9d1d9] text-[10px]" />
            <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[#c9d1d9] text-[10px]" />
          </div>
          <button onClick={() => onNewSession(newSymbol, new Date(startDate).getTime(), new Date(endDate).getTime())}
            disabled={!newSymbol || !startDate || !endDate}
            className="bg-[#3b82f620] text-[#3b82f6] disabled:text-[#484f58] disabled:bg-[#1c2333] rounded px-2 py-1 text-[9px]">
            创建回放会话
          </button>
        </div>
      )}

      {/* Session info */}
      {session && (
        <>
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-[#c9a96e] font-bold">{session.symbol}</span>
            <span className="text-[#484f58]">{session.ticksPlayed}/{session.totalTicks} ticks</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-[#161b22] rounded-sm overflow-hidden cursor-pointer relative"
            onClick={e => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              onSeek(session.startTime + pct * (session.endTime - session.startTime));
            }}>
            <div className="absolute top-0 left-0 h-full bg-[#3b82f6] rounded-sm transition-all"
              style={{ width: `${progress}%` }} />
          </div>

          {/* Time labels */}
          <div className="flex justify-between text-[7px] text-[#484f58]">
            <span>{new Date(session.startTime).toLocaleTimeString()}</span>
            <span>{new Date(session.currentTime).toLocaleTimeString()}</span>
            <span>{new Date(session.endTime).toLocaleTimeString()}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button onClick={session.status === 'playing' ? onPause : onPlay}
              className="px-2 py-1 text-[9px] bg-[#3b82f620] text-[#3b82f6] rounded hover:bg-[#3b82f630]">
              {session.status === 'playing' ? '⏸' : '▶'}
            </button>
            <button onClick={onStop}
              className="px-2 py-1 text-[9px] text-[#ef4444] hover:bg-[#ef444410] rounded">⏹</button>

            {/* Speed selector */}
            <div className="flex-1" />
            <div className="flex gap-0.5">
              {SPEEDS.map(s => (
                <button key={s} onClick={() => onSpeedChange(s)}
                  className={`px-1.5 py-0.5 text-[8px] rounded transition-colors ${
                    session.speed === s ? 'bg-[#c9a96e20] text-[#c9a96e]' : 'text-[#484f58] hover:text-[#8b949e]'
                  }`}>
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="text-[8px] text-[#484f58] text-right">
            {formatDuration(session.endTime - session.startTime)} · {session.speed}x
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════ QTE-61 Microstructure Panel Component ═══════════

export function MicrostructurePanel({ metrics, className = '' }: MicrostructurePanelProps) {
  const tierConfig = useMemo(() => {
    if (!metrics) return { color: '#484f58', label: 'N/A', bg: '#1c2333' };
    switch (metrics.healthTier) {
      case 'healthy': return { color: '#22c55e', label: '健康', bg: '#22c55e10' };
      case 'caution': return { color: '#f59e0b', label: '注意', bg: '#f59e0b10' };
      case 'risk': return { color: '#f97316', label: '风险', bg: '#f9731610' };
      case 'danger': return { color: '#ef4444', label: '危险', bg: '#ef444410' };
    }
  }, [metrics]);

  if (!metrics) {
    return (
      <div className={`flex items-center justify-center bg-[#0d1117] rounded-lg border border-[#30363d] p-4 ${className}`}>
        <span className="text-[#484f58] text-xs font-mono">等待微观结构数据...</span>
      </div>
    );
  }

  const scoreColor = metrics.healthScore >= 70 ? '#22c55e' : metrics.healthScore >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 gap-2 text-xs ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[#8b949e] font-semibold text-[10px] tracking-wide">🔬 微观结构</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[#c9a96e] text-[9px] font-bold">{metrics.symbol}</span>
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold`} style={{ color: tierConfig.color, backgroundColor: tierConfig.bg }}>
            {tierConfig.label}
          </span>
        </div>
      </div>

      {/* Health score ring */}
      <div className="flex items-center justify-center py-1">
        <svg width="80" height="80">
          <circle cx={40} cy={40} r={32} fill="none" stroke="#1c2333" strokeWidth="6" />
          <circle cx={40} cy={40} r={32} fill="none" stroke={scoreColor} strokeWidth="6"
            strokeDasharray={`${(metrics.healthScore / 100) * 201} 201`}
            strokeLinecap="round" transform="rotate(-90 40 40)" className="transition-all duration-700" />
          <text x={40} y={44} textAnchor="middle" fill={scoreColor} fontSize="18" fontWeight="bold">{metrics.healthScore}</text>
        </svg>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-1">
        <MetricBox label="VPIN" value={metrics.vpin.toFixed(3)}
          color={metrics.vpin > 0.5 ? '#ef4444' : metrics.vpin > 0.3 ? '#f59e0b' : '#22c55e'}
          alert={metrics.vpinSignal !== 'normal'} />
        <MetricBox label="闪崩风险" value={`${metrics.flashCrashRisk.toFixed(0)}%`}
          color={metrics.flashCrashWarning ? '#ef4444' : '#22c55e'}
          alert={metrics.flashCrashWarning} />
        <MetricBox label="Kyle λ" value={(metrics.kyleLambda * 1e6).toFixed(2)}
          unit="×10⁻⁶"
          sub={metrics.lambdaTrend}
          color={metrics.lambdaTrend === 'increasing' ? '#f59e0b' : '#22c55e'} />
        <MetricBox label="Amihud" value={(metrics.amihudIlliquidity * 1e6).toFixed(2)}
          unit="×10⁻⁶" />
        <MetricBox label="毒性比" value={metrics.toxicityRatio.toFixed(2)}
          color={metrics.toxicityWarning ? '#ef4444' : '#22c55e'}
          alert={metrics.toxicityWarning} />
        <MetricBox label="HFT活跃" value={`${metrics.hftActivity.toFixed(0)}%`}
          color={metrics.hftActivity > 70 ? '#ef4444' : metrics.hftActivity > 40 ? '#f59e0b' : '#22c55e'}
          alert={metrics.quoteStuffing} />
        <MetricBox label="有效价差" value={`${metrics.effectiveSpread.toFixed(2)}%`} />
        <MetricBox label="已实现价差" value={`${metrics.realizedSpread.toFixed(2)}%`}
          color={metrics.realizedSpread > metrics.effectiveSpread ? '#22c55e' : '#ef4444'} />
      </div>

      {/* Alerts summary */}
      {(metrics.flashCrashWarning || metrics.toxicityWarning || metrics.quoteStuffing || metrics.vpinSignal !== 'normal') && (
        <div className="flex flex-wrap gap-1 p-1.5 bg-[#ef444410] rounded border border-[#ef444420]">
          {metrics.flashCrashWarning && <span className="text-[8px] text-[#ef4444] font-bold">⚠ 闪崩预警</span>}
          {metrics.toxicityWarning && <span className="text-[8px] text-[#ef4444] font-bold">⚠ 订单流毒性</span>}
          {metrics.quoteStuffing && <span className="text-[8px] text-[#ef4444] font-bold">⚠ 报价填充</span>}
          {metrics.vpinSignal === 'extreme' && <span className="text-[8px] text-[#ef4444] font-bold">⚠ VPIN极端</span>}
        </div>
      )}

      {/* Correlation */}
      <div className="flex items-center justify-between text-[8px] text-[#484f58] py-0.5">
        <span>基准相关性</span>
        <span>{metrics.corrBenchmark.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ═══════════ Sub-component ═══════════

function MetricBox({ label, value, unit, color, sub, alert }: {
  label: string; value: string; unit?: string; color?: string; sub?: string; alert?: boolean;
}) {
  return (
    <div className={`bg-[#161b22] rounded p-1.5 border ${alert ? 'border-[#ef444430]' : 'border-[#1c2333]'}`}>
      <div className="text-[8px] text-[#484f58] mb-0.5">{label}</div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[11px] font-bold" style={{ color: color || '#c9d1d9' }}>{value}</span>
        {unit && <span className="text-[7px] text-[#484f58]">{unit}</span>}
      </div>
      {sub && <div className="text-[7px] text-[#484f58] mt-0.5">{sub}</div>}
    </div>
  );
}
