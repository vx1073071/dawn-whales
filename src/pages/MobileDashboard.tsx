import { useState, useEffect } from 'react';
import { api, PLATFORM } from '@/lib/platform-api';

// ── PWA Monitoring Dashboard ──────────────────────────────────────────────
// Lightweight mobile-first dashboard for real-time monitoring
// Works in both Electron and PWA modes

interface Quote {
  code: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
}

interface Strategy {
  id: string;
  name: string;
  symbol: string;
  status: string;
  liveRunning: boolean;
  totalPnl: number;
  signalCount: number;
}

interface Signal {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  price: number;
  time: string;
  reason: string;
}

interface RiskStatus {
  kelly: {
    kellyFraction: number;
    winRate: number;
    sampleSize: number;
  };
  drawdown: {
    currentDrawdownPct: number;
    isReduced: boolean;
    reductionFactor: number;
  };
  currentVix: number | null;
  volatilityFactor: number;
}

export default function MobileDashboard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [riskStatus, setRiskStatus] = useState<RiskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Default watchlist
  const watchlist = ['US.TQQQ', 'US.QQQ', 'US.SPY', 'HK.00700', 'HK.09988'];

  useEffect(() => {
    loadData();
    
    // Refresh every 5 seconds
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      // Load all data in parallel
      const [quotesData, strategiesData, riskData] = await Promise.all([
        api.getQuotes(watchlist).catch(() => []),
        api.getStrategies().catch(() => []),
        api.getRiskStatus().catch(() => null),
      ]);

      setQuotes(quotesData);
      setStrategies(strategiesData);
      if (riskData?.success) setRiskStatus(riskData.snapshot);
      
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Failed to load data:', err);
      setLoading(false);
    }
  }

  // Listen for real-time signals (Electron only)
  useEffect(() => {
    if (PLATFORM !== 'electron') return;

    const handler = (data: any) => {
      const signal: Signal = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        strategyId: data.strategyId || '',
        strategyName: data.strategyName || 'Unknown',
        symbol: data.symbol || '',
        signal: data.signal || 'HOLD',
        price: data.price || 0,
        time: new Date().toLocaleTimeString(),
        reason: data.reason || '',
      };
      setSignals(prev => [signal, ...prev].slice(0, 20)); // Keep last 20
    };

    window.api?.on('strategy-signal', handler);
    return () => {
      // Cleanup handled by platform-api
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  const activeStrategies = strategies.filter(s => s.liveRunning);
  const totalPnl = strategies.reduce((sum, s) => sum + (s.totalPnl || 0), 0);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-20">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-amber-400">道鲸监控</h1>
        <p className="text-xs text-slate-500">
          最后更新: {lastUpdate.toLocaleTimeString()} · {PLATFORM === 'electron' ? '桌面端' : 'PWA'}
        </p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">运行策略</div>
          <div className="text-2xl font-bold text-emerald-400">
            {activeStrategies.length}
            <span className="text-sm text-slate-500 ml-1">/ {strategies.length}</span>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">总盈亏</div>
          <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Risk Status */}
      {riskStatus && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">风控状态</h2>
          <div className="bg-slate-800 rounded-lg p-4 space-y-3">
            {/* Kelly Sizing */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Kelly 仓位</span>
              <span className="text-sm font-mono text-amber-400">
                {(riskStatus.kelly.kellyFraction * 100).toFixed(1)}%
              </span>
            </div>
            
            {/* Drawdown */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">当前回撤</span>
              <span className={`text-sm font-mono ${
                riskStatus.drawdown.isReduced ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {(riskStatus.drawdown.currentDrawdownPct * 100).toFixed(1)}%
                {riskStatus.drawdown.isReduced && ' ⚠️ 降仓'}
              </span>
            </div>
            
            {/* VIX */}
            {riskStatus.currentVix && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">VIX 波动率</span>
                <span className={`text-sm font-mono ${
                  riskStatus.currentVix > 30 ? 'text-red-400' : 
                  riskStatus.currentVix > 20 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {riskStatus.currentVix.toFixed(1)}
                  <span className="text-xs ml-1">
                    (×{riskStatus.volatilityFactor.toFixed(2)})
                  </span>
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Quotes */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">实时行情</h2>
        <div className="space-y-2">
          {quotes.map(quote => {
            const isUp = quote.changePct >= 0;
            return (
              <div key={quote.code} className="bg-slate-800 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <div className="text-sm font-mono text-slate-200">{quote.code}</div>
                  <div className="text-xs text-slate-500">
                    Vol: {(quote.volume / 1000000).toFixed(1)}M
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-white">
                    {quote.price.toFixed(2)}
                  </div>
                  <div className={`text-xs font-mono ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isUp ? '+' : ''}{quote.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
          {quotes.length === 0 && (
            <div className="text-center text-slate-500 py-8 text-sm">
              暂无行情数据
            </div>
          )}
        </div>
      </section>

      {/* Active Strategies */}
      {activeStrategies.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">运行中策略</h2>
          <div className="space-y-2">
            {activeStrategies.map(strategy => (
              <div key={strategy.id} className="bg-slate-800 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{strategy.name}</div>
                    <div className="text-xs text-slate-500">{strategy.symbol}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span className="text-xs text-emerald-400">运行中</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">信号: {strategy.signalCount || 0}</span>
                  <span className={strategy.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {strategy.totalPnl >= 0 ? '+' : ''}{(strategy.totalPnl || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Signal Feed */}
      {signals.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">信号推送</h2>
          <div className="space-y-2">
            {signals.slice(0, 10).map(signal => (
              <div key={signal.id} className="bg-slate-800 rounded-lg p-3">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      signal.signal === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' :
                      signal.signal === 'SELL' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-600/20 text-slate-400'
                    }`}>
                      {signal.signal === 'BUY' ? '买入' : signal.signal === 'SELL' ? '卖出' : '持有'}
                    </span>
                    <span className="text-xs text-slate-500">{signal.time}</span>
                  </div>
                  <span className="text-xs text-amber-400 font-mono">{signal.symbol}</span>
                </div>
                <div className="text-xs text-slate-400 mb-1">{signal.strategyName}</div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">@ {signal.price.toFixed(2)}</span>
                  <span className="text-slate-500 truncate ml-2">{signal.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {strategies.length === 0 && signals.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-slate-400 text-sm mb-2">暂无策略运行</div>
          <div className="text-slate-500 text-xs">
            在桌面端创建并启动策略后，这里会显示实时状态
          </div>
        </div>
      )}
    </div>
  );
}
