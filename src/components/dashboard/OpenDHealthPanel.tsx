// OpenDHealthPanel — Futu OpenD Connection Health Dashboard
// Shows 5 health checks, overall score, and auto-recommendations.

import { useState, useEffect, useCallback } from 'react';

interface HealthCheck {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL' | 'SKIP';
  value: any;
  message: string;
  ms?: number;
}

interface HealthResult {
  overall: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  score: number;
  checks: HealthCheck[];
  summary: string;
  recommendations: string[];
  timestamp: number;
}

const STATUS_ICONS: Record<string, string> = {
  PASS:  '✅',
  WARN:  '⚠️',
  FAIL:  '❌',
  SKIP:  '⏭️',
};

const STATUS_COLORS: Record<string, string> = {
  PASS:  'text-green-400',
  WARN:  'text-yellow-400',
  FAIL:  'text-red-400',
  SKIP:  'text-gray-500',
};

const SCORE_COLORS = (score: number): string => {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
};

export default function OpenDHealthPanel() {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(11111);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await (window as any).api.opendHealth({ host, port });
      if (result?.success !== false) {
        setHealth(result ?? null);
        setLastRefresh(new Date());
      } else {
        setError(result?.error ?? '健康检查失败');
      }
    } catch (e: any) {
      setError(e.message ?? '检查失败');
    } finally {
      setLoading(false);
    }
  }, [host, port]);

  // Ping test (quick TCP check)
  const [pingResult, setPingResult] = useState<{ reachable: boolean; ms: number } | null>(null);
  const [pingning, setPingning] = useState(false);

  async function ping() {
    setPingning(true);
    try {
      const r = await (window as any).api.opendHealth({ action: 'ping', host, port });
      setPingResult(r ?? null);
    } catch {
      setPingResult({ reachable: false, ms: 999 });
    } finally {
      setPingning(false);
    }
  }

  useEffect(() => {
    refresh();
    if (!autoRefresh) return;
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh, autoRefresh]);

  const overall = health?.overall ?? 'UNKNOWN';
  const score = health?.score ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">Futu OpenD 健康检查</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            {lastRefresh ? `上次刷新 ${lastRefresh.toLocaleTimeString('zh-CN')}` : '尚未检查'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto refresh toggle */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`text-xs px-2 py-1 rounded transition-colors ${autoRefresh ? 'bg-green-900/40 text-green-400' : 'bg-white/5 text-gray-500'}`}
          >
            {autoRefresh ? '🔄 自动刷新(30s)' : '⏸ 手动刷新'}
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs bg-[#C9A046] hover:bg-[#D4A853] disabled:opacity-50 text-black px-3 py-1 rounded font-medium transition-colors"
          >
            {loading ? '检查中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* Connection config */}
      <div className="flex items-center gap-2 text-xs">
        <label className="text-gray-400">连接:</label>
        <input
          type="text"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          className="bg-[#1a1a25] border border-white/10 rounded px-2 py-1 text-white w-28"
          placeholder="127.0.0.1"
        />
        <span className="text-gray-500">:</span>
        <input
          type="number"
          value={port}
          onChange={(e) => setPort(parseInt(e.target.value) || 11111)}
          className="bg-[#1a1a25] border border-white/10 rounded px-2 py-1 text-white w-20"
          placeholder="11111"
        />
        <button
          onClick={ping}
          disabled={pingning}
          className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-2 py-1 rounded transition-colors"
        >
          {pingning ? 'ping...' : '⚡ Ping'}
        </button>
        {pingResult && (
          <span className={`text-xs font-mono ${pingResult.reachable ? 'text-green-400' : 'text-red-400'}`}>
            {pingResult.reachable ? `✅ ${pingResult.ms}ms` : '❌ 超时'}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Overall score */}
      {health && (
        <div className="bg-[#0d0d14] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-4">
            {/* Score circle */}
            <div className={`text-4xl font-bold font-mono ${SCORE_COLORS(score)}`}>
              {score}
            </div>
            <div>
              <div className="text-white font-semibold text-base">
                {overall === 'HEALTHY'   ? '✅ 健康' :
                 overall === 'DEGRADED'  ? '⚠️  降级' :
                 overall === 'UNHEALTHY' ? '❌ 异常' : '❓ 未知'}
              </div>
              <div className="text-gray-400 text-xs mt-0.5">
                {health.summary}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Health checks */}
      {health && (
        <div className="space-y-2">
          {health.checks.map((check, i) => (
            <div key={i} className="bg-[#0d0d14] border border-white/10 rounded-lg px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${STATUS_COLORS[check.status]}`}>
                    {STATUS_ICONS[check.status]}
                  </span>
                  <span className="text-white text-xs font-medium">{check.name}</span>
                </div>
                <div className="text-right">
                  <span className={`text-xs ${STATUS_COLORS[check.status]}`}>{check.message}</span>
                  {check.ms != null && (
                    <div className="text-[10px] text-gray-600 mt-0.5">{check.ms}ms</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {health && health.recommendations.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 space-y-2">
          <div className="text-yellow-400 text-xs font-semibold mb-2">💡 建议</div>
          {health.recommendations.map((rec, i) => (
            <div key={i} className="text-yellow-200/80 text-xs leading-relaxed">
              • {rec}
            </div>
          ))}
        </div>
      )}

      {/* No data yet */}
      {!health && !loading && !error && (
        <div className="text-center text-gray-500 py-8 text-sm">
          点击「刷新」进行健康检查
        </div>
      )}
    </div>
  );
}
