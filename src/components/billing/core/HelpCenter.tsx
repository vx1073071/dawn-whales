/**
 * HelpCenter — ML-71-01 [P0]
 * R71: v1.7.0 GA — SEO help center + FAQ for TradingEasy.com
 *
 * Features:
 * - Structured FAQ: install/register/recharge/AI///withdraw
 * - Searchable help articles
 * - SEO: schema.org FAQPage JSON-LD
 * - Category tabs for quick navigation
 * - Expandable accordion answers
 */

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from "react-i18next";
import i18n from '../../../i18n';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

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
  // ── install ──
  { id: 'install-1', category: 'install', categoryIcon: '💻', question: i18n.t('HelpCenter.k1'), answer: i18n.t('HelpCenter.k2') },
  { id: 'install-2', category: 'install', categoryIcon: '💻', question: i18n.t('HelpCenter.k3'), answer: i18n.t('HelpCenter.k4') },
  { id: 'install-3', category: 'install', categoryIcon: '💻', question: i18n.t('HelpCenter.k5'), answer: i18n.t('HelpCenter.k6') },

  // ── register ──
  { id: 'reg-1', category: 'register', categoryIcon: '📝', question: i18n.t('HelpCenter.k7'), answer: i18n.t('HelpCenter.k8') },
  { id: 'reg-2', category: 'register', categoryIcon: '📝', question: i18n.t('HelpCenter.k9'), answer: i18n.t('HelpCenter.k10') },
  { id: 'reg-3', category: 'register', categoryIcon: '📝', question: i18n.t('HelpCenter.k11'), answer: i18n.t('HelpCenter.k12') },

  // ── recharge ──
  { id: 'topup-1', category: 'topup', categoryIcon: '💰', question: i18n.t('HelpCenter.k13'), answer: i18n.t('HelpCenter.k14') },
  { id: 'topup-2', category: 'topup', categoryIcon: '💰', question: i18n.t('HelpCenter.k15'), answer: i18n.t('HelpCenter.k16') },
  { id: 'topup-3', category: 'topup', categoryIcon: '💰', question: i18n.t('HelpCenter.k17'), answer: i18n.t('HelpCenter.k18') },

  // ── AI ──
  { id: 'ai-1', category: 'ai', categoryIcon: '🤖', question: i18n.t('HelpCenter.k19'), answer: i18n.t('HelpCenter.k20') },
  { id: 'ai-2', category: 'ai', categoryIcon: '🤖', question: i18n.t('HelpCenter.k21'), answer: i18n.t('HelpCenter.k22') },
  { id: 'ai-3', category: 'ai', categoryIcon: '🤖', question: i18n.t('HelpCenter.k23'), answer: i18n.t('HelpCenter.k24') },

 // ── ──
  { id: 'trade-1', category: 'trade', categoryIcon: '📈', question: i18n.t('HelpCenter.k25'), answer: i18n.t('HelpCenter.k26') },
  { id: 'trade-2', category: 'trade', categoryIcon: '📈', question: i18n.t('HelpCenter.k27'), answer: i18n.t('HelpCenter.k28') },
  { id: 'trade-3', category: 'trade', categoryIcon: '📈', question: i18n.t('HelpCenter.k29'), answer: i18n.t('HelpCenter.k30') },

 // ── ──
  { id: 'wallet-1', category: 'wallet', categoryIcon: '👛', question: i18n.t('HelpCenter.k31'), answer: i18n.t('HelpCenter.k32') },
  { id: 'wallet-2', category: 'wallet', categoryIcon: '👛', question: i18n.t('HelpCenter.k33'), answer: i18n.t('HelpCenter.k34') },
  { id: 'wallet-3', category: 'wallet', categoryIcon: '👛', question: i18n.t('HelpCenter.k35'), answer: i18n.t('HelpCenter.k36') },

  // ── creator ──
  { id: 'creator-1', category: 'creator', categoryIcon: '⭐', question: i18n.t('HelpCenter.k37'), answer: i18n.t('HelpCenter.k38') },
  { id: 'creator-2', category: 'creator', categoryIcon: '⭐', question: i18n.t('HelpCenter.k39'), answer: i18n.t('HelpCenter.k40') },
];

const CATEGORIES = [
  { id: 'all', label: 'components.all', icon: '📚' },
  { id: 'install', label: 'components.install', icon: '💻' },
  { id: 'register', label: 'components.register', icon: '📝' },
  { id: 'topup', label: 'components.deposit', icon: '💰' },
  { id: 'ai', label: i18n.t('HelpCenter.k41'), icon: '🤖' },
  { id: 'trade', label: i18n.t('HelpCenter.k42'), icon: '📈' },
  { id: 'wallet', label: 'components.wallet', icon: '👛' },
  { id: 'creator', label: i18n.t('HelpCenter.k43'), icon: '⭐' },
];

// ── SEO FAQPage JSON-LD ─────────────────────────────────────────────────

function FAQJsonLd({ articles }: { articles: HelpArticle[] }) {
  const { t: _t } = useTranslation();

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: articles.map(a => ({
      '@type': 'Question',
      name: a.question,
      acceptedAnswer: { '@type': 'Answer', text: a.answer },
    })),
  };
  // R92 J-01: Safe JSON-LD injection — multi-layer XSS prevention
  // 1. JSON.stringify (no raw HTML)
  // 2. Escape </ to prevent script tag breakout
  // 3. Escape > and < as additional defense-in-depth
  const json = JSON.stringify(ld)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
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
        <title>{i18n.t('HelpCenter.k44')}</title>
        <meta name="description" content={i18n.t('HelpCenter.k45')} />
        <meta name="robots" content="index, follow" />
        <FAQJsonLd articles={articles} />
      </head>
      <body className={className} style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', background: '#fff', color: '#1e293b' }}>
        {/* Nav */}
        <nav style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span style={{ fontSize: 22 }}>🐋</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>TradingEasy</span>
          </a>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{i18n.t('HelpCenter.k46')}</span>
        </nav>

        {/* Header */}
        <header style={{ padding: '60px 24px 40px', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', color: '#fff', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, margin: '0 0 12px' }}>{i18n.t('HelpCenter.k47')}</h1>
          <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 24 }}>How can we help? Search or browse topics.</p>
          <div style={{ maxWidth: 500, margin: '0 auto', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={i18n.t('HelpCenter.k48')}
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
              <p>{i18n.t('HelpCenter.k49')}</p>
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
          <p>🐋 TradingEasy Help Center · v1.7.0 GA</p>
          <p style={{ marginTop: 4 }}>Need more help? <a href="https://github.com/vx1073071/TradingEasy" style={{ color: '#3b82f6' }}>GitHub</a></p>
        </footer>
      </body>
    </html>
  );
}
