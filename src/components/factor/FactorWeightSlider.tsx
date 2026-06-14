/**
 * ── R160 ML: Factor Weight Visual Configurator ─────────────────────────
 * P0-F2: 5 sliders + auto-normalization + donut chart + 4 presets
 * Drag-to-adjust with real-time feedback.
 * Persists to localStorage 'dw-factor-weights'.
 * 11-language i18n supported.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts';

// ── Types ──────────────────────────────────────────────────────────────

export type FactorId = 'momentum' | 'value' | 'quality' | 'volatility' | 'liquidity';

export interface FactorWeightConfig {
  factor: FactorId;
  weight: number; // 0-100, all sum to 100
}

export type WeightPreset = 'momentum' | 'value' | 'balanced' | 'defensive' | 'custom';

export interface FactorWeightPreset {
  id: WeightPreset;
  labelKey: string;
  weights: Record<FactorId, number>;
}

export interface FactorWeightChangeEvent {
  weights: Record<FactorId, number>;
  preset: WeightPreset;
}

// ── Defaults & Presets ────────────────────────────────────────────────

const PRESETS: FactorWeightPreset[] = [
  { id: 'balanced',   labelKey: 'FactorWeightSlider.presetBalanced',   weights: { momentum: 20, value: 20, quality: 20, volatility: 20, liquidity: 20 } },
  { id: 'momentum',   labelKey: 'FactorWeightSlider.presetMomentum',   weights: { momentum: 40, value: 15, quality: 15, volatility: 15, liquidity: 15 } },
  { id: 'value',      labelKey: 'FactorWeightSlider.presetValue',      weights: { momentum: 10, value: 40, quality: 25, volatility: 15, liquidity: 10 } },
  { id: 'defensive',  labelKey: 'FactorWeightSlider.presetDefensive',  weights: { momentum: 5,  value: 20, quality: 25, volatility: 35, liquidity: 15 } },
];

const FACTOR_ORDER: FactorId[] = ['momentum', 'value', 'quality', 'volatility', 'liquidity'];

interface FactorMeta {
  id: FactorId;
  labelKey: string;
  descKey: string;
  color: string;
}

const FACTOR_META: FactorMeta[] = [
  { id: 'momentum',   labelKey: 'FactorWeightSlider.factorMomentum',   descKey: 'FactorWeightSlider.descMomentum',   color: '#ef4444' },
  { id: 'value',      labelKey: 'FactorWeightSlider.factorValue',      descKey: 'FactorWeightSlider.descValue',      color: '#3b82f6' },
  { id: 'quality',    labelKey: 'FactorWeightSlider.factorQuality',    descKey: 'FactorWeightSlider.descQuality',    color: '#10b981' },
  { id: 'volatility', labelKey: 'FactorWeightSlider.factorVolatility', descKey: 'FactorWeightSlider.descVolatility', color: '#f59e0b' },
  { id: 'liquidity',  labelKey: 'FactorWeightSlider.factorLiquidity',  descKey: 'FactorWeightSlider.descLiquidity',  color: '#8b5cf6' },
];

const STORAGE_KEY = 'dw-factor-weights';

// ── Helpers ─────────────────────────────────────────────────────────────

function loadWeights(): { weights: Record<FactorId, number>; preset: WeightPreset } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.weights && FACTOR_ORDER.every((f) => typeof parsed.weights[f] === 'number')) {
        return parsed;
      }
    }
  } catch { /* fall through */ }
  return { weights: { momentum: 20, value: 20, quality: 20, volatility: 20, liquidity: 20 }, preset: 'balanced' as WeightPreset };
}

function saveWeights(weights: Record<FactorId, number>, preset: WeightPreset): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ weights, preset }));
}

function normalizeWeights(raw: Record<FactorId, number>): Record<FactorId, number> {
  const total = FACTOR_ORDER.reduce((s, f) => s + (raw[f] || 0), 0);
  if (total === 0) {
    // Uniform fallback
    const uniform = 100 / FACTOR_ORDER.length;
    const result: Partial<Record<FactorId, number>> = {};
    FACTOR_ORDER.forEach((f) => { result[f] = uniform; });
    return result as Record<FactorId, number>;
  }
  const result: Partial<Record<FactorId, number>> = {};
  let rounded = 0;
  const exact: number[] = [];
  for (let i = 0; i < FACTOR_ORDER.length; i++) {
    const f = FACTOR_ORDER[i];
    const rawVal = (raw[f] || 0) / total * 100;
    exact.push(rawVal);
    const floor = Math.floor(rawVal);
    result[f] = floor;
    rounded += floor;
  }
  // Distribute rounding remainder
  let remainder = 100 - rounded;
  const indices = exact.map((v, i) => ({ v: v - Math.floor(v), i })).sort((a, b) => b.v - a.v);
  for (let j = 0; j < remainder && j < indices.length; j++) {
    result[FACTOR_ORDER[indices[j].i]]! += 1;
  }
  return result as Record<FactorId, number>;
}

function detectPreset(weights: Record<FactorId, number>): WeightPreset {
  for (const p of PRESETS) {
    let match = true;
    for (const f of FACTOR_ORDER) {
      if (Math.abs((p.weights[f] || 0) - (weights[f] || 0)) > 0.5) { match = false; break; }
    }
    if (match) return p.id;
  }
  return 'custom';
}

// ── Component ───────────────────────────────────────────────────────────

const FactorWeightSlider: React.FC<{
  onChange?: (e: FactorWeightChangeEvent) => void;
  readonly?: boolean;
}> = ({ onChange, readonly = false }) => {
  const { t } = useTranslation();

  const saved = loadWeights();
  const [weights, setWeights] = useState<Record<FactorId, number>>(saved.weights);
  const [preset, setPreset] = useState<WeightPreset>(saved.preset);
  const [dragging, setDragging] = useState<FactorId | null>(null);
  const [recBanner, setRecBanner] = useState<{ templateId: string; factors: string[] } | null>(null);

  // R163: Check for template-recommended factors
  useEffect(() => {
    try {
      const raw = localStorage.getItem('dw-factor-recommendations');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.templateId && parsed.factors && Array.isArray(parsed.factors)) {
          setRecBanner({ templateId: parsed.templateId, factors: parsed.factors });
        }
      }
    } catch { /* ignore */ }
  }, []);

  const dismissRecBanner = () => {
    localStorage.removeItem('dw-factor-recommendations');
    setRecBanner(null);
  };
  const dragRef = useRef<{ startX: number; startVal: number; factor: FactorId } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // ── Normalize on weight change ──────────────────────────────────
  const normalized = normalizeWeights(weights);

  // ── Donut chart ──────────────────────────────────────────────────
  const updateChart = useCallback(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, { renderer: 'canvas' });
    }
    const data = FACTOR_ORDER.map((f) => {
      const meta = FACTOR_META.find((m) => m.id === f)!;
      return {
        name: t(meta.labelKey),
        value: Math.round(normalized[f]),
        itemStyle: { color: meta.color },
      };
    });

    chartInstance.current.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1a1a25',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e5e7eb', fontSize: 11 },
        formatter: '{b}: {c}%',
      },
      series: [{
        type: 'pie',
        radius: ['55%', '80%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 3, borderColor: '#0d0d15', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: 'bold' },
          scaleSize: 8,
        },
        data,
      }],
    });
  }, [normalized, t]);

  useEffect(() => { updateChart(); return () => { chartInstance.current?.dispose(); chartInstance.current = null; }; }, [updateChart]);

  // ── Handlers ────────────────────────────────────────────────────
  const handlePreset = (p: FactorWeightPreset) => {
    setWeights({ ...p.weights });
    setPreset(p.id);
    saveWeights(p.weights, p.id);
    onChange?.({ weights: p.weights, preset: p.id });
  };

  const handleSlider = (factor: FactorId, value: number) => {
    const next = { ...weights, [factor]: value };
    setWeights(next);
    const detectedPreset = detectPreset(normalizeWeights(next));
    setPreset(detectedPreset);
    saveWeights(normalizeWeights(next), detectedPreset);
    onChange?.({ weights: normalizeWeights(next), preset: detectedPreset });
  };

  const handleReset = () => {
    const def = PRESETS[0]; // balanced
    setWeights({ ...def.weights });
    setPreset('balanced');
    saveWeights(def.weights, 'balanced');
    onChange?.({ weights: def.weights, preset: 'balanced' });
  };

  // ── Drag handling ────────────────────────────────────────────────
  const handleMouseDown = (factor: FactorId) => (e: React.MouseEvent) => {
    if (readonly) return;
    setDragging(factor);
    dragRef.current = { startX: e.clientX, startVal: weights[factor] || 0, factor };
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const sensitivity = 2; // pixels per weight unit
      const delta = Math.round(dx / sensitivity);
      const newVal = Math.max(0, Math.min(100, dragRef.current.startVal + delta));
      handleSlider(dragging, newVal);
    };
    const handleUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* R163: Template recommendation banner */}
      {recBanner && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 text-sm mt-0.5">🧬</span>
              <div>
                <h4 className="text-xs font-semibold text-emerald-300">
                  {t('FactorWeightSlider.recBannerTitle', '模板推荐权重已加载')}
                </h4>
                <p className="text-[10px] text-emerald-200/60 mt-0.5">
                  {t('FactorWeightSlider.recBannerBody', '以下因子组合基于所选策略模板自动推荐。你可以手动调整。')}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {recBanner.factors.map((f) => (
                    <code key={f} className="text-[10px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded">{f}</code>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={dismissRecBanner} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
          </div>
        </div>
      )}

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePreset(p)}
            disabled={readonly}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              preset === p.id
                ? 'bg-[#C9A046] text-black shadow-lg shadow-[#C9A046]/20'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 border border-white/5'
            }`}
          >
            {t(p.labelKey)}
          </button>
        ))}
        <button
          onClick={handleReset}
          disabled={readonly}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300 border border-white/5 transition-all"
        >
          ↺ {t('FactorWeightSlider.reset')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Donut Chart */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-white mb-2 w-full text-center">
            {t('FactorWeightSlider.chartTitle')}
          </h3>
          <div ref={chartRef} className="w-[200px] h-[200px]" />
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {FACTOR_META.map((m) => (
              <div key={m.id} className="flex items-center gap-1 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: m.color }} />
                <span className="text-gray-400">{t(m.labelKey)}</span>
                <span className="text-gray-500 font-mono">{Math.round(normalized[m.id])}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white mb-1">
            {t('FactorWeightSlider.sliderTitle')}
          </h3>

          {FACTOR_META.map((meta) => {
            const val = weights[meta.id] || 0;
            const displayVal = Math.round(normalized[meta.id]);
            return (
              <div key={meta.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                    <span className="text-xs font-medium text-gray-300">{t(meta.labelKey)}</span>
                    <span className="text-[10px] text-gray-500 hidden sm:inline">
                      — {t(meta.descKey)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-sm font-mono font-bold tabular-nums"
                      style={{ color: meta.color }}
                    >
                      {displayVal}%
                    </span>
                    <span className="text-[10px] text-gray-600">
                      ({t('FactorWeightSlider.raw')}: {val})
                    </span>
                  </div>
                </div>
                <div
                  className="relative group"
                  onMouseDown={handleMouseDown(meta.id)}
                  style={{ cursor: readonly ? 'default' : 'ew-resize' }}
                >
                  <div className="w-full h-6 bg-white/5 rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-100 ease-out"
                      style={{
                        width: `${displayVal}%`,
                        backgroundColor: meta.color,
                        opacity: dragging === meta.id ? 1 : 0.85,
                      }}
                    />
                    {/* Tick marks */}
                    {[25, 50, 75].map((tick) => (
                      <div
                        key={tick}
                        className="absolute top-0 h-full w-px bg-white/10"
                        style={{ left: `${tick}%` }}
                      />
                    ))}
                  </div>
                  {/* Drag hint */}
                  {!readonly && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-white/40 bg-black/50 px-2 py-0.5 rounded">
                        {t('FactorWeightSlider.dragHint')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Total indicator */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-xs text-gray-500">{t('FactorWeightSlider.total')}</span>
            <span className={`text-sm font-mono font-bold ${
              Math.abs(FACTOR_ORDER.reduce((s, f) => s + (normalized[f] || 0), 0) - 100) < 0.5
                ? 'text-emerald-400'
                : 'text-yellow-400'
            }`}>
              {FACTOR_ORDER.reduce((s, f) => s + (normalized[f] || 0), 0)}%
            </span>
          </div>

          {/* Auto-normalize note */}
          <p className="text-[10px] text-gray-600 leading-relaxed">
            {t('FactorWeightSlider.autoNormalize')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FactorWeightSlider;
export { PRESETS, FACTOR_ORDER, FACTOR_META, loadWeights, saveWeights, normalizeWeights, detectPreset };
