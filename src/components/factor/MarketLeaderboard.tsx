// @ts-nocheck
// ── R197 ML P13-02: MarketLeaderboard — 10市场独立龙虎榜 ──────────
// Per-market weekly IC Top10 ranking with flag + trends
// Tabbed: all 10 markets each with own leaderboard
// Shows: rank, factor name, IC, IR, week-over-week change, signal
// "Market of the Week" highlight banner at top
// Color-coded by market theme

import React, { useState, useMemo } from 'react';
import { Tabs, Tag, Tooltip, Badge } from 'antd';
import { TrophyOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
interface LeaderboardEntry {
  rank: number;
  factorId: string;
  factorName: string;
  market: string;
  marketFlag: string;
  ic: number;
  ir: number;
  prevWeekIC: number;
  trend: 'up' | 'down' | 'flat';
  signal: 'green' | 'yellow' | 'red';
  isExclusive: boolean;
}

interface MarketStats {
  market: string;
  flag: string;
  avgIC: number;
  bestFactor: string;
  topMarket: boolean;
}

interface MarketLeaderboardProps {
  data?: LeaderboardEntry[];
  onSelectFactor?: (entry: LeaderboardEntry) => void;
}

// ── Demo Data Generator ─────────────────────────────────────────────
function generateLeaderboardData(): { entries: LeaderboardEntry[]; stats: MarketStats[] } {
  const markets = [
    { code: 'hk', flag: '🇭🇰' },
    { code: 'us', flag: '🇺🇸' },
    { code: 'crypto', flag: '🪙' },
    { code: 'jp', flag: '🇯🇵' },
    { code: 'tw', flag: '🇹🇼' },
    { code: 'kr', flag: '🇰🇷' },
    { code: 'sg', flag: '🇸🇬' },
    { code: 'au', flag: '🇦🇺' },
    { code: 'in', flag: '🇮🇳' },
    { code: 'eu', flag: '🇪🇺' },
  ];

  const factorPool = [
    { id: 'PE_RATIO', name: 'PE Ratio', isExclusive: false },
    { id: 'MOM_12M1M', name: '12-1M Momentum', isExclusive: false },
    { id: 'DIVIDEND_YIELD', name: 'Dividend Yield', isExclusive: false },
    { id: 'ROE', name: 'ROE', isExclusive: false },
    { id: 'BAB', name: 'BAB', isExclusive: false },
    { id: 'EARNINGS_YIELD', name: 'Earnings Yield', isExclusive: false },
    { id: 'FCF_YIELD', name: 'FCF Yield', isExclusive: false },
    { id: 'ANALYST_REVISION', name: 'Analyst Revision', isExclusive: false },
    { id: 'SHORT_INTEREST', name: 'Short Interest', isExclusive: false },
    { id: 'HK_CBBC_RATIO', name: 'CBBC Bull/Bear', isExclusive: true },
    { id: 'US_GAMMA_EXPOSURE', name: 'Gamma Exposure', isExclusive: true },
    { id: 'JP_FOREIGN_FLOW', name: 'Foreign Net Buy', isExclusive: true },
    { id: 'TW_FOREIGN_FLOW', name: 'Foreign Net Flow', isExclusive: true },
    { id: 'KR_FOREIGN_OWNERSHIP', name: 'Foreign Ownership', isExclusive: true },
    { id: 'SG_REIT_SPREAD', name: 'S-REIT Spread', isExclusive: true },
    { id: 'AU_COMMODITY_LINK', name: 'Commodity Beta', isExclusive: true },
    { id: 'IN_FII_DII_FLOW', name: 'FII/DII Flow', isExclusive: true },
    { id: 'EU_STOXX_SECTOR', name: 'STOXX Sector', isExclusive: true },
    { id: 'CRYPTO_PUELL', name: 'Puell Multiple', isExclusive: true },
    { id: 'CRYPTO_FUNDING_RATE', name: 'Funding Rate', isExclusive: true },
  ];

  const entries: LeaderboardEntry[] = [];
  const stats: MarketStats[] = [];

  let idx = 0;
  markets.forEach((m) => {
    const marketFactors = factorPool.filter((f) => {
      if (f.isExclusive) {
        const prefix = f.id.split('_')[0].toLowerCase();
        return prefix === m.code || prefix === m.code;
      }
      return true;
    });
    const pool = marketFactors.length >= 10 ? marketFactors : [...marketFactors, ...factorPool.filter(f => !f.isExclusive)];

    const marketEntries: LeaderboardEntry[] = [];
    for (let rank = 0; rank < Math.min(10, pool.length); rank++) {
      idx++;
      const f = pool[rank % pool.length];
      const seed = idx * 7 + m.code.length * 13 + rank * 3;
      const rand = (o: number) => {
        const x = Math.sin(seed * o * 1.73 + seed * 0.05) * 10000;
        return x - Math.floor(x);
      };

      const ic = Math.round((0.015 + rand(1) * 0.05) * 10000) / 10000;
      const prevIC = Math.round((0.015 + rand(2) * 0.05) * 10000) / 10000;
      const trend = ic > prevIC + 0.005 ? 'up' : ic < prevIC - 0.005 ? 'down' : 'flat';

      marketEntries.push({
        rank: rank + 1,
        factorId: f.id,
        factorName: f.name,
        market: m.code,
        marketFlag: m.flag,
        ic,
        ir: Math.round(ic * (2 + rand(3) * 2) * 1000) / 1000,
        prevWeekIC: prevIC,
        trend,
        signal: ic >= 0.025 ? 'green' : ic >= 0.01 ? 'yellow' : 'red',
        isExclusive: f.isExclusive,
      });
    }

    marketEntries.sort((a, b) => b.ic - a.ic);
    marketEntries.forEach((e, i) => { e.rank = i + 1; });
    entries.push(...marketEntries);

    const avgIC = Math.round((marketEntries.reduce((s, e) => s + e.ic, 0) / marketEntries.length) * 10000) / 10000;
    stats.push({
      market: m.code,
      flag: m.flag,
      avgIC,
      bestFactor: marketEntries[0].factorName,
      topMarket: false,
    });
  });

  // Find best market
  stats.sort((a, b) => b.avgIC - a.avgIC);
  if (stats.length > 0) stats[0].topMarket = true;

  return { entries, stats };
}

// ── Component ────────────────────────────────────────────────────────
const MarketLeaderboard: React.FC<MarketLeaderboardProps> = ({
  data: propData,
  onSelectFactor,
}) => {
  const [activeMarket, setActiveMarket] = useState('hk');

  const { entries, stats } = useMemo(() => {
    if (propData) {
      const uniqueMarkets = [...new Set(propData.map((e) => e.market))];
      const s: MarketStats[] = uniqueMarkets.map((m) => {
        const mEntries = propData.filter((e) => e.market === m);
        const avgIC = mEntries.length
          ? Math.round((mEntries.reduce((sum, e) => sum + e.ic, 0) / mEntries.length) * 10000) / 10000
          : 0;
        return { market: m, flag: mEntries[0]?.marketFlag || '', avgIC, bestFactor: mEntries[0]?.factorName || '', topMarket: false };
      });
      s.sort((a, b) => b.avgIC - a.avgIC);
      if (s.length > 0) s[0].topMarket = true;
      return { entries: propData, stats: s };
    }
    return generateLeaderboardData();
  }, [propData]);

  const marketEntries = entries.filter((e) => e.market === activeMarket).sort((a, b) => b.ic - a.ic);

  const topMarket = stats[0];
  const activeStat = stats.find((s) => s.market === activeMarket);

  const tabItems = stats.map((s) => ({
    key: s.market,
    label: (
      <span style={styles.tabLabel}>
        <span>{s.flag}</span>
        {s.topMarket && <Badge status="processing" color="gold" style={{ marginLeft: 2 }} />}
      </span>
    ),
  }));

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>🏆 Market Factor Leaderboard</h3>
          <p style={styles.subtitle}>Weekly IC Top 10 per market — {stats.length} markets</p>
        </div>
      </div>

      {/* Market of the Week Banner */}
      {topMarket && (
        <div style={styles.heroBanner}>
          <span style={styles.heroIcon}><TrophyOutlined /></span>
          <div style={styles.heroContent}>
            <div style={styles.heroTitle}>
              Market of the Week: {topMarket.flag} {topMarket.market.toUpperCase()}
            </div>
            <div style={styles.heroMeta}>
              Avg IC {topMarket.avgIC >= 0 ? '+' : ''}{(topMarket.avgIC * 100).toFixed(2)}% · 
              Best: {topMarket.bestFactor}
            </div>
          </div>
        </div>
      )}

      {/* Market Tabs */}
      <Tabs
        activeKey={activeMarket}
        onChange={setActiveMarket}
        items={tabItems}
        tabBarStyle={{ borderBottom: '1px solid #2a2a4a', marginBottom: 0 }}
        tabBarExtraContent={
          activeStat && (
            <Tag color={activeStat.avgIC >= 0.02 ? 'green' : activeStat.avgIC >= 0 ? 'orange' : 'red'} style={{ marginRight: 12 }}>
              Avg IC {activeStat.avgIC >= 0 ? '+' : ''}{(activeStat.avgIC * 100).toFixed(1)}%
            </Tag>
          )
        }
      />

      {/* Leaderboard Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Factor</th>
              <th style={styles.th}>IC</th>
              <th style={styles.th}>IR</th>
              <th style={styles.th}>WoW</th>
              <th style={styles.th}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {marketEntries.map((e) => (
              <tr
                key={e.factorId}
                style={styles.tr}
                onClick={() => onSelectFactor?.(e)}
              >
                <td style={styles.tdRank}>
                  {e.rank <= 3 ? (
                    <span style={{ ...styles.medal, color: e.rank === 1 ? '#d4a853' : e.rank === 2 ? '#c0c0c0' : '#cd7f32' }}>
                      {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}
                    </span>
                  ) : (
                    <span style={styles.rankNum}>{e.rank}</span>
                  )}
                </td>
                <td style={styles.tdName}>
                  <div style={styles.factorName}>
                    {e.factorName}
                    {e.isExclusive && (
                      <Tag color="gold" style={styles.exclTag}>E</Tag>
                    )}
                  </div>
                  <div style={styles.factorId}>{e.factorId}</div>
                </td>
                <td style={styles.tdIC}>
                  <span style={{
                    color: e.ic >= 0.03 ? '#66bd63' : e.ic >= 0 ? '#d4a853' : '#f46d43',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                  }}>
                    {e.ic >= 0 ? '+' : ''}{(e.ic * 100).toFixed(2)}%
                  </span>
                </td>
                <td style={styles.tdIR}>
                  <span style={{ fontFamily: 'monospace', color: '#aaa' }}>
                    {e.ir.toFixed(3)}
                  </span>
                </td>
                <td style={styles.tdTrend}>
                  <Tooltip title={`Last week: ${(e.prevWeekIC * 100).toFixed(2)}%`}>
                    <span style={{
                      color: e.trend === 'up' ? '#66bd63' : e.trend === 'down' ? '#f46d43' : '#888',
                      fontSize: 14,
                    }}>
                      {e.trend === 'up' ? '↑' : e.trend === 'down' ? '↓' : '→'}
                    </span>
                  </Tooltip>
                </td>
                <td style={styles.tdSignal}>
                  <Tooltip title={e.signal === 'green' ? 'Bullish' : e.signal === 'yellow' ? 'Neutral' : 'Bearish'}>
                    <span>
                      {e.signal === 'green' ? '🟢' : e.signal === 'yellow' ? '🟡' : '🔴'}
                    </span>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  header: { marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 700, color: '#e0e0e0', margin: 0 },
  subtitle: { fontSize: 11, color: '#888', margin: '2px 0 0' },
  heroBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.05))',
    border: '1px solid rgba(212,168,83,0.25)',
    borderRadius: 10,
    marginBottom: 14,
  },
  heroIcon: { fontSize: 24, color: '#d4a853' },
  heroContent: {},
  heroTitle: { fontSize: 14, fontWeight: 700, color: '#d4a853' },
  heroMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  tabLabel: { display: 'flex', alignItems: 'center', gap: 2, fontSize: 14 },
  tableWrap: { maxHeight: 420, overflowY: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { fontSize: 10, color: '#888', textTransform: 'uppercase', padding: '6px 8px', textAlign: 'left' as const, borderBottom: '1px solid #2a2a4a' },
  tr: { cursor: 'pointer', transition: 'background 0.1s', borderBottom: '1px solid #1a1a3e' },
  tdRank: { padding: '8px 8px', width: 40, textAlign: 'center' as const },
  medal: { fontSize: 16 },
  rankNum: { fontSize: 12, color: '#666', fontFamily: 'monospace' },
  tdName: { padding: '8px 8px' },
  factorName: { fontSize: 12, fontWeight: 600, color: '#e0e0e0', display: 'flex', alignItems: 'center', gap: 4 },
  exclTag: { fontSize: 8, padding: '0 3px', lineHeight: '14px' },
  factorId: { fontSize: 9, color: '#555', fontFamily: 'monospace', marginTop: 1 },
  tdIC: { padding: '8px 8px', textAlign: 'right', fontSize: 12 },
  tdIR: { padding: '8px 8px', fontSize: 11, textAlign: 'right' },
  tdTrend: { padding: '8px 8px', textAlign: 'center', fontSize: 14 },
  tdSignal: { padding: '8px 8px', textAlign: 'center', fontSize: 14 },
};

export { MarketLeaderboard, generateLeaderboardData };
export type { MarketLeaderboardProps, LeaderboardEntry, MarketStats };
