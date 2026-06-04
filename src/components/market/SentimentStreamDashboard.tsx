import { useState, useEffect } from 'react';
import * as echarts from 'echarts';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface SentimentData {
  overallScore: number; // -100 to +100
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  trend: 'improving' | 'deteriorating' | 'stable';
  components: { name: string; score: number; weight: number }[];
  history: { time: string; score: number; signal: string }[];
  alerts: { id: string; timestamp: string; type: string; message: string }[];
}

const MOCK_DATA: SentimentData = {
  overallScore: 42,
  signal: 'bullish',
  confidence: 78,
  trend: 'improving',
  components: [
    { name: '市场情绪', score: 55, weight: 0.25 },
    { name: '成交量', score: 38, weight: 0.20 },
    { name: '市场广度', score: 45, weight: 0.20 },
    { name: '波动率', score: 28, weight: 0.20 },
    { name: '动量', score: 62, weight: 0.15 },
  ],
  history: [
    { time: '09:30', score: 15, signal: 'neutral' },
    { time: '10:00', score: 22, signal: 'bullish' },
    { time: '10:30', score: 18, signal: 'neutral' },
    { time: '11:00', score: 28, signal: 'bullish' },
    { time: '11:30', score: 35, signal: 'bullish' },
    { time: '13:00', score: 30, signal: 'bullish' },
    { time: '13:30', score: 38, signal: 'bullish' },
    { time: '14:00', score: 42, signal: 'bullish' },
    { time: '14:30', score: 45, signal: 'bullish' },
    { time: '15:00', score: 42, signal: 'bullish' },
  ],
  alerts: [
    { id: 'S001', timestamp: '14:25', type: '极端情绪', message: '情绪得分突破 +40，进入强烈看多区间' },
    { id: 'S002', timestamp: '11:15', type: '趋势转变', message: '情绪趋势由稳定转为改善' },
    { id: 'S003', timestamp: '10:05', type: '成分异常', message: '成交量成分出现负值，市场情绪分化' },
  ],
};

export default function SentimentStreamDashboard() {
  const [data, setData] = useState<SentimentData>(MOCK_DATA);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // const res = await getSentimentStreamStatus();
      // if (res?.success) setData(res.data);
    } catch (e) { console.error('[Error:SentimentStreamDashboard]', e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Gauge chart
  useEffect(() => {
    const chartDom = document.getElementById('sentiment-gauge');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: -100,
        max: 100,
        splitNumber: 10,
        radius: '90%',
        center: ['50%', '70%'],
        axisLine: {
          lineStyle: {
            width: 20,
            color: [
              [0.3, '#10b981'],
              [0.4, '#eab308'],
              [0.6, '#eab308'],
              [1, '#ef4444'],
            ],
          },
        },
        pointer: { itemStyle: { color: '#C9A046' }, width: 4 },
        axisTick: { distance: -25, length: 6, lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        splitLine: { distance: -30, length: 12, lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        axisLabel: { color: '#9ca3af', distance: -50, fontSize: 10 },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          color: '#fff',
          fontSize: 28,
          fontWeight: 'bold',
          offsetCenter: [0, '-10%'],
        },
        data: [{ value: data.overallScore }],
      }],
    });

    return () => chart.dispose();
  }, [data.overallScore]);

  // History chart
  useEffect(() => {
    const chartDom = document.getElementById('sentiment-history');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      grid: { left: 50, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: data.history.map(h => h.time), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10 } },
      yAxis: { type: 'value', min: -100, max: 100, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      visualMap: {
        show: false,
        dimension: 1,
        pieces: [
          { gt: 0, lte: 100, color: '#ef4444' },
          { gt: -100, lte: 0, color: '#10b981' },
        ],
      },
      series: [{
        type: 'line',
        data: data.history.map(h => h.score),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.1 },
        markLine: {
          silent: true,
          data: [
            { yAxis: 40, lineStyle: { color: 'rgba(239,68,68,0.3)', type: 'dashed' }, label: { formatter: '看多阈值', color: '#ef4444', fontSize: 9 } },
            { yAxis: -40, lineStyle: { color: 'rgba(16,185,129,0.3)', type: 'dashed' }, label: { formatter: '看空阈值', color: '#10b981', fontSize: 9 } },
          ],
        },
      }],
    });

    return () => chart.dispose();
  }, [data]);

  if (loading) return <LoadingSpinner fullscreen text="加载情绪数据..." />;

  const signalConfig = {
    bullish: { label: '看多', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: '🐂' },
    bearish: { label: '看空', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: '🐻' },
    neutral: { label: '中性', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: '➡️' },
  }[data.signal];

  const trendConfig = {
    improving: { label: '改善中', icon: '📈', color: 'text-red-400' },
    deteriorating: { label: '恶化中', icon: '📉', color: 'text-emerald-400' },
    stable: { label: '稳定', icon: '➡️', color: 'text-gray-400' },
  }[data.trend];

  return (
    <div className="p-6 space-y-6 bg-[#0a0a12] min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🎭 实时情绪流</h1>
          <p className="text-gray-400 text-sm">JVS-33 多维度市场情绪分析</p>
        </div>
        <button
          onClick={load}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors"
        >
          刷新数据
        </button>
      </div>

      {/* Main Gauge + Signal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <div id="sentiment-gauge" className="w-full h-[220px]" />
        </div>
        <div className="space-y-3">
          <div className={`border rounded-xl p-4 ${signalConfig.bg}`}>
            <div className="text-xs text-gray-500 mb-1">当前信号</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{signalConfig.icon}</span>
              <span className={`text-xl font-bold ${signalConfig.color}`}>{signalConfig.label}</span>
            </div>
          </div>
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">置信度</div>
            <div className="text-xl font-bold font-mono text-white">{data.confidence}%</div>
            <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
              <div className="bg-[#C9A046] h-1.5 rounded-full" style={{ width: `${data.confidence}%` }} />
            </div>
          </div>
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">趋势</div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{trendConfig.icon}</span>
              <span className={`text-lg font-bold ${trendConfig.color}`}>{trendConfig.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {data.components.map((c) => (
          <div key={c.name} className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{c.name}</div>
            <div className={`text-xl font-bold font-mono ${c.score >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {c.score >= 0 ? '+' : ''}{c.score}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">权重 {c.weight * 100}%</div>
            <div className="w-full bg-white/5 rounded-full h-1 mt-2">
              <div
                className="h-1 rounded-full bg-[#C9A046]"
                style={{ width: `${Math.abs(c.score)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* History Chart */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">情绪趋势</h2>
        <div id="sentiment-history" className="w-full h-[240px]" />
      </div>

      {/* Alerts */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">情绪告警</h2>
        </div>
        <div className="divide-y divide-white/5">
          {data.alerts.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-yellow-400 font-medium">{a.type}</span>
                  <span className="text-xs text-gray-500">{a.timestamp}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{a.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
