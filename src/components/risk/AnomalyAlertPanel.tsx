import { useState, useEffect, useCallback } from 'react'
import { useState, useEffect, useCallback } from 'react-i18next';
import { getAnomalySummary, getAnomalyAlerts, acknowledgeAnomalyAlert } from '../../lib/bridge-api';

interface AnomalyAlert {
  id: string;
  code: string;
  name: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  timestamp: string;
  acknowledged: boolean;
  price?: number;
  changePct?: number;
}

const SEVERITY_CONFIG = {
  high: { label: '高', bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-500' },
  medium: { label: '中', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  low: { label: '低', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
};

const TYPE_LABELS: Record<string, string> = {
  limit_up: '涨停',
  limit_down: '跌停',
  volume_surge: '放量异动',
  rapid_change: '快速拉升/跳水',
  breakout: '突破',
  breakdown: '跌破',
  unusual_activity: '异常交易',
  large_order: '大单异动',
};

export default function AnomalyAlertPanel() {

  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [summary, setSummary] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'unacknowledged'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, alertsRes] = await Promise.all([
        getAnomalySummary(),
        getAnomalyAlerts({ limit: 50 }),
      ]);
      if (summaryRes?.success) setSummary(summaryRes.summary);
      if (alertsRes?.success && Array.isArray(alertsRes.alerts)) {
        setAlerts(alertsRes.alerts);
      }
    } catch (e) {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeAnomalyAlert(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    } catch {
      // ignore
    }
  };

  const filtered = alerts.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'unacknowledged') return !a.acknowledged;
    return a.severity === filter;
  });

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-white">🚨 异动警报</h2>
          {unacknowledgedCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {unacknowledgedCount}
            </span>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          {loading ? '刷新中...' : '🔄'}
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-card rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">{"components.today"}</div>
            <div className="text-sm font-bold text-white">{summary.todayCount ?? 0}</div>
          </div>
          <div className="bg-card rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">高危</div>
            <div className="text-sm font-bold text-red-400">{summary.highSeverityCount ?? 0}</div>
          </div>
          <div className="bg-card rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">{"components.pending"}</div>
            <div className="text-sm font-bold text-yellow-400">{summary.unacknowledgedCount ?? 0}</div>
          </div>
          <div className="bg-card rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">活跃</div>
            <div className="text-sm font-bold text-[#C9A046]">{summary.activeStocksCount ?? 0}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1.5 mb-3">
        {(['all', 'high', 'medium', 'low', 'unacknowledged'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
              filter === f
                ? 'bg-[#C9A046]/20 border-[#C9A046]/40 text-[#C9A046]'
                : 'bg-transparent border-white/10 text-gray-500 hover:text-gray-300'
            }`}
          >
            {f === 'all' ? 'components.all' : f === 'unacknowledged' ? '未处理' : f === 'high' ? '高危' : f === 'medium' ? '中危' : '低危'}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="text-gray-500 text-sm py-6 text-center">暂无异动警报</div>
        )}
        {filtered.map((alert) => {
          const sev = SEVERITY_CONFIG[alert.severity];
          return (
            <div
              key={alert.id}
              className={`relative p-3 rounded-lg border ${sev.border} ${sev.bg} ${alert.acknowledged ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                    <span className="text-xs font-medium text-white">{alert.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono">{alert.code}</span>
                    <span className={`text-[10px] px-1 py-0.5 rounded ${sev.bg} ${sev.text}`}>{sev.label}</span>
                  </div>
                  <div className="text-xs text-gray-300 mb-1">{TYPE_LABELS[alert.type] || alert.type}</div>
                  <div className="text-[11px] text-gray-500">{alert.description}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {alert.price && (
                      <span className="text-[11px] text-gray-400">¥{alert.price.toFixed(2)}</span>
                    )}
                    {alert.changePct !== undefined && (
                      <span className={`text-[11px] font-medium ${alert.changePct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {alert.changePct >= 0 ? '+' : ''}{alert.changePct.toFixed(2)}%
                      </span>
                    )}
                    <span className="text-[10px] text-gray-600">{alert.timestamp}</span>
                  </div>
                </div>
                {!alert.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="text-[10px] text-gray-500 hover:text-white px-2 py-1 rounded border border-white/10 hover:bg-white/5 transition-colors shrink-0"
                  >
                    标记已读
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
