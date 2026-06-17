/**
 * LimitUpDownPanel — R272 ML#4: 涨跌停板面板 (CN A-share)
 *
 * A-share limit up/down board tracking:
 * - Real-time limit hit stocks
 * - Consecutive limit boards
 * - First-time vs N-time boards
 * - Sector heatmap
 * - Crack/fail board detection
 * - Market sentiment index
 */
import React, { useState, useMemo } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
type BoardType = 'first' | 'consecutive' | 'cracked' | 'limit_down';

interface LimitStock {
  symbol: string;
  name: string;
  market: 'SH' | 'SZ';
  boardType: BoardType;
  consecutiveDays: number;
  price: number;
  changePct: number;
  turnover: number;        // CNY mn
  turnoverRate: number;    // %
  sealAmount: number;      // CNY bn (封单金额)
  sealRatio: number;       // % of float
  openCount: number;       // 炸板次数
  sector: string;
  reason: string;
  firstHitTime: string;
}

interface SentimentCard {
  limitUpCount: number;
  limitDownCount: number;
  crackedCount: number;
  consecutiveBoards: number;
  sentimentScore: number;  // 0-100
  prevScore: number;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_LIMIT_STOCKS: LimitStock[] = [
  { symbol: '600519', name: 'Kweichow Moutai', market: 'SH', boardType: 'first', consecutiveDays: 1, price: 1680, changePct: 10.0, turnover: 5800, turnoverRate: 2.1, sealAmount: 3.5, sealRatio: 1.2, openCount: 0, sector: 'Consumer', reason: 'Earnings beat + buyback', firstHitTime: '09:35' },
  { symbol: '601012', name: 'LONGi Green Energy', market: 'SH', boardType: 'consecutive', consecutiveDays: 3, price: 45.2, changePct: 10.0, turnover: 2100, turnoverRate: 8.5, sealAmount: 1.8, sealRatio: 3.5, openCount: 1, sector: 'New Energy', reason: 'Policy catalyst: solar subsidy', firstHitTime: '09:31' },
  { symbol: '300750', name: 'CATL', market: 'SZ', boardType: 'first', consecutiveDays: 1, price: 285, changePct: 20.0, turnover: 12500, turnoverRate: 15.2, sealAmount: 5.2, sealRatio: 2.1, openCount: 0, sector: 'New Energy', reason: 'New battery tech announcement', firstHitTime: '09:42' },
  { symbol: '002475', name: 'Luxshare Precision', market: 'SZ', boardType: 'cracked', consecutiveDays: 0, price: 32.5, changePct: 5.2, turnover: 3200, turnoverRate: 12.8, sealAmount: 0, sealRatio: 0, openCount: 3, sector: 'Electronics', reason: 'Apple supply chain rally (failed)', firstHitTime: '09:38' },
  { symbol: '600036', name: 'CM Bank', market: 'SH', boardType: 'limit_down', consecutiveDays: 1, price: 35.2, changePct: -10.0, turnover: 4500, turnoverRate: 3.1, sealAmount: 0, sealRatio: 0, openCount: 0, sector: 'Financials', reason: 'Regulatory fine announcement', firstHitTime: '09:25' },
  { symbol: '002594', name: 'BYD', market: 'SZ', boardType: 'consecutive', consecutiveDays: 5, price: 380, changePct: 10.0, turnover: 8200, turnoverRate: 22.5, sealAmount: 6.5, sealRatio: 4.2, openCount: 2, sector: 'Auto', reason: 'Record monthly deliveries', firstHitTime: '09:30' },
  { symbol: '000858', name: 'Wuliangye', market: 'SZ', boardType: 'first', consecutiveDays: 1, price: 165, changePct: 10.0, turnover: 2800, turnoverRate: 2.8, sealAmount: 2.2, sealRatio: 1.5, openCount: 0, sector: 'Consumer', reason: 'Holiday season demand outlook', firstHitTime: '10:15' },
  { symbol: '600809', name: 'Shanxi Fenjiu', market: 'SH', boardType: 'cracked', consecutiveDays: 0, price: 280, changePct: 6.8, turnover: 1800, turnoverRate: 8.2, sealAmount: 0, sealRatio: 0, openCount: 2, sector: 'Consumer', reason: 'Sector rally (profit taking)', firstHitTime: '09:55' },
  { symbol: '601318', name: 'Ping An Insurance', market: 'SH', boardType: 'limit_down', consecutiveDays: 2, price: 42.5, changePct: -10.0, turnover: 6800, turnoverRate: 5.5, sealAmount: 0, sealRatio: 0, openCount: 0, sector: 'Financials', reason: 'Investment loss disclosure', firstHitTime: '09:25' },
];

const MOCK_SENTIMENT: SentimentCard = {
  limitUpCount: 45, limitDownCount: 8, crackedCount: 12, consecutiveBoards: 15,
  sentimentScore: 68, prevScore: 55,
};

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
function SentimentMeter({ score, prev }: { score: number; prev: number }) {
  const angle = (score / 100) * 180;
  const color = score > 70 ? '#22c55e' : score > 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 200 120" width="160" height="96">
        <path d="M20,110 A90,90 0 0,1 180,110" fill="none" stroke="var(--bg-input)" strokeWidth="12" />
        <path d="M20,110 A90,90 0 0,1 180,110" fill="none" 
          stroke={color} strokeWidth="12" strokeDasharray={`${(angle / 180) * 283} 283`} />
        <circle cx={20 + (angle / 180) * 160} cy={110 - Math.sin((angle / 180) * Math.PI) * 90} r="6" fill={color} />
      </svg>
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
        Sentiment: <span style={{ fontWeight: 700, color }}>{score}</span>
        <span style={{ marginLeft: 4, color: score > prev ? '#22c55e' : '#ef4444', fontSize: 9 }}>
          {score > prev ? '↑' : '↓'}{Math.abs(score - prev)}
        </span>
      </div>
    </div>
  );
}

function BoardBadge({ type, days }: { type: BoardType; days: number }) {
  const config: Record<BoardType, { bg: string; fg: string; label: string }> = {
    first: { bg: 'rgba(34,197,94,.15)', fg: '#22c55e', label: '🔰 First' },
    consecutive: { bg: 'rgba(168,85,247,.15)', fg: '#a855f7', label: `🔁 ${days}连板` },
    cracked: { bg: 'rgba(245,158,11,.15)', fg: '#f59e0b', label: '💥 Cracked' },
    limit_down: { bg: 'rgba(239,68,68,.15)', fg: '#ef4444', label: '📉 Limit Down' },
  };
  const c = config[type];
  return <span style={{ padding: '1px 6px', borderRadius: 4, background: c.bg, color: c.fg, fontSize: 10, fontWeight: 600 }}>{c.label}{type === 'consecutive' && days > 1 ? '' : ''}</span>;
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const LimitUpDownPanel: React.FC = () => {
  const [filter, setFilter] = useState<BoardType | 'all'>('all');
  const filters: (BoardType | 'all')[] = ['all', 'first', 'consecutive', 'cracked', 'limit_down'];

  const filtered = useMemo(() => {
    if (filter === 'all') return MOCK_LIMIT_STOCKS;
    return MOCK_LIMIT_STOCKS.filter(s => s.boardType === filter);
  }, [filter]);

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🇨🇳 A-Share Board Tracker (涨跌停板)</h3>
      </div>

      {/* Sentiment & KPI Row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'stretch' }}>
        <SentimentMeter score={MOCK_SENTIMENT.sentimentScore} prev={MOCK_SENTIMENT.prevScore} />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          {[
            { label: '涨停', val: MOCK_SENTIMENT.limitUpCount, color: '#ef4444' },
            { label: '跌停', val: MOCK_SENTIMENT.limitDownCount, color: '#22c55e' },
            { label: '炸板', val: MOCK_SENTIMENT.crackedCount, color: '#f59e0b' },
            { label: '连板', val: MOCK_SENTIMENT.consecutiveBoards, color: '#a855f7' },
          ].map(item => (
            <div key={item.label} style={{ padding: 6, borderRadius: 6, background: 'var(--bg-card)', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)',
            background: filter === f ? 'var(--accent)' : 'transparent',
            color: filter === f ? '#fff' : 'var(--text)', fontSize: 11, cursor: 'pointer', fontWeight: 600,
          }}>{f === 'all' ? 'All' : f}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={thL}>Symbol</th>
              <th style={thL}>Board</th>
              <th style={thL}>Price</th>
              <th style={thL}>Chg%</th>
              <th style={thL}>Turnover</th>
              <th style={thL}>Turn%</th>
              <th style={thL}>封单</th>
              <th style={thL}>炸板</th>
              <th style={thL}>Sector</th>
              <th style={thL}>Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdL}>
                  <div style={{ fontWeight: 700 }}>{s.symbol}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{s.name} <span style={{ fontSize: 9, color: s.market === 'SH' ? '#60a5fa' : '#f472b6' }}>{s.market}</span></div>
                </td>
                <td style={tdL}><BoardBadge type={s.boardType} days={s.consecutiveDays} /></td>
                <td style={{ ...tdL, textAlign: 'right' }}>¥{s.price.toFixed(1)}</td>
                <td style={{ ...tdL, textAlign: 'right', fontWeight: 600, color: s.changePct > 0 ? '#ef4444' : s.changePct < 0 ? '#22c55e' : 'var(--text)' }}>
                  {s.changePct > 0 ? '+' : ''}{s.changePct.toFixed(1)}%
                </td>
                <td style={{ ...tdL, textAlign: 'right' }}>{s.turnover.toFixed(0)}M</td>
                <td style={{ ...tdL, textAlign: 'right' }}>{s.turnoverRate.toFixed(1)}%</td>
                <td style={{ ...tdL, textAlign: 'right', color: s.sealAmount > 0 ? '#22c55e' : 'var(--text-dim)' }}>
                  {s.sealAmount > 0 ? `${s.sealAmount.toFixed(1)}B` : '—'}
                </td>
                <td style={{ ...tdL, textAlign: 'center' }}>
                  {s.openCount > 0 ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>{s.openCount}×</span> : <span style={{ color: 'var(--text-dim)' }}>0</span>}
                </td>
                <td style={tdL}><span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'var(--bg-input)' }}>{s.sector}</span></td>
                <td style={tdL}><span style={{ fontSize: 10 }}>{s.firstHitTime}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Alert row */}
      <div style={{ marginTop: 12, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)' }}>
        <strong>Crack alerts:</strong> {MOCK_LIMIT_STOCKS.filter(s => s.boardType === 'cracked').map(s => `${s.symbol}(${s.openCount}×炸板) — ${s.reason}`).join(' | ')}
      </div>
    </div>
  );
};

const thL: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdL: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle' };

export default LimitUpDownPanel;
