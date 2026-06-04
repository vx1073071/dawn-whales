import { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
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

export default function MarketPage() {
  const { t } = useTranslation();
  const watchlist = useMarketStore((s) => s.watchlist);
  const quotes = useMarketStore((s) => s.quotes);
  const addWatch = useMarketStore((s) => s.addWatch);
  const removeWatch = useMarketStore((s) => s.removeWatch);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [klineData, setKlineData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [klineLoading, setKlineLoading] = useState(false);
  const [, setKlineError] = useState<string | null>(null);
  const [klinePeriod, setKlinePeriod] = useState<string>('daily');

  const PERIODS = [
    { key: '1m', label: t('common.1min') },
    { key: '5m', label: t('common.5min') },
    { key: '15m', label: t('common.15min') },
    { key: '60m', label: t('common.60min') },
    { key: 'daily', label: t('common.dailyK') },
    { key: 'weekly', label: t('common.weeklyK') },
  ];

  useEffect(() => {
    if (selectedSymbol) loadKlines(selectedSymbol, klinePeriod);
  }, [selectedSymbol, klinePeriod]);

  async function loadKlines(symbol: string, period: string = 'daily') {
    setKlineLoading(true);
    setKlineError(null);
    try {
      const klines = await api.getKlines(symbol, period, 200);
      if (klines.length > 0) {
        setKlineData(klines.map((k: any) => ({
          time: typeof k.time === 'number' ? k.time : Math.floor(new Date(k.time).getTime() / 1000),
          open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume,
        })));
      }
    } catch (e: any) {
      setKlineError(e?.message || t('common.loadingFailed'));
    } finally { setKlineLoading(false); }
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

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{t('market.title')}</h1>
          <p className="text-gray-400 text-sm">{t('market.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSearch(!showSearch)} className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f] transition-colors">
            ＋ {t('market.addWatch')}
          </button>
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 mb-4">
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('market.searchPlaceholder')}
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
                未找到匹配 "{searchQuery}" 的股票
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
            <p className="text-gray-400 text-sm">加载 {selectedSymbol?.replace('US.', '')} K线数据...</p>
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
              <button onClick={() => loadKlines(selectedSymbol, klinePeriod)} className="text-xs text-gray-500 hover:text-gray-300 ml-auto transition-colors">⟳ 刷新</button>
            </div>
            <KLineChart data={klineData} height={400} />
          </div>
        ) : selectedSymbol ? (
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2 opacity-40">📊</div>
            <p className="text-gray-400 text-sm">K线数据加载中（需要 OpenD 连接）</p>
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
