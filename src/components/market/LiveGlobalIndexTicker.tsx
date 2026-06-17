import { useState, useEffect, useRef, useMemo } from 'react';

// ── types ──────────────────────────────────────────────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

interface IndexQuote {
  symbol: string;
  name: string;
  market: string;
  flag: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: number;
  source: 'yahoo' | 'binance' | 'futu' | 'mock';
  connectionState: 'live' | 'polling' | 'stale' | 'offline';
}

interface YahooIPCQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: number;
}

// ── index config ────────────────────────────────────────────
const INDEX_SEEDS: Omit<IndexQuote, 'price' | 'change' | 'changePercent' | 'high' | 'low' | 'timestamp' | 'source' | 'connectionState'>[] = [
  // Americas
  { symbol: '^GSPC', name: 'S&P 500', market: 'US', flag: '🇺🇸' },
  { symbol: '^IXIC', name: 'NASDAQ', market: 'US', flag: '🇺🇸' },
  { symbol: '^DJI', name: 'Dow Jones', market: 'US', flag: '🇺🇸' },
  { symbol: '^RUT', name: 'Russell 2000', market: 'US', flag: '🇺🇸' },
  { symbol: '^VIX', name: 'VIX', market: 'US', flag: '🇺🇸' },
  // Asia
  { symbol: '^HSI', name: 'Hang Seng', market: 'HK', flag: '🇭🇰' },
  { symbol: '^HSCE', name: 'HSCEI', market: 'HK', flag: '🇭🇰' },
  { symbol: '000001.SS', name: 'Shanghai', market: 'CN', flag: '🇨🇳' },
  { symbol: '399001.SZ', name: 'Shenzhen', market: 'CN', flag: '🇨🇳' },
  { symbol: '^N225', name: 'Nikkei 225', market: 'JP', flag: '🇯🇵' },
  { symbol: '^KS11', name: 'KOSPI', market: 'KR', flag: '🇰🇷' },
  { symbol: '^TWII', name: 'TWSE', market: 'TW', flag: '🇹🇼' },
  { symbol: '^AXJO', name: 'ASX 200', market: 'AU', flag: '🇦🇺' },
  { symbol: '^STI', name: 'STI', market: 'SG', flag: '🇸🇬' },
  { symbol: '^BSESN', name: 'BSE Sensex', market: 'IN', flag: '🇮🇳' },
  // Europe
  { symbol: '^FTSE', name: 'FTSE 100', market: 'UK', flag: '🇬🇧' },
  { symbol: '^GDAXI', name: 'DAX', market: 'DE', flag: '🇩🇪' },
  { symbol: '^FCHI', name: 'CAC 40', market: 'FR', flag: '🇫🇷' },
  // Crypto & Commodities
  { symbol: 'BTC-USD', name: 'Bitcoin', market: 'Crypto', flag: '🪙' },
  { symbol: 'ETH-USD', name: 'Ethereum', market: 'Crypto', flag: '🪙' },
  { symbol: 'GC=F', name: 'Gold', market: 'Commodity', flag: '🥇' },
  { symbol: 'CL=F', name: 'Crude Oil', market: 'Commodity', flag: '🛢️' },
];

const MARKET_GROUPS: Record<string, string> = {
  US: 'Americas', HK: 'Asia', CN: 'Asia', JP: 'Asia', KR: 'Asia',
  TW: 'Asia', AU: 'Asia', SG: 'Asia', IN: 'Asia',
  UK: 'Europe', DE: 'Europe', FR: 'Europe',
  Crypto: 'Crypto', Commodity: 'Commodities',
};

// ── mock fallback ───────────────────────────────────────────
function generateMockQuote(seed: typeof INDEX_SEEDS[0]): IndexQuote {
  const basePrices: Record<string, number> = {
    '^GSPC': 5980, '^IXIC': 21500, '^DJI': 43800, '^RUT': 2280, '^VIX': 16.5,
    '^HSI': 20200, '^HSCE': 7400, '000001.SS': 3380, '399001.SZ': 10850,
    '^N225': 39200, '^KS11': 2850, '^TWII': 22800, '^AXJO': 8350,
    '^STI': 3850, '^BSESN': 79500,
    '^FTSE': 8720, '^GDAXI': 23400, '^FCHI': 8180,
    'BTC-USD': 104500, 'ETH-USD': 3950,
    'GC=F': 3420, 'CL=F': 71.5,
  };
  const base = basePrices[seed.symbol] || 1000;
  const changePercent = (Math.random() - 0.48) * 4;
  const change = base * changePercent / 100;
  return {
    ...seed,
    price: base + change,
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    high: base * (1 + Math.abs(changePercent) / 100 * 1.3),
    low: base * (1 - Math.abs(changePercent) / 100 * 1.1),
    timestamp: Date.now(),
    source: 'mock',
    connectionState: 'offline',
  };
}

// ── IPC bridge ──────────────────────────────────────────────
function getElectronAPI(): any {
  return (window as any).electronAPI || (window as any).__ELECTRON_API__;
}

function useYahooIPCQuotes(): { quotes: Map<string, YahooIPCQuote> | null; connected: boolean } {
  const [quotes, setQuotes] = useState<Map<string, YahooIPCQuote> | null>(null);
  const [connected, setConnected] = useState(false);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;
    apiRef.current = api;

    let unsub: (() => void) | null = null;

    const connect = async () => {
      try {
        if (api.subscribeQuotes) {
          const symbols = INDEX_SEEDS.map(s => s.symbol);
          unsub = await api.subscribeQuotes(symbols, (data: YahooIPCQuote[]) => {
            const map = new Map<string, YahooIPCQuote>();
            data.forEach(q => map.set(q.symbol, q));
            setQuotes(map);
            setConnected(true);
          });
        }
      } catch {
        setConnected(false);
      }
    };

    connect();

    const healthCheck = setInterval(async () => {
      try {
        if (api.ping) {
          const ok = await api.ping();
          setConnected(!!ok);
        }
      } catch { setConnected(false); }
    }, 10000);

    return () => {
      if (unsub) unsub();
      clearInterval(healthCheck);
    };
  }, []);

  return { quotes, connected };
}

// ── snapshot interval (poll fallback) ───────────────────────
function useSnapshotInterval(connected: boolean) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (connected) return;
    const id = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, [connected]);
  return tick;
}

// ── main component ──────────────────────────────────────────
export default function LiveGlobalIndexTicker() {
  const { quotes, connected } = useYahooIPCQuotes();
  const mockTick = useSnapshotInterval(connected);
  const [viewMode, setViewMode] = useState<'grouped' | 'scrolling' | 'compact'>('grouped');
  const [selectedMarket, setSelectedMarket] = useState<string>('ALL');
  const [showDetail, setShowDetail] = useState(false);

  const indices: IndexQuote[] = useMemo(() => {
    return INDEX_SEEDS.map(seed => {
      if (quotes) {
        const q = quotes.get(seed.symbol);
        if (q) {
          return {
            ...seed,
            price: q.price,
            change: q.change,
            changePercent: q.changePercent,
            high: q.high,
            low: q.low,
            timestamp: q.timestamp,
            source: 'yahoo',
            connectionState: 'live',
          };
        }
      }
      // fallback: generate mock
      const mock = generateMockQuote(seed);
      mock.connectionState = connected ? 'polling' : 'offline';
      return mock;
    });
  }, [quotes, connected, mockTick]);

  const grouped = useMemo(() => {
    const groups: Record<string, IndexQuote[]> = {};
    indices.forEach(i => {
      const g = MARKET_GROUPS[i.market] || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(i);
    });
    return groups;
  }, [indices]);

  const filtered = selectedMarket === 'ALL'
    ? indices
    : indices.filter(i => i.market === selectedMarket);

  const markets = ['ALL', ...new Set(indices.map(i => i.market))];

  const upCount = indices.filter(i => i.changePercent > 0).length;
  const downCount = indices.filter(i => i.changePercent < 0).length;
  const now = new Date();

  const formatPrice = (p: number, market: string) => {
    if (market === 'Crypto') return p >= 1000 ? p.toLocaleString() : p.toFixed(1);
    if (['Commodity'].includes(market)) return p.toFixed(2);
    return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const renderQuoteItem = (q: IndexQuote, compact = false) => (
    <div key={q.symbol} className={`lgi-item ${q.changePercent > 0 ? 'lgi-up' : q.changePercent < 0 ? 'lgi-down' : 'lgi-flat'}`}>
      {!compact && (
        <>
          <span className="lgi-flag">{q.flag}</span>
          <span className="lgi-name">{q.name}</span>
        </>
      )}
      {compact && <span className="lgi-flag">{q.flag}</span>}
      <span className="lgi-price">{formatPrice(q.price, q.market)}</span>
      <span className={`lgi-change ${q.changePercent > 0 ? 'positive' : 'negative'}`}>
        {q.changePercent > 0 ? '▲' : q.changePercent < 0 ? '▼' : '–'}
        {Math.abs(q.changePercent).toFixed(2)}%
      </span>
      {showDetail && (
        <span className="lgi-detail">
          H:{formatPrice(q.high, q.market)} L:{formatPrice(q.low, q.market)}
        </span>
      )}
      <span className={`lgi-source ${q.connectionState}`} title={`Source: ${q.source} (${q.connectionState})`}>
        ●
      </span>
    </div>
  );

  return (
    <div className="lgi-container">
      {/* header */}
      <div className="lgi-header">
        <div className="lgi-title-row">
          <span className="lgi-icon">📊</span>
          <span className="lgi-title">Global Indices</span>
          <span className={`lgi-connection-badge ${connected ? 'live' : 'offline'}`}>
            {connected ? '● LIVE' : '○ MOCK'}
          </span>
        </div>
        <div className="lgi-summary">
          <span className="lgi-time">{now.toLocaleTimeString()}</span>
          <span className="lgi-up-count">▲ {upCount}</span>
          <span className="lgi-down-count">▼ {downCount}</span>
          <span className="lgi-total-count">{indices.length} indices</span>
        </div>
      </div>

      {/* market filter */}
      <div className="lgi-filters">
        <div className="lgi-market-chips">
          {markets.map(m => (
            <button
              key={m}
              className={`lgi-chip ${selectedMarket === m ? 'active' : ''}`}
              onClick={() => setSelectedMarket(m)}
            >
              {m === 'ALL' ? 'All Markets' : m}
            </button>
          ))}
        </div>
        <div className="lgi-view-toggles">
          <button className={`lgi-vt ${viewMode === 'grouped' ? 'active' : ''}`} onClick={() => setViewMode('grouped')}>⊞</button>
          <button className={`lgi-vt ${viewMode === 'scrolling' ? 'active' : ''}`} onClick={() => setViewMode('scrolling')}>≡</button>
          <button className={`lgi-vt ${viewMode === 'compact' ? 'active' : ''}`} onClick={() => setViewMode('compact')}>⊟</button>
          <button className={`lgi-vt ${showDetail ? 'active' : ''}`} onClick={() => setShowDetail(!showDetail)}>🔍</button>
        </div>
      </div>

      {/* grouped view */}
      {viewMode === 'grouped' && (
        <div className="lgi-groups">
          {Object.entries(grouped).map(([group, items]) => {
            const grpItems = selectedMarket === 'ALL' ? items : items.filter(i => i.market === selectedMarket);
            if (grpItems.length === 0) return null;
            const grpUp = grpItems.filter(i => i.changePercent > 0).length;
            const grpDown = grpItems.filter(i => i.changePercent < 0).length;
            return (
              <div key={group} className="lgi-group">
                <div className="lgi-group-header">
                  <span className="lgi-group-name">{group}</span>
                  <span className="lgi-group-stat">
                    {grpUp}↑ {grpDown}↓
                  </span>
                </div>
                <div className="lgi-group-items">
                  {grpItems.map(q => renderQuoteItem(q))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* scrolling ticker */}
      {viewMode === 'scrolling' && (
        <div className="lgi-scroll">
          <div className="lgi-scroll-inner">
            {[...filtered, ...filtered].map((q, i) => (
              <div key={`${q.symbol}-${i}`} className={`lgi-item lgi-item-inline ${q.changePercent > 0 ? 'lgi-up' : q.changePercent < 0 ? 'lgi-down' : 'lgi-flat'}`}>
                <span className="lgi-flag">{q.flag}</span>
                <span className="lgi-name">{q.name}</span>
                <span className="lgi-price">{formatPrice(q.price, q.market)}</span>
                <span className={`lgi-change ${q.changePercent > 0 ? 'positive' : 'negative'}`}>
                  {q.changePercent > 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* compact grid */}
      {viewMode === 'compact' && (
        <div className="lgi-compact-grid">
          {filtered.map(q => renderQuoteItem(q, true))}
        </div>
      )}

      <style>{`
        .lgi-container {
          background: var(--bg-surface, #0d1117);
          border: 1px solid var(--border, #21262d);
          border-radius: 12px; padding: 14px;
          color: var(--text-primary, #c9d1d9);
          font-family: 'Inter', -apple-system, sans-serif;
        }
        .lgi-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 10px; padding-bottom: 8px;
          border-bottom: 1px solid var(--border, #21262d);
        }
        .lgi-title-row { display: flex; align-items: center; gap: 8px; }
        .lgi-icon { font-size: 18px; }
        .lgi-title { font-size: 15px; font-weight: 600; }
        .lgi-connection-badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
        .lgi-connection-badge.live { background: rgba(34,197,94,0.15); color: #22c55e; }
        .lgi-connection-badge.offline { background: rgba(251,191,36,0.15); color: #fbbf24; }
        .lgi-summary { display: flex; gap: 12px; font-size: 11px; color: #8b949e; }
        .lgi-up-count { color: #22c55e; }
        .lgi-down-count { color: #ef4444; }
        .lgi-filters {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 10px; flex-wrap: wrap; gap: 6px;
        }
        .lgi-market-chips { display: flex; gap: 4px; flex-wrap: wrap; }
        .lgi-chip {
          background: var(--bg-card, #161b22); border: 1px solid #30363d;
          color: #8b949e; border-radius: 14px; padding: 2px 10px;
          font-size: 11px; cursor: pointer; transition: all 0.15s;
        }
        .lgi-chip.active { background: #1f6feb; color: #fff; border-color: #1f6feb; }
        .lgi-chip:hover { border-color: #58a6ff; }
        .lgi-view-toggles { display: flex; gap: 2px; }
        .lgi-vt {
          background: none; border: 1px solid #30363d; color: #8b949e;
          border-radius: 4px; padding: 2px 6px; font-size: 13px; cursor: pointer;
        }
        .lgi-vt.active { background: #1f6feb; color: #fff; border-color: #1f6feb; }
        .lgi-groups { display: flex; flex-direction: column; gap: 12px; }
        .lgi-group { border: 1px solid #21262d; border-radius: 8px; overflow: hidden; }
        .lgi-group-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 6px 10px; background: rgba(22,27,34,0.6);
          font-size: 12px; font-weight: 600; color: #8b949e;
        }
        .lgi-group-stat { font-size: 10px; }
        .lgi-group-items { display: flex; flex-wrap: wrap; gap: 1px; padding: 4px; }
        .lgi-item {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 8px; font-size: 12px; border-radius: 4px;
          background: var(--bg-card, #161b22); transition: background 0.2s;
        }
        .lgi-item:hover { background: rgba(31,111,235,0.1); }
        .lgi-item.lgi-up { border-left: 2px solid rgba(34,197,94,0.3); }
        .lgi-item.lgi-down { border-left: 2px solid rgba(239,68,68,0.3); }
        .lgi-item.lgi-flat { border-left: 2px solid rgba(107,114,128,0.3); }
        .lgi-item-inline { min-width: 220px; flex-shrink: 0; }
        .lgi-flag { font-size: 14px; width: 18px; text-align: center; }
        .lgi-name { flex: 1; min-width: 60px; font-weight: 500; white-space: nowrap; }
        .lgi-price { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 80px; text-align: right; }
        .lgi-change { font-variant-numeric: tabular-nums; font-weight: 500; min-width: 70px; text-align: right; }
        .lgi-change.positive { color: #22c55e; }
        .lgi-change.negative { color: #ef4444; }
        .lgi-detail { font-size: 10px; color: #484f58; min-width: 100px; }
        .lgi-source { font-size: 8px; margin-left: 2px; }
        .lgi-source.live { color: #22c55e; }
        .lgi-source.polling { color: #fbbf24; }
        .lgi-source.offline { color: #6b7280; }
        .lgi-scroll { overflow: hidden; position: relative; }
        .lgi-scroll-inner {
          display: flex; gap: 1px;
          animation: lgi-scroll 60s linear infinite;
        }
        @keyframes lgi-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .lgi-compact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 4px;
        }
        .lgi-compact-grid .lgi-item { padding: 3px 6px; font-size: 11px; }
      `}</style>
    </div>
  );
}
