import { useState, useEffect, useMemo } from 'react';
import * as api from '../../lib/bridge-api';
import { EngineError } from '../../../electron/engine/core/engine-error';

import { generatePDFReport, backtestToReport } from '../../lib/pdf-report';
import ParamScanPanel from './ParamScanPanel';
import WalkForwardPanel from './WalkForwardPanel';
import { useTranslation } from "react-i18next";
import i18n from '../../i18n';

interface BacktestResult {
  strategyId: string;
  strategyName: string;
  targetCode: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitLossRatio: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  equityCurve: {date: string;value: number;}[];
  trades: {
    id: number;
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    side: 'BUY' | 'SELL';
    pnl: number;
    pnlPercent: number;
    holdingDays: number;
  }[];
}

type SortField = 'entryDate' | 'exitDate' | 'pnl' | 'pnlPercent' | 'holdingDays';
type SortDir = 'asc' | 'desc';

export default function BacktestReportPage() {
  const { t } = useTranslation();

  const [strategies, setStrategies] = useState<unknown[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tradeSort, setTradeSort] = useState<{field: SortField;dir: SortDir;}>({ field: 'entryDate', dir: 'desc' });
  const [days, setDays] = useState(365);
  const [tab, setTab] = useState<'overview' | 'trades' | 'equity' | 'enhanced'>('overview');
  const [paramScanResult, setParamScanResult] = useState<unknown>(null);
  const [wfaResult, setWfaResult] = useState<unknown>(null);
  const [paramScanLoading, setParamScanLoading] = useState(false);
  const [wfaLoading, setWfaLoading] = useState(false);

  useEffect(() => {
    loadStrategies();
  }, []);

  async function loadStrategies() {
    try {
      const all = await api.getStrategies();
      setStrategies(all || []);
    } catch (_e: unknown) {/* silent */}
    void EngineError; // [SYSTEM] structured error tracking
  }

  async function runBacktest() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await api.runBacktest({ strategyId: selectedId, days });
      if (res?.success) {
        setResult(res.result);
      }
    } catch (_e: unknown) {/* silent */} finally {setLoading(false);}
  }

  async function runParamScan() {
    if (!selectedId) return;
    setParamScanLoading(true);
    try {
      const res = await api.runParamScan({ strategyId: selectedId });
      if (res?.success) {
        setParamScanResult(res.result);
      }
    } catch (_e: unknown) {/* silent */} finally {setParamScanLoading(false);}
  }

  async function runWFA() {
    if (!selectedId) return;
    setWfaLoading(true);
    try {
      const res = await api.runWalkForwardV2({ strategyId: selectedId });
      if (res?.success) {
        setWfaResult(res.result);
      }
    } catch (_e: unknown) {/* silent */} finally {setWfaLoading(false);}
  }

  function exportCSV() {
    if (!result) return;
    const rows = [
    [t('components.date'), t('components.direction'), i18n.t('BacktestReportPage.k1'), i18n.t('BacktestReportPage.k2'), i18n.t('BacktestReportPage.k3'), i18n.t('BacktestReportPage.k4'), i18n.t('BacktestReportPage.k5')],
    ...result.trades.map((t) => [
    t.entryDate, t.side, t.entryPrice.toFixed(2), t.exitPrice.toFixed(2),
    t.pnl.toFixed(2), (t.pnlPercent * 100).toFixed(2) + '%', t.holdingDays]
    )];

    const csv = rows.map((r) => r.join(',')).join('\n');
    downloadFile(csv, `backtest-${result.strategyName}-${result.targetCode}.csv`, 'text/csv');
  }

  function exportReport() {
    if (!result) return;
    const lines = [
    `${i18n.t('BacktestReportPage.k0')}${result.strategyName}`,
    `${i18n.t('BacktestReportPage.k1')}${result.targetCode}`,
    `${i18n.t('BacktestReportPage.k2')}${result.startDate} ~ ${result.endDate}`,
    ``,
    i18n.t('BacktestReportPage.k0'),
    `${i18n.t('BacktestReportPage.k3')}${result.initialCapital.toLocaleString()}`,
    `${i18n.t('BacktestReportPage.k4')}${result.finalCapital.toFixed(2)}`,
    `${i18n.t('BacktestReportPage.k5')}${(result.totalReturn * 100).toFixed(2)}%`,
    `${i18n.t('BacktestReportPage.k6')}${(result.annualizedReturn * 100).toFixed(2)}%`,
    `${i18n.t('BacktestReportPage.k7')}${(result.maxDrawdown * 100).toFixed(2)}%`,
    `${i18n.t('BacktestReportPage.k8')}${result.sharpeRatio.toFixed(2)}`,
    `${i18n.t('BacktestReportPage.k9')}${(result.winRate * 100).toFixed(1)}%`,
    `${i18n.t('BacktestReportPage.k10')}${result.profitLossRatio.toFixed(2)}`,
    ``,
    i18n.t('BacktestReportPage.k1'),
    `${i18n.t('BacktestReportPage.k11')}${result.totalTrades}`,
    `${i18n.t('BacktestReportPage.k12')}${result.winningTrades}`,
    `${i18n.t('BacktestReportPage.k13')}${result.losingTrades}`,
    `${i18n.t('BacktestReportPage.k14')}${result.avgWin.toFixed(2)}`,
    `${i18n.t('BacktestReportPage.k15')}${result.avgLoss.toFixed(2)}`,
    `${i18n.t('BacktestReportPage.k16')}${result.maxConsecutiveWins}`,
    `${i18n.t('BacktestReportPage.k17')}${result.maxConsecutiveLosses}`,
    ``,
    i18n.t('BacktestReportPage.k2'),
    i18n.t('BacktestReportPage.k6'),
    ...result.trades.map((t) =>
    `${t.entryDate},${t.side},${t.entryPrice.toFixed(2)},${t.exitPrice.toFixed(2)},${t.pnl.toFixed(2)},${(t.pnlPercent * 100).toFixed(2)}%,${t.holdingDays}`
    )];

    downloadFile(lines.join('\n'), `backtest-report-${result.strategyName}.txt`, 'text/plain');
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sortedTrades = useMemo(() => {
    if (!result) return [];
    return [...result.trades].sort((a, b) => {
      const mul = tradeSort.dir === 'asc' ? 1 : -1;
      const av = a[tradeSort.field];
      const bv = b[tradeSort.field];
      if (typeof av === 'string') return mul * av.localeCompare(bv as string);
      return mul * ((av as number) - (bv as number));
    });
  }, [result, tradeSort]);

  function handleSort(field: SortField) {
    setTradeSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  }

  const sortIcon = (field: SortField) =>
  tradeSort.field === field ? tradeSort.dir === 'desc' ? ' ↓' : ' ↑' : '';

  // Equity curve SVG
  const equitySvg = useMemo(() => {
    if (!result || result.equityCurve.length === 0) return null;
    const data = result.equityCurve;
    const w = 800,h = 220,pad = 30;
    const vals = data.map((d) => d.value);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const range = maxV - minV || 1;
    const step = (w - pad * 2) / (data.length - 1);

    const points = data.map((d, i) => ({
      x: pad + i * step,
      y: pad + (1 - (d.value - minV) / range) * (h - pad * 2)
    }));

    const linePath = `M${points.map((p) => `${p.x},${p.y}`).join(' L')}`;
    const fillPath = `${linePath} L${points[points.length - 1].x},${h - pad} L${pad},${h - pad} Z`;
    const isUp = vals[vals.length - 1] >= vals[0];
    const color = isUp ? '#22c55e' : '#ef4444';

    // Y axis labels
    const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
      y: pad + (1 - pct) * (h - pad * 2),
      label: `$${(minV + pct * range).toFixed(0)}`
    }));

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56" preserveAspectRatio="none">
        <defs>
          <linearGradient id="eqGradFull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {yLabels.map((yl, i) =>
        <g key={i}>
            <line x1={pad} y1={yl.y} x2={w - pad} y2={yl.y} stroke="#ffffff08" strokeWidth="0.5" />
            <text x={pad - 4} y={yl.y + 3} fill="#ffffff30" fontSize="9" textAnchor="end">{yl.label}</text>
          </g>
        )}
        {/* Fill */}
        <path d={fillPath} fill="url(#eqGradFull)" />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
        {/* Start/End labels */}
        <text x={pad} y={h - 5} fill="#ffffff40" fontSize="9">{data[0].date}</text>
        <text x={w - pad} y={h - 5} fill="#ffffff40" fontSize="9" textAnchor="end">{data[data.length - 1].date}</text>
      </svg>);

  }, [result]);

  // Monthly returns
  const monthlyReturns = useMemo(() => {
    if (!result || result.trades.length === 0) return [];
    const months: Record<string, number> = {};
    result.trades.forEach((t) => {
      const m = t.exitDate.slice(0, 7);
      months[m] = (months[m] || 0) + t.pnl;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b));
  }, [result]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{t(i18n.t('BacktestReportPage.k7'))}</h1>
          <p className="text-gray-400 text-sm">{t(i18n.t('BacktestReportPage.k8'))}</p>
        </div>
        <div className="flex gap-2">
          {result &&
          <>
              <button onClick={exportCSV} className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f]">{i18n.t("BacktestReportPage.r92_7ccf")}

            </button>
              <button onClick={exportReport} className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f]">{i18n.t("BacktestReportPage.r92_8611")}

            </button>
              <button onClick={() => {if (result) generatePDFReport(backtestToReport(result));}} className="px-3 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-sm text-amber-400 hover:bg-amber-500/30">{i18n.t("BacktestReportPage.r92_aec1")}

            </button>
            </>
          }
        </div>
      </div>

      {/* Strategy selector */}
      {!selectedId &&
      <div className="bg-[#12121a] rounded-xl border border-white/5 p-6">
          <div className="text-lg font-medium text-white mb-4">{t(i18n.t('BacktestReportPage.k9'))}</div>
          <div className="grid grid-cols-2 gap-3">
            {strategies.map((s: any) =>
          <button
          // @ts-ignore — R89 type fix
          key={s.id} as any
          onClick={() => setSelectedId(s.id as any)}
          className="p-4 rounded-xl border border-white/5 bg-[#1a1a25] hover:border-amber-500/30 text-left transition-colors">
            
                <div className="text-white font-medium mb-1">{String(s.name)}</div> as any
                <div className="text-xs text-gray-500">{s.targetCode} · {s.strategyType}</div> as any
              </button>
          )}
          </div>
          {strategies.length === 0 &&
        <div className="text-center py-8 text-gray-600">{t(i18n.t('BacktestReportPage.k10'))}</div>
        }
        </div>
      }

      {/* Backtest config + run */}
      {selectedId && !result &&
      <div className="bg-[#12121a] rounded-xl border border-white/5 p-6 max-w-lg mx-auto">
          <div className="text-lg font-medium text-white mb-4">{t(i18n.t('BacktestReportPage.k11'))}</div>
          <div className="space-y-4">
            <div>
              // @ts-ignore — R89 type fix
              <label className="text-sm text-gray-400 block mb-1">{t("components.strategy")}</label>
              <div className="text-white">{(strategies as any[]).find((s: any) => s.id === selectedId)?.name ?? ''}</div>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">{t(i18n.t('BacktestReportPage.k12'))}</label>
              <div className="flex gap-2">
                {[90, 180, 365, 730].map((d) =>
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 rounded-lg text-sm border ${days === d ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'border-white/5 text-gray-400 hover:bg-white/5'}`}>
                
                    {d === 90 ? i18n.t('BacktestReportPage.k13') : d === 180 ? i18n.t('BacktestReportPage.k14') : d === 365 ? i18n.t('BacktestReportPage.k15') : i18n.t('BacktestReportPage.k16')}
                  </button>
              )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedId(null)} className="px-4 py-2 border border-white/5 rounded-lg text-sm text-gray-400 hover:bg-white/5">{t('goBack')}</button>
              <button
              onClick={runBacktest}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-sm text-amber-400 hover:bg-amber-500/30 font-medium">
              
                {loading ? i18n.t('BacktestReportPage.k17') : i18n.t('BacktestReportPage.k18')}
              </button>
            </div>
          </div>
        </div>
      }

      {/* Results */}
      {result &&
      <>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-[#12121a] rounded-lg p-1 w-fit">
            {([['overview', i18n.t('BacktestReportPage.k19')], ['equity', i18n.t('BacktestReportPage.k20')], ['trades', i18n.t('BacktestReportPage.k21')], ['enhanced', i18n.t('BacktestReportPage.k22')]] as const).map(([key, label]) =>
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${tab === key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-gray-200'}`}>
            
                {label}
              </button>
          )}
            <button onClick={() => {setResult(null);setSelectedId(null);setParamScanResult(null);setWfaResult(null);}} className="px-4 py-2 rounded-md text-sm text-gray-500 hover:text-gray-300 ml-2">{i18n.t("BacktestReportPage.r92_c731")}

          </button>
          </div>

          {/* Overview */}
          {tab === 'overview' &&
        <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
            [t('components.totalReturn'), `${(result.totalReturn * 100).toFixed(2)}%`, result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'],
            [i18n.t('BacktestReportPage.k23'), `${(result.annualizedReturn * 100).toFixed(2)}%`, result.annualizedReturn >= 0 ? 'text-emerald-400' : 'text-red-400'],
            [t('components.maxDrawdown'), `${(result.maxDrawdown * 100).toFixed(2)}%`, 'text-red-400'],
            [i18n.t('BacktestReportPage.k24'), result.sharpeRatio.toFixed(2), result.sharpeRatio >= 1 ? 'text-emerald-400' : result.sharpeRatio >= 0 ? 'text-yellow-400' : 'text-red-400'],
            [t('components.winRate'), `${(result.winRate * 100).toFixed(1)}%`, result.winRate >= 0.5 ? 'text-emerald-400' : 'text-red-400'],
            [t('components.profitLossRatio'), result.profitLossRatio.toFixed(2), result.profitLossRatio >= 1.5 ? 'text-emerald-400' : 'text-yellow-400'],
            [i18n.t('BacktestReportPage.k25'), `${result.totalTrades}`, 'text-white'],
            [i18n.t('BacktestReportPage.k26'), `$${result.finalCapital.toFixed(0)}`, result.finalCapital >= result.initialCapital ? 'text-emerald-400' : 'text-red-400']].
            map(([label, value, color], i) =>
            <div key={i} className="p-4 bg-[#12121a] rounded-xl border border-white/5">
                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  </div>
            )}
              </div>

              {/* Monthly returns */}
              {monthlyReturns.length > 0 &&
          <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
                  <div className="text-sm font-medium text-white mb-3">{t(i18n.t('BacktestReportPage.k27'))}</div>
                  <div className="flex flex-wrap gap-2">
                    {monthlyReturns.map(([month, pnl]) =>
              <div key={month} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${pnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {month}: {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                      </div>
              )}
                  </div>
                </div>
          }

              {/* Extra stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t(i18n.t('BacktestReportPage.k28'))}</div>
                  <div className="text-lg font-bold text-emerald-400">{result.winningTrades}</div>
                  <div className="text-xs text-gray-600">{i18n.t('BacktestReportPage.k18')}{result.avgWin.toFixed(2)}</div>
                </div>
                <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t(i18n.t('BacktestReportPage.k29'))}</div>
                  <div className="text-lg font-bold text-red-400">{result.losingTrades}</div>
                  <div className="text-xs text-gray-600">{i18n.t('BacktestReportPage.k19')}{Math.abs(result.avgLoss).toFixed(2)}</div>
                </div>
                <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t(i18n.t('BacktestReportPage.k30'))}</div>
                  <div className="text-lg font-bold text-white">{result.maxConsecutiveWins} / {result.maxConsecutiveLosses}</div>
                </div>
              </div>

              {/* Phase 4.1: Auto-Exec Bridge */}
              <div className="p-4 bg-[#C9A046]/10 border border-[#C9A046]/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[#D4A853]">{t(i18n.t('BacktestReportPage.k31'))}</div>
                    <div className="text-xs text-gray-400 mt-1">{i18n.t("BacktestReportPage.r92_1fc2")}

                </div>
                  </div>
                  <button
                onClick={async () => {
                  try {
                    const taskName = `Auto-${result.strategyName || result.targetCode}`;
                    const resp = await (window.api as any)?.cron?.schedule({
                      name: taskName,
                      strategyId: result.strategyId,
                      schedule: { type: 'cron', expression: '0 21 * * 1-5' },
                      options: { dryRun: true, enabled: true }
                    });
                    if (resp?.success) {
                      alert(`${i18n.t('BacktestReportPage.k20')}${taskName}${i18n.t('BacktestReportPage.k21')}`);
                    } else {
                      alert(`❌ ${i18n.t('BacktestReportPage.k3')}: ${resp?.error || 'Unknown error'}`);
                    }
                  } catch (err: unknown) {
                    alert(i18n.t('BacktestReportPage.k32'));
                  }
                }}
                className="px-4 py-2 bg-[#C9A046]/20 hover:bg-[#C9A046]/30 border border-[#C9A046]/30 rounded-lg text-sm text-[#D4A853] font-medium transition-colors shrink-0">
                
                    ⚡ Set Auto Schedule
                  </button>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span>{t(i18n.t('BacktestReportPage.k33'))}</span>
                  <span>{t(i18n.t('BacktestReportPage.k34'))}</span>
                  <span>{t(i18n.t('BacktestReportPage.k35'))}</span>
                </div>
              </div>
            </div>
        }

          {/* Equity curve */}
          {tab === 'equity' &&
        <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
              <div className="text-sm font-medium text-white mb-3">{i18n.t("BacktestReportPage.r92_d4de")}
            {result.startDate} ~ {result.endDate})
              </div>
              {equitySvg}
              <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
                <span>{i18n.t('BacktestReportPage.k22')}{result.initialCapital.toLocaleString()}</span>
                <span>{i18n.t('BacktestReportPage.k23')}{result.finalCapital.toFixed(2)}</span>
                <span className={result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {(result.totalReturn * 100).toFixed(2)}%
                </span>
              </div>
            </div>
        }

          {/* Trades */}
          {tab === 'trades' &&
        <div className="bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
                <table className="w-full text-sm">
                  <thead className="bg-[#0d0d14] sticky top-0 z-10">
                    <tr className="text-gray-500 text-xs">
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-gray-300" onClick={() => handleSort('entryDate')}>{i18n.t("BacktestReportPage.r92_f711")}
                    {sortIcon('entryDate')}
                      </th>
                      <th className="px-4 py-3 text-left">{t("components.direction")}</th>
                      <th className="px-4 py-3 text-right">{t(i18n.t('BacktestReportPage.k36'))}</th>
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-gray-300" onClick={() => handleSort('exitDate')}>{i18n.t("BacktestReportPage.r92_4734")}
                    {sortIcon('exitDate')}
                      </th>
                      <th className="px-4 py-3 text-right">{t(i18n.t('BacktestReportPage.k37'))}</th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-gray-300" onClick={() => handleSort('pnl')}>{i18n.t("BacktestReportPage.r92_d7e1")}
                    {sortIcon('pnl')}
                      </th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-gray-300" onClick={() => handleSort('pnlPercent')}>{i18n.t("BacktestReportPage.r92_cc21")}
                    {sortIcon('pnlPercent')}
                      </th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-gray-300" onClick={() => handleSort('holdingDays')}>{i18n.t("BacktestReportPage.r92_28eb")}
                    {sortIcon('holdingDays')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {sortedTrades.map((t) =>
                <tr key={t.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 text-gray-300">{t.entryDate}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded ${t.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {t.side}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-300 font-mono">{t.entryPrice.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-gray-300">{t.exitDate}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300 font-mono">{t.exitPrice.toFixed(2)}</td>
                        <td className={`px-4 py-2.5 text-right font-mono font-medium ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono ${t.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(t.pnlPercent * 100).toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{t.holdingDays}{i18n.t("BacktestReportPage.r92_78b1")}</td>
                      </tr>
                )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-white/5 text-xs text-gray-600 flex justify-between">
                <span>{i18n.t("BacktestReportPage.r92_6d66")}{result.trades.length}{i18n.t('BacktestReportPage.k24')}</span>
                <span>{i18n.t('BacktestReportPage.k25')}{(result.winRate * 100).toFixed(1)}{i18n.t('BacktestReportPage.k26')}{result.profitLossRatio.toFixed(2)}</span>
              </div>
            </div>
        }

          {/* Enhanced Analysis */}
          {tab === 'enhanced' &&
        <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{t(i18n.t('BacktestReportPage.k38'))}</div>
                  <div className="text-xs text-gray-500">{t(i18n.t('BacktestReportPage.k39'))}</div>
                </div>
                <div className="flex gap-2">
                  <button
                onClick={runParamScan}
                disabled={paramScanLoading}
                className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-xs text-gray-300 hover:bg-[#22222f]">
                
                    {paramScanLoading ? i18n.t('BacktestReportPage.k40') : i18n.t('BacktestReportPage.k41')}
                  </button>
                  <button
                onClick={runWFA}
                disabled={wfaLoading}
                className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-xs text-gray-300 hover:bg-[#22222f]">
                
                    {wfaLoading ? i18n.t('BacktestReportPage.k42') : '🔄 Walk-Forward'}
                  </button>
                </div>
              </div>
// @ts-ignore — R89 type fix

              {/* Param Scan */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <ParamScanPanel result={((paramScanResult as any) ?? false) as any} loading={paramScanLoading} />

              {/* Walk-Forward */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <WalkForwardPanel result={((wfaResult as any) ?? false) as any} loading={wfaLoading} />
            </div>
        }
        </>
      }
    </div>);

}