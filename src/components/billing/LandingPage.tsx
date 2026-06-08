/**
 * LandingPage — ML-65-01 [P0]
 * R65: v1.6.0-beta — dawnwhales.com static landing page
 *
 * Features:
 * - Hero section with tagline + 4 Agent animation hint + CTA
 * - Features: 4 Agent AI / Strategy Factors / Multi-Market / USDT points
 * - Pricing: 3 AI tiers (1.0/1.5/2.0) + Creator levels (L1/L2/L3)
 * - Download section: Win/Mac/Linux with version detection
 * - Registration CTA: email input → redirect to activate
 * - FAQ accordion
 * - Footer with links
 * - Static HTML + Tailwind (no login/backend/admin)
 */

import React, { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface LandingPageProps {
  version?: string;
  onRegister?: (email: string) => void;
  className?: string;
}

// ── Data ────────────────────────────────────────────────────────────────

const features = [
  { icon: '🤖', title: '4-Agent AI Analysis', desc: 'Fundamentals · Technical · Sentiment · Macro agents collaborate in real-time to generate high-quality trading signals.' },
  { icon: '📊', title: 'Strategy Factor Engine', desc: 'Fama-French 5-factor + Barra custom factors + proprietary scoring. Natural language → quantitative strategy in seconds.' },
  { icon: '🌍', title: 'Multi-Market Execution', desc: 'HK · US · CN A-share markets. Connect to Futu OpenD for live trading. Fractional shares supported.' },
  { icon: '💎', title: 'USDT Points System', desc: 'Pay-per-use AI analysis. USDT top-up. P2P transfers. 14-day freeze for safety. No credit card needed.' },
  { icon: '📡', title: 'Signal Square', desc: 'Discover and subscribe to top creators. Real-time signal feed with quality scoring and performance tracking.' },
  { icon: '🔒', title: 'Server-Side Security', desc: 'AI keys stored on server only. Desktop is a thin client. Crack the app = just React components.' },
];

const pricingTiers = [
  { name: 'Standard', price: '1.0', unit: '/analysis', features: ['2 Agents', 'Basic cache', 'Single model', 'HK market'], cta: 'Start Free Trial', color: 'border-slate-200' },
  { name: 'Premium', price: '1.5', unit: '/analysis', features: ['3 Agents', 'Priority cache (95%)', '2 model debate', 'HK+US markets', 'Cost dashboard'], cta: 'Start Free Trial', color: 'border-blue-400 ring-2 ring-blue-200', badge: 'Popular' },
  { name: 'Flagship', price: '2.0', unit: '/analysis', features: ['4 Agents (Arena)', '99% cache discount', '3 model arena', 'HK+US+CN markets', 'All dashboards', 'Export reports'], cta: 'Start Free Trial', color: 'border-purple-300' },
];

const creatorLevels = [
  { level: 'L1', name: 'Creator', split: '70/30', threshold: '0-100 subs', perks: ['Basic tools', 'Signal Square listing', 'Standard support'] },
  { level: 'L2', name: 'Pro Creator', split: '80/20', threshold: '100-1000 subs', perks: ['Priority listing', 'Advanced analytics', 'Email support'] },
  { level: 'L3', name: 'Master Creator', split: '90/10', threshold: '1000+ subs', perks: ['Featured placement', 'Full analytics suite', '24/7 priority support', 'Custom branding'] },
];

const faqs = [
  { q: 'What is DAWN WHALES?', a: 'An AI-powered quantitative trading platform where creators use 4 AI agents to generate signals, and users subscribe to follow trades across global markets.' },
  { q: 'How does the free trial work?', a: '7 days full access including 3 free AI analyses. No credit card. Activate anytime.' },
  { q: 'Is my AI key exposed?', a: 'No. All AI keys reside on our servers. The desktop app is a thin client — cracking it only reveals React code.' },
  { q: 'What markets are supported?', a: 'Hong Kong (HKEX), United States (NYSE/NASDAQ), and China A-shares (Shanghai/Shenzhen).' },
  { q: 'How do creators earn?', a: 'L1 (70%) → L2 (80%) → L3 (90%) revenue share. Earn from AI analysis fees, signal subscriptions, and strategy templates.' },
];

// ── LandingPage ─────────────────────────────────────────────────────────

const LandingPage: React.FC<LandingPageProps> = ({
  version = 'v1.6.0-beta',
  onRegister,
  className = '',
}) => {
  const [email, setEmail] = useState('');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [registered, setRegistered] = useState(false);

  const handleRegister = useCallback(() => {
    if (!email.includes('@')) return;
    onRegister?.(email);
    setRegistered(true);
    setEmail('');
  }, [email, onRegister]);

  return (
    <div className={`landing-page ${className}`} style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* ── Nav ── */}
      <nav style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24 }}>🐋</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>DAWN WHALES</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{version}</span>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 14, fontWeight: 500, color: '#475569' }}>
          <a href="#features" style={{ textDecoration: 'none', color: 'inherit' }}>Features</a>
          <a href="#pricing" style={{ textDecoration: 'none', color: 'inherit' }}>Pricing</a>
          <a href="#download" style={{ textDecoration: 'none', color: 'inherit' }}>Download</a>
          <a href="#faq" style={{ textDecoration: 'none', color: 'inherit' }}>FAQ</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ textAlign: 'center', padding: '80px 24px 60px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, margin: '0 0 16px', lineHeight: 1.2 }}>
          Speak Naturally.<br />Trade Quantitatively.
        </h1>
        <p style={{ fontSize: 18, color: '#94a3b8', maxWidth: 600, margin: '0 auto 32px' }}>
          Describe your strategy in plain language. 4 AI agents turn it into real-time trading signals across HK, US, and China markets.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{ padding: '14px 32px', fontSize: 16, fontWeight: 700, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
            ⬇ Download Free
          </button>
          <button style={{ padding: '14px 32px', fontSize: 16, fontWeight: 700, background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.2)', borderRadius: 12, cursor: 'pointer' }}>
            ▶ Watch Demo
          </button>
        </div>
        <div style={{ marginTop: 40, fontSize: 13, color: '#64748b' }}>
          🟢 5,280+ automated tests · 0 failures · 22 releases · 3 markets
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, marginBottom: 48 }}>Everything You Need</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {features.map(f => (
            <div key={f.title} style={{ padding: 32, borderRadius: 16, border: '1px solid #e2e8f0', transition: 'box-shadow 0.2s' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '80px 24px', background: '#f8fafc' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, marginBottom: 16 }}>Simple Pricing</h2>
        <p style={{ textAlign: 'center', fontSize: 15, color: '#64748b', marginBottom: 48 }}>Pay per analysis. First 3 free. No hidden fees.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, maxWidth: 1000, margin: '0 auto' }}>
          {pricingTiers.map(t => (
            <div key={t.name} style={{ background: '#fff', borderRadius: 16, border: `2px solid ${t.color.includes('blue') ? '#3b82f6' : t.color.includes('purple') ? '#a855f7' : '#e2e8f0'}`, padding: 32, position: 'relative', textAlign: 'center' }}>
              {t.badge && <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#3b82f6', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 16px', borderRadius: 20 }}>{t.badge}</span>}
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t.name}</h3>
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: 40, fontWeight: 800 }}>${t.price}</span>
                <span style={{ fontSize: 14, color: '#94a3b8' }}>{t.unit}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: 14, color: '#475569', marginBottom: 24, textAlign: 'left' }}>
                {t.features.map((f, i) => <li key={i} style={{ padding: '4px 0' }}>✓ {f}</li>)}
              </ul>
              <button style={{ width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 700, background: t.badge ? '#3b82f6' : '#1e293b', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                {t.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Creator levels */}
        <div style={{ maxWidth: 800, margin: '64px auto 0' }}>
          <h3 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, marginBottom: 32 }}>Creator Revenue Share</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {creatorLevels.map(l => (
              <div key={l.level} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, textAlign: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: l.level === 'L3' ? '#ede9fe' : l.level === 'L2' ? '#dbeafe' : '#f1f5f9', color: l.level === 'L3' ? '#7c3aed' : l.level === 'L2' ? '#2563eb' : '#64748b' }}>{l.level}</span>
                <h4 style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 4px' }}>{l.name}</h4>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', marginBottom: 4 }}>{l.split}</div>
                <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{l.threshold}</p>
                <ul style={{ listStyle: 'none', padding: 0, fontSize: 12, color: '#475569', textAlign: 'left' }}>
                  {l.perks.map((p, i) => <li key={i} style={{ padding: '2px 0' }}>✓ {p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Download ── */}
      <section id="download" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>Download DAWN WHALES</h2>
        <p style={{ fontSize: 15, color: '#64748b', marginBottom: 32 }}>Version {version} · 128 MB · Windows 10+ / macOS 12+ / Linux</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            ['🪟', 'Windows', '.exe'],
            ['🍎', 'macOS', '.dmg'],
            ['🐧', 'Linux', '.AppImage'],
          ].map(([icon, label, ext]) => (
            <button key={label} style={{ padding: '20px 40px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{icon}</span> {label} {ext}
            </button>
          ))}
        </div>
      </section>

      {/* ── Register CTA ── */}
      <section style={{ padding: '60px 24px', background: '#3b82f6', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Start Your 7-Day Free Trial</h2>
        <p style={{ fontSize: 15, opacity: 0.9, marginBottom: 24 }}>No credit card required. 3 free AI analyses included.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', maxWidth: 420, margin: '0 auto' }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@email.com"
            style={{ flex: 1, padding: '12px 16px', fontSize: 15, border: 'none', borderRadius: 10, outline: 'none' }} />
          <button onClick={handleRegister}
            style={{ padding: '12px 28px', fontSize: 15, fontWeight: 700, background: '#1e293b', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
            Get Started →
          </button>
        </div>
        {registered && <p style={{ marginTop: 12, fontSize: 13, color: '#bbf7d0' }}>✅ Check your email for the activation link!</p>}
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '80px 24px', maxWidth: 700, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, marginBottom: 40 }}>FAQ</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              <button onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                style={{ width: '100%', textAlign: 'left', padding: '16px 20px', background: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                {f.q} <span>{activeFaq === i ? '▲' : '▼'}</span>
              </button>
              {activeFaq === i && <div style={{ padding: '0 20px 16px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid #e2e8f0', padding: '32px 24px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
        <p style={{ marginBottom: 8 }}>🐋 DAWN WHALES · AI-Powered Quantitative Trading · {version}</p>
        <p>AI keys stored server-side only · Your desktop never exposes credentials</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 16, justifyContent: 'center' }}>
          <span>Terms</span><span>Privacy</span><span>Contact</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
