/**
 * HelpCenter — ML-71-01 [P0]
 * R71: v1.7.0 GA — SEO help center + FAQ for dawnwhales.com
 *
 * Features:
 * - Structured FAQ: 安装/注册/充值/AI/交易/钱包/提现
 * - Searchable help articles
 * - SEO: schema.org FAQPage JSON-LD
 * - Category tabs for quick navigation
 * - Expandable accordion answers
 */

import { useState, useMemo, useCallback , useTranslation} from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface HelpArticle {
  id: string;
  category: string;
  categoryIcon: string;
  question: string;
  answer: string;
}

export interface HelpCenterProps {
  articles?: HelpArticle[];
  className?: string;
}

// ── Help Content ────────────────────────────────────────────────────────

const HELP_ARTICLES: HelpArticle[] = [
  // ── 安装 ──
  { id: 'install-1', category: 'install', categoryIcon: '💻', question: '如何下载安装 DAWN WHALES?', answer: '访问 dawnwhales.com 点击下载。Windows(.exe)、macOS(.dmg)、Linux(.AppImage) 三平台支持。下载后双击安装，首次启动会引导连接Futu OpenD。' },
  { id: 'install-2', category: 'install', categoryIcon: '💻', question: '系统要求是什么?', answer: 'Windows 10+ / macOS 12+ / Ubuntu 20.04+。需要安装 Futu OpenD (免费下载) 用于实盘交易。IBKR用户需安装 IB Gateway。' },
  { id: 'install-3', category: 'install', categoryIcon: '💻', question: '如何连接Futu OpenD?', answer: '1. 下载 Futu_OpenD 并启动; 2. 在DAWN WHALES设置中输入host:127.0.0.1, port:11111; 3. 点击"连接"。连接成功后状态栏显示绿色。' },

  // ── 注册 ──
  { id: 'reg-1', category: 'register', categoryIcon: '📝', question: '如何注册账户?', answer: '打开DAWN WHALES → 点击"免费注册" → 输入邮箱 → 收取激活链接 → 完成注册。7天免费试用，含3次免费AI分析。无需信用卡。' },
  { id: 'reg-2', category: 'register', categoryIcon: '📝', question: '免费试用包含什么?', answer: '全部功能解锁7天 + 3次免费AI分析。试用期后行情/图表/基础回测永久免费。AI分析用完后按次付费(1.0-2.0 USDT/次)。' },
  { id: 'reg-3', category: 'register', categoryIcon: '📝', question: '可以不用注册体验吗?', answer: '可以。点击"免费体验"进入访客模式。可浏览信号广场、使用基础回测(5次/天)、查看行情。注册后解锁全部功能。' },

  // ── 充值 ──
  { id: 'topup-1', category: 'topup', categoryIcon: '💰', question: '如何充值 USDT?', answer: '进入[钱包]页面 → 点击"充值" → 获取TRC-20充值地址 → 从交易所/钱包转账USDT。最低充值10 USDT。到账时间: TRC-20约3分钟。' },
  { id: 'topup-2', category: 'topup', categoryIcon: '💰', question: '支持哪些链充值?', answer: 'TRC-20 (推荐, 1U手续费, 3秒确认) · BSC BEP20 · Solana SPL · Polygon · Arbitrum。建议使用TRC-20，手续费最低。' },
  { id: 'topup-3', category: 'topup', categoryIcon: '💰', question: 'USDT价格怎么算?', answer: '1 USDT ≈ 1 USD。AI分析按次扣费: 标准1.0U · 高级1.5U · 旗舰2.0U。余额可在"钱包"页面实时查看。' },

  // ── AI ──
  { id: 'ai-1', category: 'ai', categoryIcon: '🤖', question: '4 Agent AI 怎么用?', answer: '在[AI助理]页面用自然语言描述交易想法, 4个Agent(基本面/技术/情绪/宏观)自动协作分析。几分钟内生成交易信号。无需编程。' },
  { id: 'ai-2', category: 'ai', categoryIcon: '🤖', question: 'AI分析准确吗?', answer: 'Agent分析基于实时数据+历史回测。信号有质量评分(A+~F)。回测引擎验证历史表现。交易有风险，信号仅供参考，不构成投资建议。' },
  { id: 'ai-3', category: 'ai', categoryIcon: '🤖', question: 'AI密钥安全吗?', answer: '安全。所有AI密钥(DeepSeek)存储在服务器端，通过环境变量注入。桌面端是React瘦客户端——破解只能拿到UI代码，无法获取密钥。' },

  // ── 交易 ──
  { id: 'trade-1', category: 'trade', categoryIcon: '📈', question: '支持哪些市场?', answer: '港股(HKEX) · 美股(NYSE/NASDAQ)。通过Futu OpenD或IBKR Gateway实盘交易。支持市价单/限价单/止损单。' },
  { id: 'trade-2', category: 'trade', categoryIcon: '📈', question: '费用怎么算?', answer: '券商佣金: Futu美股$0.0049/股, 港股0.03%。平台不额外收费。完整费率表见[券商管理]页面。' },
  { id: 'trade-3', category: 'trade', categoryIcon: '📈', question: '支持碎股交易吗?', answer: '支持。美股碎股: 0.01-1.00股。部分成交自动跟踪，剩余股数继续挂单。' },

  // ── 钱包 ──
  { id: 'wallet-1', category: 'wallet', categoryIcon: '👛', question: '如何提现 USDT?', answer: '进入[钱包]页面 → 点击"提现" → 输入TRC-20地址 → 输入金额 → 2FA验证 → 确认。最低提现10 USDT。P2P转账: 0.3%双向，14天冻结期。' },
  { id: 'wallet-2', category: 'wallet', categoryIcon: '👛', question: '什么是P2P转账?', answer: '平台内用户之间USDT转账。0.3%双向手续费。到账14天冻结期(安全考虑)。平台不仲裁纠纷。' },
  { id: 'wallet-3', category: 'wallet', categoryIcon: '👛', question: '钱包安全吗?', answer: '钱包私钥存储在服务器端。2FA(Google Authenticator)保护登录和提现操作。14天冻结期内异常可申诉。' },

  // ── 创作者 ──
  { id: 'creator-1', category: 'creator', categoryIcon: '⭐', question: '如何成为创作者?', answer: '注册后进入[创作者中心] → 发布策略 → 设置价格(1-1000 USDT) → 上架市场。青铜→王者6级晋升，分成70/30→90/10。' },
  { id: 'creator-2', category: 'creator', categoryIcon: '⭐', question: '创作者如何赚钱?', answer: '三个来源: 1. AI分析费分成; 2. 策略模板销售; 3. 信号订阅收入。等级越高分成比例越高(L1 70% → L3 90%)。收益可提现USDT。' },
];

const CATEGORIES = [
  { id: 'all', label: t('components.all'), icon: '📚' },
  { id: 'install', label: t('components.install'), icon: '💻' },
  { id: 'register', label: t('components.register'), icon: '📝' },
  { id: 'topup', label: t('components.deposit'), icon: '💰' },
  { id: 'ai', label: 'AI分析', icon: '🤖' },
  { id: 'trade', label: '交易', icon: '📈' },
  { id: 'wallet', label: t('components.wallet'), icon: '👛' },
  { id: 'creator', label: '创作者', icon: '⭐' },
];

// ── SEO FAQPage JSON-LD ─────────────────────────────────────────────────

function FAQJsonLd({ articles }: { articles: HelpArticle[] }) {
  const { t } = useTranslation();

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: articles.map(a => ({
      '@type': 'Question',
      name: a.question,
      acceptedAnswer: { '@type': 'Answer', text: a.answer },
    })),
  };
  // Safe injection: JSON.stringify + escape </ to prevent script tag breakout
  const json = JSON.stringify(ld).replace(/<\//g, '<' + '/');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

// ── Main Component ──────────────────────────────────────────────────────

export default function HelpCenter({ articles: propArticles, className = '' }: HelpCenterProps) {
  const articles = propArticles ?? HELP_ARTICLES;
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = category === 'all' ? articles : articles.filter(a => a.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.question.toLowerCase().includes(q) || a.answer.toLowerCase().includes(q));
    }
    return list;
  }, [articles, category, search]);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>帮助中心 — DAWN WHALES | Help Center</title>
        <meta name="description" content="DAWN WHALES 帮助中心: 安装/注册/充值/AI分析/交易/钱包/提现 完整指南。FAQ常见问题解答。" />
        <meta name="robots" content="index, follow" />
        <FAQJsonLd articles={articles} />
      </head>
      <body className={className} style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', background: '#fff', color: '#1e293b' }}>
        {/* Nav */}
        <nav style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span style={{ fontSize: 22 }}>🐋</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>DAWN WHALES</span>
          </a>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>帮助中心 Help Center</span>
        </nav>

        {/* Header */}
        <header style={{ padding: '60px 24px 40px', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', color: '#fff', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, margin: '0 0 12px' }}>需要帮助?</h1>
          <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 24 }}>How can we help? Search or browse topics.</p>
          <div style={{ maxWidth: 500, margin: '0 auto', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索问题... Search..."
              style={{ width: '100%', padding: '14px 14px 14px 44px', fontSize: 15, border: 'none', borderRadius: 12, outline: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </div>
        </header>

        {/* Category tabs */}
        <div style={{ borderBottom: '1px solid #e2e8f0', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', overflowX: 'auto', gap: 4, padding: '4px 16px' }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)}
                style={{
                  padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none',
                  color: category === c.id ? '#3b82f6' : '#64748b',
                  borderBottom: category === c.id ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color .15s',
                }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ list */}
        <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
              <span style={{ fontSize: 40 }}>📭</span>
              <p>没有找到相关问题。试试调整搜索词。</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(a => {
                const isOpen = expanded.has(a.id);
                return (
                  <article key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    <button onClick={() => toggle(a.id)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '16px 20px', background: isOpen ? '#f8fafc' : '#fff',
                        border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                      }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{a.categoryIcon}</span>
                        <span style={{ color: '#1e293b' }}>{a.question}</span>
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: 14 }}>{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 20px 16px 48px', fontSize: 14, color: '#475569', lineHeight: 1.8 }}>
                        {a.answer}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid #e2e8f0', padding: '32px 24px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          <p>🐋 DAWN WHALES Help Center · v1.7.0 GA</p>
          <p style={{ marginTop: 4 }}>Need more help? <a href="https://github.com/vx1073071/dawn-whales" style={{ color: '#3b82f6' }}>GitHub</a></p>
        </footer>
      </body>
    </html>
  );
}
