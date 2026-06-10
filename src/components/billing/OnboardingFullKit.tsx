import { useState, useMemo, type CSSProperties } from 'react';

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
  { id: 1, title: '选择市场', subtitle: '港股·美股·新加坡·日本·澳洲·加拿大·马来西亚', icon: '🌍' },
  { id: 2, title: '选择模板', subtitle: '20+量化模板·按市场和品种智能推荐', icon: '📋' },
  { id: 3, title: '调整参数', subtitle: '保守/均衡/激进一键预设·滑块微调·AI推荐', icon: '🎚️' },
  { id: 4, title: '回测验证', subtitle: '3年历史数据·实时收益曲线·健康检查', icon: '📈' },
  { id: 5, title: '发布上线', subtitle: '模拟/实盘一键切换·信号广场分享', icon: '🚀' },
];

const INDICATOR_CARDS: IndicatorCard[] = [
  { name: 'MA 移动均线', short: '趋势跟踪', usage: '短买长卖：5日突破20日买入', risk: '震荡市频繁假突破', category: 'trend' },
  { name: 'RSI 相对强弱', short: '超买超卖', usage: 'RSI<30超卖买入, RSI>70超买卖出', risk: '强趋势中RSI长时间极端', category: 'momentum' },
  { name: 'MACD', short: '趋势+动能', usage: '金叉买入·死叉卖出', risk: '滞后指标, 拐点延迟', category: 'trend' },
  { name: 'Bollinger 布林带', short: '波动率通道', usage: '触及下轨买入·触及上轨卖出', risk: '单边市突破后不止步', category: 'volatility' },
  { name: 'Volume 成交量', short: '资金流向', usage: '放量突破确认趋势', risk: '主力对倒放量欺骗', category: 'volume' },
  { name: 'ATR 真实波幅', short: '止损计算', usage: '2倍ATR止损·3倍ATR止盈', risk: '跳空缺口ATR失真', category: 'volatility' },
  { name: 'SAR 抛物线', short: '反转止损', usage: 'SAR在价格上方→止损', risk: '盘整频繁反转', category: 'trend' },
  { name: 'OBV 能量潮', short: '量价配合', usage: 'OBV与价格同向确认趋势', risk: '大单砸盘OBV骤降', category: 'volume' },
];

const FACTOR_STORIES: FactorStory[] = [
  { factor: '高 ROE', story: 'ROE=净资产收益率, 代表公司用股东的每一块钱能赚多少。高ROE=赚钱能力强, 像一台高效的印钞机。', example: '腾讯ROE~18%, 每100块净资产年赚18块' },
  { factor: '低 PE', story: 'PE=市盈率=股价÷每股收益。低PE=你很便宜地买到了同等利润。但注意：低PE可能是因为公司要不行了！', example: '银行股PE~5, 但不代表全部有价值陷阱' },
  { factor: '高股息率', story: '股息率=每股分红÷股价。高股息=上市公司从口袋里掏出真金白银给你花。防御型投资者最爱。', example: '中移动股息率~7%, 存银行不如买它' },
  { factor: '动量因子', story: '过去涨得好的, 近期还可能继续涨。就像赛跑中领跑的选手有惯性优势。但要提防"动量崩溃"！', example: '过去12个月涨幅前20%的股票, 下月平均仍跑赢' },
];

const PRESETS: ParameterPreset[] = [
  { label: '保守', icon: '🛡️', fast: 5, slow: 20, signal: 9, description: '信号少, 胜率高, 适合大盘股' },
  { label: '均衡', icon: '⚖️', fast: 12, slow: 26, signal: 9, description: '经典MACD参数, 通用性强' },
  { label: '激进', icon: '🔥', fast: 3, slow: 10, signal: 5, description: '高频信号, 适合短线波段' },
];

const BACKTEST_STORIES: BacktestStory[] = [
  { title: '快手-W (01024)', initial: 'HK$100,000', final: 'HK$183,000', maxDrawdown: '-34%', winRate: '61%', verdict: '优秀 ⭐', verdictColor: '#10B981' },
  { title: '小米集团 (01810)', initial: 'HK$100,000', final: 'HK$128,000', maxDrawdown: '-18%', winRate: '55%', verdict: '良好 ✅', verdictColor: '#10B981' },
  { title: '恒生ETF (02800)', initial: 'HK$100,000', final: 'HK$91,000', maxDrawdown: '-22%', winRate: '42%', verdict: '谨慎 ⚠️', verdictColor: '#F59E0B' },
];

const SIGNAL_DEMOS: SignalPair[] = [
  { type: 'good', date: '2026-03-15', signal: 'MACD金叉 + RSI<30超卖', entry: 'HK$68.50', exit: 'HK$82.30', pnl: '+20.1%', reason: 'RSI超卖后反弹, MACD金叉确认上涨' },
  { type: 'bad', date: '2026-04-02', signal: 'MA5突破MA20 + 放量', entry: 'HK$75.00', exit: 'HK$66.00', pnl: '-12.0%', reason: '假突破: 次日成交量骤缩, 主力诱多' },
];

const CONFLICT_RULES: ConflictRule[] = [
  { signalA: 'RSI超买 (>70)', signalB: 'MACD死叉', meaning: '双重看跌确认', action: '强烈卖出信号, 减仓/清仓', color: '#EF4444' },
  { signalA: 'RSI超卖 (<30)', signalB: 'MACD金叉', meaning: '双重看涨确认', action: '强烈买入信号, 分批建仓', color: '#10B981' },
  { signalA: 'MA金叉 (买入)', signalB: 'RSI超买 (卖出)', meaning: '指标冲突', action: '观望, 等一方确认后再操作', color: '#F59E0B' },
  { signalA: '放量突破', signalB: 'OBV下降', meaning: '量价背离', action: '谨慎, 可能主力对倒出货', color: '#F59E0B' },
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
  const catLabels: Record<string, string> = { trend: t('components.trend'), momentum: '动量', volatility: '波动', volume: t('components.volume') };

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
        <span style={{ fontSize: 11, color: '#6B7280' }}>一句话: </span>
        <span style={{ fontSize: 12, color: '#D1D5DB' }}>{card.short}</span>
      </div>
      <div>
        <span style={{ fontSize: 11, color: '#6B7280' }}>用法: </span>
        <span style={{ fontSize: 12, color: '#34D399' }}>{card.usage}</span>
      </div>
      <div>
        <span style={{ fontSize: 11, color: '#6B7280' }}>⚠️ 风险: </span>
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
          {isGood ? '🟢 盈利信号' : '🔴 亏损信号'}
        </span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{pair.date}</span>
      </div>
      <div style={{ fontSize: 12, color: '#D1D5DB', marginBottom: 6 }}>
        <strong>信号:</strong> {pair.signal}
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>入场: <span style={{ color: '#D1D5DB' }}>{pair.entry}</span></span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>出场: <span style={{ color: '#D1D5DB' }}>{pair.exit}</span></span>
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
    { label: t('components.winRate'), value: '61%', verdict: '✅ 良好', color: '#10B981' },
    { label: t('components.maxDrawdown'), value: '-34%', verdict: '⚠️ 偏高', color: '#F59E0B' },
    { label: '夏普比率', value: '1.42', verdict: '✅ 优秀', color: '#10B981' },
    { label: t('components.profitLossRatio'), value: '2.3:1', verdict: '✅ 良好', color: '#10B981' },
    { label: '最大持仓', value: 'HK$68万', verdict: '⚠️ 建议不超总资金20%', color: '#F59E0B' },
    { label: '连续亏损', value: '4次', verdict: '✅ 可接受', color: '#10B981' },
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
        💡 <strong>友好提示示例</strong> — 我们不说"Error: invalid_input_400", 我们说：
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ fontSize: 11, color: '#EF4444' }}>
          ❌ 旧: "代码格式错误, 请输入有效代码"
        </div>
        <div style={{ fontSize: 11, color: '#34D399' }}>
          ✅ 新: "港股代码是5位数字哦（如 00700），试试重新输入？"
        </div>
        <div style={{ fontSize: 11, color: '#EF4444' }}>
          ❌ 旧: "参数超出范围"
        </div>
        <div style={{ fontSize: 11, color: '#34D399' }}>
          ✅ 新: "快线 5~20 适合短线快进快出, 慢线 20~200 适合中长期趋势——调整一下试试？"
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
            {step === 0 ? '5步上手，30秒创建第一个策略' : step === 1 ? '跟做模式：边学边做' : step === 2 ? '指标卡片·因子故事·参数说明' : step === 3 ? '回测解读·信号对比·健康检查' : '🎉 恭喜出师！'}
          </p>
        </div>
        {/* Nav */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['📋 引导', '🎚️ 教程', '📖 指标', '📊 回测', '✅ 完成'].map((label, i) => (
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
              <span>3 (超短线)</span>
              <span style={{ fontWeight: 700, color: '#818CF8' }}>{sliderVal}</span>
              <span>50 (长线)</span>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF' }}>
              💡 <span style={{ color: '#D1D5DB' }}>
                {sliderVal <= 8 ? '"快线5-20适合快进快出做短线，信号密集但假信号多。"' :
                 sliderVal <= 20 ? '"快线8-20是短线常用区间，捕捉1-3周趋势。"' :
                 '"慢线20-200适合中长期趋势跟踪，信号少但准。"'}
              </span>
            </div>

            {/* Param impact preview */}
            <div style={{ marginTop: 12, padding: '10px', borderRadius: 8, background: '#111827' }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>📊 参数影响预览</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>预期信号数/月</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#818CF8' }}>
                    {sliderVal <= 8 ? '15-25' : sliderVal <= 20 ? '8-15' : '3-8'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>预期胜率</div>
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
          { key: 'indicators' as const, label: '📊 指标卡片' },
          { key: 'factors' as const, label: '📖 因子故事' },
          { key: 'conflicts' as const, label: '⚠️ 冲突规则' },
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
          { key: 'stories' as const, label: '📈 回测故事' },
          { key: 'signals' as const, label: '🟢🔴 信号对比' },
          { key: 'health' as const, label: '🩺 健康检查' },
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
            💡 回测故事化 — 把冷冰冰的数字变成"投入1万→变1.8万"的直观感受
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
            <div style={{ fontWeight: 600, marginBottom: 4 }}>📊 回测健康检查</div>
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
