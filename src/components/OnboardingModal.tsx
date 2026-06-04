import { useState, useEffect, useCallback } from 'react';

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => Promise<boolean>;
  connected: boolean;
}

export default function OnboardingModal({ open, onClose, onConnect, connected }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [connectResult, setConnectResult] = useState<'idle' | 'success' | 'fail'>('idle');
  const [demoMode, setDemoMode] = useState(false);
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (connected && step === 0) {
      setConnectResult('success');
    }
  }, [connected, step]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const ok = await onConnect();
      setConnectResult(ok ? 'success' : 'fail');
    } catch {
      setConnectResult('fail');
    } finally {
      setConnecting(false);
    }
  }, [onConnect]);

  const handleSkip = useCallback(() => {
    setSkippedSteps((prev) => new Set(prev).add(step));
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  }, [step, onClose]);

  const handleNext = useCallback(() => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  }, [step, onClose]);

  const handleBack = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  const steps = [
    {
      icon: '🔌',
      title: '连接富途 OpenD',
      desc: '道鲸通过 OpenD 直连你的券商账户，获取实时行情和交易能力。',
      detail: '请确保 OpenD 已启动（默认端口 11111）。如果还没安装，可前往富途官网免费下载。',
      action: handleConnect,
    },
    {
      icon: '📊',
      title: '添加自选股',
      desc: '选择你关注的股票和 ETF，道鲸会实时监控它们的行情变化。',
      detail: '系统已预置 8 只热门标的（TQQQ、SOXL、QQQ、SPY、AAPL、NVDA 等），你也可以在设置中自定义。',
    },
    {
      icon: '🤖',
      title: '创建第一个策略',
      desc: '用一句话描述你的交易思路，AI 自动帮你生成可执行策略。',
      detail: '例如："RSI 低于 30 时买入 TQQQ，涨 5% 卖出"。你也可以选择模板或手动填表。',
    },
    {
      icon: '🛡️',
      title: '设置风控规则',
      desc: '配置你的风险承受能力，道鲸会自动拦截危险操作。',
      detail: '包括单品种上限、日亏损上限、Kelly 仓位管理、回撤降仓等。',
    },
    {
      icon: '🐋',
      title: '开始使用道鲸',
      desc: demoMode
        ? '你已选择演示模式，所有数据为模拟，可安全体验全部功能。'
        : '一切就绪！道鲸正在实时监控市场，为你的交易保驾护航。',
      detail: '',
    },
  ];

  if (!open) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;
  const isSkipped = skippedSteps.has(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={isLast ? onClose : undefined} />

      {/* Modal */}
      <div className="relative bg-[#12121a] border border-white/10 rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-5">
          {steps.map((s, i) => (
            <div key={i} className="flex-1 flex items-center gap-1">
              <div className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i < step ? 'bg-[#C9A046]' : i === step ? 'bg-[#C9A046]' : 'bg-white/10'
              }`} />
              {i < steps.length - 1 && (
                <div className={`w-1 h-1 rounded-full ${i < step ? 'bg-[#C9A046]' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mt-2">
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all ${
                i === step
                  ? 'bg-[#C9A046] text-black'
                  : i < step
                  ? 'bg-[#C9A046]/30 text-[#D4A853]'
                  : 'bg-white/5 text-gray-500'
              }`}
              title={s.title}
            >
              {i < step ? '✓' : i + 1}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-[#D4A853] font-medium">步骤 {step + 1}/{steps.length}</span>
            {isSkipped && <span className="text-[10px] text-gray-500">(已跳过)</span>}
          </div>

          {/* Icon */}
          <div className="text-5xl mb-4">{current.icon}</div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white mb-2">{current.title}</h2>

          {/* Description */}
          <p className="text-gray-300 text-sm leading-relaxed mb-3">{current.desc}</p>
          {current.detail && (
            <p className="text-gray-500 text-xs leading-relaxed mb-6">{current.detail}</p>
          )}

          {/* Step 0: Connection status */}
          {step === 0 && (
            <div className="mb-4 space-y-3">
              {connectResult === 'idle' && (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
                  等待连接...
                </div>
              )}
              {connectResult === 'success' && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 rounded-lg px-4 py-3 border border-emerald-500/20">
                  <span>✓</span> OpenD 已连接，行情推送正常
                </div>
              )}
              {connectResult === 'fail' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-500/10 rounded-lg px-4 py-3 border border-yellow-500/20">
                    <span>⚠</span> 连接失败 — 检查 OpenD 是否运行 (端口 11111)
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={demoMode}
                      onChange={(e) => setDemoMode(e.target.checked)}
                      className="rounded border-gray-600 bg-[#1a1a25] text-[#C9A046]"
                    />
                    使用演示模式（模拟数据，无需 OpenD）
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Default watchlist */}
          {step === 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {['TQQQ', 'SOXL', 'QQQ', 'SPY', 'AAPL', 'NVDA', 'SQQQ', 'SOXS'].map((s) => (
                <span key={s} className="text-xs bg-[#C9A046]/20 text-[#D4A853] px-3 py-1.5 rounded-lg font-mono">
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Step 2: Example strategies */}
          {step === 2 && (
            <div className="space-y-2 mb-4">
              {['MA5 上穿 MA20 买入 TQQQ', 'RSI < 30 买入 AAPL，止损 5%', 'MACD 金叉买入 QQQ'].map((ex, i) => (
                <div key={i} className="text-xs text-gray-400 bg-[#1a1a25] rounded-lg px-3 py-2 italic border border-white/5">
                  "{ex}"
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Risk config preview */}
          {step === 3 && (
            <div className="grid grid-cols-2 gap-2 mb-4 text-[10px]">
              {[
                { label: '单品种上限', value: '20%' },
                { label: '日亏损上限', value: '5%' },
                { label: 'Kelly 上限', value: '25%' },
                { label: '回撤降仓', value: '15% → 30%' },
              ].map((item) => (
                <div key={item.label} className="bg-[#1a1a25] rounded-lg px-3 py-2 border border-white/5">
                  <div className="text-gray-500">{item.label}</div>
                  <div className="text-gray-300 font-mono">{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Step 4: Completion */}
          {step === 4 && (
            <div className="mb-4">
              <div className="bg-[#C9A046]/5 border border-[#C9A046]/20 rounded-lg p-4">
                <div className="text-[#D4A853] text-sm font-medium mb-1">🎉 配置完成</div>
                <div className="text-gray-400 text-xs">
                  {demoMode
                    ? '演示模式已启用。所有行情和交易均为模拟，可放心探索功能。'
                    : 'OpenD 已连接，策略引擎就绪，风控系统激活。'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          {!isFirst && (
            <button
              onClick={handleBack}
              className="px-4 py-2.5 text-gray-400 text-sm hover:text-gray-200 transition-colors"
            >
              ← 上一步
            </button>
          )}

          {step === 0 && connectResult !== 'success' && (
            <button
              onClick={current.action}
              disabled={connecting}
              className="flex-1 px-4 py-2.5 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] disabled:opacity-40 transition-colors"
            >
              {connecting ? '连接中...' : '连接 OpenD'}
            </button>
          )}

          <button
            onClick={handleNext}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isLast
                ? 'bg-[#C9A046] text-black hover:bg-[#D4A853]'
                : 'bg-[#22222f] text-gray-300 hover:bg-[#2a2a3a]'
            }`}
          >
            {isLast ? '开始使用 🐋' : '下一步 →'}
          </button>

          {!isLast && (
            <button onClick={handleSkip} className="px-4 py-2.5 text-gray-500 text-sm hover:text-gray-300 transition-colors">
              跳过
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
