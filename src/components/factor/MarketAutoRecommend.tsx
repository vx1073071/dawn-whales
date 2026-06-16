// @ts-nocheck
// ── R197 ML P13-01: MarketAutoRecommend — 10市场因材施教推荐 ──────────
// Select market → auto-recommend best local factors (universal + exclusive)
// Uses market profile: investor type, market structure, data availability
// 3 recommendation tiers: 🏆 Must-have / ⭐ Strong / 💡 Optional
// Shows why each factor is recommended for this market
// One-click "Add All" to strategy workspace

import React, { useState, useMemo, useCallback } from 'react';
import { Tag, Button, Card, Empty, Tooltip } from 'antd';
import { PlusOutlined, StarFilled } from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
type MarketCode = 'hk' | 'us' | 'crypto' | 'jp' | 'tw' | 'kr' | 'sg' | 'au' | 'in' | 'eu';

interface RecommendedFactor {
  id: string;
  name: string;
  tier: 't1_must' | 't2_strong' | 't3_optional';
  reason: string;
  isExclusive: boolean;
  ic: number;
  price?: number;
}

interface MarketProfile {
  code: MarketCode;
  flag: string;
  name: string;
  investorType: string;
  marketCharacter: string;
  recommendationTagline: string;
  recommendations: RecommendedFactor[];
}

interface MarketAutoRecommendProps {
  onAddFactor?: (factorId: string) => void;
  onAddAll?: (factorIds: string[]) => void;
  profiles?: MarketProfile[];
}

// ── Market Profiles ──────────────────────────────────────────────────
const MARKET_PROFILES: MarketProfile[] = [
  {
    code: 'hk', flag: '🇭🇰', name: 'Hong Kong',
    investorType: 'Institutional + Southbound',
    marketCharacter: 'Bridge between China & global capital. High dividend culture. CBBC/Warrants ecosystem.',
    recommendationTagline: 'Profit from H-share premium decay + CBBC flow signals',
    recommendations: [
      { id: 'HK_CBBC_RATIO', name: 'CBBC Bull/Bear Ratio', tier: 't1_must', reason: 'CBBC flow predicts +2.1% 5-day forward return', isExclusive: true, ic: 0.048 },
      { id: 'HK_SOUTHBOUND_SMART', name: 'Southbound Smart Money', tier: 't1_must', reason: 'Mainland institutional flows lead H-share moves by 3 days', isExclusive: true, ic: 0.043 },
      { id: 'DIVIDEND_YIELD', name: 'Dividend Yield', tier: 't1_must', reason: 'HK stocks average 3.2% yield, highest among developed Asia', isExclusive: false, ic: 0.022 },
      { id: 'HK_SHORT_SELL_RATIO', name: 'Short Sell Ratio', tier: 't2_strong', reason: 'HK short sell > 20% of volume signals -3.5% mean reversion', isExclusive: true, ic: -0.025 },
      { id: 'PB_RATIO', name: 'PB Ratio', tier: 't2_strong', reason: 'H-share P/B < 0.8 historically mean-reverts within 6 months', isExclusive: false, ic: 0.031 },
      { id: 'BAB', name: 'Bet Against Beta', tier: 't3_optional', reason: 'Low beta HK stocks benefit from defensive positioning', isExclusive: false, ic: 0.019, price: 0 },
    ],
  },
  {
    code: 'us', flag: '🇺🇸', name: 'United States',
    investorType: 'Institutional + Retail + HFT',
    marketCharacter: 'Deepest option market globally. 0DTE phenomenon. Earnings surprise culture.',
    recommendationTagline: 'Exploit options flow + earnings drift + short squeeze mechanics',
    recommendations: [
      { id: 'GAMMA_EXPOSURE', name: 'Gamma Exposure', tier: 't1_must', reason: 'GEX level drives intraday volatility. Best US exclusive factor.', isExclusive: true, ic: 0.053, price: 1 },
      { id: 'EARNINGS_SURPRISE', name: 'Earnings Surprise', tier: 't1_must', reason: 'Top-decile surprise stocks beat by +3.8% in 60 days post-announcement', isExclusive: false, ic: 0.041 },
      { id: 'MOM_12M1M', name: '12-1M Momentum', tier: 't1_must', reason: 'US momentum premium is largest globally. Skips reversal month.', isExclusive: false, ic: 0.046 },
      { id: 'US_POST_EARNINGS_DRIFT', name: 'PEAD Effect', tier: 't2_strong', reason: 'Post-earnings announcement drift persists 60 trading days', isExclusive: true, ic: 0.038 },
      { id: 'SHORT_INTEREST', name: 'Short Interest', tier: 't2_strong', reason: 'US short data is most transparent. Crowded shorts squeeze predictably.', isExclusive: false, ic: -0.019 },
      { id: 'OPTION_FLOW', name: 'Option Flow', tier: 't3_optional', reason: 'Unusual option activity pre-signals earnings and M&A', isExclusive: true, ic: 0.044, price: 1 },
    ],
  },
  {
    code: 'crypto', flag: '🪙', name: 'Crypto',
    investorType: 'Retail + Whale + Algo',
    marketCharacter: 'On-chain transparency. 24/7 trading. Funding rate extremes.',
    recommendationTagline: 'On-chain data reveals whale moves before price',
    recommendations: [
      { id: 'CRYPTO_PUELL', name: 'Puell Multiple', tier: 't1_must', reason: 'Miner revenue cycles perfectly match Bitcoin macro bottoms', isExclusive: true, ic: 0.061, price: 1 },
      { id: 'CRYPTO_MVRV_Z', name: 'MVRV Z-Score', tier: 't1_must', reason: 'Market value to realized value — the Bitcoin valuation anchor', isExclusive: true, ic: 0.055 },
      { id: 'CRYPTO_FUNDING_EXTREME', name: 'Funding Rate Extreme', tier: 't1_must', reason: 'Funding rate > 0.1% signals overheated longs → squeeze', isExclusive: true, ic: 0.048 },
      { id: 'CRYPTO_EXCHANGE_FLOW', name: 'Exchange Flow', tier: 't2_strong', reason: 'Exchange inflow spike precedes -6% correction', isExclusive: true, ic: -0.038 },
      { id: 'CRYPTO_STABLECOIN_RATIO', name: 'Stablecoin Ratio', tier: 't2_strong', reason: 'Stablecoin supply growth = dry powder = bullish BTC', isExclusive: true, ic: 0.042 },
      { id: 'MOM_6M', name: '6M Momentum', tier: 't3_optional', reason: 'Crypto trends are pronounced. 6-month momentum captures major cycles.', isExclusive: false, ic: 0.035 },
    ],
  },
  {
    code: 'jp', flag: '🇯🇵', name: 'Japan',
    investorType: 'Foreign + BOJ + Domestic institutions',
    marketCharacter: 'BOJ ETF buying floor. Yen sensitivity dominates. Corporate governance reform.',
    recommendationTagline: 'Track BOJ + foreign flow + governance reform alpha',
    recommendations: [
      { id: 'JP_FOREIGN_FLOW', name: 'Foreign Net Buying', tier: 't1_must', reason: 'Foreigners = 60% TSE volume. 3-week sustained buying = +2.8% TOPIX', isExclusive: true, ic: 0.046 },
      { id: 'JP_BOJ_ETF', name: 'BOJ ETF Purchases', tier: 't1_must', reason: 'BOJ ¥70B+ daily ETF buy = +0.3% next-day TOPIX', isExclusive: true, ic: 0.038 },
      { id: 'JP_CROSS_HOLDING', name: 'Cross-Holding Ratio', tier: 't2_strong', reason: 'Unwinding cross-holdings = governance alpha. ROE +2.5% for reformers', isExclusive: true, ic: 0.042, price: 1 },
      { id: 'JPY_SENSITIVITY', name: 'JPY Sensitivity', tier: 't2_strong', reason: 'Exporters rally above ¥150/USD. Domestics below ¥130.', isExclusive: true, ic: 0.028 },
      { id: 'BAB', name: 'Bet Against Beta', tier: 't3_optional', reason: 'Japanese low-vol anomaly is well-documented', isExclusive: false, ic: 0.021 },
      { id: 'ROE', name: 'ROE', tier: 't3_optional', reason: 'TSE reform pushed ROE targets. ROE > 8% stocks re-rate.', isExclusive: false, ic: 0.025 },
    ],
  },
  {
    code: 'tw', flag: '🇹🇼', name: 'Taiwan',
    investorType: 'Foreign institutions + Retail margin',
    marketCharacter: 'Semiconductor supply chain hub. TSMC dominance. High retail participation.',
    recommendationTagline: 'Follow foreign smart money + margin sentiment oscillator',
    recommendations: [
      { id: 'TW_FOREIGN_FLOW', name: 'Foreign Net Flow', tier: 't1_must', reason: 'Foreign 3-day sustained inflow > NT$10B = 78% probability TAIEX rise', isExclusive: true, ic: 0.048 },
      { id: 'TW_MARGIN_BALANCE', name: 'Margin Balance', tier: 't2_strong', reason: 'Margin > NT$300B = overheating. Retail sentiment king.', isExclusive: true, ic: 0.041 },
      { id: 'TW_TSMC_LINKAGE', name: 'TSMC Linkage', tier: 't2_strong', reason: 'TSMC = 30% TAIEX. Beta > 0.8 stocks = semiconductor proxy', isExclusive: true, ic: 0.026 },
      { id: 'TW_FINANCING_OVERHEAT', name: 'Margin Overheat', tier: 't3_optional', reason: 'Maintenance margin < 150% + day-trade > 40% = -6.8% in 2 months', isExclusive: true, ic: 0.037, price: 1 },
      { id: 'MOM_12M1M', name: '12-1M Momentum', tier: 't3_optional', reason: 'Taiwan momentum factor is surprisingly strong', isExclusive: false, ic: 0.033 },
    ],
  },
];

// Quick profiles for newer markets (compact)
const NEW_MARKET_PROFILES: MarketProfile[] = [
  {
    code: 'kr', flag: '🇰🇷', name: 'South Korea',
    investorType: 'Foreign + Domestic retail',
    marketCharacter: 'Chaebol dominance. Samsung = 20% KOSPI. KOSPI 200 options active.',
    recommendationTagline: 'Foreign ownership trend + chaebol governance reform',
    recommendations: [
      { id: 'KR_FOREIGN_OWNERSHIP', name: 'Foreign Ownership', tier: 't1_must', reason: 'Foreign > 40% = quality signal + institutional conviction', isExclusive: true, ic: 0.043 },
      { id: 'KR_CHAEBOL_DISCOUNT', name: 'Chaebol Discount', tier: 't2_strong', reason: 'Cross-holding unwind = +12% avg bounce', isExclusive: true, ic: 0.034 },
      { id: 'MOM_12M1M', name: '12-1M Momentum', tier: 't3_optional', reason: 'KOSPI momentum premium strong', isExclusive: false, ic: 0.028 },
    ],
  },
  {
    code: 'sg', flag: '🇸🇬', name: 'Singapore',
    investorType: 'Institutional + REIT income',
    marketCharacter: '40+ REITs. Tax-free dividends. STI 30 concentrated.',
    recommendationTagline: 'S-REIT yield spread is the anchor factor',
    recommendations: [
      { id: 'SG_REIT_SPREAD', name: 'S-REIT Yield Spread', tier: 't1_must', reason: 'Spread > 3% = +8-12% 12-month total return', isExclusive: true, ic: 0.047 },
      { id: 'DIVIDEND_YIELD', name: 'Dividend Yield', tier: 't2_strong', reason: 'SG dividends tax-free. 50% avg payout ratio.', isExclusive: false, ic: 0.022 },
      { id: 'ROE', name: 'ROE', tier: 't3_optional', reason: 'Quality filter for REITs and banks', isExclusive: false, ic: 0.019 },
    ],
  },
  {
    code: 'au', flag: '🇦🇺', name: 'Australia',
    investorType: 'Superannuation + Foreign',
    marketCharacter: 'Resources = 20% ASX. Franking credits unique. Big 4 bank dividends.',
    recommendationTagline: 'Iron ore beta + franking credit gross-up yield',
    recommendations: [
      { id: 'AU_COMMODITY_LINK', name: 'Commodity Beta', tier: 't1_must', reason: 'Iron ore explains 40% of ASX materials returns', isExclusive: true, ic: 0.039 },
      { id: 'AU_FRANKING_CREDIT', name: 'Franking Credit', tier: 't1_must', reason: 'Gross-up adds 1.5-2% effective yield. Unique AU advantage.', isExclusive: true, ic: 0.036 },
      { id: 'BAB', name: 'Bet Against Beta', tier: 't3_optional', reason: 'ASX low-vol premium present in banks', isExclusive: false, ic: 0.018 },
    ],
  },
  {
    code: 'in', flag: '🇮🇳', name: 'India',
    investorType: 'DII + FII + Retail SIP',
    marketCharacter: 'High growth. Monsoon-driven rural demand. DII SIP structural floor.',
    recommendationTagline: 'FII/DII flow balance + monsoon progress = alpha',
    recommendations: [
      { id: 'IN_FII_DII_FLOW', name: 'FII/DII Flow', tier: 't1_must', reason: 'FII > ₹2,000cr/day for 5 days = +3.2% Nifty', isExclusive: true, ic: 0.044 },
      { id: 'IN_PLEDGED_SHARES', name: 'Promoter Pledge', tier: 't2_strong', reason: 'Pledge > 50% = -15% annual underperformance', isExclusive: true, ic: -0.029, price: 1 },
      { id: 'EARNINGS_YIELD', name: 'Earnings Yield', tier: 't3_optional', reason: 'Value factor works well in high-growth India', isExclusive: false, ic: 0.024 },
    ],
  },
  {
    code: 'eu', flag: '🇪🇺', name: 'Europe',
    investorType: 'Institutional + ESG mandates',
    marketCharacter: 'ESG regulatory tailwind. STOXX 600 depth. Eurozone monetary policy.',
    recommendationTagline: 'ESG premium + EUR sensitivity + STOXX sector rotation',
    recommendations: [
      { id: 'EU_ESG_PREMIUM', name: 'ESG Premium', tier: 't1_must', reason: 'SFDR 9 funds received €150B. ESG leaders trade 6x P/E premium.', isExclusive: true, ic: 0.032, price: 1 },
      { id: 'EU_STOXX_SECTOR', name: 'STOXX Sector Rotation', tier: 't2_strong', reason: 'Sector momentum delivers +3.2% annual alpha', isExclusive: true, ic: 0.028 },
      { id: 'ANALYST_REVISION', name: 'Analyst Revision', tier: 't3_optional', reason: 'European analyst revisions are sticky and tradeable', isExclusive: false, ic: 0.022 },
    ],
  },
];

const ALL_PROFILES: MarketProfile[] = [...MARKET_PROFILES, ...NEW_MARKET_PROFILES];

// ── Tier Config ──────────────────────────────────────────────────────
const TIER_BADGES = {
  t1_must: { label: '🏆 Must-have', color: '#d4a853', bg: 'rgba(212,168,83,0.1)' },
  t2_strong: { label: '⭐ Strong', color: '#66bd63', bg: 'rgba(102,189,99,0.1)' },
  t3_optional: { label: '💡 Optional', color: '#888', bg: 'rgba(136,136,136,0.08)' },
};

// ── Component ────────────────────────────────────────────────────────
const MarketAutoRecommend: React.FC<MarketAutoRecommendProps> = ({
  onAddFactor,
  onAddAll,
  profiles = ALL_PROFILES,
}) => {
  const [selected, setSelected] = useState<MarketCode>('hk');
  const [addedFactors, setAddedFactors] = useState<Set<string>>(new Set());

  const profile = profiles.find((p) => p.code === selected) || profiles[0];

  const groupByTier = useMemo(() => {
    const groups: Record<string, RecommendedFactor[]> = {
      t1_must: [],
      t2_strong: [],
      t3_optional: [],
    };
    profile.recommendations.forEach((r) => {
      groups[r.tier].push(r);
    });
    return groups;
  }, [profile]);

  const handleAdd = useCallback(
    (id: string) => {
      setAddedFactors((prev) => new Set(prev).add(id));
      onAddFactor?.(id);
    },
    [onAddFactor],
  );

  const handleAddAll = useCallback(() => {
    const ids = profile.recommendations.map((r) => r.id);
    const newSet = new Set(addedFactors);
    ids.forEach((id) => newSet.add(id));
    setAddedFactors(newSet);
    onAddAll?.(ids);
  }, [profile, addedFactors, onAddAll]);

  const totalCount = profile.recommendations.length;
  const addedCount = profile.recommendations.filter((r) => addedFactors.has(r.id)).length;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>🎯 Market Auto-Recommend</h3>
          <p style={styles.subtitle}>
            Select your market — we recommend the best factors
          </p>
        </div>
      </div>

      {/* Market Selector Chips */}
      <div style={styles.chipRow}>
        {profiles.map((p) => (
          <button
            key={p.code}
            style={{
              ...styles.marketChip,
              background: selected === p.code ? `${p.code === 'kr' ? '#CD2E3A' : p.code === 'in' ? '#FF9933' : p.code === 'eu' ? '#003399' : '#d4a853'}20` : '#0f0f1e',
              borderColor: selected === p.code ? (p.code === 'kr' ? '#CD2E3A' : p.code === 'in' ? '#FF9933' : p.code === 'eu' ? '#003399' : '#d4a853') : '#2a2a4a',
              color: selected === p.code ? '#e0e0e0' : '#888',
            }}
            onClick={() => setSelected(p.code)}
          >
            <span style={styles.chipFlag}>{p.flag}</span>
            <span style={styles.chipName}>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Market Profile Card */}
      <Card
        size="small"
        style={styles.profileCard}
        bodyStyle={{ padding: 14 }}
      >
        <div style={styles.profileHeader}>
          <span style={styles.profileFlag}>{profile.flag}</span>
          <div>
            <div style={styles.profileName}>{profile.name}</div>
            <div style={styles.profileMeta}>
              <Tag>{profile.investorType}</Tag>
              <Tag>{profile.marketCharacter.split('.')[0]}</Tag>
            </div>
          </div>
          <div style={styles.addAllBtn}>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddAll}
              disabled={addedCount === totalCount}
            >
              Add All {addedCount}/{totalCount}
            </Button>
          </div>
        </div>
        <p style={styles.tagline}>💬 "{profile.recommendationTagline}"</p>
      </Card>

      {/* Recommendations */}
      <div style={styles.recList}>
        {(['t1_must', 't2_strong', 't3_optional'] as const).map((tier) => {
          const items = groupByTier[tier];
          if (items.length === 0) return null;
          const badge = TIER_BADGES[tier];
          return (
            <div key={tier} style={styles.tierGroup}>
              <div style={styles.tierHeader}>
                <span style={{ ...styles.tierBadge, color: badge.color, background: badge.bg }}>
                  {badge.label}
                </span>
                <span style={styles.tierCount}>{items.length} factors</span>
              </div>
              {items.map((r) => {
                const isAdded = addedFactors.has(r.id);
                return (
                  <div key={r.id} style={styles.recItem}>
                    <div style={styles.recLeft}>
                      <div style={styles.recNameRow}>
                        <span style={styles.recName}>{r.name}</span>
                        {r.isExclusive ? (
                          <Tag color="gold" style={styles.exclTag}>Exclusive</Tag>
                        ) : (
                          <Tag style={styles.uniTag}>Universal</Tag>
                        )}
                        {r.price ? (
                          <Tag color="purple" style={styles.priceTag}>{r.price}U</Tag>
                        ) : (
                          <Tag color="green" style={styles.priceTag}>FREE</Tag>
                        )}
                      </div>
                      <div style={styles.recReason}>
                        <span style={styles.recIC}>IC {(r.ic * 100).toFixed(1)}%</span>
                        <span style={styles.recWhy}>— {r.reason}</span>
                      </div>
                    </div>
                    <Button
                      type={isAdded ? 'default' : 'primary'}
                      size="small"
                      disabled={isAdded}
                      onClick={() => handleAdd(r.id)}
                      icon={isAdded ? undefined : <PlusOutlined />}
                    >
                      {isAdded ? 'Added ✓' : 'Add'}
                    </Button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
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
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
    color: '#e0e0e0',
    margin: 0,
  },
  subtitle: {
    fontSize: 11,
    color: '#888',
    margin: '2px 0 0',
  },
  chipRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  marketChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 20,
    border: '1px solid #2a2a4a',
    background: '#0f0f1e',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },
  chipFlag: { fontSize: 16 },
  chipName: { fontSize: 12 },
  profileCard: {
    background: '#0f0f1e',
    border: '1px solid #2a2a4a',
    borderRadius: 10,
    marginBottom: 14,
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  profileFlag: { fontSize: 28 },
  profileName: { fontSize: 15, fontWeight: 700, color: '#e0e0e0' },
  profileMeta: { display: 'flex', gap: 4, marginTop: 2 },
  addAllBtn: { marginLeft: 'auto' },
  tagline: { fontSize: 12, color: '#aaa', fontStyle: 'italic', margin: '4px 0 0' },
  recList: {},
  tierGroup: { marginBottom: 12 },
  tierHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tierBadge: {
    fontSize: 12,
    fontWeight: 700,
    padding: '2px 10px',
    borderRadius: 10,
  },
  tierCount: { fontSize: 10, color: '#888' },
  recItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: '#0f0f1e',
    borderRadius: 8,
    marginBottom: 6,
    gap: 10,
  },
  recLeft: { flex: 1, minWidth: 0 },
  recNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  recName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e0e0e0',
    fontFamily: 'monospace',
  },
  exclTag: { fontSize: 9, padding: '0 4px', lineHeight: '16px' },
  uniTag: { fontSize: 9, padding: '0 4px', lineHeight: '16px', color: '#888', border: '1px solid #444' },
  priceTag: { fontSize: 9, padding: '0 4px', lineHeight: '16px' },
  recReason: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    fontSize: 11,
  },
  recIC: {
    color: '#66bd63',
    fontFamily: 'monospace',
    fontWeight: 700,
    flexShrink: 0,
  },
  recWhy: {
    color: '#888',
    lineHeight: 1.4,
  },
};

export { MarketAutoRecommend, ALL_PROFILES, MARKET_PROFILES };
export type { MarketAutoRecommendProps, MarketProfile, RecommendedFactor, MarketCode };
