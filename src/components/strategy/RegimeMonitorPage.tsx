import { useState, useEffect } from 'react';
import * as echarts from 'echarts';
import { getMarketRegime } from '@/lib/bridge-api';
import LoadingSpinner from '@/components/common/LoadingSpinner';

type RegimeType = 'Bull' | 'Bear' | 'Range' | 'Volatile' | 'Unknown';

interface RegimeState {
  current: RegimeType;
  confidence: number;
  duration: number; // days in current regime
  since: string;
  adaptedStrategy: string;
  indicators: { name: string; value: number; signal: 'positive' | 'negative' | 'neutral' }[];
  history: { date: string; regime: RegimeType; confidence: number }[];
}

const REGIME_CONFIG: Record<RegimeType, { icon: string; label: string; color: string; bg: string; desc: string; strategyStyle: string }> = {
  Bull: { icon: '🐂', label: '牛市', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', desc: '趋势向上，建议偏股型策略', strategyStyle: '高仓位 + 动量突破' },
  Bear: { icon: '🐻', label: '熊市', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', desc: '趋势向下，建议防御型策略', strategyStyle: '低仓位 + 做空/现金' },
  Range: { icon: '➡️', label: '震荡', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', desc: '区间波动，建议均值回归策略', strategyStyle: '网格交易 + 高抛低吸' },
  Volatile: { icon: '⚡', label: '高波动', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', desc: '波动剧烈，建议降低仓位', strategyStyle: '降低仓位 + 严格止损' },
  Unknown: { icon: '❓', label: '未知', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20', desc: '数据不足，保持观望', strategyStyle: '维持现状' },
};

const MOCK_DATA: RegimeState = {
  current: 'Bull',
  confidence: 78,
  duration: 45,
  since: '2024-04-20',
  adaptedStrategy: '双均线突破策略（牛市参数）',
  indicators: [
    { name: '趋势强度', value: 72, signal: 'positive' },
    { name: '波动率', value: 35, signal: 'positive' },
    { name: '成交量', value: 85, signal: 'positive' },
    { name: '动量', value: 68, signal: 'positive' },
    { name: '市场情绪', value: 62, signal: 'positive' },
    { name: '资金流向', value: 55, signal: 'neutral' },
  ],
  history: [
    { date: '2024-01-01', regime: 'Range', confidence: 55 },
    { date: '2024-01-15', regime: 'Bull', confidence: 65 },
    { date: '2024-02-01', regime: 'Bull', confidence: 72 },
    { date: '2024-02-15', regime: 'Volatile', confidence: 48 },
    { date: '2024-03-01', regime: 'Bear', confidence: 58 },
    { date: '2024-03-15', regime: 'Range', confidence: 52 },
    { date: '2024-04-01', regime: 'Bull', confidence: 70 },
    { date: '2024-04-15', regime: 'Bull', confidence: 75 },
    { date: '2024-05-01', regime: 'Bull', confidence: 78 },
    { date: '2024-05-15', regime: 'Bull', confidence: 82 },
    { date: '2024-06-01', regime: 'Bull', confidence: 78 },
  ],
};

export default function RegimeMonitorPage() {
  const [data, setData] = useState<RegimeState>(MOCK_DATA);
  const [loading, setLoading] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [selectedRegime, setSelectedRegime] = useState<RegimeType | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await getMarketRegime();
      if (res?.success && res.regime) setData(prev => ({ ...prev, ...res.regime }));
    } catch { /* use mock */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Regime history timeline
  useEffect(() => {
    const chartDom = document.getElementById('regime-timeline');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    const regimeValues: Record<RegimeType, number> = { Bull: 4, Bear: 1, Range: 2, Volatile: 3, Unknown: 0 };
    const regimeColors: Record<RegimeType, string> = { Bull: '#ef4444', Bear: '#10b981', Range: '#eab308', Volatile: '#a855f7', Unknown: '#6b7280' };

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a1a25',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e5e7eb' },
        formatter: (params: any) => {
          const p = params[0];
          const regime = data.history[p.dataIndex]?.regime;
          return `${p.axisValue}<br/>状态: ${regime ?? ''}<br/>置信度: ${p.data}%`;
        },
      },
      grid: { left: 50, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: data.history.map(h => h.date.slice(5)), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10 } },
      yAxis: { type: 'value', min: 0, max: 100, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      visualMap: {
        show: false,
        dimension: 0,
        pieces: data.history.map((h, i) => ({ gt: i - 0.5, lt: i + 0.5, color: regimeColors[h.regime] })),
      },
      series: [{
        type: 'line',
        data: data.history.map(h => h.confidence),
        smooth: false,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.1 },
      }],
    });

    return () => chart.dispose();
  }, [data]);

  if (loading) return <LoadingSpinner fullscreen text="加载市场状态..." />;

  const config = REGIME_CONFIG[data.current];

  return (
    <div className="p-6 space-y-6 bg-[#0a0a12] min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🌊 市场状态监控</h1>
          <p className="text-gray-400 text-sm">实时市场 regime 检测与策略适配</p>
        </div>
        <button
          onClick={load}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors"
        >
          刷新状态
        </button>
      </div>

      {/* Current Regime Card */}
      <div className={`border rounded-xl p-6 ${config.bg}`}>
        <div className="flex items-center gap-4">
          <div className="text-5xl">{config.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold ${config.color}`}>{config.label}</span>
              <span className="text-sm text-gray-400">置信度 {data.confidence}%</span>
              <span className="text-sm text-gray-400">· 已持续 {data.duration} 天</span>
            </div>
            <p className="text-sm text-gray-300 mt-1">{config.desc}</p>
            <div className="mt-2 text-xs text-[#D4A853]">
              当前适配策略: {data.adaptedStrategy}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">适配风格</div>
            <div className="text-sm text-white font-medium">{config.strategyStyle}</div>
          </div>
        </div>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {data.indicators.map((ind) => (
          <div key={ind.name} className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{ind.name}</span>
              <span className={`text-xs ${
                ind.signal === 'positive' ? 'text-red-400' :
                ind.signal === 'negative' ? 'text-emerald-400' :
                'text-yellow-400'
              }`}>
                {ind.signal === 'positive' ? '看多' : ind.signal === 'negative' ? '看空' : '中性'}
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-white">{ind.value}</div>
            <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
              <div
                className={`h-1.5 rounded-full ${
                  ind.signal === 'positive' ? 'bg-red-400' :
                  ind.signal === 'negative' ? 'bg-emerald-400' :
                  'bg-yellow-400'
                }`}
                style={{ width: `${ind.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Regime History */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">状态历史</h2>
        <div id="regime-timeline" className="w-full h-[240px]" />
      </div>

      {/* Manual Override */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">手动覆盖</h2>
            <p className="text-xs text-gray-500 mt-0.5">强制切换到指定市场状态（谨慎使用）</p>
          </div>
          <button
            onClick={() => setManualOverride(!manualOverride)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              manualOverride ? 'bg-[#C9A046]' : 'bg-gray-700'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              manualOverride ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {manualOverride && (
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(REGIME_CONFIG) as RegimeType[]).map((regime) => (
              <button
                key={regime}
                onClick={() => setSelectedRegime(regime)}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  selectedRegime === regime
                    ? REGIME_CONFIG[regime].bg
                    : 'bg-[#0a0a12] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="text-2xl mb-1">{REGIME_CONFIG[regime].icon}</div>
                <div className={`text-xs font-medium ${REGIME_CONFIG[regime].color}`}>{REGIME_CONFIG[regime].label}</div>
              </button>
            ))}
          </div>
        )}

        {manualOverride && selectedRegime && (
          <div className="mt-4 flex items-center gap-3">
            <div className="text-xs text-gray-400">
              将强制切换为: <span className="text-white font-medium">{REGIME_CONFIG[selectedRegime].label}</span>
            </div>
            <button className="text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition-colors">
              确认切换
            </button>
          </div>
        )}
      </div>

      {/* Regime Legend */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">状态说明</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {(Object.keys(REGIME_CONFIG) as RegimeType[]).map((regime) => (
            <div key={regime} className="bg-[#0a0a12] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{REGIME_CONFIG[regime].icon}</span>
                <span className={`text-sm font-medium ${REGIME_CONFIG[regime].color}`}>{REGIME_CONFIG[regime].label}</span>
              </div>
              <p className="text-xs text-gray-500">{REGIME_CONFIG[regime].desc}</p>
              <p className="text-xs text-[#D4A853] mt-1">{REGIME_CONFIG[regime].strategyStyle}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
