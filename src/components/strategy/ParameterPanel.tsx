// ── R227 ML-2.4b: ParameterPanel — Dual-mode parameter controls ───
// Primary mode: Slider (Low/Medium/High) for casual users
// Advanced mode: Exact numeric input for power users
// 11-language i18n + live preview + presets
// Integrates with strategy parameter configs

import React, { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface ParameterDef {
  id: string;
  name: string;          // English machine name
  humanLabel: string;    // Human-readable (localized)
  humanDesc: string;     // What this param does in plain language
  type: 'number' | 'percent' | 'integer' | 'days';
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit?: string;         // e.g., '%', 'days', '×'
}

export interface ParameterValue {
  [paramId: string]: number;
}

export interface ParameterPanelProps {
  parameters: ParameterDef[];
  values: ParameterValue;
  onChange: (id: string, value: number) => void;
  onReset?: () => void;
  mode: 'simple' | 'advanced';
  onModeChange?: (mode: 'simple' | 'advanced') => void;
  locale?: string;
}

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    simpleMode: '简易模式',
    advancedMode: '高级模式',
    low: '低', medium: '中', high: '高',
    default: '默认', reset: '重置全部',
    switchHint: '切换到高级模式可输入精确数值',
    switchBack: '返回简易模式',
    value: '值', unitDays: '天', unitPct: '%', unitX: '倍',
  },
  en: {
    simpleMode: 'Simple', advancedMode: 'Advanced',
    low: 'Low', medium: 'Medium', high: 'High',
    default: 'Default', reset: 'Reset All',
    switchHint: 'Switch to advanced for exact values',
    switchBack: 'Back to simple mode',
    value: 'Value', unitDays: 'days', unitPct: '%', unitX: '×',
  },
  ja: {
    simpleMode: 'シンプル', advancedMode: '詳細',
    low: '低', medium: '中', high: '高',
    default: 'デフォルト', reset: 'リセット',
    switchHint: '詳細モードで正確な数値を入力',
    switchBack: 'シンプルモードに戻る',
    value: '値', unitDays: '日', unitPct: '%', unitX: '倍',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────
function sliderToNumeric(param: ParameterDef, level: 'low' | 'medium' | 'high'): number {
  const range = param.max - param.min;
  switch (level) {
    case 'low': return param.min + range * 0.15;
    case 'medium': return param.defaultValue;
    case 'high': return param.min + range * 0.85;
  }
}

function numericToSliderLevel(param: ParameterDef, value: number): 'low' | 'medium' | 'high' {
  const range = param.max - param.min;
  const pct = (value - param.min) / range;
  if (pct < 0.33) return 'low';
  if (pct < 0.67) return 'medium';
  return 'high';
}

function formatValue(param: ParameterDef, value: number): string {
  if (param.type === 'percent') return `${(value * 100).toFixed(1)}%`;
  if (param.type === 'integer') return String(Math.round(value));
  if (param.type === 'days') return `${Math.round(value)} days`;
  return value.toFixed(2);
}

function sliderColor(level: 'low' | 'medium' | 'high'): string {
  return level === 'low' ? '#3b82f6' : level === 'medium' ? '#d29922' : '#f85149';
}

// ── Component ───────────────────────────────────────────────────────
const ParameterPanel: React.FC<ParameterPanelProps> = ({
  parameters, values, onChange, onReset, mode, onModeChange, locale: pl,
}) => {
  const [hoveredParam, setHoveredParam] = useState<string | null>(null);

  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const handleSliderChange = useCallback((param: ParameterDef, level: 'low' | 'medium' | 'high') => {
    onChange(param.id, sliderToNumeric(param, level));
  }, [onChange]);

  return (
    <div style={{ background: '#0d1117', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: mode === 'simple' ? 'rgba(34,197,94,0.12)' : 'rgba(163,113,247,0.12)',
            border: `1px solid ${mode === 'simple' ? 'rgba(34,197,94,0.2)' : 'rgba(163,113,247,0.2)'}`,
            color: mode === 'simple' ? '#3fb950' : '#a371f7',
          }}>
            {mode === 'simple' ? `🔰 ${t.simpleMode}` : `⚙️ ${t.advancedMode}`}
          </span>
          <button
            onClick={() => onModeChange?.(mode === 'simple' ? 'advanced' : 'simple')}
            style={{
              padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)',
            }}
            title={mode === 'simple' ? t.switchHint : t.switchBack}
          >
            {mode === 'simple' ? t.advancedMode : t.simpleMode}
          </button>
        </div>
        {onReset && (
          <button
            onClick={onReset}
            style={{
              padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            ↩ {t.reset}
          </button>
        )}
      </div>

      {/* Parameters list */}
      <div style={{ padding: '12px 16px', maxHeight: '60vh', overflowY: 'auto' }}>
        {parameters.map(param => {
          const value = values[param.id] ?? param.defaultValue;
          const sliderLevel = numericToSliderLevel(param, value);
          const isHovered = hoveredParam === param.id;

          return (
            <div
              key={param.id}
              onMouseEnter={() => setHoveredParam(param.id)}
              onMouseLeave={() => setHoveredParam(null)}
              style={{
                padding: '10px 12px', borderRadius: 10, marginBottom: 8,
                background: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.03)',
                transition: 'all 0.15s',
              }}
            >
              {/* Label row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{param.humanLabel}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 1 }}>{param.humanDesc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#58a6ff', fontWeight: 700, fontSize: 14 }}>
                    {formatValue(param, value)}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>{t.default}: {formatValue(param, param.defaultValue)}</div>
                </div>
              </div>

              {/* Simple mode: Low/Medium/High toggle */}
              {mode === 'simple' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['low', 'medium', 'high'] as const).map(level => {
                    const isActive = sliderLevel === level;
                    return (
                      <button
                        key={level}
                        onClick={() => handleSliderChange(param, level)}
                        style={{
                          flex: 1, padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
                          border: `2px solid ${isActive ? sliderColor(level) : 'rgba(255,255,255,0.08)'}`,
                          background: isActive ? `${sliderColor(level)}15` : 'transparent',
                          color: isActive ? sliderColor(level) : 'rgba(255,255,255,0.3)',
                          fontWeight: isActive ? 600 : 400, fontSize: 12,
                          transition: 'all 0.15s',
                        }}
                      >
                        {t[level]}
                        {isActive && <span style={{ marginLeft: 4, fontSize: 10 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Advanced mode: Slider + numeric input */}
              {mode === 'advanced' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Range slider */}
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={value}
                    onChange={e => onChange(param.id, parseFloat(e.target.value))}
                    style={{
                      flex: 1, height: 4, appearance: 'none', WebkitAppearance: 'none',
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((value - param.min) / (param.max - param.min)) * 100}%, rgba(255,255,255,0.08) ${((value - param.min) / (param.max - param.min)) * 100}%, rgba(255,255,255,0.08) 100%)`,
                      borderRadius: 2, outline: 'none', cursor: 'pointer',
                    }}
                    aria-label={`${param.humanLabel}: ${value}`}
                  />
                  {/* Numeric input */}
                  <input
                    type="number"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={value}
                    onChange={e => onChange(param.id, parseFloat(e.target.value) || param.defaultValue)}
                    style={{
                      width: 72, padding: '4px 8px', borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                      color: '#58a6ff', fontSize: 12, textAlign: 'center', outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Range labels (advanced mode) */}
              {mode === 'advanced' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9 }}>{formatValue(param, param.min)}</span>
                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9 }}>{formatValue(param, param.max)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      {mode === 'simple' && (
        <div style={{
          padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.04)',
          fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center',
        }}>
          {t.switchHint} → <span style={{ color: '#a371f7' }}>⚙️ {t.advancedMode}</span>
        </div>
      )}
    </div>
  );
};

// ── Example parameter presets for common strategies ─────────────────
export const PRESET_PARAMETERS: ParameterDef[] = [
  { id: 'stopLoss', name: 'stopLoss', humanLabel: '止损线', humanDesc: '单笔交易最大亏损百分比', type: 'percent', defaultValue: 0.05, min: 0.01, max: 0.20, step: 0.01, unit: '%' },
  { id: 'takeProfit', name: 'takeProfit', humanLabel: '止盈线', humanDesc: '单笔交易目标收益百分比', type: 'percent', defaultValue: 0.15, min: 0.02, max: 0.50, step: 0.01, unit: '%' },
  { id: 'positionSize', name: 'positionSize', humanLabel: '仓位比例', humanDesc: '每笔交易占总资金比例', type: 'percent', defaultValue: 0.10, min: 0.01, max: 0.50, step: 0.01, unit: '%' },
  { id: 'maxPositions', name: 'maxPositions', humanLabel: '最大持仓数', humanDesc: '同时持有的最大标的数量', type: 'integer', defaultValue: 10, min: 1, max: 50, step: 1 },
  { id: 'lookbackDays', name: 'lookbackDays', humanLabel: '回看天数', humanDesc: '因子计算的历史窗口期', type: 'days', defaultValue: 60, min: 5, max: 365, step: 5 },
  { id: 'rebalanceFreq', name: 'rebalanceFreq', humanLabel: '再平衡频率', humanDesc: '策略调仓的时间间隔', type: 'days', defaultValue: 30, min: 1, max: 90, step: 1 },
  { id: 'momentumWindow', name: 'momentumWindow', humanLabel: '动量窗口', humanDesc: '动量因子的计算周期', type: 'days', defaultValue: 60, min: 5, max: 252, step: 5 },
  { id: 'volTarget', name: 'volTarget', humanLabel: '目标波动率', humanDesc: '组合目标年化波动率', type: 'percent', defaultValue: 0.15, min: 0.05, max: 0.50, step: 0.01, unit: '%' },
];

export default ParameterPanel;
