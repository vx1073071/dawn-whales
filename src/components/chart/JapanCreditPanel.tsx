/**
 * JapanCreditPanel — R272 ML#5: 信用取引パネル (Japan Margin/Credit Trading)
 *
 * JPX margin trading data:
 * - Margin buy/sell balance (weekly)
 * - Margin ratio vs 25D MA (overheat signal)
 * - Sector credit aggregation
 * - Top issues by margin balance change
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface MarginIssue {
  code: string;
  name: string;
  market: 'TSE1' | 'TSE2' | 'Mothers' | 'JASDAQ';
  marginBuy: number;       // 100M JPY units
  marginSell: number;
  buyChange: number;       // WoW
  sellChange: number;
  marginRatio: number;     // buy/(buy+sell) %
  marginRatio25D: number;  // 25D MA
  overheat: 'normal' | 'caution' | 'danger';
  price: number;
  changePct: number;
}

interface MarketCredit {
  week: string;
  totalBuy: number;   // JPY 100M
  totalSell: number;
  balanceRatio: number;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_MARGIN_ISSUES: MarginIssue[] = [
  { code: '7203', name: 'Toyota Motor', market: 'TSE1', marginBuy: 4250, marginSell: 3120, buyChange: 350, sellChange: -120, marginRatio: 57.7, marginRatio25D: 55.2, overheat: 'normal', price: 2850, changePct: 1.2 },
  { code: '6758', name: 'Sony Group', market: 'TSE1', marginBuy: 2850, marginSell: 1980, buyChange: 520, sellChange: 80, marginRatio: 59.0, marginRatio25D: 53.5, overheat: 'caution', price: 14250, changePct: 3.5 },
  { code: '9984', name: 'SoftBank Group', market: 'TSE1', marginBuy: 6100, marginSell: 5200, buyChange: -180, sellChange: 450, marginRatio: 54.0, marginRatio25D: 58.1, overheat: 'normal', price: 8920, changePct: -0.8 },
  { code: '7974', name: 'Nintendo', market: 'TSE1', marginBuy: 1800, marginSell: 1100, buyChange: 280, sellChange: -50, marginRatio: 62.1, marginRatio25D: 58.5, overheat: 'caution', price: 7850, changePct: 2.1 },
  { code: '6501', name: 'Hitachi', market: 'TSE1', marginBuy: 2100, marginSell: 1350, buyChange: 420, sellChange: 90, marginRatio: 60.9, marginRatio25D: 54.3, overheat: 'danger', price: 14200, changePct: 4.8 },
  { code: '4568', name: 'Daiichi Sankyo', market: 'TSE1', marginBuy: 3200, marginSell: 2150, buyChange: 180, sellChange: -80, marginRatio: 59.8, marginRatio25D: 57.2, overheat: 'normal', price: 5620, changePct: 0.5 },
  { code: '6861', name: 'Keyence', market: 'TSE1', marginBuy: 1500, marginSell: 1800, buyChange: -250, sellChange: 350, marginRatio: 45.5, marginRatio25D: 49.8, overheat: 'normal', price: 68500, changePct: -1.8 },
  { code: '4755', name: 'Rakuten Group', market: 'TSE1', marginBuy: 4200, marginSell: 3800, buyChange: 680, sellChange: 120, marginRatio: 52.5, marginRatio25D: 48.0, overheat: 'caution', price: 820, changePct: 2.8 },
];

const MOCK_MARKET_CREDIT: MarketCredit[] = [
  { week: 'W-4', totalBuy: 48500, totalSell: 42000, balanceRatio: 53.6 },
  { week: 'W-3', totalBuy: 47200, totalSell: 41500, balanceRatio: 53.2 },
  { week: 'W-2', totalBuy: 46800, totalSell: 41800, balanceRatio: 52.8 },
  { week: 'W-1', totalBuy: 47500, totalSell: 41200, balanceRatio: 53.5 },
  { week: 'This', totalBuy: 49200, totalSell: 42200, balanceRatio: 53.8 },
];

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
function OverheatBadge({ level }: { level: MarginIssue['overheat'] }) {
  const c = level === 'danger' ? { bg: 'rgba(239,68,68,.15)', fg: '#ef4444', t: '🔥 Danger' }
    : level === 'caution' ? { bg: 'rgba(245,158,11,.15)', fg: '#f59e0b', t: '⚠️ Caution' }
    : { bg: 'rgba(34,197,94,.15)', fg: '#22c55e', t: '✅ Normal' };
  return <span style={{ padding: '1px 6px', borderRadius: 4, background: c.bg, color: c.fg, fontSize: 10, fontWeight: 600 }}>{c.t}</span>;
}

function MarginRatioBar({ ratio, ma25 }: { ratio: number; ma25: number }) {
  const max = 80;
  const rPct = (ratio / max) * 100;
  const maPct = (ma25 / max) * 100;
  const over = ratio > ma25 + 5;
  const under = ratio < ma25 - 5;
  const color = over ? '#ef4444' : under ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ position: 'relative', height: 14, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: `${maPct}%`, top: 0, bottom: 0, width: 2, background: 'var(--text-dim)', zIndex: 2 }} title={`25D MA: ${ma25.toFixed(1)}%`} />
      <div style={{ width: `${rPct}%`, height: '100%', background: color, borderRadius: 3 }} />
      <span style={{ position: 'absolute', right: 4, top: 0, fontSize: 10, lineHeight: '14px', fontWeight: 600, color: 'var(--text)', zIndex: 2 }}>
        {ratio.toFixed(1)}%
      </span>
    </div>
  );
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const JapanCreditPanel: React.FC = () => {
  const [tab, setTab] = useState<'stocks' | 'market'>('stocks');

  const totalBuy = MOCK_MARGIN_ISSUES.reduce((s, i) => s + i.marginBuy, 0);
  const totalSell = MOCK_MARGIN_ISSUES.reduce((s, i) => s + i.marginSell, 0);
  const overallRatio = (totalBuy / (totalBuy + totalSell)) * 100;

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🇯🇵 信用取引 Margin Monitor</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setTab('stocks')} style={tabBtn(tab === 'stocks')}>📈 Issues</button>
          <button onClick={() => setTab('market')} style={tabBtn(tab === 'market')}>📊 Market</button>
        </div>
      </div>

      {/* KPI summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Buy Balance (買残)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{(totalBuy / 100).toFixed(1)}B¥</div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Sell Balance (売残)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{(totalSell / 100).toFixed(1)}B¥</div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Buy Ratio</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: overallRatio > 60 ? '#ef4444' : '#22c55e' }}>{overallRatio.toFixed(1)}%</div>
        </div>
      </div>

      {tab === 'stocks' ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={thJ}>Code</th>
                <th style={thJ}>Buy残</th>
                <th style={thJ}>Sell残</th>
                <th style={thJ}>Ratio</th>
                <th style={thJ}>BuyΔ</th>
                <th style={thJ}>SellΔ</th>
                <th style={thJ}>Overheat</th>
                <th style={thJ}>Price</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_MARGIN_ISSUES.sort((a, b) => b.marginBuy - a.marginBuy).map(i => (
                <tr key={i.code} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdJ}>
                    <span style={{ fontWeight: 700 }}>{i.code}</span>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{i.name}</div>
                  </td>
                  <td style={{ ...tdJ, textAlign: 'right', color: '#22c55e' }}>{i.marginBuy.toLocaleString()}</td>
                  <td style={{ ...tdJ, textAlign: 'right', color: '#ef4444' }}>{i.marginSell.toLocaleString()}</td>
                  <td style={tdJ}>
                    <MarginRatioBar ratio={i.marginRatio} ma25={i.marginRatio25D} />
                  </td>
                  <td style={{ ...tdJ, textAlign: 'right', color: i.buyChange > 0 ? '#22c55e' : '#ef4444' }}>
                    {i.buyChange > 0 ? '+' : ''}{i.buyChange}
                  </td>
                  <td style={{ ...tdJ, textAlign: 'right', color: i.sellChange > 0 ? '#ef4444' : '#22c55e' }}>
                    {i.sellChange > 0 ? '+' : ''}{i.sellChange}
                  </td>
                  <td style={tdJ}><OverheatBadge level={i.overheat} /></td>
                  <td style={{ ...tdJ, textAlign: 'right' }}>
                    ¥{i.price.toLocaleString()}
                    <div style={{ fontSize: 10, color: i.changePct > 0 ? '#22c55e' : '#ef4444' }}>
                      {i.changePct > 0 ? '+' : ''}{i.changePct.toFixed(1)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Market-level credit trend */}
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600 }}>Weekly Margin Balance Trend</h4>
            <div style={{ display: 'flex', gap: 0, height: 120, alignItems: 'flex-end', padding: '0 8px' }}>
              {MOCK_MARKET_CREDIT.map(w => {
                const maxV = 50000;
                const buyH = (w.totalBuy / maxV) * 100;
                const sellH = (w.totalSell / maxV) * 100;
                const isCurrent = w.week === 'This';
                return (
                  <div key={w.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                      <div style={{ width: 20, height: buyH, background: isCurrent ? '#22c55e' : 'rgba(34,197,94,.3)', borderRadius: '2px 2px 0 0', transition: 'height .3s' }} title={`Buy: ${w.totalBuy.toLocaleString()}`} />
                      <div style={{ width: 20, height: sellH, background: isCurrent ? '#ef4444' : 'rgba(239,68,68,.3)', borderRadius: '2px 2px 0 0', transition: 'height .3s' }} title={`Sell: ${w.totalSell.toLocaleString()}`} />
                    </div>
                    <span style={{ fontSize: 9, color: isCurrent ? 'var(--accent)' : 'var(--text-dim)', fontWeight: isCurrent ? 700 : 400 }}>
                      {w.week}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>
              <span>🟢 Buy Balance</span>
              <span>🔴 Sell Balance</span>
            </div>
          </div>

          {/* Ratio trend */}
          <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Overall Buy Ratio Trend</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {MOCK_MARKET_CREDIT.map(w => {
                const isCurrent = w.week === 'This';
                return (
                  <div key={w.week} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isCurrent ? 'var(--accent)' : 'var(--text)', transition: 'color .3s' }}>
                      {w.balanceRatio.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 9, color: isCurrent ? 'var(--accent)' : 'var(--text-dim)', fontWeight: isCurrent ? 700 : 400 }}>
                      {w.week}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Warning */}
          <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 9, color: 'var(--text-dim)' }}>
            📌 Margin buy ratio &gt;60% = overheated (逆日歩 risk). Margin sell ratio &gt;45% = potential short squeeze.
          </div>
        </>
      )}
    </div>
  );
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 500,
});

const thJ: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdJ: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle' };

export default JapanCreditPanel;
