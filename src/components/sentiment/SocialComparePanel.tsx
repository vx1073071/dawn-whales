// @ts-nocheck
// R241 ML#1: SocialComparePanel — Social sentiment comparison across platforms
// Reddit vs StockTwits vs 华尔街见闻, multi-source sentiment dashboard
import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface SocialSentiment {
  platform: 'reddit' | 'stocktwits' | 'wst' | 'xueqiu' | 'weibo';
  symbol: string;
  name: string;
  score: number;          // -100 to +100
  mentions: number;
  mentionsChange: number; // % change from previous period
  topKeywords: { word: string; count: number; sentiment: 'positive' | 'negative' | 'neutral' }[];
  recentPosts: SocialPost[];
  trend: 'rising' | 'falling' | 'stable';
}

export interface SocialPost {
  id: string;
  platform: string;
  author: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;  // upvotes/likes
  timestamp: string;
  url?: string;
}

export interface SocialComparePanelProps {
  sentiments: SocialSentiment[];
  symbol: string;
  onRefresh?: () => void;
  onViewPost?: (post: SocialPost) => void;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────
const PLATFORM_CONFIG = {
  reddit:    { name: 'Reddit', icon: '🤖', color: '#ff4500' },
  stocktwits:{ name: 'StockTwits', icon: '🐦', color: '#1da1f2' },
  wst:       { name: 'WallStreetBets', icon: '💎', color: '#22c55e' },
  xueqiu:    { name: '雪球', icon: '❄️', color: '#3b82f6' },
  weibo:     { name: '微博', icon: '📱', color: '#ef4444' },
};

// ── Component ────────────────────────────────────────────────────────
export default function SocialComparePanel({
  sentiments, symbol, onRefresh, onViewPost, className = '',
}: SocialComparePanelProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  
  const filtered = useMemo(() => {
    if (selectedPlatform === 'all') return sentiments;
    return sentiments.filter(s => s.platform === selectedPlatform);
  }, [sentiments, selectedPlatform]);
  
  // Aggregate stats
  const aggregate = useMemo(() => {
    if (sentiments.length === 0) return { avgScore: 0, totalMentions: 0, dominantSentiment: 'neutral' as const };
    const avgScore = Math.round(sentiments.reduce((s, i) => s + i.score, 0) / sentiments.length);
    const totalMentions = sentiments.reduce((s, i) => s + i.mentions, 0);
    const dominant = avgScore > 20 ? 'positive' as const : avgScore < -20 ? 'negative' as const : 'neutral' as const;
    return { avgScore, totalMentions, dominantSentiment: dominant };
  }, [sentiments]);
  
  return React.createElement('div', { className: `social-compare ${className}`, style: { display: 'flex', flexDirection: 'column', height: '100%' } }, [
    // Header
    React.createElement('div', { key: 'header', style: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px', borderBottom: '1px solid var(--border-color, #334155)',
    }}, [
      React.createElement('div', { key: 'title' }, [
        React.createElement('div', { style: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' } }, `💬 Social Sentiment: ${symbol}`),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--text-tertiary, #64748b)', marginTop: 2 } },
          `${sentiments.length} platforms · ${aggregate.totalMentions} mentions`),
      ]),
      React.createElement('div', { key: 'aggr', style: { textAlign: 'right' } }, [
        React.createElement('div', { style: { fontSize: 18, fontWeight: 700, color: aggregate.avgScore >= 0 ? '#22c55e' : '#ef4444' } }, `${aggregate.avgScore >= 0 ? '+' : ''}${aggregate.avgScore}`),
        React.createElement('div', { style: { fontSize: 10, color: 'var(--text-tertiary, #64748b)' } }, 'Aggregate Score'),
      ]),
    ]),
    
    // Platform chips
    React.createElement('div', { key: 'platforms', style: {
      display: 'flex', gap: 4, padding: '6px 14px',
      borderBottom: '1px solid var(--border-color, #334155)',
      overflow: 'auto',
    }}, [
      React.createElement('button', {
        key: 'all', onClick: () => setSelectedPlatform('all'),
        style: makeChipStyle(selectedPlatform === 'all', '#94a3b8'),
      }, 'All'),
      ...sentiments.map(s => {
        const cfg = PLATFORM_CONFIG[s.platform];
        return React.createElement('button', {
          key: s.platform, onClick: () => setSelectedPlatform(s.platform),
          style: makeChipStyle(selectedPlatform === s.platform, cfg.color),
        }, `${cfg.icon} ${cfg.name}`);
      }),
    ]),
    
    // Score comparison bars
    React.createElement('div', { key: 'scores', style: { padding: '10px 14px', borderBottom: '1px solid var(--border-color, #334155)' } },
      filtered.map(s => {
        const cfg = PLATFORM_CONFIG[s.platform];
        const pct = Math.abs(s.score);
        const isPos = s.score >= 0;
        
        return React.createElement('div', { key: s.platform, style: { marginBottom: 8 } }, [
          React.createElement('div', { key: 'label', style: { display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 } }, [
            React.createElement('span', { style: { color: 'var(--text-primary, #e2e8f0)', fontWeight: 500 } }, `${cfg.icon} ${cfg.name}`),
            React.createElement('span', { style: { display: 'flex', gap: 8 } }, [
              React.createElement('span', { style: { color: isPos ? '#22c55e' : '#ef4444', fontWeight: 600 } }, `${isPos ? '+' : ''}${s.score}`),
              React.createElement('span', { style: { color: 'var(--text-tertiary, #64748b)' } }, `${s.mentions} mentions`),
              React.createElement('span', { style: { color: s.trend === 'rising' ? '#22c55e' : s.trend === 'falling' ? '#ef4444' : '#94a3b8', fontSize: 10 } },
                s.trend === 'rising' ? '↗' : s.trend === 'falling' ? '↘' : '→'),
            ]),
          ]),
          React.createElement('div', { key: 'bar', style: { height: 6, borderRadius: 3, background: 'var(--surface-3, #334155)', overflow: 'hidden', display: 'flex' } }, [
            React.createElement('div', { style: { width: `${pct}%`, height: '100%', background: isPos ? '#22c55e' : '#ef4444', borderRadius: 3, transition: 'width 0.5s', marginLeft: isPos ? 'auto' : 0 } }),
          ]),
        ]);
      })
    ),
    
    // Recent posts
    React.createElement('div', { key: 'posts', style: { flex: 1, overflow: 'auto', padding: '8px 14px' } }, [
      React.createElement('div', { key: 'title', style: { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: 8 } }, 'Recent Posts'),
      ...filtered.flatMap(s =>
        s.recentPosts.slice(0, 3).map(post => {
          const cfg = PLATFORM_CONFIG[post.platform as keyof typeof PLATFORM_CONFIG] || PLATFORM_CONFIG.reddit;
          const sentColor = post.sentiment === 'positive' ? '#22c55e' : post.sentiment === 'negative' ? '#ef4444' : '#94a3b8';
          
          return React.createElement('div', {
            key: post.id,
            onClick: () => onViewPost?.(post),
            style: {
              padding: '8px 0', cursor: 'pointer',
              borderBottom: '1px solid var(--border-color, #334155)',
            },
          }, [
            React.createElement('div', { key: 'meta', style: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, fontSize: 10 } }, [
              React.createElement('span', { style: { color: cfg.color, fontWeight: 600 } }, `${cfg.icon} ${cfg.name}`),
              React.createElement('span', { style: { color: 'var(--text-tertiary, #64748b)' } }, post.author),
              React.createElement('span', { style: { color: sentColor, fontWeight: 600 } }, post.sentiment === 'positive' ? '🟢' : post.sentiment === 'negative' ? '🔴' : '⚪'),
              React.createElement('span', { style: { color: 'var(--text-tertiary, #64748b)', marginLeft: 'auto' } }, `⬆${post.score}`),
            ]),
            React.createElement('div', { key: 'content', style: { fontSize: 11, color: 'var(--text-primary, #e2e8f0)', lineHeight: 1.5 } }, post.content.slice(0, 200)),
          ]);
        })
      ),
    ]),
  ]);
}

function makeChipStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
    border: active ? `1px solid ${color}` : '1px solid transparent',
    background: active ? `${color}15` : 'transparent',
    color: active ? color : 'var(--text-secondary, #94a3b8)',
    cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
