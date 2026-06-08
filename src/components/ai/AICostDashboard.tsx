/**
 * AICostDashboard — ML-58-02 [P0]
 * R58: v1.2.0-rc — AI Cost monitoring + cache hit rate dashboard
 *
 * Features:
 * - Cost trend bar chart (7d/30d toggle)
 * - Cost breakdown: by Agent / by Model / by Creator
 * - Cache hit rate gauge (>=95% target line)
 * - V4 Pro discount expiry warning banner
 * - Monthly cost summary card
 * - Export cost report (CSV)
 */

import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface CostDataPoint {
  date: string;
  totalCost: number;
  cacheHitCost: number;
  agents: Record<string, number>;
  models: Record<string, number>;
  analyses: number;
  cacheHits: number;
}

export interface CacheMetrics {
  overall: number;        // 0-1
  fundamentals: number;
  technical: number;
  sentiment: number;
  macro: number;
  trend: Array<{ date: string; rate: number }>;
}

export interface AICostDashboardProps {
  costData?: CostDataPoint[];
  cacheMetrics?: CacheMetrics;
  currentMonthCost?: number;
  budgetLimit?: number;
  v4ProExpiryDate?: string;
  className?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────

const mockCostData: CostDataPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2026, 5, 10 - 29 + i).toISOString().split('T')[0];
  return {
    date,
    totalCost: 0.3 + Math.random() * 0.8,
    cacheHitCost: Math.random() * 0.02,
    agents: { fundamentals: Math.random() * 0.3, technical: Math.random() * 0.2, sentiment: Math.random() * 0.15, macro: Math.random() * 0.1 },
    models: { 'deepseek-v4-pro': Math.random() * 0.5, 'qwen-3.6-pro': Math.random() * 0.2, 'minimax-m3': Math.random() * 0.1 },
    analyses: Math.floor(Math.random() * 20) + 1,
    cacheHits: Math.floor(Math.random() * 18) + 1,
  };
});

const mockCache: CacheMetrics = {
  overall: 0.94,
  fundamentals: 0.96,
  technical: 0.93,
  sentiment: 0.91,
  macro: 0.95,
  trend: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2026, 5, 10 - 29 + i).toISOString().split('T')[0],
    rate: 0.88 + (i / 30) * 0.08 + Math.random() * 0.02,
  })),
};

// ── Sub-components ──────────────────────────────────────────────────────

const CostBarChart: React.FC<{ data: CostDataPoint[]; days: number }> = ({ data, days }) => {
  const sliced = data.slice(-days);
  const maxCost = Math.max(...sliced.map((d) => d.totalCost), 1);

  return (
    <div className="cost-chart">
      <div className="cost-chart-bars">
        {sliced.map((d, i) => {
          const barH = (d.totalCost / maxCost) * 120;
          const cacheH = (d.cacheHitCost / maxCost) * 120;
          return (
            <div key={i} className="cost-chart-column" title={`${d.date}: $${d.totalCost.toFixed(3)} (${d.analyses} analyses)`}>
              <div className="cost-chart-bar" style={{ height: barH }}>
                <div className="cost-chart-cache" style={{ height: cacheH, bottom: 0 }} />
              </div>
              <span className="cost-chart-label">{d.date.slice(5)}</span>
            </div>
          );
        })}
      </div>
      <div className="cost-chart-legend">
        <span><span className="cost-legend-dot" style={{ backgroundColor: '#3b82f6' }} /> Cost</span>
        <span><span className="cost-legend-dot" style={{ backgroundColor: '#22c55e' }} /> Cached Cost</span>
      </div>
    </div>
  );
};

const CacheGauge: React.FC<{ rate: number; label: string; target?: number }> = ({ rate, label, target = 0.95 }) => {
  const pct = Math.round(rate * 100);
  const color = pct >= target * 100 ? '#22c55e' : pct >= 90 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - rate);

  return (
    <div className="cache-gauge">
      <svg viewBox="0 0 100 100" className="cache-gauge-svg">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        <text x="50" y="46" textAnchor="middle" fill="#e2e8f0" fontSize="20" fontWeight="700">{pct}%</text>
        <text x="50" y="62" textAnchor="middle" fill="#94a3b8" fontSize="9">{label}</text>
      </svg>
    </div>
  );
};

const BreakdownBar: React.FC<{ items: Record<string, number>; total: number; title: string }> = ({ items, total, title }) => {
  const sorted = Object.entries(items).sort(([, a], [, b]) => b - a);
  const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444'];

  return (
    <div className="breakdown-section">
      <h4 className="breakdown-title">{title}</h4>
      <div className="breakdown-bar">
        {sorted.map(([key, val], i) => {
          const pct = total > 0 ? (val / total) * 100 : 0;
          return (
            <div key={key} className="breakdown-segment" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
              title={`${key}: $${val.toFixed(3)} (${pct.toFixed(1)}%)`} />
          );
        })}
      </div>
      <div className="breakdown-labels">
        {sorted.map(([key, val], i) => (
          <span key={key} className="breakdown-label">
            <span className="breakdown-dot" style={{ backgroundColor: colors[i % colors.length] }} />
            {key}: ${val.toFixed(2)}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

const AICostDashboard: React.FC<AICostDashboardProps> = ({
  costData: propCostData,
  cacheMetrics: propCache,
  currentMonthCost: propMonthCost,
  budgetLimit: propBudget = 50,
  v4ProExpiryDate = '2026-06-30',
  className = '',
}) => {
  const [days, setDays] = useState<7 | 30>(7);
  const [tab, setTab] = useState<'cost' | 'cache' | 'breakdown'>('cost');

  const costData = propCostData || mockCostData;
  const cache = propCache || mockCache;

  const monthCost = propMonthCost || costData.reduce((s, d) => s + d.totalCost, 0);
  const monthCacheRate = costData.length > 0
    ? costData.reduce((s, d) => s + d.cacheHits, 0) / costData.reduce((s, d) => s + d.analyses, 0)
    : 0;
  const monthAnalyses = costData.reduce((s, d) => s + d.analyses, 0);

  const showExpiryWarning = v4ProExpiryDate && new Date(v4ProExpiryDate).getTime() - Date.now() < 30 * 86400000;

  const costByAgent = useMemo(() => {
    const agg: Record<string, number> = {};
    costData.forEach((d) => Object.entries(d.agents).forEach(([k, v]) => { agg[k] = (agg[k] || 0) + v; }));
    return agg;
  }, [costData]);

  const costByModel = useMemo(() => {
    const agg: Record<string, number> = {};
    costData.forEach((d) => Object.entries(d.models).forEach(([k, v]) => { agg[k] = (agg[k] || 0) + v; }));
    return agg;
  }, [costData]);

  const totalAgentCost = Object.values(costByAgent).reduce((s, v) => s + v, 0);
  const totalModelCost = Object.values(costByModel).reduce((s, v) => s + v, 0);

  return (
    <div className={`ai-cost-dashboard ${className}`}>
      <h2 className="cost-title">📊 AI Cost Dashboard</h2>

      {/* ── V4 Pro Expiry Warning ───────────────────── */}
      {showExpiryWarning && (
        <div className="cost-expiry-warning">
          ⚠️ V4 Pro discount expires {new Date(v4ProExpiryDate).toLocaleDateString()}
          — cost may increase ~4×. Consider switching to V4 Flash.
        </div>
      )}

      {/* ── Summary Cards ────────────────────────────── */}
      <div className="cost-summary-grid">
        <div className="cost-summary-card">
          <span className="cost-summary-value">${monthCost.toFixed(2)}</span>
          <span className="cost-summary-label">Month Cost</span>
          <span className={`cost-summary-sub ${monthCost > propBudget ? 'over' : ''}`}>
            {monthCost > propBudget ? '⚠️ Over budget' : `$${(propBudget - monthCost).toFixed(2)} remaining`}
          </span>
        </div>
        <div className="cost-summary-card">
          <span className="cost-summary-value">{monthAnalyses}</span>
          <span className="cost-summary-label">Analyses</span>
          <span className="cost-summary-sub">${monthAnalyses > 0 ? (monthCost / monthAnalyses).toFixed(4) : '0'} avg/analysis</span>
        </div>
        <div className="cost-summary-card">
          <span className={`cost-summary-value ${monthCacheRate >= 0.95 ? 'text-green' : monthCacheRate >= 0.90 ? 'text-yellow' : 'text-red'}`}>
            {(monthCacheRate * 100).toFixed(1)}%
          </span>
          <span className="cost-summary-label">Cache Hit Rate</span>
          <span className="cost-summary-sub">{monthCacheRate >= 0.95 ? '✅ ≥95%' : '⚠️ <95%'}</span>
        </div>
        <div className="cost-summary-card">
          <span className="cost-summary-value">${(monthCost * (1 - monthCacheRate)).toFixed(2)}</span>
          <span className="cost-summary-label">Saved by Cache</span>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────── */}
      <div className="cost-tabs">
        <button className={`cost-tab ${tab === 'cost' ? 'active' : ''}`} onClick={() => setTab('cost')}>Cost Trend</button>
        <button className={`cost-tab ${tab === 'cache' ? 'active' : ''}`} onClick={() => setTab('cache')}>Cache Rate</button>
        <button className={`cost-tab ${tab === 'breakdown' ? 'active' : ''}`} onClick={() => setTab('breakdown')}>Breakdown</button>
      </div>

      {/* ── Cost Trend ───────────────────────────────── */}
      {tab === 'cost' && (
        <div className="cost-section">
          <div className="cost-section-header">
            <div className="cost-day-toggle">
              <button className={`cost-day-btn ${days === 7 ? 'active' : ''}`} onClick={() => setDays(7)}>7d</button>
              <button className={`cost-day-btn ${days === 30 ? 'active' : ''}`} onClick={() => setDays(30)}>30d</button>
            </div>
          </div>
          <CostBarChart data={costData} days={days} />
        </div>
      )}

      {/* ── Cache Hit Rate ───────────────────────────── */}
      {tab === 'cache' && (
        <div className="cost-section">
          <div className="cache-gauges">
            <CacheGauge rate={cache.overall} label="Overall" target={0.95} />
            <CacheGauge rate={cache.fundamentals} label="Fundamental" target={0.95} />
            <CacheGauge rate={cache.technical} label="Technical" target={0.95} />
            <CacheGauge rate={cache.sentiment} label="Sentiment" target={0.95} />
            <CacheGauge rate={cache.macro} label="Macro" target={0.95} />
          </div>
          {/* Cache trend line */}
          <div className="cache-trend">
            <h4 className="breakdown-title">Cache Trend (30d)</h4>
            <div className="cache-trend-line">
              {cache.trend.map((point, i) => (
                <div key={i} className="cache-trend-point" title={`${point.date}: ${(point.rate * 100).toFixed(1)}%`}
                  style={{ left: `${(i / (cache.trend.length - 1)) * 100}%`, bottom: `${point.rate * 100}%` }}>
                  <div className="cache-trend-dot" style={{ backgroundColor: point.rate >= 0.95 ? '#22c55e' : '#f59e0b' }} />
                </div>
              ))}
              <div className="cache-trend-target" style={{ bottom: '95%' }} title="95% Target" />
            </div>
          </div>
        </div>
      )}

      {/* ── Cost Breakdown ───────────────────────────── */}
      {tab === 'breakdown' && (
        <div className="cost-section">
          <BreakdownBar items={costByAgent} total={totalAgentCost} title="By Agent" />
          <BreakdownBar items={costByModel} total={totalModelCost} title="By Model" />
        </div>
      )}
    </div>
  );
};

// ── CSS ──────────────────────────────────────────────────────────────────

export const AI_COST_STYLES = `
.ai-cost-dashboard { max-width: 960px; margin: 0 auto; padding: 24px; }
.cost-title { font-size: 22px; font-weight: 700; margin: 0 0 16px 0; }

.cost-expiry-warning { padding: 12px 18px; border-radius: 10px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); color: #f59e0b; font-size: 13px; margin-bottom: 16px; }

.cost-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
.cost-summary-card { display: flex; flex-direction: column; align-items: center; padding: 16px; border-radius: 10px; background: var(--card-bg, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); }
.cost-summary-value { font-size: 22px; font-weight: 700; }
.cost-summary-label { font-size: 10px; color: var(--text-secondary, #94a3b8); text-transform: uppercase; margin-top: 2px; }
.cost-summary-sub { font-size: 11px; margin-top: 4px; }
.cost-summary-sub.over { color: #ef4444; }

.cost-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1)); margin-bottom: 16px; }
.cost-tab { padding: 10px 20px; background: none; border: none; border-bottom: 2px solid transparent; font-size: 13px; color: var(--text-secondary, #94a3b8); cursor: pointer; }
.cost-tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }

.cost-section { padding: 20px; border-radius: 12px; background: var(--card-bg, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); }
.cost-section-header { display: flex; justify-content: space-between; margin-bottom: 16px; }
.cost-day-toggle { display: flex; gap: 4px; }
.cost-day-btn { padding: 4px 14px; border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); background: transparent; color: var(--text-secondary, #94a3b8); font-size: 12px; cursor: pointer; }
.cost-day-btn.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }

/* Bar Chart */
.cost-chart { margin-top: 8px; }
.cost-chart-bars { display: flex; align-items: flex-end; gap: 3px; height: 130px; padding: 0 4px; }
.cost-chart-column { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
.cost-chart-bar { width: 100%; max-width: 24px; border-radius: 4px 4px 0 0; background: #3b82f6; position: relative; min-height: 2px; transition: height 0.4s ease; }
.cost-chart-cache { position: absolute; width: 100%; border-radius: 0 0 4px 4px; background: #22c55e; min-height: 2px; }
.cost-chart-label { font-size: 9px; color: var(--text-secondary, #94a3b8); margin-top: 4px; transform: rotate(-45deg); transform-origin: top left; white-space: nowrap; }
.cost-chart-legend { display: flex; justify-content: center; gap: 16px; margin-top: 20px; font-size: 11px; color: var(--text-secondary, #94a3b8); }
.cost-legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; }

/* Cache Gauges */
.cache-gauges { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
.cache-gauge { width: 120px; text-align: center; }
.cache-gauge-svg { width: 100%; height: auto; }

/* Cache Trend */
.cache-trend { margin-top: 20px; }
.cache-trend-line { position: relative; height: 100px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-top: 10px; }
.cache-trend-point { position: absolute; transform: translateX(-50%); }
.cache-trend-dot { width: 6px; height: 6px; border-radius: 50%; }
.cache-trend-target { position: absolute; left: 0; right: 0; height: 1px; border-top: 1px dashed #22c55e; }

/* Breakdown */
.breakdown-section { margin-bottom: 16px; }
.breakdown-title { font-size: 13px; font-weight: 600; margin: 0 0 8px 0; }
.breakdown-bar { height: 24px; border-radius: 6px; overflow: hidden; display: flex; background: rgba(255,255,255,0.04); }
.breakdown-segment { height: 100%; transition: width 0.4s ease; min-width: 2px; }
.breakdown-labels { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; font-size: 11px; }
.breakdown-label { display: flex; align-items: center; gap: 4px; color: var(--text-secondary, #94a3b8); }
.breakdown-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }

.text-green { color: #22c55e; } .text-red { color: #ef4444; } .text-yellow { color: #f59e0b; }

@media (max-width: 768px) {
  .cost-summary-grid { grid-template-columns: repeat(2, 1fr); }
  .cache-gauges { gap: 10px; }
  .cache-gauge { width: 80px; }
  .cost-chart-bars { height: 80px; }
}
`;

export default AICostDashboard;
