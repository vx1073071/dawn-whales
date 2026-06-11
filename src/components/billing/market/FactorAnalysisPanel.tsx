/**
 * FactorAnalysisPanel — ML-72-03 [P0]
 * R72: v1.8.0-alpha — Factor IC/IR analysis + strategy comparison radar
 *
 * Features:
 * - IC (Information Coefficient) curve over time
 * - IR (Information Ratio) per factor
 * - Factor exposure heatmap (factors × stocks)
 * - Multi-strategy radar chart (6D: return/sharpe/drawdown/winrate/vol/alpha)
 * - Factor decay + crowding indicators
 */

import { useState, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import i18n from '../../../i18n';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:DATA] structured error tracking

// ── Types ───────────────────────────────────────────────────────────────

export interface FactorInfo {
  name: string;
  label: string;
  ic: number;
  ir: number;
  decay: number; // months to half
  crowding: number; // 0-1
  longShortSpread: number;
  history: number[]; // 12-month IC
}

export interface FactorExposure {
  factor: string;
  stock: string;
  exposure: number; // -1 to 1
}

export interface StrategyRadar {
  name: string;
  color: string;
  return_: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  volatility: number;
  alpha: number;
}

export interface FactorAnalysisPanelProps {
  factors?: FactorInfo[];
  exposures?: FactorExposure[];
  strategies?: StrategyRadar[];
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockFactors: FactorInfo[] = [
{ name: 'MOM', label: i18n.t('FactorAnalysisPanel.k1'), ic: 0.042, ir: 0.68, decay: 3, crowding: 0.72, longShortSpread: 8.5,
  history: [0.03, 0.05, 0.04, 0.06, 0.03, 0.07, 0.04, 0.05, 0.03, 0.06, 0.04, 0.04] },
{ name: 'VAL', label: i18n.t('FactorAnalysisPanel.k2'), ic: 0.031, ir: 0.52, decay: 6, crowding: 0.45, longShortSpread: 5.2,
  history: [0.02, 0.04, 0.03, 0.02, 0.05, 0.03, 0.04, 0.02, 0.03, 0.04, 0.03, 0.03] },
{ name: 'QUAL', label: i18n.t('FactorAnalysisPanel.k3'), ic: 0.038, ir: 0.61, decay: 4, crowding: 0.38, longShortSpread: 6.8,
  history: [0.04, 0.03, 0.05, 0.04, 0.03, 0.05, 0.04, 0.04, 0.03, 0.05, 0.04, 0.04] },
{ name: 'VOL', label: i18n.t('FactorAnalysisPanel.k4'), ic: -0.028, ir: 0.44, decay: 5, crowding: 0.55, longShortSpread: 4.1,
  history: [-0.02, -0.04, -0.03, -0.02, -0.03, -0.04, -0.02, -0.03, -0.02, -0.04, -0.03, -0.03] },
{ name: 'LIQ', label: i18n.t('FactorAnalysisPanel.k5'), ic: 0.019, ir: 0.31, decay: 2, crowding: 0.28, longShortSpread: 3.2,
  history: [0.01, 0.03, 0.02, 0.01, 0.03, 0.02, 0.01, 0.02, 0.01, 0.03, 0.02, 0.02] },
{ name: 'SENT', label: i18n.t('FactorAnalysisPanel.k6'), ic: 0.035, ir: 0.55, decay: 1, crowding: 0.62, longShortSpread: 7.1,
  history: [0.03, 0.04, 0.03, 0.05, 0.02, 0.04, 0.03, 0.04, 0.03, 0.05, 0.03, 0.04] }];


const mockExposures: FactorExposure[] = [
{ factor: 'MOM', stock: 'AAPL', exposure: 0.42 }, { factor: 'MOM', stock: 'TSLA', exposure: 0.78 },
{ factor: 'MOM', stock: 'NVDA', exposure: 0.85 }, { factor: 'MOM', stock: 'MSFT', exposure: 0.31 },
{ factor: 'VAL', stock: 'AAPL', exposure: -0.15 }, { factor: 'VAL', stock: 'TSLA', exposure: -0.62 },
{ factor: 'VAL', stock: 'NVDA', exposure: -0.38 }, { factor: 'VAL', stock: 'MSFT', exposure: 0.22 },
{ factor: 'QUAL', stock: 'AAPL', exposure: 0.65 }, { factor: 'QUAL', stock: 'TSLA', exposure: 0.28 },
{ factor: 'QUAL', stock: 'NVDA', exposure: 0.71 }, { factor: 'QUAL', stock: 'MSFT', exposure: 0.82 },
{ factor: 'VOL', stock: 'AAPL', exposure: -0.34 }, { factor: 'VOL', stock: 'TSLA', exposure: -0.88 },
{ factor: 'VOL', stock: 'NVDA', exposure: -0.72 }, { factor: 'VOL', stock: 'MSFT', exposure: -0.25 }];


const mockStrategies: StrategyRadar[] = [
{ name: i18n.t('FactorAnalysisPanel.k7'), color: '#3b82f6', return_: 42.3, sharpe: 2.1, maxDrawdown: 12.5, winRate: 68.2, volatility: 18.5, alpha: 8.2 },
{ name: i18n.t('FactorAnalysisPanel.k8'), color: '#8b5cf6', return_: 28.1, sharpe: 1.8, maxDrawdown: 8.3, winRate: 72.1, volatility: 14.2, alpha: 5.1 },
{ name: i18n.t('FactorAnalysisPanel.k9'), color: '#f59e0b', return_: 35.8, sharpe: 2.4, maxDrawdown: 15.1, winRate: 65.8, volatility: 20.1, alpha: 10.3 },
{ name: i18n.t('FactorAnalysisPanel.k10'), color: '#10b981', return_: 48.5, sharpe: 2.8, maxDrawdown: 9.2, winRate: 74.5, volatility: 16.3, alpha: 12.7 }];


const STOCKS = ['AAPL', 'TSLA', 'NVDA', 'MSFT'];
const FACTOR_NAMES = ['MOM', 'VAL', 'QUAL', 'VOL', 'LIQ', 'SENT'];

// ── Heatmap Cell ────────────────────────────────────────────────────────

function HeatmapCell({ value }: {value: number;}) {
  const { t: _t } = useTranslation();

  const intensity = Math.abs(value);
  const bg = value >= 0 ?
  `rgba(34,197,94,${0.1 + intensity * 0.8})` :
  `rgba(239,68,68,${0.1 + intensity * 0.8})`;
  return (
    <td style={{ textAlign: 'center', padding: 6, background: bg, fontSize: 11, fontFamily: 'monospace', borderRadius: 2 }}>
      {value.toFixed(2)}
    </td>);

}

// ── IC Sparkline ─────────────────────────────────────────────────────────

function ICSparkline({ data, color }: {data: number[];color: string;}) {
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0.01);
  const range = max - min || 1;
  const h = 20;const w = 80;
  const points = data.map((v, i) => `${i / (data.length - 1) * w},${h - (v - min) / range * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {min < 0 && max > 0 && <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 3" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>);

}

// ── Radar Chart (simplified SVG) ─────────────────────────────────────────

function RadarChart({ strategies }: {strategies: StrategyRadar[];}) {
  const dims = ['components.returnRate', 'components.sharpeRatio', i18n.t('FactorAnalysisPanel.k11'), 'components.winRate', i18n.t('FactorAnalysisPanel.k12'), 'Alpha'] as const;
  const cx = 70;const cy = 70;const r = 55;
  const angles = [270, 330, 30, 90, 150, 210].map((a) => a * Math.PI / 180);

  return (
    <div className="flex justify-center">
      <svg width="160" height="160" viewBox="0 0 140 140">
        {/* Grid rings */}
        {[0.25, 0.5, 0.75, 1].map((scale) =>
        <polygon key={scale} points={angles.map((a) => `${cx + r * scale * Math.cos(a)},${cy + r * scale * Math.sin(a)}`).join(' ')}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        )}
        {/* Axes */}
        {angles.map((a, i) =>
        <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        )}
        {/* Labels */}
        {angles.map((a, i) =>
        <text key={i} x={cx + (r + 14) * Math.cos(a)} y={cy + (r + 14) * Math.sin(a)}
        textAnchor="middle" dominantBaseline="central" fill="#64748b" fontSize="8">{dims[i]}</text>
        )}
        {/* Strategy polygons */}
        {strategies.map((s, si) => {
          const vals = [s.return_, s.sharpe, 50 - s.maxDrawdown, s.winRate, 50 - s.volatility, s.alpha];
          const maxVals = [60, 3, 50, 100, 50, 15];
          const pts = vals.map((v, i) => `${cx + r * (v / maxVals[i]) * Math.cos(angles[i])},${cy + r * (v / maxVals[i]) * Math.sin(angles[i])}`);
          return <polygon key={si} points={pts.join(' ')} fill={s.color} fillOpacity="0.15" stroke={s.color} strokeWidth="1.5" />;
        })}
      </svg>
    </div>);

}

// ── Main ────────────────────────────────────────────────────────────────

export default function FactorAnalysisPanel({
  factors: propFactors,
  exposures: propExposures,
  strategies: propStrats,
  className = ''
}: FactorAnalysisPanelProps) {
  const [tab, setTab] = useState<'icir' | 'exposure' | 'radar'>('icir');
  const factors = propFactors ?? mockFactors;
  const stratExposures = propExposures ?? mockExposures;
  const strategies = propStrats ?? mockStrategies;

  const heatmap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    FACTOR_NAMES.forEach((f) => {map[f] = {};STOCKS.forEach((s) => {map[f][s] = 0;});});
    stratExposures.forEach((e) => {if (map[e.factor] && map[e.factor][e.stock] !== undefined) map[e.factor][e.stock] = e.exposure;});
    return map;
  }, [stratExposures]);

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{i18n.t('FactorAnalysisPanel.k0')}</h2>
          <div className="flex gap-1">
            {(['icir', 'exposure', 'radar'] as const).map((t) =>
            <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === t ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-600'}`}>
                {t === 'icir' ? 'IC/IR' : t === 'exposure' ? i18n.t('FactorAnalysisPanel.k13') : i18n.t('FactorAnalysisPanel.k14')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* ── IC/IR Table ──────────────────────────────────────────────── */}
        {tab === 'icir' &&
        <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 text-gray-300 font-semibold text-sm">{i18n.t("FactorAnalysisPanel.r92_73ea")}</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/[0.02] text-gray-500">
                  <th className="text-left px-4 py-2">{"components.factor"}</th><th className="text-right px-4 py-2">IC</th><th className="text-right px-4 py-2">IR</th>
                  <th className="text-right px-4 py-2">{i18n.t("FactorAnalysisPanel.r92_20f4")}</th><th className="text-right px-4 py-2">{i18n.t('FactorAnalysisPanel.k1')}</th>
                  <th className="text-right px-4 py-2">{i18n.t("FactorAnalysisPanel.r92_7136")}</th><th className="px-4 py-2">{i18n.t("FactorAnalysisPanel.r92_a04a")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {factors.map((f) =>
              <tr key={f.name} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-semibold text-gray-300">{f.label}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${f.ic >= 0.03 ? 'text-green-400' : f.ic >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>{f.ic.toFixed(3)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${f.ir >= 0.5 ? 'text-green-400' : 'text-yellow-400'}`}>{f.ir.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{f.decay}{i18n.t("FactorAnalysisPanel.r92_1cdb")}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={f.crowding > 0.6 ? 'text-red-400' : f.crowding > 0.4 ? 'text-yellow-400' : 'text-green-400'}>{f.crowding.toFixed(2)}</span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${f.longShortSpread >= 0 ? 'text-green-400' : 'text-red-400'}`}>{f.longShortSpread}%</td>
                    <td className="px-4 py-2.5"><ICSparkline data={f.history} color={f.ic >= 0 ? '#22C55E' : '#ef4444'} /></td>
                  </tr>
              )}
              </tbody>
            </table>
          </div>
        }

        {/* ── Exposure Heatmap ──────────────────────────────────────────── */}
        {tab === 'exposure' &&
        <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 text-gray-300 font-semibold text-sm">{i18n.t("FactorAnalysisPanel.r92_d9dd")}</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/[0.02] text-gray-500">
                  <th className="text-left px-4 py-2">{"components.factor"}</th>
                  {STOCKS.map((s) => <th key={s} className="text-center px-2 py-2">{s}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {FACTOR_NAMES.map((f) =>
              <tr key={f}>
                    <td className="px-4 py-1.5 font-semibold text-gray-400">{f}</td>
                    {STOCKS.map((s) => <HeatmapCell key={s} value={heatmap[f]?.[s] ?? 0} />)}
                  </tr>
              )}
              </tbody>
            </table>
            <div className="px-5 py-2 text-[10px] text-gray-600 border-t border-white/5">{i18n.t("FactorAnalysisPanel.r92_46d9")}

          </div>
          </div>
        }

        {/* ── Strategy Radar ────────────────────────────────────────────── */}
        {tab === 'radar' &&
        <div className="space-y-5">
            <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
              <h4 className="text-gray-300 font-semibold text-sm mb-3">{i18n.t("FactorAnalysisPanel.r92_2cc1")}</h4>
              <RadarChart strategies={strategies} />
              <div className="flex justify-center gap-4 mt-2">
                {strategies.map((s) =>
              <span key={s.name} className="text-[10px] flex items-center gap-1">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                    {s.name}
                  </span>
              )}
              </div>
            </div>

            <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 text-gray-300 font-semibold text-sm">{i18n.t("FactorAnalysisPanel.r92_e58a")}</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.02] text-gray-500">
                    <th className="text-left px-4 py-2">{"components.strategy"}</th><th className="text-right px-4 py-2">{"components.returnRate"}</th><th className="text-right px-4 py-2">{"components.sharpeRatio"}</th>
                    <th className="text-right px-4 py-2">{i18n.t('FactorAnalysisPanel.k2')}</th><th className="text-right px-4 py-2">{"components.winRate"}</th>
                    <th className="text-right px-4 py-2">{i18n.t('FactorAnalysisPanel.k3')}</th><th className="text-right px-4 py-2">Alpha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {strategies.map((s) =>
                <tr key={s.name}>
                      <td className="px-4 py-2.5"><span style={{ color: s.color, fontWeight: 600, fontSize: 12 }}>{s.name}</span></td>
                      <td className="px-4 py-2.5 text-right text-green-400 font-mono">+{s.return_}%</td>
                      <td className="px-4 py-2.5 text-right text-gray-300 font-mono">{s.sharpe}</td>
                      <td className="px-4 py-2.5 text-right text-red-400 font-mono">{s.maxDrawdown}%</td>
                      <td className="px-4 py-2.5 text-right text-gray-300 font-mono">{s.winRate}%</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 font-mono">{s.volatility}%</td>
                      <td className="px-4 py-2.5 text-right text-green-400 font-mono">+{s.alpha}%</td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>
    </div>);

}