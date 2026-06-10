// ── JVS-108: User Preferences — 用户偏好系统 ───────────────────────────────
// 持久化用户配置: UI偏好、交易偏好、通知偏好、布局设置
// 存储: SQLite (通过 DatabaseManager) + JSON 文件备份

import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en-US' | 'zh-TW';
  fontSize: 'small' | 'medium' | 'large';
  sidebarCollapsed: boolean;
  chartType: 'candlestick' | 'line' | 'area';
  chartInterval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
  defaultMarket: 'US' | 'HK' | 'CN' | 'CRYPTO';
  dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  timeFormat: '24h' | '12h';
  animationsEnabled: boolean;
  compactMode: boolean;
}

export interface TradingPreferences {
  defaultBroker: string;
  defaultAccountId: string;
  defaultOrderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  defaultTimeInForce: 'GTC' | 'DAY' | 'IOC' | 'FOK';
  confirmBeforeTrade: boolean;
  oneClickTrading: boolean;
  defaultQuantity: number;
  maxPositionSize: number;        // percentage of portfolio
  defaultStopLossPct: number;     // default stop loss %
  defaultTakeProfitPct: number;   // default take profit %
  autoRefreshIntervalSec: number; // account/portfolio refresh interval
  tradingHoursOnly: boolean;      // only show signals during trading hours
}

export interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  tradeSignals: boolean;
  riskAlerts: boolean;
  systemAlerts: boolean;
  priceAlerts: boolean;
  newsAlerts: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;  // "22:00"
  quietHoursEnd: string;    // "08:00"
  emailAlerts: boolean;
  emailAddress: string;
}

export interface LayoutPreferences {
  dashboardLayout: string;       // JSON string of widget positions
  watchlistColumns: string[];    // visible columns in watchlist
  pinnedPanels: string[];        // panel IDs that are pinned
  lastActiveTab: string;         // last viewed page
  windowBounds: { x: number; y: number; width: number; height: number; maximized: boolean };
}

export interface UserPreferences {
  version: string;
  ui: UIPreferences;
  trading: TradingPreferences;
  notifications: NotificationPreferences;
  layout: LayoutPreferences;
  customData: Record<string, any>; // user-defined key-value pairs
  updatedAt: string;
}

// ── Default Values ─────────────────────────────────────────────────────────

export function getDefaultPreferences(): UserPreferences {
  return {
    version: '1.0.0',
    ui: {
      theme: 'dark',
      language: 'zh-CN',
      fontSize: 'medium',
      sidebarCollapsed: false,
      chartType: 'candlestick',
      chartInterval: '5m',
      defaultMarket: 'US',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h',
      animationsEnabled: true,
      compactMode: false,
    },
    trading: {
      defaultBroker: 'futu',
      defaultAccountId: '',
      defaultOrderType: 'MARKET',
      defaultTimeInForce: 'DAY',
      confirmBeforeTrade: true,
      oneClickTrading: false,
      defaultQuantity: 100,
      maxPositionSize: 20,
      defaultStopLossPct: 5,
      defaultTakeProfitPct: 10,
      autoRefreshIntervalSec: 30,
      tradingHoursOnly: false,
    },
    notifications: {
      enabled: true,
      soundEnabled: true,
      desktopNotifications: true,
      tradeSignals: true,
      riskAlerts: true,
      systemAlerts: true,
      priceAlerts: true,
      newsAlerts: false,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      emailAlerts: false,
      emailAddress: '',
    },
    layout: {
      dashboardLayout: '{}',
      watchlistColumns: ['symbol', 'price', 'change', 'volume', 'market_cap'],
      pinnedPanels: [],
      lastActiveTab: 'dashboard',
      windowBounds: { x: 100, y: 100, width: 1400, height: 900, maximized: false },
    },
    customData: {},
    updatedAt: new Date().toISOString(),
  };
}

// ── Preferences Manager ────────────────────────────────────────────────────

export class PreferencesManager {
  private prefs: UserPreferences;
  private dbPath: string = '';
  private backupPath: string = '';
  private initialized: boolean = false;

  constructor() {
    this.prefs = getDefaultPreferences();
  }

  initialize() {
    try {
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'preferences.db');
      this.backupPath = path.join(userDataPath, 'preferences-backup.json');

      // Try to load from DB first, then backup
      this.loadFromDB();
      this.initialized = true;
      log.info('[Preferences] Initialized');
    } catch (err: unknown) {
      log.error('[Preferences] Init failed, using defaults:', err.message);
      this.prefs = getDefaultPreferences();
      this.initialized = true;
    }
  }

  // ── DB Operations ────────────────────────────────────────────────────

  private getDb(): any {
    try {
      const { shared } = require('../ipc-handlers/_import-shared');
      return shared.db?.getDb?.() || null;
    } catch {
      return null;
    }
  }

  private ensureTable(db: any) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  private loadFromDB() {
    const db = this.getDb();
    if (!db) {
      this.loadFromBackup();
      return;
    }

    try {
      this.ensureTable(db);
      const row = db.prepare('SELECT value FROM user_preferences WHERE key = ?').get('main');
      if (row) {
        const saved = JSON.parse(row.value);
        this.prefs = this.mergeWithDefaults(saved);
        log.info('[Preferences] Loaded from DB');
      } else {
        // Check backup
        this.loadFromBackup();
      }
    } catch (err: unknown) {
      log.warn('[Preferences] DB load failed, trying backup:', err.message);
      this.loadFromBackup();
    }
  }

  private saveToDB() {
    const db = this.getDb();
    if (!db) {
      this.saveToBackup();
      return;
    }

    try {
      this.ensureTable(db);
      const json = JSON.stringify(this.prefs);
      db.prepare(`
        INSERT OR REPLACE INTO user_preferences (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
      `).run('main', json);

      // Also save backup
      this.saveToBackup();
    } catch (err: unknown) {
      log.error('[Preferences] DB save failed:', err.message);
      this.saveToBackup();
    }
  }

  // ── Backup Operations ────────────────────────────────────────────────

  private loadFromBackup() {
    try {
      if (this.backupPath && fs.existsSync(this.backupPath)) {
        const json = fs.readFileSync(this.backupPath, 'utf-8');
        const saved = JSON.parse(json);
        this.prefs = this.mergeWithDefaults(saved);
        log.info('[Preferences] Loaded from backup');
      }
    } catch (err: unknown) {
      log.warn('[Preferences] Backup load failed:', err.message);
    }
  }

  private saveToBackup() {
    try {
      if (this.backupPath) {
        const dir = path.dirname(this.backupPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.backupPath, JSON.stringify(this.prefs, null, 2), 'utf-8');
      }
    } catch (err: unknown) {
      log.error('[Preferences] Backup save failed:', err.message);
    }
  }

  // ── Merge Logic ──────────────────────────────────────────────────────

  private mergeWithDefaults(saved: Partial<UserPreferences>): UserPreferences {
    const defaults = getDefaultPreferences();

    return {
      version: saved.version || defaults.version,
      ui: { ...defaults.ui, ...(saved.ui || {}) },
      trading: { ...defaults.trading, ...(saved.trading || {}) },
      notifications: { ...defaults.notifications, ...(saved.notifications || {}) },
      layout: { ...defaults.layout, ...(saved.layout || {}) },
      customData: { ...defaults.customData, ...(saved.customData || {}) },
      updatedAt: saved.updatedAt || defaults.updatedAt,
    };
  }

  // ── Public API ───────────────────────────────────────────────────────

  getAll(): UserPreferences {
    return { ...this.prefs };
  }

  getSection<K extends keyof UserPreferences>(section: K): UserPreferences[K] {
    return { ...this.prefs[section] } as UserPreferences[K];
  }

  get<T = any>(section: keyof UserPreferences, key: string): T {
    const s = this.prefs[section] as any;
    return s?.[key];
  }

  set(section: keyof UserPreferences, key: string, value: any): boolean {
    if (!this.prefs[section]) return false;
    (this.prefs[section] as any)[key] = value;
    this.prefs.updatedAt = new Date().toISOString();
    this.saveToDB();
    return true;
  }

  setSection(section: keyof UserPreferences, data: Partial<any>): boolean {
    if (!this.prefs[section]) return false;
    Object.assign(this.prefs[section], data);
    this.prefs.updatedAt = new Date().toISOString();
    this.saveToDB();
    return true;
  }

  setAll(data: Partial<UserPreferences>): boolean {
    this.prefs = this.mergeWithDefaults({ ...this.prefs, ...data });
    this.prefs.updatedAt = new Date().toISOString();
    this.saveToDB();
    return true;
  }

  reset(section?: keyof UserPreferences): boolean {
    const defaults = getDefaultPreferences();
    if (section) {
      this.prefs[section] = defaults[section];
    } else {
      this.prefs = defaults;
    }
    this.prefs.updatedAt = new Date().toISOString();
    this.saveToDB();
    return true;
  }

  // ── Custom Data ──────────────────────────────────────────────────────

  setCustom(key: string, value: any): void {
    this.prefs.customData[key] = value;
    this.prefs.updatedAt = new Date().toISOString();
    this.saveToDB();
  }

  getCustom<T = any>(key: string): T | undefined {
    return this.prefs.customData[key];
  }

  deleteCustom(key: string): boolean {
    if (key in this.prefs.customData) {
      delete this.prefs.customData[key];
      this.prefs.updatedAt = new Date().toISOString();
      this.saveToDB();
      return true;
    }
    return false;
  }

  // ── Export / Import ──────────────────────────────────────────────────

  exportToFile(filePath?: string): string {
    const outputPath = filePath || path.join(
      app.getPath('downloads'),
      `dawn-whales-prefs-${new Date().toISOString().slice(0, 10)}.json`
    );

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const exportData = {
      app: 'dawn-whales',
      version: this.prefs.version,
      exportedAt: new Date().toISOString(),
      preferences: this.prefs,
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    log.info(`[Preferences] Exported to ${outputPath}`);
    return outputPath;
  }

  importFromFile(filePath: string): { success: boolean; error?: string } {
    try {
      const json = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(json);

      if (!data.preferences && !data.ui) {
        return { success: false, error: 'Invalid preferences file format' };
      }

      const imported = data.preferences || data;
      this.prefs = this.mergeWithDefaults(imported);
      this.prefs.updatedAt = new Date().toISOString();
      this.saveToDB();

      log.info(`[Preferences] Imported from ${filePath}`);
      return { success: true };
    } catch (err: unknown) {
      log.error('[Preferences] Import failed:', err.message);
      return { success: false, error: err.message };
    }
  }
}
