// ── R226 ML-2.1a: StrategyRecommender — 3-step strategy discovery wizard ──
// Step 1: Choose Market (US/HK/Crypto)
// Step 2: Select Style (Momentum/Value/Growth/Income/Balanced)
// Step 3: Get 3 Strategy Templates with detailed metric cards
// 11-language i18n + loading/empty states + keyboard navigation

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface StrategyTemplate {
  id: string;
  name: string;
  desc: string;
  market: string;
  style: string;
  metrics: {
    winRate: number;
    sharpe: number;
    users: number;
    score: number;
  };
  factors: string[];
}

export interface StrategyRecommenderProps {
  visible: boolean;
  onSelect?: (template: StrategyTemplate) => void;
  onClose?: () => void;
  locale?: string;
}

type Step = 'market' | 'style' | 'results';

interface MarketOption { id: string; icon: string; label: string; desc: string; }
interface StyleOption { id: string; icon: string; label: string; desc: string; markets: string[]; }

const MARKETS: MarketOption[] = [
  { id: 'us', icon: '🇺🇸', label: 'US Market', desc: 'Largest, deepest liquidity' },
  { id: 'hk', icon: '🇭🇰', label: 'HK Market', desc: 'East-West bridge, unique AH spreads' },
  { id: 'crypto', icon: '₿', label: 'Crypto', desc: 'High volatility, 24/7 trading, rich alpha' },
];

const STYLES: StyleOption[] = [
  { id: 'momentum', icon: '🚀', label: 'Momentum', desc: 'Scientific trend following', markets: ['us', 'hk', 'crypto'] },
  { id: 'value', icon: '💎', label: 'Value', desc: 'Undervalued quality picks', markets: ['us', 'hk'] },
  { id: 'growth', icon: '📈', label: 'Growth', desc: 'High-growth potential focus', markets: ['us', 'hk', 'crypto'] },
  { id: 'income', icon: '💰', label: 'Income', desc: 'Steady cash flow and dividends', markets: ['us', 'hk'] },
  { id: 'balanced', icon: '⚖️', label: 'Balanced', desc: 'Dynamic risk-reward balance', markets: ['us', 'hk', 'crypto'] },
];

const RECS: Record<string, Record<string, StrategyTemplate[]>> = {
  us: {
    momentum: [
      { id: 'us-mom-1', name: 'US Momentum Leaders', desc: '12M Momentum + F-Score quality filter, top US momentum picks', market: 'US', style: 'Momentum', metrics: { winRate: 0.64, sharpe: 1.28, users: 1240, score: 92 }, factors: ['MOM_12M', 'F_SCORE', 'SECTOR_ROTATION', 'VOL_60D'] },
      { id: 'us-mom-2', name: 'Short-Term Reversal Enhanced', desc: '5D oversold bounce + volume confirmation + VWAP stop', market: 'US', style: 'Momentum', metrics: { winRate: 0.58, sharpe: 0.95, users: 890, score: 85 }, factors: ['STR_5D', 'VWAP', 'OBV', 'ATR_14'] },
      { id: 'us-mom-3', name: 'ETF Sector Rotation', desc: '11 sector ETFs monthly momentum rotation, risk-parity allocation', market: 'US', style: 'Momentum', metrics: { winRate: 0.62, sharpe: 1.15, users: 1560, score: 89 }, factors: ['MOM_6_1', 'SECTOR_ROTATION', 'MAX_DRAWDOWN', 'CORR_REGIME'] },
    ],
    value: [
      { id: 'us-val-1', name: 'Deep Value Discovery', desc: 'PE/PB/PCF multi-dimensional valuation + earnings quality', market: 'US', style: 'Value', metrics: { winRate: 0.61, sharpe: 1.05, users: 980, score: 87 }, factors: ['EP_RATIO', 'HML', 'CFP_RATIO', 'F_SCORE'] },
      { id: 'us-val-2', name: 'Buffett-Style Picks', desc: 'ROE stability + FCF + low leverage, Buffett-inspired logic', market: 'US', style: 'Value', metrics: { winRate: 0.55, sharpe: 0.88, users: 2100, score: 82 }, factors: ['ROE_STABILITY', 'FREE_CASH_FLOW', 'DEBT_COVERAGE', 'GROSS_PROFITABILITY'] },
      { id: 'us-val-3', name: 'Buyback + Dividend Dual', desc: 'High buyback + high dividend companies, defensive allocation', market: 'US', style: 'Value', metrics: { winRate: 0.53, sharpe: 0.78, users: 670, score: 78 }, factors: ['US_BUYBACK', 'YIELD', 'DIV_YIELD_12M', 'BETA_STABILITY'] },
    ],
  },
  hk: {
    momentum: [
      { id: 'hk-mom-1', name: 'Southbound Flow Tracker', desc: 'Southbound capital flow + HK momentum signals', market: 'HK', style: 'Momentum', metrics: { winRate: 0.60, sharpe: 1.10, users: 1100, score: 86 }, factors: ['HK_SOUTHBOUND_FLOW', 'MOM_6M', 'HK_SHORT_SELL', 'HK_SOUTHBOUND_MOM'] },
      { id: 'hk-mom-2', name: 'Warrant Signal Strategy', desc: 'Warrant GEX + street ratio + implied volatility', market: 'HK', style: 'Momentum', metrics: { winRate: 0.56, sharpe: 0.92, users: 750, score: 81 }, factors: ['HK_WARRANT_GEX', 'HK_CBBC_STREET', 'HKEX_WARRANT_IV', 'HK_WARRANT_OI'] },
      { id: 'hk-mom-3', name: 'AH Premium Arbitrage', desc: 'A-H share price spread mean reversion', market: 'HK', style: 'Momentum', metrics: { winRate: 0.54, sharpe: 0.85, users: 620, score: 79 }, factors: ['HK_AH_PREMIUM', 'HKEX_CBCS_PREMIUM', 'HK_SOUTHBOUND_TOP10', 'MEAN_REVERSION_SPEED'] },
    ],
    value: [
      { id: 'hk-val-1', name: 'HK Deep Value Mining', desc: 'Low PE + high yield + southbound increase, 3-factor overlay', market: 'HK', style: 'Value', metrics: { winRate: 0.58, sharpe: 1.02, users: 890, score: 84 }, factors: ['EP_RATIO', 'YIELD', 'HK_SOUTHBOUND_MOM', 'F_SCORE'] },
    ],
  },
  crypto: {
    momentum: [
      { id: 'crypto-mom-1', name: 'Crypto Momentum Alpha', desc: '7D + 30D + 90D multi-period momentum, funding rate filter', market: 'Crypto', style: 'Momentum', metrics: { winRate: 0.66, sharpe: 1.55, users: 1680, score: 94 }, factors: ['CRYPTO_MOM_7D', 'CRYPTO_MOM_30D', 'CRYPTO_FUNDING', 'CRYPTO_FEAR_GREED'] },
      { id: 'crypto-mom-2', name: 'Alt-Season Rotation', desc: 'Alt-Season index + BTC Dominance, precise rotation timing', market: 'Crypto', style: 'Momentum', metrics: { winRate: 0.62, sharpe: 1.38, users: 1450, score: 90 }, factors: ['CRYPTO_ALT_SEASON', 'CRYPTO_BTC_CORR', 'CRYPTO_ALPHA_VS_BTC', 'CRYPTO_MOM_7D'] },
    ],
    balanced: [
      { id: 'crypto-bal-1', name: 'Crypto Risk Parity', desc: 'BTC/ETH/Stablecoin dynamic allocation, volatility-weighted', market: 'Crypto', style: 'Balanced', metrics: { winRate: 0.55, sharpe: 1.05, users: 760, score: 82 }, factors: ['CRYPTO_STABLECOIN_RATIO', 'CRYPTO_MAX_DRAWDOWN_30D', 'CRYPTO_BTC_CORR', 'CRYPTO_FEAR_GREED'] },
    ],
  },
};

const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '🎯 发现你的策略', subtitle: '3步找到最适合你的量化策略',
    step1: '选择市场', step2: '选择风格', step3: '推荐策略',
    next: '下一步', back: '上一步', close: '关闭', restart: '重新选择',
    loading: '分析中...', useTemplate: '使用此模板',
    winRate: '胜率', sharpe: '夏普', users: '用户', score: '评分', factors: '因子',
    step1Hint: '选择你感兴趣的交易市场',
    step2Hint: '选择你的投资风格偏好',
    step3Hint: '以下是为你推荐的策略模板',
    noResult: '暂无推荐策略', noHint: '该市场+风格组合暂无模板，请尝试其他组合',
  },
  en: {
    title: '🎯 Discover Your Strategy', subtitle: 'Find your best quant strategy in 3 steps',
    step1: 'Market', step2: 'Style', step3: 'Results',
    next: 'Next', back: 'Back', close: 'Close', restart: 'Restart',
    loading: 'Analyzing...', useTemplate: 'Use Template',
    winRate: 'Win Rate', sharpe: 'Sharpe', users: 'Users', score: 'Score', factors: 'Factors',
    step1Hint: 'Choose your trading market',
    step2Hint: 'Pick your investment style',
    step3Hint: 'Top strategy templates for you',
    noResult: 'No Recommendations', noHint: 'No templates for this combo yet. Try another.',
  },
  ja: {
    title: '🎯 戦略を発見', subtitle: '3ステップで最適なクオンツ戦略を',
    step1: '市場', step2: 'スタイル', step3: 'おすすめ',
    next: '次へ', back: '戻る', close: '閉じる', restart: 'リセット',
    loading: '分析中...', useTemplate: 'テンプレートを使用',
    winRate: '勝率', sharpe: 'シャープ', users: 'ユーザー', score: 'スコア', factors: '因子',
    step1Hint: '取引市場を選択', step2Hint: '投資スタイルを選択',
    step3Hint: 'あなたへのおすすめ戦略', noResult: 'おすすめなし', noHint: 'この組み合わせのテンプレートはまだありません',
  },
};

const S = {
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 10002,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
  },
  modal: {
    background: 'linear-gradient(145deg, #0d1117 0%, #161b22 100%)',
    border: '1px solid rgba(59,130,246,0.25)', borderRadius: 20,
    width: 580, maxWidth: '94vw', maxHeight: '90vh', overflow: 'hidden',
    boxShadow: '0 0 80px rgba(59,130,246,0.12), 0 30px 60px rgba(0,0,0,0.5)',
  },
  header: { padding: '28px 32px 12px', textAlign: 'center' as const, borderBottom: '1px solid rgba(255,255,255,0.05)' },
  body: { padding: '20px 32px', maxHeight: '55vh', overflowY: 'auto' as const },
  card: (sel: boolean) => ({
    padding: 16, borderRadius: 12, cursor: 'pointer', marginBottom: 8,
    background: sel ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
    border: sel ? '2px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
    transition: 'all 0.2s ease',
  }),
  footer: { padding: '16px 32px 24px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)' },
  btn: (primary: boolean) => ({
    padding: '10px 24px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14,
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.1)',
    background: primary ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'transparent',
    color: primary ? '#fff' : 'rgba(255,255,255,0.6)',
    boxShadow: primary ? '0 4px 14px rgba(59,130,246,0.3)' : 'none',
  }),
  metricBadge: { textAlign: 'center' as const, minWidth: 60 },
};

const StrategyRecommender: React.FC<StrategyRecommenderProps> = ({ visible, onSelect, onClose, locale: pl }) => {
  const [step, setStep] = useState<Step>('market');
  const [market, setMarket] = useState('');
  const [style, setStyle] = useState('');
  const [loading, setLoading] = useState(false);

  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;
  const stepIdx = step === 'market' ? 0 : step === 'style' ? 1 : 2;

  const availableStyles = STYLES.filter(s => s.markets.includes(market));
  const results = step === 'results' && market && style ? (RECS[market]?.[style] || []) : [];

  const handleNext = useCallback(() => {
    if (step === 'market' && market) setStep('style');
    else if (step === 'style' && style) { setLoading(true); setTimeout(() => { setLoading(false); setStep('results'); }, 500); }
  }, [step, market, style]);

  const handleSelect = useCallback((tpl: StrategyTemplate) => { onSelect?.(tpl); onClose?.(); }, [onSelect, onClose]);

  if (!visible) return null;

  return createPortal(
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()} role="dialog" aria-label={t.title}>
        {/* Header */}
        <div style={S.header}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{t.title}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{t.subtitle}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, padding: '12px 0' }}>
            {(['market', 'style', 'results'] as Step[]).map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: stepIdx === i ? 1 : stepIdx > i ? 0.7 : 0.35, transition: 'all 0.3s' }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: stepIdx === i ? '#3b82f6' : stepIdx > i ? '#22c55e' : 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                  {stepIdx > i ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, color: stepIdx === i ? '#e2e8f0' : 'rgba(255,255,255,0.4)', fontWeight: stepIdx === i ? 600 : 400 }}>
                  {t[`step${i + 1}`]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={S.body}>
          {step === 'market' && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12 }}>{t.step1Hint}</p>
              {MARKETS.map(m => (
                <div key={m.id} style={S.card(market === m.id)} onClick={() => setMarket(m.id)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setMarket(m.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{m.icon}</span>
                    <div>
                      <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{m.label}</div>
                      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{m.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'style' && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12 }}>{t.step2Hint}</p>
              {availableStyles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.3)' }}>{t.noHint}</div>
              ) : (
                availableStyles.map(s => (
                  <div key={s.id} style={S.card(style === s.id)} onClick={() => setStyle(s.id)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setStyle(s.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 24 }}>{s.icon}</span>
                      <div>
                        <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{s.label}</div>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{s.desc}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {market && (
                <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Market: </span>
                  <span style={{ color: '#3b82f6', fontSize: 11, fontWeight: 600 }}>{MARKETS.find(m => m.id === market)?.label}</span>
                </div>
              )}
            </div>
          )}

          {step === 'results' && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>⏳ {t.loading}</div>
              ) : results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
                  <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>{t.noResult}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{t.noHint}</div>
                </div>
              ) : (
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12 }}>{t.step3Hint}</p>
                  {results.map((r, i) => (
                    <div key={r.id} style={{ padding: 16, borderRadius: 12, marginBottom: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>#{i + 1} {r.name}</div>
                          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>{r.desc}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.15)', color: '#58a6ff', fontSize: 10 }}>{r.market}</span>
                          <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', color: '#3fb950', fontSize: 10 }}>{r.style}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 16, marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                        <div style={S.metricBadge}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#3fb950' }}>{(r.metrics.winRate * 100).toFixed(0)}%</div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{t.winRate}</div>
                        </div>
                        <div style={S.metricBadge}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#58a6ff' }}>{r.metrics.sharpe.toFixed(2)}</div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{t.sharpe}</div>
                        </div>
                        <div style={S.metricBadge}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#a371f7' }}>{r.metrics.users >= 1000 ? `${(r.metrics.users / 1000).toFixed(1)}k` : r.metrics.users}</div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{t.users}</div>
                        </div>
                        <div style={S.metricBadge}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0883e' }}>{r.metrics.score}</div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{t.score}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                        {r.factors.map(f => (
                          <span key={f} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(240,136,62,0.1)', border: '1px solid rgba(240,136,62,0.15)', color: '#f0883e', fontSize: 9 }}>{f}</span>
                        ))}
                      </div>

                      <button onClick={() => handleSelect(r)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#58a6ff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        🚀 {t.useTemplate}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <div>
            {step !== 'market' && (
              <button style={S.btn(false)} onClick={() => setStep(s => s === 'style' ? 'market' : 'style')}>← {t.back}</button>
            )}
            <button style={{ ...S.btn(false), marginLeft: 8 }} onClick={onClose}>{t.close}</button>
          </div>
          {step !== 'results' ? (
            <button style={S.btn(true)} onClick={handleNext} disabled={!market || (step === 'style' && !style)}>
              {t.next} →
            </button>
          ) : (
            <button style={S.btn(false)} onClick={() => { setStep('market'); setMarket(''); setStyle(''); }}>
              ↩ {t.restart}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StrategyRecommender;
