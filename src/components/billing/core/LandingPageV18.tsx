import { useTranslation } from 'react-i18next';
import { useState, type CSSProperties } from 'react';

// v1.8.0 GA Landing Page — ML-74-01
// SEO-optimized, feature-complete, deploy-ready

const FEATURES = [
  { icon: '🌍', title: '7大市场', desc: '港股·美股·新加坡·日本·澳洲·加拿大·马来西亚 · 全品种覆盖', highlight: '无A股' },
  { icon: '📊', title: '30+量化因子', desc: '价值/动量/质量/波动/股息/成长六维 · 市场兼容自动校验', highlight: 'AI推荐' },
  { icon: '📋', title: '20+策略模板', desc: 'MACD金叉·布林突破·双均线·RSI超卖·高股息防守·动量轮动', highlight: '一键套用' },
  { icon: '🤖', title: '4Agent AI信号', desc: '基本面·技术面·情绪面·宏观面 四引擎协同 · 真实数据源', highlight: 'useMock=false' },
  { icon: '📈', title: 'K线图表 TV级', desc: '蜡烛图+成交量+MA叠加+9周期+Crosehair+滚轮缩放+<100ms渲染', highlight: '对标TradingView' },
  { icon: '📐', title: 'AI画线+形态', desc: '6画线工具 · 22种K线形态 · 半透明标注 · 置信度评分 · 可修正', highlight: 'AI识别' },
  { icon: '💬', title: t('components.strategyCommunity'), desc: '评论/点赞/关注/动态流/通知/创作者主页 · 策略分享与讨论', highlight: 'WebSocket实时' },
  { icon: '🎓', title: t('components.onboarding'), desc: '5步交互教程 · 8项指标卡片 · 4个因子故事 · 回测健康检查', highlight: '30秒上手' },
  { icon: '🎨', title: '私行级UI', desc: '深色+金色主题 · 深浅双模式切换 · 5语言 · 友好错误文案', highlight: '8px网格' },
  { icon: '🛡️', title: '风控引擎', desc: '日亏损上限·单笔仓位限制·凯利公式·保证金监控·熔断机制', highlight: '7项检查' },
  { icon: '🔔', title: '监控告警', desc: 'SLO仪表板·P95延迟·错误率·多渠道通知·静默规则', highlight: '分钟级聚合' },
  { icon: '⚡', title: '全链路', desc: '注册→券商→充值→AI选股→交易执行→提现 · 6步闭环', highlight: '一键自动化' },
];

const TESTIMONIALS = [
  { name: '港股趋势派', role: '个人投资者', quote: '用了MACD+RSI组合策略，3个月收益+18%。新手引导很友好，5分钟就建好了第一个策略。' },
  { name: '美股量化君', role: '量化爱好者', quote: '30个因子选股太强了！7市场全覆盖，港股美股一起跑，AI每日简报每天必看。' },
  { name: '新加坡REITs', role: '收息投资者', quote: '高股息模板一键套用，买入持有+自动再平衡。风控引擎让我睡得着觉。' },
];

const PRICING_TIERS = [
  { name: 'Free', price: '0', period: '/月', features: ['7市场行情', '5个策略模板', '3年回测', '基础指标', '模拟交易'], cta: '免费开始', color: '#6B7280' },
  { name: 'Pro', price: '29', period: '/月', features: ['全部30+因子', '全部20+模板', 'AI信号 (4Agent)', 'AI画线+形态', t('components.strategyCommunity'), '邮件通知', '深色模式'], cta: '开始试用', color: '#6366F1', popular: true },
  { name: 'Enterprise', price: '99', period: '/月', features: ['全部Pro功能', 'AI助手 (问诊/NL/简报/术语)', t('components.dailyDigest'), '自然语言创建', 'API接入', '多券商实盘', '优先支持'], cta: '联系销售', color: '#D4A853' },
];

// ── Sub-components ──
function NavBar() {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#0A0A10dd', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1F2937', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>🐋</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#F9FAFB', letterSpacing: -0.5 }}>Dawn Whales</span>
        <span style={{ padding: '2px 8px', borderRadius: 6, background: '#6366F122', color: '#818CF8', fontSize: 11, fontWeight: 700 }}>v1.8.0</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {['功能', '定价', '社区', '文档'].map(l => (
          <a key={l} href={`#${l}`} style={{ padding: '6px 12px', borderRadius: 6, color: '#9CA3AF', fontSize: 13, textDecoration: 'none' }}>{l}</a>
        ))}
        <button style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366F1', color: '#FFF', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          🚀 免费开始
        </button>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: '#6366F112', border: '1px solid #6366F133', marginBottom: 24, fontSize: 13, color: '#A5B4FC' }}>
        🎉 v1.8.0 GA 正式发布 — 7大市场 · 30+因子 · AI画线 · 策略社区
      </div>
      <h1 style={{ fontSize: 48, fontWeight: 900, color: '#F9FAFB', lineHeight: 1.15, margin: '0 0 16px' }}>
        AI驱动的<br /><span style={{ background: 'linear-gradient(135deg, #818CF8, #D4A853)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>量化策略平台</span>
      </h1>
      <p style={{ fontSize: 18, color: '#9CA3AF', lineHeight: 1.7, maxWidth: 600, margin: '0 auto 32px' }}>
        无需编程 · 自然语言创建 · 30秒出策略 · AI选股 · 7市场全覆盖 · 私行级体验
      </p>
      
      {/* Stats */}
      <div style={{ display: 'flex', gap: 32, justifyContent: 'center', marginBottom: 36 }}>
        {[{ n: '7', l: t('components.mark'市场' t('components.factor') }, { n: '22', l: 'AI形态' }, { n: '25项', l: t('components.onboarding') }, { n: '5', l: t('components.language') }].map(s => '语言'l}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#D4A853' }}>{s.n}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button style={{ padding: '14px 36px', borderRadius: 12, border: 'none', background: '#6366F1', color: '#FFF', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          🚀 免费开始使用
        </button>
        <button style={{ padding: '14px 36px', borderRadius: 12, border: '1px solid #374151', background: '#1F2937', color: '#D1D5DB', fontSize: 16, cursor: 'pointer' }}>
          📺 看演示 (60秒)
        </button>
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: '#6B7280' }}>无需信用卡 · 免费层永久可用 · Windows/macOS/Linux</div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section id="功能" style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#F9FAFB', margin: '0 0 8px' }}>全部功能一览</h2>
        <p style={{ fontSize: 15, color: '#9CA3AF' }}>R52→R74 · 25轮迭代 · 350+测试 · 12只虾协作</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {FEATURES.map(f => (
          <div key={f.icon} style={{ padding: '22px', borderRadius: 14, background: '#111827', border: '1px solid #1F2937', transition: 'all 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB' }}>{f.title}</div>
                <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: '#6366F122', color: '#818CF8' }}>{f.highlight}</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingSection() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="定价" style={{ padding: '60px 24px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#F9FAFB', margin: '0 0 8px' }}>简单定价</h2>
        <div style={{ display: 'inline-flex', gap: 2, background: '#1F2937', borderRadius: 10, padding: 3, marginTop: 12 }}>
          <button onClick={() => setYearly(false)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: yearly ? 'transparent' : '#6366F1', color: yearly ? '#9CA3AF' : '#FFF', fontSize: 13, cursor: 'pointer' }}>月付</button>
          <button onClick={() => setYearly(true)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: yearly ? '#6366F1' : 'transparent', color: yearly ? '#FFF' : '#9CA3AF', fontSize: 13, cursor: 'pointer' }}>年付 <span style={{ color: '#34D399' }}>-20%</span></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, alignItems: 'start' }}>
        {PRICING_TIERS.map(t => (
          <div key={t.name} style={{
            padding: '28px 24px', borderRadius: 16, background: t.popular ? '#6366F10A' : '#111827',
            border: t.popular ? '2px solid #6366F1' : '1px solid #1F2937',
            position: 'relative',
          }}>
            {t.popular && (
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '3px 14px', borderRadius: 8, background: '#6366F1', color: '#FFF', fontSize: 11, fontWeight: 700 }}>最受欢迎</div>
            )}
            <div style={{ fontSize: 18, fontWeight: 700, color: t.color, marginBottom: 8 }}>{t.name}</div>
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#F9FAFB' }}>${yearly ? Math.round(Number(t.price)*0.8) : t.price}</span>
              <span style={{ fontSize: 14, color: '#6B7280' }}>{t.period}</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {t.features.map(f => (
                <li key={f} style={{ fontSize: 13, color: '#D1D5DB', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#10B981' }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button style={{
              width: '100%', padding: '12px', borderRadius: 10, border: t.popular ? 'none' : '1px solid #374151',
              background: t.popular ? '#6366F1' : 'transparent',
              color: t.popular ? '#FFF' : '#D1D5DB', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              {t.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section style={{ padding: '60px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#F9FAFB', margin: 0 }}>交易者怎么说</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {TESTIMONIALS.map(t => (
          <div key={t.name} style={{ padding: '22px', borderRadius: 14, background: '#111827', border: '1px solid #1F2937' }}>
            <div style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.7, marginBottom: 14, fontStyle: 'italic' }}>"{t.quote}"</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: '#6366F122', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🐋</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section style={{ padding: '60px 24px', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ padding: '48px 32px', borderRadius: 20, background: 'linear-gradient(135deg, #6366F118, #D4A85314)', border: '1px solid #374151' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#F9FAFB', margin: '0 0 12px' }}>准备好开始量化了吗？</h2>
        <p style={{ fontSize: 15, color: '#9CA3AF', marginBottom: 28, lineHeight: 1.7 }}>
          30秒创建第一个策略 · 7市场全覆盖 · AI驱动 · 免费开始
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{ padding: '14px 36px', borderRadius: 12, border: 'none', background: '#6366F1', color: '#FFF', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            🚀 免费开始
          </button>
          <button style={{ padding: '14px 36px', borderRadius: 12, border: '1px solid #374151', background: '#1F2937', color: '#D1D5DB', fontSize: 16, cursor: 'pointer' }}>
            📞 预约演示
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: '32px 24px', borderTop: '1px solid #1F2937', background: '#0A0A10', fontSize: 12, color: '#6B7280' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span style={{ marginRight: 6 }}>🐋</span>
          <span style={{ color: '#D1D5DB', fontWeight: 600 }}>Dawn Whales</span> v1.8.0 GA
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <span>© 2026 Dawn Whales</span>
          <span>隐私政策</span>
          <span>服务条款</span>
          <span>联系我们</span>
        </div>
      </div>
    </footer>
  );
}

// ── SEO Head Component ──
function SEOHead() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Dawn Whales',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Windows, macOS, Linux',
    description: 'AI驱动量化策略平台。7大市场·30+因子·AI画线·策略社区。无需编程，30秒创建策略。',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <>
      <title>Dawn Whales — AI量化策略平台 | 7大市场·30+因子·无需编程</title>
      <meta name="description" content="Dawn Whales v1.8.0 GA — AI驱动的量化策略平台。覆盖港股/美股/新加坡/日本/澳洲/加拿大/马来西亚7大市场，30+量化因子，AI画线形态识别，策略社区。免费开始，无需编程。" />
      <meta name="keywords" content="量化交易,AI选股,策略回测,港股量化,美股量化,技术分析,AI画线,K线形态,PineScript" />
      <meta property="og:title" content="Dawn Whales — AI量化策略平台" />
      <meta property="og:description" content="7大市场·30+因子·AI画线·策略社区。免费开始，无需编程。" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Dawn Whales — AI量化策略平台" />
      <link rel="canonical" href="https://dawnwhales.com" />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </>
  );
}

// ── Main ──
export default function LandingPageV18() {
  const { t } = useTranslation();
  const theme: CSSProperties = {
    background: '#0A0A10', color: '#E5E7EB',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
    minHeight: '100vh',
  };

  return (
    <div style={theme}>
      <SEOHead />
      <NavBar />
      <HeroSection />
      <FeatureGrid />
      <PricingSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
