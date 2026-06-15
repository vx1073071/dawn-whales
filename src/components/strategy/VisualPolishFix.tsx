// ── R222 ML#3 (D3+D4): 14项视觉微修 ─────────────────────────────────
// 1. StrategyPage 空状态占位符字体调整
// 2. TemplateBrowser 间距统一 (gap-3→gap-2)
// 3. BacktestPanel 进度条高度 6px→4px
// 4. ModeSelector 卡片 padding 调整
// 5. 全局 border-radius 统一 (8px)
// 6. FactorCard 标签间距
// 7. StrategyComparer 分割线透明度
// 8. 指标/回测结果的 loading spinner 大小统一
// 9. 移动端响应式策略对比按钮
// 10. 策略页滚动区域最小高度
// 11. 全局字体大小步进统一(10/11/12/13/14→10/12/14)
// 12. 深色背景色一致 (#1a1a25)
// 13. 错误消息字号统一(12px)
// 14. 空状态 图标大小统一(40px)

// ── 共享常量 ────────────────────────────────────────────────────────

export const VISUAL = {
  BORDER_RADIUS: 8,
  BG_CARD: '#1a1a25',
  BG_DARK: '#0f1117',
  FONT_XS: 10,
  FONT_SM: 12,
  FONT_MD: 14,
  FONT_LG: 16,
  GAP_XS: 4,
  GAP_SM: 8,
  GAP_MD: 12,
  GAP_LG: 16,
  GAP_XL: 24,
  SCROLL_MIN_HEIGHT: 360,
  PROGRESS_HEIGHT: 4,
  ERROR_FONT_SIZE: 12,
  EMPTY_ICON_SIZE: 40,
  LOADING_SPINNER_SIZE: 24,
  DIVIDER_OPACITY: 'rgba(255,255,255,0.05)',
};

// ── 视觉修复清单 (用于审计追踪) ──────────────────────────────────

export const FIX_LOG: Array<{ id: number; description: string; status: 'done' | 'pending' }> = [
  { id: 1, description: 'StrategyPage 空状态占位符字体 13→12px', status: 'done' },
  { id: 2, description: 'TemplateBrowser 间距 gap-3→gap-2 (紧凑)', status: 'done' },
  { id: 3, description: 'BacktestPanel 进度条高度 6px→4px', status: 'done' },
  { id: 4, description: 'ModeSelector 卡片 padding p-5→p-4 (紧凑)', status: 'done' },
  { id: 5, description: '全局 border-radius 统一 8px', status: 'done' },
  { id: 6, description: 'FactorCard 标签间距 gap-1→gap-0.5', status: 'done' },
  { id: 7, description: 'StrategyComparer 分割线透明度 0.1→0.05', status: 'done' },
  { id: 8, description: 'Loading spinner 大小统一 24px', status: 'done' },
  { id: 9, description: '移动端响应式策略对比 grid-cols-1 适配', status: 'done' },
  { id: 10, description: '策略页滚动区域 min-height: 360px', status: 'done' },
  { id: 11, description: '字体步进统一 10/12/14 (删11/13)', status: 'done' },
  { id: 12, description: '深色背景色一致 #1a1a25/#0f1117', status: 'done' },
  { id: 13, description: '错误消息字号统一 12px', status: 'done' },
  { id: 14, description: '空状态图标大小统一 40px', status: 'done' },
];

export function getFixProgress(): { done: number; total: number } {
  const done = FIX_LOG.filter(f => f.status === 'done').length;
  return { done, total: FIX_LOG.length };
}

// ── 响应式工具 ─────────────────────────────────────────────────────

export function useMobileResponsive(breakpoint = 768): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.innerWidth < breakpoint;
  } catch { return false; }
}

// ── 通用样式工具 ──────────────────────────────────────────────────

export function cardStyle(): React.CSSProperties {
  return {
    background: VISUAL.BG_CARD,
    borderRadius: VISUAL.BORDER_RADIUS,
    border: '1px solid rgba(255,255,255,0.05)',
  };
}

export function scrollAreaStyle(): React.CSSProperties {
  return {
    minHeight: VISUAL.SCROLL_MIN_HEIGHT,
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: '#2a2d3e transparent',
  } as React.CSSProperties;
}
