import { useState, useEffect } from 'react';

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

  useEffect(() => {
    if (connected && step === 0) {
      setConnectResult('success');
    }
  }, [connected, step]);

  if (!open) return null;

  const steps = [
    {
      icon: '🔌',
      title: '连接富途 OpenD',
      desc: '道鲸通过 OpenD 直连你的券商账户，获取实时行情和交易能力。',
      detail: '请确保 OpenD 已启动（默认端口 11111）。如果还没安装，可前往富途官网免费下载。',
      action: async () => {
        setConnecting(true);
        try {
          const ok = await onConnect();
          setConnectResult(ok ? 'success' : 'fail');
        } catch {
          setConnectResult('fail');
        } finally {
          setConnecting(false);
        }
      },
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
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-[#12121a] border border-white/10 rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-5">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-[#C9A046]' : 'bg-white/10'}`} />
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-[#D4A853] font-medium">步骤 {step + 1}/{steps.length}</span>
          </div>

          {/* Icon */}
          <div className="text-5xl mb-4">{current.icon}</div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white mb-2">{current.title}</h2>

          {/* Description */}
          <p className="text-gray-300 text-sm leading-relaxed mb-3">{current.desc}</p>
          <p className="text-gray-500 text-xs leading-relaxed mb-6">{current.detail}</p>

          {/* Step 0: Connection status */}
          {step === 0 && (
            <div className="mb-4">
              {connectResult === 'idle' && (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
                  等待连接...
                </div>
              )}
              {connectResult === 'success' && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 rounded-lg px-4 py-3">
                  <span>✓</span> OpenD 已连接，行情推送正常
                </div>
              )}
              {connectResult === 'fail' && (
                <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-500/10 rounded-lg px-4 py-3">
                  <span>⚠</span> 连接失败 — 可先跳过，稍后在设置中重试
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
                <div key={i} className="text-xs text-gray-400 bg-[#1a1a25] rounded-lg px-3 py-2 italic">
                  "{ex}"
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          {step === 0 && connectResult !== 'success' && (
            <button onClick={current.action} disabled={connecting} className="flex-1 px-4 py-2.5 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] disabled:opacity-40 transition-colors">
              {connecting ? '连接中...' : '连接 OpenD'}
            </button>
          )}

          <button
            onClick={() => {
              if (isLast) {
                onClose();
              } else {
                setStep(step + 1);
              }
            }}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isLast
                ? 'bg-[#C9A046] text-black hover:bg-[#D4A853]'
                : 'bg-[#22222f] text-gray-300 hover:bg-[#2a2a3a]'
            }`}
          >
            {isLast ? '开始使用 🐋' : '下一步 →'}
          </button>

          {!isLast && (
            <button onClick={onClose} className="px-4 py-2.5 text-gray-500 text-sm hover:text-gray-300 transition-colors">
              跳过
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
