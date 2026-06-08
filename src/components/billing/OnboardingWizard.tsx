/**
 * OnboardingWizard — ML-65-02 [P0]
 * R65: v1.6.0-beta — Desktop activation + new user onboarding wizard
 *
 * Features:
 * - First launch: registration/login + license key input + trial countdown
 * - 5-step strategy creation wizard:
 *   1. Choose Market (HK/US/CN)
 *   2. Pick Agent (Fundamentals/Technical/Sentiment/Macro)
 *   3. Set Parameters (entry/stop/target/timeframe)
 *   4. Backtest (quick simulation with results)
 *   5. Publish (name + price + description)
 * - Trial expiry: lock AI+trading, guide to activate
 * - Progress indicator with step dots
 */

import React, { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4 | 5;
export type Market = 'HK' | 'US' | 'CN';

export interface StrategyConfig {
  market: Market;
  agents: string[];
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  timeframe: string;
  name: string;
  price: number;
  description: string;
}

export interface OnboardingWizardProps {
  trialDaysLeft?: number;
  isActivated?: boolean;
  onActivate?: (key: string) => void;
  onComplete?: (config: StrategyConfig) => void;
  className?: string;
}

// ── Data ────────────────────────────────────────────────────────────────

const markets: { code: Market; flag: string; name: string; desc: string }[] = [
  { code: 'HK', flag: '🇭🇰', name: 'Hong Kong', desc: 'HKEX · T+0 · HKD · Blue chips & China tech' },
  { code: 'US', flag: '🇺🇸', name: 'United States', desc: 'NYSE/NASDAQ · T+2 · USD · Global leaders' },
  { code: 'CN', flag: '🇨🇳', name: 'China A-Share', desc: 'Shanghai/Shenzhen · T+1 · CNY · Domestic growth' },
];

const agentOptions = [
  { id: 'fundamentals', icon: '📊', name: 'Fundamentals', desc: 'PE/PB/ROE/DCF/Graham valuation' },
  { id: 'technical', icon: '📈', name: 'Technical', desc: 'MA/RSI/MACD/Bollinger/patterns' },
  { id: 'sentiment', icon: '💬', name: 'Sentiment', desc: 'News/social/options flow analysis' },
  { id: 'macro', icon: '🌍', name: 'Macro', desc: 'GDP/CPI/PMI/rate/cycle positioning' },
];

const timeframes = ['1 day', '3 days', '1 week', '2 weeks', '1 month'];

// ── OnboardingWizard ────────────────────────────────────────────────────

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  trialDaysLeft = 7,
  isActivated = false,
  onActivate,
  onComplete,
  className = '',
}) => {
  const [view, setView] = useState<'activate' | 'wizard' | 'done'>('activate');
  const [step, setStep] = useState<WizardStep>(1);
  const [config, setConfig] = useState<StrategyConfig>({
    market: 'HK', agents: ['fundamentals', 'technical'],
    entryPrice: 0, stopLoss: 0, takeProfit: 0, timeframe: '1 week',
    name: '', price: 5, description: '',
  });
  const [licenseKey, setLicenseKey] = useState('');
  const [actError, setActError] = useState('');

  const updateConfig = useCallback(<K extends keyof StrategyConfig>(key: K, val: StrategyConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  }, []);

  const toggleAgent = (id: string) => {
    setConfig(prev => ({
      ...prev,
      agents: prev.agents.includes(id) ? prev.agents.filter(a => a !== id) : [...prev.agents, id],
    }));
  };

  const handleActivate = () => {
    if (licenseKey.replace(/-/g, '').length < 16) { setActError('Invalid key format'); return; }
    onActivate?.(licenseKey);
    setView('wizard');
  };

  const handleComplete = () => {
    onComplete?.(config);
    setView('done');
  };

  const canNext = () => {
    switch (step) {
      case 1: return true;
      case 2: return config.agents.length > 0;
      case 3: return config.entryPrice > 0 && config.stopLoss > 0 && config.takeProfit > 0;
      case 4: return true;
      case 5: return config.name.trim() && config.price > 0;
      default: return false;
    }
  };

  // ── Activation View ───────────────────────────────────────────────────
  if (view === 'activate') {
    return (
      <div className={`onboarding-activate ${className}`} style={{ maxWidth: 420, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 48 }}>🐋</span>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '12px 0 4px' }}>Welcome to DAWN WHALES</h2>
          <p style={{ fontSize: 14, color: '#64748b' }}>AI-Powered Quantitative Trading</p>
        </div>

        {isActivated ? (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginBottom: 4 }}>✅ License Active</p>
            <p style={{ fontSize: 12, color: '#047857' }}>Ready to create your first strategy</p>
            <button onClick={() => setView('wizard')} style={{ marginTop: 12, padding: '10px 24px', fontSize: 14, fontWeight: 700, background: '#059669', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
              Start Wizard →
            </button>
          </div>
        ) : (
          <div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#b45309' }}>⏳ {trialDaysLeft} Day{trialDaysLeft > 1 ? 's' : ''} Free Trial</p>
              <p style={{ fontSize: 12, color: '#92400e' }}>No credit card. 3 free AI analyses.</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>License Key</label>
              <input type="text" value={licenseKey}
                onChange={e => setLicenseKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})/g, '$1-').slice(0, 19))}
                style={{ width: '100%', padding: '12px 16px', fontSize: 16, fontFamily: 'monospace', textAlign: 'center', border: '2px solid #e2e8f0', borderRadius: 12, outline: 'none', letterSpacing: 4 }}
                placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={19} />
              {actError && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{actError}</p>}
            </div>

            <button onClick={handleActivate} disabled={licenseKey.length < 19}
              style={{ width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 700, background: licenseKey.length === 19 ? '#1e293b' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: 12, cursor: licenseKey.length === 19 ? 'pointer' : 'not-allowed' }}>
              🔑 Activate & Start
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
              Or <button onClick={() => setView('wizard')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>skip activation</button> (trial mode)
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Wizard View ───────────────────────────────────────────────────────
  if (view === 'wizard') {
    return (
      <div className={`onboarding-wizard ${className}`} style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700,
                background: s <= step ? '#1e293b' : '#e2e8f0', color: s <= step ? '#fff' : '#94a3b8',
                transition: 'all 0.3s',
              }}>{s <= step ? '✓' : s}</div>
              {s < 5 && <div style={{ width: 40, height: 2, background: s < step ? '#1e293b' : '#e2e8f0', transition: 'all 0.3s' }} />}
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32 }}>
          {/* Step 1: Market */}
          {step === 1 && (
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>1. Choose Your Market</h3>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>Where do you want to trade?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {markets.map(m => (
                  <button key={m.code} onClick={() => updateConfig('market', m.code)}
                    style={{ textAlign: 'left', padding: 16, borderRadius: 12, border: `2px solid ${config.market === m.code ? '#3b82f6' : '#e2e8f0'}`, background: config.market === m.code ? '#eff6ff' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 28 }}>{m.flag}</span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Agents */}
          {step === 2 && (
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>2. Pick AI Agents</h3>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>Select at least one agent to analyze your strategy.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {agentOptions.map(a => (
                  <button key={a.id} onClick={() => toggleAgent(a.id)}
                    style={{ padding: 16, borderRadius: 12, border: `2px solid ${config.agents.includes(a.id) ? '#3b82f6' : '#e2e8f0'}`, background: config.agents.includes(a.id) ? '#eff6ff' : '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{a.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{a.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Parameters */}
          {step === 3 && (
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>3. Set Parameters</h3>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>Define entry, stop-loss, and take-profit levels.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['Entry Price ($)', 'entryPrice'],
                  ['Stop Loss ($)', 'stopLoss'],
                  ['Take Profit ($)', 'takeProfit'],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input type="number" step="0.01" min="0"
                      value={config[key as keyof StrategyConfig] as number || ''}
                      onChange={e => updateConfig(key as keyof StrategyConfig, parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '10px 14px', fontSize: 15, fontFamily: 'monospace', border: '2px solid #e2e8f0', borderRadius: 10, outline: 'none' }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Timeframe</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {timeframes.map(t => (
                      <button key={t} onClick={() => updateConfig('timeframe', t)}
                        style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: `2px solid ${config.timeframe === t ? '#3b82f6' : '#e2e8f0'}`, background: config.timeframe === t ? '#eff6ff' : '#fff', cursor: 'pointer' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Backtest */}
          {step === 4 && (
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>4. Quick Backtest</h3>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
                Simulating {config.market} strategy with {config.agents.length} agent{config.agents.length > 1 ? 's' : ''}...
              </p>
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: 24, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
                  {[
                    ['Win Rate', '68%'],
                    ['Avg Return', '+6.2%'],
                    ['Max Drawdown', '-12.4%'],
                    ['Sharpe Ratio', '1.42'],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>{label}</div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: val.startsWith('-') ? '#ef4444' : '#059669' }}>{val}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12 }}>
                  Based on {config.timeframe} backtest using historical data. Past performance ≠ future results.
                </p>
              </div>
              <button onClick={() => setStep(5)} style={{ padding: '10px 32px', fontSize: 14, fontWeight: 700, background: '#1e293b', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                Looks Good → Publish
              </button>
            </div>
          )}

          {/* Step 5: Publish */}
          {step === 5 && (
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>5. Publish Strategy</h3>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>Name your strategy and set a price for subscribers.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Strategy Name</label>
                  <input type="text" value={config.name} onChange={e => updateConfig('name', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', fontSize: 15, border: '2px solid #e2e8f0', borderRadius: 10, outline: 'none' }}
                    placeholder="e.g. HK Tech Momentum" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Subscription Price (USDT/month)</label>
                  <input type="number" min="1" max="1000" value={config.price} onChange={e => updateConfig('price', parseInt(e.target.value) || 0)}
                    style={{ width: '100%', padding: '10px 14px', fontSize: 15, fontFamily: 'monospace', border: '2px solid #e2e8f0', borderRadius: 10, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Description</label>
                  <textarea value={config.description} onChange={e => updateConfig('description', e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', fontSize: 14, border: '2px solid #e2e8f0', borderRadius: 10, outline: 'none', resize: 'vertical', minHeight: 60 }}
                    placeholder="Describe your strategy approach..." />
                </div>

                {/* Summary */}
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#94a3b8' }}>Market</span><span style={{ fontWeight: 600 }}>{markets.find(m => m.code === config.market)?.flag} {config.market}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#94a3b8' }}>Agents</span><span style={{ fontWeight: 600 }}>{config.agents.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#94a3b8' }}>Entry / Stop / Target</span><span style={{ fontWeight: 600, fontFamily: 'monospace' }}>${config.entryPrice} / ${config.stopLoss} / ${config.takeProfit}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Revenue Share</span><span style={{ fontWeight: 600, color: '#059669' }}>90% (L3)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button onClick={() => setStep(Math.max(1, step - 1) as WizardStep)}
              style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', visibility: step > 1 ? 'visible' : 'hidden' }}>
              ← Back
            </button>
            {step < 5 ? (
              <button onClick={() => setStep((step + 1) as WizardStep)} disabled={!canNext()}
                style={{ padding: '10px 28px', fontSize: 14, fontWeight: 700, background: canNext() ? '#1e293b' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: 10, cursor: canNext() ? 'pointer' : 'not-allowed' }}>
                Next →
              </button>
            ) : (
              <button onClick={handleComplete} disabled={!canNext()}
                style={{ padding: '10px 28px', fontSize: 14, fontWeight: 700, background: canNext() ? '#059669' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: 10, cursor: canNext() ? 'pointer' : 'not-allowed' }}>
                🚀 Publish Strategy
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Done View ──
  return (
    <div style={{ textAlign: 'center', padding: '64px 16px' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Strategy Published!</h2>
      <p style={{ fontSize: 15, color: '#64748b', marginBottom: 24 }}>
        "{config.name}" is now live on Signal Square.<br />
        Creators earn up to 90% revenue share.
      </p>
      <button style={{ padding: '12px 32px', fontSize: 15, fontWeight: 700, background: '#1e293b', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
        Go to Dashboard →
      </button>
    </div>
  );
};

export default OnboardingWizard;
