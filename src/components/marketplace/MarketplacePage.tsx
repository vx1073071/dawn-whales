import { useState, useEffect } from 'react';
import { getAllStrategies, getMarketplaceList, getStrategyRating, rateStrategy, addComment, getComments } from '@/lib/bridge-api';
import { EngineError } from '../../../electron/engine/core/engine-error';
import { sanitizeText } from '@/lib/dompurify';

import { notify } from '@/components/NotificationToast';
import i18n from '../../i18n';

// ── Types ──────────────────────────────────────────────────────────────────

interface MarketplaceStrategy {
  id: string;
  name: string;
  description: string;
  symbol: string;
  dsl_json: string;
  avg_rating: number;
  rating_count: number;
  comment_count: number;
  performance_return: number;
  performance_sharpe: number;
  status: string;
}

interface StrategyRating {
  avg: number;
  count: number;
  myRating: number;
}

interface StrategyComment {
  id: number;
  strategy_id: string;
  user_id: string;
  content: string;
  parent_id: number | null;
  created_at: string;
}

type Tab = 'rating' | 'return' | 'new';
type RiskFilter = 'all' | 'low' | 'medium' | 'high';

// ── Demo equity curves for display (until real performance DB is populated) ─
const DEMO_CHARTS: Record<string, number[]> = {
  default: [100, 103, 107, 105, 112, 118, 115, 122, 128, 125, 132, 138]
};

export default function MarketplacePage() {

  const [activeTab, setActiveTab] = useState<Tab>('rating');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPublish, setShowPublish] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [myStrategies, setMyStrategies] = useState<unknown[]>([]);
  const [marketStrategies, setMarketStrategies] = useState<MarketplaceStrategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketplace();
    loadMyStrategies();
  }, [activeTab]);

  async function loadMarketplace() {
    setLoading(true);
    try {
      const res = await getMarketplaceList(activeTab === 'return' ? 'return' : 'rating');
      if (res?.success && res.strategies) {
        setMarketStrategies(res.strategies);
      }
    } catch (_e: unknown) {/* silent */}
    void EngineError; // [DATA] structured error tracking
    setLoading(false);
  }

  async function loadMyStrategies() {
    try {
      const list = await getAllStrategies();
      setMyStrategies(list);
    } catch (_e: unknown) {/* silent */}
  }

  const filtered = marketStrategies.
  filter((s) => !searchQuery || s.name.includes(searchQuery));

  const selected = filtered.find((s) => s.id === selectedId);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t('MarketplacePage.k1')}</h1>
          <p className="text-gray-400 text-sm">{i18n.t('MarketplacePage.k2')}</p>
        </div>
        <button
          onClick={() => setShowPublish(true)}
          className="px-4 py-2 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] transition-colors">{i18n.t("MarketplacePage.r92_91d9")}


        </button>
      </div>

      {/* Tabs + Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex gap-1 bg-[#12121a] rounded-lg p-1">
          {([['hot', i18n.t('MarketplacePage.k3')], ['return', i18n.t('MarketplacePage.k4')], ['stable', i18n.t('MarketplacePage.k5')], ['new', i18n.t('MarketplacePage.k6')], ['free', i18n.t('MarketplacePage.k7')]] as [Tab, string][]).map(([key, label]) =>
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === key ? 'bg-[#C9A046] text-black' : 'text-gray-400 hover:text-gray-200'}`
            }>
            
              {label}
            </button>
          )}
        </div>

        <div className="flex gap-1 text-xs">
          {([['all', 'components.all'], ['low', i18n.t('MarketplacePage.k8')], ['medium', i18n.t('MarketplacePage.k9')], ['high', i18n.t('MarketplacePage.k10')]] as [RiskFilter, string][]).map(([key, label]) =>
          <button
            key={key}
            onClick={() => setRiskFilter(key)}
            className={`px-2.5 py-1 rounded transition-colors ${
            riskFilter === key ? 'bg-[#22222f] text-gray-200' : 'text-gray-500 hover:text-gray-300'}`
            }>
            
              {label}
            </button>
          )}
        </div>

        <div className="flex-1" />

        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={i18n.t('MarketplacePage.searchPlaceholder')}
          className="bg-[#12121a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 w-48 focus:outline-none focus:border-[#C9A046]/50" />
        
      </div>

      {/* Content area */}
      {loading ?
      <div className="text-center py-12 text-gray-500">{i18n.t('MarketplacePage.k11')}</div> :

      <div className="flex gap-4">
          <div className="flex-1 grid grid-cols-2 xl:grid-cols-3 gap-3 content-start">
            {filtered.map((s) =>
          <StrategyCardItem
            key={s.id}
            strategy={s}
            selected={s.id === selectedId}
            onClick={() => {setSelectedId(s.id === selectedId ? null : s.id);setShowDetail(true);}} />

          )}
            {filtered.length === 0 &&
          <div className="col-span-3 text-center py-12 text-gray-500">
                {marketStrategies.length === 0 ? i18n.t('MarketplacePage.k12') : i18n.t('MarketplacePage.k13')}
              </div>
          }
          </div>

          {selected && showDetail &&
        <div className="w-80 flex-shrink-0">
              <StrategyDetailPanel strategy={selected} onClose={() => {setSelectedId(null);setShowDetail(false);}} />
            </div>
        }
        </div>
      }

      {/* Publish Modal */}
      {showPublish &&
      <PublishModal
        myStrategies={myStrategies}
        onClose={() => setShowPublish(false)} />

      }
    </div>);

}

// ── Strategy Card ──────────────────────────────────────────────────────────

function StrategyCardItem({ strategy: s, selected, onClick }: {strategy: MarketplaceStrategy;selected: boolean;onClick: () => void;}) {
  const returnPct = s.performance_return || 0;
  const returnColor = returnPct >= 0 ? 'text-emerald-400' : 'text-red-400';
  const chart = DEMO_CHARTS.default;

  return (
    <button
      onClick={onClick}
      className={`bg-[#1a1a25] border rounded-xl p-4 text-left transition-all hover:border-white/10 ${
      selected ? 'border-[#C9A046]/50 ring-1 ring-[#C9A046]/20' : 'border-white/5'}`
      }>
      
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-white text-sm font-medium truncate">{s.name || i18n.t('MarketplacePage.k14')}</h3>
          <div className="text-gray-500 text-[11px] mt-0.5">
            ⭐{s.avg_rating || 0} ({s.rating_count || 0}{i18n.t("MarketplacePage.r92_154e")}{s.comment_count || 0}
          </div>
        </div>
      </div>

      <div className="h-12 mb-3">
        <MiniChart data={chart} positive={returnPct >= 0} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-center">
        <div>
          <div className={`text-sm font-mono font-bold ${returnColor}`}>{returnPct > 0 ? '+' : ''}{returnPct.toFixed(1)}%</div>
          <div className="text-[10px] text-gray-500">{"components.annualized"}</div>
        </div>
        <div>
          <div className="text-sm font-mono text-gray-200">{s.performance_sharpe ? s.performance_sharpe.toFixed(1) : '-'}</div>
          <div className="text-[10px] text-gray-500">{"components.sharpeRatio"}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[10px] text-gray-500 bg-[#12121a] px-1.5 py-0.5 rounded">{s.symbol || i18n.t('MarketplacePage.k15')}</span>
        {s.description && <span className="text-[10px] text-gray-400 truncate">{s.description.slice(0, 30)}</span>}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="text-gray-500 text-[11px]">{i18n.t('MarketplacePage.k16')}</div>
        <div className="text-sm font-bold text-[#D4A853]">{i18n.t('MarketplacePage.k17')}</div>
      </div>
    </button>);

}

// ── Mini Chart ─────────────────────────────────────────────────────────────

function MiniChart({ data, positive }: {data: number[];positive: boolean;}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 200;
  const h = 48;
  const points = data.map((v, i) => {
    const x = i / (data.length - 1) * w;
    const y = h - (v - min) / range * h;
    return `${x},${y}`;
  });
  const color = positive ? '#22c55e' : '#ef4444';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>);

}

// ── Strategy Detail Panel (with real rating + comment) ────────────────────

function StrategyDetailPanel({ strategy: s, onClose }: {strategy: MarketplaceStrategy;onClose: () => void;}) {
  const [rating, setRating] = useState<StrategyRating>({ avg: 0, count: 0, myRating: 0 });
  const [comments, setComments] = useState<StrategyComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [hoverStar, setHoverStar] = useState(0);

  useEffect(() => {
    loadRating();
    loadComments();
  }, [s.id]);

  async function loadRating() {
    try {
      const res = await getStrategyRating(s.id);
      if (res?.success) setRating({ avg: res.avg, count: res.count, myRating: res.myRating });
    } catch (_e: unknown) {}
  }

  async function loadComments() {
    try {
      const res = await getComments(s.id);
      if (res?.success) setComments(res.comments || []);
    } catch (_e: unknown) {}
  }

  async function handleRate(star: number) {
    try {
      await rateStrategy(s.id, star);
      await loadRating();
    } catch (_e: unknown) {notify('error', i18n.t('MarketplacePage.k18'));}
  }

  async function handleComment() {
    if (!newComment.trim()) return;
    try {
      await addComment(s.id, newComment.trim());
      setNewComment('');
      await loadComments();
    } catch (_e: unknown) {notify('error', i18n.t('MarketplacePage.k19'));}
  }

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5 sticky top-0 max-h-[calc(100vh-120px)] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm">{s.name}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
      </div>

      {s.description && <p className="text-gray-400 text-xs mb-4">{s.description}</p>}

      {/* Star Rating */}
      <div className="mb-4 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="text-3xl font-bold text-[#D4A853]">{rating.avg || '-'}</div>
          <div>
            <div className="flex gap-0.5 mb-0.5">
              {[1, 2, 3, 4, 5].map((star) =>
              <button
                key={star}
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHoverStar(star)}
                onMouseLeave={() => setHoverStar(0)}
                className={`text-sm transition-colors ${
                star <= (hoverStar || rating.myRating) ? 'text-[#D4A853]' : 'text-gray-600'}`
                }>
                
                  ★
                </button>
              )}
            </div>
            <div className="text-gray-500 text-[10px]">{rating.count}{i18n.t("MarketplacePage.r92_4f6c")}{rating.myRating > 0 && ` · 我的: ${rating.myRating}星`}</div>
          </div>
        </div>
      </div>

      {/* Strategy Info */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricBox label={i18n.t('MarketplacePage.k20')} value={s.symbol || i18n.t('MarketplacePage.k21')} />
        <MetricBox label={i18n.t('MarketplacePage.k22')} value={`${(s.performance_return || 0).toFixed(1)}%`} color={s.performance_return >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <MetricBox label={i18n.t('MarketplacePage.k23')} value={s.performance_sharpe ? s.performance_sharpe.toFixed(1) : '-'} />
        <MetricBox label={i18n.t('MarketplacePage.k24')} value={String(s.comment_count || 0)} />
      </div>

      {/* Comments Section */}
      <div className="mb-3">
        <div className="text-gray-400 text-[11px] font-medium mb-2">{i18n.t("MarketplacePage.r92_8f80")}{comments.length})</div>

        {/* Add comment */}
        <div className="flex gap-2 mb-3">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleComment()}
            placeholder={i18n.t('MarketplacePage.reviewPlaceholder')}
            className="flex-1 bg-[#12121a] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/50" />
          
          <button
            onClick={handleComment}
            disabled={!newComment.trim()}
            className="px-3 py-1.5 bg-[#C9A046]/20 text-[#D4A853] text-xs rounded-lg hover:bg-[#C9A046]/30 disabled:opacity-40">{i18n.t("MarketplacePage.r92_4f12")}


          </button>
        </div>

        {/* Comment list */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {comments.length === 0 &&
          <div className="text-gray-600 text-[10px] text-center py-3">{i18n.t('MarketplacePage.k25')}</div>
          }
          {comments.map((c) =>
          <div key={c.id} className="bg-[#12121a] rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-[10px]">{c.user_id}</span>
                <span className="text-gray-600 text-[9px]">{c.created_at?.slice(0, 16)}</span>
              </div>
              <div className="text-gray-300 text-xs">{sanitizeText(c.content)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="border-t border-white/5 pt-4">
        <button
          onClick={() => notify('info', i18n.t('MarketplacePage.k26'))}
          className="w-full py-2.5 bg-[#C9A046] text-black font-semibold rounded-lg text-sm hover:bg-[#D4A853] transition-colors">{i18n.t("MarketplacePage.r92_7ad0")}


        </button>
        <div className="mt-2 text-center text-[10px] text-gray-600">{i18n.t("MarketplacePage.r92_5517")}

        </div>
      </div>
    </div>);

}

function MetricBox({ label, value, color = 'text-gray-200' }: {label: string;value: string;color?: string;}) {
  return (
    <div className="bg-[#12121a] rounded-lg p-2.5 text-center">
      <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>);

}

// ── Publish Modal ──────────────────────────────────────────────────────────

function PublishModal({ myStrategies, onClose }: {myStrategies: any[];onClose: () => void;}) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState('');

  const selected = myStrategies.find((s) => s.id === selectedId);

  function handlePublish() {
    if (!selected) {
      notify('warning', i18n.t('MarketplacePage.k27'));
      return;
    }
    notify('success', `${i18n.t('MarketplacePage.submitted')} "${selected.name}"`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#12121a] border border-white/10 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-lg">{i18n.t('MarketplacePage.k28')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">✕</button>
        </div>

        {myStrategies.length === 0 ?
        <div className="text-center py-8">
            <div className="text-3xl mb-2 opacity-40">🧠</div>
            <p className="text-gray-400 text-sm">{i18n.t('MarketplacePage.k29')}</p>
            <p className="text-gray-500 text-xs mt-1">{i18n.t('MarketplacePage.k30')}</p>
          </div> :

        <div className="space-y-4">
            {/* Strategy selection */}
            <div>
              <label className="block text-gray-400 text-xs mb-1">{i18n.t('MarketplacePage.k31')}</label>
              <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
              
                <option value="">{i18n.t('MarketplacePage.k32')}</option>
                {myStrategies.map((s) =>
              <option key={s.id} value={s.id}>{s.name || i18n.t('MarketplacePage.k33')}</option>
              )}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-gray-400 text-xs mb-1">{i18n.t('MarketplacePage.k34')}</label>
              <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={i18n.t('MarketplacePage.descPlaceholder')}
              className="w-full h-20 bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-[#C9A046]/50" />
            
            </div>

            {/* Price */}
            <div>
              <label className="block text-gray-400 text-xs mb-1">{i18n.t('MarketplacePage.k35')}</label>
              <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              min={0}
              max={999}
              className="w-full bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50" />
            
              <div className="text-gray-500 text-[11px] mt-1">
                {price === 0 ? i18n.t('MarketplacePage.k36') : `${i18n.t('MarketplacePage.revenue')}: $${(price * 0.7).toFixed(0)}/mo (70%)`}
              </div>
            </div>

            {/* Revenue split info */}
            <div className="bg-[#C9A046]/10 border border-[#C9A046]/20 rounded-lg p-3">
              <div className="text-[#D4A853] text-xs font-medium mb-1">{i18n.t('MarketplacePage.k37')}</div>
              <div className="text-gray-400 text-[11px]">{i18n.t("MarketplacePage.r92_b333")}

            </div>
            </div>

            <button
            onClick={handlePublish}
            disabled={!selectedId}
            className="w-full py-2.5 bg-[#C9A046] text-black font-semibold rounded-lg text-sm hover:bg-[#D4A853] disabled:opacity-40 transition-colors">{i18n.t("MarketplacePage.r92_127c")}


          </button>
          </div>
        }
      </div>
    </div>);

}