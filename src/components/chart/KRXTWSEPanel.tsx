/**
 * KRXTWSEPanel — R273 ML#4: 三大法人面板 (Korea + Taiwan Institutional Flow)
 *
 * Korea KRX: 외국인/기관/개인 (Foreign/Institution/Individual)
 * Taiwan TWSE: 外資/投信/自營商 (Foreign/Investment Trust/Dealer)
 * Combined panel for cross-market institutional comparison
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface KRInstitution {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  foreignNet: number;      // KRW bn
  institutionNet: number;
  individualNet: number;
  foreignCum5d: number;
}

interface TWInstitution {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  foreignNet: number;      // TWD mn
  investTrustNet: number;  // 投信
  dealerNet: number;       // 自營商
  foreignCum5d: number;
  marginBalance: number;
  shortBalance: number;
}

interface MarketSummary {
  market: 'KR' | 'TW';
  foreignTotal: number;
  institutionTotal: number;
  individualTotal: number;
  index: number;
  indexChg: number;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const MOCK_KR: KRInstitution[] = [
  { symbol: '005930', name: 'Samsung Electronics', price: 78500, changePct: 1.2, foreignNet: 320, institutionNet: -180, individualNet: -140, foreignCum5d: 1250 },
  { symbol: '000660', name: 'SK hynix', price: 235000, changePct: 2.8, foreignNet: 215, institutionNet: -95, individualNet: -120, foreignCum5d: 850 },
  { symbol: '373220', name: 'LG Energy Solution', price: 420000, changePct: -0.5, foreignNet: -85, institutionNet: 120, individualNet: -35, foreignCum5d: -320 },
  { symbol: '035420', name: 'NAVER', price: 185000, changePct: 0.8, foreignNet: 145, institutionNet: -60, individualNet: -85, foreignCum5d: 580 },
  { symbol: '005380', name: 'Hyundai Motor', price: 285000, changePct: 1.5, foreignNet: 195, institutionNet: -110, individualNet: -85, foreignCum5d: 720 },
  { symbol: '207940', name: 'Samsung Biologics', price: 820000, changePct: -2.1, foreignNet: -210, institutionNet: -150, individualNet: 360, foreignCum5d: -680 },
];

const MOCK_TW: TWInstitution[] = [
  { symbol: '2330', name: 'TSMC', price: 980, changePct: 1.8, foreignNet: 4500, investTrustNet: -1200, dealerNet: -800, foreignCum5d: 18200, marginBalance: 38500, shortBalance: 12000 },
  { symbol: '2454', name: 'MediaTek', price: 1250, changePct: 2.5, foreignNet: 2800, investTrustNet: -600, dealerNet: -400, foreignCum5d: 9500, marginBalance: 22500, shortBalance: 8500 },
  { symbol: '2317', name: 'Hon Hai (Foxconn)', price: 195, changePct: 3.2, foreignNet: 6200, investTrustNet: -1800, dealerNet: -1200, foreignCum5d: 21500, marginBalance: 52000, shortBalance: 18000 },
  { symbol: '2308', name: 'Delta Electronics', price: 385, changePct: -0.8, foreignNet: -1200, investTrustNet: 800, dealerNet: 200, foreignCum5d: -4500, marginBalance: 8500, shortBalance: 3200 },
  { symbol: '2603', name: 'Evergreen Marine', price: 185, changePct: 4.5, foreignNet: 3500, investTrustNet: -900, dealerNet: -500, foreignCum5d: 12500, marginBalance: 18500, shortBalance: 5800 },
];

const KR_SUMMARY: MarketSummary = { market: 'KR', foreignTotal: 580, institutionTotal: -475, individualTotal: -105, index: 2785, indexChg: 0.8 };
const TW_SUMMARY: MarketSummary = { market: 'TW', foreignTotal: 15800, institutionTotal: -3700, individualTotal: -2700, index: 22450, indexChg: 1.2 };

// ────────────────────────────────────
// Sub-components
// ────────────────────────────────────
// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const KRXTWSEPanel: React.FC = () => {
  const [market, setMarket] = useState<'KR' | 'TW'>('KR');

  const summary = market === 'KR' ? KR_SUMMARY : TW_SUMMARY;

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          {market === 'KR' ? '🇰🇷 한국 ' : '🇹🇼 台灣 '} Institutional Flow
        </h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setMarket('KR')} style={tabS(market === 'KR')}>🇰🇷 Korea</button>
          <button onClick={() => setMarket('TW')} style={tabS(market === 'TW')}>🇹🇼 Taiwan</button>
        </div>
      </div>

      {/* Market summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{market === 'KR' ? 'KOSPI' : 'TAIEX'}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {summary.index.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: summary.indexChg > 0 ? '#22c55e' : '#ef4444' }}>
            {summary.indexChg > 0 ? '+' : ''}{summary.indexChg}%
          </div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: summary.foreignTotal > 0 ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{market === 'KR' ? 'Foreign (외국인)' : 'Foreign (外資)'}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: summary.foreignTotal > 0 ? '#22c55e' : '#ef4444' }}>
            {summary.foreignTotal > 0 ? '+' : ''}{summary.foreignTotal.toLocaleString()}{market === 'KR' ? 'B' : 'M'}
          </div>
        </div>
        <div style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: summary.institutionTotal > 0 ? 'rgba(99,102,241,.08)' : 'rgba(168,85,247,.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{market === 'KR' ? 'Institution (기관)' : 'Inv. Trust (投信)'}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: summary.institutionTotal > 0 ? '#6366f1' : '#a855f7' }}>
            {summary.institutionTotal > 0 ? '+' : ''}{summary.institutionTotal.toLocaleString()}{market === 'KR' ? 'B' : 'M'}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        {market === 'KR' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={thK}>Code</th>
                <th style={thK}>Price</th>
                <th style={thK}>Chg%</th>
                <th style={thK}>Foreign</th>
                <th style={thK}>Institution</th>
                <th style={thK}>Individual</th>
                <th style={thK}>F 5D</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_KR.map(r => {
                return (
                  <tr key={r.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdK}>
                      <span style={{ fontWeight: 700 }}>{r.symbol}</span>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.name}</div>
                    </td>
                    <td style={{ ...tdK, textAlign: 'right' }}>₩{r.price.toLocaleString()}</td>
                    <td style={{ ...tdK, textAlign: 'right', fontWeight: 600, color: r.changePct > 0 ? '#ef4444' : '#22c55e' }}>
                      {r.changePct > 0 ? '+' : ''}{r.changePct}%
                    </td>
                    <td style={{ ...tdK, textAlign: 'right', fontWeight: 600, color: r.foreignNet > 0 ? '#22c55e' : '#ef4444' }}>
                      {r.foreignNet > 0 ? '+' : ''}{r.foreignNet.toLocaleString()}B
                    </td>
                    <td style={{ ...tdK, textAlign: 'right', fontWeight: 600, color: r.institutionNet > 0 ? '#6366f1' : '#a855f7' }}>
                      {r.institutionNet > 0 ? '+' : ''}{r.institutionNet.toLocaleString()}B
                    </td>
                    <td style={{ ...tdK, textAlign: 'right', fontWeight: 600, color: r.individualNet > 0 ? '#f59e0b' : '#ec4899' }}>
                      {r.individualNet > 0 ? '+' : ''}{r.individualNet.toLocaleString()}B
                    </td>
                    <td style={{ ...tdK, textAlign: 'right', fontWeight: 600, color: r.foreignCum5d > 0 ? '#22c55e' : '#ef4444' }}>
                      {r.foreignCum5d > 0 ? '+' : ''}₩{r.foreignCum5d.toLocaleString()}B
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={thK}>Code</th>
                <th style={thK}>Price</th>
                <th style={thK}>Chg%</th>
                <th style={thK}>Foreign</th>
                <th style={thK}>投信</th>
                <th style={thK}>自營商</th>
                <th style={thK}>Margin</th>
                <th style={thK}>Short</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TW.map(r => (
                <tr key={r.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdK}>
                    <span style={{ fontWeight: 700 }}>{r.symbol}</span>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.name}</div>
                  </td>
                  <td style={{ ...tdK, textAlign: 'right' }}>NT${r.price.toFixed(0)}</td>
                  <td style={{ ...tdK, textAlign: 'right', fontWeight: 600, color: r.changePct > 0 ? '#ef4444' : '#22c55e' }}>
                    {r.changePct > 0 ? '+' : ''}{r.changePct}%
                  </td>
                  <td style={{ ...tdK, textAlign: 'right', fontWeight: 600, color: r.foreignNet > 0 ? '#22c55e' : '#ef4444' }}>
                    {r.foreignNet > 0 ? '+' : ''}{r.foreignNet.toLocaleString()}M
                  </td>
                  <td style={{ ...tdK, textAlign: 'right', fontWeight: 600, color: r.investTrustNet > 0 ? '#6366f1' : '#a855f7' }}>
                    {r.investTrustNet > 0 ? '+' : ''}{r.investTrustNet.toLocaleString()}M
                  </td>
                  <td style={{ ...tdK, textAlign: 'right', fontWeight: 600, color: r.dealerNet > 0 ? '#22c55e' : '#ef4444' }}>
                    {r.dealerNet > 0 ? '+' : ''}{r.dealerNet.toLocaleString()}M
                  </td>
                  <td style={{ ...tdK, textAlign: 'right' }}>NT${r.marginBalance.toLocaleString()}M</td>
                  <td style={{ ...tdK, textAlign: 'right' }}>NT${r.shortBalance.toLocaleString()}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-dim)', display: 'flex', gap: 16 }}>
        <span>🟢 Foreign buy</span>
        <span>🔴 Foreign sell</span>
        <span>🟣 Institution buy/sell</span>
        <span>🟡 Individual</span>
        {market === 'KR' ? (
          <span>| Institutional = 연기금 + 투신 + 은행 + 보험</span>
        ) : (
          <span>| 投信=Mutual Funds | 自營商=Proprietary Trading</span>
        )}
      </div>
    </div>
  );
};

const tabS = (active: boolean): React.CSSProperties => ({
  padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 500,
});

const thK: React.CSSProperties = { padding: '6px 8px', borderBottom: '2px solid var(--border)', fontSize: 11, textAlign: 'left', color: 'var(--text-dim)', whiteSpace: 'nowrap' };
const tdK: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'middle' };

export default KRXTWSEPanel;
