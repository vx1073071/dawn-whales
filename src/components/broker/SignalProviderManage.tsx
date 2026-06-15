// ── R131-M03 SignalProviderManage — 信号源管理面板 ────────────────────────
// PM: 关注/取消/分润比例/排序/搜索/过滤

import { useState, useCallback, useMemo } from 'react';
import { Input, Button, Tag, Tooltip, Select, message } from 'antd';
import { StarOutlined, StarFilled, SearchOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

// ═══════════ Types ═══════════

interface Provider {
  id: string;
  name: string;
  avatar: string;
  exchange: string;
  strategy: string;
  totalReturn: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  followers: number;
  fee: number;
  riskLevel: 'low' | 'medium' | 'high';
  verified: boolean;
  minAmount: number;
  description: string;
}

// ═══════════ Mock data ═══════════

const MOCK_PROVIDERS: Provider[] = [
  { id: 'p1', name: 'AlphaQuant', avatar: 'AQ', exchange: 'Binance', strategy: '多因子+趋势跟踪', totalReturn: 380, winRate: 64.5, sharpeRatio: 2.4, maxDrawdown: 18, followers: 3420, fee: 15, riskLevel: 'medium', verified: true, minAmount: 100, description: '机构级量化策略，基于多因子模型和趋势跟踪，覆盖BTC/ETH/SOL等主流币种' },
  { id: 'p2', name: 'GoldenCross', avatar: 'GC', exchange: 'Bybit', strategy: 'MA双均线交叉', totalReturn: 210, winRate: 58.2, sharpeRatio: 1.8, maxDrawdown: 25, followers: 1280, fee: 12, riskLevel: 'medium', verified: true, minAmount: 50, description: '经典均线策略，适合中长期趋势跟踪' },
  { id: 'p3', name: 'ScalperBot', avatar: 'SB', exchange: 'OKX', strategy: '高频剥头皮', totalReturn: 156, winRate: 71.3, sharpeRatio: 2.1, maxDrawdown: 12, followers: 5600, fee: 20, riskLevel: 'high', verified: false, minAmount: 200, description: '高频短线策略，单笔持仓短，胜率高但需低延迟' },
  { id: 'p4', name: 'TrendRider', avatar: 'TR', exchange: 'Bitget', strategy: '趋势跟随+网格', totalReturn: 89, winRate: 52.8, sharpeRatio: 1.2, maxDrawdown: 32, followers: 890, fee: 8, riskLevel: 'low', verified: true, minAmount: 50, description: '稳健型策略，低波动标的网格交易' },
  { id: 'p5', name: 'WhaleTracker', avatar: 'WT', exchange: 'Binance', strategy: '链上鲸鱼追踪', totalReturn: 520, winRate: 67.0, sharpeRatio: 3.1, maxDrawdown: 15, followers: 8900, fee: 25, riskLevel: 'low', verified: true, minAmount: 500, description: '追踪链上鲸鱼地址交易行为，跟单大户操作' },
  { id: 'p6', name: 'ArbMaster', avatar: 'AM', exchange: 'Binance', strategy: '跨所价差套利', totalReturn: 45, winRate: 89.0, sharpeRatio: 4.2, maxDrawdown: 3, followers: 2100, fee: 10, riskLevel: 'low', verified: true, minAmount: 1000, description: '低风险套利策略，跨交易所价差捕捉' },
  { id: 'p7', name: 'MacroHedge', avatar: 'MH', exchange: 'OKX', strategy: '宏观对冲', totalReturn: 175, winRate: 55.0, sharpeRatio: 1.6, maxDrawdown: 22, followers: 670, fee: 18, riskLevel: 'high', verified: false, minAmount: 300, description: '基于宏观经济指标的对冲策略' },
  { id: 'p8', name: 'GridMaster', avatar: 'GM', exchange: 'Bybit', strategy: '网格+马丁', totalReturn: 95, winRate: 72.0, sharpeRatio: 1.9, maxDrawdown: 28, followers: 450, fee: 6, riskLevel: 'medium', verified: true, minAmount: 100, description: '自动化网格交易，震荡市表现优秀' },
];

// ═══════════ Sorting ═══════════

type SortKey = 'totalReturn' | 'winRate' | 'sharpeRatio' | 'followers' | 'fee';

// ═══════════ Component ═══════════

export function SignalProviderManage() {
  const [following, setFollowing] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dw-following');
      return new Set(saved ? JSON.parse(saved) : ['p1', 'p5']);
    } catch { return new Set(['p1', 'p5']); }
  });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('totalReturn');
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  const toggleFollow = useCallback((id: string) => {
    setFollowing(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); message.info('已取消关注'); }
      else { next.add(id); message.success('已关注信号源'); }
      try { localStorage.setItem('dw-following', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const sorted = useMemo(() => {
    let list = [...MOCK_PROVIDERS];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.strategy.includes(q) || p.description.includes(q));
    }
    if (riskFilter !== 'all') list = list.filter(p => p.riskLevel === riskFilter);
    list.sort((a, b) => b[sortBy] - a[sortBy]);
    // Following first
    list.sort((a, b) => (following.has(b.id) ? 1 : 0) - (following.has(a.id) ? 1 : 0));
    return list;
  }, [search, sortBy, riskFilter, following]);

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[#e6edf3] text-sm font-bold mb-0.5">信号源管理</h3>
          <p className="text-[#484f58] text-[10px]">关注优质信号源，自动接收交易信号</p>
        </div>
        <Tag color="blue" className="text-[9px]">{following.size} 已关注</Tag>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <Input prefix={<SearchOutlined className="text-[#484f58]" />}
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索信号源..."
          className="flex-1 bg-[#0d1117] border-[#30363d] text-[#c9d1d9] text-xs" />
        <Select value={sortBy} onChange={setSortBy} size="small"
          className="w-28 [&_.ant-select-selector]:bg-[#0d1117] [&_.ant-select-selector]:border-[#30363d] [&_.ant-select-selection-item]:text-[9px]"
          options={[
            { value: 'totalReturn', label: '收益' },
            { value: 'winRate', label: '胜率' },
            { value: 'sharpeRatio', label: '夏普' },
            { value: 'followers', label: '关注' },
            { value: 'fee', label: '费率' },
          ]} />
        <Select value={riskFilter} onChange={setRiskFilter} size="small"
          className="w-20 [&_.ant-select-selector]:bg-[#0d1117] [&_.ant-select-selector]:border-[#30363d] [&_.ant-select-selection-item]:text-[9px]"
          options={[
            { value: 'all', label: '全部' },
            { value: 'low', label: '低风险' },
            { value: 'medium', label: '中风险' },
            { value: 'high', label: '高风险' },
          ]} />
      </div>

      {/* Provider list */}
      <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
        {sorted.map(p => {
          const isFollowed = following.has(p.id);
          const isSelected = selectedProvider?.id === p.id;

          return (
            <div key={p.id}
              onClick={() => setSelectedProvider(isSelected ? null : p)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded border cursor-pointer transition-all ${isSelected ? 'bg-[#161b22] border-[#30363d]' : 'bg-[#0d1117] border-[#1c2333] hover:border-[#30363d]'}`}
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded bg-[#161b22] flex items-center justify-center text-xs font-bold text-[#c9d1d9] shrink-0 border border-[#30363d]">
                {p.avatar}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[#c9d1d9] text-xs font-bold">{p.name}</span>
                  {p.verified && <SafetyCertificateOutlined className="text-[#3b82f6] text-[10px]" title="已验证" />}
                  <Tag className="text-[6px] leading-none px-1" color={p.riskLevel === 'low' ? 'green' : p.riskLevel === 'medium' ? 'orange' : 'red'}>{p.riskLevel === 'low' ? '低' : p.riskLevel === 'medium' ? '中' : '高'}</Tag>
                </div>
                <div className="text-[8px] text-[#8b949e] mt-0.5 truncate">{p.strategy}</div>
                <div className="flex items-center gap-2 mt-0.5 text-[8px]">
                  <span className="text-[#22c55e]">+{p.totalReturn}%</span>
                  <span className="text-[#c9d1d9]">{p.winRate}%胜率</span>
                  <span className="text-[#c9d1d9]">夏普{p.sharpeRatio}</span>
                  <span className="text-[#f59e0b]">{p.fee}%分润</span>
                </div>
              </div>

              {/* Followers + Follow */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="text-[8px] text-[#484f58]">{p.followers.toLocaleString()} 关注</div>
                <Tooltip title={isFollowed ? '取消关注' : '关注信号源'}>
                  <Button size="small" type="text"
                    icon={isFollowed ? <StarFilled className="text-[#f59e0b] text-xs" /> : <StarOutlined className="text-[#484f58] text-xs" />}
                    onClick={(e) => { e.stopPropagation(); toggleFollow(p.id); }} />
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected provider detail */}
      {selectedProvider && (
        <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded bg-[#161b22] flex items-center justify-center text-sm font-bold text-[#c9d1d9] border border-[#30363d]">{selectedProvider.avatar}</div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-[#e6edf3] text-sm font-bold">{selectedProvider.name}</span>
                {selectedProvider.verified && <SafetyCertificateOutlined className="text-[#3b82f6] text-xs" />}
              </div>
              <div className="text-[#8b949e] text-[9px]">{selectedProvider.exchange} · {selectedProvider.strategy}</div>
            </div>
          </div>

          <p className="text-[#8b949e] text-[10px] leading-relaxed mb-2">{selectedProvider.description}</p>

          <div className="grid grid-cols-3 gap-2 text-[9px] mb-2">
            <div className="px-2 py-1 bg-[#161b22] rounded text-center">
              <div className="text-[#8b949e]">收益</div><div className="text-[#22c55e] font-bold">+{selectedProvider.totalReturn}%</div>
            </div>
            <div className="px-2 py-1 bg-[#161b22] rounded text-center">
              <div className="text-[#8b949e]">回撤</div><div className="text-[#ef4444] font-bold">{selectedProvider.maxDrawdown}%</div>
            </div>
            <div className="px-2 py-1 bg-[#161b22] rounded text-center">
              <div className="text-[#8b949e]">分润</div><div className="text-[#f59e0b] font-bold">{selectedProvider.fee}%</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="small" type="primary" className="text-[10px] bg-[#3b82f6]">开始跟单</Button>
            <Button size="small" onClick={() => toggleFollow(selectedProvider.id)} className="text-[10px]">
              {following.has(selectedProvider.id) ? '取消关注' : '关注'}
            </Button>
            <span className="text-[8px] text-[#484f58] self-center ml-auto">最低 {selectedProvider.minAmount} USDT</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SignalProviderManage;
