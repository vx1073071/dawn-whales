// @ts-nocheck
// R239 ML#1: PriceAttributionBadge — Price movement attribution display
// Shows ▲/▼ arrows with 1-line reason + source link, severity colors
import React from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface AttributionItem {
  symbol: string;
  name: string;
  price: number;
  change: number;        // %
  changeAmount: number;  // absolute
  reason: string;
  source: string;
  sourceUrl?: string;
  severity: 'major' | 'significant' | 'minor';
  tags: string[];        // e.g., ['earnings', 'fed', 'geopolitical']
  timestamp: string;
}

export interface PriceAttributionBadgeProps {
  item: AttributionItem;
  variant?: 'inline' | 'card' | 'compact';
  onClick?: (item: AttributionItem) => void;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  major:       { color: '#ef4444', bg: '#ef444415', border: '#ef444440', label: 'Major Move' },
  significant: { color: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b40', label: 'Significant' },
  minor:       { color: '#3b82f6', bg: '#3b82f615', border: '#3b82f640', label: 'Minor' },
};

const TAG_ICONS: Record<string, string> = {
  earnings: '💰', fed: '🏦', geopolitical: '🌍', macro: '📊',
  sector: '🏢', technical: '📈', crypto: '₿', regulatory: '⚖️',
  commodity: '🛢️', fx: '💱', rumor: '💭', upgrade: '⬆️',
  downgrade: '⬇️', ipo: '🆕', merger: '🤝',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ── Component ────────────────────────────────────────────────────────
export default function PriceAttributionBadge({
  item, variant = 'card', onClick, className = '',
}: PriceAttributionBadgeProps) {
  const isUp = item.change >= 0;
  const sev = SEVERITY_CONFIG[item.severity];
  const arrow = isUp ? '▲' : '▼';
  const color = isUp ? '#22c55e' : '#ef4444';
  
  // Compact variant
  if (variant === 'compact') {
    return React.createElement('div', {
      onClick: () => onClick?.(item),
      className: `attribution-compact ${className}`,
      style: {
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 12, cursor: 'pointer',
        background: sev.bg, border: `1px solid ${sev.border}`,
        fontSize: 11, fontWeight: 500,
      },
    }, [
      React.createElement('span', { key: 'sym', style: { color: 'var(--text-primary, #e2e8f0)', fontWeight: 600 } }, item.symbol),
      React.createElement('span', { key: 'arrow', style: { color } }, `${arrow} ${Math.abs(item.change).toFixed(1)}%`),
      React.createElement('span', { key: 'reason', style: { color: 'var(--text-secondary, #94a3b8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 } }, item.reason),
    ]);
  }
  
  // Inline variant
  if (variant === 'inline') {
    return React.createElement('div', {
      onClick: () => onClick?.(item),
      className: `attribution-inline ${className}`,
      style: {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${sev.border}`, background: sev.bg,
      },
    }, [
      React.createElement('span', { key: 'sym', style: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' } }, item.symbol),
      React.createElement('span', { key: 'name', style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, item.name),
      React.createElement('span', { key: 'chg', style: { fontSize: 13, fontWeight: 700, color } }, `${arrow} ${Math.abs(item.change).toFixed(1)}%`),
      React.createElement('span', { key: 'amount', style: { fontSize: 11, color, fontWeight: 500 } }, `${isUp ? '+' : '-'}${Math.abs(item.changeAmount).toFixed(2)}`),
      React.createElement('span', { key: 'reason', style: { flex: 1, fontSize: 11, color: 'var(--text-secondary, #94a3b8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, item.reason),
      React.createElement('span', { key: 'time', style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, timeAgo(item.timestamp)),
    ]);
  }
  
  // Card variant (default)
  return React.createElement('div', {
    onClick: () => onClick?.(item),
    className: `attribution-card ${className}`,
    style: {
      padding: 14, borderRadius: 10, cursor: 'pointer',
      border: `1px solid ${sev.border}`, background: sev.bg,
      transition: 'transform 0.15s, box-shadow 0.15s',
    },
  }, [
    // Header: symbol + severity badge + time
    React.createElement('div', { key: 'header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } }, [
      React.createElement('div', { key: 'left', style: { display: 'flex', alignItems: 'center', gap: 8 } }, [
        React.createElement('span', { key: 'sym', style: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' } }, item.symbol),
        React.createElement('span', { key: 'name', style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)' } }, item.name),
        React.createElement('span', { key: 'sev', style: {
          padding: '1px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700,
          background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`,
        }}, sev.label),
      ]),
      React.createElement('span', { key: 'time', style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, timeAgo(item.timestamp)),
    ]),
    // Price line
    React.createElement('div', { key: 'price', style: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 } }, [
      React.createElement('span', { key: 'p', style: { fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' } }, item.price.toFixed(2)),
      React.createElement('span', { key: 'chg', style: { fontSize: 14, fontWeight: 700, color } }, `${arrow} ${Math.abs(item.change).toFixed(2)}%`),
      React.createElement('span', { key: 'amt', style: { fontSize: 12, color, fontWeight: 500 } }, `${isUp ? '+' : '-'}${Math.abs(item.changeAmount).toFixed(2)}`),
    ]),
    // Reason
    React.createElement('div', { key: 'reason', style: { fontSize: 12, color: 'var(--text-primary, #e2e8f0)', lineHeight: 1.5, marginBottom: 8, fontWeight: 500 } }, item.reason),
    // Source + tags
    React.createElement('div', { key: 'footer', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 } }, [
      React.createElement('div', { key: 'tags', style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
        item.tags.map(tag =>
          React.createElement('span', { key: tag, style: {
            padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 500,
            background: 'var(--surface-2, #1e293b)', color: 'var(--text-secondary, #94a3b8)',
          }}, `${TAG_ICONS[tag] || '📌'} ${tag}`)
        )
      ),
      item.sourceUrl
        ? React.createElement('a', { key: 'src', href: item.sourceUrl, target: '_blank', rel: 'noopener', onClick: (e: any) => e.stopPropagation(),
            style: { fontSize: 10, color: 'var(--brand, #d4a574)', textDecoration: 'none' } }, `📎 ${item.source}`)
        : React.createElement('span', { key: 'src', style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, `📡 ${item.source}`),
    ]),
  ]);
}

// ── AttributionList — Multiple attributions in a list ─────────────────
export interface AttributionListProps {
  items: AttributionItem[];
  onItemClick?: (item: AttributionItem) => void;
}

export function AttributionList({ items, onItemClick }: AttributionListProps) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
    items.map(item =>
      React.createElement(PriceAttributionBadge, { key: item.symbol + item.timestamp, item, variant: 'inline', onClick: onItemClick })
    )
  );
}
