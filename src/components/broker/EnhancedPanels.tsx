// ── R121 #22+#23 Polish — 信号Dashboard增强 + 持仓趋势 ─────────────────

import { useMemo, useState } from 'react';
import { useBrokerData } from '../../hooks/useBrokerData';
import { ChartSkeleton, ChartError } from '../chart/ChartStates';

// ═══════════ #22 Enhanced Types ═══════════

export interface SignalProviderEnhanced {
  id: string; name: string; exchange: string;
  totalTrades: number; winRate: number; totalReturn: number;
  sharpeRatio: number; maxDrawdown: number;
  copiers: number; fee: number; riskLevel: 'low' | 'medium' | 'high';
  verified: boolean; last30dReturn: number; strategy: string;
  // Enhanced: historical timeline
  monthlyReturns: { month: string; return: number }[];
  // Enhanced: trade distribution
  tradeDistribution: { pair: string; count: number; winRate: number }[];
}

export interface PortfolioHistory {
  date: string;
  totalValue: number;
  pnl: number;
}

// ═══════════ Mock ──────────────────────────────────────────────────────

const MOCK_ENHANCED: SignalProviderEnhanced[] = [
  { id: 'sp1', name: 'AlphaQuant', exchange: 'Binance', totalTrades: 1247, winRate: 68.4, totalReturn: 342.5, sharpeRatio: 2.8, maxDrawdown: 12.3, copiers: 3420, fee: 15, riskLevel: 'medium', verified: true, last30dReturn: 28.4, strategy: 'Multi-TF trend following',
    monthlyReturns: [{ month:'1月',return:5.2},{ month:'2月',return:8.1},{ month:'3月',return:-2.3},{ month:'4月',return:12.5},{ month:'5月',return:4.8},{ month:'6月',return:28.4}],
    tradeDistribution: [{ pair:'BTC-USDT',count:450,winRate:72},{ pair:'ETH-USDT',count:380,winRate:68},{ pair:'SOL-USDT',count:220,winRate:65},{ pair:'DOGE-USDT',count:120,winRate:58}],
  },
  { id: 'sp2', name: 'ScalperKing', exchange: 'Binance', totalTrades: 8923, winRate: 72.1, totalReturn: 567.8, sharpeRatio: 3.2, maxDrawdown: 8.7, copiers: 1870, fee: 20, riskLevel: 'high', verified: true, last30dReturn: 45.2, strategy: 'Ultra-short scalping',
    monthlyReturns: [{ month:'1月',return:8.3},{ month:'2月',return:12.1},{ month:'3月',return:6.7},{ month:'4月',return:15.2},{ month:'5月',return:-1.2},{ month:'6月',return:45.2}],
    tradeDistribution: [{ pair:'BTC-USDT',count:3100,winRate:74},{ pair:'ETH-USDT',count:2800,winRate:71},{ pair:'DOGE-USDT',count:1800,winRate:69}],
  },
];

const MOCK_HISTORY: PortfolioHistory[] = [
  { date: '1月', totalValue: 850000, pnl: 12000 }, { date: '2月', totalValue: 880000, pnl: 30000 },
  { date: '3月', totalValue: 910000, pnl: 30000 }, { date: '4月', totalValue: 945000, pnl: 35000 },
  { date: '5月', totalValue: 975000, pnl: 30000 }, { date: '6月', totalValue: 1020000, pnl: 45000 },
];

// ═══════════ Enhanced Dashboard ═══════════

export function SignalDashboardEnhanced() {
  const { data, loading, error, refetch } = useBrokerData<SignalProviderEnhanced[]>({
    channel: 'signal:getProvidersEnhanced',
    mockData: MOCK_ENHANCED,
    pollInterval: 15000,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'return' | 'sharpe' | 'winRate' | 'copiers'>('return');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  const filtered = useMemo(() => {
    if (!data) return [];
    let items = [...data];
    if (filterRisk !== 'all') items = items.filter(p => p.riskLevel === filterRisk);
    items.sort((a, b) => {
      switch (sortKey) {
        case 'return': return b.totalReturn - a.totalReturn;
        case 'sharpe': return b.sharpeRatio - a.sharpeRatio;
        case 'winRate': return b.winRate - a.winRate;
        case 'copiers': return b.copiers - a.copiers;
        default: return 0;
      }
    });
    return items;
  }, [data, sortKey, filterRisk]);

  const provider = useMemo(() => data?.find(p => p.id === selected) || null, [data, selected]);

  if (loading) return <ChartSkeleton rows={6} />;
  if (error) return <ChartError title="信号Dashboard加载失败" message={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 gap-2" style={{ fontFamily: 'monospace' }}>
      <div className="flex items-center justify-between">
        <span className="text-[#8b949e] text-[10px] font-semibold">📊 信号Dashboard</span>
        {/* Sort + Filter */}
        <div className="flex gap-0.5">
          {(['return','sharpe','winRate','copiers'] as const).map(k => (
            <button key={k} onClick={() => setSortKey(k)}
              className={`px-1.5 py-0.5 text-[8px] rounded ${sortKey === k ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58]'}`}>
              {k === 'return' ? '收益' : k === 'sharpe' ? '夏普' : k === 'winRate' ? '胜率' : '跟单'}
            </button>
          ))}
          <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
            className="bg-[#161b22] border border-[#30363d] rounded px-1 text-[8px] text-[#8b949e]">
            <option value="all">全部</option>
            <option value="low">低风险</option>
            <option value="medium">中风险</option>
            <option value="high">高风险</option>
          </select>
        </div>
      </div>

      {/* Provider list */}
      <div className="max-h-[300px] overflow-y-auto flex flex-col gap-1">
        {filtered.map(p => {
          const isSel = selected === p.id;
          const maxRet = Math.max(...p.monthlyReturns.map(m => m.return), 1);
          return (
            <div key={p.id} onClick={() => setSelected(isSel ? null : p.id)}
              className={`flex flex-col gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors border
                ${isSel ? 'bg-[#3b82f610] border-[#3b82f630]' : 'border-[#1c2333] hover:bg-[#161b22]'}`}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#c9d1d9] font-bold">{p.name}</span>
                <span className={`text-[7px] px-1 rounded ${p.riskLevel === 'low' ? 'bg-[#22c55e20] text-[#22c55e]' : p.riskLevel === 'medium' ? 'bg-[#f59e0b20] text-[#f59e0b]' : 'bg-[#ef444420] text-[#ef4444]'}`}>
                  {p.riskLevel === 'low' ? '低' : p.riskLevel === 'medium' ? '中' : '高'}
                </span>
                <span className="text-[8px] text-[#22c55e] font-bold ml-auto">+{p.totalReturn}%</span>
                <span className="text-[7px] text-[#484f58]">夏普{p.sharpeRatio}</span>
              </div>

              {/* Monthly returns sparkline */}
              <div className="flex items-center gap-0.5 h-5">
                {p.monthlyReturns.map((m, i) => {
                  const h = `${Math.max(4, (Math.abs(m.return) / maxRet) * 100)}%`;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full bg-[#161b22] rounded-sm overflow-hidden h-3 relative">
                        <div className={`absolute bottom-0 w-full rounded-sm transition-all ${m.return >= 0 ? 'bg-[#22c55e50]' : 'bg-[#ef444450]'}`}
                          style={{ height: h }} />
                      </div>
                      <span className="text-[6px] text-[#484f58]">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected detail */}
      {provider && (
        <div className="grid grid-cols-4 gap-1 p-2 bg-[#161b22] rounded border border-[#1c2333]">
          <MiniStat label="总交易" v={String(provider.totalTrades)} />
          <MiniStat label="胜率" v={`${provider.winRate}%`} c="#22c55e" />
          <MiniStat label="回撤" v={`${provider.maxDrawdown}%`} c="#ef4444" />
          <MiniStat label="跟单费" v={`${provider.fee}%`} />
          <MiniStat label="30日" v={`+${provider.last30dReturn}%`} c="#22c55e" />
          <MiniStat label="交易对" v={String(provider.tradeDistribution.length)} />
          <MiniStat label="策略" v={provider.strategy.slice(0, 8) + '...'} />
          <MiniStat label="验证" v={provider.verified ? '✓' : '✗'} c={provider.verified ? '#3b82f6' : '#ef4444'} />
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, v, c }: { label: string; v: string; c?: string }) {
  return (
    <div className="text-center">
      <div className="text-[7px] text-[#484f58]">{label}</div>
      <div className="text-[9px] font-bold" style={{ color: c || '#c9d1d9' }}>{v}</div>
    </div>
  );
}

// ═══════════ #23 PortfolioTrend Component ═══════════

export function PortfolioTrend({ history }: { history?: PortfolioHistory[] }) {
  const data = history || MOCK_HISTORY;
  if (data.length === 0) return null;

  const maxV = Math.max(...data.map(d => d.totalValue));
  const minV = Math.min(...data.map(d => d.totalValue));
  const range = maxV - minV || 1;
  const w = 300, h = 80, pad = 10;
  const points = data.map((d, i) => ({
    x: pad + (i / (data.length - 1 || 1)) * (w - pad * 2),
    y: h - pad - ((d.totalValue - minV) / range) * (h - pad * 2),
    ...d,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const isUp = data.length >= 2 ? data[data.length - 1].totalValue >= data[0].totalValue : true;
  const fillColor = isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
  const strokeColor = isUp ? '#22c55e' : '#ef4444';

  return (
    <div className="flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 gap-1" style={{ fontFamily: 'monospace' }}>
      <div className="flex items-center justify-between">
        <span className="text-[#8b949e] text-[10px] font-semibold">📈 资产趋势</span>
        <span className={`text-[9px] font-bold ${isUp ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {isUp ? '+' : ''}{(((data[data.length - 1].totalValue - data[0].totalValue) / data[0].totalValue) * 100).toFixed(1)}%
        </span>
      </div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* Area fill */}
        <path d={`${pathD} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`} fill={fillColor} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.5" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={strokeColor} />
        ))}
      </svg>
      <div className="flex justify-between text-[7px] text-[#484f58]">
        {data.map((d, i) => (
          <span key={i}>{d.date}</span>
        ))}
      </div>
    </div>
  );
}
