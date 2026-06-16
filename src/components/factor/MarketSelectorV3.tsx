// @ts-nocheck
// ── R195 ML P11-01: MarketSelectorV3 — 7市场全切换 + 快速统计面板 ──────────
// Extends V2 with 🇰🇷 Korea + 🇸🇬 Singapore + 🇦🇺 Australia
// Shows all 7 markets in dropdown with factor/exclusive counts
// Quick stats bar: total factors per selected market
// Props: selected, onSelect, availableMarkets, showStats

import React, { useState, useCallback, useMemo } from 'react';
import { Dropdown, Tag } from 'antd';
import { GlobalOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
type MarketCode7 = 'hk' | 'us' | 'crypto' | 'jp' | 'tw' | 'kr' | 'sg' | 'au';

interface MarketOptionV3 {
  code: MarketCode7;
  flag: string;
  name: string;
  nameLocal: string;
  factorCount: number;
  exclusiveCount: number;
  currency: string;
  tz: string;
  isNew?: boolean;
}

interface MarketSelectorV3Props {
  selected: MarketCode7;
  availableMarkets?: MarketCode7[];
  onSelect: (code: MarketCode7) => void;
  showStats?: boolean;
}

// ── Market Data ─────────────────────────────────────────────────────
const MARKET_OPTIONS_V3: MarketOptionV3[] = [
  { code: 'hk', flag: '🇭🇰', name: 'Hong Kong', nameLocal: '香港', factorCount: 89, exclusiveCount: 11, currency: 'HKD', tz: 'UTC+8' },
  { code: 'us', flag: '🇺🇸', name: 'United States', nameLocal: 'United States', factorCount: 99, exclusiveCount: 14, currency: 'USD', tz: 'UTC-5/-4' },
  { code: 'crypto', flag: '🪙', name: 'Crypto', nameLocal: 'Crypto', factorCount: 62, exclusiveCount: 31, currency: 'USDT', tz: '24/7' },
  { code: 'jp', flag: '🇯🇵', name: 'Japan', nameLocal: '日本', factorCount: 119, exclusiveCount: 12, currency: 'JPY', tz: 'UTC+9', isNew: true },
  { code: 'tw', flag: '🇹🇼', name: 'Taiwan', nameLocal: '台灣', factorCount: 107, exclusiveCount: 7, currency: 'TWD', tz: 'UTC+8', isNew: true },
  { code: 'kr', flag: '🇰🇷', name: 'South Korea', nameLocal: '대한민국', factorCount: 114, exclusiveCount: 6, currency: 'KRW', tz: 'UTC+9', isNew: true },
  { code: 'sg', flag: '🇸🇬', name: 'Singapore', nameLocal: 'Singapore', factorCount: 113, exclusiveCount: 5, currency: 'SGD', tz: 'UTC+8', isNew: true },
  { code: 'au', flag: '🇦🇺', name: 'Australia', nameLocal: 'Australia', factorCount: 113, exclusiveCount: 5, currency: 'AUD', tz: 'UTC+10/+11', isNew: true },
];

// ── Component ────────────────────────────────────────────────────────
const MarketSelectorV3: React.FC<MarketSelectorV3Props> = ({
  selected,
  availableMarkets,
  onSelect,
  showStats = true,
}) => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<MarketCode7 | null>(null);

  const markets = useMemo(() => {
    const base = availableMarkets
      ? MARKET_OPTIONS_V3.filter((m) => availableMarkets.includes(m.code))
      : MARKET_OPTIONS_V3;
    return base;
  }, [availableMarkets]);

  const selectedOption = markets.find((m) => m.code === selected) || markets[0];

  const handleSelect = useCallback(
    (code: MarketCode7) => {
      onSelect(code);
      setOpen(false);
    },
    [onSelect],
  );

  const menuItems = markets.map((m) => ({
    key: m.code,
    label: (
      <div
        style={styles.menuItem}
        onMouseEnter={() => setPreview(m.code)}
        onMouseLeave={() => setPreview(null)}
      >
        <div style={styles.menuLeft}>
          <span style={styles.menuFlag}>{m.flag}</span>
          <div>
            <div style={styles.menuName}>
              {m.name}
              {m.isNew && <Tag color="purple" style={{ fontSize: 9, padding: '0 4px', marginLeft: 6, lineHeight: '16px' }}>NEW</Tag>}
            </div>
            <div style={styles.menuMeta}>
              <span style={{ color: '#888' }}>{m.factorCount} factors</span>
              {m.exclusiveCount > 0 && (
                <span style={{ color: '#d4a853', marginLeft: 4 }}>
                  +{m.exclusiveCount} exclusive
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={styles.menuRight}>
          <span style={styles.menuTz}>{m.tz}</span>
          {m.code === selected && <span style={styles.check}>✓</span>}
        </div>
      </div>
    ),
    onClick: () => handleSelect(m.code),
  }));

  // Aggregate stats
  const totalFactors = markets.reduce((s, m) => s + m.factorCount, 0);
  const totalExclusive = markets.reduce((s, m) => s + m.exclusiveCount, 0);

  return (
    <div style={styles.container}>
      {/* Main Selector */}
      <Dropdown
        menu={{ items: menuItems, selectedKeys: [selected] }}
        trigger={['click']}
        open={open}
        onOpenChange={setOpen}
        overlayStyle={{ minWidth: 300, maxHeight: 400 }}
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
                {selectedOption.exclusiveCount > 0 && (
                  <Tag color="gold" style={styles.exclTag}>
                    +{selectedOption.exclusiveCount} exclusive
                  </Tag>
                )}
              </div>
            </div>
          </div>
          <div style={styles.selectorRight}>
            <span style={styles.selectorTz}>{selectedOption.tz}</span>
            <DownOutlined style={{ fontSize: 10, color: '#888' }} />
          </div>
        </div>
      </Dropdown>

      {/* Quick Stats Bar */}
      {showStats && (
        <div style={styles.statsBar}>
          <div style={styles.statsItem}>
            <span style={styles.statsLabel}>Total Factors</span>
            <span style={styles.statsValue}>{totalFactors}</span>
          </div>
          <div style={styles.statsItem}>
            <span style={styles.statsLabel}>Exclusive</span>
            <span style={styles.statsValueGold}>{totalExclusive}</span>
          </div>
          <div style={styles.statsItem}>
            <span style={styles.statsLabel}>Markets</span>
            <span style={styles.statsValue}>{markets.length}</span>
          </div>
          <div style={styles.statsItem}>
            <span style={styles.statsLabel}>Currencies</span>
            <span style={styles.statsValueMono}>
              {[...new Set(markets.map((m) => m.currency))].join('/')}
            </span>
          </div>
        </div>
      )}

      {/* Market Preview Chip (on hover) */}
      {preview && (
        <div style={styles.previewBar}>
          <div style={styles.previewContent}>
            {(() => {
              const m = markets.find((mk) => mk.code === preview);
              if (!m) return null;
              return (
                <>
                  <span style={styles.previewFlag}>{m.flag}</span>
                  <span style={styles.previewName}>{m.name}</span>
                  <span style={styles.previewLocal}>— {m.nameLocal}</span>
                  <span style={styles.previewMeta}>
                    {m.factorCount} factors · {m.exclusiveCount} exclusive · {m.currency} · {m.tz}
                  </span>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  selector: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#0f0f1e',
    border: '1px solid #2a2a4a',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    userSelect: 'none',
  },
  selectorLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  selectorFlag: {
    fontSize: 24,
  },
  selectorInfo: {},
  selectorName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  selectorLocal: {
    fontSize: 12,
    color: '#888',
    fontWeight: 400,
  },
  selectorMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    fontSize: 11,
    color: '#aaa',
  },
  exclTag: {
    fontSize: 9,
    padding: '0 5px',
    lineHeight: '18px',
  },
  selectorRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  selectorTz: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
  },
  // ── Menu Item ──
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
  },
  menuLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  menuFlag: {
    fontSize: 22,
  },
  menuName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
  },
  menuMeta: {
    fontSize: 10,
    marginTop: 1,
  },
  menuRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  menuTz: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#666',
  },
  check: {
    color: '#d4a853',
    fontWeight: 700,
    fontSize: 16,
  },
  // ── Stats Bar ──
  statsBar: {
    display: 'flex',
    gap: 12,
    marginTop: 10,
    padding: '10px 14px',
    background: '#0f0f1e',
    borderRadius: 8,
    flexWrap: 'wrap',
  },
  statsItem: {
    flex: 1,
    textAlign: 'center',
    minWidth: 80,
  },
  statsLabel: {
    display: 'block',
    fontSize: 9,
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statsValue: {
    fontSize: 16,
    fontWeight: 800,
    color: '#e0e0e0',
    fontFamily: 'monospace',
  },
  statsValueGold: {
    fontSize: 16,
    fontWeight: 800,
    color: '#d4a853',
    fontFamily: 'monospace',
  },
  statsValueMono: {
    fontSize: 12,
    fontWeight: 600,
    color: '#aaa',
    fontFamily: 'monospace',
  },
  // ── Preview Bar ──
  previewBar: {
    marginTop: 8,
  },
  previewContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: 'rgba(212,168,83,0.08)',
    borderRadius: 6,
    fontSize: 12,
  },
  previewFlag: {
    fontSize: 18,
  },
  previewName: {
    fontWeight: 600,
    color: '#e0e0e0',
  },
  previewLocal: {
    color: '#888',
  },
  previewMeta: {
    marginLeft: 'auto',
    color: '#666',
    fontSize: 10,
  },
};

export { MarketSelectorV3, MARKET_OPTIONS_V3 };
export type { MarketSelectorV3Props, MarketCode7 as MarketCode7V3, MarketOptionV3 };
