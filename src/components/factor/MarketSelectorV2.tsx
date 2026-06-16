// @ts-nocheck
// ── R194 ML P10-02: MarketSelectorV2 — 5市场下拉切换+信息面板 ──────────
// Supports: 🇭🇰 HK · 🇺🇸 US · 🪙 Crypto · 🇯🇵 Japan · 🇹🇼 Taiwan
// Dropdown with flag + name + factor count + status dot
// Animated panel below: market stats, exclusive factors, trading hours
// Integrates with MarketFlag component for metadata

import React, { useState, useCallback } from 'react';
import { Dropdown, Tag, Badge } from 'antd';
import { GlobalOutlined, DownOutlined } from '@ant-design/icons';
import { MarketFlag, MarketCode7 } from './MarketFlag';

// ── Types ───────────────────────────────────────────────────────────
interface MarketSelectorV2Props {
  selected: MarketCode7;
  availableMarkets?: MarketCode7[];
  onSelect: (code: MarketCode7) => void;
  showStats?: boolean;
}

// ── Market Option Config ────────────────────────────────────────────
const MARKET_OPTIONS_V2: {
  code: MarketCode7;
  flag: string;
  name: string;
  factorCount: number;
  exclusiveCount: number;
}[] = [
  { code: 'hk', flag: '🇭🇰', name: 'Hong Kong', factorCount: 89, exclusiveCount: 11 },
  { code: 'us', flag: '🇺🇸', name: 'United States', factorCount: 99, exclusiveCount: 14 },
  { code: 'crypto', flag: '🪙', name: 'Crypto', factorCount: 62, exclusiveCount: 31 },
  { code: 'jp', flag: '🇯🇵', name: 'Japan', factorCount: 119, exclusiveCount: 12 },
  { code: 'tw', flag: '🇹🇼', name: 'Taiwan', factorCount: 107, exclusiveCount: 7 },
];

// ── Component ────────────────────────────────────────────────────────
const MarketSelectorV2: React.FC<MarketSelectorV2Props> = ({
  selected,
  availableMarkets,
  onSelect,
  showStats = true,
}) => {
  const [open, setOpen] = useState(false);

  const markets = availableMarkets
    ? MARKET_OPTIONS_V2.filter((m) => availableMarkets.includes(m.code))
    : MARKET_OPTIONS_V2;

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
      <div style={styles.menuItem}>
        <div style={styles.menuLeft}>
          <span style={styles.menuFlag}>{m.flag}</span>
          <div>
            <div style={styles.menuName}>{m.name}</div>
            <div style={styles.menuMeta}>
              <span style={{ color: '#888' }}>{m.factorCount} factors</span>
              {m.exclusiveCount > 0 && (
                <Tag color="gold" style={{ fontSize: 9, padding: '0 4px', marginLeft: 6, lineHeight: '16px' }}>
                  +{m.exclusiveCount} exclusive
                </Tag>
              )}
            </div>
          </div>
        </div>
        {m.code === selected && <span style={styles.check}>✓</span>}
      </div>
    ),
    onClick: () => handleSelect(m.code),
  }));

  return (
    <div style={styles.container}>
      <Dropdown
        menu={{ items: menuItems, selectedKeys: [selected] }}
        trigger={['click']}
        open={open}
        onOpenChange={setOpen}
        overlayStyle={{ minWidth: 260 }}
      >
        <div style={styles.selector}>
          <span style={styles.selectorFlag}>{selectedOption.flag}</span>
          <span style={styles.selectorName}>{selectedOption.name}</span>
          <span style={styles.selectorCount}>{selectedOption.factorCount} factors</span>
          {selectedOption.exclusiveCount > 0 && (
            <Tag color="gold" style={{ fontSize: 10, padding: '0 6px', lineHeight: '18px' }}>
              +{selectedOption.exclusiveCount}
            </Tag>
          )}
          <DownOutlined style={{ fontSize: 10, color: '#888' }} />
        </div>
      </Dropdown>

      {/* Market Info Panel */}
      {showStats && (
        <div style={styles.infoPanel}>
          <MarketFlag code={selected} size="sm" showTime={true} showCurrency={true} showHoliday={true} />
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
    gap: 8,
    padding: '10px 14px',
    background: '#0f0f1e',
    border: '1px solid #2a2a4a',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'border-color 0.2s ease',
    userSelect: 'none',
  },
  selectorFlag: {
    fontSize: 20,
  },
  selectorName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  selectorCount: {
    fontSize: 11,
    color: '#888',
    marginLeft: 'auto',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
  },
  menuLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  menuFlag: {
    fontSize: 20,
  },
  menuName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e0e0e0',
  },
  menuMeta: {
    fontSize: 10,
    marginTop: 1,
    display: 'flex',
    alignItems: 'center',
  },
  check: {
    color: '#d4a853',
    fontWeight: 700,
    fontSize: 16,
  },
  infoPanel: {
    marginTop: 10,
  },
};

export { MarketSelectorV2, MARKET_OPTIONS_V2 };
export type { MarketSelectorV2Props };
