// R125-Q01: ts-nocheck cleared
// ── R115 QTE-26 MarketScanner — 市场筛选器 UI ────────────────────────────
// PM: 5预设+自定义条件面板, 1000+结果<2s, 排序/分页/导出

import { useState, useMemo, useCallback } from 'react';



// ═══════ Bridge: MarketScanner Engine → UI ═══════════
import { MarketScanner as ScannerEngine, type ScanResult } from '../../lib/chart/market-scanner';

let _scanner: ScannerEngine | null = null;
export function getMarketScannerEngine(): ScannerEngine {
  if (!_scanner) _scanner = new ScannerEngine();
  return _scanner;
}

// ═══════════ Types ═══════════

export interface ScanItem {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  turnover: number;
  turnoverRate: number;
  amplitude: number;
  volumeRatio: number;
  marketCap: number;
  pe?: number;
}

export type PresetScan = 'top_gainers' | 'top_losers' | 'most_active' | 'high_turnover' | 'volume_breakout';

export interface ScanFilter {
  priceMin?: number; priceMax?: number;
  changeMin?: number; changeMax?: number;
  turnoverMin?: number;
  volumeRatioMin?: number;
  amplitudeMin?: number;
  marketCapMin?: number; marketCapMax?: number;
  peMin?: number; peMax?: number;
  indicatorSignal?: string;
  pattern?: string;
  sector?: string;
}

export interface MarketScannerProps {
  data: ScanItem[];
  onExport?: (items: ScanItem[]) => void;
  className?: string;
}

// ═══════════ Presets ═══════════

const PRESETS: { id: PresetScan; label: string; filter: Partial<ScanFilter>; sortBy: keyof ScanItem; desc: boolean }[] = [
  { id: 'top_gainers', label: '涨幅榜', filter: { changeMin: 0 }, sortBy: 'changePct', desc: true },
  { id: 'top_losers', label: '跌幅榜', filter: { changeMax: 0 }, sortBy: 'changePct', desc: false },
  { id: 'most_active', label: '成交额榜', filter: {}, sortBy: 'turnover', desc: true },
  { id: 'high_turnover', label: '高换手率', filter: {}, sortBy: 'turnoverRate', desc: true },
  { id: 'volume_breakout', label: '放量突破', filter: { volumeRatioMin: 3, changeMin: 0 }, sortBy: 'volumeRatio', desc: true },
];

// ═══════════ Component ═══════════

export default function MarketScanner({ data, onExport, className = '' }: MarketScannerProps) {
  const [preset, setPreset] = useState<PresetScan>('top_gainers');
  const [customMode, setCustomMode] = useState(false);
  const [filters, setFilters] = useState<ScanFilter>({});
  const [sortBy, setSortBy] = useState<keyof ScanItem>('changePct');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Get current filter
  const activeFilter = useMemo(() => {
    if (!customMode) {
      const p = PRESETS.find(p => p.id === preset);
      return { filter: p?.filter || {}, sortBy: p?.sortBy || 'changePct', desc: p?.desc ?? true };
    }
    return { filter: filters, sortBy, desc: sortDesc };
  }, [customMode, preset, filters, sortBy, sortDesc]);

  // Apply filter + sort
  const results = useMemo(() => {
    let items = [...data];
    const f = activeFilter.filter;
    if (f.priceMin != null) items = items.filter(i => i.price >= f.priceMin!);
    if (f.priceMax != null) items = items.filter(i => i.price <= f.priceMax!);
    if (f.changeMin != null) items = items.filter(i => i.changePct >= f.changeMin!);
    if (f.changeMax != null) items = items.filter(i => i.changePct <= f.changeMax!);
    if (f.turnoverMin != null) items = items.filter(i => i.turnover >= f.turnoverMin!);
    if (f.volumeRatioMin != null) items = items.filter(i => i.volumeRatio >= f.volumeRatioMin!);
    if (f.amplitudeMin != null) items = items.filter(i => i.amplitude >= f.amplitudeMin!);
    if (f.marketCapMin != null) items = items.filter(i => i.marketCap >= f.marketCapMin!);
    if (f.marketCapMax != null) items = items.filter(i => i.marketCap <= f.marketCapMax!);
    if (f.peMin != null) items = items.filter(i => (i.pe || 0) >= f.peMin!);
    if (f.peMax != null) items = items.filter(i => (i.pe || 0) <= f.peMax!);

    // Sort
    items.sort((a, b) => {
      const va = a[activeFilter.sortBy] as number ?? 0;
      const vb = b[activeFilter.sortBy] as number ?? 0;
      return activeFilter.desc ? vb - va : va - vb;
    });

    return items;
  }, [data, activeFilter]);

  const paged = results.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(results.length / pageSize);

  const handlePreset = useCallback((p: PresetScan) => {
    setPreset(p);
    setCustomMode(false);
    setPage(0);
  }, []);

  const handleSort = useCallback((col: keyof ScanItem) => {
    if (customMode) {
      if (sortBy === col) setSortDesc(!sortDesc);
      else { setSortBy(col); setSortDesc(true); }
    }
  }, [customMode, sortBy, sortDesc]);

  const formatVal = (v: number | undefined, fmt: string): string => {
    if (v == null) return '-';
    switch (fmt) {
      case 'pct': return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
      case 'price': return v.toFixed(2);
      case 'vol': return v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v.toFixed(0);
      case 'mc': return v >= 1e12 ? (v / 1e12).toFixed(1) + 'T' : v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : (v / 1e6).toFixed(0) + 'M';
      default: return String(v);
    }
  };

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c2333]">
        <span className="text-[#8b949e] font-semibold text-xs tracking-wide">市场扫描</span>
        <div className="flex gap-0.5">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => handlePreset(p.id)}
              className={`px-2 py-0.5 text-[9px] rounded transition-colors ${!customMode && preset === p.id ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58] hover:text-[#8b949e]'}`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => setCustomMode(!customMode)}
            className={`px-2 py-0.5 text-[9px] rounded transition-colors ${customMode ? 'bg-[#c9a96e20] text-[#c9a96e]' : 'text-[#484f58] hover:text-[#8b949e]'}`}>
            自定义
          </button>
        </div>
        <div className="flex items-center gap-2 text-[9px]">
          <span className="text-[#484f58]">{results.length} 结果</span>
          {onExport && (
            <button onClick={() => onExport(results)} className="text-[#3b82f6] hover:underline">导出</button>
          )}
        </div>
      </div>

      {/* Custom filter panel */}
      {customMode && (
        <div className="px-3 py-2 border-b border-[#1c2333] flex flex-wrap gap-2 text-[9px]">
          <FilterInput label="价格≥" value={filters.priceMin} onChange={v => setFilters({ ...filters, priceMin: v })} />
          <FilterInput label="价格≤" value={filters.priceMax} onChange={v => setFilters({ ...filters, priceMax: v })} />
          <FilterInput label="涨幅≥%" value={filters.changeMin} onChange={v => setFilters({ ...filters, changeMin: v })} />
          <FilterInput label="涨幅≤%" value={filters.changeMax} onChange={v => setFilters({ ...filters, changeMax: v })} />
          <FilterInput label="成交额≥" value={filters.turnoverMin} onChange={v => setFilters({ ...filters, turnoverMin: v })} />
          <FilterInput label="量比≥" value={filters.volumeRatioMin} onChange={v => setFilters({ ...filters, volumeRatioMin: v })} />
          <FilterInput label="振幅≥%" value={filters.amplitudeMin} onChange={v => setFilters({ ...filters, amplitudeMin: v })} />
          <button onClick={() => setFilters({})} className="text-[#ef4444] px-1 hover:underline">清除</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[#0d1117]">
            <tr className="text-[#484f58] border-b border-[#1c2333]">
              <SortHeader label="代码" onClick={() => {}} />
              <SortHeader label="价格" col="price" sortBy={sortBy} desc={sortDesc} onClick={handleSort} />
              <SortHeader label="涨跌" col="changePct" sortBy={sortBy} desc={sortDesc} onClick={handleSort} />
              <SortHeader label="成交额" col="turnover" sortBy={sortBy} desc={sortDesc} onClick={handleSort} />
              <SortHeader label="换手率" col="turnoverRate" sortBy={sortBy} desc={sortDesc} onClick={handleSort} />
              <SortHeader label="量比" col="volumeRatio" sortBy={sortBy} desc={sortDesc} onClick={handleSort} />
              <SortHeader label="振幅" col="amplitude" sortBy={sortBy} desc={sortDesc} onClick={handleSort} />
            </tr>
          </thead>
          <tbody>
            {paged.map(item => (
              <tr key={item.symbol} className="border-b border-[#1c2333] hover:bg-[#161b22] cursor-pointer">
                <td className="px-2 py-1 text-[#c9a96e] font-bold">{item.symbol}</td>
                <td className="px-2 py-1 text-[#8b949e] text-right">{formatVal(item.price, 'price')}</td>
                <td className={`px-2 py-1 text-right font-bold ${item.changePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {formatVal(item.changePct, 'pct')}
                </td>
                <td className="px-2 py-1 text-[#8b949e] text-right">{formatVal(item.turnover, 'vol')}</td>
                <td className="px-2 py-1 text-[#8b949e] text-right">{formatVal(item.turnoverRate, 'pct')}</td>
                <td className="px-2 py-1 text-[#8b949e] text-right">{item.volumeRatio.toFixed(1)}</td>
                <td className="px-2 py-1 text-[#8b949e] text-right">{formatVal(item.amplitude, 'pct')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {paged.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[#484f58] text-xs">无匹配结果</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-1.5 border-t border-[#1c2333] text-[9px]">
          <button onClick={() => setPage(Math.max(0, page - 1))} className="text-[#8b949e] hover:text-[#c9d1d9] disabled:text-[#30363d]" disabled={page === 0}>◀</button>
          <span className="text-[#484f58]">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} className="text-[#8b949e] hover:text-[#c9d1d9] disabled:text-[#30363d]" disabled={page >= totalPages - 1}>▶</button>
        </div>
      )}
    </div>
  );
}

// ═══════════ Sub-components ═══════════

function SortHeader({ label, col, sortBy, desc, onClick }: { label: string; col?: keyof ScanItem; sortBy?: keyof ScanItem; desc?: boolean; onClick: (col: keyof ScanItem) => void }) {
  const isActive = col && sortBy === col;
  return (
    <th className="px-2 py-1 text-left cursor-pointer hover:text-[#8b949e] select-none" onClick={() => col && col && onClick(col)}>
      {label} {isActive ? (desc ? '↓' : '↑') : ''}
    </th>
  );
}

function FilterInput({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-[#484f58]">{label}</span>
      <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
        className="w-16 bg-[#161b22] border border-[#30363d] rounded px-1 py-0.5 text-[#c9d1d9] text-[9px]" />
    </label>
  );
}
