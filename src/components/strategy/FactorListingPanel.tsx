/**
* FactorListingPanel — ML R174 D6 [P0] 策略市场发布流程
* Flow: FactorAnalysis → "上架到市场" → 定价(≥9.9U) → 审核预览 → 确认发布
* Progressive disclosure: step-by-step wizard, no overwhelm.
*/

import { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface ListedFactor {
  factorId: string;
  name: string;
  weight: number; // 0-1
  category: string;
}

export interface ListingDraft {
  id: string;
  name: string;
  description: string;
  price: number; // USDT, min 9.9
  category: 'factor_bundle' | 'signal_subscription' | 'ai_custom';
  factors: ListedFactor[];
  tags: string[];
  market: string[];
  backtestSnapshot?: {
    annualReturn: number;
    sharpe: number;
    maxDrawdown: number;
  };
}

export interface FactorListingPanelProps {
  /** Current factor composition to list */
  factors: ListedFactor[];
  /** Optional backtest results to display in preview */
  backtestResult?: ListingDraft['backtestSnapshot'];
  /** Called when user confirms listing */
  onPublish: (draft: ListingDraft) => Promise<{ success: boolean; error?: string }>;
  /** User's USDT balance */
  userBalance?: number;
  /** Creator level for revenue share display */
  creatorLevel?: 'L1' | 'L2' | 'L3';
  onClose: () => void;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────────

const MIN_PRICE = 9.9;

const REVENUE_SHARE: Record<string, { platform: number; creator: number; label: string }> = {
  L1: { platform: 30, creator: 70, label: '新手上路' },
  L2: { platform: 20, creator: 80, label: '进阶创作者' },
  L3: { platform: 10, creator: 90, label: '旗舰创作者' },
};

const PRESET_TAGS = ['因子组合', '多因子', 'IC排序', '动态权重', '行业轮动', '防御型', '进攻型', 'A股', '港股', '美股'];

const MARKET_OPTIONS = ['US', 'HK', 'CN', 'CRYPTO'];

// ── Step Indicator ───────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ['因子确认', '定价描述', '预览审核', '发布'];
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
              i < current
                ? 'bg-[#D4A853] text-black'
                : i === current
                ? 'bg-[#D4A853]/30 text-[#D4A853] border border-[#D4A853]'
                : 'bg-white/5 text-gray-600'
            }`}
          >
            {i < current ? '✓' : i + 1}
          </div>
          <span className={`text-[11px] ${i <= current ? 'text-gray-300' : 'text-gray-600'}`}>{label}</span>
          {i < steps.length - 1 && (
            <div className={`w-10 h-px ${i < current ? 'bg-[#D4A853]/40' : 'bg-white/5'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Price Selector ───────────────────────────────────────────────────────
function PriceSelector({ price, onChange }: { price: number; onChange: (p: number) => void }) {
  const presets = [9.9, 19.9, 49.9, 99.9, 199.9];
  return (
    <div className="space-y-3">
      <label className="text-xs text-gray-500 block">设定价格 (USDT)</label>
      <div className="flex gap-2 flex-wrap">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              Math.abs(price - p) < 0.01
                ? 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]/30'
                : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            {p}U
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-xs">自定义:</span>
        <input
          type="number"
          min={MIN_PRICE}
          step={0.1}
          value={price}
          onChange={(e) => {
            const v = parseFloat(e.target.value) || MIN_PRICE;
            onChange(Math.max(MIN_PRICE, v));
          }}
          className="w-32 px-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white text-right"
        />
        <span className="text-gray-500 text-xs">USDT</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

export default function FactorListingPanel({
  factors,
  backtestResult,
  onPublish,
  creatorLevel = 'L1',
  onClose,
  className = '',
}: FactorListingPanelProps) {
  // Step state
  const [step, setStep] = useState(0); // 0=confirm, 1=price, 2=preview, 3=done

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(MIN_PRICE);
  const [category, setCategory] = useState<ListingDraft['category']>('factor_bundle');
  const [tags, setTags] = useState<string[]>([]);
  const [markets, setMarkets] = useState<string[]>(['US']);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const share = REVENUE_SHARE[creatorLevel];

  // Toggle tag
  const toggleTag = useCallback((tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  // Toggle market
  const toggleMarket = useCallback((m: string) => {
    setMarkets((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }, []);

  // Build draft
  const buildDraft = useCallback(
    (): ListingDraft => ({
      id: `listing-${Date.now()}`,
      name: name.trim() || `${factors.length}因子组合`,
      description: description.trim() || `包含 ${factors.length} 个精选因子的策略组合`,
      price,
      category,
      factors,
      tags,
      market: markets,
      backtestSnapshot: backtestResult,
    }),
    [name, description, price, category, factors, tags, markets, backtestResult]
  );

  // Publish
  const handlePublish = async () => {
    setPublishing(true);
    setError('');
    try {
      const draft = buildDraft();
      const res = await onPublish(draft);
      if (res.success) {
        setStep(3);
      } else {
        setError(res.error || '发布失败，请重试');
      }
    } catch {
      setError('网络错误，请重试');
    }
    setPublishing(false);
  };

  // Backtest display
  const bt = backtestResult;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm ${className}`}>
      <div className="bg-[#1A1A24] border border-white/10 rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <h3 className="text-white font-semibold text-lg">📦 上架到策略市场</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">
            &times;
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4 flex-shrink-0">
          <StepIndicator current={step} />
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── Step 0: Confirm Factors ─────────────────────────────── */}
          {step === 0 && (
            <>
              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-3">📊 选中的因子组合</h4>
                <div className="space-y-2">
                  {factors.map((f) => (
                    <div key={f.factorId} className="flex items-center justify-between bg-deep rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{f.category}</span>
                        <span className="text-sm text-white">{f.name}</span>
                      </div>
                      <span className="text-[#D4A853] text-xs font-mono font-semibold">
                        {(f.weight * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
                {factors.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">请先从因子分析中选择因子</p>
                )}
              </div>
              {backtestResult && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">年化收益</div>
                    <div className={`text-sm font-bold ${bt!.annualReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {bt!.annualReturn >= 0 ? '+' : ''}
                      {bt!.annualReturn.toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">Sharpe</div>
                    <div className="text-sm font-bold text-white">{bt!.sharpe.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">最大回撤</div>
                    <div className="text-sm font-bold text-red-400">{bt!.maxDrawdown.toFixed(1)}%</div>
                  </div>
                </div>
              )}
              <div className="mt-4">
                <button
                  onClick={() => setStep(1)}
                  disabled={factors.length === 0}
                  className="w-full py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  下一步：定价与描述 →
                </button>
              </div>
            </>
          )}

          {/* ── Step 1: Price + Description ────────────────────────── */}
          {step === 1 && (
            <>
              {/* Name */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">策略名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`${factors.length}因子策略组合`}
                  maxLength={60}
                  className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/50"
                />
                <div className="text-right text-[10px] text-gray-600 mt-0.5">{name.length}/60</div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">策略描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述这个策略组合的特点、适合的市场环境、因子选择逻辑等..."
                  rows={3}
                  maxLength={300}
                  className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/50 resize-none"
                />
                <div className="text-right text-[10px] text-gray-600 mt-0.5">{description.length}/300</div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">商品类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'factor_bundle', label: '因子组合包', desc: '一次性购买' },
                      { key: 'signal_subscription', label: '信号订阅', desc: '按周/月' },
                      { key: 'ai_custom', label: 'AI定制', desc: '按次' },
                    ] as const
                  ).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => setCategory(key)}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        category === key
                          ? 'bg-[#D4A853]/10 border-[#D4A853]/30 text-[#D4A853]'
                          : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10'
                      }`}
                    >
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-[10px] mt-0.5 opacity-60">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <PriceSelector price={price} onChange={setPrice} />

              {/* Revenue share preview */}
              <div className="bg-[#D4A853]/5 border border-[#D4A853]/10 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    收益预估 ({share.label})
                  </span>
                  <span className="text-[#D4A853] font-semibold">
                    {price.toFixed(1)} × {share.creator}% = {(price * share.creator / 100).toFixed(1)} USDT
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  平台抽成 {share.platform}% · 创作者得 {share.creator}%
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">标签 (选填)</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TAGS.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`px-2 py-1 rounded text-[11px] transition-all ${
                        tags.includes(t)
                          ? 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]/30'
                          : 'bg-white/5 text-gray-500 border border-transparent hover:border-white/10'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Markets */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">适用市场</label>
                <div className="flex gap-2">
                  {MARKET_OPTIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => toggleMarket(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                        markets.includes(m)
                          ? 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]/30'
                          : 'bg-white/5 text-gray-500 border border-transparent hover:border-white/10'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nav */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  ← 返回
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors"
                >
                  预览 →
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Preview ────────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-semibold">{name || `${factors.length}因子策略组合`}</h4>
                  <span className="text-[#D4A853] font-bold text-lg">{price.toFixed(1)} USDT</span>
                </div>
                <p className="text-sm text-gray-400">{description || '—'}</p>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="bg-white/5 px-1.5 py-0.5 rounded">
                    {category === 'factor_bundle' ? '因子组合包' : category === 'signal_subscription' ? '信号订阅' : 'AI定制'}
                  </span>
                  {markets.map((m) => (
                    <span key={m} className="bg-white/5 px-1.5 py-0.5 rounded">
                      {m}
                    </span>
                  ))}
                </div>

                {/* Factor list */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">因子组成</div>
                  <div className="space-y-1.5">
                    {factors.map((f) => (
                      <div key={f.factorId} className="flex items-center justify-between text-sm bg-deep rounded px-3 py-1.5">
                        <span className="text-gray-300">{f.name}</span>
                        <span className="text-[#D4A853] font-mono text-xs">
                          {(f.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 bg-[#D4A853]/10 text-[#D4A853]/70 rounded text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Revenue calc */}
                <div className="bg-[#D4A853]/5 border border-[#D4A853]/10 rounded p-3 flex items-center justify-between text-xs">
                  <span className="text-gray-400">每笔交易你的收益</span>
                  <span className="text-[#D4A853] font-semibold">
                    {price.toFixed(1)} × {share.creator}% = {(price * share.creator / 100).toFixed(1)} USDT
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">{error}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  ← 返回修改
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex-1 py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors disabled:opacity-60"
                >
                  {publishing ? '发布中...' : '✅ 确认发布'}
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Done ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col items-center gap-4 py-8">
              <span className="text-6xl">🎉</span>
              <div className="text-white font-semibold text-lg">发布成功！</div>
              <p className="text-sm text-gray-400 text-center max-w-xs">
                你的策略 <span className="text-[#D4A853]">{name || `${factors.length}因子组合`}</span> 已上架到策略市场
              </p>
              <div className="bg-[#D4A853]/5 border border-[#D4A853]/10 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400">创作者收益</div>
                <div className="text-[#D4A853] font-bold text-lg">
                  {price.toFixed(1)} × {share.creator}% = {(price * share.creator / 100).toFixed(1)} USDT / 笔
                </div>
              </div>
              <button
                onClick={onClose}
                className="px-8 py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors"
              >
                完成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
