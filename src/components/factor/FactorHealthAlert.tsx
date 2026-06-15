// ── R188 ML P4-01: FactorHealthAlert — 四维健康预警 ─────────────────
// Monitors factor health across 4 dimensions:
// 1. IC Trend (rising/falling/flat with half-life countdown)
// 2. Crowding (% of active strategies using this factor)
// 3. Correlation (with dominant factors, risk of redundancy)
// 4. Stability (IC volatility, how erratic the signal is)
//
// Design:
// - 4 mini gauge cards in a horizontal row
// - Traffic-light color coding (green/yellow/red/gray)
// - Countdown to IC decay (e.g. "IC drops below 0.03 in 32 days")
// - Click to expand detailed chart + recommendations
// - Dark theme, compact layout

import React, { useState, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type HealthLevel = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface HealthDimension {
  key: 'ic_trend' | 'crowding' | 'correlation' | 'stability';
  label: string;
  icon: string;
  value: number;          // normalized 0-100
  level: HealthLevel;
  detail: string;          // human-readable explanation
  recommendation: string;
}

interface FactorHealthAlertProps {
  factorName: string;
  factorId: string;
  dimensions: HealthDimension[];
  /** Overall health score 0-100 */
  overallScore: number;
  /** Days until IC expected to drop below significance */
  icDecayDays?: number;
  className?: string;
}

// ── Health level config ──────────────────────────────────────────────────────

const HEALTH_CONFIG: Record<HealthLevel, {
  label: string; emoji: string; color: string; bgColor: string;
  borderColor: string; pulse: boolean;
}> = {
  healthy: { label: '健康', emoji: '🟢', color: '#22c55e', bgColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)', pulse: false },
  warning: { label: '预警', emoji: '🟡', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)', pulse: true },
  critical: { label: '危险', emoji: '🔴', color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', pulse: true },
  unknown: { label: '未知', emoji: '⚪', color: '#6b7280', bgColor: 'rgba(107,114,128,0.05)', borderColor: 'rgba(107,114,128,0.2)', pulse: false },
};

// ── Mini gauge ───────────────────────────────────────────────────────────────

const MiniGauge: React.FC<{
  dim: HealthDimension;
  expanded: boolean;
  onToggle: () => void;
}> = ({ dim, expanded, onToggle }) => {
  const cfg = HEALTH_CONFIG[dim.level];

  return (
    <div
      onClick={onToggle}
      className="rounded-lg border p-3 cursor-pointer transition-all hover:border-white/10"
      style={{ backgroundColor: cfg.bgColor, borderColor: cfg.borderColor }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500">{dim.icon} {dim.label}</span>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${cfg.pulse ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: cfg.color + '15', color: cfg.color }}
        >
          {cfg.emoji} {cfg.label}
        </span>
      </div>

      {/* Gauge bar */}
      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden mb-1">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${dim.value}%`,
            backgroundColor: dim.value >= 70 ? '#22c55e' : dim.value >= 40 ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>

      {/* Value + scale */}
      <div className="flex justify-between text-[9px]">
        <span className="font-mono font-bold text-white">{dim.value.toFixed(0)}/100</span>
        <span className="text-gray-700">
          {dim.value >= 70 ? '优' : dim.value >= 40 ? '可' : '差'}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-white/5 text-[9px] space-y-1">
          <p className="text-gray-400 leading-relaxed">{dim.detail}</p>
          <p className="text-[#D4A853]/80">{dim.recommendation}</p>
        </div>
      )}
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const FactorHealthAlert: React.FC<FactorHealthAlertProps> = ({
  factorName,
  factorId,
  dimensions,
  overallScore,
  icDecayDays,
  className = '',
}) => {
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const overallLevel: HealthLevel = useMemo(() => {
    if (overallScore >= 70) return 'healthy';
    if (overallScore >= 40) return 'warning';
    if (overallScore >= 10) return 'critical';
    return 'unknown';
  }, [overallScore]);

  const cfg = HEALTH_CONFIG[overallLevel];

  // Count issues
  const issuesCount = dimensions.filter(d => d.level === 'critical' || d.level === 'warning').length;

  return (
    <div className={`rounded-xl border p-4 ${className}`}
      style={{ backgroundColor: cfg.bgColor + '40', borderColor: cfg.borderColor }}>
      {/* Overall header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{factorName}</span>
          <span className="text-[10px] text-gray-600 font-mono">{factorId}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Overall score badge */}
          <div className="flex items-center gap-1.5">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={cfg.color} strokeWidth="3"
                  strokeDasharray={`${(overallScore / 100) * 88} 88`} strokeLinecap="round"
                  className="transition-all duration-700" />
              </svg>
              <span className="text-[11px] font-bold text-white z-10">{overallScore}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.emoji} {cfg.label}</span>
              {issuesCount > 0 && <div className="text-[8px] text-gray-600">{issuesCount}项需关注</div>}
            </div>
          </div>
        </div>
      </div>

      {/* IC decay countdown */}
      {icDecayDays !== undefined && icDecayDays > 0 && icDecayDays <= 90 && (
        <div className={`mb-3 p-2 rounded-lg text-[10px] ${
          icDecayDays <= 15 ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
          icDecayDays <= 30 ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400' :
          'bg-white/[0.03] border border-white/5 text-gray-400'
        }`}>
          ⏰ IC衰退倒计时: 预计 <strong>{icDecayDays}天</strong> 后IC降至0.03以下
          {icDecayDays <= 15 && ' — 建议立即优化参数或替换因子'}
        </div>
      )}

      {/* 4 dimension gauges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {dimensions.map(dim => (
          <MiniGauge
            key={dim.key}
            dim={dim}
            expanded={expandedDim === dim.key}
            onToggle={() => setExpandedDim(expandedDim === dim.key ? null : dim.key)}
          />
        ))}
      </div>

      {/* Composite recommendations */}
      {showAll && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2 text-[10px]">
          {dimensions.filter(d => d.level === 'critical').map(d => (
            <div key={d.key} className="flex items-start gap-2 p-2 rounded bg-red-500/5 border border-red-500/10">
              <span>🔴</span>
              <div>
                <span className="text-red-400 font-bold">{d.label}: </span>
                <span className="text-gray-400">{d.recommendation}</span>
              </div>
            </div>
          ))}
          {dimensions.filter(d => d.level === 'warning').map(d => (
            <div key={d.key} className="flex items-start gap-2 p-2 rounded bg-yellow-500/5 border border-yellow-500/10">
              <span>🟡</span>
              <div>
                <span className="text-yellow-400 font-bold">{d.label}: </span>
                <span className="text-gray-400">{d.recommendation}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toggle all */}
      <button
        onClick={() => setShowAll(!showAll)}
        className="text-[10px] text-gray-600 hover:text-gray-400"
      >
        {showAll ? '收起建议' : '查看所有建议 →'}
      </button>
    </div>
  );
};

// ── Health computation helper ────────────────────────────────────────────────

export function computeDimensions(params: {
  ic: number; icTrend: number; crowdingPct: number;
  corrWithDominant: number; icStdDev: number; halfLifeDays?: number;
}): { dimensions: HealthDimension[]; overallScore: number; icDecayDays?: number } {
  const { ic, icTrend, crowdingPct, corrWithDominant, icStdDev, halfLifeDays } = params;

  // 1. IC Trend
  const icTrendScore = Math.min(100, Math.max(0, 50 + icTrend * 50));
  const icTrendLevel: HealthLevel = icTrend > 0.5 ? 'healthy' : icTrend > 0 ? 'warning' : 'critical';
  const icTrendDetail = icTrend > 0.5
    ? `IC趋势上升 (+${(icTrend*100).toFixed(0)}%/月)，信号在增强`
    : icTrend > 0
    ? `IC趋势微弱上升 (+${(icTrend*100).toFixed(0)}%/月)，需持续观察`
    : `IC趋势下降 (${(icTrend*100).toFixed(0)}%/月)，信号在衰减`;

  // 2. Crowding
  const crowdingScore = Math.max(0, 100 - crowdingPct);
  const crowdingLevel: HealthLevel = crowdingPct < 30 ? 'healthy' : crowdingPct < 60 ? 'warning' : 'critical';
  const crowdingDetail = crowdingPct < 30
    ? `拥挤度低 (${crowdingPct}%)，Alpha空间充足`
    : crowdingPct < 60
    ? `拥挤度中等 (${crowdingPct}%)，需关注Alpha衰减`
    : `拥挤度过高 (${crowdingPct}%)，Alpha已被大量套利`;

  // 3. Correlation
  const corrScore = Math.max(0, 100 - corrWithDominant * 100);
  const corrLevel: HealthLevel = corrWithDominant < 0.3 ? 'healthy' : corrWithDominant < 0.6 ? 'warning' : 'critical';
  const corrDetail = corrWithDominant < 0.3
    ? `与主流因子相关性低 (${(corrWithDominant*100).toFixed(0)}%)，独立性强`
    : corrWithDominant < 0.6
    ? `与主流因子中度相关 (${(corrWithDominant*100).toFixed(0)}%)`
    : `与主流因子高度重叠 (${(corrWithDominant*100).toFixed(0)}%)，同质化严重`;

  // 4. Stability
  const stabilityScore = Math.max(0, Math.min(100, 100 - icStdDev * 200));
  const stabilityLevel: HealthLevel = icStdDev < 0.02 ? 'healthy' : icStdDev < 0.05 ? 'warning' : 'critical';
  const stabilityDetail = icStdDev < 0.02
    ? `IC波动小 (std=${icStdDev.toFixed(3)})，信号非常稳定`
    : icStdDev < 0.05
    ? `IC波动中等 (std=${icStdDev.toFixed(3)})`
    : `IC波动大 (std=${icStdDev.toFixed(3)})，信号不可靠`;

  const dimensions: HealthDimension[] = [
    { key: 'ic_trend', label: 'IC趋势', icon: '📈', value: icTrendScore, level: icTrendLevel, detail: icTrendDetail, recommendation: icTrend > 0 ? '保持当前参数，继续监控' : '建议回调参数或考虑替换因子' },
    { key: 'crowding', label: '拥挤度', icon: '👥', value: crowdingScore, level: crowdingLevel, detail: crowdingDetail, recommendation: crowdingPct < 30 ? '当前拥挤度安全' : '考虑降低因子权重，分散到低相关因子' },
    { key: 'correlation', label: '独立性', icon: '🔗', value: corrScore, level: corrLevel, detail: corrDetail, recommendation: corrWithDominant < 0.6 ? '独立性良好' : '建议搭配低相关因子(BAB/低波)对冲' },
    { key: 'stability', label: '稳定性', icon: '🔒', value: stabilityScore, level: stabilityLevel, detail: stabilityDetail, recommendation: icStdDev < 0.05 ? '信号可靠' : '建议增加数据窗口或使用均值平滑' },
  ];

  const overallScore = Math.round((icTrendScore + crowdingScore + corrScore + stabilityScore) / 4);

  return {
    dimensions,
    overallScore,
    icDecayDays: halfLifeDays ? Math.round(halfLifeDays * 0.7) : undefined,
  };
}

export default FactorHealthAlert;
