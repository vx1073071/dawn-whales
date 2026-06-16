/**
* AIAdvisorPage — ML R174 E4 [P0] 免费预览+付费解锁
* Freemium model: free factor list → pay 1 USDT → unlocked full analysis
* Integrates with existing AIAdvisorPage UI patterns.
*/

import { useState, useEffect, useMemo } from 'react';
import { getAISuggest } from '@/lib/bridge-api';
import i18n from '../../i18n';
import AIPriceBadge, { AI_PRICES } from '../common/AIPriceBadge';

// ── Types ───────────────────────────────────────────────────────────────

type DisclosureLevel = 'L1' | 'L2' | 'L3';

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
  summary: string; // L1: one-liner, always free
  weight: number; // L2: recommended weight 0-1
  backtestAnnualReturn: number; // L3: paid
  backtestSharpe: number; // L3: paid
  backtestMaxDD: number; // L3: paid
  compatScore: number; // 0-1 compatibility with portfolio
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
    weight: 0.22, backtestAnnualReturn: 18.5, backtestSharpe: 1.42, backtestMaxDD: 15.2, compatScore: 0.85,
  },
  {
    id: 'market_beta', name: 'Market Beta', nameZh: '市场Beta', category: 'risk', categoryZh: '风险',
    ic: 0.055, ir: 0.85, score: 88, direction: 'long',
    summary: '系统性风险暴露，高Beta在牛市中提供超额收益',
    weight: 0.20, backtestAnnualReturn: 22.1, backtestSharpe: 1.55, backtestMaxDD: 18.7, compatScore: 0.92,
  },
  {
    id: 'value_ep', name: 'Earnings Yield', nameZh: '盈利收益率', category: 'value', categoryZh: '价值',
    ic: 0.038, ir: 0.61, score: 75, direction: 'long',
    summary: 'E/P比率衡量估值水平，低估值股票长期胜率更高',
    weight: 0.18, backtestAnnualReturn: 14.2, backtestSharpe: 1.18, backtestMaxDD: 12.8, compatScore: 0.78,
  },
  {
    id: 'quality_roe', name: 'ROE Quality', nameZh: 'ROE质量', category: 'quality', categoryZh: '品质',
    ic: 0.042, ir: 0.68, score: 79, direction: 'long',
    summary: '高ROE公司持续盈利能力更强，防御性特征明显',
    weight: 0.16, backtestAnnualReturn: 16.8, backtestSharpe: 1.35, backtestMaxDD: 10.5, compatScore: 0.80,
  },
  {
    id: 'low_vol', name: 'Low Volatility', nameZh: '低波动', category: 'volatility', categoryZh: '波动',
    ic: 0.031, ir: 0.55, score: 68, direction: 'long',
    summary: '低波动股票风险调整后收益更强，适合稳健型投资者',
    weight: 0.10, backtestAnnualReturn: 10.5, backtestSharpe: 1.05, backtestMaxDD: 8.2, compatScore: 0.70,
  },
  {
    id: 'size_small', name: 'Small Size', nameZh: '小市值', category: 'size', categoryZh: '规模',
    ic: 0.028, ir: 0.42, score: 60, direction: 'long',
    summary: '小市值效应，历史长期跑赢大市值但波动更大',
    weight: 0.08, backtestAnnualReturn: 12.0, backtestSharpe: 0.78, backtestMaxDD: 25.3, compatScore: 0.55,
  },
  {
    id: 'reversal_short', name: 'Short-term Reversal', nameZh: '短期反转', category: 'momentum', categoryZh: '动量',
    ic: 0.035, ir: 0.58, score: 65, direction: 'short',
    summary: '1-2周反转效应，捕捉短期超买超卖回归均值',
    weight: 0.04, backtestAnnualReturn: 8.2, backtestSharpe: 0.72, backtestMaxDD: 20.1, compatScore: 0.48,
  },
  {
    id: 'liquidity', name: 'Liquidity', nameZh: '流动性', category: 'liquidity', categoryZh: '流动性',
    ic: 0.025, ir: 0.38, score: 55, direction: 'long',
    summary: '低流动性补偿，换手率低的股票享受流动性溢价',
    weight: 0.02, backtestAnnualReturn: 6.5, backtestSharpe: 0.55, backtestMaxDD: 22.0, compatScore: 0.40,
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

// ── Tiered Factor Card (L1/L2/L3 progressive disclosure) ────────────────

function TieredFactorCard({
  factor,
  level,
  isUnlocked,
  onUnlock,
}: {
  factor: FactorRecommendation;
  level: DisclosureLevel;
  isUnlocked: boolean;
  onUnlock: () => void;
}) {
  const showL2 = level === 'L2' || level === 'L3' || isUnlocked;
  const showL3 = (level === 'L3' && isUnlocked) || isUnlocked;
  const needsPay = !isUnlocked;

  return (
    <div
      className={`rounded-lg p-3 transition-all ${
        isUnlocked
          ? 'bg-[#1a1a25] border border-[#D4A853]/20'
          : 'bg-[#1a1a25] border border-white/5 hover:border-[#C9A046]/20'
      }`}
    >
      {/* L1: Always visible — name + category + IC + summary */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              isUnlocked ? 'bg-[#D4A853]/20 text-[#D4A853]' : 'bg-white/5 text-gray-500'
            }`}
          >
            {factor.categoryZh}
          </span>
          <span className="text-sm font-medium text-white">{factor.nameZh}</span>
          {isUnlocked && <span className="text-[10px] text-green-400 bg-green-500/10 px-1 py-0.5 rounded">已解锁</span>}
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
      {/* L1 summary */}
      <p className="text-xs text-gray-400 leading-relaxed mb-1">{factor.summary}</p>

      {/* L2: Weight bar + IR + Score + Compat */}
      {showL2 && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">推荐权重</span>
            <span className="text-[11px] text-white font-mono">{(factor.weight * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-[#D4A853] transition-all"
              style={{ width: `${Math.min(factor.weight * 100, 100)}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-deep rounded p-1.5">
              <div className="text-[9px] text-gray-500">IR</div>
              <div className={`text-[11px] font-mono font-semibold ${factor.ir >= 0.7 ? 'text-green-400' : factor.ir >= 0.5 ? 'text-yellow-400' : 'text-gray-400'}`}>
                {factor.ir.toFixed(2)}
              </div>
            </div>
            <div className="bg-deep rounded p-1.5">
              <div className="text-[9px] text-gray-500">评分</div>
              <div className={`text-[11px] font-mono font-semibold ${factor.score >= 75 ? 'text-green-400' : factor.score >= 60 ? 'text-yellow-400' : 'text-gray-400'}`}>
                {factor.score}
              </div>
            </div>
            <div className="bg-deep rounded p-1.5">
              <div className="text-[9px] text-gray-500">兼容</div>
              <div className={`text-[11px] font-mono font-semibold ${factor.compatScore >= 0.8 ? 'text-green-400' : factor.compatScore >= 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
                {(factor.compatScore * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* L3: Paid detail — backtest + IC interpretation */}
      {showL3 && (
        <div className="mt-3 pt-3 border-t border-[#D4A853]/20 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#D4A853]/5 border border-[#D4A853]/10 rounded p-2 text-center">
              <div className="text-[9px] text-gray-500">年化收益</div>
              <div className={`text-xs font-bold ${factor.backtestAnnualReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {factor.backtestAnnualReturn >= 0 ? '+' : ''}{factor.backtestAnnualReturn.toFixed(1)}%
              </div>
            </div>
            <div className="bg-[#D4A853]/5 border border-[#D4A853]/10 rounded p-2 text-center">
              <div className="text-[9px] text-gray-500">Sharpe</div>
              <div className="text-xs font-bold text-white">{factor.backtestSharpe.toFixed(2)}</div>
            </div>
            <div className="bg-[#D4A853]/5 border border-[#D4A853]/10 rounded p-2 text-center">
              <div className="text-[9px] text-gray-500">最大回撤</div>
              <div className="text-xs font-bold text-red-400">{factor.backtestMaxDD.toFixed(1)}%</div>
            </div>
          </div>
          <div className="bg-[#D4A853]/5 border border-[#D4A853]/10 rounded p-2.5">
            <div className="text-[10px] text-[#D4A853] font-medium mb-1">💡 AI 解读</div>
            <p className="text-[10px] text-gray-300 leading-relaxed">
              {factor.ic >= 0.05
                ? `高IC(${factor.ic.toFixed(3)})表明${factor.nameZh}具有强预测力。IR ${factor.ir.toFixed(2)}信号稳定。年化${factor.backtestAnnualReturn.toFixed(1)}%回测支持，建议配置${(factor.weight * 100).toFixed(0)}%为核心因子。`
                : factor.ic >= 0.03
                ? `${factor.nameZh} IC ${factor.ic.toFixed(3)}中等水平，IR ${factor.ir.toFixed(2)}信号基本稳定。年化${factor.backtestAnnualReturn.toFixed(1)}%，适合辅助因子配置${(factor.weight * 100).toFixed(0)}%。`
                : `${factor.nameZh}当前IC偏低(${factor.ic.toFixed(3)})，Sharpe仅${factor.backtestSharpe.toFixed(2)}，建议等待IC回升后纳入。`}
            </p>
          </div>
        </div>
      )}

      {/* Paywall CTA */}
      {needsPay && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
          <span className="text-[10px] text-gray-500">
            {level === 'L1' ? '🔒 点击展开更多' : '🔒 1 USDT 查看完整分析'}
          </span>
          <button
            onClick={onUnlock}
            className="text-[10px] bg-[#C9A046]/20 hover:bg-[#C9A046]/30 text-[#D4A853] px-2 py-1 rounded transition-colors"
          >
            解锁 →
          </button>
        </div>
      )}
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
  const [disclosureLevel, setDisclosureLevel] = useState<DisclosureLevel>('L1');
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
            className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            {loading ? i18n.t('AIAdvisorPage.k30') : i18n.t('AIAdvisorPage.k31')}
            <AIPriceBadge config={AI_PRICES.aiRefresh} userBalance={balance} inline />
          </button>
        </div>
      </div>

      {/* ── Freemium: Free unlock-all banner ─────────────────────── */}
      {!unlocked && (
        <div className="bg-gradient-to-r from-[#D4A853]/10 to-[#1a1a25] border border-[#D4A853]/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <div className="flex-1">
              <div className="text-white font-medium text-sm">渐进式因子分析</div>
              <div className="text-xs text-gray-400 mt-0.5">
                免费查看 {factors.length} 个因子 · L1/L2 详情免费 · L3 深度分析需 1 USDT 解锁
              </div>
            </div>
          </div>
          {/* Disclosure level selector */}
          <div className="flex items-center gap-1 mt-2 bg-white/[0.02] border border-white/5 rounded-lg p-1">
            {([
              { key: 'L1' as const, label: 'L1 概览', desc: '免费', active: disclosureLevel === 'L1' },
              { key: 'L2' as const, label: 'L2 权重', desc: '免费', active: disclosureLevel === 'L2' },
              { key: 'L3' as const, label: 'L3 深度', desc: '1U', active: disclosureLevel === 'L3' },
            ] as const).map(({ key, label, desc, active }) => (
              <button
                key={key}
                onClick={() => setDisclosureLevel(key)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                  active
                    ? 'bg-[#C9A046] text-black'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
                <span className={`block text-[9px] ${active ? 'text-black/60' : 'text-gray-600'}`}>{desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {unlocked && (
        <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm">✅</span>
            <span className="text-sm text-green-400">已解锁全部因子 L1-L3 深度分析</span>
          </div>
          <span className="text-[10px] text-gray-500">全部级别可视</span>
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
              disabled={balance < 1}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                balance >= 1
                  ? 'bg-[#C9A046]/20 hover:bg-[#C9A046]/30 text-[#D4A853]'
                  : 'bg-gray-500/10 text-gray-500 cursor-not-allowed'
              }`}
            >
              解锁全部
              <AIPriceBadge config={AI_PRICES.aiRecommend} userBalance={balance} inline />
            </button>
          )}
        </div>

        {/* Factor list — tiered progressive disclosure */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedFactors.map((f) => (
            <TieredFactorCard
              key={f.id}
              factor={f}
              level={disclosureLevel}
              isUnlocked={isFactorUnlocked(f.id)}
              onUnlock={() => setShowUnlockModal(true)}
            />
          ))}
        </div>
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
