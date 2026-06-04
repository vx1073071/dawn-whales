import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getQuotes } from '@/lib/bridge-api';

interface OrderBookEntry {
  price: number;
  volume: number;
  total: number;
}

export default function OrderBookPanel({ symbol }: { symbol?: string }) {
  const { t } = useTranslation();
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const [lastPrice, setLastPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    loadOrderBook();
    const interval = setInterval(loadOrderBook, 3000);
    return () => clearInterval(interval);
  }, [symbol]);

  async function loadOrderBook() {
    if (!symbol) return;
    setLoading(true);
    try {
      const quotes = await getQuotes([symbol]);
      if (quotes && quotes.length > 0) {
        const q = quotes[0];
        setLastPrice(q.price || 0);
        // Build synthetic order book from bid/ask
        const bidEntries: OrderBookEntry[] = [];
        const askEntries: OrderBookEntry[] = [];
        if (q.bid && q.bidVol) {
          for (let i = 0; i < 5; i++) {
            const price = q.bid - i * 0.01;
            const vol = Math.floor(q.bidVol * (1 - i * 0.15));
            if (vol > 0) bidEntries.push({ price, volume: vol, total: vol + (bidEntries[i-1]?.total || 0) });
          }
        }
        if (q.ask && q.askVol) {
          for (let i = 0; i < 5; i++) {
            const price = q.ask + i * 0.01;
            const vol = Math.floor(q.askVol * (1 - i * 0.15));
            if (vol > 0) askEntries.push({ price, volume: vol, total: vol + (askEntries[i-1]?.total || 0) });
          }
        }
        setBids(bidEntries);
        setAsks(askEntries.reverse());
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }

  if (!symbol) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 text-center">
        <div className="text-2xl mb-2 opacity-40">📖</div>
        <p className="text-gray-400 text-sm">{t('trading.selectSymbolFirst')}</p>
      </div>
    );
  }

  const maxVol = Math.max(
    ...bids.map(b => b.volume),
    ...asks.map(a => a.volume),
    1
  );

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{t('trading.orderBook')}</h3>
        <span className="text-xs text-gray-500">{symbol}</span>
      </div>

      {loading && bids.length === 0 ? (
        <div className="p-6 text-center text-gray-500 text-sm">{t('common.loading')}</div>
      ) : (
        <div className="p-2">
          {/* Asks (sell) */}
          <div className="space-y-0.5 mb-2">
            {asks.map((a, i) => (
              <div key={`ask-${i}`} className="flex items-center text-xs relative">
                <div
                  className="absolute right-0 top-0 bottom-0 bg-red-500/10 rounded"
                  style={{ width: `${(a.volume / maxVol) * 100}%` }}
                />
                <span className="w-16 text-right text-red-400 relative z-10">{a.price.toFixed(2)}</span>
                <span className="w-16 text-right text-gray-400 relative z-10">{a.volume}</span>
                <span className="w-16 text-right text-gray-500 relative z-10">{a.total}</span>
              </div>
            ))}
          </div>

          {/* Last price */}
          <div className="py-2 text-center border-y border-white/5">
            <span className="text-lg font-bold text-white">{lastPrice.toFixed(2)}</span>
          </div>

          {/* Bids (buy) */}
          <div className="space-y-0.5 mt-2">
            {bids.map((b, i) => (
              <div key={`bid-${i}`} className="flex items-center text-xs relative">
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded"
                  style={{ width: `${(b.volume / maxVol) * 100}%` }}
                />
                <span className="w-16 text-right text-emerald-400 relative z-10">{b.price.toFixed(2)}</span>
                <span className="w-16 text-right text-gray-400 relative z-10">{b.volume}</span>
                <span className="w-16 text-right text-gray-500 relative z-10">{b.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
