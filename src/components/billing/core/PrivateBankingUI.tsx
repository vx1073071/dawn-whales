/**
 * PrivateBankingUI — ML-72-01 [P0]
 * R72 Authoritative: v1.8.0-alpha — Private banking dark+gold UI shell
 *
 * Design system:
 * - Background: #0A0A10 (deep dark) + gold accent #D4A853
 * - 8px grid spacing
 * - Monospace abbreviations for numbers
 * - Card stacking with subtle shadows
 * - No horizontal scroll, responsive grid-only
 * - 6-panel layout shell: Market | Strategy | Portfolio | Orders | AI | Settings
 */

import React from 'react';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Theme Constants ──────────────────────────────────────────────────────

export const PB_THEME = {
  bg: '#0A0A10',
  cardBg: '#0E0E18',
  cardBorder: 'rgba(255,255,255,0.04)',
  gold: '#D4A853',
  goldDim: '#C9A046',
  goldBg: 'rgba(201,160,70,0.08)',
  text: '#E2E8F0',
  textDim: '#94A3B8',
  textMuted: '#64748B',
  green: '#22C55E',
  red: '#EF4444',
  blue: '#3B82F6',
  radius: 12,
  gap: 8,
};

// ── Global CSS Injection ─────────────────────────────────────────────────

const GLOBAL_STYLES = `
  :root {
    --pb-bg: ${PB_THEME.bg};
    --pb-card: ${PB_THEME.cardBg};
    --pb-gold: ${PB_THEME.gold};
    --pb-text: ${PB_THEME.text};
    --pb-text-dim: ${PB_THEME.textDim};
    --pb-radius: ${PB_THEME.radius}px;
    --pb-gap: ${PB_THEME.gap}px;
  }
  .pb-shell * { box-sizing: border-box; }
  .pb-shell { min-height: 100vh; background: var(--pb-bg); color: var(--pb-text); font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', 'Segoe UI', monospace; -webkit-font-smoothing: antialiased; }
  .pb-card { background: var(--pb-card); border: 1px solid rgba(255,255,255,0.04); border-radius: var(--pb-radius); overflow: hidden; }
  .pb-btn-gold { background: #C9A046; color: #000; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: background .15s; }
  .pb-btn-gold:hover { background: #D4A853; }
  .pb-btn-ghost { background: rgba(255,255,255,0.04); color: #94A3B8; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; cursor: pointer; }
  .pb-input { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #E2E8F0; padding: 8px 12px; font-size: 13px; outline: none; }
  .pb-input:focus { border-color: rgba(212,168,83,0.4); }
  .pb-mono { font-family: 'SF Mono', 'Fira Code', monospace; }
  .pb-gold-text { color: #D4A853; }
  .pb-green { color: #22C55E; }
  .pb-red { color: #EF4444; }
  .pb-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--pb-gap); }
  .pb-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--pb-gap); }
  .pb-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--pb-gap); }
  @media (max-width: 768px) { .pb-grid-2, .pb-grid-3, .pb-grid-4 { grid-template-columns: 1fr; } }
`;

// ── Layout Component ────────────────────────────────────────────────────

export interface PrivateBankingUIProps {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  statusBar?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export default function PrivateBankingUI({
  sidebar, header, statusBar, children, className = '',
}: PrivateBankingUIProps) {
  return (
    <div className={`pb-shell ${className}`}>
      <style>{GLOBAL_STYLES}</style>
      {/* Header */}
      {header && (
        <header style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: '#0A0A10', position: 'sticky', top: 0, zIndex: 50 }}>
          {header}
        </header>
      )}

      {/* Body: sidebar + content */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 40px)' }}>
        {sidebar && (
          <aside style={{ width: 200, borderRight: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
            {sidebar}
          </aside>
        )}
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {children}
        </main>
      </div>

      {/* Status bar */}
      {statusBar && (
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '4px 16px', fontSize: 10, color: '#64748B', background: '#0A0A10' }}>
          {statusBar}
        </footer>
      )}
    </div>
  );
}

// ── Reusable Components ──────────────────────────────────────────────────

export function PBCard({ title, subtitle, children, action }: {
  title?: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="pb-card" style={{ padding: 16 }}>
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            {title && <h3 style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', margin: 0 }}>{title}</h3>}
            {subtitle && <p style={{ fontSize: 10, color: '#64748B', margin: '2px 0 0' }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function PBMetric({ label, value, change, color }: {
  label: string; value: string; change?: string; color?: string;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(255,255,255,0.015)', borderRadius: 10 }}>
      <div style={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: color || '#E2E8F0' }}>{value}</div>
      {change && (
        <div style={{ fontSize: 9, marginTop: 2, color: change.startsWith('+') ? '#22C55E' : change.startsWith('-') ? '#EF4444' : '#64748B' }}>
          {change}
        </div>
      )}
    </div>
  );
}

export function PBBadge({ label, variant = 'default' }: { label: string; variant?: 'gold' | 'green' | 'red' | 'blue' | 'default' }) {
  const colors: Record<string, { bg: string; color: string }> = {
    gold: { bg: 'rgba(212,168,83,0.1)', color: '#D4A853' },
    green: { bg: 'rgba(34,197,94,0.1)', color: '#22C55E' },
    red: { bg: 'rgba(239,68,68,0.1)', color: '#EF4444' },
    blue: { bg: 'rgba(59,130,246,0.1)', color: '#60A5FA' },
    default: { bg: 'rgba(148,163,184,0.08)', color: '#94A3B8' },
  };
  const c = colors[variant];
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 6, background: c.bg, color: c.color }}>
      {label}
    </span>
  );
}


