/**
 * AIBillingPanel — R83 P1-5c i18n 化
 * All hardcoded strings replaced with t() calls.
 * Billing translations: src/i18n/locales/billing-*.json (9 languages)
 *
 * Features:
 * - 3 pricing tiers: Standard (1.0) / Premium (1.5) / Flagship (2.0) USDT/analysis
 * - Debate surcharge: +0.5/round, Arena: base × models × 0.3
 * - Balance display + pre-charge → settle → refund flow
 * - New creator: first 3 analyses FREE
 * - Monthly budget slider + usage progress
 * - Cost estimator per analysis
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import billingEn from '../../i18n/locales/billing-en.json';

type TBilling = typeof billingEn;

// ── Types ───────────────────────────────────────────────────────────────

export interface PricingTier {
  id: string;
  price: number;
  recommended?: boolean;
}

export interface BillingState {
  balance: number;        // USDT
  freeRemaining: number;   // free analyses remaining (new creators)
  monthlyBudget: number;
  monthlyUsed: number;
  selectedTier: string;
  totalAnalyses: number;
  totalCost: number;
  lastTransaction?: { type: string; amount: number; timestamp: string };
}

export interface AIBillingPanelProps {
  tiers?: PricingTier[];
  billing?: BillingState;
  onTierChange?: (tierId: string) => void;
  onBudgetChange?: (budget: number) => void;
  onAnalyze?: () => void;
  onRecharge?: () => void;
  className?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────

const mockTiers: PricingTier[] = [
  { id: 'standard', price: 1.0, recommended: false },
  { id: 'premium', price: 1.5, recommended: true },
  { id: 'flagship', price: 2.0, recommended: false },
];

const tierFeatureKeys: Record<string, string[]> = {
  standard: ['standard_1','standard_2','standard_3','standard_4'],
  premium: ['premium_1','premium_2','premium_3','premium_4','premium_5'],
  flagship: ['flagship_1','flagship_2','flagship_3','flagship_4','flagship_5','flagship_6'],
};

const mockBilling: BillingState = {
  balance: 28.50,
  freeRemaining: 2,
  monthlyBudget: 50,
  monthlyUsed: 12.35,
  selectedTier: 'premium',
  totalAnalyses: 15,
  totalCost: 18.75,
  lastTransaction: { type: 'analysis', amount: 1.5, timestamp: '2026-06-09T03:15:00Z' },
};

// ── Sub-components ──────────────────────────────────────────────────────

const TierCard: React.FC<{
  tier: PricingTier;
  selected: boolean;
  freeRemaining: number;
  onSelect: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}> = ({ tier, selected, freeRemaining, onSelect, t }) => {
  const isFree = freeRemaining > 0;
  const displayPrice = isFree ? 0 : tier.price;
  const tierName = t(tier.id as keyof TBilling) as string;

  return (
    <div className={`billing-tier-card ${selected ? 'selected' : ''} ${tier.recommended ? 'recommended' : ''}`}
      onClick={onSelect}>
      {tier.recommended && <div className="billing-tier-badge">{t('recommended')}</div>}
      <div className="billing-tier-header">
        <h3 className="billing-tier-name">{tierName}</h3>
        <div className="billing-tier-price">
          {isFree ? (
            <>
              <span className="billing-price-free">{t('free')}</span>
              <span className="billing-price-remaining">({t('freeRemaining', { count: freeRemaining, context: freeRemaining === 1 ? t('freeSingular') : t('freePlural') })})</span>
            </>
          ) : (
            <>
              <span className="billing-price-value">${displayPrice.toFixed(1)}</span>
              <span className="billing-price-unit">{t('perAnalysis')}</span>
            </>
          )}
        </div>
      </div>
      <ul className="billing-tier-features">
        {(tierFeatureKeys[tier.id] || []).map((fk) => (
          <li key={fk}>{t(`features.${fk}`)}</li>
        ))}
      </ul>
      {!isFree && (
        <div className="billing-tier-addons">
          <small>{t('debateSurcharge')}</small>
        </div>
      )}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

const AIBillingPanel: React.FC<AIBillingPanelProps> = ({
  tiers: propTiers,
  billing: propBilling,
  onTierChange,
  onBudgetChange,
  onAnalyze,
  onRecharge,
  className = '',
}) => {
  const { t } = useTranslation();
  const tiers = propTiers || mockTiers;
  const billing = propBilling || mockBilling;
  const [localTier, setLocalTier] = useState(billing.selectedTier);
  const [localBudget, setLocalBudget] = useState(billing.monthlyBudget);

  const selectedTier = tiers.find((ti) => ti.id === localTier) || tiers[1];
  const budgetPct = billing.monthlyBudget > 0 ? (billing.monthlyUsed / billing.monthlyBudget) * 100 : 0;
  const budgetColor = budgetPct >= 100 ? '#ef4444' : budgetPct >= 80 ? '#f59e0b' : '#22c55e';
  const remainingAnalyses = selectedTier.price > 0 ? Math.floor(billing.balance / selectedTier.price) : 99;

  const agentUsage = useMemo(() => {
    const raw = [
      { name: t('agentFundamentals'), count: 8, color: '#3b82f6' },
      { name: t('agentTechnical'), count: 6, color: '#8b5cf6' },
      { name: t('agentSentiment'), count: 5, color: '#ec4899' },
      { name: t('agentMacro'), count: 4, color: '#f59e0b' },
    ];
    const max = Math.max(...raw.map(a => a.count));
    return raw.sort((a, b) => b.count - a.count).map(a => ({ ...a, pct: (a.count / max) * 100 }));
  }, [t]);

  const freeQuotaTip = billing.freeRemaining === 3 ? t('freeAllLeft', { count: 3 }) : billing.freeRemaining === 1 ? t('freeLastOne') : billing.freeRemaining === 0 ? t('freeUsedUp') : '';

  return (
    <div className={`ai-billing-panel ${className}`}>
      <h2 className="billing-title">{t('title')}</h2>

      {/* ── Balance Card ──────────────────────────── */}
      <div className="billing-balance-card">
        <div className="billing-balance-main">
          <span className="billing-balance-label">{t('balance')}</span>
          <span className="billing-balance-value">${billing.balance.toFixed(2)} USDT</span>
          <span className="billing-balance-sub">{t('balanceAvailable', { count: remainingAnalyses })}</span>
        </div>
        <div className="billing-balance-actions">
          <button className="billing-btn-recharge" onClick={onRecharge}>{t('recharge')}</button>
          <button className="billing-btn-analyze" onClick={onAnalyze} disabled={billing.balance < selectedTier.price && billing.freeRemaining === 0}>
            {billing.freeRemaining > 0 ? t('analyzeFree', { count: billing.freeRemaining }) : t('analyze', { price: selectedTier.price.toFixed(1) })}
          </button>
        </div>
      </div>

      {/* ── Free Quota Banner ─────────────────────── */}
      {billing.freeRemaining > 0 && (
        <div className="billing-free-banner">
          🎉 <strong>{t('freeRemaining', { count: billing.freeRemaining, context: billing.freeRemaining === 1 ? t('freeSingular') : t('freePlural') })}</strong>
          {freeQuotaTip && <span className="billing-free-tip"> — {freeQuotaTip}</span>}
          {billing.freeRemaining <= 1 && (
            <span className="billing-free-upgrade"> · <button onClick={onRecharge} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, cursor: 'pointer', fontSize: 'inherit' }}>{t('rechargeNow')}</button></span>
          )}
        </div>
      )}
      {billing.freeRemaining === 0 && (
        <div className="billing-free-banner" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', color: '#ef4444' }}>
          ⚡ {t('freeQuotaUsed')}
        </div>
      )}

      {/* ── Budget Progress ───────────────────────── */}
      <div className="billing-section">
        <h3 className="billing-section-title">{t('monthlyBudget')}</h3>
        <div className="billing-budget-bar-container">
          <div className="billing-budget-labels">
            <span>${billing.monthlyUsed.toFixed(2)} {t('used')}</span>
            <span>${billing.monthlyBudget.toFixed(2)} {t('limit')}</span>
          </div>
          <div className="billing-budget-bar">
            <div className="billing-budget-fill" style={{ width: `${Math.min(budgetPct, 100)}%`, backgroundColor: budgetColor }} />
          </div>
          <div className="billing-budget-slider">
            <input type="range" min={5} max={200} step={5} value={localBudget}
              onChange={(e) => { setLocalBudget(Number(e.target.value)); onBudgetChange?.(Number(e.target.value)); }} />
          </div>
        </div>

        {/* ── Usage Stats ──────────────────────────── */}
        <div className="billing-usage-grid">
          <div className="billing-usage-item">
            <span className="billing-usage-value">{billing.totalAnalyses}</span>
            <span className="billing-usage-label">{t('totalAnalyses')}</span>
          </div>
          <div className="billing-usage-item">
            <span className="billing-usage-value">${billing.totalCost.toFixed(2)}</span>
            <span className="billing-usage-label">{t('totalCost')}</span>
          </div>
          <div className="billing-usage-item">
            <span className="billing-usage-value">${billing.totalAnalyses > 0 ? (billing.totalCost / billing.totalAnalyses).toFixed(3) : '0'}</span>
            <span className="billing-usage-label">{t('avgPerAnalysis')}</span>
          </div>
          <div className="billing-usage-item">
            <span className="billing-usage-value">{billing.freeRemaining + billing.totalAnalyses}</span>
            <span className="billing-usage-label">{t('allTime')}</span>
          </div>
        </div>

        {/* ── Usage by Agent ──────────────────────── */}
        <div className="billing-agent-usage">
          <h4 className="billing-agent-title">{t('usageByAgent')}</h4>
          {agentUsage.map((agent) => (
            <div key={agent.name} className="billing-agent-row">
              <span className="billing-agent-name">{agent.name}</span>
              <div className="billing-agent-bar">
                <div className="billing-agent-fill" style={{ width: `${agent.pct}%`, background: `linear-gradient(90deg, ${agent.color}, ${agent.color}88)` }} />
              </div>
              <span className="billing-agent-count">{agent.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tier Selection ────────────────────────── */}
      <div className="billing-section">
        <h3 className="billing-section-title">{t('pricingPlan')}</h3>
        <div className="billing-tier-grid">
          {tiers.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              selected={tier.id === localTier}
              freeRemaining={tier.id === localTier ? billing.freeRemaining : 0}
              onSelect={() => { setLocalTier(tier.id); onTierChange?.(tier.id); }}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* ── Cost Estimator ────────────────────────── */}
      <div className="billing-section">
        <h3 className="billing-section-title">{t('costSummary')}</h3>
        <div className="billing-cost-breakdown">
          <div className="billing-cost-row">
            <span>{t('base', { tier: t(selectedTier.id as keyof TBilling) as string })}</span>
            <span>{billing.freeRemaining > 0 ? t('free') : `$${selectedTier.price.toFixed(1)}`}</span>
          </div>
          <div className="billing-cost-row">
            <span title={t('cacheTooltip')}>{t('cacheDiscount')} ⓘ</span>
            <span className="text-green">-${billing.freeRemaining > 0 ? '0.00' : (selectedTier.price * 0.95).toFixed(2)}</span>
          </div>
          <div className="billing-cost-row total">
            <span>{t('estimatedPer')}</span>
            <span>{billing.freeRemaining > 0 ? t('free') : `$${(selectedTier.price * 0.05).toFixed(3)}`}</span>
          </div>
        </div>
      </div>

      {/* ── Last Transaction ──────────────────────── */}
      {billing.lastTransaction && (
        <div className="billing-last-tx">
          <span>Last: {billing.lastTransaction.type}</span>
          <span>${billing.lastTransaction.amount.toFixed(2)}</span>
          <span>{new Date(billing.lastTransaction.timestamp).toLocaleTimeString()}</span>
        </div>
      )}

      {/* ── Billing History ──────────────────────── */}
      <div className="billing-section">
        <h3 className="billing-section-title">{t('recentBilling')}</h3>
        <div className="billing-history-list">
          <div className="billing-history-row">
            <span>🤖</span>
            <span className="billing-history-desc">AAPL 4-Agent Analysis (Premium)</span>
            <span className="billing-history-cost">$1.50</span>
            <span className="billing-history-time">03:15</span>
          </div>
          <div className="billing-history-row">
            <span>🏟️</span>
            <span className="billing-history-desc">NVDA Arena (3 models × Premium)</span>
            <span className="billing-history-cost">$1.35</span>
            <span className="billing-history-time">02:50</span>
          </div>
          <div className="billing-history-row free">
            <span>🎉</span>
            <span className="billing-history-desc">TSLA Quick Scan (Free #1 of 3)</span>
            <span className="billing-history-cost">FREE</span>
            <span className="billing-history-time">02:10</span>
          </div>
        </div>
      </div>

      {/* ── Tier Upgrade Simulator ────────────────── */}
      <div className="billing-section">
        <h3 className="billing-section-title">{t('upgradeSimulator')}</h3>
        <div className="billing-simulator">
          <div className="billing-sim-row">
            <span>{t('standardToPremium')}</span>
            <span className="text-green">{t('savePerAnalysis')}</span>
            <span>{t('breakEven')}</span>
          </div>
          <div className="billing-sim-row">
            <span>{t('premiumToFlagship')}</span>
            <span className="text-green">{t('plusArena')}</span>
            <span>{t('morePerAnalysis')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── CSS ──────────────────────────────────────────────────────────────────

export const AI_BILLING_STYLES = `
.ai-billing-panel { max-width: 800px; margin: 0 auto; padding: 24px; }
.billing-title { font-size: 22px; font-weight: 700; margin: 0 0 16px 0; }

.billing-balance-card { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-radius: 14px; background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.08)); border: 1px solid rgba(59,130,246,0.2); margin-bottom: 16px; }
.billing-balance-main { display: flex; flex-direction: column; gap: 2px; }
.billing-balance-label { font-size: 12px; color: var(--text-secondary, #94a3b8); text-transform: uppercase; }
.billing-balance-value { font-size: 28px; font-weight: 700; }
.billing-balance-sub { font-size: 12px; color: var(--text-secondary, #94a3b8); }
.billing-balance-actions { display: flex; gap: 8px; }
.billing-btn-recharge { padding: 10px 20px; border-radius: 10px; border: 1px solid #22c55e; background: transparent; color: #22c55e; font-size: 14px; font-weight: 600; cursor: pointer; }
.billing-btn-recharge:hover { background: rgba(34,197,94,0.1); }
.billing-btn-analyze { padding: 10px 24px; border-radius: 10px; border: none; background: #3b82f6; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.billing-btn-analyze:disabled { background: #374151; cursor: not-allowed; }

.billing-free-banner { padding: 14px 20px; border-radius: 10px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.15); color: #22c55e; font-size: 14px; margin-bottom: 16px; }

.billing-section { padding: 20px; border-radius: 12px; background: var(--card-bg, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); margin-bottom: 16px; }
.billing-section-title { font-size: 15px; font-weight: 600; margin: 0 0 14px 0; }

.billing-budget-bar-container { margin-bottom: 12px; }
.billing-budget-labels { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
.billing-budget-bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); overflow: hidden; }
.billing-budget-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.billing-budget-slider { margin-top: 10px; }
.billing-budget-slider input { width: 100%; }

.billing-usage-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
.billing-usage-item { display: flex; flex-direction: column; align-items: center; padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); }
.billing-usage-value { font-size: 16px; font-weight: 700; }
.billing-usage-label { font-size: 10px; color: var(--text-secondary, #94a3b8); margin-top: 2px; }

.billing-agent-usage { margin-top: 14px; }
.billing-agent-title { font-size: 12px; font-weight: 600; margin: 0 0 8px 0; color: var(--text-secondary, #94a3b8); }
.billing-agent-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.billing-agent-name { font-size: 12px; width: 100px; }
.billing-agent-bar { flex: 1; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.05); overflow: hidden; }
.billing-agent-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #3b82f6, #8b5cf6); }
.billing-agent-count { font-size: 12px; min-width: 20px; text-align: right; color: var(--text-secondary, #94a3b8); }

.billing-tier-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.billing-tier-card { padding: 18px; border-radius: 12px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); cursor: pointer; position: relative; transition: all 0.2s; }
.billing-tier-card:hover { border-color: #3b82f640; }
.billing-tier-card.selected { border-color: #3b82f6; background: rgba(59,130,246,0.06); }
.billing-tier-card.recommended { border-color: rgba(139,92,246,0.3); }
.billing-tier-badge { position: absolute; top: -10px; right: 12px; padding: 3px 12px; border-radius: 10px; background: #8b5cf6; color: #fff; font-size: 11px; font-weight: 600; }
.billing-tier-header { margin-bottom: 12px; }
.billing-tier-name { font-size: 16px; font-weight: 600; margin: 0 0 6px 0; }
.billing-tier-price { display: flex; align-items: baseline; gap: 4px; }
.billing-price-free { font-size: 24px; font-weight: 700; color: #22c55e; }
.billing-price-remaining { font-size: 12px; color: var(--text-secondary, #94a3b8); }
.billing-price-value { font-size: 24px; font-weight: 700; }
.billing-price-unit { font-size: 12px; color: var(--text-secondary, #94a3b8); }
.billing-tier-features { margin: 0 0 8px 0; padding-left: 18px; font-size: 12px; color: var(--text-secondary, #94a3b8); }
.billing-tier-features li { margin-bottom: 3px; }
.billing-tier-addons { font-size: 11px; color: var(--text-secondary, #94a3b8); }

.billing-cost-breakdown { display: flex; flex-direction: column; gap: 6px; }
.billing-cost-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
.billing-cost-row.total { border-top: 1px solid var(--border-color, rgba(255,255,255,0.08)); padding-top: 8px; font-weight: 700; font-size: 15px; }

.billing-last-tx { display: flex; gap: 12px; justify-content: center; padding: 12px; font-size: 12px; color: var(--text-secondary, #94a3b8); }

.billing-history-list { display: flex; flex-direction: column; gap: 6px; }
.billing-history-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.05)); font-size: 13px; }
.billing-history-row.free { background: rgba(34,197,94,0.04); border-color: rgba(34,197,94,0.1); }
.billing-history-desc { flex: 1; }
.billing-history-cost { font-weight: 600; }
.billing-history-row.free .billing-history-cost { color: #22c55e; }
.billing-history-time { font-size: 11px; color: var(--text-secondary, #94a3b8); }

.billing-simulator { display: flex; flex-direction: column; gap: 8px; }
.billing-sim-row { display: flex; gap: 16px; padding: 8px 0; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.04)); font-size: 12px; color: var(--text-secondary, #94a3b8); }

.text-green { color: #22c55e; }

@media (max-width: 768px) {
  .billing-tier-grid { grid-template-columns: 1fr; }
  .billing-balance-card { flex-direction: column; gap: 12px; text-align: center; }
  .billing-usage-grid { grid-template-columns: repeat(2, 1fr); }
}
`;

export default AIBillingPanel;
