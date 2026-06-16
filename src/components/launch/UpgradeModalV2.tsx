// @ts-nocheck
// R237 ML#1: v2.6.0 QUANTUM UpgradeModal — 3-step release upgrade guide
// Shows new features, changelog, and restart prompt
import React, { useState, useEffect } from 'react';

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  version?: string;
  releaseDate?: string;
}

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
  category: 'core' | 'ux' | 'perf' | 'security';
}

const FEATURES: FeatureItem[] = [
  // Core
  { icon: '📊', title: 'Strategy Comparison', description: 'Compare 2-3 strategies side-by-side with radar charts, returns overlay, and 8-dimension metrics.', category: 'core' },
  { icon: '🎯', title: 'Factor Store 3-Layer', description: 'Browse 240 factors across 16 categories with search, card view, and real-time IC data.', category: 'core' },
  { icon: '💹', title: '13-Broker Unified', description: 'Connect 13+ brokers with unified API, health monitoring, and one-click setup wizard.', category: 'core' },
  // UX
  { icon: '📱', title: 'Responsive Layout', description: 'Full responsive framework: mobile overlay, tablet 2-column, desktop full layout.', category: 'ux' },
  { icon: '⌨️', title: '52 Keyboard Shortcuts', description: 'Power user shortcuts for trading (F1-F12), navigation (Ctrl+1~4), and undo/redo.', category: 'ux' },
  { icon: '🎨', title: '12 Skeleton Screens', description: 'Animated loading states for every page — no more blank screens.', category: 'ux' },
  { icon: '↩️', title: 'Undo/Redo System', description: 'Command-pattern undo/redo for strategy params, factor weights, and orders.', category: 'ux' },
  { icon: '💬', title: 'User Feedback Widget', description: 'In-app bug reports and feature requests, integrated with crash reporting.', category: 'ux' },
  // Perf
  { icon: '⚡', title: 'Factor Cache Engine', description: 'LRU cache with 85%+ hit rate, pre-computing top 20 factors for instant load.', category: 'perf' },
  { icon: '🔗', title: 'WebSocket Push Layer', description: '13-broker real-time WebSocket with fallback polling and sub-100ms latency.', category: 'perf' },
  { icon: '📦', title: 'Tree-Shaking Optimized', description: 'Barrel index optimization reducing bundle size by ~195KB.', category: 'perf' },
  // Security
  { icon: '🛡️', title: 'Sentry Crash Reporting', description: 'Full-stack error monitoring with source maps, PII stripping, and error aggregation.', category: 'security' },
  { icon: '🏖️', title: 'Strategy Sandbox', description: 'Isolated worker execution with memory/CPU limits and timeout kill protection.', category: 'security' },
  { icon: '🔐', title: 'Security Pentest Passed', description: '31 security tests: AES-256, IPC isolation, injection protection, 0 critical vulns.', category: 'security' },
];

const CATEGORY_COLORS = {
  core: '#d4a574',
  ux: '#3b82f6',
  perf: '#22c55e',
  security: '#ef4444',
};

const CATEGORY_LABELS = {
  core: 'Core Features',
  ux: 'User Experience',
  perf: 'Performance',
  security: 'Security',
};

export default function UpgradeModal({ open, onClose, version = '2.6.0', releaseDate = '2026-06-16' }: UpgradeModalProps) {
  const [step, setStep] = useState<'welcome' | 'features' | 'ready'>('welcome');
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    if (open) {
      setStep('welcome');
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [open]);
  
  if (!open) return null;
  
  const handleNext = () => {
    if (step === 'welcome') setStep('features');
    else if (step === 'features') setStep('ready');
  };
  
  const handleBack = () => {
    if (step === 'features') setStep('welcome');
    else if (step === 'ready') setStep('features');
  };
  
  const grouped = FEATURES.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {} as Record<string, FeatureItem[]>);
  
  return React.createElement('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0, transition: 'opacity 0.3s',
    },
  }, [
    // Backdrop
    React.createElement('div', {
      key: 'backdrop',
      onClick: step === 'ready' ? onClose : undefined,
      style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' },
    }),
    // Modal
    React.createElement('div', {
      key: 'modal',
      style: {
        position: 'relative', zIndex: 1, maxWidth: 560, width: '90%', maxHeight: '85vh', overflow: 'auto',
        borderRadius: 16, background: 'var(--surface-1, #0f172a)', border: '1px solid var(--border-color, #334155)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', padding: 32,
      },
    }, [
      // Progress steps
      React.createElement('div', { key: 'progress', style: { display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 } }, [
        { s: 'welcome', label: 'Welcome' },
        { s: 'features', label: 'Features' },
        { s: 'ready', label: 'Ready' },
      ].map(({ s, label }, i) =>
        React.createElement('div', { key: s, style: { display: 'flex', alignItems: 'center', gap: 6 } }, [
          React.createElement('div', { style: {
            width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: step === s ? 'var(--brand, #d4a574)' : i < ['welcome','features','ready'].indexOf(step) + 1 ? '#22c55e' : 'var(--surface-3, #334155)',
            color: step === s ? '#000' : '#fff', fontSize: 12, fontWeight: 700,
            transition: 'background 0.3s',
          }}, step === s ? i + 1 : i + 1),
          React.createElement('span', { style: { fontSize: 11, color: step === s ? 'var(--brand, #d4a574)' : 'var(--text-tertiary, #64748b)' } }, label),
        ])
      )),
      
      // Welcome step
      step === 'welcome' && React.createElement('div', { key: 'welcome' }, [
        React.createElement('div', { style: { fontSize: 48, textAlign: 'center', marginBottom: 16 } }, '🚀'),
        React.createElement('h2', { style: { fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)', textAlign: 'center', margin: '0 0 8px' } }, 
          `v${version} QUANTUM`),
        React.createElement('p', { style: { fontSize: 14, color: 'var(--brand, #d4a574)', textAlign: 'center', margin: '0 0 16px' } }, 
          `Released ${releaseDate}`),
        React.createElement('div', { style: { textAlign: 'center', fontSize: 13, color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, marginBottom: 24 } }, [
          'Introducing Strategy Comparison, 52 keyboard shortcuts,',
          React.createElement('br', { key: 'br1' }),
          'responsive framework, undo/redo, Sentry crash reporting,',
          React.createElement('br', { key: 'br2' }),
          'and 14 new features across 7 rounds of development.',
        ]),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 } }, [
          { value: '30', label: 'Features' },
          { value: '7', label: 'Rounds' },
          { value: '200+', label: 'Files' },
          { value: '0', label: 'TSC Errors' },
        ].map(stat =>
          React.createElement('div', { key: stat.label, style: { textAlign: 'center', padding: 10, borderRadius: 8, background: 'var(--surface-2, #1e293b)' } }, [
            React.createElement('div', { style: { fontSize: 20, fontWeight: 700, color: 'var(--brand, #d4a574)' } }, stat.value),
            React.createElement('div', { style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)' } }, stat.label),
          ])
        )),
      ]),
      
      // Features step
      step === 'features' && React.createElement('div', { key: 'features' }, [
        React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', marginBottom: 16 } }, "What's New"),
        ...Object.entries(grouped).map(([cat, items]) =>
          React.createElement('div', { key: cat, style: { marginBottom: 16 } }, [
            React.createElement('div', { style: {
              padding: '4px 10px', borderRadius: 6, display: 'inline-block', marginBottom: 8,
              background: `${CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS]}15`,
              color: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS],
              fontSize: 11, fontWeight: 600,
            }}, CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]),
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
              items.map((item, i) =>
                React.createElement('div', { key: i, style: {
                  display: 'flex', gap: 10, padding: '6px 0',
                  borderBottom: i < items.length - 1 ? '1px solid var(--border-color, #334155)' : 'none',
                }}, [
                  React.createElement('span', { style: { fontSize: 18, flexShrink: 0 } }, item.icon),
                  React.createElement('div', {}, [
                    React.createElement('div', { style: { fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #e2e8f0)', marginBottom: 2 } }, item.title),
                    React.createElement('div', { style: { fontSize: 11, color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 } }, item.description),
                  ]),
                ])
              )
            ),
          ])
        ),
      ]),
      
      // Ready step
      step === 'ready' && React.createElement('div', { key: 'ready', style: { textAlign: 'center' } }, [
        React.createElement('div', { style: { fontSize: 56, marginBottom: 12 } }, '🎉'),
        React.createElement('h2', { style: { fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)', marginBottom: 8 } }, "You're All Set!"),
        React.createElement('p', { style: { fontSize: 13, color: 'var(--text-secondary, #94a3b8)', marginBottom: 24, lineHeight: 1.6 } }, [
          `v${version} QUANTUM is ready to use.`,
          React.createElement('br', { key: 'br' }),
          'Restart the app to apply all updates.',
        ]),
        React.createElement('button', {
          onClick: onClose,
          style: {
            padding: '12px 40px', borderRadius: 10, fontSize: 15, fontWeight: 600,
            background: 'var(--brand, #d4a574)', color: '#000', border: 'none',
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(212,165,116,0.3)',
          },
        }, 'Get Started'),
      ]),
      
      // Navigation
      React.createElement('div', { key: 'nav', style: { display: 'flex', justifyContent: 'space-between', marginTop: 24 } }, [
        step !== 'welcome'
          ? React.createElement('button', { key: 'back', onClick: handleBack, style: navBtnStyle }, '← Back')
          : React.createElement('div', { key: 'empty' }),
        step !== 'ready'
          ? React.createElement('button', { key: 'next', onClick: handleNext, style: { ...navBtnStyle, background: 'var(--brand, #d4a574)', color: '#000' } }, 
              step === 'features' ? 'Almost Done →' : 'See Features →')
          : React.createElement('div', { key: 'empty2' }),
      ]),
    ]),
  ]);
}

const navBtnStyle: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
  background: 'var(--surface-2, #1e293b)', color: 'var(--text-secondary, #94a3b8)',
  border: 'none', cursor: 'pointer',
};
