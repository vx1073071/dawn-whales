// @ts-nocheck
// R239 ML#2: DailyBriefingPanel — AI morning briefing panel
// 3 tabs: Portfolio/Positions/Watchlist/Market — summary cards + sentiment bars
import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface BriefingItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  sentiment: number;       // -100 to +100
  summary: string;
  keyPoints: string[];
  riskLevel: 'low' | 'medium' | 'high';
  newsCount: number;
}

export interface MarketBrief {
  market: string;
  index: string;
  indexChange: number;
  sentiment: number;
  topMovers: { symbol: string; change: number; reason: string }[];
  keyEvents: string[];
}

export interface DailyBriefing {
  date: string;
  generatedAt: string;
  portfolio: { summary: string; items: BriefingItem[]; totalChange: number };
  watchlist: { summary: string; items: BriefingItem[] };
  market: MarketBrief[];
}

export interface DailyBriefingPanelProps {
  briefing: DailyBriefing;
  isLoading?: boolean;
  onRefresh?: () => void;
  onItemClick?: (symbol: string) => void;
  className?: string;
}

// ── Sentiment Bar Component ──────────────────────────────────────────
function SentimentBar({ value, height = 6 }: { value: number; height?: number }) {
  const pct = Math.abs(value); // 0-100
  const isPositive = value >= 0;
  const color = isPositive ? '#22c55e' : '#ef4444';
  
  return React.createElement('div', { style: {
    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
  }}, [
    React.createElement('span', { key: 'neg', style: { fontSize: 10, color: '#ef4444', width: 28, textAlign: 'right' } }, 'Bear'),
    React.createElement('div', { key: 'bar', style: {
      flex: 1, height, borderRadius: height / 2, background: 'var(--surface-3, #334155)',
      overflow: 'hidden', display: 'flex',
    }}, [
      React.createElement('div', { key: 'neg-fill', style: {
        width: `${isPositive ? 0 : pct}%`, height: '100%',
        background: '#ef4444', transition: 'width 0.5s',
        borderTopLeftRadius: height / 2, borderBottomLeftRadius: height / 2,
      }}),
      React.createElement('div', { key: 'pos-fill', style: {
        width: `${isPositive ? pct : 0}%`, height: '100%',
        background: '#22c55e', transition: 'width 0.5s',
        borderTopRightRadius: height / 2, borderBottomRightRadius: height / 2,
        marginLeft: 'auto',
      }}),
    ]),
    React.createElement('span', { key: 'pos', style: { fontSize: 10, color: '#22c55e', width: 28 } }, 'Bull'),
  ]);
}

// ── Briefing Card ────────────────────────────────────────────────────
function BriefingCard({ item, onClick, compact }: { item: BriefingItem; onClick?: (s: string) => void; compact?: boolean }) {
  const isUp = item.change >= 0;
  const color = isUp ? '#22c55e' : '#ef4444';
  const riskColor = item.riskLevel === 'high' ? '#ef4444' : item.riskLevel === 'medium' ? '#f59e0b' : '#22c55e';
  
  return React.createElement('div', {
    onClick: () => onClick?.(item.symbol),
    style: {
      padding: compact ? '8px 10px' : '10px 12px', borderRadius: 8, cursor: 'pointer',
      border: '1px solid var(--border-color, #334155)',
      background: 'var(--surface-1, #0f172a)',
      transition: 'background 0.15s',
    },
  }, [
    // Header
    React.createElement('div', { key: 'header', style: { display: 'flex', justifyContent: 'space-between', marginBottom: compact ? 4 : 6 } }, [
      React.createElement('div', { key: 'left' }, [
        React.createElement('div', { style: { fontSize: compact ? 12 : 13, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' } }, item.symbol),
        React.createElement('div', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, item.name),
      ]),
      React.createElement('div', { key: 'right', style: { textAlign: 'right' } }, [
        React.createElement('div', { style: { fontSize: compact ? 13 : 15, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' } }, item.price.toFixed(2)),
        React.createElement('div', { style: { fontSize: compact ? 10 : 11, fontWeight: 600, color } }, `${isUp ? '▲' : '▼'} ${Math.abs(item.change).toFixed(1)}%`),
      ]),
    ]),
    // Sentiment
    React.createElement(SentimentBar, { key: 'sentiment', value: item.sentiment, height: compact ? 4 : 5 }),
    React.createElement('div', { key: 'sent-label', style: { fontSize: 9, color: 'var(--text-tertiary, #64748b)', marginTop: 2, display: 'flex', justifyContent: 'space-between' } }, [
      React.createElement('span', { key: 'risk', style: { color: riskColor, fontWeight: 600 } }, `Risk: ${item.riskLevel.toUpperCase()}`),
      React.createElement('span', { key: 'news' }, `📰 ${item.newsCount} news`),
    ]),
    // Summary
    React.createElement('div', { key: 'summary', style: { fontSize: compact ? 10 : 11, color: 'var(--text-secondary, #94a3b8)', marginTop: 6, lineHeight: 1.5 } }, item.summary),
    // Key points
    !compact && item.keyPoints.length > 0 && React.createElement('div', { key: 'points', style: { marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 } },
      item.keyPoints.slice(0, 3).map((p, i) =>
        React.createElement('div', { key: i, style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)', paddingLeft: 10 } }, `• ${p}`)
      )
    ),
  ]);
}

// ── Market Brief Card ────────────────────────────────────────────────
function MarketCard({ brief }: { brief: MarketBrief }) {
  const isUp = brief.indexChange >= 0;
  const color = isUp ? '#22c55e' : '#ef4444';
  
  return React.createElement('div', { style: {
    padding: 12, borderRadius: 8, border: '1px solid var(--border-color, #334155)',
    background: 'var(--surface-1, #0f172a)',
  }}, [
    React.createElement('div', { key: 'header', style: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 } }, [
      React.createElement('div', { key: 'name', style: { fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', fontSize: 13 } }, brief.market),
      React.createElement('div', { key: 'idx', style: { textAlign: 'right' } }, [
        React.createElement('div', { style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)' } }, brief.index),
        React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color } }, `${isUp ? '▲' : '▼'} ${Math.abs(brief.indexChange).toFixed(2)}%`),
      ]),
    ]),
    React.createElement(SentimentBar, { key: 'sentiment', value: brief.sentiment }),
    // Top movers
    React.createElement('div', { key: 'movers', style: { marginTop: 8, fontSize: 11 } }, [
      React.createElement('div', { style: { fontWeight: 500, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 } }, 'Top Movers'),
      ...brief.topMovers.map((m, i) =>
        React.createElement('div', { key: i, style: { display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: i < brief.topMovers.length - 1 ? '1px solid var(--border-color, #334155)' : 'none' } }, [
          React.createElement('span', { style: { fontWeight: 500, color: 'var(--text-primary, #e2e8f0)' } }, m.symbol),
          React.createElement('span', { style: { color: m.change >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 } }, `${m.change >= 0 ? '+' : ''}${m.change.toFixed(1)}%`),
        ])
      ),
    ]),
    // Key events
    React.createElement('div', { key: 'events', style: { marginTop: 8 } },
      brief.keyEvents.map((e, i) =>
        React.createElement('div', { key: i, style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)', paddingLeft: 8, marginBottom: 2 } }, `• ${e}`)
      )
    ),
  ]);
}

// ── Main Component ───────────────────────────────────────────────────
export default function DailyBriefingPanel({
  briefing, isLoading, onRefresh, onItemClick, className = '',
}: DailyBriefingPanelProps) {
  const [tab, setTab] = useState<'portfolio' | 'watchlist' | 'market'>('portfolio');
  
  const tabs = [
    { key: 'portfolio' as const, label: 'Portfolio', icon: '💼', change: briefing.portfolio.totalChange, count: briefing.portfolio.items.length },
    { key: 'watchlist' as const, label: 'Watchlist', icon: '👀', change: 0, count: briefing.watchlist.items.length },
    { key: 'market' as const, label: 'Market', icon: '🌍', change: briefing.market[0]?.indexChange || 0, count: briefing.market.length },
  ];
  
  return React.createElement('div', { className: `daily-briefing ${className}`, style: { display: 'flex', flexDirection: 'column', height: '100%' } }, [
    // Header
    React.createElement('div', { key: 'header', style: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px', borderBottom: '1px solid var(--border-color, #334155)',
    }}, [
      React.createElement('div', { key: 'title', style: { display: 'flex', alignItems: 'center', gap: 8 } }, [
        React.createElement('span', { style: { fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' } }, '🤖 AI Morning Briefing'),
        React.createElement('span', { style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)' } }, briefing.date),
      ]),
      React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 } }, [
        React.createElement('span', { key: 'gen', style: { color: 'var(--text-tertiary, #64748b)' } }, `Generated ${new Date(briefing.generatedAt).toLocaleTimeString()}`),
        onRefresh && React.createElement('button', { key: 'refresh', onClick: onRefresh, style: {
          padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
          background: 'var(--brand, #d4a574)', color: '#000', border: 'none', cursor: 'pointer',
        }}, '🔄 Refresh (1U)'),
      ]),
    ]),
    
    // Tab bar
    React.createElement('div', { key: 'tabs', style: { display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color, #334155)' } },
      tabs.map(t => {
        const tColor = (t.change || 0) >= 0 ? '#22c55e' : '#ef4444';
        return React.createElement('button', {
          key: t.key, onClick: () => setTab(t.key),
          style: {
            flex: 1, padding: '10px 4px', textAlign: 'center', fontSize: 12, fontWeight: 500,
            background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--brand, #d4a574)' : '2px solid transparent',
            color: tab === t.key ? 'var(--brand, #d4a574)' : 'var(--text-secondary, #94a3b8)',
            cursor: 'pointer',
          },
        }, `${t.icon} ${t.label} (${t.count})`);
      })
    ),
    
    // Content
    React.createElement('div', { key: 'content', style: { flex: 1, overflow: 'auto', padding: 14 } },
      (() => { if (isLoading) return React.createElement('div', { style: { padding: 40, textAlign: 'center', color: 'var(--text-tertiary, #64748b)' } }, 'Generating AI briefing...'); if (tab === 'portfolio') return React.createElement('div', {}, React.createElement('div', {}, 'Portfolio')); if (tab === 'watchlist') return React.createElement('div', {}, React.createElement('div', {}, 'Watchlist')); return React.createElement('div', {}, React.createElement('div', {}, 'Market')); })()
    ),
    
    // Footer
    React.createElement('div', { key: 'footer', style: {
      padding: '8px 14px', borderTop: '1px solid var(--border-color, #334155)',
      fontSize: 10, color: 'var(--text-tertiary, #64748b)', textAlign: 'center',
    }}, '⚠️ AI-generated content. For reference only. Not financial advice. 1U per refresh.'),
  ]);
}
