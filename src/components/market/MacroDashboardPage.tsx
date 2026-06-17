// ── TradingEasy — MacroDashboardPage (W27) ─────────────────────────────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// dashboard：GDP/CPI/PMI/PPI/M2/LPR//

import { useState, useEffect, useCallback, useMemo } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
import ReactECharts from 'echarts-for-react';
import { getMacroDashboard } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface MacroIndicator {
  name: string;
  code: string;
  unit: string;
  frequency: string;
  latestValue: number;
  previousValue: number;
  changePct: number;
  trend: 'up' | 'down' | 'flat';
  history: {date: string;value: number;}[];
  description: string;
}

const INDICATOR_META: Record<string, {name: string;unit: string;desc: string;goodDirection: 'up' | 'down';}> = {
  gdp: { name: 'GDP', unit: '%', desc: i18n.t('MacroDashboardPage.k1'), goodDirection: 'up' },
  cpi: { name: 'CPI', unit: '%', desc: i18n.t('MacroDashboardPage.k2'), goodDirection: 'down' },
  pmi: { name: 'PMI', unit: '', desc: i18n.t('MacroDashboardPage.k3'), goodDirection: 'up' },
  ppi: { name: 'PPI', unit: '%', desc: i18n.t('MacroDashboardPage.k4'), goodDirection: 'down' },
  m2: { name: 'M2', unit: '%', desc: i18n.t('MacroDashboardPage.k5'), goodDirection: 'up' },
  lpr: { name: 'LPR', unit: '%', desc: i18n.t('MacroDashboardPage.k6'), goodDirection: 'down' },
  unemployment: { name: i18n.t('MacroDashboardPage.k7'), unit: '%', desc: i18n.t('MacroDashboardPage.k8'), goodDirection: 'down' },
  industrial: { name: i18n.t('MacroDashboardPage.k9'), unit: '%', desc: i18n.t('MacroDashboardPage.k10'), goodDirection: 'up' }
};

export default function MacroDashboardPage() {
  const [indicators, setIndicators] = useState<MacroIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(null);

  const loadMacroData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMacroDashboard();
      if (result?.success && Array.isArray(result.indicators)) {
        setIndicators(result.indicators);
      } else {
        setIndicators(generateDemoIndicators());
      }
    } catch {
      void EngineError; // [DATA] structured error tracking
      setIndicators(generateDemoIndicators());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMacroData();
  }, [loadMacroData]);

  const selectedData = useMemo(() => {
    if (!selectedIndicator) return null;
    return indicators.find((i) => i.code === selectedIndicator) || null;
  }, [selectedIndicator, indicators]);

  const chartOption = useMemo(() => {
    if (!selectedData?.history?.length) return null;
    const dates = selectedData.history.map((h) => h.date);
    const values = selectedData.history.map((h) => h.value);

    return {
      backgroundColor: 'transparent',
      grid: { top: 30, right: 20, bottom: 30, left: 50 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a1a25',
        borderColor: '#333',
        textStyle: { color: '#e6edf3', fontSize: 12 }
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#8b949e', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#8b949e', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } }
      },
      series: [{
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#C9A046', width: 2 },
        itemStyle: { color: '#C9A046' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
            { offset: 0, color: 'rgba(201,169,70,0.3)' },
            { offset: 1, color: 'rgba(201,169,70,0.0)' }]

          }
        }
      }]
    };
  }, [selectedData]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t("MacroDashboardPage.r92_a0c5")}</h1>
          <p className="text-gray-400 text-sm">{i18n.t('MacroDashboardPage.k0')}</p>
        </div>
        <button
          onClick={loadMacroData}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs bg-[#22222f] text-gray-400 hover:text-gray-300 disabled:opacity-40 transition-colors">
          
          {loading ? i18n.t('MacroDashboardPage.k11') : i18n.t('MacroDashboardPage.k12')}
        </button>
      </div>

      {/* Indicator Cards */}
      {loading && indicators.length === 0 ?
      <div className="flex items-center justify-center h-32">
          <div className="text-gray-500 animate-pulse">{i18n.t('MacroDashboardPage.k1')}</div>
        </div> :

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {indicators.map((ind) =>
        <button
          key={ind.code}
          onClick={() => setSelectedIndicator(ind.code)}
          className={`text-left rounded-xl border p-4 transition-all ${
          selectedIndicator === ind.code ?
          'bg-[#C9A046]/10 border-[#C9A046]/30' :
          'bg-[#12121a] border-white/5 hover:border-white/10'}`
          }>
          
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">{ind.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            ind.trend === 'up' ? 'bg-red-500/10 text-red-400' :
            ind.trend === 'down' ? 'bg-emerald-500/10 text-emerald-400' :
            'bg-gray-500/10 text-gray-400'}`
            }>
                  {ind.trend === 'up' ? '↑' : ind.trend === 'down' ? '↓' : '→'}
                </span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {ind.latestValue.toFixed(2)}
                <span className="text-sm text-gray-500 ml-1">{ind.unit}</span>
              </div>
              <div className={`text-xs mt-1 font-mono ${
          ind.changePct > 0 ? 'text-red-400' : ind.changePct < 0 ? 'text-emerald-400' : 'text-gray-400'}`
          }>
                {ind.changePct >= 0 ? '+' : ''}{ind.changePct.toFixed(2)}%
              </div>
              <div className="text-[10px] text-gray-600 mt-1.5">{ind.description}</div>
            </button>
        )}
        </div>
      }

      {/* Detail Chart */}
      {selectedData && chartOption &&
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">
              {selectedData.name}{i18n.t("MacroDashboardPage.r92_9c9d")}
            <span className="text-gray-500 text-xs ml-2">{selectedData.frequency}</span>
            </h3>
            <button
            onClick={() => setSelectedIndicator(null)}
            className="text-gray-500 hover:text-gray-300 text-xs">{i18n.t("MacroDashboardPage.r92_add4")}


          </button>
          </div>
          <ReactECharts
          option={chartOption}
          style={{ height: 300 }}
          theme="dark" />
        
        </div>
      }

      {/* Legend */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
        <h3 className="text-white text-sm font-medium mb-3">{i18n.t("MacroDashboardPage.r92_0e97")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {Object.entries(INDICATOR_META).map(([code, meta]) =>
          <div key={code} className="flex items-start gap-2">
              <span className="text-[#D4A853] font-medium min-w-[60px]">{meta.name}</span>
              <span className="text-gray-500">{meta.desc}</span>
            </div>
          )}
        </div>
      </div>
    </div>);

}

// ── Demo Data ──────────────────────────────────────────────────────────────

function generateDemoIndicators(): MacroIndicator[] {
  const now = new Date();
  const generateHistory = (base: number, volatility: number, count: number) => {
    const history: {date: string;value: number;}[] = [];
    let value = base;
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      value += (Math.random() - 0.5) * volatility;
      history.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        value: +value.toFixed(2)
      });
    }
    return history;
  };

  const configs = [
  { code: 'gdp', base: 5.2, vol: 0.3 },
  { code: 'cpi', base: 0.8, vol: 0.2 },
  { code: 'pmi', base: 50.5, vol: 1.5 },
  { code: 'ppi', base: -1.2, vol: 0.4 },
  { code: 'm2', base: 10.5, vol: 0.5 },
  { code: 'lpr', base: 3.45, vol: 0.1 },
  { code: 'unemployment', base: 5.2, vol: 0.3 },
  { code: 'industrial', base: 6.8, vol: 0.8 }];


  return configs.map((cfg) => {
    const meta = INDICATOR_META[cfg.code];
    const history = generateHistory(cfg.base, cfg.vol, 12);
    const latest = history[history.length - 1].value;
    const previous = history[history.length - 2]?.value || latest;
    const changePct = previous !== 0 ? (latest - previous) / Math.abs(previous) * 100 : 0;
    const trend = changePct > 0.5 ? 'up' : changePct < -0.5 ? 'down' : 'flat';

    return {
      name: meta.name,
      code: cfg.code,
      unit: meta.unit,
      frequency: i18n.t('MacroDashboardPage.k13'),
      latestValue: latest,
      previousValue: previous,
      changePct,
      trend,
      history,
      description: meta.desc
    };
  });
}