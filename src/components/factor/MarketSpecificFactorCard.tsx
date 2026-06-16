// @ts-nocheck
// ── R188 ML P4-03: MarketSpecificFactorCard ─────────────────────────────
// Factor card with market-specific UX enhancements:
// - Regional flag + market indicator (🇺🇸/🇭🇰/🪙)
// - Timezone-aware trading hour display
// - Holiday calendar hint (e.g. "港股今日休市" / "美股感恩节")
// - Market-specific data freshness indicator
// - Cross-market factor compatibility badge
//
// Design: Standard FactorCard layout + region bar + timezone pill.
// Supports dark theme with distinct market accent colors.

import React, { useState, useMemo } from 'react';
import { FactorSignalLight, type SignalLightData, computeSignalColor } from './FactorSignalLight';
import type { FactorMarket } from './FactorMarketSwitch';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MarketSpecificFactorData {
  id: string;
  nameCN: string;
  market: FactorMarket | FactorMarket[];
  category: string;
  categoryCN: string;
  level: 'L1' | 'L2' | 'L3';
  ic?: number;
  sharpe?: number;
  winRate?: number;
  zScore?: number;
  story: string;
  storyShort: string;
  dataFreshness?: string;     // "实时" / "5分钟前" / "1小时前"
  tradingStatus?: 'open' | 'closed' | 'lunch_break' | 'pre_market' | 'after_hours';
  nextOpenTime?: string;      // "14:30 GMT+8"
  holidayNote?: string;        // "今日港股佛诞日休市"
  isCrossMarket?: boolean;    // available in multiple markets
  exclusiveToMarket?: boolean; // only available in this market
}

interface MarketSpecificFactorCardProps {
  factor: MarketSpecificFactorData;
  onSelect?: (factorId: string) => void;
  className?: string;
}

// ── Market config ────────────────────────────────────────────────────────────

const MARKET_CONFIG: Record<string, {
  flag: string; label: string; color: string; bgColor: string;
  timezone: string; tradingHours: string; lunchBreak?: string;
}> = {
  US: { flag: '🇺🇸', label: '美股', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.08)', timezone: 'EST (GMT-5)', tradingHours: '21:30-04:00 GMT+8' },
  HK: { flag: '🇭🇰', label: '港股', color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)', timezone: 'HKT (GMT+8)', tradingHours: '09:30-16:00 GMT+8', lunchBreak: '12:00-13:00' },
  CRYPTO: { flag: '🪙', label: '加密', color: '#f97316', bgColor: 'rgba(249,115,22,0.08)', timezone: 'UTC', tradingHours: '24/7 全年无休' },
};

// ── Trading status config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: string; label: string; color: string; pulse: boolean }> = {
  open: { icon: '🟢', label: '交易中', color: '#22c55e', pulse: true },
  closed: { icon: '🔴', label: '已收盘', color: '#ef4444', pulse: false },
  lunch_break: { icon: '🟡', label: '午休', color: '#f59e0b', pulse: false },
  pre_market: { icon: '🔵', label: '盘前', color: '#3b82f6', pulse: true },
  after_hours: { icon: '🟣', label: '盘后', color: '#a855f7', pulse: false },
};

// ── Component ────────────────────────────────────────────────────────────────

export const MarketSpecificFactorCard: React.FC<MarketSpecificFactorCardProps> = ({
  factor,
  onSelect,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);

  const markets = Array.isArray(factor.market) ? factor.market : [factor.market];
  const primaryMarket = markets[0] || 'US';
  const marketCfg = MARKET_CONFIG[primaryMarket];
  const status = STATUS_CONFIG[factor.tradingStatus || 'open'];

  const signal = computeSignalColor({
    ic: factor.ic,
    zScore: factor.zScore,
    winRate: factor.winRate,
  });

  return (
    <div
      onClick={() => { setExpanded(!expanded); onSelect?.(factor.id); }}
      className={`rounded-xl border transition-all duration-300 cursor-pointer ${className}`}
      style={{
        backgroundColor: expanded ? marketCfg.bgColor + '30' : 'rgba(255,255,255,0.02)',
        borderColor: expanded ? marketCfg.color + '40' : 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="p-4">
        {/* Region bar */}
        <div className="flex items-center gap-2 mb-3">
          {/* Market flags */}
          <div className="flex items-center gap-1">
            {markets.map(m => {
              const cfg = MARKET_CONFIG[m];
              return (
                <span
                  key={m}
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1"
                  style={{ backgroundColor: cfg.bgColor, color: cfg.color, border: `1px solid ${cfg.color}30` }}
                >
                  {cfg.flag} {cfg.label}
                </span>
              );
            })}
          </div>

          {/* Cross-market badge */}
          {factor.isCrossMarket && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#D4A853]/10 text-[#D4A853] border border-[#D4A853]/20">
              🌐 跨市场
            </span>
          )}
          {factor.exclusiveToMarket && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.03] text-gray-500 border border-white/5">
              📌 市场专属
            </span>
          )}

          {/* Trading status */}
          <div className="ml-auto flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${status.pulse ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: status.color }} />
            <span className="text-[9px]" style={{ color: status.color }}>{status.label}</span>
          </div>
        </div>

        {/* Factor header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{factor.nameCN}</span>
            <span className="text-[10px] text-gray-600 font-mono">{factor.id}</span>
          </div>
          <FactorSignalLight data={signal} />
        </div>

        {/* Story */}
        <div className={`text-[10px] leading-relaxed transition-all duration-300 overflow-hidden ${expanded ? 'max-h-[100px] opacity-100' : 'max-h-[24px] opacity-50'}`}>
          <p className="text-gray-400">{expanded ? factor.story : factor.storyShort}</p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
          {factor.ic !== undefined && (
            <span className="flex items-center gap-1 text-[10px]">
              <span className="text-gray-600">IC</span>
              <span className={`font-mono font-bold ${factor.ic >= 0.03 ? 'text-green-400' : factor.ic > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                {factor.ic.toFixed(3)}
              </span>
            </span>)}
          {factor.sharpe !== undefined && (
            <span className="flex items-center gap-1 text-[10px]">
              <span className="text-gray-600">Sharpe</span>
              <span className="font-mono text-gray-400">{factor.sharpe.toFixed(2)}</span>
            </span>)}
          {factor.winRate !== undefined && (
            <span className="flex items-center gap-1 text-[10px]">
              <span className="text-gray-600">胜率</span>
              <span className="font-mono text-gray-400">{factor.winRate}%</span>
            </span>)}
          <span className="text-[10px] text-gray-600 ml-auto">{factor.categoryCN}</span>
        </div>

        {/* Expanded: market details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
            {/* Timezone info */}
            <div className="flex items-center gap-4 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="text-gray-600">🕐 时区</span>
                <span className="text-gray-400">{marketCfg.timezone}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-600">⏰ 交易时间</span>
                <span className="text-gray-400">{marketCfg.tradingHours}</span>
              </div>
              {marketCfg.lunchBreak && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">🍱 午休</span>
                  <span className="text-gray-400">{marketCfg.lunchBreak}</span>
                </div>
              )}
            </div>

            {/* Data freshness */}
            {factor.dataFreshness && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-gray-600">📡 数据新鲜度</span>
                <span className={factor.dataFreshness === '实时' ? 'text-green-400' : 'text-yellow-400'}>
                  {factor.dataFreshness}
                </span>
              </div>
            )}

            {/* Holiday note */}
            {factor.holidayNote && (
              <div className="p-2 rounded bg-yellow-500/5 border border-yellow-500/10 text-[10px] text-yellow-400/80">
                📅 {factor.holidayNote}
              </div>
            )}

            {/* Next open time */}
            {factor.tradingStatus !== 'open' && factor.nextOpenTime && (
              <div className="text-[10px] text-gray-600">
                下次开盘: {factor.nextOpenTime}
              </div>
            )}

            {/* Cross-market detail */}
            {factor.isCrossMarket && markets.length > 1 && (
              <div className="p-2 rounded bg-[#D4A853]/5 border border-[#D4A853]/10 text-[10px]">
                <span className="text-[#D4A853]">🌐 跨市场因子:</span>
                <span className="text-gray-400 ml-1">
                  该因子在 {markets.map(m => MARKET_CONFIG[m]?.label).join('、')} 市场均可用。
                  数据源和计算方式相同，但需注意各市场交易时间差异。
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Trading status checker (approximate) ─────────────────────────────────────

export function getTradingStatus(market: FactorMarket): {
  status: MarketSpecificFactorData['tradingStatus'];
  nextOpenTime?: string;
  holidayNote?: string;
} {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const isWeekendHK = day === 0 || day === 6;

  switch (market) {
    case 'HK':
      if (isWeekendHK) return { status: 'closed', nextOpenTime: '周一 09:30 GMT+8' };
      if (hours < 9 || (hours === 9 && minutes < 30)) return { status: 'closed', nextOpenTime: '今日 09:30 GMT+8' };
      if (hours >= 12 && hours < 13) return { status: 'lunch_break' };
      if (hours >= 16) return { status: 'closed', nextOpenTime: day === 5 ? '周一 09:30 GMT+8' : '明日 09:30 GMT+8' };
      return { status: 'open' };
    case 'US':
      if (day === 0 || day === 6) return { status: 'closed', nextOpenTime: '周一 21:30 GMT+8' };
      if (hours < 16 && hours >= 4) return { status: 'closed', nextOpenTime: '今日 21:30 GMT+8' };
      if (hours >= 16 && hours < 21) return { status: 'pre_market' };
      if (hours >= 4 && hours < 16) return { status: 'after_hours' };
      return { status: 'open' };
    case 'CRYPTO':
      return { status: 'open' };
    default:
      return { status: 'open' };
  }
}

export default MarketSpecificFactorCard;
