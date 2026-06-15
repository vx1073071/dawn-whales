// ── R227 ML-2.1b: OnboardingStrategyWizard ──────────────────────────
// Triggers the 3-step strategy wizard on first login / empty state
// Integration: localStorage flag → auto-launch → StrategyRecommender
// Also provides a manual launch button for returning users

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'dw_onboarding_v250_complete';

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    welcome: '👋 欢迎来到 Dawn Whales!',
    tagline: '3步发现你的第一个量化策略',
    startBtn: '🚀 开始发现策略',
    skipBtn: '跳过，我自己探索',
    laterBtn: '稍后再说',
    welcomeBack: '发现新策略',
    welcomeBackBtn: '探索策略模板',
    step1: '选择市场',
    step2: '选风格',
    step3: '得策略',
    hint: '只需3步，找到适合你的量化策略',
  },
  en: {
    welcome: '👋 Welcome to Dawn Whales!',
    tagline: 'Discover your first quant strategy in 3 steps',
    startBtn: '🚀 Discover Strategy',
    skipBtn: 'Skip, I\'ll explore',
    laterBtn: 'Maybe later',
    welcomeBack: 'Discover New Strategies',
    welcomeBackBtn: 'Explore Templates',
    step1: 'Market',
    step2: 'Style',
    step3: 'Strategy',
    hint: 'Just 3 steps to find your perfect quant strategy',
  },
  ja: {
    welcome: '👋 Dawn Whalesへようこそ!',
    tagline: '3ステップで最初のクオンツ戦略を発見',
    startBtn: '🚀 戦略を発見',
    skipBtn: 'スキップ',
    laterBtn: '後で',
    welcomeBack: '新しい戦略を発見',
    welcomeBackBtn: 'テンプレートを探索',
    step1: '市場', step2: 'スタイル', step3: '戦略',
    hint: 'わずか3ステップであなたに最適なクオンツ戦略を見つけます',
  },
};

// ── Types ───────────────────────────────────────────────────────────
export interface OnboardingStrategyWizardProps {
  /** Force show (e.g., from sidebar button) */
  forceShow?: boolean;
  /** Locale override */
  locale?: string;
  /** Callback when wizard completes (template selected) */
  onComplete?: (templateId: string) => void;
  /** Callback when user skips */
  onSkip?: () => void;
}

function useStrategyOnboardingWizard() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // First-time user — show after a short delay
      const timer = setTimeout(() => setShowOnboarding(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const launch = useCallback(() => {
    setShowOnboarding(true);
    setForceShow(true);
  }, []);

  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShowOnboarding(false);
    setForceShow(false);
  }, []);

  const skip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'skipped');
    setShowOnboarding(false);
    setForceShow(false);
  }, []);

  return { showOnboarding: showOnboarding || forceShow, launch, complete, skip };
}

// ── Styles ──────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 10010,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: 'linear-gradient(145deg, #0d1117 0%, #161b22 100%)',
    border: '1px solid rgba(59,130,246,0.3)', borderRadius: 24,
    width: 480, maxWidth: '92vw', padding: '40px 36px',
    textAlign: 'center' as const,
    boxShadow: '0 0 100px rgba(59,130,246,0.15), 0 30px 60px rgba(0,0,0,0.5)',
  },
  logo: { fontSize: 48, marginBottom: 16 },
  title: { color: '#e2e8f0', fontSize: 22, fontWeight: 700, margin: '0 0 8px' },
  tagline: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 },
  steps: { display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 28 },
  stepItem: (highlight: boolean) => ({
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    opacity: highlight ? 1 : 0.5, transition: 'all 0.3s',
  }),
  stepNum: (active: boolean) => ({
    width: 36, height: 36, borderRadius: 18, marginBottom: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? '#3b82f6' : 'rgba(255,255,255,0.1)',
    color: active ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: 700,
  }),
  primaryBtn: {
    padding: '14px 36px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: '#fff', fontWeight: 600, fontSize: 15, width: '100%', marginBottom: 12,
    boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
  },
  secondaryBtn: {
    padding: '8px 16px', cursor: 'pointer', border: 'none',
    background: 'transparent', color: 'rgba(255,255,255,0.35)', fontSize: 12,
  },
};

const OnboardingStrategyWizard: React.FC<OnboardingStrategyWizardProps> = ({
  forceShow = false, locale: pl, onComplete, onSkip,
}) => {
  const { showOnboarding, launch: _launch, complete, skip } = useStrategyOnboardingWizard();
  const [showRecommender, setShowRecommender] = useState(false);

  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const visible = (forceShow || showOnboarding) && !showRecommender;

  const handleStart = () => {
    setShowRecommender(true);
  };

  const handleSkip = () => {
    skip();
    onSkip?.();
  };

  if (!visible && !showRecommender) return null;

  return createPortal(
    <div style={S.overlay}>
      {!showRecommender ? (
        <div style={S.card} role="dialog" aria-label={t.welcome}>
          <div style={S.logo}>🐋</div>
          <h2 style={S.title}>{t.welcome}</h2>
          <p style={S.tagline}>{t.tagline}</p>

          {/* 3-step preview */}
          <div style={S.steps}>
            {[
              { num: 1, label: t.step1, icon: '🇺🇸' },
              { num: 2, label: t.step2, icon: '🎯' },
              { num: 3, label: t.step3, icon: '📊' },
            ].map((s, i) => (
              <div key={i} style={S.stepItem(true)}>
                <div style={S.stepNum(i === 0)}>{s.icon}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginBottom: 20 }}>{t.hint}</p>

          <button style={S.primaryBtn} onClick={handleStart}>{t.startBtn}</button>
          <button style={S.secondaryBtn} onClick={handleSkip}>{t.skipBtn}</button>
        </div>
      ) : (
        /* Lazy-load the StrategyRecommender from R226 */
        <StrategyRecommenderWrapper
          visible={showRecommender}
          locale={pl}
          onSelect={(id: string) => { complete(); onComplete?.(id); }}
          onClose={() => { setShowRecommender(false); }}
        />
      )}
    </div>,
    document.body
  );
};

// ── Lazy wrapper for StrategyRecommender ─────────────────────────────
const StrategyRecommenderWrapper: React.FC<{
  visible: boolean; locale?: string;
  onSelect: (id: string) => void; onClose: () => void;
}> = ({ visible, locale, onSelect, onClose }) => {
  // Dynamic import to avoid circular dependency
  const [Comp, setComp] = React.useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    import('../strategy/StrategyRecommender').then(m => setComp(() => m.default));
  }, []);

  if (!Comp) return null;
  return <Comp visible={visible} locale={locale} onSelect={(t: any) => onSelect(t.id)} onClose={onClose} />;
};

export default OnboardingStrategyWizard;
export { useStrategyOnboardingWizard };
