// PaperTraderPanel — 模拟实盘交易面板
// 显示账户状态、持仓、P&L统计、信号执行记录，支持启动/停止/重置

import { useState, useEffect, useCallback } from 'react';

interface PaperPosition {
  code: string;
  name: string;
  qty: number;
  avgCost: number;
  lastPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
}

interface PaperOrder {
  id: string;
  time: number;
  code: string;
  name: string;
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  status: 'FILLED' | 'PARTIAL' | 'CANCELLED' | 'REJECTED';
}

interface PaperReport {
  totalReturn: number;
  totalReturnPct: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winTrades: number;
  loseTrades: number;
  avgWin: number;
  avgLoss: number;
}

interface PaperStatus {
  running: boolean;
  cash: number;
  marketValue: number;
  totalValue: number;
  todayPnl: number;
  todayPnlPct: number;
  unrealizedPnl: number;
  initialized: boolean;
}

export default function PaperTraderPanel() {
  const [status, setStatus] = useState<PaperStatus | null>(null);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [report, setReport] = useState<PaperReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'report'>('positions');
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await (window as any).api.getPaperStatus();
      if (r) {
        setStatus(r);
        setPositions(r.positions ?? []);
        setRefreshing(false);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 10_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  async function start() {
    setLoading(true);
    try {
      await (window as any).api.startPaperTrader();
      await fetchStatus();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function stop() {
    setLoading(true);
    try {
      await (window as any).api.stopPaperTrader();
      await fetchStatus();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function reset() {
    if (!confirm('确定重置模拟账户？所有持仓和资金将清零。')) return;
    setLoading(true);
    try {
      await (window as any).api.resetPaperTrader();
      setPositions([]);
      setOrders([]);
      setReport(null);
      await fetchStatus();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadOrders() {
    try {
      const r = await (window as any).api.getPaperOrders?.();
      if (r) setOrders(r);
      else setOrders([]);
    } catch { setOrders([]); }
  }

  async function loadReport() {
    try {
      const r = await (window as any).api.getPaperReport?.();
      if (r) setReport(r);
      else setReport(null);
    } catch { setReport(null); }
  }

  function switchTab(tab: 'positions' | 'orders' | 'report') {
    setActiveTab(tab);
    if (tab === 'orders') loadOrders();
    if (tab === 'report') loadReport();
  }

  const fmt = (n: number, pct = false) =>
    pct ? `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%` : `${n >= 0 ? '+' : ''}HKD ${n.toFixed(2)}`;

  const fmtTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">模拟实盘</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            {status?.running ? '🟢 运行中' : status?.initialized ? '⏸ 已暂停' : '⏹ 未初始化'}
          </p>
        </div>
        <div className="flex gap-2">
          {status?.running
            ? <button onClick={stop} disabled={loading} className="text-xs bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-3 py-1.5 rounded font-medium transition-colors">暂停</button>
            : <button onClick={start} disabled={loading} className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded font-medium transition-colors">启动</button>
          }
          <button onClick={reset} disabled={loading} className="text-xs bg-red-900/60 hover:bg-red-900/80 disabled:opacity-50 text-red-300 px-3 py-1.5 rounded font-medium transition-colors border border-red-500/30">重置</button>
          <button onClick={fetchStatus} className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded transition-colors">刷新</button>
        </div>
      </div>

      {error && <div className="text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded px-3 py-2">{error}</div>}

      {/* Account summary */}
      {status && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-white/10 rounded-lg p-3">
            <div className="text-gray-500 text-[10px] mb-1">总价值</div>
            <div className="text-white font-semibold text-sm">HKD {status.totalValue.toFixed(0)}</div>
          </div>
          <div className="bg-card border border-white/10 rounded-lg p-3">
            <div className="text-gray-500 text-[10px] mb-1">可用现金</div>
            <div className="text-white font-semibold text-sm">HKD {status.cash.toFixed(0)}</div>
          </div>
          <div className="bg-card border border-white/10 rounded-lg p-3">
            <div className="text-gray-500 text-[10px] mb-1">持仓市值</div>
            <div className="text-white font-semibold text-sm">HKD {status.marketValue.toFixed(0)}</div>
          </div>
          <div className={`bg-card border border-white/10 rounded-lg p-3 ${status.todayPnl >= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
            <div className="text-gray-500 text-[10px] mb-1">今日盈亏</div>
            <div className={`font-semibold text-sm ${status.todayPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(status.todayPnl)}
            </div>
          </div>
          <div className={`bg-card border border-white/10 rounded-lg p-3 ${status.unrealizedPnl >= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
            <div className="text-gray-500 text-[10px] mb-1">持仓盈亏</div>
            <div className={`font-semibold text-sm ${status.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(status.unrealizedPnl)}
            </div>
          </div>
          <div className="bg-card border border-white/10 rounded-lg p-3">
            <div className="text-gray-500 text-[10px] mb-1">持仓数量</div>
            <div className="text-white font-semibold text-sm">{positions.length} 只</div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        {(['positions', 'orders', 'report'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab ? 'text-[#C9A046] border-b-2 border-[#C9A046]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === 'positions' ? '📊 持仓' : tab === 'orders' ? '📋 订单' : '📈 报告'}
          </button>
        ))}
      </div>

      {/* Positions tab */}
      {activeTab === 'positions' && (
        <div>
          {positions.length === 0 ? (
            <div className="text-center text-gray-500 text-xs py-8">暂无持仓</div>
          ) : (
            <div className="space-y-2">
              {positions.map((p) => (
                <div key={p.code} className="bg-card border border-white/10 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs font-medium">{p.name}</span>
                      <span className="text-gray-500 text-[10px]">{p.code}</span>
                    </div>
                    <div className={`text-xs font-semibold ${p.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(p.pnl)} ({fmt(p.pnlPct, true)})
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-gray-500">
                    <span>数量: {p.qty}</span>
                    <span>均价: HKD {p.avgCost.toFixed(2)}</span>
                    <span>现价: HKD {p.lastPrice.toFixed(2)}</span>
                    <span>市值: HKD {p.marketValue.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orders tab */}
      {activeTab === 'orders' && (
        <div>
          {orders.length === 0 ? (
            <div className="text-center text-gray-500 text-xs py-8">暂无订单记录</div>
          ) : (
            <div className="space-y-1">
              {orders.slice(0, 50).map((o) => (
                <div key={o.id} className="flex items-center justify-between bg-card border border-white/5 rounded px-3 py-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${o.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{o.side}</span>
                    <span className="text-white">{o.name || o.code}</span>
                    <span className="text-gray-500">{o.code}</span>
                  </div>
                  <div className="text-gray-400">@ HKD {o.price.toFixed(2)} × {o.qty}</div>
                  <div className="flex items-center gap-2">
                    <span className={`${o.status === 'FILLED' ? 'text-green-400' : o.status === 'CANCELLED' ? 'text-gray-500' : 'text-yellow-400'}`}>{o.status}</span>
                    <span className="text-gray-600">{fmtTime(o.time)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Report tab */}
      {activeTab === 'report' && (
        <div>
          {report ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['总收益率', fmt(report.totalReturnPct, true), report.totalReturnPct >= 0 ? 'text-green-400' : 'text-red-400'],
                  ['Sharpe 比率', report.sharpeRatio.toFixed(2), report.sharpeRatio >= 1 ? 'text-green-400' : report.sharpeRatio >= 0 ? 'text-yellow-400' : 'text-red-400'],
                  ['最大回撤', fmt(report.maxDrawdownPct, true), 'text-red-400'],
                  ['胜率', fmt(report.winRate, true), report.winRate >= 0.5 ? 'text-green-400' : 'text-red-400'],
                  ['盈亏比', report.profitFactor.toFixed(2), report.profitFactor >= 1.5 ? 'text-green-400' : report.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'],
                  ['交易次数', String(report.totalTrades), 'text-white'],
                ].map(([label, value, color]) => (
                  <div key={label as string} className="bg-card border border-white/10 rounded-lg px-3 py-2.5">
                    <div className="text-gray-500 text-[10px] mb-0.5">{label}</div>
                    <div className={`font-semibold text-sm ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-500">
                <span>盈利交易: <b className="text-green-400">{report.winTrades}</b></span>
                <span>亏损交易: <b className="text-red-400">{report.loseTrades}</b></span>
                <span>平均盈利: <b className="text-green-400">HKD {report.avgWin.toFixed(0)}</b></span>
                <span>平均亏损: <b className="text-red-400">HKD {report.avgLoss.toFixed(0)}</b></span>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-xs py-8">运行一段时间后查看绩效报告</div>
          )}
        </div>
      )}
    </div>
  );
}
