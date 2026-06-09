/**
 * LandingPageV2 — ML-67-01 [P0]
 * R67: v1.6.0 GA — Final landing page polish for dawnwhales.com launch
 *
 * Enhancements over R65 LandingPage:
 * - Bilingual copy (EN + 中文 key phrases)
 * - Free vs Paid boundary table (what's free forever vs USDT required)
 * - Social proof: test count, version history, market coverage badges
 * - Download verification: checksum hints + platform detection
 * - Trust bar: security architecture diagram
 * - Better CTA: "Start Free" vs "Top Up USDT" clear separation
 */

import React, { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface LandingPageV2Props {
  version?: string;
  onRegister?: (email: string) => void;
  onDownload?: (platform: 'win' | 'mac' | 'linux') => void;
  className?: string;
}

// ── Data ────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: '🤖', title: '4-Agent AI / 四Agent协作', desc: '基本面·技术面·情绪·宏观 四维Agent实时协作，自然语言描述→量化交易信号。Fundamentals · Technical · Sentiment · Macro agents.' },
  { icon: '📊', title: '策略因子引擎 / Factor Engine', desc: 'Fama-French 5因子 + Barra定制因子 + 自研选股。自然语言秒变量化策略。NL→DSL→Signal in seconds.' },
  { icon: '🌍', title: '三市场执行 / 3-Market Execution', desc: '港股(HKEX) · 美股(NYSE/NASDAQ) · A股(沪深)。对接Futu OpenD实盘。Fractional shares supported.' },
  { icon: '💎', title: 'USDT积分 / USDT Points', desc: '按次付费AI分析。USDT充值。P2P转账。14天冻结。无需信用卡。Pay-per-use. No fiat.' },
  { icon: '📡', title: '信号广场 / Signal Square', desc: '发现订阅顶尖创作者。实时信号推送+质量评分+表现追踪。Discover. Subscribe. Copy-trade.' },
  { icon: '🔒', title: '服务器端安全 / Server-Side Security', desc: 'AI密钥仅在服务器。桌面端是瘦客户端。破解只拿到React代码。Keys server-side only.' },
];

const AI_TIERS = [
  { name: '标准 Standard', price: '1.0', unit: 'USDT/次', agents: 2, cache: '基础 Basic', models: '单模型 Single', markets: '港股 HK', badge: '' },
  { name: '高级 Premium', price: '1.5', unit: 'USDT/次', agents: 3, cache: '95% 命中', models: '双模型辩论 2-Model', markets: '港股+美股 HK+US', badge: '🔥 推荐' },
  { name: '旗舰 Flagship', price: '2.0', unit: 'USDT/次', agents: 4, cache: '99% 命中', models: '三模型竞技 3-Model Arena', markets: '港股+美股+A股 All 3', badge: '👑 旗舰' },
];

const FREE_VS_PAID = [
  { feature: '市场行情查看 / Market Quotes', free: '✅ 实时 / Realtime', paid: '✅ 实时 / Realtime' },
  { feature: '技术指标 (MA/MACD/RSI)', free: '✅ 全部 / All 12', paid: '✅ 全部 / All 12' },
  { feature: 'K线图表 / Charting', free: '✅ 多周期 / Multi-period', paid: '✅ 多周期 / Multi-period' },
  { feature: 'AI策略分析 / AI Analysis', free: '🆓 3次免费 / 3 Free', paid: '💰 1.0-2.0 USDT/次' },
  { feature: '策略回测 / Backtest', free: '✅ 基础回测 / Basic', paid: '✅ 高级回测 / Advanced' },
  { feature: '实盘交易 / Live Trading', free: '✅ Futu OpenD', paid: '✅ Futu OpenD' },
  { feature: '信号订阅 / Signal Subscribe', free: '❌', paid: '✅ 创作者定价 / Creator Price' },
  { feature: '策略模板购买 / Templates', free: '❌', paid: '✅ 0-1000 USDT' },
  { feature: 'P2P转账 / P2P Transfer', free: '❌', paid: '✅ 0.3% 双向' },
  { feature: '创作者发布 / Creator Publish', free: '❌', paid: '✅ L1-L3分成 / Revenue Share' },
  { feature: '4 Agent Arena', free: '❌', paid: '✅ Premium/Flagship' },
  { feature: 'API 数据导出 / Data Export', free: '❌', paid: '✅ CSV/JSON/PDF' },
];

const SOCIAL_PROOF = [
  { icon: '🧪', value: '5,400+', label: '自动化测试 / Tests' },
  { icon: '✅', value: '0 fail', label: '零失败 / Zero Failures' },
  { icon: '📦', value: '23', label: '版本发布 / Releases' },
  { icon: '🌍', value: '3', label: '市场覆盖 / Markets' },
  { icon: '🤖', value: '4', label: 'AI Agent' },
  { icon: '📊', value: '282+', label: '引擎模块 / Engines' },
];

const DOWNLOAD_PLATFORMS = [
  { id: 'win' as const, icon: '🪟', label: 'Windows', ext: '.exe', size: '~128 MB', min: 'Windows 10+' },
  { id: 'mac' as const, icon: '🍎', label: 'macOS', ext: '.dmg', size: '~135 MB', min: 'macOS 12+' },
  { id: 'linux' as const, icon: '🐧', label: 'Linux', ext: '.AppImage', size: '~140 MB', min: 'Ubuntu 20.04+' },
];

const FAQS = [
  { q: '免费和付费的边界? / Free vs Paid?', a: '行情、图表、基础回测、3次AI分析永久免费。AI分析用完后按次付费(1.0-2.0 USDT/次)。信号订阅、策略购买、P2P转账需要USDT充值。Market data, charts, basic backtest, and 3 AI analyses are free forever. AI beyond that is pay-per-use.' },
  { q: 'AI密钥安全吗? / Is my AI key safe?', a: '所有AI密钥存储在服务器端。桌面端只是React瘦客户端——破解只能拿到UI代码，无法白嫖AI。All AI keys are server-side. The desktop app is a thin client — cracking it yields only React components.' },
  { q: '支持哪些券商? / Supported brokers?', a: '富途牛牛 Futu (OpenD)。支持港股/美股/A股实盘交易。未来计划接入长桥 LongBridge 和 Interactive Brokers。Futu OpenD for HK/US/CN live trading. More brokers planned.' },
  { q: '创作者怎么赚钱? / Creator earnings?', a: '青铜→王者 6级晋升。L1(70/30)→L2(80/20)→L3(90/10) 收益分成。来源: AI分析费 + 信号订阅 + 策略模板销售。Bronze→King levels. Earn from AI fees, subscriptions, and template sales.' },
  { q: '7天试用包含什么? / 7-day trial?', a: '全部功能解锁 + 3次免费AI分析。无需信用卡。7天后按需充值USDT。Full features unlocked + 3 free AI analyses. No credit card. Top up USDT as needed.' },
  { q: '数据源是什么? / Data sources?', a: '10源融合: 东方财富+Yahoo Finance+Alpha Vantage+NewsAPI+Reddit+微博+雪球+StockTwits+自研情绪。不含MOCK假数据。10-source fusion. Zero mock data.' },
];

// ── Platform detection ──────────────────────────────────────────────────

function detectPlatform(): 'win' | 'mac' | 'linux' | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'win';
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('linux')) return 'linux';
  return null;
}

// ── FreeVsPaidTable Sub-Component ───────────────────────────────────────

function FreeVsPaidTable() {
  return (
    <section style={{ padding: '80px 24px', background: '#0f172a', color: '#fff' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, marginBottom: 8 }}>免费 vs 付费 / Free vs Paid</h2>
        <p style={{ textAlign: 'center', fontSize: 14, color: '#94a3b8', marginBottom: 40 }}>
          一目了然什么永远免费，什么需要USDT / Clear boundary between free forever and USDT-required
        </p>
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: 600, color: '#e2e8f0', width: '40%' }}>功能 Feature</th>
                <th style={{ textAlign: 'center', padding: '12px 20px', fontWeight: 600, color: '#4ade80', width: '30%' }}>🆓 免费 Free</th>
                <th style={{ textAlign: 'center', padding: '12px 20px', fontWeight: 600, color: '#fbbf24', width: '30%' }}>💰 付费 Paid (USDT)</th>
              </tr>
            </thead>
            <tbody>
              {FREE_VS_PAID.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td style={{ padding: '10px 20px', color: '#cbd5e1' }}>{row.feature}</td>
                  <td style={{ textAlign: 'center', padding: '10px 20px', color: row.free.includes('✅') || row.free.includes('🆓') ? '#e2e8f0' : '#64748b' }}>{row.free}</td>
                  <td style={{ textAlign: 'center', padding: '10px 20px', fontWeight: row.paid.includes('✅') || row.paid.includes('💰') ? 500 : 400, color: row.paid.includes('💰') ? '#fbbf24' : row.paid.includes('✅') ? '#e2e8f0' : '#64748b' }}>{row.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#64748b' }}>
          💡 核心功能永久免费 · AI分析按次付费 · 不绑套餐 · 不强制订阅
          <br />Core features free forever · AI pay-per-use · No subscription lock-in
        </p>
      </div>
    </section>
  );
}

// ── SocialProof Sub-Component ───────────────────────────────────────────

function SocialProof() {
  return (
    <section style={{ padding: '60px 24px', background: '#f8fafc', textAlign: 'center' }}>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 32, fontWeight: 500 }}>TRUSTED BY QUANTITATIVE TRADERS</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap', maxWidth: 900, margin: '0 auto' }}>
        {SOCIAL_PROOF.map((item) => (
          <div key={item.label} style={{ textAlign: 'center', minWidth: 100 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{item.value}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── SecurityArch Sub-Component ──────────────────────────────────────────

function SecurityArch() {
  return (
    <section style={{ padding: '60px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h3 style={{ textAlign: 'center', fontSize: 24, fontWeight: 800, marginBottom: 32 }}>🔐 安全架构 / Security Architecture</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2px 1fr 2px 1fr', gap: 0, alignItems: 'start' }}>
          {[
            { title: '🌐 落地页', sub: 'Landing Page', desc: 'dawnwhales.com\n静态HTML\n无登录/无功能\n访客浏览+下载', color: '#3b82f6' },
            { title: '🖥 桌面端', sub: 'Desktop App', desc: 'Electron瘦客户端\nReact UI层\n无AI Key\n无钱包私钥\n破解=拿React代码', color: '#8b5cf6' },
            { title: '🖧 服务器', sub: 'Server', desc: '/api + /admin\nDeepSeek Key仅在此\n计费+钱包逻辑\n许可证验证\n2FA保护', color: '#10b981' },
          ].map((col, i) => (
            <React.Fragment key={col.title}>
              {i > 0 && <div style={{ width: 2, background: 'linear-gradient(to bottom, #e2e8f0, #e2e8f0)', borderRadius: 1, margin: '0 16px', alignSelf: 'stretch', minHeight: 120 }} />}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: col.color, marginBottom: 4 }}>{col.title}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>{col.sub}</div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{col.desc}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
        <div style={{ marginTop: 32, padding: 16, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', textAlign: 'center', fontSize: 13, color: '#166534' }}>
          🔒 所有敏感逻辑在服务器端 · 桌面端永不暴露AI密钥/钱包私钥/管理员入口
          <br />All sensitive logic server-side · Desktop never exposes AI keys / private keys / admin access
        </div>
      </div>
    </section>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

const LandingPageV2: React.FC<LandingPageV2Props> = ({
  version = 'v1.6.0 GA',
  onRegister,
  onDownload,
  className = '',
}) => {
  const [email, setEmail] = useState('');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [registered, setRegistered] = useState(false);
  const [platform] = useState(() => detectPlatform());

  const handleRegister = useCallback(() => {
    if (!email.includes('@')) return;
    onRegister?.(email);
    setRegistered(true);
    setEmail('');
  }, [email, onRegister]);

  return (
    <div className={`landing-page-v2 ${className}`} style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1e293b' }}>
      {/* ── Nav ── */}
      <nav style={{ borderBottom: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24 }}>🐋</span>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' }}>DAWN WHALES</span>
          <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{version}</span>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 13, fontWeight: 600, color: '#475569' }}>
          <a href="#features" style={{ textDecoration: 'none', color: 'inherit' }}>功能</a>
          <a href="#pricing" style={{ textDecoration: 'none', color: 'inherit' }}>定价</a>
          <a href="#free-vs-paid" style={{ textDecoration: 'none', color: 'inherit' }}>免费vs付费</a>
          <a href="#download" style={{ textDecoration: 'none', color: 'inherit' }}>下载</a>
          <a href="#faq" style={{ textDecoration: 'none', color: 'inherit' }}>FAQ</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ textAlign: 'center', padding: '90px 24px 70px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', color: '#fff' }}>
        <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600, marginBottom: 16, letterSpacing: '2px' }}>
          🚀 DAWN WHALES v1.6.0 GA — NOW LIVE
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: '-1px' }}>
          自然语言描述<br />量化策略交易
        </h1>
        <p style={{ fontSize: 17, color: '#94a3b8', maxWidth: 620, margin: '0 auto 36px', lineHeight: 1.7 }}>
          用日常语言描述你的交易想法。4个AI Agent实时协作，生成跨港股·美股·A股的量化交易信号。
          <br /><span style={{ fontSize: 13, color: '#64748b' }}>Describe your strategy in plain language. 4 AI agents turn it into live signals.</span>
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#download" style={{ padding: '15px 36px', fontSize: 16, fontWeight: 700, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
            ⬇ 免费下载 Free Download
          </a>
          <button style={{ padding: '15px 36px', fontSize: 16, fontWeight: 700, background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.2)', borderRadius: 12, cursor: 'pointer' }}>
            ▶ 3分钟演示 Demo
          </button>
        </div>
        {platform && (
          <div style={{ marginTop: 24, fontSize: 12, color: '#64748b' }}>
            🖥 检测到 {platform === 'win' ? 'Windows' : platform === 'mac' ? 'macOS' : 'Linux'} 系统 — 推荐下载对应版本
          </div>
        )}
        <div style={{ marginTop: 40, fontSize: 13, color: '#64748b' }}>
          🟢 5,400+ 自动化测试 · 0 失败 · 23 版本 · 3 市场 · 282+ 引擎模块
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <SocialProof />

      {/* ── Features ── */}
      <section id="features" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, marginBottom: 8 }}>一切你需要的 / Everything You Need</h2>
        <p style={{ textAlign: 'center', fontSize: 14, color: '#94a3b8', marginBottom: 48 }}>从数据到信号，从回测到实盘 — 全链路覆盖 / Full pipeline: data → signal → backtest → live</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ padding: 28, borderRadius: 16, border: '1px solid #e2e8f0', transition: 'box-shadow 0.2s, transform 0.15s', cursor: 'default' }}
                 onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 30px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                 onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Security Architecture ── */}
      <SecurityArch />

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '80px 24px', background: '#f8fafc' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, marginBottom: 8 }}>简单定价 / Simple Pricing</h2>
        <p style={{ textAlign: 'center', fontSize: 14, color: '#64748b', marginBottom: 8 }}>按次付费 · 前3次免费 · 不绑套餐 · Pay-per-use · First 3 free · No subscription</p>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginBottom: 48 }}>1 USDT ≈ 1 USD (TRC-20)</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, maxWidth: 960, margin: '0 auto' }}>
          {AI_TIERS.map(t => (
            <div key={t.name} style={{
              background: '#fff', borderRadius: 16, border: t.badge.includes('推荐') ? '2px solid #3b82f6' : t.badge.includes('旗舰') ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
              padding: 32, position: 'relative', textAlign: 'center', boxShadow: t.badge ? '0 4px 20px rgba(59,130,246,0.1)' : 'none'
            }}>
              {t.badge && <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: t.badge.includes('旗舰') ? '#8b5cf6' : '#3b82f6', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 16px', borderRadius: 20 }}>{t.badge}</span>}
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, marginTop: t.badge ? 8 : 0 }}>{t.name}</h3>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: '#1e293b' }}>${t.price}</span>
                <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 2 }}>{t.unit}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24, fontSize: 13, color: '#475569' }}>
                <span>🤖 {t.agents} Agent{t.agents > 1 ? 's' : ''}</span>
                <span>⚡ 缓存 {t.cache}</span>
                <span>🧠 {t.models}</span>
                <span>🌍 {t.markets}</span>
              </div>
              <button style={{ width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 700, background: t.badge ? '#3b82f6' : '#1e293b', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                开始免费试用 Start Free
              </button>
            </div>
          ))}
        </div>

        {/* Creator split */}
        <div style={{ maxWidth: 800, margin: '56px auto 0' }}>
          <h3 style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>创作者分成 / Creator Revenue Share</h3>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginBottom: 28 }}>青铜🥉→白银🥈→黄金🥇→铂金💎→钻石👑→王者🏆 6级晋升</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { lv: 'L1', name: '创作者 Creator', split: '70/30', color: '#CD7F32', bg: '#fef3c7', desc: '0-100 订阅' },
              { lv: 'L2', name: '专业创作者 Pro', split: '80/20', color: '#C0C0C0', bg: '#dbeafe', desc: '100-1000订阅' },
              { lv: 'L3', name: '大师创作者 Master', split: '90/10', color: '#FFD700', bg: '#ede9fe', desc: '1000+ 订阅' },
            ].map(l => (
              <div key={l.lv} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, textAlign: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: l.bg, color: l.color }}>{l.lv}</span>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 4px' }}>{l.name}</h4>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#059669', marginBottom: 4 }}>{l.split}</div>
                <p style={{ fontSize: 11, color: '#94a3b8' }}>{l.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Free vs Paid ── */}
      <div id="free-vs-paid"><FreeVsPaidTable /></div>

      {/* ── Download ── */}
      <section id="download" style={{ padding: '80px 24px', textAlign: 'center', background: '#f8fafc' }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>下载 DAWN WHALES</h2>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>版本 {version} · 支持 Windows / macOS / Linux · 免费下载</p>
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 32 }}>SHA-256 checksums available on GitHub Release page</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {DOWNLOAD_PLATFORMS.map(p => (
            <button key={p.id}
              onClick={() => onDownload?.(p.id)}
              style={{
                padding: '22px 36px', background: platform === p.id ? '#1e293b' : '#fff', color: platform === p.id ? '#fff' : '#1e293b',
                border: platform === p.id ? '2px solid #3b82f6' : '1px solid #e2e8f0', borderRadius: 14, fontSize: 15, fontWeight: 700,
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                transition: 'all 0.15s', boxShadow: platform === p.id ? '0 4px 16px rgba(59,130,246,0.2)' : 'none',
              }}>
              <span style={{ fontSize: 28 }}>{p.icon}</span>
              <span>{p.label} {p.ext}</span>
              <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6 }}>{p.size} · {p.min}</span>
              {platform === p.id && <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600 }}>← 推荐 / Recommended</span>}
            </button>
          ))}
        </div>
      </section>

      {/* ── Register CTA ── */}
      <section style={{ padding: '70px 24px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>开始 7 天免费试用</h2>
        <p style={{ fontSize: 15, opacity: 0.9, marginBottom: 8 }}>无需信用卡 · 3次免费AI分析 · 全功能解锁</p>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 28 }}>No credit card · 3 free AI analyses · Full features unlocked</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', maxWidth: 440, margin: '0 auto' }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{ flex: 1, padding: '13px 18px', fontSize: 15, border: 'none', borderRadius: 10, outline: 'none' }} />
          <button onClick={handleRegister}
            style={{ padding: '13px 30px', fontSize: 15, fontWeight: 700, background: '#1e293b', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            开始使用 →
          </button>
        </div>
        {registered && <p style={{ marginTop: 12, fontSize: 13, color: '#bbf7d0' }}>✅ 激活链接已发送至邮箱！Check your email for the activation link!</p>}
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '80px 24px', maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, marginBottom: 40 }}>常见问题 / FAQ</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQS.map((f, i) => (
            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              <button onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                style={{ width: '100%', textAlign: 'left', padding: '16px 20px', background: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{f.q}</span>
                <span style={{ color: '#94a3b8', fontSize: 18 }}>{activeFaq === i ? '−' : '+'}</span>
              </button>
              {activeFaq === i && <div style={{ padding: '0 20px 16px', fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid #e2e8f0', padding: '40px 24px', textAlign: 'center', fontSize: 12, color: '#94a3b8', background: '#0f172a' }}>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 28 }}>🐋</span>
          <div style={{ fontWeight: 700, color: '#fff', marginTop: 4 }}>DAWN WHALES</div>
          <div style={{ marginTop: 2 }}>AI-Powered Quantitative Trading · {version}</div>
        </div>
        <p style={{ marginBottom: 4, color: '#64748b' }}>所有AI密钥存储在服务器端 · 桌面端永不暴露敏感信息</p>
        <p style={{ marginBottom: 16, color: '#64748b' }}>All AI keys server-side · Desktop is a thin client · Security-first architecture</p>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', color: '#64748b' }}>
          <span>Terms 条款</span><span>Privacy 隐私</span><span>GitHub</span><span>Contact 联系</span>
        </div>
        <div style={{ marginTop: 16, fontSize: 11, color: '#475569' }}>
          © 2026 DAWN WHALES · 道鲸 · Built by 5-Shrimp Team 🦐
        </div>
      </footer>
    </div>
  );
};

export default LandingPageV2;
