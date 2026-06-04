import { useState, useEffect, useCallback, useRef } from 'react';

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => Promise<boolean>;
  connected: boolean;
}

// ── Demo Data Injection ────────────────────────────────────────────────────

function injectDemoData() {
  const now = Date.now();
  const dayMs = 86400000;

  // Mock equity curve (90 days)
  const equityCurve: number[] = [];
  let equity = 100000;
  for (let i = 90; i >= 0; i--) {
    const change = (Math.random() - 0.45) * 0.02 * equity;
    equity += change;
    equityCurve.push(Math.round(equity));
  }

  // Mock positions
  const positions = [
    { code: 'US.TQQQ', name: 'TQQQ', qty: 200, avgPrice: 45.5, currentPrice: 48.2, pnl: 540, pnlPct: 5.93 },
    { code: 'US.QQQ', name: 'QQQ', qty: 50, avgPrice: 380, currentPrice: 395, pnl: 750, pnlPct: 3.95 },
    { code: 'US.SPY', name: 'SPY', qty: 30, avgPrice: 520, currentPrice: 510, pnl: -300, pnlPct: -1.92 },
    { code: 'US.AAPL', name: 'AAPL', qty: 40, avgPrice: 180, currentPrice: 195, pnl: 600, pnlPct: 8.33 },
    { code: 'US.NVDA', name: 'NVDA', qty: 25, avgPrice: 750, currentPrice: 820, pnl: 1750, pnlPct: 9.33 },
  ];

  // Mock funds
  const funds = {
    totalAssets: equity,
    availableFunds: equity * 0.35,
    marketValue: equity * 0.65,
    maxWithdrawal: equity * 0.25,
    buyingPower: equity * 0.5,
  };

  // Mock trading journal entries
  const journalEntries = [
    { id: 'd1', date: new Date(now - 0 * dayMs).toISOString().split('T')[0], symbol: 'TQQQ', side: 'buy', qty: 100, price: 44.8, pnl: 0, tags: ['突破', '趋势'], notes: 'MA5上穿MA20' },
    { id: 'd2', date: new Date(now - 1 * dayMs).toISOString().split('T')[0], symbol: 'NVDA', side: 'buy', qty: 10, price: 740, pnl: 0, tags: ['消息', '财报'], notes: 'CES keynote后买入' },
    { id: 'd3', date: new Date(now - 2 * dayMs).toISOString().split('T')[0], symbol: 'SQQQ', side: 'sell', qty: 50, price: 12.5, pnl: -45, tags: ['止损'], notes: 'RSI超卖但继续下跌' },
    { id: 'd4', date: new Date(now - 3 * dayMs).toISOString().split('T')[0], symbol: 'AAPL', side: 'buy', qty: 20, price: 178, pnl: 0, tags: ['回调', '技术'], notes: '回调到支撑位' },
    { id: 'd5', date: new Date(now - 5 * dayMs).toISOString().split('T')[0], symbol: 'TQQQ', side: 'sell', qty: 50, price: 46.2, pnl: 120, tags: ['止盈'], notes: '目标价达成' },
    { id: 'd6', date: new Date(now - 7 * dayMs).toISOString().split('T')[0], symbol: 'QQQ', side: 'buy', qty: 25, price: 375, pnl: 0, tags: ['趋势'], notes: '定投' },
    { id: 'd7', date: new Date(now - 8 * dayMs).toISOString().split('T')[0], symbol: 'SOXL', side: 'sell', qty: 30, price: 32, pnl: -80, tags: ['止损', '技术'], notes: '跌破布林带下轨' },
    { id: 'd8', date: new Date(now - 10 * dayMs).toISOString().split('T')[0], symbol: 'SPY', side: 'buy', qty: 15, price: 518, pnl: 0, tags: ['宏观'], notes: 'CPI数据低于预期' },
  ];

  // Mock watchlist
  const watchlist = ['US.TQQQ', 'US.QQQ', 'US.SPY', 'US.AAPL', 'US.NVDA', 'US.SOXL', 'US.SQQQ', 'US.SOXS'];

  // Persist
  localStorage.setItem('dw_demo_equity_curve', JSON.stringify(equityCurve));
  localStorage.setItem('dw_demo_positions', JSON.stringify(positions));
  localStorage.setItem('dw_demo_funds', JSON.stringify(funds));
  localStorage.setItem('dw_demo_journal', JSON.stringify(journalEntries));
  localStorage.setItem('dw_demo_watchlist', JSON.stringify(watchlist));
  localStorage.setItem('dw_demo_mode', '1');

  // Also inject into the app's expected keys so components can read them
  localStorage.setItem('dw_watchlist', JSON.stringify(watchlist));
}

function clearDemoData() {
  localStorage.removeItem('dw_demo_equity_curve');
  localStorage.removeItem('dw_demo_positions');
  localStorage.removeItem('dw_demo_funds');
  localStorage.removeItem('dw_demo_journal');
  localStorage.removeItem('dw_demo_watchlist');
  localStorage.removeItem('dw_demo_mode');
}

// ── Component ──────────────────────────────────────────────────────────────

export default function OnboardingModal({ open, onClose, onConnect, connected }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [connectResult, setConnectResult] = useState<'idle' | 'success' | 'fail'>('idle');
  const [demoMode, setDemoMode] = useState(false);
  const [, setSkippedSteps] = useState<Set<number>>(new Set());
  const [polling, setPolling] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-detect OpenD connection on mount & when step 0 is active
  useEffect(() => {
    if (!open || step !== 0) return;

    // Immediate check
    const check = async () => {
      if (!polling || connectResult === 'success') return;
      try {
        const ok = await onConnect();
        if (ok) {
          setConnectResult('success');
          setPolling(false);
        } else {
          setConnectResult('fail');
        }
      } catch {
        setConnectResult('fail');
      }
    };
    check();

    // Poll every 3 seconds
    pollRef.current = setInterval(check, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, step, onConnect, polling, connectResult]);

  // React to external `connected` prop
  useEffect(() => {
    if (connected && step === 0) {
      setConnectResult('success');
      setPolling(false);
    }
  }, [connected, step]);

  // Demo mode toggle → inject/clear data
  useEffect(() => {
    if (demoMode) {
      injectDemoData();
    } else {
      clearDemoData();
    }
  }, [demoMode]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setPolling(false); // pause auto-poll during manual attempt
    try {
      const ok = await onConnect();
      setConnectResult(ok ? 'success' : 'fail');
      if (!ok) setPolling(true); // resume polling on failure
    } catch {
      setConnectResult('fail');
      setPolling(true);
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
  // const isSkipped = skippedSteps.has(step);
  const progressPct = ((step + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={isLast ? onClose : undefined} />

      {/* Modal */}
      <div className="relative bg-[#12121a] border border-white/10 rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Linear Progress Bar (replaces dot navigation) */}
        <div className="px-0 pt-0">
          <div className="h-1.5 w-full bg-white/5">
            <div
              className="h-full bg-[#C9A046] transition-all duration-500 ease-out rounded-r-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between px-6 pt-4 pb-1">
            <span className="text-[11px] text-gray-400 font-medium tracking-wide">
              步骤 <span className="text-[#D4A853]">{step + 1}</span> / {steps.length}
            </span>
            <span className="text-[11px] text-[#D4A853] font-medium">
              {Math.round(progressPct)}%
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pt-2 pb-4">
          {/* Icon */}
          <div className="text-5xl mb-3">{current.icon}</div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white mb-2">{current.title}</h2>

          {/* Description */}
          <p className="text-gray-300 text-sm leading-relaxed mb-2">{current.desc}</p>
          {current.detail && (
            <p className="text-gray-500 text-xs leading-relaxed mb-4">{current.detail}</p>
          )}

          {/* Step 0: Connection status with real-time polling indicator */}
          {step === 0 && (
            <div className="mb-4 space-y-3">
              {connectResult === 'idle' && (
                <div className="flex items-center gap-2 text-gray-400 text-sm bg-white/5 rounded-lg px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
                  <span>自动检测 OpenD 连接中…</span>
                  <span className="ml-auto text-[10px] text-gray-500">每 3 秒检测</span>
                </div>
              )}
              {connectResult === 'success' && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 rounded-lg px-4 py-3 border border-emerald-500/20">
                  <span className="text-base">✓</span>
                  <div>
                    <div className="font-medium">OpenD 已连接</div>
                    <div className="text-[10px] text-emerald-400/70">行情推送正常，自动检测已停止</div>
                  </div>
                </div>
              )}
              {connectResult === 'fail' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-500/10 rounded-lg px-4 py-3 border border-yellow-500/20">
                    <span className="text-base">⚠</span>
                    <div>
                      <div className="font-medium">未检测到 OpenD</div>
                      <div className="text-[10px] text-yellow-400/70">请确认 OpenD 已运行（端口 11111），或选择演示模式</div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer bg-white/5 rounded-lg px-4 py-3 border border-white/5 hover:border-white/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={demoMode}
                      onChange={(e) => setDemoMode(e.target.checked)}
                      className="rounded border-gray-600 bg-[#1a1a25] text-[#C9A046] w-4 h-4"
                    />
                    <span>
                      <span className="font-medium">使用演示模式</span>
                      <span className="text-gray-500 ml-1">— 无需 OpenD，体验全部功能</span>
                    </span>
                  </label>
                  {demoMode && (
                    <div className="text-[10px] text-emerald-400/80 bg-emerald-500/5 rounded-lg px-4 py-2 border border-emerald-500/10">
                      ✓ 已注入模拟数据：8 只自选股、$100K 模拟资金、7 条交易记录
                    </div>
                  )}
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
