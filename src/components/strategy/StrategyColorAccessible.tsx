// ── R222 ML#1 (D1): 色盲友好色板共用模块 ──────────────────────────────
// 替换所有 green/red 配色为 blue/orange 色盲友好配对
// 覆盖: StrategyComparer + StrategyCompareModal + 其他策略对比组件
// 设计: 蓝(positive) + 橙(negative) — 红绿色盲也能清晰区分

export const COLOR_UP = '#3b82f6';       // blue-500 ✅ positive
export const COLOR_DOWN = '#f97316';      // orange-500 ✅ negative
export const COLOR_DOWN_SOFT = '#fb923c'; // orange-400 for softer indicators
export const COLOR_NEUTRAL = '#6b7280';   // gray-500

export const COLOR_UP_BG = 'rgba(59, 130, 246, 0.1)';
export const COLOR_DOWN_BG = 'rgba(249, 115, 22, 0.1)';
export const COLOR_UP_BORDER = 'rgba(59, 130, 246, 0.3)';
export const COLOR_DOWN_BORDER = 'rgba(249, 115, 22, 0.3)';

export const COLOR_UP_TEXT = 'text-blue-400';
export const COLOR_DOWN_TEXT = 'text-orange-400';
export const COLOR_UP_BG_CLASS = 'bg-blue-500/10';
export const COLOR_DOWN_BG_CLASS = 'bg-orange-500/10';

/**
 * Returns color-blind friendly color for positive/negative value
 */
export function positiveColor(value: number, threshold = 0): string {
  return value >= threshold ? COLOR_UP : COLOR_DOWN;
}

/**
 * Returns CSS class for text color
 */
export function positiveTextClass(value: number, threshold = 0): string {
  return value >= threshold ? 'text-blue-400' : 'text-orange-400';
}

/**
 * Returns format for positive/negative change display
 */
export function formatChange(value: number, decimals = 2, showSign = true): { text: string; color: string } {
  const formatted = value.toFixed(decimals);
  return {
    text: showSign && value > 0 ? `+${formatted}` : formatted,
    color: value >= 0 ? '#3b82f6' : '#f97316',
  };
}
