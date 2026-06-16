// @ts-nocheck
// R238 ML#2: BreakingNewsToast — Desktop notification for breaking news
// Severity-colored, auto-dismiss, click-to-detail, stack management
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { NewsItem } from './NewsFeedPanelV2';

export interface BreakingNewsToastProps {
  news: NewsItem;
  onDismiss?: (id: string) => void;
  onClick?: (item: NewsItem) => void;
  autoDismissMs?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const SEVERITY_GRADIENTS = {
  breaking: 'linear-gradient(135deg, #ef4444, #dc2626)',
  high: 'linear-gradient(135deg, #f59e0b, #d97706)',
  medium: 'linear-gradient(135deg, #3b82f6, #2563eb)',
  low: 'linear-gradient(135deg, #64748b, #475569)',
};

const SEVERITY_ICONS = {
  breaking: '🔴', high: '🟠', medium: '🔵', low: '⚪',
};

export default function BreakingNewsToast({
  news, onDismiss, onClick, autoDismissMs = 10000, position = 'top-right',
}: BreakingNewsToastProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  
  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);
  
  // Auto dismiss
  useEffect(() => {
    if (autoDismissMs <= 0 || news.severity === 'low') return;
    const ms = news.severity === 'breaking' ? autoDismissMs * 2 : autoDismissMs;
    timerRef.current = setTimeout(() => handleDismiss(), ms);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);
  
  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss?.(news.id), 300);
  }, [news.id, onDismiss]);
  
  const handleClick = useCallback(() => {
    onClick?.(news);
    handleDismiss();
  }, [news, onClick, handleDismiss]);
  
  const posStyles: React.CSSProperties = {
    position: 'fixed', zIndex: 5000,
    ...(position === 'top-right' && { top: 16, right: 16 }),
    ...(position === 'top-left' && { top: 16, left: 16 }),
    ...(position === 'bottom-right' && { bottom: 16, right: 16 }),
    ...(position === 'bottom-left' && { bottom: 16, left: 16 }),
  };
  
  return React.createElement('div', {
    onClick: handleClick,
    style: {
      ...posStyles,
      width: 380, maxWidth: '90vw',
      borderRadius: 12, overflow: 'hidden',
      background: 'var(--surface-1, #0f172a)',
      border: `1px solid var(--border-color, #334155)`,
      boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${SEVERITY_GRADIENTS[news.severity]?.split(',')[0]?.replace('linear-gradient(135deg, ', '') || '#ef4444'}40`,
      cursor: 'pointer',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(-12px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      ...(exiting ? { opacity: 0, transform: 'translateY(-12px)' } : {}),
    },
  }, [
    // Severity header bar
    React.createElement('div', { key: 'bar', style: {
      height: 4, background: SEVERITY_GRADIENTS[news.severity] || SEVERITY_GRADIENTS.low,
    }}),
    // Content
    React.createElement('div', { key: 'content', style: { padding: '12px 14px' } }, [
      // Header row
      React.createElement('div', { key: 'header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 } }, [
        React.createElement('div', { key: 'left', style: { display: 'flex', alignItems: 'center', gap: 6 } }, [
          React.createElement('span', { style: { fontSize: 14 } }, SEVERITY_ICONS[news.severity]),
          React.createElement('span', { style: {
            padding: '1px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700,
            background: SEVERITY_GRADIENTS[news.severity] || SEVERITY_GRADIENTS.low,
            color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5,
          }}, news.severity === 'breaking' ? 'BREAKING NEWS' : news.severity.toUpperCase()),
          React.createElement('span', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, 
            new Date(news.publishedAt).toLocaleTimeString()),
        ]),
        React.createElement('button', {
          onClick: (e: any) => { e.stopPropagation(); handleDismiss(); },
          style: { background: 'none', border: 'none', color: 'var(--text-tertiary, #64748b)', fontSize: 14, cursor: 'pointer', padding: '0 2px' },
        }, '✕'),
      ]),
      // Title
      React.createElement('div', { key: 'title', style: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', marginBottom: 4, lineHeight: 1.4 } }, news.title),
      // Summary
      React.createElement('div', { key: 'summary', style: { fontSize: 11, color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, news.summary),
      // Footer: source + symbols + sentiment
      React.createElement('div', { key: 'footer', style: { display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' } }, [
        React.createElement('span', { key: 'source', style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, news.source),
        ...news.symbols.slice(0, 3).map(sym =>
          React.createElement('span', { key: sym, style: { padding: '1px 5px', borderRadius: 3, fontSize: 9, background: 'var(--surface-2, #1e293b)', color: 'var(--brand, #d4a574)', fontWeight: 500 } }, sym)
        ),
        React.createElement('span', { key: 'sentiment', style: { fontSize: 10, fontWeight: 500, marginLeft: 'auto',
          color: news.sentiment === 'positive' ? '#22c55e' : news.sentiment === 'negative' ? '#ef4444' : '#94a3b8',
        }}, news.sentiment === 'positive' ? '🟢 Bullish' : news.sentiment === 'negative' ? '🔴 Bearish' : '⚪ Neutral'),
      ]),
    ]),
  ]);
}

// ── BreakingNewsManager — Manages toast stack ────────────────────────
export interface BreakingNewsManagerProps {
  breakingNews: NewsItem[];
  onNewsClick?: (item: NewsItem) => void;
  maxToasts?: number;
}

export function BreakingNewsManager({ breakingNews, onNewsClick, maxToasts = 3 }: BreakingNewsManagerProps) {
  const [activeToasts, setActiveToasts] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  
  // Show new breaking news as toasts
  useEffect(() => {
    const newItems = breakingNews.filter(
      n => n.severity === 'breaking' && !dismissed.has(n.id) && !activeToasts.includes(n.id)
    );
    if (newItems.length === 0) return;
    
    setActiveToasts(prev => {
      const next = [...prev];
      for (const item of newItems) {
        if (next.length >= maxToasts) break;
        next.push(item.id);
      }
      return next;
    });
  }, [breakingNews, dismissed, activeToasts, maxToasts]);
  
  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => new Set(prev).add(id));
    setActiveToasts(prev => prev.filter(x => x !== id));
  }, []);
  
  const visibleNews = breakingNews.filter(n => activeToasts.includes(n.id));
  
  return React.createElement('div', {},
    visibleNews.map((item, i) =>
      React.createElement(BreakingNewsToast, {
        key: item.id,
        news: item,
        onDismiss: handleDismiss,
        onClick: onNewsClick,
        position: i === 0 ? 'top-right' : i === 1 ? 'top-right' : 'bottom-right',
        autoDismissMs: item.severity === 'breaking' ? 15000 : 8000,
      })
    )
  );
}
