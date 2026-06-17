// ── R132-M03 PnLOverview — 收益概览面板 ──────────────────────────────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// @ts-nocheck — PnL sparkline + stats grid
// PM: 总/今日/本周/本月 + 收益曲线 + 盈亏比

import { useState, useMemo } from 'react';
import { Tag } from 'antd';
import { RiseOutlined, FallOutlined, DollarOutlined, CalendarOutlined, TrophyOutlined, ThunderboltOutlined } from '@ant-design/icons';

// ═══════════ Types ═══════════

interface PnLSummary {
  period: string;
  pnl: number;
  pnlPct: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  fees: number;
}

interface DailyPnL {
  date: string;
  pnl: number;
  trades: number;
}

// ═══════════ Mock data ═══════════

const MOCK_PNL_SUMMARY: Record<string, PnLSummary> = {
  today: { period: '今日', pnl: 156.8, pnlPct: 1.62, trades: 3, wins: 2, losses: 1, winRate: 66.7, avgWin: 98.4, avgLoss: -24.5, maxDrawdown: 0.3, fees: 3.9 },
  week: { period: '本周', pnl: 521.3, pnlPct: 5.23, trades: 12, wins: 8, losses: 4, winRate: 66.7, avgWin: 87.1, avgLoss: -33.8, maxDrawdown: 1.2, fees: 12.5 },
  month: { period: '本月', pnl: 2847.6, pnlPct: 28.5, trades: 47, wins: 31, losses: 16, winRate: 65.9, avgWin: 112.3, avgLoss: -41.6, maxDrawdown: 3.8, fees: 45.2 },
  total: { period: '总计', pnl: 12580.4, pnlPct: 125.8, trades: 284, wins: 183, losses: 101, winRate: 64.4, avgWin: 89.2, avgLoss: -38.5, maxDrawdown: 12.5, fees: 210.8 },
};

// 30-day daily PnL for the mini chart
const MOCK_DAILY_PNL: DailyPnL[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.now() - (29 - i) * 86400000);
  const pnl = (Math.random() - 0.35) * 200;
  return {
    date: d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
    pnl: +pnl.toFixed(2),
    trades: Math.floor(Math.random() * 5) + 1,
  };
});

// ═══════════ Mini SVG Sparkline ═══════════

function MiniSparkline({ data, width = 300, height = 60, color }: { data: number[]; width?: number; height?: number; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="shrink-0">
      {/* Grid */}
      <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#1c2333" strokeWidth={0.5} strokeDasharray="3,3" />
      {/* Area */}
      <polygon points={areaPoints} fill={`${color}15`} />
      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ═══════════ Component ═══════════

export function PnLOverview() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'total'>('today');
  const summary = MOCK_PNL_SUMMARY[period];
  const isPositive = summary.pnl >= 0;

  // Cumulative PnL for sparkline
  const cumulativeData = useMemo(() => {
    let cum = 0;
    return MOCK_DAILY_PNL.map(d => { cum += d.pnl; return cum; });
  }, []);

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <h3 className="text-[#e6edf3] text-sm font-bold">收益概览</h3>

      {/* Period selector */}
      <div className="flex gap-1">
        {(['today', 'week', 'month', 'total'] as const).map(p => (
          <button key={p}
            onClick={() => setPeriod(p)}
            className={`px-2 py-0.5 text-[9px] rounded transition-colors ${period === p ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58] hover:text-[#8b949e]'}`}
          >
            {p === 'today' ? '今日' : p === 'week' ? '本周' : p === 'month' ? '本月' : '总计'}
          </button>
        ))}
      </div>

      {/* Main PnL card */}
      <div className={`px-4 py-3 rounded-lg border ${isPositive ? 'bg-[#22c55e08] border-[#22c55e20]' : 'bg-[#ef444408] border-[#ef444420]'}`}>
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-[#8b949e] text-[10px] mb-1">{summary.period}收益</div>
            <div className={`text-2xl font-bold ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {isPositive ? '+' : ''}{summary.pnl.toFixed(2)}
              <span className="text-sm ml-1">USDT</span>
            </div>
            <div className={`text-xs mt-0.5 ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              <DollarOutlined /> {isPositive ? '+' : ''}{summary.pnlPct.toFixed(2)}%
            </div>
          </div>
          <div className="text-[10px] text-[#8b949e] text-right">
            <div>{summary.trades} 笔交易</div>
            <div>{summary.winRate.toFixed(1)}% 胜率</div>
          </div>
        </div>

        {/* Sparkline */}
        <MiniSparkline data={cumulativeData} width={300} height={50} color={isPositive ? '#22c55e' : '#ef4444'} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        {[
          { label: '盈利笔数', value: summary.wins, color: '#22c55e', icon: <RiseOutlined /> },
          { label: '亏损笔数', value: summary.losses, color: '#ef4444', icon: <FallOutlined /> },
          { label: '平均盈利', value: `$${summary.avgWin.toFixed(0)}`, color: '#22c55e', icon: <TrophyOutlined /> },
          { label: '平均亏损', value: `$${Math.abs(summary.avgLoss).toFixed(0)}`, color: '#ef4444', icon: <ThunderboltOutlined /> },
          { label: '最大回撤', value: `${summary.maxDrawdown}%`, color: '#f59e0b', icon: <FallOutlined /> },
          { label: '手续费', value: `$${summary.fees.toFixed(2)}`, color: '#8b949e', icon: <DollarOutlined /> },
        ].map(s => (
          <div key={s.label} className="px-2.5 py-1.5 bg-[#0d1117] border border-[#1c2333] rounded flex items-center gap-1.5">
            <span style={{ color: s.color }} className="text-[10px]">{s.icon}</span>
            <div>
              <div className="text-[#8b949e] text-[7px]">{s.label}</div>
              <div className="font-bold mt-0.5 text-[#c9d1d9]">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 4-period quick comparison */}
      <div className="grid grid-cols-4 gap-1.5">
        {Object.entries(MOCK_PNL_SUMMARY).map(([key, s]) => (
          <div key={key}
            onClick={() => setPeriod(key as any)}
            className={`px-2 py-1.5 bg-[#0d1117] border rounded cursor-pointer text-center transition-colors ${period === key ? 'border-[#3b82f6]' : 'border-[#1c2333] hover:border-[#30363d]'}`}
          >
            <div className="text-[7px] text-[#484f58]">{s.period}</div>
            <div className={`text-[10px] font-bold mt-0.5 ${s.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {s.pnl >= 0 ? '+' : ''}{s.pnl.toFixed(0)}
            </div>
            <div className={`text-[7px] ${s.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {s.pnlPct >= 0 ? '+' : ''}{s.pnlPct.toFixed(1)}%
            </div>
            <div className="text-[7px] text-[#484f58] mt-0.5">{s.trades}笔</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PnLOverview;
