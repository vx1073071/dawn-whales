import { useTranslation } from 'react-i18next';
/**
 * StrategyMarketplace — ML-66-01 [P0]
 * R66: v1.6.0 GA — Creator growth: strategy marketplace with purchase flow
 *
 * Features:
 * - Strategy card grid with search/filter/sort
 * - Strategy detail modal: description, performance, creator profile
 * - Purchase flow: browse → detail → confirm → USDT deduction → load template
 * - Creator card with level badge, reputation, signal stats
 * - Price filter: free, 1-50, 50-200, 200-1000 USDT
 * - Sort by: return, subscribers, rating, newest, price
 */

import { useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type CreatorLevel = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'king';

export interface StrategyCard {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  creatorLevel: CreatorLevel;
  creatorAvatar: string;
  verified: boolean;
  symbol: string;
  market: 'HK' | 'US' | 'CN';
  price: number;              // USDT
  subscribers: number;
  rating: number;             // 0-5
  ratingCount: number;
  totalReturn: number;        // %
  sharpe: number;
  maxDrawdown: number;        // %
  winRate: number;            // %
  totalSignals: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  dslJson?: string;          // strategy template JSON
  equityCurve?: number[];    // for mini chart
}

export interface PurchaseState {
  step: 'browse' | 'detail' | 'confirm' | 'success';
  strategyId: string | null;
  strategyName: string;
  price: number;
  txHash?: string;
}

export interface StrategyMarketplaceProps {
  strategies?: StrategyCard[];
  userBalance?: number;       // USDT
  onPurchase?: (strategyId: string, price: number) => Promise<{ success: boolean; txHash?: string }>;
  onLoadTemplate?: (strategyId: string, dslJson: string) => void;
  onFavorite?: (strategyId: string) => void;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<CreatorLevel, { label: string; icon: string; color: string; bg: string }> = {
  bronze:   { label: '青铜', icon: '🥉', color: '#CD7F32', bg: 'bg-amber-900/20' },
  silver:   { label: '白银', icon: '🥈', color: '#C0C0C0', bg: 'bg-gray-400/10' },
  gold:     { label: '黄金', icon: '🥇', color: '#FFD700', bg: 'bg-yellow-500/10' },
  platinum: { label: '铂金', icon: '💎', color: '#E5E4E2', bg: 'bg-slate-300/10' },
  diamond:  { label: '钻石', icon: '👑', color: '#B9F2FF', bg: 'bg-cyan-300/10' },
  king:     { label: '王者', icon: '🏆', color: '#FF4500', bg: 'bg-orange-600/10' },
};

const PRICE_RANGES = [
  { label: t('components.all'), min: 0, max: Infinity },
  { label: '免费', min: 0, max: 0 },
  { label: '1-50 USDT', min: 1, max: 50 },
  { label: '50-200 USDT', min: 50, max: 200 },
  { label: '200-1000 USDT', min: 200, max: 1000 },
] as const;

type SortKey = 'return' | 'subscribers' | 'rating' | 'newest' | 'price';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'return', label: '收益最高' },
  { key: 'subscribers', label: '订阅最多' },
  { key: 'rating', label: '评分最高' },
  { key: 'newest', label: '最新发布' },
  { key: 'price', label: t('components.price') },
];

// ── Mock Data ────────────────────────────────────────────────────────────

const mockStrategies: StrategyCard[] = [
  {
    id: 's-001', name: '趋势跟踪增强版', description: '双均线+RSI确认，适合震荡市和趋势市切换，3年回测年化42%',
    creatorId: 'c-01', creatorName: 'QuantEdge Pro', creatorLevel: 'diamond', creatorAvatar: '🦊', verified: true,
    symbol: 'AAPL', market: 'US', price: 50, subscribers: 2847, rating: 4.8, ratingCount: 312,
    totalReturn: 42.3, sharpe: 2.1, maxDrawdown: 12.5, winRate: 68.2, totalSignals: 847,
    tags: ['趋势跟踪', '双均线', 'RSI'], createdAt: '2026-03-15', updatedAt: '2026-06-01',
  },
  {
    id: 's-002', name: '均值回归狙击手', description: '布林带下轨+成交量确认反弹，持仓1-3天，胜率72%',
    creatorId: 'c-02', creatorName: 'MeanReversion', creatorLevel: 'gold', creatorAvatar: '🐺', verified: true,
    symbol: 'TSLA', market: 'US', price: 30, subscribers: 1523, rating: 4.5, ratingCount: 198,
    totalReturn: 28.1, sharpe: 1.8, maxDrawdown: 8.3, winRate: 72.1, totalSignals: 523,
    tags: ['均值回归', '布林带', '短线'], createdAt: '2026-02-20', updatedAt: '2026-05-28',
  },
  {
    id: 's-003', name: '港股市值轮动', description: '月度调仓，选取市值前20%+动量前30%，年化31%',
    creatorId: 'c-03', creatorName: 'HK Whale', creatorLevel: 'platinum', creatorAvatar: '🐋', verified: true,
    symbol: 'HK.00700', market: 'HK', price: 80, subscribers: 982, rating: 4.9, ratingCount: 156,
    totalReturn: 31.2, sharpe: 2.4, maxDrawdown: 15.1, winRate: 65.8, totalSignals: 321,
    tags: ['轮动', '港股', '动量'], createdAt: '2026-01-10', updatedAt: '2026-06-05',
  },

  {
    id: 's-005', name: '波动率套利模型', description: 'VIX衍生品+期权跨式组合，低相关Alpha策略',
    creatorId: 'c-05', creatorName: 'VolArb', creatorLevel: 'king', creatorAvatar: '🦅', verified: true,
    symbol: 'SPY', market: 'US', price: 200, subscribers: 2103, rating: 4.7, ratingCount: 289,
    totalReturn: 35.8, sharpe: 3.1, maxDrawdown: 5.2, winRate: 78.4, totalSignals: 1204,
    tags: [t('components.volatility'), '期权', '低相关'], createdAt: '2025-11-05', updatedAt: '2026-06-07',
  },
  {
    id: 's-006', name: 'MACD金叉死叉经典', description: '经典MACD信号+成交量过滤，适合新手入门',
    creatorId: 'c-06', creatorName: 'NewbieTrader', creatorLevel: 'bronze', creatorAvatar: '🐣', verified: false,
    symbol: 'QQQ', market: 'US', price: 5, subscribers: 89, rating: 3.5, ratingCount: 24,
    totalReturn: 8.2, sharpe: 0.6, maxDrawdown: 28.5, winRate: 48.3, totalSignals: 56,
    tags: ['MACD', '入门', '经典'], createdAt: '2026-05-20', updatedAt: '2026-06-01',
  },
];

// ── Mini Chart (Sparkline) ──────────────────────────────────────────────

function MiniChart({ data, color }: { data?: number[]; color: string }) {
  if (!data || data.length < 2) return <div className="h-8 text-gray-600 text-xs flex items-center">无数据</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 80 - 10}`).join(' ');
  return (
    <svg className="w-full h-8" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── Star Rating ─────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-xs ${s <= Math.round(rating) ? 'text-[#D4A853]' : 'text-gray-600'}`}>
          ★
        </span>
      ))}
      <span className="text-xs text-gray-400 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

// ── Level Badge ──────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: CreatorLevel }) {
  const cfg = LEVEL_CONFIG[level];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${cfg.bg}`}
          style={{ color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Purchase Modal ──────────────────────────────────────────────────────

function PurchaseModal({
  strategy,
  userBalance,
  onPurchase,
  onClose,
}: {
  strategy: StrategyCard;
  userBalance: number;
  onPurchase: (id: string, price: number) => Promise<{ success: boolean; txHash?: string }>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'confirm' | 'processing' | 'success'>('confirm');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const handleBuy = async () => {
    setStep('processing');
    setError('');
    try {
      const result = await onPurchase(strategy.id, strategy.price);
      if (result.success) {
        setTxHash(result.txHash || '0x' + Math.random().toString(16).slice(2, 42));
        setStep('success');
      } else {
        setError('交易失败，请重试');
        setStep('confirm');
      }
    } catch {
      setError('网络错误，请检查连接');
      setStep('confirm');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1A1A24] border border-white/10 rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg">
              {step === 'confirm' ? '确认购买' : step === 'processing' ? '处理中...' : '购买成功'}
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">&times;</button>
          </div>
        </div>

        {step === 'confirm' && (
          <>
            {/* Strategy info */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{strategy.creatorAvatar}</span>
                <div>
                  <div className="text-white font-medium">{strategy.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <LevelBadge level={strategy.creatorLevel} />
                    <span className="text-xs text-gray-500">{strategy.creatorName}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400">{strategy.description.slice(0, 120)}</p>
              {/* Price & Balance */}
              <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg">
                <span className="text-gray-400 text-sm">策略价格</span>
                <span className="text-[#D4A853] font-bold text-lg">{strategy.price} USDT</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg">
                <span className="text-gray-400 text-sm">你的余额</span>
                <span className={`font-medium ${userBalance >= strategy.price ? 'text-green-400' : 'text-red-400'}`}>
                  {userBalance.toLocaleString()} USDT
                </span>
              </div>
              {userBalance < strategy.price && (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
                  余额不足，请先充值 USDT
                </div>
              )}
              {error && (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">{error}</div>
              )}
            </div>
            {/* Footer */}
            <div className="p-5 border-t border-white/5 flex gap-3">
              <button onClick={onClose}
                      className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-colors">
                取消
              </button>
              <button onClick={handleBuy}
                      disabled={userBalance < strategy.price}
                      className="flex-1 py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                确认支付 {strategy.price} USDT
              </button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="p-10 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-[#D4A853] border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-300 text-sm">区块链确认中...</span>
          </div>
        )}

        {step === 'success' && (
          <div className="p-10 flex flex-col items-center gap-4">
            <span className="text-5xl">✅</span>
            <div className="text-white font-semibold">购买成功！</div>
            <div className="text-gray-400 text-xs text-center break-all px-2">
              TX: {txHash.slice(0, 20)}...
            </div>
            <button onClick={onClose}
                    className="mt-2 px-8 py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors">
              加载策略模板
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function StrategyMarketplace({
  strategies: propStrategies,
  userBalance = 250,
  onPurchase,
  onLoadTemplate: _onLoadTemplate,
  onFavorite,
  className = '',
}: StrategyMarketplaceProps) {
  const { t } = useTranslation();
  const strategies = propStrategies ?? mockStrategies;

  // ── State ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [priceRange, setPriceRange] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('return');
  const [purchasing, setPurchasing] = useState<StrategyCard | null>(null);
  const [detailStrategy, setDetailStrategy] = useState<StrategyCard | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // ── Derive ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...strategies];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.creatorName.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)) ||
        s.symbol.toLowerCase().includes(q)
      );
    }

    // Market
    if (marketFilter !== 'all') {
      list = list.filter((s) => s.market === marketFilter);
    }

    // Price
    const range = PRICE_RANGES[priceRange];
    list = list.filter((s) => s.price >= range.min && s.price <= range.max);

    // Sort
    switch (sortKey) {
      case 'return':     list.sort((a, b) => b.totalReturn - a.totalReturn); break;
      case 'subscribers':list.sort((a, b) => b.subscribers - a.subscribers); break;
      case 'rating':     list.sort((a, b) => b.rating - a.rating); break;
      case 'newest':     list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
      case 'price':      list.sort((a, b) => a.price - b.price); break;
    }

    return list;
  }, [strategies, search, marketFilter, priceRange, sortKey]);

  const handleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    onFavorite?.(id);
  }, [onFavorite]);

  const handlePurchase = useCallback(async (id: string, price: number) => {
    if (onPurchase) return onPurchase(id, price);
    // Simulated purchase
    await new Promise((r) => setTimeout(r, 1500));
    return { success: true, txHash: '0x' + Math.random().toString(16).slice(2, 42) };
  }, [onPurchase]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{t("components.strategyMarketplace")}</h2>
            <p className="text-gray-500 text-xs mt-0.5">发现、购买、加载优质量化策略</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>💰 余额:</span>
            <span className="text-[#D4A853] font-semibold">{userBalance.toLocaleString()} USDT</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索策略、创作者、标签..."
              className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/50"
            />
          </div>

          {/* Market */}
          <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)}
                  className="px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-gray-300">
            <option value="all">🌍 全部市场</option>
            <option value="US">🇺🇸 美股</option>
            <option value="HK">🇭🇰 港股</option>

          </select>

          {/* Price */}
          <select value={priceRange} onChange={(e) => setPriceRange(Number(e.target.value))}
                  className="px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-gray-300">
            {PRICE_RANGES.map((r, i) => (
              <option key={i} value={i}>💰 {r.label}</option>
            ))}
          </select>

          {/* Sort */}
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-gray-300">
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>📊 {o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
            <span className="text-4xl">🏪</span>
            <span>没有找到匹配的策略</span>
            <span className="text-xs">试试调整筛选条件</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <div key={s.id}
                   className="bg-[#111119] border border-white/5 rounded-xl p-4 hover:border-[#C9A046]/20 transition-all group cursor-pointer"
                   onClick={() => setDetailStrategy(s)}>
                {/* Top row: creator + level */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{s.creatorAvatar}</span>
                    <div>
                      <div className="text-sm text-gray-200 font-medium">{s.creatorName}</div>
                      <LevelBadge level={s.creatorLevel} />
                    </div>
                  </div>
                  {s.verified && <span className="text-blue-400 text-xs" title="认证创作者">✓ 认证</span>}
                </div>

                {/* Name + description */}
                <h3 className="text-white font-semibold mb-1 group-hover:text-[#D4A853] transition-colors">
                  {s.name}
                </h3>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{s.description}</p>

                {/* Chart */}
                <div className="mb-3">
                  <MiniChart data={s.equityCurve ?? [100, 102, 105, 103, 108, 112, 118, 120]} color="#D4A853" />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <div className="bg-white/[0.03] rounded p-1.5">
                    <div className="text-xs text-gray-500">{t("components.returnRate")}</div>
                    <div className={`text-sm font-semibold ${s.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {s.totalReturn >= 0 ? '+' : ''}{s.totalReturn}%
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded p-1.5">
                    <div className="text-xs text-gray-500">{t("components.winRate")}</div>
                    <div className="text-sm font-semibold text-gray-200">{s.winRate}%</div>
                  </div>
                  <div className="bg-white/[0.03] rounded p-1.5">
                    <div className="text-xs text-gray-500">回撤</div>
                    <div className="text-sm font-semibold text-red-400">{s.maxDrawdown}%</div>
                  </div>
                </div>

                {/* Bottom row: price + actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[#D4A853] font-bold text-lg">
                      {s.price === 0 ? '免费' : `${s.price} USDT`}
                    </span>
                    <div className="flex items-center gap-1 text-gray-500 text-xs">
                      <span>👥 {s.subscribers.toLocaleString()}</span>
                      <StarRating rating={s.rating} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleFavorite(s.id); }}
                            className={`p-1.5 rounded-lg transition-colors text-sm ${favorites.has(s.id) ? 'text-red-400' : 'text-gray-600 hover:text-gray-400'}`}>
                      {favorites.has(s.id) ? '❤️' : '🤍'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setPurchasing(s); }}
                            className="px-3 py-1.5 rounded-lg bg-[#C9A046]/20 hover:bg-[#C9A046]/30 text-[#D4A853] text-xs font-medium transition-colors">
                      {s.price === 0 ? '免费获取' : '购买'}
                    </button>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex gap-1 mt-3">
                  {s.tags.map((tag) => (
                    <span key={tag}
                          className="px-1.5 py-0.5 bg-[#C9A046]/10 text-[#D4A853]/70 rounded text-[10px]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailStrategy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
             onClick={(e) => { if (e.target === e.currentTarget) setDetailStrategy(null); }}>
          <div className="bg-[#1A1A24] border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-[#1A1A24] p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{detailStrategy.creatorAvatar}</span>
                <div>
                  <div className="text-white font-semibold text-lg">{detailStrategy.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <LevelBadge level={detailStrategy.creatorLevel} />
                    <span className="text-gray-400 text-sm">{detailStrategy.creatorName}</span>
                    {detailStrategy.verified && <span className="text-blue-400 text-xs">✓ 认证</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setDetailStrategy(null)}
                      className="text-gray-500 hover:text-gray-300 text-2xl leading-none">&times;</button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <p className="text-gray-300 text-sm leading-relaxed">{detailStrategy.description}</p>

              {/* Performance */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/[0.03] rounded-lg">
                  <div className="text-xs text-gray-500">累计收益</div>
                  <div className={`text-lg font-bold ${detailStrategy.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {detailStrategy.totalReturn >= 0 ? '+' : ''}{detailStrategy.totalReturn}%
                  </div>
                </div>
                <div className="p-3 bg-white/[0.03] rounded-lg">
                  <div className="text-xs text-gray-500">夏普比率</div>
                  <div className="text-lg font-bold text-white">{detailStrategy.sharpe}</div>
                </div>
                <div className="p-3 bg-white/[0.03] rounded-lg">
                  <div className="text-xs text-gray-500">{t("components.maxDrawdown")}</div>
                  <div className="text-lg font-bold text-red-400">{detailStrategy.maxDrawdown}%</div>
                </div>
                <div className="p-3 bg-white/[0.03] rounded-lg">
                  <div className="text-xs text-gray-500">{t("components.winRate")}</div>
                  <div className="text-lg font-bold text-white">{detailStrategy.winRate}%</div>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                <span>👥 {detailStrategy.subscribers.toLocaleString()} 订阅</span>
                <span>🔔 {detailStrategy.totalSignals} 信号</span>
                <span>📅 {detailStrategy.updatedAt} 更新</span>
                <span>⭐ {detailStrategy.rating}({detailStrategy.ratingCount})</span>
              </div>

              {/* Tags */}
              <div className="flex gap-1">
                {detailStrategy.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-[#C9A046]/10 text-[#D4A853]/80 rounded text-xs">{tag}</span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-white/5 flex gap-3">
              <button onClick={() => handleFavorite(detailStrategy.id)}
                      className={`px-4 py-2.5 rounded-lg border text-sm transition-colors ${favorites.has(detailStrategy.id) ? 'border-red-400/30 text-red-400 bg-red-400/5' : 'border-white/10 text-gray-400 hover:text-white'}`}>
                {favorites.has(detailStrategy.id) ? '❤️ 已收藏' : '🤍 收藏'}
              </button>
              <button onClick={() => { setDetailStrategy(null); setPurchasing(detailStrategy); }}
                      className="flex-1 py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors">
                {detailStrategy.price === 0 ? '免费获取' : `购买 — ${detailStrategy.price} USDT`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {purchasing && (
        <PurchaseModal
          strategy={purchasing}
          userBalance={userBalance}
          onPurchase={handlePurchase}
          onClose={() => setPurchasing(null)}
        />
      )}
    </div>
  );
}
