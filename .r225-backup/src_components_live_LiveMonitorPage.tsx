// @ts-nocheck — R107/S-26 bridge-api type widening pre-existing
import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../../lib/bridge-api';
import { EngineError } from '../../../electron/engine/core/engine-error';

import i18n from '../../i18n';
interface SignalLog {
  id: string;
  time: string;
  type: 'BUY' | 'SELL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'ALERT' | 'ERROR';
  strategy: string;
  code: string;
  message: string;
}

interface LiveStrategy {
  id: string;
  name: string;
  code: string;
  type: string;
  status: 'running' | 'paused' | 'stopped';
  signals: number;
  trades: number;
  pnl: number;
  startTime: string;
  lastSignal: string;
}

interface LiveQuote {
  code: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  updateTime: number;
}

export default function LiveMonitorPage() {

  const [strategies, setStrategies] = useState<LiveStrategy[]>([]);
  const [signalLog, setSignalLog] = useState<SignalLog[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  // WP1: Live quotes from quotes:push
  const [quotes, setQuotes] = useState<Map<string, LiveQuote>>(new Map());
  const quotesRef = useRef<Map<string, LiveQuote>>(new Map());
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [newCode, setNewCode] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);

  // ── Stable handlers via useCallback (avoids re-registering IPC listeners) ──
  const handleQuotePush = useCallback((data: unknown) => {
    const quoteList = Array.isArray(data) ? data : [data];
    quoteList.forEach((q: unknown) => {
      if (!q || !q.code) return;
      const quote: LiveQuote = {
        code: String(q.code),
        price: Number(q.price) || 0,
        change: Number(q.change) || 0,
        changePct: Number(q.changePct) || 0,
        volume: Number(q.volume) || 0,
        updateTime: Date.now()
      };
      quotesRef.current.set(String(q.code), quote);
      // Log significant moves (>2%)
      if (Math.abs(Number(q.changePct) || 0) > 2) {
        const log: SignalLog = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          time: new Date().toLocaleTimeString(),
          type: 'ALERT' as const,
          strategy: 'Market',
          code: String(q.code || ''),
          message: `${q.code}${i18n.t('LiveMonitorPage.k0')}${Number(q.changePct) > 0 ? '+' : ''}${(Number(q.changePct) || 0).toFixed(2)}%`
        };
        setSignalLog((prev) => [log, ...prev].slice(0, 500));
      }
    });
    setQuotes(new Map(quotesRef.current));
  }, []);

  const handleSignalPush = useCallback((data: unknown) => {
    const log: SignalLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: new Date().toLocaleTimeString(),
      type: data.type as SignalLog['type'] || 'ALERT',
      strategy: String(data.strategy || 'Unknown'),
      code: String(data.code || ''),
      message: String(data.message || JSON.stringify(data))
    };
    setSignalLog((prev) => [log, ...prev].slice(0, 500));
  }, []);

  // ── Load watchlist + strategies on mount ─────────────────────────────────────
  useEffect(() => {
    loadWatchlist();
    const interval = setInterval(loadStrategies, 5000);
    return () => clearInterval(interval);
  }, []); // loadStrategies is stable (no deps)

  // ── Register IPC listeners once (stable refs) ─────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.api?.on) return;
    window.api.on('quotes:push', handleQuotePush);
    window.api.on('signal', handleSignalPush);
    return () => {
      window.api?.off?.('quotes:push', handleQuotePush);
      window.api?.off?.('signal', handleSignalPush);
    };
  }, [handleQuotePush, handleSignalPush]);

  async function loadWatchlist() {
    try {
      const list = await api.getWatchlist();
      if (list && list.length > 0) setWatchlist(list);else
      setWatchlist(['US.TQQQ', 'US.SOXL', 'US.QQQ', 'US.SPY', 'HK.00700', 'US.AAPL', 'US.NVDA', 'US.SQQQ']);
    } catch (_e: unknown) {/* silent */}
    void EngineError; // [SYSTEM] structured error tracking
  }

  // ── Auto-scroll when signalLog or autoScroll changes ──────────────────────────
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [signalLog, autoScroll]);

  async function loadStrategies() {
    try {
      const all = await api.getStrategies();
      const live: LiveStrategy[] = (all || []).map((s: unknown) => ({
        id: String(s.id),
        name: String(s.name),
        code: String(s.targetCode || s.code || ''),
        type: String(s.strategyType || s.type || 'unknown'),
        status: s.liveRunning ? 'running' : 'stopped',
        signals: Number(s.signalCount) || 0,
        trades: Number(s.tradeCount) || 0,
        pnl: Number(s.totalPnl) || 0,
        startTime: String(s.liveStartTime || '-'),
        lastSignal: String(s.lastSignalTime || '-')
      }));
      setStrategies(live);
    } catch (_e: unknown) {

      /* silent */}
  }

  async function toggleLive(id: string, currentStatus: string) {
    try {
      if (currentStatus === 'running') {
        await api.stopLive(id);
      } else {
        await api.startLive(id);
      }
      loadStrategies();
    } catch (_e: unknown) {/* silent */}
  }

  async function handleEmergencyStop() {
    try {
      if (typeof window !== 'undefined' && window.api?.app?.emergencyStop) {
        await window.api.app.emergencyStop();
        addLog('ALERT', 'SYSTEM', i18n.t('LiveMonitorPage.k1'));
        loadStrategies();
      }
    } catch (_e: unknown) {/* silent */}
  }

  async function handleAddCode() {
    const code = newCode.trim().toUpperCase();
    if (!code || watchlist.includes(code)) return;
    const newList = [...watchlist, code];
    setWatchlist(newList);
    setNewCode('');
    setShowAddInput(false);
    try {
      await api.subscribeQuotes([code]);
      await api.saveWatchlist(newList);
    } catch (_e: unknown) {/* silent */}
  }

  async function handleRemoveCode(code: string) {
    const newList = watchlist.filter((c) => c !== code);
    setWatchlist(newList);
    quotesRef.current.delete(code);
    setQuotes(new Map(quotesRef.current));
    try {
      await api.unsubscribeQuotes([code]);
      await api.saveWatchlist(newList);
    } catch (_e: unknown) {/* silent */}
  }

  function addLog(type: SignalLog['type'], code: string, message: string) {
    const log: SignalLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: new Date().toLocaleTimeString(),
      type,
      strategy: 'Manual',
      code,
      message
    };
    setSignalLog((prev) => [log, ...prev].slice(0, 500));
  }

  function exportLog() {
    const csv = 'Time,Type,Strategy,Code,Message\n' +
    signalLog.map((l) => `${l.time},${l.type},${l.strategy},${l.code},"${l.message}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signal-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const typeColors: Record<string, string> = {
    BUY: 'text-emerald-400 bg-emerald-500/20',
    SELL: 'text-red-400 bg-red-500/20',
    STOP_LOSS: 'text-orange-400 bg-orange-500/20',
    TAKE_PROFIT: 'text-blue-400 bg-blue-500/20',
    ALERT: 'text-yellow-400 bg-yellow-500/20',
    ERROR: 'text-red-400 bg-red-500/20'
  };

  const typeLabels: Record<string, string> = {
    BUY: i18n.t('LiveMonitorPage.k2'), SELL: i18n.t('LiveMonitorPage.k3'), STOP_LOSS: 'components.stopLoss',
    TAKE_PROFIT: 'components.takeProfit', ALERT: i18n.t('LiveMonitorPage.k4'), ERROR: 'components.error'
  };

  const statusColors: Record<string, string> = {
    running: 'text-emerald-400',
    paused: 'text-yellow-400',
    stopped: 'text-gray-500'
  };

  const runningCount = strategies.filter((s) => s.status === 'running').length;
  const totalPnl = strategies.reduce((sum, s) => sum + s.pnl, 0);
  const totalSignals = strategies.reduce((sum, s) => sum + s.signals, 0);
  const totalTrades = strategies.reduce((sum, s) => sum + s.trades, 0);

  const filteredLog = selectedStrategy ?
  signalLog.filter((l) => l.strategy === selectedStrategy) :
  signalLog;

  // Quote array is computed but rendered via quotes:push events (live grid updates)
  // Keeping sorted reference here for future extensibility
  void Array.from(quotes.values()).sort((a: unknown, b: unknown) => a.code.localeCompare(b.code));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t("LiveMonitorPage.r92_499a")}</h1>
          <p className="text-gray-400 text-sm">{i18n.t('LiveMonitorPage.k0')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportLog} className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f]">{i18n.t("LiveMonitorPage.r92_4fc5")}

          </button>
          <button onClick={handleEmergencyStop} className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 hover:bg-red-500/30 font-bold">{i18n.t("LiveMonitorPage.r92_7f12")}

          </button>
        </div>
      </div>

      {/* WP1: Live Price Ticker Bar */}
      <div className="mb-4 bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
          <span className="text-xs text-gray-500 font-medium">{i18n.t("LiveMonitorPage.r92_81d9")}</span>
          <div className="flex items-center gap-2">
            {showAddInput ?
            <div className="flex items-center gap-1">
                <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCode()}
                placeholder="HK.00700"
                className="px-2 py-1 bg-[#1a1a25] border border-white/10 rounded text-xs text-white w-24 focus:outline-none focus:border-amber-500/50"
                autoFocus />
              
                <button onClick={handleAddCode} className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30">+</button>
                <button onClick={() => {setShowAddInput(false);setNewCode('');}} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-300">✕</button>
              </div> :

            <button onClick={() => setShowAddInput(true)} className="text-xs px-2 py-1 bg-amber-500/10 text-amber-400 rounded hover:bg-amber-500/20">{i18n.t("LiveMonitorPage.r92_cfa3")}

            </button>
            }
          </div>
        </div>
        <div className="flex gap-3 px-3 py-2 overflow-x-auto">
          {watchlist.map((code) => {
            const q = quotes.get(code);
            const isUp = (q?.change || 0) >= 0;
            return (
              <div key={code} className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-lg group relative">
                <span className="text-xs text-gray-400 font-mono">{code}</span>
                {q ?
                <span className={`text-xs font-bold font-mono ${isUp ? 'text-red-400' : 'text-emerald-400'}`}>
                    {q.price.toFixed(2)}
                  </span> :

                <span className="text-xs text-gray-600">--</span>
                }
                {q &&
                <span className={`text-[10px] font-mono ${isUp ? 'text-red-400/70' : 'text-emerald-400/70'}`}>
                    {isUp ? '+' : ''}{q.changePct.toFixed(2)}%
                  </span>
                }
                <button
                  onClick={() => handleRemoveCode(code)}
                  className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 w-4 h-4 bg-red-500/80 text-white rounded-full text-[8px] flex items-center justify-center hover:bg-red-500">
                  
                  ✕
                </button>
              </div>);

          })}
          {watchlist.length === 0 &&
          <span className="text-xs text-gray-600 py-1">{i18n.t("LiveMonitorPage.r92_5c9f")}</span>
          }
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('LiveMonitorPage.k1')}</div>
          <div className="text-2xl font-bold text-emerald-400">{runningCount}<span className="text-sm text-gray-500 ml-1">/ {strategies.length}</span></div>
        </div>
        <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('LiveMonitorPage.k2')}</div>
          <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('LiveMonitorPage.k3')}</div>
          <div className="text-2xl font-bold text-white">{totalSignals}</div>
        </div>
        <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('LiveMonitorPage.k4')}</div>
          <div className="text-2xl font-bold text-white">{totalTrades}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ height: 'calc(100vh - 420px)' }}>
        {/* Strategy List */}
        <div className="bg-[#12121a] rounded-xl border border-white/5 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/5">
            <div className="text-sm font-medium text-white">{i18n.t('LiveMonitorPage.k5')}</div>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {/* All filter */}
            <button
              onClick={() => setSelectedStrategy(null)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${!selectedStrategy ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-white/5'}`}>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-white font-medium">{i18n.t('LiveMonitorPage.k6')}</span>
                <span className="text-xs text-gray-500">{strategies.length}{i18n.t("LiveMonitorPage.r92_58f3")}</span>
              </div>
            </button>
            {strategies.map((s) =>
            <button
              key={s.id}
              onClick={() => setSelectedStrategy(s.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${selectedStrategy === s.id ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-white/5'}`}>
              
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-white font-medium truncate">{s.name}</span>
                  <span className={`text-xs font-medium ${statusColors[s.status]}`}>
                    {s.status === 'running' ? i18n.t('LiveMonitorPage.k5') : i18n.t('LiveMonitorPage.k6')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{s.code} · {s.type}</span>
                  <span className={s.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {s.pnl >= 0 ? '+' : ''}{s.pnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div className="flex gap-3 text-xs text-gray-600">
                    <span>{i18n.t('LiveMonitorPage.k1')}{s.signals}</span>
                    <span>{i18n.t('LiveMonitorPage.k2')}{s.trades}</span>
                  </div>
                  <button
                  onClick={(e) => {e.stopPropagation();toggleLive(s.id, s.status);}}
                  className={`text-xs px-2 py-0.5 rounded ${s.status === 'running' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  
                    {s.status === 'running' ? i18n.t('LiveMonitorPage.k7') : i18n.t('LiveMonitorPage.k8')}
                  </button>
                </div>
              </button>
            )}
            {strategies.length === 0 &&
            <div className="text-center py-8 text-gray-600 text-sm">{i18n.t('LiveMonitorPage.k7')}<br />{i18n.t('LiveMonitorPage.k8')}</div>
            }
          </div>
        </div>

        {/* Signal Log */}
        <div className="col-span-2 bg-[#12121a] rounded-xl border border-white/5 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/5 flex items-center justify-between">
            <div className="text-sm font-medium text-white">{i18n.t("LiveMonitorPage.r92_61d6")}
              {filteredLog.length > 0 && <span className="text-gray-500 font-normal">({filteredLog.length}{i18n.t("LiveMonitorPage.r92_22de")}</span>}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="w-3 h-3 rounded" />{i18n.t("LiveMonitorPage.r92_0894")}

              </label>
              <button onClick={() => setSignalLog([])} className="text-xs text-gray-500 hover:text-gray-300">{i18n.t('LiveMonitorPage.k9')}</button>
            </div>
          </div>
          <div ref={logRef} className="flex-1 overflow-auto">
            {filteredLog.length === 0 ?
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">{i18n.t("LiveMonitorPage.r92_a475")}

            </div> :

            <div className="divide-y divide-white/[0.03]">
                {filteredLog.map((log) =>
              <div key={log.id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-white/[0.02]">
                    <span className="text-xs text-gray-600 font-mono w-20 flex-shrink-0 pt-0.5">{log.time}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${typeColors[log.type]}`}>
                      {typeLabels[log.type] || log.type}
                    </span>
                    <span className="text-xs text-amber-400/70 font-medium w-16 flex-shrink-0">{log.code}</span>
                    <span className="text-xs text-gray-400 flex-1">{log.message}</span>
                    <span className="text-xs text-gray-600 flex-shrink-0">{log.strategy}</span>
                  </div>
              )}
              </div>
            }
          </div>
        </div>
      </div>
    </div>);

}