// @ts-nocheck
// ── R195 ML P11-03: MarketFactorNavigator — 7市场因子发现导航 ──────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// By-market browsing of 188 universal + 35 exclusive factors
// Tab strip for each market with factor count badges
// Color-coded: universal (grey) / market-exclusive (gold)
// Search + tier filter integrated, inherited from FactorUniverseHub patterns
// Scrollable factor cards with flag identifier

import React, { useState, useMemo, useCallback } from 'react';
import { Tabs, Input, Tag, Empty, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
type NavMarketCode = 'hk' | 'us' | 'crypto' | 'jp' | 'tw' | 'kr' | 'sg' | 'au';

interface NavFactor {
  id: string;
  name: string;
  market: NavMarketCode | 'universal';
  tier: 'basic' | 'advanced' | 'pro';
  category: string;
  description: string;
  isExclusive: boolean;
  ic?: number;
  signal?: 'green' | 'yellow' | 'red';
}

interface MarketFactorNavigatorProps {
  onSelectFactor?: (factor: NavFactor) => void;
  factors?: NavFactor[];
}

// ── Market Tab Config ────────────────────────────────────────────────
const NAV_MARKETS: { code: NavMarketCode; flag: string; label: string; exclusiveCount: number; universalCount: number }[] = [
  { code: 'hk', flag: '🇭🇰', label: 'Hong Kong', exclusiveCount: 11, universalCount: 78 },
  { code: 'us', flag: '🇺🇸', label: 'United States', exclusiveCount: 14, universalCount: 85 },
  { code: 'crypto', flag: '🪙', label: 'Crypto', exclusiveCount: 31, universalCount: 31 },
  { code: 'jp', flag: '🇯🇵', label: 'Japan', exclusiveCount: 12, universalCount: 78 },
  { code: 'tw', flag: '🇹🇼', label: 'Taiwan', exclusiveCount: 7, universalCount: 78 },
  { code: 'kr', flag: '🇰🇷', label: 'Korea', exclusiveCount: 6, universalCount: 78 },
  { code: 'sg', flag: '🇸🇬', label: 'Singapore', exclusiveCount: 5, universalCount: 78 },
  { code: 'au', flag: '🇦🇺', label: 'Australia', exclusiveCount: 5, universalCount: 78 },
];

// ── Demo Factors (subset of 188 universal + 35 exclusive) ──────────
const generateDemoNavFactors = (): NavFactor[] => {
  const universalCategories = ['Value', 'Quality', 'Momentum', 'Low Vol', 'Sentiment', 'Macro'];
  const universalNames = [
    'PE Ratio', 'PB Ratio', 'ROE', 'ROIC', '12-1M Momentum', '6M Momentum',
    'Dividend Yield', 'Market Cap', '1M Volatility', 'BAB', 'Short Interest',
    'FCF Yield', 'EV/EBITDA', 'Piotroski F', 'Asset Turnover',
    'Downside Vol', 'Idio Vol', 'Analyst Revision', 'Earnings Surprise',
    'Revenue Growth', 'Earnings Growth', 'GDP Beta', 'Rate Sensitivity',
    'Inflation Beta', 'Volatility Regime', 'Cross-Asset Corr',
    'Accruals', 'Debt Maturity', 'CAPEX Intensity',
  ];

  const factors: NavFactor[] = [];

  universalNames.forEach((name, i) => {
    const seed = i * 7 + 3;
    const rand = (offset: number) => {
      const x = Math.sin(seed * offset * 1.37) * 10000;
      return x - Math.floor(x);
    };
    factors.push({
      id: `UNI_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
      name,
      market: 'universal',
      tier: i < 10 ? 'basic' : i < 20 ? 'advanced' : 'pro',
      category: universalCategories[i % universalCategories.length],
      description: `${name} — universal factor applicable across all markets.`,
      isExclusive: false,
      ic: Math.round((0.01 + rand(1) * 0.05) * 1000) / 1000,
      signal: rand(2) > 0.6 ? 'green' : rand(2) > 0.5 ? 'yellow' : 'red',
    });
  });

  // Market-specific exclusives (names only for demo)
  const exclusives: { id: string; name: string; market: NavMarketCode; tier: NavFactor['tier']; category: string; desc: string }[] = [
    { id: 'HK_CBBC_RATIO', name: 'CBBC Bull/Bear Ratio', market: 'hk', tier: 'pro', category: 'Derivatives', desc: 'Bull vs bear CBBC ratio on HKEX.' },
    { id: 'HK_SOUTHBOUND', name: 'Southbound Flow', market: 'hk', tier: 'pro', category: 'Flow', desc: 'Mainland → HK net capital flow.' },
    { id: 'US_GAMMA_EXPOSURE', name: 'Gamma Exposure', market: 'us', tier: 'pro', category: 'Options', desc: 'Dealer gamma positioning.' },
    { id: 'US_0DTE_RATIO', name: '0DTE Ratio', market: 'us', tier: 'pro', category: 'Options', desc: '% of option volume expiring same day.' },
    { id: 'CRYPTO_PUELL', name: 'Puell Multiple', market: 'crypto', tier: 'pro', category: 'On-Chain', desc: 'Miner revenue / 365-day MA.' },
    { id: 'CRYPTO_MVRV_Z', name: 'MVRV Z-Score', market: 'crypto', tier: 'pro', category: 'On-Chain', desc: 'Market value to realized value.' },
    { id: 'JP_BOJ_ETF', name: 'BOJ ETF Purchases', market: 'jp', tier: 'advanced', category: 'Central Bank', desc: 'BOJ ETF buying activity.' },
    { id: 'JP_FOREIGN_FLOW', name: 'Foreign Net Buying', market: 'jp', tier: 'basic', category: 'Flow', desc: 'Weekly foreign flows on TSE.' },
    { id: 'TW_MARGIN_BALANCE', name: 'Margin Balance', market: 'tw', tier: 'basic', category: 'Flow', desc: 'Total margin loan balance.' },
    { id: 'TW_FOREIGN_FLOW', name: 'Foreign Net Flow', market: 'tw', tier: 'basic', category: 'Flow', desc: 'Foreign institutional flow.' },
    { id: 'KR_CHAEBOL_DISCOUNT', name: 'Chaebol Discount', market: 'kr', tier: 'advanced', category: 'Governance', desc: 'Conglomerate governance discount.' },
    { id: 'KR_FOREIGN_OWNERSHIP', name: 'Foreign Ownership', market: 'kr', tier: 'basic', category: 'Flow', desc: '% foreign-held shares.' },
    { id: 'SG_REIT_SPREAD', name: 'S-REIT Yield Spread', market: 'sg', tier: 'basic', category: 'Income', desc: 'REIT yield minus bond yield.' },
    { id: 'SG_DIVIDEND_CULTURE', name: 'Dividend Culture', market: 'sg', tier: 'advanced', category: 'Income', desc: 'Tax-free dividend advantage.' },
    { id: 'AU_COMMODITY_LINK', name: 'Commodity Beta', market: 'au', tier: 'advanced', category: 'Macro', desc: 'Iron ore/coal/LNG sensitivity.' },
    { id: 'AU_FRANKING_CREDIT', name: 'Franking Credit', market: 'au', tier: 'basic', category: 'Income', desc: 'Imputation credit gross-up.' },
  ];

  exclusives.forEach((e) => {
    factors.push({
      ...e,
      description: e.desc,
      isExclusive: true,
      signal: 'green',
      ic: 0.03 + Math.random() * 0.02,
    });
  });

  return factors;
};

// ── Component ────────────────────────────────────────────────────────
const MarketFactorNavigator: React.FC<MarketFactorNavigatorProps> = ({
  onSelectFactor,
  factors: propFactors,
}) => {
  const [activeTab, setActiveTab] = useState<NavMarketCode>('hk');
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<NavFactor['tier'] | 'all'>('all');

  const allFactors = useMemo(() => propFactors || generateDemoNavFactors(), [propFactors]);

  const marketFactors = useMemo(() => {
    let result = allFactors.filter(
      (f) => f.market === 'universal' || f.market === activeTab,
    );

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (f) => f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.category.toLowerCase().includes(q),
      );
    }

    if (tierFilter !== 'all') {
      result = result.filter((f) => f.tier === tierFilter);
    }

    return result;
  }, [allFactors, activeTab, query, tierFilter]);

  const exclusiveCount = marketFactors.filter((f) => f.isExclusive).length;
  const universalCount = marketFactors.filter((f) => !f.isExclusive).length;

  const tierConfig = {
    basic: { color: '#66bd63', emoji: '🌱' },
    advanced: { color: '#d4a853', emoji: '🌶️' },
    pro: { color: '#9b59b6', emoji: '🔴' },
  };

  const tabItems = NAV_MARKETS.map((m) => ({
    key: m.code,
    label: (
      <Tooltip title={`${m.exclusiveCount} exclusive + ${m.universalCount} universal`}>
        <span style={styles.tabLabel}>
          <span style={styles.tabFlag}>{m.flag}</span>
          <span style={styles.tabName}>{m.label}</span>
          <Tag color="gold" style={styles.tabBadge}>
            +{m.exclusiveCount}
          </Tag>
        </span>
      </Tooltip>
    ),
  }));

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>🧬 Market Factor Navigator</h3>
        <p style={styles.subtitle}>
          Browse {allFactors.length} factors across 8 markets —{' '}
          {allFactors.filter((f) => f.isExclusive).length} market-exclusive
        </p>
      </div>

      {/* Market Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as NavMarketCode)}
        items={tabItems}
        style={styles.tabs}
        tabBarStyle={{ borderBottom: '1px solid #2a2a4a', marginBottom: 0 }}
      />

      {/* Search + Filter Bar */}
      <div style={styles.filterBar}>
        <Input
          prefix={<SearchOutlined style={{ color: '#888' }} />}
          placeholder="Search factors by name or category..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          style={styles.searchInput}
        />
        <div style={styles.tierBtns}>
          {(['all', 'basic', 'advanced', 'pro'] as const).map((t) => (
            <button
              key={t}
              style={{
                ...styles.tierBtn,
                background: tierFilter === t ? (t === 'all' ? '#3a3a5a' : `${tierConfig[t === 'all' ? 'basic' : t].color}20`) : 'transparent',
                borderColor: tierFilter === t ? (t === 'all' ? '#5a5a7a' : tierConfig[t === 'all' ? 'basic' : t].color) : '#2a2a4a',
              }}
              onClick={() => setTierFilter(t)}
            >
              {t === 'all' ? 'All' : `${tierConfig[t].emoji} ${t.charAt(0).toUpperCase() + t.slice(1)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Count Summary */}
      <div style={styles.countBar}>
        <span style={styles.countLabel}>
          {marketFactors.length} factors shown
        </span>
        <div style={styles.countBadges}>
          <Tag color="blue" style={{ fontSize: 10 }}>{universalCount} universal</Tag>
          {exclusiveCount > 0 && (
            <Tag color="gold" style={{ fontSize: 10 }}>{exclusiveCount} exclusive</Tag>
          )}
        </div>
      </div>

      {/* Factor List */}
      {marketFactors.length === 0 ? (
        <Empty description="No factors match your filters" />
      ) : (
        <div style={styles.factorList}>
          {marketFactors.map((f) => {
            const tc = tierConfig[f.tier];
            return (
              <div
                key={f.id}
                style={{
                  ...styles.factorItem,
                  borderLeft: `3px solid ${f.isExclusive ? '#d4a853' : tc.color}`,
                }}
                onClick={() => onSelectFactor?.(f)}
              >
                <div style={styles.itemLeft}>
                  <div style={styles.itemNameRow}>
                    <span style={styles.itemName}>{f.name}</span>
                    {f.isExclusive ? (
                      <Tag color="gold" style={{ fontSize: 9, padding: '0 4px', lineHeight: '16px' }}>
                        Exclusive
                      </Tag>
                    ) : (
                      <Tag style={{ fontSize: 9, padding: '0 4px', lineHeight: '16px', color: '#888', border: '1px solid #444' }}>
                        Universal
                      </Tag>
                    )}
                    <span style={{ color: tc.color, fontSize: 12 }}>{tc.emoji}</span>
                  </div>
                  <div style={styles.itemMeta}>
                    <span style={styles.itemCat}>{f.category}</span>
                    {f.ic != null && (
                      <span style={{
                        ...styles.itemIC,
                        color: f.ic >= 0.03 ? '#66bd63' : f.ic >= 0 ? '#d4a853' : '#f46d43',
                      }}>
                        IC {(f.ic * 100).toFixed(1)}%
                      </span>
                    )}
                    {f.signal && (
                      <span>{f.signal === 'green' ? '🟢' : f.signal === 'yellow' ? '🟡' : '🔴'}</span>
                    )}
                  </div>
                  <p style={styles.itemDesc}>{f.description}</p>
                </div>
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
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#e0e0e0',
    margin: 0,
  },
  subtitle: {
    fontSize: 11,
    color: '#888',
    margin: '4px 0 0',
  },
  tabs: {},
  tabLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  tabFlag: {
    fontSize: 14,
  },
  tabName: {
    fontSize: 12,
    fontWeight: 600,
  },
  tabBadge: {
    fontSize: 9,
    padding: '0 4px',
    marginLeft: 2,
  },
  filterBar: {
    display: 'flex',
    gap: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    minWidth: 180,
    background: '#0f0f1e',
    border: '1px solid #2a2a4a',
    borderRadius: 8,
    color: '#e0e0e0',
  },
  tierBtns: {
    display: 'flex',
    gap: 4,
  },
  tierBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #2a2a4a',
    background: 'transparent',
    color: '#aaa',
    fontSize: 11,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  countBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  countLabel: {
    fontSize: 11,
    color: '#888',
  },
  countBadges: {
    display: 'flex',
    gap: 6,
  },
  factorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 480,
    overflowY: 'auto',
  },
  factorItem: {
    padding: '10px 14px',
    background: '#0f0f1e',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  itemLeft: {},
  itemNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  itemName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e0e0e0',
    fontFamily: 'monospace',
  },
  itemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  itemCat: {
    fontSize: 10,
    color: '#666',
  },
  itemIC: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 600,
  },
  itemDesc: {
    fontSize: 11,
    color: '#888',
    margin: 0,
    lineHeight: 1.4,
  },
};

export { MarketFactorNavigator, generateDemoNavFactors, NAV_MARKETS };
export type { MarketFactorNavigatorProps, NavFactor, NavMarketCode };
