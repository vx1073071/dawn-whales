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
    title: '欢迎使用 DAWN WHALES',
    description: 'AI 驱动的量化交易平台。支持 A股/港股/美股，内置策略优化、多周期分析、组合风险管理。',
    icon: '🐋',
    tip: 'Phase 6.2 · v0.11.0',
  },
  {
    id: 2,
    title: '连接券商',
    description: '连接 Futu OpenD 获取实时行情和交易能力。点击下方进入设置页面配置连接。',
    icon: '🔌',
    action: { label: '去设置', href: '/?page=settings' },
    tip: '需要 Futu OpenD 在后台运行',
  },
  {
    id: 3,
    title: '创建第一个策略',
    description: '使用自然语言描述你的交易逻辑，或从 10+ 模板中选择。AI 会自动解析并生成策略。',
    icon: '🎯',
    action: { label: '创建策略', href: '/?page=strategy' },
    tip: '试试说"当5日均线上穿20日均线时买入"',
  },
  {
    id: 4,
    title: '回测验证',
    description: '用历史数据验证你的策略。查看收益曲线、Sharpe 比率、最大回撤等关键指标。',
    icon: '🔬',
    action: { label: '运行回测', href: '/?page=backtest' },
    tip: '支持 3 年历史数据，3 种优化模式',
  },
  {
    id: 5,
    title: '开始交易！',
    description: '策略已就绪。你可以通过实盘桥接（LiveTradeBridge）执行交易，或先使用模拟盘练习。',
    icon: '🚀',
    action: { label: '进入仪表盘', href: '/?page=dashboard' },
    tip: '模拟盘 100 万 HKD 练手资金',
  },
];

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
    } catch {
      setVisible(true);
    }
  }, []);

  const currentStep = ONBOARDING_STEPS[step - 1];
  const isLast = step === ONBOARDING_STEPS.length;

  const handleNext = useCallback(() => {
    if (isLast) {
      setVisible(false);
      try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
      onComplete?.();
    } else {
      setStep(s => s + 1);
    }
  }, [isLast, onComplete]);

  const handleSkip = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
    onComplete?.();
  }, [onComplete]);

  const handlePrev = useCallback(() => {
    setStep(s => Math.max(1, s - 1));
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
            style={{ width: `${(step / ONBOARDING_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] text-gray-600">
              步骤 {step}/{ONBOARDING_STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-[10px] text-gray-600 hover:text-gray-400"
            >
              跳过 →
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
          {currentStep.tip && (
            <p className="text-[10px] text-gray-600 text-center italic mb-4">
              💡 {currentStep.tip}
            </p>
          )}

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mb-6">
            {ONBOARDING_STEPS.map(s => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  s.id === step ? 'bg-amber-500 scale-125' :
                  s.id < step ? 'bg-emerald-500' :
                  'bg-gray-700'
                }`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={handlePrev}
                className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                ← 上一步
              </button>
            )}

            {currentStep.action ? (
              <button
                onClick={() => {
                  if (currentStep.action?.href) {
                    window.location.hash = currentStep.action.href;
                  }
                  handleNext();
                }}
                className="flex-1 px-4 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-bold hover:bg-amber-400 transition-colors"
              >
                {currentStep.action.label}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-bold hover:bg-amber-400 transition-colors"
              >
                {isLast ? '🎉 开始使用' : '继续 →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
