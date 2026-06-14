/**
* AIAdvisorPage — ML R174 E4 [P0] 免费预览+付费解锁
* Freemium model: free factor list → pay 1 USDT → unlocked full analysis
* Integrates with existing AIAdvisorPage UI patterns.
*/

import { useState, useEffect, useMemo } from 'react';
import { getAISuggest } from '@/lib/bridge-api';
import i18n from '../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

interface AIAdvice {
  marketView: string;
  score: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'sell';
  portfolioSuggestions: { action: string; code: string; name: string; reason: string }[];
  riskWarnings: string[];
  keyThemes: string[];
  nextWeekOutlook: string;
}

interface FactorRecommendation {
  id: string;
  name: string;
  nameZh: string;
  category: string;
  categoryZh: string;
  ic: number; // Information Coefficient
  ir: number; // Information Ratio
  score: number; // 0-100
  direction: 'long' | 'short';
  summary: string; // one-liner, always free
}

const RECOMMENDATION_MAP: Record<string, { label: string; color: string; bg: string }> = {
  strong_buy: { label: i18n.t('AIAdvisorPage.k1'), color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
  buy: { label: i18n.t('AIAdvisorPage.k2'), color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  hold: { label: i18n.t('AIAdvisorPage.k3'), color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  reduce: { label: 'reduce', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  sell: { label: i18n.t('AIAdvisorPage.k4'), color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

// ── Mock factor recommendations (free tier visible) ─────────────────────

const MOCK_FACTORS: FactorRecommendation[] = [
  {
    id: 'momentum_12m', name: '12M Momentum', nameZh: '12月动量', category: 'momentum', categoryZh: '动量',
    ic: 0.045, ir: 0.72, score: 82, direction: 'long',
    summary: '中期价格趋势跟踪，12个月窗口捕捉持续性收益',
  },
  {
    id: 'market_beta', name: 'Market Beta', nameZh: '市场Beta', category: 'risk', categoryZh: '风险',
    ic: 0.055, ir: 0.85, score: 88, direction: 'long',
    summary: '系统性风险暴露，高Beta在牛市中提供超额收益',
  },
  {
    id: 'value_ep', name: 'Earnings Yield', nameZh: '盈利收益率', category: 'value', categoryZh: '价值',
    ic: 0.038, ir: 0.61, score: 75, direction: 'long',
    summary: 'E/P比率衡量估值水平，低估值股票长期胜率更高',
  },
  {
    id: 'quality_roe', name: 'ROE Quality', nameZh: 'ROE质量', category: 'quality', categoryZh: '品质',
    ic: 0.042, ir: 0.68, score: 79, direction: 'long',
    summary: '高ROE公司持续盈利能力更强，防御性特征明显',
  },
  {
    id: 'low_vol', name: 'Low Volatility', nameZh: '低波动', category: 'volatility', categoryZh: '波动',
    ic: 0.031, ir: 0.55, score: 68, direction: 'long',
    summary: '低波动股票风险调整后收益更强，适合稳健型投资者',
  },
  {
    id: 'size_small', name: 'Small Size', nameZh: '小市值', category: 'size', categoryZh: '规模',
    ic: 0.028, ir: 0.42, score: 60, direction: 'long',
    summary: '小市值效应，历史长期跑赢大市值但波动更大',
  },
  {
    id: 'reversal_short', name: 'Short-term Reversal', nameZh: '短期反转', category: 'momentum', categoryZh: '动量',
    ic: 0.035, ir: 0.58, score: 65, direction: 'short',
    summary: '1-2周反转效应，捕捉短期超买超卖回归均值',
  },
  {
    id: 'liquidity', name: 'Liquidity', nameZh: '流动性', category: 'liquidity', categoryZh: '流动性',
    ic: 0.025, ir: 0.38, score: 55, direction: 'long',
    summary: '低流动性补偿，换手率低的股票享受流动性溢价',
  },
];

const MOCK_ADVICE: AIAdvice = {
  marketView: i18n.t('AIAdvisorPage.k5'),
  score: 62,
  recommendation: 'hold',
  portfolioSuggestions: [
    { action: 'components.increaseHolding', code: 'NVDA', name: i18n.t('AIAdvisorPage.k6'), reason: i18n.t('AIAdvisorPage.k7') },
    { action: 'components.increaseHolding', code: 'AVGO', name: i18n.t('AIAdvisorPage.k8'), reason: i18n.t('AIAdvisorPage.k9') },
    { action: 'components.decreaseHolding', code: 'TSLA', name: i18n.t('AIAdvisorPage.k10'), reason: i18n.t('AIAdvisorPage.k11') },
    { action: i18n.t('AIAdvisorPage.k12'), code: 'AAPL', name: i18n.t('AIAdvisorPage.k13'), reason: i18n.t('AIAdvisorPage.k14') },
    { action: i18n.t('AIAdvisorPage.k15'), code: 'SMCI', name: i18n.t('AIAdvisorPage.k16'), reason: i18n.t('AIAdvisorPage.k17') },
  ],
  riskWarnings: [
    i18n.t('AIAdvisorPage.k18'),
    i18n.t('AIAdvisorPage.k19'),
    i18n.t('AIAdvisorPage.k20'),
    i18n.t('AIAdvisorPage.k21'),
  ],
  keyThemes: [
    i18n.t('AIAdvisorPage.k22'),
    i18n.t('AIAdvisorPage.k23'),
    i18n.t('AIAdvisorPage.k24'),
    i18n.t('AIAdvisorPage.k25'),
    i18n.t('AIAdvisorPage.k26'),
  ],
  nextWeekOutlook: i18n.t('AIAdvisorPage.k27'),
};

// ── Free tier: Factor summary card ──────────────────────────────────────

function FreeFactorCard({ factor }: { factor: FactorRecommendation }) {
  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-lg p-3 hover:border-[#C9A046]/20 transition-all">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-white/5 px-1.5 py-0.5 rounded text-gray-500">{factor.categoryZh}</span>
          <span className="text-sm font-medium text-white">{factor.nameZh}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              factor.ic >= 0.04 ? 'bg-green-500/10 text-green-400' : factor.ic >= 0.03 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-gray-500/10 text-gray-400'
            }`}
          >
            IC {factor.ic >= 0 ? '+' : ''}{factor.ic.toFixed(3)}
          </span>
          <span
            className={`text-[10px] px-1 py-0.5 rounded ${
              factor.direction === 'long' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}
          >
            {factor.direction === 'long' ? '做多' : '做空'}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{factor.summary}</p>
      {/* Paywall hint */}
      <div className="flex items-center gap-1 mt-2 text-[10px] text-[#D4A853]">
        <span>🔒</span>
        <span>1 USDT 查看完整分析</span>
      </div>
    </div>
  );
}

// ── Paid tier: Detailed factor analysis card ────────────────────────────

function PaidFactorDetail({ factor }: { factor: FactorRecommendation }) {
  return (
    <div className="bg-[#1a1a25] border border-[#D4A853]/20 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-[#D4A853]/20 text-[#D4A853] px-1.5 py-0.5 rounded">{factor.categoryZh}</span>
          <span className="text-base font-semibold text-white">{factor.nameZh}</span>
          <span className="text-xs text-gray-500">({factor.name})</span>
        </div>
        <span className="text-xs text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">✅ 已解锁</span>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-300 mb-4">{factor.summary}</p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="bg-deep rounded-lg p-2.5 text-center">
          <div className="text-xs text-gray-500">IC (信息系数)</div>
          <div className={`text-sm font-bold font-mono ${factor.ic >= 0.04 ? 'text-green-400' : factor.ic >= 0.03 ? 'text-yellow-400' : 'text-gray-400'}`}>
            {factor.ic >= 0 ? '+' : ''}{factor.ic.toFixed(3)}
          </div>
        </div>
        <div className="bg-deep rounded-lg p-2.5 text-center">
          <div className="text-xs text-gray-500">IR (信息比)</div>
          <div className={`text-sm font-bold font-mono ${factor.ir >= 0.7 ? 'text-green-400' : factor.ir >= 0.5 ? 'text-yellow-400' : 'text-gray-400'}`}>
            {factor.ir.toFixed(2)}
          </div>
        </div>
        <div className="bg-deep rounded-lg p-2.5 text-center">
          <div className="text-xs text-gray-500">综合评分</div>
          <div className={`text-sm font-bold font-mono ${factor.score >= 75 ? 'text-green-400' : factor.score >= 60 ? 'text-yellow-400' : 'text-gray-400'}`}>
            {factor.score}/100
          </div>
        </div>
        <div className="bg-deep rounded-lg p-2.5 text-center">
          <div className="text-xs text-gray-500">方向</div>
          <div className={`text-sm font-bold ${factor.direction === 'long' ? 'text-green-400' : 'text-red-400'}`}>
            {factor.direction === 'long' ? '做多' : '做空'}
          </div>
        </div>
      </div>

      {/* IC interpretation */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 mb-3">
        <div className="text-xs text-gray-500 mb-1.5">📊 IC 解读</div>
        <p className="text-xs text-gray-300 leading-relaxed">
          {factor.ic >= 0.05
            ? `高IC值表明${factor.nameZh}因子具有很强的预测能力。当前IC为${factor.ic.toFixed(3)}，在同类因子中处于前${Math.round((1 - factor.ic / 0.08) * 100)}%水平。结合IR ${factor.ir.toFixed(2)}，该因子稳定性优秀，适合作为核心因子。`
            : factor.ic >= 0.03
            ? `${factor.nameZh}因子的当前IC为${factor.ic.toFixed(3)}，处于中等预测能力水平。IR ${factor.ir.toFixed(2)}显示信号一致性较好。建议与其他互补因子搭配使用以提升组合稳定性。`
            : `${factor.nameZh}因子当前IC偏低(${factor.ic.toFixed(3)})，IR ${factor.ir.toFixed(2)}表明信号不够一致。在当前市场环境下，该因子独立使用效果有限，建议作为辅助因子或等待IC回升。`}
        </p>
      </div>

      {/* Action recommendation */}
      <div className="bg-[#D4A853]/5 border border-[#D4A853]/10 rounded-lg p-3">
        <div className="text-xs text-[#D4A853] font-medium mb-1">💡 AI 建议</div>
        <p className="text-xs text-gray-300">
          {factor.score >= 75
            ? `${factor.nameZh}因子当前评分${factor.score}/100，建议配置${Math.round(factor.score / 10)}%权重于策略组合中。${factor.direction === 'long' ? '做多方向适合当前市场环境。' : '做空方向可用于对冲多头风险。'}`
            : factor.score >= 60
            ? `${factor.nameZh}因子评分${factor.score}/100，建议作为辅助因子配置${Math.round(factor.score / 15)}%权重。当前不是最优配置窗口，可适度参与。`
            : `当前评分较低，建议等待该因子的IC回升后再考虑纳入策略组合。`}
        </p>
      </div>
    </div>
  );
}

// ── Unlock modal (1 USDT paywall) ───────────────────────────────────────

function UnlockModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1A1A24] border border-white/10 rounded-xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-white/5 text-center">
          <span className="text-4xl">🔓</span>
          <h3 className="text-white font-semibold text-lg mt-2">解锁完整因子分析</h3>
          <p className="text-sm text-gray-400 mt-1">
            查看全部 {MOCK_FACTORS.length} 个因子的深度分析，包括IC解读、AI建议和权重配置
          </p>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 flex items-center justify-between">
            <span className="text-gray-400 text-sm">费用</span>
            <span className="text-[#D4A853] font-bold text-lg">1.00 USDT</span>
          </div>
          <div className="text-xs text-gray-500 text-center">
            首次解锁 · 失败不收费 · 按次计费
          </div>
        </div>
        <div className="p-5 border-t border-white/5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm transition-colors"
          >
            再看看
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {loading ? '扣费中...' : '1 USDT 解锁'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function AIAdvisorPage() {
  const [advice, setAdvice] = useState<AIAdvice>(MOCK_ADVICE);
  const [loading, setLoading] = useState(false);

  // Freemium state
  const [unlocked, setUnlocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [factors] = useState<FactorRecommendation[]>(MOCK_FACTORS);
  const [balance, setBalance] = useState(250); // mock, normally from IPC


  async function load() {
    setLoading(true);
    try {
      const res = await getAISuggest();
      if (res?.success && res.data) setAdvice(res.data);
    } catch (e) {
      console.error('[Error:AIAdvisorPage]', e);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const handleUnlockAll = async () => {
    if (balance < 1) {
      setShowUnlockModal(false);
      return; // would show insufficient balance toast
    }
    setUnlocking(true);
    // Simulate USDT deduction
    await new Promise((r) => setTimeout(r, 1200));
    setBalance((prev) => prev - 1);
    setUnlocked(true);
    setUnlocking(false);
    setShowUnlockModal(false);
  };

  // Check if a specific factor has been unlocked
  const isFactorUnlocked = (_factorId: string) => unlocked;

  const rec = RECOMMENDATION_MAP[advice.recommendation] || RECOMMENDATION_MAP.hold;

  // Sort factors: unlocked first, then by IC descending
  const sortedFactors = useMemo(() => {
    return [...factors].sort((a, b) => {
      const aUnlocked = isFactorUnlocked(a.id);
      const bUnlocked = isFactorUnlocked(b.id);
      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;
      return b.ic - a.ic;
    });
  }, [factors, unlocked]);

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t('AIAdvisorPage.k28')}</h1>
          <p className="text-gray-400 text-sm">{i18n.t('AIAdvisorPage.k29')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Balance */}
          <div className="text-xs text-gray-500">
            <span>余额 </span>
            <span className="text-[#D4A853] font-semibold">{balance.toLocaleString()} USDT</span>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? i18n.t('AIAdvisorPage.k30') : i18n.t('AIAdvisorPage.k31')}
          </button>
        </div>
      </div>

      {/* ── Freemium: Free unlock-all banner ─────────────────────── */}
      {!unlocked && (
        <div className="bg-gradient-to-r from-[#D4A853]/10 to-[#1a1a25] border border-[#D4A853]/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <div>
              <div className="text-white font-medium text-sm">免费因子列表已展示</div>
              <div className="text-xs text-gray-400 mt-0.5">
                下方展示 {factors.length} 个推荐因子概览 · 1 USDT 解锁全部深度分析
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowUnlockModal(true)}
            className="px-4 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors whitespace-nowrap"
          >
            1 USDT 解锁全部
          </button>
        </div>
      )}

      {unlocked && (
        <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3 flex items-center gap-2">
          <span className="text-green-400 text-sm">✅</span>
          <span className="text-sm text-green-400">已解锁全部因子深度分析</span>
        </div>
      )}

      {/* Market Score cards — always visible */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`border rounded-xl p-5 ${rec.bg}`}>
          <div className="text-xs text-gray-500 mb-1">{i18n.t('AIAdvisorPage.k32')}</div>
          <div className={`text-2xl font-bold ${rec.color}`}>{rec.label}</div>
          <div className="text-xs text-gray-400 mt-1">
            {i18n.t('AIAdvisorPage.r92_81bc')}
            {advice.score}/100
          </div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('AIAdvisorPage.k33')}</div>
          <div className="text-2xl font-bold text-white">
            {advice.score >= 70 ? i18n.t('AIAdvisorPage.k34') : advice.score >= 50 ? i18n.t('AIAdvisorPage.k35') : i18n.t('AIAdvisorPage.k36')}
          </div>
          <div className="w-full bg-white/5 rounded-full h-2 mt-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${advice.score}%`,
                background: advice.score >= 70 ? '#16a34a' : advice.score >= 50 ? '#ca8a04' : '#dc2626',
              }}
            />
          </div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('AIAdvisorPage.k37')}</div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {advice.keyThemes.map((t) => (
              <span key={t} className="text-xs bg-[#C9A046]/10 text-[#D4A853] px-2 py-1 rounded-lg">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Factor Recommendations Section ────────────────────────── */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            🧬 AI 因子推荐
            {unlocked && <span className="text-xs text-green-400 ml-2 font-normal">已解锁</span>}
          </h2>
          {!unlocked && (
            <button
              onClick={() => setShowUnlockModal(true)}
              className="text-xs bg-[#C9A046]/20 hover:bg-[#C9A046]/30 text-[#D4A853] px-3 py-1.5 rounded-lg transition-colors"
            >
              1 USDT 解锁全部 →
            </button>
          )}
        </div>

        {!unlocked ? (
          /* Free tier: factor cards without detail */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedFactors.map((f) => (
              <FreeFactorCard key={f.id} factor={f} />
            ))}
          </div>
        ) : (
          /* Paid tier: full detailed analysis */
          <div className="space-y-4">
            {sortedFactors.map((f) => (
              <PaidFactorDetail key={f.id} factor={f} />
            ))}
          </div>
        )}
      </div>

      {/* Market View */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-3">{i18n.t('AIAdvisorPage.k38')}</h2>
        <p className="text-sm text-gray-300 leading-relaxed">{advice.marketView}</p>
      </div>

      {/* Portfolio Suggestions */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">{i18n.t('AIAdvisorPage.k39')}</h2>
        <div className="space-y-3">
          {advice.portfolioSuggestions.map((s, idx) => (
            <div key={idx} className="flex items-start gap-3 bg-deep rounded-lg p-3">
              <span
                className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${
                  s.action === 'components.increaseHolding'
                    ? 'bg-red-500/20 text-red-400'
                    : s.action === 'components.decreaseHolding'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : s.action === i18n.t('AIAdvisorPage.k0')
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {s.action}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{s.name}</span>
                  <span className="text-xs text-gray-500">{s.code}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{s.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Warnings */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">{i18n.t('AIAdvisorPage.k40')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {advice.riskWarnings.map((w, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-deep rounded-lg p-3">
              <span className="text-red-400 flex-shrink-0 mt-0.5">•</span>
              <span className="text-sm text-gray-300">{w}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Next Week Outlook */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-3">{i18n.t('AIAdvisorPage.k41')}</h2>
        <p className="text-sm text-gray-300 leading-relaxed">{advice.nextWeekOutlook}</p>
      </div>

      {/* ── Unlock Modal ──────────────────────────────────────────── */}
      {showUnlockModal && (
        <UnlockModal
          onConfirm={handleUnlockAll}
          onCancel={() => setShowUnlockModal(false)}
          loading={unlocking}
        />
      )}
    </div>
  );
}
