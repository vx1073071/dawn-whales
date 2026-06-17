import { useState, useEffect, useMemo, useRef } from 'react';

// ── types ──────────────────────────────────────────────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

interface WatchlistItem {
  symbol: string;
  name: string;
  flag: string;
  market: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  pe?: number;
  marketCap?: number;
  dividendYield?: number;
  rsi?: number;
  momentum6m?: number;
  beta?: number;
  starred: boolean;
  alert: boolean;
  timestamp: number;
  source: 'yahoo' | 'binance' | 'futu' | 'mock';
  connection: 'live' | 'polling' | 'stale';
}

const MOCK_WATCHLIST: WatchlistItem[] = [
  { symbol: 'NVDA', name: 'NVIDIA', flag: '🇺🇸', market: 'US', price: 152.3, change: 7.5, changePercent: 5.2, volume: 52000000, pe: 72, marketCap: 3800, dividendYield: 0.01, rsi: 68, momentum6m: 48.5, beta: 1.85, starred: true, alert: true, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: 'TSLA', name: 'Tesla', flag: '🇺🇸', market: 'US', price: 268.5, change: -12.1, changePercent: -4.3, volume: 89000000, pe: 45, marketCap: 850, dividendYield: 0, rsi: 42, momentum6m: -8.3, beta: 2.1, starred: true, alert: true, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: '0700', name: 'Tencent', flag: '🇭🇰', market: 'HK', price: 488.2, change: -16.1, changePercent: -3.2, volume: 32000000, pe: 18, marketCap: 580, dividendYield: 0.8, rsi: 38, momentum6m: 12.1, beta: 1.2, starred: true, alert: false, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: 'MSFT', name: 'Microsoft', flag: '🇺🇸', market: 'US', price: 445.8, change: 6.6, changePercent: 1.5, volume: 22000000, pe: 35, marketCap: 3300, dividendYield: 0.7, rsi: 55, momentum6m: 22.0, beta: 1.1, starred: false, alert: false, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: 'COIN', name: 'Coinbase', flag: '🇺🇸', market: 'US', price: 312.5, change: 24.5, changePercent: 8.5, volume: 18000000, pe: 28, marketCap: 75, dividendYield: 0, rsi: 72, momentum6m: 65.3, beta: 2.8, starred: false, alert: false, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: '9988', name: 'BABA', flag: '🇭🇰', market: 'HK', price: 128.4, change: 7.4, changePercent: 6.1, volume: 45000000, pe: 12, marketCap: 280, dividendYield: 1.2, rsi: 60, momentum6m: 18.5, beta: 1.0, starred: false, alert: false, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: 'BTC-USD', name: 'Bitcoin', flag: '🪙', market: 'Crypto', price: 104500, change: 2100, changePercent: 2.05, volume: 0, pe: undefined, marketCap: 2100, dividendYield: 0, rsi: 62, momentum6m: 35.2, beta: undefined, starred: true, alert: true, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: 'AAPL', name: 'Apple', flag: '🇺🇸', market: 'US', price: 198.2, change: -1.8, changePercent: -0.9, volume: 48000000, pe: 30, marketCap: 3000, dividendYield: 0.5, rsi: 50, momentum6m: 10.1, beta: 0.95, starred: false, alert: false, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: 'SMCI', name: 'Super Micro', flag: '🇺🇸', market: 'US', price: 890.5, change: 96.2, changePercent: 12.1, volume: 15000000, pe: 42, marketCap: 52, dividendYield: 0, rsi: 78, momentum6m: 120.5, beta: 2.5, starred: false, alert: false, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: 'ETH-USD', name: 'Ethereum', flag: '🪙', market: 'Crypto', price: 3950, change: 85, changePercent: 2.2, volume: 0, pe: undefined, marketCap: 480, dividendYield: 0, rsi: 58, momentum6m: 28.7, beta: undefined, starred: false, alert: false, timestamp: Date.now(), source: 'mock', connection: 'stale' },
];

type SortDimension = 'change' | 'momentum' | 'value' | 'risk' | 'volume' | 'quality' | 'name';

const SORT_CONFIGS: Record<SortDimension, { label: string; desc: string; icon: string; fn: (a: WatchlistItem, b: WatchlistItem) => number }> = {
  change: { label: 'Change %', desc: 'Sort by today\'s price change', icon: '📈', fn: (a, b) => b.changePercent - a.changePercent },
  momentum: { label: 'Momentum', desc: '6-month momentum + RSI composite', icon: '🚀', fn: (a, b) => ((b.momentum6m ?? 0) + (b.rsi ?? 50) * 0.3) - ((a.momentum6m ?? 0) + (a.rsi ?? 50) * 0.3) },
  value: { label: 'Value', desc: 'Sort by P/E (low = cheaper)', icon: '💎', fn: (a, b) => (a.pe ?? 999) - (b.pe ?? 999) },
  risk: { label: 'Risk', desc: 'Sort by Beta (low = less risky)', icon: '🛡️', fn: (a, b) => (a.beta ?? 99) - (b.beta ?? 99) },
  volume: { label: 'Volume', desc: 'Sort by trading volume', icon: '📊', fn: (a, b) => b.volume - a.volume },
  quality: { label: 'Quality', desc: 'ROE proxy: P/E × dividend yield', icon: '⭐', fn: (a, b) => ((b.dividendYield ?? 0) * 100 / ((b.pe ?? 20) || 1)) - ((a.dividendYield ?? 0) * 100 / ((a.pe ?? 20) || 1)) },
  name: { label: 'Name', desc: 'Alphabetical', icon: '🔤', fn: (a, b) => a.name.localeCompare(b.name) },
};

// ── IPC ─────────────────────────────────────────────────────
function getElectronAPI(): any {
  return (window as any).electronAPI || (window as any).__ELECTRON_API__;
}

function useListWithIPC(): WatchlistItem[] {
  const [items, setItems] = useState<WatchlistItem[]>(MOCK_WATCHLIST);
  const cpuRef = useRef(0);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api) {
      // Browser mock: auto-jitter prices
      const id = setInterval(() => {
        setItems(prev => prev.map(i => ({
          ...i,
          price: parseFloat((i.price * (1 + (Math.random() - 0.48) * 0.008)).toFixed(i.market === 'Crypto' ? 0 : 2)),
          changePercent: parseFloat((i.changePercent + (Math.random() - 0.5) * 0.15).toFixed(2)),
          timestamp: Date.now(),
          connection: 'stale' as const,
        })));
        cpuRef.current = Math.random() * 3 + 1;
      }, 3000);
      return () => clearInterval(id);
    }

    let unsub: (() => void) | null = null;
    (async () => {
      try {
        if (api.subscribeQuotes) {
          unsub = await api.subscribeQuotes(
            MOCK_WATCHLIST.map(i => i.symbol),
            (quotes: any[]) => {
              setItems(prev => prev.map(item => {
                const q = quotes.find((q: any) => q.symbol === item.symbol);
                if (q) {
                  return {
                    ...item,
                    price: q.price,
                    change: q.change,
                    changePercent: q.changePercent,
                    timestamp: q.timestamp ?? Date.now(),
                    source: 'yahoo' as const,
                    connection: 'live' as const,
                  };
                }
                return item;
              }));
              cpuRef.current = Math.random() * 1.5 + 0.5;
            }
          );
        }
      } catch {
        const id = setInterval(() => {
          setItems(prev => prev.map(i => ({ ...i, price: parseFloat((i.price * (1 + (Math.random() - 0.48) * 0.005)).toFixed(2)), timestamp: Date.now(), connection: 'polling' as const })));
        }, 3000);
        return () => clearInterval(id);
      }
    })();

    return () => { if (unsub) unsub(); };
  }, []);

  return items;
}

// ── DesktopTickerBar (compact) ──────────────────────────────
function DesktopTickerBar({ items, compact }: { items: WatchlistItem[]; compact: boolean }) {
  if (compact) {
    return (
      <div className="dtb-compact">
        <div className="dtb-scroll-inner">
          {[...items, ...items].map((item, i) => (
            <div key={`${item.symbol}-${i}`} className={`dtb-compact-item ${item.changePercent > 0 ? 'up' : 'down'}`}>
              <span className="dtb-compact-symbol">{item.symbol}</span>
              <span className="dtb-compact-price">{item.market === 'Crypto' ? item.price.toLocaleString() : item.price.toFixed(2)}</span>
              <span className={`dtb-compact-change ${item.changePercent > 0 ? 'pos' : 'neg'}`}>
                {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
              </span>
              <span className={`dtb-compact-dot ${item.connection}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const liveCount = items.filter(i => i.connection === 'live').length;
  return (
    <div className="dtb-bar">
      <div className="dtb-header">
        <span className="dtb-title">🐄 QUANT MOO</span>
        <span className="dtb-status">
          {liveCount === items.length ? '🟢 Live' : liveCount > 0 ? '🟡 Partial' : '⚪ Mock'}
        </span>
        <span className="dtb-count">{items.length} stocks</span>
      </div>
      <div className="dtb-items">
        {items.map(item => (
          <div key={item.symbol} className={`dtb-item ${item.changePercent > 0 ? 'up' : 'down'}`}>
            <span className="dtb-flag">{item.flag}</span>
            <span className="dtb-symbol">{item.symbol}</span>
            <span className="dtb-price">{item.market === 'Crypto' ? item.price.toLocaleString() : item.price.toFixed(2)}</span>
            <span className={`dtb-change ${item.changePercent > 0 ? 'pos' : 'neg'}`}>
              {item.changePercent > 0 ? '▲' : '▼'} {Math.abs(item.changePercent).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── main component ──────────────────────────────────────────
export default function SmartSortedWatchlist() {
  const items = useListWithIPC();
  const [sortDim, setSortDim] = useState<SortDimension>('change');
  const [filterMarket, setFilterMarket] = useState<string>('ALL');
  const [starredOnly, setStarredOnly] = useState(false);
  const [compact, setCompact] = useState(false);

  const markets = ['ALL', ...new Set(items.map(i => i.market))];

  const filtered = useMemo(() => {
    let list = [...items];
    if (filterMarket !== 'ALL') list = list.filter(i => i.market === filterMarket);
    if (starredOnly) list = list.filter(i => i.starred);
    list.sort(SORT_CONFIGS[sortDim].fn);
    return list;
  }, [items, filterMarket, starredOnly, sortDim]);

  const avgChange = filtered.length > 0 ? filtered.reduce((s, i) => s + i.changePercent, 0) / filtered.length : 0;
  const liveCount = filtered.filter(i => i.connection === 'live').length;

  return (
    <div className="sso-container">
      {/* Desktop ticker bar */}
      <DesktopTickerBar items={filtered} compact={compact} />

      {/* header */}
      <div className="sso-header">
        <div className="sso-title-row">
          <span className="sso-icon">📋</span>
          <span className="sso-title">Watchlist</span>
          <span className={`sso-live-badge ${liveCount === filtered.length ? 'all' : liveCount > 0 ? 'partial' : 'mock'}`}>
            {liveCount}/{filtered.length} LIVE
          </span>
        </div>
        <div className="sso-header-right">
          <span className={`sso-avg-change ${avgChange > 0 ? 'pos' : 'neg'}`}>
            Avg: {avgChange > 0 ? '+' : ''}{avgChange.toFixed(2)}%
          </span>
          <button className={`sso-star-btn ${starredOnly ? 'active' : ''}`} onClick={() => setStarredOnly(!starredOnly)}>
            ⭐
          </button>
          <button className={`sso-compact-btn ${compact ? 'active' : ''}`} onClick={() => setCompact(!compact)}>
            ⊟
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="sso-filters">
        <div className="sso-market-chips">
          {markets.map(m => (
            <button key={m} className={`sso-chip ${filterMarket === m ? 'active' : ''}`} onClick={() => setFilterMarket(m)}>
              {m === 'ALL' ? 'All' : m}
            </button>
          ))}
        </div>
      </div>

      {/* sort dimensions */}
      <div className="sso-sorts">
        {(Object.entries(SORT_CONFIGS) as [SortDimension, typeof SORT_CONFIGS[SortDimension]][]).map(([key, config]) => (
          <button key={key} className={`sso-sort-btn ${sortDim === key ? 'active' : ''}`} onClick={() => setSortDim(key)} title={config.desc}>
            <span className="sso-sort-icon">{config.icon}</span>
            <span className="sso-sort-label">{config.label}</span>
          </button>
        ))}
      </div>

      {/* list */}
      <div className="sso-list">
        {filtered.map(item => (
          <div key={item.symbol} className={`sso-row ${item.changePercent > 0 ? 'up' : 'down'}`}>
            <span className="sso-flag">{item.flag}</span>
            {item.starred && <span className="sso-star">⭐</span>}
            {item.alert && <span className="sso-alert">🔔</span>}
            <span className="sso-symbol">{item.symbol}</span>
            <span className="sso-name">{item.name}</span>
            <span className="sso-price">{item.market === 'Crypto' ? item.price.toLocaleString() : item.price.toFixed(2)}</span>
            <span className={`sso-change ${item.changePercent > 0 ? 'pos' : 'neg'}`}>
              {item.changePercent > 0 ? '▲' : '▼'} {Math.abs(item.changePercent).toFixed(2)}%
            </span>
            {sortDim === 'momentum' && <span className="sso-momentum">M:{item.momentum6m?.toFixed(0)} R:{item.rsi}</span>}
            {sortDim === 'value' && <span className="sso-pe">PE:{item.pe ?? '—'}</span>}
            {sortDim === 'risk' && <span className="sso-beta">β:{item.beta?.toFixed(2) ?? '—'}</span>}
            {sortDim === 'volume' && <span className="sso-vol">{(item.volume / 1000000).toFixed(0)}M</span>}
            {sortDim === 'quality' && <span className="sso-div">Div:{item.dividendYield?.toFixed(1) ?? '—'}%</span>}
            <span className={`sso-source-dot ${item.connection}`} title={`${item.source}`} />
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="sso-empty">No stocks match your filter</div>
      )}

      <style>{`
        .sso-container {
          background: var(--bg-surface, #0d1117);
          border: 1px solid var(--border, #21262d);
          border-radius: 12px; padding: 14px;
          color: var(--text-primary, #c9d1d9);
          font-family: 'Inter', -apple-system, sans-serif;
        }
        .dtb-bar { margin-bottom: 10px; }
        .dtb-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .dtb-title { font-size: 13px; font-weight: 700; color: #22c55e; }
        .dtb-status { font-size: 10px; color: #8b949e; }
        .dtb-count { font-size: 10px; color: #484f58; margin-left: auto; }
        .dtb-items { display: flex; gap: 4px; flex-wrap: wrap; }
        .dtb-item { display: flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: 11px; border-radius: 4px; }
        .dtb-item.up { background: rgba(34,197,94,0.05); }
        .dtb-item.down { background: rgba(239,68,68,0.05); }
        .dtb-compact { overflow: hidden; margin-bottom: 8px; }
        .dtb-scroll-inner { display: flex; gap: 4px; animation: dtb-scroll 30s linear infinite; }
        @keyframes dtb-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .dtb-compact-item { display: flex; align-items: center; gap: 3px; padding: 2px 6px; font-size: 10px; white-space: nowrap; border-radius: 3px; min-width: 150px; }
        .dtb-compact-item.up { background: rgba(34,197,94,0.05); }
        .dtb-compact-item.down { background: rgba(239,68,68,0.05); }
        .dtb-compact-symbol { font-weight: 600; }
        .dtb-compact-dot { width: 4px; height: 4px; border-radius: 50%; }
        .dtb-compact-dot.live { background: #22c55e; }
        .dtb-compact-dot.polling { background: #fbbf24; }
        .dtb-compact-dot.stale { background: #6b7280; }
        .dtb-flag, .sso-flag { font-size: 14px; width: 18px; text-align: center; }
        .dtb-symbol, .sso-symbol { font-weight: 600; min-width: 45px; }
        .dtb-price, .sso-price { font-variant-numeric: tabular-nums; }
        .pos { color: #22c55e; } .neg { color: #ef4444; }
        .sso-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .sso-title-row { display: flex; align-items: center; gap: 6px; }
        .sso-icon { font-size: 16px; }
        .sso-title { font-size: 14px; font-weight: 600; }
        .sso-live-badge { font-size: 9px; padding: 1px 6px; border-radius: 8px; }
        .sso-live-badge.all { background: rgba(34,197,94,0.15); color: #22c55e; }
        .sso-live-badge.partial { background: rgba(251,191,36,0.15); color: #fbbf24; }
        .sso-live-badge.mock { background: rgba(107,114,128,0.15); color: #6b7280; }
        .sso-header-right { display: flex; align-items: center; gap: 8px; }
        .sso-avg-change { font-size: 12px; font-weight: 600; }
        .sso-star-btn, .sso-compact-btn {
          background: none; border: 1px solid #30363d; color: #8b949e;
          border-radius: 4px; padding: 2px 6px; font-size: 12px; cursor: pointer;
        }
        .sso-star-btn.active { background: rgba(251,191,36,0.15); border-color: #fbbf24; }
        .sso-compact-btn.active { background: #1f6feb; color: #fff; border-color: #1f6feb; }
        .sso-filters { margin-bottom: 6px; }
        .sso-market-chips { display: flex; gap: 4px; flex-wrap: wrap; }
        .sso-chip {
          background: none; border: 1px solid #30363d; color: #8b949e;
          border-radius: 10px; padding: 1px 8px; font-size: 10px; cursor: pointer;
        }
        .sso-chip.active { background: #1f6feb; color: #fff; border-color: #1f6feb; }
        .sso-sorts { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
        .sso-sort-btn {
          display: flex; align-items: center; gap: 3px;
          background: none; border: 1px solid #21262d; color: #8b949e;
          border-radius: 6px; padding: 3px 8px; font-size: 10px; cursor: pointer;
        }
        .sso-sort-btn.active { border-color: #58a6ff; color: #58a6ff; background: rgba(31,111,235,0.08); }
        .sso-sort-btn:hover { border-color: #30363d; color: #c9d1d9; }
        .sso-sort-icon { font-size: 12px; }
        .sso-list { display: flex; flex-direction: column; gap: 2px; }
        .sso-row {
          display: flex; align-items: center; gap: 6px;
          padding: 4px 8px; font-size: 12px; border-radius: 4px;
          border-left: 2px solid transparent;
        }
        .sso-row.up { border-left-color: rgba(34,197,94,0.3); }
        .sso-row.down { border-left-color: rgba(239,68,68,0.3); }
        .sso-row:hover { background: rgba(22,27,34,0.5); }
        .sso-star { font-size: 10px; }
        .sso-alert { font-size: 10px; }
        .sso-name { flex: 1; min-width: 60px; color: #8b949e; }
        .sso-change { font-weight: 600; min-width: 80px; text-align: right; }
        .sso-momentum, .sso-pe, .sso-beta, .sso-vol, .sso-div { font-size: 10px; color: #484f58; min-width: 60px; text-align: right; }
        .sso-source-dot { width: 5px; height: 5px; border-radius: 50%; }
        .sso-source-dot.live { background: #22c55e; }
        .sso-source-dot.polling { background: #fbbf24; }
        .sso-source-dot.stale { background: #6b7280; }
        .sso-empty { padding: 20px; text-align: center; color: #484f58; font-size: 13px; }
      `}</style>
    </div>
  );
}
