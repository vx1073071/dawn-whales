/**
 * src/components/broker/WatchlistV2.tsx
 * R1 CONC-06: Multi-broker real-time watchlist prototype
 *
 * Shows the same symbol across multiple connected brokers,
 * highlights best price, and flags arbitrage opportunities.
 */

import React, { useState, useMemo } from 'react';
import { Table, Tag, Badge, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';

// ── Types ──────────────────────────────────────────────

interface TaggedQuote {
  symbol: string;
  brokerId: string;
  brokerName: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  bid: number;
  ask: number;
  timestamp: number;
}

interface WatchlistRow {
  symbol: string;
  quotes: Record<string, TaggedQuote>;
}

// ── Mock data ──────────────────────────────────────────

const MOCK_BROKERS = ['binance', 'okx', 'bybit', 'bitget'];

const MOCK_SYMBOLS = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT', 'ADA-USDT'];

function generateMockQuote(symbol: string, brokerId: string): TaggedQuote {
  const basePrice = {
    'BTC-USDT': 98234.5,
    'ETH-USDT': 5432.1,
    'SOL-USDT': 187.45,
    'DOGE-USDT': 0.12345,
    'ADA-USDT': 0.8765,
  }[symbol] || 100;

  // Add small random variance per broker
  const variance = (Math.random() - 0.5) * basePrice * 0.002; // ±0.1%
  const price = basePrice + variance;

  return {
    symbol,
    brokerId,
    brokerName: brokerId.charAt(0).toUpperCase() + brokerId.slice(1),
    price: Math.round(price * 1e6) / 1e6,
    change24h: Math.round((Math.random() - 0.5) * 1000 * 1e6) / 1e6,
    changePercent24h: Math.round((Math.random() - 0.5) * 10 * 100) / 100,
    volume24h: Math.round(Math.random() * 1e9),
    bid: Math.round((price - Math.random() * 0.5) * 1e6) / 1e6,
    ask: Math.round((price + Math.random() * 0.5) * 1e6) / 1e6,
    timestamp: Date.now(),
  };
}

function generateMockData(): WatchlistRow[] {
  return MOCK_SYMBOLS.map(symbol => {
    const quotes: Record<string, TaggedQuote> = {};
    MOCK_BROKERS.forEach(brokerId => {
      quotes[brokerId] = generateMockQuote(symbol, brokerId);
    });
    return { symbol, quotes };
  });
}

// ── Helpers ────────────────────────────────────────────

function getBestBroker(quotes: Record<string, TaggedQuote>, side: 'bid' | 'ask'): string {
  let best = '';
  let bestPrice = side === 'ask' ? Infinity : -Infinity;
  for (const [broker, quote] of Object.entries(quotes)) {
    const price = side === 'ask' ? quote.ask : quote.bid;
    if ((side === 'ask' && price < bestPrice) || (side === 'bid' && price > bestPrice)) {
      best = broker;
      bestPrice = price;
    }
  }
  return best;
}

function getArbitrageSpread(quotes: Record<string, TaggedQuote>): number | null {
  const prices = Object.values(quotes).map(q => q.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === 0) return null;
  return ((max - min) / min) * 100;
}

const BROKER_COLORS: Record<string, string> = {
  binance: '#F0B90B',
  okx: '#00A2FF',
  bybit: '#F7A600',
  bitget: '#03A9F4',
};

// ── Component ──────────────────────────────────────────

export default function WatchlistV2() {
  const [data] = useState<WatchlistRow[]>(() => generateMockData());
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>(MOCK_BROKERS);

  // Use selected brokers only
  const visible = useMemo(() => {
    return data.map(row => {
      const filtered: Record<string, TaggedQuote> = {};
      selectedBrokers.forEach(b => {
        if (row.quotes[b]) filtered[b] = row.quotes[b];
      });
      return { ...row, quotes: filtered };
    });
  }, [data, selectedBrokers]);

  const columns: ColumnsType<WatchlistRow> = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      fixed: 'left',
      width: 130,
      render: (sym: string) => <span className="text-white font-mono font-semibold">{sym}</span>,
    },
    ...selectedBrokers.map(brokerId => ({
      title: (
        <div className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: BROKER_COLORS[brokerId] || '#666' }}
          />
          {brokerId.charAt(0).toUpperCase() + brokerId.slice(1)}
        </div>
      ),
      key: brokerId,
      width: 160,
      render: (_: unknown, record: WatchlistRow) => {
        const quote = record.quotes[brokerId];
        if (!quote) return <span className="text-gray-600">—</span>;
        const isCheapestAsk = getBestBroker(record.quotes, 'ask') === brokerId;
        const isHighestBid = getBestBroker(record.quotes, 'bid') === brokerId;
        return (
          <div className="flex flex-col gap-0.5 text-xs">
            <div className="flex items-center gap-1">
              <span className={isCheapestAsk ? 'text-green-400 font-bold' : 'text-white'}>
                {quote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </span>
              {isCheapestAsk && <Tag color="green" className="text-[10px] px-1 py-0 leading-3">BEST</Tag>}
            </div>
            <div className="flex gap-2 text-gray-500">
              <span>B: {quote.bid.toFixed(2)}</span>
              <span>A: {quote.ask.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={quote.changePercent24h >= 0 ? 'text-green-500' : 'text-red-500'}>
                {quote.changePercent24h > 0 ? '+' : ''}{quote.changePercent24h.toFixed(2)}%
              </span>
              <span className="text-gray-600">
                V: {(quote.volume24h / 1e6).toFixed(1)}M
              </span>
            </div>
          </div>
        );
      },
    })),
    {
      title: 'Spread',
      key: 'spread',
      width: 80,
      render: (_: unknown, record: WatchlistRow) => {
        const spread = getArbitrageSpread(record.quotes);
        if (spread === null) return <span className="text-gray-600">—</span>;
        const isOpportunity = spread > 0.15;
        return (
          <Tooltip title={isOpportunity ? 'Arbitrage opportunity detected' : 'Normal spread'}>
            <Badge
              count={`${spread.toFixed(3)}%`}
              style={{
                backgroundColor: isOpportunity ? '#f5222d' : spread > 0.05 ? '#faad14' : '#52c41a',
              }}
            />
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div className="p-4">
      {/* Broker toggles */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-gray-400 text-xs mr-2">Brokers:</span>
        {MOCK_BROKERS.map(brokerId => (
          <button
            key={brokerId}
            onClick={() =>
              setSelectedBrokers(prev =>
                prev.includes(brokerId) ? prev.filter(b => b !== brokerId) : [...prev, brokerId]
              )
            }
            className={`px-2 py-1 rounded text-xs transition-colors ${
              selectedBrokers.includes(brokerId)
                ? 'bg-opacity-20 text-white'
                : 'bg-transparent text-gray-600'
            }`}
            style={{
              backgroundColor: selectedBrokers.includes(brokerId)
                ? BROKER_COLORS[brokerId] + '33'
                : 'transparent',
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1"
              style={{ backgroundColor: BROKER_COLORS[brokerId] || '#666' }}
            />
            {brokerId.charAt(0).toUpperCase() + brokerId.slice(1)}
          </button>
        ))}
      </div>

      <Table
        rowKey="symbol"
        columns={columns}
        dataSource={visible}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
        className="broker-watchlist"
        locale={{ emptyText: 'No symbols' }}
      />
    </div>
  );
}
