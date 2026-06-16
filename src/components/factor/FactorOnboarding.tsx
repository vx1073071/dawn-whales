// @ts-nocheck
// ── R186 ML P2-03: FactorOnboarding — 3步向导UI ─────────────────────
// New user onboarding for the factor system. 3 steps, progressive disclosure.
// Step 1: What are factors? (concept intro with emoji metaphors)
// Step 2: Pick your style (user persona → recommended scenario pack)
// Step 3: Your first signal (demo a factor with live signal light)
//
// Design: Modal/panel with step indicator, back/next navigation, skip option.
// Remembers completion in localStorage. Only shows once per user.
// Mobile responsive.

import React, { useState, useEffect, useCallback } from 'react';
import { FactorSignalLight } from './FactorSignalLight';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingStep {
  id: number;
  title: string;
  subtitle: string;
  emoji: string;
}

interface FactorOnboardingProps {
  /** Called when onboarding is dismissed/completed */
  onComplete?: (selections: OnboardingSelections) => void;
  /** Called when onboarding is skipped */
  onSkip?: () => void;
  /** Force show even if already completed */
  forceShow?: boolean;
  className?: string;
}

export interface OnboardingSelections {
  persona: string;
  recommendedPacks: string[];
  firstFactor: string;
}

const STORAGE_KEY = 'tradingeasy-factor-onboarding-completed';
const STEPS: OnboardingStep[] = [
  { id: 1, title: '什么是策略因子？', subtitle: '30秒了解因子投资的核心理念', emoji: '🧠' },
  { id: 2, title: '你的投资风格？', subtitle: '选一种最像你的，我们推荐因子组合', emoji: '🎯' },
  { id: 3, title: '你的第一个信号灯', subtitle: '看看市场现在在说什么', emoji: '🚦' },
];

const PERSONAS = [
  {
    id: 'beginner',
    emoji: '🌱',
    name: '我是新手',
    description: '刚开始投资，想慢慢学，不想冒太大风险',
    recommendedPacks: ['defense', 'value-mining'],
    color: '#22c55e',
  },
  {
    id: 'growth_seeker',
    emoji: '🦅',
    name: '追成长',
    description: '找下一个NVIDIA，愿意承受波动博高收益',
    recommendedPacks: ['bull-charge', 'growth-hunter'],
    color: '#3b82f6',
  },
  {
    id: 'balanced',
    emoji: '🌈',
    name: '稳中求进',
    description: '不想太激进也不想太保守，稳健增值就行',
    recommendedPacks: ['all-weather'],
    color: '#f59e0b',
  },
  {
    id: 'crypto_trader',
    emoji: '🪙',
    name: '加密玩家',
    description: '主要在加密货币市场交易，擅长看链上数据',
    recommendedPacks: ['crypto-trend'],
    color: '#f97316',
  },
  {
    id: 'hk_trader',
    emoji: '🇭🇰',
    name: '港股老手',
    description: '熟悉港股市场，关注南向资金和A/H溢价',
    recommendedPacks: ['value-mining', 'range-swing'],
    color: '#ef4444',
  },
];

// ── Step 1: Concept intro ────────────────────────────────────────────────────

const Step1Concept: React.FC = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      {[
        { emoji: '📊', title: '因子=选股条件', desc: '就像筛选"便宜+好公司+涨势强"的股票——每条都是你设置的"条件"。' },
        { emoji: '🚦', title: '信号灯=执行提醒', desc: '绿灯=条件满足可以买，红灯=条件不满足该卖/回避，黄灯=再等等。' },
        { emoji: '🎯', title: '场景包=专家策略', desc: '不知道怎么选因子？用我们预设的场景包——价值掘金/成长猎手/全天候均衡。' },
        { emoji: '🌐', title: '多市场=一站式', desc: '同一个界面看📈美股、🇭🇰港股、🪙加密货币——平台自动适配各市场专属因子。' },
      ].map((item, i) => (
        <div key={i} className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
          <div className="text-xl mb-2">{item.emoji}</div>
          <h4 className="text-xs font-bold text-white mb-1">{item.title}</h4>
          <p className="text-[10px] text-gray-400 leading-relaxed">{item.desc}</p>
        </div>
      ))}
    </div>
    <div className="bg-[#D4A853]/5 border border-[#D4A853]/20 rounded-lg p-3 text-[10px] text-gray-300">
      💡 <strong className="text-[#D4A853]">关键：</strong>
      不是AI替你炒股，是AI帮你找到符合你标准的股票。你永远是最终的决策者。
    </div>
  </div>
);

// ── Step 2: Persona selector ─────────────────────────────────────────────────

const Step2Persona: React.FC<{
  selected: string | null;
  onSelect: (id: string) => void;
}> = ({ selected, onSelect }) => (
  <div className="space-y-3">
    <p className="text-xs text-gray-500">选择最像你的一种风格，我们会推荐最适合的因子组合。</p>
    <div className="space-y-2">
      {PERSONAS.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`w-full text-left p-4 rounded-xl border transition-all ${
            selected === p.id
              ? 'border-white/30 shadow-lg'
              : 'border-white/5 hover:border-white/10 hover:bg-white/[0.03]'
          }`}
          style={{
            backgroundColor: selected === p.id ? p.color + '10' : 'transparent',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{p.emoji}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{p.name}</span>
                {selected === p.id && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: p.color + '20', color: p.color }}>
                    ✓ 已选
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">{p.description}</p>
              {selected === p.id && (
                <div className="flex gap-1 mt-2">
                  {p.recommendedPacks.map(packId => {
                    const packNames: Record<string, string> = {
                      defense: '🛡️ 稳健防守', 'value-mining': '⛏️ 价值掘金',
                      'bull-charge': '🐂 牛市进攻', 'growth-hunter': '🦅 成长猎手',
                      'all-weather': '🌈 全天候', 'crypto-trend': '📈 加密趋势',
                      'range-swing': '🔄 震荡轮动',
                    };
                    return (
                      <span key={packId} className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: p.color + '10', color: p.color, border: `1px solid ${p.color}30` }}>
                        {packNames[packId] || packId}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  </div>
);

// ── Step 3: First signal demo ────────────────────────────────────────────────

const Step3Signal: React.FC<{
  onFinish: () => void;
}> = ({ onFinish }) => {
  const demoFactors = [
    { name: '12月动量', id: 'MOM_12M', color: 'green' as const, ic: 0.045, label: '看好' },
    { name: '品质因子', id: 'QUAL', color: 'green' as const, ic: 0.040, label: '看好' },
    { name: '60日低波', id: 'VOL_60D', color: 'yellow' as const, ic: -0.038, label: '中性' },
    { name: '做空比率', id: 'US_SHORT', color: 'yellow' as const, ic: 0.025, label: '中性' },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">每个因子都有一个"信号灯"。绿色=看好，黄色=中性，红色=看空，灰色=数据不足。</p>

      <div className="bg-[#1a1a25] rounded-lg border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">示例市场</span>
          <span className="text-[10px] text-[#D4A853]">🇺🇸 美股市场</span>
        </div>

        {demoFactors.map((f, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{
                backgroundColor: f.color === 'green' ? '#4CAF50' : '#FFC107',
              }} />
              <span className="text-xs text-white">{f.name}</span>
              <span className="text-[10px] text-gray-600 font-mono">{f.id}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-green-400">IC: {f.ic.toFixed(3)}</span>
              <FactorSignalLight data={{ color: f.color, label: f.label }} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 text-[10px] text-gray-300">
        🟢 <strong className="text-green-400">当前信号解读：</strong>
        动量因子和品质因子都是绿灯——说明当前美股市场中，优质+涨势强的股票信号最好。
        可以考虑"🐂 牛市进攻"场景包。
      </div>

      <button
        onClick={onFinish}
        className="w-full py-3 rounded-lg bg-[#D4A853] text-black text-sm font-bold hover:bg-[#C9A046] transition-colors"
      >
        🚀 开始使用因子系统
      </button>
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const FactorOnboarding: React.FC<FactorOnboardingProps> = ({
  onComplete,
  onSkip,
  forceShow = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [persona, setPersona] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
      return;
    }
    try {
      const completed = localStorage.getItem(STORAGE_KEY);
      if (!completed) setIsOpen(true);
    } catch {
      setIsOpen(true);
    }
  }, [forceShow]);

  const handleSkip = useCallback(() => {
    setIsOpen(false);
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
    onSkip?.();
  }, [onSkip]);

  const handleComplete = useCallback(() => {
    setIsOpen(false);
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
    const selectedPersona = PERSONAS.find(p => p.id === persona);
    onComplete?.({
      persona: persona || 'beginner',
      recommendedPacks: selectedPersona?.recommendedPacks || ['defense'],
      firstFactor: 'MOM_12M',
    });
  }, [persona, onComplete]);

  const handleNext = useCallback(() => {
    if (step === 2 && !persona) return; // Require persona selection
    if (step === 3) {
      handleComplete();
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setAnimating(false);
    }, 300);
  }, [step, persona, handleComplete]);

  const handleBack = useCallback(() => {
    setAnimating(true);
    setTimeout(() => {
      setStep(s => s - 1);
      setAnimating(false);
    }, 300);
  }, []);

  if (!isOpen) return null;

  const currentStep = STEPS[step - 1];
  const progress = Math.round((step / STEPS.length) * 100);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm ${className}`}>
      <div className="bg-[#111118] border border-white/10 rounded-2xl shadow-2xl w-[520px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header with progress */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentStep.emoji}</span>
              <div>
                <h2 className="text-base font-bold text-white">{currentStep.title}</h2>
                <p className="text-xs text-gray-500">{currentStep.subtitle}</p>
              </div>
            </div>
            <button onClick={handleSkip} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              跳过 →
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-4">
            {STEPS.map((s) => (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <div
                  className={`h-1 rounded-full transition-all flex-1 ${
                    s.id <= step ? 'bg-[#D4A853]' : 'bg-white/10'
                  }`}
                />
                <span className={`text-[9px] font-mono ${
                  s.id <= step ? 'text-[#D4A853]' : 'text-gray-600'
                }`}>
                  {s.id}/3
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className={`px-6 py-4 transition-opacity duration-300 ${animating ? 'opacity-0' : 'opacity-100'}`}>
          {step === 1 && <Step1Concept />}
          {step === 2 && <Step2Persona selected={persona} onSelect={setPersona} />}
          {step === 3 && <Step3Signal onFinish={handleComplete} />}
        </div>

        {/* Footer nav */}
        {step < 3 && (
          <div className="px-6 pb-6 pt-2 flex justify-between">
            <button
              onClick={step === 1 ? handleSkip : handleBack}
              className="px-4 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {step === 1 ? '跳过' : '← 上一步'}
            </button>
            <button
              onClick={handleNext}
              disabled={step === 2 && !persona}
              className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${
                step === 2 && !persona
                  ? 'bg-white/[0.03] text-gray-600 cursor-not-allowed'
                  : 'bg-[#D4A853] text-black hover:bg-[#C9A046]'
              }`}
            >
              {step === 2 ? '完成 →' : '下一步 →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FactorOnboarding;
