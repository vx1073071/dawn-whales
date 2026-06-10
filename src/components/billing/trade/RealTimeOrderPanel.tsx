/**
 * RealTimeOrderPanel — ML-60-02 [P0]
 * R60: v1.3.0 GA — Real-time order status from Futu OpenD
 *
 * Features:
 * - Full order state machine: pending→submitted→partial→filled / cancelled / rejected
 * - Order book with live polling (simulated via auto-refresh)
 * - Order detail: fill price, avg fill, commission, P&L
 * - Day orders + historical orders tabs
 * - Search by symbol / order ID
 * - Order type badges (LIMIT/MARKET/STOP/STOP_LIMIT)
 * - Cancel pending orders
 * - Summary stats: total filled, open orders, day P&L
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'submitted' | 'partial' | 'filled' | 'cancelled' | 'rejected';
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_LIMIT';

export interface LiveOrder {
  orderId: string;
  symbol: string;
  market: 'HK' | 'US' | 'CN';
  side: OrderSide;
  type: OrderType;
  quantity: number;
  filledQty: number;
  price: number;
  avgFillPrice?: number;
  commission: number;
  status: OrderStatus;
  pnl?: number;
  pnlPercent?: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  filledAt?: string;
  cancelledAt?: string;
  rejectedReason?: string;
}

export interface OrderStats {
  totalFilled: number;
  openOrders: number;
  dayPnl: number;
  dayTrades: number;
  totalCommission: number;
  winRate: number;
}

export interface RealTimeOrderPanelProps {
  orders?: LiveOrder[];
  stats?: OrderStats;
  onCancelOrder?: (orderId: string) => void;
  onRefresh?: () => void;
  maxDailyTrades?: number;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockOrders: LiveOrder[] = [
  {
    orderId: 'ORD-20260609-001', symbol: '0700.HK', market: 'HK', side: 'BUY', type: 'LIMIT',
    quantity: 200, filledQty: 200, price: 428.00, avgFillPrice: 427.80, commission: 17.12,
    status: 'filled', pnl: 1560, pnlPercent: 1.82, source: 'AI Signal',
    createdAt: '2026-06-09T03:40:00Z', updatedAt: '2026-06-09T03:51:12Z', filledAt: '2026-06-09T03:51:12Z',
  },
  {
    orderId: 'ORD-20260609-002', symbol: 'NVDA', market: 'US', side: 'BUY', type: 'MARKET',
    quantity: 100, filledQty: 100, price: 142.80, avgFillPrice: 142.92, commission: 1.43,
    status: 'filled', pnl: 320, pnlPercent: 2.24, source: 'AI Signal',
    createdAt: '2026-06-09T04:15:00Z', updatedAt: '2026-06-09T04:16:05Z', filledAt: '2026-06-09T04:16:05Z',
  },
  {
    orderId: 'ORD-20260609-003', symbol: 'AAPL', market: 'US', side: 'BUY', type: 'LIMIT',
    quantity: 50, filledQty: 0, price: 195.20, commission: 0,
    status: 'submitted', source: 'AI Signal',
    createdAt: '2026-06-09T04:20:00Z', updatedAt: '2026-06-09T04:20:00Z',
  },
  {
    orderId: 'ORD-20260609-004', symbol: 'BABA', market: 'US', side: 'SELL', type: 'STOP',
    quantity: 80, filledQty: 30, price: 92.50, avgFillPrice: 92.30, commission: 0.55,
    status: 'partial', pnl: -120, pnlPercent: -0.54, source: 'Manual',
    createdAt: '2026-06-09T03:55:00Z', updatedAt: '2026-06-09T04:10:30Z',
  },
  {
    orderId: 'ORD-20260609-005', symbol: '601318.SH', market: 'CN', side: 'BUY', type: 'LIMIT',
    quantity: 1000, filledQty: 0, price: 52.30, commission: 0,
    status: 'cancelled', source: 'AI Signal',
    createdAt: '2026-06-09T03:25:00Z', updatedAt: '2026-06-09T03:35:00Z', cancelledAt: '2026-06-09T03:35:00Z',
  },
  {
    orderId: 'ORD-20260609-006', symbol: 'TSLA', market: 'US', side: 'SELL', type: 'STOP_LIMIT',
    quantity: 30, filledQty: 0, price: 248.50, commission: 0,
    status: 'rejected', rejectedReason: 'Risk: max daily loss exceeded', source: 'AI Signal',
    createdAt: '2026-06-09T03:30:00Z', updatedAt: '2026-06-09T03:30:01Z',
  },
  {
    orderId: 'ORD-20260609-007', symbol: '00700.HK', market: 'HK', side: 'BUY', type: 'MARKET',
    quantity: 100, filledQty: 100, price: 432.50, avgFillPrice: 432.50, commission: 8.65,
    status: 'filled', pnl: 850, pnlPercent: 1.96, source: 'AI Signal',
    createdAt: '2026-06-09T02:50:00Z', updatedAt: '2026-06-09T02:51:30Z', filledAt: '2026-06-09T02:51:30Z',
  },
  {
    orderId: 'ORD-20260609-008', symbol: 'MSTR', market: 'US', side: 'SELL', type: 'LIMIT',
    quantity: 15, filledQty: 15, price: 1850.00, avgFillPrice: 1852.30, commission: 5.56,
    status: 'filled', pnl: -450, pnlPercent: -1.59, source: 'Manual',
    createdAt: '2026-06-09T01:20:00Z', updatedAt: '2026-06-09T01:22:15Z', filledAt: '2026-06-09T01:22:15Z',
  },
];

const mockStats: OrderStats = {
  totalFilled: 12,
  openOrders: 2,
  dayPnl: 2160,
  dayTrades: 8,
  totalCommission: 33.31,
  winRate: 66.7,
};

// ── Helpers ─────────────────────────────────────────────────────────────

const fmtUSD = (v: number): string => {
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? '-' : ''}$${s}`;
};

const fmtPercent = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const statusBadge: Record<OrderStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-600', icon: '⏳' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: '📤' },
  partial: { label: 'Partial', color: 'bg-purple-100 text-purple-700', icon: '🔄' },
  filled: { label: 'Filled', color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: '✕' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: '🚫' },
};

const typeBadge: Record<OrderType, string> = {
  LIMIT: 'bg-cyan-100 text-cyan-700', MARKET: 'bg-orange-100 text-orange-700',
  STOP: 'bg-rose-100 text-rose-700', STOP_LIMIT: 'bg-pink-100 text-pink-700',
};

const statusFlow: OrderStatus[] = ['pending', 'submitted', 'partial', 'filled'];
const statusIdx = (s: OrderStatus): number => {
  if (s === 'cancelled') return -1;
  if (s === 'rejected') return -2;
  return statusFlow.indexOf(s);
};

// ── RealTimeOrderPanel ──────────────────────────────────────────────────

const RealTimeOrderPanel: React.FC<RealTimeOrderPanelProps> = ({
  orders: inputOrders,
  stats: inputStats,
  onCancelOrder,
  onRefresh,
  maxDailyTrades = 20,
  className = '',
}) => {
  const [orders] = useState<LiveOrder[]>(inputOrders ?? mockOrders);
  const [stats] = useState<OrderStats>(inputStats ?? mockStats);
  const [tab, setTab] = useState<'active' | 'history' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleTimeString());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        setLastRefresh(new Date().toLocaleTimeString());
        onRefresh?.();
      }, 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, onRefresh]);

  const handleRefresh = useCallback(() => {
    setLastRefresh(new Date().toLocaleTimeString());
    onRefresh?.();
  }, [onRefresh]);

  const handleCancel = useCallback((orderId: string) => {
    onCancelOrder?.(orderId);
  }, [onCancelOrder]);

  const toggleExpand = useCallback((orderId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  }, []);

  // Filter
  let filtered = orders;
  if (tab === 'active') {
    filtered = orders.filter(o => o.status === 'submitted' || o.status === 'partial' || o.status === 'pending');
  } else if (tab === 'history') {
    filtered = orders.filter(o => o.status === 'filled' || o.status === 'cancelled' || o.status === 'rejected');
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(o => o.symbol.toLowerCase().includes(q) || o.orderId.toLowerCase().includes(q));
  }

  const activeCount = orders.filter(o => o.status === 'submitted' || o.status === 'partial').length;
  const historyCount = orders.filter(o => o.status === 'filled' || o.status === 'cancelled' || o.status === 'rejected').length;

  return (
    <div className={`real-time-order-panel ${className}`}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-800">📋 Real-Time Orders</h2>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-[10px] text-slate-400">{autoRefresh ? 'Live' : 'Paused'} · {lastRefresh}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
              autoRefresh ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {autoRefresh ? '⏸ Pause' : '▶ Resume'}
          </button>
          <button onClick={handleRefresh} className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        {([
          ['📊 Filled', String(stats.totalFilled)],
          ['📤 Open', String(stats.openOrders)],
          ['💰 Day P&L', fmtUSD(stats.dayPnl), stats.dayPnl >= 0 ? 'text-emerald-600' : 'text-red-500'],
          ['📈 Win Rate', `${stats.winRate}%`, stats.winRate >= 50 ? 'text-emerald-600' : 'text-red-500'],
          ['🔢 Trades', `${stats.dayTrades}/${maxDailyTrades}`, stats.dayTrades >= maxDailyTrades * 0.8 ? 'text-amber-600' : 'text-slate-700'],
          ['💸 Fees', fmtUSD(stats.totalCommission)],
        ] as [string, string, string?][]).map(([label, value, color]) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</div>
            <div className={`text-sm font-bold ${color ?? 'text-slate-800'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Search + Tabs ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text" placeholder="Search symbol or order ID..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-blue-300 outline-none"
          />
          <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {[
            ['active', `Active (${activeCount})`],
            ['history', `History (${historyCount})`],
            ['all', `All (${orders.length})`],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Order Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="pb-2 font-semibold text-slate-500 px-2">Order ID</th>
              <th className="pb-2 font-semibold text-slate-500 px-2">Symbol</th>
              <th className="pb-2 font-semibold text-slate-500 px-2">Side/Type</th>
              <th className="pb-2 font-semibold text-slate-500 px-2">Qty/Filled</th>
              <th className="pb-2 font-semibold text-slate-500 px-2">Price</th>
              <th className="pb-2 font-semibold text-slate-500 px-2">Status</th>
              <th className="pb-2 font-semibold text-slate-500 px-2">P&L</th>
              <th className="pb-2 font-semibold text-slate-500 px-2">Time</th>
              <th className="pb-2 font-semibold text-slate-500 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => {
              const isExpanded = expanded.has(order.orderId);
              const canCancel = order.status === 'submitted' || order.status === 'pending';
              const flowPos = statusIdx(order.status);

              return (
                <React.Fragment key={order.orderId}>
                  <tr
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(order.orderId)}
                  >
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-600">{order.orderId.replace('ORD-', '')}</td>
                    <td className="py-2.5 px-2 font-bold text-slate-800">{order.symbol}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${order.side === 'BUY' ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                          {order.side}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeBadge[order.type]}`}>
                          {order.type}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="font-mono text-slate-700">{order.filledQty}</span>
                      <span className="text-slate-400">/{order.quantity}</span>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-slate-700">
                      {order.status === 'filled' ? fmtUSD(order.avgFillPrice!) : fmtUSD(order.price)}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBadge[order.status].color}`}>
                        {statusBadge[order.status].icon} {statusBadge[order.status].label}
                      </span>
                    </td>
                    <td className={`py-2.5 px-2 font-mono font-bold ${(order.pnl ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {order.pnl !== undefined ? `${fmtUSD(order.pnl)} (${fmtPercent(order.pnlPercent!)})` : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-[10px] text-slate-400">
                      {new Date(order.updatedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-2">
                      {canCancel && (
                        <button
                          onClick={e => { e.stopPropagation(); handleCancel(order.orderId); }}
                          className="text-[10px] font-semibold text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <tr key={`${order.orderId}-detail`}>
                      <td colSpan={9} className="bg-slate-50 px-4 py-3 border-b border-slate-100">
                        {/* Status flow bar */}
                        <div className="mb-3">
                          <div className="flex items-center gap-1">
                            {['Created', 'Submitted', 'Partial', 'Filled'].map((step, i) => {
                              const passed = flowPos >= i;
                              const isCancelled = order.status === 'cancelled';
                              const isRejected = order.status === 'rejected';
                              return (
                                <React.Fragment key={step}>
                                  <div className={`flex items-center justify-center w-20 h-7 rounded-lg text-[10px] font-semibold ${
                                    isRejected && i === 0 ? 'bg-red-100 text-red-600' :
                                    isCancelled && passed ? 'bg-gray-100 text-gray-400 line-through' :
                                    passed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    {step}
                                  </div>
                                  {i < 3 && (
                                    <div className={`w-4 h-0.5 ${passed && !isCancelled && i < flowPos ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400">Source</span>
                            <div className="font-semibold text-slate-700 mt-0.5">{order.source}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">Commission</span>
                            <div className="font-semibold text-slate-700 mt-0.5">{fmtUSD(order.commission)}</div>
                          </div>
                          {order.filledAt && (
                            <div>
                              <span className="text-slate-400">Filled At</span>
                              <div className="font-semibold text-slate-700 mt-0.5">{new Date(order.filledAt).toLocaleString()}</div>
                            </div>
                          )}
                          {order.cancelledAt && (
                            <div>
                              <span className="text-slate-400">Cancelled At</span>
                              <div className="font-semibold text-slate-700 mt-0.5">{new Date(order.cancelledAt).toLocaleString()}</div>
                            </div>
                          )}
                          {order.rejectedReason && (
                            <div className="col-span-2">
                              <span className="text-slate-400">Rejection Reason</span>
                              <div className="font-semibold text-red-600 mt-0.5">{order.rejectedReason}</div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm">{tab === 'active' ? 'No active orders' : tab === 'history' ? 'No order history' : 'No orders found'}</p>
          {search && <p className="text-xs mt-1">Try a different search term</p>}
        </div>
      )}
    </div>
  );
};

export default RealTimeOrderPanel;
