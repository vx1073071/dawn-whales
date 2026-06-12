// ── R120 #22 SignalProviderDashboard — 信号提供者跟单面板 ─────────────────
// PM: 信号源业绩/胜率/回撤/夏普比率可视化 + 详情面板

import { useState, useMemo } from 'react';
import { useBrokerData } from '../../hooks/useBrokerData';
import { ChartSkeleton, ChartError, ChartEmpty } from '../chart/ChartStates';

// ═══════════ Types ═══════════

export interface SignalProvider {
  id: string;
  name: string;
  avatar?: string;
  exchange: string;
  market: string;
  totalTrades: number;
  winRate: number;
  totalReturn: number;      // %
  sharpeRatio: number;
  maxDrawdown: number;      // %
  avgHoldingTime: string;   // e.g. "4h 30m"
  copiers: number;
  fee: number;              // % of profit
  riskLevel: 'low' | 'medium' | 'high';
  verified: boolean;
  last30dReturn: number;
  strategy: string;
  description: string;
}

export interface TradeRecord {
  id: string;
  providerId: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  openedAt: number;
  closedAt?: number;
  status: 'open' | 'closed';
}

// ═══════════ Mock ──────────────────────────────────────────────────────

const MOCK_PROVIDERS: SignalProvider[] = [
  { id: 'sp1', name: 'AlphaQuant', exchange: 'Binance', market: 'Crypto', totalTrades: 1247, winRate: 68.4, totalReturn: 342.5, sharpeRatio: 2.8, maxDrawdown: 12.3, avgHoldingTime: '6h', copiers: 3420, fee: 15, riskLevel: 'medium', verified: true, last30dReturn: 28.4, strategy: 'Multi-TF trend following + volume confirmation', description: '专攻BTC/ETH大周期趋势跟踪，结合成交量确认信号，持仓6小时到3天。' },
  { id: 'sp2', name: 'ScalperKing', exchange: 'Binance', market: 'Crypto', totalTrades: 8923, winRate: 72.1, totalReturn: 567.8, sharpeRatio: 3.2, maxDrawdown: 8.7, avgHoldingTime: '12m', copiers: 1870, fee: 20, riskLevel: 'high', verified: true, last30dReturn: 45.2, strategy: 'Ultra-short-term scalping, < 1h hold', description: '超短线剥头皮策略，持仓平均12分钟，基于订单簿失衡+大单检测。' },
  { id: 'sp3', name: 'MacroHedge', exchange: 'Binance', market: 'Crypto', totalTrades: 423, winRate: 55.3, totalReturn: 234.1, sharpeRatio: 1.9, maxDrawdown: 22.1, avgHoldingTime: '3d', copiers: 890, fee: 10, riskLevel: 'low', verified: true, last30dReturn: 12.7, strategy: 'Macro-driven swing trading', description: '基于宏观经济指标的大波段交易，低换手率，适合资金量大不想频繁操作的用户。' },
];

const MOCK_TRADES: TradeRecord[] = [
  { id: 't1', providerId: 'sp1', symbol: 'BTC-USDT', side: 'long', entryPrice: 97234, exitPrice: 99234, pnl: 2000, pnlPercent: 2.05, openedAt: Date.now() - 3600000, closedAt: Date.now() - 600000, status: 'closed' },
  { id: 't2', providerId: 'sp1', symbol: 'ETH-USDT', side: 'long', entryPrice: 3821, exitPrice: 3950, pnl: 129, pnlPercent: 3.38, openedAt: Date.now() - 7200000, closedAt: Date.now() - 1200000, status: 'closed' },
  { id: 't3', providerId: 'sp1', symbol: 'SOL-USDT', side: 'short', entryPrice: 187.5, pnlPercent: -1.3, openedAt: Date.now() - 1800000, status: 'open' },
  { id: 't4', providerId: 'sp2', symbol: 'DOGE-USDT', side: 'long', entryPrice: 0.382, exitPrice: 0.389, pnl: 0.007, pnlPercent: 1.83, openedAt: Date.now() - 600000, closedAt: Date.now() - 120000, status: 'closed' },
  { id: 't5', providerId: 'sp2', symbol: 'ADA-USDT', side: 'short', entryPrice: 0.745, pnlPercent: -0.5, openedAt: Date.now() - 300000, status: 'open' },
];

// ═══════════ Component ═══════════

export default function SignalProviderDashboard() {
  const { data: providers, loading, error, refetch } = useBrokerData<SignalProvider[]>({
    channel: 'signal:getProviders',
    mockData: MOCK_PROVIDERS,
    pollInterval: 15000,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');

  const provider = useMemo(() => providers?.find(p => p.id === selected) || null, [providers, selected]);
  const providerTrades = useMemo(() => MOCK_TRADES.filter(t => t.providerId === selected), [selected]);

  if (loading) return <ChartSkeleton rows={5} />;
  if (error) return <ChartError title="信号源加载失败" message={error} onRetry={refetch} />;
  if (!providers || providers.length === 0) return <ChartEmpty icon="📡" title="暂无信号源" message="暂无可用信号提供者" />;

  return (
    <div className="flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 gap-2" style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[#8b949e] text-[10px] font-semibold">📊 信号提供者</span>
        <div className="flex gap-1">
          <button onClick={() => { setView('list'); setSelected(null); }}
            className={`px-2 py-0.5 text-[9px] rounded ${view === 'list' ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58]'}`}>列表</button>
          <button onClick={() => provider && setView('detail')}
            className={`px-2 py-0.5 text-[9px] rounded ${view === 'detail' ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58]'}`}
            disabled={!provider}>详情</button>
        </div>
      </div>

      {/* List view */}
      {view === 'list' && (
        <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
          {providers.map(p => {
            const isSel = selected === p.id;
            return (
              <div key={p.id}
                onClick={() => setSelected(isSel ? null : p.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors border
                  ${isSel ? 'bg-[#3b82f610] border-[#3b82f630]' : 'border-[#1c2333] hover:bg-[#161b22]'}`}>
                {/* Risk badge */}
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.riskLevel === 'low' ? 'bg-[#22c55e]' : p.riskLevel === 'medium' ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'}`} />
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#c9d1d9] font-bold">{p.name}</span>
                    {p.verified && <span className="text-[7px] text-[#3b82f6]">✓</span>}
                    <span className="text-[7px] text-[#484f58]">{p.exchange}</span>
                  </div>
                  <div className="text-[8px] text-[#484f58] truncate">{p.strategy}</div>
                </div>
                {/* Stats */}
                <div className="flex gap-3 text-right">
                  <div>
                    <div className="text-[8px] text-[#22c55e] font-bold">+{p.totalReturn}%</div>
                    <div className="text-[7px] text-[#484f58]">总收益</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-[#8b949e] font-bold">{p.winRate}%</div>
                    <div className="text-[7px] text-[#484f58]">胜率</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-[#c9d1d9] font-bold">{p.copiers}</div>
                    <div className="text-[7px] text-[#484f58]">跟单</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail view */}
      {view === 'detail' && provider && (
        <div className="flex flex-col gap-2">
          {/* Provider header */}
          <div className="flex items-center justify-between p-2 bg-[#161b22] rounded border border-[#1c2333]">
            <div>
              <div className="flex items-center gap-1">
                <span className="text-[12px] text-[#c9d1d9] font-bold">{provider.name}</span>
                {provider.verified && <span className="text-[8px] text-[#3b82f6]">✓已验证</span>}
              </div>
              <div className="text-[9px] text-[#484f58]">{provider.description}</div>
            </div>
            <button className="px-3 py-1 bg-[#22c55e] text-black text-[9px] font-bold rounded hover:bg-[#22c55e]/80">
              跟单 ({provider.fee}% 利润分润)
            </button>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-4 gap-1">
            <StatBox label="总收益" value={`+${provider.totalReturn}%`} color="#22c55e" />
            <StatBox label="夏普比" value={provider.sharpeRatio.toFixed(1)} color="#f59e0b" />
            <StatBox label="最大回撤" value={`${provider.maxDrawdown}%`} color="#ef4444" />
            <StatBox label="胜率" value={`${provider.winRate}%`} color="#3b82f6" />
            <StatBox label="总交易" value={String(provider.totalTrades)} color="#8b949e" />
            <StatBox label="30日" value={`+${provider.last30dReturn}%`} color="#22c55e" />
            <StatBox label="持有时长" value={provider.avgHoldingTime} color="#8b949e" />
            <StatBox label="跟单人数" value={String(provider.copiers)} color="#c9d1d9" />
          </div>

          {/* Recent trades */}
          <div>
            <span className="text-[9px] text-[#8b949e] font-semibold">最近交易</span>
            <div className="flex flex-col gap-0.5 mt-1 max-h-[150px] overflow-y-auto">
              {providerTrades.map(t => (
                <div key={t.id} className="flex items-center gap-2 px-2 py-0.5 bg-[#161b22] rounded text-[9px]">
                  <span className={t.side === 'long' ? 'text-[#22c55e]' : 'text-[#ef4444]'}>{t.side === 'long' ? '多' : '空'}</span>
                  <span className="text-[#c9a96e] font-bold">{t.symbol}</span>
                  <span className="text-[#8b949e] flex-1">{t.entryPrice}</span>
                  {t.pnlPercent != null && (
                    <span className={t.pnlPercent >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                      {t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent}%
                    </span>
                  )}
                  <span className={`text-[7px] ${t.status === 'open' ? 'text-[#f59e0b]' : 'text-[#484f58]'}`}>
                    {t.status === 'open' ? '持仓' : '已平'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#161b22] rounded p-1.5 border border-[#1c2333] text-center">
      <div className="text-[7px] text-[#484f58]">{label}</div>
      <div className="text-[10px] font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
