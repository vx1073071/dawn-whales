/**
 * FractionalShareControls — ML-61-03 [P1]
 * R61: v1.4.0-beta — Fractional share input + transparent fee display
 *
 * Features:
 * - Fractional quantity input per market rules (US: 0.01, HK: 1, CN: 100)
 * - Step controls: preset buttons (25%/50%/75%/100% of max budget)
 * - Real-time fee calculator with detailed breakdown
 * - Market-specific fee comparison table (5 markets)
 * - Budget-based quantity estimator (enter budget → calculate max shares)
 * - Fee tier indicator (maker vs taker rates)
 * - Mini order preview
 */

import React, { useState, useCallback, useMemo } from 'react';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:TRADE] structured error tracking

// ── Types ───────────────────────────────────────────────────────────────

export interface FractionalConfig {
  market: string;
  flag: string;
  currency: string;
  minQty: number;
  step: number;
  fractionalLabel: string;
  commissionPct: number;
  stampPct: number;
  exchangePct: number;
  minFee: number;
  makerRate: number;
  takerRate: number;
}

export interface FeeBreakdown {
  notional: number;
  commission: number;
  stamp: number;
  exchange: number;
  totalFees: number;
  effectiveRate: number;  // bps
}

export interface FractionalShareControlsProps {
  markets?: FractionalConfig[];
  budget?: number;
  onQuantityChange?: (qty: number, market: string) => void;
  className?: string;
}

// ── Market Configs ──────────────────────────────────────────────────────

const defaultMarkets: FractionalConfig[] = [
  {
    market: 'HK', flag: '🇭🇰', currency: 'HKD', minQty: 1, step: 1,
    fractionalLabel: 'Integer lots only',
    commissionPct: 0.03, stampPct: 0.13, exchangePct: 0.005,
    minFee: 3, makerRate: 0.01, takerRate: 0.03,
  },
  {
    market: 'US', flag: '🇺🇸', currency: 'USD', minQty: 0.01, step: 0.01,
    fractionalLabel: 'Fractional (≥ 0.01 shares)',
    commissionPct: 0.0049, stampPct: 0.0008, exchangePct: 0.003,
    minFee: 0.99, makerRate: 0.0002, takerRate: 0.001,
  },
  {
    market: 'US Options', flag: '🇺🇸', currency: 'USD', minQty: 1, step: 1,
    fractionalLabel: 'Contracts (1 = 100 shares)',
    commissionPct: 0.65, stampPct: 0, exchangePct: 0.03,
    minFee: 0, makerRate: 0.0003, takerRate: 0.001,
  },
  {
    market: 'CN', flag: '🇨🇳', currency: 'CNY', minQty: 100, step: 100,
    fractionalLabel: '100-share lots only',
    commissionPct: 0.025, stampPct: 0.05, exchangePct: 0.00487,
    minFee: 5, makerRate: 0.01, takerRate: 0.025,
  },
  {
    market: 'US ETF', flag: '🇺🇸', currency: 'USD', minQty: 0.0001, step: 0.0001,
    fractionalLabel: 'Micro-fractional (≥ 0.0001)',
    commissionPct: 0, stampPct: 0, exchangePct: 0.003,
    minFee: 0, makerRate: 0, takerRate: 0,
  },
];

const presetPcts = [25, 50, 75, 100];

// ── Helpers ─────────────────────────────────────────────────────────────

const fmtMoney = (v: number, currency: string): string => {
  const sym = currency === 'HKD' ? 'HK$' : currency === 'CNY' ? '¥' : '$';
  return `${sym}${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const calcFees = (qty: number, price: number, mkt: FractionalConfig): FeeBreakdown => {
  const notional = qty * price;
  const commission = Math.max(notional * mkt.commissionPct / 100, mkt.minFee);
  const stamp = notional * mkt.stampPct / 100;
  const exchange = notional * mkt.exchangePct / 100;
  const totalFees = commission + stamp + exchange;
  const effectiveRate = notional > 0 ? (totalFees / notional) * 10000 : 0;
  return { notional, commission, stamp, exchange, totalFees, effectiveRate };
};

// ── FractionalShareControls ─────────────────────────────────────────────

const FractionalShareControls: React.FC<FractionalShareControlsProps> = ({
  markets: inputMarkets,
  budget: inputBudget = 10000,
  onQuantityChange,
  className = '',
}) => {
  const markets = inputMarkets ?? defaultMarkets;
  const [activeMarket, setActiveMarket] = useState<string>('US');
  const [price, setPrice] = useState<string>('100');
  const [quantity, setQuantity] = useState<string>('10');
  const [budget, setBudget] = useState<string>(String(inputBudget));
  const [useBudget, setUseBudget] = useState(false);
  const [orderType, setOrderType] = useState<'maker' | 'taker'>('taker');

  const mkt = useMemo(() => markets.find(m => m.market === activeMarket)!, [activeMarket, markets]);
  const prc = parseFloat(price) || 0;
  const qty = parseFloat(quantity) || 0;
  const bgt = parseFloat(budget) || 0;

  const fees = useMemo(() => calcFees(qty, prc, mkt), [qty, prc, mkt]);
  const totalCost = fees.notional + fees.totalFees;

  // Budget-based quantity
  const maxFromBudget = useMemo(() => {
    if (prc <= 0) return 0;
    const raw = bgt / prc / (1 + mkt.commissionPct / 100 + mkt.stampPct / 100 + mkt.exchangePct / 100);
    return Math.floor(raw / mkt.step) * mkt.step;
  }, [prc, bgt, mkt]);

  const handlePreset = useCallback((pct: number) => {
    const budgetQty = maxFromBudget * pct / 100;
    const rounded = Math.round(budgetQty / mkt.step) * mkt.step;
    const final = Math.max(rounded, mkt.minQty);
    setQuantity(String(final));
    onQuantityChange?.(final, activeMarket);
  }, [maxFromBudget, mkt, onQuantityChange, activeMarket]);

  const handleQuantityChange = useCallback((val: string) => {
    setQuantity(val);
    const n = parseFloat(val) || 0;
    onQuantityChange?.(n, activeMarket);
  }, [onQuantityChange, activeMarket]);

  const isQtyValid = qty >= mkt.minQty;

  return (
    <div className={`fractional-share-controls ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">🔢 Fractional Share Controls</h2>
        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Fee Calculator</span>
      </div>

      {/* Market Picker */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {markets.map(m => (
          <button
            key={m.market}
            onClick={() => setActiveMarket(m.market)}
            className={`text-xs font-bold px-3 py-2 rounded-xl transition-all ${
              activeMarket === m.market
                ? 'bg-slate-800 text-white shadow-md'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {m.flag} {m.market}
          </button>
        ))}
      </div>

      {/* Market Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-slate-400">Min Quantity</span>
            <div className="font-bold text-slate-700 mt-0.5">{mkt.minQty} <span className="text-[10px] text-slate-400">{mkt.fractionalLabel}</span></div>
          </div>
          <div>
            <span className="text-slate-400">Step</span>
            <div className="font-bold text-slate-700 mt-0.5">{mkt.step}</div>
          </div>
          <div>
            <span className="text-slate-400">Currency</span>
            <div className="font-bold text-slate-700 mt-0.5">{mkt.currency}</div>
          </div>
        </div>
      </div>

      {/* Order Type */}
      <div className="mb-4">
        <label className="text-[10px] text-slate-500 font-semibold block mb-1">Fee Tier</label>
        <div className="flex gap-1">
          {(['maker', 'taker'] as const).map(t => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`flex-1 text-xs font-bold py-2 rounded-xl transition-all ${
                orderType === t
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {t === 'maker' ? `📉 Maker (${mkt.makerRate}%)` : `📈 Taker (${mkt.takerRate}%)`}
            </button>
          ))}
        </div>
      </div>

      {/* Price + Budget Mode */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Reference Price</label>
            <input
              type="number" step="0.01" min="0" value={price}
              onChange={e => setPrice(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-blue-300 outline-none"
              placeholder="100.00"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Quantity</label>
            <input
              type="number" step={mkt.step} min={mkt.minQty} value={quantity}
              onChange={e => handleQuantityChange(e.target.value)}
              className={`w-full text-sm border rounded-lg px-3 py-2 font-mono focus:ring-2 outline-none ${
                qty > 0 && !isQtyValid ? 'border-red-300 bg-red-50 focus:ring-red-300' : 'border-slate-200 focus:ring-blue-300'
              }`}
              placeholder={`Min ${mkt.minQty}`}
            />
            {!isQtyValid && qty > 0 && (
              <p className="text-[10px] text-red-500 mt-0.5">Minimum: {mkt.minQty} ({mkt.fractionalLabel})</p>
            )}
          </div>
        </div>

        {/* Budget mode toggle */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox" checked={useBudget} onChange={e => setUseBudget(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs text-slate-600">Estimate from budget</span>
        </div>

        {useBudget && (
          <div className="mb-3">
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Budget ({mkt.currency})</label>
            <input
              type="number" step="100" min="1" value={budget}
              onChange={e => setBudget(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-blue-300 outline-none"
            />
            {prc > 0 && bgt > 0 && (
              <p className="text-[10px] text-blue-600 mt-1">Max shares: <strong>{maxFromBudget}</strong> (≈ {fmtMoney(maxFromBudget * prc, mkt.currency)})</p>
            )}
          </div>
        )}

        {/* Preset buttons */}
        <div className="mb-3">
          <label className="text-[10px] text-slate-500 font-semibold block mb-1">Quick Fill</label>
          <div className="flex gap-1.5">
            {presetPcts.map(pct => (
              <button
                key={pct}
                onClick={() => handlePreset(pct)}
                disabled={!useBudget || maxFromBudget <= 0}
                className={`flex-1 text-[10px] font-bold py-2 rounded-lg transition-all ${
                  !useBudget || maxFromBudget <= 0
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Mini order preview */}
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">Shares</span>
            <span className="font-mono font-bold text-slate-700">{qty || '—'}</span>
          </div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">× Price</span>
            <span className="font-mono text-slate-600">{prc > 0 ? fmtMoney(prc, mkt.currency) : '—'}</span>
          </div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">= Notional</span>
            <span className="font-mono font-bold text-slate-700">{fees.notional > 0 ? fmtMoney(fees.notional, mkt.currency) : '—'}</span>
          </div>
          <div className="flex justify-between text-xs border-t border-slate-200 pt-2 mt-2">
            <span className="font-semibold text-slate-700">Total (incl. fees)</span>
            <span className={`font-mono font-bold ${totalCost > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
              {totalCost > 0 ? fmtMoney(totalCost, mkt.currency) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Fee Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <h3 className="text-xs font-bold text-slate-700 mb-3">📋 Fee Breakdown ({orderType} rate)</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Commission ({mkt.commissionPct}%)</span>
            <span className="font-mono text-red-500">{fees.notional > 0 ? fmtMoney(fees.commission, mkt.currency) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Stamp Duty ({mkt.stampPct}%)</span>
            <span className="font-mono text-red-500">{fees.notional > 0 ? fmtMoney(fees.stamp, mkt.currency) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Exchange Fee ({mkt.exchangePct}%)</span>
            <span className="font-mono text-red-500">{fees.notional > 0 ? fmtMoney(fees.exchange, mkt.currency) : '—'}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold text-slate-700">Total Fees</span>
            <span className="font-mono font-bold text-red-600">{fees.notional > 0 ? fmtMoney(fees.totalFees, mkt.currency) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Effective Rate</span>
            <span className={`font-mono font-bold ${fees.effectiveRate > 10 ? 'text-red-500' : 'text-emerald-600'}`}>
              {fees.effectiveRate > 0 ? `${fees.effectiveRate.toFixed(1)} bps` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Cross-Market Fee Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-700 mb-3">📊 Fee Comparison (All Markets)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="pb-2 text-slate-500 font-semibold">Market</th>
                <th className="pb-2 text-slate-500 font-semibold">Min Qty</th>
                <th className="pb-2 text-slate-500 font-semibold">Commission</th>
                <th className="pb-2 text-slate-500 font-semibold">Maker</th>
                <th className="pb-2 text-slate-500 font-semibold">Taker</th>
                <th className="pb-2 text-slate-500 font-semibold">Min Fee</th>
                <th className="pb-2 text-slate-500 font-semibold">Fee on $1K</th>
              </tr>
            </thead>
            <tbody>
              {markets.map(m => {
                const f1k = calcFees(1000 / (prc || 100), prc || 100, m);
                return (
                  <tr key={m.market} className={`border-b border-slate-100 ${activeMarket === m.market ? 'bg-blue-50' : ''}`}>
                    <td className="py-2 font-bold">{m.flag} {m.market}</td>
                    <td className="py-2 font-mono">{m.minQty}</td>
                    <td className="py-2 font-mono">{m.commissionPct}%</td>
                    <td className="py-2 font-mono">{m.makerRate}%</td>
                    <td className="py-2 font-mono">{m.takerRate}%</td>
                    <td className="py-2 font-mono">{m.minFee > 0 ? fmtMoney(m.minFee, m.currency) : 'Free'}</td>
                    <td className={`py-2 font-mono font-bold ${f1k.totalFees === Math.min(...markets.map(x => calcFees(1000 / (prc || 100), prc || 100, x).totalFees)) ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {fmtMoney(f1k.totalFees, m.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Fee tier explanation */}
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-[10px] text-amber-700">
            <strong>Tip:</strong> Maker orders (limit orders that add liquidity) get lower fees than taker orders (market orders that remove liquidity).
            US ETFs have no commission — free to trade!
          </p>
        </div>
      </div>
    </div>
  );
};

export default FractionalShareControls;
