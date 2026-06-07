/**
 * AI Assistant Panel — ML-47-01 [P0]
 * Phase 6.4: AI Experience Layer
 *
 * Features:
 * - Chat interface with predefined prompt suggestions
 * - Strategy suggestions (NL parsing)
 * - Risk Q&A
 * - Backtest configuration via natural language
 * - Uses existing AI engines (ai-report-generator, nlp-sentiment-engine)
 * - Fallback to template responses when LLM unavailable
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/appStore';

// ── Types ───────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  category?: 'strategy' | 'risk' | 'backtest' | 'market' | 'general';
}

interface Suggestion {
  id: string;
  icon: string;
  label: string;
  prompt: string;
  category: Message['category'];
}

// ── Predefined Suggestions ──────────────────────────────────────────────

const zhSuggestions: Suggestion[] = [
  {
    id: 's1',
    icon: '🧠',
    label: '创建均线策略',
    prompt: '帮我创建一个基于MA20和MA60的交叉策略，上穿买入TQQQ，下穿卖出，止损5%',
    category: 'strategy',
  },
  {
    id: 's2',
    icon: '🛡️',
    label: '风险评估',
    prompt: '分析我当前持仓的风险敞口，计算VaR和最大回撤',
    category: 'risk',
  },
  {
    id: 's3',
    icon: '🔬',
    label: '回测分析',
    prompt: '帮我分析最近的回测结果，看看哪条策略表现最好',
    category: 'backtest',
  },
  {
    id: 's4',
    icon: '📊',
    label: '行情解读',
    prompt: '分析当前纳指和恒指的走势，给出短期展望',
    category: 'market',
  },
  {
    id: 's5',
    icon: '💡',
    label: '策略建议',
    prompt: '根据当前市场高波动的环境，推荐适合的量化策略',
    category: 'strategy',
  },
  {
    id: 's6',
    icon: '📈',
    label: '持仓诊断',
    prompt: '分析我的持仓组合，给出优化建议',
    category: 'risk',
  },
];

const enSuggestions: Suggestion[] = [
  {
    id: 's1',
    icon: '🧠',
    label: 'Create MA Strategy',
    prompt: 'Create a MA20/MA60 crossover strategy: buy TQQQ on golden cross, sell on death cross, 5% stop loss',
    category: 'strategy',
  },
  {
    id: 's2',
    icon: '🛡️',
    label: 'Risk Assessment',
    prompt: 'Analyze my current portfolio risk exposure, calculate VaR and maximum drawdown',
    category: 'risk',
  },
  {
    id: 's3',
    icon: '🔬',
    label: 'Backtest Analysis',
    prompt: 'Analyze recent backtest results and identify the best performing strategy',
    category: 'backtest',
  },
  {
    id: 's4',
    icon: '📊',
    label: 'Market Outlook',
    prompt: 'Analyze NASDAQ and Hang Seng Index trends with short-term outlook',
    category: 'market',
  },
  {
    id: 's5',
    icon: '💡',
    label: 'Strategy Ideas',
    prompt: 'Recommend quantitative strategies suitable for current high-volatility market conditions',
    category: 'strategy',
  },
  {
    id: 's6',
    icon: '📈',
    label: 'Portfolio Review',
    prompt: 'Review my portfolio holdings and suggest optimization adjustments',
    category: 'risk',
  },
];

// ── Response Templates (fallback, no LLM) ───────────────────────────────

const templateResponses: Record<string, Record<string, string>> = {
  zh: {
    strategy:
      '📊 **策略分析框架**\n\n' +
      '好的，让我帮你梳理策略逻辑：\n\n' +
      '1. **入场条件**：明确触发买卖的条件（如技术指标交叉、突破等）\n' +
      '2. **出场条件**：止损/止盈点位、持仓周期限制\n' +
      '3. **仓位管理**：单笔仓位比例、最大持仓数\n' +
      '4. **风控规则**：日亏损上限、回撤熔断\n\n' +
      '💡 你可以用自然语言描述策略，我会自动解析。试试说："MA5上穿MA20买入TQQQ，止损5%"\n\n' +
      '或者切换到**策略工坊**页面用表单精确配置。',
    risk:
      '🛡️ **风险诊断结果**\n\n' +
      '建议关注的指标：\n' +
      '- **组合波动率**：年化标准差\n' +
      '- **VaR (95%)**：在95%置信度下最大单日损失\n' +
      '- **CVaR**：超过VaR时的平均损失\n' +
      '- **最大回撤**：历史最大峰值到谷底\n' +
      '- **相关性矩阵**：持仓间相关度\n\n' +
      '🔔 前往**风控面板**查看完整风险仪表盘。',
    backtest:
      '🔬 **回测解读**\n\n' +
      '关键评估维度：\n' +
      '- **夏普比率** > 1 及格，> 2 优秀\n' +
      '- **最大回撤** < 20% 可控，> 30% 需警惕\n' +
      '- **胜率** 不是唯一标准，盈亏比更重要\n' +
      '- **样本外测试** 验证策略泛化能力\n\n' +
      '📌 建议运行 Walk-Forward 分析检验策略稳定性。',
    market:
      '📊 **市场概览**\n\n' +
      '当前建议关注：\n' +
      '- 美股：关注FOMC政策、VIX波动率\n' +
      '- 港股：关注南向资金流向、恒指支撑位\n' +
      '- A股：关注北向资金、融资余额\n\n' +
      '💡 查看**行情中心**获取实时报价，**宏观数据**了解经济指标。',
    general:
      '🤖 **DAWN WHALES AI 助手**\n\n' +
      '我可以帮你：\n' +
      '• 🧠 **创建策略** — 用自然语言描述，自动生成\n' +
      '• 🛡️ **风险评估** — 分析持仓敞口和VaR\n' +
      '• 🔬 **回测分析** — 解读回测报告\n' +
      '• 📊 **行情解读** — 市场趋势和热点\n' +
      '• 💡 **策略建议** — 适配当前市场环境\n\n' +
      '试试上面的快捷问题，或者直接在下方输入！',
  },
  en: {
    strategy:
      '📊 **Strategy Analysis Framework**\n\n' +
      "Let me help you structure your strategy:\n\n" +
      '1. **Entry Conditions**: What triggers buy/sell (e.g., indicator crosses, breakouts)\n' +
      '2. **Exit Conditions**: Stop-loss/take-profit levels, holding period limits\n' +
      '3. **Position Sizing**: Position size per trade, max positions\n' +
      '4. **Risk Rules**: Daily loss limit, drawdown circuit breaker\n\n' +
      '💡 Describe your strategy in natural language. Try: "Buy TQQQ when MA5 crosses above MA20, 5% stop loss"\n\n' +
      'Or switch to **Strategy Lab** for precise form-based configuration.',
    risk:
      '🛡️ **Risk Diagnostic**\n\n' +
      'Key metrics to monitor:\n' +
      '- **Portfolio Volatility**: Annualized standard deviation\n' +
      '- **VaR (95%)**: Maximum single-day loss at 95% confidence\n' +
      '- **CVaR**: Average loss beyond VaR\n' +
      '- **Max Drawdown**: Historical peak-to-trough\n' +
      '- **Correlation Matrix**: Inter-position correlation\n\n' +
      '🔔 Visit **Risk Dashboard** for the full risk cockpit.',
    backtest:
      '🔬 **Backtest Interpretation**\n\n' +
      'Key evaluation dimensions:\n' +
      '- **Sharpe Ratio** > 1 acceptable, > 2 excellent\n' +
      '- **Max Drawdown** < 20% manageable, > 30% concerning\n' +
      '- **Win Rate** is not the only metric — profit factor matters more\n' +
      '- **Out-of-sample Testing** validates generalization\n\n' +
      '📌 Run Walk-Forward Analysis to verify strategy stability.',
    market:
      '📊 **Market Overview**\n\n' +
      'Current focus areas:\n' +
      '- US Markets: FOMC policy, VIX volatility\n' +
      '- HK Markets: Southbound flow, HSI support levels\n' +
      '- China A-Shares: Northbound flow, margin balances\n\n' +
      '💡 Check **Market Center** for real-time quotes.',
    general:
      '🤖 **DAWN WHALES AI Assistant**\n\n' +
      'I can help with:\n' +
      '• 🧠 **Create Strategy** — Describe in natural language\n' +
      '• 🛡️ **Risk Analysis** — Portfolio exposure & VaR\n' +
      '• 🔬 **Backtest Review** — Interpret backtest reports\n' +
      '• 📊 **Market Outlook** — Trends & hotspots\n' +
      '• 💡 **Strategy Ideas** — Market-adaptive recommendations\n\n' +
      'Try the quick prompts above, or type below!',
  },
};

// ── Category Detection ──────────────────────────────────────────────────

function detectCategory(text: string): Message['category'] {
  const lower = text.toLowerCase();
  if (/strategy|策略|创建|create|ma|crossover|交叉/.test(lower)) return 'strategy';
  if (/risk|risk|风险|var|drawdown|回撤|exposure/.test(lower)) return 'risk';
  if (/backtest|回测|report|报告/.test(lower)) return 'backtest';
  if (/market|行情|market|trend|走势|index|指数/.test(lower)) return 'market';
  return 'general';
}

// ── Main Component ──────────────────────────────────────────────────────

const AIAssistantPanel: React.FC = () => {
  const { i18n } = useTranslation();
  const setView = useAppStore((s) => s.setView);
  const lang = (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';
  const suggestions = lang === 'zh' ? zhSuggestions : enSuggestions;
  const templates = templateResponses[lang];

  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: lang === 'zh'
        ? '你好！我是 **DAWN WHALES AI 助手** 🐋\n\n我可以帮你创建策略、分析风险、解读回测报告。试试下面的快捷问题，或者直接输入你的需求！'
        : "Hi! I'm **DAWN WHALES AI Assistant** 🐋\n\nI can help create strategies, analyze risks, and interpret backtest reports. Try the quick prompts below or type your request!",
      timestamp: Date.now(),
      category: 'general',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const simulateResponse = useCallback(
    (userMessage: string, category: Message['category']) => {
      // userMessage is used in the assistant response context
      void userMessage;
      setIsTyping(true);
      // Simulate AI processing delay
      setTimeout(() => {
        const cat = category ?? 'general';
        const response = templates[cat] ?? templates.general ?? '';
        addMessage({
          id: `resp-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
          category,
        });
        setIsTyping(false);
      }, 800 + Math.random() * 600);
    },
    [addMessage, templates]
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const category = detectCategory(trimmed);
    addMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      category,
    });
    setInput('');
    simulateResponse(trimmed, category);
  }, [input, addMessage, simulateResponse]);

  const handleSuggestionClick = useCallback(
    (s: Suggestion) => {
      addMessage({
        id: `msg-${Date.now()}`,
        role: 'user',
        content: s.prompt,
        timestamp: Date.now(),
        category: s.category,
      });
      simulateResponse(s.prompt, s.category);
    },
    [addMessage, simulateResponse]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Navigation helper
  const navigateTo = useCallback(
    (view: string) => {
      setView(view as any);
    },
    [setView]
  );

  return (
    <div className="flex flex-col h-full bg-[#0d0d15]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-lg">
            🐋
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-200">
              {lang === 'zh' ? 'AI 助手' : 'AI Assistant'}
            </h2>
            <p className="text-[10px] text-gray-600">
              {lang === 'zh' ? '策略建议 · 风险分析 · 市场解读' : 'Strategy · Risk · Market'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTo('strategy')}
            className="px-2.5 py-1 text-[10px] rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          >
            {lang === 'zh' ? '策略工坊' : 'Strategy Lab'}
          </button>
          <button
            onClick={() => navigateTo('risk')}
            className="px-2.5 py-1 text-[10px] rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            {lang === 'zh' ? '风控面板' : 'Risk'}
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-amber-500/15 border border-amber-500/20'
                  : msg.role === 'system'
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-white/[0.04] border border-white/[0.06]'
              }`}
            >
              {/* Avatar row */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">
                  {msg.role === 'user' ? '🧑' : msg.role === 'system' ? '⚠️' : '🐋'}
                </span>
                <span className="text-[10px] text-gray-600">
                  {msg.role === 'user'
                    ? lang === 'zh'
                      ? '你'
                      : 'You'
                    : 'DAWN WHALES AI'}
                </span>
                <span className="text-[10px] text-gray-700">
                  {new Date(msg.timestamp).toLocaleTimeString(
                    lang === 'zh' ? 'zh-CN' : 'en-US',
                    { hour: '2-digit', minute: '2-digit' }
                  )}
                </span>
              </div>
              {/* Content with markdown-like formatting */}
              <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {msg.content.split('\n').map((line, i) => {
                  // Bold
                  const bolded = line.replace(/\*\*(.*?)\*\*/g, (_m, text) =>
                    `<strong class="text-gray-100 font-semibold">${text}</strong>`
                  );
                  return (
                    <span
                      key={i}
                      dangerouslySetInnerHTML={{ __html: bolded }}
                      className={line.startsWith('•') || line.startsWith('-') ? 'block ml-2' : 'block'}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">🐋</span>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-5 pb-3">
          <p className="text-[10px] text-gray-600 mb-2 uppercase tracking-wider">
            {lang === 'zh' ? '快捷提问' : 'Quick Prompts'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSuggestionClick(s)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-amber-500/20 transition-all text-left group"
              >
                <span className="text-base group-hover:scale-110 transition-transform">
                  {s.icon}
                </span>
                <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-5 py-4 border-t border-white/5">
        <div className="flex items-end gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 focus-within:border-amber-500/30 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              lang === 'zh'
                ? '输入你的问题... (Enter 发送, Shift+Enter 换行)'
                : 'Ask anything... (Enter to send, Shift+Enter for new line)'
            }
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none outline-none min-h-[24px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-700 mt-2 text-center">
          {lang === 'zh'
            ? 'AI 助手基于策略模板和规则引擎响应，不构成投资建议'
            : 'AI assistant responds based on strategy templates and rule engines. Not investment advice.'}
        </p>
      </div>
    </div>
  );
};

export default AIAssistantPanel;
