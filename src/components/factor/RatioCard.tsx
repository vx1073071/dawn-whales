// ── R199 ML P15-02: RatioCard — 商品比价分享卡 ──────────
// Gold/Silver Ratio + Gold/Oil Ratio gauge dials
// Current value + 5-year range + percentile position
// 📤 Share button (social spread = zero acquisition cost)
// "Gold is expensive vs Oil — historically this means-reverts"
// Premium: Crack Spread analysis (crude→gasoline→heating oil)

import React, { useState } from 'react';
import { Button, Tag } from 'antd';
import { ShareAltOutlined, CopyOutlined } from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
interface RatioData {
  id: string;
  name: string;
  nameCN: string;
  emoji: string;
  currentValue: number;
  fiveYearHigh: number;
  fiveYearLow: number;
  fiveYearAvg: number;
  percentile: number; // 0-100, where does current value sit in 5yr range?
  signal: 'green' | 'yellow' | 'red';
  insight: string;
  asset1: { emoji: string; name: string };
  asset2: { emoji: string; name: string };
}

interface RatioCardProps {
  data: RatioData;
  onShare?: (data: RatioData) => void;
  onCopy?: (data: RatioData) => void;
}

// ── Demo Data ────────────────────────────────────────────────────────
const DEMO_RATIOS: RatioData[] = [
  {
    id: 'GOLD_SILVER', name: 'Gold/Silver Ratio', nameCN: '金银比', emoji: '⚖️',
    currentValue: 88.5, fiveYearHigh: 124, fiveYearLow: 64, fiveYearAvg: 85,
    percentile: 62,
    signal: 'yellow',
    insight: '金银比88.5 → 高于5年均值85 → 白银相对黄金偏便宜。历史均值回归→白银可能跑赢黄金。',
    asset1: { emoji: '🥇', name: 'Gold' },
    asset2: { emoji: '🥈', name: 'Silver' },
  },
  {
    id: 'GOLD_OIL', name: 'Gold/Oil Ratio', nameCN: '金油比', emoji: '🛢️',
    currentValue: 38.2, fiveYearHigh: 52, fiveYearLow: 16, fiveYearAvg: 28,
    percentile: 85,
    signal: 'red',
    insight: '金油比38.2 → 处于5年85%分位 → 黄金相对原油极贵。历史上超过35后6个月内原油平均反弹+18%。',
    asset1: { emoji: '🥇', name: 'Gold' },
    asset2: { emoji: '🛢️', name: 'Crude Oil' },
  },
  {
    id: 'COPPER_GOLD', name: 'Copper/Gold Ratio', nameCN: '铜金比', emoji: '🔩',
    currentValue: 0.18, fiveYearHigh: 0.30, fiveYearLow: 0.14, fiveYearAvg: 0.22,
    percentile: 22,
    signal: 'green',
    insight: '铜金比0.18 → 只有5年均值82% → 铜被低估。该比例是全球经济增长预期的晴雨表。',
    asset1: { emoji: '🔩', name: 'Copper' },
    asset2: { emoji: '🥇', name: 'Gold' },
  },
  {
    id: 'CRACK_SPREAD', name: 'Crack Spread (321)', nameCN: '裂解价差', emoji: '⛽',
    currentValue: 28.5, fiveYearHigh: 55, fiveYearLow: 8, fiveYearAvg: 25,
    percentile: 58,
    signal: 'green',
    insight: '裂解价差$28.5/bbl → 高于5年均值 → 炼油利润好。原油→汽油→取暖油。这是炼油厂的核心利润指标。',
    asset1: { emoji: '🛢️', name: 'Crude →' },
    asset2: { emoji: '⛽', name: 'Gasoline+HO' },
  },
];

// ── Gauge SVG ────────────────────────────────────────────────────────
function RatioGauge({ data, size }: { data: RatioData; size: number }) {
  const cx = size / 2;
  const cy = size * 0.55;
  const radius = size * 0.32;
  const strokeW = 8;

  // Arc: 135° to 405° (270° arc, bottom half hidden)
  const startAngle = -135 * (Math.PI / 180);
  const arcSweep = 270 * (Math.PI / 180);

  const range = data.fiveYearHigh - data.fiveYearLow;
  const pct = range > 0 ? (data.currentValue - data.fiveYearLow) / range : 0.5;
  const needleAngle = startAngle + pct * arcSweep;

  const needleLen = radius * 0.75;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy + needleLen * Math.sin(needleAngle);

  // Color zones
  const zoneColors = [
    { start: 0, end: 0.25, color: '#66bd63' },
    { start: 0.25, end: 0.75, color: '#d4a853' },
    { start: 0.75, end: 1, color: '#f46d43' },
  ];

  // Arc path
  const arcAnglePerZone = arcSweep;
  const arcPath = (startPct: number, endPct: number) => {
    const a1 = startAngle + startPct * arcAnglePerZone;
    const a2 = startAngle + endPct * arcAnglePerZone;
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2);
    const y2 = cy + radius * Math.sin(a2);
    const large = (endPct - startPct) > 0.5 ? 1 : 0;
    return `M${x1.toFixed(1)},${y1.toFixed(1)} A${radius},${radius} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
  };

  // Tick marks
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size}>
      {/* Background arc */}
      <path d={arcPath(0, 1)} fill="none" stroke="#2a2a4a" strokeWidth={strokeW} strokeLinecap="round" />

      {/* Color zones */}
      {zoneColors.map((z) => (
        <path key={z.color} d={arcPath(z.start, z.end)} fill="none" stroke={z.color} strokeWidth={strokeW} strokeLinecap="butt" opacity={0.3} />
      ))}

      {/* Tick marks */}
      {ticks.map((t) => {
        const a = startAngle + t * arcAnglePerZone;
        const tx = cx + (radius + 8) * Math.cos(a);
        const ty = cy + (radius + 8) * Math.sin(a);
        const val = data.fiveYearLow + t * range;
        return (
          <text key={t} x={tx} y={ty} fill="#888" fontSize={8} textAnchor="middle" dominantBaseline="middle">
            {val.toFixed(0)}
          </text>
        );
      })}

      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e0e0e0" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="#e0e0e0" />

      {/* Center value */}
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#e0e0e0" fontSize={24} fontWeight={800} fontFamily="monospace">
        {data.currentValue.toFixed(1)}
      </text>
      <text x={cx} y={cy + 44} textAnchor="middle" fill="#888" fontSize={9}>
        {data.percentile}th percentile
      </text>
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────
const RatioCard: React.FC<RatioCardProps> = ({ data, onShare, onCopy }) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const handleCopy = () => {
    const text = `${data.name}: ${data.currentValue} (5yr range ${data.fiveYearLow}-${data.fiveYearHigh})\n${data.insight}\nvia Dawn Whales`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.(data);
  };

  const handleShare = () => {
    setShared(true);
    setTimeout(() => setShared(false), 2000);
    onShare?.(data);
  };

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerEmoji}>{data.emoji}</span>
        <div>
          <div style={styles.headerName}>{data.name}</div>
          <div style={styles.headerCN}>{data.nameCN}</div>
        </div>
        <Tag color={data.signal === 'green' ? 'green' : data.signal === 'red' ? 'red' : 'orange'}
          style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600 }}>
          {data.signal === 'green' ? '🟢 便宜' : data.signal === 'red' ? '🔴 贵' : '🟡 适中'}
        </Tag>
      </div>

      {/* Gauge */}
      <div style={styles.gaugeWrap}>
        <RatioGauge data={data} size={200} />
      </div>

      {/* Asset Pair */}
      <div style={styles.pair}>
        <span style={styles.pairAsset}>{data.asset1.emoji} {data.asset1.name}</span>
        <span style={styles.pairVs}>vs</span>
        <span style={styles.pairAsset}>{data.asset2.emoji} {data.asset2.name}</span>
      </div>

      {/* Key Stats */}
      <div style={styles.stats}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>5yr High</span>
          <span style={{ ...styles.statVal, color: '#f46d43' }}>{data.fiveYearHigh.toFixed(1)}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>5yr Avg</span>
          <span style={{ ...styles.statVal, color: '#d4a853' }}>{data.fiveYearAvg.toFixed(1)}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>5yr Low</span>
          <span style={{ ...styles.statVal, color: '#66bd63' }}>{data.fiveYearLow.toFixed(1)}</span>
        </div>
      </div>

      {/* Insight */}
      <div style={styles.insight}>💡 {data.insight}</div>

      {/* Share Buttons */}
      <div style={styles.shareRow}>
        <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}
          type={copied ? 'primary' : 'default'} style={{ borderRadius: 6 }}>
          {copied ? '✓ Copied' : 'Copy'}
        </Button>
        <Button size="small" icon={<ShareAltOutlined />} onClick={handleShare}
          type={shared ? 'primary' : 'default'} style={{ borderRadius: 6 }}>
          {shared ? '✓ Shared' : 'Share'}
        </Button>
      </div>
    </div>
  );
};

// ── Grid Wrapper ─────────────────────────────────────────────────────
const RatioCardGrid: React.FC<{
  ratios?: RatioData[];
  onShare?: (data: RatioData) => void;
}> = ({ ratios = DEMO_RATIOS, onShare }) => {
  return (
    <div style={gridStyles.container}>
      <div style={gridStyles.header}>
        <h3 style={gridStyles.title}>⚖️ Commodity Ratio Dashboard</h3>
        <p style={gridStyles.subtitle}>Key inter-commodity spreads — is Gold too expensive vs Oil?</p>
      </div>
      <div style={gridStyles.grid}>
        {ratios.map((r) => (
          <RatioCard key={r.id} data={r} onShare={onShare} />
        ))}
      </div>
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    border: '1px solid #2a2a4a',
    fontFamily: "'Inter', -apple-system, sans-serif",
    textAlign: 'center',
  },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, textAlign: 'left' },
  headerEmoji: { fontSize: 24 },
  headerName: { fontSize: 13, fontWeight: 700, color: '#e0e0e0' },
  headerCN: { fontSize: 10, color: '#888' },
  gaugeWrap: { display: 'flex', justifyContent: 'center', marginBottom: 6 },
  pair: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 },
  pairAsset: { fontSize: 12, color: '#ccc', fontWeight: 500 },
  pairVs: { fontSize: 10, color: '#888' },
  stats: { display: 'flex', gap: 8, marginBottom: 10 },
  stat: { flex: 1, padding: '6px 4px', background: '#0f0f1e', borderRadius: 6 },
  statLabel: { display: 'block', fontSize: 8, color: '#888', textTransform: 'uppercase' },
  statVal: { fontSize: 13, fontWeight: 700, fontFamily: 'monospace' },
  insight: { fontSize: 11, color: '#aaa', lineHeight: 1.5, textAlign: 'left', marginBottom: 10, padding: '8px 10px', background: '#0f0f1e', borderRadius: 6 },
  shareRow: { display: 'flex', gap: 8, justifyContent: 'center' },
};

const gridStyles: Record<string, React.CSSProperties> = {
  container: { fontFamily: "'Inter', -apple-system, sans-serif" },
  header: { marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 700, color: '#e0e0e0', margin: 0 },
  subtitle: { fontSize: 11, color: '#888', margin: '2px 0 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
};

export { RatioCard, RatioCardGrid, DEMO_RATIOS, RatioGauge };
export type { RatioCardProps, RatioData };
