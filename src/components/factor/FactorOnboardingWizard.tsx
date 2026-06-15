// ── R193 ML P9-01: FactorOnboardingWizard — 3步入门向导 ──────────
// Step 1: Welcome → 2: Market (HK/US/Crypto) → 3: Scenario Pack → Done
// Animated stepper, market badges with flags, scenario preset cards
// localStorage remembers completion, skip button on all steps
// Final step shows recommended factor subset

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Steps, Card, Tag, Progress } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
type MarketId = 'hk' | 'us' | 'crypto';

interface ScenarioPack {
  id: string;
  name: string;
  description: string;
  icon: string;
  factorCount: number;
  tags: string[];
  recommended?: boolean;
  factorIds: string[];
}

interface FactorOnboardingWizardProps {
  onComplete?: (selections: OnboardingSelections) => void;
  onSkip?: () => void;
  demoMode?: boolean;
}

interface OnboardingSelections {
  markets: MarketId[];
  scenarioPacks: string[];
}

// ── Data ─────────────────────────────────────────────────────────────
const MARKET_OPTIONS: { id: MarketId; name: string; flag: string; desc: string; factorCount: number }[] = [
  { id: 'hk', name: 'Hong Kong', flag: '🇭🇰', desc: 'H-shares, red chips, CBBC, warrants. 11 market-exclusive factors.', factorCount: 89 },
  { id: 'us', name: 'US Market', flag: '🇺🇸', desc: 'NYSE + Nasdaq. Options, 0DTE, Mag7 momentum. 14 exclusive factors.', factorCount: 99 },
  { id: 'crypto', name: 'Crypto', flag: '🪙', desc: 'On-chain data, liquidation heatmaps, funding rates. 31 crypto factors.', factorCount: 62 },
];

const SCENARIO_PACKS: ScenarioPack[] = [
  {
    id: 'value-dividend',
    name: 'Value & Dividend Hunter',
    description: 'Find undervalued stocks with strong dividends. PE ratio, PB, dividend yield, FCF yield.',
    icon: '💎',
    factorCount: 12,
    tags: ['value', 'dividend', 'defensive'],
    recommended: true,
    factorIds: ['PE_RATIO', 'PB_RATIO', 'DIVIDEND_YIELD', 'FCF_YIELD', 'EV_EBITDA', 'GRAHAM_NET', 'CASHFLOW_YIELD', 'SALES_TO_PRICE', 'PEG_RATIO', 'EBITDA_EV', 'PRICE_BOOK', 'NET_NET'],
  },
  {
    id: 'momentum-growth',
    name: 'Momentum & Growth',
    description: 'Ride trends and capture growth acceleration. Price momentum, earnings surprises, analyst revisions.',
    icon: '🚀',
    factorCount: 14,
    tags: ['momentum', 'growth', 'earnings'],
    factorIds: ['MOM_12M1M', 'MOM_6M', 'SHORT_TERM_REVERSAL', 'EARNINGS_SURPRISE', 'ANALYST_REVISION', 'REVENUE_GROWTH', 'EARNINGS_GROWTH', 'MAG7_MOMENTUM', 'POST_EARNINGS_DRIFT', 'GUIDANCE_CHANGE', 'ILM_ANALYST', 'ANALYST_DISPERSION', 'EARNINGS_MOVE', 'GAP_FILL'],
  },
  {
    id: 'quality-lowvol',
    name: 'Quality & Low Volatility',
    description: 'Safe, profitable companies with low risk. ROIC, margins, accruals, BAB, downside protection.',
    icon: '🛡️',
    factorCount: 11,
    tags: ['quality', 'lowvol', 'defensive'],
    factorIds: ['ROIC', 'ROE', 'ASSET_TURNOVER', 'ACCRUALS', 'PIOTROSKI_F', 'BAB', 'IDIO_VOL', 'DOWNSIDE_VOL', 'PROFITABILITY', 'MIN_VOLATILITY', 'ALTMAN_Z'],
  },
  {
    id: 'options-derivatives',
    name: 'Options & Derivatives Pro',
    description: 'Advanced options signals. Gamma exposure, max pain, IV skew, 0DTE flow, VRP.',
    icon: '🎯',
    factorCount: 12,
    tags: ['options', 'derivatives', 'advanced'],
    factorIds: ['GAMMA_EXPOSURE', 'MAX_PAIN', 'IV_SKEW', 'IV_RANK_ADVANCED', 'IV_TERM_STRUCT', 'VRP', '0DTE_RATIO', 'PUT_CALL_RATIO', 'OPTION_FLOW', 'IMPLIED_CORRELATION', 'SKEW_INDEX', 'OPTION_SKEW'],
  },
  {
    id: 'crypto-onchain',
    name: 'Crypto On-Chain Master',
    description: 'Deep on-chain analysis. Exchange flows, miner data, stablecoin minting, whale tracking.',
    icon: '⛓️',
    factorCount: 14,
    tags: ['crypto', 'onchain', 'blockchain'],
    factorIds: ['CRYPTO_EXCHANGE_FLOW', 'CRYPTO_STABLECOIN_RATIO', 'CRYPTO_MINER_RESERVE', 'CRYPTO_WHALE_ACTIVITY', 'CRYPTO_FUNDING_RATE', 'CRYPTO_PUELL', 'CRYPTO_MVRV_Z', 'CRYPTO_HODL_WAVE', 'CRYPTO_FUNDING_EXTREME', 'CRYPTO_LIQUIDATION_MAP', 'CRYPTO_NFT_VOLUME', 'CRYPTO_BRIDGE_FLOW', 'CRYPTO_STABLECOIN_MINT', 'CRYPTO_MINER_FLOW'],
  },
  {
    id: 'sentiment-macro',
    name: 'Sentiment & Macro Radar',
    description: 'News NLP, social sentiment, macro regime. Short interest, retail flow, GDP beta.',
    icon: '📡',
    factorCount: 12,
    tags: ['sentiment', 'macro', 'news'],
    factorIds: ['SHORT_INTEREST', 'SHORT_SQUEEZE', 'NEWS_SENTIMENT', 'RETAIL_SENTIMENT', 'GDP_BETA', 'RATE_SENSITIVITY', 'INFLATION_BETA', 'VOLATILITY_REGIME', 'CROSS_ASSET_CORR', 'SHORT_CROWDING', 'ESG_SCORE', 'APP_DOWNLOADS'],
  },
];

// ── Component ────────────────────────────────────────────────────────
const FactorOnboardingWizard: React.FC<FactorOnboardingWizardProps> = ({
  onComplete,
  onSkip,
  demoMode = true,
}) => {
  const [step, setStep] = useState(0);
  const [markets, setMarkets] = useState<MarketId[]>([]);
  const [packs, setPacks] = useState<string[]>([]);
  const [animating, setAnimating] = useState(false);

  const toggleMarket = useCallback((id: MarketId) => {
    setMarkets((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }, []);

  const togglePack = useCallback((id: string) => {
    setPacks((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const nextStep = () => {
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setAnimating(false);
    }, 300);
  };

  const prevStep = () => {
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s - 1);
      setAnimating(false);
    }, 300);
  };

  const finish = () => {
    const selections: OnboardingSelections = { markets, scenarioPacks: packs };
    localStorage.setItem('factor-onboarding-done', 'true');
    localStorage.setItem('factor-onboarding-selections', JSON.stringify(selections));
    onComplete?.(selections);
  };

  const skip = () => {
    localStorage.setItem('factor-onboarding-skipped', 'true');
    onSkip?.();
  };

  // Auto-advance animation
  useEffect(() => {
    if (animating) {
      const t = setTimeout(() => setAnimating(false), 350);
      return () => clearTimeout(t);
    }
  }, [animating]);

  const totalFactors = packs.reduce((sum, pid) => {
    const pack = SCENARIO_PACKS.find((p) => p.id === pid);
    return sum + (pack?.factorCount || 0);
  }, 0);

  const progress = ((step + 1) / 3) * 100;

  return (
    <div style={styles.overlay}>
      <Card style={styles.wizard} bodyStyle={{ padding: 0 }}>
        {/* Progress Bar */}
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>

        {/* Steps Indicator */}
        <div style={styles.stepsRow}>
          <Steps
            current={step}
            size="small"
            items={[
              { title: 'Welcome' },
              { title: 'Market' },
              { title: 'Scenarios' },
            ]}
          />
        </div>

        {/* Step Content */}
        <div
          style={{
            ...styles.stepContent,
            opacity: animating ? 0 : 1,
            transform: animating ? 'translateX(20px)' : 'translateX(0)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
          }}
        >
          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div style={styles.welcomeStep}>
              <div style={styles.welcomeHero}>🧬</div>
              <h2 style={styles.welcomeTitle}>Welcome to Factor Universe</h2>
              <p style={styles.welcomeDesc}>
                Dawn Whales now offers <b>188 professional factors</b> across 3 markets.
                Let's find the ones that match your trading style.
              </p>
              <div style={styles.statGrid}>
                <div style={styles.stat}>
                  <span style={styles.statNum}>188</span>
                  <span style={styles.statLabel}>Factors</span>
                </div>
                <div style={styles.stat}>
                  <span style={styles.statNum}>3</span>
                  <span style={styles.statLabel}>Markets</span>
                </div>
                <div style={styles.stat}>
                  <span style={styles.statNum}>6</span>
                  <span style={styles.statLabel}>Scenario Packs</span>
                </div>
              </div>
              <Tag color="gold" style={{ fontSize: 12 }}>3 steps · ~1 min</Tag>
            </div>
          )}

          {/* ── Step 1: Market Selection ── */}
          {step === 1 && (
            <div style={styles.marketStep}>
              <h3 style={styles.stepTitle}>🌍 Choose Your Markets</h3>
              <p style={styles.stepDesc}>Select one or more markets. You can change this anytime.</p>
              <div style={styles.marketGrid}>
                {MARKET_OPTIONS.map((m) => {
                  const selected = markets.includes(m.id);
                  return (
                    <Card
                      key={m.id}
                      size="small"
                      style={{
                        ...styles.marketCard,
                        borderColor: selected ? '#d4a853' : '#2a2a4a',
                        background: selected ? '#1e1e3a' : '#0f0f1e',
                        boxShadow: selected ? '0 0 12px rgba(212, 168, 83, 0.2)' : 'none',
                      }}
                      onClick={() => toggleMarket(m.id)}
                    >
                      <div style={styles.marketFlag}>{m.flag}</div>
                      <div style={styles.marketName}>{m.name}</div>
                      <div style={styles.marketDesc}>{m.desc}</div>
                      <Tag color={selected ? 'gold' : 'default'} style={{ marginTop: 8 }}>
                        {m.factorCount} factors
                      </Tag>
                      {selected && <div style={styles.checkmark}>✓</div>}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 2: Scenario Packs ── */}
          {step === 2 && (
            <div style={styles.packStep}>
              <h3 style={styles.stepTitle}>📦 Pick Your Scenario Packs</h3>
              <p style={styles.stepDesc}>
                Each pack bundles related factors. Pick what matches your strategy.
              </p>
              <div style={styles.packGrid}>
                {SCENARIO_PACKS.map((pack) => {
                  const selected = packs.includes(pack.id);
                  return (
                    <Card
                      key={pack.id}
                      size="small"
                      style={{
                        ...styles.packCard,
                        borderColor: selected ? '#d4a853' : '#2a2a4a',
                        background: selected ? '#1e1e3a' : '#0f0f1e',
                        position: 'relative',
                      }}
                      onClick={() => togglePack(pack.id)}
                    >
                      {pack.recommended && (
                        <Tag color="gold" style={styles.recommendedTag}>⭐ Popular</Tag>
                      )}
                      <div style={styles.packHeader}>
                        <span style={styles.packIcon}>{pack.icon}</span>
                        <div>
                          <div style={styles.packName}>{pack.name}</div>
                          <div style={styles.packMeta}>
                            {pack.factorCount} factors · {pack.tags.join(' · ')}
                          </div>
                        </div>
                      </div>
                      <p style={styles.packDesc}>{pack.description}</p>
                      {selected && <div style={styles.checkmark}>✓</div>}
                    </Card>
                  );
                })}
              </div>
              {/* Summary */}
              {packs.length > 0 && (
                <div style={styles.packSummary}>
                  <span>{packs.length} pack{packs.length > 1 ? 's' : ''} selected</span>
                  <span style={styles.packSummaryNum}>{totalFactors} factors unlocked</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div style={styles.footer}>
          {step > 0 ? (
            <Button onClick={prevStep} style={styles.backBtn}>
              ← Back
            </Button>
          ) : (
            <Button onClick={skip} style={styles.skipBtn}>
              Skip for now
            </Button>
          )}
          <div style={{ flex: 1 }} />
          {step < 2 ? (
            <Button
              type="primary"
              onClick={nextStep}
              style={styles.nextBtn}
              disabled={step === 1 && markets.length === 0}
            >
              Continue →
            </Button>
          ) : (
            <Button
              type="primary"
              onClick={finish}
              style={styles.finishBtn}
            >
              🎉 Get Started — {totalFactors > 0 ? `${totalFactors} factors` : 'Browse All'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 460,
    padding: 20,
  },
  wizard: {
    width: '100%',
    maxWidth: 660,
    background: '#1a1a2e',
    border: '1px solid #2a2a4a',
    borderRadius: 14,
    overflow: 'hidden',
  },
  progressBar: {
    height: 3,
    background: '#2a2a4a',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #d4a853, #b8942e)',
    transition: 'width 0.4s ease',
  },
  stepsRow: {
    padding: '20px 24px 0',
  },
  stepContent: {
    padding: '24px',
    minHeight: 260,
  },
  // ── Welcome Step ──
  welcomeStep: {
    textAlign: 'center',
  },
  welcomeHero: {
    fontSize: 48,
    marginBottom: 12,
    animation: 'none',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#e0e0e0',
    margin: '0 0 8px',
  },
  welcomeDesc: {
    fontSize: 13,
    color: '#aaa',
    lineHeight: 1.6,
    margin: '0 0 20px',
  },
  statGrid: {
    display: 'flex',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 16,
  },
  stat: {
    textAlign: 'center',
  },
  statNum: {
    display: 'block',
    fontSize: 24,
    fontWeight: 800,
    color: '#d4a853',
    fontFamily: 'monospace',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
  },
  // ── Market Step ──
  marketStep: {},
  stepTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: '#e0e0e0',
    margin: '0 0 6px',
  },
  stepDesc: {
    fontSize: 12,
    color: '#888',
    margin: '0 0 14px',
  },
  marketGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  marketCard: {
    cursor: 'pointer',
    textAlign: 'center',
    position: 'relative',
    transition: 'all 0.2s ease',
  },
  marketFlag: {
    fontSize: 32,
    marginBottom: 6,
  },
  marketName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  marketDesc: {
    fontSize: 11,
    color: '#888',
    lineHeight: 1.4,
    marginTop: 4,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#d4a853',
    color: '#1a1a2e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
  },
  // ── Pack Step ──
  packStep: {},
  packGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  packCard: {
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.2s ease',
  },
  recommendedTag: {
    position: 'absolute',
    top: 8,
    left: 10,
    fontSize: 10,
    zIndex: 1,
  },
  packHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  packIcon: {
    fontSize: 24,
  },
  packName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  packMeta: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  packDesc: {
    fontSize: 11,
    color: '#aaa',
    margin: '4px 0 0',
    lineHeight: 1.4,
  },
  packSummary: {
    marginTop: 12,
    padding: '8px 12px',
    background: '#0f0f1e',
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#aaa',
  },
  packSummaryNum: {
    color: '#d4a853',
    fontWeight: 700,
  },
  // ── Footer ──
  footer: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 24px',
    borderTop: '1px solid #2a2a4a',
    gap: 10,
  },
  backBtn: {
    color: '#888',
    border: '1px solid #3a3a5a',
    background: 'transparent',
    fontSize: 13,
  },
  skipBtn: {
    color: '#888',
    border: 'none',
    background: 'transparent',
    fontSize: 13,
  },
  nextBtn: {
    background: 'linear-gradient(135deg, #d4a853, #b8942e)',
    border: 'none',
    color: '#1a1a2e',
    fontWeight: 700,
    fontSize: 13,
  },
  finishBtn: {
    background: 'linear-gradient(135deg, #1a9850, #66bd63)',
    border: 'none',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
  },
};

export { FactorOnboardingWizard };
export { MARKET_OPTIONS, SCENARIO_PACKS };
export type { FactorOnboardingWizardProps, OnboardingSelections, MarketId, ScenarioPack };
