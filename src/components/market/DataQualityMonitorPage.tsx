import { useState, useEffect , useTranslation} from 'react'
import { useState, useEffect } from 'react-i18next';
import * as echarts from 'echarts';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface QualityCheck {
  type: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  checked: number;
  passed: number;
  failed: number;
  lastCheck: string;
}

interface SymbolQuality {
  code: string;
  name: string;
  status: 'good' | 'stale' | 'error';
  lastUpdate: string;
  latencyMs: number;
  checks: { format: boolean; priceBounds: boolean; volume: boolean; timestamp: boolean; stale: boolean };
}

interface QualityAlert {
  id: string;
  timestamp: string;
  code: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  acknowledged: boolean;
}

interface CacheStats {
  namespace: string;
  entries: number;
  hitRate: number;
  misses: number;
  evictions: number;
  expired: number;
}

const MOCK_CHECKS: QualityCheck[] = [
  { type: 'format', label: '格式校验', status: 'pass', checked: 12580, passed: 12580, failed: 0, lastCheck: '2024-06-05T00:54:12' },
  { type: 'priceBounds', label: '价格边界', status: 'pass', checked: 12580, passed: 12578, failed: 2, lastCheck: '2024-06-05T00:54:12' },
  { type: 'volume', label: '成交量异常', status: 'warn', checked: 12580, passed: 12560, failed: 20, lastCheck: '2024-06-05T00:54:12' },
  { type: 'timestamp', label: '时间戳间隙', status: 'pass', checked: 12580, passed: 12575, failed: 5, lastCheck: '2024-06-05T00:54:12' },
  { type: 'stale', label: '数据延迟', status: 'warn', checked: 12580, passed: 12550, failed: 30, lastCheck: '2024-06-05T00:54:12' },
];

const MOCK_SYMBOLS: SymbolQuality[] = [
  { code: 'AAPL', name: '苹果', status: 'good', lastUpdate: '00:54:10', latencyMs: 45, checks: { format: true, priceBounds: true, volume: true, timestamp: true, stale: true } },
  { code: 'NVDA', name: '英伟达', status: 'good', lastUpdate: '00:54:11', latencyMs: 42, checks: { format: true, priceBounds: true, volume: true, timestamp: true, stale: true } },
  { code: 'TSLA', name: '特斯拉', status: 'good', lastUpdate: '00:54:09', latencyMs: 38, checks: { format: true, priceBounds: true, volume: true, timestamp: true, stale: true } },
  { code: 'MSFT', name: '微软', status: 'stale', lastUpdate: '00:53:15', latencyMs: 120, checks: { format: true, priceBounds: true, volume: true, timestamp: true, stale: false } },
  { code: 'AMZN', name: '亚马逊', status: 'good', lastUpdate: '00:54:10', latencyMs: 50, checks: { format: true, priceBounds: true, volume: true, timestamp: true, stale: true } },
  { code: 'GOOGL', name: '谷歌', status: 'good', lastUpdate: '00:54:08', latencyMs: 55, checks: { format: true, priceBounds: true, volume: true, timestamp: true, stale: true } },
  { code: 'META', name: 'Meta', status: 'error', lastUpdate: '00:52:30', latencyMs: 500, checks: { format: true, priceBounds: false, volume: true, timestamp: false, stale: false } },
  { code: 'AVGO', name: '博通', status: 'good', lastUpdate: '00:54:11', latencyMs: 48, checks: { format: true, priceBounds: true, volume: true, timestamp: true, stale: true } },
  { code: '00700', name: '腾讯', status: 'stale', lastUpdate: '00:53:45', latencyMs: 200, checks: { format: true, priceBounds: true, volume: true, timestamp: true, stale: false } },
  { code: '09988', name: '阿里', status: 'good', lastUpdate: '00:54:10', latencyMs: 65, checks: { format: true, priceBounds: true, volume: true, timestamp: true, stale: true } },
];

const MOCK_ALERTS: QualityAlert[] = [
  { id: 'A001', timestamp: '00:54:05', code: 'META', type: '价格边界', severity: 'high', message: '价格超出合理区间 (检测到 $9999.99)', acknowledged: false },
  { id: 'A002', timestamp: '00:53:50', code: '00700', type: '数据延迟', severity: 'medium', message: '超过60秒未收到更新', acknowledged: false },
  { id: 'A003', timestamp: '00:53:30', code: 'MSFT', type: '数据延迟', severity: 'low', message: '超过30秒未收到更新', acknowledged: false },
  { id: 'A004', timestamp: '00:52:15', code: 'META', type: '时间戳间隙', severity: 'high', message: '检测到时间戳倒序', acknowledged: true },
  { id: 'A005', timestamp: '00:51:40', code: 'TSLA', type: '成交量异常', severity: 'low', message: '成交量突增300%', acknowledged: true },
];

const MOCK_CACHE: CacheStats[] = [
  { namespace: 'quote', entries: 1520, hitRate: 87.5, misses: 190, evictions: 45, expired: 120 },
  { namespace: 'heatmap', entries: 320, hitRate: 92.3, misses: 25, evictions: 8, expired: 15 },
  { namespace: 'macro', entries: 85, hitRate: 95.1, misses: 4, evictions: 2, expired: 5 },
  { namespace: 'sentiment', entries: 210, hitRate: 78.2, misses: 47, evictions: 12, expired: 30 },
  { namespace: 'fund', entries: 450, hitRate: 88.9, misses: 50, evictions: 15, expired: 40 },
];

export default function DataQualityMonitorPage() {
  const { t } = useTranslation();

  const [checks] = useState<QualityCheck[]>(MOCK_CHECKS);
  const [symbols] = useState<SymbolQuality[]>(MOCK_SYMBOLS);
  const [alerts, setAlerts] = useState<QualityAlert[]>(MOCK_ALERTS);
  const [cacheStats] = useState<CacheStats[]>(MOCK_CACHE);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // const res = await getDataQualityStatus();
      // if (res?.success) { ... }
    } catch (e) { console.error('[Error:DataQualityMonitorPage]', e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Quality trend chart
  useEffect(() => {
    const chartDom = document.getElementById('quality-trend-chart');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const passRates = [99.2, 99.1, 99.3, 99.0, 98.8, 98.5, 98.2, 98.0, 97.8, 98.1, 98.5, 98.8, 99.0, 99.1, 99.2, 99.3, 99.1, 98.9, 98.7, 98.5, 98.3, 98.6, 98.9, 99.0];

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      grid: { left: 50, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: hours, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 9 } },
      yAxis: { type: 'value', min: 95, max: 100, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: [{
        type: 'line',
        data: passRates,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#C9A046' },
        areaStyle: { color: 'rgba(201,160,70,0.1)' },
      }],
    });

    return () => chart.dispose();
  }, []);

  function acknowledgeAlert(id: string) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  }

  const unackCount = alerts.filter(a => !a.acknowledged).length;

  if (loading) return <LoadingSpinner fullscreen text="加载数据质量状态..." />;

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🔍 数据质量监控</h1>
          <p className="text-gray-400 text-sm">实时数据验证与质量保障</p>
        </div>
        <button
          onClick={load}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors"
        >
          刷新状态
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {checks.map((c) => (
          <div key={c.type} className={`border rounded-xl p-4 ${
            c.status === 'pass' ? 'bg-emerald-500/5 border-emerald-500/20' :
            c.status === 'warn' ? 'bg-yellow-500/5 border-yellow-500/20' :
            'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${
                c.status === 'pass' ? 'bg-emerald-400' :
                c.status === 'warn' ? 'bg-yellow-400' :
                'bg-red-400'
              }`} />
              <span className="text-xs text-gray-400">{c.label}</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {((c.passed / c.checked) * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              {c.passed.toLocaleString()}/{c.checked.toLocaleString()} 通过
              {c.failed > 0 && <span className="text-red-400"> · {c.failed} 异常</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">质量告警</h2>
            {unackCount > 0 && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{unackCount} 未处理</span>
            )}
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {alerts.map((a) => (
            <div key={a.id} className={`px-4 py-3 flex items-start gap-3 ${a.acknowledged ? 'opacity-50' : ''}`}>
              <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                a.severity === 'high' ? 'bg-red-400' :
                a.severity === 'medium' ? 'bg-yellow-400' :
                'bg-blue-400'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">{a.code}</span>
                  <span className="text-xs text-gray-500">{a.type}</span>
                  <span className="text-xs text-gray-500">{a.timestamp}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{a.message}</p>
              </div>
              {!a.acknowledged && (
                <button
                  onClick={() => acknowledgeAlert(a.id)}
                  className="text-xs text-[#D4A853] hover:text-[#E5B964] transition-colors flex-shrink-0"
                >
                  确认
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Symbol Quality Table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">个股数据质量</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">股票</th>
                <th className="px-4 py-3 text-center">{t("components.status")}</th>
                <th className="px-4 py-3 text-right">延迟</th>
                <th className="px-4 py-3 text-right">最后更新</th>
                <th className="px-4 py-3 text-center">格式</th>
                <th className="px-4 py-3 text-center">{t("components.price")}</th>
                <th className="px-4 py-3 text-center">{t("components.volume")}</th>
                <th className="px-4 py-3 text-center">时间戳</th>
                <th className="px-4 py-3 text-center">新鲜度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {symbols.map((s) => (
                <tr key={s.code} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{s.name}</div>
                    <div className="text-[10px] text-gray-500">{s.code}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded ${
                      s.status === 'good' ? 'bg-emerald-500/10 text-emerald-400' :
                      s.status === 'stale' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {s.status === 'good' ? '正常' : s.status === 'stale' ? '延迟' : '异常'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${s.latencyMs > 100 ? 'text-yellow-400' : 'text-gray-300'}`}>
                    {s.latencyMs}ms
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{s.lastUpdate}</td>
                  {['format', 'priceBounds', 'volume', 'timestamp', 'stale'].map((key) => (
                    <td key={key} className="px-4 py-3 text-center">
                      <span className={`text-sm ${(s.checks as any)[key] ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(s.checks as any)[key] ? '✓' : '✗'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quality Trend */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">24小时通过率趋势</h2>
        <div id="quality-trend-chart" className="w-full h-[200px]" />
      </div>

      {/* Cache Stats */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">缓存统计 (JVS-32)</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {cacheStats.map((c) => (
            <div key={c.namespace} className="bg-deep rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1 capitalize">{c.namespace}</div>
              <div className="text-lg font-bold font-mono text-white">{c.hitRate.toFixed(1)}%</div>
              <div className="text-[10px] text-gray-500 mt-1">命中率</div>
              <div className="w-full bg-white/5 rounded-full h-1 mt-2">
                <div className="bg-[#C9A046] h-1 rounded-full" style={{ width: `${c.hitRate}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-gray-500">
                <span>{c.entries} 条目</span>
                <span>{c.misses} miss</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
