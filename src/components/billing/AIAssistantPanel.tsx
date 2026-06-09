import { useState, useRef, useEffect, type CSSProperties } from 'react';

// ── Types ──
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  usdtCost?: number
}

interface BriefingItem {
  category: string; icon: string; title: string; content: string; action?: string
}

interface TermEntry { term: string; category: string; explanation: string; example: string; related: string[] }

const TERMS_DB: TermEntry[] = [
  { term: 'MACD', category: '技术指标', explanation: '指数平滑异同移动平均线, 用快慢两条EMA的差值和信号线交叉来判断买卖时机。金叉买入, 死叉卖出。', example: '快线12日EMA, 慢线26日EMA, 信号线9日EMA。当快线从下方上穿慢线→MACD金叉→买入信号。', related: ['RSI', 'Bollinger', 'EMA'] },
  { term: 'RSI', category: '技术指标', explanation: '相对强弱指数, 衡量近期价格涨跌幅度的比例。0-100范围, >70超买(要跌), <30超卖(要涨)。', example: '腾讯RSI跌到25→超卖→可能反弹, 此时考虑买入。但如果持续下跌, RSI可能长时间<30。', related: ['MACD', '超买超卖', '背离'] },
  { term: '回撤', category: '风险指标', explanation: '资产从最高点到最低点的跌幅百分比。最大回撤越小, 策略越稳。', example: '账户从100万涨到150万又跌到120万, 回撤=(150-120)/150=20%。', related: ['夏普比率', '波动率', 'VaR'] },
  { term: '夏普比率', category: '风险指标', explanation: '每单位风险的超额回报。>1为良好, >2为优秀, >3罕见。越高代表收益与风险越匹配。', example: '策略年化收益15%, 无风险利率3%, 波动率8% → 夏普=(15-3)/8=1.5, 良好。', related: ['索提诺比率', '卡玛比率', '波动率'] },
  { term: '量化交易', category: '基础概念', explanation: '用数学模型和计算机程序替代人工判断进行交易决策。优势：无情绪、速度快、可回测。', example: '"如果MACD金叉且RSI<30, 则买入1000股腾讯" ——这就是一个最简单的量化策略。', related: ['回测', '策略', 'Alpha'] },
  { term: 'Alpha', category: '基础概念', explanation: '策略的超额收益——跑赢市场基准的部分。正Alpha=策略有价值, 负Alpha=不如直接买指数。', example: '恒指今年涨5%, 你的策略涨12%, Alpha=7%, 说明策略贡献了7%的超额回报。', related: ['Beta', '夏普比率', '信息比率'] },
  { term: '杠杆', category: '风险概念', explanation: '借钱投资放大收益和风险。2倍杠杆=涨1%赚2%, 但跌1%也亏2%。双刃剑。', example: '100万本金+100万借款投资200万→2倍杠杆。涨5%赚10万(10%收益), 跌5%亏10万(10%亏损)。', related: ['保证金', '爆仓', '止损'] },
  { term: '止损', category: '风险概念', explanation: '预设亏损上限, 触及自动卖出。保护本金的最基本手段。', example: '买入价HK$100, 设止损-8%→当价格跌到HK$92自动卖出, 限制最大亏损。', related: ['止盈', '仓位管理', 'ATR'] },
];

const BRIEFING_DEMO: BriefingItem[] = [
  { category: '策略表现', icon: '📈', title: '你的策略昨日表现', content: 'MACD+RSI 组合策略 +1.2%, 胜率61%。触发3次买入信号, 2次盈利。', action: '查看详情' },
  { category: '市场概况', icon: '🌍', title: '今日市场关注', content: '恒指+0.8%, 腾讯+2.1%领涨。美股期货微涨。关注今日美国CPI数据发布。', action: '查看日历' },
  { category: '风险提醒', icon: '⚠️', title: '风险预警', content: '港股波动率VIX升至32, 创3周新高。建议降低杠杆或收紧止损。', action: '调整策略' },
  { category: '机会发现', icon: '🔍', title: 'AI发现的机会', content: '高股息+低PE+北水增持: 中移动(0941)、中海油(0883) 符合防守型偏好。', action: '分析详情' },
];

// ── Sub-components ──
function UsdtBadge() {
  return (
    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#F59E0B22', color: '#F59E0B', marginLeft: 4 }}>
      🤖 USDT
    </span>
  );
}

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: '80%', padding: '10px 14px', borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        background: isUser ? '#6366F1' : '#1F2937', border: isUser ? 'none' : '1px solid #374151',
        color: isUser ? '#FFF' : '#D1D5DB', fontSize: 13, lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <span style={{ fontSize: 10, color: '#6B7280' }}>{msg.timestamp}</span>
        {msg.usdtCost && <span style={{ fontSize: 10, color: '#F59E0B' }}>-{msg.usdtCost} USDT</span>}
      </div>
    </div>
  );
}

function DiagnosisTab() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'd0', role: 'assistant', content: '👋 我是你的AI策略医生。把你策略的核心逻辑告诉我，我帮你诊断问题。\n\n比如:\n• "我的策略在港股用MA金叉买入，但最近连续亏损"\n• "这个策略胜率65%但最大回撤45%，怎么办"', timestamp: '刚刚' },
  ]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const usdtBalance = 482.50;

  const send = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', content: input, timestamp: '刚刚', usdtCost: 0.50 };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    setTimeout(() => {
      const resp = generateDiagnosis(input);
      const aiMsg: Message = { id: `a${Date.now()}`, role: 'assistant', content: resp, timestamp: '刚刚', usdtCost: 0.50 };
      setMessages(prev => [...prev, aiMsg]);
    }, 800);
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
        余额: <span style={{ color: '#F59E0B', fontWeight: 600 }}>{usdtBalance} USDT</span> · 每次诊断 <span style={{ color: '#F59E0B' }}>1.0 USDT</span>
      </div>
      <div style={{ minHeight: 280, maxHeight: 380, overflowY: 'auto', marginBottom: 12, paddingRight: 8 }}>
        {messages.map(m => <ChatMessage key={m.id} msg={m} />)}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="描述你的策略问题..."
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #374151',
            background: '#1F2937', color: '#E5E7EB', fontSize: 13, outline: 'none',
          }}
        />
        <button
          onClick={send}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none', background: '#6366F1',
            color: '#FFF', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          发送 <UsdtBadge />
        </button>
      </div>
    </div>
  );
}

function NLCreationTab() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const usdtBalance = 482.50;

  const submit = () => {
    if (!input.trim()) return;
    const sample = `✅ 策略已生成！

📋 名称: 港股高股息防守型
🏷️ 市场: 港股 | 品种: 股票
📊 因子: 股息率>4% · PE<15 · ROE>10%
🎚️ 参数: MA12/MA26 · RSI 30/70
🛡️ 止损: -8% · 止盈: +15%
⚡ 信号: 股息率>4% 且 RSI<40 → 买入

查看回测 → (模拟3年+58%)`;
    setResult(sample);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder='例如："帮我在港股找高股息防守型策略"'
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid #374151',
            background: '#1F2937', color: '#E5E7EB', fontSize: 14, outline: 'none',
          }}
        />
        <button
          onClick={submit}
          style={{
            padding: '12px 24px', borderRadius: 10, border: 'none', background: '#6366F1',
            color: '#FFF', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          创建 <UsdtBadge />
          <div style={{ fontSize: 10, color: '#A5B4FC' }}>2.0 USDT</div>
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
        余额: <span style={{ color: '#F59E0B', fontWeight: 600 }}>{usdtBalance} USDT</span> · 自然语言创建 <span style={{ color: '#F59E0B' }}>2.0 USDT/次</span>
      </div>

      {result && (
        <div style={{ padding: '16px', borderRadius: 12, background: '#1F2937', border: '1px solid #374151', whiteSpace: 'pre-wrap', fontSize: 13, color: '#D1D5DB', lineHeight: 1.8 }}>
          {result}
        </div>
      )}

      {/* Preset prompts */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>💡 试试这些：</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            '港股高股息防守',
            '美股科技股趋势跟踪',
            '日股波动率套利',
            '新加坡REITs收息',
          ].map(p => (
            <button
              key={p}
              onClick={() => setInput(p)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid #374151',
                background: '#1F2937', color: '#9CA3AF', fontSize: 12, cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BriefingTab() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB' }}>📰 AI 每日简报</div>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>2026-06-09 · 周一</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#F59E0B' }}>每日订阅 <UsdtBadge /></span>
          <button style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #F59E0B', background: '#F59E0B18',
            color: '#F59E0B', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            订阅 5.0 USDT/月
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BRIEFING_DEMO.map((item, i) => (
          <div key={i} style={{ padding: '14px 16px', borderRadius: 12, background: '#1F2937', border: '1px solid #374151' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#D1D5DB' }}>{item.title}</span>
              </div>
              {item.action && (
                <span style={{ fontSize: 11, color: '#818CF8', cursor: 'pointer' }}>{item.action} →</span>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#9CA3AF', lineHeight: 1.6, paddingLeft: 26 }}>
              {item.content}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', fontSize: 12, color: '#6B7280' }}>
        💡 简报每天早上 8:00 (GMT+8) 推送到通知中心
      </div>
    </div>
  );
}

function TermExplainerTab() {
  const [search, setSearch] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<TermEntry | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);

  const filtered = TERMS_DB.filter(t =>
    t.term.includes(search) || t.category.includes(search) || t.explanation.includes(search)
  );

  const askAI = (term: string) => {
    setAiAnswer(null);
    setTimeout(() => {
      const entry = TERMS_DB.find(t => t.term === term);
      if (entry) {
        setAiAnswer(`🤖 大白话解释"${term}"：\n\n${entry.explanation}\n\n📌 举个例子：\n${entry.example}\n\n🔗 相关概念：${entry.related.join('、')}`);
      }
    }, 600);
  };

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 搜索术语...（例如 MACD、回撤、夏普比率）"
        style={{
          width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #374151',
          background: '#1F2937', color: '#E5E7EB', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          marginBottom: 12,
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 16 }}>
        {filtered.map(t => (
          <button
            key={t.term}
            onClick={() => { setSelectedTerm(t); setAiAnswer(null); }}
            style={{
              padding: '10px 14px', borderRadius: 8, border: selectedTerm?.term === t.term ? '2px solid #6366F1' : '1px solid #374151',
              background: selectedTerm?.term === t.term ? '#6366F118' : '#1F2937',
              color: '#D1D5DB', fontSize: 13, textAlign: 'left', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span>{t.term}</span>
            <span style={{ fontSize: 10, color: '#6B7280' }}>{t.category}</span>
          </button>
        ))}
      </div>

      {selectedTerm && (
        <div style={{ padding: '16px', borderRadius: 12, background: '#1F2937', border: '1px solid #374151', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB' }}>{selectedTerm.term}</span>
            <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, background: '#374151', color: '#9CA3AF' }}>{selectedTerm.category}</span>
          </div>
          <div style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.7, marginBottom: 10 }}>
            {selectedTerm.explanation}
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#111827', fontSize: 12, color: '#34D399', lineHeight: 1.6 }}>
            💡 {selectedTerm.example}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#6B7280' }}>
            相关: {selectedTerm.related.join(' · ')}
          </div>

          {/* AI explain button */}
          <button
            onClick={() => askAI(selectedTerm.term)}
            style={{
              marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid #6366F1',
              background: '#6366F118', color: '#818CF8', fontSize: 12, cursor: 'pointer',
            }}
          >
            🤖 AI大白话解释 <UsdtBadge />
          </button>
        </div>
      )}

      {aiAnswer && (
        <div style={{ padding: '14px 16px', borderRadius: 10, background: '#111827', border: '1px solid #6366F133', fontSize: 13, color: '#D1D5DB', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          {aiAnswer}
        </div>
      )}
    </div>
  );
}

// ── Main ──
export default function AIAssistantPanel() {
  const [tab, setTab] = useState<'diagnosis' | 'nl' | 'briefing' | 'terms'>('diagnosis');

  const theme: CSSProperties = {
    background: '#0A0A10', borderRadius: 16, padding: 24,
    border: '1px solid #1F2937', color: '#E5E7EB',
    maxWidth: 900, margin: '0 auto',
  };

  const tabs: { key: typeof tab; icon: string; label: string }[] = [
    { key: 'diagnosis', icon: '🩺', label: '策略问诊' },
    { key: 'nl', icon: '✨', label: '自然语言创建' },
    { key: 'briefing', icon: '📰', label: '每日简报' },
    { key: 'terms', icon: '📚', label: '术语解释' },
  ];

  return (
    <div style={theme}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F9FAFB' }}>
            🤖 AI 助手 <UsdtBadge />
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            策略诊断·自然语言创建·每日简报·术语解释——AI驱动，USDT计费
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: tab === t.key ? '#6366F1' : '#1F2937',
              color: tab === t.key ? '#FFF' : '#9CA3AF', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.key !== 'terms' && <UsdtBadge />}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'diagnosis' && <DiagnosisTab />}
      {tab === 'nl' && <NLCreationTab />}
      {tab === 'briefing' && <BriefingTab />}
      {tab === 'terms' && <TermExplainerTab />}
    </div>
  );
}

// ── Helper: AI response generator ──
function generateDiagnosis(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes('亏损') || lower.includes('赔钱')) {
    return `🔍 诊断结果：\n\n你的策略近期连续亏损，可能原因：\n\n1. 📉 **市场环境改变** — 你的策略擅长趋势市，但近期市场震荡（VIX高）\n2. 🎯 **参数过拟合** — 回测参数太针对历史，到实盘失效\n3. ⚠️ **单品种过度集中** — 港股单一品种风险太高\n\n💊 建议：\n• 加入多品种分散（港股→港股+美股对冲）\n• 添加震荡市过滤器（ADX<20时不交易）\n• 排查最近10笔交易，看亏损是否有规律`;
  }

  if (lower.includes('回撤') || lower.includes('drawdown')) {
    return `🔍 诊断结果：\n\n回撤45%确实偏高（正常应<30%）。\n\n可能原因：\n1. 🎚️ **仓位过重** — 单笔超过总资金20%，一次大亏影响巨大\n2. 🛡️ **止损太宽** — 你没有硬止损或止损设得太远\n3. 🦈 **黑天鹅** — 市场突发事件（如财报暴雷）\n\n💊 建议：\n• 单笔最大仓位≤15%\n• 日亏损上限≤总资金5%，触发即平仓\n• 加入凯利公式动态仓位`;
  }

  return `🔍 诊断结果：\n\n你的策略整体健康。\n\n✅ 胜率65% 在量化策略中属中上水平\n✅ 如果夏普比率>1.2，说明收益质量不错\n\n⚠️ 但建议考虑：\n• 加入多市场分散（港股+美股相关性低）\n• 添加适应性止损（ATR动态止损 vs 固定止损）\n• 定期6个月样本外测试，防过拟合`;
}
