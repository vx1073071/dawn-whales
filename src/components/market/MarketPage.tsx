// ── MarketPage — IPC Full-Link (Round 16 P0) ─────────────────────────────
// 全链路对接: marketStore quotes (IPC push) + K线 (IPC fetch) + 数据源状态
// >=500 lines | dark theme | Ant-style cards
import { useState, useEffect, memo } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import KLineChart from './KLineChart';
import * as api from '@/lib/bridge-api';

const POPULAR_US = [
  { code: 'US.TQQQ', name: 'ProShares UltraPro QQQ 3x' },
  { code: 'US.SQQQ', name: 'ProShares UltraPro Short QQQ' },
  { code: 'US.SOXL', name: 'Direxion Semiconductor Bull 3x' },
  { code: 'US.SOXS', name: 'Direxion Semiconductor Bear 3x' },
  { code: 'US.QQQ', name: 'Invesco QQQ Trust' },
  { code: 'US.SPY', name: 'SPDR S&P 500 ETF' },
  { code: 'US.AAPL', name: 'Apple Inc.' },
  { code: 'US.NVDA', name: 'NVIDIA Corp.' },
  { code: 'US.MSFT', name: 'Microsoft Corp.' },
  { code: 'US.TSLA', name: 'Tesla Inc.' },
  { code: 'US.AMD', name: 'Advanced Micro Devices' },
  { code: 'US.GOOG', name: 'Alphabet Inc.' },
  { code: 'US.AMZN', name: 'Amazon.com Inc.' },
  { code: 'US.META', name: 'Meta Platforms Inc.' },
  { code: 'US.PLTR', name: 'Palantir Technologies' },
  { code: 'US.AVGO', name: 'Broadcom Inc.' },
  { code: 'US.ARKK', name: 'ARK Innovation ETF' },
  { code: 'US.IWM', name: 'iShares Russell 2000' },
  { code: 'US.GLD', name: 'SPDR Gold Shares' },
  { code: 'US.TLT', name: 'iShares 20+ Year Treasury' },
  { code: 'US.UVXY', name: 'ProShares Ultra VIX' },
  { code: 'US.BABA', name: 'Alibaba Group (US)' },
  { code: 'US.PDD', name: 'PDD Holdings' },
  { code: 'US.NIO', name: 'NIO Inc.' },
];

// ── Data Source Status Component ──────────────────────────────────────────
function DataSourceIndicator({ connected, brokerName }: { connected: boolean; brokerName: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
      <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
        {connected ? `${brokerName} 实时` : '离线 (模拟数据)'}
      </span>
    </div>
  );
}

// ── Market Stats Bar ──────────────────────────────────────────────────────
function MarketStatsBar({ quotes, watchlist }: { quotes: Record<string, any>; watchlist: string[] }) {
  const stats = watchlist.reduce(
    (acc, code) => {
      const q = quotes[code];
      if (q) {
        acc.total++;
        if (q.change > 0) acc.up++;
        else if (q.change < 0) acc.down++;
        else acc.flat++;
      }
      return acc;
    },
    { up: 0, down: 0, flat: 0, total: 0 }
  );

  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="text-gray-500">自选 {stats.total} 只</span>
      <span className="text-emerald-400">↑ {stats.up}</span>
      <span className="text-red-400">↓ {stats.down}</span>
      <span className="text-gray-500">→ {stats.flat}</span>
    </div>
  );
}

export default function MarketPage() {
  const watchlist = useMarketStore((s) => s.watchlist);
  const quotes = useMarketStore((s) => s.quotes);
  const addWatch = useMarketStore((s) => s.addWatch);
  const removeWatch = useMarketStore((s) => s.removeWatch);
  const setQuotes = useMarketStore((s) => s.setQuotes);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [klineData, setKlineData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [klineLoading, setKlineLoading] = useState(false);
  const [klinePeriod, setKlinePeriod] = useState<string>('daily');
  const [connected, setConnected] = useState(false);
  const [brokerName, setBrokerName] = useState('OpenD');
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [pushCount, setPushCount] = useState(0);
  const [dataSource, setDataSource] = useState<'realtime' | 'cached' | 'simulated'>('simulated');

  const PERIODS = [
    { key: '1m', label: '1分' },
    { key: '5m', label: '5分' },
    { key: '15m', label: '15分' },
    { key: '60m', label: '60分' },
    { key: 'daily', label: '日K' },
    { key: 'weekly', label: '周K' },
  ];

  // ── IPC: Check broker connection ────────────────────────────────────────
  useEffect(() => {
    checkConnection();
    subscribeQuotes();
    const timer = setInterval(checkConnection, 10000);
    return () => clearInterval(timer);
  }, []);

  async function checkConnection() {
    try {
      const ok = await api.isConnected();
      setConnected(ok);
      if (ok) {
        setDataSource('realtime');
        try {
          const status = await api.getBrokerStatus();
          if (status?.length > 0) {
            const active = status.find((s: any) => s.active) || status[0];
            setBrokerName(active.name || active.type || 'OpenD');
          }
        } catch { /* keep default */ }
      } else {
        setDataSource('simulated');
      }
    } catch {
      setConnected(false);
      setDataSource('simulated');
    }
  }

  // ── IPC: Subscribe to quote push ─────────────────────────────────────
  function subscribeQuotes() {
    if (typeof window === 'undefined' || !window.api?.on) return;

    // Subscribe to quote push events from broker
    window.api.on('quote-update', (data: any) => {
      if (Array.isArray(data) && data.length > 0) {
        setQuotes(data);
        setPushCount((c) => c + 1);
        setLastUpdateTime(new Date().toLocaleTimeString('zh-CN'));
        setDataSource('realtime');
      }
    });

    // Also listen for quotes:push (alternative channel)
    window.api.on('quotes:push', (data: any) => {
      if (Array.isArray(data) && data.length > 0) {
        setQuotes(data);
        setPushCount((c) => c + 1);
        setLastUpdateTime(new Date().toLocaleTimeString('zh-CN'));
      }
    });
  }

  // ── IPC: Subscribe to broker quote push on mount ─────────────────────
  useEffect(() => {
    if (connected && watchlist.length > 0) {
      try {
        window.api?.broker?.subscribe?.(watchlist);
      } catch { /* silent */ }
    }
  }, [connected, watchlist.length]);

  // ── IPC: Fetch initial quotes on mount ───────────────────────────────
  useEffect(() => {
    if (watchlist.length > 0) fetchQuotes();
  }, [watchlist.length]);

  async function fetchQuotes() {
    try {
      const result = await api.getQuotes(watchlist);
      if (result && Array.isArray(result) && result.length > 0) {
        setQuotes(result);
        setLastUpdateTime(new Date().toLocaleTimeString('zh-CN'));
        if (connected) setDataSource('realtime');
      } else {
        // Fallback: generate simulated quotes
        generateSimulatedQuotes();
      }
    } catch {
      generateSimulatedQuotes();
    }
  }

  function generateSimulatedQuotes() {
    const simulated = watchlist.map((code) => {
      const base = getBasePrice(code);
      const change = (Math.random() - 0.48) * base * 0.04;
      return {
        code,
        name: POPULAR_US.find((s) => s.code === code)?.name || code.replace('US.', ''),
        price: base + change,
        change,
        changePct: (change / base) * 100,
        volume: Math.floor(Math.random() * 50000000) + 1000000,
        high: base + Math.abs(change) * 1.2,
        low: base - Math.abs(change) * 1.2,
        open: base + (Math.random() - 0.5) * base * 0.01,
        time: Date.now(),
      };
    });
    setQuotes(simulated as any[]);
    setDataSource('simulated');
    setLastUpdateTime(new Date().toLocaleTimeString('zh-CN'));
  }

  function getBasePrice(code: string): number {
    const prices: Record<string, number> = {
      'US.TQQQ': 52, 'US.SQQQ': 28, 'US.SOXL': 35, 'US.SOXS': 22,
      'US.QQQ': 445, 'US.SPY': 520, 'US.AAPL': 192, 'US.NVDA': 880,
      'US.MSFT': 415, 'US.TSLA': 178, 'US.AMD': 162, 'US.GOOG': 155,
      'US.AMZN': 185, 'US.META': 490, 'US.PLTR': 24, 'US.AVGO': 1320,
      'US.ARKK': 52, 'US.IWM': 200, 'US.GLD': 215, 'US.TLT': 92,
      'US.UVXY': 18, 'US.BABA': 78, 'US.PDD': 128, 'US.NIO': 5.5,
    };
    return prices[code] || 100;
  }

  // ── IPC: Load K-lines ────────────────────────────────────────────────
  useEffect(() => {
    if (selectedSymbol) loadKlines(selectedSymbol, klinePeriod);
  }, [selectedSymbol, klinePeriod]);

  async function loadKlines(symbol: string, period: string = 'daily') {
    setKlineLoading(true);
    try {
      const klines = await api.getKlines(symbol, period, 200);
      if (klines.length > 0) {
        setKlineData(
          klines.map((k: any) => ({
            time: typeof k.time === 'number' ? k.time : Math.floor(new Date(k.time).getTime() / 1000),
            open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume,
          }))
        );
        setDataSource(connected ? 'realtime' : 'cached');
      } else {
        // Fallback: generate simulated klines
        setKlineData(generateSimulatedKlines(symbol));
        setDataSource('simulated');
      }
    } catch {
      setKlineData(generateSimulatedKlines(symbol));
      setDataSource('simulated');
    } finally {
      setKlineLoading(false);
    }
  }

  function generateSimulatedKlines(symbol: string): any[] {
    const base = getBasePrice(symbol);
    const klines: any[] = [];
    let price = base * 0.85;
    const now = Math.floor(Date.now() / 1000);

    for (let i = 199; i >= 0; i--) {
      const change = (Math.random() - 0.47) * price * 0.025;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * price * 0.01;
      const low = Math.min(open, close) - Math.random() * price * 0.01;
      const volume = Math.floor(Math.random() * 30000000) + 5000000;

      klines.push({
        time: now - i * 86400,
        open: +open.toFixed(2),
        high: +high.toFixed(2),
        low: +low.toFixed(2),
        close: +close.toFixed(2),
        volume,
      });
      price = close;
    }
    return klines;
  }

  const filteredSearch = searchQuery.trim()
    ? POPULAR_US.filter((s) => {
        const q = searchQuery.toUpperCase();
        return s.code.includes(q) || s.name.toUpperCase().includes(q);
      })
    : POPULAR_US.filter((s) => !watchlist.includes(s.code));

  function handleAddStock(code: string) {
    addWatch(code);
    setSearchQuery('');
    setShowSearch(false);
  }

  const dataSourceLabel = dataSource === 'realtime' ? '实时数据' : dataSource === 'cached' ? '缓存数据' : '模拟数据';
  const dataSourceColor = dataSource === 'realtime' ? 'text-emerald-400' : dataSource === 'cached' ? 'text-yellow-400' : 'text-gray-500';

  return (
    <div className="p-6">
      {/* Header with IPC status */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">行情中心</h1>
          <p className="text-gray-400 text-sm">实时监控自选股行情 · IPC 全链路</p>
        </div>
        <div className="flex items-center gap-4">
          <DataSourceIndicator connected={connected} brokerName={brokerName} />
          <MarketStatsBar quotes={quotes} watchlist={watchlist} />
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f] transition-colors"
          >
            ＋ 添加自选
          </button>
        </div>
      </div>

      {/* Data source status bar */}
      <div className="bg-[#12121a] border border-white/5 rounded-lg px-4 py-2 mb-4 flex items-center gap-4 text-xs">
        <span className="text-gray-600">数据源:</span>
        <span className={dataSourceColor}>{dataSourceLabel}</span>
        <span className="text-gray-700">|</span>
        <span className="text-gray-500">Push 次数: {pushCount}</span>
        <span className="text-gray-700">|</span>
        <span className="text-gray-500">最后更新: {lastUpdateTime || '--'}</span>
        <span className="text-gray-700">|</span>
        <span className="text-gray-500">自选: {watchlist.length} 只</span>
        <button
          onClick={fetchQuotes}
          className="ml-auto text-gray-500 hover:text-gray-300 transition-colors"
        >
          ⟳ 刷新行情
        </button>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 mb-4">
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索股票代码或名称..."
            className="w-full bg-[#12121a] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/50 mb-3"
            onKeyDown={(e) => { if (e.key === 'Escape') setShowSearch(false); }}
          />
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
            {filteredSearch.map((s) => {
              const inWatchlist = watchlist.includes(s.code);
              return (
                <button
                  key={s.code}
                  onClick={() => !inWatchlist && handleAddStock(s.code)}
                  disabled={inWatchlist}
                  className={`text-left p-2 rounded-lg text-xs transition-colors ${
                    inWatchlist
                      ? 'bg-[#C9A046]/10 text-[#D4A853] cursor-default'
                      : 'bg-[#12121a] text-gray-300 hover:bg-[#22222f] hover:text-white cursor-pointer'
                  }`}
                >
                  <div className="font-mono font-medium">{s.code.replace('US.', '')}</div>
                  <div className="text-gray-500 truncate mt-0.5" style={{ fontSize: '10px' }}>{s.name}</div>
                </button>
              );
            })}
            {filteredSearch.length === 0 && (
              <div className="col-span-6 text-center text-gray-500 text-sm py-4">
                未找到匹配 &quot;{searchQuery}&quot; 的股票
              </div>
            )}
          </div>
        </div>
      )}

      {/* Market table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wide">代码</th>
              <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wide">名称</th>
              <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide">最新价</th>
              <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide">涨跌额</th>
              <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide">涨跌幅</th>
              <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide">成交量</th>
              <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium uppercase tracking-wide">标签</th>
              <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium uppercase tracking-wide w-12"></th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((code) => (
              <WatchlistRow
                key={code}
                code={code}
                quote={quotes[code]}
                isSelected={selectedSymbol === code}
                onSelect={setSelectedSymbol}
                onRemove={removeWatch}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* K-Line Chart */}
      <div className="mt-6">
        {klineLoading ? (
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2 opacity-40">⏳</div>
            <p className="text-gray-400 text-sm">加载 {selectedSymbol?.replace('US.', '')} K线数据 (IPC)...</p>
          </div>
        ) : selectedSymbol && klineData.length > 0 ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-white font-semibold">{selectedSymbol.replace('US.', '')}</h2>
              {(() => {
                const q = quotes[selectedSymbol];
                const cls = q && q.change > 0 ? 'text-emerald-400' : q && q.change < 0 ? 'text-red-400' : 'text-gray-500';
                return q ? (
                  <span className={`font-mono text-sm ${cls}`}>
                    {q.price.toFixed(2)} {q.change > 0 ? '+' : ''}{q.changePct.toFixed(2)}%
                  </span>
                ) : null;
              })()}
              <div className="flex gap-1 ml-4">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setKlinePeriod(p.key)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      klinePeriod === p.key
                        ? 'bg-[#C9A046] text-black'
                        : 'text-gray-500 hover:text-gray-300 bg-[#12121a]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <span className={`text-[10px] ml-2 ${dataSourceColor}`}>{dataSourceLabel}</span>
              <button onClick={() => loadKlines(selectedSymbol, klinePeriod)} className="text-xs text-gray-500 hover:text-gray-300 ml-auto transition-colors">
                ⟳ 刷新
              </button>
            </div>
            <KLineChart data={klineData} height={400} />
          </div>
        ) : selectedSymbol ? (
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2 opacity-40">📊</div>
            <p className="text-gray-400 text-sm">K线数据加载中（{connected ? 'IPC 请求中...' : '需要 OpenD 连接或使用模拟数据'}）</p>
          </div>
        ) : (
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2 opacity-40">📈</div>
            <p className="text-gray-400 text-sm">点击上面的股票查看 K 线图</p>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtVol(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}

// ── Memoized Watchlist Row ───────────────────────────────────────────────
const WatchlistRow = memo(function WatchlistRow({
  code,
  quote,
  isSelected,
  onSelect,
  onRemove,
}: {
  code: string;
  quote: any;
  isSelected: boolean;
  onSelect: (code: string) => void;
  onRemove: (code: string) => void;
}) {
  const chg = quote?.change ?? 0;
  const pct = quote?.changePct ?? 0;
  const cls = chg > 0 ? 'text-emerald-400' : chg < 0 ? 'text-red-400' : 'text-gray-500';
  const sym = code.replace('US.', '');
  const isLev = ['TQQQ', 'SOXL', 'SQQQ', 'SOXS', 'UVXY'].includes(sym);
  const isInv = ['SQQQ', 'SOXS'].includes(sym);

  return (
    <tr
      onClick={() => onSelect(code)}
      className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer ${isSelected ? 'bg-[#C9A046]/5' : ''}`}
    >
      <td className="px-4 py-3 font-semibold text-white text-sm">{sym}</td>
      <td className="px-4 py-3 text-gray-400 text-xs">{quote?.name || '--'}</td>
      <td className={`px-4 py-3 text-right font-mono text-sm ${cls}`}>{quote ? quote.price.toFixed(2) : '--'}</td>
      <td className={`px-4 py-3 text-right font-mono text-sm ${cls}`}>{chg > 0 ? '+' : ''}{chg.toFixed(2)}</td>
      <td className={`px-4 py-3 text-right font-mono text-sm ${cls}`}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{quote ? fmtVol(quote.volume) : '--'}</td>
      <td className="px-4 py-3 text-center">
        {isLev && <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded mr-1">3x</span>}
        {isInv && <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">反向</span>}
      </td>
      <td className="px-4 py-3 text-center">
        <button onClick={(e) => { e.stopPropagation(); onRemove(code); }} className="text-gray-600 hover:text-red-400 text-xs transition-colors" title="移出自选">✕</button>
      </td>
    </tr>
  );
});
