// ── R185 ML P1-03: EntryFactorGallery — 35入门因子卡片渲染集 ──────────
// Renders all 35 entry-level (🌱) factors with integrated signal lights,
// level badges, and story snippets. One-stop gallery for factor discovery.
//
// Integrates: FactorCard (level badge) + FactorSignalLight + story text.
// Each factor: name/ID/IC/signal/level/story/useCase/riskWarning.
// Categories: 通用(19) + 港股(5) + 美股(5) + 加密(6) + 跨市场(3) = 38 shown.

import React, { useState, useMemo } from 'react';
import { FactorSignalLight, computeSignalColor, type SignalColor, type SignalLightData } from './FactorSignalLight';
import type { FactorLevel } from './FactorLevelSelector';
import { FactorMarketSwitch, type FactorMarket, CrossMarketBadge } from './FactorMarketSwitch';

export interface EntryFactor {
  id: string;
  nameCN: string;
  category: string;
  categoryCN: string;
  level: FactorLevel;
  markets: FactorMarket[];
  ic?: number;
  zScore?: number;
  winRate?: number;
  isReversing?: boolean;
  dataPoints?: number;
  story: string;
  storyShort: string;
  useCase: string;
  riskWarning: string;
}

interface EntryFactorGalleryProps {
  factors: EntryFactor[];
  activeMarket: FactorMarket;
  onMarketChange: (market: FactorMarket) => void;
  searchQuery?: string;
  className?: string;
}

const FactorRow: React.FC<{ factor: EntryFactor }> = ({ factor }) => {
  const [expanded, setExpanded] = useState(false);
  const signal = useMemo<SignalLightData>(() =>
    computeSignalColor({ ic: factor.ic, zScore: factor.zScore, winRate: factor.winRate, isReversing: factor.isReversing, dataPoints: factor.dataPoints }),
    [factor.ic, factor.zScore, factor.winRate, factor.isReversing, factor.dataPoints]);

  return (
    <div className="group relative bg-white/[0.02] rounded-lg border border-white/5 hover:border-white/10 transition-all p-3"
      onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-white truncate">{factor.nameCN}</span>
          <span className="text-[10px] text-gray-600 font-mono">{factor.id}</span>
          <CrossMarketBadge markets={factor.markets as FactorMarket[]} />
        </div>
        <FactorSignalLight data={signal} animated={signal.color !== 'gray' && signal.color !== 'yellow'} />
      </div>
      <div className={`text-[10px] leading-relaxed transition-all duration-300 overflow-hidden ${expanded ? 'max-h-[120px] opacity-100' : 'max-h-[28px] opacity-50'}`}>
        <p className="text-gray-400">{expanded ? factor.story : factor.storyShort}</p>
      </div>
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
        {factor.ic !== undefined && (
          <span className="flex items-center gap-1 text-[10px]">
            <span className="text-gray-600">IC</span>
            <span className={`font-mono font-bold ${factor.ic >= 0.04 ? 'text-green-400' : factor.ic > 0 ? 'text-green-400/70' : 'text-red-400'}`}>{factor.ic.toFixed(3)}</span>
          </span>)}
        {factor.winRate !== undefined && (
          <span className="flex items-center gap-1 text-[10px]"><span className="text-gray-600">胜率</span>
            <span className="font-mono text-gray-400">{factor.winRate}%</span></span>)}
        <span className="text-[10px] text-gray-600 ml-auto">{factor.categoryCN}</span>
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-white/5 space-y-1.5 text-[10px]">
          <div className="flex justify-between"><span className="text-gray-500">适用场景</span><span className="text-gray-400 max-w-[180px] text-right">{factor.useCase}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">风险提示</span><span className="text-red-400/70 max-w-[180px] text-right">{factor.riskWarning}</span></div>
        </div>)}
    </div>);
};

const CategorySection: React.FC<{ title: string; titleCN: string; factors: EntryFactor[] }> = ({ title, titleCN, factors }) => {
  if (factors.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
        <span className="text-[10px] text-gray-600">{titleCN} · {factors.length}因子</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {factors.map(f => <FactorRow key={f.id} factor={f} />)}
      </div>
    </div>);
};

const CATEGORY_GROUPS = [
  { key: 'value', title: 'VALUE', titleCN: '价值' },
  { key: 'quality', title: 'QUALITY', titleCN: '品质' },
  { key: 'momentum', title: 'MOMENTUM', titleCN: '动量' },
  { key: 'volatility', title: 'VOLATILITY', titleCN: '低波/风控' },
  { key: 'sentiment', title: 'SENTIMENT', titleCN: '情绪/资金' },
  { key: 'technical', title: 'TECHNICAL', titleCN: '技术面' },
  { key: 'growth', title: 'GROWTH', titleCN: '成长' },
  { key: 'yield', title: 'YIELD', titleCN: '股息/收益' },
  { key: 'size', title: 'SIZE', titleCN: '规模' },
  { key: 'hk_specific', title: 'HK SPECIFIC', titleCN: '港股专属' },
  { key: 'us_specific', title: 'US SPECIFIC', titleCN: '美股专属' },
  { key: 'crypto', title: 'CRYPTO', titleCN: '加密货币' },
  { key: 'macro', title: 'MACRO', titleCN: '宏观/跨市场' },
];

export const EntryFactorGallery: React.FC<EntryFactorGalleryProps> = ({ factors, activeMarket, onMarketChange, searchQuery = '', className = '' }) => {
  const [showAll, setShowAll] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const marketFactors = useMemo(() =>
    activeMarket === 'ALL' ? factors : factors.filter(f => f.markets.includes(activeMarket)),
    [factors, activeMarket]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return marketFactors;
    const q = searchQuery.toLowerCase();
    return marketFactors.filter(f => f.nameCN.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.story.toLowerCase().includes(q));
  }, [marketFactors, searchQuery]);

  if (filtered.length === 0) {
    return (<div className={`text-center py-12 ${className}`}><div className="text-3xl mb-3">🔍</div><p className="text-sm text-gray-400">没有找到匹配的因子</p><p className="text-xs text-gray-600 mt-1">尝试切换市场或修改搜索关键词</p></div>);
  }

  return (
    <div className={className}>
      <div className="mb-4">
        <FactorMarketSwitch activeMarket={activeMarket} onMarketChange={onMarketChange}
          counts={{ US: { exclusive: 5, total: 25 }, HK: { exclusive: 5, total: 25 }, CRYPTO: { exclusive: 6, total: 25 }, ALL: { exclusive: 0, total: factors.length }}} compact />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button onClick={() => setActiveCategory(null)}
          className={`text-[10px] px-2 py-1 rounded-full transition-all ${activeCategory === null ? 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]/40' : 'bg-white/[0.03] text-gray-500 border border-white/5 hover:border-white/10'}`}>
          全部 ({filtered.length})</button>
        {CATEGORY_GROUPS.map(cat => {
          const count = filtered.filter(f => f.category === cat.key).length;
          if (count === 0) return null;
          return (<button key={cat.key} onClick={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
            className={`text-[10px] px-2 py-1 rounded-full transition-all ${activeCategory === cat.key ? 'bg-white/[0.08] text-white border border-white/20' : 'bg-white/[0.02] text-gray-500 border border-white/5 hover:border-white/10'}`}>
            {cat.title} ({count})</button>);
        })}</div>
      <div className="flex gap-2 mb-4">
        {[['green', '看好', 'text-green-400'], ['yellow', '中性', 'text-yellow-400'], ['red', '看空', 'text-red-400'], ['gray', '不足', 'text-gray-500']].map(([color, label, cls]) => {
          const signals = filtered.map(f => computeSignalColor({ ic: f.ic, zScore: f.zScore, winRate: f.winRate, isReversing: f.isReversing, dataPoints: f.dataPoints }));
          const count = signals.filter(s => s.color === color).length;
          return (<span key={color} className={`text-[10px] ${cls}`}><FactorSignalLight data={{ color: color as SignalColor, label: '' }} compact animated={false} /> {label}:{count}</span>);
        })}</div>
      {(activeCategory ? CATEGORY_GROUPS.filter(c => c.key === activeCategory) : CATEGORY_GROUPS).map(cat => (
        <CategorySection key={cat.key} title={cat.title} titleCN={cat.titleCN} factors={filtered.filter(f => f.category === cat.key)} />
      ))}
      {filtered.length > 0 && (
        <div className="text-center mt-4"><button onClick={() => setShowAll(!showAll)} className="text-[10px] text-gray-600 hover:text-gray-400">{showAll ? '收起所有故事' : '展开所有因子故事'}</button></div>)}
    </div>);
};

export default EntryFactorGallery;
