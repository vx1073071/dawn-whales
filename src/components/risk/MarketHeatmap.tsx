// ── DAWN WHALES — MarketHeatmap (市场板块热力图) ───────────────────────────
// 板块涨跌全景 — 中国惯例: 红涨绿跌

import { useState, useMemo } from 'react';

interface SectorItem {
  name: string;
  changePct: number;
  marketCap?: number;
  leaders?: string[];
}

interface MarketHeatmapProps {
  data?: SectorItem[];
  title?: string;
  onSectorClick?: (sector: string) => void;
}

const DEFAULT_SECTORS: SectorItem[] = [
  { name: '半导体', changePct: 3.24, marketCap: 2800, leaders: ['中芯国际', '韦尔股份'] },
  { name: '人工智能', changePct: 2.87, marketCap: 3200, leaders: ['科大讯飞', '海康威视'] },
  { name: '新能源', changePct: 1.56, marketCap: 4500, leaders: ['宁德时代', '比亚迪'] },
  { name: '白酒', changePct: 0.98, marketCap: 3800, leaders: ['贵州茅台', '五粮液'] },
  { name: '银行', changePct: 0.45, marketCap: 5200, leaders: ['工商银行', '招商银行'] },
  { name: '券商', changePct: -0.32, marketCap: 1800, leaders: ['中信证券', '东方财富'] },
  { name: '医药', changePct: -0.78, marketCap: 2900, leaders: ['恒瑞医药', '药明康德'] },
  { name: '房地产', changePct: -1.23, marketCap: 1500, leaders: ['万科A', '保利发展'] },
  { name: '煤炭', changePct: -1.56, marketCap: 900, leaders: ['中国神华', '陕西煤业'] },
  { name: '钢铁', changePct: -2.10, marketCap: 600, leaders: ['宝钢股份', '鞍钢股份'] },
  { name: '光伏', changePct: 1.82, marketCap: 2100, leaders: ['隆基绿能', '通威股份'] },
  { name: '汽车', changePct: 0.65, marketCap: 2400, leaders: ['比亚迪', '长城汽车'] },
  { name: '通信', changePct: 2.15, marketCap: 1700, leaders: ['中国移动', '中兴通讯'] },
  { name: '游戏', changePct: -0.95, marketCap: 800, leaders: ['腾讯控股', '网易'] },
  { name: '航运', changePct: 0.32, marketCap: 500, leaders: ['中远海控', '招商轮船'] },
  { name: '黄金', changePct: 1.45, marketCap: 400, leaders: ['山东黄金', '紫金矿业'] },
];

export default function MarketHeatmap({
  data = DEFAULT_SECTORS,
  title = '🗺️ 市场板块热力图',
  onSectorClick,
}: MarketHeatmapProps) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => b.changePct - a.changePct);
  }, [data]);

  const maxChange = Math.max(...data.map((d) => Math.abs(d.changePct)));

  function getColor(change: number): string {
    const intensity = Math.min(Math.abs(change) / Math.max(maxChange * 0.6, 1), 1);
    if (change > 0) {
      // Red for up (China convention)
      return `rgba(239, 68, 68, ${0.15 + intensity * 0.65})`;
    } else {
      // Green for down (China convention)
      return `rgba(34, 197, 94, ${0.15 + intensity * 0.65})`;
    }
  }

  function getTextColor(change: number): string {
    const intensity = Math.min(Math.abs(change) / Math.max(maxChange * 0.6, 1), 1);
    if (change > 0) {
      return intensity > 0.5 ? 'text-red-300' : 'text-red-400';
    } else {
      return intensity > 0.5 ? 'text-emerald-300' : 'text-emerald-400';
    }
  }

  function getBorderColor(change: number): string {
    if (change > 0) return 'border-red-500/20';
    return 'border-emerald-500/20';
  }

  const upCount = data.filter((d) => d.changePct > 0).length;
  const downCount = data.filter((d) => d.changePct < 0).length;
  const flatCount = data.length - upCount - downCount;

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-sm">{title}</h2>
          <p className="text-gray-500 text-[10px] mt-0.5">
            涨 {upCount} · 跌 {downCount} · 平 {flatCount}
            <span className="ml-2 text-gray-600">(中国惯例: 红涨绿跌)</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500/60" />涨</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500/60" />跌</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {sorted.map((sector) => {
          const isSelected = selectedSector === sector.name;
          return (
            <button
              key={sector.name}
              onClick={() => {
                setSelectedSector(isSelected ? null : sector.name);
                onSectorClick?.(sector.name);
              }}
              className={`relative rounded-lg p-3 text-left border transition-all hover:scale-[1.02] ${
                isSelected ? 'ring-1 ring-[#C9A046]' : ''
              } ${getBorderColor(sector.changePct)}`}
              style={{ backgroundColor: getColor(sector.changePct) }}
            >
              <div className="flex items-center justify-between">
                <span className="text-white text-xs font-medium truncate">{sector.name}</span>
                <span className={`text-xs font-mono font-bold ${getTextColor(sector.changePct)}`}>
                  {sector.changePct >= 0 ? '+' : ''}{sector.changePct.toFixed(2)}%
                </span>
              </div>
              {sector.marketCap && (
                <div className="text-[10px] text-gray-400 mt-1">
                  市值 {(sector.marketCap / 100).toFixed(0)}亿
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected sector detail */}
      {selectedSector && (
        <div className="mt-4 bg-[#12121a] rounded-lg p-4 border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-medium">{selectedSector}</span>
            <button onClick={() => setSelectedSector(null)} className="text-gray-500 text-xs hover:text-gray-300">✕</button>
          </div>
          {(() => {
            const sector = data.find((d) => d.name === selectedSector);
            if (!sector || !sector.leaders) return null;
            return (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 text-[10px]">龙头股:</span>
                {sector.leaders.map((l) => (
                  <span key={l} className="text-[10px] bg-[#1a1a25] text-gray-300 px-2 py-0.5 rounded">{l}</span>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
