/**
* Onboarding — 5-step guided onboarding flow
* (ML-45-03, R45 Phase 6.2)
*
* Steps:
* 1. Welcome + platform intro
* 2. Connect broker (Futu OpenD)
* 3. Create first strategy
* 4. Run backtest
* 5. Ready to trade
*/

import React, { useState, useCallback, useEffect } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

import i18n from '../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  tip?: string;
}

// ── Steps definition ────────────────────────────────────────────────────

const ONBOARDING_STEPS: OnboardingStep[] = [
{
  id: 1,
  title: i18n.t('OnboardingModal.k1'),
  description: i18n.t('OnboardingModal.k2'),
  icon: '🐋',
  tip: 'Phase 6.2 · v0.11.0'
},
{
  id: 2,
  title: i18n.t('OnboardingModal.k3'),
  description: i18n.t('OnboardingModal.k4'),
  icon: '🔌',
  action: { label: i18n.t('OnboardingModal.k5'), href: '/?page=settings' },
  tip: i18n.t('OnboardingModal.k6')
},
{
  id: 3,
  title: i18n.t('OnboardingModal.k7'),
  description: i18n.t('OnboardingModal.k8'),
  icon: '🎯',
  action: { label: i18n.t('OnboardingModal.k9'), href: '/?page=strategy' },
  tip: i18n.t('OnboardingModal.k10')
},
{
  id: 4,
  title: i18n.t('OnboardingModal.k11'),
  description: i18n.t('OnboardingModal.k12'),
  icon: '🔬',
  action: { label: i18n.t('OnboardingModal.k13'), href: '/?page=backtest' },
  tip: i18n.t('OnboardingModal.k14')
},
{
  id: 5,
  title: i18n.t('OnboardingModal.k15'),
  description: i18n.t('OnboardingModal.k16'),
  icon: '🚀',
  action: { label: i18n.t('OnboardingModal.k17'), href: '/?page=dashboard' },
  tip: i18n.t('OnboardingModal.k18')
}];


// ── Onboarding Modal ────────────────────────────────────────────────────

interface OnboardingModalProps {
  onComplete?: () => void;
  className?: string;
  open?: boolean;
  onClose?: () => void;
  onConnect?: () => Promise<boolean>;
  connected?: boolean;
}

const STORAGE_KEY = 'dawn-whales-onboarding-done';

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete, className, open: _open, onClose: _onClose, onConnect: _onConnect, connected: _connected }) => {
  const [step, setStep] = useState(1);
  const [visible, setVisible] = useState(false);

  // Check if already completed
  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setVisible(true);
    } catch (_e: unknown) {
      void EngineError; // [SYSTEM] structured error tracking
      setVisible(true);
    }
  }, []);

  const currentStep = ONBOARDING_STEPS[step - 1];
  const isLast = step === ONBOARDING_STEPS.length;

  const handleNext = useCallback(() => {
    if (isLast) {
      setVisible(false);
      try {localStorage.setItem(STORAGE_KEY, 'true');} catch (_e: unknown) {}
      onComplete?.();
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast, onComplete]);

  const handleSkip = useCallback(() => {
    setVisible(false);
    try {localStorage.setItem(STORAGE_KEY, 'true');} catch (_e: unknown) {}
    onComplete?.();
  }, [onComplete]);

  const handlePrev = useCallback(() => {
    setStep((s) => Math.max(1, s - 1));
  }, []);

  if (!visible) return null;

  return (
    <div className={`fixed inset-0 z-[999] flex items-center justify-center p-4 ${className ?? ''}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Card */}
      <div className="relative bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl max-w-md w-full overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
            style={{ width: `${step / ONBOARDING_STEPS.length * 100}%` }} />
          
        </div>

        <div className="p-6">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] text-gray-600">{i18n.t("OnboardingModal.r92_bce4")}
              {step}/{ONBOARDING_STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-[10px] text-gray-600 hover:text-gray-400">{i18n.t("OnboardingModal.r92_7f87")}


            </button>
          </div>

          {/* Icon */}
          <div className="text-5xl text-center mb-4">{currentStep.icon}</div>

          {/* Content */}
          <h2 className="text-lg font-bold text-white text-center mb-2">
            {currentStep.title}
          </h2>
          <p className="text-sm text-gray-400 text-center leading-relaxed mb-2">
            {currentStep.description}
          </p>
          {currentStep.tip &&
          <p className="text-[10px] text-gray-600 text-center italic mb-4">
              💡 {currentStep.tip}
            </p>
          }

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mb-6">
            {ONBOARDING_STEPS.map((s) =>
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={`w-2 h-2 rounded-full transition-colors ${
              s.id === step ? 'bg-amber-500 scale-125' :
              s.id < step ? 'bg-emerald-500' :
              'bg-gray-700'}`
              } />

            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {step > 1 &&
            <button
              onClick={handlePrev}
              className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs text-gray-400 hover:text-gray-200 transition-colors">{i18n.t("OnboardingModal.r92_279d")}


            </button>
            }

            {currentStep.action ?
            <button
              onClick={() => {
                if (currentStep.action?.href) {
                  window.location.hash = currentStep.action.href;
                }
                handleNext();
              }}
              className="flex-1 px-4 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-bold hover:bg-amber-400 transition-colors">
              
                {currentStep.action.label}
              </button> :

            <button
              onClick={handleNext}
              className="flex-1 px-4 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-bold hover:bg-amber-400 transition-colors">
              
                {isLast ? i18n.t('OnboardingModal.k19') : i18n.t('OnboardingModal.k20')}
              </button>
            }
          </div>
        </div>
      </div>
    </div>);

};

export default OnboardingModal;