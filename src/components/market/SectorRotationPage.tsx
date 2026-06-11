import { useState, useEffect, useRef } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

import * as echarts from 'echarts';
import { analyzeSectorRotation } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface SectorData {
  name: string;
  changePct1d: number;
  changePct5d: number;
  changePct20d: number;
  momentumScore: number;
  status: 'heating' | 'cooling' | 'stable';
  rank: number;
}

interface RotationSignal {
  type: 'inflow' | 'outflow' | 'rotation';
  fromSector?: string;
  toSector?: string;
  sector?: string;
  strength: number;
  timestamp: string;
}

export default function SectorRotationPage() {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [signals, setSignals] = useState<RotationSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState<'1d' | '5d' | '20d'>('5d');
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await analyzeSectorRotation();
      if (res?.success) {
        setSectors(res.sectors || []);
        setSignals(res.signals || []);
      } else {
        setError(res?.error || i18n.t('SectorRotationPage.k1'));
      }
    } catch (e: unknown) {
      void EngineError; // [DATA] structured error tracking
      setError((e as any).message || i18n.t('SectorRotationPage.k2'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000); // 5min refresh
    return () => clearInterval(interval);
  }, []);

  // ECharts
  useEffect(() => {
    if (!chartRef.current || sectors.length === 0) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const key = timeframe === '1d' ? 'changePct1d' : timeframe === '5d' ? 'changePct5d' : 'changePct20d';
    const sorted = [...sectors].sort((a, b) => b[key] - a[key]);
    const top10 = sorted.slice(0, 10);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { left: 100, right: 30, top: 20, bottom: 20 },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#9ca3af', formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      yAxis: {
        type: 'category',
        data: top10.map((s) => s.name).reverse(),
        axisLabel: { color: '#d1d5db', fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [{
        type: 'bar',
        data: top10.map((s) => ({
          value: s[key],
          itemStyle: {
            color: s[key] >= 0 ? '#ef4444' : '#10b981',
          },
        })).reverse(),
        barWidth: 16,
        label: {
          show: true,
          position: 'right',
          formatter: '{c}%',
          color: '#9ca3af',
          fontSize: 11,
        },
      }],
    };

    chartInstance.current.setOption(option);
  }, [sectors, timeframe]);

  useEffect(() => {
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const heatingSectors = sectors.filter((s) => s.status === 'heating').sort((a, b) => b.momentumScore - a.momentumScore);
  const coolingSectors = sectors.filter((s) => s.status === 'cooling').sort((a, b) => a.momentumScore - b.momentumScore);

  return (
    <div className="p-6 space-y-5 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🔄 板块轮动</h1>
          <p className="text-gray-400 text-sm">板块动量监测 + 轮动信号</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-3 py-2 rounded-lg border border-white/5 transition-colors"
        >
          {loading ? i18n.t('SectorRotationPage.k3') : i18n.t('SectorRotationPage.k4')}
        </button>
      </div>

      {/* Timeframe Toggle */}
      <div className="flex gap-2">
        {(['1d', '5d', '20d'] as const).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              timeframe === tf
                ? 'bg-[#C9A046]/20 border-[#C9A046]/40 text-[#C9A046]'
                : 'bg-[#1a1a25] border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {tf === '1d' ? i18n.t('SectorRotationPage.k5') : tf === '5d' ? i18n.t('SectorRotationPage.k6') : i18n.t('SectorRotationPage.k7')}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-3">板块涨幅排行</h2>
          <div ref={chartRef} style={{ height: 320 }} />
        </div>

        {/* Rotation Signals */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-white mb-1">轮动信号</h2>
          {signals.length === 0 && (
            <div className="text-gray-500 text-sm py-8 text-center">暂无轮动信号</div>
          )}
          {signals.slice(0, 8).map((sig, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 bg-card rounded-lg">
              <div className={`w-2 h-2 rounded-full ${
                sig.type === 'inflow' ? 'bg-red-400' : sig.type === 'outflow' ? 'bg-emerald-400' : 'bg-[#C9A046]'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">
                  {sig.type === 'rotation' && sig.fromSector && sig.toSector
                    ? `${sig.fromSector} → ${sig.toSector}`
                    : sig.sector || '-'}
                </div>
                <div className="text-xs text-gray-500">
                  {sig.type === 'inflow' ? i18n.t('SectorRotationPage.k8') : sig.type === 'outflow' ? i18n.t('SectorRotationPage.k9') : i18n.t('SectorRotationPage.k10')}
                  {' · '}强度 {sig.strength?.toFixed(1) ?? '-'}
                </div>
              </div>
              <div className="text-xs text-gray-500">{sig.timestamp}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Heating & Cooling */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Heating */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-medium text-red-400 mb-3">🔥 升温板块</h2>
          <div className="space-y-2">
            {heatingSectors.slice(0, 8).map((s) => (
              <div key={s.name} className="flex items-center justify-between p-2.5 bg-card rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-5">{s.rank}</span>
                  <span className="text-sm text-white">{s.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500">动量 {s.momentumScore?.toFixed(1)}</div>
                  <div className="text-sm font-medium text-red-400">+{s.changePct5d?.toFixed(1)}%</div>
                </div>
              </div>
            ))}
            {heatingSectors.length === 0 && (
              <div className="text-gray-500 text-sm py-4 text-center">暂无升温板块</div>
            )}
          </div>
        </div>

        {/* Cooling */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-medium text-emerald-400 mb-3">❄️ 降温板块</h2>
          <div className="space-y-2">
            {coolingSectors.slice(0, 8).map((s) => (
              <div key={s.name} className="flex items-center justify-between p-2.5 bg-card rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-5">{s.rank}</span>
                  <span className="text-sm text-white">{s.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500">动量 {s.momentumScore?.toFixed(1)}</div>
                  <div className="text-sm font-medium text-emerald-400">{s.changePct5d?.toFixed(1)}%</div>
                </div>
              </div>
            ))}
            {coolingSectors.length === 0 && (
              <div className="text-gray-500 text-sm py-4 text-center">暂无降温板块</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
