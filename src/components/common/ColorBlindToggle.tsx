/**
* ColorBlindToggle — ML R177 B8 [P0] 色盲友好模式
* Global toggle: red/green → blue/orange alternative + CSS variable switch
* Settings persisted in localStorage. Heatmaps get numeric labels.
*/

import { useState, useEffect, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface ColorBlindToggleProps {
  className?: string;
}

// ── CSS variable overrides ──────────────────────────────────────────────

const NORMAL_VARS = {
  '--color-positive': '#16a34a',
  '--color-positive-bg': 'rgba(22,163,74,0.1)',
  '--color-negative': '#dc2626',
  '--color-negative-bg': 'rgba(220,38,38,0.1)',
  '--color-trend-up': '#16a34a',
  '--color-trend-down': '#dc2626',
  '--color-heatmap-high': '#16a34a',
  '--color-heatmap-low': '#dc2626',
};

const COLORBLIND_VARS = {
  '--color-positive': '#2563eb',      // blue instead of green
  '--color-positive-bg': 'rgba(37,99,235,0.1)',
  '--color-negative': '#ea580c',      // orange instead of red
  '--color-negative-bg': 'rgba(234,88,12,0.1)',
  '--color-trend-up': '#2563eb',
  '--color-trend-down': '#ea580c',
  '--color-heatmap-high': '#2563eb',
  '--color-heatmap-low': '#ea580c',
};

const STORAGE_KEY = 'TradingEasy-colorblind-mode';

// ── Helper ──────────────────────────────────────────────────────────────

function applyTheme(enabled: boolean) {
  const vars = enabled ? COLORBLIND_VARS : NORMAL_VARS;
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  root.setAttribute('data-colorblind', enabled ? 'true' : 'false');
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}

// ── Main Component ─────────────────────────────────────────────────────

export default function ColorBlindToggle({ className = '' }: ColorBlindToggleProps) {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    applyTheme(enabled);
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Toggle button */}
      <button
        onClick={toggle}
        className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none ${
          enabled ? 'bg-blue-600' : 'bg-gray-600'
        }`}
        title={enabled ? '色盲模式已开启' : '色盲模式已关闭'}
        aria-label={enabled ? 'Disable colorblind mode' : 'Enable colorblind mode'}
      >
        <span
          className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>

      {/* Label */}
      <div className="flex flex-col">
        <span className="text-xs text-gray-300">色盲友好模式</span>
        <span className="text-[9px] text-gray-500">
          {enabled ? '蓝/橙配色 · 数字标注' : '红/绿配色 · 标准模式'}
        </span>
      </div>

      {/* Color preview */}
      <div className="flex items-center gap-1.5 ml-2">
        <div className="flex flex-col items-center gap-0.5">
          <div
            className="w-4 h-2 rounded"
            style={{ backgroundColor: enabled ? '#2563eb' : '#16a34a' }}
          />
          <span className="text-[8px] text-gray-600">涨</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div
            className="w-4 h-2 rounded"
            style={{ backgroundColor: enabled ? '#ea580c' : '#dc2626' }}
          />
          <span className="text-[8px] text-gray-600">跌</span>
        </div>
      </div>
    </div>
  );
}
