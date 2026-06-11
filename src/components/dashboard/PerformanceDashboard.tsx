// PerformanceDashboard — Portfolio & Strategy performance visualization
// UIM-33-01: Sharpe/Sortino/Calmar/ProfitFactor dashboard
// R33, 10-lobster architecture

import { useState, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import i18n from '../../i18n';

interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  volatility: number;
  bestMonth: { month: string; return: number };
  worstMonth: { month: string; return: number };
  consecutiveWins: number;
  consecutiveLosses: number;
}

interface Props {
  metrics?: PerformanceMetrics;
  equityCurve?: { date: string; value: number }[];
  monthlyReturns?: { month: string; return: number }[];
  drawdownCurve?: { date: string; drawdown: number }[];
  strategyName?: string;
}

function generateMockMetrics(): PerformanceMetrics {
  return {
    totalReturn: 23.45,
    annualizedReturn: 18.72,
    sharpe: 1.85,
    sortino: 2.41,
    calmar: 1.62,
    maxDrawdown: -11.56,
    winRate: 58.3,
    profitFactor: 1.94,
    avgWin: 3.24,
    avgLoss: -1.87,
    totalTrades: 247,
    winningTrades: 144,
    losingTrades: 103,
    volatility: 12.8,
    bestMonth: { month: '2025-03', return: 8.45 },
    worstMonth: { month: '2025-09', return: -5.67 },
    consecutiveWins: 8,
    consecutiveLosses: 4,
  };
}

function generateMockEquityCurve(): { date: string; value: number }[] {
  const data: { date: string; value: number }[] = [];
  let value = 100000;
  for (let i = 0; i < 252; i++) {
    const date = new Date(2025, 0, 1);
    date.setDate(date.getDate() + i);
    value += value * (Math.random() - 0.48) * 0.02;
    data.push({ date: date.toISOString().split('T')[0], value: +value.toFixed(2) });
  }
  return data;
}

export default function PerformanceDashboard({
  metrics: externalMetrics,
  equityCurve: externalEquity,
  monthlyReturns: _externalMonthly,
  drawdownCurve: _externalDD,
  strategyName = 'Portfolio',
}: Props) {
  const { t } = useTranslation();

  const metrics = useMemo(() => externalMetrics || generateMockMetrics(), [externalMetrics]);
  const equityCurve = useMemo(() => externalEquity || generateMockEquityCurve(), [externalEquity]);

  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y');
  const [selectedMetric, setSelectedMetric] = useState<'sharpe' | 'sortino' | 'calmar' | 'drawdown'>('sharpe');

  const formatPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  const formatNum = (v: number) => v.toFixed(2);

  // Simple sparkline from equity curve
  const sparkline = useMemo(() => {
    const values = equityCurve.map(p => p.value);
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const height = 40;
    const width = 200;
    const step = width / (values.length - 1);
    const points = values.map((v, i) => {
      const x = +(i * step).toFixed(1);
      const y = +((1 - (v - min) / range) * height).toFixed(1);
      return `${x},${y}`;
    });
    return points.join(' ');
  }, [equityCurve]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{i18n.t('PerformanceDashboard.k0')}</h2>
          <p className="text-xs text-gray-500 mt-1">{strategyName} · {metrics.totalTrades}笔交易</p>
        </div>
        <div className="flex gap-2">
          {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-[#D4A853]/20 text-[#D4A853]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label={i18n.t('PerformanceDashboard.k1')} value={formatPct(metrics.totalReturn)} color={metrics.totalReturn >= 0 ? 'green' : 'red'} subtitle={i18n.t('PerformanceDashboard.k2')} />
        <MetricCard label={i18n.t('PerformanceDashboard.k3')} value={formatPct(metrics.annualizedReturn)} color={metrics.annualizedReturn >= 0 ? 'green' : 'red'} subtitle={t("components.annualized")} />
        <MetricCard label={i18n.t('PerformanceDashboard.k4')} value={formatPct(metrics.maxDrawdown)} color="red" subtitle={i18n.t('PerformanceDashboard.k5')} />
        <MetricCard label={i18n.t('PerformanceDashboard.k6')} value={`${metrics.winRate.toFixed(1)}%`} color={metrics.winRate > 50 ? 'green' : 'yellow'} subtitle={`${metrics.winningTrades}W / ${metrics.losingTrades}L`} />
      </div>

      {/* Risk-Adjusted Metrics */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label={i18n.t('PerformanceDashboard.k7')} value={formatNum(metrics.sharpe)} color={metrics.sharpe > 1 ? 'green' : metrics.sharpe > 0.5 ? 'yellow' : 'red'} subtitle="Sharpe" highlight={selectedMetric === 'sharpe'} onClick={() => setSelectedMetric('sharpe')} />
        <MetricCard label={i18n.t('PerformanceDashboard.k8')} value={formatNum(metrics.sortino)} color={metrics.sortino > 1.5 ? 'green' : metrics.sortino > 0.8 ? 'yellow' : 'red'} subtitle="Sortino" highlight={selectedMetric === 'sortino'} onClick={() => setSelectedMetric('sortino')} />
        <MetricCard label={i18n.t('PerformanceDashboard.k9')} value={formatNum(metrics.calmar)} color={metrics.calmar > 1 ? 'green' : metrics.calmar > 0.5 ? 'yellow' : 'red'} subtitle="Calmar" highlight={selectedMetric === 'calmar'} onClick={() => setSelectedMetric('calmar')} />
        <MetricCard label={i18n.t('PerformanceDashboard.k10')} value={formatNum(metrics.profitFactor)} color={metrics.profitFactor > 1.5 ? 'green' : metrics.profitFactor > 1 ? 'yellow' : 'red'} subtitle="Profit Factor" />
      </div>

      {/* Equity Curve (sparkline) */}
      <div className="bg-[#12121a] rounded-xl p-4 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">{i18n.t('PerformanceDashboard.k1')}</span>
          <span className={`text-xs font-mono ${metrics.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPct(metrics.totalReturn)}
          </span>
        </div>
        <svg viewBox="0 0 200 40" className="w-full" preserveAspectRatio="none">
          {/* Grid */}
          <line x1="0" y1="40" x2="200" y2="40" stroke="#1a1a2e" strokeWidth="0.5" />
          <line x1="0" y1="20" x2="200" y2="20" stroke="#1a1a2e" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="0" x2="200" y2="0" stroke="#1a1a2e" strokeWidth="0.5" />
          {/* Line */}
          {sparkline && (
            <polyline
              points={sparkline}
              fill="none"
              stroke={metrics.totalReturn >= 0 ? '#4ade80' : '#f87171'}
              strokeWidth="1.5"
            />
          )}
        </svg>
      </div>

      {/* Trade Stats and Details */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#12121a] rounded-xl p-4 border border-white/5">
          <h3 className="text-sm text-gray-400 mb-3">{i18n.t('PerformanceDashboard.k2')}</h3>
          <div className="space-y-2">
            <StatRow label={i18n.t('PerformanceDashboard.k11')} value={String(metrics.totalTrades)} />
            <StatRow label={i18n.t('PerformanceDashboard.k12')} value={String(metrics.winningTrades)} color="green" />
            <StatRow label={i18n.t('PerformanceDashboard.k13')} value={String(metrics.losingTrades)} color="red" />
            <StatRow label={i18n.t('PerformanceDashboard.k14')} value={formatPct(metrics.avgWin)} color="green" />
            <StatRow label={i18n.t('PerformanceDashboard.k15')} value={formatPct(metrics.avgLoss)} color="red" />
            <StatRow label={i18n.t('PerformanceDashboard.k16')} value={`${metrics.consecutiveWins}${i18n.t('PerformanceDashboard.k0')}`} color="green" />
            <StatRow label={i18n.t('PerformanceDashboard.k17')} value={`${metrics.consecutiveLosses}${i18n.t('PerformanceDashboard.k1')}`} color="red" />
          </div>
        </div>

        <div className="bg-[#12121a] rounded-xl p-4 border border-white/5">
          <h3 className="text-sm text-gray-400 mb-3">{i18n.t('PerformanceDashboard.k3')}</h3>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">{i18n.t('PerformanceDashboard.k4')}</div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-mono">{metrics.bestMonth.month}</span>
                <span className="text-sm text-green-400 font-mono font-bold">{formatPct(metrics.bestMonth.return)}</span>
              </div>
              {/* Mini bar */}
              <div className="mt-1 bg-[#0a0a12] rounded-full h-1.5 overflow-hidden">
                <div className="bg-green-500 h-full rounded-full" style={{ width: `${Math.min(100, (metrics.bestMonth.return / 10) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{i18n.t('PerformanceDashboard.k5')}</div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-mono">{metrics.worstMonth.month}</span>
                <span className="text-sm text-red-400 font-mono font-bold">{formatPct(metrics.worstMonth.return)}</span>
              </div>
              <div className="mt-1 bg-[#0a0a12] rounded-full h-1.5 overflow-hidden">
                <div className="bg-red-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.abs(metrics.worstMonth.return) / 10 * 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="text-xs text-gray-500 mb-2">{t("components.volatility")}</div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-mono font-bold text-white">{metrics.volatility.toFixed(1)}%</span>
              <span className="text-xs text-gray-500">{t("components.annualized")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk metric explanation */}
      <div className="bg-[#12121a] rounded-xl p-4 border border-white/5 text-xs text-gray-500">
        <p>
          {selectedMetric === 'sharpe' && i18n.t('PerformanceDashboard.k18')}
          {selectedMetric === 'sortino' && i18n.t('PerformanceDashboard.k19')}
          {selectedMetric === 'calmar' && i18n.t('PerformanceDashboard.k20')}
          {selectedMetric === 'drawdown' && `${i18n.t('PerformanceDashboard.k2')}${formatPct(metrics.maxDrawdown)}${i18n.t('PerformanceDashboard.k3')}`}
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function MetricCard({
  label, value, color, subtitle, highlight, onClick,
}: {
  label: string; value: string; color: 'green' | 'red' | 'yellow';
  subtitle: string; highlight?: boolean; onClick?: () => void;
}) {
  const colorMap = { green: 'text-green-400', red: 'text-red-400', yellow: 'text-yellow-400' };
  return (
    <div
      className={`bg-[#12121a] rounded-xl p-3 border ${highlight ? 'border-[#D4A853]/50' : 'border-white/5'} ${onClick ? 'cursor-pointer hover:border-white/10' : ''}`}
      onClick={onClick}
    >
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-mono font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-[10px] text-gray-600 mt-0.5">{subtitle}</div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' }) {
  const colorMap = { green: 'text-green-400', red: 'text-red-400' };
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-mono ${color ? colorMap[color] : 'text-gray-300'}`}>{value}</span>
    </div>
  );
}
