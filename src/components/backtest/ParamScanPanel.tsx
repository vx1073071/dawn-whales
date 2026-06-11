// ── DAWN WHALES — Parameter Scan Panel (Sprint 2 UI) ───────────────────────
// Heatmap grid + robust region detection + Top 10 combos

import { useState, useEffect } from 'react';
import i18n from '../../i18n';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

interface ParamSweepConfig {
  klines: any[];
  baseConfig: any;
  paramRanges: Record<string, {min: number;max: number;step: number;}>;
}

interface ParamResult {
  params: Record<string, number>;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

interface HeatmapCell {
  x: number;
  y: number;
  value: number;
  params: Record<string, number>;
  isRobust: boolean;
}

interface ParamScanPanelProps {
  result?: {
    success: boolean;
    results?: ParamResult[];
    config?: ParamSweepConfig;
  } | null;
  loading?: boolean;
}

export default function ParamScanPanel({ result, loading }: ParamScanPanelProps) {
  const [results, setResults] = useState<ParamResult[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [showRobustOnly, setShowRobustOnly] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const config = result?.config;
  const paramKeys = config ? Object.keys(config.paramRanges) : [];
  const paramX = paramKeys[0] || 'param1';
  const paramY = paramKeys[1] || 'param2';

  useEffect(() => {
    if (result?.success && result.results) {
      setResults(result.results);
      buildHeatmap(result.results);
    }
  }, [result]);

  function buildHeatmap(data: ParamResult[]) {
    const cells: HeatmapCell[] = [];
    const sharpeValues = data.map((d) => d.sharpeRatio);
    const avgSharpe = sharpeValues.length ? sharpeValues.reduce((s, v) => s + v, 0) / sharpeValues.length : 0;

    for (const d of data) {
      const x = d.params[paramX] ?? 0;
      const y = d.params[paramY] ?? 0;
      const sorted = [...data].sort((a, b) => b.sharpeRatio - a.sharpeRatio);
      const top20Idx = Math.floor(data.length * 0.2);
      const isTop20 = sorted.slice(0, top20Idx).some((r) => r === d);
      const isRobust = d.sharpeRatio > avgSharpe && isTop20;
      cells.push({ x, y, value: d.sharpeRatio, params: d.params, isRobust });
    }
    setHeatmap(cells);
  }

  const displayResults = result?.success ? results : [];
  const maxSharpe = Math.max(...displayResults.map((r) => r.sharpeRatio), 0.1);
  const minSharpe = Math.min(...displayResults.map((r) => r.sharpeRatio), 0);
  const range = maxSharpe - minSharpe || 1;

  const xVals = [...new Set(heatmap.map((c) => c.x))].sort((a, b) => a - b);
  const yVals = [...new Set(heatmap.map((c) => c.y))].sort((a, b) => a - b);

  const top10 = [...displayResults].
  sort((a, b) => b.sharpeRatio - a.sharpeRatio).
  slice(0, 10);

  function getColor(value: number): string {
    const ratio = (value - minSharpe) / range;
    return ratio > 0.66 ? `rgb(${Math.round(34)},${Math.round(197)},${Math.round(94)})` :
    ratio > 0.33 ? `rgb(${Math.round(201)},${Math.round(160)},${Math.round(70)})` :
    `rgb(${Math.round(239)},${Math.round(68)},${Math.round(68)})`;
  }

  if (!result) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm">{i18n.t("ParamScanPanel.r92_4024")}</h3>
        </div>
        <div className="text-center py-8 text-gray-500 text-sm">{i18n.t("ParamScanPanel.r92_8647")}

        </div>
      </div>);

  }

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">{i18n.t("ParamScanPanel.r92_0de1")}</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={showRobustOnly}
              onChange={(e) => setShowRobustOnly(e.target.checked)}
              className="rounded" />{i18n.t("ParamScanPanel.r92_73e3")}


          </label>
        </div>
      </div>

      {loading ?
      <div className="text-center py-8 text-gray-500 text-sm">{i18n.t('ParamScanPanel.k0')}</div> :

      <>
          {/* Heatmap */}
          {xVals.length > 0 &&
        <div className="mb-4 overflow-x-auto">
              <div className="text-[10px] text-gray-500 mb-1">{paramY} →</div>
              <div className="flex">
                <div className="flex flex-col justify-around text-[10px] text-gray-500 pr-2">
                  {yVals.map((y, i) =>
              <span key={i}>{y}</span>
              )}
                </div>
                <div
              className="grid gap-0.5"
              style={{ gridTemplateColumns: `repeat(${xVals.length}, 28px)` }}>
              
                  {yVals.slice().reverse().map((y) =>
              xVals.map((x) => {
                const cell = heatmap.find((c) => c.x === x && c.y === y);
                if (!cell) return <div key={`${x}-${y}`} className="w-7 h-7 bg-[#12121a] rounded" />;
                if (showRobustOnly && !cell.isRobust) return <div key={`${x}-${y}`} className="w-7 h-7 bg-[#12121a] rounded opacity-20" />;
                return (
                  <div
                    key={`${x}-${y}`}
                    className="w-7 h-7 rounded relative cursor-pointer transition-transform hover:scale-110"
                    style={{ backgroundColor: getColor(cell.value) }}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}>
                    
                          {cell.isRobust &&
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#D4A853] rounded-full ring-1 ring-black/30" />
                    }
                        </div>);

              })
              )}
                </div>
              </div>
              <div className="text-[10px] text-gray-500 mt-1 ml-6 flex" style={{ width: xVals.length * 28 }}>
                {xVals.map((x, i) =>
            <span key={i} className="w-7 text-center">{x}</span>
            )}
                <span className="ml-1">{paramX} →</span>
              </div>
            </div>
        }

          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
              <span className="text-gray-400">{i18n.t('ParamScanPanel.k1')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#C9A046' }} />
              <span className="text-gray-400">{i18n.t('ParamScanPanel.k2')}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-gray-400">{i18n.t('ParamScanPanel.k3')}</span>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <div className="w-2 h-2 rounded-full bg-[#D4A853] ring-1 ring-black/30" />
              <span className="text-gray-400">{i18n.t('ParamScanPanel.k4')}</span>
            </div>
          </div>

          {/* Hover tooltip */}
          {hoveredCell &&
        <div className="bg-[#12121a] border border-white/10 rounded-lg p-3 mb-4 text-xs">
              <div className="text-gray-400 mb-1">{i18n.t('ParamScanPanel.k5')}</div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(hoveredCell.params).map(([k, v]) =>
            <div key={k} className="text-gray-200"><span className="text-gray-500">{k}:</span> {v}</div>
            )}
              </div>
              <div className="mt-2 text-[#D4A853]">{i18n.t("ParamScanPanel.r92_c3ef")}
            {hoveredCell.value.toFixed(2)}{hoveredCell.isRobust ? i18n.t('ParamScanPanel.k1') : ''}
              </div>
            </div>
        }

          {/* Top 10 */}
          {top10.length > 0 &&
        <div>
              <div className="text-gray-400 text-[11px] font-medium mb-2">{i18n.t("ParamScanPanel.r92_8941")}</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {top10.map((r, i) =>
            <div key={i} className="flex items-center gap-2 bg-[#12121a] rounded-lg px-3 py-2 text-xs">
                    <span className={`font-mono font-bold ${i < 3 ? 'text-[#D4A853]' : 'text-gray-500'}`}>
                      #{i + 1}
                    </span>
                    <div className="flex-1 flex gap-2">
                      {Object.entries(r.params).map(([k, v]) =>
                <span key={k} className="text-gray-300">{k}={v}</span>
                )}
                    </div>
                    <span className={`font-mono ${r.sharpeRatio > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{i18n.t("ParamScanPanel.r92_83d0")}
                {r.sharpeRatio.toFixed(2)}
                    </span>
                    <span className="text-gray-500">{i18n.t('ParamScanPanel.k0')}{r.totalReturn.toFixed(1)}%</span>
                  </div>
            )}
              </div>
            </div>
        }
        </>
      }
    </div>);

}