/**
 * ── R162 ML + R163 PM: FactorExposurePage — Human-Readable Factor Cards + Real IPC Data
 * P0-H1+P0-H3: Chinese factor names, color bars, one-line summaries,
 * click-to-expand timeline, click-to-reveal comparison.
 * Raw p-Values hidden behind a foldable toggle.
 *
 * R163 P0-U1: Removed MOCK_DATA, now fetches real data via IPC bridge (getPerformance).
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { getPerformance } from '@/lib/bridge-api';

// ── Types ──────────────────────────────────────────────────────────────────

interface FactorData {
  factor: string;
  name: string;
  nameCN?: string;
  oneLine?: string;
  exposure: number;
  contribution: number;
  tStat: number;
  pValue: number;
  significance: '***' | '**' | '*' | 'ns';
}

interface FactorExposureResult {
  strategyName: string;
  rSquared: number;
  residualPnL: number;
  totalPnL: number;
  explainedPnL: number;
  factors: FactorData[];
  monthlyResiduals: { month: string; residual: number }[];
  factorCorrelation: { factor1: string; factor2: string; correlation: number }[];
  isSimulated: boolean;
  simulatedFactors: string[];
}

// ── Color-band helper ──────────────────────────────────────────────────────

type Band = 'green' | 'yellow' | 'red';

function getBand(exposure: number, direction: 'higherBetter' | 'lowerBetter' | 'neutral'): Band {
  const absVal = Math.abs(exposure);
  if (direction === 'higherBetter') {
    if (exposure > 0.3) return 'green';
    if (exposure < -0.3) return 'red';
    return 'yellow';
  }
  if (direction === 'lowerBetter') {
    if (exposure < -0.3) return 'green';
    if (exposure > 0.3) return 'red';
    return 'yellow';
  }
  // neutral: just show intensity
  if (absVal > 0.6) return 'red';
  if (absVal > 0.3) return 'yellow';
  return 'green';
}

function bandColor(band: Band): string {
  if (band === 'green') return 'bg-emerald-500';
  if (band === 'yellow') return 'bg-yellow-500';
  return 'bg-red-500';
}

function bandTextColor(band: Band): string {
  if (band === 'green') return 'text-emerald-400';
  if (band === 'yellow') return 'text-yellow-400';
  return 'text-red-400';
}

// Direction info per factor (can be extended with factor-i18n-map later)
const FACTOR_DIRECTIONS: Record<string, { direction: 'higherBetter' | 'lowerBetter' | 'neutral'; nameCN: string; oneLine: string }> = {
  MKT:  { direction: 'neutral', nameCN: '市场 Beta', oneLine: '对大盘的敏感度，>1 放大涨跌，<1 相对抗跌' },
  SMB:  { direction: 'higherBetter', nameCN: '小盘因子', oneLine: '偏向小盘股的程度，小盘长期有超额收益' },
  HML:  { direction: 'higherBetter', nameCN: '价值因子', oneLine: '偏向低估值（高账面/市价比）股票' },
  RMW:  { direction: 'higherBetter', nameCN: '盈利因子', oneLine: '偏向高经营利润率公司，盈利越好越强' },
  CMA:  { direction: 'lowerBetter', nameCN: '投资因子', oneLine: '偏向保守投资的公司，扩张过快反而弱' },
  MOM:  { direction: 'higherBetter', nameCN: '动量因子', oneLine: '偏向近期强势股，趋势延续性是利润来源' },
  LOWVOL:{ direction: 'lowerBetter', nameCN: '低波因子', oneLine: '偏向低波动股票，低波异常是防御型首选' },
  QUAL: { direction: 'higherBetter', nameCN: '品质因子', oneLine: '偏向高ROE/高利润率，质优公司长期更稳健' },
};

// ── Component ──────────────────────────────────────────────────────────────

export default function FactorExposurePage() {
  const { t } = useTranslation(); void t;
  const [data, setData] = useState<FactorExposureResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showRawStats, setShowRawStats] = useState(false);
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

  // ── Fetch factor exposure from electron engine ──────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const result = await getPerformance('default');
        if (cancelled) return;
        if (result?.success && result.attribution) {
          const attr = result.attribution;
          setData({
            strategyName: attr.strategyName || result.strategyName || '当前策略',
            rSquared: attr.rSquared ?? 0,
            residualPnL: attr.residualPnL ?? 0,
            totalPnL: attr.totalPnL ?? 0,
            explainedPnL: (attr.totalPnL ?? 0) - (attr.residualPnL ?? 0),
            factors: (attr.factorExposures || attr.loadings ? Object.entries(attr.loadings || {}) : []).map(
              ([key, val]: [string, unknown]) => {
                const meta = FACTOR_DIRECTIONS[key];
                return {
                  factor: key,
                  name: meta?.nameCN || key,
                  nameCN: meta?.nameCN,
                  oneLine: meta?.oneLine,
                  exposure: typeof val === 'number' ? val : 0,
                  contribution: attr.contributions?.find((c: Record<string, unknown>) => c.factor === key)?.contributionAbs || 0,
                  tStat: 0,
                  pValue: 0,
                  significance: 'ns' as const,
                };
              },
            ) || [],
            monthlyResiduals: attr.monthlyResiduals || [],
            factorCorrelation: attr.factorCorrelation || [],
            isSimulated: attr.isSimulated ?? true,
            simulatedFactors: attr.simulatedFactors || [],
          });
        } else {
          setError('无法获取因子暴露数据');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '数据加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // ══ Charts (only when data is available) ════════════════════════════════════

  // Factor radar
  useEffect(() => {
    if (!data) return;
    const el = document.getElementById('factor-radar-chart');
    if (!el) return;
    const c = echarts.init(el, undefined, { renderer: 'canvas' });
    c.setOption({
      backgroundColor: 'transparent',
      radar: {
        indicator: data.factors.map((f) => {
          const meta = FACTOR_DIRECTIONS[f.factor];
          return { name: (meta?.nameCN || f.factor).slice(0, 6), max: 1 };
        }),
        radius: '60%',
        axisName: { color: '#9ca3af', fontSize: 10 },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      series: [{
        type: 'radar',
        data: [{ value: data.factors.map((f) => Math.abs(f.exposure)), name: '暴露度', areaStyle: { color: 'rgba(201,160,70,0.2)' }, lineStyle: { color: '#C9A046', width: 2 }, itemStyle: { color: '#C9A046' } }],
      }],
    });
    return () => c.dispose();
  }, [data]);

  // Contribution bar
  useEffect(() => {
    if (!data) return;
    const el = document.getElementById('factor-contribution-chart');
    if (!el) return;
    const c = echarts.init(el, undefined, { renderer: 'canvas' });
    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      grid: { left: 60, right: 20, top: 10, bottom: 20 },
      xAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 9, formatter: '${value}' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      yAxis: { type: 'category', data: data.factors.map((f) => (FACTOR_DIRECTIONS[f.factor]?.nameCN || f.factor)).reverse(), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#9ca3af', fontSize: 10 } },
      series: [{ type: 'bar', data: [...data.factors].reverse().map((f) => ({ value: f.contribution, itemStyle: { color: f.contribution >= 0 ? '#ef4444' : '#10b981' } })), barWidth: '50%', label: { show: true, position: 'right', color: '#e5e7eb', fontSize: 9, formatter: (p: any) => '$' + p.value } }],
    });
    return () => c.dispose();
  }, [data]);

  // Residual chart (only when expanded)
  useEffect(() => {
    if (!data || !showTimeline) return;
    const el = document.getElementById('residual-chart');
    if (!el) return;
    const c = echarts.init(el, undefined, { renderer: 'canvas' });
    c.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      grid: { left: 50, right: 20, top: 10, bottom: 20 },
      xAxis: { type: 'category', data: data.monthlyResiduals.map((r) => r.month), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 9 } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 9, formatter: '${value}' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: [{ type: 'bar', data: data.monthlyResiduals.map((r) => ({ value: r.residual, itemStyle: { color: r.residual >= 0 ? '#ef4444' : '#10b981' } })), barWidth: '50%' }],
    });
    return () => c.dispose();
  }, [data, showTimeline]);

  // ── Rendering ────────────────────────────────────────────────────────────

  if (loading) return <LoadingSpinner fullscreen text="加载因子暴露分析..." />;
  if (error) return (
    <div className="p-6 min-h-full bg-deep flex flex-col items-center justify-center">
      <div className="text-red-400 text-lg font-semibold mb-2">⚠️ 数据加载失败</div>
      <p className="text-gray-500 text-sm mb-4">{error}</p>
      <button onClick={() => window.location.reload()} className="px-4 py-2 bg-[#C9A046] text-black rounded-lg text-sm">
        刷新页面
      </button>
    </div>
  );
  if (!data || data.factors.length === 0) return (
    <div className="p-6 min-h-full bg-deep flex flex-col items-center justify-center">
      <div className="text-gray-400 text-lg font-semibold mb-2">📊 暂无因子暴露数据</div>
      <p className="text-gray-600 text-sm">请先运行策略或确保引擎已连接</p>
    </div>
  );

  // Build a one-line summary
  const dominantFactor = [...data.factors].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0];
  const dominantMeta = dominantFactor ? FACTOR_DIRECTIONS[dominantFactor.factor] : null;
  return (
    <div className="p-6 space-y-5 bg-deep min-h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">🔬 因子暴露分析</h1>
        <p className="text-gray-400 text-sm">{data.strategyName} · 收益归因</p>
      </div>

      {/* ⚠️ Simulated data warning */}
      {data.isSimulated && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-yellow-400">⚠️</span>
            <div>
              <span className="text-yellow-300 text-xs font-semibold">此报告部分基于模拟数据</span>
              <span className="text-yellow-200/60 text-xs ml-2">
                以下因子使用估算值：{data.simulatedFactors.map((f) => FACTOR_DIRECTIONS[f]?.nameCN || f).join('、')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Card 1: One-line summary ─────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#1a1a25] to-[#1a1a28] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">📊</span>
          <div>
            <h2 className="text-sm font-semibold text-white">一句话归因</h2>
            <p className="text-xs text-gray-500">你的策略收益从哪里来</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-200 leading-relaxed">
            <span className="text-[#C9A046] font-semibold">R² = {(data.rSquared * 100).toFixed(0)}%</span>
            {' '}的收益可以被因子模型解释。
            其中{' '}
            <span className="font-semibold text-white">{dominantMeta?.nameCN || dominantFactor?.factor}</span>
            {' '}贡献最大，达{' '}
            <span className={`font-mono font-bold ${(dominantFactor?.contribution || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${Math.abs(dominantFactor?.contribution || 0).toLocaleString()}
            </span>
            {'，'}暴露度为{' '}
            <span className="font-mono text-white">{(dominantFactor?.exposure || 0).toFixed(2)}</span>
            {dominantMeta?.oneLine ? `，${dominantMeta.oneLine}` : ''}。
          </p>
        </div>
      </div>

      {/* ── Card 2: Factor cards with progressive disclosure ─────── */}

      {/* Model Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '模型解释度', value: `${(data.rSquared * 100).toFixed(1)}%`, color: 'text-[#C9A046]' },
          { label: '总收益', value: `+$${data.totalPnL.toLocaleString()}`, color: 'text-red-400' },
          { label: '因子解释', value: `$${data.explainedPnL.toLocaleString()}`, color: 'text-[#D4A853]' },
          { label: '特质收益', value: `${data.residualPnL >= 0 ? '+' : ''}$${data.residualPnL.toLocaleString()}`, color: data.residualPnL >= 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map((m, i) => (
          <div key={i} className="bg-[#1a1a25] border border-white/5 rounded-xl p-3 text-center">
            <p className={`text-lg font-mono font-bold ${m.color}`}>{m.value}</p>
            <span className="text-[10px] text-gray-500">{m.label}</span>
          </div>
        ))}
      </div>

      {/* Radar + Contribution charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-white mb-3">因子暴露雷达</h3>
          <div id="factor-radar-chart" className="w-full h-[260px]" />
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-white mb-3">收益贡献排名</h3>
          <div id="factor-contribution-chart" className="w-full h-[260px]" />
        </div>
      </div>

      {/* ── Card 3: Expandable factor cards ─────────────────────── */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white">因子详情</h3>
          <button
            onClick={() => setShowRawStats(!showRawStats)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${showRawStats ? 'bg-white/10 text-gray-300 border-white/20' : 'text-gray-600 border-white/5 hover:text-gray-400'}`}
          >
            {showRawStats ? '收起统计数据' : '显示 t-统计 / p-值'}
          </button>
        </div>

        <div className="divide-y divide-white/[0.03]">
          {data.factors.map((f) => {
            const meta = FACTOR_DIRECTIONS[f.factor];
            const band = getBand(f.exposure, meta?.direction || 'higherBetter');
            const isExpanded = expandedFactor === f.factor;

            return (
              <div key={f.factor}>
                <button
                  onClick={() => setExpandedFactor(isExpanded ? null : f.factor)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left"
                >
                  {/* Color band indicator */}
                  <div className={`w-1.5 h-10 rounded-full ${bandColor(band)}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{meta?.nameCN || f.name}</span>
                      {f.significance !== 'ns' && (
                        <span className={`text-[10px] font-bold ${f.significance === '***' ? 'text-red-400' : f.significance === '**' ? 'text-orange-400' : 'text-yellow-400'}`}>
                          {f.significance}
                        </span>
                      )}
                    </div>
                    {meta?.oneLine && (
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{meta.oneLine}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-mono font-bold text-white">{f.exposure.toFixed(2)}</span>
                      <span className={`text-xs font-mono ${f.contribution >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {f.contribution >= 0 ? '+' : ''}${Math.abs(f.contribution).toLocaleString()}
                      </span>
                    </div>
                    {/* Mini bar */}
                    <div className="w-16 h-1 bg-white/5 rounded-full mt-1 ml-auto">
                      <div
                        className={`h-full rounded-full ${bandColor(band)}`}
                        style={{ width: `${Math.min(100, Math.abs(f.exposure) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <span className={`text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.03]">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-gray-600">暴露度</span>
                        <p className="text-white font-mono mt-0.5">{f.exposure.toFixed(4)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">贡献</span>
                        <p className={`font-mono mt-0.5 ${f.contribution >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>${f.contribution.toLocaleString()}</p>
                      </div>
                      {showRawStats && (
                        <>
                          <div>
                            <span className="text-gray-600">t 统计量</span>
                            <p className="text-white font-mono mt-0.5">{f.tStat.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">p 值</span>
                            <p className="text-white font-mono mt-0.5">{f.pValue.toFixed(4)}</p>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className={`text-[10px] px-1.5 py-0.5 rounded ${bandTextColor(band)} bg-white/5`}>
                        {band === 'green' ? '✅ 正常' : band === 'yellow' ? '⚠️ 关注' : '🔴 注意'}
                      </div>
                      <span className="text-[10px] text-gray-600">
                        {meta?.direction === 'higherBetter' ? '偏多方向' : meta?.direction === 'lowerBetter' ? '偏空方向' : '中性'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Card 4: Click to show timeline ────────────────────── */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="flex items-center justify-between w-full text-left"
        >
          <div>
            <h3 className="text-xs font-semibold text-white">月度残差收益</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {showTimeline ? '点击收起' : '点击展开时序图 →'}
            </p>
          </div>
          <span className={`text-gray-600 transition-transform ${showTimeline ? 'rotate-90' : ''}`}>▶</span>
        </button>

        {showTimeline && (
          <div id="residual-chart" className="w-full h-[180px] mt-3" />
        )}
      </div>

      {/* ── Card 5: Click to show factor correlations ──────────── */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
        <button
          onClick={() => setShowCompare(!showCompare)}
          className="flex items-center justify-between w-full text-left"
        >
          <div>
            <h3 className="text-xs font-semibold text-white">因子相关性</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {showCompare ? '点击收起' : '点击展开相关性矩阵 →'}
            </p>
          </div>
          <span className={`text-gray-600 transition-transform ${showCompare ? 'rotate-90' : ''}`}>▶</span>
        </button>

        {showCompare && (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.factorCorrelation.map((c, idx) => {
              const label1 = FACTOR_DIRECTIONS[c.factor1]?.nameCN || c.factor1;
              const label2 = FACTOR_DIRECTIONS[c.factor2]?.nameCN || c.factor2;
              return (
                <div key={idx} className="bg-deep rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-500">{label1} ↔ {label2}</div>
                  <div className={`text-xs font-mono font-bold ${c.correlation > 0.5 ? 'text-red-400' : c.correlation > 0.3 ? 'text-yellow-400' : 'text-gray-300'}`}>
                    {c.correlation.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
