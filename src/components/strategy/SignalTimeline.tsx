/**
* SignalTimeline — ML R177 B7 [P0] 信号时间线交互
* Horizontal scrollable timeline showing factor signal changes over time
* Click signal → K-line chart jumps to that date + factor value linked highlight
*/

import { useState, useRef, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface SignalEvent {
  id: string;
  timestamp: string;   // ISO date
  date: string;         // display date "06-14"
  factorId: string;
  factorNameZh: string;
  type: 'entry' | 'exit' | 'alert' | 'rebalance' | 'decay';
  ic: number;
  signal: 'buy' | 'sell' | 'neutral';
  strength: number; // 0-1 signal confidence
  detail: string;
  klineDate?: string; // jump target date
}

interface SignalTimelineProps {
  events?: SignalEvent[];
  factorIds: string[];        // all factor IDs to track
  factorNames: Record<string, string>; // factorId→nameZh
  onJumpToKline?: (date: string) => void;
  onFactorHighlight?: (factorId: string | null) => void;
  dateRange?: { start: string; end: string };
  className?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────

const MOCK_EVENTS: SignalEvent[] = [
  { id: 'evt-1', timestamp: '2026-06-14T09:30:00', date: '06-14', factorId: 'market_beta', factorNameZh: '市场Beta', type: 'entry', ic: 0.055, signal: 'buy', strength: 0.88, detail: 'IC突破0.05阈值，做多信号触发', klineDate: '2026-06-14' },
  { id: 'evt-2', timestamp: '2026-06-13T14:00:00', date: '06-13', factorId: 'momentum_12m', factorNameZh: '12月动量', type: 'rebalance', ic: 0.045, signal: 'buy', strength: 0.75, detail: '权重从18%上调至22%，IC持续上行', klineDate: '2026-06-13' },
  { id: 'evt-3', timestamp: '2026-06-12T10:00:00', date: '06-12', factorId: 'low_vol', factorNameZh: '低波动', type: 'decay', ic: 0.018, signal: 'sell', strength: 0.62, detail: '衰减去到IC=0.018，触发减仓信号', klineDate: '2026-06-12' },
  { id: 'evt-4', timestamp: '2026-06-11T11:30:00', date: '06-11', factorId: 'value_ep', factorNameZh: '盈利收益率', type: 'alert', ic: 0.038, signal: 'neutral', strength: 0.45, detail: '价值因子与动量因子相关性升至0.68，拥挤预警', klineDate: '2026-06-11' },
  { id: 'evt-5', timestamp: '2026-06-10T09:45:00', date: '06-10', factorId: 'quality_roe', factorNameZh: 'ROE质量', type: 'entry', ic: 0.042, signal: 'buy', strength: 0.82, detail: '品质因子IC回升至0.042，新增做多信号', klineDate: '2026-06-10' },
  { id: 'evt-6', timestamp: '2026-06-09T15:00:00', date: '06-09', factorId: 'reversal_short', factorNameZh: '短期反转', type: 'exit', ic: 0.020, signal: 'sell', strength: 0.55, detail: '反转因子IC降至0.02，平仓信号', klineDate: '2026-06-09' },
  { id: 'evt-7', timestamp: '2026-06-08T10:15:00', date: '06-08', factorId: 'market_beta', factorNameZh: '市场Beta', type: 'rebalance', ic: 0.052, signal: 'buy', strength: 0.80, detail: 'Beta因子权重微调至20%保持均衡', klineDate: '2026-06-08' },
  { id: 'evt-8', timestamp: '2026-06-07T13:00:00', date: '06-07', factorId: 'size_small', factorNameZh: '小市值', type: 'alert', ic: 0.028, signal: 'neutral', strength: 0.35, detail: '小市值因子IC持续低于0.03，关注是否移除', klineDate: '2026-06-07' },
  { id: 'evt-9', timestamp: '2026-06-06T09:00:00', date: '06-06', factorId: 'momentum_12m', factorNameZh: '12月动量', type: 'entry', ic: 0.048, signal: 'buy', strength: 0.90, detail: '动量因子IC创2月新高，强烈做多信号', klineDate: '2026-06-06' },
  { id: 'evt-10', timestamp: '2026-06-05T14:30:00', date: '06-05', factorId: 'liquidity', factorNameZh: '流动性', type: 'decay', ic: 0.015, signal: 'sell', strength: 0.70, detail: '流动性因子衰减加速(λ=0.35)，触发清仓', klineDate: '2026-06-05' },
];

const MOCK_FACTOR_IDS = ['market_beta', 'momentum_12m', 'low_vol', 'value_ep', 'quality_roe', 'reversal_short', 'size_small', 'liquidity'];

const MOCK_FACTOR_NAMES: Record<string, string> = {
  market_beta: '市场Beta', momentum_12m: '12月动量', low_vol: '低波动',
  value_ep: '盈利收益率', quality_roe: 'ROE质量', reversal_short: '短期反转',
  size_small: '小市值', liquidity: '流动性',
};

// ── Signal badge ────────────────────────────────────────────────────────

function SignalBadge({ type }: { type: SignalEvent['type']; signal: SignalEvent['signal'] }) {
  const config: Record<string, { icon: string; color: string; bg: string; label: string }> = {
    entry: { icon: '🚀', color: 'text-green-400', bg: 'bg-green-500/10', label: '入场' },
    exit: { icon: '🚪', color: 'text-red-400', bg: 'bg-red-500/10', label: '出场' },
    alert: { icon: '⚠️', color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: '预警' },
    rebalance: { icon: '⚖️', color: 'text-blue-400', bg: 'bg-blue-500/10', label: '调仓' },
    decay: { icon: '📉', color: 'text-orange-400', bg: 'bg-orange-500/10', label: '衰减' },
  };
  const c = config[type] || config.alert;

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.color}`}>
      {c.icon} {c.label}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function SignalTimeline({
  events: propEvents,
  factorIds: propIds,
  factorNames: propNames,
  onJumpToKline,
  onFactorHighlight,
  className = '',
}: SignalTimelineProps) {
  const events = (propEvents && propEvents.length > 0) ? propEvents : MOCK_EVENTS;
  const factorIds = propIds.length > 0 ? propIds : MOCK_FACTOR_IDS;
  const factorNames = Object.keys(propNames).length > 0 ? propNames : MOCK_FACTOR_NAMES;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeEvent, setActiveEvent] = useState<string | null>(null);
  const [filterFactor, setFilterFactor] = useState<string | null>(null);
  const [hoveredFactor, setHoveredFactor] = useState<string | null>(null);

  const handleEventClick = useCallback(
    (evt: SignalEvent) => {
      setActiveEvent(evt.id);
      onJumpToKline?.(evt.klineDate || evt.timestamp.split('T')[0]);
      onFactorHighlight?.(evt.factorId);
    },
    [onJumpToKline, onFactorHighlight]
  );

  // Filter events
  const filtered = filterFactor ? events.filter((e) => e.factorId === filterFactor) : events;

  return (
    <div className={`bg-[#0D0D14] flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">📡 因子信号时间线</h3>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-gray-500">{events.length} 个信号</span>
            {filterFactor && (
              <button
                onClick={() => setFilterFactor(null)}
                className="text-[#D4A853] hover:underline"
              >
                清除筛选
              </button>
            )}
          </div>
        </div>

        {/* Factor filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {factorIds.map((fid) => (
            <button
              key={fid}
              onClick={() => {
                setFilterFactor(filterFactor === fid ? null : fid);
                onFactorHighlight?.(filterFactor === fid ? null : fid);
              }}
              onMouseEnter={() => setHoveredFactor(fid)}
              onMouseLeave={() => setHoveredFactor(null)}
              className={`px-2 py-1 rounded text-[10px] whitespace-nowrap transition-all border ${
                filterFactor === fid
                  ? 'bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/30'
                  : hoveredFactor === fid
                  ? 'bg-white/[0.04] text-gray-300 border-white/10'
                  : 'bg-white/[0.02] text-gray-500 border-transparent'
              }`}
            >
              {factorNames[fid] || fid}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline — horizontal scroll on mobile, list on desktop */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-auto"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="min-w-[600px]">
          {/* Timeline header */}
          <div className="sticky top-0 bg-[#0D0D14] z-10 flex border-b border-white/5 px-4 py-2 text-[10px] text-gray-500">
            <span className="w-16">日期</span>
            <span className="w-20">因子</span>
            <span className="w-16">类型</span>
            <span className="w-20 text-right">IC</span>
            <span className="w-20">信号</span>
            <span className="flex-1">详情</span>
          </div>

          {/* Events */}
          {filtered.map((evt) => (
            <div
              key={evt.id}
              onClick={() => handleEventClick(evt)}
              onMouseEnter={() => onFactorHighlight?.(evt.factorId)}
              onMouseLeave={() => onFactorHighlight?.(null)}
              className={`flex items-center px-4 py-2.5 border-b border-white/5 cursor-pointer transition-all text-xs ${
                activeEvent === evt.id
                  ? 'bg-[#D4A853]/10 border-l-2 border-l-[#D4A853]'
                  : hoveredFactor === evt.factorId
                  ? 'bg-white/[0.02]'
                  : 'hover:bg-white/[0.02]'
              }`}
            >
              {/* Date */}
              <span className="w-16 text-gray-400 font-mono">{evt.date}</span>

              {/* Factor name */}
              <span className={`w-20 truncate ${hoveredFactor === evt.factorId ? 'text-[#D4A853]' : 'text-gray-300'}`}>
                {evt.factorNameZh}
              </span>

              {/* Type badge */}
              <span className="w-16">
                <SignalBadge type={evt.type} signal={evt.signal} />
              </span>

              {/* IC */}
              <span className={`w-20 text-right font-mono ${evt.ic >= 0.04 ? 'text-green-400' : evt.ic >= 0.03 ? 'text-yellow-400' : 'text-gray-400'}`}>
                {evt.ic >= 0 ? '+' : ''}{evt.ic.toFixed(3)}
              </span>

              {/* Signal icon */}
              <span className="w-20">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    evt.signal === 'buy'
                      ? 'bg-green-500/10 text-green-400'
                      : evt.signal === 'sell'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-gray-500/10 text-gray-400'
                  }`}
                >
                  {evt.signal === 'buy' ? '▲' : evt.signal === 'sell' ? '▼' : '─'}
                  {evt.signal === 'buy' ? '买入' : evt.signal === 'sell' ? '卖出' : '中性'}
                </span>
                {/* Strength bar */}
                <div className="w-16 bg-white/5 rounded-full h-1 mt-1">
                  <div
                    className={`h-1 rounded-full ${
                      evt.strength >= 0.8 ? 'bg-green-400' : evt.strength >= 0.6 ? 'bg-yellow-400' : 'bg-gray-400'
                    }`}
                    style={{ width: `${evt.strength * 100}%` }}
                  />
                </div>
              </span>

              {/* Detail */}
              <span className="flex-1 text-gray-500 truncate ml-2">{evt.detail}</span>

              {/* Jump icon */}
              <span className="text-gray-600 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <span className="text-3xl mb-2">📡</span>
              <span className="text-sm">暂无信号</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer legend */}
      <div className="p-3 border-t border-white/5 flex items-center gap-4 text-[9px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          买入
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          卖出
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          预警
        </span>
        <span>· 点击跳转K线</span>
        <span>· 点击因子筛选</span>
      </div>
    </div>
  );
}
