// ── DAWN WHALES — WatchlistManager (自选股管理) ────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
import { getWatchlist, saveWatchlist, getQuotes } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface WatchlistItem {
  symbol: string;
  price?: number;
  change?: number;
  changePct?: number;
}

const DEFAULT_WATCHLIST = ['TQQQ', 'SOXL', 'QQQ', 'SPY', 'AAPL', 'NVDA', 'MSFT', 'GOOGL'];

export default function WatchlistManager() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWatchlist();
  }, []);

  async function loadWatchlist() {
    setLoading(true);
    try {
      const codes = await getWatchlist();
      const symbols = codes.length > 0 ? codes : DEFAULT_WATCHLIST;
      const quotes = await getQuotes(symbols.map((s: string) => `US.${s}`));
      const mapped = symbols.map((s: string, i: number) => {
        const q = quotes?.[i];
        return {
          symbol: s,
          price: q?.price || 0,
          change: q?.change || 0,
          changePct: q?.changePct || 0,
        };
      });
      setItems(mapped);
    } catch {
      void EngineError; // [SYSTEM] structured error tracking
      setItems(DEFAULT_WATCHLIST.map((s) => ({ symbol: s })));
    }
    setLoading(false);
  }

  const addItem = useCallback(async () => {
    if (!newSymbol) return;
    const symbol = newSymbol.toUpperCase().trim();
    if (items.some((i) => i.symbol === symbol)) {
      setNewSymbol('');
      return;
    }
    const updated = [...items, { symbol }];
    setItems(updated);
    await saveWatchlist(updated.map((i) => i.symbol));
    setNewSymbol('');
  }, [newSymbol, items]);

  const removeItem = useCallback(async (symbol: string) => {
    const updated = items.filter((i) => i.symbol !== symbol);
    setItems(updated);
    await saveWatchlist(updated.map((i) => i.symbol));
  }, [items]);

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    const updated = [...items];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setItems(updated);
    saveWatchlist(updated.map((i) => i.symbol));
  }, [items]);

  const moveDown = useCallback((index: number) => {
    if (index === items.length - 1) return;
    const updated = [...items];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setItems(updated);
    saveWatchlist(updated.map((i) => i.symbol));
  }, [items]);

  if (loading) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <p className="text-gray-500 text-sm text-center py-4">{i18n.t('WatchlistManager.k0')}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-sm">⭐ 自选股</h2>
          <p className="text-gray-500 text-[10px] mt-0.5">{items.length} 只标的</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder={i18n.t('WatchlistManager.k1')}
            className="w-24 bg-[#12121a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-[#C9A046] focus:outline-none"
          />
          <button
            onClick={addItem}
            disabled={!newSymbol}
            className="px-2 py-1.5 bg-[#C9A046]/10 text-[#D4A853] border border-[#C9A046]/20 rounded-lg text-xs hover:bg-[#C9A046]/20 transition-colors disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
        {items.map((item, index) => {
          const isProfit = (item.changePct || 0) >= 0;
          return (
            <div
              key={item.symbol}
              className="flex items-center justify-between bg-[#12121a] rounded-lg px-3 py-2 border border-white/5"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-white text-xs font-medium">{item.symbol}</span>
                {item.price ? (
                  <span className="text-gray-500 text-[10px] font-mono">${item.price.toFixed(2)}</span>
                ) : null}
                {item.changePct !== undefined ? (
                  <span className={`text-[10px] font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isProfit ? '+' : ''}{item.changePct.toFixed(2)}%
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="text-gray-600 text-[10px] hover:text-gray-300 disabled:opacity-20 px-1"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === items.length - 1}
                  className="text-gray-600 text-[10px] hover:text-gray-300 disabled:opacity-20 px-1"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeItem(item.symbol)}
                  className="text-gray-600 text-[10px] hover:text-red-400 px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
