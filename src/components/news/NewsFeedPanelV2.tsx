// @ts-nocheck
// R238 ML#1: NewsFeedPanelV2 — Real-time news feed with market/symbol/sentiment filtering
// Infinite scroll, real-time refresh, severity badges, click-to-detail
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  market: 'US' | 'HK' | 'CN' | 'JP' | 'EU' | 'CRYPTO' | 'GLOBAL';
  symbols: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  severity: 'breaking' | 'high' | 'medium' | 'low';
  category: 'earnings' | 'macro' | 'policy' | 'company' | 'crypto' | 'commodity' | 'technical' | 'other';
}

export interface NewsFeedPanelV2Props {
  news: NewsItem[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  onItemClick?: (item: NewsItem) => void;
  hasMore?: boolean;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────
const MARKETS = [
  { key: 'all' as const, label: 'All', icon: '🌐' },
  { key: 'US' as const, label: 'US', icon: '🇺🇸' },
  { key: 'HK' as const, label: 'HK', icon: '🇭🇰' },
  { key: 'CN' as const, label: 'CN', icon: '🇨🇳' },
  { key: 'JP' as const, label: 'JP', icon: '🇯🇵' },
  { key: 'EU' as const, label: 'EU', icon: '🇪🇺' },
  { key: 'CRYPTO' as const, label: 'Crypto', icon: '₿' },
];

const SENTIMENTS = [
  { key: 'all' as const, label: 'All', color: '#94a3b8' },
  { key: 'positive' as const, label: '🟢 Bullish', color: '#22c55e' },
  { key: 'negative' as const, label: '🔴 Bearish', color: '#ef4444' },
  { key: 'neutral' as const, label: '⚪ Neutral', color: '#94a3b8' },
];

const SEVERITY_COLORS = {
  breaking: { bg: '#ef444420', border: '#ef4444', text: '#ef4444', label: 'BREAKING' },
  high:     { bg: '#f59e0b20', border: '#f59e0b', text: '#f59e0b', label: 'HIGH' },
  medium:   { bg: '#3b82f620', border: '#3b82f6', text: '#3b82f6', label: 'MEDIUM' },
  low:      { bg: '#94a3b820', border: '#94a3b8', text: '#94a3b8', label: 'LOW' },
};

const CATEGORY_ICONS: Record<string, string> = {
  earnings: '💰', macro: '🌍', policy: '🏛️', company: '🏢',
  crypto: '₿', commodity: '🛢️', technical: '📊', other: '📰',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Component ────────────────────────────────────────────────────────
export default function NewsFeedPanelV2({
  news, isLoading, onLoadMore, onRefresh, onItemClick, hasMore = false, className = '',
}: NewsFeedPanelV2Props) {
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  
  // Infinite scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onLoadMore || !hasMore) return;
    const handler = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        onLoadMore();
      }
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [onLoadMore, hasMore]);
  
  // Filter
  const filtered = useMemo(() => {
    return news.filter(item => {
      if (marketFilter !== 'all' && item.market !== marketFilter) return false;
      if (sentimentFilter !== 'all' && item.sentiment !== sentimentFilter) return false;
      if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(q) || 
               item.summary.toLowerCase().includes(q) ||
               item.symbols.some(s => s.toLowerCase().includes(q));
      }
      return true;
    });
  }, [news, marketFilter, sentimentFilter, severityFilter, searchQuery]);
  
  // Stats
  const stats = useMemo(() => ({
    breaking: news.filter(n => n.severity === 'breaking').length,
    positive: news.filter(n => n.sentiment === 'positive').length,
    negative: news.filter(n => n.sentiment === 'negative').length,
    total: news.length,
  }), [news]);
  
  return React.createElement('div', { className: `news-feed-v2 ${className}`, style: { display: 'flex', height: '100%' } }, [
    // Main feed
    React.createElement('div', { key: 'feed', style: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 } }, [
      // Header
      React.createElement('div', { key: 'header', style: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid var(--border-color, #334155)',
        flexWrap: 'wrap', gap: 8,
      }}, [
        React.createElement('div', { key: 'title', style: { display: 'flex', alignItems: 'center', gap: 8 } }, [
          React.createElement('span', { style: { fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' } }, '📰 News Feed'),
          React.createElement('span', { style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)' } }, `(${filtered.length}/${stats.total})`),
        ]),
        React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 6 } }, [
          React.createElement('input', {
            key: 'search', type: 'text', placeholder: '🔍 Search news...',
            value: searchQuery, onChange: (e: any) => setSearchQuery(e.target.value),
            style: {
              padding: '4px 10px', borderRadius: 6, width: 180, fontSize: 12,
              border: '1px solid var(--border-color, #334155)',
              background: 'var(--surface-2, #1e293b)', color: 'var(--text-primary, #e2e8f0)',
            },
          }),
          onRefresh && React.createElement('button', { key: 'refresh', onClick: onRefresh, style: iconBtnStyle }, '🔄'),
        ]),
      ]),
      
      // Quick stats
      React.createElement('div', { key: 'stats', style: {
        display: 'flex', gap: 12, padding: '6px 14px',
        borderBottom: '1px solid var(--border-color, #334155)',
        fontSize: 11, overflow: 'auto',
      }}, [
        React.createElement('span', { style: { color: '#ef4444', fontWeight: 600 } }, `🔴 Breaking: ${stats.breaking}`),
        React.createElement('span', { style: { color: '#22c55e', fontWeight: 600 } }, `🟢 Bullish: ${stats.positive}`),
        React.createElement('span', { style: { color: '#ef4444', fontWeight: 600 } }, `🔴 Bearish: ${stats.negative}`),
      ]),
      
      // Market filter
      React.createElement('div', { key: 'markets', style: {
        display: 'flex', gap: 4, padding: '6px 14px',
        borderBottom: '1px solid var(--border-color, #334155)',
        overflow: 'auto',
      }},
        MARKETS.map(m =>
          React.createElement('button', {
            key: m.key, onClick: () => setMarketFilter(m.key),
            style: {
              padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
              border: marketFilter === m.key ? '1px solid var(--brand, #d4a574)' : '1px solid transparent',
              background: marketFilter === m.key ? 'var(--brand-bg, rgba(212,165,116,0.15))' : 'transparent',
              color: marketFilter === m.key ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer', whiteSpace: 'nowrap',
            },
          }, `${m.icon} ${m.label}`)
        )
      ),
      
      // Sentiment + Severity filter row
      React.createElement('div', { key: 'filters', style: {
        display: 'flex', gap: 6, padding: '4px 14px',
        borderBottom: '1px solid var(--border-color, #334155)',
        overflow: 'auto', flexWrap: 'wrap',
      }}, [
        ...SENTIMENTS.map(s =>
          React.createElement('button', {
            key: s.key, onClick: () => setSentimentFilter(s.key),
            style: {
              padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 500,
              border: sentimentFilter === s.key ? `1px solid ${s.color}` : '1px solid transparent',
              background: sentimentFilter === s.key ? `${s.color}15` : 'transparent',
              color: sentimentFilter === s.key ? s.color : 'var(--text-tertiary, #64748b)',
              cursor: 'pointer', whiteSpace: 'nowrap',
            },
          }, s.label)
        ),
        React.createElement('div', { key: 'sep', style: { width: 1, background: 'var(--border-color, #334155)', margin: '2px 4px' } }),
        ...['all', 'breaking', 'high', 'medium', 'low'].map(sev =>
          React.createElement('button', {
            key: sev, onClick: () => setSeverityFilter(sev),
            style: {
              padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 500,
              border: severityFilter === sev ? `1px solid ${SEVERITY_COLORS[sev as keyof typeof SEVERITY_COLORS]?.border || '#94a3b8'}` : '1px solid transparent',
              background: severityFilter === sev ? `${SEVERITY_COLORS[sev as keyof typeof SEVERITY_COLORS]?.bg || '#94a3b820'}` : 'transparent',
              color: severityFilter === sev ? SEVERITY_COLORS[sev as keyof typeof SEVERITY_COLORS]?.text || '#94a3b8' : 'var(--text-tertiary, #64748b)',
              cursor: 'pointer', whiteSpace: 'nowrap',
            },
          }, sev === 'all' ? 'All' : SEVERITY_COLORS[sev as keyof typeof SEVERITY_COLORS]?.label || sev)
        ),
      ]),
      
      // News list (infinite scroll)
      React.createElement('div', { key: 'list', ref: scrollRef, style: { flex: 1, overflow: 'auto' } },
        isLoading && filtered.length === 0
          ? React.createElement('div', { style: { padding: 40, textAlign: 'center', color: 'var(--text-tertiary, #64748b)' } }, 'Loading news...')
          : filtered.length === 0
            ? React.createElement('div', { style: { padding: 40, textAlign: 'center', color: 'var(--text-tertiary, #64748b)' } }, 
                searchQuery ? 'No news match your search' : 'No news in this filter')
            : [
                ...filtered.map(item => {
                  const sev = SEVERITY_COLORS[item.severity];
                  return React.createElement('div', {
                    key: item.id,
                    onClick: () => { setSelectedItem(item); onItemClick?.(item); },
                    style: {
                      padding: '10px 14px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color, #334155)',
                      borderLeft: item.severity === 'breaking' ? `3px solid ${sev.border}` : '3px solid transparent',
                      background: selectedItem?.id === item.id ? 'var(--surface-2, #1e293b)' : 'transparent',
                      transition: 'background 0.15s',
                    },
                  }, [
                    // Severity badge + time
                    React.createElement('div', { key: 'meta', style: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 } }, [
                      item.severity !== 'low' && React.createElement('span', { style: {
                        padding: '0 6px', borderRadius: 3, fontSize: 9, fontWeight: 700,
                        background: sev.bg, color: sev.text, border: `1px solid ${sev.border}40`,
                      }}, sev.label),
                      React.createElement('span', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, timeAgo(item.publishedAt)),
                      React.createElement('span', { style: { fontSize: 10, color: item.sentiment === 'positive' ? '#22c55e' : item.sentiment === 'negative' ? '#ef4444' : '#94a3b8', fontWeight: 500 } },
                        item.sentiment === 'positive' ? '🟢' : item.sentiment === 'negative' ? '🔴' : '⚪'),
                      React.createElement('span', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, CATEGORY_ICONS[item.category] || '📰'),
                    ]),
                    // Title
                    React.createElement('div', { key: 'title', style: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', marginBottom: 4, lineHeight: 1.4 } }, item.title),
                    // Summary
                    React.createElement('div', { key: 'summary', style: { fontSize: 11, color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, item.summary),
                    // Symbols + source
                    React.createElement('div', { key: 'footer', style: { display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' } }, [
                      ...item.symbols.slice(0, 4).map(sym =>
                        React.createElement('span', { key: sym, style: {
                          padding: '1px 6px', borderRadius: 4, fontSize: 10,
                          background: 'var(--surface-2, #1e293b)', color: 'var(--brand, #d4a574)',
                          fontWeight: 500,
                        }}, sym)
                      ),
                      item.symbols.length > 4 && React.createElement('span', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, `+${item.symbols.length - 4}`),
                      React.createElement('span', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)', marginLeft: 'auto' } }, item.source),
                    ]),
                  ]);
                }),
                hasMore && React.createElement('div', { key: 'more', style: { padding: 16, textAlign: 'center' } },
                  React.createElement('button', {
                    onClick: onLoadMore,
                    style: {
                      padding: '6px 20px', borderRadius: 8, fontSize: 12,
                      background: 'var(--surface-2, #1e293b)', border: '1px solid var(--border-color, #334155)',
                      color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer',
                    },
                  }, 'Load More')
                ),
              ]
      ),
    ]),
    
    // Detail panel (selected item)
    selectedItem && React.createElement('div', { key: 'detail', style: {
      width: 340, flexShrink: 0, borderLeft: '1px solid var(--border-color, #334155)',
      display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 16,
    }}, [
      React.createElement('div', { key: 'close', style: { textAlign: 'right', marginBottom: 8 } },
        React.createElement('button', { onClick: () => setSelectedItem(null), style: { background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', fontSize: 16, cursor: 'pointer' } }, '✕')),
      React.createElement('h3', { key: 'title', style: { fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', marginBottom: 12, lineHeight: 1.5 } }, selectedItem.title),
      React.createElement('div', { key: 'meta', style: { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' } }, [
        React.createElement('span', { style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)' } }, `🕐 ${new Date(selectedItem.publishedAt).toLocaleString()}`),
        React.createElement('span', { style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)' } }, `📡 ${selectedItem.source}`),
        React.createElement('span', { style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)' } }, `${MARKETS.find(m => m.key === selectedItem.market)?.icon} ${selectedItem.market}`),
      ]),
      React.createElement('p', { key: 'summary', style: { fontSize: 13, color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.7, marginBottom: 16 } }, selectedItem.summary),
      React.createElement('a', { key: 'link', href: selectedItem.url, target: '_blank', rel: 'noopener noreferrer', style: {
        padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, textAlign: 'center',
        background: 'var(--brand, #d4a574)', color: '#000', textDecoration: 'none', display: 'block',
      }}, 'Read Full Article →'),
    ]),
  ]);
}

const iconBtnStyle: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, fontSize: 13,
  background: 'var(--surface-2, #1e293b)', border: '1px solid var(--border-color, #334155)',
  color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer',
};
