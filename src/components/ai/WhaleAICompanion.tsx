// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';

/* ====== Types ====== */
interface ChatMessage {
  id: string; role: 'whale' | 'user';
  text: string; time: string;
  isTyping?: boolean;
}

interface QuickPrompt {
  text: string; icon: string;
}

/* ====== Mock Data ====== */
const whaleQuotes = [
  '让我帮你看看... 🐋',
  '等一下，先别急——数据怎么说？',
  '深呼吸，市场还在。',
  '我跟你说实话，这个信号不太对。',
  '你看，机会就在这里。',
  '别追高，等它回踩。',
  '这事我帮你盯着。'
];

const quickPrompts: QuickPrompt[] = [
  { text: '今天有什么好机会？', icon: '📊' },
  { text: '帮我扫描一下持仓', icon: '🔍' },
  { text: '最近什么因子强？', icon: '🧬' },
  { text: '我该加仓还是减仓？', icon: '⚖️' },
  { text: '有没有风险要提醒我？', icon: '⚠️' },
  { text: '推荐一个策略给我', icon: '📋' }
];

const initialState: ChatMessage[] = [
  { id: 'w0', role: 'whale', text: `嗨！我是鲸灵 🐋，你的24小时AI交易伙伴。

我帮你盯着市场、管着持仓、找机会。跟我说你想做什么？`, time: '刚刚' }
];

const mockResponses: Record<string, string> = {
  '今天有什么好机会？': '让我看看... 📊\n\n今天三个机会值得关注：\n1. 🚀 NVDA财报后继续走强，AI芯片需求旺盛\n2. 💰 BTC突破$120K，ETF流入强劲\n3. 🛡️ 黄金$3500，央行继续买，防御配置好选择\n\n要不要我帮你挑一个做策略？',
  '帮我扫描一下持仓': '好的，帮你扫一遍持仓... 🔍\n\n⚠️ 发现2个风险：\n1. 你的NVDA仓位占比38%，超过集中度上限30%\n2. 港股00700连涨5天，RSI到72了，短期可能回调\n\n建议：减5% NVDA，加仓黄金ETF对冲。要我帮你调吗？',
  '最近什么因子强？': '这周最强的3个因子：\n\n1. 🥇 北向资金 IC+0.12 — 跟大资金走\n2. 🥈 机构资金 IC+0.11 — 大户在买\n3. 🥉 新闻情绪 IC+0.09 — 正面新闻多\n\n想用哪一个？我帮你加到策略里。',
  '我该加仓还是减仓？': '等一下，先别急——让我看看数据...\n\n你的持仓整体偏多，科技股占比高。\n\n当前市场信号：\n• Fed偏鸽 → ✅ 利好成长股\n• BTC创新高 → ✅ 风险偏好上升\n• VIX 15 → ⚠️ 太安静，小心突袭\n\n我的建议：维持仓位，不加不减。设个止损在-5%，睡得着觉。',
  '有没有风险要提醒我？': '有3个风险你要注意：\n\n🔴 NVDA集中度高 → 建议降到30%以下\n🟡 Fed官员今晚讲话 → 可能引发波动\n🟡 BTC日波动率上升 → 设止损\n\n不过别怕，风险是可控的。需要帮你设个预警吗？',
  '推荐一个策略给我': '根据你的持仓，我推荐：\n\n📋 「布林带回归策略」\n你在布林带下轨捡便宜，涨回中间卖出\n• 年化 +15% | 最大回撤 -12% | 胜率 62%\n• 难度：入门级，3个参数\n\n要试试吗？免费回测1次，5分钟搞定。'
};

/* ====== Sub-Components ====== */

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    <span className="text-lg">🐋</span>
    <div className="flex gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  </div>
);

const ChatBubble = ({ msg }: { msg: ChatMessage }) => {
  const isWhale = msg.role === 'whale';
  return (
    <div className={`flex gap-2 mb-3 ${isWhale ? '' : 'flex-row-reverse'}`}>
      <span className="text-xl flex-shrink-0 mt-1">{isWhale ? '🐋' : '👤'}</span>
      <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl ${isWhale ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-sm' : 'bg-blue-600 text-white rounded-tr-sm'}`}>
        <p className={`text-sm leading-relaxed whitespace-pre-line ${isWhale ? 'text-gray-800 dark:text-gray-200' : 'text-white'}`}>{msg.text}</p>
        <p className={`text-xs mt-1 ${isWhale ? 'text-gray-400' : 'text-blue-200'}`}>{msg.time}</p>
      </div>
    </div>
  );
};

/* ====== Main Component ====== */

export default function WhaleAICompanion() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialState);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mood, setMood] = useState<number>(0); // cycles through moods
  const scrollRef = useRef<HTMLDivElement>(null);

  const moods = [
    { emoji: '😊', label: '乐观' },
    { emoji: '🤔', label: '分析中' },
    { emoji: '😐', label: '中性' },
    { emoji: '⚠️', label: '警惕' },
    { emoji: '🔄', label: '学习中' }
  ];

  // Cycle mood every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => setMood(prev => (prev + 1) % 5), 15000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: 'user', text, time: '刚刚' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const reply = mockResponses[text] || `好的，我收到了。"${text}" — 让我先分析一下... 🧐\n\n根据你的持仓和市场情况，我觉得这是个值得深入的问题。要不要我帮你做一个详细的回测来看看？`;
      const whaleMsg: ChatMessage = { id: `w${Date.now()}`, role: 'whale', text: reply, time: '刚刚' };
      setMessages(prev => [...prev, whaleMsg]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  };

  const clearChat = () => setMessages(initialState);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="text-2xl">🐋</span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white dark:border-gray-800" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">鲸灵 Whaley</h2>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">{moods[mood].emoji} {moods[mood].label}</span>
                <span className="text-xs text-green-600">• 在线</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">免费 3次/天</span>
            <button onClick={clearChat} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">清空</button>
          </div>
        </div>
      </div>

      {/* Personality Intro */}
      <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 overflow-x-auto">
          {whaleQuotes.slice(0, 4).map((q, i) => (
            <span key={i} className="text-xs text-blue-600 dark:text-blue-400 italic whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full bg-white/50 dark:bg-white/5">"{q}"</span>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
        {isTyping && <TypingIndicator />}
      </div>

      {/* Quick Prompts */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 mb-2">💡 试试问我：</p>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map(p => (
              <button key={p.text} onClick={() => sendMessage(p.text)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 hover:bg-blue-50 hover:border-blue-300 transition-colors">
                {p.icon} {p.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(input)} placeholder="跟鲸灵说点什么..." className="flex-1 px-3 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400" disabled={isTyping} />
          <button onClick={() => sendMessage(input)} disabled={isTyping || !input.trim()} className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
