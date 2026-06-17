/**
 * R265: ShortcutIpcBridge — 全局快捷键IPC桥接
 * 
 * 功能:
 *   1. 30+快捷键注册表 (主进程注册→渲染进程分发)
 *   2. 上下文感知: 图表视图/自选列表/设置弹窗 → 不同快捷键生效
 *   3. 冲突检测: 同键位多绑定→优先级裁决
 *   4. 快捷键开启/禁用切换 (全局+按模块)
 *   5. 快捷键帮助浮窗数据
 *   6. 同步双向: 渲染进程也可注册自定义快捷键
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ShortcutDef {
  shortcutId: string;
  key: string;           // e.g. 'Space', '1', 'Ctrl+Z', 'Shift+ArrowRight'
  command: string;       // semantic action id
  label: string;
  labelCn: string;
  context: ShortcutContext[];
  priority: number;      // higher = wins on conflict
  enabled: boolean;
  category: 'chart' | 'navigate' | 'drawing' | 'indicator' | 'general';
}

export type ShortcutContext = 'chart' | 'watchlist' | 'settings' | 'backtest' | 'global';

export interface ShortcutEvent {
  shortcutId: string;
  command: string;
  key: string;
  context: ShortcutContext;
  timestamp: number;
  source: 'main' | 'renderer';
}

export interface ShortcutConflict {
  key: string;
  shortcuts: ShortcutDef[];
  resolution: string;
  resolutionCn: string;
}

export interface ShortcutCategoryGuide {
  category: string;
  categoryCn: string;
  shortcuts: ShortcutDef[];
}

// ── Default 30 shortcuts (TradingView-compatible) ──────────────────────────

const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  // ── Navigation (space + arrows) ──
  { shortcutId: 'nav-next-symbol', key: 'Space', command: 'navigate:next_symbol', label: 'Next Symbol', labelCn: '下一个股票', context: ['chart'], priority: 10, enabled: true, category: 'navigate' },
  { shortcutId: 'nav-prev-symbol', key: 'Shift+Space', command: 'navigate:prev_symbol', label: 'Previous Symbol', labelCn: '上一个股票', context: ['chart'], priority: 10, enabled: true, category: 'navigate' },
  { shortcutId: 'nav-scroll-left', key: 'ArrowLeft', command: 'chart:scroll_left', label: 'Scroll Left', labelCn: '左移', context: ['chart'], priority: 8, enabled: true, category: 'navigate' },
  { shortcutId: 'nav-scroll-right', key: 'ArrowRight', command: 'chart:scroll_right', label: 'Scroll Right', labelCn: '右移', context: ['chart'], priority: 8, enabled: true, category: 'navigate' },
  { shortcutId: 'nav-scroll-left-fast', key: 'Shift+ArrowLeft', command: 'chart:scroll_left_fast', label: 'Fast Scroll Left', labelCn: '快速左移', context: ['chart'], priority: 8, enabled: true, category: 'navigate' },
  { shortcutId: 'nav-scroll-right-fast', key: 'Shift+ArrowRight', command: 'chart:scroll_right_fast', label: 'Fast Scroll Right', labelCn: '快速右移', context: ['chart'], priority: 8, enabled: true, category: 'navigate' },

  // ── Timeframe switching (1-9) ──
  { shortcutId: 'tf-1m', key: '1', command: 'chart:timeframe:1m', label: '1 minute', labelCn: '1分钟', context: ['chart'], priority: 12, enabled: true, category: 'chart' },
  { shortcutId: 'tf-5m', key: '2', command: 'chart:timeframe:5m', label: '5 minutes', labelCn: '5分钟', context: ['chart'], priority: 12, enabled: true, category: 'chart' },
  { shortcutId: 'tf-15m', key: '3', command: 'chart:timeframe:15m', label: '15 minutes', labelCn: '15分钟', context: ['chart'], priority: 12, enabled: true, category: 'chart' },
  { shortcutId: 'tf-30m', key: '4', command: 'chart:timeframe:30m', label: '30 minutes', labelCn: '30分钟', context: ['chart'], priority: 12, enabled: true, category: 'chart' },
  { shortcutId: 'tf-1h', key: '5', command: 'chart:timeframe:1h', label: '1 hour', labelCn: '1小时', context: ['chart'], priority: 12, enabled: true, category: 'chart' },
  { shortcutId: 'tf-4h', key: '6', command: 'chart:timeframe:4h', label: '4 hours', labelCn: '4小时', context: ['chart'], priority: 12, enabled: true, category: 'chart' },
  { shortcutId: 'tf-D', key: '7', command: 'chart:timeframe:D', label: 'Daily', labelCn: '日线', context: ['chart'], priority: 12, enabled: true, category: 'chart' },
  { shortcutId: 'tf-W', key: '8', command: 'chart:timeframe:W', label: 'Weekly', labelCn: '周线', context: ['chart'], priority: 12, enabled: true, category: 'chart' },
  { shortcutId: 'tf-M', key: '9', command: 'chart:timeframe:M', label: 'Monthly', labelCn: '月线', context: ['chart'], priority: 12, enabled: true, category: 'chart' },

  // ── Indicator toggle ──
  { shortcutId: 'ind-toggle', key: 'Tab', command: 'indicator:toggle_overlay', label: 'Toggle Indicator', labelCn: '切换指标叠加', context: ['chart'], priority: 9, enabled: true, category: 'indicator' },

  // ── Drawing tools ──
  { shortcutId: 'draw-trendline', key: 'T', command: 'drawing:tool:trend-line', label: 'Trend Line', labelCn: '趋势线', context: ['chart'], priority: 7, enabled: true, category: 'drawing' },
  { shortcutId: 'draw-hline', key: 'H', command: 'drawing:tool:horizontal-line', label: 'Horizontal Line', labelCn: '水平线', context: ['chart'], priority: 7, enabled: true, category: 'drawing' },
  { shortcutId: 'draw-fib', key: 'F', command: 'drawing:tool:fib-retracement', label: 'Fibonacci', labelCn: '斐波那契', context: ['chart'], priority: 7, enabled: true, category: 'drawing' },
  { shortcutId: 'draw-text', key: 'X', command: 'drawing:tool:text', label: 'Text Note', labelCn: '文字标注', context: ['chart'], priority: 6, enabled: true, category: 'drawing' },
  { shortcutId: 'draw-toggle', key: 'R', command: 'drawing:toggle_visibility', label: 'Toggle Drawings', labelCn: '显示/隐藏画线', context: ['chart'], priority: 6, enabled: true, category: 'drawing' },

  // ── Undo/Redo ──
  { shortcutId: 'edit-undo', key: 'Ctrl+Z', command: 'drawing:undo', label: 'Undo Drawing', labelCn: '撤销画线', context: ['chart'], priority: 6, enabled: true, category: 'drawing' },
  { shortcutId: 'edit-redo', key: 'Ctrl+Y', command: 'drawing:redo', label: 'Redo Drawing', labelCn: '重做画线', context: ['chart'], priority: 6, enabled: true, category: 'drawing' },

  // ── Zoom ──
  { shortcutId: 'zoom-in', key: '=', command: 'chart:zoom_in', label: 'Zoom In', labelCn: '放大', context: ['chart'], priority: 8, enabled: true, category: 'chart' },
  { shortcutId: 'zoom-out', key: '-', command: 'chart:zoom_out', label: 'Zoom Out', labelCn: '缩小', context: ['chart'], priority: 8, enabled: true, category: 'chart' },
  { shortcutId: 'zoom-reset', key: '0', command: 'chart:zoom_reset', label: 'Reset Zoom', labelCn: '重置缩放', context: ['chart'], priority: 8, enabled: true, category: 'chart' },

  // ── General ──
  { shortcutId: 'general-escape', key: 'Escape', command: 'general:cancel', label: 'Cancel/Escape', labelCn: '取消', context: ['global'], priority: 4, enabled: true, category: 'general' },
  { shortcutId: 'general-help', key: '?', command: 'general:shortcut_help', label: 'Shortcut Help', labelCn: '快捷键帮助', context: ['global'], priority: 3, enabled: true, category: 'general' },
  { shortcutId: 'general-search', key: '/', command: 'general:search', label: 'Search Symbol', labelCn: '搜索股票', context: ['global'], priority: 5, enabled: true, category: 'general' },
  { shortcutId: 'general-fullscreen', key: 'Ctrl+Enter', command: 'general:fullscreen', label: 'Toggle Fullscreen', labelCn: '全屏切换', context: ['global'], priority: 5, enabled: true, category: 'general' },
  { shortcutId: 'general-darkmode', key: 'Ctrl+D', command: 'general:toggle_dark_mode', label: 'Toggle Dark Mode', labelCn: '切换暗色模式', context: ['global'], priority: 4, enabled: true, category: 'general' },
];

// ═══════════════════════════════════════════════════════════════════════════
// ShortcutIpcBridge
// ═══════════════════════════════════════════════════════════════════════════

export class ShortcutIpcBridge {
  private shortcuts: Map<string, ShortcutDef> = new Map();
  private keyIndex: Map<string, string[]> = new Map();  // key → [shortcutId, ...]
  private disabledIds: Set<string> = new Set();
  private eventLog: ShortcutEvent[] = [];
  private customShortcuts: ShortcutDef[] = [];

  constructor() {
    this._initDefaults();
  }

  // ── Public API: Registration ────────────────────────────────────────────

  /**
   * Register a shortcut (called from IPC main or renderer).
   */
  register(shortcut: Omit<ShortcutDef, 'enabled'> & { enabled?: boolean }): ShortcutDef {
    const def: ShortcutDef = { ...shortcut, enabled: shortcut.enabled ?? true };
    this.shortcuts.set(def.shortcutId, def);

    // Rebuild key index
    const ids = this.keyIndex.get(def.key) ?? [];
    if (!ids.includes(def.shortcutId)) ids.push(def.shortcutId);
    this.keyIndex.set(def.key, ids);

    return def;
  }

  /**
   * Unregister a shortcut.
   */
  unregister(shortcutId: string): boolean {
    const def = this.shortcuts.get(shortcutId);
    if (!def) return false;

    this.shortcuts.delete(shortcutId);
    const ids = this.keyIndex.get(def.key) ?? [];
    this.keyIndex.set(def.key, ids.filter(id => id !== shortcutId));

    return true;
  }

  // ── Public API: Dispatch ────────────────────────────────────────────────

  /**
   * Main process receives key event → resolve to command + context check.
   * Returns the winning shortcut (or null if no match/disabled).
   */
  dispatchKey(key: string, context: ShortcutContext): ShortcutEvent | null {
    const ids = this.keyIndex.get(key);
    if (!ids || ids.length === 0) return null;

    // Filter to enabled, context-matching shortcuts
    const candidates = ids
      .map(id => this.shortcuts.get(id)!)
      .filter(s => s && s.enabled && !this.disabledIds.has(s.shortcutId))
      .filter(s => s.context.includes(context) || s.context.includes('global'))
      .sort((a, b) => b.priority - a.priority);

    if (candidates.length === 0) return null;

    const winner = candidates[0];
    const event: ShortcutEvent = {
      shortcutId: winner.shortcutId,
      command: winner.command,
      key: winner.key,
      context,
      timestamp: Date.now(),
      source: 'main',
    };

    this.eventLog.push(event);
    if (this.eventLog.length > 500) this.eventLog.shift();

    return event;
  }

  // ── Public API: Toggle ──────────────────────────────────────────────────

  /** Enable/disable a single shortcut */
  setEnabled(shortcutId: string, enabled: boolean): void {
    const s = this.shortcuts.get(shortcutId);
    if (s) s.enabled = enabled;
  }

  /** Disable all shortcuts in a category */
  setCategoryEnabled(category: ShortcutDef['category'], enabled: boolean): void {
    for (const [, s] of this.shortcuts) {
      if (s.category === category) s.enabled = enabled;
    }
  }

  /** Disable all shortcuts globally */
  setGlobalEnabled(enabled: boolean): void {
    for (const [, s] of this.shortcuts) {
      s.enabled = enabled;
    }
  }

  /** Disable a set of shortcuts by ID (for modal/input focus) */
  disableIds(ids: string[]): void {
    for (const id of ids) this.disabledIds.add(id);
  }

  /** Re-enable previously disabled IDs */
  enableIds(ids: string[]): void {
    for (const id of ids) this.disabledIds.delete(id);
  }

  // ── Public API: Conflict Detection ──────────────────────────────────────

  /**
   * Detect key binding conflicts.
   */
  detectConflicts(): ShortcutConflict[] {
    const conflicts: ShortcutConflict[] = [];

    for (const [key, ids] of this.keyIndex) {
      if (ids.length <= 1) continue;
      const shortcuts = ids.map(id => this.shortcuts.get(id)!).filter(Boolean);
      const byPriority = [...shortcuts].sort((a, b) => b.priority - a.priority);

      conflicts.push({
        key,
        shortcuts,
        resolution: `${byPriority[0].shortcutId} wins (p${byPriority[0].priority} > p${byPriority[1]?.priority ?? 0})`,
        resolutionCn: `${byPriority[0].labelCn} 优先 (优先级${byPriority[0].priority})`,
      });
    }

    return conflicts;
  }

  // ── Public API: Help / Guide ────────────────────────────────────────────

  /**
   * Get shortcuts grouped by category (for help overlay).
   */
  getCategoryGuides(context?: ShortcutContext): ShortcutCategoryGuide[] {
    const categories: Record<string, ShortcutDef[]> = {};

    for (const [, s] of this.shortcuts) {
      if (context && !s.context.includes(context) && !s.context.includes('global')) continue;
      if (!s.enabled) continue;
      const cat = categories[s.category] ?? [];
      cat.push(s);
      categories[s.category] = cat;
    }

    return Object.entries(categories).map(([cat, shortcuts]) => ({
      category: cat,
      categoryCn: this._categoryCn(cat),
      shortcuts,
    }));
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get all registered shortcuts */
  getAll(): ShortcutDef[] { return Array.from(this.shortcuts.values()); }

  /** Get by command */
  getByCommand(command: string): ShortcutDef | null {
    for (const [, s] of this.shortcuts) {
      if (s.command === command) return s;
    }
    return null;
  }

  /** Get event log */
  getEventLog(limit = 50): ShortcutEvent[] {
    return this.eventLog.slice(-limit).reverse();
  }

  /** Get count */
  getCount(): number { return this.shortcuts.size; }

  /** Reset to defaults */
  reset(): void {
    this.shortcuts.clear();
    this.keyIndex.clear();
    this.disabledIds.clear();
    this.eventLog = [];
    this.customShortcuts = [];
    this._initDefaults();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _initDefaults(): void {
    for (const s of DEFAULT_SHORTCUTS) {
      this.register(s);
    }
  }

  private _categoryCn(cat: string): string {
    const map: Record<string, string> = {
      chart: '图表操作', navigate: '导航', drawing: '画线工具',
      indicator: '技术指标', general: '通用',
    };
    return map[cat] ?? cat;
  }
}

export const shortcutIpcBridge = new ShortcutIpcBridge();
