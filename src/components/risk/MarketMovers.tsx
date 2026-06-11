// ── DAWN WHALES — MarketMovers (市场异动) ──────────────────────────────────

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

interface MoverItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
}

interface MarketMoversProps {
  gainers?: MoverItem[];
  losers?: MoverItem[];
  title?: string;
}

const DEFAULT_GAINERS: MoverItem[] = [
  { symbol: 'MSTR', name: 'MicroStrategy', price: 185.42, change: 24.56, changePct: 15.26, volume: 28.5e6 },
  { symbol: 'SOXL', name: i18n.t('MarketMovers.k1'), price: 42.18, change: 4.32, changePct: 11.41, volume: 45.2e6 },
  { symbol: 'TQQQ', name: i18n.t('MarketMovers.k2'), price: 78.95, change: 6.78, changePct: 9.40, volume: 62.1e6 },
  { symbol: 'COIN', name: 'Coinbase', price: 245.80, change: 18.90, changePct: 8.33, volume: 15.8e6 },
  { symbol: 'NVDA', name: i18n.t('MarketMovers.k3'), price: 148.20, change: 9.85, changePct: 7.12, volume: 85.4e6 },
];

const DEFAULT_LOSERS: MoverItem[] = [
  { symbol: 'SQQQ', name: i18n.t('MarketMovers.k4'), price: 12.45, change: -1.28, changePct: -9.32, volume: 55.3e6 },
  { symbol: 'SOXS', name: i18n.t('MarketMovers.k5'), price: 18.92, change: -1.85, changePct: -8.91, volume: 32.1e6 },
  { symbol: 'TLT', name: i18n.t('MarketMovers.k6'), price: 88.45, change: -2.15, changePct: -2.37, volume: 22.7e6 },
  { symbol: 'GLD', name: i18n.t('MarketMovers.k7'), price: 228.60, change: -3.40, changePct: -1.46, volume: 8.5e6 },
  { symbol: 'XLE', name: i18n.t('MarketMovers.k8'), price: 92.15, change: -1.05, changePct: -1.13, volume: 12.3e6 },
];

export default function MarketMovers({
  gainers = DEFAULT_GAINERS,
  losers = DEFAULT_LOSERS,
  title = i18n.t('MarketMovers.k9'),
}: MarketMoversProps) {
  const { t } = useTranslation();

  const [tab, setTab] = useState<'gainers' | 'losers' | 'volume'>('gainers');

  const volumeLeaders = useMemo(() => {
    return [...gainers, ...losers].sort((a, b) => b.volume - a.volume).slice(0, 5);
  }, [gainers, losers]);

  const displayData = tab === 'gainers' ? gainers : tab === 'losers' ? losers : volumeLeaders;

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm">{title}</h2>
        <div className="flex items-center gap-1 bg-[#12121a] rounded-lg p-0.5">
          {([
            { key: 'gainers' as const, label: i18n.t('MarketMovers.k10'), color: 'text-emerald-400' },
            { key: 'losers' as const, label: i18n.t('MarketMovers.k11'), color: 'text-red-400' },
            { key: 'volume' as const, label: t('components.volume'), color: 'text-[#D4A853]' },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                tab === t.key ? 'bg-[#22222f] text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {displayData.map((item, i) => {
          const isGainer = item.changePct >= 0;
          return (
            <div
              key={item.symbol}
              className="flex items-center justify-between bg-[#12121a] rounded-lg px-3 py-2 border border-white/5"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-gray-600 text-[10px] w-4">{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-white text-xs font-medium">{item.symbol}</div>
                  <div className="text-gray-500 text-[10px] truncate">{item.name}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-gray-300 text-xs font-mono">${item.price.toFixed(2)}</div>
                <div className={`text-[10px] font-mono ${isGainer ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isGainer ? '+' : ''}{item.changePct.toFixed(2)}%
                </div>
              </div>
              {tab === 'volume' && (
                <div className="text-right flex-shrink-0 ml-3">
                  <div className="text-gray-500 text-[10px]">{(item.volume / 1e6).toFixed(1)}M</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
