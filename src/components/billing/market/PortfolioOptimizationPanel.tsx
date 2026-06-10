/**
 * PortfolioOptimizationPanel — ML-72-04 [P1]
 * R72: v1.8.0-alpha — Efficient frontier + risk budget + rebalance
 *
 * Features:
 * - Efficient frontier scatter chart (return vs risk)
 * - Current portfolio position marker
 * - Risk budget pie chart (per asset allocation)
 * - Rebalance suggestion table (current→target with trade direction)
 * - Max Sharpe / Min Variance / Equal Weight presets
 */

import { useState } from 'react';
import { useTranslation } from "react-i18next";

// ── Types ───────────────────────────────────────────────────────────────

export interface PortfolioPoint {
  label: string;
  return_: number;
  risk: number;
  sharpe: number;
  highlight?: boolean;
}

export interface RiskBudget {
  asset: string;
  weight: number;
  riskContrib: number;
  color: string;
}

export interface RebalanceTrade {
  asset: string;
  currentWeight: number;
  targetWeight: number;
  delta: number;
  direction: 'BUY' | 'SELL' | 'HOLD';
  amount: number;
  reason: string;
}

export interface PortfolioOptimizationPanelProps {
  frontier?: PortfolioPoint[];
  riskBudget?: RiskBudget[];
  rebalanceTrades?: RebalanceTrade[];
  totalValue?: number;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockFrontier: PortfolioPoint[] = [
  { label: '最小方差', return_: 8.2, risk: 10.5, sharpe: 0.78 },
  { label: '等权重', return_: 15.8, risk: 16.3, sharpe: 0.97 },
  { label: '当前组合', return_: 22.3, risk: 18.5, sharpe: 1.21, highlight: true },
  { label: '最大夏普', return_: 25.1, risk: 14.8, sharpe: 1.70 },
  { label: '最大收益', return_: 42.3, risk: 22.1, sharpe: 1.91 },
  // Frontier curve points
  ...[...Array(15)].map((_, i) => ({ label: '', return_: 6 + i * 2.5, risk: 8 + (Math.sin(i * 0.8) * 6 + 8) * (1 + i * 0.08), sharpe: 0.5 + i * 0.1 })),
];

const mockRiskBudget: RiskBudget[] = [
  { asset: 'AAPL', weight: 25, riskContrib: 22, color: '#3b82f6' },
  { asset: 'TSLA', weight: 20, riskContrib: 35, color: '#ef4444' },
  { asset: 'NVDA', weight: 18, riskContrib: 28, color: '#22c55e' },
  { asset: 'MSFT', weight: 15, riskContrib: 9, color: '#8b5cf6' },
  { asset: 'HK.00700', weight: 12, riskContrib: 4, color: '#f59e0b' },
  { asset: 'Cash', weight: 10, riskContrib: 2, color: '#64748b' },
];

const mockRebalance: RebalanceTrade[] = [
  { asset: 'AAPL', currentWeight: 25, targetWeight: 22, delta: -3, direction: 'SELL', amount: 5280, reason: '降低集中度' },
  { asset: 'TSLA', currentWeight: 20, targetWeight: 15, delta: -5, direction: 'SELL', amount: 8800, reason: '高风险占比过高' },
  { asset: 'NVDA', currentWeight: 18, targetWeight: 20, delta: 2, direction: 'BUY', amount: 3520, reason: '动量+AI主题延续' },
  { asset: 'MSFT', currentWeight: 15, targetWeight: 18, delta: 3, direction: 'BUY', amount: 5280, reason: '低波动+稳定Alpha' },
  { asset: 'HK.00700', currentWeight: 12, targetWeight: 10, delta: -2, direction: 'SELL', amount: 3520, reason: '港股回归均值' },
  { asset: 'Cash', currentWeight: 10, targetWeight: 15, delta: 5, direction: 'BUY', amount: 8800, reason: '增加现金缓冲' },
];

// ── Efficient Frontier Chart (SVG) ───────────────────────────────────────

function EfficientFrontier({ points }: { points: PortfolioPoint[] }) {
  const { t } = useTranslation();

  const w = 260; const h = 180; const pad = { l: 40, r: 20, t: 15, b: 25 };
  const risks = points.map(p => p.risk);
  const returns = points.map(p => p.return_);
  const xMin = 0; const xMax = Math.max(...risks) * 1.1;
  const yMin = Math.min(...returns) * 0.8; const yMax = Math.max(...returns) * 1.1;

  const tx = (v: number) => pad.l + ((v - xMin) / (xMax - xMin)) * (w - pad.l - pad.r);
  const ty = (v: number) => h - pad.b - ((v - yMin) / (yMax - yMin)) * (h - pad.t - pad.b);

  const frontierPts = points.filter(p => !p.label).map(p => `${tx(p.risk)},${ty(p.return_)}`).join(' ');
  const highlightPts = points.filter(p => p.label && p.highlight);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
      {/* Axes */}
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="rgba(255,255,255,0.1)" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={h - pad.b} stroke="rgba(255,255,255,0.1)" />
      {/* Labels */}
      <text x={w / 2} y={h - 2} fill="#64748b" fontSize="9" textAnchor="middle">风险 Risk (%)</text>
      <text x={8} y={h / 2} fill="#64748b" fontSize="9" textAnchor="middle" transform={`rotate(-90,8,${h/2})`}>收益 Return (%)</text>
      {/* Frontier curve */}
      <polyline points={frontierPts} fill="none" stroke="#D4A853" strokeWidth="2" strokeOpacity="0.6" />
      {/* Normal points */}
      {points.filter(p => p.label && !p.highlight).map((p, i) => (
        <circle key={i} cx={tx(p.risk)} cy={ty(p.return_)} r={4} fill="#64748b" />
      ))}
      {/* Highlighted points */}
      {highlightPts.map((p, i) => (
        <circle key={i} cx={tx(p.risk)} cy={ty(p.return_)} r={6} fill="#D4A853" stroke="#fff" strokeWidth="1.5" />
      ))}
      {/* Labels for named points */}
      {points.filter(p => p.label).map((p, i) => (
        <text key={i} x={tx(p.risk)} y={ty(p.return_) - 10} fill="#94a3b8" fontSize="8" textAnchor="middle">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

// ── Risk Budget Pie (SVG) ────────────────────────────────────────────────

function RiskBudgetPie({ budget, size = 140 }: { budget: RiskBudget[]; size?: number }) {
  const total = budget.reduce((s, b) => s + b.riskContrib, 0);
  let cumAngle = 0;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {budget.map(b => {
          const angle = (b.riskContrib / total) * 360;
          const mid = (cumAngle + angle / 2) * Math.PI / 180;
          const r = size / 2 - 5;
          const x1 = size / 2 + r * Math.cos(cumAngle * Math.PI / 180);
          const y1 = size / 2 + r * Math.sin(cumAngle * Math.PI / 180);
          const largeArc = angle > 180 ? 1 : 0;
          const x2 = size / 2 + r * Math.cos((cumAngle + angle) * Math.PI / 180);
          const y2 = size / 2 + r * Math.sin((cumAngle + angle) * Math.PI / 180);
          const d = `M${size / 2},${size / 2} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;
          cumAngle += angle;
          const lx = size / 2 + (r * 0.65) * Math.cos(mid);
          const ly = size / 2 + (r * 0.65) * Math.sin(mid);
          return (
            <g key={b.asset}>
              <path d={d} fill={b.color} fillOpacity="0.7" stroke="#0D0D14" strokeWidth="1.5" />
              <text x={lx} y={ly} fill="#fff" fontSize="8" fontWeight="600" textAnchor="middle" dominantBaseline="central">
                {b.riskContrib}%
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-2 mt-2 justify-center">
        {budget.map(b => (
          <span key={b.asset} className="text-[10px] flex items-center gap-1">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
            {b.asset} {b.riskContrib}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────

export default function PortfolioOptimizationPanel({
  frontier: propFrontier,
  riskBudget: propBudget,
  rebalanceTrades: propTrades,
  totalValue = 176000,
  className = '',
}: PortfolioOptimizationPanelProps) {
  const [tab, setTab] = useState<'frontier' | 'risk' | 'rebalance'>('frontier');
  const frontier = propFrontier ?? mockFrontier;
  const riskBudget = propBudget ?? mockRiskBudget;
  const rebalance = propTrades ?? mockRebalance;

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">组合优化</h2>
            <p className="text-gray-500 text-xs mt-0.5">总资产: ${totalValue.toLocaleString()}</p>
          </div>
          <div className="flex gap-1">
            {(['frontier', 'risk', 'rebalance'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === t ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-600'}`}>
                {t === 'frontier' ? '📈 有效前沿' : t === 'risk' ? '🎯 风险预算' : '🔄 再平衡'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* ── Efficient Frontier ────────────────────────────────────────── */}
        {tab === 'frontier' && (
          <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
            <h4 className="text-gray-300 font-semibold text-sm mb-3">📈 有效前沿</h4>
            <EfficientFrontier points={frontier} />
            <div className="grid grid-cols-3 gap-2 mt-3">
              {['最大夏普', '最小方差', '当前组合'].map(preset => {
                const pt = frontier.find(p => p.label === preset);
                return (
                  <button key={preset} className={`py-1.5 rounded text-[10px] font-semibold border ${preset === '当前组合' ? 'border-[#D4A853]/30 bg-[#C9A046]/10 text-[#D4A853]' : 'border-white/5 text-gray-500 hover:text-gray-300'}`}>
                    {preset} {pt ? `${pt.return_}%/${pt.risk}%` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Risk Budget ───────────────────────────────────────────────── */}
        {tab === 'risk' && (
          <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
            <h4 className="text-gray-300 font-semibold text-sm mb-3">🎯 风险预算</h4>
            <RiskBudgetPie budget={riskBudget} />
            <div className="mt-3 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg text-[10px] text-yellow-400 text-center">
              ⚠️ TSLA 贡献 35% 风险但仅占 20% 权重 — 建议降权
            </div>
          </div>
        )}

        {/* ── Rebalance ──────────────────────────────────────────────────── */}
        {tab === 'rebalance' && (
          <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 text-gray-300 font-semibold text-sm">🔄 再平衡建议</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/[0.02] text-gray-500">
                  <th className="text-left px-4 py-2">资产</th>
                  <th className="text-right px-4 py-2">当前</th>
                  <th className="text-right px-4 py-2">目标</th>
                  <th className="text-center px-4 py-2">{t("components.actions")}</th>
                  <th className="text-right px-4 py-2">金额</th>
                  <th className="text-left px-4 py-2">理由</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rebalance.map(r => (
                  <tr key={r.asset}>
                    <td className="px-4 py-2.5 font-semibold text-gray-300">{r.asset}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{r.currentWeight}%</td>
                    <td className="px-4 py-2.5 text-right text-[#D4A853] font-semibold">{r.targetWeight}%</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-[10px] font-bold ${r.direction === 'BUY' ? 'text-green-400' : r.direction === 'SELL' ? 'text-red-400' : 'text-gray-500'}`}>
                        {r.direction === 'BUY' ? '🟢 买入' : r.direction === 'SELL' ? '🔴 卖出' : '—'}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${r.delta > 0 ? 'text-green-400' : r.delta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                      {r.delta > 0 ? '+' : ''}{r.delta}% (${r.amount.toLocaleString()})
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
