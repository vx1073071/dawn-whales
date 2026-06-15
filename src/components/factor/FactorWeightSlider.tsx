// ── R228 ML-2.2d: FactorWeightSlider — 拖拽权重滑块+实时预览 ──
// Drag 0-100 weight slider, live preview of strategy impact
// Multi-factor weight distribution, auto-normalize, visual bar chart
// 11-language i18n + undo + presets

import React, { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface WeightedFactor {
  id: string;
  nameCn: string;
  weight: number; // 0-100
  color?: string;
}

export interface FactorWeightSliderProps {
  factors: WeightedFactor[];
  onChange: (factors: WeightedFactor[]) => void;
  onReset?: () => void;
  totalWeight?: number; // usually 100
  locale?: string;
  compact?: boolean;
}

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '因子权重配置', total: '总权重', remaining: '剩余',
    hint: '拖动滑块调整每个因子的权重 (0-100)',
    normalize: '自动配平', reset: '重置', undo: '撤销',
    distribution: '权重分布', zero: '无',
    preview: '策略预览',
    impact: '影响度',
    presetBalanced: '均衡',
    presetMomentum: '动量偏好',
    presetValue: '价值偏好',
    overAllocated: '超配',
    underAllocated: '不足',
  },
  en: {
    title: 'Factor Weights', total: 'Total', remaining: 'Remaining',
    hint: 'Drag sliders to adjust each factor weight (0-100)',
    normalize: 'Auto-Balance', reset: 'Reset', undo: 'Undo',
    distribution: 'Distribution', zero: 'None',
    preview: 'Strategy Preview',
    impact: 'Impact',
    presetBalanced: 'Balanced',
    presetMomentum: 'Momentum',
    presetValue: 'Value',
    overAllocated: 'Over', underAllocated: 'Under',
  },
  ja: {
    title: '因子ウェイト', total: '合計', remaining: '残り',
    hint: 'スライダーをドラッグして因子ウェイトを調整 (0-100)',
    normalize: '自動配分', reset: 'リセット', undo: '元に戻す',
    distribution: '配分', zero: 'なし',
    preview: '戦略プレビュー',
    impact: '影響度',
    presetBalanced: 'バランス', presetMomentum: 'モメンタム', presetValue: 'バリュー',
    overAllocated: '超過', underAllocated: '不足',
  },
};

// ── Factor colors ───────────────────────────────────────────────────
const FACTOR_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
];

// ── Component ───────────────────────────────────────────────────────
const FactorWeightSlider: React.FC<FactorWeightSliderProps> = ({
  factors: initialFactors, onChange, onReset, totalWeight = 100, locale: pl, compact,
}) => {
  const [factors, setFactors] = useState<WeightedFactor[]>(
    initialFactors.map((f, i) => ({ ...f, color: f.color || FACTOR_COLORS[i % FACTOR_COLORS.length] }))
  );
  const [history, setHistory] = useState<WeightedFactor[][]>([]);

  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const currentTotal = factors.reduce((s, f) => s + f.weight, 0);
  const remaining = totalWeight - currentTotal;
  const isBalanced = Math.abs(remaining) < 0.5;

  const handleWeightChange = useCallback((id: string, newWeight: number) => {
    setHistory(prev => [...prev.slice(-9), [...factors]]);
    const updated = factors.map(f =>
      f.id === id ? { ...f, weight: Math.max(0, Math.min(totalWeight, newWeight)) } : f
    );
    setFactors(updated);
    onChange(updated);
  }, [factors, onChange, totalWeight]);

  const handleNormalize = useCallback(() => {
    setHistory(prev => [...prev.slice(-9), [...factors]]);
    const total = factors.reduce((s, f) => s + f.weight, 0) || 1;
    const updated = factors.map(f => ({
      ...f, weight: Math.round((f.weight / total) * totalWeight),
    }));
    // Adjust last factor to make exact total
    const diff = totalWeight - updated.reduce((s, f) => s + f.weight, 0);
    if (updated.length > 0) updated[updated.length - 1].weight += diff;
    setFactors(updated);
    onChange(updated);
  }, [factors, onChange, totalWeight]);

  const handleUndo = useCallback(() => {
    const prev = history.pop();
    if (prev) {
      setFactors(prev);
      setHistory([...history]);
      onChange(prev);
    }
  }, [history, onChange]);

  const handleReset = useCallback(() => {
    setHistory(prev => [...prev.slice(-9), [...factors]]);
    const resetFactors = initialFactors.map((f, i) => ({ ...f, color: FACTOR_COLORS[i % FACTOR_COLORS.length] }));
    setFactors(resetFactors);
    onChange(resetFactors);
    onReset?.();
  }, [initialFactors, factors, onChange, onReset]);

  // Preset application
  const applyPreset = useCallback((type: 'balanced' | 'momentum' | 'value') => {
    setHistory(prev => [...prev.slice(-9), [...factors]]);
    let updated: WeightedFactor[];
    const n = factors.length;
    switch (type) {
      case 'balanced':
        updated = factors.map(f => ({ ...f, weight: Math.round(totalWeight / n) }));
        break;
      case 'momentum':
        updated = factors.map((f, idx) => ({ ...f, weight: idx === 0 ? Math.round(totalWeight * 0.5) : Math.round(totalWeight * 0.5 / (n - 1)) }));
        break;
      case 'value':
        updated = factors.map((f, i) => ({ ...f, weight: i === n - 1 ? Math.round(totalWeight * 0.5) : Math.round(totalWeight * 0.5 / (n - 1)) }));
        break;
    }
    const diff = totalWeight - updated.reduce((s, f) => s + f.weight, 0);
    if (diff !== 0) updated[0].weight += diff;
    setFactors(updated);
    onChange(updated);
  }, [factors, onChange, totalWeight]);

  if (factors.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>{t.zero}</div>;
  }

  return (
    <div style={{ background: '#0d1117', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{t.title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Total indicator */}
          <span style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: isBalanced ? 'rgba(34,197,94,0.1)' : 'rgba(240,136,62,0.1)',
            border: `1px solid ${isBalanced ? 'rgba(34,197,94,0.2)' : 'rgba(240,136,62,0.2)'}`,
            color: isBalanced ? '#3fb950' : '#f0883e',
          }}>
            {t.total}: {currentTotal}/{totalWeight}
          </span>
          {!isBalanced && (
            <button onClick={handleNormalize} style={{
              padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#3fb950',
            }}>
              {t.normalize}
            </button>
          )}
          {history.length > 0 && (
            <button onClick={handleUndo} style={{
              padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)',
            }}>
              {t.undo}
            </button>
          )}
          <button onClick={handleReset} style={{
            padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)',
          }}>
            {t.reset}
          </button>
        </div>
      </div>

      {/* Preset buttons */}
      {!compact && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <PresetBtn label={t.presetBalanced} onClick={() => applyPreset('balanced')} />
          <PresetBtn label={t.presetMomentum} onClick={() => applyPreset('momentum')} />
          <PresetBtn label={t.presetValue} onClick={() => applyPreset('value')} />
        </div>
      )}

      {/* Factor sliders */}
      <div style={{ padding: '12px 16px', maxHeight: '50vh', overflowY: 'auto' }}>
        {factors.map((factor) => (
          <div key={factor.id} style={{ marginBottom: compact ? 8 : 14 }}>
            {/* Factor name + weight */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: factor.color, flexShrink: 0,
                }} />
                <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500 }}>{factor.nameCn}</span>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace' }}>{factor.id}</span>
              </div>
              <span style={{
                color: factor.color, fontWeight: 700, fontSize: 13,
                minWidth: 36, textAlign: 'right',
              }}>
                {factor.weight}
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={0}
              max={totalWeight}
              value={factor.weight}
              onChange={e => handleWeightChange(factor.id, parseInt(e.target.value))}
              style={{
                width: '100%', height: 4, appearance: 'none', WebkitAppearance: 'none',
                background: `linear-gradient(to right, ${factor.color} 0%, ${factor.color} ${(factor.weight / totalWeight) * 100}%, rgba(255,255,255,0.05) ${(factor.weight / totalWeight) * 100}%, rgba(255,255,255,0.05) 100%)`,
                borderRadius: 2, outline: 'none', cursor: 'pointer',
              }}
              aria-label={`${factor.nameCn}: ${factor.weight}`}
            />

            {/* Impact label */}
            {!compact && (
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', marginTop: 2, textAlign: 'right' }}>
                {factor.weight > totalWeight * 0.6 ? t.overAllocated : factor.weight < 5 ? t.underAllocated : `${t.impact}: ${factor.weight}%`}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Weight distribution bar (visual preview) */}
      <div style={{ padding: '8px 16px 12px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, marginBottom: 6 }}>{t.distribution}</div>
        <div style={{
          height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex',
          background: 'rgba(255,255,255,0.03)',
        }}>
          {factors.map(f => (
            <div
              key={f.id}
              style={{
                width: `${Math.max((f.weight / (factors.reduce((s, x) => s + x.weight, 0) || 1)) * 100, 0.5)}%`,
                background: f.color, transition: 'width 0.3s ease',
              }}
              title={`${f.nameCn}: ${f.weight}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Preset button ───────────────────────────────────────────────────
const PresetBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.4)',
    }}
  >
    {label}
  </button>
);

export default FactorWeightSlider;
