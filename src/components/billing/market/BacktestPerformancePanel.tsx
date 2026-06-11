/**
* BacktestPerformancePanel — ML-68-03 [P1]
* R68: v1.7.0-alpha — Backtest performance visualization with speedup comparison
*
* Features:
* - Backtest duration with before/after comparison (current >5s → target <2s)
* - Speedup factor display (parallel workers + cache)
* - TopK results table (best 100 parameter combinations)
* - Cache hit rate gauge
* - Worker utilization dashboard
* - Per-strategy benchmark table
*/

import { useState, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import i18n from '../../../i18n';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:DATA] structured error tracking

// ── Types ───────────────────────────────────────────────────────────────

export interface BacktestTiming {
  strategy: string;
  symbol: string;
  period: string; // "1Y", "3Y", "5Y"
  bars: number;
  beforeMs: number; // without optimization
  afterMs: number; // with parallel + cache
  speedup: number; // x factor
  cacheHit: boolean;
  topK: number;
}

export interface TopKResult {
  rank: number;
  params: Record<string, number>;
  sharpe: number;
  totalReturn: number; // %
  maxDrawdown: number; // %
  winRate: number; // %
  trades: number;
}

export interface CacheStats {
  hitRate: number; // %
  entries: number;
  sizeMB: number;
  saves: number;
  ttlMinutes: number;
}

export interface WorkerStats {
  total: number;
  active: number;
  avgUtilization: number; // %
  maxUtilization: number;
}

export interface BacktestPerformancePanelProps {
  timings?: BacktestTiming[];
  topKResults?: TopKResult[];
  cacheStats?: CacheStats;
  workerStats?: WorkerStats;
  onClearCache?: () => void;
  onRunBenchmark?: () => void;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockTimings: BacktestTiming[] = [
{ strategy: i18n.t('BacktestPerformancePanel.k1'), symbol: 'AAPL', period: '1Y', bars: 252, beforeMs: 5200, afterMs: 1800, speedup: 2.9, cacheHit: true, topK: 23 },
{ strategy: i18n.t('BacktestPerformancePanel.k2'), symbol: 'TSLA', period: '1Y', bars: 252, beforeMs: 4800, afterMs: 1400, speedup: 3.4, cacheHit: true, topK: 18 },
{ strategy: i18n.t('BacktestPerformancePanel.k3'), symbol: 'QQQ', period: '3Y', bars: 756, beforeMs: 12300, afterMs: 3100, speedup: 4.0, cacheHit: false, topK: 45 },
{ strategy: i18n.t('BacktestPerformancePanel.k4'), symbol: 'SPY', period: '1Y', bars: 252, beforeMs: 5100, afterMs: 1500, speedup: 3.4, cacheHit: true, topK: 31 },
{ strategy: i18n.t('BacktestPerformancePanel.k5'), symbol: 'HK.00700', period: '5Y', bars: 1260, beforeMs: 18800, afterMs: 4200, speedup: 4.5, cacheHit: false, topK: 67 },
{ strategy: i18n.t('BacktestPerformancePanel.k6'), symbol: 'SH.600519', period: '1Y', bars: 242, beforeMs: 4700, afterMs: 1200, speedup: 3.9, cacheHit: true, topK: 15 },
{ strategy: i18n.t('BacktestPerformancePanel.k7'), symbol: 'SH.000300', period: '3Y', bars: 726, beforeMs: 15600, afterMs: 3800, speedup: 4.1, cacheHit: false, topK: 52 }];


const mockTopK: TopKResult[] = [
{ rank: 1, params: { fastMA: 5, slowMA: 20, rsiPeriod: 14, rsiOversold: 30 }, sharpe: 2.45, totalReturn: 42.3, maxDrawdown: 12.5, winRate: 68.2, trades: 847 },
{ rank: 2, params: { fastMA: 10, slowMA: 30, rsiPeriod: 14, rsiOversold: 35 }, sharpe: 2.31, totalReturn: 38.7, maxDrawdown: 13.8, winRate: 65.4, trades: 723 },
{ rank: 3, params: { fastMA: 5, slowMA: 25, rsiPeriod: 10, rsiOversold: 25 }, sharpe: 2.18, totalReturn: 35.2, maxDrawdown: 14.1, winRate: 63.1, trades: 691 },
{ rank: 4, params: { fastMA: 8, slowMA: 22, rsiPeriod: 14, rsiOversold: 30 }, sharpe: 2.05, totalReturn: 31.8, maxDrawdown: 15.3, winRate: 61.7, trades: 652 },
{ rank: 5, params: { fastMA: 12, slowMA: 26, rsiPeriod: 12, rsiOversold: 28 }, sharpe: 1.89, totalReturn: 28.5, maxDrawdown: 16.7, winRate: 59.3, trades: 578 },
{ rank: 6, params: { fastMA: 7, slowMA: 21, rsiPeriod: 14, rsiOversold: 35 }, sharpe: 1.72, totalReturn: 25.1, maxDrawdown: 18.2, winRate: 57.8, trades: 534 }];


const mockCache: CacheStats = { hitRate: 87.3, entries: 1847, sizeMB: 48.2, saves: 294, ttlMinutes: 60 };
const mockWorkers: WorkerStats = { total: 4, active: 3, avgUtilization: 72.5, maxUtilization: 94.0 };

// ── Speedup Badge ───────────────────────────────────────────────────────

function SpeedupBadge({ speedup }: {speedup: number;}) {
  const { t: _t } = useTranslation();

  const c = speedup >= 4 ? 'text-green-400 bg-green-500/10' : speedup >= 3 ? 'text-[#D4A853] bg-[#C9A046]/10' : 'text-yellow-400 bg-yellow-500/10';
  return <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${c}`}>{speedup.toFixed(1)}x</span>;
}

// ── Gauge ────────────────────────────────────────────────────────────────

function Gauge({ value, label, max, color }: {value: number;label: string;max: number;color: string;}) {
  const pct = Math.min(100, value / max * 100);
  return (
    <div className="flex flex-col items-center">
      <svg width="90" height="50" viewBox="0 0 90 45">
        <path d="M9,40 A36,36 0 0,1 81,40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
        <path d="M9,40 A36,36 0 0,1 81,40" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={Math.PI * 36} strokeDashoffset={Math.PI * 36 * (1 - pct / 100)}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="text-lg font-bold -mt-5" style={{ color }}>{value}{label.includes('%') ? '%' : ''}</div>
      <div className="text-[10px] text-gray-600">{label}</div>
    </div>);

}

// ── Main Component ──────────────────────────────────────────────────────

export default function BacktestPerformancePanel({
  timings: propTimings,
  topKResults: propTopK,
  cacheStats: propCache,
  workerStats: propWorkers,
  onClearCache,
  onRunBenchmark,
  className = ''
}: BacktestPerformancePanelProps) {
  const [tab, setTab] = useState<'speedup' | 'topk' | 'workers'>('speedup');

  const timings = propTimings ?? mockTimings;
  const topK = propTopK ?? mockTopK;
  const cache = propCache ?? mockCache;
  const workers = propWorkers ?? mockWorkers;

  const avgBefore = useMemo(() => timings.reduce((s, t) => s + t.beforeMs, 0) / timings.length, [timings]);
  const avgAfter = useMemo(() => timings.reduce((s, t) => s + t.afterMs, 0) / timings.length, [timings]);
  const avgSpeedup = avgBefore / avgAfter;
  const totalTimeSaved = useMemo(() => timings.reduce((s, t) => s + (t.beforeMs - t.afterMs), 0), [timings]);

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{i18n.t('BacktestPerformancePanel.k8')}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{i18n.t('BacktestPerformancePanel.k9')}</p>
          </div>
          <div className="flex gap-2">
            {(['speedup', 'topk', 'workers'] as const).map((t) =>
            <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-600 hover:text-gray-400'}`}>
                {t === 'speedup' ? i18n.t('BacktestPerformancePanel.k10') : t === 'topk' ? '🏆 TopK' : '🖥 Worker'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="bg-[#111119] border border-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-600 mb-1">{i18n.t('BacktestPerformancePanel.k11')}</div>
            <div className="text-xl font-bold text-green-400">{avgSpeedup.toFixed(1)}x</div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-600 mb-1">{i18n.t('BacktestPerformancePanel.k12')}</div>
            <div className="text-lg font-bold text-red-400">{(avgBefore / 1000).toFixed(1)}s</div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-600 mb-1">{i18n.t('BacktestPerformancePanel.k13')}</div>
            <div className="text-lg font-bold text-green-400">{(avgAfter / 1000).toFixed(1)}s</div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-600 mb-1">{i18n.t('BacktestPerformancePanel.k14')}</div>
            <div className="text-lg font-bold text-[#D4A853]">{(totalTimeSaved / 1000).toFixed(0)}s</div>
          </div>
        </div>

        {/* ── Speedup Tab ──────────────────────────────────────────────── */}
        {tab === 'speedup' &&
        <div className="space-y-5">
            {/* Timing table */}
            <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5">
                <h4 className="text-gray-300 font-semibold text-sm">{i18n.t('BacktestPerformancePanel.k15')}</h4>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.02] text-gray-500">
                    <th className="text-left px-4 py-2 font-medium">{"components.strategy"}</th>
                    <th className="text-left px-4 py-2 font-medium">{i18n.t('BacktestPerformancePanel.k16')}</th>
                    <th className="text-left px-4 py-2 font-medium">{i18n.t('BacktestPerformancePanel.k17')}</th>
                    <th className="text-right px-4 py-2 font-medium">{i18n.t('BacktestPerformancePanel.k18')}</th>
                    <th className="text-right px-4 py-2 font-medium">{i18n.t('BacktestPerformancePanel.k19')}</th>
                    <th className="text-center px-4 py-2 font-medium">{i18n.t('BacktestPerformancePanel.k20')}</th>
                    <th className="text-center px-4 py-2 font-medium">{i18n.t('BacktestPerformancePanel.k21')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {timings.map((t, i) =>
                <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-gray-300 font-medium">{t.strategy}</td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono">{t.symbol}</td>
                      <td className="px-4 py-2.5 text-gray-600">{t.period} ({t.bars}{i18n.t("BacktestPerformancePanel.r92_27d8")}</td>
                      <td className="px-4 py-2.5 text-right text-red-400 font-mono">{(t.beforeMs / 1000).toFixed(1)}s</td>
                      <td className="px-4 py-2.5 text-right text-green-400 font-mono">{(t.afterMs / 1000).toFixed(1)}s</td>
                      <td className="px-4 py-2.5 text-center"><SpeedupBadge speedup={t.speedup} /></td>
                      <td className="px-4 py-2.5 text-center">
                        {t.cacheHit ? <span className="text-green-400">✓ Hit</span> : <span className="text-gray-600">Miss</span>}
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>

            {/* Before/After bar comparison */}
            <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
              <h4 className="text-gray-300 font-semibold text-sm mb-4">{i18n.t('BacktestPerformancePanel.k22')}</h4>
              <div className="space-y-3">
                {timings.slice(0, 6).map((t, i) => {
                const maxMs = Math.max(...timings.map((x) => x.beforeMs));
                const beforePct = t.beforeMs / maxMs * 100;
                const afterPct = t.afterMs / maxMs * 100;
                return (
                  <div key={i}>
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>{t.strategy} ({t.period})</span>
                        <SpeedupBadge speedup={t.speedup} />
                      </div>
                      <div className="flex gap-1 h-4">
                        <div className="h-full rounded flex items-center justify-end px-1" style={{ width: `${beforePct}%`, background: 'rgba(239,68,68,0.3)' }}>
                          <span className="text-[9px] text-red-300 font-mono">{(t.beforeMs / 1000).toFixed(1)}s</span>
                        </div>
                        <div className="h-full rounded flex items-center justify-end px-1" style={{ width: `${afterPct}%`, background: 'rgba(34,197,94,0.3)' }}>
                          <span className="text-[9px] text-green-300 font-mono">{(t.afterMs / 1000).toFixed(1)}s</span>
                        </div>
                      </div>
                    </div>);

              })}
              </div>
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5 text-[10px] text-gray-600">
                <span>{i18n.t('BacktestPerformancePanel.k23')}</span>
                <span>{i18n.t('BacktestPerformancePanel.k24')}</span>
                <span>{i18n.t('BacktestPerformancePanel.k25')}</span>
              </div>
            </div>

            {/* Cache stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#111119] border border-white/5 rounded-xl p-4 flex flex-col items-center">
                <Gauge value={cache.hitRate} label={i18n.t('BacktestPerformancePanel.k26')} max={100} color="#22C55E" />
              </div>
              <div className="bg-[#111119] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold text-gray-200">{cache.entries.toLocaleString()}</div>
                <div className="text-[10px] text-gray-600 mt-1">{i18n.t('BacktestPerformancePanel.k27')}</div>
                <div className="text-xs text-gray-500 mt-2">{cache.sizeMB} MB · TTL {cache.ttlMinutes}min</div>
              </div>
              <div className="bg-[#111119] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold text-[#D4A853]">{cache.saves}</div>
                <div className="text-[10px] text-gray-600 mt-1">{i18n.t('BacktestPerformancePanel.k28')}</div>
                <button onClick={onClearCache}
              className="mt-2 px-3 py-1 rounded text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">{i18n.t("BacktestPerformancePanel.r92_3e98")}

              </button>
              </div>
            </div>
          </div>
        }

        {/* ── TopK Tab ─────────────────────────────────────────────────── */}
        {tab === 'topk' &&
        <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <h4 className="text-gray-300 font-semibold text-sm">🏆 Top {topK.length}{i18n.t("BacktestPerformancePanel.r92_21fd")}</h4>
              <span className="text-[10px] text-gray-600">{i18n.t('BacktestPerformancePanel.k29')}</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/[0.02] text-gray-500">
                  <th className="text-center px-3 py-2 font-medium w-10">#</th>
                  <th className="text-left px-3 py-2 font-medium">{i18n.t('BacktestPerformancePanel.k30')}</th>
                  <th className="text-right px-3 py-2 font-medium">{"components.sharpeRatio"}</th>
                  <th className="text-right px-3 py-2 font-medium">{"components.returnRate"}</th>
                  <th className="text-right px-3 py-2 font-medium">{i18n.t('BacktestPerformancePanel.k31')}</th>
                  <th className="text-right px-3 py-2 font-medium">{"components.winRate"}</th>
                  <th className="text-right px-3 py-2 font-medium">{i18n.t('BacktestPerformancePanel.k32')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topK.map((r) =>
              <tr key={r.rank} className={`hover:bg-white/[0.02] ${r.rank <= 3 ? 'bg-[#C9A046]/[0.02]' : ''}`}>
                    <td className="px-3 py-2.5 text-center">
                      {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' :
                  <span className="text-gray-600 font-mono">{r.rank}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 font-mono">
                      {Object.entries(r.params).map(([k, v], i) =>
                  <span key={k}>
                          {i > 0 && <span className="text-gray-700">, </span>}
                          <span className="text-gray-500">{k}:</span>{v}
                        </span>
                  )}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono ${r.sharpe >= 2 ? 'text-green-400' : r.sharpe >= 1 ? 'text-gray-200' : 'text-gray-500'}`}>
                      {r.sharpe.toFixed(2)}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono ${r.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {r.totalReturn >= 0 ? '+' : ''}{r.totalReturn.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-right text-red-400 font-mono">{r.maxDrawdown.toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-right text-gray-400 font-mono">{r.winRate.toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-right text-gray-500 font-mono">{r.trades}</td>
                  </tr>
              )}
              </tbody>
            </table>
            <div className="px-5 py-2 text-[10px] text-gray-600 border-t border-white/5">{i18n.t("BacktestPerformancePanel.r92_c35f")}

          </div>
          </div>
        }

        {/* ── Workers Tab ───────────────────────────────────────────────── */}
        {tab === 'workers' &&
        <div className="space-y-5">
            {/* Worker cards */}
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: workers.total }).map((_, i) => {
              const isActive = i < workers.active;
              const util = isActive ? workers.maxUtilization - i * (workers.maxUtilization - workers.avgUtilization) / (workers.active - 1 || 1) : 0;
              return (
                <div key={i} className={`bg-[#111119] border rounded-xl p-4 text-center ${isActive ? 'border-green-500/20' : 'border-white/5'}`}>
                    <div className="text-2xl mb-1">{isActive ? '🟢' : '⚫'}</div>
                    <div className="text-xs font-semibold text-gray-300">Worker #{i + 1}</div>
                    <div className="text-[10px] text-gray-600 mt-1">{isActive ? i18n.t('BacktestPerformancePanel.k33') : i18n.t('BacktestPerformancePanel.k34')}</div>
                    {isActive &&
                  <div className="mt-2">
                        <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{
                        width: `${util}%`,
                        background: util > 90 ? '#ef4444' : util > 70 ? '#fbbf24' : '#22c55e'
                      }} />
                        </div>
                        <div className="text-[9px] text-gray-500 mt-0.5">{util.toFixed(0)}%</div>
                      </div>
                  }
                  </div>);

            })}
            </div>

            {/* Workers summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#111119] border border-white/5 rounded-xl p-4 flex flex-col items-center">
                <Gauge value={workers.avgUtilization} label={i18n.t('BacktestPerformancePanel.k35')} max={100} color="#fbbf24" />
              </div>
              <div className="bg-[#111119] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-gray-200">{workers.active}/{workers.total}</div>
                <div className="text-[10px] text-gray-600 mt-1">{i18n.t('BacktestPerformancePanel.k36')}</div>
                <div className="text-xs text-gray-500 mt-2">{i18n.t('BacktestPerformancePanel.k37')}</div>
              </div>
              <div className="bg-[#111119] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-[#D4A853]">{workers.maxUtilization.toFixed(0)}%</div>
                <div className="text-[10px] text-gray-600 mt-1">{i18n.t('BacktestPerformancePanel.k38')}</div>
                <button onClick={onRunBenchmark}
              className="mt-2 px-3 py-1 rounded text-[10px] bg-[#C9A046]/10 text-[#D4A853] hover:bg-[#C9A046]/20 transition-colors">{i18n.t("BacktestPerformancePanel.r92_74bc")}

              </button>
              </div>
            </div>

            {/* Architecture note */}
            <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
              <h4 className="text-gray-300 font-semibold text-sm mb-3">{i18n.t('BacktestPerformancePanel.k39')}</h4>
              <div className="text-xs text-gray-500 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">●</span>{i18n.t("BacktestPerformancePanel.r92_c047")}
              </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#D4A853]">●</span>{i18n.t("BacktestPerformancePanel.r92_406b")}
              </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">●</span>{i18n.t("BacktestPerformancePanel.r92_2f15")}
              </div>
                <div className="flex items-center gap-2">
                  <span className="text-purple-400">●</span>{i18n.t("BacktestPerformancePanel.r92_1062")}
              </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">●</span>{i18n.t("BacktestPerformancePanel.r92_633c")}
              </div>
              </div>
            </div>
          </div>
        }
      </div>
    </div>);

}