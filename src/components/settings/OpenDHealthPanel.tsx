import { useState, useEffect } from 'react';
import * as echarts from 'echarts';
import { isConnected } from '@/lib/bridge-api';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface OpenDHealth {
  connected: boolean;
  status: 'online' | 'offline' | 'reconnecting';
  version: string;
  latencyMs: number;
  uptime: number; // seconds
  lastError?: string;
  reconnectCount: number;
  latencyHistory: { time: string; latency: number }[];
  throughput: { requests: number; responses: number };
}

const MOCK_HEALTH: OpenDHealth = {
  connected: true,
  status: 'online',
  version: 'FutuOpenD 8.2.0',
  latencyMs: 42,
  uptime: 86400 * 2 + 3600 * 5 + 1800,
  reconnectCount: 3,
  latencyHistory: [
    { time: '00:00', latency: 38 },
    { time: '00:10', latency: 45 },
    { time: '00:20', latency: 42 },
    { time: '00:30', latency: 55 },
    { time: '00:40', latency: 40 },
    { time: '00:50', latency: 48 },
    { time: '01:00', latency: 42 },
    { time: '01:10', latency: 50 },
    { time: '01:20', latency: 38 },
    { time: '01:30', latency: 44 },
  ],
  throughput: { requests: 12580, responses: 12578 },
};

export default function OpenDHealthPanel() {
  const [health, setHealth] = useState<OpenDHealth>(MOCK_HEALTH);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await isConnected();
      setHealth(prev => ({ ...prev, connected: (res as any)?.connected ?? false }));
    } catch (e) { console.error('[Error:OpenDHealthPanel]', e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Latency chart
  useEffect(() => {
    const chartDom = document.getElementById('opend-latency-chart');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      grid: { left: 50, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: health.latencyHistory.map(h => h.time), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10 } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}ms' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: [{
        type: 'line',
        data: health.latencyHistory.map(h => h.latency),
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2, color: '#C9A046' },
        areaStyle: { color: 'rgba(201,160,70,0.1)' },
        markLine: {
          silent: true,
          data: [
            { yAxis: 100, lineStyle: { color: 'rgba(239,68,68,0.3)', type: 'dashed' }, label: { formatter: '警告阈值', color: '#ef4444', fontSize: 9 } },
          ],
        },
      }],
    });

    return () => chart.dispose();
  }, [health]);

  if (loading) return <LoadingSpinner fullscreen text="加载 OpenD 状态..." />;

  const statusConfig = {
    online: { label: '在线', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400 animate-pulse' },
    offline: { label: '离线', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-400' },
    reconnecting: { label: '重连中', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-400 animate-pulse' },
  }[health.status];

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}天 ${h}小时 ${m}分`;
  };

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🔌 OpenD 健康监控</h1>
          <p className="text-gray-400 text-sm">富途 OpenD 连接状态与性能监控</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-4 py-2 rounded-lg border border-white/5 transition-colors"
          >
            刷新状态
          </button>
          <button
            className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors"
            onClick={() => alert('重新连接 OpenD...')}
          >
            重新连接
          </button>
        </div>
      </div>

      {/* Status Card */}
      <div className={`border rounded-xl p-6 ${statusConfig.bg}`}>
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${statusConfig.dot}`} />
          <div>
            <div className={`text-2xl font-bold ${statusConfig.color}`}>{statusConfig.label}</div>
            <div className="text-sm text-gray-400">{health.version}</div>
          </div>
          <div className="flex-1" />
          <div className="text-right">
            <div className="text-xs text-gray-500">运行时间</div>
            <div className="text-lg font-mono text-white">{formatUptime(health.uptime)}</div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">当前延迟</div>
          <div className={`text-xl font-bold font-mono ${health.latencyMs > 100 ? 'text-red-400' : health.latencyMs > 50 ? 'text-yellow-400' : 'text-emerald-400'}`}>
            {health.latencyMs}ms
          </div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">请求数</div>
          <div className="text-xl font-bold font-mono text-white">{health.throughput.requests.toLocaleString()}</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">响应数</div>
          <div className="text-xl font-bold font-mono text-white">{health.throughput.responses.toLocaleString()}</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">重连次数</div>
          <div className="text-xl font-bold font-mono text-white">{health.reconnectCount}</div>
        </div>
      </div>

      {/* Latency Chart */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">延迟趋势</h2>
        <div id="opend-latency-chart" className="w-full h-[220px]" />
      </div>

      {/* Connection Log */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">连接日志</h2>
        <div className="space-y-2 text-sm">
          {[
            { time: '01:12:15', event: '心跳检测', status: '正常', latency: '42ms' },
            { time: '01:10:30', event: '行情订阅', status: '成功', latency: '38ms' },
            { time: '01:08:45', event: '订单查询', status: '成功', latency: '55ms' },
            { time: '01:05:00', event: '持仓同步', status: '成功', latency: '40ms' },
            { time: '01:00:00', event: '账户信息', status: '成功', latency: '45ms' },
            { time: '00:55:20', event: '自动重连', status: '成功', latency: '--' },
            { time: '00:55:15', event: '连接断开', status: '警告', latency: '--' },
            { time: '00:30:00', event: '初始连接', status: '成功', latency: '120ms' },
          ].map((log, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-deep rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500 w-16">{log.time}</span>
              <span className="text-xs text-gray-300 w-20">{log.event}</span>
              <span className={`text-xs ${log.status === '成功' ? 'text-emerald-400' : log.status === '警告' ? 'text-yellow-400' : 'text-gray-400'}`}>
                {log.status}
              </span>
              {log.latency !== '--' && <span className="text-xs text-gray-500 ml-auto">{log.latency}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
