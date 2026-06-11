/**
 * SignalPerformancePanel — ML-66-03 [P1]
 * R66: v1.6.0 GA — Signal performance dashboard with backtest results
 *
 * Features:
 * - Signal win rate gauge + Sharpe ratio + max drawdown
 * - Profit curve chart (sparkline + detailed)
 * - Signal history timeline with expandable details
 * - Backtest comparison: signal vs benchmark
 * - Quality grade (A+ ~ F) color-coded
 * - Signal calendar heatmap
 */

import { useState, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import i18n from '../../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

export type SignalGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface SignalRecord {
  id: string;
  symbol: string;
  market: 'HK' | 'US' | 'CN';
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  entryDate: string;
  exitDate?: string;
  pnl?: number;          // %
  result?: 'WIN' | 'LOSS' | 'PENDING';
  confidence: number;
  reason: string;
  agent: string;
}

export interface SignalPerformance {
  totalSignals: number;
  closedSignals: number;
  winRate: number;         // %
  avgReturn: number;       // %
  avgWin: number;          // %
  avgLoss: number;         // %
  sharpeRatio: number;
  maxDrawdown: number;     // %
  profitFactor: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  bestTrade: number;       // %
  worstTrade: number;      // %
  grade: SignalGrade;
  equityCurve: number[];   // cumulative %
  monthlyReturns: { month: string; return_: number; signals: number; winRate: number }[];
  signals: SignalRecord[];
}

export interface SignalPerformancePanelProps {
  performance?: SignalPerformance;
  creatorId?: string;
  creatorName?: string;
  className?: string;
}

// ── Grade Config ────────────────────────────────────────────────────────

const GRADE_COLORS: Record<SignalGrade, { color: string; bg: string; border: string }> = {
  'A+': { color: '#22C55E', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  'A':  { color: '#4ADE80', bg: 'bg-green-400/10', border: 'border-green-400/30' },
  'B':  { color: '#FACC15', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  'C':  { color: '#FB923C', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
  'D':  { color: '#F87171', bg: 'bg-red-400/10', border: 'border-red-400/30' },
  'F':  { color: '#EF4444', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

function computeGrade(winRate: number, sharpe: number, maxDD: number): SignalGrade {
  const score = winRate * 0.5 + Math.min(sharpe, 3) / 3 * 30 + (1 - Math.min(maxDD / 50, 1)) * 20;
  if (score >= 90) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockSignals: SignalRecord[] = [
  { id: 'sig-001', symbol: 'AAPL', market: 'US', direction: 'BUY', entryPrice: 195.2, exitPrice: 202.5, entryDate: '2026-06-07', exitDate: '2026-06-08', pnl: 3.74, result: 'WIN', confidence: 0.88, reason: i18n.t('SignalPerformancePanel.k1'), agent: 'Fundamentals' },
  { id: 'sig-002', symbol: 'TSLA', market: 'US', direction: 'SELL', entryPrice: 248.0, exitPrice: 252.3, entryDate: '2026-06-06', exitDate: '2026-06-07', pnl: -1.73, result: 'LOSS', confidence: 0.72, reason: i18n.t('SignalPerformancePanel.k2'), agent: 'Technical' },
  { id: 'sig-003', symbol: 'NVDA', market: 'US', direction: 'BUY', entryPrice: 142.5, exitPrice: 151.8, entryDate: '2026-06-05', exitDate: '2026-06-06', pnl: 6.53, result: 'WIN', confidence: 0.91, reason: i18n.t('SignalPerformancePanel.k3'), agent: 'Sentiment' },
  { id: 'sig-004', symbol: 'HK.00700', market: 'HK', direction: 'BUY', entryPrice: 420.0, exitPrice: 438.5, entryDate: '2026-06-04', exitDate: '2026-06-05', pnl: 4.40, result: 'WIN', confidence: 0.85, reason: i18n.t('SignalPerformancePanel.k4'), agent: 'Fundamentals' },
  { id: 'sig-005', symbol: 'MSFT', market: 'US', direction: 'SELL', entryPrice: 478.0, exitPrice: 465.2, entryDate: '2026-06-03', exitDate: '2026-06-04', pnl: 2.68, result: 'WIN', confidence: 0.79, reason: i18n.t('SignalPerformancePanel.k5'), agent: 'Technical' },
  { id: 'sig-006', symbol: 'SH.600519', market: 'CN', direction: 'BUY', entryPrice: 1680.0, exitPrice: 1645.0, entryDate: '2026-06-02', exitDate: '2026-06-04', pnl: -2.08, result: 'LOSS', confidence: 0.65, reason: i18n.t('SignalPerformancePanel.k6'), agent: 'Macro' },
  { id: 'sig-007', symbol: 'GOOGL', market: 'US', direction: 'BUY', entryPrice: 195.0, exitPrice: 201.2, entryDate: '2026-06-01', exitDate: '2026-06-02', pnl: 3.18, result: 'WIN', confidence: 0.83, reason: i18n.t('SignalPerformancePanel.k7'), agent: 'Sentiment' },
  { id: 'sig-008', symbol: 'META', market: 'US', direction: 'BUY', entryPrice: 632.0, exitPrice: 648.5, entryDate: '2026-05-30', exitDate: '2026-06-01', pnl: 2.61, result: 'WIN', confidence: 0.77, reason: i18n.t('SignalPerformancePanel.k8'), agent: 'Fundamentals' },
  { id: 'sig-009', symbol: 'HK.09988', market: 'HK', direction: 'BUY', entryPrice: 125.0, entryDate: '2026-06-08', result: 'PENDING', confidence: 0.74, reason: i18n.t('SignalPerformancePanel.k9'), agent: 'Fundamentals' },
  { id: 'sig-010', symbol: 'AMD', market: 'US', direction: 'SELL', entryPrice: 185.0, exitPrice: 178.5, entryDate: '2026-05-29', exitDate: '2026-05-30', pnl: 3.51, result: 'WIN', confidence: 0.81, reason: i18n.t('SignalPerformancePanel.k10'), agent: 'Technical' },
  { id: 'sig-011', symbol: 'TSM', market: 'US', direction: 'BUY', entryPrice: 168.0, exitPrice: 163.4, entryDate: '2026-05-28', exitDate: '2026-05-29', pnl: -2.74, result: 'LOSS', confidence: 0.70, reason: i18n.t('SignalPerformancePanel.k11'), agent: 'Macro' },
  { id: 'sig-012', symbol: 'SH.000858', market: 'CN', direction: 'BUY', entryPrice: 198.0, exitPrice: 208.5, entryDate: '2026-05-27', exitDate: '2026-05-28', pnl: 5.30, result: 'WIN', confidence: 0.87, reason: i18n.t('SignalPerformancePanel.k12'), agent: 'Fundamentals' },
];

const mockPerformance: SignalPerformance = {
  totalSignals: 847,
  closedSignals: 756,
  winRate: 68.2,
  avgReturn: 1.85,
  avgWin: 4.12,
  avgLoss: -2.95,
  sharpeRatio: 2.1,
  maxDrawdown: 12.5,
  profitFactor: 1.85,
  consecutiveWins: 8,
  consecutiveLosses: 3,
  bestTrade: 18.5,
  worstTrade: -9.8,
  grade: 'A',
  equityCurve: [0, 0.5, 1.8, 2.1, -0.3, 1.5, 4.2, 5.1, 4.0, 5.8, 8.2, 7.1, 6.5, 9.2, 11.5, 10.8, 12.3, 14.1, 13.2, 15.8, 16.5, 14.2, 17.0, 18.2, 20.1, 19.5, 22.3, 24.0, 23.5, 25.8],
  monthlyReturns: [
    { month: '2026-01', return_: 3.2, signals: 68, winRate: 65.2 },
    { month: '2026-02', return_: -1.5, signals: 72, winRate: 58.3 },
    { month: '2026-03', return_: 5.1, signals: 81, winRate: 72.1 },
    { month: '2026-04', return_: 2.8, signals: 74, winRate: 64.5 },
    { month: '2026-05', return_: 4.2, signals: 85, winRate: 70.8 },
    { month: '2026-06', return_: 2.5, signals: 42, winRate: 78.6 },
  ],
  signals: mockSignals,
};

// ── Gauge ────────────────────────────────────────────────────────────────

function Gauge({ value, label, max, unit, colorRanges }: {
  value: number; label: string; max: number; unit: string;
  colorRanges: { min: number; max: number; color: string }[];
}) {
  const { t: _t } = useTranslation();

  const pct = Math.min(100, (value / max) * 100);
  const activeRange = colorRanges.find((r) => value >= r.min && value <= r.max);
  const color = activeRange?.color ?? '#6B7280';

  // SVG arc from 180° to 0° (semi-circle)
  const radius = 40;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="60" viewBox="0 0 100 50" className="-mb-1">
        <path d="M10,45 A40,40 0 0,1 90,45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
        <path d="M10,45 A40,40 0 0,1 90,45" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="text-xl font-bold -mt-6" style={{ color }}>{value}{unit}</div>
      <div className="text-[10px] text-gray-600">{label}</div>
    </div>
  );
}

// ── Equity Curve Chart ──────────────────────────────────────────────────

function EquityCurve({ data, height = 120 }: { data: number[]; height?: number }) {
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const range = max - min || 1;
  const w = 100;
  const h = 100;

  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  const area = `${points} ${100},105 ${0},105`;

  const isUp = data[data.length - 1] >= 0;

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`eq-grad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? '#22C55E' : '#EF4444'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isUp ? '#22C55E' : '#EF4444'} stopOpacity="0" />
          </linearGradient>
        </defs>
        {min < 0 && (
          <line x1="0" y1={h * 0.5} x2={w} y2={h * 0.5} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
        )}
        <polygon points={area} fill={`url(#eq-grad)`} />
        <polyline points={points} fill="none" stroke={isUp ? '#22C55E' : '#EF4444'} strokeWidth="2"
                  vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

// ── Heatmap ─────────────────────────────────────────────────────────────

function SignalHeatmap({ returns }: { returns: { month: string; return_: number; signals: number; winRate: number }[] }) {
  const absMax = Math.max(...returns.map((r) => Math.abs(r.return_)), 1);
  return (
    <div className="flex flex-wrap gap-1">
      {returns.map((r) => {
        const intensity = Math.abs(r.return_) / absMax;
        const bg = r.return_ >= 0
          ? `rgba(34,197,94,${0.1 + intensity * 0.7})`
          : `rgba(239,68,68,${0.1 + intensity * 0.7})`;
        return (
          <div key={r.month} className="p-2 rounded-md text-center min-w-[70px]" style={{ background: bg }}>
            <div className="text-[9px] text-gray-500">{r.month.slice(5)}月</div>
            <div className={`text-xs font-bold ${r.return_ >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {r.return_ >= 0 ? '+' : ''}{r.return_}%
            </div>
            <div className="text-[9px] text-gray-600">
              {r.signals}信号 | {r.winRate}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function SignalPerformancePanel({
  performance: propPerf,
  creatorId: _creatorId,
  creatorName,
  className = '',
}: SignalPerformancePanelProps) {
  const perf = propPerf ?? mockPerformance;
  const grade = perf.grade ?? computeGrade(perf.winRate, perf.sharpeRatio, perf.maxDrawdown);
  const gradeCfg = GRADE_COLORS[grade];
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);
  const [signalFilter, setSignalFilter] = useState<'all' | 'WIN' | 'LOSS' | 'PENDING'>('all');

  const filteredSignals = useMemo(() => {
    if (signalFilter === 'all') return perf.signals;
    return perf.signals.filter((s) => s.result === signalFilter);
  }, [perf.signals, signalFilter]);

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{i18n.t('SignalPerformancePanel.k0')}</h2>
            {creatorName && <p className="text-gray-500 text-xs mt-0.5">{creatorName} 的信号表现分析</p>}
          </div>
          {/* Grade Badge */}
          <div className={`px-4 py-2 rounded-xl border ${gradeCfg.border} ${gradeCfg.bg} flex items-center gap-2`}>
            <span className="text-xs text-gray-500">{i18n.t('SignalPerformancePanel.k1')}</span>
            <span className="text-2xl font-bold" style={{ color: gradeCfg.color }}>{grade}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* ── Top Stats ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4 text-center">
            <div className="text-[10px] text-gray-600 mb-1">{i18n.t('SignalPerformancePanel.k2')}</div>
            <div className="text-xl font-bold text-gray-200">{perf.totalSignals}</div>
            <div className="text-[10px] text-gray-600">{perf.closedSignals} 已平仓</div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4 text-center">
            <div className="text-[10px] text-gray-600 mb-1">{"components.profitLossRatio"}</div>
            <div className={`text-xl font-bold ${perf.profitFactor >= 1.5 ? 'text-green-400' : perf.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
              {perf.profitFactor.toFixed(2)}
            </div>
            <div className="text-[10px] text-gray-600">{i18n.t('SignalPerformancePanel.k3')}</div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4 text-center">
            <div className="text-[10px] text-gray-600 mb-1">{i18n.t('SignalPerformancePanel.k4')}</div>
            <div className="text-xl font-bold text-green-400">{perf.consecutiveWins}</div>
            <div className="text-[10px] text-gray-600">{i18n.t('SignalPerformancePanel.k5')}</div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4 text-center">
            <div className="text-[10px] text-gray-600 mb-1">{i18n.t('SignalPerformancePanel.k6')}</div>
            <div className={`text-xl font-bold ${perf.consecutiveLosses <= 3 ? 'text-green-400' : 'text-red-400'}`}>
              {perf.consecutiveLosses}
            </div>
            <div className="text-[10px] text-gray-600">{i18n.t('SignalPerformancePanel.k7')}</div>
          </div>
        </div>

        {/* ── Gauges Row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4 flex flex-col items-center">
            <Gauge value={perf.winRate}  label={"components.winRate"} max={100} unit="%"
                   colorRanges={[{ min: 0, max: 40, color: '#EF4444' }, { min: 40, max: 55, color: '#F97316' }, { min: 55, max: 70, color: '#FACC15' }, { min: 70, max: 100, color: '#22C55E' }]} />
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4 flex flex-col items-center">
            <Gauge value={perf.sharpeRatio} label={i18n.t('SignalPerformancePanel.k13')} max={4} unit=""
                   colorRanges={[{ min: -10, max: 0.5, color: '#EF4444' }, { min: 0.5, max: 1.5, color: '#FACC15' }, { min: 1.5, max: 2.5, color: '#22C55E' }, { min: 2.5, max: 10, color: '#3B82F6' }]} />
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4 flex flex-col items-center">
            <Gauge value={perf.maxDrawdown}  label={"components.maxDrawdown"} max={50} unit="%"
                   colorRanges={[{ min: 0, max: 10, color: '#22C55E' }, { min: 10, max: 20, color: '#FACC15' }, { min: 20, max: 30, color: '#F97316' }, { min: 30, max: 100, color: '#EF4444' }]} />
          </div>
        </div>

        {/* ── Trade Stats ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4">
            <div className="text-[10px] text-gray-600">{i18n.t('SignalPerformancePanel.k8')}</div>
            <div className={`text-lg font-bold ${perf.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {perf.avgReturn >= 0 ? '+' : ''}{perf.avgReturn}%
            </div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4">
            <div className="text-[10px] text-gray-600">{i18n.t('SignalPerformancePanel.k9')}</div>
            <div className="text-lg font-bold text-green-400">+{perf.avgWin}%</div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4">
            <div className="text-[10px] text-gray-600">{i18n.t('SignalPerformancePanel.k10')}</div>
            <div className="text-lg font-bold text-red-400">{perf.avgLoss}%</div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4">
            <div className="text-[10px] text-gray-600">{i18n.t('SignalPerformancePanel.k11')}</div>
            <div className="text-xs">
              <span className="text-green-400 font-bold">+{perf.bestTrade}%</span>
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-red-400 font-bold">{perf.worstTrade}%</span>
            </div>
          </div>
        </div>

        {/* ── Equity Curve ──────────────────────────────────────────────── */}
        <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
          <h3 className="text-gray-300 font-semibold text-sm mb-3">📈 累计收益曲线</h3>
          <EquityCurve data={perf.equityCurve} height={140} />
          <div className="flex justify-between mt-2 text-[10px] text-gray-600">
            <span>30日</span>
            <span className={perf.equityCurve[perf.equityCurve.length - 1] >= 0 ? 'text-green-400' : 'text-red-400'}>
              {perf.equityCurve[perf.equityCurve.length - 1] >= 0 ? '+' : ''}{perf.equityCurve[perf.equityCurve.length - 1].toFixed(1)}%
            </span>
          </div>
        </div>

        {/* ── Monthly Heatmap ───────────────────────────────────────────── */}
        <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
          <h3 className="text-gray-300 font-semibold text-sm mb-3">📅 月度表现热力图</h3>
          <SignalHeatmap returns={perf.monthlyReturns} />
        </div>

        {/* ── Signal History ────────────────────────────────────────────── */}
        <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-gray-300 font-semibold text-sm">🔔 信号历史</h3>
            <div className="flex gap-1">
              {(['all', 'WIN', 'LOSS', 'PENDING'] as const).map((f) => (
                <button key={f} onClick={() => setSignalFilter(f)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${signalFilter === f ? 'bg-white/[0.06] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {f === 'all' ? 'components.all' : f === 'WIN' ? i18n.t('SignalPerformancePanel.k14') : f === 'LOSS' ? i18n.t('SignalPerformancePanel.k15') : i18n.t('SignalPerformancePanel.k16')}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
            {filteredSignals.map((sig) => {
              const isExpanded = expandedSignal === sig.id;
              return (
                <div key={sig.id}>
                  <div onClick={() => setExpandedSignal(isExpanded ? null : sig.id)}
                       className={`px-5 py-3 flex items-center gap-4 cursor-pointer transition-colors ${isExpanded ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}>
                    {/* Result icon */}
                    <span className="text-sm flex-shrink-0">
                      {sig.result === 'WIN' ? '✅' : sig.result === 'LOSS' ? '❌' : '⏳'}
                    </span>
                    {/* Symbol */}
                    <div className="w-20 flex-shrink-0">
                      <span className="text-sm text-gray-200 font-medium">{sig.symbol}</span>
                      <span className="text-[10px] text-gray-600 ml-1">{sig.market}</span>
                    </div>
                    {/* Direction */}
                    <span className={`text-xs font-semibold w-10 flex-shrink-0 ${sig.direction === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                      {sig.direction === 'BUY' ? 'components.long' : 'components.short'}
                    </span>
                    {/* Price */}
                    <div className="text-xs text-gray-400 w-24 flex-shrink-0">
                      {sig.entryPrice}
                      {sig.exitPrice && <span className="text-gray-600"> → {sig.exitPrice}</span>}
                    </div>
                    {/* Date */}
                    <div className="text-xs text-gray-600 flex-1">
                      {sig.entryDate}
                      {sig.exitDate && <span className="text-gray-700"> → {sig.exitDate}</span>}
                    </div>
                    {/* PnL */}
                    <div className={`text-sm font-mono font-semibold w-20 text-right flex-shrink-0 ${sig.pnl !== undefined ? (sig.pnl >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-600'}`}>
                      {sig.pnl !== undefined ? `${sig.pnl >= 0 ? '+' : ''}${sig.pnl.toFixed(2)}%` : '—'}
                    </div>
                    {/* Expand */}
                    <span className="text-gray-600 text-xs">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                  {isExpanded && (
                    <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">{i18n.t('SignalPerformancePanel.k12')}</span>
                          <span className="text-gray-300">{(sig.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500">{i18n.t('SignalPerformancePanel.k13')}</span>
                          <span className="text-gray-300">{sig.agent}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        <span className="text-gray-500">{i18n.t('SignalPerformancePanel.k14')}</span>
                        {sig.reason}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredSignals.length === 0 && (
              <div className="p-10 text-center text-gray-600 text-sm">
                暂无{signalFilter === 'WIN' ? i18n.t('SignalPerformancePanel.k17') : signalFilter === 'LOSS' ? i18n.t('SignalPerformancePanel.k18') : 'components.positions'}信号
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
