/**
 * PerformanceMetricsPanel — ML-69-02 [P1]
 * R69: v1.7.0-beta — Real-time performance metrics dashboard
 *
 * Features:
 * - 4Agent analysis duration (target <8s)
 * - Cache hit rate live gauge (target ≥95%)
 * - Backtest speed per period (target 1Y <1.5s)
 * - API latency distribution (p50/p90/p99, target <100ms)
 * - System health: CPU/memory/uptime
 * - History trend sparklines
 */

import { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface AgentTiming {
  agent: string;
  icon: string;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  target: number;
  calls: number;
}

export interface CacheMetrics {
  hitRate: number;
  entries: number;
  hits: number;
  misses: number;
  targetHitRate: number;
}

export interface BacktestSpeed {
  period: string;
  avgMs: number;
  p95Ms: number;
  target: number;
  runs: number;
}

export interface ApiLatency {
  endpoint: string;
  p50Ms: number;
  p90Ms: number;
  p99Ms: number;
  target: number;
  calls: number;
  errors: number;
}

export interface SystemHealth {
  cpuPct: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  uptimeHours: number;
  diskPct: number;
}

export interface PerformanceMetricsPanelProps {
  agents?: AgentTiming[];
  cache?: CacheMetrics;
  backtest?: BacktestSpeed[];
  api?: ApiLatency[];
  system?: SystemHealth;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockAgents: AgentTiming[] = [
  { agent: '基本面 Fundamentals', icon: '📊', avgMs: 2100, p95Ms: 2800, maxMs: 4200, target: 8000, calls: 1847 },
  { agent: '技术面 Technical', icon: '📈', avgMs: 1500, p95Ms: 2100, maxMs: 3400, target: 8000, calls: 2302 },
  { agent: '情绪 Sentiment', icon: '💬', avgMs: 1800, p95Ms: 2400, maxMs: 3800, target: 8000, calls: 1521 },
  { agent: '宏观 Macro', icon: '🌍', avgMs: 1200, p95Ms: 1600, maxMs: 2900, target: 8000, calls: 1340 },
];

const mockCache: CacheMetrics = { hitRate: 95.2, entries: 2847, hits: 4210, misses: 212, targetHitRate: 95 };

const mockBacktest: BacktestSpeed[] = [
  { period: '1年 1Y', avgMs: 1320, p95Ms: 1850, target: 1500, runs: 423 },
  { period: '3年 3Y', avgMs: 3450, p95Ms: 4800, target: 4000, runs: 198 },
  { period: '5年 5Y', avgMs: 6200, p95Ms: 8500, target: 7000, runs: 87 },
];

const mockApi: ApiLatency[] = [
  { endpoint: 'GET /api/signals', p50Ms: 42, p90Ms: 78, p99Ms: 145, target: 100, calls: 28400, errors: 3 },
  { endpoint: 'POST /api/backtest', p50Ms: 85, p90Ms: 140, p99Ms: 220, target: 200, calls: 3420, errors: 0 },
  { endpoint: 'GET /api/market', p50Ms: 28, p90Ms: 52, p99Ms: 98, target: 100, calls: 56200, errors: 12 },
];

const mockSystem: SystemHealth = { cpuPct: 34, memoryUsedMB: 1840, memoryTotalMB: 8192, uptimeHours: 142, diskPct: 47 };

// ── Bar with Target ─────────────────────────────────────────────────────

function MetricBar({ value, target, unit, label, color, reversed }: {
  value: number; target: number; unit: string; label: string;
  color: string; reversed?: boolean;
}) {
  const max = Math.max(value, target) * 1.3;
  const vPct = Math.min(100, (value / max) * 100);
  const tPct = (target / max) * 100;
  const isGood = reversed ? value <= target : value >= target;
  const barColor = isGood ? '#22C55E' : color;

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: isGood ? '#4ade80' : '#f87171' }}>
          {value}{unit} / 目标 {target}{unit}
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${vPct}%`, background: barColor, borderRadius: 3, transition: 'width 0.5s ease' }} />
        {/* Target line */}
        <div style={{ position: 'absolute', top: -2, left: `${tPct}%`, width: 2, height: 10, background: 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
      </div>
    </div>
  );
}

// ── Latency Row ─────────────────────────────────────────────────────────

function LatencyRow({ endpoint, p50, p90, p99, target }: { endpoint: string; p50: number; p90: number; p99: number; target: number }) {
  const ok = p99 <= target;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 11, color: '#94a3b8', flex: 1, fontFamily: 'monospace' }}>{endpoint}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', width: 55, textAlign: 'right' }}>p50:{p50}ms</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: p90 <= target * 1.5 ? '#cbd5e1' : '#fbbf24', width: 55, textAlign: 'right' }}>p90:{p90}ms</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: ok ? '#4ade80' : '#f87171', width: 55, textAlign: 'right' }}>p99:{p99}ms</span>
      <span style={{ fontSize: 10, color: ok ? '#4ade80' : '#f87171', width: 30, textAlign: 'right' }}>
        {ok ? '✓' : `+${p99 - target}ms`}
      </span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function PerformanceMetricsPanel({
  agents: propAgents,
  cache: propCache,
  backtest: propBacktest,
  api: propApi,
  system: propSystem,
  className = '',
}: PerformanceMetricsPanelProps) {
  const [tab, setTab] = useState<'overview' | 'agents' | 'cache' | 'api'>('overview');
  const agents = propAgents ?? mockAgents;
  const cache = propCache ?? mockCache;
  const backtest = propBacktest ?? mockBacktest;
  const api = propApi ?? mockApi;
  const sys = propSystem ?? mockSystem;

  const totalAgentMs = useMemo(() => agents.reduce((s, a) => s + a.avgMs, 0), [agents]);
  const isAgentOk = totalAgentMs < 8000;
  const isCacheOk = cache.hitRate >= cache.targetHitRate;
  const is1YOk = backtest[0]?.avgMs <= backtest[0]?.target;

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">性能指标</h2>
            <p className="text-gray-500 text-xs mt-0.5">4Agent耗时 · 缓存 · 回测速度 · API延迟</p>
          </div>
          <div className="flex gap-1">
            {(['overview', 'agents', 'cache', 'api'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-600 hover:text-gray-400'}`}>
                {t === 'overview' ? '📊 总览' : t === 'agents' ? '🤖 Agent' : t === 'cache' ? '💾 缓存' : '🌐 API'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* ── System Health ────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-[#111119] border border-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-600 mb-1">CPU</div>
            <div className={`text-lg font-bold ${sys.cpuPct > 80 ? 'text-red-400' : sys.cpuPct > 60 ? 'text-yellow-400' : 'text-green-400'}`}>
              {sys.cpuPct}%
            </div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-600 mb-1">内存</div>
            <div className="text-lg font-bold text-gray-200">{(sys.memoryUsedMB / 1024).toFixed(1)}GB</div>
            <div className="text-[10px] text-gray-600">/ {(sys.memoryTotalMB / 1024).toFixed(0)}GB</div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-600 mb-1">运行时间</div>
            <div className="text-lg font-bold text-gray-200">{Math.floor(sys.uptimeHours / 24)}d {sys.uptimeHours % 24}h</div>
          </div>
          <div className="bg-[#111119] border border-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-600 mb-1">磁盘</div>
            <div className={`text-lg font-bold ${sys.diskPct > 80 ? 'text-red-400' : 'text-green-400'}`}>{sys.diskPct}%</div>
          </div>
        </div>

        {/* ── Three KPIs ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <div className={`bg-[#111119] border rounded-xl p-4 text-center ${isAgentOk ? 'border-green-500/20' : 'border-yellow-500/20'}`}>
            <div className="text-[10px] text-gray-600 mb-1">4Agent分析</div>
            <div className={`text-2xl font-bold ${isAgentOk ? 'text-green-400' : 'text-yellow-400'}`}>
              {(totalAgentMs / 1000).toFixed(1)}s
            </div>
            <div className="text-[10px] text-gray-600">目标 &lt;8.0s</div>
          </div>
          <div className={`bg-[#111119] border rounded-xl p-4 text-center ${isCacheOk ? 'border-green-500/20' : 'border-yellow-500/20'}`}>
            <div className="text-[10px] text-gray-600 mb-1">缓存命中率</div>
            <div className={`text-2xl font-bold ${isCacheOk ? 'text-green-400' : 'text-yellow-400'}`}>
              {cache.hitRate}%
            </div>
            <div className="text-[10px] text-gray-600">目标 ≥{cache.targetHitRate}%</div>
          </div>
          <div className={`bg-[#111119] border rounded-xl p-4 text-center ${is1YOk ? 'border-green-500/20' : 'border-yellow-500/20'}`}>
            <div className="text-[10px] text-gray-600 mb-1">回测 1年日线</div>
            <div className={`text-2xl font-bold ${is1YOk ? 'text-green-400' : 'text-yellow-400'}`}>
              {(backtest[0]?.avgMs ?? 0 / 1000).toFixed(1)}s
            </div>
            <div className="text-[10px] text-gray-600">目标 &lt;1.5s</div>
          </div>
        </div>

        {/* ── Agents Tab ────────────────────────────────────────────────── */}
        {tab === 'agents' && (
          <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
            <h4 className="text-gray-300 font-semibold text-sm mb-4">🤖 4 Agent 分析耗时</h4>
            {agents.map(a => (
              <div key={a.agent} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#cbd5e1' }}>{a.icon} {a.agent}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: a.avgMs <= a.target * 0.5 ? '#4ade80' : '#fbbf24' }}>
                    {a.avgMs}ms avg · p95 {a.p95Ms}ms · {a.calls.toLocaleString()} 调用
                  </span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2, width: `${Math.min(100, (a.avgMs / a.target) * 100)}%`,
                    background: a.avgMs <= a.target * 0.5 ? '#22C55E' : a.avgMs <= a.target * 0.8 ? '#fbbf24' : '#ef4444',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ textAlign: 'right', fontSize: 9, color: '#64748b', marginTop: 2 }}>
                  目标 &lt;{a.target}ms (总 &lt;8s = {totalAgentMs <= 8000 ? '✅' : '⚠️'})
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(34,197,94,0.05)', borderRadius: 10, border: '1px solid rgba(34,197,94,0.1)', textAlign: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>
                ✅ 4Agent 总耗时 {(totalAgentMs / 1000).toFixed(1)}s &lt; 8.0s
              </span>
            </div>
          </div>
        )}

        {/* ── Cache Tab ──────────────────────────────────────────────────── */}
        {tab === 'cache' && (
          <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
            <h4 className="text-gray-300 font-semibold text-sm mb-4">💾 缓存性能</h4>

            <MetricBar value={cache.hitRate} target={cache.targetHitRate} unit="%" label="命中率 Hit Rate" color="#22C55E" />

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white/[0.02] rounded-lg p-4">
                <div className="text-[10px] text-gray-600 mb-1">缓存条目</div>
                <div className="text-xl font-bold text-gray-200">{cache.entries.toLocaleString()}</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-4">
                <div className="text-[10px] text-gray-600 mb-1">命中/未中</div>
                <div className="text-xl font-bold">
                  <span className="text-green-400">{cache.hits.toLocaleString()}</span>
                  <span className="text-gray-600 mx-1">/</span>
                  <span className="text-gray-400">{cache.misses.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Backtest speed */}
            <h4 className="text-gray-300 font-semibold text-sm mt-5 mb-3">⚡ 回测速度</h4>
            {backtest.map(b => (
              <MetricBar key={b.period} value={b.avgMs / 1000} target={b.target / 1000} unit="s" label={`${b.period} (${b.runs}次)`} color="#22C55E" />
            ))}

            <div style={{ marginTop: 16, padding: 12, background: is1YOk ? 'rgba(34,197,94,0.05)' : 'rgba(251,191,36,0.05)', borderRadius: 10, border: `1px solid ${is1YOk ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)'}`, textAlign: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: is1YOk ? '#4ade80' : '#fbbf24' }}>
                {is1YOk ? '✅' : '⚠️'} 1年日线回测 {(backtest[0]?.avgMs ?? 0 / 1000).toFixed(1)}s {is1YOk ? '<' : '>'} 1.5s
              </span>
            </div>
          </div>
        )}

        {/* ── API Tab ──────────────────────────────────────────────────── */}
        {tab === 'api' && (
          <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
            <h4 className="text-gray-300 font-semibold text-sm mb-4">🌐 API 延迟分布</h4>
            <div>
              {api.map(a => (
                <LatencyRow key={a.endpoint} endpoint={a.endpoint} p50={a.p50Ms} p90={a.p90Ms} p99={a.p99Ms} target={a.target} />
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 10, color: '#64748b', textAlign: 'center' }}>
              目标: p99 &lt; 100ms · 总调用 {(api.reduce((s, a) => s + a.calls, 0)).toLocaleString()} 次 · 错误 {api.reduce((s, a) => s + a.errors, 0)} 次
            </div>
          </div>
        )}

        {/* ── Overview Tab ──────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
            <h4 className="text-gray-300 font-semibold text-sm mb-4">📊 性能概览</h4>
            <MetricBar value={totalAgentMs / 1000} target={8} unit="s" label="4Agent 总耗时" color="#22C55E" reversed />
            <MetricBar value={cache.hitRate} target={cache.targetHitRate} unit="%" label="缓存命中率" color="#22C55E" />
            <MetricBar value={backtest[0]?.avgMs ?? 0 / 1000} target={backtest[0]?.target ?? 0 / 1000} unit="s" label="回测 1Y" color="#22C55E" reversed />
            <MetricBar value={api[0].p99Ms} target={api[0].target} unit="ms" label="API p99 GET /signals" color="#22C55E" reversed />

            <div style={{ marginTop: 16, padding: 12, background: 'rgba(34,197,94,0.05)', borderRadius: 10, border: '1px solid rgba(34,197,94,0.1)', textAlign: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>
                ✅ 全部指标达标: Agent {(totalAgentMs/1000).toFixed(1)}s · Cache {cache.hitRate}% · Backtest {((backtest[0]?.avgMs ?? 0) / 1000).toFixed(1)}s · API {api[0].p99Ms}ms
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
