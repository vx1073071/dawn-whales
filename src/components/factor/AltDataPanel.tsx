/**
 * AltDataPanel — R278 ML#3: 另类数据面板 (Alternative Data Factors)
 *
 * 20 alternative data sources:
 * - Satellite imagery (parking lot fullness, oil tank levels, crop health)
 * - Supply chain (supplier concentration, shipment data, port congestion)
 * - Credit card (transaction volume, ticket size, category spend)
 * - Web scraping (job postings, app downloads, website traffic)
 * - Geospatial (foot traffic, weather impact)
 * - Shipping (AIS vessel tracking, Baltic Dry Index)
 */
import React, { useState } from 'react';

// ────────────────────────────────────
// Types
// ────────────────────────────────────
interface AltDataSignal {
  id: string;
  name: string;
  category: string;
  icon: string;
  symbol: string;
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  confidence: number;  // 0-100
  currentValue: number;
  unit: string;
  change: number;
  timeframe: string;
  description: string;
  source: string;
  latency: string;
}

interface AltDataCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  signalCount: number;
  avgConfidence: number;
}

// ────────────────────────────────────
// Mock data
// ────────────────────────────────────
const ALT_CATEGORIES: AltDataCategory[] = [
  { id: 'satellite', name: 'Satellite', icon: '\u{1F6F0}\u{FE0F}', description: 'Orbital imagery — parking lots, crops, oil tanks', signalCount: 4, avgConfidence: 72 },
  { id: 'supply_chain', name: 'Supply Chain', icon: '\u{1F69A}', description: 'Supplier concentration, shipments, ports', signalCount: 4, avgConfidence: 68 },
  { id: 'credit_card', name: 'Credit Card', icon: '\u{1F4B3}', description: 'Consumer spending, ticket size, categories', signalCount: 4, avgConfidence: 78 },
  { id: 'web_scraping', name: 'Web Scraping', icon: '\u{1F310}', description: 'Jobs, downloads, traffic, reviews', signalCount: 4, avgConfidence: 65 },
  { id: 'geospatial', name: 'Geospatial', icon: '\u{1F4CD}', description: 'Foot traffic, weather, location analytics', signalCount: 4, avgConfidence: 62 },
];

const MOCK_ALT_SIGNALS: AltDataSignal[] = [
  // ── Satellite ──
  { id: 'wmt_parking', name: 'Walmart Parking Fullness', category: 'satellite', icon: '\u{1F6F0}\u{FE0F}', symbol: 'WMT', signal: 'BUY', confidence: 78, currentValue: 82, unit: '%', change: 5.2, timeframe: 'WoW', description: 'Parking lot occupancy up 5.2% WoW — correlates with same-store sales growth. Historical r=0.68.', source: 'Orbital Insight', latency: 'T+2d' },
  { id: 'cushing_oil', name: 'Cushing Oil Tank Levels', category: 'satellite', icon: '\u{1F6F0}\u{FE0F}', symbol: 'USO', signal: 'SELL', confidence: 72, currentValue: 68, unit: '%', change: 8.5, timeframe: 'WoW', description: 'Oil tank levels rising — supply glut building. Typically precedes WTI price decline.', source: 'Ursa Space', latency: 'T+3d' },
  { id: 'corn_health', name: 'Corn Belt Crop Health', category: 'satellite', icon: '\u{1F6F0}\u{FE0F}', symbol: 'CORN', signal: 'BUY', confidence: 65, currentValue: 0.72, unit: 'NDVI', change: -0.05, timeframe: '2W', description: 'NDVI declining — drought stress. Lower yield expectations = higher prices.', source: 'Planet Labs', latency: 'T+1d' },
  { id: 'tsla_factory', name: 'Tesla Factory Activity', category: 'satellite', icon: '\u{1F6F0}\u{FE0F}', symbol: 'TSLA', signal: 'NEUTRAL', confidence: 55, currentValue: 75, unit: '%', change: -2.0, timeframe: 'WoW', description: 'Giga Shanghai parking stable. Giga Texas slightly down. No major change.', source: 'Planet Labs', latency: 'T+2d' },

  // ── Supply Chain ──
  { id: 'aapl_suppliers', name: 'Apple Supplier Overtime', category: 'supply_chain', icon: '\u{1F69A}', symbol: 'AAPL', signal: 'BUY', confidence: 82, currentValue: 18, unit: '%', change: 12, timeframe: 'MoM', description: 'Foxconn/Pegatron overtime hours up 12% — strong production ramp ahead of iPhone launch.', source: 'Panjiva', latency: 'T+7d' },
  { id: 'la_port', name: 'LA Port Container Volume', category: 'supply_chain', icon: '\u{1F69A}', symbol: 'XLI', signal: 'BUY', confidence: 68, currentValue: 950, unit: 'K TEU', change: 85, timeframe: 'MoM', description: 'Import volumes surging — retailers building inventory. Bullish for transports.', source: 'Port of LA', latency: 'T+2d' },
  { id: 'nike_vietnam', name: 'Nike Vietnam Factory Output', category: 'supply_chain', icon: '\u{1F69A}', symbol: 'NKE', signal: 'NEUTRAL', confidence: 58, currentValue: 92, unit: '%', change: -3, timeframe: 'MoM', description: 'Vietnam production slightly down. Order book still healthy.', source: 'Trade data', latency: 'T+15d' },
  { id: 'semicon_shipments', name: 'Semiconductor Equipment Shipments', category: 'supply_chain', icon: '\u{1F69A}', symbol: 'SOXX', signal: 'STRONG_BUY', confidence: 85, currentValue: 42, unit: 'B USD', change: 8.5, timeframe: 'MoM', description: 'ASML/Tokyo Electron shipments at record highs — AI capex boom driving.', source: 'SEMI', latency: 'T+14d' },

  // ── Credit Card ──
  { id: 'amzn_spend', name: 'Amazon Card Spend', category: 'credit_card', icon: '\u{1F4B3}', symbol: 'AMZN', signal: 'BUY', confidence: 80, currentValue: 1250, unit: 'USD/user', change: 85, timeframe: 'YoY', description: 'Average card spend per user up 7.3% YoY — consumer wallet share growing.', source: 'Earnest Analytics', latency: 'T+5d' },
  { id: 'luxury_spend', name: 'Luxury Goods Spend', category: 'credit_card', icon: '\u{1F4B3}', symbol: 'LVMUY', signal: 'NEUTRAL', confidence: 62, currentValue: 3800, unit: 'USD', change: -120, timeframe: 'QoQ', description: 'Luxury spending plateauing after strong post-COVID recovery.', source: 'Earnest', latency: 'T+7d' },
  { id: 'travel_spend', name: 'Travel & Dining Spend', category: 'credit_card', icon: '\u{1F4B3}', symbol: 'BKNG', signal: 'BUY', confidence: 75, currentValue: 680, unit: 'USD', change: 45, timeframe: 'YoY', description: 'Travel spend up 7.1% — international bookings surging.', source: 'BAC Agg Data', latency: 'T+3d' },
  { id: 'gas_station', name: 'Gas Station Transactions', category: 'credit_card', icon: '\u{1F4B3}', symbol: 'XLE', signal: 'SELL', confidence: 70, currentValue: -5.2, unit: '%', change: -8.0, timeframe: 'YoY', description: 'Gas transactions declining — lower gas prices reducing energy revenue.', source: 'Facteus', latency: 'T+5d' },

  // ── Web Scraping ──
  { id: 'tsla_jobs', name: 'Tesla Job Postings', category: 'web_scraping', icon: '\u{1F310}', symbol: 'TSLA', signal: 'BUY', confidence: 68, currentValue: 3200, unit: 'postings', change: 450, timeframe: 'WoW', description: 'Job postings surging — expansion mode. Gigafactory hiring spike.', source: 'LinkUp', latency: 'T+1d' },
  { id: 'shopify_apps', name: 'Shopify App Installs', category: 'web_scraping', icon: '\u{1F310}', symbol: 'SHOP', signal: 'BUY', confidence: 72, currentValue: 28, unit: '%', change: 8, timeframe: 'QoQ', description: 'New merchant app installs accelerating — platform growth healthy.', source: 'Apptopia', latency: 'T+2d' },
  { id: 'reddit_mentions', name: 'AI Stock Mentions', category: 'web_scraping', icon: '\u{1F310}', symbol: 'NVDA', signal: 'BUY', confidence: 65, currentValue: 18500, unit: '/day', change: 2500, timeframe: 'WoW', description: 'Reddit r/wallstreetbets AI mentions surging. Retail euphoria indicator.', source: 'Quiver Quantitative', latency: 'T+0d' },
  { id: 'indeed_jobs', name: 'Tech Job Postings Index', category: 'web_scraping', icon: '\u{1F310}', symbol: 'QQQ', signal: 'NEUTRAL', confidence: 55, currentValue: 105, unit: '', change: -2, timeframe: 'MoM', description: 'Tech hiring plateauing after 2 year boom. Normalization, not contraction.', source: 'Indeed', latency: 'T+1d' },

  // ── Geospatial ──
  { id: 'starbucks_traffic', name: 'Starbucks Foot Traffic', category: 'geospatial', icon: '\u{1F4CD}', symbol: 'SBUX', signal: 'BUY', confidence: 75, currentValue: 8.5, unit: '%', change: 3.2, timeframe: 'YoY', description: 'US store visits up 8.5% YoY — Pumpkin Spice Latte effect + drive-thru growth.', source: 'Placer.ai', latency: 'T+2d' },
  { id: 'home_depot_traffic', name: 'Home Depot Traffic', category: 'geospatial', icon: '\u{1F4CD}', symbol: 'HD', signal: 'SELL', confidence: 70, currentValue: -3.5, unit: '%', change: -5.5, timeframe: 'YoY', description: 'Store visits declining — housing turnover low, DIY demand weak.', source: 'Placer.ai', latency: 'T+2d' },
  { id: 'hurricane_impact', name: 'Hurricane Season Outlook', category: 'geospatial', icon: '\u{1F4CD}', symbol: 'USO', signal: 'BUY', confidence: 60, currentValue: 18, unit: 'storms', change: 3, timeframe: 'Season', description: 'NOAA predicting above-normal hurricane season — Gulf production risk.', source: 'NOAA', latency: 'T+0d' },
  { id: 'china_traffic', name: 'China City Traffic Index', category: 'geospatial', icon: '\u{1F4CD}', symbol: 'FXI', signal: 'BUY', confidence: 62, currentValue: 92, unit: '', change: 8, timeframe: 'YoY', description: 'Major city congestion rising — economic activity picking up.', source: 'Baidu Maps', latency: 'T+0d' },
];

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
function SignalStrength({ signal }: { signal: AltDataSignal['signal'] }) {
  const cfg = {
    STRONG_BUY: { color: '#22c55e', bg: 'rgba(34,197,94,.15)', label: '\u{1F7E2}\u{1F7E2} Strong Buy' },
    BUY: { color: '#86efac', bg: 'rgba(34,197,94,.10)', label: '\u{1F7E2} Buy' },
    NEUTRAL: { color: '#f59e0b', bg: 'rgba(245,158,11,.10)', label: '\u{26A0}\u{FE0F} Neutral' },
    SELL: { color: '#fca5a5', bg: 'rgba(239,68,68,.10)', label: '\u{1F534} Sell' },
    STRONG_SELL: { color: '#ef4444', bg: 'rgba(239,68,68,.15)', label: '\u{1F534}\u{1F534} Strong Sell' },
  }[signal];
  return <span style={{ padding: '1px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color, fontSize: 9, fontWeight: 600 }}>{cfg.label}</span>;
}

function ConfidenceRing({ value }: { value: number }) {
  const color = value > 75 ? '#22c55e' : value > 60 ? '#f59e0b' : '#ef4444';
  const circumference = 56.5;
  const dash = (value / 100) * circumference;
  return (
    <div style={{ position: 'relative', width: 28, height: 28 }}>
      <svg viewBox="0 0 24 24" width={28} height={28}>
        <circle cx={12} cy={12} r={9} fill="none" stroke="var(--bg-input)" strokeWidth={2.5} />
        <circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round"
          transform="rotate(-90 12 12)" />
        <text x={12} y={13} textAnchor="middle" fontSize={7} fontWeight={700} fill="var(--text)">{value}</text>
      </svg>
    </div>
  );
}

// ────────────────────────────────────
// Main Component
// ────────────────────────────────────
export const AltDataPanel: React.FC = () => {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);

  const filtered = selectedCat ? MOCK_ALT_SIGNALS.filter(s => s.category === selectedCat) : MOCK_ALT_SIGNALS;

  const buyCount = MOCK_ALT_SIGNALS.filter(s => s.signal === 'STRONG_BUY' || s.signal === 'BUY').length;
  const sellCount = MOCK_ALT_SIGNALS.filter(s => s.signal === 'SELL' || s.signal === 'STRONG_SELL').length;

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F52C}'} Alternative Data Signals</h3>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {MOCK_ALT_SIGNALS.length} signals · {ALT_CATEGORIES.length} categories
        </span>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {[{ label: 'Buy Signals', val: buyCount, color: '#22c55e' },
          { label: 'Sell Signals', val: sellCount, color: '#ef4444' },
          { label: 'Avg Confidence', val: Math.round(MOCK_ALT_SIGNALS.reduce((s, x) => s + x.confidence, 0) / MOCK_ALT_SIGNALS.length), color: '#6366f1' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: 8, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedCat(null)} style={chipA(!selectedCat)}>All</button>
        {ALT_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setSelectedCat(c.id)} style={chipA(selectedCat === c.id)}>
            {c.icon} {c.name} ({MOCK_ALT_SIGNALS.filter(s => s.category === c.id).length})
          </button>
        ))}
      </div>

      {/* Signals grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 8 }}>
        {filtered.map(s => {
          const isOpen = selectedSignal === s.id;
          return (
            <div key={s.id} onClick={() => setSelectedSignal(isOpen ? null : s.id)} style={{
              padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
              background: isOpen ? 'rgba(99,102,241,.04)' : 'var(--bg-card)',
              border: isOpen ? '2px solid var(--accent)' : '1px solid var(--border)',
              transition: 'all .2s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 14 }}>{s.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 11 }}>{s.name}</span>
                    <span style={{ padding: '1px 4px', borderRadius: 3, background: 'var(--bg-input)', fontSize: 9 }}>{s.symbol}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{s.description.slice(0, 120)}{s.description.length > 120 ? '...' : ''}</div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'var(--text-dim)' }}>
                    <span>Source: {s.source}</span>
                    <span>Latency: {s.latency}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 60 }}>
                  <ConfidenceRing value={s.confidence} />
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{s.confidence}%</div>
                </div>
              </div>

              {/* Bottom row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <SignalStrength signal={s.signal} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {s.currentValue}{s.unit}
                  </div>
                  <div style={{ fontSize: 9, color: s.change > 0 ? '#22c55e' : '#ef4444' }}>
                    {s.change > 0 ? '+' : ''}{s.change}{s.unit === '%' ? 'pp' : ''} {s.timeframe}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Category stats bar */}
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
        {ALT_CATEGORIES.map(c => {
          const sigs = MOCK_ALT_SIGNALS.filter(s => s.category === c.id);
          const buys = sigs.filter(s => s.signal === 'STRONG_BUY' || s.signal === 'BUY').length;
          return (
            <div key={c.id} style={{ padding: 8, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{c.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 10 }}>{c.name}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                {sigs.length} signals · {buys} buys · conf: {Math.round(sigs.reduce((s, x) => s + x.confidence, 0) / Math.max(sigs.length, 1))}%
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-input)', marginTop: 4, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(buys / Math.max(sigs.length, 1)) * 100}%`, height: '100%', background: '#22c55e' }} />
                <div style={{ width: `${((sigs.length - buys) / Math.max(sigs.length, 1)) * 100}%`, height: '100%', background: '#ef4444' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const chipA = (active: boolean): React.CSSProperties => ({
  padding: '2px 10px', borderRadius: 4, border: active ? '1px solid var(--accent)' : '1px solid transparent',
  background: active ? 'rgba(99,102,241,.10)' : 'var(--bg-input)',
  color: active ? 'var(--accent)' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer', fontWeight: active ? 600 : 400,
});

export default AltDataPanel;
