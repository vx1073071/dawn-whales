// ── DAWN WHALES — MarketBreadth (metric) ─────────────────────────────

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

interface MarketBreadthData {
  advancing: number;
  declining: number;
  unchanged: number;
  newHighs: number;
  newLows: number;
  upVolume: number;
  downVolume: number;
}

interface MarketBreadthProps {
  data?: MarketBreadthData;
  title?: string;
}

const DEFAULT_DATA: MarketBreadthData = {
  advancing: 2845,
  declining: 1923,
  unchanged: 142,
  newHighs: 87,
  newLows: 34,
  upVolume: 4.2e9,
  downVolume: 3.1e9,
};

export default function MarketBreadth({
  data = DEFAULT_DATA,
  title = i18n.t('MarketBreadth.k1'),
}: MarketBreadthProps) {
  const { t: _t } = useTranslation();

  const total = data.advancing + data.declining + data.unchanged;
  const advanceDeclineRatio = data.declining > 0 ? data.advancing / data.declining : 0;
  const volumeRatio = data.downVolume > 0 ? data.upVolume / data.downVolume : 0;
  const breadth = total > 0 ? (data.advancing / total) * 100 : 0;

  const sentiment = useMemo(() => {
    if (breadth >= 60 && advanceDeclineRatio >= 1.5) return { label: i18n.t('MarketBreadth.k2'), color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (breadth >= 55) return { label: i18n.t('MarketBreadth.k3'), color: 'text-emerald-300', bg: 'bg-emerald-500/5' };
    if (breadth <= 40 && advanceDeclineRatio <= 0.7) return { label: i18n.t('MarketBreadth.k4'), color: 'text-red-400', bg: 'bg-red-500/10' };
    if (breadth <= 45) return { label: i18n.t('MarketBreadth.k5'), color: 'text-red-300', bg: 'bg-red-500/5' };
    return { label: i18n.t('MarketBreadth.k6'), color: 'text-[#D4A853]', bg: 'bg-[#D4A853]/10' };
  }, [breadth, advanceDeclineRatio]);

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm">{title}</h2>
        <span className={`text-xs font-medium px-2 py-1 rounded ${sentiment.bg} ${sentiment.color}`}>
          {sentiment.label}
        </span>
      </div>

      {/* A/D Ratio */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-gray-500">{i18n.t('MarketBreadth.k0')}{advanceDeclineRatio.toFixed(2)}</span>
          <span className="text-gray-500">{breadth.toFixed(1)}% 上涨</span>
        </div>
        <div className="w-full h-3 bg-[#12121a] rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500/60"
            style={{ width: `${total > 0 ? (data.advancing / total) * 100 : 0}%` }}
          />
          <div
            className="h-full bg-gray-500/30"
            style={{ width: `${total > 0 ? (data.unchanged / total) * 100 : 0}%` }}
          />
          <div
            className="h-full bg-red-500/60"
            style={{ width: `${total > 0 ? (data.declining / total) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] mt-1">
          <span className="text-emerald-400">涨 {data.advancing}</span>
          <span className="text-gray-500">平 {data.unchanged}</span>
          <span className="text-red-400">跌 {data.declining}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-[#12121a] rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">{i18n.t('MarketBreadth.k0')}</div>
          <div className="text-emerald-400 text-sm font-mono font-bold">{data.newHighs}</div>
        </div>
        <div className="bg-[#12121a] rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">{i18n.t('MarketBreadth.k1')}</div>
          <div className="text-red-400 text-sm font-mono font-bold">{data.newLows}</div>
        </div>
        <div className="bg-[#12121a] rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">{i18n.t('MarketBreadth.k2')}</div>
          <div className="text-emerald-400 text-sm font-mono font-bold">{(data.upVolume / 1e9).toFixed(1)}B</div>
        </div>
        <div className="bg-[#12121a] rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">{i18n.t('MarketBreadth.k3')}</div>
          <div className="text-red-400 text-sm font-mono font-bold">{(data.downVolume / 1e9).toFixed(1)}B</div>
        </div>
      </div>

      {/* Volume Ratio */}
      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">{i18n.t('MarketBreadth.k4')}</span>
          <span className={volumeRatio >= 1 ? 'text-emerald-400' : 'text-red-400'}>
            {volumeRatio >= 1 ? i18n.t('MarketBreadth.k7') : i18n.t('MarketBreadth.k8')}
          </span>
        </div>
      </div>
    </div>
  );
}
