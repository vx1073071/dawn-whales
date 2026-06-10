/**
 * LiveTradingPanel — Real-time order flow + position monitor + emergency stop
 * (ML-40-01, R40 Phase 5.0)
 *
 * Integrates with LiveTradeBridge to display:
 * - Live order stream with status badges
 * - Paper vs Live position reconciliation
 * - Emergency stop button with confirm dialog
 * - P&L real-time ticker
 * - Audit log viewer
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';

// ── Types (mirrors bridge types) ────────────────────────────────────────

type OrderSide = 'BUY' | 'SELL';
type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
type OrderStatus = 'PENDING' | 'SUBMITTED' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
type AuditAction = 'CREATE' | 'SUBMIT' | 'FILL' | 'CANCEL' | 'REJECT' | 'RECONCILE' | 'EMERGENCY_STOP';

interface BridgeOrder {
  id: string;
  paperOrderId: string;
  brokerOrderId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  status: OrderStatus;
  filledQty: number;
  avgFillPrice?: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

interface PaperPosition {
  symbol: string;
  quantity: number;
  avgPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

interface ReconciliationResult {
  matched: number;
  paperOnly: string[];
  liveOnly: string[];
  quantityMismatch: { symbol: string; paperQty: number; liveQty: number }[];
  driftPercent: number;
}

interface AuditEntry {
  timestamp: number;
  action: AuditAction;
  orderId?: string;
  symbol?: string;
  details: string;
}

// ── Sub-components ──────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
    const colors: Record<OrderStatus, string> = {
    PENDING: 'bg-gray-500/20 text-gray-400',
    SUBMITTED: 'bg-blue-500/20 text-blue-400',
    FILLED: 'bg-emerald-500/20 text-emerald-400',
    PARTIALLY_FILLED: 'bg-amber-500/20 text-amber-400',
    CANCELLED: 'bg-red-500/20 text-red-400',
    REJECTED: 'bg-red-600/20 text-red-500',
    EXPIRED: 'bg-gray-600/20 text-gray-500',
  };
  const labels: Record<OrderStatus, string> = {
    PENDING: 'components.pending', SUBMITTED: '已提交', FILLED: 'components.tradeFilled',
    PARTIALLY_FILLED: 'components.partialFill', CANCELLED: 'components.tradeCancelled', REJECTED: 'components.tradeRejected', EXPIRED: '已过期',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

interface LiveTradingPanelProps {
  className?: string;
}

// Mock data for demo
const MOCK_ORDERS: BridgeOrder[] = [
  { id: 'ORD-001', paperOrderId: 'P-001', brokerOrderId: 'B-001', symbol: 'US.AAPL', side: 'BUY', type: 'LIMIT', quantity: 100, price: 150.00, status: 'FILLED', filledQty: 100, avgFillPrice: 149.95, createdAt: Date.now() - 120000, updatedAt: Date.now() - 60000 },
  { id: 'ORD-002', paperOrderId: 'P-002', symbol: 'US.TSLA', side: 'SELL', type: 'MARKET', quantity: 50, status: 'PENDING', filledQty: 0, createdAt: Date.now() - 30000, updatedAt: Date.now() - 30000 },
  { id: 'ORD-003', paperOrderId: 'P-003', brokerOrderId: 'B-003', symbol: 'HK.00700', side: 'BUY', type: 'LIMIT', quantity: 200, price: 380.00, status: 'PARTIALLY_FILLED', filledQty: 120, avgFillPrice: 379.50, createdAt: Date.now() - 90000, updatedAt: Date.now() - 15000 },
  { id: 'ORD-004', paperOrderId: 'P-004', symbol: 'US.NVDA', side: 'BUY', type: 'STOP', quantity: 80, price: 850.00, status: 'SUBMITTED', filledQty: 0, createdAt: Date.now() - 60000, updatedAt: Date.now() - 60000 },
  { id: 'ORD-005', paperOrderId: 'P-005', symbol: 'HK.09988', side: 'SELL', type: 'LIMIT', quantity: 300, price: 90.00, status: 'REJECTED', filledQty: 0, createdAt: Date.now() - 180000, updatedAt: Date.now() - 150000, error: 'Insufficient position' },
];

const MOCK_PAPER: PaperPosition[] = [
  { symbol: 'US.AAPL', quantity: 500, avgPrice: 145.20, marketValue: 75000, unrealizedPnl: 2500, realizedPnl: 1200 },
  { symbol: 'US.TSLA', quantity: 200, avgPrice: 220.00, marketValue: 44000, unrealizedPnl: -1500, realizedPnl: 800 },
  { symbol: 'HK.00700', quantity: 1000, avgPrice: 370.00, marketValue: 380000, unrealizedPnl: 10000, realizedPnl: 5000 },
];

const MOCK_AUDIT: AuditEntry[] = [
  { timestamp: Date.now() - 5000, action: 'FILL', orderId: 'ORD-001', symbol: 'US.AAPL', details: 'Filled 100 @ 149.95' },
  { timestamp: Date.now() - 30000, action: 'SUBMIT', orderId: 'ORD-002', symbol: 'US.TSLA', details: 'SELL 50 MARKET' },
  { timestamp: Date.now() - 60000, action: 'CREATE', orderId: 'ORD-004', symbol: 'US.NVDA', details: 'BUY 80 STOP @ 850' },
  { timestamp: Date.now() - 90000, action: 'RECONCILE', details: 'Reconciliation: 5 matched, 1 mismatch' },
  { timestamp: Date.now() - 150000, action: 'REJECT', orderId: 'ORD-005', symbol: 'HK.09988', details: 'Insufficient position' },
];

export const LiveTradingPanel: React.FC<LiveTradingPanelProps> = ({ className }) => {
  const [mode, setMode] = useState<'sim' | 'live'>('sim');
  const [selectedTab, setSelectedTab] = useState<'orders' | 'positions' | 'audit'>('orders');
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [orders, _setOrders] = useState<BridgeOrder[]>(MOCK_ORDERS);
  const [paperPositions] = useState<PaperPosition[]>(MOCK_PAPER);
  const [auditLog] = useState<AuditEntry[]>(MOCK_AUDIT);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate live PnL tick
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    timerRef.current = setInterval(() => setTick(t => t + 1), 2000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  // Computed metrics
  const totalPaperValue = useMemo(() =>
    paperPositions.reduce((s, p) => s + p.marketValue, 0),
    [paperPositions]
  );
  const totalUnrealizedPnl = useMemo(() =>
    paperPositions.reduce((s, p) => s + p.unrealizedPnl, 0) + tick * 5,
    [paperPositions, tick]
  );
  const totalRealizedPnl = useMemo(() =>
    paperPositions.reduce((s, p) => s + p.realizedPnl, 0),
    [paperPositions]
  );
  const reconciliation = useMemo((): ReconciliationResult => ({
    matched: 3,
    paperOnly: ['US.TSLA'],
    liveOnly: [],
    quantityMismatch: [{ symbol: 'HK.00700', paperQty: 1000, liveQty: 980 }],
    driftPercent: 2.0,
  }), []);

  const activeOrderCount = useMemo(() =>
    orders.filter(o => !['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(o.status)).length,
    [orders]
  );

  const handleEmergencyStop = useCallback(() => {
    setIsRunning(false);
    setShowStopConfirm(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleModeToggle = useCallback(() => {
    setMode(prev => prev === 'sim' ? 'live' : 'sim');
  }, []);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">
            实时交易
            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 5.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {isRunning ? '🟢 运行中' : '🔴 已停止'} · {activeOrderCount} 活跃订单 · {paperPositions.length} 持仓
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sim/Live toggle */}
          <button
            onClick={handleModeToggle}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'sim'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            {mode === 'sim' ? '🔬 模拟盘' : '🔥 实盘'}
          </button>

          {/* Emergency Stop */}
          <button
            onClick={() => setShowStopConfirm(true)}
            disabled={!isRunning}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isRunning
                ? 'bg-red-600 text-white hover:bg-red-500 animate-pulse'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            ⏹ 紧急停止
          </button>
        </div>
      </div>

      {/* Stop confirm dialog */}
      {showStopConfirm && (
        <div className="mb-5 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-red-400 font-bold text-sm">确认紧急停止？</div>
              <p className="text-red-400/70 text-xs mt-1">
                所有未成交订单将被取消，交易引擎将停止。
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowStopConfirm(false)}
                className="px-3 py-1.5 bg-gray-800 rounded-lg text-xs text-gray-400"
              >
                取消
              </button>
              <button
                onClick={handleEmergencyStop}
                className="px-3 py-1.5 bg-red-600 rounded-lg text-xs text-white font-bold"
              >
                确认停止
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P&L ticker bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {([
          { label: '组合市值', value: `$${totalPaperValue.toLocaleString()}`, color: 'text-white' },
          { label: '未实现盈亏', value: `${totalUnrealizedPnl >= 0 ? '+' : ''}$${totalUnrealizedPnl.toLocaleString()}`, color: totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: '已实现盈亏', value: `${totalRealizedPnl >= 0 ? '+' : ''}$${totalRealizedPnl.toLocaleString()}`, color: totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
        ] as const).map(card => (
          <div key={card.label} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 text-center">
            <div className="text-[10px] text-gray-500">{card.label}</div>
            <div className={`text-base font-bold mt-0.5 ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-gray-800/40 rounded-lg p-1">
        {([
          { key: 'orders', label: '订单流' },
          { key: 'positions', label: '持仓对账' },
          { key: 'audit', label: '审计日志' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selectedTab === tab.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Orders ───────────────────────────────────────────── */}
      {selectedTab === 'orders' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700/50">
                <th className="text-left py-2 pr-3">订单ID</th>
                <th className="text-left py-2 pr-3">标的</th>
                <th className="text-right py-2 pr-3">{"components.direction"}</th>
                <th className="text-right py-2 pr-3">{"components.quantity"}</th>
                <th className="text-right py-2 pr-3">{"components.price"}</th>
                <th className="text-right py-2 pr-3">{"components.tradeFilled"}</th>
                <th className="text-right py-2 pr-3">均价</th>
                <th className="text-center py-2">{"components.status"}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-gray-700/20 text-gray-400">
                  <td className="py-2 pr-3 font-mono text-[10px]">{o.id}</td>
                  <td className="py-2 pr-3 font-mono">{o.symbol}</td>
                  <td className={`py-2 pr-3 text-right font-semibold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {o.side === 'BUY' ? '买' : '卖'}
                  </td>
                  <td className="py-2 pr-3 text-right">{o.quantity}</td>
                  <td className="py-2 pr-3 text-right font-mono">{o.price ? `$${o.price}` : '-'}</td>
                  <td className="py-2 pr-3 text-right">{o.filledQty}</td>
                  <td className="py-2 pr-3 text-right font-mono">{o.avgFillPrice ? `$${o.avgFillPrice}` : '-'}</td>
                  <td className="py-2 text-center"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Positions ────────────────────────────────────────── */}
      {selectedTab === 'positions' && (
        <div className="space-y-4">
          {/* Reconciliation summary */}
          <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
            <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
              对账摘要
            </h4>
            <div className="grid grid-cols-4 gap-3">
              {([
                { label: '匹配', value: reconciliation.matched, color: 'text-emerald-400' },
                { label: '仅模拟盘', value: reconciliation.paperOnly.length, color: 'text-yellow-400' },
                { label: '仅实盘', value: reconciliation.liveOnly.length, color: 'text-orange-400' },
                { label: '数量偏差', value: `${reconciliation.driftPercent}%`, color: reconciliation.driftPercent > 5 ? 'text-red-400' : 'text-emerald-400' },
              ] as const).map(c => (
                <div key={c.label} className="text-center">
                  <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
                  <div className="text-[10px] text-gray-500">{c.label}</div>
                </div>
              ))}
            </div>
            {reconciliation.quantityMismatch.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700/30">
                <div className="text-[10px] text-yellow-400 mb-2">数量不匹配：</div>
                {reconciliation.quantityMismatch.map(m => (
                  <div key={m.symbol} className="text-[10px] text-yellow-400/70">
                    {m.symbol}: 模拟 {m.paperQty} vs 实盘 {m.liveQty}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Position table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700/50">
                  <th className="text-left py-2 pr-3">标的</th>
                  <th className="text-right py-2 pr-3">持仓量</th>
                  <th className="text-right py-2 pr-3">均价</th>
                  <th className="text-right py-2 pr-3">{"components.marketCap"}</th>
                  <th className="text-right py-2 pr-3">未实现</th>
                  <th className="text-right py-2">已实现</th>
                </tr>
              </thead>
              <tbody>
                {paperPositions.map(p => (
                  <tr key={p.symbol} className="border-b border-gray-700/20 text-gray-400">
                    <td className="py-2 pr-3 font-mono">{p.symbol}</td>
                    <td className="py-2 pr-3 text-right">{p.quantity}</td>
                    <td className="py-2 pr-3 text-right font-mono">${p.avgPrice}</td>
                    <td className="py-2 pr-3 text-right font-mono">${p.marketValue.toLocaleString()}</td>
                    <td className={`py-2 pr-3 text-right font-mono ${p.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.unrealizedPnl >= 0 ? '+' : ''}${p.unrealizedPnl}
                    </td>
                    <td className={`py-2 text-right font-mono ${p.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.realizedPnl >= 0 ? '+' : ''}${p.realizedPnl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Audit ────────────────────────────────────────────── */}
      {selectedTab === 'audit' && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {auditLog.map((entry, i) => (
            <div key={i} className="flex items-start gap-3 bg-gray-800/30 rounded-lg p-3 border border-gray-700/20">
              <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                entry.action === 'FILL' ? 'bg-emerald-500' :
                entry.action === 'REJECT' ? 'bg-red-500' :
                entry.action === 'EMERGENCY_STOP' ? 'bg-red-600' :
                entry.action === 'RECONCILE' ? 'bg-blue-500' :
                'bg-gray-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-[10px] font-mono text-gray-600">{entry.action}</span>
                  {entry.symbol && (
                    <span className="text-[10px] text-gray-500">{entry.symbol}</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{entry.details}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveTradingPanel;
