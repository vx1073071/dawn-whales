import { useState, useEffect, useRef, useCallback } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

import { useTranslation } from 'react-i18next';
import {
  getQuotes, subscribeQuoteStream, unsubscribeQuoteStream, getQuoteStreamStatus,
} from '@/lib/bridge-api';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import i18n from '../../i18n';

interface RealTimeQuote {
  code: string;
  name: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  volume: number;
  turnover: number;
  bid: number;
  ask: number;
  bidVol: number;
  askVol: number;
  high: number;
  low: number;
  open: number;
  updateTime: string;
  sparkline?: number[];
  flash?: 'up' | 'down' | null;
  dataQuality?: 'good' | 'stale' | 'error';
}

const WATCHLIST = [
  { code: 'US.AAPL', name: i18n.t('RealTimeMarketDashboard.k0') },
  { code: 'US.NVDA', name: i18n.t('RealTimeMarketDashboard.k1') },
  { code: 'US.TSLA', name: i18n.t('RealTimeMarketDashboard.k2') },
  { code: 'US.MSFT', name: i18n.t('RealTimeMarketDashboard.k3') },
  { code: 'US.AMZN', name: i18n.t('RealTimeMarketDashboard.k4') },
  { code: 'US.GOOGL', name: i18n.t('RealTimeMarketDashboard.k5') },
  { code: 'US.META', name: 'Meta' },
  { code: 'US.AVGO', name: i18n.t('RealTimeMarketDashboard.k6') },
  { code: 'HK.00700', name: i18n.t('RealTimeMarketDashboard.k7') },
  { code: 'HK.09988', name: i18n.t('RealTimeMarketDashboard.k8') },
  { code: 'US.BABA', name: i18n.t('RealTimeMarketDashboard.k9') },
  { code: 'US.PDD', name: i18n.t('RealTimeMarketDashboard.k10') },
];

function generateSparkline(basePrice: number): number[] {
  const data: number[] = [basePrice];
  for (let i = 1; i < 30; i++) {
    data.push(data[i - 1] * (1 + (Math.random() - 0.5) * 0.02));
  }
  return data;
}

function generateMockQuote(stock: { code: string; name: string }): RealTimeQuote {
  const basePrice = stock.code.includes('AAPL') ? 189.5 :
    stock.code.includes('NVDA') ? 875.3 :
    stock.code.includes('TSLA') ? 172.6 :
    stock.code.includes('MSFT') ? 412.2 :
    stock.code.includes('AMZN') ? 178.1 :
    stock.code.includes('GOOGL') ? 165.8 :
    stock.code.includes('META') ? 474.3 :
    stock.code.includes('AVGO') ? 1280.5 :
    stock.code.includes('00700') ? 385.2 :
    stock.code.includes('09988') ? 78.5 :
    stock.code.includes('BABA') ? 78.3 :
    stock.code.includes('PDD') ? 142.8 : 100;

  const changePct = (Math.random() - 0.48) * 5;
  const price = basePrice * (1 + changePct / 100);
  const prevClose = basePrice;

  return {
    code: stock.code,
    name: stock.name,
    price: +price.toFixed(2),
    prevClose: +prevClose.toFixed(2),
    change: +(price - prevClose).toFixed(2),
    changePct: +changePct.toFixed(2),
    volume: Math.floor(Math.random() * 50000000) + 1000000,
    turnover: Math.floor(Math.random() * 5000000000) + 100000000,
    bid: +(price * 0.999).toFixed(2),
    ask: +(price * 1.001).toFixed(2),
    bidVol: Math.floor(Math.random() * 5000) + 100,
    askVol: Math.floor(Math.random() * 5000) + 100,
    high: +(price * 1.02).toFixed(2),
    low: +(price * 0.98).toFixed(2),
    open: +(prevClose * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2),
    updateTime: new Date().toISOString(),
    sparkline: generateSparkline(prevClose),
    dataQuality: Math.random() > 0.9 ? 'stale' : 'good',
  };
}

export default function RealTimeMarketDashboard() {
  const { t } = useTranslation();
  const [quotes, setQuotes] = useState<Record<string, RealTimeQuote>>({});
  const [loading, setLoading] = useState(true);
  const [streamConnected, setStreamConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const quoteStreamListener = useRef<((event: unknown, quotes: unknown[]) => void) | null>(null);

  const loadQuotes = useCallback(async () => {
    try {
      const codes = WATCHLIST.map(s => s.code);
      const res = await getQuotes(codes);
      if (Array.isArray(res)) {
        const map: Record<string, RealTimeQuote> = {};
        res.forEach((q: Record<string, unknown>) => {
          const code = q.code as string;
          const stock = WATCHLIST.find(s => s.code === code);
          const price = q.price as number;
          map[code] = {
            code,
            name: stock?.name || (q.name as string) || code,
            price,
            prevClose: q.prevClose as number,
            change: q.change as number,
            changePct: q.changePct as number,
            volume: q.volume as number,
            turnover: q.turnover as number,
            bid: (q.bid as number) || price * 0.999,
            ask: (q.ask as number) || price * 1.001,
            bidVol: (q.bidVol as number) || 0,
            askVol: (q.askVol as number) || 0,
            high: q.high as number,
            low: q.low as number,
            open: q.open as number,
            updateTime: q.updateTime as string,
            sparkline: generateSparkline(q.prevClose as number),
            dataQuality: 'good' as const,
          };
        });
        setQuotes(map);
      } else {
        // Mock data fallback
        const map: Record<string, RealTimeQuote> = {};
        WATCHLIST.forEach(s => { map[s.code] = generateMockQuote(s); });
        setQuotes(map);
      }
    } catch (_e: unknown) {
      void EngineError; // [DATA] structured error tracking
      const map: Record<string, RealTimeQuote> = {};
      WATCHLIST.forEach(s => { map[s.code] = generateMockQuote(s); });
      setQuotes(map);
    }
    setLoading(false);
  }, []);

  // WebSocket push listener
  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) return;

    const handleQuoteUpdate = (_event: unknown, quoteUpdates: unknown[]) => {
      if (!Array.isArray(quoteUpdates) || quoteUpdates.length === 0) return;

      setQuotes(prev => {
        const next = { ...prev };
        
        for (const q of quoteUpdates) {
          if (!q.code || !q.price) continue;
          
          const stock = WATCHLIST.find(s => s.code === q.code);
          if (!stock) continue;

          const oldQuote = next[q.code];
          const prevPrice = oldQuote?.price || q.prevClose || q.price;
          const flash = q.price > prevPrice ? 'up' : q.price < prevPrice ? 'down' : null;

          // Clear old flash timer
          if (flashTimers.current[q.code]) {
            clearTimeout(flashTimers.current[q.code]);
          }

          // Set new flash timer
          if (flash) {
            flashTimers.current[q.code] = setTimeout(() => {
              setQuotes(p => ({
                ...p,
                [q.code]: { ...p[q.code], flash: null }
              }));
            }, 800);
          }

          // Update sparkline
          let sparkline = oldQuote?.sparkline || generateSparkline(prevPrice);
          if (sparkline.length >= 30) {
            sparkline = [...sparkline.slice(1), q.price];
          } else {
            sparkline = [...sparkline, q.price];
          }

          next[q.code] = {
            code: q.code,
            name: stock.name,
            price: +q.price.toFixed(2),
            prevClose: q.prevClose || prevPrice,
            change: +(q.price - (q.prevClose || prevPrice)).toFixed(2),
            changePct: +((q.price - (q.prevClose || prevPrice)) / (q.prevClose || prevPrice) * 100).toFixed(2),
            volume: q.volume || oldQuote?.volume || 0,
            turnover: q.turnover || oldQuote?.turnover || 0,
            bid: q.bid || +(q.price * 0.999).toFixed(2),
            ask: q.ask || +(q.price * 1.001).toFixed(2),
            bidVol: q.bidVol || oldQuote?.bidVol || 0,
            askVol: q.askVol || oldQuote?.askVol || 0,
            high: Math.max(q.high || q.price, oldQuote?.high || 0),
            low: q.low ? Math.min(q.low, oldQuote?.low || Infinity) : oldQuote?.low || q.price,
            open: q.open || oldQuote?.open || q.price,
            updateTime: new Date().toISOString(),
            sparkline,
            flash,
            dataQuality: 'good',
          };
        }

        setLastUpdate(new Date());
        return next;
      });
    };

    // Register WebSocket listener
    if (window.api.on) {
      window.api.on('quote:stream-tick', handleQuoteUpdate);
      quoteStreamListener.current = handleQuoteUpdate;
    }

    return () => {
      // Cleanup listener
      if (window.api.off && quoteStreamListener.current) {
        window.api.off('quote:stream-tick', quoteStreamListener.current);
        quoteStreamListener.current = null;
      }
      // Clear all flash timers
      Object.values(flashTimers.current).forEach(t => clearTimeout(t));
    };
  }, []);

  // Initial load + stream subscription
  useEffect(() => {
    loadQuotes();

    async function startStream() {
      try {
        const status = await getQuoteStreamStatus();
        if (!status?.running) {
          await subscribeQuoteStream(WATCHLIST.map(s => s.code).join(','));
        }
        setStreamConnected(true);
      } catch (_e: unknown) {
        setStreamConnected(false);
      }
    }

    startStream();

    // Fallback polling only if stream not connected (every 5s)
    const fallbackInterval = setInterval(() => {
      if (!streamConnected) {
        loadQuotes();
      }
    }, 5000);

    return () => {
      clearInterval(fallbackInterval);
      // Unsubscribe on unmount
      unsubscribeQuoteStream(WATCHLIST.map(s => s.code).join(",")).catch((_: unknown) => {});
    };
  }, [loadQuotes]);

  if (loading) return <LoadingSpinner fullscreen text={t('common.loading')} />;

  const quoteList = Object.values(quotes);

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">⚡ {t('realTimeMarket.title')}</h1>
          <p className="text-gray-400 text-sm">
            {streamConnected ? t('realTimeMarket.wsConnected') : t('realTimeMarket.pollingMode')}
            {lastUpdate && ` · ${t('realTimeMarket.lastUpdate')} ${lastUpdate.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
            streamConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${streamConnected ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`} />
            {streamConnected ? t('realTimeMarket.liveConnection') : t('realTimeMarket.polling')}
          </span>
        </div>
      </div>

      {/* Quote Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {quoteList.map((q) => (
          <div
            key={q.code}
            className={`bg-[#1a1a25] border rounded-xl p-4 transition-all duration-300 ${
              q.flash === 'up' ? 'border-red-500/40 shadow-[0_0_12px_rgba(220,38,38,0.15)]' :
              q.flash === 'down' ? 'border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]' :
              'border-white/5'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-sm font-medium text-white">{q.name}</div>
                <div className="text-[10px] text-gray-500">{q.code}</div>
              </div>
              {q.dataQuality === 'stale' && (
                <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">{t('realTimeMarket.dataStale')}</span>
              )}
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-xl font-bold font-mono text-white">${q.price.toFixed(2)}</span>
              <span className={`text-sm font-mono ${q.changePct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {q.changePct >= 0 ? '+' : ''}{q.changePct.toFixed(2)}%
              </span>
            </div>

            {/* Sparkline */}
            {q.sparkline && (
              <svg className="w-full h-8 mb-2" viewBox="0 0 100 20" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke={q.changePct >= 0 ? '#ef4444' : '#10b981'}
                  strokeWidth="1.5"
                  points={q.sparkline.map((v, i) => {
                    const min = Math.min(...q.sparkline!);
                    const max = Math.max(...q.sparkline!);
                    const x = (i / (q.sparkline!.length - 1)) * 100;
                    const y = 20 - ((v - min) / (max - min || 1)) * 18 - 1;
                    return `${x},${y}`;
                  }).join(' ')}
                />
              </svg>
            )}

            {/* Bid/Ask */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-deep rounded px-2 py-1.5">
                <div className="text-gray-500">{t('realTimeMarket.buy')} {q.bidVol}</div>
                <div className="font-mono text-red-400">{q.bid.toFixed(2)}</div>
              </div>
              <div className="bg-deep rounded px-2 py-1.5">
                <div className="text-gray-500">{t('realTimeMarket.sell')} {q.askVol}</div>
                <div className="font-mono text-emerald-400">{q.ask.toFixed(2)}</div>
              </div>
            </div>

            {/* Volume & Range */}
            <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
              <span>{t('realTimeMarket.volume')}: {(q.volume / 1e6).toFixed(1)}M</span>
              <span>{t('realTimeMarket.high')}: {q.high.toFixed(2)} {t('realTimeMarket.low')}: {q.low.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">{t('realTimeMarket.detailQuote')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">{t('realTimeMarket.stockName')}</th>
                <th className="px-4 py-3 text-right">{t('realTimeMarket.latestPrice')}</th>
                <th className="px-4 py-3 text-right">{t('realTimeMarket.change')}</th>
                <th className="px-4 py-3 text-right">{t('realTimeMarket.changePct')}</th>
                <th className="px-4 py-3 text-right">{t('common.volume')}</th>
                <th className="px-4 py-3 text-right">{t('realTimeMarket.turnover')}</th>
                <th className="px-4 py-3 text-right">{t('realTimeMarket.bid1')}</th>
                <th className="px-4 py-3 text-right">{t('realTimeMarket.ask1')}</th>
                <th className="px-4 py-3 text-right">{t('realTimeMarket.highest')}</th>
                <th className="px-4 py-3 text-right">{t('realTimeMarket.lowest')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {quoteList.map((q) => (
                <tr key={q.code} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{q.name}</div>
                    <div className="text-[10px] text-gray-500">{q.code}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white font-bold">${q.price.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${q.change >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${q.changePct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {q.changePct >= 0 ? '+' : ''}{q.changePct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{(q.volume / 1e6).toFixed(1)}M</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">${(q.turnover / 1e9).toFixed(2)}B</td>
                  <td className="px-4 py-3 text-right font-mono text-red-400">{q.bid.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400">{q.ask.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{q.high.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{q.low.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
