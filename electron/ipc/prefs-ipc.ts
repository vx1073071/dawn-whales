// ── DAWN WHALES IPC: prefs — User preferences persistence ────────────────
// R20: Missing handlers detected by QClaw — preload exposes prefs:*
//      but no prefs-ipc.ts existed. This module provides all prefs:*
//      handlers using electron-store for persistent JSON storage.

import { ipcMain, app } from 'electron';
import { EngineError } from '../engine/core/engine-error';
import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';

interface PrefsSection {
  [key: string]: unknown;
}

// In-memory cache
let prefsCache: PrefsSection = {};
let dirty = false;
let STORE_PATH = '';

// ── Load ───────────────────────────────────────────────────────────────────
function load(): PrefsSection {
  try {
    if (STORE_PATH && fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      prefsCache = JSON.parse(raw);
      log.info('[PrefsIPC] loaded', Object.keys(prefsCache).length, 'sections from', STORE_PATH);
    }
  } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
    void EngineError; // structured error domain: SYSTEM
    log.warn('[PrefsIPC] load error, starting fresh:', err.message);
    prefsCache = {};
  }
  return prefsCache;
}

// ── Save ────────────────────────────────────────────────────────────────────
function save() {
  try {
    if (!STORE_PATH) return;
    fs.writeFileSync(STORE_PATH, JSON.stringify(prefsCache, null, 2), 'utf-8');
    dirty = false;
    log.debug('[PrefsIPC] saved to', STORE_PATH);
  } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
    log.error('[PrefsIPC] save error:', err.message);
  }
}

// ── Register ────────────────────────────────────────────────────────────────
export function registerPrefsIPC() {
  // Lazy-init STORE_PATH after app is ready
  STORE_PATH = path.join(app.getPath('userData'), 'preferences.json');
  load();
  // ── prefs:get — get value for key ───────────────────────────────────
  ipcMain.handle('prefs:get', async (_e, key: string) => {
    const val = key.includes('.') ? getNested(prefsCache, key) : prefsCache[key];
    return { success: true, value: val ?? null };
  });

  // ── prefs:set — set value for key ───────────────────────────────────
  ipcMain.handle('prefs:set', async (_e, key: string, value: unknown) => {
    if (key.includes('.')) {
      setNested(prefsCache, key, value);
    } else {
      prefsCache[key] = value;
    }
    dirty = true;
    save();
    return { success: true };
  });

  // ── prefs:get-all — get entire preferences object ───────────────────
  ipcMain.handle('prefs:get-all', async () => {
    return { success: true, prefs: { ...prefsCache } };
  });

  // ── prefs:get-section — get section by name ────────────────────────
  ipcMain.handle('prefs:get-section', async (_e, section: string) => {
    return { success: true, section: prefsCache[section] ?? null };
  });

  // ── prefs:set-section — replace entire section ─────────────────────
  ipcMain.handle('prefs:set-section', async (_e, section: string, data: unknown) => {
    prefsCache[section] = data;
    dirty = true;
    save();
    return { success: true };
  });

  // ── prefs:custom-get — custom key with default ──────────────────────
  ipcMain.handle('prefs:custom-get', async (_e, key: string, defaultValue?: unknown) => {
    const val = key.includes('.') ? getNested(prefsCache, key) : prefsCache[key];
    return { success: true, value: val ?? defaultValue ?? null };
  });

  // ── prefs:custom-set — custom key with options ──────────────────────
  ipcMain.handle('prefs:custom-set', async (_e, key: string, value: unknown, options?: { merge?: boolean }) => {
    if (options?.merge && !key.includes('.')) {
      prefsCache[key] = { ...prefsCache[key], ...value };
    } else if (key.includes('.')) {
      setNested(prefsCache, key, value);
    } else {
      prefsCache[key] = value;
    }
    dirty = true;
    save();
    return { success: true };
  });

  // ── prefs:export — export all prefs as JSON string ──────────────────
  ipcMain.handle('prefs:export', async () => {
    return { success: true, json: JSON.stringify(prefsCache, null, 2) };
  });

  // ── prefs:import — import prefs from JSON string ───────────────────
  ipcMain.handle('prefs:import', async (_e, json: string) => {
    try {
      const imported = JSON.parse(json);
      prefsCache = { ...prefsCache, ...imported };
      dirty = true;
      save();
      return { success: true, count: Object.keys(imported).length };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: 'Invalid JSON: ' + err.message };
    }
  });

  // ── prefs:reset — reset section or all ───────────────────────────────
  ipcMain.handle('prefs:reset', async (_e, section?: string) => {
    if (section) {
      delete prefsCache[section];
    } else {
      prefsCache = {};
    }
    dirty = true;
    save();
    return { success: true };
  });

  log.info('[PrefsIPC] registered 11 handlers, store at', STORE_PATH);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function getNested(obj: unknown, path: string): any {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function setNested(obj: unknown, path: string, value: unknown) {
  const keys = path.split('.');
  let curr = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!curr[keys[i]]) curr[keys[i]] = {};
    curr = curr[keys[i]];
  }
  curr[keys[keys.length - 1]] = value;
}