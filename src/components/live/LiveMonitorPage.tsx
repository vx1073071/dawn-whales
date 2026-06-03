import { useState, useEffect, useRef } from 'react';
import * as api from '../../lib/bridge-api';

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

export default function LiveMonitorPage() {
  const [strategies, setStrategies] = useState<LiveStrategy[]>([]);
  const [signalLog, setSignalLog] = useState<SignalLog[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStrategies();
    const interval = setInterval(loadStrategies, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time signals
  useEffect(() => {
    if (typeof window !== 'undefined' && window.api?.on) {
      const handler = (data: any) => {
        const log: SignalLog = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          time: new Date().toLocaleTimeString(),
          type: data.type || 'ALERT',
          strategy: data.strategy || 'Unknown',
          code: data.code || '',
          message: data.message || JSON.stringify(data),
        };
        setSignalLog((prev) => [log, ...prev].slice(0, 500));
      };
      window.api.on('signal', handler);
      return () => { window.api?.off?.('signal', handler); };
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [signalLog, autoScroll]);

  async function loadStrategies() {
    try {
      const all = await api.getStrategies();
      const live: LiveStrategy[] = (all || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        code: s.targetCode || s.code || '',
        type: s.strategyType || s.type || 'unknown',
        status: s.liveRunning ? 'running' : 'stopped',
        signals: s.signalCount || 0,
        trades: s.tradeCount || 0,
        pnl: s.totalPnl || 0,
        startTime: s.liveStartTime || '-',
        lastSignal: s.lastSignalTime || '-',
      }));
      setStrategies(live);
    } catch {
      /* silent */
    }
  }

  async function toggleLive(id: string, currentStatus: string) {
    try {
      if (currentStatus === 'running') {
        await api.stopLive(id);
      } else {
        await api.startLive(id);
      }
      loadStrategies();
    } catch { /* silent */ }
  }

  async function handleEmergencyStop() {
    try {
      if (typeof window !== 'undefined' && window.api?.app?.emergencyStop) {
        await window.api.app.emergencyStop();
        addLog('ALERT', 'SYSTEM', '紧急停止已触发，所有策略已停止');
        loadStrategies();
      }
    } catch { /* silent */ }
  }

  function addLog(type: SignalLog['type'], code: string, message: string) {
    const log: SignalLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: new Date().toLocaleTimeString(),
      type,
      strategy: 'Manual',
      code,
      message,
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
    ERROR: 'text-red-400 bg-red-500/20',
  };

  const typeLabels: Record<string, string> = {
    BUY: '买入', SELL: '卖出', STOP_LOSS: '止损',
    TAKE_PROFIT: '止盈', ALERT: '告警', ERROR: '错误',
  };

  const statusColors: Record<string, string> = {
    running: 'text-emerald-400',
    paused: 'text-yellow-400',
    stopped: 'text-gray-500',
  };

  const runningCount = strategies.filter((s) => s.status === 'running').length;
  const totalPnl = strategies.reduce((sum, s) => sum + s.pnl, 0);
  const totalSignals = strategies.reduce((sum, s) => sum + s.signals, 0);
  const totalTrades = strategies.reduce((sum, s) => sum + s.trades, 0);

  const filteredLog = selectedStrategy
    ? signalLog.filter((l) => l.strategy === selectedStrategy)
    : signalLog;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">⚡ 实盘监控</h1>
          <p className="text-gray-400 text-sm">实时策略运行状态 · 信号推送日志 · 紧急停止</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportLog} className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f]">
            📥 导出日志
          </button>
          <button onClick={handleEmergencyStop} className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 hover:bg-red-500/30 font-bold">
            🛑 紧急停止
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
          <div className="text-xs text-gray-500 mb-1">运行中策略</div>
          <div className="text-2xl font-bold text-emerald-400">{runningCount}<span className="text-sm text-gray-500 ml-1">/ {strategies.length}</span></div>
        </div>
        <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
          <div className="text-xs text-gray-500 mb-1">今日盈亏</div>
          <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
          <div className="text-xs text-gray-500 mb-1">信号总数</div>
          <div className="text-2xl font-bold text-white">{totalSignals}</div>
        </div>
        <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
          <div className="text-xs text-gray-500 mb-1">成交总数</div>
          <div className="text-2xl font-bold text-white">{totalTrades}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ height: 'calc(100vh - 320px)' }}>
        {/* Strategy List */}
        <div className="bg-[#12121a] rounded-xl border border-white/5 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/5">
            <div className="text-sm font-medium text-white">策略列表</div>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {/* All filter */}
            <button
              onClick={() => setSelectedStrategy(null)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${!selectedStrategy ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-white/5'}`}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm text-white font-medium">全部策略</span>
                <span className="text-xs text-gray-500">{strategies.length} 个</span>
              </div>
            </button>
            {strategies.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStrategy(s.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${selectedStrategy === s.id ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-white/5'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-white font-medium truncate">{s.name}</span>
                  <span className={`text-xs font-medium ${statusColors[s.status]}`}>
                    {s.status === 'running' ? '● 运行中' : '○ 已停止'}
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
                    <span>信号 {s.signals}</span>
                    <span>成交 {s.trades}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLive(s.id, s.status); }}
                    className={`text-xs px-2 py-0.5 rounded ${s.status === 'running' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}
                  >
                    {s.status === 'running' ? '停止' : '启动'}
                  </button>
                </div>
              </button>
            ))}
            {strategies.length === 0 && (
              <div className="text-center py-8 text-gray-600 text-sm">暂无策略<br />前往策略工坊创建</div>
            )}
          </div>
        </div>

        {/* Signal Log */}
        <div className="col-span-2 bg-[#12121a] rounded-xl border border-white/5 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/5 flex items-center justify-between">
            <div className="text-sm font-medium text-white">
              信号日志 {filteredLog.length > 0 && <span className="text-gray-500 font-normal">({filteredLog.length} 条)</span>}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="w-3 h-3 rounded" />
                自动滚动
              </label>
              <button onClick={() => setSignalLog([])} className="text-xs text-gray-500 hover:text-gray-300">清空</button>
            </div>
          </div>
          <div ref={logRef} className="flex-1 overflow-auto">
            {filteredLog.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                等待信号推送...
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {filteredLog.map((log) => (
                  <div key={log.id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-white/[0.02]">
                    <span className="text-xs text-gray-600 font-mono w-20 flex-shrink-0 pt-0.5">{log.time}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${typeColors[log.type]}`}>
                      {typeLabels[log.type] || log.type}
                    </span>
                    <span className="text-xs text-amber-400/70 font-medium w-16 flex-shrink-0">{log.code}</span>
                    <span className="text-xs text-gray-400 flex-1">{log.message}</span>
                    <span className="text-xs text-gray-600 flex-shrink-0">{log.strategy}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
