/**
 * DAWN WHALES R123 J02 — SignalDashboard Data Pipeline Connector
 * 
 * Bridges signal-push-engine with SignalDashboard UI.
 * Subscribes to strategy signals via IPC and provides React hook.
 */

import { useEffect, useState, useCallback } from 'react';

// ═══════════ Types ════════════════════════════════════

export interface SignalData {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;    // 0-100
  price: number;
  timestamp: number;
  reason?: string;
  copyTradeCount?: number;
  category?: 'trend' | 'momentum' | 'arbitrage' | 'mean-reversion';
}

export interface SignalDashboardData {
  signals: SignalData[];
  totalSignals: number;
  activeStrategies: number;
  copyTradeSummary?: {
    activeCopies: number;
    totalPnL: number;
  };
}

// ═══════════ Hook: useSignalPipeline ═══════════════════

export function useSignalPipeline() {
  const [signals, setSignals] = useState<SignalData[]>([]);
  const [stats, setStats] = useState({ totalSignals: 0, activeStrategies: 0 });
  const [isConnected, setIsConnected] = useState(false);

  // Subscribe to signal push
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.on) return;

    const unsubSignal = api.on('strategy-signal', (data: SignalData) => {
      setSignals(prev => [data, ...prev].slice(0, 100));
      setStats(prev => ({ ...prev, totalSignals: prev.totalSignals + 1 }));
      setIsConnected(true);
    });

    const unsubTrade = api.on('trade:signal-generated', (data: SignalData) => {
      setSignals(prev => [data, ...prev].slice(0, 100));
    });

    return () => { unsubSignal?.(); unsubTrade?.(); };
  }, []);

  // Load initial signals from backend
  useEffect(() => {
    const api = (window as any).api;
    api?.db?.getSignals().then((result: any) => {
      if (result?.success && result.signals) {
        setSignals(result.signals.slice(0, 100));
        setStats(prev => ({ ...prev, totalSignals: result.signals.length }));
      }
    });
    api?.strategy?.getAll().then((result: any) => {
      if (result?.success && result.strategies) {
        setStats(prev => ({ ...prev, activeStrategies: result.strategies.length }));
      }
    });
  }, []);

  const clearSignals = useCallback(() => setSignals([]), []);

  return { signals, stats, isConnected, clearSignals };
}

// ═══════════ SignalDashboard Component ═══════════════════

export const SignalDashboard: React.FC = () => {
  const { signals, stats, isConnected } = useSignalPipeline();
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all'
    ? signals
    : signals.filter(s => s.signal === filter);

  return (
    <div className="p-4 bg-[#0d1117] text-[#c9d1d9] h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#58a6ff]">Signal Dashboard</h2>
        <div className="flex items-center gap-3 text-[10px]">
          <span className={`px-2 py-0.5 rounded-full ${isConnected ? 'bg-[#0d3320] text-[#3fb950]' : 'bg-[#330d17] text-[#f85149]'}`}>
            {isConnected ? 'Live' : 'Offline'}
          </span>
          <span className="text-[#484f58]">
            {stats.totalSignals} signals | {stats.activeStrategies} strategies
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3">
        {['all', 'BUY', 'SELL', 'HOLD'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-[11px] rounded-full border transition-colors ${
              filter === f
                ? 'border-[#58a6ff] bg-[#58a6ff20] text-[#58a6ff]'
                : 'border-[#30363d] text-[#8b949e] hover:bg-[#1c2333]'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Signal List */}
      <div className="space-y-1">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-[#484f58] text-sm">
            {isConnected ? 'Waiting for signals...' : 'Connect a broker to receive signals'}
          </div>
        )}
        {filtered.map(signal => (
          <div
            key={signal.id}
            className="flex items-center gap-3 p-2.5 bg-[#161b22] border border-[#21262d] rounded-lg hover:bg-[#1c2333] transition-colors"
          >
            {/* Signal Type Badge */}
            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
              signal.signal === 'BUY' ? 'bg-[#22c55e20] text-[#22c55e]' :
              signal.signal === 'SELL' ? 'bg-[#ef444420] text-[#ef4444]' :
              'bg-[#8b949e20] text-[#8b949e]'
            }`}>
              {signal.signal}
            </span>

            {/* Strategy + Symbol */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-[#c9d1d9] truncate">{signal.strategyName}</span>
                <span className="text-[#484f58]">|</span>
                <span className="font-mono text-[#58a6ff]">{signal.symbol}</span>
              </div>
              {signal.reason && (
                <div className="text-[10px] text-[#484f58] truncate">{signal.reason}</div>
              )}
            </div>

            {/* Confidence + Time */}
            <div className="flex flex-col items-end text-[10px]">
              <span className="text-[#c9d1d9] font-mono">{signal.confidence}%</span>
              <span className="text-[#484f58]">{new Date(signal.timestamp).toLocaleTimeString()}</span>
            </div>

            {/* Copy-trade count */}
            {signal.copyTradeCount != null && signal.copyTradeCount > 0 && (
              <span className="text-[10px] text-[#f0883e]">{signal.copyTradeCount} copies</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
