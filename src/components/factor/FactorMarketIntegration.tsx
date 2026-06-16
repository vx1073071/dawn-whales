// @ts-nocheck
// ── R186 ML P2-01: FactorMarketIntegration — 市场自动切换集成 ─────────
// Integrates FactorMarketSwitch with EntryFactorGallery + ScenarioPackSelector.
// When user switches market (US/HK/Crypto/ALL), all factor cards and scenario
// packs auto-filter to show only relevant content.
//
// Smarts:
// - 选港股 → 只显示港股专属+通用因子，隐藏美股/加密专有
// - 选美股 → 只显示美股专属+通用因子
// - 选加密 → 只显示加密专属+通用因子+跨市场
// - 通用因子(MOM_12M/HML/QUAL等)在所有市场显示
// - Scenario packs also filtered by market eligibility

import React, { useState, useMemo, useCallback } from 'react';
import { FactorMarketSwitch, type FactorMarket, MARKETS, useFactorMarket } from './FactorMarketSwitch';
import { EntryFactorGallery, type EntryFactor } from './EntryFactorGallery';
import { ScenarioPackSelector, DEFAULT_SCENARIO_PACKS, type ScenarioPack } from './ScenarioPackSelector';

interface FactorMarketIntegrationProps {
  /** All entry factors */
  factors: EntryFactor[];
  /** All scenario packs */
  packs?: ScenarioPack[];
  /** Initial market */
  defaultMarket?: FactorMarket;
  /** Search query */
  searchQuery?: string;
  /** Called when a scenario pack is applied */
  onApplyPack?: (pack: ScenarioPack) => void;
  /** Show only gallery (no scenario packs) */
  galleryOnly?: boolean;
  /** Show only scenario packs (no gallery) */
  packsOnly?: boolean;
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export const FactorMarketIntegration: React.FC<FactorMarketIntegrationProps> = ({
  factors,
  packs = DEFAULT_SCENARIO_PACKS,
  defaultMarket = 'US',
  searchQuery: externalSearch = '',
  onApplyPack,
  galleryOnly = false,
  packsOnly = false,
  className = '',
}) => {
  const [market, setMarket] = useFactorMarket(defaultMarket);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(externalSearch);
  const [viewMode, setViewMode] = useState<'gallery' | 'packs'>('gallery');

  // Filter packs by market
  const marketPacks = useMemo(() => {
    if (market === 'ALL') return packs;
    return packs.filter(p => p.markets.some(m => m === market || m === 'ALL'));
  }, [packs, market]);

  // Factor count stats
  const stats = useMemo(() => {
    const marketFactors = market === 'ALL' ? factors : factors.filter(f => f.markets.includes(market));
    const exclusive = market === 'ALL' ? 0 : factors.filter(f => f.markets.length === 1 && f.markets.includes(market)).length;
    return { total: marketFactors.length, exclusive, shared: marketFactors.length - exclusive };
  }, [factors, market]);

  const handleMarketChange = useCallback((m: FactorMarket) => {
    setMarket(m);
  }, [setMarket]);

  const handleApplyPack = useCallback((pack: ScenarioPack) => {
    setActivePackId(pack.id);
    onApplyPack?.(pack);
  }, [onApplyPack]);

  const activeMarket = MARKETS[market];

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center flex-wrap gap-3 mb-4">
        <div className="flex-1">
          <FactorMarketSwitch
            activeMarket={market}
            onMarketChange={handleMarketChange}
            compact
            counts={{
              US: { exclusive: 5, total: 30 },
              HK: { exclusive: 5, total: 30 },
              CRYPTO: { exclusive: 6, total: 31 },
              ALL: { exclusive: 0, total: factors.length },
            }}
          />
        </div>

        {/* View toggle */}
        <div className="flex bg-white/[0.03] rounded-lg p-0.5 border border-white/5">
          <button
            onClick={() => setViewMode('gallery')}
            className={`px-3 py-1.5 rounded-md text-xs transition-all ${
              viewMode === 'gallery' ? 'bg-[#D4A853]/20 text-[#D4A853]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            📋 因子列表
          </button>
          <button
            onClick={() => setViewMode('packs')}
            className={`px-3 py-1.5 rounded-md text-xs transition-all ${
              viewMode === 'packs' ? 'bg-[#D4A853]/20 text-[#D4A853]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            🎯 场景包
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索因子（说人话）..."
            className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white w-[200px] focus:outline-none focus:border-[#D4A853]/30 placeholder-gray-600"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Market context banner */}
      {!galleryOnly && !packsOnly && (
        <div
          className="mb-4 p-3 rounded-lg border transition-all"
          style={{
            backgroundColor: activeMarket.bgColor + '20',
            borderColor: activeMarket.color + '15',
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">{activeMarket.flag}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{activeMarket.labelCN}</span>
                <span className="text-[10px] text-gray-600">
                  {stats.total} 因子可用 ({stats.exclusive} 专属 · {stats.shared} 共享)
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">{activeMarket.descriptionCN}</p>
            </div>
            <div className="text-right">
              {marketPacks.length > 0 && (
                <div className="text-[10px]">
                  <span className="text-gray-600">{marketPacks.length} 场景包</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content: Gallery or Packs */}
      {!packsOnly && (viewMode === 'gallery') && (
        <EntryFactorGallery
          factors={factors}
          activeMarket={market}
          onMarketChange={handleMarketChange}
          searchQuery={searchQuery}
        />
      )}

      {!galleryOnly && (viewMode === 'packs') && (
        <ScenarioPackSelector
          packs={marketPacks}
          activePackId={activePackId}
          onSelect={(p) => setActivePackId(p.id)}
          onApply={handleApplyPack}
        />
      )}

      {/* Quick stats footer */}
      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between text-[9px] text-gray-600">
        <span>当前市场: {activeMarket.flag} {activeMarket.labelCN}</span>
        <span>{stats.total} 因子 · {marketPacks.length} 场景包 · 免费</span>
        <span>数据实时更新</span>
      </div>
    </div>
  );
};

export default FactorMarketIntegration;
