/**
 * Performance Dashboard - 绩效仪表盘
 * 展示策略绩效指标: Sharpe, Sortino, Calmar, 胜率, 盈亏比等
 */

import { useState, useEffect } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface PerformanceMetrics {
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  volatility: number;
  annualizedReturn: number;
  beta: number;
  alpha: number;
}

interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
}

interface PerformanceDashboardProps {
  strategyId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// ── Helper Functions ───────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function getMetricColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return 'text-green-400';
  if (value >= thresholds[0]) return 'text-yellow-400';
  return 'text-red-400';
}

// ── Mock Data Generator ────────────────────────────────────────────────────

function generateMockMetrics(): PerformanceMetrics {
  return {
    sharpe: 1.2 + Math.random() * 0.5,
    sortino: 1.5 + Math.random() * 0.8,
    calmar: 0.8 + Math.random() * 0.6,
    winRate: 0.55 + Math.random() * 0.15,
    profitFactor: 1.3 + Math.random() * 0.5,
    avgWin: 500 + Math.random() * 300,
    avgLoss: 300 + Math.random() * 200,
    winLossRatio: 1.5 + Math.random() * 0.5,
    totalTrades: 50 + Math.floor(Math.random() * 50),
    winningTrades: 30 + Math.floor(Math.random() * 20),
    losingTrades: 20 + Math.floor(Math.random() * 15),
    totalPnl: 5000 + Math.random() * 10000,
    maxDrawdown: 8 + Math.random() * 12,
    maxDrawdownDuration: 15 + Math.floor(Math.random() * 30),
    volatility: 12 + Math.random() * 8,
    annualizedReturn: 15 + Math.random() * 20,
    beta: 0.8 + Math.random() * 0.4,
    alpha: 2 + Math.random() * 8,
  };
}

function generateMockEquityCurve(): EquityPoint[] {
  const points: EquityPoint[] = [];
  let equity = 100000;
  let peak = equity;
  const now = Date.now();

  for (let i = 90; i >= 0; i--) {
    const change = (Math.random() - 0.48) * 2000;
    equity += change;
    peak = Math.max(peak, equity);
    const drawdown = ((peak - equity) / peak) * 100;

    points.push({
      timestamp: now - i * 24 * 60 * 60 * 1000,
      equity,
      drawdown,
    });
  }

  return points;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PerformanceDashboard({
  strategyId,
  autoRefresh = true,
  refreshInterval = 30000,
}: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(generateMockMetrics());
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>(generateMockEquityCurve());
  const [loading, setLoading] = useState(false);

  const refreshData = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from IPC
      // const result = await window.api.performance.getMetrics(strategyId);
      // setMetrics(result.metrics);
      // setEquityCurve(result.equityCurve);

      // For now, use mock data
      setMetrics(generateMockMetrics());
      setEquityCurve(generateMockEquityCurve());
    } catch (error) {
      console.error('[PerformanceDashboard] Failed to refresh:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();

    if (autoRefresh) {
      const interval = setInterval(refreshData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [strategyId]);

  // ── Equity Curve SVG ─────────────────────────────────────────────────────

  const renderEquityCurve = () => {
    if (equityCurve.length === 0) return null;

    const width = 800;
    const height = 200;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const minEquity = Math.min(...equityCurve.map(p => p.equity));
    const maxEquity = Math.max(...equityCurve.map(p => p.equity));
    const equityRange = maxEquity - minEquity;

    const points = equityCurve.map((p, i) => {
      const x = padding + (i / (equityCurve.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((p.equity - minEquity) / equityRange) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    const maxDrawdown = Math.max(...equityCurve.map(p => p.drawdown));

    return (
      <svg width={width} height={height} className="w-full">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = padding + ratio * chartHeight;
          const value = maxEquity - ratio * equityRange;
          return (
            <g key={ratio}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#374151" strokeWidth="1" />
              <text x={padding - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">
                {formatCurrency(value)}
              </text>
            </g>
          );
        })}

        {/* Equity line */}
        <polyline
          points={points}
          fill="none"
          stroke="#10B981"
          strokeWidth="2"
        />

        {/* Max drawdown marker */}
        {maxDrawdown > 0 && (
          <text x={width - padding} y={padding - 5} textAnchor="end" fontSize="11" fill="#EF4444">
            Max DD: {maxDrawdown.toFixed(2)}%
          </text>
        )}
      </svg>
    );
  };

  // ── Monthly Returns Heatmap ──────────────────────────────────────────────

  const renderMonthlyHeatmap = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const returns = months.map(() => (Math.random() - 0.4) * 20);

    return (
      <div className="grid grid-cols-12 gap-1">
        {returns.map((ret, i) => {
          const intensity = Math.min(Math.abs(ret) / 10, 1);
          const color = ret >= 0
            ? `rgba(16, 185, 129, ${intensity})`
            : `rgba(239, 68, 68, ${intensity})`;

          return (
            <div
              key={i}
              className="aspect-square rounded flex items-center justify-center text-xs"
              style={{ backgroundColor: color }}
              title={`${months[i]}: ${ret.toFixed(2)}%`}
            >
              {ret.toFixed(1)}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 bg-gray-900 text-white">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Performance Dashboard</h2>
        <button
          onClick={refreshData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        {/* Sharpe Ratio */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Sharpe Ratio</div>
          <div className={`text-3xl font-bold ${getMetricColor(metrics.sharpe, [0.5, 1.5])}`}>
            {metrics.sharpe.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Risk-adjusted return</div>
        </div>

        {/* Sortino Ratio */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Sortino Ratio</div>
          <div className={`text-3xl font-bold ${getMetricColor(metrics.sortino, [1.0, 2.0])}`}>
            {metrics.sortino.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Downside risk adjusted</div>
        </div>

        {/* Calmar Ratio */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Calmar Ratio</div>
          <div className={`text-3xl font-bold ${getMetricColor(metrics.calmar, [0.5, 1.0])}`}>
            {metrics.calmar.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Return / Max Drawdown</div>
        </div>

        {/* Profit Factor */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Profit Factor</div>
          <div className={`text-3xl font-bold ${getMetricColor(metrics.profitFactor, [1.0, 2.0])}`}>
            {metrics.profitFactor.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Gross profit / Gross loss</div>
        </div>
      </div>

      {/* Trade Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold mb-3">Trade Statistics</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Trades</span>
              <span className="font-mono">{metrics.totalTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Winning Trades</span>
              <span className="font-mono text-green-400">{metrics.winningTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Losing Trades</span>
              <span className="font-mono text-red-400">{metrics.losingTrades}</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-2">
              <span className="text-gray-400">Win Rate</span>
              <span className={`font-mono ${getMetricColor(metrics.winRate, [0.45, 0.60])}`}>
                {formatPercent(metrics.winRate * 100)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold mb-3">Profit/Loss</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Avg Win</span>
              <span className="font-mono text-green-400">{formatCurrency(metrics.avgWin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Avg Loss</span>
              <span className="font-mono text-red-400">-{formatCurrency(metrics.avgLoss)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Win/Loss Ratio</span>
              <span className={`font-mono ${getMetricColor(metrics.winLossRatio, [1.0, 2.0])}`}>
                {metrics.winLossRatio.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-2">
              <span className="text-gray-400">Total P&L</span>
              <span className={`font-mono font-bold ${metrics.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(metrics.totalPnl)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold mb-3">Risk Metrics</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Max Drawdown</span>
              <span className={`font-mono ${getMetricColor(-metrics.maxDrawdown, [-15, -8])}`}>
                -{formatPercent(metrics.maxDrawdown)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Max DD Duration</span>
              <span className="font-mono">{metrics.maxDrawdownDuration} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Volatility</span>
              <span className={`font-mono ${getMetricColor(metrics.volatility, [10, 20])}`}>
                {formatPercent(metrics.volatility)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Annualized Return</span>
              <span className={`font-mono ${getMetricColor(metrics.annualizedReturn, [10, 25])}`}>
                {formatPercent(metrics.annualizedReturn)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold mb-3">Market Metrics</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Beta</span>
              <span className="font-mono">{metrics.beta.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Alpha</span>
              <span className={`font-mono ${getMetricColor(metrics.alpha, [0, 5])}`}>
                {formatPercent(metrics.alpha)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-4">
              Beta measures correlation with market. Alpha measures excess return.
            </div>
          </div>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Equity Curve</h3>
        {renderEquityCurve()}
      </div>

      {/* Monthly Returns Heatmap */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Monthly Returns (%)</h3>
        {renderMonthlyHeatmap()}
      </div>
    </div>
  );
}
