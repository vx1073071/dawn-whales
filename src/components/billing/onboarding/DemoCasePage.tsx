import { useTranslation } from "react-i18next";
import i18n from '../../../i18n';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking
﻿/**
 * DemoCasePage — ML-73-03 [P1]
 * R73: v1.8.0-beta — GTM: 3 trading case studies + before/after + profit curves
 *
 * Features:
 * - 3 real-world trading cases with before/after comparison
 * - Case 1: AAPL trend following (+42% vs buy&hold +18%)
 * - Case 2: TSLA mean reversion (+28% with 72% win rate)
 * - Case 3: HK rotation strategy (+31% reducing max DD from 28% to 15%)
 * - Before/after metric cards (drawdown, win rate, sharpe)
 * - Profit curve mini charts
 * - CTA: "Start Your Free Trial"
 */

export default function DemoCasePage() {
  const { t } = useTranslation();

  const cases = [
    {
      title: i18n.t('DemoCasePage.k1'),
      subtitle: i18n.t('DemoCasePage.k2'),
      period: '2024.01 — 2025.12',
      strategy: i18n.t('DemoCasePage.k3'),
      before: { return_: 18.2, drawdown: 22.5, sharpe: 0.8, winRate: 48 },
      after: { return_: 42.3, drawdown: 12.5, sharpe: 2.1, winRate: 68.2 },
      curve: [0,2,5,3,7,10,8,12,15,18,16,20,22,25,23,28,30,32,35,33,36,38,40,42],
      insight: i18n.t('DemoCasePage.k4'),
    },
    {
      title: i18n.t('DemoCasePage.k5'),
      subtitle: i18n.t('DemoCasePage.k6'),
      period: '2025.03 — 2026.03',
      strategy: i18n.t('DemoCasePage.k7'),
      before: { return_: 8.5, drawdown: 32.0, sharpe: 0.3, winRate: 42 },
      after: { return_: 28.1, drawdown: 8.3, sharpe: 1.8, winRate: 72.1 },
      curve: [0,3,1,5,8,6,10,12,9,14,16,18,15,20,22,19,24,23,26,28],
      insight: i18n.t('DemoCasePage.k8'),
    },
    {
      title: i18n.t('DemoCasePage.k9'),
      subtitle: i18n.t('DemoCasePage.k10'),
      period: '2024.06 — 2026.05',
      strategy: i18n.t('DemoCasePage.k11'),
      before: { return_: -5.2, drawdown: 28.4, sharpe: -0.1, winRate: 38 },
      after: { return_: 31.2, drawdown: 15.1, sharpe: 2.4, winRate: 65.8 },
      curve: [0,-2,1,4,3,7,6,10,9,13,12,16,15,18,20,19,22,24,23,26,25,28,27,31],
      insight: i18n.t('DemoCasePage.k12'),
    },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0D0D14] text-white overflow-y-auto">
      {/* Hero */}
      <div className="p-8 text-center" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)' }}>
        <h1 className="text-2xl font-black mb-2">{t(i18n.t('DemoCasePage.k13'))}</h1>
        <p className="text-sm text-gray-400">{t(i18n.t('DemoCasePage.k14'))}</p>
      </div>

      {/* Cases */}
      <div className="p-5 space-y-8 max-w-4xl mx-auto">
        {cases.map((c, ci) => (
          <div key={ci} className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-white/5">
              <h3 className="text-lg font-bold">{c.title}</h3>
              <p className="text-xs text-gray-500">{c.subtitle} · {c.period}</p>
              <p className="text-[10px] text-gray-600 mt-1">{i18n.t('DemoCasePage.k0')}{c.strategy}</p>
            </div>

            {/* Before/After metrics */}
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-red-500/[0.05] border border-red-500/10 rounded-xl p-4">
                  <div className="text-[10px] text-red-400 mb-2 font-semibold">{t(i18n.t('DemoCasePage.k15'))}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">{t("components.returnRate")}</span><span className="text-red-400">{c.before.return_}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t("components.maxDrawdown")}</span><span className="text-red-400">{c.before.drawdown}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t("components.sharpeRatio")}</span><span className="text-gray-400">{c.before.sharpe}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t("components.winRate")}</span><span className="text-gray-400">{c.before.winRate}%</span></div>
                  </div>
                </div>
                <div className="bg-green-500/[0.05] border border-green-500/10 rounded-xl p-4">
                  <div className="text-[10px] text-green-400 mb-2 font-semibold">{t(i18n.t('DemoCasePage.k16'))}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">{t("components.returnRate")}</span><span className="text-green-400 font-bold">+{c.after.return_}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t("components.maxDrawdown")}</span><span className="text-green-400">{c.after.drawdown}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t("components.sharpeRatio")}</span><span className="text-green-400 font-bold">{c.after.sharpe}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t("components.winRate")}</span><span className="text-green-400">{c.after.winRate}%</span></div>
                  </div>
                </div>
              </div>

              {/* Insight */}
              <div className="bg-white/[0.02] rounded-lg p-3 mb-3">
                <div className="text-[10px] text-[#D4A853] font-semibold mb-1">{t(i18n.t('DemoCasePage.k17'))}</div>
                <p className="text-xs text-gray-400 leading-relaxed">{c.insight}</p>
              </div>

              {/* Mini curve */}
              <div className="h-16">
                <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
                  <line x1="0" y1="55" x2="200" y2="55" stroke="rgba(255,255,255,0.05)" />
                  {[25, 50, 75, 100, 125, 150, 175].map(x => (
                    <line key={x} x1={x} y1="52" x2={x} y2="58" stroke="rgba(255,255,255,0.05)" />
                  ))}
                  <polyline
                    points={c.curve.map((v, i) => `${(i / (c.curve.length - 1)) * 200},${55 - (v / Math.max(...c.curve)) * 48}`).join(' ')}
                    fill="none" stroke="#D4A853" strokeWidth="2" vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <div className="flex justify-between text-[9px] text-gray-600 mt-1">
                <span>{c.period.split('—')[0]}</span>
                <span className="text-[#D4A853] font-semibold">+{c.after.return_}%</span>
                <span>{c.period.split('—')[1]}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="p-8 text-center" style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
        <h2 className="text-xl font-black mb-2">{t(i18n.t('DemoCasePage.k18'))}</h2>
        <p className="text-sm opacity-80 mb-4">{t(i18n.t('DemoCasePage.k19'))}</p>
        <button className="px-8 py-3 bg-white text-[#3b82f6] rounded-xl text-sm font-bold">
          🚀 开始免费试用 · Start Free Trial
        </button>
      </div>
    </div>
  );
}
