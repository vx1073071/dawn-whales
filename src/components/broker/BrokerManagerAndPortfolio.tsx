// ── R120 #28 BrokerManager + #23 PortfolioOverview + #31 MultiBrokerCompare ──

import { useState, useMemo } from 'react';
import { useBrokerData } from '../../hooks/useBrokerData';
import { ChartSkeleton, ChartError, ChartEmpty } from '../chart/ChartStates';

// ═══════════ #28 Broker Manager Types ═══════════

export interface BrokerConfig {
  brokerId: string;
  brokerName: string;
  status: 'connected' | 'connecting' | 'stale' | 'disconnected';
  latency?: number;
  market: string[];
  feeRate: number;
  apiKeySet: boolean;
  lastConnected?: number;
  wsStatus: 'active' | 'inactive';
}

// ═══════════ #23 Portfolio Overview Types ═══════════

export interface PortfolioAsset {
  category: string; // crypto/US stocks/HK stocks/forex/cash
  value: number;
  pct: number;
  color: string;
}

// ═══════════ MOCK ════════════════════════════════════

const MOCK_BROKERS: BrokerConfig[] = [
  { brokerId: 'binance', brokerName: 'Binance', status: 'connected', latency: 12, market: ['Crypto'], feeRate: 0.10, apiKeySet: true, wsStatus: 'active' },
  { brokerId: 'okx', brokerName: 'OKX', status: 'connected', latency: 45, market: ['Crypto'], feeRate: 0.08, apiKeySet: true, wsStatus: 'active' },
  { brokerId: 'bybit', brokerName: 'Bybit', status: 'stale', latency: 345, market: ['Crypto'], feeRate: 0.10, apiKeySet: true, wsStatus: 'active' },
  { brokerId: 'bitget', brokerName: 'Bitget', status: 'connected', latency: 23, market: ['Crypto'], feeRate: 0.10, apiKeySet: false, wsStatus: 'inactive' },
  { brokerId: 'futu', brokerName: 'Futu', status: 'connected', latency: 8, market: ['HK', 'US'], feeRate: 0.03, apiKeySet: true, wsStatus: 'active' },
  { brokerId: 'moomoo', brokerName: 'Moomoo', status: 'disconnected', market: ['HK', 'US'], feeRate: 0.03, apiKeySet: true, wsStatus: 'inactive' },
  { brokerId: 'ib', brokerName: 'IBKR', status: 'disconnected', market: ['US', 'Global'], feeRate: 0.005, apiKeySet: false, wsStatus: 'inactive' },
  { brokerId: 'tiger', brokerName: 'Tiger', status: 'connecting', market: ['HK', 'US'], feeRate: 0.03, apiKeySet: false, wsStatus: 'inactive' },
  { brokerId: 'longbridge', brokerName: 'Longbridge', status: 'disconnected', market: ['HK', 'US'], feeRate: 0.02, apiKeySet: false, wsStatus: 'inactive' },
  { brokerId: 'schwab', brokerName: 'Schwab', status: 'disconnected', market: ['US'], feeRate: 0.00, apiKeySet: false, wsStatus: 'inactive' },
];

const MOCK_ASSETS: PortfolioAsset[] = [
  { category: 'Crypto', value: 823456, pct: 47, color: '#F0B90B' },
  { category: 'US Stocks', value: 523456, pct: 30, color: '#3b82f6' },
  { category: 'HK Stocks', value: 234567, pct: 13, color: '#22c55e' },
  { category: 'Forex', value: 123456, pct: 7, color: '#a78bfa' },
  { category: 'Cash', value: 54321, pct: 3, color: '#8b949e' },
];

// ═══════════ #28 Broker Manager Component ═══════════

export function BrokerManagerPage() {
  const { data: brokers, loading, error, refetch } = useBrokerData<BrokerConfig[]>({
    channel: 'broker:getAllConfigs',
    mockData: MOCK_BROKERS,
    pollInterval: 5000,
  });

  const [expandId, setExpandId] = useState<string | null>(null);

  if (loading) return <ChartSkeleton rows={8} />;
  if (error) return <ChartError title="券商管理加载失败" message={error} onRetry={refetch} />;
  if (!brokers) return <ChartEmpty icon="🏦" title="无券商数据" />;

  const connected = brokers.filter(b => b.status === 'connected').length;

  const statusColor = (s: string) =>
    s === 'connected' ? '#22c55e' : s === 'connecting' ? '#f59e0b' : s === 'stale' ? '#f97316' : '#ef4444';

  return (
    <div className="flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 gap-2" style={{ fontFamily: 'monospace' }}>
      <div className="flex items-center justify-between">
        <span className="text-[#8b949e] text-[10px] font-semibold">🏦 券商管理</span>
        <span className={`text-[9px] ${connected === brokers.length ? 'text-[#22c55e]' : connected > 0 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>
          {connected}/{brokers.length} 已连接
        </span>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {brokers.map(b => (
          <div key={b.brokerId} className="border-b border-[#1c2333]">
            <div
              onClick={() => setExpandId(expandId === b.brokerId ? null : b.brokerId)}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#161b22] cursor-pointer transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor(b.status) }} />
              <span className="text-[10px] text-[#c9d1d9] font-bold flex-1">{b.brokerName}</span>
              <span className="text-[8px] text-[#484f58]">{b.market.join(', ')}</span>
              <span className={`text-[8px] ${b.status === 'connected' ? 'text-[#22c55e]' : b.status === 'stale' ? 'text-[#f97316]' : 'text-[#484f58]'}`}>
                {b.status}{b.latency != null ? ` ${b.latency}ms` : ''}
              </span>
              <span className="text-[#484f58] text-[8px]">{expandId === b.brokerId ? '▲' : '▼'}</span>
            </div>

            {expandId === b.brokerId && (
              <div className="px-4 py-1.5 bg-[#161b22] grid grid-cols-3 gap-1 text-[8px]">
                <div><span className="text-[#484f58]">费率:</span> {b.feeRate}%</div>
                <div><span className="text-[#484f58]">API Key:</span> <span className={b.apiKeySet ? 'text-[#22c55e]' : 'text-[#ef4444]'}>{b.apiKeySet ? '已设置' : '未设置'}</span></div>
                <div><span className="text-[#484f58]">WS:</span> <span className={b.wsStatus === 'active' ? 'text-[#22c55e]' : 'text-[#484f58]'}>{b.wsStatus}</span></div>
                {b.lastConnected && <div><span className="text-[#484f58]">最后连接:</span> {new Date(b.lastConnected).toLocaleString()}</div>}
                <button className="col-span-3 mt-1 py-0.5 text-[8px] bg-[#3b82f620] text-[#3b82f6] rounded hover:bg-[#3b82f630]">
                  配置API Key
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════ #23 Portfolio Overview Component ═══════════

export function PortfolioOverview() {
  const { data: assets, loading, error, refetch } = useBrokerData<PortfolioAsset[]>({
    channel: 'portfolio:getOverview',
    mockData: MOCK_ASSETS,
    pollInterval: 10000,
  });

  if (loading) return <ChartSkeleton rows={5} />;
  if (error) return <ChartError title="资产总览加载失败" message={error} onRetry={refetch} />;
  if (!assets) return <ChartEmpty icon="💰" title="暂无资产数据" />;

  const total = assets.reduce((s, a) => s + a.value, 0);

  // Simple pie chart using SVG arcs
  let cumAngle = -90;
  const pieSlices = assets.map(a => {
    const angle = (a.pct / 100) * 360;
    const start = cumAngle; cumAngle += angle;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const cx = 60, cy = 60, r = 45;
    const x1 = cx + r * Math.cos(rad(start)), y1 = cy + r * Math.sin(rad(start));
    const x2 = cx + r * Math.cos(rad(start + angle)), y2 = cy + r * Math.sin(rad(start + angle));
    const large = angle > 180 ? 1 : 0;
    return { ...a, d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z` };
  });

  return (
    <div className="flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 gap-2" style={{ fontFamily: 'monospace' }}>
      <span className="text-[#8b949e] text-[10px] font-semibold">📈 资产总览</span>

      <div className="flex items-center gap-3">
        {/* Pie chart */}
        <svg width="120" height="120" viewBox="0 0 120 120">
          {pieSlices.map(s => <path key={s.category} d={s.d} fill={s.color} stroke="#0d1117" strokeWidth="1" />)}
          <text x={60} y={58} textAnchor="middle" fill="#c9d1d9" fontSize="12" fontWeight="bold">${(total / 1000000).toFixed(1)}M</text>
          <text x={60} y={70} textAnchor="middle" fill="#484f58" fontSize="7">Total</text>
        </svg>

        {/* Legend + amounts */}
        <div className="flex-1 flex flex-col gap-1">
          {assets.map(a => (
            <div key={a.category} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
              <span className="text-[9px] text-[#8b949e] flex-1">{a.category}</span>
              <span className="text-[9px] text-[#c9d1d9] font-bold">${(a.value / 1000).toFixed(0)}K</span>
              <span className="text-[8px] text-[#484f58]">{a.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════ #31 Multi-Broker Compare Component ═══════════

export interface CompareQuote {
  brokerId: string;
  brokerName: string;
  bid: number;
  ask: number;
  spread: number;
  spreadPct: number;
  volume24h: number;
  isBestBid: boolean;
  isBestAsk: boolean;
}

export function MultiBrokerCompare({ symbol = 'BTC-USDT', quotes }: { symbol?: string; quotes?: CompareQuote[] }) {
  const sorted = useMemo(() => {
    if (!quotes) return [];
    return [...quotes].sort((a, b) => b.bid - a.bid);
  }, [quotes]);

  const bestBid = useMemo(() => sorted.length > 0 ? sorted[0].bid : 0, [sorted]);
  const bestAsk = useMemo(() => sorted.length > 0 ? sorted.reduce((min, q) => Math.min(min, q.ask), Infinity) : 0, [sorted]);

  if (!quotes || quotes.length === 0) {
    return <ChartEmpty icon="📊" title="等待行情" message="连接券商后显示多券商报价对比" />;
  }

  const arbSpread = bestBid > bestAsk ? ((bestBid - bestAsk) / bestAsk) * 100 : 0;

  return (
    <div className="flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 gap-2" style={{ fontFamily: 'monospace' }}>
      <div className="flex items-center justify-between">
        <span className="text-[#8b949e] text-[10px] font-semibold">🏦 多券商对比 {symbol}</span>
        {arbSpread > 0 && <span className="text-[8px] text-[#22c55e] animate-pulse font-bold">⚡套利 {arbSpread.toFixed(2)}%</span>}
      </div>

      {/* Best banner */}
      <div className="flex border border-[#1c2333] rounded overflow-hidden text-[9px]">
        <div className="flex-1 px-2 py-1 bg-[#22c55e08] text-center">
          <div className="text-[7px] text-[#484f58]">最优买价</div>
          <div className="text-[#22c55e] font-bold">{bestBid.toFixed(2)}</div>
        </div>
        <div className="w-px bg-[#1c2333]" />
        <div className="flex-1 px-2 py-1 bg-[#ef444408] text-center">
          <div className="text-[7px] text-[#484f58]">最优卖价</div>
          <div className="text-[#ef4444] font-bold">{bestAsk.toFixed(2)}</div>
        </div>
      </div>

      {/* Per-broker rows */}
      {sorted.map(q => (
        <div key={q.brokerId} className="flex items-center gap-1.5 px-2 py-1 bg-[#161b22] rounded border border-[#1c2333] text-[9px]">
          <div className="w-16 font-bold text-[#c9d1d9] truncate">{q.brokerName}</div>
          <div className="flex-1 flex gap-2">
            <span className={`${q.isBestBid ? 'text-[#22c55e] font-bold' : 'text-[#8b949e]'}`}>
              {q.bid.toFixed(2)}
            </span>
            <span className={`${q.isBestAsk ? 'text-[#ef4444] font-bold' : 'text-[#8b949e]'}`}>
              {q.ask.toFixed(2)}
            </span>
          </div>
          <span className="text-[#484f58] w-14 text-right">{q.spreadPct.toFixed(3)}%</span>
          {q.isBestBid && <span className="text-[7px] bg-[#22c55e20] text-[#22c55e] px-1 rounded">买</span>}
          {q.isBestAsk && <span className="text-[7px] bg-[#ef444420] text-[#ef4444] px-1 rounded">卖</span>}
        </div>
      ))}
    </div>
  );
}
