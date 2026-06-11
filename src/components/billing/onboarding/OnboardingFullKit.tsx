import i18n from '../../../i18n';
import { EngineError } from '../../../../electron/engine/core/engine-error';
﻿import { useState, useMemo, type CSSProperties } from 'react';
// ── Types ──
interface Step {
  id: number
  title: string
  subtitle: string
  icon: string
}

interface IndicatorCard { name: string; short: string; usage: string; risk: string; category: 'trend' | 'momentum' | 'volatility' | 'volume' }

interface FactorStory { factor: string; story: string; example: string }

interface ParameterPreset { label: string; icon: string; fast: number; slow: number; signal: number; description: string }

interface BacktestStory { title: string; initial: string; final: string; maxDrawdown: string; winRate: string; verdict: string; verdictColor: string }

interface SignalPair { type: 'good' | 'bad'; date: string; signal: string; entry: string; exit: string; pnl: string; reason: string }

interface ConflictRule { signalA: string; signalB: string; meaning: string; action: string; color: string }

const ONBOARD_STEPS: Step[] = [
  { id: 1, title: i18n.t('OnboardingFullKit.k1'), subtitle: i18n.t('OnboardingFullKit.k2'), icon: '🌍' },
  { id: 2, title: i18n.t('OnboardingFullKit.k3'), subtitle: i18n.t('OnboardingFullKit.k4'), icon: '📋' },
  { id: 3, title: i18n.t('OnboardingFullKit.k5'), subtitle: i18n.t('OnboardingFullKit.k6'), icon: '🎚️' },
  { id: 4, title: i18n.t('OnboardingFullKit.k7'), subtitle: i18n.t('OnboardingFullKit.k8'), icon: '📈' },
  { id: 5, title: i18n.t('OnboardingFullKit.k9'), subtitle: i18n.t('OnboardingFullKit.k10'), icon: '🚀' },
];

const INDICATOR_CARDS: IndicatorCard[] = [
  { name: i18n.t('OnboardingFullKit.k11'), short: i18n.t('OnboardingFullKit.k12'), usage: i18n.t('OnboardingFullKit.k13'), risk: i18n.t('OnboardingFullKit.k14'), category: 'trend' },
  { name: i18n.t('OnboardingFullKit.k15'), short: i18n.t('OnboardingFullKit.k16'), usage: i18n.t('OnboardingFullKit.k17'), risk: i18n.t('OnboardingFullKit.k18'), category: 'momentum' },
  { name: 'MACD', short: i18n.t('OnboardingFullKit.k19'), usage: i18n.t('OnboardingFullKit.k20'), risk: i18n.t('OnboardingFullKit.k21'), category: 'trend' },
  { name: i18n.t('OnboardingFullKit.k22'), short: i18n.t('OnboardingFullKit.k23'), usage: i18n.t('OnboardingFullKit.k24'), risk: i18n.t('OnboardingFullKit.k25'), category: 'volatility' },
  { name: i18n.t('OnboardingFullKit.k26'), short: i18n.t('OnboardingFullKit.k27'), usage: i18n.t('OnboardingFullKit.k28'), risk: i18n.t('OnboardingFullKit.k29'), category: 'volume' },
  { name: i18n.t('OnboardingFullKit.k30'), short: i18n.t('OnboardingFullKit.k31'), usage: i18n.t('OnboardingFullKit.k32'), risk: i18n.t('OnboardingFullKit.k33'), category: 'volatility' },
  { name: i18n.t('OnboardingFullKit.k34'), short: i18n.t('OnboardingFullKit.k35'), usage: i18n.t('OnboardingFullKit.k36'), risk: i18n.t('OnboardingFullKit.k37'), category: 'trend' },
  { name: i18n.t('OnboardingFullKit.k38'), short: i18n.t('OnboardingFullKit.k39'), usage: i18n.t('OnboardingFullKit.k40'), risk: i18n.t('OnboardingFullKit.k41'), category: 'volume' },
];

const FACTOR_STORIES: FactorStory[] = [
  { factor: i18n.t('OnboardingFullKit.k42'), story: i18n.t('OnboardingFullKit.k43'), example: i18n.t('OnboardingFullKit.k44') },
  { factor: i18n.t('OnboardingFullKit.k45'), story: i18n.t('OnboardingFullKit.k46'), example: i18n.t('OnboardingFullKit.k47') },
  { factor: i18n.t('OnboardingFullKit.k48'), story: i18n.t('OnboardingFullKit.k49'), example: i18n.t('OnboardingFullKit.k50') },
  { factor: i18n.t('OnboardingFullKit.k51'), story: i18n.t('OnboardingFullKit.k52'), example: i18n.t('OnboardingFullKit.k53') },
];

const PRESETS: ParameterPreset[] = [
  { label: i18n.t('OnboardingFullKit.k54'), icon: '🛡️', fast: 5, slow: 20, signal: 9, description: i18n.t('OnboardingFullKit.k55') },
  { label: i18n.t('OnboardingFullKit.k56'), icon: '⚖️', fast: 12, slow: 26, signal: 9, description: i18n.t('OnboardingFullKit.k57') },
  { label: i18n.t('OnboardingFullKit.k58'), icon: '🔥', fast: 3, slow: 10, signal: 5, description: i18n.t('OnboardingFullKit.k59') },
];

const BACKTEST_STORIES: BacktestStory[] = [
  { title: i18n.t('OnboardingFullKit.k60'), initial: 'HK$100,000', final: 'HK$183,000', maxDrawdown: '-34%', winRate: '61%', verdict: i18n.t('OnboardingFullKit.k61'), verdictColor: '#10B981' },
  { title: i18n.t('OnboardingFullKit.k62'), initial: 'HK$100,000', final: 'HK$128,000', maxDrawdown: '-18%', winRate: '55%', verdict: i18n.t('OnboardingFullKit.k63'), verdictColor: '#10B981' },
  { title: i18n.t('OnboardingFullKit.k64'), initial: 'HK$100,000', final: 'HK$91,000', maxDrawdown: '-22%', winRate: '42%', verdict: i18n.t('OnboardingFullKit.k65'), verdictColor: '#F59E0B' },
];

const SIGNAL_DEMOS: SignalPair[] = [
  { type: 'good', date: '2026-03-15', signal: i18n.t('OnboardingFullKit.k66'), entry: 'HK$68.50', exit: 'HK$82.30', pnl: '+20.1%', reason: i18n.t('OnboardingFullKit.k67') },
  { type: 'bad', date: '2026-04-02', signal: i18n.t('OnboardingFullKit.k68'), entry: 'HK$75.00', exit: 'HK$66.00', pnl: '-12.0%', reason: i18n.t('OnboardingFullKit.k69') },
];

const CONFLICT_RULES: ConflictRule[] = [
  { signalA: i18n.t('OnboardingFullKit.k70'), signalB: i18n.t('OnboardingFullKit.k71'), meaning: i18n.t('OnboardingFullKit.k72'), action: i18n.t('OnboardingFullKit.k73'), color: '#EF4444' },
  { signalA: i18n.t('OnboardingFullKit.k74'), signalB: i18n.t('OnboardingFullKit.k75'), meaning: i18n.t('OnboardingFullKit.k76'), action: i18n.t('OnboardingFullKit.k77'), color: '#10B981' },
  { signalA: i18n.t('OnboardingFullKit.k78'), signalB: i18n.t('OnboardingFullKit.k79'), meaning: i18n.t('OnboardingFullKit.k80'), action: i18n.t('OnboardingFullKit.k81'), color: '#F59E0B' },
  { signalA: i18n.t('OnboardingFullKit.k82'), signalB: i18n.t('OnboardingFullKit.k83'), meaning: i18n.t('OnboardingFullKit.k84'), action: i18n.t('OnboardingFullKit.k85'), color: '#F59E0B' },
];

// ── Sub-components ──
function StepIndicator({ current }: { current: number }) {

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
      {ONBOARD_STEPS.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700,
              background: i < current ? '#6366F1' : i === current ? '#6366F133' : '#1F2937',
              border: i === current ? '2px solid #6366F1' : i < current ? 'none' : '1px solid #374151',
              color: i <= current ? '#FFF' : '#6B7280', transition: 'all 0.3s',
            }}
          >
            {i < current ? '✓' : s.icon}
          </div>
          {i < 4 && (
            <div style={{ width: 24, height: 2, background: i < current ? '#6366F1' : '#374151', transition: 'all 0.3s' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function IndicatorCardC({ card }: { card: IndicatorCard }) {
  const catColors: Record<string, string> = { trend: '#3B82F6', momentum: '#10B981', volatility: '#F59E0B', volume: '#EF4444' };
  const catLabels: Record<string, string> = { trend: 'components.trend', momentum: i18n.t('OnboardingFullKit.k86'), volatility: i18n.t('OnboardingFullKit.k87'), volume: 'components.volume' };

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12, background: '#1F2937', border: '1px solid #374151',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB' }}>{card.name}</span>
        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: catColors[card.category] + '22', color: catColors[card.category] }}>
          {catLabels[card.category]}
        </span>
      </div>
      <div>
        <span style={{ fontSize: 11, color: '#6B7280' }}>{i18n.t('OnboardingFullKit.k88')}</span>
        <span style={{ fontSize: 12, color: '#D1D5DB' }}>{card.short}</span>
      </div>
      <div>
        <span style={{ fontSize: 11, color: '#6B7280' }}>{i18n.t('OnboardingFullKit.k89')}</span>
        <span style={{ fontSize: 12, color: '#34D399' }}>{card.usage}</span>
      </div>
      <div>
        <span style={{ fontSize: 11, color: '#6B7280' }}>{i18n.t('OnboardingFullKit.k90')}</span>
        <span style={{ fontSize: 12, color: '#FCA5A5' }}>{card.risk}</span>
      </div>
    </div>
  );
}

function FactorStoryCard({ story }: { story: FactorStory }) {
  return (
    <div style={{ padding: '16px 18px', borderRadius: 12, background: '#1F2937', border: '1px solid #374151' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 8 }}>📖 {story.factor}</div>
      <div style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.7, marginBottom: 10 }}>
        {story.story}
      </div>
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#111827', fontSize: 12, color: '#818CF8' }}>
        💡 举例：{story.example}
      </div>
    </div>
  );
}

function PresetCard({ preset, selected, onClick }: { preset: ParameterPreset; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '16px', borderRadius: 12, border: selected ? '2px solid #6366F1' : '1px solid #374151',
        background: selected ? '#6366F112' : '#1F2937', cursor: 'pointer',
        textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.2s',
      }}
    >
      <div style={{ fontSize: 22 }}>{preset.icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: selected ? '#A5B4FC' : '#D1D5DB' }}>{preset.label}</div>
      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
        MA{preset.fast}/{preset.slow} · Signal:{preset.signal}
      </div>
      <div style={{ fontSize: 11, color: '#6B7280' }}>{preset.description}</div>
    </button>
  );
}

function BacktestStoryRow({ story }: { story: BacktestStory }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 10, background: '#1F2937', border: '1px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB' }}>{story.title}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
          {story.initial} → {story.final} · 最大回撤 {story.maxDrawdown} · 胜率 {story.winRate}
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: story.verdictColor }}>{story.verdict}</div>
    </div>
  );
}

function SignalComparisonCard({ pair }: { pair: SignalPair }) {
  const isGood = pair.type === 'good';
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 10, border: `1px solid ${isGood ? '#10B98133' : '#EF444433'}`,
      background: isGood ? '#10B9810A' : '#EF44440A',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: isGood ? '#34D399' : '#FCA5A5' }}>
          {isGood ? i18n.t('OnboardingFullKit.k91') : i18n.t('OnboardingFullKit.k92')}
        </span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{pair.date}</span>
      </div>
      <div style={{ fontSize: 12, color: '#D1D5DB', marginBottom: 6 }}>
        <strong>{i18n.t('OnboardingFullKit.k93')}</strong> {pair.signal}
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{i18n.t('OnboardingFullKit.k94')}<span style={{ color: '#D1D5DB' }}>{pair.entry}</span></span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{i18n.t('OnboardingFullKit.k95')}<span style={{ color: '#D1D5DB' }}>{pair.exit}</span></span>
        <span style={{ fontSize: 13, fontWeight: 700, color: isGood ? '#10B981' : '#EF4444' }}>{pair.pnl}</span>
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>📝 {pair.reason}</div>
    </div>
  );
}

function ConflictRuleCard({ rule }: { rule: ConflictRule }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${rule.color}33`, background: rule.color + '0A' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: rule.color + '22', color: rule.color }}>
          {rule.signalA}
        </span>
        <span style={{ color: '#6B7280', fontSize: 13 }}>+</span>
        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: rule.color + '22', color: rule.color }}>
          {rule.signalB}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#D1D5DB' }}>
        = <strong>{rule.meaning}</strong> → {rule.action}
      </div>
    </div>
  );
}

function HealthCheckDemo() {
  const checks = [
    { label: 'components.winRate', value: '61%', verdict: i18n.t('OnboardingFullKit.k96'), color: '#10B981' },
    { label: 'components.maxDrawdown', value: '-34%', verdict: i18n.t('OnboardingFullKit.k97'), color: '#F59E0B' },
    { label: i18n.t('OnboardingFullKit.k98'), value: '1.42', verdict: i18n.t('OnboardingFullKit.k99'), color: '#10B981' },
    { label: 'components.profitLossRatio', value: '2.3:1', verdict: i18n.t('OnboardingFullKit.k100'), color: '#10B981' },
    { label: i18n.t('OnboardingFullKit.k101'), value: i18n.t('OnboardingFullKit.k102'), verdict: i18n.t('OnboardingFullKit.k103'), color: '#F59E0B' },
    { label: i18n.t('OnboardingFullKit.k104'), value: i18n.t('OnboardingFullKit.k105'), verdict: i18n.t('OnboardingFullKit.k106'), color: '#10B981' },
  ];

  return (
    <div style={{
      padding: '16px', borderRadius: 12, background: '#1F2937', border: '1px solid #374151',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
    }}>
      {checks.map(c => (
        <div key={c.label} style={{ padding: '8px 12px', borderRadius: 8, background: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{c.label}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#D1D5DB' }}>{c.value}</span>
            <span style={{ fontSize: 11, color: c.color }}>{c.verdict}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FriendlyErrorBanner() {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 10, background: '#6366F10A', border: '1px solid #6366F133',
      marginBottom: 12,
    }}>
      <div style={{ fontSize: 13, color: '#D1D5DB', marginBottom: 6 }}>
        💡 <strong>{i18n.t('OnboardingFullKit.k107')}</strong> — 我们不说"Error: invalid_input_400", 我们说：
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ fontSize: 11, color: '#EF4444' }}>
          ❌ 旧: i18n.t('OnboardingFullKit.k108')
        </div>
        <div style={{ fontSize: 11, color: '#34D399' }}>
          ✅ 新: i18n.t('OnboardingFullKit.k109')
        </div>
        <div style={{ fontSize: 11, color: '#EF4444' }}>
          ❌ 旧: i18n.t('OnboardingFullKit.k110')
        </div>
        <div style={{ fontSize: 11, color: '#34D399' }}>
          ✅ 新: i18n.t('OnboardingFullKit.k111')
        </div>
      </div>
    </div>
  );
}

// ── Main ──
export default function OnboardingFullKit() {
  const [step, setStep] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [sliderVal, setSliderVal] = useState(12);
  const theme: CSSProperties = {
    background: '#0A0A10', borderRadius: 16, padding: 24,
    border: '1px solid #1F2937', color: '#E5E7EB',
    maxWidth: 1000, margin: '0 auto',
  };

  const stepContent = useMemo(() => {
    switch (step) {
      case 0: return <OnboardingIntro onStart={() => setStep(1)} />;
      case 1: return <TutorialFlow onComplete={() => setStep(2)} sliderVal={sliderVal} setSliderVal={setSliderVal} selectedPreset={selectedPreset} setSelectedPreset={setSelectedPreset} />;
      case 2: return <MetricsAndFactors />;
      case 3: return <BacktestAndSignals />;
      case 4: return <CompletionScreen />;
      default: return null;
    }
  }, [step, sliderVal, selectedPreset]);

  return (
    <div style={theme}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F9FAFB' }}>
            🎓 新手引导中心
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            {step === 0 ? i18n.t('OnboardingFullKit.k112') : step === 1 ? i18n.t('OnboardingFullKit.k113') : step === 2 ? i18n.t('OnboardingFullKit.k114') : step === 3 ? i18n.t('OnboardingFullKit.k115') : i18n.t('OnboardingFullKit.k116')}
          </p>
        </div>
        {/* Nav */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[i18n.t('OnboardingFullKit.k117'), i18n.t('OnboardingFullKit.k118'), i18n.t('OnboardingFullKit.k119'), i18n.t('OnboardingFullKit.k120'), i18n.t('OnboardingFullKit.k121')].map((label, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: 'none',
                background: step === i ? '#6366F1' : 'transparent',
                color: step === i ? '#FFF' : '#6B7280', fontSize: 12, cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <StepIndicator current={step} />

      {stepContent}

      {/* Bottom nav */}
      {step > 0 && step < 4 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            style={{
              padding: '8px 20px', borderRadius: 8, border: '1px solid #374151',
              background: '#1F2937', color: '#D1D5DB', fontSize: 14, cursor: 'pointer',
            }}
          >
            ← 上一步
          </button>
          <button
            onClick={() => setStep(s => Math.min(4, s + 1))}
            style={{
              padding: '8px 24px', borderRadius: 8, border: 'none',
              background: '#6366F1', color: '#FFF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            下一步 →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 0: Intro ──
function OnboardingIntro({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🚀</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#F9FAFB', marginBottom: 8 }}>
        欢迎来到 Dawn Whales
      </div>
      <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 32, lineHeight: 1.8 }}>
        5步创建你的第一个量化策略<br />
        无需编程 · 自然语言 · 30秒出结果
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
        {ONBOARD_STEPS.map(s => (
          <div key={s.id} style={{ padding: '12px 8px', borderRadius: 10, background: '#1F2937', border: '1px solid #374151', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#D1D5DB' }}>{s.title}</div>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        style={{
          padding: '14px 48px', borderRadius: 12, border: 'none', background: '#6366F1',
          color: '#FFF', fontSize: 16, fontWeight: 700, cursor: 'pointer',
        }}
      >
        🎯 开始引导教程
      </button>

      <div style={{ marginTop: 16, fontSize: 12, color: '#6B7280' }}>
        约 3 分钟 · 免费 · 无需注册
      </div>
    </div>
  );
}

// ── Step 1: Tutorial Flow ──
function TutorialFlow({ onComplete, sliderVal, setSliderVal, selectedPreset, setSelectedPreset }: {
  onComplete: () => void
  sliderVal: number; setSliderVal: (v: number) => void
  selectedPreset: string | null; setSelectedPreset: (v: string) => void
}) {
  return (
    <div>
      <FriendlyErrorBanner />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Left: presets */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#D1D5DB', marginBottom: 10 }}>
            🎚️ 参数预设 — 一键选风格
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {PRESETS.map(p => (
              <PresetCard key={p.label} preset={p} selected={selectedPreset === p.label} onClick={() => setSelectedPreset(p.label)} />
            ))}
          </div>
        </div>

        {/* Right: slider */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#D1D5DB', marginBottom: 10 }}>
            🎚️ 参数滑块 — 精细调节
          </div>
          <div style={{ padding: '16px', borderRadius: 12, background: '#1F2937', border: '1px solid #374151' }}>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>
              快线参数 (MA Fast Period)
            </div>
            <input
              type="range"
              min={3}
              max={50}
              value={sliderVal}
              onChange={e => setSliderVal(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#6366F1', height: 6 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginTop: 2 }}>
              <span>{i18n.t('OnboardingFullKit.k122')}</span>
              <span style={{ fontWeight: 700, color: '#818CF8' }}>{sliderVal}</span>
              <span>{i18n.t('OnboardingFullKit.k123')}</span>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF' }}>
              💡 <span style={{ color: '#D1D5DB' }}>
                {sliderVal <= 8 ? i18n.t('OnboardingFullKit.k124') :
                 sliderVal <= 20 ? i18n.t('OnboardingFullKit.k125') :
                 i18n.t('OnboardingFullKit.k126')}
              </span>
            </div>

            {/* Param impact preview */}
            <div style={{ marginTop: 12, padding: '10px', borderRadius: 8, background: '#111827' }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{i18n.t('OnboardingFullKit.k127')}</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>{i18n.t('OnboardingFullKit.k128')}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#818CF8' }}>
                    {sliderVal <= 8 ? '15-25' : sliderVal <= 20 ? '8-15' : '3-8'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>{i18n.t('OnboardingFullKit.k129')}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#34D399' }}>
                    {sliderVal <= 8 ? '~45%' : sliderVal <= 20 ? '~55%' : '~65%'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Safety boundary warning */}
          {sliderVal < 5 && (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#EF444418', border: '1px solid #EF444433', fontSize: 11, color: '#FCA5A5' }}>
              ⚠️ 参数过小 (&lt;5) 可能导致过度交易，回测结果不可靠
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onComplete}
        style={{
          padding: '10px 32px', borderRadius: 8, border: 'none', background: '#10B981',
          color: '#FFF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ✅ 我已理解，继续学习
      </button>
    </div>
  );
}

// ── Step 2: Metrics & Factors ──
function MetricsAndFactors() {
  const [tab, setTab] = useState<'indicators' | 'factors' | 'conflicts'>('indicators');

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { key: 'indicators' as const, label: i18n.t('OnboardingFullKit.k130') },
          { key: 'factors' as const, label: i18n.t('OnboardingFullKit.k131') },
          { key: 'conflicts' as const, label: i18n.t('OnboardingFullKit.k132') },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: tab === t.key ? '#6366F1' : '#1F2937',
              color: tab === t.key ? '#FFF' : '#9CA3AF', fontSize: 13, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'indicators' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {INDICATOR_CARDS.map(c => <IndicatorCardC key={c.name} card={c} />)}
        </div>
      )}

      {tab === 'factors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FACTOR_STORIES.map(f => <FactorStoryCard key={f.factor} story={f} />)}
        </div>
      )}

      {tab === 'conflicts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {CONFLICT_RULES.map((r, i) => <ConflictRuleCard key={i} rule={r} />)}
        </div>
      )}
    </div>
  );
}

// ── Step 3: Backtest & Signals ──
function BacktestAndSignals() {
  const [tab, setTab] = useState<'stories' | 'signals' | 'health'>('stories');

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { key: 'stories' as const, label: i18n.t('OnboardingFullKit.k133') },
          { key: 'signals' as const, label: i18n.t('OnboardingFullKit.k134') },
          { key: 'health' as const, label: i18n.t('OnboardingFullKit.k135') },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: tab === t.key ? '#6366F1' : '#1F2937',
              color: tab === t.key ? '#FFF' : '#9CA3AF', fontSize: 13, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BACKTEST_STORIES.map(s => <BacktestStoryRow key={s.title} story={s} />)}
          <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
            💡 回测故事化 — 把冷冰冰的数字变成i18n.t('OnboardingFullKit.k136')的直观感受
          </div>
        </div>
      )}

      {tab === 'signals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SIGNAL_DEMOS.map((p, i) => <SignalComparisonCard key={i} pair={p} />)}
        </div>
      )}

      {tab === 'health' && (
        <div>
          <HealthCheckDemo />
          <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: '#1F2937', border: '1px solid #374151', fontSize: 13, color: '#D1D5DB' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{i18n.t('OnboardingFullKit.k137')}</div>
            <div style={{ lineHeight: 1.8 }}>
              不仅仅是看总收益！胜率、回撤、夏普、盈亏比、持仓集中度——<br />
              六维体检帮你发现策略的潜在风险。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Completion ──
function CompletionScreen() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#F9FAFB', marginBottom: 8 }}>
        恭喜出师！
      </div>
      <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 24, lineHeight: 1.8 }}>
        你已掌握量化策略创建全流程<br />
        现在就开始创建你的第一个策略吧
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button style={{
          padding: '12px 32px', borderRadius: 10, border: 'none', background: '#6366F1',
          color: '#FFF', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>
          🚀 创建第一个策略
        </button>
        <button style={{
          padding: '12px 32px', borderRadius: 10, border: '1px solid #374151',
          background: '#1F2937', color: '#D1D5DB', fontSize: 15, cursor: 'pointer',
        }}>
          📋 浏览模板市场
        </button>
        <button style={{
          padding: '12px 32px', borderRadius: 10, border: '1px solid #374151',
          background: '#1F2937', color: '#D1D5DB', fontSize: 15, cursor: 'pointer',
        }}>
          🤖 自然语言创建
          <span style={{ marginLeft: 6, padding: '2px 6px', borderRadius: 4, fontSize: 9, background: '#F59E0B22', color: '#F59E0B' }}>USDT</span>
        </button>
      </div>
    </div>
  );
}

void EngineError; // [TRADE] structured error tracking