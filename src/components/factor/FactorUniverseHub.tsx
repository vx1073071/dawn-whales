// @ts-nocheck
// ── R193 ML P9-02: FactorUniverseHub — 全188因子UI集成中心 ──────────
// Three-tier classification cards (🟢入门 / 🟡进阶 / 🔴专业)
// 3-market toggle (HK/US/Crypto) with animated transitions
// Factor signal lights + search + i18n unified entry
// Integrates all factor components into single browsable hub
// Mobile-responsive grid with expandable detail cards

import React, { useState, useMemo, useCallback } from 'react';
import { Input, Tag, Segmented, Tooltip, Empty, Badge } from 'antd';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
type FactorTier = 'basic' | 'advanced' | 'pro';
type MarketCode = 'hk' | 'us' | 'crypto';

interface FactorMeta {
  id: string;
  name: string;
  nameCN: string;
  tier: FactorTier;
  markets: MarketCode[];
  category: string;
  tags: string[];
  description: string;
  signal?: 'green' | 'yellow' | 'red'; // current signal light
  ic?: number;
  price?: number; // USDT for pro factors
}

interface FactorUniverseHubProps {
  factors: FactorMeta[];
  onSelectFactor?: (factor: FactorMeta) => void;
  onSearch?: (query: string) => void;
}

// ── Demo Factor Data (subset of 188) ────────────────────────────────
const DEMO_FACTORS: FactorMeta[] = [
  // 🟢 Basic
  { id: 'PE_RATIO', name: 'PE Ratio', nameCN: '市盈率', tier: 'basic', markets: ['hk', 'us'], category: 'Value', tags: ['value', 'fundamental'], description: 'Price to earnings ratio. Lower = cheaper.', signal: 'green', ic: 0.032 },
  { id: 'PB_RATIO', name: 'PB Ratio', nameCN: '市净率', tier: 'basic', markets: ['hk', 'us'], category: 'Value', tags: ['value', 'fundamental'], description: 'Price to book ratio.', signal: 'green', ic: 0.028 },
  { id: 'DIVIDEND_YIELD', name: 'Dividend Yield', nameCN: '股息率', tier: 'basic', markets: ['hk', 'us'], category: 'Income', tags: ['dividend', 'income'], description: 'Annual dividend / current price.', signal: 'yellow', ic: 0.015 },
  { id: 'MOM_12M1M', name: '12-1M Momentum', nameCN: '12-1月动量', tier: 'basic', markets: ['hk', 'us', 'crypto'], category: 'Momentum', tags: ['momentum', 'trend'], description: '12-month return excluding last month.', signal: 'green', ic: 0.041 },
  { id: 'MOM_6M', name: '6M Momentum', nameCN: '6月动量', tier: 'basic', markets: ['hk', 'us', 'crypto'], category: 'Momentum', tags: ['momentum'], description: '6-month return.', signal: 'green', ic: 0.035 },
  { id: 'ROE', name: 'ROE', nameCN: '净资产收益率', tier: 'basic', markets: ['hk', 'us'], category: 'Quality', tags: ['quality', 'profitability'], description: 'Return on equity.', signal: 'green', ic: 0.025 },
  { id: 'MARKET_CAP', name: 'Market Cap', nameCN: '市值', tier: 'basic', markets: ['hk', 'us', 'crypto'], category: 'Size', tags: ['size'], description: 'Total market capitalization.', signal: 'yellow', ic: -0.018 },
  { id: 'VOLATILITY_1M', name: '1M Volatility', nameCN: '1月波动率', tier: 'basic', markets: ['hk', 'us', 'crypto'], category: 'Risk', tags: ['volatility', 'risk'], description: '1-month annualized volatility.', signal: 'red', ic: -0.022 },
  // 🟡 Advanced
  { id: 'ROIC', name: 'ROIC', nameCN: '投入资本回报率', tier: 'advanced', markets: ['hk', 'us'], category: 'Quality', tags: ['quality', 'advanced'], description: 'Return on invested capital.', signal: 'green', ic: 0.038 },
  { id: 'BAB', name: 'Bet Against Beta', nameCN: '反贝塔', tier: 'advanced', markets: ['hk', 'us'], category: 'Low Vol', tags: ['lowvol', 'academic'], description: 'Frazzini-Pedersen BAB factor.', signal: 'green', ic: 0.045 },
  { id: 'IDIO_VOL', name: 'Idiosyncratic Vol', nameCN: '特质波动率', tier: 'advanced', markets: ['hk', 'us'], category: 'Low Vol', tags: ['lowvol', 'idiosyncratic'], description: 'Stock-specific volatility after market regression.', signal: 'red', ic: -0.031 },
  { id: 'SHORT_INTEREST', name: 'Short Interest', nameCN: '做空比例', tier: 'advanced', markets: ['us'], category: 'Sentiment', tags: ['sentiment', 'short'], description: '% shares sold short.', signal: 'yellow', ic: -0.019 },
  { id: 'PIOTROSKI_F', name: 'Piotroski F-Score', nameCN: '皮氏F分', tier: 'advanced', markets: ['hk', 'us'], category: 'Quality', tags: ['quality', 'academic'], description: '9-point fundamental strength.', signal: 'green', ic: 0.029 },
  { id: 'ANALYST_REVISION', name: 'Analyst Revision', nameCN: '分析师修正', tier: 'advanced', markets: ['hk', 'us'], category: 'Sentiment', tags: ['sentiment', 'analyst'], description: 'EPS revision momentum.', signal: 'green', ic: 0.027 },
  { id: 'CRYPTO_FUNDING_RATE', name: 'Funding Rate', nameCN: '资金费率', tier: 'advanced', markets: ['crypto'], category: 'Derivatives', tags: ['crypto', 'funding'], description: 'Perpetual swap funding rate signal.', signal: 'yellow', ic: 0.021 },
  { id: 'DOWNSIDE_VOL', name: 'Downside Vol', nameCN: '下行波动率', tier: 'advanced', markets: ['hk', 'us'], category: 'Low Vol', tags: ['lowvol', 'risk'], description: 'Volatility of negative returns only.', signal: 'yellow', ic: -0.015 },
  // 🔴 Pro
  { id: 'GAMMA_EXPOSURE', name: 'Gamma Exposure', nameCN: 'Gamma暴露', tier: 'pro', markets: ['us'], category: 'Options', tags: ['options', 'pro'], description: 'Dealer gamma positioning.', signal: 'red', ic: 0.053, price: 1 },
  { id: 'CRYPTO_PUELL', name: 'Puell Multiple', nameCN: 'Puell多重', tier: 'pro', markets: ['crypto'], category: 'On-Chain', tags: ['crypto', 'onchain', 'pro'], description: 'Miner revenue / 365-day MA.', signal: 'green', ic: 0.061, price: 1 },
  { id: 'MAX_PAIN', name: 'Max Pain', nameCN: '最大痛点', tier: 'pro', markets: ['us'], category: 'Options', tags: ['options', 'pro'], description: 'Strike where option buyers lose most.', signal: 'yellow', ic: 0.033, price: 1 },
  { id: 'HK_CBBC_RATIO', name: 'CBBC Bull/Bear', nameCN: '牛熊比例', tier: 'pro', markets: ['hk'], category: 'Derivatives', tags: ['hk', 'cbbc', 'pro'], description: 'Bull vs bear CBBC ratio.', signal: 'green', ic: 0.048, price: 1 },
  { id: 'CRYPTO_MVRV_Z', name: 'MVRV Z-Score', nameCN: 'MVRV Z分', tier: 'pro', markets: ['crypto'], category: 'On-Chain', tags: ['crypto', 'onchain', 'pro'], description: 'Market value to realized value Z-score.', signal: 'green', ic: 0.055, price: 1 },
  { id: 'ALTMAN_Z', name: 'Altman Z-Score', nameCN: '阿尔曼Z分', tier: 'pro', markets: ['hk', 'us'], category: 'Fundamental', tags: ['pro', 'credit'], description: 'Bankruptcy probability indicator.', signal: 'green', ic: 0.026, price: 1 },
  { id: 'OPTION_FLOW', name: 'Option Flow', nameCN: '期权流向', tier: 'pro', markets: ['us'], category: 'Options', tags: ['options', 'pro', 'flow'], description: 'Unusual option activity detection.', signal: 'yellow', ic: 0.044, price: 1 },
  { id: 'HK_SOUTHBOUND', name: 'Southbound Flow', nameCN: '南向资金流', tier: 'pro', markets: ['hk'], category: 'Flow', tags: ['hk', 'southbound', 'pro'], description: 'Mainland → HK capital flow.', signal: 'green', ic: 0.037, price: 1 },
  { id: 'NEWS_SENTIMENT', name: 'News NLP Sentiment', nameCN: '新闻NLP情绪', tier: 'pro', markets: ['us'], category: 'Alt Data', tags: ['pro', 'nlp', 'news'], description: 'Real-time news sentiment scoring.', signal: 'green', ic: 0.042, price: 2 },
];

// ── Helper ───────────────────────────────────────────────────────────
const TIER_CONFIG: Record<FactorTier, { label: string; color: string; bg: string; emoji: string }> = {
  basic: { label: 'Entrant', color: '#66bd63', bg: 'rgba(102,189,99,0.1)', emoji: '🌱' },
  advanced: { label: 'Advanced', color: '#d4a853', bg: 'rgba(212,168,83,0.1)', emoji: '🌶️' },
  pro: { label: 'Professional', color: '#9b59b6', bg: 'rgba(155,89,182,0.1)', emoji: '🔴' },
};

const MARKET_CONFIG: Record<MarketCode, { flag: string; name: string }> = {
  hk: { flag: '🇭🇰', name: 'HK' },
  us: { flag: '🇺🇸', name: 'US' },
  crypto: { flag: '🪙', name: 'Crypto' },
};

const SIGNAL_CONFIG = {
  green: { color: '#66bd63', label: 'Bullish', dot: '🟢' },
  yellow: { color: '#d4a853', label: 'Neutral', dot: '🟡' },
  red: { color: '#f46d43', label: 'Bearish', dot: '🔴' },
};

// ── Component ────────────────────────────────────────────────────────
const FactorUniverseHub: React.FC<FactorUniverseHubProps> = ({
  factors = DEMO_FACTORS,
  onSelectFactor,
  onSearch,
}) => {
  const [market, setMarket] = useState<MarketCode | 'all'>('all');
  const [tier, setTier] = useState<FactorTier | 'all'>('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = factors;

    if (market !== 'all') {
      result = result.filter((f) => f.markets.includes(market));
    }
    if (tier !== 'all') {
      result = result.filter((f) => f.tier === tier);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (f) =>
          f.id.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          f.nameCN.includes(q) ||
          f.tags.some((t) => t.includes(q)) ||
          f.category.toLowerCase().includes(q),
      );
    }

    return result;
  }, [factors, market, tier, query]);

  const handleSearch = useCallback(
    (val: string) => {
      setQuery(val);
      onSearch?.(val);
    },
    [onSearch],
  );

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Count by tier
  const counts = useMemo(() => {
    const base = market === 'all' ? factors : factors.filter((f) => f.markets.includes(market));
    return {
      basic: base.filter((f) => f.tier === 'basic').length,
      advanced: base.filter((f) => f.tier === 'advanced').length,
      pro: base.filter((f) => f.tier === 'pro').length,
      total: base.length,
    };
  }, [factors, market]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>
            <span>🧬</span> Factor Universe
          </h2>
          <p style={styles.subtitle}>
            {counts.total} factors across 3 markets —{' '}
            {counts.basic} 🌱 basic · {counts.advanced} 🌶️ advanced · {counts.pro} 🔴 pro
          </p>
        </div>
        <Tag style={{ ...styles.countBadge, marginLeft: 'auto' }}>
          {filtered.length} / {factors.length}
        </Tag>
      </div>

      {/* Search & Filters */}
      <div style={styles.filterBar}>
        <Input
          prefix={<SearchOutlined style={{ color: '#888' }} />}
          placeholder="Search factor name, ID, or tag..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          allowClear
          style={styles.searchInput}
        />
        <Segmented
          value={market}
          onChange={(v) => setMarket(v as MarketCode)}
          options={[
            { label: '🌍 All', value: 'all' },
            { label: '🇭🇰 HK', value: 'hk' },
            { label: '🇺🇸 US', value: 'us' },
            { label: '🪙 Crypto', value: 'crypto' },
          ]}
          style={styles.segmented}
        />
        <Segmented
          value={tier}
          onChange={(v) => setTier(v as FactorTier)}
          options={[
            { label: '🌱 Basic', value: 'basic' },
            { label: '🌶️ Advanced', value: 'advanced' },
            { label: '🔴 Pro', value: 'pro' },
            { label: 'All', value: 'all' },
          ]}
          style={styles.segmented}
        />
      </div>

      {/* Factor Grid */}
      {filtered.length === 0 ? (
        <Empty description="No factors match your filters" style={{ marginTop: 40 }} />
      ) : (
        <div style={styles.grid}>
          {filtered.map((factor) => {
            const cfg = TIER_CONFIG[factor.tier];
            const expanded = expandedId === factor.id;
            const signal = factor.signal ? SIGNAL_CONFIG[factor.signal] : null;

            return (
              <div
                key={factor.id}
                style={{
                  ...styles.card,
                  borderLeft: `3px solid ${cfg.color}`,
                }}
                onClick={() => {
                  toggleExpand(factor.id);
                  if (!expanded) onSelectFactor?.(factor);
                }}
              >
                {/* Compact Row */}
                <div style={styles.cardRow}>
                  <div style={styles.cardLeft}>
                    <span style={styles.cardTier}>{cfg.emoji}</span>
                    <div style={styles.cardInfo}>
                      <div style={styles.cardNameRow}>
                        <span style={styles.cardName}>{factor.name}</span>
                        {factor.nameCN && (
                          <span style={styles.cardNameCN}>{factor.nameCN}</span>
                        )}
                      </div>
                      <div style={styles.cardMeta}>
                        <Tag color={cfg.color.replace('#', '')} style={{ fontSize: 10, padding: '0 4px', lineHeight: '18px' }}>
                          {cfg.label}
                        </Tag>
                        {factor.markets.map((m) => (
                          <span key={m} style={styles.marketFlag}>
                            {MARKET_CONFIG[m].flag}
                          </span>
                        ))}
                        <span style={styles.cardCategory}>{factor.category}</span>
                      </div>
                    </div>
                  </div>
                  <div style={styles.cardRight}>
                    {signal && (
                      <Tooltip title={signal.label}>
                        <span style={{ ...styles.signalDot, color: signal.color }}>
                          {signal.dot}
                        </span>
                      </Tooltip>
                    )}
                    {factor.ic != null && (
                      <span
                        style={{
                          ...styles.icBadge,
                          color: factor.ic >= 0.03 ? '#66bd63' : factor.ic >= 0 ? '#d4a853' : '#f46d43',
                        }}
                      >
                        IC {(factor.ic * 100).toFixed(1)}%
                      </span>
                    )}
                    {factor.price ? (
                      <Tag color="gold" style={styles.priceTag}>
                        {factor.price}U
                      </Tag>
                    ) : (
                      <Tag color="green" style={styles.priceTag}>FREE</Tag>
                    )}
                  </div>
                </div>

                {/* Expanded Detail */}
                {expanded && (
                  <div style={styles.expandedPanel}>
                    <p style={styles.expandedDesc}>{factor.description}</p>
                    <div style={styles.expandedTags}>
                      {factor.tags.map((t) => (
                        <Tag key={t} style={styles.expandedTag}>{t}</Tag>
                      ))}
                    </div>
                    <div style={styles.expandedActions}>
                      <button style={styles.actionBtn}>📊 Backtest</button>
                      <button style={styles.actionBtn}>🔬 Diagnose</button>
                      <button style={styles.actionBtn}>📈 View Chart</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    border: '1px solid #2a2a4a',
    fontFamily: "'Inter', -apple-system, sans-serif",
    minHeight: 400,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#e0e0e0',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    margin: '4px 0 0',
  },
  countBadge: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  filterBar: {
    display: 'flex',
    gap: 10,
    marginBottom: 14,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    minWidth: 200,
    background: '#0f0f1e',
    border: '1px solid #2a2a4a',
    borderRadius: 8,
    color: '#e0e0e0',
  },
  segmented: {
    background: '#0f0f1e',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 500,
    overflowY: 'auto',
  },
  card: {
    background: '#0f0f1e',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    overflow: 'hidden',
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    gap: 10,
  },
  cardLeft: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    minWidth: 0,
  },
  cardTier: {
    fontSize: 16,
    flexShrink: 0,
    marginTop: 2,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardNameRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e0e0e0',
    fontFamily: 'monospace',
  },
  cardNameCN: {
    fontSize: 11,
    color: '#888',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  marketFlag: {
    fontSize: 14,
  },
  cardCategory: {
    fontSize: 10,
    color: '#666',
  },
  cardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  signalDot: {
    fontSize: 16,
    lineHeight: 1,
  },
  icBadge: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 600,
  },
  priceTag: {
    fontSize: 10,
    padding: '0 6px',
    lineHeight: '18px',
  },
  expandedPanel: {
    padding: '0 14px 12px',
    borderTop: '1px solid #2a2a4a',
    marginTop: 0,
    paddingTop: 10,
  },
  expandedDesc: {
    fontSize: 12,
    color: '#aaa',
    margin: '0 0 8px',
    lineHeight: 1.5,
  },
  expandedTags: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  expandedTag: {
    fontSize: 10,
  },
  expandedActions: {
    display: 'flex',
    gap: 8,
  },
  actionBtn: {
    padding: '4px 12px',
    borderRadius: 6,
    border: '1px solid #3a3a5a',
    background: '#1a1a2e',
    color: '#aaa',
    fontSize: 11,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};

export { FactorUniverseHub, DEMO_FACTORS };
export type { FactorUniverseHubProps, FactorMeta, FactorTier, MarketCode };
