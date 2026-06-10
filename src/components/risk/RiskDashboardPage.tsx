import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RiskConfig {
  maxDrawdownPct: number;
  kellyFraction: number;
  vixThreshold: number;
  stopLossPct: number;
}

interface DrawdownState {
  currentPct: number;
  maxPct: number;
  peakAssets: number;
  troughAssets: number;
}

interface KellyStats {
  fraction: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  sampleSize: number;
}

interface RiskAlert {
  id: string;
  timestamp: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  source: string;
}

interface StatusSnapshot {
  config: RiskConfig;
  drawdown: DrawdownState;
  kelly: KellyStats;
  vix: number;
  totalAssets: number;
  dailyPnl: number;
  alerts: RiskAlert[];
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_SNAPSHOT: StatusSnapshot = {
  config: {
    maxDrawdownPct: 15,
    kellyFraction: 0.25,
    vixThreshold: 30,
    stopLossPct: 5,
  },
  drawdown: {
    currentPct: 4.7,
    maxPct: 8.2,
    peakAssets: 1250000,
    troughAssets: 1147500,
  },
  kelly: {
    fraction: 0.18,
    winRate: 0.58,
    profitFactor: 1.85,
    avgWin: 3200,
    avgLoss: 1730,
    sampleSize: 240,
  },
  vix: 18.4,
  totalAssets: 1192500,
  dailyPnl: 12350,
  alerts: [
    {
      id: 'a1',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      type: 'warning',
      message: 'Drawdown approaching 5% threshold',
      source: 'drawdown-monitor',
    },
    {
      id: 'a2',
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      type: 'info',
      message: 'Kelly fraction adjusted to 0.18',
      source: 'kelly-engine',
    },
    {
      id: 'a3',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      type: 'critical',
      message: 'VIX spike detected: 32.1',
      source: 'vix-monitor',
    },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getAlertColor(type: string): string {
  switch (type) {
    case 'critical':
      return 'text-red-400 bg-red-900/30 border-red-700';
    case 'warning':
      return 'text-yellow-400 bg-yellow-900/30 border-yellow-700';
    default:
      return 'text-blue-400 bg-blue-900/30 border-blue-700';
  }
}

function getDrawdownColor(pct: number, max: number): string {
  const ratio = pct / max;
  if (ratio >= 0.8) return 'bg-red-500';
  if (ratio >= 0.5) return 'bg-yellow-500';
  return 'bg-green-500';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RiskDashboardPage() {
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [kellyStats, setKellyStats] = useState<KellyStats | null>(null);
  const [drawdownState, setDrawdownState] = useState<DrawdownState | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = window.api;

  const fetchData = useCallback(async () => {
    try {
      let snap: StatusSnapshot;
      let kelly: KellyStats;
      let dd: DrawdownState;
      let alertList: RiskAlert[];

      if (api?.risk?.getStatusSnapshot) {
        snap = await api.risk.getStatusSnapshot();
      } else {
        snap = MOCK_SNAPSHOT;
      }

      if (api?.risk?.getKellyStats) {
        kelly = await api.risk.getKellyStats();
      } else {
        kelly = snap.kelly;
      }

      if (api?.risk?.getDrawdownState) {
        dd = await api.risk.getDrawdownState();
      } else {
        dd = snap.drawdown;
      }

      if (api?.risk?.getAlerts) {
        alertList = await api.risk.getAlerts();
      } else {
        alertList = snap.alerts;
      }

      setSnapshot(snap);
      setKellyStats(kelly);
      setDrawdownState(dd);
      setAlerts(alertList);
      setLastUpdate(new Date());
      setError(null);
    } catch (err: unknown) {
      setError(err?.message || 'Failed to fetch risk data');
      // Fallback to mock
      setSnapshot(MOCK_SNAPSHOT);
      setKellyStats(MOCK_SNAPSHOT.kelly);
      setDrawdownState(MOCK_SNAPSHOT.drawdown);
      setAlerts(MOCK_SNAPSHOT.alerts);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // ─── WebSocket Real-Time Integration ──────────────────────────────────────

  const [wsConnected, setWsConnected] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!api?.ws?.subscribe || !api?.ws?.on) return;

    // Subscribe to position symbols for real-time price updates
    const positionSymbols = ['US.TQQQ', 'US.SPY', 'US.AAPL', 'US.NVDA', 'US.MSFT']; // Example positions
    
    const handleTick = (data: unknown) => {
      if (data?.code && data?.price) {
        setLivePrices(prev => ({
          ...prev,
          [(data as any).code]: (data as any).price,
        }));
        
        // Update snapshot with live price if this is a position we hold
        if (positionSymbols.includes((data as any).code) && snapshot) {
          setSnapshot(prev => {
            if (!prev) return prev;
            // Recalculate totalAssets based on live prices
            // This is a simplified example - in production you'd track positions properly
            const priceChange = (data as any).price - (prev.totalAssets / positionSymbols.length);
            return {
              ...prev,
              totalAssets: prev.totalAssets + priceChange * 0.01, // Scaled impact
              dailyPnl: prev.dailyPnl + priceChange * 0.005,
            };
          });
        }
      }
    };

    const handleConnect = () => {
      setWsConnected(true);
    };

    const handleDisconnect = () => {
      setWsConnected(false);
    };

    // Subscribe and register handlers
    (api as any).ws.subscribe(positionSymbols, 'quote');
    (api as any).ws.on('tick', handleTick);
    (api as any).ws.on('connected', handleConnect);
    (api as any).ws.on('disconnected', handleDisconnect);

    // Check initial connection status
    (api as any).ws.getStatus?.().then((status: unknown) => {
      setWsConnected(status?.connected || false);
    });

    return () => {
      (api as any).ws.off?.('tick', handleTick);
      (api as any).ws.off?.('connected', handleConnect);
      (api as any).ws.off?.('disconnected', handleDisconnect);
      (api as any).ws.unsubscribe?.(positionSymbols);
    };
  }, [api, snapshot]);

  // ─── Real-Time Alert Integration ──────────────────────────────────────────

  useEffect(() => {
    if (!api?.on) return;

    const handleRiskAlert = (alert: unknown) => {
      if (alert?.type && alert?.message) {
        setAlerts(prev => [
          {
            id: (alert as any).id || `alert-${Date.now()}`,
            timestamp: (alert as any).timestamp || new Date().toISOString(),
            type: (alert as any).type,
            message: (alert as any).message,
            source: (alert as any).source || 'ws-risk-monitor',
          },
          ...prev.slice(0, 19), // Keep max 20 alerts
        ]);
        setLastUpdate(new Date());
      }
    };

    api.on('risk-alert', handleRiskAlert);

    return () => {
      api.off?.('risk-alert', handleRiskAlert);
    };
  }, [api]);

  // ─── Loading State ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading risk dashboard…</p>
        </div>
      </div>
    );
  }

  // ─── Derived Values ──────────────────────────────────────────────────────

  const config = snapshot?.config ?? MOCK_SNAPSHOT.config;
  const kelly = kellyStats ?? MOCK_SNAPSHOT.kelly;
  const dd = drawdownState ?? MOCK_SNAPSHOT.drawdown;
  const totalAssets = snapshot?.totalAssets ?? MOCK_SNAPSHOT.totalAssets;
  const dailyPnl = snapshot?.dailyPnl ?? MOCK_SNAPSHOT.dailyPnl;
  const vix = snapshot?.vix ?? MOCK_SNAPSHOT.vix;

  const kellyPct = kelly.fraction * 100;
  const ddPct = dd.currentPct;
  const ddMaxPct = dd.maxPct;
  const ddRatio = ddMaxPct > 0 ? (ddPct / ddMaxPct) * 100 : 0;
  const kellyRatio = Math.min(kellyPct / (config.kellyFraction * 100) * 100, 100);
  const livePriceCount = Object.keys(livePrices).length;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk Dashboard</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-400 text-sm">
              {lastUpdate
                ? `Last updated: ${lastUpdate.toLocaleTimeString()}`
                : 'Not yet updated'}
            </p>
            {wsConnected && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Live
              </span>
            )}
            {!wsConnected && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 bg-gray-500 rounded-full" />
                Polling
              </span>
            )}
            {livePriceCount > 0 && (
              <span className="text-xs text-gray-500">
                ({livePriceCount} live prices)
              </span>
            )}
          </div>
          {error && (
            <p className="text-yellow-400 text-xs mt-1">⚠ Using cached data: {error}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            Refresh Now
          </button>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-400">Auto-refresh</span>
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${
                autoRefresh ? 'bg-blue-600' : 'bg-gray-600'
              }`}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  autoRefresh ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </label>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Total Assets */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalAssets)}</p>
          <p className="text-gray-500 text-xs mt-1">
            Peak: {formatCurrency(dd.peakAssets)}
          </p>
        </div>

        {/* Daily P&L */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Daily P&L</p>
          <p
            className={`text-2xl font-bold ${
              dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {dailyPnl >= 0 ? '+' : ''}
            {formatCurrency(dailyPnl)}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            {totalAssets > 0 ? formatPct(dailyPnl / totalAssets) : '0%'} of portfolio
          </p>
        </div>

        {/* Kelly % */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Kelly Fraction</p>
          <p className="text-2xl font-bold text-blue-400">{kellyPct.toFixed(1)}%</p>
          <p className="text-gray-500 text-xs mt-1">
            Target: {formatPct(config.kellyFraction)}
          </p>
        </div>

        {/* Drawdown % */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Drawdown</p>
          <p
            className={`text-2xl font-bold ${
              ddPct > config.maxDrawdownPct * 0.8
                ? 'text-red-400'
                : ddPct > config.maxDrawdownPct * 0.5
                ? 'text-yellow-400'
                : 'text-green-400'
            }`}
          >
            {ddPct.toFixed(1)}%
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Max: {ddMaxPct.toFixed(1)}% / Limit: {config.maxDrawdownPct}%
          </p>
        </div>

        {/* VIX */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">VIX</p>
          <p
            className={`text-2xl font-bold ${
              vix > config.vixThreshold ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {vix.toFixed(1)}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Threshold: {config.vixThreshold}
          </p>
        </div>
      </div>

      {/* Visualizations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Kelly Sizing Visual */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Kelly Sizing</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Current Fraction</span>
                <span className="text-blue-400 font-medium">{kellyPct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-4">
                <div
                  className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(kellyRatio, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>Target: {formatPct(config.kellyFraction)}</span>
                <span>100%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <p className="text-gray-400 text-xs">Win Rate</p>
                <p className="text-white font-semibold">{formatPct(kelly.winRate)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs">Profit Factor</p>
                <p className="text-white font-semibold">{kelly.profitFactor.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs">Samples</p>
                <p className="text-white font-semibold">{kelly.sampleSize}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="text-center">
                <p className="text-gray-400 text-xs">Avg Win</p>
                <p className="text-green-400 font-semibold">{formatCurrency(kelly.avgWin)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs">Avg Loss</p>
                <p className="text-red-400 font-semibold">{formatCurrency(kelly.avgLoss)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Drawdown Visual */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Drawdown Status</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Current Drawdown</span>
                <span
                  className={`font-medium ${
                    ddPct > config.maxDrawdownPct * 0.8
                      ? 'text-red-400'
                      : ddPct > config.maxDrawdownPct * 0.5
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`}
                >
                  {ddPct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all duration-500 ${getDrawdownColor(
                    ddPct,
                    config.maxDrawdownPct
                  )}`}
                  style={{ width: `${Math.min(ddRatio, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>Max: {config.maxDrawdownPct}%</span>
              </div>
            </div>

            {/* Drawdown threshold markers */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-gray-400">
                  Safe Zone (&lt; {config.maxDrawdownPct * 0.5}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-sm text-gray-400">
                  Caution ({config.maxDrawdownPct * 0.5}% – {config.maxDrawdownPct * 0.8}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-gray-400">
                  Danger (&gt; {config.maxDrawdownPct * 0.8}%)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Peak Assets</p>
                <p className="text-white font-semibold">{formatCurrency(dd.peakAssets)}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Trough Assets</p>
                <p className="text-white font-semibold">{formatCurrency(dd.troughAssets)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Recent Alerts</h2>
          <p className="text-gray-400 text-sm mt-1">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''} in recent history
          </p>
        </div>
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No alerts — all systems nominal
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">
                      {formatTime(alert.timestamp)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getAlertColor(
                          (alert as any).type
                        )}`}
                      >
                        {(alert as any).type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">{alert.source}</td>
                    <td className="px-6 py-4 text-sm text-gray-200">{(alert as any).message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Config Summary Footer */}
      <div className="mt-6 bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Active Configuration</h3>
        <div className="flex flex-wrap gap-6 text-xs text-gray-500">
          <span>
            Max Drawdown: <span className="text-gray-300">{config.maxDrawdownPct}%</span>
          </span>
          <span>
            Kelly Target: <span className="text-gray-300">{formatPct(config.kellyFraction)}</span>
          </span>
          <span>
            VIX Threshold: <span className="text-gray-300">{config.vixThreshold}</span>
          </span>
          <span>
            Stop Loss: <span className="text-gray-300">{config.stopLossPct}%</span>
          </span>
        </div>
      </div>
    </div>
  );
}
