import { useState, useEffect, useMemo } from 'react';
import * as api from '../../lib/bridge-api';
import { generatePDFReport, backtestToReport } from '../../lib/pdf-report';
import ParamScanPanel from './ParamScanPanel';
import WalkForwardPanel from './WalkForwardPanel';
import { useTranslation } from "react-i18next";

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
  equityCurve: { date: string; value: number }[];
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
  const [tradeSort, setTradeSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'entryDate', dir: 'desc' });
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
    } catch { /* silent */ }
  }

  async function runBacktest() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await api.runBacktest({ strategyId: selectedId, days });
      if (res?.success) {
        setResult(res.result);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }

  async function runParamScan() {
    if (!selectedId) return;
    setParamScanLoading(true);
    try {
      const res = await api.runParamScan({ strategyId: selectedId });
      if (res?.success) {
        setParamScanResult(res.result);
      }
    } catch { /* silent */ } finally { setParamScanLoading(false); }
  }

  async function runWFA() {
    if (!selectedId) return;
    setWfaLoading(true);
    try {
      const res = await api.runWalkForwardV2({ strategyId: selectedId });
      if (res?.success) {
        setWfaResult(res.result);
      }
    } catch { /* silent */ } finally { setWfaLoading(false); }
  }

  function exportCSV() {
    if (!result) return;
    const rows = [
      [t('components.date'), t('components.direction'), '入场价', '出场价', '盈亏', '盈亏%', '持有天数'],
      ...result.trades.map((t) => [
        t.entryDate, t.side, t.entryPrice.toFixed(2), t.exitPrice.toFixed(2),
        t.pnl.toFixed(2), (t.pnlPercent * 100).toFixed(2) + '%', t.holdingDays,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    downloadFile(csv, `backtest-${result.strategyName}-${result.targetCode}.csv`, 'text/csv');
  }

  function exportReport() {
    if (!result) return;
    const lines = [
      `# 回测报告: ${result.strategyName}`,
      `标的: ${result.targetCode}`,
      `周期: ${result.startDate} ~ ${result.endDate}`,
      ``,
      `## 绩效摘要`,
      `初始资金: $${result.initialCapital.toLocaleString()}`,
      `最终资金: $${result.finalCapital.toFixed(2)}`,
      `总收益: ${(result.totalReturn * 100).toFixed(2)}%`,
      `年化收益: ${(result.annualizedReturn * 100).toFixed(2)}%`,
      `最大回撤: ${(result.maxDrawdown * 100).toFixed(2)}%`,
      `夏普比率: ${result.sharpeRatio.toFixed(2)}`,
      `胜率: ${(result.winRate * 100).toFixed(1)}%`,
      `盈亏比: ${result.profitLossRatio.toFixed(2)}`,
      ``,
      `## 交易统计`,
      `总交易次数: ${result.totalTrades}`,
      `盈利次数: ${result.winningTrades}`,
      `亏损次数: ${result.losingTrades}`,
      `平均盈利: $${result.avgWin.toFixed(2)}`,
      `平均亏损: $${result.avgLoss.toFixed(2)}`,
      `最大连胜: ${result.maxConsecutiveWins}`,
      `最大连亏: ${result.maxConsecutiveLosses}`,
      ``,
      `## 交易明细`,
      '日期,方向,入场价,出场价,盈亏,盈亏%,持有天数',
      ...result.trades.map((t) =>
        `${t.entryDate},${t.side},${t.entryPrice.toFixed(2)},${t.exitPrice.toFixed(2)},${t.pnl.toFixed(2)},${(t.pnlPercent * 100).toFixed(2)}%,${t.holdingDays}`
      ),
    ];
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
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  }

  const sortIcon = (field: SortField) =>
    tradeSort.field === field ? (tradeSort.dir === 'desc' ? ' ↓' : ' ↑') : '';

  // Equity curve SVG
  const equitySvg = useMemo(() => {
    if (!result || result.equityCurve.length === 0) return null;
    const data = result.equityCurve;
    const w = 800, h = 220, pad = 30;
    const vals = data.map((d) => d.value);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const range = maxV - minV || 1;
    const step = (w - pad * 2) / (data.length - 1);

    const points = data.map((d, i) => ({
      x: pad + i * step,
      y: pad + (1 - (d.value - minV) / range) * (h - pad * 2),
    }));

    const linePath = `M${points.map((p) => `${p.x},${p.y}`).join(' L')}`;
    const fillPath = `${linePath} L${points[points.length - 1].x},${h - pad} L${pad},${h - pad} Z`;
    const isUp = vals[vals.length - 1] >= vals[0];
    const color = isUp ? '#22c55e' : '#ef4444';

    // Y axis labels
    const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
      y: pad + (1 - pct) * (h - pad * 2),
      label: `$${(minV + pct * range).toFixed(0)}`,
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
        {yLabels.map((yl, i) => (
          <g key={i}>
            <line x1={pad} y1={yl.y} x2={w - pad} y2={yl.y} stroke="#ffffff08" strokeWidth="0.5" />
            <text x={pad - 4} y={yl.y + 3} fill="#ffffff30" fontSize="9" textAnchor="end">{yl.label}</text>
          </g>
        ))}
        {/* Fill */}
        <path d={fillPath} fill="url(#eqGradFull)" />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
        {/* Start/End labels */}
        <text x={pad} y={h - 5} fill="#ffffff40" fontSize="9">{data[0].date}</text>
        <text x={w - pad} y={h - 5} fill="#ffffff40" fontSize="9" textAnchor="end">{data[data.length - 1].date}</text>
      </svg>
    );
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
          <h1 className="text-2xl font-bold text-white mb-1">{t('📈 回测报告')}</h1>
          <p className="text-gray-400 text-sm">{t('独立回测分析 · 权益曲线 · 交易明细 · CSV/PDF 导出')}</p>
        </div>
        <div className="flex gap-2">
          {result && (
            <>
              <button onClick={exportCSV} className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f]">
                📊 导出 CSV
              </button>
              <button onClick={exportReport} className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f]">
                📄 导出报告
              </button>
              <button onClick={() => { if (result) generatePDFReport(backtestToReport(result)); }} className="px-3 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-sm text-amber-400 hover:bg-amber-500/30">
                📑 导出 PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Strategy selector */}
      {!selectedId && (
        <div className="bg-[#12121a] rounded-xl border border-white/5 p-6">
          <div className="text-lg font-medium text-white mb-4">{t('选择策略进行回测')}</div>
          <div className="grid grid-cols-2 gap-3">
            {strategies.map((s: unknown) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="p-4 rounded-xl border border-white/5 bg-[#1a1a25] hover:border-amber-500/30 text-left transition-colors"
              >
                <div className="text-white font-medium mb-1">{s.name}</div>
                <div className="text-xs text-gray-500">{s.targetCode} · {s.strategyType}</div>
              </button>
            ))}
          </div>
          {strategies.length === 0 && (
            <div className="text-center py-8 text-gray-600">{t('暂无策略，请先在策略工坊创建')}</div>
          )}
        </div>
      )}

      {/* Backtest config + run */}
      {selectedId && !result && (
        <div className="bg-[#12121a] rounded-xl border border-white/5 p-6 max-w-lg mx-auto">
          <div className="text-lg font-medium text-white mb-4">{t('回测配置')}</div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">{t("components.strategy")}</label>
              <div className="text-white">{strategies.find((s) => s.id === selectedId)?.name}</div>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">{t('回测周期')}</label>
              <div className="flex gap-2">
                {[90, 180, 365, 730].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`px-4 py-2 rounded-lg text-sm border ${days === d ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'border-white/5 text-gray-400 hover:bg-white/5'}`}
                  >
                    {d === 90 ? '3个月' : d === 180 ? '6个月' : d === 365 ? '1年' : '2年'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedId(null)} className="px-4 py-2 border border-white/5 rounded-lg text-sm text-gray-400 hover:bg-white/5">{t('goBack')}</button>
              <button
                onClick={runBacktest}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-sm text-amber-400 hover:bg-amber-500/30 font-medium"
              >
                {loading ? '⏳ 回测中...' : '🚀 开始回测'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-[#12121a] rounded-lg p-1 w-fit">
            {([['overview', '📊 绩效概览'], ['equity', '📈 权益曲线'], ['trades', '📋 交易明细'], ['enhanced', '🔬 增强分析']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 rounded-md text-sm transition-colors ${tab === key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {label}
              </button>
            ))}
            <button onClick={() => { setResult(null); setSelectedId(null); setParamScanResult(null); setWfaResult(null); }} className="px-4 py-2 rounded-md text-sm text-gray-500 hover:text-gray-300 ml-2">
              ← 换策略
            </button>
          </div>

          {/* Overview */}
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  [t('components.totalReturn'), `${(result.totalReturn * 100).toFixed(2)}%`, result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'],
                  ['年化收益', `${(result.annualizedReturn * 100).toFixed(2)}%`, result.annualizedReturn >= 0 ? 'text-emerald-400' : 'text-red-400'],
                  [t('components.maxDrawdown'), `${(result.maxDrawdown * 100).toFixed(2)}%`, 'text-red-400'],
                  ['夏普比率', result.sharpeRatio.toFixed(2), result.sharpeRatio >= 1 ? 'text-emerald-400' : result.sharpeRatio >= 0 ? 'text-yellow-400' : 'text-red-400'],
                  [t('components.winRate'), `${(result.winRate * 100).toFixed(1)}%`, result.winRate >= 0.5 ? 'text-emerald-400' : 'text-red-400'],
                  [t('components.profitLossRatio'), result.profitLossRatio.toFixed(2), result.profitLossRatio >= 1.5 ? 'text-emerald-400' : 'text-yellow-400'],
                  ['总交易', `${result.totalTrades}`, 'text-white'],
                  ['最终资金', `$${result.finalCapital.toFixed(0)}`, result.finalCapital >= result.initialCapital ? 'text-emerald-400' : 'text-red-400'],
                ].map(([label, value, color], i) => (
                  <div key={i} className="p-4 bg-[#12121a] rounded-xl border border-white/5">
                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Monthly returns */}
              {monthlyReturns.length > 0 && (
                <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
                  <div className="text-sm font-medium text-white mb-3">{t('月度收益')}</div>
                  <div className="flex flex-wrap gap-2">
                    {monthlyReturns.map(([month, pnl]) => (
                      <div key={month} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${pnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {month}: {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extra stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('盈利次数')}</div>
                  <div className="text-lg font-bold text-emerald-400">{result.winningTrades}</div>
                  <div className="text-xs text-gray-600">平均 +${result.avgWin.toFixed(2)}</div>
                </div>
                <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('亏损次数')}</div>
                  <div className="text-lg font-bold text-red-400">{result.losingTrades}</div>
                  <div className="text-xs text-gray-600">平均 -${Math.abs(result.avgLoss).toFixed(2)}</div>
                </div>
                <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('最大连胜/连亏')}</div>
                  <div className="text-lg font-bold text-white">{result.maxConsecutiveWins} / {result.maxConsecutiveLosses}</div>
                </div>
              </div>

              {/* Phase 4.1: Auto-Exec Bridge */}
              <div className="p-4 bg-[#C9A046]/10 border border-[#C9A046]/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[#D4A853]">{t('🤖 设置自动执行')}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      将此策略转为定时自动执行任务（每日盘前/每小时），支持 dry-run 模式先模拟验证
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const taskName = `Auto-${result.strategyName || result.targetCode}`;
                        const resp = await window.api?.cron?.schedule({
                          name: taskName,
                          strategyId: result.strategyId,
                          schedule: { type: 'cron', expression: '0 21 * * 1-5' },
                          options: { dryRun: true, enabled: true },
                        });
                        if (resp?.success) {
                          alert(`✅ 定时任务已创建: ${taskName}\n工作日21:00自动执行（dry-run）`);
                        } else {
                          alert(`❌ 创建失败: ${resp?.error || '未知错误'}`);
                        }
                      } catch (err: unknown) {
                        alert('❌ CronScheduler 尚未初始化，请先启动应用');
                      }
                    }}
                    className="px-4 py-2 bg-[#C9A046]/20 hover:bg-[#C9A046]/30 border border-[#C9A046]/30 rounded-lg text-sm text-[#D4A853] font-medium transition-colors shrink-0"
                  >
                    ⚡ Set Auto Schedule
                  </button>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span>{t('⏰ 工作日 21:00 (美东 9:00AM)')}</span>
                  <span>{t('🔒 Dry-run 模式 (模拟下单)')}</span>
                  <span>{t('📋 可在 Settings → Scheduler 管理')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Equity curve */}
          {tab === 'equity' && (
            <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
              <div className="text-sm font-medium text-white mb-3">
                权益曲线 ({result.startDate} ~ {result.endDate})
              </div>
              {equitySvg}
              <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
                <span>初始: ${result.initialCapital.toLocaleString()}</span>
                <span>最终: ${result.finalCapital.toFixed(2)}</span>
                <span className={result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {(result.totalReturn * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          )}

          {/* Trades */}
          {tab === 'trades' && (
            <div className="bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
                <table className="w-full text-sm">
                  <thead className="bg-[#0d0d14] sticky top-0 z-10">
                    <tr className="text-gray-500 text-xs">
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-gray-300" onClick={() => handleSort('entryDate')}>
                        入场日期{sortIcon('entryDate')}
                      </th>
                      <th className="px-4 py-3 text-left">{t("components.direction")}</th>
                      <th className="px-4 py-3 text-right">{t('入场价')}</th>
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-gray-300" onClick={() => handleSort('exitDate')}>
                        出场日期{sortIcon('exitDate')}
                      </th>
                      <th className="px-4 py-3 text-right">{t('出场价')}</th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-gray-300" onClick={() => handleSort('pnl')}>
                        盈亏{sortIcon('pnl')}
                      </th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-gray-300" onClick={() => handleSort('pnlPercent')}>
                        盈亏%{sortIcon('pnlPercent')}
                      </th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-gray-300" onClick={() => handleSort('holdingDays')}>
                        持有{sortIcon('holdingDays')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {sortedTrades.map((t) => (
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
                        <td className="px-4 py-2.5 text-right text-gray-500">{t.holdingDays}天</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-white/5 text-xs text-gray-600 flex justify-between">
                <span>共 {result.trades.length} 笔交易</span>
                <span>胜率 {(result.winRate * 100).toFixed(1)}% · 盈亏比 {result.profitLossRatio.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Enhanced Analysis */}
          {tab === 'enhanced' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{t('🔬 增强分析')}</div>
                  <div className="text-xs text-gray-500">{t('参数扫描 · Walk-Forward · 深度风险指标')}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={runParamScan}
                    disabled={paramScanLoading}
                    className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-xs text-gray-300 hover:bg-[#22222f]"
                  >
                    {paramScanLoading ? '⏳ 扫描中...' : '🔬 参数扫描'}
                  </button>
                  <button
                    onClick={runWFA}
                    disabled={wfaLoading}
                    className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-xs text-gray-300 hover:bg-[#22222f]"
                  >
                    {wfaLoading ? '⏳ 分析中...' : '🔄 Walk-Forward'}
                  </button>
                </div>
              </div>

              {/* Param Scan */}
              <ParamScanPanel result={paramScanResult} loading={paramScanLoading} />

              {/* Walk-Forward */}
              <WalkForwardPanel result={wfaResult} loading={wfaLoading} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
