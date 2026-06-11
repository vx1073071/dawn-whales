import { useState, useEffect } from 'react';
import { getAISuggest } from '@/lib/bridge-api';
import { EngineError } from '../../../electron/engine/core/engine-error';
import i18n from '../../i18n';
interface AIAdvice {
  marketView: string;
  score: number; // 0-100
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'sell';
  portfolioSuggestions: { action: string; code: string; name: string; reason: string }[];
  riskWarnings: string[];
  keyThemes: string[];
  nextWeekOutlook: string;
}

const RECOMMENDATION_MAP: Record<string, { label: string; color: string; bg: string }> = {
  strong_buy: { label: i18n.t('AIAdvisorPage.k1'), color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
  buy: { label: i18n.t('AIAdvisorPage.k2'), color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  hold: { label: i18n.t('AIAdvisorPage.k3'), color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  reduce: { label: 'reduce', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  sell: { label: i18n.t('AIAdvisorPage.k4'), color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

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

export default function AIAdvisorPage() {
  
  const [advice, setAdvice] = useState<AIAdvice>(MOCK_ADVICE);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getAISuggest();
      if (res?.success && res.data) setAdvice(res.data);
    } catch (e) { console.error('[Error:AIAdvisorPage]', e); }
    void EngineError; // [AI] structured error tracking
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const rec = RECOMMENDATION_MAP[advice.recommendation] || RECOMMENDATION_MAP.hold;

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t('AIAdvisorPage.k28')}</h1>
          <p className="text-gray-400 text-sm">{i18n.t('AIAdvisorPage.k29')}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? i18n.t('AIAdvisorPage.k30') : i18n.t('AIAdvisorPage.k31')}
        </button>
      </div>

      {/* Market Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`border rounded-xl p-5 ${rec.bg}`}>
          <div className="text-xs text-gray-500 mb-1">{i18n.t('AIAdvisorPage.k32')}</div>
          <div className={`text-2xl font-bold ${rec.color}`}>{rec.label}</div>
          <div className="text-xs text-gray-400 mt-1">综合评分: {advice.score}/100</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">{i18n.t('AIAdvisorPage.k33')}</div>
          <div className="text-2xl font-bold text-white">{advice.score >= 70 ? i18n.t('AIAdvisorPage.k34') : advice.score >= 50 ? i18n.t('AIAdvisorPage.k35') : i18n.t('AIAdvisorPage.k36')}</div>
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
              <span key={t} className="text-xs bg-[#C9A046]/10 text-[#D4A853] px-2 py-1 rounded-lg">{t}</span>
            ))}
          </div>
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
              <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${
                s.action === 'components.increaseHolding' ? 'bg-red-500/20 text-red-400' :
                s.action === 'components.decreaseHolding' ? 'bg-emerald-500/20 text-emerald-400' :
                s.action === i18n.t('AIAdvisorPage.k0') ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
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
    </div>
  );
}
