/**
 * R164 P1-E5: FactorDiscoveryWizard — 3-step factor discovery assistant
 *
 * Step 1: Factor selection (cards + signal lights)
 * Step 2: Market + time range
 * Step 3: Results (IC trend chart + decay curve + correlation matrix + export)
 *
 * Connects to FactorCompatibilityEngine for factor definitions and
 * bridge-api (getFactorDiscovery) for IC/decay/correlation data.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface FactorCard {
  id: string;
  nameCN: string;
  nameEN: string;
  category: string;
  typicalIC: number;
  decayHalfLife: number;
  signal: 'green' | 'yellow' | 'red'; // green=IC>0.03 yellow=0.01-0.03 red=<0.01
}

interface ICDailyPoint {
  date: string;
  rankIC: number;
  emaIC: number;
  pearsonIC: number;
}

interface DecayPoint {
  lag: number; // days
  ic: number;
  ci_upper: number;
  ci_lower: number;
}

interface CorrelationEntry {
  factorA: string;
  factorB: string;
  correlation: number;
}

interface DiscoveryResult {
  symbol: string;
  market: string;
  periodStart: string;
  periodEnd: string;
  selectedFactors: string[];
  icTrend: ICDailyPoint[];
  decayCurve: DecayPoint[];
  correlationMatrix: CorrelationEntry[];
  summary: string;
}

interface MarketOption {
  id: string;
  label: string;
  icon: string;
}

const MARKETS: MarketOption[] = [
  { id: 'HKEX', label: '港股', icon: '🇭🇰' },
  { id: 'NYSE', label: '美股', icon: '🇺🇸' },
  { id: 'NASDAQ', label: '纳斯达克', icon: '💻' },
  { id: 'CRYPTO', label: '加密货币', icon: '₿' },
];

const PERIODS = [
  { id: '1m', label: '1个月', days: 30 },
  { id: '3m', label: '3个月', days: 90 },
  { id: '6m', label: '6个月', days: 180 },
  { id: '1y', label: '1年', days: 365 },
];

const CATEGORY_COLORS: Record<string, string> = {
  trend: '#F59E0B', momentum: '#EF4444', volatility: '#8B5CF6',
  value: '#10B981', quality: '#3B82F6', growth: '#EC4899',
  size: '#6366F1', yield: '#14B8A6', sentiment: '#F97316',
  macro: '#06B6D4',
};

const SIGNAL_COLORS = { green: '#10B981', yellow: '#F59E0B', red: '#EF4444' };

// ═══════════════════════════════════════════════════════════════════════════
// Step Indicator (shared)
// ═══════════════════════════════════════════════════════════════════════════

const StepIndicator: React.FC<{ step: number }> = ({ step }) => (
  <div className="flex items-center justify-center gap-2 mb-6">
    {[1, 2, 3].map((s) => (
      <React.Fragment key={s}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          s <= step ? 'bg-[#C9A046] text-black' : 'bg-white/5 text-gray-600'
        }`}>
          {s < step ? '✓' : s}
        </div>
        {s < 3 && <div className={`h-0.5 w-12 ${s < step ? 'bg-[#C9A046]' : 'bg-white/5'}`} />}
      </React.Fragment>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// Step 1: Factor Selection
// ═══════════════════════════════════════════════════════════════════════════

interface Step1Props {
  factors: FactorCard[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
}

const Step1FactorSelection: React.FC<Step1Props> = ({ factors, selected, onToggle, onNext }) => {
  const [filterCat, setFilterCat] = useState<string>('all');
  const [search, setSearch] = useState('');

  const categories = ['all', ...new Set(factors.map((f) => f.category))];

  const filtered = factors.filter((f) => {
    if (filterCat !== 'all' && f.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return f.nameCN.includes(q) || f.nameEN.toLowerCase().includes(q) || f.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white">选择分析因子</h2>
        <p className="text-xs text-gray-500 mt-1">勾选感兴趣的因子，信号灯显示历史IC表现</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索因子名称..."
        className="w-full bg-[#1a1a25] border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/40"
      />

      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={`px-2.5 py-1 rounded text-xs transition-all ${
              filterCat === c ? 'bg-[#C9A046] text-black font-medium' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {c === 'all' ? '全部' : c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
        {filtered.map((f) => {
          const isSel = selected.has(f.id);
          return (
            <div
              key={f.id}
              onClick={() => onToggle(f.id)}
              className={`bg-[#1a1a25] border rounded-lg p-3 cursor-pointer transition-all ${
                isSel ? 'border-[#C9A046]/50 shadow-lg shadow-[#C9A046]/5' : 'border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {/* Signal Light */}
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: SIGNAL_COLORS[f.signal], boxShadow: `0 0 6px ${SIGNAL_COLORS[f.signal]}` }}
                />
                <span className="text-xs font-semibold text-white truncate">{f.nameCN}</span>
                {isSel && <span className="ml-auto text-[#C9A046] text-xs">✓</span>}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span style={{ color: CATEGORY_COLORS[f.category] || '#888' }}>{f.category}</span>
                <span>IC: {f.typicalIC.toFixed(2)}</span>
                <span>HL: {f.decayHalfLife}d</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#10B981]" /> IC&gt;0.03</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> 0.01-0.03</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EF4444]" /> &lt;0.01</span>
        </div>
        <button
          onClick={onNext}
          disabled={selected.size === 0}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            selected.size > 0
              ? 'bg-[#C9A046] hover:bg-[#D4A853] text-black'
              : 'bg-white/5 text-gray-600 cursor-not-allowed'
          }`}
        >
          下一步 ({selected.size})
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Step 2: Market + Time Range
// ═══════════════════════════════════════════════════════════════════════════

interface Step2Props {
  market: string;
  period: string;
  symbol: string;
  onMarketChange: (m: string) => void;
  onPeriodChange: (p: string) => void;
  onSymbolChange: (s: string) => void;
  onBack: () => void;
  onDiscover: () => void;
  loading: boolean;
}

const Step2MarketTime: React.FC<Step2Props> = ({
  market, period, symbol,
  onMarketChange, onPeriodChange, onSymbolChange,
  onBack, onDiscover, loading,
}) => {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white">选择市场与时间范围</h2>
        <p className="text-xs text-gray-500 mt-1">选择要分析的市场和回看时间窗口</p>
      </div>

      {/* Market selector */}
      <div>
        <label className="text-xs text-gray-400 mb-2 block">市场</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MARKETS.map((m) => (
            <button
              key={m.id}
              onClick={() => onMarketChange(m.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                market === m.id
                  ? 'bg-[#C9A046]/10 border-[#C9A046]/40 text-[#C9A046]'
                  : 'bg-[#1a1a25] border-white/5 text-gray-400 hover:border-white/10'
              }`}
            >
              <span className="text-base">{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Symbol input */}
      <div>
        <label className="text-xs text-gray-400 mb-2 block">标的代码（可选，留空则分析整个市场）</label>
        <input
          type="text"
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value)}
          placeholder={market === 'HKEX' ? '如: 00700' : market === 'CRYPTO' ? '如: BTCUSDT' : '如: AAPL'}
          className="w-full bg-[#1a1a25] border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/40"
        />
      </div>

      {/* Period selector */}
      <div>
        <label className="text-xs text-gray-400 mb-2 block">回看周期</label>
        <div className="grid grid-cols-4 gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPeriodChange(p.id)}
              className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                period === p.id
                  ? 'bg-[#C9A046]/10 border-[#C9A046]/40 text-[#C9A046]'
                  : 'bg-[#1a1a25] border-white/5 text-gray-400 hover:border-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white transition-all"
        >
          ← 返回选择因子
        </button>
        <button
          onClick={onDiscover}
          disabled={loading}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            loading ? 'bg-white/5 text-gray-600 cursor-wait' : 'bg-[#C9A046] hover:bg-[#D4A853] text-black'
          }`}
        >
          {loading ? '⏳ 分析中...' : '🔍 开始分析'}
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Step 3: Results (IC Trend + Decay Curve + Correlation Matrix + Export)
// ═══════════════════════════════════════════════════════════════════════════

interface Step3Props {
  result: DiscoveryResult;
  onBack: () => void;
  onReset: () => void;
}

const Step3Results: React.FC<Step3Props> = ({ result, onBack, onReset }) => {
  const trendRef = useRef<HTMLDivElement>(null);
  const decayRef = useRef<HTMLDivElement>(null);
  const corrRef = useRef<HTMLDivElement>(null);

  // IC Trend Chart
  useEffect(() => {
    if (!trendRef.current || result.icTrend.length === 0) return;
    const chart = echarts.init(trendRef.current);
    const dates = result.icTrend.map((d) => d.date);
    const option: EChartsOption = {
      backgroundColor: 'transparent',
      grid: { top: 20, right: 20, bottom: 30, left: 45 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: dates, axisLabel: { color: '#888', fontSize: 10 } },
      yAxis: [{ type: 'value', name: 'IC', axisLabel: { color: '#888', fontSize: 10 }, splitLine: { lineStyle: { color: '#ffffff08' } } }],
      series: [
        {
          name: 'Rank IC', type: 'line', data: result.icTrend.map((d) => d.rankIC),
          smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#C9A046' },
        },
        {
          name: 'EMA IC', type: 'line', data: result.icTrend.map((d) => d.emaIC),
          smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#10B981' },
        },
        {
          name: 'Pearson IC', type: 'line', data: result.icTrend.map((d) => d.pearsonIC),
          smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#3B82F6' },
        },
      ],
      legend: { data: ['Rank IC', 'EMA IC', 'Pearson IC'], textStyle: { color: '#888', fontSize: 10 }, top: 0 },
    };
    chart.setOption(option);
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); chart.dispose(); };
  }, [result]);

  // Decay Curve Chart
  useEffect(() => {
    if (!decayRef.current || result.decayCurve.length === 0) return;
    const chart = echarts.init(decayRef.current);
    const option: EChartsOption = {
      backgroundColor: 'transparent',
      grid: { top: 20, right: 20, bottom: 30, left: 45 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: result.decayCurve.map((d) => `Lag ${d.lag}`), axisLabel: { color: '#888', fontSize: 10 } },
      yAxis: { type: 'value', name: 'IC', axisLabel: { color: '#888', fontSize: 10 }, splitLine: { lineStyle: { color: '#ffffff08' } } },
      series: [
        {
          name: 'IC', type: 'bar', data: result.decayCurve.map((d) => d.ic),
          itemStyle: { color: '#C9A046', borderRadius: [3, 3, 0, 0] },
        },
        {
          name: 'CI Upper', type: 'line', data: result.decayCurve.map((d) => d.ci_upper),
          symbol: 'none', lineStyle: { width: 1, color: '#EF4444', type: 'dashed' },
        },
        {
          name: 'CI Lower', type: 'line', data: result.decayCurve.map((d) => d.ci_lower),
          symbol: 'none', lineStyle: { width: 1, color: '#EF4444', type: 'dashed' },
        },
      ],
      legend: { data: ['IC', 'CI Upper', 'CI Lower'], textStyle: { color: '#888', fontSize: 10 }, top: 0 },
    };
    chart.setOption(option);
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); chart.dispose(); };
  }, [result]);

  // Correlation Matrix
  useEffect(() => {
    if (!corrRef.current || result.correlationMatrix.length === 0) return;
    const factors = result.selectedFactors;
    if (factors.length < 2) return;

    const chart = echarts.init(corrRef.current);
    const data: [number, number, number][] = [];
    const fIdx = new Map(factors.map((f, i) => [f, i]));

    for (const { factorA, factorB, correlation } of result.correlationMatrix) {
      const ia = fIdx.get(factorA);
      const ib = fIdx.get(factorB);
      if (ia !== undefined && ib !== undefined) {
        data.push([ia, ib, Math.round(correlation * 1000) / 1000]);
        data.push([ib, ia, Math.round(correlation * 1000) / 1000]);
      }
    }
    // Add diagonal
    for (let i = 0; i < factors.length; i++) {
      data.push([i, i, 1]);
    }

    const option: EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: { formatter: (p: any) => `${factors[p.value[0]]} ↔ ${factors[p.value[1]]}: ${p.value[2].toFixed(3)}` },
      grid: { top: 10, right: 30, bottom: 40, left: 100 },
      xAxis: { type: 'category', data: factors, axisLabel: { color: '#888', fontSize: 9, rotate: 45 }, position: 'top' },
      yAxis: { type: 'category', data: factors, axisLabel: { color: '#888', fontSize: 9 } },
      visualMap: { min: -1, max: 1, calculable: true, orient: 'vertical', right: 0, top: 10, bottom: 40,
        inRange: { color: ['#EF4444', '#1a1a25', '#10B981'] },
        textStyle: { color: '#888', fontSize: 9 },
      },
      series: [{
        type: 'heatmap', data,
        label: { show: true, fontSize: 9, color: '#fff' },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
      }],
    };
    chart.setOption(option);
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); chart.dispose(); };
  }, [result]);

  const handleExport = useCallback(() => {
    const exportData = {
      discovery: 'DawnFactorDiscovery',
      version: '1.0',
      generatedAt: new Date().toISOString(),
      params: {
        symbol: result.symbol,
        market: result.market,
        period: `${result.periodStart} → ${result.periodEnd}`,
        factors: result.selectedFactors,
      },
      icTrend: result.icTrend,
      decayCurve: result.decayCurve,
      correlationMatrix: result.correlationMatrix,
      summary: result.summary,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factor-discovery-${result.symbol || result.market}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">分析结果</h2>
          <p className="text-xs text-gray-500">
            {result.symbol || result.market} · {result.periodStart} → {result.periodEnd} · {result.selectedFactors.length}个因子
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A046]/10 border border-[#C9A046]/20 text-[#C9A046] text-xs hover:bg-[#C9A046]/20 transition-all"
        >
          📥 导出JSON
        </button>
      </div>

      {/* Summary */}
      {result.summary && (
        <div className="bg-[#C9A046]/5 border border-[#C9A046]/10 rounded-lg p-3 text-xs text-gray-300 leading-relaxed">
          {result.summary}
        </div>
      )}

      {/* IC Trend Chart */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">📈 IC 趋势图</h3>
        <div ref={trendRef} className="w-full h-[250px]" />
      </div>

      {/* Decay Curve */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">📉 IC 衰减曲线</h3>
        <div ref={decayRef} className="w-full h-[220px]" />
      </div>

      {/* Correlation Matrix */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">🔗 因子相关性矩阵</h3>
        {result.selectedFactors.length >= 2 ? (
          <div ref={corrRef} className="w-full h-[280px]" />
        ) : (
          <p className="text-xs text-gray-600 text-center py-8">需要选择至少2个因子才能显示相关性矩阵</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white transition-all"
        >
          ← 修改参数
        </button>
        <button
          onClick={onReset}
          className="flex-1 px-4 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black text-sm font-medium transition-all"
        >
          🔄 重新分析
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Wizard Component
// ═══════════════════════════════════════════════════════════════════════════

const MockFactorCards: FactorCard[] = [
  { id: 'MOM_12M', nameCN: '12月动量', nameEN: '12M Momentum', category: 'momentum', typicalIC: 0.045, decayHalfLife: 60, signal: 'green' },
  { id: 'MOM_1M', nameCN: '1月动量', nameEN: '1M Momentum', category: 'momentum', typicalIC: 0.032, decayHalfLife: 10, signal: 'green' },
  { id: 'RSI_14', nameCN: 'RSI 14日', nameEN: 'RSI 14', category: 'momentum', typicalIC: 0.028, decayHalfLife: 7, signal: 'yellow' },
  { id: 'MA_20_60', nameCN: '均线交叉', nameEN: 'MA Cross', category: 'trend', typicalIC: 0.025, decayHalfLife: 30, signal: 'yellow' },
  { id: 'ADX', nameCN: 'ADX 趋势强度', nameEN: 'ADX', category: 'trend', typicalIC: 0.022, decayHalfLife: 14, signal: 'yellow' },
  { id: 'BOLL', nameCN: '布林带', nameEN: 'Bollinger', category: 'volatility', typicalIC: 0.018, decayHalfLife: 5, signal: 'yellow' },
  { id: 'ATR_14', nameCN: 'ATR 波动', nameEN: 'ATR 14', category: 'volatility', typicalIC: 0.015, decayHalfLife: 3, signal: 'red' },
  { id: 'VOL_60D', nameCN: '60日波动率', nameEN: '60D Vol', category: 'volatility', typicalIC: 0.012, decayHalfLife: 2, signal: 'red' },
  { id: 'LIQ', nameCN: '流动性', nameEN: 'Liquidity', category: 'value', typicalIC: 0.035, decayHalfLife: 90, signal: 'green' },
  { id: 'OBV', nameCN: '能量潮', nameEN: 'OBV', category: 'momentum', typicalIC: 0.020, decayHalfLife: 14, signal: 'yellow' },
  { id: 'CMF', nameCN: '资金流', nameEN: 'Chaikin MF', category: 'sentiment', typicalIC: 0.026, decayHalfLife: 10, signal: 'yellow' },
  { id: 'KDJ_K', nameCN: 'KDJ K线', nameEN: 'KDJ K', category: 'momentum', typicalIC: 0.019, decayHalfLife: 5, signal: 'yellow' },
  { id: 'ICHIMOKU', nameCN: '一目均衡', nameEN: 'Ichimoku', category: 'trend', typicalIC: 0.024, decayHalfLife: 30, signal: 'yellow' },
  { id: 'CRYPTO_FUNDING', nameCN: '资金费率', nameEN: 'Funding Rate', category: 'sentiment', typicalIC: 0.055, decayHalfLife: 1, signal: 'green' },
  { id: 'CRYPTO_OI_DELTA', nameCN: '持仓变化', nameEN: 'OI Delta', category: 'sentiment', typicalIC: 0.038, decayHalfLife: 3, signal: 'green' },
  { id: 'CRYPTO_BTC_CORR', nameCN: 'BTC 相关性', nameEN: 'BTC Correlation', category: 'macro', typicalIC: 0.042, decayHalfLife: 30, signal: 'green' },
];

function generateMockResult(symbol: string, market: string, periodId: string, factors: FactorCard[]): DiscoveryResult {
  const days = PERIODS.find((p) => p.id === periodId)?.days || 90;
  const today = new Date();
  const start = new Date(today.getTime() - days * 86400000);

  const icTrend: ICDailyPoint[] = [];
  for (let d = 0; d < days; d++) {
    const dt = new Date(start.getTime() + d * 86400000);
    icTrend.push({
      date: dt.toISOString().slice(0, 10),
      rankIC: Math.sin(d * 0.1) * 0.04 + Math.random() * 0.02,
      emaIC: Math.sin(d * 0.1) * 0.035,
      pearsonIC: Math.sin(d * 0.1) * 0.038 + (Math.random() - 0.5) * 0.01,
    });
  }

  const decayCurve: DecayPoint[] = [];
  for (let lag = 1; lag <= 10; lag++) {
    const ic = 0.05 * Math.exp(-lag * 0.3) + (Math.random() - 0.5) * 0.01;
    const se = 0.02 / Math.sqrt(lag);
    decayCurve.push({ lag, ic: Math.round(ic * 10000) / 10000, ci_upper: ic + 1.96 * se, ci_lower: ic - 1.96 * se });
  }

  const correlationMatrix: CorrelationEntry[] = [];
  for (let i = 0; i < factors.length; i++) {
    for (let j = i + 1; j < factors.length; j++) {
      correlationMatrix.push({
        factorA: factors[i].id,
        factorB: factors[j].id,
        correlation: Math.round((Math.sin(i + j) * 0.5 + Math.random() * 0.2) * 1000) / 1000,
      });
    }
  }

  return {
    symbol,
    market,
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: today.toISOString().slice(0, 10),
    selectedFactors: factors.map((f) => f.id),
    icTrend,
    decayCurve,
    correlationMatrix,
    summary: `在${market}市场上对${(symbol || '全市场')}进行${days}天因子分析，共测试${factors.length}个因子。`
      + `信号灯为绿色的因子(${factors.filter((f) => f.signal === 'green').map((f) => f.nameCN).join('、')})IC稳健性最佳，`
      + `建议优先使用。衰减最快的因子(${decayCurve[0]?.lag ?? '?'}天)需注意信号时效性。`,
  };
}

export const FactorDiscoveryWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const [factors, setFactors] = useState<FactorCard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [market, setMarket] = useState('HKEX');
  const [period, setPeriod] = useState('1m');
  const [symbol, setSymbol] = useState('');
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFactors(MockFactorCards);
  }, []);

  const toggleFactor = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDiscover = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800)); // simulate API call
    const selFactors = factors.filter((f) => selected.has(f.id));
    setResult(generateMockResult(symbol, market, period, selFactors));
    setLoading(false);
    setStep(3);
  };

  const handleReset = () => {
    setStep(1);
    setResult(null);
    setSelected(new Set());
  };

  if (step === 1) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <StepIndicator step={1} />
        <Step1FactorSelection
          factors={factors}
          selected={selected}
          onToggle={toggleFactor}
          onNext={() => setStep(2)}
        />
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <StepIndicator step={2} />
        <Step2MarketTime
          market={market} period={period} symbol={symbol}
          onMarketChange={setMarket} onPeriodChange={setPeriod} onSymbolChange={setSymbol}
          onBack={() => setStep(1)} onDiscover={handleDiscover} loading={loading}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <StepIndicator step={3} />
      {result && <Step3Results result={result} onBack={() => setStep(2)} onReset={handleReset} />}
    </div>
  );
};

export default FactorDiscoveryWizard;
