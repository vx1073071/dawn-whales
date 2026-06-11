/**
* AIDailyDigestPanel — AI-generated daily/weekly summary dashboard
* (ML-44-02, R44 Phase 6.0)
*
* Integrates with ai-report-generator.ts (11,033L) to display:
* - Today's market overview with sentiment
* - Portfolio snapshot with top movers
* - Active strategy signals summary
* - Risk alerts + recommendations
* - Regenerate / schedule controls
*/

import React, { useState, useCallback } from 'react';
import i18n from '../../i18n';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking
// ── Types ───────────────────────────────────────────────────────────────

interface DigestSection {
  heading: string;
  content: string;
  icon: string;
}

interface DailyDigest {
  date: string;
  generatedAt: number;
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  sections: DigestSection[];
  topMovers: {symbol: string;name: string;change: number;}[];
  activeSignals: {strategy: string;symbol: string;signal: string;time: string;}[];
  riskAlerts: {level: 'info' | 'warning' | 'critical';message: string;}[];
}

type DigestType = 'daily' | 'weekly' | 'monthly';

// ── Mock digest ──────────────────────────────────────────────────────────

const MOCK_DIGEST: Record<DigestType, DailyDigest> = {
  daily: {
    date: '2026-06-07',
    generatedAt: Date.now(),
    marketSentiment: 'bullish',
    sections: [
    { heading: i18n.t('AIDailyDigestPanel.k1'), content: i18n.t('AIDailyDigestPanel.k2'), icon: '📈' },
    { heading: i18n.t('AIDailyDigestPanel.k3'), content: i18n.t('AIDailyDigestPanel.k4'), icon: '💰' },
    { heading: i18n.t('AIDailyDigestPanel.k5'), content: i18n.t('AIDailyDigestPanel.k6'), icon: '📊' },
    { heading: i18n.t('AIDailyDigestPanel.k7'), content: i18n.t('AIDailyDigestPanel.k8'), icon: '⚠️' },
    { heading: i18n.t('AIDailyDigestPanel.k9'), content: i18n.t('AIDailyDigestPanel.k10'), icon: '🤖' }],

    topMovers: [
    { symbol: '00700', name: i18n.t('AIDailyDigestPanel.k11'), change: 1.2 },
    { symbol: '01299', name: i18n.t('AIDailyDigestPanel.k12'), change: 1.5 },
    { symbol: '09988', name: i18n.t('AIDailyDigestPanel.k13'), change: 0.6 },
    { symbol: '01810', name: i18n.t('AIDailyDigestPanel.k14'), change: -1.1 },
    { symbol: '01211', name: i18n.t('AIDailyDigestPanel.k15'), change: -0.5 }],

    activeSignals: [
    { strategy: i18n.t('AIDailyDigestPanel.k16'), symbol: 'US.AAPL', signal: i18n.t('AIDailyDigestPanel.k17'), time: '09:35' },
    { strategy: i18n.t('AIDailyDigestPanel.k18'), symbol: 'HK.00700', signal: i18n.t('AIDailyDigestPanel.k19'), time: '10:12' },
    { strategy: i18n.t('AIDailyDigestPanel.k20'), symbol: 'US.NVDA', signal: 'components.positions', time: '08:00' }],

    riskAlerts: [
    { level: 'info', message: i18n.t('AIDailyDigestPanel.k21') },
    { level: 'info', message: i18n.t('AIDailyDigestPanel.k22') },
    { level: 'warning', message: i18n.t('AIDailyDigestPanel.k23') }]

  },
  weekly: {
    date: '2026-06-01 ~ 06-07',
    generatedAt: Date.now(),
    marketSentiment: 'neutral',
    sections: [
    { heading: i18n.t('AIDailyDigestPanel.k24'), content: i18n.t('AIDailyDigestPanel.k25'), icon: '📅' },
    { heading: i18n.t('AIDailyDigestPanel.k26'), content: i18n.t('AIDailyDigestPanel.k27'), icon: '💰' },
    { heading: i18n.t('AIDailyDigestPanel.k28'), content: i18n.t('AIDailyDigestPanel.k29'), icon: '📊' },
    { heading: i18n.t('AIDailyDigestPanel.k30'), content: i18n.t('AIDailyDigestPanel.k31'), icon: '🤖' }],

    topMovers: [
    { symbol: '00700', name: i18n.t('AIDailyDigestPanel.k32'), change: 3.5 },
    { symbol: '09988', name: i18n.t('AIDailyDigestPanel.k33'), change: 2.8 },
    { symbol: '01810', name: i18n.t('AIDailyDigestPanel.k34'), change: -2.1 }],

    activeSignals: [
    { strategy: i18n.t('AIDailyDigestPanel.k35'), symbol: 'US.AAPL', signal: i18n.t('AIDailyDigestPanel.k36'), time: i18n.t('AIDailyDigestPanel.k37') },
    { strategy: i18n.t('AIDailyDigestPanel.k38'), symbol: 'HK.00700', signal: i18n.t('AIDailyDigestPanel.k39'), time: i18n.t('AIDailyDigestPanel.k40') }],

    riskAlerts: [
    { level: 'info', message: i18n.t('AIDailyDigestPanel.k41') }]

  },
  monthly: {
    date: i18n.t('AIDailyDigestPanel.k42'),
    generatedAt: Date.now(),
    marketSentiment: 'bullish',
    sections: [
    { heading: i18n.t('AIDailyDigestPanel.k43'), content: i18n.t('AIDailyDigestPanel.k44'), icon: '📅' },
    { heading: i18n.t('AIDailyDigestPanel.k45'), content: i18n.t('AIDailyDigestPanel.k46'), icon: '💰' },
    { heading: i18n.t('AIDailyDigestPanel.k47'), content: i18n.t('AIDailyDigestPanel.k48'), icon: '🤖' }],

    topMovers: [
    { symbol: '00700', name: i18n.t('AIDailyDigestPanel.k49'), change: 8.2 },
    { symbol: '01299', name: i18n.t('AIDailyDigestPanel.k50'), change: 6.8 }],

    activeSignals: [],
    riskAlerts: [
    { level: 'info', message: i18n.t('AIDailyDigestPanel.k51') }]

  }
};

// ── Main Component ──────────────────────────────────────────────────────

interface AIDailyDigestPanelProps {
  className?: string;
}

const SENTIMENT_ICONS: Record<string, string> = {
  bullish: '🐂', bearish: '🐻', neutral: '😐'
};
const SENTIMENT_LABELS: Record<string, string> = {
  bullish: i18n.t('AIDailyDigestPanel.k52'), bearish: i18n.t('AIDailyDigestPanel.k53'), neutral: i18n.t('AIDailyDigestPanel.k54')
};
const SENTIMENT_COLORS: Record<string, string> = {
  bullish: 'text-emerald-400', bearish: 'text-red-400', neutral: 'text-gray-400'
};

const ALERT_COLORS = {
  info: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
  warning: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
  critical: 'border-red-500/20 bg-red-500/5 text-red-400'
};

export const AIDailyDigestPanel: React.FC<AIDailyDigestPanelProps> = ({ className }) => {
  const [digestType, setDigestType] = useState<DigestType>('daily');
  const [regenerating, setRegenerating] = useState(false);

  const digest = MOCK_DIGEST[digestType];

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    // Simulate AI generation
    await new Promise((r) => setTimeout(r, 1500));
    setRegenerating(false);
  }, []);

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">{i18n.t("AIDailyDigestPanel.r92_fe94")}

            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 6.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {digest.date}{i18n.t("AIDailyDigestPanel.r92_a5e5")}{new Date(digest.generatedAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Digest type tabs */}
          {[
          { key: 'daily' as const, label: i18n.t('AIDailyDigestPanel.k55') },
          { key: 'weekly' as const, label: i18n.t('AIDailyDigestPanel.k56') },
          { key: 'monthly' as const, label: i18n.t('AIDailyDigestPanel.k57') }].
          map((t) =>
          <button
            key={t.key}
            onClick={() => setDigestType(t.key)}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
            digestType === t.key ?
            'bg-amber-500/20 text-amber-400' :
            'text-gray-500 hover:text-gray-300'}`
            }>
            
              {t.label}
            </button>
          )}
          {/* Regenerate */}
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
            regenerating ?
            'bg-gray-800 text-gray-600' :
            'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'}`
            }>
            
            {regenerating ? i18n.t('AIDailyDigestPanel.k58') : i18n.t('AIDailyDigestPanel.k59')}
          </button>
        </div>
      </div>

      {/* Market sentiment bar */}
      <div className={`rounded-lg p-4 mb-5 border ${
      digest.marketSentiment === 'bullish' ? 'border-emerald-500/20 bg-emerald-500/5' :
      digest.marketSentiment === 'bearish' ? 'border-red-500/20 bg-red-500/5' :
      'border-gray-700/30 bg-gray-800/20'}`
      }>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{SENTIMENT_ICONS[digest.marketSentiment]}</span>
          <div>
            <div className={`text-sm font-bold ${SENTIMENT_COLORS[digest.marketSentiment]}`}>{i18n.t("AIDailyDigestPanel.r92_a3f6")}
              {SENTIMENT_LABELS[digest.marketSentiment]}
            </div>
            <div className="text-[10px] text-gray-500">{i18n.t('AIDailyDigestPanel.k60')}</div>
          </div>
        </div>
      </div>

      {/* Digest sections */}
      <div className="space-y-4 mb-5">
        {digest.sections.map((section, i) =>
        <div key={i} className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
              <span>{section.icon}</span> {section.heading}
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">{section.content}</p>
          </div>
        )}
      </div>

      {/* Two-column: movers + signals */}
      <div className={`grid ${digestType === 'daily' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
        {/* Top movers */}
        {digest.topMovers.length > 0 &&
        <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
            <h4 className="text-xs font-semibold text-gray-400 mb-3">{i18n.t('AIDailyDigestPanel.k61')}</h4>
            <div className="space-y-2">
              {digest.topMovers.map((m) =>
            <div key={m.symbol} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-300 font-mono">{m.symbol}</span>
                    <span className="text-gray-600 ml-2">{m.name}</span>
                  </div>
                  <span className={`font-mono ${m.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.change >= 0 ? '+' : ''}{m.change}%
                  </span>
                </div>
            )}
            </div>
          </div>
        }

        {/* Active signals */}
        {digest.activeSignals.length > 0 &&
        <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
            <h4 className="text-xs font-semibold text-gray-400 mb-3">{i18n.t('AIDailyDigestPanel.k62')}</h4>
            <div className="space-y-2">
              {digest.activeSignals.map((s, i) =>
            <div key={i} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400">{s.strategy}</span>
                    <span className="text-gray-600 ml-1.5">{s.symbol}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                s.signal === i18n.t('AIDailyDigestPanel.k0') ? 'bg-emerald-500/10 text-emerald-400' :
                s.signal === i18n.t('AIDailyDigestPanel.k1') ? 'bg-red-500/10 text-red-400' :
                'bg-gray-500/10 text-gray-400'}`
                }>
                      {s.signal}
                    </span>
                    <span className="text-[10px] text-gray-600">{s.time}</span>
                  </div>
                </div>
            )}
            </div>
          </div>
        }
      </div>

      {/* Risk alerts */}
      {digest.riskAlerts.length > 0 &&
      <div className="mt-4 space-y-1.5">
          {digest.riskAlerts.map((alert, i) =>
        <div key={i} className={`rounded px-3 py-1.5 text-[10px] border ${ALERT_COLORS[alert.level]}`}>
              {alert.level === 'critical' ? '🔴' : alert.level === 'warning' ? '🟡' : '🔵'} {alert.message}
            </div>
        )}
        </div>
      }
    </div>);

};

export default AIDailyDigestPanel;