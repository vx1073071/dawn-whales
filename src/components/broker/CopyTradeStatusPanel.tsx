// ── R131-M02 CopyTradeStatusPanel — Cloud跟单状态面板 ────────────────────
// @ts-nocheck — window.api contextBridge access
// PM: 执行中/成功/失败/重试, 实时状态流

import { useState } from 'react';
import { Tag, Tooltip, Button } from 'antd';
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, ClockCircleOutlined, SyncOutlined } from '@ant-design/icons';

// ═══════════ Types ═══════════

type TradeStatus = 'pending' | 'executing' | 'filled' | 'failed' | 'retrying' | 'skipped';

interface CopyTradeRecord {
  id: string;
  signalId: string;
  providerId: string;
  providerName: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  brokerId: string;
  brokerName: string;
  status: TradeStatus;
  pnl?: number;
  pnlPct?: number;
  fee?: number;
  slippage?: number;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

// ═══════════ Mock data ═══════════

const MOCK_RECORDS: CopyTradeRecord[] = [
  { id: 'ct1', signalId: 's-001', providerId: 'sp1', providerName: 'AlphaQuant', symbol: 'BTC-USDT', side: 'buy', amount: 0.01, price: 97234, brokerId: 'binance', brokerName: 'Binance', status: 'filled', pnl: 156.8, pnlPct: 1.62, fee: 2.1, slippage: 0.02, retryCount: 0, createdAt: Date.now() - 3600000, updatedAt: Date.now() - 1800000 },
  { id: 'ct2', signalId: 's-002', providerId: 'sp1', providerName: 'AlphaQuant', symbol: 'ETH-USDT', side: 'buy', amount: 0.5, price: 3821, brokerId: 'binance', brokerName: 'Binance', status: 'filled', pnl: -24.5, pnlPct: -1.28, fee: 1.8, slippage: 0.05, retryCount: 0, createdAt: Date.now() - 7200000, updatedAt: Date.now() - 5400000 },
  { id: 'ct3', signalId: 's-003', providerId: 'sp2', providerName: 'GoldenCross', symbol: 'SOL-USDT', side: 'sell', amount: 5, price: 187.5, brokerId: 'okx', brokerName: 'OKX', status: 'executing', retryCount: 0, createdAt: Date.now() - 300000, updatedAt: Date.now() - 60000 },
  { id: 'ct4', signalId: 's-004', providerId: 'sp1', providerName: 'AlphaQuant', symbol: 'BNB-USDT', side: 'buy', amount: 0.3, price: 612, brokerId: 'binance', brokerName: 'Binance', status: 'failed', error: 'Insufficient balance', retryCount: 2, createdAt: Date.now() - 3600000, updatedAt: Date.now() - 3000000 },
  { id: 'ct5', signalId: 's-005', providerId: 'sp3', providerName: 'ScalperBot', symbol: 'DOGE-USDT', side: 'buy', amount: 5000, price: 0.172, brokerId: 'bybit', brokerName: 'Bybit', status: 'retrying', retryCount: 1, createdAt: Date.now() - 1200000, updatedAt: Date.now() - 600000 },
  { id: 'ct6', signalId: 's-006', providerId: 'sp5', providerName: 'WhaleTracker', symbol: 'BTC-USDT', side: 'buy', amount: 0.02, price: 97150, brokerId: 'binance', brokerName: 'Binance', status: 'pending', retryCount: 0, createdAt: Date.now() - 60000, updatedAt: Date.now() - 60000 },
];

// ═══════════ Status helpers ═══════════

const STATUS_CONFIG: Record<TradeStatus, { color: string; icon: React.ReactNode; label: string }> = {
  pending:    { color: '#8b949e', icon: <ClockCircleOutlined />, label: '待处理' },
  executing:  { color: '#f59e0b', icon: <LoadingOutlined spin />, label: '执行中' },
  filled:     { color: '#22c55e', icon: <CheckCircleOutlined />, label: '已成交' },
  failed:     { color: '#ef4444', icon: <CloseCircleOutlined />, label: '失败' },
  retrying:   { color: '#f59e0b', icon: <SyncOutlined spin />, label: '重试中' },
  skipped:    { color: '#484f58', icon: <CloseCircleOutlined />, label: '已跳过' },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

// ═══════════ Component ═══════════

export function CopyTradeStatusPanel() {
  const [records] = useState<CopyTradeRecord[]>(MOCK_RECORDS);
  const [filter, setFilter] = useState<TradeStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filter === 'all' ? records : records.filter(r => r.status === filter);

  // Stats
  const stats = {
    total: records.length,
    filled: records.filter(r => r.status === 'filled').length,
    failed: records.filter(r => r.status === 'failed').length,
    executing: records.filter(r => r.status === 'executing' || r.status === 'retrying').length,
    totalPnl: records.reduce((sum, r) => sum + (r.pnl || 0), 0),
    totalFees: records.reduce((sum, r) => sum + (r.fee || 0), 0),
  };

  const handleRetry = (id: string) => {
    // @ts-expect-error window.api
    window.api?.copytrade?.retrySignal(id);
  };

  const handleSkip = (id: string) => {
    // @ts-expect-error window.api
    window.api?.copytrade?.skipSignal(id);
  };

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: 'monospace' }}>
      {/* Header + Summary */}
      <div className="flex items-center justify-between">
        <h3 className="text-[#e6edf3] text-sm font-bold">跟单状态</h3>
        <div className="flex items-center gap-2 text-[9px]">
          <Tooltip title="已成交">
            <Tag color="green">{stats.filled} ✅</Tag>
          </Tooltip>
          <Tooltip title="执行中">
            <Tag color="gold">{stats.executing} ⏳</Tag>
          </Tooltip>
          <Tooltip title="失败">
            <Tag color="red">{stats.failed} ❌</Tag>
          </Tooltip>
        </div>
      </div>

      {/* PnL summary */}
      <div className="grid grid-cols-3 gap-2 text-[9px]">
        <div className="px-2 py-1.5 bg-[#0d1117] border border-[#1c2333] rounded text-center">
          <div className="text-[#8b949e] mb-0.5">总收益</div>
          <div className={`font-bold ${stats.totalPnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)} USDT
          </div>
        </div>
        <div className="px-2 py-1.5 bg-[#0d1117] border border-[#1c2333] rounded text-center">
          <div className="text-[#8b949e] mb-0.5">手续费</div>
          <div className="text-[#c9d1d9] font-bold">{stats.totalFees.toFixed(2)} USDT</div>
        </div>
        <div className="px-2 py-1.5 bg-[#0d1117] border border-[#1c2333] rounded text-center">
          <div className="text-[#8b949e] mb-0.5">总订单</div>
          <div className="text-[#c9d1d9] font-bold">{stats.total}</div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1 flex-wrap">
        {([
          { key: 'all', label: '全部' },
          { key: 'executing', label: '执行中' },
          { key: 'filled', label: '已成交' },
          { key: 'failed', label: '失败' },
          { key: 'pending', label: '待处理' },
        ] as const).map(f => (
          <button key={f.key}
            onClick={() => setFilter(f.key === 'all' ? 'all' : f.key)}
            className={`px-2 py-0.5 text-[8px] rounded transition-colors ${filter === f.key || (f.key === 'all' && filter === 'all') ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58] hover:text-[#8b949e]'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Records list */}
      <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
        {filtered.map(r => {
          const statusCfg = STATUS_CONFIG[r.status];
          const isExpanded = expanded === r.id;

          return (
            <div key={r.id}
              className={`flex flex-col border rounded transition-colors cursor-pointer ${isExpanded ? 'bg-[#161b22] border-[#30363d]' : 'bg-[#0d1117] border-[#1c2333] hover:border-[#30363d]'}`}
              onClick={() => setExpanded(isExpanded ? null : r.id)}
            >
              {/* Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                {/* Status icon */}
                <Tooltip title={statusCfg.label}>
                  <span style={{ color: statusCfg.color }}>{statusCfg.icon}</span>
                </Tooltip>

                {/* Trade info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#c9d1d9] font-bold truncate">{r.symbol}</span>
                    <Tag color={r.side === 'buy' ? 'green' : 'red'} className="text-[7px] leading-none px-1">
                      {r.side === 'buy' ? '买入' : '卖出'}
                    </Tag>
                    <span className="text-[9px] text-[#c9d1d9] font-mono">{r.amount}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[8px] text-[#484f58]">
                    <span>{r.providerName}</span>
                    <span>·</span>
                    <span>{r.brokerName}</span>
                    <span>·</span>
                    <span>@{r.price.toFixed(r.price < 1 ? 4 : 2)}</span>
                    <span>·</span>
                    <span>{timeAgo(r.createdAt)}</span>
                    {r.retryCount > 0 && <span className="text-[#f59e0b]">· 重试{r.retryCount}次</span>}
                  </div>
                </div>

                {/* PnL */}
                {r.pnl != null && (
                  <div className={`text-[10px] font-bold text-right ${r.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {r.pnl >= 0 ? '+' : ''}{r.pnl.toFixed(2)}
                    <div className="text-[8px]">{r.pnlPct != null ? `${r.pnlPct >= 0 ? '+' : ''}${r.pnlPct.toFixed(2)}%` : ''}</div>
                  </div>
                )}
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-2 border-t border-[#1c2333] text-[9px]">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5">
                    <div className="flex justify-between"><span className="text-[#8b949e]">信号ID</span><span className="text-[#c9d1d9] font-mono">{r.signalId}</span></div>
                    <div className="flex justify-between"><span className="text-[#8b949e]">订单ID</span><span className="text-[#c9d1d9] font-mono">{r.id}</span></div>
                    {r.slippage != null && (
                      <div className="flex justify-between"><span className="text-[#8b949e]">滑点</span><span className="text-[#c9d1d9]">{r.slippage}%</span></div>
                    )}
                    {r.fee != null && (
                      <div className="flex justify-between"><span className="text-[#8b949e]">手续费</span><span className="text-[#c9d1d9]">{r.fee.toFixed(2)} USDT</span></div>
                    )}
                  </div>

                  {r.error && (
                    <div className="mt-1.5 px-2 py-1 bg-[#ef444410] border border-[#ef444430] rounded text-[8px] text-[#ef4444]">
                      {r.error}
                    </div>
                  )}

                  {/* Actions for failed/retrying */}
                  {(r.status === 'failed' || r.status === 'retrying') && (
                    <div className="flex gap-1 mt-1.5">
                      <Button size="small" icon={<ReloadOutlined />} onClick={(e) => { e.stopPropagation(); handleRetry(r.id); }} className="text-[9px]">重试</Button>
                      <Button size="small" danger onClick={(e) => { e.stopPropagation(); handleSkip(r.id); }} className="text-[9px]">跳过</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-6 text-[#484f58] text-xs">暂无跟单记录</div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-1 text-[8px] text-[#30363d]">
        <SyncOutlined spin className="text-[8px]" /> 每5秒自动刷新
      </div>
    </div>
  );
}

export default CopyTradeStatusPanel;
