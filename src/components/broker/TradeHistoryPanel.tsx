// ── R132-M02 TradeHistory — 交易历史面板 ──────────────────────────────────
// @ts-nocheck — complex trade history panel with timeline view
// PM: 时间线 + 筛选 + 详情, 全量交易记录

import { useState, useMemo } from 'react';
import { Input, Select, Tag, Button, Tooltip, Timeline, Modal } from 'antd';
import { SearchOutlined, FilterOutlined, DollarOutlined, RiseOutlined, FallOutlined, CalendarOutlined, SwapOutlined } from '@ant-design/icons';

// ═══════════ Types ═══════════

interface TradeRecord {
  id: string;
  signalId: string;
  providerName: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  total: number;
  brokerName: string;
  status: 'filled' | 'failed' | 'retrying';
  pnl?: number;
  pnlPct?: number;
  fee: number;
  feeCurrency: string;
  slippage?: number;
  error?: string;
  createdAt: number;
  filledAt?: number;
}

// ═══════════ Mock data ═══════════

const MOCK_TRADES: TradeRecord[] = [
  { id: 't1', signalId: 's-001', providerName: 'AlphaQuant', symbol: 'BTC-USDT', side: 'buy', amount: 0.01, price: 97234, total: 972.34, brokerName: 'Binance', status: 'filled', pnl: 156.8, pnlPct: 1.62, fee: 2.1, feeCurrency: 'USDT', slippage: 0.02, createdAt: Date.now() - 3600000, filledAt: Date.now() - 3540000 },
  { id: 't2', signalId: 's-002', providerName: 'AlphaQuant', symbol: 'ETH-USDT', side: 'buy', amount: 0.5, price: 3821, total: 1910.5, brokerName: 'Binance', status: 'filled', pnl: -24.5, pnlPct: -1.28, fee: 1.8, feeCurrency: 'USDT', slippage: 0.05, createdAt: Date.now() - 7200000, filledAt: Date.now() - 7140000 },
  { id: 't3', signalId: 's-003', providerName: 'GoldenCross', symbol: 'SOL-USDT', side: 'sell', amount: 5, price: 187.5, total: 937.5, brokerName: 'OKX', status: 'filled', pnl: 42.1, pnlPct: 2.25, fee: 0.9, feeCurrency: 'USDT', slippage: 0.01, createdAt: Date.now() - 10800000, filledAt: Date.now() - 10740000 },
  { id: 't4', signalId: 's-004', providerName: 'AlphaQuant', symbol: 'BNB-USDT', side: 'buy', amount: 0.3, price: 612, total: 183.6, brokerName: 'Binance', status: 'failed', fee: 0, feeCurrency: 'USDT', error: 'Insufficient balance', createdAt: Date.now() - 14400000 },
  { id: 't5', signalId: 's-005', providerName: 'WhaleTracker', symbol: 'BTC-USDT', side: 'buy', amount: 0.02, price: 97150, total: 1943, brokerName: 'Binance', status: 'filled', pnl: 89.3, pnlPct: 4.60, fee: 1.5, feeCurrency: 'USDT', slippage: 0.03, createdAt: Date.now() - 18000000, filledAt: Date.now() - 17940000 },
  { id: 't6', signalId: 's-006', providerName: 'ScalperBot', symbol: 'DOGE-USDT', side: 'buy', amount: 5000, price: 0.172, total: 860, brokerName: 'Bybit', status: 'failed', fee: 0, feeCurrency: 'USDT', error: 'Rate limit exceeded', createdAt: Date.now() - 21600000 },
  { id: 't7', signalId: 's-007', providerName: 'TrendRider', symbol: 'ADA-USDT', side: 'sell', amount: 200, price: 0.89, total: 178, brokerName: 'Bitget', status: 'filled', pnl: -8.5, pnlPct: -4.78, fee: 0.2, feeCurrency: 'USDT', slippage: 0.1, createdAt: Date.now() - 25200000, filledAt: Date.now() - 25140000 },
  { id: 't8', signalId: 's-008', providerName: 'WhaleTracker', symbol: 'ETH-USDT', side: 'sell', amount: 0.3, price: 3850, total: 1155, brokerName: 'OKX', status: 'filled', pnl: 15.3, pnlPct: 1.33, fee: 1.1, feeCurrency: 'USDT', slippage: 0.02, createdAt: Date.now() - 86400000, filledAt: Date.now() - 86340000 },
];

// ═══════════ Helpers ═══════════

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

// ═══════════ Component ═══════════

export function TradeHistoryPanel() {
  const [trades] = useState<TradeRecord[]>(MOCK_TRADES);
  const [search, setSearch] = useState('');
  const [sideFilter, setSideFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'filled' | 'failed'>('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'time' | 'pnl' | 'amount'>('time');
  const [selectedTrade, setSelectedTrade] = useState<TradeRecord | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  const providers = useMemo(() =>
    [...new Set(trades.map(t => t.providerName))],
    [trades]
  );

  const filtered = useMemo(() => {
    let list = [...trades];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.symbol.toLowerCase().includes(q) || t.providerName.toLowerCase().includes(q));
    }
    if (sideFilter !== 'all') list = list.filter(t => t.side === sideFilter);
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter);
    if (providerFilter !== 'all') list = list.filter(t => t.providerName === providerFilter);

    if (sortBy === 'pnl') list.sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
    else if (sortBy === 'amount') list.sort((a, b) => b.total - a.total);
    else list.sort((a, b) => b.createdAt - a.createdAt);

    return list;
  }, [trades, search, sideFilter, statusFilter, providerFilter, sortBy]);

  // Stats
  const stats = useMemo(() => ({
    totalTrades: filtered.length,
    totalVolume: filtered.reduce((s, t) => s + t.total, 0),
    totalPnl: filtered.reduce((s, t) => s + (t.pnl || 0), 0),
    totalFees: filtered.reduce((s, t) => s + t.fee, 0),
    winRate: filtered.filter(t => t.status === 'filled').length > 0
      ? (filtered.filter(t => (t.pnl || 0) > 0).length / filtered.filter(t => t.status === 'filled').length * 100).toFixed(0)
      : '—',
  }), [filtered]);

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: 'monospace' }}>
      {/* Header + view toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-[#e6edf3] text-sm font-bold">交易历史</h3>
        <div className="flex gap-1">
          <button onClick={() => setViewMode('list')} className={`px-2 py-0.5 text-[8px] rounded ${viewMode === 'list' ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58]'}`}>列表</button>
          <button onClick={() => setViewMode('timeline')} className={`px-2 py-0.5 text-[8px] rounded ${viewMode === 'timeline' ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58]'}`}>时间线</button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2 text-[9px]">
        {[
          { label: '成交量', value: `$${stats.totalVolume.toLocaleString()}`, color: '#c9d1d9' },
          { label: '总收益', value: `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`, color: stats.totalPnl >= 0 ? '#22c55e' : '#ef4444' },
          { label: '手续费', value: `$${stats.totalFees.toFixed(2)}`, color: '#f59e0b' },
          { label: '胜率', value: `${stats.winRate}%`, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} className="px-2 py-1 bg-[#0d1117] border border-[#1c2333] rounded text-center">
            <div className="text-[#8b949e] text-[7px]">{s.label}</div>
            <div className="font-bold mt-0.5" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        <Input prefix={<SearchOutlined className="text-[#484f58]" />}
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索交易记录..."
          className="flex-1 bg-[#0d1117] border-[#30363d] text-[#c9d1d9] text-xs" />
        <Select value={sideFilter} onChange={setSideFilter} size="small"
          className="w-18 [&_.ant-select-selector]:bg-[#0d1117] [&_.ant-select-selector]:border-[#30363d] [&_.ant-select-selection-item]:text-[9px]"
          options={[{ value: 'all', label: '方向' }, { value: 'buy', label: '买入' }, { value: 'sell', label: '卖出' }]} />
        <Select value={statusFilter} onChange={setStatusFilter} size="small"
          className="w-18 [&_.ant-select-selector]:bg-[#0d1117] [&_.ant-select-selector]:border-[#30363d] [&_.ant-select-selection-item]:text-[9px]"
          options={[{ value: 'all', label: '状态' }, { value: 'filled', label: '成交' }, { value: 'failed', label: '失败' }]} />
        <Select value={providerFilter} onChange={setProviderFilter} size="small"
          className="w-20 [&_.ant-select-selector]:bg-[#0d1117] [&_.ant-select-selector]:border-[#30363d] [&_.ant-select-selection-item]:text-[9px]"
          options={[{ value: 'all', label: '信号源' }, ...providers.map(p => ({ value: p, label: p }))]} />
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
          {filtered.map(t => (
            <div key={t.id}
              onClick={() => setSelectedTrade(t)}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-[#0d1117] border border-[#1c2333] rounded hover:border-[#30363d] cursor-pointer transition-colors"
            >
              {/* Side */}
              <span className={`text-[10px] ${t.side === 'buy' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {t.side === 'buy' ? <RiseOutlined /> : <FallOutlined />}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[#c9d1d9] font-bold">{t.symbol}</span>
                  <Tag color={t.side === 'buy' ? 'green' : 'red'} className="text-[7px] leading-none px-1">{t.side === 'buy' ? '买' : '卖'}</Tag>
                  <Tag color={t.status === 'filled' ? 'green' : 'red'} className="text-[7px] leading-none px-1">{t.status === 'filled' ? '成交' : '失败'}</Tag>
                </div>
                <div className="flex items-center gap-1 text-[8px] text-[#484f58]">
                  <span>{t.providerName}</span><span>·</span>
                  <span>{t.brokerName}</span><span>·</span>
                  <span>{t.amount} @ {t.price.toFixed(t.price < 1 ? 4 : 2)}</span><span>·</span>
                  <span>{fmtDate(t.createdAt)}</span>
                </div>
              </div>

              {/* PnL */}
              <div className="text-right shrink-0">
                {t.pnl != null ? (
                  <>
                    <div className={`text-[10px] font-bold ${t.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                    </div>
                    <div className={`text-[8px] ${t.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {t.pnlPct != null ? `${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(2)}%` : ''}
                    </div>
                  </>
                ) : (
                  <Tag color="red" className="text-[7px]">失败</Tag>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-6 text-[#484f58] text-xs">无匹配记录</div>
          )}
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="max-h-96 overflow-y-auto px-2">
          <Timeline
            items={filtered.slice(0, 30).map(t => ({
              color: t.status === 'filled' ? (t.pnl && t.pnl >= 0 ? '#22c55e' : '#ef4444') : '#f59e0b',
              dot: t.status === 'filled' ? (t.pnl && t.pnl >= 0 ? <CheckCircleOutlined /> : <CloseCircleOutlined />) : <CloseCircleOutlined />,
              children: (
                <div className="flex flex-col gap-0.5 -mt-0.5" style={{ fontFamily: 'monospace' }}>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#c9d1d9] font-bold">{t.symbol}</span>
                    <Tag color={t.side === 'buy' ? 'green' : 'red'} className="text-[7px] leading-none px-1">{t.side === 'buy' ? '买' : '卖'}</Tag>
                    <span className="text-[9px] text-[#c9d1d9]">{t.amount} @ {t.price.toFixed(t.price < 1 ? 4 : 2)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[8px] text-[#484f58]">
                    <span>{t.providerName}</span><span>·</span><span>{t.brokerName}</span><span>·</span>
                    <span>{fmtTime(t.createdAt)}</span>
                  </div>
                  {t.pnl != null && (
                    <div className={`text-[9px] font-bold ${t.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)} USDT
                    </div>
                  )}
                  {t.error && <div className="text-[8px] text-[#ef4444]">{t.error}</div>}
                </div>
              ),
            }))}
          />
        </div>
      )}

      {/* Trade Detail Modal */}
      <Modal
        open={!!selectedTrade}
        onCancel={() => setSelectedTrade(null)}
        footer={<Button onClick={() => setSelectedTrade(null)} className="text-xs">关闭</Button>}
        title={<span className="text-[#e6edf3] text-xs font-mono">交易详情</span>}
        styles={{ content: { background: '#0d1117' }, header: { background: '#0d1117' } }}
      >
        {selectedTrade && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]" style={{ fontFamily: 'monospace' }}>
            <div className="text-[#8b949e]">订单ID</div><div className="text-[#c9d1d9] text-right font-mono">{selectedTrade.id}</div>
            <div className="text-[#8b949e]">信号ID</div><div className="text-[#c9d1d9] text-right font-mono">{selectedTrade.signalId}</div>
            <div className="text-[#8b949e]">标的</div><div className="text-[#c9d1d9] text-right">{selectedTrade.symbol}</div>
            <div className="text-[#8b949e]">方向</div><div className="text-right"><Tag color={selectedTrade.side === 'buy' ? 'green' : 'red'} className="text-[8px]">{selectedTrade.side === 'buy' ? '买入' : '卖出'}</Tag></div>
            <div className="text-[#8b949e]">数量</div><div className="text-[#c9d1d9] text-right">{selectedTrade.amount}</div>
            <div className="text-[#8b949e]">价格</div><div className="text-[#c9d1d9] text-right">${selectedTrade.price.toFixed(selectedTrade.price < 1 ? 4 : 2)}</div>
            <div className="text-[#8b949e]">总金额</div><div className="text-[#c9d1d9] text-right">${selectedTrade.total.toFixed(2)}</div>
            <div className="text-[#8b949e]">券商</div><div className="text-[#c9d1d9] text-right">{selectedTrade.brokerName}</div>
            <div className="text-[#8b949e]">信号源</div><div className="text-[#c9d1d9] text-right">{selectedTrade.providerName}</div>
            <div className="text-[#8b949e]">手续费</div><div className="text-[#f59e0b] text-right">{selectedTrade.fee.toFixed(2)} {selectedTrade.feeCurrency}</div>
            {selectedTrade.slippage != null && (<><div className="text-[#8b949e]">滑点</div><div className="text-[#c9d1d9] text-right">{selectedTrade.slippage}%</div></>)}
            <div className="text-[#8b949e]">创建时间</div><div className="text-[#c9d1d9] text-right">{fmtTime(selectedTrade.createdAt)}</div>
            {selectedTrade.filledAt && (<><div className="text-[#8b949e]">成交时间</div><div className="text-[#c9d1d9] text-right">{fmtTime(selectedTrade.filledAt)}</div></>)}
            {selectedTrade.pnl != null && (
              <>
                <div className="text-[#8b949e]">PnL</div>
                <div className={`text-right font-bold ${selectedTrade.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {selectedTrade.pnl >= 0 ? '+' : ''}${selectedTrade.pnl.toFixed(2)} ({selectedTrade.pnlPct?.toFixed(2)}%)
                </div>
              </>
            )}
            {selectedTrade.error && (
              <><div className="text-[#8b949e]">错误</div><div className="text-[#ef4444] text-right col-span-1">{selectedTrade.error}</div></>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TradeHistoryPanel;
