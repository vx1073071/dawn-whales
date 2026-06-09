/**
 * LandingPageFinal — ML-70-01 [P0]
 * R70: v1.7.0 GA — Production landing page: dawnwhales.com deploy-ready
 *
 * Features:
 * - Complete landing page: intro + pricing + download + register + guest mode
 * - Responsive design (mobile-first breakpoints)
 * - SEO meta tags + Open Graph + Twitter Card
 * - Google Analytics (gtag placeholder)
 * - Structured JSON-LD for search engines
 * - Deploy-ready as static index.html
 */

import { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface LandingPageFinalProps {
  version?: string;
  gaId?: string;
  baseUrl?: string;
  onRegister?: (email: string) => void;
  onDownload?: (p: 'win' | 'mac' | 'linux') => void;
  className?: string;
}

// ── SEO Data ────────────────────────────────────────────────────────────

const SEO = {
  title: 'DAWN WHALES — AI量化交易平台 | Quantitative Trading',
  description: '4 Agent AI协作生成量化交易信号。港股·美股·A股三市场。自然语言描述策略, Futu/IBKR实盘交易。免费体验。',
  keywords: '量化交易,AI交易,股票信号,Futu,IBKR,USDT,策略回测,quantitative trading',
  ogImage: '/og-image.png',
};

// ── Deploy Config ───────────────────────────────────────────────────────

const DEPLOY = {
  version: 'v1.7.0 GA',
  downloadBase: '/downloads',
  registerApi: '/api/register',
};

// ── GA Script ───────────────────────────────────────────────────────────

function GAScript({ gaId }: { gaId?: string }) {
  if (!gaId) return null;
  return (
    <script dangerouslySetInnerHTML={{ __html: `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId}', { send_page_view: true });
      document.querySelectorAll('a[href^="#"]').forEach(el => {
        el.addEventListener('click', () => gtag('event', 'nav_click', { target: el.getAttribute('href') }));
      });
    `}} />
  );
}

// ── JSON-LD ─────────────────────────────────────────────────────────────

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'DAWN WHALES',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Windows, macOS, Linux',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free download with pay-per-use AI analysis' },
  description: SEO.description,
};

// ── Main ────────────────────────────────────────────────────────────────

export default function LandingPageFinal({
  version = DEPLOY.version,
  gaId,
  baseUrl = '',
  onRegister,
  onDownload,
  className = '',
}: LandingPageFinalProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleRegister = useCallback(() => {
    if (!email.includes('@')) return;
    onRegister?.(email);
    setSubmitted(true);
    setEmail('');
  }, [email, onRegister]);

  return (
    <html lang="zh-CN" style={{ scrollBehavior: 'smooth' }}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{SEO.title}</title>
        <meta name="description" content={SEO.description} />
        <meta name="keywords" content={SEO.keywords} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${baseUrl || 'https://dawnwhales.com'}/`} />

        {/* Open Graph */}
        <meta property="og:title" content={SEO.title} />
        <meta property="og:description" content={SEO.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${baseUrl || 'https://dawnwhales.com'}/`} />
        <meta property="og:image" content={`${baseUrl || ''}${SEO.ogImage}`} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SEO.title} />
        <meta name="twitter:description" content={SEO.description} />

        {/* JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

        {/* GA */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId || 'G-XXXXXXXXXX'}`} />
        <GAScript gaId={gaId} />

        {/* Responsive base styles */}
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; background: #fff; }
          .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
          @media (max-width: 768px) {
            .hide-mobile { display: none !important; }
            .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </head>
      <body className={className}>
        {/* ── Nav ── */}
        <nav style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #f1f5f9', zIndex: 100, padding: '12px 0' }}>
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <span style={{ fontSize: 24 }}>🐋</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>DAWN WHALES</span>
              <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{version}</span>
            </a>
            <div style={{ display: 'flex', gap: 20, fontSize: 13, fontWeight: 600 }} className="hide-mobile">
              <a href="#features" style={{ color: '#475569', textDecoration: 'none' }}>功能</a>
              <a href="#pricing" style={{ color: '#475569', textDecoration: 'none' }}>定价</a>
              <a href="#download" style={{ color: '#475569', textDecoration: 'none' }}>下载</a>
              <a href="#faq" style={{ color: '#475569', textDecoration: 'none' }}>FAQ</a>
            </div>
            <a href="#register" style={{ padding: '8px 20px', background: '#3b82f6', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              免费注册
            </a>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section style={{ padding: '80px 0', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', color: '#fff', textAlign: 'center' }}>
          <div className="container">
            <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, letterSpacing: 3, marginBottom: 16 }}>
              🚀 {version} NOW LIVE
            </div>
            <h1 style={{ fontSize: 'clamp(28px, 6vw, 52px)', fontWeight: 900, lineHeight: 1.15, marginBottom: 16 }}>
              AI量化交易<br />自然语言驱动
            </h1>
            <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.7 }}>
              4个AI Agent实时协作。港股·美股·A股三市场。Futu + IBKR双券商。
              <br /><span style={{ fontSize: 13, color: '#64748b' }}>Describe your strategy in plain language. 4 AI agents turn it into live trading signals.</span>
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="#download" style={{ padding: '14px 36px', fontSize: 15, fontWeight: 700, background: '#3b82f6', color: '#fff', borderRadius: 12, textDecoration: 'none' }}>
                ⬇ 免费下载
              </a>
              <a href="#register" style={{ padding: '14px 36px', fontSize: 15, fontWeight: 700, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, textDecoration: 'none' }}>
                👀 免费体验
              </a>
            </div>
            <div style={{ marginTop: 36, fontSize: 12, color: '#64748b' }}>
              🟢 5,500+ 自动化测试 · 0 失败 · 19 版本 · 3 市场 · IBKR+Futu
            </div>
          </div>
        </section>

        {/* ── Social Proof ── */}
        <section style={{ padding: '48px 0', background: '#f8fafc', textAlign: 'center' }}>
          <div className="container" style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
            {[
              ['🧪', '5,500+', '自动化测试'],
              ['✅', '0 fail', '零失败'],
              ['📦', '19', '版本发布'],
              ['🌍', '3', '市场覆盖'],
              ['🤖', '4', 'AI Agent'],
              ['🏦', '2', '券商支持'],
            ].map(([icon, val, label]) => (
              <div key={label} style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 24 }}>{icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{val}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" style={{ padding: '80px 0' }}>
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, marginBottom: 8 }}>一切你需要的</h2>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#94a3b8', marginBottom: 48 }}>全链路: 数据 → 信号 → 回测 → 实盘</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {[
                ['🤖', '4 Agent AI', '基本面·技术·情绪·宏观 Agent协作，自然语言秒变信号'],
                ['📊', '策略因子引擎', 'Fama-French 5因子 + Barra定制因子 + 自研选股'],
                ['🌍', '三市场 + 双券商', '港股HKEX·美股NYSE·A股沪深, Futu + IBKR'],
                ['💰', 'USDT积分', '按次付费AI。USDT充值。P2P转账。不绑套餐'],
                ['📡', '信号广场', '订阅顶尖创作者信号。实时推送+质量评分+表现追踪'],
                ['🔒', '服务器端安全', 'AI密钥仅在服务器。桌面端瘦客户端。破解只拿React代码'],
              ].map(([icon, title, desc]) => (
                <div key={title} style={{ padding: 24, borderRadius: 14, border: '1px solid #e2e8f0', transition: 'box-shadow .2s' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</h3>
                  <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" style={{ padding: '80px 0', background: '#f8fafc' }}>
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, marginBottom: 8 }}>简单定价</h2>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#94a3b8', marginBottom: 8 }}>按次付费 · 前3次免费 · 不绑套餐</p>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#cbd5e1', marginBottom: 40 }}>1 USDT ≈ 1 USD (TRC-20)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
              {[
                { name: '标准', price: '1.0', agents: '2 Agent', cache: '基础', markets: '港股', badge: '', color: '#e2e8f0' },
                { name: '高级', price: '1.5', agents: '3 Agent', cache: '95%命中', markets: '港股+美股', badge: '🔥 推荐', color: '#3b82f6' },
                { name: '旗舰', price: '2.0', agents: '4 Agent Arena', cache: '99%命中', markets: '全三市场', badge: '👑 旗舰', color: '#8b5cf6' },
              ].map(t => (
                <div key={t.name} style={{ background: '#fff', borderRadius: 14, border: `2px solid ${t.color}`, padding: 28, textAlign: 'center', position: 'relative' }}>
                  {t.badge && <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#3b82f6', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>{t.badge}</span>}
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: t.badge ? 8 : 0 }}>{t.name}</h3>
                  <div style={{ margin: '16px 0' }}><span style={{ fontSize: 40, fontWeight: 900 }}>${t.price}</span><span style={{ fontSize: 13, color: '#94a3b8' }}>/次</span></div>
                  <div style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>{t.agents}<br/>{t.cache}<br/>{t.markets}</div>
                  <a href="#register" style={{ display: 'block', padding: '12px 0', background: t.badge ? '#3b82f6' : '#1e293b', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>开始免费试用</a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Download ── */}
        <section id="download" style={{ padding: '80px 0' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, marginBottom: 8 }}>下载 DAWN WHALES</h2>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 36 }}>{version} · Windows 10+ / macOS 12+ / Linux</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                ['🪟', 'Windows', '.exe', 'win' as const],
                ['🍎', 'macOS', '.dmg', 'mac' as const],
                ['🐧', 'Linux', '.AppImage', 'linux' as const],
              ].map(([icon, label, ext, plat]) => (
                <button key={label} onClick={() => onDownload?.(plat as 'win' | 'mac' | 'linux')}
                  style={{ padding: '20px 36px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 28 }}>{icon}</span>
                  <span>{label} {ext}</span>
                  <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 400 }}>~128 MB</span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#cbd5e1', marginTop: 16 }}>SHA-256 checksums available on <a href="https://github.com/vx1073071/dawn-whales/releases" style={{ color: '#3b82f6' }}>GitHub Releases</a></p>
          </div>
        </section>

        {/* ── Register ── */}
        <section id="register" style={{ padding: '80px 0', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', textAlign: 'center' }}>
          <div className="container">
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, marginBottom: 8 }}>开始 7 天免费试用</h2>
            <p style={{ fontSize: 15, opacity: 0.9, marginBottom: 28 }}>无需信用卡 · 3次免费AI分析 · 全功能解锁</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', maxWidth: 440, margin: '0 auto', flexWrap: 'wrap' }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" aria-label="Email address"
                style={{ flex: 1, minWidth: 200, padding: '14px 18px', fontSize: 15, border: 'none', borderRadius: 10, outline: 'none' }} />
              <button onClick={handleRegister}
                style={{ padding: '14px 30px', fontSize: 15, fontWeight: 700, background: '#1e293b', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                开始使用 →
              </button>
            </div>
            {submitted && <p style={{ marginTop: 12, fontSize: 13, color: '#bbf7d0' }}>✅ 激活链接已发送至邮箱！</p>}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" style={{ padding: '80px 0' }}>
          <div className="container" style={{ maxWidth: 680 }}>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, marginBottom: 36 }}>常见问题</h2>
            {[
              ['免费和付费的边界?', '行情·图表·基础回测·3次AI分析永久免费。AI分析用完后按次付费(1.0-2.0 USDT)。信号订阅·策略购买·P2P转账需USDT。'],
              ['AI密钥安全吗?', '所有AI密钥存储在服务器端。桌面端只是React瘦客户端——破解只能拿到UI代码。'],
              ['支持哪些券商?', '富途牛牛Futu(OpenD) + 盈透IBKR(IB Gateway)。港股·美股·A股实盘交易。'],
              ['创作者怎么赚钱?', '青铜→王者6级晋升。L1(70/30)→L2(80/20)→L3(90/10)分成。来源:AI分析费+信号订阅+策略销售。'],
            ].map(([q, a], i) => (
              <details key={i} style={{ marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <summary style={{ padding: '14px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}>
                  {q} <span style={{ color: '#94a3b8' }}>▼</span>
                </summary>
                <p style={{ padding: '0 18px 14px', fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{ padding: '40px 0', background: '#0f172a', color: '#94a3b8', textAlign: 'center', fontSize: 12 }}>
          <div className="container">
            <div style={{ fontSize: 28, marginBottom: 8 }}>🐋</div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: 16, marginBottom: 4 }}>DAWN WHALES</div>
            <p style={{ marginBottom: 12 }}>AI-Powered Quantitative Trading · {version}</p>
            <p style={{ color: '#64748b', marginBottom: 8 }}>所有AI密钥存储在服务器端 · 桌面端永不暴露敏感信息</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', color: '#64748b' }}>
              <span>Terms 条款</span><span>Privacy 隐私</span><a href="https://github.com/vx1073071/dawn-whales" style={{ color: '#64748b' }}>GitHub</a><span>Contact</span>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: '#475569' }}>© 2026 DAWN WHALES · 道鲸 · Built by 5-Shrimp Team 🦐</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
