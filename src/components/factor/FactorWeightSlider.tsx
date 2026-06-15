// ── R187 ML P3-01: FactorWeightSlider — 因子权重拖拽+自动归一化 ──────
// Interactive weight allocator for multi-factor strategies.
// Users drag sliders to set factor weights. System auto-normalizes to 100%.
// Visual: horizontal bar chart with drag handles, color-coded by factor.
//
// Features:
// - Drag-to-adjust weight sliders with live normalization
// - Lock individual weights (keep fixed during normalization)
// - Preset weight distributions (equal, momentum-heavy, value-heavy, quality-heavy)
// - Responsive: works on touch and mouse
// - Shows effective weight after normalization
// - Dark theme with golden accent

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WeightItem {
  id: string;
  name: string;
  weight: number;       // 0-100
  locked: boolean;
  color: string;
  category?: string;
}

interface FactorWeightSliderProps {
  items: WeightItem[];
  onChange: (items: WeightItem[]) => void;
  /** Maximum total weight (default 100) */
  maxTotal?: number;
  /** Show preset distribution buttons */
  showPresets?: boolean;
  /** Show weight distribution bar */
  showDistribution?: boolean;
  /** Additional class */
  className?: string;
}

// ── Presets ──────────────────────────────────────────────────────────────────

const WEIGHT_PRESETS = [
  { label: '⚖️ 等权', key: 'equal', description: '所有因子等权重' },
  { label: '📈 动量优先', key: 'momentum', description: '动量因子权重最高' },
  { label: '💰 价值优先', key: 'value', description: '价值因子权重最高' },
  { label: '💎 品质优先', key: 'quality', description: '品质因子权重最高' },
];

// ── Normalize weights ────────────────────────────────────────────────────────

function normalizeWeights(items: WeightItem[], maxTotal: number = 100): WeightItem[] {
  const locked = items.filter(i => i.locked);
  const unlocked = items.filter(i => !i.locked);

  const lockedTotal = locked.reduce((sum, i) => sum + i.weight, 0);
  if (lockedTotal > maxTotal) {
    // Scale down locked weights proportionally
    const scale = maxTotal / lockedTotal;
    const adjustedLocked = locked.map(i => ({ ...i, weight: Math.round(i.weight * scale) }));
    return [...adjustedLocked, ...unlocked.map(i => ({ ...i, weight: 0 }))];
  }

  const unlockedTotal = unlocked.reduce((sum, i) => sum + i.weight, 0);
  const remaining = maxTotal - lockedTotal;

  if (unlockedTotal === 0 && remaining > 0) {
    // Distribute evenly
    const each = Math.floor(remaining / unlocked.length);
    const extra = remaining - each * unlocked.length;
    return [
      ...locked,
      ...unlocked.map((u, i) => ({ ...u, weight: each + (i < extra ? 1 : 0) })),
    ];
  }

  if (unlockedTotal <= 0) return items;

  const scale = remaining / unlockedTotal;
  const normalized = unlocked.map((u, i) => {
    const rawWeight = Math.round(u.weight * scale);
    return { ...u, weight: rawWeight };
  });

  // Fix rounding to sum exactly to maxTotal
  let sum = lockedTotal + normalized.reduce((s, i) => s + i.weight, 0);
  let idx = 0;
  while (sum < maxTotal && idx < normalized.length) {
    if (!normalized[idx].locked) {
      normalized[idx] = { ...normalized[idx], weight: normalized[idx].weight + 1 };
      sum++;
    }
    idx++;
  }
  while (sum > maxTotal && idx < normalized.length) {
    if (!normalized[idx].locked && normalized[idx].weight > 0) {
      normalized[idx] = { ...normalized[idx], weight: normalized[idx].weight - 1 };
      sum--;
    }
    idx++;
  }

  return [...locked, ...normalized];
}

// ── Component ────────────────────────────────────────────────────────────────

export const FactorWeightSlider: React.FC<FactorWeightSliderProps> = ({
  items,
  onChange,
  maxTotal = 100,
  showPresets = true,
  showDistribution = true,
  className = '',
}) => {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply preset
  const applyPreset = useCallback((key: string) => {
    const newItems = items.map(i => {
      const cat = i.category || '';
      switch (key) {
        case 'equal': return { ...i, weight: 100 / items.length, locked: false };
        case 'momentum': return { ...i, weight: cat === 'momentum' || cat === 'growth' ? 30 : 10, locked: false };
        case 'value': return { ...i, weight: cat === 'value' || cat === 'yield' ? 30 : 10, locked: false };
        case 'quality': return { ...i, weight: cat === 'quality' ? 30 : 10, locked: false };
        default: return i;
      }
    });
    onChange(normalizeWeights(newItems, maxTotal));
  }, [items, maxTotal, onChange]);

  // Handle slider change
  const handleWeightChange = useCallback((idx: number, newWeight: number) => {
    const newItems = items.map((item, i) =>
      i === idx ? { ...item, weight: Math.max(0, Math.min(100, newWeight)) } : item
    );
    onChange(normalizeWeights(newItems, maxTotal));
  }, [items, maxTotal, onChange]);

  // Toggle lock
  const toggleLock = useCallback((idx: number) => {
    const newItems = items.map((item, i) =>
      i === idx ? { ...item, locked: !item.locked } : item
    );
    onChange(normalizeWeights(newItems, maxTotal));
  }, [items, maxTotal, onChange]);

  // Drag handling
  const handleMouseDown = useCallback((idx: number) => {
    setDragIdx(idx);
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        handleWeightChange(idx, Math.round(pct));
      }
    };
    const handleMouseUp = () => {
      setDragIdx(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleWeightChange]);

  // Pre-compute normalized display
  const totalWeight = useMemo(() => items.reduce((s, i) => s + i.weight, 0), [items]);

  if (items.length === 0) {
    return <div className="text-center py-4 text-xs text-gray-600">暂无因子，请先添加因子</div>;
  }

  return (
    <div className={`${className}`}>
      {/* Presets */}
      {showPresets && (
        <div className="mb-4">
          <span className="text-[10px] text-gray-600 mr-2">快速分配:</span>
          <div className="inline-flex gap-1 flex-wrap">
            {WEIGHT_PRESETS.map(preset => (
              <button
                key={preset.key}
                onClick={() => applyPreset(preset.key)}
                className="text-[10px] px-2 py-1 rounded-full bg-white/[0.03] text-gray-500 border border-white/5 hover:border-[#D4A853]/30 hover:text-[#D4A853] transition-colors"
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Weight distribution bar */}
      {showDistribution && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-gray-600 mb-1">
            <span>权重分布</span>
            <span className={totalWeight === maxTotal ? 'text-green-400' : 'text-yellow-400'}>
              合计: {totalWeight}/{maxTotal}%
            </span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.03]">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="transition-all duration-300 h-full"
                style={{
                  width: `${(item.weight / maxTotal) * 100}%`,
                  backgroundColor: item.color,
                  opacity: item.weight > 0 ? 1 : 0.2,
                }}
                title={`${item.name}: ${item.weight}%`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Individual sliders */}
      <div ref={containerRef} className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="group">
            {/* Label row */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-white font-medium">{item.name}</span>
                {item.category && (
                  <span className="text-[9px] text-gray-600">{item.category}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleLock(idx)}
                  className={`text-[10px] transition-colors ${
                    item.locked ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-500'
                  }`}
                  title={item.locked ? '已锁定（不受归一化影响）' : '点击锁定此权重'}
                >
                  {item.locked ? '🔒' : '🔓'}
                </button>
                <span className={`text-xs font-mono font-bold w-10 text-right ${
                  item.locked ? 'text-yellow-400' : 'text-white'
                }`}>
                  {Math.round(item.weight)}%
                </span>
              </div>
            </div>

            {/* Slider track */}
            <div className="relative h-6 flex items-center">
              {/* Track background */}
              <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                <div className="w-full h-1.5 rounded-full bg-white/[0.04]">
                  {/* Filled portion */}
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${(item.weight / maxTotal) * 100}%`,
                      backgroundColor: item.color + '60',
                    }}
                  />
                </div>
              </div>

              {/* Drag handle */}
              <div
                className={`absolute w-4 h-4 rounded-full border-2 cursor-ew-resize transition-shadow ${
                  dragIdx === idx ? 'shadow-lg scale-125 z-10' : 'hover:scale-110'
                }`}
                style={{
                  left: `calc(${(item.weight / maxTotal) * 100}% - 8px)`,
                  backgroundColor: item.color,
                  borderColor: item.color,
                  boxShadow: dragIdx === idx ? `0 0 12px ${item.color}80` : `0 0 4px ${item.color}40`,
                }}
                onMouseDown={(e) => { e.preventDefault(); handleMouseDown(idx); }}
              />
            </div>

            {/* Fine-tune buttons (visible on hover) */}
            <div className="flex gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {[-5, -1, +1, +5].map(delta => (
                <button
                  key={delta}
                  onClick={() => handleWeightChange(idx, item.weight + delta)}
                  className={`text-[9px] px-1.5 py-0.5 rounded ${
                    delta > 0 ? 'bg-white/[0.03] text-gray-500 hover:text-green-400' : 'bg-white/[0.03] text-gray-500 hover:text-red-400'
                  } border border-white/5 transition-colors`}
                >
                  {delta > 0 ? '+' : ''}{delta}%
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between text-[10px]">
        <span className="text-gray-600">
          {items.filter(i => i.locked).length} 锁定 · {items.length - items.filter(i => i.locked).length} 自由
        </span>
        <span className={`font-mono ${totalWeight === maxTotal ? 'text-green-400' : 'text-yellow-400'}`}>
          归一化: {totalWeight === maxTotal ? '✓ 已平衡' : `${totalWeight}/${maxTotal}`}
        </span>
      </div>
    </div>
  );
};

export default FactorWeightSlider;
