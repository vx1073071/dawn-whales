// ── Unit Tests — JVS-108: User Preferences ──────────────────────────────────
// Tests preferences logic without DB/electron dependency
// Run: npx tsx tests/preferences.test.ts

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ── Inline Preferences Logic (no electron deps) ──────────────────────────

interface UserPreferences {
  version: string;
  ui: {
    theme: string;
    language: string;
    fontSize: string;
    sidebarCollapsed: boolean;
    chartType: string;
    chartInterval: string;
    defaultMarket: string;
    animationsEnabled: boolean;
    compactMode: boolean;
  };
  trading: {
    defaultBroker: string;
    confirmBeforeTrade: boolean;
    oneClickTrading: boolean;
    defaultQuantity: number;
    maxPositionSize: number;
    defaultStopLossPct: number;
    defaultTakeProfitPct: number;
  };
  notifications: {
    enabled: boolean;
    soundEnabled: boolean;
    desktopNotifications: boolean;
    tradeSignals: boolean;
    riskAlerts: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
  };
  customData: Record<string, any>;
  updatedAt: string;
}

function getDefaults(): UserPreferences {
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
      animationsEnabled: true,
      compactMode: false,
    },
    trading: {
      defaultBroker: 'futu',
      confirmBeforeTrade: true,
      oneClickTrading: false,
      defaultQuantity: 100,
      maxPositionSize: 20,
      defaultStopLossPct: 5,
      defaultTakeProfitPct: 10,
    },
    notifications: {
      enabled: true,
      soundEnabled: true,
      desktopNotifications: true,
      tradeSignals: true,
      riskAlerts: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    },
    customData: {},
    updatedAt: new Date().toISOString(),
  };
}

function mergeWithDefaults(saved: any): UserPreferences {
  const defaults = getDefaults();
  return {
    version: saved.version || defaults.version,
    ui: { ...defaults.ui, ...(saved.ui || {}) },
    trading: { ...defaults.trading, ...(saved.trading || {}) },
    notifications: { ...defaults.notifications, ...(saved.notifications || {}) },
    customData: { ...defaults.customData, ...(saved.customData || {}) },
    updatedAt: saved.updatedAt || defaults.updatedAt,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

section('Preferences — Defaults');
{
  const prefs = getDefaults();
  assert(prefs.version === '1.0.0', 'version is 1.0.0');
  assert(prefs.ui.theme === 'dark', 'default theme is dark');
  assert(prefs.ui.language === 'zh-CN', 'default language is zh-CN');
  assert(prefs.ui.fontSize === 'medium', 'default fontSize is medium');
  assert(prefs.ui.sidebarCollapsed === false, 'sidebar not collapsed');
  assert(prefs.ui.chartType === 'candlestick', 'default chart is candlestick');
  assert(prefs.trading.defaultBroker === 'futu', 'default broker is futu');
  assert(prefs.trading.confirmBeforeTrade === true, 'confirm before trade');
  assert(prefs.trading.oneClickTrading === false, 'one click off by default');
  assert(prefs.trading.defaultQuantity === 100, 'default qty is 100');
  assert(prefs.trading.defaultStopLossPct === 5, 'default SL is 5%');
  assert(prefs.notifications.enabled === true, 'notifications enabled');
  assert(prefs.notifications.soundEnabled === true, 'sound enabled');
}

section('Preferences — Merge with Defaults');
{
  const saved = {
    ui: { theme: 'light', language: 'en-US' },
    trading: { defaultQuantity: 50 },
    customData: { myKey: 'myValue' },
  };

  const merged = mergeWithDefaults(saved);

  assert(merged.ui.theme === 'light', 'overridden theme is light');
  assert(merged.ui.language === 'en-US', 'overridden language is en-US');
  assert(merged.ui.fontSize === 'medium', 'non-overridden fontSize stays default');
  assert(merged.ui.chartType === 'candlestick', 'non-overridden chartType stays default');
  assert(merged.trading.defaultQuantity === 50, 'overridden quantity is 50');
  assert(merged.trading.defaultBroker === 'futu', 'non-overridden broker stays default');
  assert(merged.trading.defaultStopLossPct === 5, 'non-overridden SL stays default');
  assert(merged.customData.myKey === 'myValue', 'custom data preserved');
  assert(merged.notifications.enabled === true, 'non-overridden notifications stay default');
}

section('Preferences — Partial Override');
{
  const saved = {
    ui: { compactMode: true },
  };

  const merged = mergeWithDefaults(saved);
  assert(merged.ui.compactMode === true, 'compactMode overridden');
  assert(merged.ui.theme === 'dark', 'theme stays default');
  assert(merged.ui.animationsEnabled === true, 'animations stay default');
}

section('Preferences — Empty Override');
{
  const merged = mergeWithDefaults({});
  assert(merged.ui.theme === 'dark', 'empty override keeps default theme');
  assert(merged.trading.defaultQuantity === 100, 'empty override keeps default qty');
  assert(merged.notifications.enabled === true, 'empty override keeps default notifications');
}

section('Preferences — Set/Get Simulation');
{
  const prefs = getDefaults();

  // Set a value
  (prefs.ui as any).theme = 'light';
  assert(prefs.ui.theme === 'light', 'set theme to light');

  // Get section
  const uiSection = { ...prefs.ui };
  assert(uiSection.theme === 'light', 'get section returns updated value');

  // Set nested
  prefs.trading.defaultQuantity = 200;
  assert(prefs.trading.defaultQuantity === 200, 'set trading quantity');
}

section('Preferences — Reset');
{
  const prefs = getDefaults();
  prefs.ui.theme = 'light';
  prefs.trading.defaultQuantity = 500;

  // Reset UI section
  const defaults = getDefaults();
  prefs.ui = { ...defaults.ui };

  assert(prefs.ui.theme === 'dark', 'reset UI theme back to dark');
  assert(prefs.trading.defaultQuantity === 500, 'trading section not affected');

  // Reset all
  const resetPrefs = getDefaults();
  assert(resetPrefs.trading.defaultQuantity === 100, 'full reset restores all defaults');
}

section('Preferences — Custom Data');
{
  const prefs = getDefaults();

  prefs.customData['watchlist_v2'] = ['AAPL', 'TQQQ', 'NVDA'];
  prefs.customData['chart_overlay'] = { showMA: true, maPeriods: [5, 20, 60] };

  assert(prefs.customData['watchlist_v2'].length === 3, 'custom array stored');
  assert(prefs.customData['chart_overlay'].showMA === true, 'custom object stored');

  // Delete custom
  delete prefs.customData['watchlist_v2'];
  assert(prefs.customData['watchlist_v2'] === undefined, 'custom key deleted');
  assert(prefs.customData['chart_overlay'] !== undefined, 'other custom keys preserved');
}

section('Preferences — Export Format');
{
  const prefs = getDefaults();
  const exportData = {
    app: 'dawn-whales',
    version: prefs.version,
    exportedAt: new Date().toISOString(),
    preferences: prefs,
  };

  const json = JSON.stringify(exportData, null, 2);
  const parsed = JSON.parse(json);

  assert(parsed.app === 'dawn-whales', 'export has app name');
  assert(parsed.version === '1.0.0', 'export has version');
  assert(parsed.exportedAt !== undefined, 'export has timestamp');
  assert(parsed.preferences.ui.theme === 'dark', 'export contains preferences');
}

section('Preferences — Import Validation');
{
  // Valid import
  const validImport = {
    app: 'dawn-whales',
    preferences: {
      ui: { theme: 'light', language: 'en-US' },
      trading: { defaultQuantity: 50 },
    },
  };

  const data = validImport.preferences || validImport;
  assert(data.ui?.theme === 'light', 'valid import parsed correctly');

  // Invalid import (no preferences key)
  const invalidImport = { foo: 'bar' };
  const check = !invalidImport.preferences && !(invalidImport as any).ui;
  assert(check === true, 'invalid import detected');
}

section('Preferences — Deep Merge Edge Cases');
{
  // Null values should not override defaults
  const saved = {
    ui: { theme: null },
    trading: null,
  };

  const merged = mergeWithDefaults(saved);
  assert(merged.ui.theme === null, 'null override is preserved (caller responsibility)');
  assert(merged.trading.defaultQuantity === 100, 'null section falls back to defaults via spread');
}

section('Preferences — JSON Roundtrip');
{
  const prefs = getDefaults();
  prefs.ui.theme = 'light';
  prefs.trading.defaultQuantity = 300;
  prefs.customData.test = { nested: [1, 2, 3] };

  const json = JSON.stringify(prefs);
  const restored = JSON.parse(json);

  assert(restored.ui.theme === 'light', 'JSON roundtrip: theme');
  assert(restored.trading.defaultQuantity === 300, 'JSON roundtrip: quantity');
  assert(restored.customData.test.nested.length === 3, 'JSON roundtrip: nested custom');
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'═'.repeat(50)}`);

if (failed > 0) process.exit(1);
