// @ts-nocheck — R119: ML code, cross-module type mismatch
/**
 * src/components/broker/AggregatedPortfolio.tsx
 * R119 #19: Cross-broker aggregated portfolio — IPC wired
 */

import { useMemo } from 'react';
import { Progress } from 'antd';
import { useBrokerData } from '../../hooks/useBrokerData';
import { BrokerChartBridge, getChartBridge } from '../../lib/chart/broker-chart-bridge';
import { ChartSkeleton, ChartError, ChartEmpty } from '../chart/ChartStates';

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

const BROKER_COLORS: Record<string, string> = {
  binance: '#F0B90B', okx: '#00A2FF', bybit: '#F7A600', bitget: '#03A9F4',
  futu: '#22C55E', moomoo: '#6366F1', ib: '#EF4444', longbridge: '#F59E0B',
};

const MOCK_BALANCES: BrokerBalance[] = [
  { brokerId: 'binance', brokerName: 'Binance', totalEquity: 523456, availableCash: 234567, frozenCash: 12000, positions: [] },
  { brokerId: 'okx', brokerName: 'OKX', totalEquity: 345678, availableCash: 123456, frozenCash: 5000, positions: [] },
  { brokerId: 'bybit', brokerName: 'Bybit', totalEquity: 234567, availableCash: 87654, frozenCash: 3000, positions: [] },
  { brokerId: 'futu', brokerName: 'Futu', totalEquity: 1765432, availableCash: 876543, frozenCash: 123456, positions: [] },
];

// ── Component ──────────────────────────────────────────

export default function AggregatedPortfolio() {
  const { data: balances, loading, error, refetch, source } = useBrokerData<BrokerBalance[]>({
    channel: 'broker:getAggregatedFunds',
    mockData: MOCK_BALANCES,
    pollInterval: 10000,
  });

  const metrics = useMemo(() => {
    if (!balances) return null;
    const totalEquity = balances.reduce((s, b) => s + b.totalEquity, 0);
    const totalCash = balances.reduce((s, b) => s + b.availableCash, 0);
    const totalFrozen = balances.reduce((s, b) => s + b.frozenCash, 0);
    return { totalEquity, totalCash, totalFrozen };
  }, [balances]);

  if (loading) return <ChartSkeleton rows={5} />;
  if (error) return <ChartError title="持仓加载失败" message={error} onRetry={refetch} />;
  if (!balances || !metrics) return <ChartEmpty icon="💰" title="暂无持仓" message="连接券商后自动显示跨券商汇总" />;

  return (
    <div className="p-4 space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2">
        <h2 className="text-[#8b949e] text-xs font-semibold tracking-wide">📊 Aggregated Portfolio</h2>
        {source === 'mock' && <span className="text-[8px] bg-[#f59e0b20] text-[#f59e0b] px-1.5 py-0.5 rounded">MOCK</span>}
        {source === 'ipc' && <span className="text-[8px] bg-[#22c55e20] text-[#22c55e] px-1.5 py-0.5 rounded">LIVE</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="Total Equity" value={metrics.totalEquity} color="#c9d1d9" />
        <SummaryCard label="Available Cash" value={metrics.totalCash} color="#22c55e" />
        <SummaryCard label="Frozen" value={metrics.totalFrozen} color="#f59e0b" />
        <SummaryCard label="Brokers" value={balances.length} color="#3b82f6" isCount />
      </div>

      {/* Broker allocation */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
        <h3 className="text-[#8b949e] text-[10px] font-semibold mb-3">Broker Allocation</h3>
        <div className="space-y-2">
          {balances.map(b => (
            <div key={b.brokerId} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: BROKER_COLORS[b.brokerId] || '#666' }} />
              <span className="w-20 text-[10px] text-[#8b949e] font-mono">{b.brokerName}</span>
              <div className="flex-1">
                <Progress percent={Math.round((b.totalEquity / metrics.totalEquity) * 100)}
                  strokeColor={BROKER_COLORS[b.brokerId]} showInfo={false} size="small" />
              </div>
              <span className="w-32 text-right text-[10px] text-[#c9d1d9] font-mono">
                ${b.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cash breakdown */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
        <h3 className="text-[#8b949e] text-[10px] font-semibold mb-2">Cash Detail</h3>
        <div className="grid grid-cols-2 gap-2">
          {balances.map(b => (
            <div key={b.brokerId} className="flex justify-between text-[9px] font-mono bg-[#161b22] rounded px-2 py-1">
              <span className="text-[#8b949e]">{b.brokerName}</span>
              <span className="text-[#22c55e]">${b.availableCash.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, isCount }: { label: string; value: number; color: string; isCount?: boolean }) {
  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
      <div className="text-[#484f58] text-[9px] uppercase tracking-wide font-mono">{label}</div>
      <div className="text-lg font-bold font-mono mt-1" style={{ color }}>
        {isCount ? value : '$' + value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}
