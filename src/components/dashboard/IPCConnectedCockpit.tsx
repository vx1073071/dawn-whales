import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ── types ──────────────────────────────────────────────────
interface QuoteSnapshot {
  symbol: string;
  name: string;
  flag: string;
  market: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timestamp: number;
  source: 'yahoo' | 'binance' | 'futu' | 'mock';
  connection: 'live' | 'polling' | 'stale';
}

interface CockpitData {
  indices: QuoteSnapshot[];
  sectors: { name: string; changePercent: number; topStock: string; topChange: number }[];
  movers: { symbol: string; name: string; changePercent: number; severity: 'high' | 'medium' | 'low'; catalyst: string }[];
  factors: { name: string; signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'; ic: number; sharpe: number }[];
  aiTake: string;
  alerts: { level: 'critical' | 'warning' | 'info'; message: string; time: number }[];
  connectionState: 'live' | 'degraded' | 'mock';
}

const MOCK_INDICES: QuoteSnapshot[] = [
  { symbol: '^GSPC', name: 'S&P 500', flag: '🇺🇸', market: 'US', price: 5982, change: 24.5, changePercent: 0.41, volume: 2200000000, high: 5995, low: 5950, open: 5960, prevClose: 5957.5, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: '^HSI', name: 'Hang Seng', flag: '🇭🇰', market: 'HK', price: 20200, change: -180, changePercent: -0.88, volume: 1500000000, high: 20450, low: 20100, open: 20380, prevClose: 20380, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: 'BTC-USD', name: 'Bitcoin', flag: '🪙', market: 'Crypto', price: 104500, change: 2100, changePercent: 2.05, volume: 28000000000, high: 105200, low: 102000, open: 102400, prevClose: 102400, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: '^N225', name: 'Nikkei 225', flag: '🇯🇵', market: 'JP', price: 39200, change: 350, changePercent: 0.90, volume: 800000000, high: 39300, low: 38800, open: 38850, prevClose: 38850, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: '^FTSE', name: 'FTSE 100', flag: '🇬🇧', market: 'UK', price: 8720, change: -42, changePercent: -0.48, volume: 600000000, high: 8770, low: 8700, open: 8762, prevClose: 8762, timestamp: Date.now(), source: 'mock', connection: 'stale' },
  { symbol: 'ETH-USD', name: 'Ethereum', flag: '🪙', market: 'Crypto', price: 3950, change: 85, changePercent: 2.20, volume: 12000000000, high: 3980, low: 3850, open: 3865, prevClose: 3865, timestamp: Date.now(), source: 'mock', connection: 'stale' },
];

const MOCK_COCKPIT: CockpitData = {
  indices: MOCK_INDICES,
  sectors: [
    { name: 'Semiconductors', changePercent: 3.2, topStock: 'NVDA', topChange: 5.2 },
    { name: 'AI & Cloud', changePercent: 2.8, topStock: 'MSFT', topChange: 1.5 },
    { name: 'Crypto', changePercent: 2.1, topStock: 'COIN', topChange: 4.8 },
    { name: 'Energy', changePercent: -0.8, topStock: 'XOM', topChange: -1.2 },
    { name: 'Consumer', changePercent: 0.3, topStock: 'AMZN', topChange: 0.7 },
    { name: 'Financials', changePercent: -0.5, topStock: 'JPM', topChange: -0.9 },
  ],
  movers: [
    { symbol: 'NVDA', name: 'NVIDIA', changePercent: 5.2, severity: 'high', catalyst: 'AI chip demand surge' },
    { symbol: 'SMCI', name: 'Super Micro', changePercent: 12.1, severity: 'high', catalyst: 'Earnings beat' },
    { symbol: 'TSLA', name: 'Tesla', changePercent: -4.3, severity: 'medium', catalyst: 'Delivery miss' },
    { symbol: 'COIN', name: 'Coinbase', changePercent: 8.5, severity: 'medium', catalyst: 'BTC rally' },
    { symbol: '0700', name: 'Tencent', changePercent: -3.2, severity: 'medium', catalyst: 'Regulatory concerns' },
    { symbol: '9988', name: 'BABA', changePercent: 6.1, severity: 'medium', catalyst: 'Buyback announcement' },
  ],
  factors: [
    { name: 'Momentum 12M', signal: 'strong_buy', ic: 0.08, sharpe: 1.2 },
    { name: 'Low Volatility', signal: 'buy', ic: 0.05, sharpe: 0.8 },
    { name: 'Value (P/E)', signal: 'hold', ic: 0.03, sharpe: 0.4 },
    { name: 'Quality (ROE)', signal: 'buy', ic: 0.06, sharpe: 0.9 },
    { name: 'Sentiment', signal: 'sell', ic: -0.04, sharpe: -0.3 },
    { name: 'Size (Small Cap)', signal: 'hold', ic: 0.01, sharpe: 0.1 },
  ],
  aiTake: 'US markets resilient. Tech and crypto leading. NVDA +5.2% on AI demand. Defensive sectors mixed. Fed minutes at 2pm ET — key for afternoon direction.',
  alerts: [
    { level: 'warning', message: 'VIX spiked to 18.5 (+15%)', time: Date.now() - 120000 },
    { level: 'info', message: 'NVDA hit all-time high $152', time: Date.now() - 300000 },
    { level: 'critical', message: 'SMCI halted — volatility pause', time: Date.now() - 600000 },
  ],
  connectionState: 'mock',
};

// ── IPC bridge ──────────────────────────────────────────────
function getElectronAPI(): any {
  return (window as any).electronAPI || (window as any).__ELECTRON_API__;
}

function useCockpitIPC(): CockpitData {
  const [data, setData] = useState<CockpitData>(MOCK_COCKPIT);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api) {
      // Browser mode: auto-refresh mock every 5s
      const id = setInterval(() => {
        setData(prev => ({
          ...prev,
          indices: prev.indices.map(i => ({
            ...i,
            price: i.price * (1 + (Math.random() - 0.48) * 0.005),
            changePercent: parseFloat((i.changePercent + (Math.random() - 0.5) * 0.1).toFixed(2)),
            timestamp: Date.now(),
          })),
          connectionState: 'mock' as const,
        }));
      }, 5000);
      return () => clearInterval(id);
    }

    let unsub: (() => void) | null = null;
    (async () => {
      try {
        if (api.subscribeQuotes) {
          unsub = await api.subscribeQuotes(
            MOCK_INDICES.map(i => i.symbol),
            (quotes: any[]) => {
              setData(prev => ({
                ...prev,
                indices: prev.indices.map((idx, i) => {
                  const q = quotes.find((q: any) => q.symbol === idx.symbol);
                  if (q) {
                    return {
                      ...idx,
                      price: q.price,
                      change: q.change,
                      changePercent: q.changePercent,
                      high: q.high ?? idx.high,
                      low: q.low ?? idx.low,
                      timestamp: q.timestamp ?? Date.now(),
                      source: 'yahoo' as const,
                      connection: 'live' as const,
                    };
                  }
                  return idx;
                }),
                connectionState: 'live' as const,
              }));
            }
          );
        }
      } catch {
        // fallback to mock polling
        const id = setInterval(() => {
          setData(prev => ({
            ...prev,
            indices: prev.indices.map(i => ({
              ...i,
              price: i.price * (1 + (Math.random() - 0.48) * 0.005),
              timestamp: Date.now(),
            })),
            connectionState: 'degraded' as const,
          }));
        }, 5000);
        return () => clearInterval(id);
      }
    })();

    return () => { if (unsub) unsub(); };
  }, []);

  return data;
}

// ── sub-components ──────────────────────────────────────────
function IndexBar({ indices }: { indices: QuoteSnapshot[] }) {
  return (
    <div className="ipc-index-bar">
      {indices.map(i => (
        <div key={i.symbol} className={`ipc-index-item ${i.changePercent > 0 ? 'up' : i.changePercent < 0 ? 'down' : 'flat'}`}>
          <span className="ipc-idx-flag">{i.flag}</span>
          <span className="ipc-idx-name">{i.name}</span>
          <span className="ipc-idx-price">{i.price.toLocaleString()}</span>
          <span className={`ipc-idx-change ${i.changePercent > 0 ? 'pos' : 'neg'}`}>
            {i.changePercent > 0 ? '▲' : i.changePercent < 0 ? '▼' : '–'}{Math.abs(i.changePercent).toFixed(2)}%
          </span>
          <span className={`ipc-idx-dot ${i.connection}`} title={`Source: ${i.source} (${i.connection})`} />
        </div>
      ))}
    </div>
  );
}

function SectorBar({ sectors }: { sectors: CockpitData['sectors'] }) {
  return (
    <div className="ipc-sector-bar">
      <span className="ipc-section-label">Sectors</span>
      {sectors.map(s => (
        <div key={s.name} className={`ipc-sector-chip ${s.changePercent > 0 ? 'up' : 'down'}`}>
          <span className="ipc-sector-name">{s.name}</span>
          <span className={`ipc-sector-change ${s.changePercent > 0 ? 'pos' : 'neg'}`}>
            {s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(1)}%
          </span>
          <span className="ipc-sector-leader">{s.topStock}</span>
        </div>
      ))}
    </div>
  );
}

function MoversPanel({ movers }: { movers: CockpitData['movers'] }) {
  return (
    <div className="ipc-movers">
      <span className="ipc-section-label">Top Movers</span>
      {movers.map(m => (
        <div key={m.symbol} className={`ipc-mover-row severity-${m.severity}`}>
          <span className="ipc-mover-symbol">{m.symbol}</span>
          <span className="ipc-mover-name">{m.name}</span>
          <span className={`ipc-mover-change ${m.changePercent > 0 ? 'pos' : 'neg'}`}>
            {m.changePercent > 0 ? '+' : ''}{m.changePercent.toFixed(1)}%
          </span>
          <span className={`ipc-mover-severity ${m.severity}`}>{m.severity.toUpperCase()}</span>
          <span className="ipc-mover-catalyst">{m.catalyst}</span>
        </div>
      ))}
    </div>
  );
}

function FactorsPanel({ factors }: { factors: CockpitData['factors'] }) {
  const sigColors: Record<string, string> = { strong_buy: '#22c55e', buy: '#4ade80', hold: '#f59e0b', sell: '#f87171', strong_sell: '#ef4444' };
  return (
    <div className="ipc-factors">
      <span className="ipc-section-label">Factor Signals</span>
      {factors.map(f => (
        <div key={f.name} className="ipc-factor-row">
          <span className="ipc-factor-name">{f.name}</span>
          <span className="ipc-factor-signal" style={{ color: sigColors[f.signal] }}>{f.signal.toUpperCase()}</span>
          <span className="ipc-factor-ic">IC: {f.ic >= 0 ? '+' : ''}{f.ic.toFixed(2)}</span>
          <span className="ipc-factor-sharpe">Sharpe: {f.sharpe.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

function AlertsFeed({ alerts }: { alerts: CockpitData['alerts'] }) {
  const levelColors: Record<string, string> = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
  return (
    <div className="ipc-alerts">
      <span className="ipc-section-label">Live Alerts</span>
      {alerts.map((a, i) => (
        <div key={i} className="ipc-alert-row" style={{ borderLeftColor: levelColors[a.level] }}>
          <span className="ipc-alert-level" style={{ color: levelColors[a.level] }}>{a.level.toUpperCase()}</span>
          <span className="ipc-alert-msg">{a.message}</span>
          <span className="ipc-alert-time">{new Date(a.time).toLocaleTimeString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── main cockpit ────────────────────────────────────────────
export default function IPCConnectedCockpit() {
  const data = useCockpitIPC();
  const [tab, setTab] = useState<'overview' | 'movers' | 'factors' | 'ai'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const connIcon = data.connectionState === 'live' ? '🟢' : data.connectionState === 'degraded' ? '🟡' : '⚪';
  const connLabel = data.connectionState === 'live' ? 'LIVE' : data.connectionState === 'degraded' ? 'DEGRADED' : 'MOCK';

  return (
    <div className="ipc-cockpit">
      {/* header */}
      <div className="ipc-header">
        <div className="ipc-title-row">
          <span className="ipc-icon">🐄</span>
          <span className="ipc-title">QUANT MOO Cockpit</span>
          <span className={`ipc-conn-badge ${data.connectionState}`}>
            {connIcon} {connLabel}
          </span>
        </div>
        <div className="ipc-header-actions">
          <button className={`ipc-tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>📊</button>
          <button className={`ipc-tab-btn ${tab === 'movers' ? 'active' : ''}`} onClick={() => setTab('movers')}>📈</button>
          <button className={`ipc-tab-btn ${tab === 'factors' ? 'active' : ''}`} onClick={() => setTab('factors')}>🧬</button>
          <button className={`ipc-tab-btn ${tab === 'ai' ? 'active' : ''}`} onClick={() => setTab('ai')}>🤖</button>
          <button className={`ipc-refresh-btn ${autoRefresh ? 'active' : ''}`} onClick={() => setAutoRefresh(!autoRefresh)}>
            {autoRefresh ? '⟳' : '⏸'}
          </button>
        </div>
      </div>

      {/* index ticker */}
      <IndexBar indices={data.indices} />

      {/* tab content */}
      <div className="ipc-content">
        {tab === 'overview' && (
          <>
            <SectorBar sectors={data.sectors} />
            <MoversPanel movers={data.movers.slice(0, 3)} />
          </>
        )}
        {tab === 'movers' && <MoversPanel movers={data.movers} />}
        {tab === 'factors' && <FactorsPanel factors={data.factors} />}
        {tab === 'ai' && (
          <div className="ipc-ai-panel">
            <span className="ipc-section-label">🤖 AI Quick Take</span>
            <p className="ipc-ai-text">{data.aiTake}</p>
            <div className="ipc-ai-actions">
              <button className="ipc-ai-btn">📋 Copy</button>
              <button className="ipc-ai-btn">🔊 Voice</button>
              <button className="ipc-ai-btn">📈 Backtest</button>
            </div>
          </div>
        )}
      </div>

      {/* alerts */}
      <AlertsFeed alerts={data.alerts} />

      <style>{`
        .ipc-cockpit {
          background: var(--bg-surface, #0d1117);
          border: 1px solid var(--border, #21262d);
          border-radius: 12px; padding: 14px;
          color: var(--text-primary, #c9d1d9);
          font-family: 'Inter', -apple-system, sans-serif;
        }
        .ipc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .ipc-title-row { display: flex; align-items: center; gap: 8px; }
        .ipc-icon { font-size: 20px; }
        .ipc-title { font-size: 16px; font-weight: 700; }
        .ipc-conn-badge { font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
        .ipc-conn-badge.live { background: rgba(34,197,94,0.15); color: #22c55e; }
        .ipc-conn-badge.degraded { background: rgba(251,191,36,0.15); color: #fbbf24; }
        .ipc-conn-badge.mock { background: rgba(107,114,128,0.15); color: #6b7280; }
        .ipc-header-actions { display: flex; gap: 2px; }
        .ipc-tab-btn, .ipc-refresh-btn {
          background: none; border: 1px solid #30363d; color: #8b949e;
          border-radius: 4px; padding: 2px 8px; font-size: 14px; cursor: pointer;
        }
        .ipc-tab-btn.active, .ipc-refresh-btn.active { background: #1f6feb; color: #fff; border-color: #1f6feb; }
        .ipc-index-bar { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; padding: 6px 8px; background: rgba(22,27,34,0.5); border-radius: 8px; }
        .ipc-index-item { display: flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 12px; border-radius: 4px; flex: 1; min-width: 140px; }
        .ipc-index-item.up { background: rgba(34,197,94,0.05); border-left: 2px solid rgba(34,197,94,0.3); }
        .ipc-index-item.down { background: rgba(239,68,68,0.05); border-left: 2px solid rgba(239,68,68,0.3); }
        .ipc-idx-flag { font-size: 14px; }
        .ipc-idx-name { font-weight: 500; flex: 1; }
        .ipc-idx-price { font-variant-numeric: tabular-nums; }
        .pos { color: #22c55e; } .neg { color: #ef4444; }
        .ipc-idx-dot { width: 6px; height: 6px; border-radius: 50%; }
        .ipc-idx-dot.live { background: #22c55e; }
        .ipc-idx-dot.polling { background: #fbbf24; }
        .ipc-idx-dot.stale { background: #6b7280; }
        .ipc-section-label { display: block; font-size: 10px; color: #484f58; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .ipc-content { margin-bottom: 10px; }
        .ipc-sector-bar { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
        .ipc-sector-chip { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 10px; border-radius: 8px; background: rgba(22,27,34,0.5); border: 1px solid #21262d; min-width: 80px; }
        .ipc-sector-chip.up { border-color: rgba(34,197,94,0.3); }
        .ipc-sector-chip.down { border-color: rgba(239,68,68,0.3); }
        .ipc-sector-name { font-size: 10px; color: #8b949e; }
        .ipc-sector-change { font-size: 13px; font-weight: 600; }
        .ipc-sector-leader { font-size: 9px; color: #484f58; }
        .ipc-movers { }
        .ipc-mover-row { display: flex; align-items: center; gap: 6px; padding: 4px 8px; font-size: 12px; border-left: 2px solid transparent; margin-bottom: 2px; border-radius: 4px; }
        .severity-high { border-left-color: #ef4444; }
        .severity-medium { border-left-color: #f59e0b; }
        .severity-low { border-left-color: #3b82f6; }
        .ipc-mover-symbol { font-weight: 600; min-width: 50px; }
        .ipc-mover-name { flex: 1; min-width: 60px; }
        .ipc-mover-change { font-weight: 600; }
        .ipc-mover-severity { font-size: 9px; padding: 1px 4px; border-radius: 3px; }
        .ipc-mover-severity.high { background: rgba(239,68,68,0.15); color: #f87171; }
        .ipc-mover-severity.medium { background: rgba(251,191,36,0.15); color: #fbbf24; }
        .ipc-mover-severity.low { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .ipc-mover-catalyst { font-size: 10px; color: #484f58; flex: 1; }
        .ipc-factors { }
        .ipc-factor-row { display: flex; align-items: center; gap: 8px; padding: 3px 8px; font-size: 12px; }
        .ipc-factor-name { flex: 1; font-weight: 500; }
        .ipc-factor-signal { font-size: 10px; font-weight: 600; min-width: 80px; }
        .ipc-factor-ic, .ipc-factor-sharpe { font-size: 10px; color: #8b949e; font-variant-numeric: tabular-nums; }
        .ipc-ai-panel { padding: 8px; }
        .ipc-ai-text { font-size: 13px; line-height: 1.6; color: #c9d1d9; margin: 6px 0; }
        .ipc-ai-actions { display: flex; gap: 6px; }
        .ipc-ai-btn { background: none; border: 1px solid #30363d; color: #8b949e; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; }
        .ipc-ai-btn:hover { border-color: #58a6ff; color: #c9d1d9; }
        .ipc-alerts { margin-top: 8px; padding-top: 8px; border-top: 1px solid #21262d; }
        .ipc-alert-row { display: flex; align-items: center; gap: 6px; padding: 3px 8px; font-size: 11px; border-left: 2px solid; margin-bottom: 2px; }
        .ipc-alert-level { font-size: 9px; font-weight: 600; min-width: 60px; }
        .ipc-alert-msg { flex: 1; }
        .ipc-alert-time { font-size: 10px; color: #484f58; }
      `}</style>
    </div>
  );
}
