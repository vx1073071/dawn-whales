// ── R191 ML P7-01: DeepDiagnosisPanel — 深度因子诊断 (1U/次) ────────
// Full factor diagnosis with 5-dimension radar chart + IC decay trend +
// crowding analysis + optimization recommendations.
// Revenue: 1 USDT per diagnosis (basic signal light is free).
//
// Design:
// - Top: 5-dim radar chart (IC/IR/Stability/Crowding/Decay)
// - Middle: IC decay trend sparkline (12 months)
// - Bottom: AI-powered optimization recommendations
// - Paywall: free preview shows 3 items, 1U unlocks full results
// - Dark theme with professional/academic feel

import React, { useState, useMemo } from 'react';
import { FactorSignalLight, computeSignalColor } from './FactorSignalLight';
import { FactorCrowdingAlert, generateDemoCrowdingData } from './FactorCrowdingAlert';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DiagnosisData {
  factorId: string;
  factorName: string;
  category: string;
  ic: number;
  ir: number;            // Information Ratio
  stability: number;      // 0-100
  crowding: number;       // 0-100
  decayRate: number;      // IC decay/month
  sharpRatio: number;
  maxDrawdown: number;
  winRate: number;
  halfLifeMonths: number;
  icHistory: number[];    // 12-month IC values
  optimizationTips: string[];
  riskSummary: string;
  recommendation: string;
}

interface DeepDiagnosisPanelProps {
  data: DiagnosisData;
  /** User USDT balance for paywall */
  userBalance?: number;
  /** Called when user wants to purchase full diagnosis */
  onPurchaseDiagnosis?: (factorId: string) => void;
  /** If false, show paywall. True = full result shown */
  unlocked?: boolean;
  className?: string;
}

// ── Simple radar chart (CSS-based) ───────────────────────────────────────────

const RadarChart: React.FC<{
  dimensions: Array<{ key: string; label: string; value: number; max: number }>;
  size?: number;
}> = ({ dimensions, size = 180 }) => {
  const center = size / 2;
  const radius = (size / 2) - 20;
  const angleStep = (2 * Math.PI) / dimensions.length;

  const points = dimensions.map((d, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (d.value / d.max) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  });

  const gridPoints = [0.25, 0.5, 0.75, 1].map(frac =>
    dimensions.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = frac * radius;
      return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
    })
  );

  const labelPoints = dimensions.map((_, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = radius + 14;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  });

  const dataPolygon = points.map(p => `${p.x},${p.y}`).join(' ');
  const fillColor = 'rgba(212,168,83,0.2)';
  const strokeColor = '#D4A853';

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid */}
        {gridPoints.map((gp, gi) => (
          <polygon key={gi} points={gp.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        ))}
        {/* Axes */}
        {dimensions.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const ex = center + radius * Math.cos(angle);
          const ey = center + radius * Math.sin(angle);
          return <line key={i} x1={center} y1={center} x2={ex} y2={ey} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />;
        })}
        {/* Data polygon */}
        <polygon points={dataPolygon} fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={strokeColor} />
        ))}
        {/* Labels */}
        {labelPoints.map((lp, i) => {
          const d = dimensions[i];
          return (
            <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
              fill={d.value / d.max >= 0.7 ? '#D4A853' : '#6b7280'} fontSize="9">
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

// ── IC trend sparkline ───────────────────────────────────────────────────────

const ICTrendLine: React.FC<{ data: number[]; decay: number }> = ({ data, decay }) => {
  if (data.length === 0) return null;
  const w = 200; const h = 40;
  const max = Math.max(...data, 0.06);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');

  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h} className="flex-shrink-0">
        <polyline points={points} fill="none" stroke={decay > 0 ? '#ef4444' : '#22c55e'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {data.map((v, i) => (
          <circle key={i} cx={(i / (data.length - 1)) * w} cy={h - ((v - min) / range) * h} r="2"
            fill={decay > 0 ? '#ef4444' : '#22c55e'} />
        ))}
        {/* Threshold line at 0.03 */}
        <line x1="0" y1={h - ((0.03 - min) / range) * h} x2={w} y2={h - ((0.03 - min) / range) * h}
          stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="3,3" />
        <text x={w - 18} y={h - ((0.03 - min) / range) * h - 3} fill="rgba(255,255,255,0.3)" fontSize="7">0.03</text>
      </svg>
      <div className="text-[9px] flex-shrink-0">
        <div className={decay > 0 ? 'text-red-400' : 'text-green-400'}>
          {decay > 0 ? '↘ 衰减' : '↗ 上升'}
        </div>
        <div className="text-gray-600">{Math.abs(decay * 1000).toFixed(1)}/月</div>
      </div>
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const DeepDiagnosisPanel: React.FC<DeepDiagnosisPanelProps> = ({
  data,
  userBalance,
  onPurchaseDiagnosis,
  unlocked = false,
  className = '',
}) => {
  const signal = computeSignalColor({ ic: data.ic, winRate: data.winRate });

  const radarDims = [
    { key: 'ic', label: 'IC', value: data.ic * 1000, max: 80 },
    { key: 'ir', label: 'IR', value: data.ir * 100, max: 150 },
    { key: 'stability', label: '稳定性', value: data.stability, max: 100 },
    { key: 'crowding', label: '不拥挤', value: 100 - data.crowding, max: 100 },
    { key: 'decay', label: '抗衰', value: Math.max(0, 100 - data.decayRate * 2000), max: 100 },
  ];

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{data.factorName}</span>
          <span className="text-[10px] text-gray-600 font-mono">{data.factorId}</span>
          <FactorSignalLight data={signal} />
        </div>
        <span className="text-[9px] text-gray-700 bg-white/[0.03] px-1.5 py-0.5 rounded">深度诊断</span>
      </div>

      {/* Radar + Key stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <RadarChart dimensions={radarDims} size={180} />
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {[
            ['IC (信息系数)', data.ic.toFixed(3), data.ic >= 0.03],
            ['IR (信息比)', data.ir.toFixed(2), data.ir >= 0.5],
            ['Sharpe', data.sharpRatio.toFixed(2), data.sharpRatio >= 0.5],
            ['胜率', `${data.winRate}%`, data.winRate >= 50],
            ['Max Drawdown', `-${data.maxDrawdown}%`, data.maxDrawdown <= 25],
            ['半衰期', `${data.halfLifeMonths}月`, data.halfLifeMonths >= 12],
            ['拥挤度', `${data.crowding}%`, data.crowding <= 50],
            ['衰减速率', `${(data.decayRate * 1000).toFixed(1)}/月`, data.decayRate <= 0.002],
          ].map(([label, val, pass]) => (
            <div key={label as string} className="flex justify-between p-1.5 rounded bg-white/[0.02]">
              <span className="text-gray-500">{label}</span>
              <span className={`font-mono ${pass ? 'text-green-400' : 'text-red-400'}`}>
                {pass ? '✓ ' : '✗ '}{val as string}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* IC trend */}
      <div className="mb-4 p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <div className="text-[10px] text-gray-500 mb-2">12月IC趋势</div>
        <ICTrendLine data={data.icHistory} decay={data.decayRate} />
      </div>

      {/* Optimization tips (blurred if not unlocked) */}
      <div className={`relative mb-4 ${!unlocked ? 'select-none' : ''}`}>
        <h4 className="text-[10px] text-gray-500 mb-2">AI优化建议</h4>
        <div className={`space-y-2 ${!unlocked ? 'blur-sm' : ''}`}>
          {data.optimizationTips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded bg-[#D4A853]/5 border border-[#D4A853]/10 text-[10px]">
              <span className="text-[#D4A853]">💡</span>
              <span className="text-gray-300">{tip}</span>
            </div>
          ))}
          <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10 text-[10px]">
            <span className="text-green-400">✅ 综合建议：</span>
            <span className="text-gray-300 ml-1">{data.recommendation}</span>
          </div>
          <div className="p-2 rounded bg-red-500/5 border border-red-500/10 text-[10px]">
            <span className="text-red-400">⚠️ 风险：</span>
            <span className="text-gray-300 ml-1">{data.riskSummary}</span>
          </div>
        </div>

        {/* Paywall overlay */}
        {!unlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-transparent">
            <div className="text-center">
              <div className="text-2xl mb-2">🔒</div>
              <p className="text-sm text-white font-bold mb-1">完整诊断 1 USDT</p>
              <p className="text-[10px] text-gray-500 mb-3">包含AI优化建议+风险分析+参数推荐</p>
              <button
                onClick={() => onPurchaseDiagnosis?.(data.factorId)}
                className="px-5 py-2 rounded-lg bg-[#D4A853] text-black text-xs font-bold hover:bg-[#C9A046] transition-colors"
              >
                解锁完整诊断 (1 USDT)
                {userBalance !== undefined && <span className="ml-1 opacity-60">余额:{userBalance}U</span>}
              </button>
            </div>
          </div>
        )}
      </div>

      {!unlocked && (
        <div className="text-center text-[9px] text-gray-700">
          基础信号灯永久免费 · 深度分析按次1U · 失败自动退费
        </div>
      )}
    </div>
  );
};

// ── Demo data ────────────────────────────────────────────────────────────────

export function generateDemoDiagnosis(factorId: string, factorName: string): DiagnosisData {
  const seed = factorId.charCodeAt(0) * 17 + factorId.length * 31;
  const ic = 0.02 + (seed % 50) / 1000;
  const icHistory = Array.from({ length: 12 }, (_, i) => {
    const trend = (seed % 3 === 0) ? -0.001 : 0.001;
    return Math.max(0.01, Math.min(0.08, ic + trend * (i - 6) + (Math.sin(seed + i * 1.5) * 0.008)));
  });

  return {
    factorId, factorName, category: 'quality',
    ic, ir: ic * 25 + 0.3, stability: 45 + (seed % 50), crowding: 15 + (seed % 70),
    decayRate: icHistory[0] > icHistory[11] ? 0.0015 : -0.001,
    sharpRatio: 0.5 + (seed % 100) / 100, maxDrawdown: 15 + (seed % 45),
    winRate: 45 + (seed % 25), halfLifeMonths: 8 + (seed % 30),
    icHistory,
    optimizationTips: [
      '将回看窗口从12月调整为9月可提升IC 0.005-0.008',
      '当前拥挤度35% — 建议与低相关因BAB配对使用',
      '在牛市环境中IC可达0.05+，当前建议维持权重',
      '参数微调：增大最低市值过滤可降低噪声15%',
    ],
    riskSummary: '该因子在2022年加息周期中最大回撤达-28%。当前美联储鹰派预期下需关注利率敏感度。半衰期预估8个月，届时需重新评估。',
    recommendation: '建议保留，权重控制在组合的20%以内。与低Beta因子对冲以控制尾部风险。每季度重新评估IC趋势。',
  };
}

export default DeepDiagnosisPanel;
