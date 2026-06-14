// ── R184 ML P0-03: FactorMarketSwitch — 市场自动切换框架 ─────────────────
// Auto-switch factor library based on selected market: 🇺🇸 US / 🇭🇰 HK / 🪙 Crypto.
// Each market gets its own factor set with different defaults and priorities.
// Markets that share factors (e.g. MOM_12M across all) show once with a
// "cross-market" badge.
//
// Design: Horizontal tab bar with market flag + count + active accent.
// Colors: US=blue, HK=red, Crypto=orange — distinct and recognizable.

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type FactorMarket = 'US' | 'HK' | 'CRYPTO' | 'ALL';

export interface MarketInfo {
  id: FactorMarket;
  label: string;
  labelCN: string;
  flag: string;
  color: string;
  bgColor: string;
  description: string;
  descriptionCN: string;
  /** How many factors are specific to this market (excluding cross-market shared) */
  exclusiveCount: number;
  /** How many factors total (including cross-market) */
  totalCount: number;
}

export interface FactorMarketSwitchProps {
  /** Currently active market */
  activeMarket: FactorMarket;
  /** Called when user switches market */
  onMarketChange: (market: FactorMarket) => void;
  /** Factor counts per market */
  counts?: Partial<Record<FactorMarket, { exclusive: number; total: number }>>;
  /** Show compact mode (flags only) */
  compact?: boolean;
  /** Additional class */
  className?: string;
}

// ── Market Configuration ─────────────────────────────────────────────────────

export const MARKETS: Record<FactorMarket, MarketInfo> = {
  ALL: {
    id: 'ALL',
    label: 'All Markets',
    labelCN: '🌏 全部市场',
    flag: '🌏',
    color: '#9ca3af',
    bgColor: 'rgba(156,163,175,0.10)',
    description: 'All factors across US, HK, and Crypto markets. Best for cross-market strategies.',
    descriptionCN: '覆盖美股、港股、加密货币的全部因子。适合跨市场策略。',
    exclusiveCount: 0,
    totalCount: 114,
  },
  US: {
    id: 'US',
    label: 'US Stocks',
    labelCN: '🇺🇸 美股',
    flag: '🇺🇸',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.10)',
    description: 'US stock factors: earnings, insider, VIX, options flow, institutional holdings.',
    descriptionCN: '美股专有因子：财报、内部人、VIX、期权流、机构持仓。',
    exclusiveCount: 25,
    totalCount: 50,
  },
  HK: {
    id: 'HK',
    label: 'HK Stocks',
    labelCN: '🇭🇰 港股',
    flag: '🇭🇰',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.10)',
    description: 'HK stock factors: southbound flow, AH premium, warrant IV, dividend tax.',
    descriptionCN: '港股专有因子：南向资金、AH溢价、窝轮IV、红利税。',
    exclusiveCount: 20,
    totalCount: 45,
  },
  CRYPTO: {
    id: 'CRYPTO',
    label: 'Crypto',
    labelCN: '🪙 加密货币',
    flag: '🪙',
    color: '#f97316',
    bgColor: 'rgba(249,115,22,0.10)',
    description: 'Crypto factors: on-chain metrics, funding rate, exchange flows, MVRV, SOPR.',
    descriptionCN: '加密专有因子：链上指标、资金费率、交易所流、MVRV、SOPR。',
    exclusiveCount: 25,
    totalCount: 55,
  },
};

const LOCAL_STORAGE_KEY = 'tradingeasy-factor-market';

// ── Market Tab ───────────────────────────────────────────────────────────────

const MarketTab: React.FC<{
  info: MarketInfo;
  isActive: boolean;
  exclusiveCount: number;
  totalCount: number;
  onClick: () => void;
  compact?: boolean;
}> = ({ info, isActive, exclusiveCount, totalCount, onClick, compact }) => {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300
        ${isActive
          ? 'border-white/20 shadow-lg'
          : 'border-white/5 hover:border-white/10 hover:bg-white/[0.03]'
        }
      `}
      style={{
        backgroundColor: isActive ? info.bgColor : 'transparent',
        boxShadow: isActive ? `0 0 16px ${info.color}10` : 'none',
      }}
    >
      {/* Market flag */}
      <span className="text-lg flex-shrink-0">{info.flag}</span>

      {/* Label */}
      <div className="text-left">
        <div className="flex items-center gap-1.5">
          <span
            className="text-sm font-bold transition-colors"
            style={{ color: isActive ? info.color : '#9ca3af' }}
          >
            {info.labelCN}
          </span>
        </div>
        {!compact && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-600 font-mono">
              {totalCount} 因子
            </span>
            {exclusiveCount > 0 && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: isActive ? info.color + '15' : 'transparent',
                  color: isActive ? info.color : '#6b7280',
                  border: `1px solid ${info.color}20`,
                }}
              >
                +{exclusiveCount} 专属
              </span>
            )}
          </div>
        )}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
          <div className="w-6 h-1 rounded-full" style={{ backgroundColor: info.color }} />
          <div className="w-2 h-1 rounded-full opacity-60" style={{ backgroundColor: info.color }} />
        </div>
      )}
    </button>
  );
};

// ── Cross-Market Badge ───────────────────────────────────────────────────────

export const CrossMarketBadge: React.FC<{
  markets: FactorMarket[];
}> = ({ markets }) => {
  if (markets.length <= 1) return null;

  const marketFlags: Record<string, string> = {
    US: '🇺🇸', HK: '🇭🇰', CRYPTO: '🪙',
  };

  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px]"
      style={{
        backgroundColor: 'rgba(212,168,83,0.15)',
        color: '#D4A853',
        border: '1px solid rgba(212,168,83,0.3)',
      }}
      title={`跨市场因子: ${markets.join(', ')}`}
    >
      🌐 {markets.map(m => marketFlags[m] || m).join('')}
    </span>
  );
};

// ── Hook: Get factors for a market ───────────────────────────────────────────

export interface FactorItem {
  id: string;
  nameCN: string;
  markets: FactorMarket[];
  level: 'L1' | 'L2' | 'L3';
}

export function useMarketFactors(
  factors: FactorItem[],
  activeMarket: FactorMarket
): { visible: FactorItem[]; total: number; exclusive: number } {
  return useMemo(() => {
    if (activeMarket === 'ALL') {
      return { visible: factors, total: factors.length, exclusive: 0 };
    }
    const filtered = factors.filter(
      f => f.markets.includes(activeMarket) || f.markets.includes('ALL' as FactorMarket)
    );
    const exclusive = factors.filter(
      f => f.markets.length === 1 && f.markets.includes(activeMarket)
    ).length;
    return { visible: filtered, total: filtered.length, exclusive };
  }, [factors, activeMarket]);
}

// ── Hook: Persist market selection ───────────────────────────────────────────

export function useFactorMarket(
  defaultMarket: FactorMarket = 'US'
): [FactorMarket, (market: FactorMarket) => void] {
  const [market, setMarket] = useState<FactorMarket>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved && ['US', 'HK', 'CRYPTO', 'ALL'].includes(saved)) {
        return saved as FactorMarket;
      }
    } catch { /* localStorage unavailable */ }
    return defaultMarket;
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, market);
    } catch { /* localStorage unavailable */ }
  }, [market]);

  return [market, setMarket];
}

// ── Component ────────────────────────────────────────────────────────────────

export const FactorMarketSwitch: React.FC<FactorMarketSwitchProps> = ({
  activeMarket,
  onMarketChange,
  counts,
  compact = false,
  className,
}) => {
  const markets: FactorMarket[] = ['US', 'HK', 'CRYPTO', 'ALL'];
  const activeInfo = MARKETS[activeMarket];

  return (
    <div className={`${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-300">因子市场</h3>
        {!compact && (
          <span className="text-[10px] text-gray-600">
            {activeInfo.descriptionCN.substring(0, 30)}...
          </span>
        )}
      </div>

      {/* Market tabs */}
      <div className="flex gap-2 flex-wrap">
        {markets.map((mk) => {
          const info = MARKETS[mk];
          const c = counts?.[mk] ?? { exclusive: info.exclusiveCount, total: info.totalCount };
          return (
            <MarketTab
              key={mk}
              info={info}
              isActive={mk === activeMarket}
              exclusiveCount={c.exclusive}
              totalCount={c.total}
              onClick={() => onMarketChange(mk)}
              compact={compact}
            />
          );
        })}
      </div>

      {/* Active market context banner */}
      {!compact && (
        <div
          className="mt-3 p-3 rounded-lg border transition-all"
          style={{
            backgroundColor: activeInfo.bgColor + '30',
            borderColor: activeInfo.color + '15',
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-xl flex-shrink-0">{activeInfo.flag}</span>
            <div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {activeInfo.descriptionCN}
              </p>
              <div className="flex gap-3 mt-1.5 text-[10px]">
                <span className="text-gray-500">
                  总因子: <span className="text-white font-mono font-bold">{activeInfo.totalCount}</span>
                </span>
                {activeInfo.exclusiveCount > 0 && (
                  <span className="text-gray-500">
                    市场专属: <span className="text-[#D4A853] font-mono font-bold">+{activeInfo.exclusiveCount}</span>
                  </span>
                )}
                <span className="text-gray-500">
                  跨市场共享: <span className="text-gray-400 font-mono">{activeInfo.totalCount - activeInfo.exclusiveCount}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FactorMarketSwitch;
