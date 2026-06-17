/**
 * R257 P0-3: Tray桥接 (TrayIpcBridge)
 * 
 * Electron Tray + 迷你窗口 IPC 数据桥接
 * 连接引擎数据层 → Electron 托盘/迷你窗口 UI
 * 
 * 功能:
 *   1. Tray图标状态管理 (正常/异动/告警/离线)
 *   2. 迷你窗口数据推送 (自选股实时行情)
 *   3. 托盘右键菜单IPC命令
 *   4. 迷你窗口生命周期管理
 *   5. Watchlist增量更新
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type TrayState = 'normal' | 'active' | 'alert' | 'offline';

export interface TrayQuote {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  changeAmount: number;
  volume: number;
  market: 'US' | 'HK' | 'A' | 'CRYPTO';
  updatedAt: number;
}

export interface MiniWindowConfig {
  width: number;
  height: number;
  position: 'tray_above' | 'center' | 'mouse';
  alwaysOnTop: boolean;
  autoHide: boolean;
  autoHideDelayMs: number;
  showNews: boolean;
  showSignals: boolean;
  maxItems: number;
}

export interface TrayMenuAction {
  id: string;
  label: string;
  shortcut?: string;
  enabled: boolean;
  checked?: boolean;
}

export interface TrayIpcEvent {
  eventId: string;
  type: 'tray_state_change' | 'mini_window_toggle' | 'menu_click' | 'quote_update' | 'alert_trigger';
  data: Record<string, unknown>;
  timestamp: number;
}

export interface WatchlistSnapshot {
  symbols: string[];
  quotes: TrayQuote[];
  totalChange: number;          // portfolio-level % change
  totalChangeAmount: number;
  alertCount: number;           // active alerts
  updatedAt: number;
}

// ── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_MINI_CONFIG: MiniWindowConfig = {
  width: 320,
  height: 400,
  position: 'tray_above',
  alwaysOnTop: true,
  autoHide: true,
  autoHideDelayMs: 3000,
  showNews: false,
  showSignals: true,
  maxItems: 8,
};

// ═══════════════════════════════════════════════════════════════════════════
// TrayIpcBridge
// ═══════════════════════════════════════════════════════════════════════════

export class TrayIpcBridge {
  private config: MiniWindowConfig;
  private state: TrayState = 'offline';
  private quotes: Map<string, TrayQuote> = new Map();
  private watchlist: Set<string> = new Set();
  private events: TrayIpcEvent[] = [];
  private miniWindowVisible = false;
  private alertCount = 0;
  private menuActions: TrayMenuAction[] = [];

  constructor(config?: Partial<MiniWindowConfig>) {
    this.config = { ...DEFAULT_MINI_CONFIG, ...config };
    this._initMenuActions();
  }

  // ── Public API: Tray State ──────────────────────────────────────────────

  /** Set the tray icon state and emit event */
  setTrayState(newState: TrayState): TrayIpcEvent {
    this.state = newState;
    return this._emit('tray_state_change', { state: newState });
  }

  /** Get current tray state */
  getTrayState(): TrayState {
    return this.state;
  }

  /** Trigger tray alert (flash/blink) */
  triggerAlert(reason: string, symbol?: string): TrayIpcEvent {
    this.alertCount++;
    return this._emit('alert_trigger', { reason, symbol, alertCount: this.alertCount });
  }

  /** Clear alert state */
  clearAlerts(): void {
    this.alertCount = 0;
  }

  // ── Public API: Mini Window ─────────────────────────────────────────────

  /** Toggle mini window visibility */
  toggleMiniWindow(): TrayIpcEvent {
    this.miniWindowVisible = !this.miniWindowVisible;
    return this._emit('mini_window_toggle', { visible: this.miniWindowVisible });
  }

  /** Show mini window */
  showMiniWindow(): TrayIpcEvent {
    if (this.miniWindowVisible) {
      return this._emit('mini_window_toggle', { visible: true });
    }
    this.miniWindowVisible = true;
    return this._emit('mini_window_toggle', { visible: true });
  }

  /** Hide mini window */
  hideMiniWindow(): TrayIpcEvent {
    if (!this.miniWindowVisible) {
      return this._emit('mini_window_toggle', { visible: false });
    }
    this.miniWindowVisible = false;
    return this._emit('mini_window_toggle', { visible: false });
  }

  /** Get mini window visibility */
  isMiniWindowVisible(): boolean {
    return this.miniWindowVisible;
  }

  // ── Public API: Quote Feed ──────────────────────────────────────────────

  /**
   * Register a watchlist for the mini window.
   * Quotes for these symbols will be pushed to the mini window.
   */
  registerWatchlist(symbols: string[]): void {
    this.watchlist = new Set(symbols);
    // Clean up quotes for removed symbols
    for (const sym of this.quotes.keys()) {
      if (!this.watchlist.has(sym)) this.quotes.delete(sym);
    }
  }

  /**
   * Push a batch of quotes to the mini window.
   * Only symbols in the registered watchlist are kept.
   */
  pushQuotes(quotes: TrayQuote[]): TrayIpcEvent {
    let changed = false;

    for (const q of quotes) {
      if (!this.watchlist.has(q.symbol)) continue;
      const existing = this.quotes.get(q.symbol);
      if (!existing || this._hasChanged(existing, q)) {
        this.quotes.set(q.symbol, q);
        changed = true;
      }
    }

    if (changed) {
      return this._emit('quote_update', {
        quotes: this.getWatchlistSnapshot(),
        count: this.quotes.size,
      });
    }

    return {
      eventId: `evt:no_change:${Date.now()}`,
      type: 'quote_update',
      data: { quotes: this.getWatchlistSnapshot(), count: this.quotes.size, unchanged: true },
      timestamp: Date.now(),
    };
  }

  /** Get a snapshot of the current watchlist */
  getWatchlistSnapshot(): WatchlistSnapshot {
    const quoteList = Array.from(this.quotes.values());
    const totalChange = quoteList.reduce((sum, q) => sum + q.changePercent, 0);
    const totalChangeAmount = quoteList.reduce((sum, q) => sum + q.changeAmount, 0);

    return {
      symbols: Array.from(this.watchlist),
      quotes: quoteList.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)),
      totalChange: Math.round(totalChange * 100) / 100,
      totalChangeAmount: Math.round(totalChangeAmount * 100) / 100,
      alertCount: this.alertCount,
      updatedAt: Date.now(),
    };
  }

  /** Get latest quote for a symbol */
  getQuote(symbol: string): TrayQuote | null {
    return this.quotes.get(symbol) ?? null;
  }

  // ── Public API: Menu Actions ────────────────────────────────────────────

  /** Get tray right-click menu items */
  getMenuActions(): TrayMenuAction[] {
    return this.menuActions.map(a => ({ ...a }));
  }

  /** Handle a menu item click */
  handleMenuClick(actionId: string): TrayIpcEvent {
    const action = this.menuActions.find(a => a.id === actionId);
    if (!action || !action.enabled) {
      return this._emit('menu_click', { actionId, handled: false, error: 'Action not available' });
    }

    switch (actionId) {
      case 'toggle_mini':
        this.toggleMiniWindow();
        break;
      case 'show_main':
        // IPC: mainWindow.show() / mainWindow.focus()
        break;
      case 'toggle_alerts':
        const alertAction = this.menuActions.find(a => a.id === 'toggle_alerts');
        if (alertAction) alertAction.checked = !alertAction.checked;
        break;
      case 'exit':
        // IPC: app.quit()
        break;
    }

    return this._emit('menu_click', { actionId, handled: true });
  }

  // ── Public API: Config ──────────────────────────────────────────────────

  getConfig(): MiniWindowConfig {
    return { ...this.config };
  }

  updateConfig(patch: Partial<MiniWindowConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  // ── Public API: Events ──────────────────────────────────────────────────

  getEvents(limit = 50): TrayIpcEvent[] {
    return this.events.slice(-limit).reverse();
  }

  reset(): void {
    this.state = 'offline';
    this.quotes.clear();
    this.watchlist.clear();
    this.events = [];
    this.miniWindowVisible = false;
    this.alertCount = 0;
    this._initMenuActions();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _hasChanged(oldQ: TrayQuote, newQ: TrayQuote): boolean {
    return (
      oldQ.price !== newQ.price ||
      oldQ.changePercent !== newQ.changePercent ||
      oldQ.volume !== newQ.volume
    );
  }

  private _emit(type: TrayIpcEvent['type'], data: Record<string, unknown>): TrayIpcEvent {
    const event: TrayIpcEvent = {
      eventId: `evt:${type}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      type,
      data,
      timestamp: Date.now(),
    };
    this.events.push(event);
    if (this.events.length > 500) this.events.shift();
    return event;
  }

  private _initMenuActions(): void {
    this.menuActions = [
      { id: 'toggle_mini',    label: '迷你行情窗口', shortcut: 'Ctrl+Shift+M', enabled: true },
      { id: 'show_main',      label: '打开主窗口',    shortcut: 'Ctrl+Shift+O', enabled: true },
      { id: 'toggle_alerts',  label: '推送通知',       enabled: true, checked: true },
      { id: 'separator_1',    label: '─────────────',  enabled: false },
      { id: 'exit',           label: '退出 QUANT MOO',                     enabled: true },
    ];
  }
}

export const trayIpcBridge = new TrayIpcBridge();
