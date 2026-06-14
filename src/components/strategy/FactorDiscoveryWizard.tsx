/**
* FactorDiscoveryWizard — ML R175 F6 [P0] 智能因子筛选
* Compatible factors: green highlight | Incompatible: grey out + hover tooltip
* One-click "filter compatible only" toggle
*/

import { useState, useMemo, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface DiscoverableFactor {
  id: string;
  nameZh: string;
  nameEn: string;
  categoryZh: string;
  ic: number;
  ir: number;
  score: number;
  direction: 'long' | 'short';
  /** 0-1 compatibility with current portfolio composition */
  compatibility: number;
  /** Why incompatible, if score < 0.5 */
  incompatibilityReason?: string;
  /** Partner factors (negative correlation, complementary) */
  partners?: string[];
  /** Conflicting factors (too similar, redundant) */
  conflicts?: string[];
  /** Decay factor (0=none, 1=fully decayed) */
  decay?: number;
}

interface FactorDiscoveryWizardProps {
  factors: DiscoverableFactor[];
  /** Callback for when user selects a factor to add */
  onSelectFactor?: (factorId: string) => void;
  /** Callback for "add to portfolio" action */
  onAddToPortfolio?: (factorIds: string[]) => void;
  className?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────

const MOCK_DISCOVERABLE: DiscoverableFactor[] = [
  {
    id: 'momentum_12m', nameZh: '12月动量', nameEn: '12M Momentum', categoryZh: '动量',
    ic: 0.045, ir: 0.72, score: 82, direction: 'long',
    compatibility: 0.85,
    partners: ['value_ep', 'quality_roe'],
    conflicts: ['momentum_6m'],
    decay: 0.12,
  },
  {
    id: 'market_beta', nameZh: '市场Beta', nameEn: 'Market Beta', categoryZh: '风险',
    ic: 0.055, ir: 0.85, score: 88, direction: 'long',
    compatibility: 0.92,
    partners: ['low_vol', 'quality_roe'],
    conflicts: [],
    decay: 0.05,
  },
  {
    id: 'value_ep', nameZh: '盈利收益率', nameEn: 'Earnings Yield', categoryZh: '价值',
    ic: 0.038, ir: 0.61, score: 75, direction: 'long',
    compatibility: 0.78,
    partners: ['momentum_12m'],
    conflicts: ['value_bp'],
    decay: 0.20,
  },
  {
    id: 'quality_roe', nameZh: 'ROE质量', nameEn: 'ROE Quality', categoryZh: '品质',
    ic: 0.042, ir: 0.68, score: 79, direction: 'long',
    compatibility: 0.80,
    partners: ['low_vol', 'market_beta'],
    conflicts: [],
    decay: 0.08,
  },
  {
    id: 'low_vol', nameZh: '低波动', nameEn: 'Low Volatility', categoryZh: '波动',
    ic: 0.031, ir: 0.55, score: 68, direction: 'long',
    compatibility: 0.70,
    incompatibilityReason: '与当前高波动持仓风格不匹配',
    partners: ['quality_roe'],
    conflicts: ['high_beta'],
    decay: 0.15,
  },
  {
    id: 'size_small', nameZh: '小市值', nameEn: 'Small Size', categoryZh: '规模',
    ic: 0.028, ir: 0.42, score: 60, direction: 'long',
    compatibility: 0.55,
    incompatibilityReason: '当前组合以大市值为主，小市值因子冲突严重',
    partners: ['momentum_12m'],
    conflicts: ['size_large', 'market_beta'],
    decay: 0.25,
  },
  {
    id: 'reversal_short', nameZh: '短期反转', nameEn: 'Short-term Reversal', categoryZh: '动量',
    ic: 0.035, ir: 0.58, score: 65, direction: 'short',
    compatibility: 0.48,
    incompatibilityReason: '做空方向与当前多头组合冲突',
    partners: ['low_vol'],
    conflicts: ['momentum_12m', 'momentum_6m'],
    decay: 0.18,
  },
  {
    id: 'liquidity', nameZh: '流动性', nameEn: 'Liquidity', categoryZh: '流动性',
    ic: 0.025, ir: 0.38, score: 55, direction: 'long',
    compatibility: 0.40,
    incompatibilityReason: '流动性因子IC过低，不建议在当前市场环境配置',
    partners: [],
    conflicts: ['market_beta', 'low_vol'],
    decay: 0.35,
  },
  {
    id: 'momentum_6m', nameZh: '6月动量', nameEn: '6M Momentum', categoryZh: '动量',
    ic: 0.041, ir: 0.65, score: 78, direction: 'long',
    compatibility: 0.60,
    incompatibilityReason: '与12月动量高度相关(ρ=0.85)，冗余配置',
    partners: ['value_ep'],
    conflicts: ['momentum_12m'],
    decay: 0.10,
  },
  {
    id: 'value_bp', nameZh: '市净率', nameEn: 'Book-to-Price', categoryZh: '价值',
    ic: 0.033, ir: 0.50, score: 62, direction: 'long',
    compatibility: 0.35,
    incompatibilityReason: '与盈利收益率因子高度相关(ρ=0.78)，择一即可',
    partners: [],
    conflicts: ['value_ep', 'momentum_6m'],
    decay: 0.28,
  },
  {
    id: 'high_beta', nameZh: '高Beta', nameEn: 'High Beta', categoryZh: '风险',
    ic: 0.036, ir: 0.58, score: 70, direction: 'long',
    compatibility: 0.30,
    incompatibilityReason: '已配置市场Beta，高Beta因子冗余(ρ=0.92)',
    partners: ['momentum_12m'],
    conflicts: ['market_beta', 'low_vol'],
    decay: 0.14,
  },
  {
    id: 'size_large', nameZh: '大市值', nameEn: 'Large Size', categoryZh: '规模',
    ic: 0.020, ir: 0.35, score: 52, direction: 'long',
    compatibility: 0.65,
    incompatibilityReason: 'IC值偏低，预测能力弱',
    partners: ['low_vol'],
    conflicts: ['size_small'],
    decay: 0.22,
  },
];

// ── Compatibility color helper ─────────────────────────────────────────

function compatColor(score: number): { bg: string; border: string; text: string; label: string } {
  if (score >= 0.8) return { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', label: '最佳' };
  if (score >= 0.6) return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', label: '可用' };
  if (score >= 0.4) return { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', label: '留意' };
  return { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', label: '不兼容' };
}

// ── Factor card ─────────────────────────────────────────────────────────

function FactorDiscoveryCard({
  factor,
  isSelected,
  onSelect,
}: {
  factor: DiscoverableFactor;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const compat = compatColor(factor.compatibility);
  const isCompatible = factor.compatibility >= 0.6;
  const isGreyed = !isCompatible;
  const decayBad = (factor.decay ?? 0) > 0.2;

  return (
    <div
      className={`rounded-lg p-3 border transition-all cursor-pointer ${
        isSelected
          ? 'bg-[#D4A853]/10 border-[#D4A853]/30'
          : isGreyed
          ? 'bg-white/[0.01] border-white/5 opacity-50 hover:opacity-70'
          : 'bg-[#1a1a25] border-white/5 hover:border-[#C9A046]/20'
      }`}
      onClick={onSelect}
      title={isGreyed && factor.incompatibilityReason ? factor.incompatibilityReason : undefined}
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              isCompatible ? 'bg-[#D4A853]/10 text-[#D4A853]' : 'bg-gray-500/10 text-gray-500'
            }`}
          >
            {factor.categoryZh}
          </span>
          <span className={`text-sm font-medium ${isGreyed ? 'text-gray-500' : 'text-white'}`}>
            {factor.nameZh}
          </span>
        </div>
        {/* Compatibility badge */}
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${compat.bg} ${compat.border} ${compat.text}`}
        >
          {compat.label} {(factor.compatibility * 100).toFixed(0)}%
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px] mb-2">
        <span className={`${factor.ic >= 0.04 ? 'text-green-400' : 'text-yellow-400'}`}>
          IC {factor.ic >= 0 ? '+' : ''}{factor.ic.toFixed(3)}
        </span>
        <span className="text-gray-500">IR {factor.ir.toFixed(2)}</span>
        <span className={factor.direction === 'long' ? 'text-green-400' : 'text-red-400'}>
          {factor.direction === 'long' ? '做多' : '做空'}
        </span>
        {decayBad && <span className="text-orange-400">衰减 {((factor.decay ?? 0) * 100).toFixed(0)}%</span>}
      </div>

      {/* Incompatibility reason (tooltip on hover) */}
      {isGreyed && factor.incompatibilityReason && (
        <div className="bg-red-500/5 border border-red-500/10 rounded px-2 py-1 mb-1.5">
          <span className="text-[10px] text-red-400/80">⚠️ {factor.incompatibilityReason}</span>
        </div>
      )}

      {/* Partners / Conflicts */}
      {isCompatible && (factor.partners?.length || factor.conflicts?.length) && (
        <div className="flex items-center gap-2 text-[9px]">
          {factor.partners && factor.partners.length > 0 && (
            <span className="text-green-400/70">🤝 搭档: {factor.partners.length}个</span>
          )}
          {factor.conflicts && factor.conflicts.length > 0 && (
            <span className="text-red-400/70">⚠️ 冲突: {factor.conflicts.length}个</span>
          )}
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div className="mt-2 pt-2 border-t border-[#D4A853]/20">
          <span className="text-[10px] text-[#D4A853] font-medium">✓ 已选中</span>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function FactorDiscoveryWizard({
  factors: propFactors,
  onSelectFactor,
  onAddToPortfolio,
  className = '',
}: FactorDiscoveryWizardProps) {
  const factors = propFactors.length > 0 ? propFactors : MOCK_DISCOVERABLE;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showOnlyCompatible, setShowOnlyCompatible] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Categories from data
  const categories = useMemo(() => {
    const cats = new Set(factors.map((f) => f.categoryZh));
    return ['all', ...Array.from(cats)];
  }, [factors]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...factors];

    // search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (f) =>
          f.nameZh.includes(q) ||
          f.nameEn.toLowerCase().includes(q) ||
          f.categoryZh.includes(q) ||
          f.id.includes(q)
      );
    }

    // category
    if (categoryFilter !== 'all') {
      list = list.filter((f) => f.categoryZh === categoryFilter);
    }

    // compatibility filter
    if (showOnlyCompatible) {
      list = list.filter((f) => f.compatibility >= 0.6);
    }

    // sort: compatibility desc → ic desc
    list.sort((a, b) => {
      if (a.compatibility !== b.compatibility) return b.compatibility - a.compatibility;
      return b.ic - a.ic;
    });

    return list;
  }, [factors, searchTerm, categoryFilter, showOnlyCompatible]);

  const handleSelect = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      onSelectFactor?.(id);
    },
    [onSelectFactor]
  );

  const handleBulkToggle = useCallback(() => {
    // Select all currently visible compatible factors
    const visibleIds = filtered.map((f) => f.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = visibleIds.every((id) => next.has(id));
      if (allSelected) {
        // Deselect all visible
        visibleIds.forEach((id) => next.delete(id));
      } else {
        // Select all visible
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [filtered]);

  const stats = {
    total: factors.length,
    compatible: factors.filter((f) => f.compatibility >= 0.6).length,
    incompatible: factors.filter((f) => f.compatibility < 0.6).length,
  };

  return (
    <div className={`bg-[#0D0D14] flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <h3 className="text-lg font-semibold text-white mb-3">🧭 智能因子筛选</h3>

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索因子名称..."
              className="w-full pl-9 pr-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/50"
            />
          </div>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-gray-300"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? '全部类别' : c}
              </option>
            ))}
          </select>

          {/* Compatibility toggle */}
          <button
            onClick={() => setShowOnlyCompatible(!showOnlyCompatible)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              showOnlyCompatible
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'
            }`}
          >
            {showOnlyCompatible ? '✓ 仅显示兼容' : '显示全部'}
          </button>

          {/* Bulk select */}
          <button
            onClick={handleBulkToggle}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
          >
            {filtered.every((f) => selected.has(f.id)) ? '取消全选' : '全选可见'}
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 mt-2 text-[10px]">
          <span className="text-gray-500">
            共 <span className="text-white">{factors.length}</span> 个因子
          </span>
          <span className="text-green-400">
            ✓ <span className="font-semibold">{stats.compatible}</span> 兼容
          </span>
          <span className="text-red-400">
            ⚠ <span className="font-semibold">{stats.incompatible}</span> 不兼容
          </span>
          <span className="text-[#D4A853]">
            📌 <span className="font-semibold">{selected.size}</span> 已选
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-500">显示 {filtered.length} 个</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <span className="text-3xl mb-2">🔍</span>
            <span className="text-sm">没有找到匹配的因子</span>
            <span className="text-xs mt-1">尝试调整筛选条件或搜索词</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((f) => (
              <FactorDiscoveryCard
                key={f.id}
                factor={f}
                isSelected={selected.has(f.id)}
                onSelect={() => handleSelect(f.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {selected.size > 0 && (
        <div className="p-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-sm text-gray-400">
            已选择{' '}
            <span className="text-[#D4A853] font-semibold">{selected.size}</span>{' '}
            个因子
          </span>
          <button
            onClick={() => onAddToPortfolio?.(Array.from(selected))}
            className="px-4 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors"
          >
            添加到组合 →
          </button>
        </div>
      )}
    </div>
  );
}
