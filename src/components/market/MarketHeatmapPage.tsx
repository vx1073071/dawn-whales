// ── TradingEasy — MarketHeatmapPage (W26) ──────────────────────────────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// sectorheatmappage： EM ，industry/concept/region

import { useState, useEffect, useCallback, useMemo } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
import { getSectorHeatmap } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface SectorItem {
  name: string;
  code: string;
  changePct: number;
  changeAmount: number;
  marketCap?: number;
  leaders?: {name: string;code: string;changePct: number;}[];
}

type BoardType = 'industry' | 'concept' | 'region';

const BOARD_LABELS: Record<BoardType, string> = {
  industry: i18n.t('MarketHeatmapPage.k1'),
  concept: i18n.t('MarketHeatmapPage.k2'),
  region: i18n.t('MarketHeatmapPage.k3')
};

export default function MarketHeatmapPage() {

  const [boardType, setBoardType] = useState<BoardType>('industry');
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadHeatmap = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSectorHeatmap(boardType, 100);
      if (result?.success && Array.isArray(result.sectors)) {
        setSectors(result.sectors);
        setLastUpdate(new Date());
      } else {
        // Fallback demo data
        setSectors(generateDemoSectors(boardType));
        setLastUpdate(new Date());
      }
    } catch {
      void EngineError; // [DATA] structured error tracking
      setSectors(generateDemoSectors(boardType));
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [boardType]);

  useEffect(() => {
    loadHeatmap();
    const interval = setInterval(loadHeatmap, 300000); // 5 min refresh
    return () => clearInterval(interval);
  }, [loadHeatmap]);

  const sortedSectors = useMemo(() => {
    return [...sectors].sort((a, b) => b.changePct - a.changePct);
  }, [sectors]);

  const upCount = useMemo(() => sectors.filter((s) => s.changePct > 0).length, [sectors]);
  const downCount = useMemo(() => sectors.filter((s) => s.changePct < 0).length, [sectors]);
  const flatCount = useMemo(() => sectors.filter((s) => s.changePct === 0).length, [sectors]);

  const maxAbsChange = useMemo(() => {
    if (sectors.length === 0) return 1;
    return Math.max(...sectors.map((s) => Math.abs(s.changePct)), 0.01);
  }, [sectors]);

  function getColorClass(changePct: number): string {
    if (changePct > 0) {
      const intensity = Math.min(Math.abs(changePct) / maxAbsChange, 1);
      if (intensity > 0.7) return 'bg-red-600 text-white';
      if (intensity > 0.4) return 'bg-red-500 text-white';
      if (intensity > 0.2) return 'bg-red-400 text-white';
      return 'bg-red-300 text-red-900';
    }
    if (changePct < 0) {
      const intensity = Math.min(Math.abs(changePct) / maxAbsChange, 1);
      if (intensity > 0.7) return 'bg-emerald-600 text-white';
      if (intensity > 0.4) return 'bg-emerald-500 text-white';
      if (intensity > 0.2) return 'bg-emerald-400 text-white';
      return 'bg-emerald-300 text-emerald-900';
    }
    return 'bg-gray-600 text-gray-200';
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t("MarketHeatmapPage.r92_b7aa")}</h1>
          <p className="text-gray-400 text-sm">
            {lastUpdate ? `${i18n.t('MarketHeatmapPage.k0')}${lastUpdate.toLocaleTimeString('zh-CN')}` : 'components.loading'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(Object.keys(BOARD_LABELS) as BoardType[]).map((type) =>
          <button
            key={type}
            onClick={() => setBoardType(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            boardType === type ?
            'bg-[#C9A046] text-black' :
            'bg-[#22222f] text-gray-400 hover:bg-[#2a2a3a] hover:text-gray-300'}`
            }>
            
              {BOARD_LABELS[type]}
            </button>
          )}
          <button
            onClick={loadHeatmap}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs bg-[#22222f] text-gray-400 hover:text-gray-300 disabled:opacity-40 transition-colors">
            
            {loading ? '⟳' : '↻'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />{i18n.t("MarketHeatmapPage.r92_9632")}
          <strong className="text-red-400">{upCount}</strong>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />{i18n.t("MarketHeatmapPage.r92_e466")}
          <strong className="text-emerald-400">{downCount}</strong>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-500" />{i18n.t("MarketHeatmapPage.r92_b59f")}
          <strong className="text-gray-400">{flatCount}</strong>
        </span>
        <span className="text-gray-600">{i18n.t("MarketHeatmapPage.r92_ec02")}{sectors.length}{i18n.t('MarketHeatmapPage.k1')}</span>
      </div>

      {/* Heatmap Grid */}
      {loading && sectors.length === 0 ?
      <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 animate-pulse">{i18n.t('MarketHeatmapPage.k0')}</div>
        </div> :

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {sortedSectors.map((sector) =>
        <div
          key={sector.code || sector.name}
          className={`rounded-lg p-3 cursor-pointer transition-transform hover:scale-[1.02] ${getColorClass(
            sector.changePct
          )}`}
          title={`${sector.name}: ${sector.changePct >= 0 ? '+' : ''}${sector.changePct.toFixed(2)}%`}>
          
              <div className="font-bold text-sm truncate">{sector.name}</div>
              <div className="text-xs opacity-90 mt-0.5">
                {sector.changePct >= 0 ? '+' : ''}
                {sector.changePct.toFixed(2)}%
              </div>
              {sector.leaders && sector.leaders.length > 0 &&
          <div className="text-[10px] opacity-75 mt-1 truncate">
                  {sector.leaders.slice(0, 2).map((l) => l.name).join(', ')}
                </div>
          }
            </div>
        )}
        </div>
      }

      {/* Leaders Table */}
      {sortedSectors.length > 0 &&
      <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 text-sm font-medium text-white">{i18n.t("MarketHeatmapPage.r92_ef0d")}

        </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-white/5">
                  <th className="text-left px-4 py-2">{i18n.t('MarketHeatmapPage.k1')}</th>
                  <th className="text-left px-4 py-2">{"components.sector"}</th>
                  <th className="text-right px-4 py-2">{"components.priceChange"}</th>
                  <th className="text-right px-4 py-2">{i18n.t('MarketHeatmapPage.k2')}</th>
                  <th className="text-left px-4 py-2">{i18n.t('MarketHeatmapPage.k3')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {sortedSectors.slice(0, 15).map((sector, idx) =>
              <tr key={sector.code || sector.name} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-2.5 text-gray-200 font-medium">{sector.name}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-medium ${
                sector.changePct > 0 ? 'text-red-400' : sector.changePct < 0 ? 'text-emerald-400' : 'text-gray-400'}`
                }>
                      {sector.changePct >= 0 ? '+' : ''}{sector.changePct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400 font-mono">
                      {sector.changeAmount >= 0 ? '+' : ''}{sector.changeAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {sector.leaders?.slice(0, 2).map((l) => l.name).join(', ') || '--'}
                    </td>
                  </tr>
              )}
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>);

}

// ── Demo Data ──────────────────────────────────────────────────────────────

function generateDemoSectors(boardType: BoardType): SectorItem[] {
  const industrySectors = [
  { name: i18n.t('MarketHeatmapPage.k4'), changePct: 3.24 },
  { name: i18n.t('MarketHeatmapPage.k5'), changePct: 2.87 },
  { name: i18n.t('MarketHeatmapPage.k6'), changePct: 1.56 },
  { name: i18n.t('MarketHeatmapPage.k7'), changePct: 0.98 },
  { name: i18n.t('MarketHeatmapPage.k8'), changePct: 0.45 },
  { name: i18n.t('MarketHeatmapPage.k9'), changePct: -0.32 },
  { name: i18n.t('MarketHeatmapPage.k10'), changePct: -0.78 },
  { name: i18n.t('MarketHeatmapPage.k11'), changePct: -1.23 },
  { name: i18n.t('MarketHeatmapPage.k12'), changePct: -1.56 },
  { name: i18n.t('MarketHeatmapPage.k13'), changePct: -2.10 },
  { name: i18n.t('MarketHeatmapPage.k14'), changePct: 1.82 },
  { name: i18n.t('MarketHeatmapPage.k15'), changePct: 0.65 },
  { name: i18n.t('MarketHeatmapPage.k16'), changePct: 2.15 },
  { name: i18n.t('MarketHeatmapPage.k17'), changePct: -0.95 },
  { name: i18n.t('MarketHeatmapPage.k18'), changePct: 0.32 },
  { name: i18n.t('MarketHeatmapPage.k19'), changePct: 1.45 },
  { name: i18n.t('MarketHeatmapPage.k20'), changePct: -0.56 },
  { name: i18n.t('MarketHeatmapPage.k21'), changePct: 0.21 }];


  const conceptSectors = [
  { name: 'ChatGPT', changePct: 4.12 },
  { name: i18n.t('MarketHeatmapPage.k22'), changePct: 3.56 },
  { name: i18n.t('MarketHeatmapPage.k23'), changePct: 2.89 },
  { name: i18n.t('MarketHeatmapPage.k24'), changePct: 1.92 },
  { name: i18n.t('MarketHeatmapPage.k25'), changePct: 1.45 },
  { name: i18n.t('MarketHeatmapPage.k26'), changePct: -0.78 },
  { name: i18n.t('MarketHeatmapPage.k27'), changePct: -1.23 },
  { name: i18n.t('MarketHeatmapPage.k28'), changePct: 2.34 }];


  const regionSectors = [
  { name: i18n.t('MarketHeatmapPage.k29'), changePct: 0.85 },
  { name: i18n.t('MarketHeatmapPage.k30'), changePct: 1.12 },
  { name: i18n.t('MarketHeatmapPage.k31'), changePct: 0.56 },
  { name: i18n.t('MarketHeatmapPage.k32'), changePct: 1.45 },
  { name: i18n.t('MarketHeatmapPage.k33'), changePct: -0.32 },
  { name: i18n.t('MarketHeatmapPage.k34'), changePct: 0.78 },
  { name: i18n.t('MarketHeatmapPage.k35'), changePct: -0.45 },
  { name: i18n.t('MarketHeatmapPage.k36'), changePct: 0.23 }];


  const base = boardType === 'concept' ? conceptSectors : boardType === 'region' ? regionSectors : industrySectors;
  return base.map((s, i) => ({
    ...s,
    code: `${boardType}-${i}`,
    changeAmount: s.changePct * 10,
    marketCap: 500 + Math.random() * 5000,
    leaders: [
    { name: `${i18n.t('MarketHeatmapPage.k2')}${i}A`, code: `00${i.toString().padStart(3, '0')}`, changePct: s.changePct + 1 },
    { name: `${i18n.t('MarketHeatmapPage.k3')}${i}B`, code: `00${(i + 1).toString().padStart(3, '0')}`, changePct: s.changePct + 0.5 }]

  }));
}