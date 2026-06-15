// ── R202 ML P3: DailyBriefingCard — AI每日简报卡片 ──────────
// Morning digest: Top 5 factor IC ranking + anomaly alerts + DeepSeek commentary
// Subscribe toggle: daily 1U auto-charge
// 7-day IC trend mini chart + factor comparison
// History sidebar: past briefings archive

import React, { useState, useMemo, useCallback } from 'react';
import { Button, Tag, Switch, Card, Tooltip, Skeleton, Empty } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
interface BriefingFactor {
  rank: number;
  id: string;
  name: string;
  ic: number;
  prevIC: number;
  signal: 'green' | 'yellow' | 'red';
  category: string;
}

interface BriefingAnomaly {
  factorId: string;
  factorName: string;
  type: 'surge' | 'plunge' | 'flip' | 'crowding';
  severity: 'high' | 'medium';
  message: string;
}

interface DailyBriefing {
  date: string;
  marketSummary: string;
  topFactors: BriefingFactor[];
  anomalies: BriefingAnomaly[];
  aiCommentary: string;
}

interface DailyBriefingCardProps {
  briefing?: DailyBriefing | null;
  subscribed?: boolean;
  onToggleSubscribe?: (subscribed: boolean) => void;
  onViewHistory?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  balance?: number | null;
}

// ── Demo Data ────────────────────────────────────────────────────────
function generateDemoBriefing(): DailyBriefing {
  return {
    date: new Date().toISOString().split('T')[0],
    marketSummary: 'Bullish — VIX at 14.3, market breadth improving, 3 sectors turning positive.',
    topFactors: [
      { rank: 1, id: 'MOM_12M1M', name: '12-1M Momentum', ic: 0.052, prevIC: 0.048, signal: 'green', category: 'Momentum' },
      { rank: 2, id: 'GAMMA_EXPOSURE', name: 'Gamma Exposure', ic: 0.047, prevIC: 0.041, signal: 'green', category: 'Options' },
      { rank: 3, id: 'EARNINGS_SURPRISE', name: 'Earnings Surprise', ic: 0.039, prevIC: 0.035, signal: 'green', category: 'Sentiment' },
      { rank: 4, id: 'BAB', name: 'BAB', ic: 0.031, prevIC: 0.029, signal: 'green', category: 'Low Vol' },
      { rank: 5, id: 'CMD_ROLL_YIELD', name: 'Roll Yield', ic: 0.028, prevIC: 0.022, signal: 'green', category: 'Commodity' },
    ],
    anomalies: [
      { factorId: 'SHORT_INTEREST', factorName: 'Short Interest', type: 'surge', severity: 'high', message: 'Short interest jumped 380% MoM in US tech — potential squeeze brewing.' },
      { factorId: 'US_GAMMA_EXPOSURE', factorName: 'Gamma Exposure (US)', type: 'flip', severity: 'medium', message: 'GEX flipped positive to +$2.8B. Dealer hedging supports dip buying.' },
    ],
    aiCommentary: '本周因子动量持续走强，MOM_12M1M已连续4周IC>0.04。短期关注做空比率飙升至危险区域(可引发逼空)。建议超配动量+低波组合，轻仓期权Gamma(已接近历史高位)。',
  };
}

// ── Historia Briefings ───────────────────────────────────────────────
const HISTORY_BRIEFINGS: DailyBriefing[] = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return {
    date: d.toISOString().split('T')[0],
    marketSummary: i < 4 ? 'Bullish — momentum strong, breadth expanding.' : 'Neutral — consolidation, sector rotation underway.',
    topFactors: [
      { rank: 1, id: 'MOM_12M1M', name: '12-1M Momentum', ic: 0.045 + i * 0.002, prevIC: 0.043, signal: 'green', category: 'Momentum' },
      { rank: 2, id: 'PE_RATIO', name: 'PE Ratio', ic: 0.03 + i * 0.001, prevIC: 0.029, signal: 'green', category: 'Value' },
      { rank: 3, id: 'ROE', name: 'ROE', ic: 0.025, prevIC: 0.024, signal: 'yellow', category: 'Quality' },
    ],
    anomalies: [],
    aiCommentary: '因子表现稳定。' + (i < 4 ? '动量持续领跑。建议维持现有配置。' : '市场进入横盘，因子IC收窄。建议轻仓。'),
  };
});

// ── Mini SVG Trend ─────────────────────────────────────────────────
function MiniICTrend({ history }: { history: { date: string; ic: number }[] }) {
  const w = 160; const h = 40; const pad = { l: 5, r: 5, t: 5, b: 5 };
  const cw = w - pad.l - pad.r; const ch = h - pad.t - pad.b;
  const vals = history.map(d => d.ic);
  const yMin = Math.min(...vals, 0) * 1.1; const yMax = Math.max(...vals, 0) * 1.1;
  const toX = (i: number) => pad.l + (i / Math.max(vals.length - 1, 1)) * cw;
  const toY = (v: number) => pad.t + ch - ((v - yMin) / (yMax - yMin)) * ch;
  const path = history.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.ic).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h}>
      <line x1={pad.l} y1={toY(0)} x2={w - pad.r} y2={toY(0)} stroke="#2a2a4a" strokeWidth={0.5} />
      <path d={path} fill="none" stroke="#66bd63" strokeWidth={1.5} />
      <circle cx={toX(vals.length - 1)} cy={toY(vals[vals.length - 1])} r={2.5} fill="#66bd63" />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────
const DailyBriefingCard: React.FC<DailyBriefingCardProps> = ({
  briefing: propBriefing,
  subscribed = false,
  onToggleSubscribe,
  onRefresh,
  loading = false,
  balance,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const briefing = propBriefing || (loading ? null : generateDemoBriefing());
  const insufficient = balance !== null && balance !== undefined && balance < 1;

  // Build IC trend data from top factor
  const topFactorTrend = useMemo(() => {
    if (!briefing) return [];
    return HISTORY_BRIEFINGS.map(h => {
      const tf = h.topFactors[0];
      return { date: h.date, ic: tf?.ic || 0 };
    });
  }, [briefing]);

  const handleToggleSub = useCallback((checked: boolean) => {
    onToggleSubscribe?.(checked);
  }, [onToggleSubscribe]);

  if (loading) {
    return (
      <Card style={cs.card} bodyStyle={{ padding: 16 }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  if (!briefing) {
    return (
      <Card style={cs.card} bodyStyle={{ padding: 16 }}>
        <Empty description="No briefing available" />
      </Card>
    );
  }

  return (
    <div style={cs.card}>
      {/* Header */}
      <div style={cs.header}>
        <div style={cs.headerLeft}>
          <span style={cs.headerIcon}>📰</span>
          <div>
            <div style={cs.headerTitle}>AI Daily Factor Briefing</div>
            <div style={cs.headerDate}>
              <CalendarOutlined style={{ fontSize: 10 }} /> {briefing.date}
              <Tag color="green" style={cs.marketTag}>{briefing.marketSummary.split('—')[0]}</Tag>
            </div>
          </div>
        </div>
        <div style={cs.headerRight}>
          <div style={cs.subRow}>
            <span style={cs.subLabel}>Daily</span>
            <Switch checked={subscribed} onChange={handleToggleSub} size="small" />
          </div>
          <Tag color="gold" style={cs.priceTag}>1U/day</Tag>
        </div>
      </div>

      {/* Market Summary */}
      <div style={cs.summary}>
        <span>📊 {briefing.marketSummary}</span>
      </div>

      {/* Top 5 Factors */}
      <div style={cs.sectionTitle}>🏆 Top 5 Factors</div>
      <div style={cs.factorList}>
        {briefing.topFactors.map((f) => {
          const change = f.ic - f.prevIC;
          return (
            <div key={f.id} style={cs.factorRow}>
              <span style={cs.factorRank}>#{f.rank}</span>
              <span style={cs.factorName}>{f.name}</span>
              <span style={cs.factorCat}>{f.category}</span>
              <span style={{
                ...cs.factorIC,
                color: f.ic >= 0.03 ? '#66bd63' : f.ic >= 0 ? '#d4a853' : '#f46d43',
              }}>
                +{(f.ic * 100).toFixed(1)}%
              </span>
              <Tooltip title={`Change: ${change >= 0 ? '+' : ''}${(change * 100).toFixed(2)}%`}>
                <span style={{ color: change >= 0 ? '#66bd63' : '#f46d43', fontSize: 10, fontFamily: 'monospace' }}>
                  {change >= 0 ? '↑' : '↓'}
                </span>
              </Tooltip>
              <span>{f.signal === 'green' ? '🟢' : f.signal === 'yellow' ? '🟡' : '🔴'}</span>
            </div>
          );
        })}
      </div>

      {/* Anomalies */}
      {briefing.anomalies.length > 0 && (
        <>
          <div style={cs.sectionTitle}>🚨 Anomaly Alerts</div>
          {briefing.anomalies.map((a, i) => (
            <div key={i} style={{ ...cs.anomalyRow, borderLeft: `3px solid ${a.severity === 'high' ? '#d73027' : '#d4a853'}` }}>
              <div style={cs.anomalyHeader}>
                <Tag color={a.severity === 'high' ? 'red' : 'orange'} style={{ fontSize: 9 }}>
                  {a.type === 'surge' ? '📈 Surge' : a.type === 'plunge' ? '📉 Plunge' : a.type === 'flip' ? '🔄 Flip' : '👥 Crowding'}
                </Tag>
                <span style={cs.anomalyName}>{a.factorName}</span>
              </div>
              <p style={cs.anomalyMsg}>{a.message}</p>
            </div>
          ))}
        </>
      )}

      {/* 7-Day IC Trend */}
      <div style={{ ...cs.sectionTitle, marginTop: 10 }}>📈 Top Factor IC Trend (7 days)</div>
      <div style={cs.trendRow}>
        <MiniICTrend history={topFactorTrend} />
        <div style={cs.trendStats}>
          <div style={cs.trendStat}>
            <span style={cs.trendStatLabel}>Latest</span>
            <span style={{ ...cs.trendStatVal, color: '#66bd63' }}>
              +{(topFactorTrend[topFactorTrend.length - 1]?.ic * 100 || 0).toFixed(1)}%
            </span>
          </div>
          <div style={cs.trendStat}>
            <span style={cs.trendStatLabel}>7d Avg</span>
            <span style={{ ...cs.trendStatVal, color: '#d4a853' }}>
              +{(topFactorTrend.reduce((s, d) => s + d.ic, 0) / topFactorTrend.length * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* AI Commentary — premium gate */}
      {showAI ? (
        <div style={cs.aiSection}>
          <div style={cs.sectionTitle}>🤖 DeepSeek Market Commentary</div>
          <p style={cs.aiText}>{briefing.aiCommentary}</p>
        </div>
      ) : (
        <div style={cs.aiGate}>
          <div style={cs.aiGateBlur}>
            <p style={cs.aiGateHint}>AI market commentary available — 1U</p>
          </div>
          <Button type="primary" size="small" onClick={() => setShowAI(true)} disabled={insufficient}
            style={{ background: '#d4a853', border: 'none', fontWeight: 600, borderRadius: 6 }}>
            🔓 Unlock AI Commentary — 1U
          </Button>
        </div>
      )}

      {/* Footer Actions */}
      <div style={cs.footer}>
        <Button size="small" type="link" onClick={() => setShowHistory(!showHistory)}
          style={{ color: '#888', fontSize: 10, padding: 0 }}>
          {showHistory ? '▲ Hide History' : '▼ 7-Day History'}
        </Button>
        <Button size="small" type="link" onClick={onRefresh} style={{ color: '#888', fontSize: 10, padding: 0 }}>
          🔄 Refresh
        </Button>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div style={cs.historyPanel}>
          {HISTORY_BRIEFINGS.map((hb) => (
            <div key={hb.date} style={cs.historyItem}>
              <span style={cs.historyDate}>{hb.date}</span>
              <span style={cs.historySummary}>{hb.marketSummary}</span>
              <span style={{ fontSize: 9, color: '#d4a853' }}>{hb.topFactors[0]?.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const cs: Record<string, React.CSSProperties> = {
  card: {
    background: '#1a1a2e', borderRadius: 12, padding: 18,
    border: '1px solid #2a2a4a', fontFamily: "'Inter', -apple-system, sans-serif",
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerLeft: { display: 'flex', gap: 10 },
  headerIcon: { fontSize: 24 },
  headerTitle: { fontSize: 15, fontWeight: 700, color: '#e0e0e0' },
  headerDate: { fontSize: 10, color: '#888', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 },
  marketTag: { fontSize: 9, padding: '0 4px' },
  headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  subRow: { display: 'flex', alignItems: 'center', gap: 6 },
  subLabel: { fontSize: 10, color: '#888' },
  priceTag: { fontSize: 10, fontWeight: 600 },
  summary: { padding: '8px 12px', background: 'rgba(102,189,99,0.08)', borderRadius: 8, marginBottom: 12, fontSize: 11, color: '#aaa' },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: '#ccc', marginBottom: 8 },
  factorList: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 },
  factorRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#0f0f1e', borderRadius: 6, fontSize: 11 },
  factorRank: { color: '#d4a853', fontWeight: 700, fontFamily: 'monospace', minWidth: 22 },
  factorName: { flex: 1, color: '#e0e0e0', fontWeight: 500 },
  factorCat: { fontSize: 9, color: '#666' },
  factorIC: { fontSize: 11, fontFamily: 'monospace', fontWeight: 700, minWidth: 45, textAlign: 'right' },
  anomalyRow: { padding: '8px 10px', background: '#0f0f1e', borderRadius: 6, marginBottom: 6 },
  anomalyHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 },
  anomalyName: { fontSize: 11, fontWeight: 600, color: '#e0e0e0' },
  anomalyMsg: { fontSize: 10, color: '#aaa', margin: 0, lineHeight: 1.4 },
  trendRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  trendStats: { display: 'flex', gap: 12 },
  trendStat: { textAlign: 'center' },
  trendStatLabel: { display: 'block', fontSize: 8, color: '#888' },
  trendStatVal: { fontSize: 14, fontWeight: 700, fontFamily: 'monospace' },
  aiSection: { padding: '10px 12px', background: 'rgba(212,168,83,0.08)', borderRadius: 8, marginBottom: 10 },
  aiText: { fontSize: 11, color: '#ccc', lineHeight: 1.6, margin: '4px 0 0' },
  aiGate: { textAlign: 'center', padding: '12px 0', marginBottom: 8 },
  aiGateBlur: { filter: 'blur(3px)', opacity: 0.4, pointerEvents: 'none' },
  aiGateHint: { color: '#888', fontSize: 12, margin: 0 },
  footer: { display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #2a2a4a' },
  historyPanel: { marginTop: 8 },
  historyItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 10, borderBottom: '1px solid #1a1a3e' },
  historyDate: { fontFamily: 'monospace', color: '#888', minWidth: 80 },
  historySummary: { flex: 1, color: '#aaa' },
};

export { DailyBriefingCard, generateDemoBriefing, HISTORY_BRIEFINGS };
export type { DailyBriefingCardProps, DailyBriefing, BriefingFactor, BriefingAnomaly };
