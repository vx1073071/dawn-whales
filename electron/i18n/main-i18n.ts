// ── QUANT MOO — Main Process i18n (R105 S-16) ─────────────────
// Independent i18next instance for Electron main process.
// Decouples 94 files from importing renderer's src/i18n (dependency inversion).
//
// Usage in electron/:
//   import i18n from '../i18n/main-i18n';   // ← use this
//   instead of:  import i18n from '../../src/i18n';  // ← OLD, remove
//
// Migration plan:
//   R105: Create this file + fix database.ts (S-05 by JVS)
//   R106: Migrate ipc/ layer (14 files)
//   R107: Migrate engine/ layer (remaining ~70 files)

import i18next from 'i18next';
import * as path from 'path';
import { app } from 'electron';

// ── Main-process-only translation resources ──────────────────────
// Database table comments, log messages, error descriptions, etc.
// These keys are NOT shared with the renderer — renderer has its own i18n.
const mainProcessResources: Record<string, Record<string, string>> = {
  'zh-CN': {
    // Database table/column comments (was i18n.t('Database.k0') etc.)
    'Database.k0': '用户策略表',
    'Database.k1': '策略ID',
    'Database.k2': '策略名称',
    'Database.k3': '交易记录表',
    'Database.k4': '记录ID',
    'Database.k5': '交易时间',
    'Database.k6': '风控规则表',
    'Database.k7': '规则ID',
    'Database.k8': '规则名称',
    'Database.k9': '积分余额表',
    'Database.k10': '积分交易流水表',

    // Shared namespace keys used by main process
    'CN': 'CN',
    'HK$': 'HK$',
    'SELL': '卖出',
    'BUY': '买入',
  },
  'en': {
    'Database.k0': 'User Strategy Table',
    'Database.k1': 'Strategy ID',
    'Database.k2': 'Strategy Name',
    'Database.k3': 'Trade Records Table',
    'Database.k4': 'Record ID',
    'Database.k5': 'Trade Time',
    'Database.k6': 'Risk Rules Table',
    'Database.k7': 'Rule ID',
    'Database.k8': 'Rule Name',
    'Database.k9': 'Points Balance Table',
    'Database.k10': 'Points Transaction Ledger',
    'CN': 'CN',
    'HK$': 'HK$',
    'SELL': 'SELL',
    'BUY': 'BUY',
  },
};

// ── Detect language preference ───────────────────────────────────
// Main process cannot access localStorage; read from electron-store or default.
function detectLanguage(): string {
  // Priority: electron-store saved pref > system locale > fallback zh-CN
  try {
    // Will be extended when electron-store is integrated
    const sysLocale = app.getLocale?.() ?? 'zh-CN';
    // Normalize: zh-HK/zh-TW → zh-HK, zh* → zh-CN, else → en
    if (sysLocale.startsWith('zh-HK') || sysLocale.startsWith('zh-TW')) return 'zh-HK';
    if (sysLocale.startsWith('zh')) return 'zh-CN';
    return 'en';
  } catch {
    return 'zh-CN';
  }
}

// ── Initialize i18next for main process ──────────────────────────
const mainI18n = i18next.createInstance();

let initialized = false;

/**
 * Initialize the main-process i18n instance.
 * Must be called after app.on('ready') — auto-called on first i18n.t() if not yet done.
 */
export async function initMainI18n(lang?: string): Promise<void> {
  if (initialized) return;

  const lng = lang ?? detectLanguage();

  mainI18n.init({
    resources: {
      'zh-CN': { translation: mainProcessResources['zh-CN'] },
      'en': { translation: mainProcessResources['en'] },
    },
    lng,
    fallbackLng: 'zh-CN',
    interpolation: { escapeValue: false },
  });

  initialized = true;
}

/**
 * Load full locale JSON from src/i18n/locales/ for a given language.
 * This is for engine modules that need the full translation dataset
 * (e.g., data-export formatting, report generation).
 * Only loads on demand to avoid the 3MB i18n bundle at startup.
 */
export async function loadFullLocale(lang: string): Promise<void> {
  if (!initialized) await initMainI18n();

  try {
    const localePath = path.join(__dirname, '../src/i18n/locales', `${lang}.json`);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require(localePath);
    mainI18n.addResourceBundle(lang, 'translation', data, true, true);
  } catch {
    // Locale file not found — fallback already loaded, safe to ignore
  }
}

/**
 * Change main process language.
 * Syncs with renderer language preference via IPC.
 */
export async function changeMainLanguage(lang: string): Promise<void> {
  if (!initialized) await initMainI18n(lang);

  // Load full locale if not yet loaded for this language
  if (!mainProcessResources[lang]) {
    await loadFullLocale(lang);
  }

  await mainI18n.changeLanguage(lang);
}

// ── Proxy: auto-init on first t() call ──────────────────────────
// This ensures backward compatibility — existing code calling i18n.t()
// will auto-initialize if called before app ready.
// After full migration, this proxy can be removed.
function createAutoInitProxy(): typeof mainI18n {
  return new Proxy(mainI18n, {
    get(target, prop, receiver) {
      if (prop === 't' && !initialized) {
        // Sync init fallback for database.ts calls during app startup
        // (before app.on('ready')). Use zh-CN as safe default.
        if (!initialized) {
          mainI18n.init({
            resources: {
              'zh-CN': { translation: mainProcessResources['zh-CN'] },
              'en': { translation: mainProcessResources['en'] },
            },
            lng: 'zh-CN',
            fallbackLng: 'zh-CN',
            interpolation: { escapeValue: false },
          });
          initialized = true;
        }
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

const i18nProxy = createAutoInitProxy();

export { i18nProxy as default, mainI18n };
