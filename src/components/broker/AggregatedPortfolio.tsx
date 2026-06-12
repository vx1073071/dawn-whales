/**
 * src/components/broker/AggregatedPortfolio.tsx
 * R1 CONC-07: Cross-broker aggregated portfolio prototype
 *
 * Shows total balance across all connected brokers,
 * per-broker breakdown, and cross-broker position aggregation.
 */

import React, { useState, useMemo } from 'react';
import { Progress, Tooltip } from 'antd';

// ── Types ──────────────────────────────────────────────

interface BrokerBalance {
  brokerId: string;
  brokerName: string;
  totalEquity: number;
  availableCash: number;
  frozenCash: number;
  positions: AggregatedPosition[];
}

interface AggregatedPosition {
  symbol: string;
  quantity: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  brokerAllocation: { brokerId: string; quantity: number }[];
}

// ── Mock data ──────────────────────────────────────────

const MOCK_BALANCES: BrokerBalance[] = [
  {
    brokerId: 'binance',
    brokerName: 'Binance',
    totalEquity: 523456.78,
    availableCash: 234567.89,
    frozenCash: 12345.67,
    positions: [],
  },
  {
    brokerId: 'okx',
    brokerName: 'OKX',
    totalEquity: 312345.67,
    availableCash: 156789.01,
    frozenCash: 8765.43,
    positions: [],
  },
  {
    brokerId: 'bybit',
    brokerName: 'Bybit',
    totalEquity: 198765.43,
    availableCash: 98765.43,
    frozenCash: 5432.10,
    positions: [],
  },
  {
    brokerId: 'futu',
    brokerName: 'Futu',
    totalEquity: 1765432.10,
    availableCash: 876543.21,
    frozenCash: 123456.78,
    positions: [],
  },
];

const MOCK_POSITIONS: AggregatedPosition[] = [
  {
    symbol: 'BTC-USDT',
    quantity: 1.234,
    marketPrice: 98234.50,
    marketValue: 121221.37,
    unrealizedPnl: 12345.67,
    unrealizedPnlPercent: 11.3,
    brokerAllocation: [
      { brokerId: 'binance', quantity: 0.5 },
      { brokerId: 'okx', quantity: 0.3 },
      { brokerId: 'bybit', quantity: 0.434 },
    ],
  },
  {
    symbol: 'ETH-USDT',
    quantity: 15.5,
    marketPrice: 5432.10,
    marketValue: 84197.55,
    unrealizedPnl: -2345.67,
    unrealizedPnlPercent: -2.7,
    brokerAllocation: [
      { brokerId: 'binance', quantity: 5.0 },
      { brokerId: 'okx', quantity: 8.0 },
      { brokerId: 'futu', quantity: 2.5 },
    ],
  },
  {
    symbol: 'SOL-USDT',
    quantity: 500,
    marketPrice: 187.45,
    marketValue: 93725.00,
    unrealizedPnl: 5678.90,
    unrealizedPnlPercent: 6.5,
    brokerAllocation: [
      { brokerId: 'binance', quantity: 200 },
      { brokerId: 'okx', quantity: 100 },
      { brokerId: 'bybit', quantity: 200 },
    ],
  },
];

const BROKER_COLORS: Record<string, string> = {
  binance: '#F0B90B',
  okx: '#00A2FF',
  bybit: '#F7A600',
  bitget: '#03A9F4',
  futu: '#22C55E',
};

// ── Component ──────────────────────────────────────────

export default function AggregatedPortfolio() {
  const [expanded] = useState(true);

  const totalEquity = useMemo(
    () => MOCK_BALANCES.reduce((sum, b) => sum + b.totalEquity, 0),
    []
  );

  const totalCash = useMemo(
    () => MOCK_BALANCES.reduce((sum, b) => sum + b.availableCash, 0),
    []
  );

  const totalPositions = useMemo(
    () => MOCK_POSITIONS.reduce((sum, p) => sum + p.marketValue, 0),
    []
  );

  const totalPnl = useMemo(
    () => MOCK_POSITIONS.reduce((sum, p) => sum + p.unrealizedPnl, 0),
    []
  );

  return (
    <div className="p-4 space-y-6">
      {/* ── Total Summary ── */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1a1a2e] border border-white/5 rounded-lg p-4">
          <div className="text-gray-400 text-xs uppercase tracking-wide">Total Equity</div>
          <div className="text-2xl font-bold text-white mt-1">
            ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-[#1a1a2e] border border-white/5 rounded-lg p-4">
          <div className="text-gray-400 text-xs uppercase tracking-wide">Available Cash</div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            ${totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-[#1a1a2e] border border-white/5 rounded-lg p-4">
          <div className="text-gray-400 text-xs uppercase tracking-wide">Position Value</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            ${totalPositions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-[#1a1a2e] border border-white/5 rounded-lg p-4">
          <div className="text-gray-400 text-xs uppercase tracking-wide">Unrealized PnL</div>
          <div className={`text-2xl font-bold mt-1 ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* ── Broker Breakdown ── */}
      <div className="bg-[#1a1a2e] border border-white/5 rounded-lg p-4">
        <h3 className="text-white font-semibold mb-4">Broker Allocation</h3>
        <div className="space-y-3">
          {MOCK_BALANCES.map(broker => (
            <div key={broker.brokerId} className="flex items-center gap-3">
              <div className="w-24 flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: BROKER_COLORS[broker.brokerId] || '#666' }}
                />
                <span className="text-gray-300 text-sm">{broker.brokerName}</span>
              </div>
              <div className="flex-1">
                <Tooltip title={`$${broker.totalEquity.toLocaleString()}`}>
                  <Progress
                    percent={Math.round((broker.totalEquity / totalEquity) * 100)}
                    strokeColor={BROKER_COLORS[broker.brokerId]}
                    showInfo={true}
                    size="small"
                  />
                </Tooltip>
              </div>
              <div className="w-40 text-right text-sm">
                <span className="text-white font-mono">
                  ${broker.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Aggregated Positions ── */}
      {expanded && (
        <div className="bg-[#1a1a2e] border border-white/5 rounded-lg p-4">
          <h3 className="text-white font-semibold mb-4">Aggregated Positions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase">
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-right py-2">Quantity</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">Value</th>
                  <th className="text-right py-2">PnL</th>
                  <th className="text-left py-2 pl-4">Allocation</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_POSITIONS.map(pos => (
                  <tr key={pos.symbol} className="border-t border-white/5">
                    <td className="py-2">
                      <span className="text-white font-mono font-semibold">{pos.symbol}</span>
                    </td>
                    <td className="py-2 text-right text-white font-mono">
                      {pos.quantity.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-gray-300 font-mono">
                      ${pos.marketPrice.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-white font-mono">
                      ${pos.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2 text-right font-mono ${pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toLocaleString()}
                      <span className="text-xs ml-1">
                        ({pos.unrealizedPnlPercent > 0 ? '+' : ''}{pos.unrealizedPnlPercent}%)
                      </span>
                    </td>
                    <td className="py-2 pl-4">
                      <div className="flex gap-1">
                        {pos.brokerAllocation.map(alloc => (
                          <Tooltip
                            key={alloc.brokerId}
                            title={`${alloc.brokerId}: ${alloc.quantity} ${pos.symbol.split('-')[0]}`}
                          >
                            <div
                              className="h-4 rounded-sm"
                              style={{
                                width: `${(alloc.quantity / pos.quantity) * 80}px`,
                                minWidth: '12px',
                                backgroundColor: BROKER_COLORS[alloc.brokerId] || '#666',
                              }}
                            />
                          </Tooltip>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
