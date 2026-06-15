// ── R198 ML P14-04: AssetClassSelector — 资产大类选择器 + 🛢️大宗商品Tab ──────────
// Extends existing factor navigation with commodity asset class
// Tabs: 📈 Stocks | 🛢️ Commodities | ₿ Crypto | 📊 All
// Commodity tab opens CommodityOnboarding + CommodityFactorGrid
// Color-coded by asset class: Stocks=blue, Commodities=orange, Crypto=purple

import React, { useState, useCallback } from 'react';
import { Tabs, Tag, Card } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
type AssetClass = 'stocks' | 'commodities' | 'crypto' | 'all';

interface AssetClassSelectorProps {
  defaultTab?: AssetClass;
  onTabChange?: (tab: AssetClass) => void;
  stockCount?: number;
  commodityCount?: number;
  cryptoCount?: number;
}

// ── Component ────────────────────────────────────────────────────────
const AssetClassSelector: React.FC<AssetClassSelectorProps> = ({
  defaultTab = 'stocks',
  onTabChange,
  stockCount = 188,
  commodityCount = 14,
  cryptoCount = 62,
}) => {
  const [activeTab, setActiveTab] = useState<AssetClass>(defaultTab);

  const handleChange = useCallback(
    (key: string) => {
      const tab = key as AssetClass;
      setActiveTab(tab);
      onTabChange?.(tab);
    },
    [onTabChange],
  );

  const totalCount = stockCount + commodityCount + cryptoCount;

  const tabItems = [
    {
      key: 'stocks',
      label: (
        <span style={styles.tabLabel}>
          <span style={styles.tabIcon}>📈</span>
          <span style={styles.tabText}>Stocks</span>
          <Tag color="blue" style={styles.tabBadge}>{stockCount}</Tag>
        </span>
      ),
    },
    {
      key: 'commodities',
      label: (
        <span style={styles.tabLabel}>
          <span style={styles.tabIcon}>🛢️</span>
          <span style={styles.tabText}>Commodities</span>
          <Tag color="orange" style={styles.tabBadge}>{commodityCount}</Tag>
        </span>
      ),
    },
    {
      key: 'crypto',
      label: (
        <span style={styles.tabLabel}>
          <span style={styles.tabIcon}>₿</span>
          <span style={styles.tabText}>Crypto</span>
          <Tag color="purple" style={styles.tabBadge}>{cryptoCount}</Tag>
        </span>
      ),
    },
    {
      key: 'all',
      label: (
        <span style={styles.tabLabel}>
          <span style={styles.tabIcon}>🌐</span>
          <span style={styles.tabText}>All</span>
          <Tag style={styles.tabBadge}>{totalCount}</Tag>
        </span>
      ),
    },
  ];

  // Category cards for commodity section
  const commodityCategories = [
    { emoji: '🥇', name: 'Precious Metals', desc: 'Gold, Silver ETF + seasonality', count: 3 },
    { emoji: '🛢️', name: 'Energy', desc: 'Crude, Natural Gas, storage/inventory', count: 5 },
    { emoji: '🔩', name: 'Industrial Metals', desc: 'Copper LME, Aluminum, supply chain', count: 3 },
    { emoji: '🌾', name: 'Agriculture', desc: 'Corn, Soybeans seasonal + weather', count: 3 },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <h2 style={styles.heroTitle}>🧬 Dawn Whales Factor Engine</h2>
        <p style={styles.heroSubtitle}>
          {totalCount} factors across stocks, commodities, and crypto
        </p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={handleChange}
        items={tabItems}
        size="large"
        tabBarStyle={{ borderBottom: '1px solid #2a2a4a' }}
      />

      {/* Commodity Landing Content */}
      {activeTab === 'commodities' && (
        <div style={styles.commoditySection}>
          <div style={styles.commodityHero}>
            <span style={styles.commodityHeroEmoji}>🛢️</span>
            <div>
              <h3 style={styles.commodityHeroTitle}>Commodity Factor Suite — NEW!</h3>
              <p style={styles.commodityHeroDesc}>
                14 commodity-specific factors. Plain language. Institutional inventory data.
              </p>
            </div>
          </div>

          {/* Category Cards */}
          <div style={styles.commodityCatGrid}>
            {commodityCategories.map((cat) => (
              <Card key={cat.name} size="small" style={styles.comCatCard}
                bodyStyle={{ padding: '14px', textAlign: 'center' }}>
                <span style={styles.comCatEmoji}>{cat.emoji}</span>
                <div style={styles.comCatName}>{cat.name}</div>
                <div style={styles.comCatDesc}>{cat.desc}</div>
                <Tag style={{ marginTop: 6 }}>{cat.count} factors</Tag>
              </Card>
            ))}
          </div>

          {/* Quick Highlights */}
          <div style={styles.highlights}>
            <div style={styles.highlight}>
              <span style={styles.highlightIcon}>🔄</span>
              <div>
                <div style={styles.highlightTitle}>Roll Yield</div>
                <div style={styles.highlightDesc}>近月贴水→做多还能额外赚展期收益</div>
              </div>
            </div>
            <div style={styles.highlight}>
              <span style={styles.highlightIcon}>🛢️</span>
              <div>
                <div style={styles.highlightTitle}>EIA Inventory</div>
                <div style={styles.highlightDesc}>美国每周原油库存→实际vs预期差距才是信号</div>
              </div>
            </div>
            <div style={styles.highlight}>
              <span style={styles.highlightIcon}>📅</span>
              <div>
                <div style={styles.highlightTitle}>Seasonality</div>
                <div style={styles.highlightDesc}>6大商品环形日历→一目了然旺季淡季</div>
              </div>
            </div>
            <div style={styles.highlight}>
              <span style={styles.highlightIcon}>🏭</span>
              <div>
                <div style={styles.highlightTitle}>LME Warehouse</div>
                <div style={styles.highlightDesc}>伦敦铜库存+注销仓单→实物短缺预警</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stocks Placeholder (links to existing FactorUniverseHub) */}
      {activeTab === 'stocks' && (
        <div style={styles.placeholder}>
          <span style={styles.placeholderEmoji}>📈</span>
          <div style={styles.placeholderTitle}>Stock Factor Universe</div>
          <div style={styles.placeholderDesc}>
            {stockCount} stock factors across 10 global markets. 🇭🇰🇺🇸🪙🇯🇵🇹🇼🇰🇷🇸🇬🇦🇺🇮🇳🇪🇺
          </div>
          <div style={styles.placeholderStats}>
            <Tag color="green">🌱 31 Basic</Tag>
            <Tag color="gold">🌶️ 68 Advanced</Tag>
            <Tag color="purple">🔴 89 Professional</Tag>
            <Tag color="blue">🌟 44 Exclusive</Tag>
          </div>
        </div>
      )}

      {/* All Tab = Summary */}
      {activeTab === 'all' && (
        <div style={styles.allSection}>
          <div style={styles.allGrid}>
            <Card size="small" style={styles.allCard} bodyStyle={{ textAlign: 'center', padding: 16 }}>
              <span style={{ fontSize: 32 }}>📈</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0', margin: '8px 0' }}>Stocks</div>
              <div style={{ fontSize: 11, color: '#888' }}>{stockCount} factors · 10 markets</div>
            </Card>
            <Card size="small" style={styles.allCard} bodyStyle={{ textAlign: 'center', padding: 16 }}>
              <span style={{ fontSize: 32 }}>🛢️</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0', margin: '8px 0' }}>Commodities</div>
              <div style={{ fontSize: 11, color: '#888' }}>{commodityCount} factors · 4 categories</div>
            </Card>
            <Card size="small" style={styles.allCard} bodyStyle={{ textAlign: 'center', padding: 16 }}>
              <span style={{ fontSize: 32 }}>₿</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0', margin: '8px 0' }}>Crypto</div>
              <div style={{ fontSize: 11, color: '#888' }}>{cryptoCount} factors · On-chain</div>
            </Card>
          </div>
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
  },
  hero: { marginBottom: 16 },
  heroTitle: { fontSize: 20, fontWeight: 800, color: '#e0e0e0', margin: 0 },
  heroSubtitle: { fontSize: 12, color: '#888', margin: '4px 0 0' },
  tabLabel: { display: 'flex', alignItems: 'center', gap: 6 },
  tabIcon: { fontSize: 16 },
  tabText: { fontSize: 13, fontWeight: 600 },
  tabBadge: { fontSize: 10, padding: '0 4px', minWidth: 22, textAlign: 'center' },
  // ── Commodity ──
  commoditySection: { paddingTop: 8 },
  commodityHero: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(255,140,0,0.08)', borderRadius: 10, border: '1px solid rgba(255,140,0,0.2)', marginBottom: 14 },
  commodityHeroEmoji: { fontSize: 36 },
  commodityHeroTitle: { fontSize: 15, fontWeight: 700, color: '#FF8C00', margin: 0 },
  commodityHeroDesc: { fontSize: 11, color: '#aaa', margin: '2px 0 0' },
  commodityCatGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 },
  comCatCard: { background: '#0f0f1e', border: '1px solid #2a2a4a', borderRadius: 10 },
  comCatEmoji: { fontSize: 28 },
  comCatName: { fontSize: 12, fontWeight: 600, color: '#e0e0e0', margin: '4px 0' },
  comCatDesc: { fontSize: 10, color: '#888', lineHeight: 1.3 },
  highlights: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 },
  highlight: { display: 'flex', gap: 10, padding: '12px', background: '#0f0f1e', borderRadius: 8, border: '1px solid #2a2a4a', alignItems: 'center' },
  highlightIcon: { fontSize: 22, flexShrink: 0 },
  highlightTitle: { fontSize: 12, fontWeight: 600, color: '#e0e0e0' },
  highlightDesc: { fontSize: 10, color: '#888', marginTop: 2 },
  // ── Placeholder ──
  placeholder: { textAlign: 'center', padding: '30px 0' },
  placeholderEmoji: { fontSize: 40, display: 'block', marginBottom: 8 },
  placeholderTitle: { fontSize: 16, fontWeight: 700, color: '#e0e0e0' },
  placeholderDesc: { fontSize: 12, color: '#888', margin: '4px 0 12px' },
  placeholderStats: { display: 'flex', justifyContent: 'center', gap: 8 },
  // ── All ──
  allSection: { paddingTop: 8 },
  allGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  allCard: { background: '#0f0f1e', border: '1px solid #2a2a4a', borderRadius: 10 },
};

export { AssetClassSelector };
export type { AssetClassSelectorProps, AssetClass };
