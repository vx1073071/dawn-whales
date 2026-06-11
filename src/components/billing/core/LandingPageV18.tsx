import { useTranslation } from 'react-i18next';
import { useState, type CSSProperties } from 'react';
import i18n from '../../../i18n';

// v1.8.0 GA Landing Page — ML-74-01
// SEO-optimized, feature-complete, deploy-ready

const FEATURES = [
{ icon: '🌍', title: i18n.t('LandingPageV18.k1'), desc: i18n.t('LandingPageV18.k2'), highlight: i18n.t('LandingPageV18.k3') },
{ icon: '📊', title: i18n.t('LandingPageV18.k4'), desc: i18n.t('LandingPageV18.k5'), highlight: i18n.t('LandingPageV18.k6') },
{ icon: '📋', title: i18n.t('LandingPageV18.k7'), desc: i18n.t('LandingPageV18.k8'), highlight: i18n.t('LandingPageV18.k9') },
{ icon: '🤖', title: i18n.t('LandingPageV18.k10'), desc: i18n.t('LandingPageV18.k11'), highlight: 'useMock=false' },
{ icon: '📈', title: i18n.t('LandingPageV18.k12'), desc: i18n.t('LandingPageV18.k13'), highlight: i18n.t('LandingPageV18.k14') },
{ icon: '📐', title: i18n.t('LandingPageV18.k15'), desc: i18n.t('LandingPageV18.k16'), highlight: i18n.t('LandingPageV18.k17') },
{ icon: '💬', title: 'components.strategyCommunity', desc: i18n.t('LandingPageV18.k18'), highlight: i18n.t('LandingPageV18.k19') },
{ icon: '🎓', title: 'components.onboarding', desc: i18n.t('LandingPageV18.k20'), highlight: i18n.t('LandingPageV18.k21') },
{ icon: '🎨', title: i18n.t('LandingPageV18.k22'), desc: i18n.t('LandingPageV18.k23'), highlight: i18n.t('LandingPageV18.k24') },
{ icon: '🛡️', title: i18n.t('LandingPageV18.k25'), desc: i18n.t('LandingPageV18.k26'), highlight: i18n.t('LandingPageV18.k27') },
{ icon: '🔔', title: i18n.t('LandingPageV18.k28'), desc: i18n.t('LandingPageV18.k29'), highlight: i18n.t('LandingPageV18.k30') },
{ icon: '⚡', title: i18n.t('LandingPageV18.k31'), desc: i18n.t('LandingPageV18.k32'), highlight: i18n.t('LandingPageV18.k33') },
{ icon: '💰', title: i18n.t('LandingPageV18.v110_1') || 'USDT Wallet & P2P', desc: i18n.t('LandingPageV18.v110_2') || 'Built-in USDT wallet with P2P transfer, 14-day freeze, and dispute resolution. Multi-chain support (TRC20/ERC20/BEP20).', highlight: 'v1.10.0' },
{ icon: '🤝', title: i18n.t('LandingPageV18.v110_3') || 'P2P Marketplace', desc: i18n.t('LandingPageV18.v110_4') || 'Peer-to-peer USDT trading with 0.3% fee, escrow protection, and 4-option dispute arbitration.', highlight: 'v1.10.0' },
{ icon: '🔐', title: i18n.t('LandingPageV18.v110_5') || '2FA Security', desc: i18n.t('LandingPageV18.v110_6') || 'TOTP-based 2FA (Google Authenticator) with 8 backup codes. Required for login and withdrawals.', highlight: 'v1.10.0' },
{ icon: '📚', title: i18n.t('LandingPageV18.v110_7') || 'Storybook UI Docs', desc: i18n.t('LandingPageV18.v110_8') || '15 interactive component stories with props docs, dark/light theme toggle, and live previews.', highlight: 'v1.10.0' }];


const TESTIMONIALS = [
{ name: i18n.t('LandingPageV18.k34'), role: i18n.t('LandingPageV18.k35'), quote: i18n.t('LandingPageV18.k36') },
{ name: i18n.t('LandingPageV18.k37'), role: i18n.t('LandingPageV18.k38'), quote: i18n.t('LandingPageV18.k39') },
{ name: i18n.t('LandingPageV18.k40'), role: i18n.t('LandingPageV18.k41'), quote: i18n.t('LandingPageV18.k42') }];


const PRICING_TIERS = [
{ name: 'Free', price: '0', period: i18n.t('LandingPageV18.k43'), features: [i18n.t('LandingPageV18.k44'), i18n.t('LandingPageV18.k45'), i18n.t('LandingPageV18.k46'), i18n.t('LandingPageV18.k47'), i18n.t('LandingPageV18.k48')], cta: i18n.t('LandingPageV18.k49'), color: '#6B7280' },
{ name: 'Pro', price: '29', period: i18n.t('LandingPageV18.k50'), features: [i18n.t('LandingPageV18.k51'), i18n.t('LandingPageV18.k52'), i18n.t('LandingPageV18.k53'), i18n.t('LandingPageV18.k54'), 'components.strategyCommunity', i18n.t('LandingPageV18.k55'), 'components.darkMode'], cta: i18n.t('LandingPageV18.k56'), color: '#6366F1', popular: true },
{ name: 'Enterprise', price: '99', period: i18n.t('LandingPageV18.k57'), features: [i18n.t('LandingPageV18.k58'), i18n.t('LandingPageV18.k59'), 'components.dailyDigest', i18n.t('LandingPageV18.k60'), i18n.t('LandingPageV18.k61'), i18n.t('LandingPageV18.k62'), i18n.t('LandingPageV18.k63')], cta: i18n.t('LandingPageV18.k64'), color: '#D4A853' }];


// ── Sub-components ──
function NavBar() {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#0A0A10dd', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1F2937', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>🐋</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#F9FAFB', letterSpacing: -0.5 }}>Dawn Whales</span>
        <span style={{ padding: '2px 8px', borderRadius: 6, background: '#6366F122', color: '#818CF8', fontSize: 11, fontWeight: 700 }}>v1.10.0</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[i18n.t('LandingPageV18.k65'), i18n.t('LandingPageV18.k66'), i18n.t('LandingPageV18.k67'), i18n.t('LandingPageV18.k68')].map((l) =>
        <a key={l} href={`#${l}`} style={{ padding: '6px 12px', borderRadius: 6, color: '#9CA3AF', fontSize: 13, textDecoration: 'none' }}>{l}</a>
        )}
        <button style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366F1', color: '#FFF', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{i18n.t("LandingPageV18.r92_4d40")}

        </button>
      </div>
    </nav>);

}

function HeroSection() {
  return (
    <section style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: '#6366F112', border: '1px solid #6366F133', marginBottom: 24, fontSize: 13, color: '#A5B4FC' }}>{i18n.t("LandingPageV18.r92_d5b6")}

      </div>
      <h1 style={{ fontSize: 48, fontWeight: 900, color: '#F9FAFB', lineHeight: 1.15, margin: '0 0 16px' }}>{i18n.t("LandingPageV18.r92_0c37")}
        <br /><span style={{ background: 'linear-gradient(135deg, #818CF8, #D4A853)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{i18n.t('LandingPageV18.k69')}</span>
      </h1>
      <p style={{ fontSize: 18, color: '#9CA3AF', lineHeight: 1.7, maxWidth: 600, margin: '0 auto 32px' }}>{i18n.t("LandingPageV18.r92_8937")}

      </p>
      
      {/* Stats */}
      <div style={{ display: 'flex', gap: 32, justifyContent: 'center', marginBottom: 36 }}>
        {[{ n: '7', l: 'components.markets' }, { n: '30+', l: 'components.factor' }, { n: '22', l: i18n.t('LandingPageV18.k70') }, { n: i18n.t('LandingPageV18.k71'), l: 'components.onboarding' }, { n: '8', l: 'components.language' }, { n: '5144', l: 'components.tests' }, { n: '15', l: 'components.storybook' }].map((s) =>
        <div key={s.l}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#D4A853' }}>{s.n}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{s.l}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button style={{ padding: '14px 36px', borderRadius: 12, border: 'none', background: '#6366F1', color: '#FFF', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>{i18n.t("LandingPageV18.r92_7dba")}

        </button>
        <button style={{ padding: '14px 36px', borderRadius: 12, border: '1px solid #374151', background: '#1F2937', color: '#D1D5DB', fontSize: 16, cursor: 'pointer' }}>{i18n.t("LandingPageV18.r92_0ab0")}

        </button>
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: '#6B7280' }}>{i18n.t('LandingPageV18.k72')}</div>
    </section>);

}

function FeatureGrid() {
  return (
    <section id={i18n.t("LandingPageV18.r92_63b6")} style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#F9FAFB', margin: '0 0 8px' }}>{i18n.t('LandingPageV18.k73')}</h2>
        <p style={{ fontSize: 15, color: '#9CA3AF' }}>{i18n.t('LandingPageV18.k74')}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {FEATURES.map((f) =>
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
        )}
      </div>
    </section>);

}

function PricingSection() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id={i18n.t("LandingPageV18.r92_dbd9")} style={{ padding: '60px 24px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#F9FAFB', margin: '0 0 8px' }}>{i18n.t('LandingPageV18.k75')}</h2>
        <div style={{ display: 'inline-flex', gap: 2, background: '#1F2937', borderRadius: 10, padding: 3, marginTop: 12 }}>
          <button onClick={() => setYearly(false)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: yearly ? 'transparent' : '#6366F1', color: yearly ? '#9CA3AF' : '#FFF', fontSize: 13, cursor: 'pointer' }}>{i18n.t('LandingPageV18.k76')}</button>
          <button onClick={() => setYearly(true)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: yearly ? '#6366F1' : 'transparent', color: yearly ? '#FFF' : '#9CA3AF', fontSize: 13, cursor: 'pointer' }}>{i18n.t('LandingPageV18.k77')}<span style={{ color: '#34D399' }}>-20%</span></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, alignItems: 'start' }}>
        {PRICING_TIERS.map((t) =>
        <div key={t.name} style={{
          padding: '28px 24px', borderRadius: 16, background: t.popular ? '#6366F10A' : '#111827',
          border: t.popular ? '2px solid #6366F1' : '1px solid #1F2937',
          position: 'relative'
        }}>
            {t.popular &&
          <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '3px 14px', borderRadius: 8, background: '#6366F1', color: '#FFF', fontSize: 11, fontWeight: 700 }}>{i18n.t('LandingPageV18.k78')}</div>
          }
            <div style={{ fontSize: 18, fontWeight: 700, color: t.color, marginBottom: 8 }}>{t.name}</div>
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#F9FAFB' }}>${yearly ? Math.round(Number(t.price) * 0.8) : t.price}</span>
              <span style={{ fontSize: 14, color: '#6B7280' }}>{t.period}</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {t.features.map((f) =>
            <li key={f} style={{ fontSize: 13, color: '#D1D5DB', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#10B981' }}>✓</span> {f}
                </li>
            )}
            </ul>
            <button style={{
            width: '100%', padding: '12px', borderRadius: 10, border: t.popular ? 'none' : '1px solid #374151',
            background: t.popular ? '#6366F1' : 'transparent',
            color: t.popular ? '#FFF' : '#D1D5DB', fontSize: 14, fontWeight: 700, cursor: 'pointer'
          }}>
              {t.cta}
            </button>
          </div>
        )}
      </div>
    </section>);

}

function TestimonialsSection() {
  return (
    <section style={{ padding: '60px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#F9FAFB', margin: 0 }}>{i18n.t('LandingPageV18.k79')}</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {TESTIMONIALS.map((t) =>
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
        )}
      </div>
    </section>);

}

function CTASection() {
  return (
    <section style={{ padding: '60px 24px', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ padding: '48px 32px', borderRadius: 20, background: 'linear-gradient(135deg, #6366F118, #D4A85314)', border: '1px solid #374151' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#F9FAFB', margin: '0 0 12px' }}>{i18n.t('LandingPageV18.k80')}</h2>
        <p style={{ fontSize: 15, color: '#9CA3AF', marginBottom: 28, lineHeight: 1.7 }}>{i18n.t("LandingPageV18.r92_17e7")}

        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{ padding: '14px 36px', borderRadius: 12, border: 'none', background: '#6366F1', color: '#FFF', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>{i18n.t("LandingPageV18.r92_0ac1")}

          </button>
          <button style={{ padding: '14px 36px', borderRadius: 12, border: '1px solid #374151', background: '#1F2937', color: '#D1D5DB', fontSize: 16, cursor: 'pointer' }}>{i18n.t("LandingPageV18.r92_a224")}

          </button>
        </div>
      </div>
    </section>);

}

function DownloadSection() {
  return (
    <section id="download" style={{ padding: '60px 24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ padding: '40px 32px', borderRadius: 20, background: '#111827', border: '1px solid #1F2937', textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#F9FAFB', margin: '0 0 8px' }}>{i18n.t('LandingPageV18.v110_download')}</h2>
        <p style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 24 }}>{i18n.t('LandingPageV18.v110_release')}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
          <a href="https://github.com/nicnoc/dawn-whales/releases/tag/v1.10.0" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12, background: '#6366F1', color: '#FFF', fontSize: 16, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' }}>
            <span>📦</span> {i18n.t('LandingPageV18.v110_download')}
          </a>
          <a href="https://github.com/nicnoc/dawn-whales/blob/master/CHANGELOG.md" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12, border: '1px solid #374151', background: '#1F2937', color: '#D1D5DB', fontSize: 16, textDecoration: 'none', cursor: 'pointer' }}>
            <span>📋</span> {i18n.t('LandingPageV18.v110_changelog')}
          </a>
        </div>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', fontSize: 12, color: '#6B7280' }}>
          <span>🪟 {i18n.t('LandingPageV18.v110_win')}</span>
          <span>📐 SHA256 verified</span>
          <span>🔓 Open Source (MIT)</span>
          <span>📦 ~85MB installer</span>
        </div>
        <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 10, background: '#0F1117', border: '1px solid #1F2937', textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#D4A853', marginBottom: 8 }}>✨ v1.10.0 Highlights</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 16px', fontSize: 12, color: '#9CA3AF' }}>
            <span>✅ USDT Wallet + P2P Marketplace</span>
            <span>✅ 2FA (TOTP) Security</span>
            <span>✅ 8-language i18n (996 CJK)</span>
            <span>✅ Storybook 15 components</span>
            <span>✅ AI Assistant Panel</span>
            <span>✅ Loading/Error/Empty states</span>
            <span>✅ 5144 tests / 0 fail</span>
            <span>✅ EngineError 61.3% coverage</span>
          </div>
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
          <span style={{ color: '#D1D5DB', fontWeight: 600 }}>Dawn Whales</span> v1.10.0
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <span>© 2026 Dawn Whales</span>
          <span>{i18n.t('LandingPageV18.k81')}</span>
          <span>{i18n.t('LandingPageV18.k82')}</span>
          <span>{i18n.t('LandingPageV18.k83')}</span>
        </div>
      </div>
    </footer>);

}

// ── SEO Head Component ──
function SEOHead() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Dawn Whales',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Windows, macOS, Linux',
    description: i18n.t('LandingPageV18.k84'),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    }
  };

  return (
    <>
      <title>{i18n.t('LandingPageV18.k85')}</title>
      <meta name="description" content={i18n.t('LandingPageV18.k86')} />
      <meta name="keywords" content={i18n.t('LandingPageV18.k87')} />
      <meta property="og:title" content={i18n.t('LandingPageV18.k88')} />
      <meta property="og:description" content={i18n.t('LandingPageV18.k89')} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={i18n.t('LandingPageV18.k90')} />
      <link rel="canonical" href="https://dawnwhales.com" />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </>);

}

// ── Main ──
export default function LandingPageV18() {
  const { t: _t } = useTranslation();
  const theme: CSSProperties = {
    background: '#0A0A10', color: '#E5E7EB',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
    minHeight: '100vh'
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
      <DownloadSection />
      <Footer />
    </div>);

}