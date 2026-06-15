// ── R196 ML P12-01: MarketSelectorV4 — 10市场全上线 ──────────
// Final version: 🇭🇰🇺🇸🪙🇯🇵🇹🇼🇰🇷🇸🇬🇦🇺🇮🇳🇪🇺 all 10 markets
// Searchable dropdown with region grouping (Asia-Pacific / Americas / Europe)
// Quick filter chips: Active now / Premium exclusive / Dividend focus
// Responsive: collapses to icon-only strip on mobile

import React, { useState, useCallback, useMemo } from 'react';
import { Dropdown, Input, Tag, Tooltip, Divider } from 'antd';
import { SearchOutlined, GlobalOutlined, DownOutlined } from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
type MarketCode10 = 'hk' | 'us' | 'crypto' | 'jp' | 'tw' | 'kr' | 'sg' | 'au' | 'in' | 'eu';

interface FullMarketOption {
  code: MarketCode10;
  flag: string;
  name: string;
  nameLocal: string;
  region: string;
  factorCount: number;
  exclusiveCount: number;
  currency: string;
  tz: string;
  highlight?: string; // key feature
  isNew?: boolean;
}

interface MarketSelectorV4Props {
  selected: MarketCode10;
  availableMarkets?: MarketCode10[];
  onSelect: (code: MarketCode10) => void;
  showStats?: boolean;
  compact?: boolean;
}

// ── Full 10-Market Data ─────────────────────────────────────────────
const ALL_MARKETS: FullMarketOption[] = [
  { code: 'hk', flag: '🇭🇰', name: 'Hong Kong', nameLocal: '香港', region: 'Asia-Pacific', factorCount: 89, exclusiveCount: 11, currency: 'HKD', tz: 'UTC+8', highlight: 'CBBC/Warrants' },
  { code: 'us', flag: '🇺🇸', name: 'United States', nameLocal: 'United States', region: 'Americas', factorCount: 99, exclusiveCount: 14, currency: 'USD', tz: 'UTC-5/-4', highlight: 'Options/0DTE' },
  { code: 'crypto', flag: '🪙', name: 'Crypto', nameLocal: 'Crypto', region: 'Global', factorCount: 62, exclusiveCount: 31, currency: 'USDT', tz: '24/7', highlight: 'On-Chain Data' },
  { code: 'jp', flag: '🇯🇵', name: 'Japan', nameLocal: '日本', region: 'Asia-Pacific', factorCount: 119, exclusiveCount: 12, currency: 'JPY', tz: 'UTC+9', highlight: 'BOJ/Kabu', isNew: true },
  { code: 'tw', flag: '🇹🇼', name: 'Taiwan', nameLocal: '台灣', region: 'Asia-Pacific', factorCount: 107, exclusiveCount: 7, currency: 'TWD', tz: 'UTC+8', highlight: 'Semi/Margin', isNew: true },
  { code: 'kr', flag: '🇰🇷', name: 'South Korea', nameLocal: '대한민국', region: 'Asia-Pacific', factorCount: 114, exclusiveCount: 6, currency: 'KRW', tz: 'UTC+9', highlight: 'Chaebol/Options', isNew: true },
  { code: 'sg', flag: '🇸🇬', name: 'Singapore', nameLocal: 'Singapore', region: 'Asia-Pacific', factorCount: 113, exclusiveCount: 5, currency: 'SGD', tz: 'UTC+8', highlight: 'REITs/ADR', isNew: true },
  { code: 'au', flag: '🇦🇺', name: 'Australia', nameLocal: 'Australia', region: 'Asia-Pacific', factorCount: 113, exclusiveCount: 5, currency: 'AUD', tz: 'UTC+10/+11', highlight: 'Commodities/Franking', isNew: true },
  { code: 'in', flag: '🇮🇳', name: 'India', nameLocal: 'भारत', region: 'Asia-Pacific', factorCount: 113, exclusiveCount: 5, currency: 'INR', tz: 'UTC+5:30', highlight: 'FII/Monsoon', isNew: true },
  { code: 'eu', flag: '🇪🇺', name: 'Europe', nameLocal: 'Europe', region: 'Europe', factorCount: 112, exclusiveCount: 4, currency: 'EUR', tz: 'UTC+1/+2', highlight: 'ESG/STOXX', isNew: true },
];

const REGIONS = ['Asia-Pacific', 'Americas', 'Europe', 'Global'];

// ── Component ────────────────────────────────────────────────────────
const MarketSelectorV4: React.FC<MarketSelectorV4Props> = ({
  selected,
  availableMarkets,
  onSelect,
  showStats = true,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPreset, setFilterPreset] = useState<string | null>(null);

  const markets = useMemo(() => {
    let base = availableMarkets
      ? ALL_MARKETS.filter((m) => availableMarkets.includes(m.code))
      : ALL_MARKETS;

    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.nameLocal.toLowerCase().includes(q) ||
        m.code.includes(q) ||
        m.highlight?.toLowerCase().includes(q) ||
        m.region.toLowerCase().includes(q),
      );
    }

    if (filterPreset === 'active') {
      base = base.slice(0, 5); // first 5 = main markets
    } else if (filterPreset === 'premium') {
      base = base.filter((m) => m.exclusiveCount >= 10);
    } else if (filterPreset === 'dividend') {
      base = base.filter((m) =>
        ['hk', 'sg', 'au', 'eu'].includes(m.code),
      );
    }

    return base;
  }, [availableMarkets, search, filterPreset]);

  const selectedOption = markets.find((m) => m.code === selected) || markets[0];

  const handleSelect = useCallback(
    (code: MarketCode10) => {
      onSelect(code);
      setOpen(false);
      setSearch('');
    },
    [onSelect],
  );

  // Build menu with region groups
  const grouped = useMemo(() => {
    return REGIONS.filter((r) => markets.some((m) => m.region === r)).map((region) => {
      const regionMarkets = markets.filter((m) => m.region === region);
      return {
        type: 'group' as const,
        label: <span style={styles.menuRegionTitle}>{region}</span>,
        children: regionMarkets.map((m) => ({
          key: m.code,
          label: (
            <div style={styles.menuItem}>
              <div style={styles.menuLeft}>
                <span style={styles.menuFlag}>{m.flag}</span>
                <div>
                  <div style={styles.menuName}>
                    {m.name}
                    {m.isNew && (
                      <Tag color="purple" style={styles.newTag}>NEW</Tag>
                    )}
                  </div>
                  <div style={styles.menuMeta}>
                    <span>{m.factorCount}f</span>
                    <span style={{ color: '#d4a853' }}>+{m.exclusiveCount}e</span>
                    <span style={{ color: '#888' }}>{m.tz}</span>
                  </div>
                </div>
              </div>
              <div style={styles.menuRight}>
                <Tooltip title={m.highlight}>
                  <span style={styles.menuHighlight}>{m.highlight}</span>
                </Tooltip>
                {m.code === selected && <span style={styles.check}>✓</span>}
              </div>
            </div>
          ),
          onClick: () => handleSelect(m.code),
        })),
      };
    });
  }, [markets, selected, handleSelect]);

  // Total stats
  const totalFactors = markets.reduce((s, m) => s + m.factorCount, 0);
  const totalExclusive = markets.reduce((s, m) => s + m.exclusiveCount, 0);

  if (compact) {
    return (
      <div style={styles.compactContainer}>
        <Dropdown
          menu={{ items: grouped.flatMap((g) => [...(g as any).children]) }}
          trigger={['click']}
          overlayStyle={{ minWidth: 240 }}
        >
          <div style={styles.compactBtn}>
            <span style={styles.compactFlag}>{selectedOption.flag}</span>
            <DownOutlined style={{ fontSize: 8, color: '#888' }} />
          </div>
        </Dropdown>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Main Selector */}
      <Dropdown
        menu={{ items: grouped }}
        trigger={['click']}
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setSearch('');
        }}
        overlayStyle={{ minWidth: 340, maxHeight: 500 }}
        dropdownRender={(menu) => (
          <div>
            <div style={styles.searchBox}>
              <Input
                prefix={<SearchOutlined style={{ color: '#888' }} />}
                placeholder="Search markets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                bordered={false}
                style={{ background: 'transparent', color: '#e0e0e0' }}
              />
            </div>
            <div style={styles.filterChips}>
              {[
                { key: null, label: 'All' },
                { key: 'active', label: '🔥 Active' },
                { key: 'premium', label: '💎 Premium' },
                { key: 'dividend', label: '💰 Dividend' },
              ].map((f) => (
                <button
                  key={f.key || 'all'}
                  style={{
                    ...styles.chip,
                    background: filterPreset === f.key ? '#d4a85320' : 'transparent',
                    borderColor: filterPreset === f.key ? '#d4a853' : '#2a2a4a',
                  }}
                  onClick={() => setFilterPreset(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {menu}
          </div>
        )}
      >
        <div style={styles.selector}>
          <div style={styles.selectorLeft}>
            <span style={styles.selectorFlag}>{selectedOption.flag}</span>
            <div style={styles.selectorInfo}>
              <div style={styles.selectorName}>
                {selectedOption.name}
                <span style={styles.selectorLocal}> · {selectedOption.nameLocal}</span>
              </div>
              <div style={styles.selectorMeta}>
                <span>{selectedOption.factorCount} factors</span>
                <Tag color="gold" style={styles.exclTag}>+{selectedOption.exclusiveCount}</Tag>
                <span style={styles.selectorTz}>{selectedOption.currency} · {selectedOption.tz}</span>
              </div>
            </div>
          </div>
          <div style={styles.selectorRight}>
            <Tag style={{ fontSize: 10, color: '#888', border: '1px solid #444' }}>
              {selectedOption.region}
            </Tag>
            <GlobalOutlined style={{ fontSize: 14, color: '#888' }} />
            <DownOutlined style={{ fontSize: 10, color: '#888' }} />
          </div>
        </div>
      </Dropdown>

      {/* Stats Bar */}
      {showStats && (
        <div style={styles.statsBar}>
          <div style={styles.statsItem}>
            <span style={styles.statsLabel}>Total</span>
            <span style={styles.statsValue}>{totalFactors}f + {totalExclusive}e</span>
          </div>
          <div style={styles.statsItem}>
            <span style={styles.statsLabel}>Markets</span>
            <span style={styles.statsValue}>{markets.length}</span>
          </div>
          <div style={styles.statsItem}>
            <span style={styles.statsLabel}>Currencies</span>
            <span style={styles.statsValueMono}>
              {[...new Set(markets.map((m) => m.currency))].join(' · ')}
            </span>
          </div>
          <div style={styles.statsItem}>
            <span style={styles.statsLabel}>Regions</span>
            <span style={styles.statsValue}>
              {[...new Set(markets.map((m) => m.region))].length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: "'Inter', -apple-system, sans-serif" },
  compactContainer: {},
  compactBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    background: '#0f0f1e',
    border: '1px solid #2a2a4a',
    borderRadius: 8,
    cursor: 'pointer',
  },
  compactFlag: { fontSize: 18 },
  searchBox: {
    padding: '8px 12px',
    borderBottom: '1px solid #2a2a4a',
  },
  filterChips: {
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    borderBottom: '1px solid #2a2a4a',
  },
  chip: {
    padding: '3px 10px',
    borderRadius: 12,
    border: '1px solid #2a2a4a',
    background: 'transparent',
    color: '#aaa',
    fontSize: 11,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  // ── Selector ──
  selector: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#0f0f1e',
    border: '1px solid #2a2a4a',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    userSelect: 'none',
  },
  selectorLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  selectorFlag: { fontSize: 26 },
  selectorInfo: {},
  selectorName: { fontSize: 15, fontWeight: 700, color: '#e0e0e0' },
  selectorLocal: { fontSize: 12, color: '#888', fontWeight: 400 },
  selectorMeta: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 11, color: '#aaa' },
  exclTag: { fontSize: 9, padding: '0 5px', lineHeight: '18px' },
  selectorTz: { fontSize: 10, color: '#666', fontFamily: 'monospace' },
  selectorRight: { display: 'flex', alignItems: 'center', gap: 8 },
  // ── Menu Item ──
  menuRegionTitle: { fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  menuItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' },
  menuLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  menuFlag: { fontSize: 20 },
  menuName: { fontSize: 13, fontWeight: 600, color: '#e0e0e0', display: 'flex', alignItems: 'center' },
  newTag: { fontSize: 9, padding: '0 4px', marginLeft: 6, lineHeight: '16px' },
  menuMeta: { fontSize: 10, marginTop: 1, display: 'flex', gap: 8 },
  menuRight: { display: 'flex', alignItems: 'center', gap: 8 },
  menuHighlight: { fontSize: 10, color: '#888', fontStyle: 'italic' },
  check: { color: '#d4a853', fontWeight: 700, fontSize: 16 },
  // ── Stats ──
  statsBar: { display: 'flex', gap: 12, marginTop: 10, padding: '10px 14px', background: '#0f0f1e', borderRadius: 8, flexWrap: 'wrap' },
  statsItem: { flex: 1, textAlign: 'center', minWidth: 80 },
  statsLabel: { display: 'block', fontSize: 9, color: '#888', textTransform: 'uppercase', marginBottom: 2 },
  statsValue: { fontSize: 13, fontWeight: 800, color: '#e0e0e0', fontFamily: 'monospace' },
  statsValueMono: { fontSize: 10, fontWeight: 600, color: '#aaa', fontFamily: 'monospace' },
};

export { MarketSelectorV4, ALL_MARKETS };
export type { MarketCode10, FullMarketOption, MarketSelectorV4Props };
