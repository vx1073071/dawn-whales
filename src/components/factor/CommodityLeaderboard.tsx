// ── R199 ML P15-03: CommodityLeaderboard — 26商品周IC Top10 ──────────
// 26 commodity factors ranked by weekly IC across 4 categories
// Category tabs: 🥇Precious / 🛢️Energy / 🔩Metals / 🌾Agri / All
// Shows: rank, factor name, commodity flag, IC, WoW change, signal
// Compact cards with commodity emoji + category accent color

import React, { useState, useMemo } from 'react';
import { Tag, Tooltip, Segmented } from 'antd';


// ── Types ───────────────────────────────────────────────────────────
interface CommodityLeaderEntry {
  rank: number;
  id: string;
  name: string;
  plainName: string;
  commodity: string;
  commodityEmoji: string;
  category: 'precious' | 'energy' | 'metal' | 'agri';
  ic: number;
  ir: number;
  prevWeekIC: number;
  trend: 'up' | 'down' | 'flat';
  signal: 'green' | 'yellow' | 'red';
}

interface CommodityLeaderboardProps {
  data?: CommodityLeaderEntry[];
  onSelect?: (entry: CommodityLeaderEntry) => void;
}

// ── Demo Data ────────────────────────────────────────────────────────
function generateCommodityLeaderboard(): CommodityLeaderEntry[] {
  const factors: Omit<CommodityLeaderEntry, 'rank' | 'ic' | 'ir' | 'prevWeekIC' | 'trend' | 'signal'>[] = [
    { id: 'CMD_BASIS', name: 'Basis', plainName: '基差', commodity: 'Crude Oil', commodityEmoji: '🛢️', category: 'energy' },
    { id: 'CMD_COC_COMMERCIAL', name: 'COT Commercial', plainName: '大佬持仓', commodity: 'Gold', commodityEmoji: '🥇', category: 'precious' },
    { id: 'CMD_EIA_CRUDE', name: 'EIA Inventory', plainName: '原油库存', commodity: 'Crude Oil', commodityEmoji: '🛢️', category: 'energy' },
    { id: 'CMD_DXY_LINKAGE', name: 'DXY Linkage', plainName: '美元联动', commodity: 'Gold', commodityEmoji: '🥇', category: 'precious' },
    { id: 'CMD_LME_INVENTORY', name: 'LME Inventory', plainName: 'LME库存', commodity: 'Copper', commodityEmoji: '🔩', category: 'metal' },
    { id: 'CMD_MOMENTUM_12M', name: '12M Momentum', plainName: '12月动量', commodity: 'Copper', commodityEmoji: '🔩', category: 'metal' },
    { id: 'CMD_ROLL_YIELD', name: 'Roll Yield', plainName: '换月成本', commodity: 'Crude Oil', commodityEmoji: '🛢️', category: 'energy' },
    { id: 'CMD_SEASONALITY', name: 'Seasonality', plainName: '季节性', commodity: 'Soybeans', commodityEmoji: '🫘', category: 'agri' },
    { id: 'CMD_GOLD_SILVER_RATIO', name: 'Gold/Silver', plainName: '金银比', commodity: 'Gold/Silver', commodityEmoji: '⚖️', category: 'precious' },
    { id: 'CMD_GOLD_ETF', name: 'Gold ETF', plainName: '黄金ETF', commodity: 'Gold', commodityEmoji: '🥇', category: 'precious' },
    { id: 'CMD_REAL_RATE', name: 'Real Rate', plainName: '实际利率', commodity: 'Gold', commodityEmoji: '🥇', category: 'precious' },
    { id: 'CMD_COT_SPECULATOR', name: 'COT Speculator', plainName: '投机仓位', commodity: 'Crude Oil', commodityEmoji: '🛢️', category: 'energy' },
    { id: 'CMD_GEOPOL_RISK', name: 'Geopol Risk', plainName: '地缘风险', commodity: 'Crude Oil', commodityEmoji: '🛢️', category: 'energy' },
    { id: 'CMD_TERM_STRUCTURE', name: 'Term Structure', plainName: '期限斜率', commodity: 'Natural Gas', commodityEmoji: '🔥', category: 'energy' },
    { id: 'CMD_GOLD_OIL_RATIO', name: 'Gold/Oil', plainName: '金油比', commodity: 'Gold vs Oil', commodityEmoji: '⚖️', category: 'precious' },
    { id: 'CMD_VOLATILITY', name: 'Volatility', plainName: '波动率', commodity: 'Silver', commodityEmoji: '🥈', category: 'precious' },
    { id: 'CMD_MOMENTUM_1M', name: '1M Reversal', plainName: '1月反转', commodity: 'Corn', commodityEmoji: '🌽', category: 'agri' },
    { id: 'CMD_INFLATION_BE', name: 'Inflation BE', plainName: '通胀预期', commodity: 'Gold', commodityEmoji: '🥇', category: 'precious' },
    { id: 'CMD_NATGAS_STORAGE', name: 'NatGas Storage', plainName: '天然气库存', commodity: 'Natural Gas', commodityEmoji: '🔥', category: 'energy' },
    { id: 'CMD_CRACK_SPREAD', name: 'Crack Spread', plainName: '裂解价差', commodity: 'Crude Products', commodityEmoji: '⛽', category: 'energy' },
    { id: 'CMD_SKEWNESS', name: 'Skewness', plainName: '偏度', commodity: 'Silver', commodityEmoji: '🥈', category: 'precious' },
    { id: 'CMD_COC_EXTREME', name: 'COT Extreme', plainName: '持仓极端', commodity: 'Corn', commodityEmoji: '🌽', category: 'agri' },
    { id: 'CMD_OPEN_INTEREST', name: 'Open Interest', plainName: '持仓变化', commodity: 'Copper', commodityEmoji: '🔩', category: 'metal' },
    { id: 'CMD_BALANCE_SHEET', name: 'Balance Sheet', plainName: '供需平衡', commodity: 'Soybeans', commodityEmoji: '🫘', category: 'agri' },
    { id: 'CMD_GOLD_SUMMER', name: 'Gold Summer', plainName: '黄金夏季', commodity: 'Gold', commodityEmoji: '🥇', category: 'precious' },
    { id: 'CMD_COT_CHANGE', name: 'COT Change', plainName: '仓位变动', commodity: 'Copper', commodityEmoji: '🔩', category: 'metal' },
  ];

  return factors.map((f, i) => {
    const seed = i * 13 + f.id.length * 7;
    const rand = (o: number) => { const x = Math.sin(seed * o * 1.73 + seed * 0.03) * 10000; return x - Math.floor(x); };
    const ic = Math.round((0.01 + rand(1) * 0.06) * 10000) / 10000;
    const prevIC = Math.round((0.01 + rand(2) * 0.06) * 10000) / 10000;
    const trend = ic > prevIC + 0.005 ? 'up' as const : ic < prevIC - 0.005 ? 'down' as const : 'flat' as const;
    return { ...f, ic, ir: Math.round(ic * (2 + rand(3) * 2) * 1000) / 1000, prevWeekIC: prevIC, trend, signal: ic >= 0.025 ? 'green' : ic >= 0.01 ? 'yellow' : 'red', rank: 0 };
  });
}

const CAT_THEME: Record<string, { accent: string; label: string }> = {
  precious: { accent: '#FFD700', label: '🥇 Precious' },
  energy: { accent: '#FF8C00', label: '🛢️ Energy' },
  metal: { accent: '#B87333', label: '🔩 Metals' },
  agri: { accent: '#228B22', label: '🌾 Agri' },
};

// ── Component ────────────────────────────────────────────────────────
const CommodityLeaderboard: React.FC<CommodityLeaderboardProps> = ({ data: propData, onSelect }) => {
  const allData = useMemo(() => propData || generateCommodityLeaderboard(), [propData]);
  const [category, setCategory] = useState<string>('all');

  const filtered = useMemo(() => {
    let d = category === 'all' ? allData : allData.filter((e) => e.category === category);
    return d.sort((a, b) => b.ic - a.ic).map((e, i) => ({ ...e, rank: i + 1 }));
  }, [allData, category]);

  const top3 = filtered.slice(0, 3);
  const avgIC = filtered.length ? Math.round((filtered.reduce((s, e) => s + e.ic, 0) / filtered.length) * 10000) / 10000 : 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>🏆 Commodity Factor Leaderboard</h3>
          <p style={styles.subtitle}>Weekly IC ranking — {allData.length} factors across 4 categories</p>
        </div>
      </div>

      {/* Top 3 Banner */}
      {top3.length > 0 && (
        <div style={styles.topBanner}>
          {top3.map((e, i) => (
            <div key={e.id} style={styles.topCard} onClick={() => onSelect?.(e)}>
              <span style={styles.topMedal}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
              <div>
                <div style={styles.topName}>
                  {e.commodityEmoji} {e.plainName}
                </div>
                <div style={styles.topMeta}>{e.name} · {e.commodity}</div>
              </div>
              <span style={{ ...styles.topIC, color: e.ic >= 0.03 ? '#66bd63' : '#d4a853' }}>
                +{(e.ic * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Category Filter */}
      <div style={styles.filterBar}>
        <Segmented
          value={category}
          onChange={(v) => setCategory(v as string)}
          options={[
            { label: 'All', value: 'all' },
            ...Object.entries(CAT_THEME).map(([k, v]) => ({ label: v.label, value: k })),
          ]}
          style={{ background: '#0f0f1e' }}
        />
        <Tag color={avgIC >= 0.02 ? 'green' : avgIC >= 0 ? 'orange' : 'red'} style={{ marginLeft: 'auto' }}>
          Avg IC {avgIC >= 0 ? '+' : ''}{(avgIC * 100).toFixed(1)}%
        </Tag>
      </div>

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
            {filtered.map((e) => {
              const catTheme = CAT_THEME[e.category];
              return (
                <tr key={e.id} style={{ ...styles.tr, borderLeft: `3px solid ${catTheme?.accent || '#444'}` }}
                  onClick={() => onSelect?.(e)}>
                  <td style={styles.tdRank}>
                    {e.rank <= 3 ? (
                      <span style={{ fontSize: 14 }}>{e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}</span>
                    ) : (
                      <span style={styles.rankNum}>{e.rank}</span>
                    )}
                  </td>
                  <td style={styles.tdName}>
                    <div style={styles.fname}>
                      <span>{e.commodityEmoji}</span>
                      <span style={styles.fnamePlain}>{e.plainName}</span>
                    </div>
                    <div style={styles.fmeta}>{e.name} · {e.commodity}</div>
                  </td>
                  <td style={styles.tdIC}>
                    <span style={{ color: e.ic >= 0.03 ? '#66bd63' : e.ic >= 0 ? '#d4a853' : '#f46d43', fontWeight: 700, fontFamily: 'monospace' }}>
                      {e.ic >= 0 ? '+' : ''}{(e.ic * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td style={styles.tdIR}>
                    <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 11 }}>{e.ir.toFixed(3)}</span>
                  </td>
                  <td style={styles.tdTrend}>
                    <Tooltip title={`Last week: ${(e.prevWeekIC * 100).toFixed(2)}%`}>
                      <span style={{ color: e.trend === 'up' ? '#66bd63' : e.trend === 'down' ? '#f46d43' : '#888', fontSize: 14 }}>
                        {e.trend === 'up' ? '↑' : e.trend === 'down' ? '↓' : '→'}
                      </span>
                    </Tooltip>
                  </td>
                  <td style={styles.tdSignal}>
                    <Tooltip title={e.signal === 'green' ? 'Bullish' : e.signal === 'yellow' ? 'Neutral' : 'Bearish'}>
                      <span>{e.signal === 'green' ? '🟢' : e.signal === 'yellow' ? '🟡' : '🔴'}</span>
                    </Tooltip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a4a', fontFamily: "'Inter', -apple-system, sans-serif" },
  header: { marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 700, color: '#e0e0e0', margin: 0 },
  subtitle: { fontSize: 11, color: '#888', margin: '2px 0 0' },
  topBanner: { display: 'flex', gap: 10, marginBottom: 14 },
  topCard: { flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'linear-gradient(135deg, rgba(212,168,83,0.1), rgba(212,168,83,0.03))', borderRadius: 10, border: '1px solid rgba(212,168,83,0.2)', cursor: 'pointer' },
  topMedal: { fontSize: 22 },
  topName: { fontSize: 12, fontWeight: 700, color: '#e0e0e0' },
  topMeta: { fontSize: 9, color: '#888' },
  topIC: { fontSize: 16, fontWeight: 800, fontFamily: 'monospace', marginLeft: 'auto' },
  filterBar: { display: 'flex', alignItems: 'center', marginBottom: 12 },
  tableWrap: { maxHeight: 420, overflowY: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { fontSize: 10, color: '#888', textTransform: 'uppercase', padding: '6px 8px', textAlign: 'left' as const, borderBottom: '1px solid #2a2a4a' },
  tr: { cursor: 'pointer', borderBottom: '1px solid #1a1a3e', transition: 'background 0.1s' },
  tdRank: { padding: '8px 8px', width: 36, textAlign: 'center' },
  rankNum: { fontSize: 11, color: '#666', fontFamily: 'monospace' },
  tdName: { padding: '6px 8px' },
  fname: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#e0e0e0' },
  fnamePlain: {},
  fmeta: { fontSize: 9, color: '#555', marginTop: 1 },
  tdIC: { padding: '6px 8px', textAlign: 'right', fontSize: 12 },
  tdIR: { padding: '6px 8px', fontSize: 11, textAlign: 'right' },
  tdTrend: { padding: '6px 8px', textAlign: 'center', fontSize: 14 },
  tdSignal: { padding: '6px 8px', textAlign: 'center', fontSize: 14 },
};

export { CommodityLeaderboard, generateCommodityLeaderboard };
export type { CommodityLeaderboardProps, CommodityLeaderEntry };
