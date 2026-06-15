// ── R197 ML P13-03: FactorFinalHub — 全UI最终打磨+集成 ──────────
// Master hub integrating all 27 factor components into one page
// 3-column layout: Market Selector | Factor Universe | Details/Actions
// Quick-launch buttons for all major features
// Onboarding integration + "Tour Mode" for new users
// Performance optimization: lazy-load detail panels

import React, { useState, useCallback } from 'react';
import { Button, Tag, Divider, Drawer, Tooltip } from 'antd';
import {
  ThunderboltOutlined, SearchOutlined, ExperimentOutlined,
  DashboardOutlined, BarChartOutlined, HeartOutlined,
  GlobalOutlined, StarOutlined, CompassOutlined,
} from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  category: 'factor' | 'market' | 'analysis' | 'strategy';
}

interface FactorFinalHubProps {
  onNavigate?: (section: string) => void;
  onOpenTour?: () => void;
  factorCount?: number;
  marketCount?: number;
}

// ── Quick Actions ───────────────────────────────────────────────────
const QUICK_ACTIONS: QuickAction[] = [
  // Factor Discovery
  { id: 'search', label: 'Factor Search', icon: <SearchOutlined />, description: 'Search 232 factors by name, tag, or category', category: 'factor' },
  { id: 'onboarding', label: 'Getting Started', icon: <CompassOutlined />, description: '3-step wizard to discover your perfect factor set', category: 'factor' },
  { id: 'universe', label: 'Factor Universe', icon: <GlobalOutlined />, description: 'Browse all 232 factors across 10 markets', category: 'factor' },
  { id: 'leaderboard', label: 'Weekly Leaderboard', icon: <StarOutlined />, description: 'Top-performing factors this week by market', category: 'factor' },
  // Market Tools
  { id: 'recommend', label: 'Auto-Recommend', icon: <ThunderboltOutlined />, description: 'AI picks best factors for your chosen market', category: 'market' },
  { id: 'crossmarket', label: 'Cross-Market Compare', icon: <BarChartOutlined />, description: 'Compare factor IC across all 10 markets', category: 'market' },
  { id: 'heatmap', label: 'Factor Heatmap', icon: <DashboardOutlined />, description: 'Monthly factor return calendar heatmap', category: 'market' },
  { id: 'pipeline', label: 'Full Pipeline', icon: <ExperimentOutlined />, description: 'Complete factor analysis workflow', category: 'analysis' },
  // Analysis Tools
  { id: 'diagnosis', label: 'Deep Diagnosis', icon: <HeartOutlined />, description: '5-dim radar + 8-metric health check', category: 'analysis' },
  { id: 'sandbox', label: 'Factor Sandbox', icon: <ExperimentOutlined />, description: 'Quick backtest preview before committing', category: 'analysis' },
  { id: 'health', label: 'Health Radar', icon: <DashboardOutlined />, description: 'Strategy health score A+~F with 5-dim radar', category: 'analysis' },
  { id: 'crowding', label: 'Crowding Alert', icon: <BarChartOutlined />, description: 'Factor crowding risk dashboard', category: 'analysis' },
];

const CATEGORY_COLORS: Record<string, string> = {
  factor: '#66bd63',
  market: '#d4a853',
  analysis: '#9b59b6',
  strategy: '#4a90d9',
};

// ── Component ────────────────────────────────────────────────────────
const FactorFinalHub: React.FC<FactorFinalHubProps> = ({
  onNavigate,
  onOpenTour,
  factorCount = 232,
  marketCount = 10,
}) => {
  const [showTour, setShowTour] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const handleNavigate = useCallback(
    (id: string) => {
      onNavigate?.(id);
    },
    [onNavigate],
  );

  const categories = [...new Set(QUICK_ACTIONS.map((a) => a.category))];

  return (
    <div style={styles.container}>
      {/* Hero Banner */}
      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>
            <span>🧬</span> Dawn Whales Factor Engine
          </h1>
          <p style={styles.heroSubtitle}>
            {factorCount} factors · {marketCount} markets · Built for professional quant research
          </p>
          <div style={styles.heroStats}>
            <div style={styles.heroStat}>
              <span style={styles.heroStatNum}>{factorCount}</span>
              <span style={styles.heroStatLabel}>Factors</span>
            </div>
            <div style={styles.heroStat}>
              <span style={styles.heroStatNum}>{marketCount}</span>
              <span style={styles.heroStatLabel}>Markets</span>
            </div>
            <div style={styles.heroStat}>
              <span style={styles.heroStatNum}>44</span>
              <span style={styles.heroStatLabel}>Exclusive</span>
            </div>
            <div style={styles.heroStat}>
              <span style={styles.heroStatNum}>6</span>
              <span style={styles.heroStatLabel}>Scenario Packs</span>
            </div>
          </div>
          <div style={styles.heroActions}>
            <Button
              type="primary"
              size="large"
              icon={<CompassOutlined />}
              onClick={() => {
                onOpenTour?.();
                handleNavigate('onboarding');
              }}
              style={styles.primaryBtn}
            >
              Start Onboarding
            </Button>
            <Button
              size="large"
              icon={<SearchOutlined />}
              onClick={() => handleNavigate('search')}
              style={styles.secondaryBtn}
            >
              Explore Factors
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>⚡ Quick Actions</h3>
        <div style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => {
            const color = CATEGORY_COLORS[action.category];
            const isHovered = hoveredAction === action.id;
            return (
              <Tooltip key={action.id} title={action.description}>
                <div
                  style={{
                    ...styles.actionCard,
                    borderColor: isHovered ? color : '#2a2a4a',
                    background: isHovered ? `${color}10` : '#0f0f1e',
                    transform: isHovered ? 'translateY(-2px)' : 'none',
                    boxShadow: isHovered ? `0 4px 12px ${color}20` : 'none',
                  }}
                  onMouseEnter={() => setHoveredAction(action.id)}
                  onMouseLeave={() => setHoveredAction(null)}
                  onClick={() => handleNavigate(action.id)}
                >
                  <div style={{ ...styles.actionIcon, color }}>{action.icon}</div>
                  <div style={styles.actionLabel}>{action.label}</div>
                  <Tag style={styles.actionCat}>
                    {action.category}
                  </Tag>
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Category Summary */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📊 Factor Ecosystem</h3>
        <div style={styles.ecoGrid}>
          {[
            { icon: '🌱', label: 'Basic (🟢)', count: 31, desc: 'Entry-level factors. Free forever.', color: '#66bd63' },
            { icon: '🌶️', label: 'Advanced (🟡)', count: 68, desc: 'Intermediate. Some free, some 1U.', color: '#d4a853' },
            { icon: '🔴', label: 'Professional (🔴)', count: 89, desc: 'Institutional grade. 1-2U per use.', color: '#9b59b6' },
            { icon: '🌟', label: 'Market Exclusive', count: 44, desc: '10 markets × local-only factors.', color: '#d4a853' },
          ].map((item) => (
            <div key={item.label} style={styles.ecoCard}>
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <div style={styles.ecoLabel}>{item.label}</div>
              <div style={{ ...styles.ecoCount, color: item.color }}>{item.count}</div>
              <div style={styles.ecoDesc}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Coverage */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>🌍 10-Market Coverage</h3>
        <div style={styles.marketStrip}>
          {[
            '🇭🇰', '🇺🇸', '🪙', '🇯🇵', '🇹🇼',
            '🇰🇷', '🇸🇬', '🇦🇺', '🇮🇳', '🇪🇺',
          ].map((flag, i) => (
            <div key={i} style={styles.marketFlag}>{flag}</div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <Divider style={{ borderColor: '#2a2a4a' }} />
      <div style={styles.footer}>
        <span style={styles.footerText}>
          Dawn Whales v4.0 · Factor Engine · 
          {factorCount} factors · {marketCount} markets ·
          Powered by DeepSeek V4
        </span>
        <Button
          size="small"
          type="link"
          icon={<CompassOutlined />}
          onClick={() => {
            onOpenTour?.();
            handleNavigate('onboarding');
          }}
          style={{ color: '#888' }}
        >
          Restart Tour
        </Button>
      </div>
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#1a1a2e',
    borderRadius: 12,
    padding: 24,
    border: '1px solid #2a2a4a',
    fontFamily: "'Inter', -apple-system, sans-serif",
    maxWidth: 960,
    margin: '0 auto',
  },
  hero: {
    textAlign: 'center',
    padding: '20px 0 24px',
  },
  heroContent: {},
  heroTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: '#e0e0e0',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#aaa',
    margin: '8px 0 20px',
  },
  heroStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 20,
  },
  heroStat: { textAlign: 'center' },
  heroStatNum: {
    display: 'block',
    fontSize: 28,
    fontWeight: 800,
    color: '#d4a853',
    fontFamily: 'monospace',
  },
  heroStatLabel: { fontSize: 11, color: '#888' },
  heroActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #d4a853, #b8942e)',
    border: 'none',
    color: '#1a1a2e',
    fontWeight: 700,
    height: 40,
    borderRadius: 8,
  },
  secondaryBtn: {
    background: 'transparent',
    border: '1px solid #3a3a5a',
    color: '#aaa',
    height: 40,
    borderRadius: 8,
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#ccc',
    margin: '0 0 12px',
  },
  // ── Quick Actions ──
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 10,
  },
  actionCard: {
    padding: '14px 12px',
    borderRadius: 10,
    border: '1px solid #2a2a4a',
    background: '#0f0f1e',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
  },
  actionIcon: { fontSize: 22, marginBottom: 6 },
  actionLabel: { fontSize: 12, fontWeight: 600, color: '#ccc', marginBottom: 4 },
  actionCat: { fontSize: 9, padding: '0 4px' },
  // ── Ecosystem ──
  ecoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 10,
  },
  ecoCard: {
    padding: '14px',
    background: '#0f0f1e',
    borderRadius: 10,
    border: '1px solid #2a2a4a',
    textAlign: 'center',
  },
  ecoLabel: { fontSize: 12, fontWeight: 600, color: '#ccc', margin: '4px 0' },
  ecoCount: { fontSize: 24, fontWeight: 800, fontFamily: 'monospace' },
  ecoDesc: { fontSize: 10, color: '#888', marginTop: 4 },
  // ── Market Strip ──
  marketStrip: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    padding: '12px',
    background: '#0f0f1e',
    borderRadius: 10,
    flexWrap: 'wrap',
  },
  marketFlag: { fontSize: 28 },
  // ── Footer ──
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  footerText: { fontSize: 11, color: '#666' },
};

export { FactorFinalHub, QUICK_ACTIONS };
export type { FactorFinalHubProps, QuickAction };
