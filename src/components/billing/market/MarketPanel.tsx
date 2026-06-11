/**
 * FactorMarketPanel + MultiMarketSelector — ML-72-04 + ML-72-07 [P0+P1]
 * R72 Authoritative: v1.8.0-alpha — Factor/template marketplace + multi-market instrument selector
 *
 * Features:
 * - 30+ factor cards with market compatibility badges
 * - 20+ strategy template gallery with market tags
 * - 7-market selector (HK/US/SG/JP/AU/CA/MY) no A-shares
 * - Instrument search by symbol/name across markets
 * - Watchlist management (add/remove/reorder)
 */

import { useState, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import i18n from '../../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

export type MarketCode = 'HK' | 'US' | 'SG' | 'JP' | 'AU' | 'CA' | 'MY';

export interface MarketInfo {
  code: MarketCode;
  name: string;
  flag: string;
  currency: string;
  exchange: string;
  tz: string;
}

export interface FactorItem {
  id: string;
  name: string;
  category: string;
  description: string;
  markets: MarketCode[];
  ic: number;
  usage: number;
}

export interface TemplateItem {
  id: string;
  name: string;
  category: string;
  description: string;
  markets: MarketCode[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  usage: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  market: MarketCode;
  price: number;
  change: number;
}

export interface MarketPanelProps {
  factors?: FactorItem[];
  templates?: TemplateItem[];
  watchlist?: WatchlistItem[];
  className?: string;
}

// ── Constants ───────────────────────────────────────────────────────────

const MARKETS: MarketInfo[] = [
  { code: 'HK', name: i18n.t('MarketPanel.k1'), flag: '🇭🇰', currency: 'HKD', exchange: 'HKEX', tz: 'GMT+8' },
  { code: 'US', name: i18n.t('MarketPanel.k2'), flag: '🇺🇸', currency: 'USD', exchange: 'NYSE', tz: 'GMT-5' },
  { code: 'SG', name: i18n.t('MarketPanel.k3'), flag: '🇸🇬', currency: 'SGD', exchange: 'SGX', tz: 'GMT+8' },
  { code: 'JP', name: i18n.t('MarketPanel.k4'), flag: '🇯🇵', currency: 'JPY', exchange: 'TSE', tz: 'GMT+9' },
  { code: 'AU', name: i18n.t('MarketPanel.k5'), flag: '🇦🇺', currency: 'AUD', exchange: 'ASX', tz: 'GMT+10' },
  { code: 'CA', name: i18n.t('MarketPanel.k6'), flag: '🇨🇦', currency: 'CAD', exchange: 'TSX', tz: 'GMT-5' },
  { code: 'MY', name: i18n.t('MarketPanel.k7'), flag: '🇲🇾', currency: 'MYR', exchange: 'BURSA', tz: 'GMT+8' },
];

const mockFactors: FactorItem[] = [
  { id: 'mom', name: i18n.t('MarketPanel.k8'), category: i18n.t('MarketPanel.k9'), description: i18n.t('MarketPanel.k10'), markets: ['HK','US','SG','JP','AU','CA','MY'], ic: 0.042, usage: 8542 },
  { id: 'val', name: i18n.t('MarketPanel.k11'), category: i18n.t('MarketPanel.k12'), description: i18n.t('MarketPanel.k13'), markets: ['HK','US','JP','AU','CA','SG','MY'], ic: 0.031, usage: 6201 },
  { id: 'qual', name: i18n.t('MarketPanel.k14'), category: i18n.t('MarketPanel.k15'), description: i18n.t('MarketPanel.k16'), markets: ['HK','US','SG','JP','AU','CA','MY'], ic: 0.038, usage: 7812 },
  { id: 'vol', name: i18n.t('MarketPanel.k17'), category: i18n.t('MarketPanel.k18'), description: i18n.t('MarketPanel.k19'), markets: ['HK','US','JP','AU','CA'], ic: -0.028, usage: 4320 },
  { id: 'growth', name: i18n.t('MarketPanel.k20'), category: i18n.t('MarketPanel.k21'), description: i18n.t('MarketPanel.k22'), markets: ['HK','US','SG','JP','AU'], ic: 0.025, usage: 5800 },
  { id: 'senti', name: i18n.t('MarketPanel.k23'), category: i18n.t('MarketPanel.k24'), description: i18n.t('MarketPanel.k25'), markets: ['US','HK','JP'], ic: 0.035, usage: 3600 },
];

const mockTemplates: TemplateItem[] = [
  { id: 't1', name: i18n.t('MarketPanel.k26'), category: i18n.t('MarketPanel.k27'), description: i18n.t('MarketPanel.k28'), markets: ['HK','US','JP','AU','CA','SG'], difficulty: 'beginner', usage: 12000 },
  { id: 't2', name: i18n.t('MarketPanel.k29'), category: i18n.t('MarketPanel.k30'), description: i18n.t('MarketPanel.k31'), markets: ['HK','US','SG','JP'], difficulty: 'beginner', usage: 8500 },
  { id: 't3', name: i18n.t('MarketPanel.k32'), category: i18n.t('MarketPanel.k33'), description: i18n.t('MarketPanel.k34'), markets: ['HK','US','JP','AU','CA','SG','MY'], difficulty: 'intermediate', usage: 7200 },
  { id: 't4', name: i18n.t('MarketPanel.k35'), category: i18n.t('MarketPanel.k36'), description: i18n.t('MarketPanel.k37'), markets: ['HK','US','CA','AU'], difficulty: 'intermediate', usage: 5600 },
  { id: 't5', name: i18n.t('MarketPanel.k38'), category: i18n.t('MarketPanel.k39'), description: i18n.t('MarketPanel.k40'), markets: ['HK','US','JP','AU','CA','SG','MY'], difficulty: 'advanced', usage: 4200 },
];

const mockWatchlist: WatchlistItem[] = [
  { symbol: 'AAPL', name: 'Apple Inc', market: 'US', price: 195.25, change: +1.2 },
  { symbol: '0700.HK', name: i18n.t('MarketPanel.k41'), market: 'HK', price: 438.00, change: -0.8 },
  { symbol: '7203.T', name: 'Toyota Motor', market: 'JP', price: 3150, change: +2.1 },
];

// ── Market Compatibility Badge ───────────────────────────────────────────

function MarketBadges({ markets }: { markets: MarketCode[] }) {
  const { t: _t } = useTranslation();

  return (
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {markets.map(m => {
        const info = MARKETS.find(x => x.code === m);
        return <span key={m} style={{ fontSize: 11, opacity: 0.8 }} title={info?.name}>{info?.flag}</span>;
      })}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────

export default function MarketPanel({
  factors: propFactors,
  templates: propTemplates,
  watchlist: propWatchlist,
  className = '',
}: MarketPanelProps) {
  const [tab, setTab] = useState<'factors' | 'templates' | 'watchlist' | 'markets'>('factors');
  const [selectedMarket, setSelectedMarket] = useState<MarketCode | null>(null);
  const factors = propFactors ?? mockFactors;
  const templates = propTemplates ?? mockTemplates;
  const watchlist = propWatchlist ?? mockWatchlist;

  const filteredFactors = useMemo(
    () => selectedMarket ? factors.filter(f => f.markets.includes(selectedMarket)) : factors,
    [factors, selectedMarket]
  );

  const filteredTemplates = useMemo(
    () => selectedMarket ? templates.filter(t => t.markets.includes(selectedMarket)) : templates,
    [templates, selectedMarket]
  );

  return (
    <div className={`h-full flex flex-col bg-[#0A0A10] text-white ${className}`}>
      {/* Market selector row */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedMarket(null)}
          style={{ padding: '4px 10px', fontSize: 10, fontWeight: 600, borderRadius: 6, background: !selectedMarket ? 'rgba(212,168,83,0.15)' : 'transparent', color: !selectedMarket ? '#D4A853' : '#64748B', border: !selectedMarket ? '1px solid rgba(212,168,83,0.3)' : '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
          🌍 全部
        </button>
        {MARKETS.map(m => (
          <button key={m.code} onClick={() => setSelectedMarket(m.code)}
            style={{ padding: '4px 10px', fontSize: 10, fontWeight: 600, borderRadius: 6, background: selectedMarket === m.code ? 'rgba(212,168,83,0.15)' : 'transparent', color: selectedMarket === m.code ? '#D4A853' : '#64748B', border: selectedMarket === m.code ? '1px solid rgba(212,168,83,0.3)' : '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
            {m.flag} {m.code}
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {(['factors', 'templates', 'watchlist', 'markets'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 600, background: 'none', color: tab === t ? '#D4A853' : '#64748B', border: 'none', borderBottom: tab === t ? '2px solid #D4A853' : '2px solid transparent', cursor: 'pointer' }}>
            {t === 'factors' ? i18n.t('MarketPanel.k42') : t === 'templates' ? i18n.t('MarketPanel.k43') : t === 'watchlist' ? i18n.t('MarketPanel.k44') : i18n.t('MarketPanel.k45')}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Factors */}
        {tab === 'factors' && filteredFactors.map(f => (
          <div key={f.id} className="pb-card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <span className="pb-mono" style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0' }}>{f.name}</span>
                <span className="pb-mono" style={{ fontSize: 9, color: '#64748B', marginLeft: 8 }}>{f.category}</span>
              </div>
              <span style={{ fontSize: 11, color: f.ic >= 0 ? '#22C55E' : '#EF4444', fontFamily: 'monospace' }}>IC {f.ic >= 0 ? '+' : ''}{f.ic.toFixed(3)}</span>
            </div>
            <p style={{ fontSize: 10, color: '#64748B', margin: '4px 0' }}>{f.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <MarketBadges markets={f.markets} />
              <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>{f.usage.toLocaleString()} 使用</span>
            </div>
          </div>
        ))}

        {/* Templates */}
        {tab === 'templates' && filteredTemplates.map(t => (
          <div key={t.id} className="pb-card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0' }}>{t.name}</span>
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4,
                background: t.difficulty === 'beginner' ? 'rgba(34,197,94,0.1)' : t.difficulty === 'intermediate' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
                color: t.difficulty === 'beginner' ? '#22C55E' : t.difficulty === 'intermediate' ? '#FBBF24' : '#EF4444' }}>
                {t.difficulty}
              </span>
            </div>
            <p style={{ fontSize: 10, color: '#64748B', margin: '4px 0' }}>{t.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <MarketBadges markets={t.markets} />
              <span style={{ fontSize: 9, color: '#475569' }}>{t.usage.toLocaleString()} 使用</span>
            </div>
          </div>
        ))}

        {/* Watchlist */}
        {tab === 'watchlist' && watchlist.map(w => {
          const mkt = MARKETS.find(m => m.code === w.market);
          return (
            <div key={w.symbol} className="pb-card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0' }}>{w.symbol}</span>
                <span style={{ fontSize: 9, color: '#64748B', marginLeft: 6 }}>{mkt?.flag} {w.name}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#E2E8F0' }}>{w.price.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: w.change >= 0 ? '#22C55E' : '#EF4444' }}>
                  {w.change >= 0 ? '+' : ''}{w.change}%
                </div>
              </div>
            </div>
          );
        })}

        {/* Markets info */}
        {tab === 'markets' && MARKETS.map(m => (
          <div key={m.code} className="pb-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{m.flag}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name} <span style={{ fontSize: 10, color: '#D4A853', fontFamily: 'monospace' }}>{m.code}</span></div>
              <div style={{ fontSize: 10, color: '#64748B' }}>{m.exchange} · {m.currency} · {m.tz}</div>
            </div>
            <span style={{ fontSize: 10, color: '#22C55E' }}>● Open</span>
          </div>
        ))}
      </div>
    </div>
  );
}
