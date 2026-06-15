// ── R199 ML P15-01: COTTrackerPanel — CFTC持仓追踪器 ──────────
// Three-line chart: Commercial (blue) / Speculator (orange) / Retail (grey)
// Net long positions over time with signal bar at bottom
// "大佬加仓做多🟢" / "大户悄悄减仓🟡" / "散户疯狂追高🔴"
// Weekly updated. Source: CFTC Commitment of Traders Report.

import React, { useState, useMemo } from 'react';
import { Tag } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
interface COTPosition {
  date: string;
  commercial: number;  // net long (contracts)
  speculator: number;
  retail: number;
}

interface COTConfig {
  commodity: string;
  commodityEmoji: string;
  signal: 'green' | 'yellow' | 'red';
  commercialChange: string; // e.g. "+8,200 contracts"
  speculatorChange: string;
  retailChange: string;
  insight: string;
  weekLabel: string;
}

interface COTTrackerPanelProps {
  commodity: string;
  commodityEmoji: string;
  data?: COTPosition[];
  config?: Partial<COTConfig>;
}

// ── Demo Data Generator ─────────────────────────────────────────────
function generateCOTData(commodity: string): COTPosition[] {
  const seed = commodity.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const positions: COTPosition[] = [];
  let commercial = 150000 + seed * 1000;
  let speculator = 80000 - seed * 500;
  let retail = -20000 + seed * 300;

  for (let w = 0; w < 52; w++) {
    const date = new Date(2024, 5, 1); // June 2024 start
    date.setDate(date.getDate() - (51 - w) * 7);

    const drift = Math.sin(w * 0.15 + seed * 0.01) * 8000;
    const noise = (Math.sin(w * 1.7 + seed) * 3000);

    commercial += drift * 0.6 + noise * 0.4;
    speculator += drift * 0.4 - noise * 0.5;
    retail += noise * 0.3 - drift * 0.2;

    positions.push({
      date: date.toISOString().split('T')[0],
      commercial: Math.round(commercial),
      speculator: Math.round(speculator),
      retail: Math.round(retail),
    });
  }
  return positions;
}

function getCOTSignal(positions: COTPosition[]): COTConfig {
  const last = positions[positions.length - 1];
  const prev = positions[positions.length - 2];

  const commChange = last.commercial - prev.commercial;
  const specChange = last.speculator - prev.speculator;
  const retailChange = last.retail - prev.retail;

  // Signal logic: commercial = smart money, spec = trend follower, retail = contrarian
  const commercialStrong = commChange > 5000;
  const retailExtreme = Math.abs(retailChange) > 10000;

  let signal: COTConfig['signal'] = 'yellow';
  if (commercialStrong && !retailExtreme) signal = 'green';
  if (retailExtreme && !commercialStrong) signal = 'red';

  const fmtK = (n: number) => `${n >= 0 ? '+' : ''}${(n / 1000).toFixed(1)}K`;

  const insights: Record<string, string> = {
    green: '商业持仓(大佬)净多单增加→产商套保减少→看多。聪明钱在进场。',
    yellow: '商业与投机头寸分歧→方向不明。等新一周COT确认信号再行动。',
    red: '散户净多单飙升+商业净多单减少→散户在追高、大佬在撤退。谨慎！',
  };

  return {
    commodity: '',
    commodityEmoji: '',
    signal,
    commercialChange: `${fmtK(commChange)} contracts`,
    speculatorChange: `${fmtK(specChange)} contracts`,
    retailChange: `${fmtK(retailChange)} contracts`,
    insight: insights[signal],
    weekLabel: last.date,
  };
}

// ── Mini SVG Line Chart ─────────────────────────────────────────────
function COTLineChart({ positions, width, height }: { positions: COTPosition[]; width: number; height: number }) {
  const pad = { top: 15, right: 10, bottom: 25, left: 50 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const allValues = positions.flatMap((p) => [p.commercial, p.speculator, p.retail]);
  const yMin = Math.min(...allValues) * 0.95;
  const yMax = Math.max(...allValues) * 1.05;

  const toX = (i: number) => pad.left + (i / Math.max(positions.length - 1, 1)) * chartW;
  const toY = (v: number) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const makePath = (key: 'commercial' | 'speculator' | 'retail') =>
    positions.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p[key]).toFixed(1)}`).join(' ');

  const colors = { commercial: '#4a90d9', speculator: '#FF8C00', retail: '#888' };

  return (
    <svg width={width} height={height} style={{ fontFamily: 'monospace' }}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + chartH * (1 - frac);
        const v = yMin + (yMax - yMin) * frac;
        return (
          <g key={frac}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#2a2a4a" strokeWidth={0.5} />
            <text x={pad.left - 6} y={y + 4} fill="#666" fontSize={8} textAnchor="end">
              {Math.round(v).toLocaleString()}
            </text>
          </g>
        );
      })}

      {/* Zero line */}
      {yMin < 0 && yMax > 0 && (
        <line x1={pad.left} x2={width - pad.right} y1={toY(0)} y2={toY(0)} stroke="#4a4a6a" strokeWidth={1} strokeDasharray="4,2" />
      )}

      {/* Lines */}
      {(['commercial', 'speculator', 'retail'] as const).map((key) => (
        <path key={key} d={makePath(key)} fill="none" stroke={colors[key]} strokeWidth={1.5} opacity={key === 'retail' ? 0.5 : 1} />
      ))}

      {/* X labels */}
      {[0, 12, 25, 38, 51].map((i) => {
        const p = positions[i] || positions[positions.length - 1];
        return (
          <text key={i} x={toX(i)} y={height - 6} fill="#666" fontSize={8} textAnchor="middle">
            {p.date.slice(0, 7)}
          </text>
        );
      })}
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────
const COTTrackerPanel: React.FC<COTTrackerPanelProps> = ({
  commodity,
  commodityEmoji,
  data: propData,
  config: propConfig,
}) => {
  const [showDetail, setShowDetail] = useState(false);

  const positions = useMemo(() => propData || generateCOTData(commodity), [commodity, propData]);
  const signal = useMemo(() => getCOTSignal(positions), [positions]);

  const config: COTConfig = {
    ...signal,
    commodity,
    commodityEmoji,
    ...propConfig,
  };

  const lastPos = positions[positions.length - 1];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.emoji}>{config.commodityEmoji}</span>
        <div style={{ flex: 1 }}>
          <div style={styles.title}>COT Position Tracker</div>
          <div style={styles.subtitle}>{commodity} — CFTC Commitment of Traders</div>
        </div>
        <Tag color={config.signal === 'green' ? 'green' : config.signal === 'red' ? 'red' : 'orange'}
          style={{ fontSize: 13, fontWeight: 700, padding: '4px 12px' }}>
          {config.signal === 'green' ? '🟢 大佬加仓' : config.signal === 'red' ? '🔴 散户追高' : '🟡 观望分歧'}
        </Tag>
      </div>

      {/* Mini Chart */}
      <div style={styles.chartWrapper}>
        <COTLineChart positions={positions} width={520} height={160} />
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#4a90d9' }} /> Commercial (产业客户)</span>
        <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#FF8C00' }} /> Speculator (投机基金)</span>
        <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#888', opacity: 0.5 }} /> Retail (散户)</span>
      </div>

      {/* Signal Bar */}
      <div style={{ ...styles.signalBar, background: config.signal === 'green' ? 'rgba(102,189,99,0.1)' : config.signal === 'red' ? 'rgba(244,109,67,0.1)' : 'rgba(212,168,83,0.1)' }}>
        <span style={styles.signalEmoji}>{config.signal === 'green' ? '🐋' : config.signal === 'red' ? '🐟' : '⚖️'}</span>
        <span style={styles.signalText}>{config.insight}</span>
      </div>

      {/* Weekly Change Table */}
      <div style={styles.changeRow}>
        <div style={styles.changeCol}>
          <div style={styles.changeLabel}>商业净多</div>
          <div style={{ ...styles.changeVal, color: config.commercialChange.startsWith('+') ? '#66bd63' : '#f46d43' }}>
            {config.commercialChange}
          </div>
        </div>
        <div style={styles.changeCol}>
          <div style={styles.changeLabel}>投机净多</div>
          <div style={{ ...styles.changeVal, color: config.speculatorChange.startsWith('+') ? '#66bd63' : '#f46d43' }}>
            {config.speculatorChange}
          </div>
        </div>
        <div style={styles.changeCol}>
          <div style={styles.changeLabel}>散户净多</div>
          <div style={{ ...styles.changeVal, color: config.retailChange.startsWith('+') ? '#66bd63' : '#f46d43' }}>
            {config.retailChange}
          </div>
        </div>
      </div>

      {/* Expand: Full Positions Detail */}
      {showDetail && (
        <div style={styles.detail}>
          <div style={styles.detailTitle}>52-Week Position Summary</div>
          <div style={styles.detailGrid}>
            <div style={styles.detailCard}>
              <div style={styles.detailCardLabel}>Commercial (产业)</div>
              <div style={{ ...styles.detailCardVal, color: '#4a90d9' }}>{lastPos.commercial.toLocaleString()}</div>
              <div style={styles.detailCardSub}>52-week range: {Math.min(...positions.map(p => p.commercial)).toLocaleString()} ~ {Math.max(...positions.map(p => p.commercial)).toLocaleString()}</div>
            </div>
            <div style={styles.detailCard}>
              <div style={styles.detailCardLabel}>Speculator (基金)</div>
              <div style={{ ...styles.detailCardVal, color: '#FF8C00' }}>{lastPos.speculator.toLocaleString()}</div>
              <div style={styles.detailCardSub}>52-week range: {Math.min(...positions.map(p => p.speculator)).toLocaleString()} ~ {Math.max(...positions.map(p => p.speculator)).toLocaleString()}</div>
            </div>
            <div style={styles.detailCard}>
              <div style={styles.detailCardLabel}>Retail (散户)</div>
              <div style={{ ...styles.detailCardVal, color: '#888' }}>{lastPos.retail.toLocaleString()}</div>
              <div style={styles.detailCardSub}>Net position — negative = net short</div>
            </div>
          </div>
        </div>
      )}

      {/* Toggle */}
      <div style={styles.toggle} onClick={() => setShowDetail(!showDetail)}>
        <span style={{ color: '#888' }}>{showDetail ? '▲ Hide Details' : '▼ Show 52-Week Details'}</span>
        <Tag style={{ fontSize: 9 }}>Updated: {config.weekLabel}</Tag>
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
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  emoji: { fontSize: 28 },
  title: { fontSize: 16, fontWeight: 700, color: '#e0e0e0' },
  subtitle: { fontSize: 11, color: '#888' },
  chartWrapper: { display: 'flex', justifyContent: 'center', marginBottom: 8 },
  legend: { display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 10 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#aaa' },
  legendDot: { width: 10, height: 3, borderRadius: 1, display: 'inline-block' },
  signalBar: { padding: '10px 14px', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 },
  signalEmoji: { fontSize: 20, flexShrink: 0 },
  signalText: { fontSize: 12, color: '#ccc', lineHeight: 1.6 },
  changeRow: { display: 'flex', gap: 8, marginBottom: 8 },
  changeCol: { flex: 1, padding: '8px', background: '#0f0f1e', borderRadius: 8, textAlign: 'center' },
  changeLabel: { fontSize: 9, color: '#888', marginBottom: 2 },
  changeVal: { fontSize: 13, fontWeight: 700, fontFamily: 'monospace' },
  detail: { marginBottom: 10 },
  detailTitle: { fontSize: 11, color: '#aaa', fontWeight: 600, marginBottom: 6 },
  detailGrid: { display: 'flex', gap: 8 },
  detailCard: { flex: 1, padding: '8px 10px', background: '#0f0f1e', borderRadius: 8 },
  detailCardLabel: { fontSize: 10, color: '#888', marginBottom: 2 },
  detailCardVal: { fontSize: 16, fontWeight: 800, fontFamily: 'monospace' },
  detailCardSub: { fontSize: 8, color: '#555', marginTop: 2 },
  toggle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', cursor: 'pointer' },
};

export { COTTrackerPanel, generateCOTData, getCOTSignal };
export type { COTTrackerPanelProps, COTPosition, COTConfig };
