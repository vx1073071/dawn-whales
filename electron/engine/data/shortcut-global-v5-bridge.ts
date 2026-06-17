/**
 * R271 快捷键全局注册 v5.0
 * 
 * 增强 ShortcutIpcBridge:
 *   全局Electron加速器注册 (跨所有窗口)
 *   多窗口协调 (main/mini/chart-N)
 *   系统级热键 vs 应用级热键
 *   快捷键优先级解析 (全局 > 上下文)
 *   活动上下文切换
 *   键盘序列 (和弦) 支持
 *   冲突检测+解决方案
 *   快捷键别名
 */
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type ShortcutContext = 'global' | 'chart' | 'watchlist' | 'trading' | 'drawing';
export type ShortcutAction = string; // command ID

export interface ShortcutDef {
  id: string;
  name: string;
  nameCn: string;
  keys: string;            // e.g. 'Ctrl+T', 'Alt+1', 'Shift+Drag'
  action: ShortcutAction;
  context: ShortcutContext;
  description: string;
  descriptionCn: string;
  category: ShortcutCategory;
  isSystemLevel?: boolean; // System-level (works even when app is in background)
  isChord?: boolean;       // Part of a multi-key sequence
  chordSequence?: string[]; // e.g. ['Ctrl+K', 'Ctrl+S'] — press Ctrl+K then Ctrl+S
}

export type ShortcutCategory = 'navigation' | 'chart' | 'drawing' | 'trading' | 'window' | 'workspace' | 'tools';

export interface ShortcutEvent {
  shortcutId: string;
  action: ShortcutAction;
  keys: string;
  context: ShortcutContext;
  source: string; // window ID
  handled: boolean;
  timestamp: number;
}

export interface ShortcutConflict {
  shortcutId: string;
  key: string;
  conflictsWith: string[];
  suggestedKeys: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface ShortcutCategoryGuide {
  category: ShortcutCategory;
  name: string;
  nameCn: string;
  shortcuts: string[];
}

export interface ActiveContext {
  context: ShortcutContext;
  windowId: string;
  activatedAt: number;
}

// ── Default Global Shortcuts (TradingView-compatible) ──────────────────────

const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  // Navigation
  { id: 'nav-symbol', name: 'Search Symbol', nameCn: '搜索代码', keys: 'Ctrl+T', action: 'search_sym', context: 'global', description: 'Open symbol search', descriptionCn: '打开代码搜索', category: 'navigation' },
  { id: 'nav-indicator', name: 'Indicators', nameCn: '技术指标', keys: 'Ctrl+I', action: 'indicators', context: 'global', description: 'Open indicators panel', descriptionCn: '打开技术指标面板', category: 'navigation' },
  { id: 'nav-watchlist', name: 'Watchlist', nameCn: '自选股', keys: 'Ctrl+W', action: 'watchlist', context: 'global', description: 'Open watchlist', descriptionCn: '打开自选股', category: 'navigation' },
  { id: 'nav-trade', name: 'Trading Panel', nameCn: '交易面板', keys: 'Ctrl+E', action: 'trading_panel', context: 'global', description: 'Open trading panel', descriptionCn: '打开交易面板', category: 'navigation' },
  { id: 'nav-settings', name: 'Settings', nameCn: '设置', keys: 'Ctrl+,', action: 'settings', context: 'global', description: 'Open settings', descriptionCn: '打开设置', category: 'navigation' },
  { id: 'nav-fullscreen', name: 'Toggle Fullscreen', nameCn: '全屏切换', keys: 'F11', action: 'toggle_fullscreen', context: 'global', description: 'Toggle fullscreen mode', descriptionCn: '切换全屏模式', category: 'navigation' },
  { id: 'nav-mini-window', name: 'Mini Window', nameCn: '迷你窗口', keys: 'Ctrl+Shift+M', action: 'toggle_mini', context: 'global', description: 'Toggle mini window', descriptionCn: '切换迷你窗口', category: 'window' },

  // Chart
  { id: 'chart-tf-1m', name: '1 Minute', nameCn: '1分钟', keys: '1', action: 'tf_1m', context: 'chart', description: 'Switch to 1-minute chart', descriptionCn: '切换到1分钟K线', category: 'chart' },
  { id: 'chart-tf-5m', name: '5 Minutes', nameCn: '5分钟', keys: '2', action: 'tf_5m', context: 'chart', description: 'Switch to 5-minute chart', descriptionCn: '切换到5分钟K线', category: 'chart' },
  { id: 'chart-tf-15m', name: '15 Minutes', nameCn: '15分钟', keys: '3', action: 'tf_15m', context: 'chart', description: 'Switch to 15-minute chart', descriptionCn: '切换到15分钟K线', category: 'chart' },
  { id: 'chart-tf-1h', name: '1 Hour', nameCn: '1小时', keys: '4', action: 'tf_1h', context: 'chart', description: 'Switch to 1-hour chart', descriptionCn: '切换到1小时K线', category: 'chart' },
  { id: 'chart-tf-4h', name: '4 Hours', nameCn: '4小时', keys: '5', action: 'tf_4h', context: 'chart', description: 'Switch to 4-hour chart', descriptionCn: '切换到4小时K线', category: 'chart' },
  { id: 'chart-tf-D', name: 'Daily', nameCn: '日K', keys: 'D', action: 'tf_daily', context: 'chart', description: 'Switch to daily chart', descriptionCn: '切换到日K线', category: 'chart' },
  { id: 'chart-tf-W', name: 'Weekly', nameCn: '周K', keys: 'W', action: 'tf_weekly', context: 'chart', description: 'Switch to weekly chart', descriptionCn: '切换到周K线', category: 'chart' },
  { id: 'chart-tf-M', name: 'Monthly', nameCn: '月K', keys: 'M', action: 'tf_monthly', context: 'chart', description: 'Switch to monthly chart', descriptionCn: '切换到月K线', category: 'chart' },
  { id: 'chart-zoom-in', name: 'Zoom In', nameCn: '放大', keys: 'Ctrl++', action: 'zoom_in', context: 'chart', description: 'Zoom chart in', descriptionCn: '放大图表', category: 'chart' },
  { id: 'chart-zoom-out', name: 'Zoom Out', nameCn: '缩小', keys: 'Ctrl+-', action: 'zoom_out', context: 'chart', description: 'Zoom chart out', descriptionCn: '缩小图表', category: 'chart' },
  { id: 'chart-scroll-left', name: 'Scroll Left', nameCn: '左移', keys: 'Left', action: 'scroll_left', context: 'chart', description: 'Scroll chart left', descriptionCn: '图表左移', category: 'chart' },
  { id: 'chart-scroll-right', name: 'Scroll Right', nameCn: '右移', keys: 'Right', action: 'scroll_right', context: 'chart', description: 'Scroll chart right', descriptionCn: '图表右移', category: 'chart' },
  { id: 'chart-goto-latest', name: 'Go to Latest', nameCn: '回到最新', keys: 'End', action: 'goto_latest', context: 'chart', description: 'Go to latest bar', descriptionCn: '跳到最新K线', category: 'chart' },
  { id: 'chart-crosshair', name: 'Crosshair', nameCn: '十字光标', keys: 'Alt+C', action: 'toggle_crosshair', context: 'chart', description: 'Toggle crosshair mode', descriptionCn: '切换十字光标', category: 'chart' },

  // Drawing
  { id: 'draw-horizontal', name: 'Horizontal Line', nameCn: '水平线', keys: 'Alt+H', action: 'draw_horizontal', context: 'drawing', description: 'Draw horizontal line', descriptionCn: '画水平线', category: 'drawing' },
  { id: 'draw-trend', name: 'Trend Line', nameCn: '趋势线', keys: 'Alt+T', action: 'draw_trend', context: 'drawing', description: 'Draw trend line', descriptionCn: '画趋势线', category: 'drawing' },
  { id: 'draw-fib', name: 'Fib Retracement', nameCn: '斐波回撤', keys: 'Alt+F', action: 'draw_fib', context: 'drawing', description: 'Draw Fibonacci retracement', descriptionCn: '画斐波那契回撤', category: 'drawing' },
  { id: 'draw-rectangle', name: 'Rectangle', nameCn: '矩形', keys: 'Alt+R', action: 'draw_rectangle', context: 'drawing', description: 'Draw rectangle', descriptionCn: '画矩形', category: 'drawing' },
  { id: 'draw-text', name: 'Text', nameCn: '文字', keys: 'Alt+X', action: 'draw_text', context: 'drawing', description: 'Add text annotation', descriptionCn: '添加文字标注', category: 'drawing' },
  { id: 'draw-undraw', name: 'Remove All Drawings', nameCn: '清除画线', keys: 'Alt+Delete', action: 'draw_remove_all', context: 'drawing', description: 'Remove all drawings on current chart', descriptionCn: '清除当前图表所有画线', category: 'drawing' },

  // Trading
  { id: 'trade-buy', name: 'Buy', nameCn: '买入', keys: 'Ctrl+B', action: 'order_buy', context: 'trading', description: 'Open buy order', descriptionCn: '打开买入下单', category: 'trading' },
  { id: 'trade-sell', name: 'Sell', nameCn: '卖出', keys: 'Ctrl+S', action: 'order_sell', context: 'trading', description: 'Open sell order', descriptionCn: '打开卖出下单', category: 'trading' },
  { id: 'trade-close', name: 'Close Position', nameCn: '平仓', keys: 'Ctrl+Shift+C', action: 'order_close', context: 'trading', description: 'Close current position', descriptionCn: '平掉当前仓位', category: 'trading' },

  // Window
  { id: 'win-close', name: 'Close Window', nameCn: '关闭窗口', keys: 'Ctrl+W', action: 'close_window', context: 'global', description: 'Close active window', descriptionCn: '关闭当前窗口', category: 'window' },
  { id: 'win-new', name: 'New Window', nameCn: '新窗口', keys: 'Ctrl+N', action: 'new_window', context: 'global', description: 'Open new window', descriptionCn: '打开新窗口', category: 'window' },
  { id: 'win-switch', name: 'Switch Window', nameCn: '切换窗口', keys: 'Ctrl+Tab', action: 'switch_window', context: 'global', description: 'Switch between windows', descriptionCn: '在窗口间切换', category: 'window' },

  // Workspace
  { id: 'ws-save', name: 'Save Layout', nameCn: '保存布局', keys: 'Ctrl+Shift+S', action: 'save_layout', context: 'global', description: 'Save current layout', descriptionCn: '保存当前布局', category: 'workspace' },
  { id: 'ws-load', name: 'Load Layout', nameCn: '加载布局', keys: 'Ctrl+Shift+L', action: 'load_layout', context: 'global', description: 'Load saved layout', descriptionCn: '加载布局', category: 'workspace' },
  { id: 'ws-screenshot', name: 'Screenshot', nameCn: '截图', keys: 'Ctrl+Shift+P', action: 'screenshot', context: 'global', description: 'Take screenshot of chart', descriptionCn: '图表截图', category: 'workspace' },

  // Tools
  { id: 'tool-calc', name: 'Calculator', nameCn: '计算器', keys: 'Ctrl+Shift+K', action: 'open_calculator', context: 'global', description: 'Open position size calculator', descriptionCn: '打开仓位计算器', category: 'tools' },
  { id: 'tool-help', name: 'Shortcut Help', nameCn: '快捷键帮助', keys: '?', action: 'shortcut_help', context: 'global', description: 'Show all shortcuts', descriptionCn: '显示所有快捷键', category: 'tools' },
];

// ── v5 Global Shortcut Bridge ──────────────────────────────────────────────

export class ShortcutGlobalV5Bridge extends EventEmitter {
  private shortcuts_: ShortcutDef[] = [...DEFAULT_SHORTCUTS];
  private handlers_: Map<ShortcutAction, Set<(ev: ShortcutEvent) => void>> = new Map();
  private contexts_: Map<string, ActiveContext> = new Map(); // windowId → active context
  private chordBuffer_: Map<string, string[]> = new Map();  // windowId → pending chord keys
  private readonly CHORD_TIMEOUT = 2000;                     // 2s to complete chord
  private chordTimers_: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // ── Registration ──────────────────────────────────────────────────────

  /** Register a custom shortcut */
  registerShortcut(def: ShortcutDef): { success: boolean; conflict?: ShortcutConflict } {
    // Conflict check
    const conflict = this._checkConflict(def.keys, def.id, def.context);
    if (conflict && conflict.severity === 'high') {
      return { success: false, conflict };
    }

    // Don't duplicate
    const existing = this.shortcuts_.find(s => s.id === def.id);
    if (existing) Object.assign(existing, def);
    else this.shortcuts_.push(def);

    return { success: true, conflict };
  }

  /** Unregister a shortcut */
  unregisterShortcut(shortcutId: string): boolean {
    const idx = this.shortcuts_.findIndex(s => s.id === shortcutId);
    if (idx < 0) return false;
    this.shortcuts_.splice(idx, 1);
    return true;
  }

  /** Replace all global-default shortcuts */
  resetToDefaults(): void {
    this.shortcuts_ = [...DEFAULT_SHORTCUTS];
  }

  /** Override a shortcut's key binding */
  rebindShortcut(shortcutId: string, newKeys: string): boolean {
    const shortcut = this.shortcuts_.find(s => s.id === shortcutId);
    if (!shortcut) return false;
    shortcut.keys = newKeys;
    return true;
  }

  // ── Key Handling ──────────────────────────────────────────────────────

  /**
   * Handle key press. Route to correct handler based on active context.
   * @param keys Normalized key combo (e.g. 'Ctrl+T')
   * @param windowId Source window ID
   * @returns Whether the shortcut was handled
   */
  handleKeyPress(keys: string, windowId: string): boolean {
    const active = this.contexts_.get(windowId);
    const context = active?.context || 'global';

    // Check chord buffer first
    const chord = this.chordBuffer_.get(windowId);
    if (chord) {
      chord.push(keys);
      // Try to match chord sequence
      for (const s of this.shortcuts_) {
        if (s.isChord && s.chordSequence && this._chordMatches(chord, s.chordSequence)) {
          return this._fireShortcut(s, windowId, context);
        }
      }
      return false; // waiting for next key in chord
    }

    // Find matching shortcut (context > global fallback)
    let match = this.shortcuts_.find(s => s.keys === keys && s.context === context);
    if (!match) {
      match = this.shortcuts_.find(s => s.keys === keys && s.context === 'global');
    }
    if (!match) return false;

    // If chord, start chord buffer
    if (match.isChord && match.chordSequence && match.chordSequence.length > 1) {
      this.chordBuffer_.set(windowId, [keys]);
      const timer = setTimeout(() => this.chordBuffer_.delete(windowId), this.CHORD_TIMEOUT);
      this.chordTimers_.set(windowId, timer);
      return false;
    }

    return this._fireShortcut(match, windowId, context);
  }

  private _fireShortcut(shortcut: ShortcutDef, windowId: string, activeContext: ShortcutContext): boolean {
    const ev: ShortcutEvent = {
      shortcutId: shortcut.id, action: shortcut.action,
      keys: shortcut.keys, context: activeContext,
      source: windowId, handled: false, timestamp: Date.now(),
    };

    // Fire specific action handler
    const handlers = this.handlers_.get(shortcut.action);
    if (handlers) {
      for (const h of handlers) {
        h(ev);
        if (ev.handled) break; // Stop propagation when handled
      }
    }

    return ev.handled;
  }

  private _chordMatches(pressed: string[], sequence: string[]): boolean {
    if (pressed.length !== sequence.length) return false;
    return pressed.every((k, i) => k === sequence[i]);
  }

  // ── Context Management ────────────────────────────────────────────────

  /** Activate a context for a window */
  activateContext(windowId: string, ctx: ShortcutContext): void {
    const prev = this.contexts_.get(windowId);
    this.contexts_.set(windowId, { context: ctx, windowId, activatedAt: Date.now() });
    // Emit context change
    this.emit('context_change', { previous: prev, current: this.contexts_.get(windowId) });
  }

  /** Get active context for a window */
  getActiveContext(windowId: string): ShortcutContext {
    return this.contexts_.get(windowId)?.context || 'global';
  }

  /** Deregister a window (cleanup on close) */
  deregisterWindow(windowId: string): void {
    this.contexts_.delete(windowId);
    this.chordBuffer_.delete(windowId);
    const timer = this.chordTimers_.get(windowId);
    if (timer) { clearTimeout(timer); this.chordTimers_.delete(windowId); }
  }

  // ── Handler Registration ──────────────────────────────────────────────

  /** Register handler for a specific action */
  onAction(action: ShortcutAction, handler: (ev: ShortcutEvent) => void): () => void {
    if (!this.handlers_.has(action)) this.handlers_.set(action, new Set());
    this.handlers_.get(action)!.add(handler);
    return () => this.handlers_.get(action)?.delete(handler);
  }

  // ── Conflict Detection ────────────────────────────────────────────────

  /** Detect all key binding conflicts */
  detectConflicts(): ShortcutConflict[] {
    const conflicts: ShortcutConflict[] = [];
    const keyMap: Map<string, string[]> = new Map();

    for (const s of this.shortcuts_) {
      const key = `${s.keys}:${s.context}`;
      if (!keyMap.has(key)) keyMap.set(key, []);
      keyMap.get(key)!.push(s.id);
    }

    for (const [key, ids] of keyMap.entries()) {
      if (ids.length > 1) {
        const [keysStr, ctx] = key.split(':');
        conflicts.push({
          shortcutId: ids[0],
          key: keysStr,
          conflictsWith: ids.slice(1),
          suggestedKeys: this._suggestAlternativeKeys(keysStr),
          severity: 'high',
        });
      }
    }

    // Also detect cross-context conflicts (same key, different context)
    const keyOnly: Map<string, Array<{ id: string; ctx: string }>> = new Map();
    for (const s of this.shortcuts_) {
      if (!keyOnly.has(s.keys)) keyOnly.set(s.keys, []);
      keyOnly.get(s.keys)!.push({ id: s.id, ctx: s.context });
    }
    for (const [key, entries] of keyOnly.entries()) {
      const contexts = new Set(entries.map(e => e.ctx));
      if (contexts.size > 1) {
        for (const entry of entries) {
          const existing = conflicts.find(c => c.shortcutId === entry.id);
          if (!existing) {
            conflicts.push({
              shortcutId: entry.id,
              key,
              conflictsWith: entries.filter(e => e.id !== entry.id).map(e => `${e.id}(${e.ctx})`),
              suggestedKeys: [],
              severity: 'medium',
            });
          }
        }
      }
    }

    return conflicts;
  }

  private _checkConflict(keys: string, exceptId: string, context: ShortcutContext): ShortcutConflict | undefined {
    const same = this.shortcuts_.filter(s => s.keys === keys && s.context === context && s.id !== exceptId);
    if (same.length > 0) {
      return {
        shortcutId: exceptId,
        key: keys,
        conflictsWith: same.map(s => s.id),
        suggestedKeys: this._suggestAlternativeKeys(keys),
        severity: 'high',
      };
    }
    const crossContext = this.shortcuts_.filter(s => s.keys === keys && s.context !== context && s.id !== exceptId);
    if (crossContext.length > 0) {
      return {
        shortcutId: exceptId,
        key: keys,
        conflictsWith: crossContext.map(s => `${s.id}(${s.context})`),
        suggestedKeys: [],
        severity: 'medium',
      };
    }
    return undefined;
  }

  private _suggestAlternativeKeys(keys: string): string[] {
    const mods = ['Ctrl+', 'Alt+', 'Shift+', 'Ctrl+Shift+', 'Alt+Shift+'];
    const base = keys.replace(/^(Ctrl\+|Alt\+|Shift\+|Ctrl\+Shift\+|Alt\+Shift\+)+/, '');
    return mods.filter(m => m + base !== keys).map(m => m + base);
  }

  // ── Queries ───────────────────────────────────────────────────────────

  getAllShortcuts(): ShortcutDef[] {
    return [...this.shortcuts_];
  }

  getShortcutsByCategory(): Map<ShortcutCategory, ShortcutDef[]> {
    const map = new Map<ShortcutCategory, ShortcutDef[]>();
    for (const s of this.shortcuts_) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return map;
  }

  getShortcutsByContext(ctx: ShortcutContext): ShortcutDef[] {
    return this.shortcuts_.filter(s => s.context === ctx);
  }

  getShortcut(id: string): ShortcutDef | undefined {
    return this.shortcuts_.find(s => s.id === id);
  }

  getCategoryGuides(): ShortcutCategoryGuide[] {
    const byCategory = this.getShortcutsByCategory();
    return Array.from(byCategory.entries()).map(([category, defs]) => ({
      category,
      name: category, nameCn: this._categoryCn(category),
      shortcuts: defs.map(d => `${d.keys} — ${d.nameCn}`),
    }));
  }

  private _categoryCn(cat: ShortcutCategory): string {
    const map: Record<ShortcutCategory, string> = {
      navigation: '导航', chart: '图表', drawing: '画线',
      trading: '交易', window: '窗口', workspace: '工作区', tools: '工具',
    };
    return map[cat] || cat;
  }

  getTotalCount(): number { return this.shortcuts_.length; }

  // Enable/disable
  private disabled_: Set<string> = new Set();

  disableShortcut(id: string): void { this.disabled_.add(id); }
  enableShortcut(id: string): void { this.disabled_.delete(id); }
  isDisabled(id: string): boolean { return this.disabled_.has(id); }

  reset(): void {
    this.shortcuts_ = [...DEFAULT_SHORTCUTS];
    this.handlers_ = new Map();
    this.contexts_ = new Map();
    this.disabled_ = new Set();
    this.chordBuffer_ = new Map();
    for (const t of this.chordTimers_.values()) clearTimeout(t);
    this.chordTimers_ = new Map();
  }
}

export const shortcutGlobalV5Bridge = new ShortcutGlobalV5Bridge();
