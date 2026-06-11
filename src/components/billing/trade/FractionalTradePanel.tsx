/**
 * FractionalTradePanel — ML-68-02 [P0]
 * R68: v1.7.0-alpha — Enhanced fractional share trading with partial fill support
 *
 * Features:
 * - Fractional share input (美股 0.01-1.00)
 * - Partial fill status tracking: ordered→partial→filled→remaining
 * - Real-time fee calculator per fractional lot
 * - Market-specific rules (美股任意小数)
 * - Fill progress bar with ordered/filled/remaining breakdown
 * - Partial fill history log
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import i18n from '../../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

export interface FractionalOrder {
  symbol: string;
  market: 'HK' | 'US' | 'CN';
  direction: 'BUY' | 'SELL';
  totalQty: number;        // includes fractional part
  wholeLots: number;       // integer lots
  fractionalQty: number;   // fractional remainder
  price: number;
  filledQty: number;
  remainingQty: number;
  status: 'pending' | 'partial' | 'filled' | 'cancelled';
  avgFillPrice: number;
  commission: number;
  partialFills: PartialFillRecord[];
}

export interface PartialFillRecord {
  time: string;
  qty: number;
  price: number;
  fee: number;
}

export interface MarketRule {
  market: string;
  flag: string;
  currency: string;
  lotSize: number;
  minFractional: number;
  fractionalStep: number;
  fractionalLabel: string;
  commissionPct: number;
  minCommission: number;
  stampPct: number;
}

export interface FractionalTradePanelProps {
  symbol?: string;
  market?: 'HK' | 'US' | 'CN';
  price?: number;
  onOrder?: (order: FractionalOrder) => void;
  onCancel?: () => void;
  activeOrder?: FractionalOrder;
  className?: string;
}

// ── Market Rules ────────────────────────────────────────────────────────

const MARKET_RULES: MarketRule[] = [
  { market: 'US', flag: '🇺🇸', currency: 'USD', lotSize: 1, minFractional: 0.01, fractionalStep: 0.01, fractionalLabel: i18n.t('FractionalTradePanel.k1'), commissionPct: 0.0049, minCommission: 0.99, stampPct: 0.0008 },
  { market: 'HK', flag: '🇭🇰', currency: 'HKD', lotSize: 100, minFractional: 1, fractionalStep: 1, fractionalLabel: i18n.t('FractionalTradePanel.k2'), commissionPct: 0.03, minCommission: 3, stampPct: 0.13 },

];

// ── Mock Order ──────────────────────────────────────────────────────────

const mockPartialFills: PartialFillRecord[] = [
  { time: '09:32:15', qty: 100, price: 195.20, fee: 0.49 },
  { time: '09:32:48', qty: 100, price: 195.15, fee: 0.49 },
  { time: '09:33:21', qty: 63, price: 195.30, fee: 0.32 },
];

const mockActiveOrder: FractionalOrder = {
  symbol: 'AAPL', market: 'US', direction: 'BUY',
  totalQty: 263.5, wholeLots: 263, fractionalQty: 0.50,
  price: 195.25, filledQty: 263, remainingQty: 0.5,
  status: 'partial', avgFillPrice: 195.22, commission: 1.30,
  partialFills: mockPartialFills,
};

// ── Sub-components ──────────────────────────────────────────────────────

function FillProgressBar({ filled, total, status }: { filled: number; total: number; status: string }) {
  const { t: _t } = useTranslation();

  const pct = Math.min(100, (filled / total) * 100);
  const color = status === 'filled' ? '#4ade80' : status === 'partial' ? '#fbbf24' : status === 'cancelled' ? '#ef4444' : '#475569';
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
        <span>成交 {filled.toLocaleString()}</span>
        <span style={{ color }}>{pct.toFixed(1)}%</span>
        <span>总量 {total.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function FractionalTradePanel({
  symbol: propSymbol,
  market: propMarket,
  price: propPrice,
  onOrder,
  onCancel,
  activeOrder: propOrder,
  className = '',
}: FractionalTradePanelProps) {
  const [symbol, setSymbol] = useState(propSymbol ?? 'AAPL');
  const [market, setMarket] = useState<'HK' | 'US' | 'CN'>(propMarket ?? 'US');
  const [price, setPrice] = useState(propPrice ?? 195.25);
  const [wholeLots, setWholeLots] = useState(263);
  const [fractionalQty, setFractionalQty] = useState(0.5);
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [activeOrder, setActiveOrder] = useState<FractionalOrder | null>(propOrder ?? mockActiveOrder);
  const [hasActiveOrder, setHasActiveOrder] = useState(!!(propOrder ?? true));

  const rule = useMemo(() => MARKET_RULES.find(r => r.market === market)!, [market]);

  const totalQty = wholeLots + fractionalQty;
  const notional = totalQty * price;
  const commission = Math.max(rule.minCommission, notional * (rule.commissionPct / 100));
  const stamp = notional * (rule.stampPct / 100);
  const totalFees = commission + stamp;

  const handleSubmit = useCallback(() => {
    const order: FractionalOrder = {
      symbol, market, direction,
      totalQty, wholeLots, fractionalQty, price,
      filledQty: 0, remainingQty: totalQty,
      status: 'pending', avgFillPrice: 0, commission: 0, partialFills: [],
    };
    setActiveOrder(order);
    setHasActiveOrder(true);
    onOrder?.(order);
  }, [symbol, market, direction, totalQty, wholeLots, fractionalQty, price, onOrder]);

  const handleCancel = useCallback(() => {
    setActiveOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
    onCancel?.();
  }, [onCancel]);

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <h2 className="text-xl font-bold">碎股交易</h2>
        <p className="text-gray-500 text-xs mt-0.5">美股碎股(0.01-1.00) · 部分成交跟踪</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* ── Market Selector ──────────────────────────────────────────── */}
        <div className="flex gap-2">
          {MARKET_RULES.map(r => (
            <button key={r.market} onClick={() => setMarket(r.market as 'HK' | 'US' | 'CN')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${market === r.market ? 'bg-[#C9A046]/10 text-[#D4A853] border border-[#C9A046]/30' : 'text-gray-600 border border-white/5 hover:text-gray-400'}`}>
              {r.flag} {r.market}
            </button>
          ))}
        </div>

        {/* ── Order Input ───────────────────────────────────────────────── */}
        <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
          <h3 className="text-gray-300 font-semibold text-sm mb-4">📝 下单参数</h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">代码 Symbol</label>
              <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)}
                     className="w-full mt-1 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#C9A046]/50" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">价格 Price</label>
              <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} step={0.01}
                     className="w-full mt-1 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#C9A046]/50" />
            </div>
          </div>

          {/* Direction */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => setDirection('BUY')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${direction === 'BUY' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-gray-600 border border-white/5'}`}>
              🟢 买入 BUY
            </button>
            <button onClick={() => setDirection('SELL')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${direction === 'SELL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-gray-600 border border-white/5'}`}>
              🔴 卖出 SELL
            </button>
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">
                整手 Whole Lots
                {rule.market !== 'US' && <span className="text-gray-500 ml-1">({rule.lotSize}股/lot)</span>}
              </label>
              <input type="number" value={wholeLots} onChange={e => setWholeLots(Number(e.target.value))} min={0} step={1}
                     className="w-full mt-1 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#C9A046]/50" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">
                碎股 Fractional
                <span className="text-gray-500 ml-1">(最小{rule.minFractional})</span>
              </label>
              <input type="number" value={fractionalQty} onChange={e => setFractionalQty(Number(e.target.value))}
                     min={rule.minFractional} max={rule.market === 'US' ? 1 : rule.lotSize - 1} step={rule.fractionalStep}
                     className="w-full mt-1 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-[#D4A853] focus:outline-none focus:border-[#C9A046]/50" />
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg mb-4">
            <div>
              <span className="text-xs text-gray-500">总股数 Total: </span>
              <span className="text-sm text-white font-semibold">{totalQty.toLocaleString()}</span>
              <span className="text-[10px] text-gray-600 ml-2">
                ({wholeLots} 整手 + {fractionalQty} 碎股)
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500">预估金额: </span>
              <span className="text-sm text-[#D4A853] font-semibold">{rule.currency} {notional.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className="space-y-1.5 text-xs text-gray-500 mb-4">
            <div className="flex justify-between"><span>佣金 Commission</span><span>{rule.currency} {commission.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>印花税 Stamp</span><span>{rule.currency} {stamp.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-white/5 pt-1.5 text-[#D4A853] font-medium">
              <span>总费用 Total Fees</span><span>{rule.currency} {totalFees.toFixed(2)}</span>
            </div>
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={hasActiveOrder}
                  className="w-full py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {direction === 'BUY' ? i18n.t('FractionalTradePanel.k3') : i18n.t('FractionalTradePanel.k4')} {totalQty} 股 {symbol} · {rule.currency} {notional.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </button>
        </div>

        {/* ── Active Order / Partial Fill ──────────────────────────────── */}
        {activeOrder && (
          <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-300 font-semibold text-sm">
                📊 订单状态
              </h3>
              <span className={`px-3 py-0.5 rounded text-xs font-semibold ${
                activeOrder.status === 'filled' ? 'bg-green-500/10 text-green-400' :
                activeOrder.status === 'partial' ? 'bg-yellow-500/10 text-yellow-400' :
                activeOrder.status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                'bg-gray-500/10 text-gray-400'}`}>
                {activeOrder.status === 'filled' ? i18n.t('FractionalTradePanel.k5') :
                 activeOrder.status === 'partial' ? i18n.t('FractionalTradePanel.k6') :
                 activeOrder.status === 'cancelled' ? i18n.t('FractionalTradePanel.k7') : i18n.t('FractionalTradePanel.k8')}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <FillProgressBar filled={activeOrder.filledQty} total={activeOrder.totalQty} status={activeOrder.status} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="text-[10px] text-gray-600">{"components.tradeFilled"}</div>
                <div className="text-sm font-semibold text-green-400">{activeOrder.filledQty}</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="text-[10px] text-gray-600">剩余</div>
                <div className={`text-sm font-semibold ${activeOrder.remainingQty > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                  {activeOrder.remainingQty}
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="text-[10px] text-gray-600">均价</div>
                <div className="text-sm font-semibold text-gray-200">
                  {activeOrder.avgFillPrice > 0 ? activeOrder.avgFillPrice.toFixed(2) : '—'}
                </div>
              </div>
            </div>

            {/* Partial fill log */}
            {activeOrder.partialFills.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">部分成交记录</div>
                <div className="space-y-1">
                  {activeOrder.partialFills.map((fill, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-white/[0.02] rounded text-xs">
                      <span className="text-gray-500 font-mono">{fill.time}</span>
                      <span className="text-gray-400 font-mono">{fill.qty}股 @ {fill.price}</span>
                      <span className="text-gray-600 font-mono">费{fill.fee.toFixed(2)}</span>
                      {i === activeOrder.partialFills.length - 1 && activeOrder.remainingQty > 0 && (
                        <span className="text-yellow-400 text-[10px]">← 剩余 {activeOrder.remainingQty} 股继续挂单</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancel button */}
            {['pending', 'partial'].includes(activeOrder.status) && (
              <button onClick={handleCancel}
                      className="mt-4 w-full py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors">
                取消订单 Cancel Order
              </button>
            )}
          </div>
        )}

        {/* ── Market Rules Reference ────────────────────────────────────── */}
        <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <h3 className="text-gray-300 font-semibold text-sm">📋 三市场碎股规则</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/[0.02] text-gray-500">
                <th className="text-left px-5 py-2 font-medium">{"components.markets"}</th>
                <th className="text-left px-5 py-2 font-medium">整手</th>
                <th className="text-left px-5 py-2 font-medium">碎股范围</th>
                <th className="text-left px-5 py-2 font-medium">最小碎股</th>
                <th className="text-left px-5 py-2 font-medium">{"components.commission"}</th>
                <th className="text-left px-5 py-2 font-medium">最低佣金</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MARKET_RULES.map(r => (
                <tr key={r.market} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-2.5 text-gray-300">{r.flag} {r.market}</td>
                  <td className="px-5 py-2.5 text-gray-400">{r.lotSize} 股</td>
                  <td className="px-5 py-2.5 text-gray-400">
                    {r.market === 'US' ? '0.01-1.00' : `1-${r.lotSize - 1}`} 股
                  </td>
                  <td className="px-5 py-2.5 text-gray-500">{r.minFractional}</td>
                  <td className="px-5 py-2.5 text-gray-400">{r.commissionPct}%</td>
                  <td className="px-5 py-2.5 text-gray-500">{r.currency}{r.minCommission}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
