// ── R128-M01 Sandbox UI Adapter — contextBridge API 路径调整 ─────────────
// PM: sandbox:true迁移后, renderer不能用require('electron')
// 所有IPC调用必须通过 window.api (contextBridge exposed)

/**
 * Type-safe wrapper for sandbox contextBridge API.
 * In sandbox mode, all electron APIs come through window.api.
 * This file provides fallback detection and a unified interface.
 */

// ═══════════ Types ═══════════

export interface SandboxAPI {
  // IPC invoke
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  // File operations (via IPC:file:*)
  file: {
    read: (path: string) => Promise<string>;
    write: (path: string, data: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
    list: (dirPath: string) => Promise<string[]>;
  };
  // Shell
  shell: {
    openExternal: (url: string) => Promise<void>;
    showItemInFolder: (path: string) => Promise<void>;
  };
  // App
  app: {
    getPath: (name: string) => Promise<string>;
    quit: () => Promise<void>;
    getVersion: () => Promise<string>;
  };
  // Broker (existing)
  broker: {
    connect: (brokerId: string, config: any) => Promise<any>;
    disconnect: (brokerId: string) => Promise<void>;
    getBrokers: () => Promise<any[]>;
    subscribe: (brokerId: string, codes: string[]) => Promise<void>;
    placeOrder: (order: any) => Promise<any>;
  };
  // Strategy
  strategy: {
    create: (config: any) => Promise<any>;
    list: () => Promise<any[]>;
    start: (id: string) => Promise<void>;
    stop: (id: string) => Promise<void>;
  };
  // Platform info
  platform: {
    isElectron: boolean;
    isSandbox: boolean;
    os: string;
    arch: string;
  };
}

// ═══════════ Detection ═══════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getWindowAny(): any { return typeof window !== 'undefined' ? window : undefined; }

/**
 * Detect if running in Electron sandbox mode
 */
export function isElectronSandbox(): boolean {
  const win = getWindowAny();
  if (!win) return false;
  return !!(win.api && win.api.platform?.isSandbox);
}

/**
 * Detect if running in Electron (any mode)
 */
export function isElectron(): boolean {
  const win = getWindowAny();
  if (!win) return false;
  if (win.api?.platform?.isElectron) return true;
  if (win.electronAPI) return true;
  if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) return true;
  return false;
}

/**
 * Get the sandbox-safe API interface.
 * Returns real API in Electron, mock in browser dev mode.
 */
export function getSandboxAPI(): SandboxAPI {
  const win = getWindowAny();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (win && (win as any).api?.invoke) return (win as any).api as SandboxAPI;
  return createMockAPI();
}

// ═══════════ Mock API for browser dev ═══════════
// Provides realistic mock responses so UI works without Electron

function createMockAPI(): SandboxAPI {
  const log = (method: string, ...args: any[]) => {
    console.debug(`[SandboxMock] ${method}`, ...args);
  };

  const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

  return {
    invoke: async (channel: string, ...args: any[]) => {
      log(`invoke:${channel}`, args);
      await delay();
      // Mock responses for common channels
      if (channel === 'app:getVersion') return '2.0.0';
      if (channel === 'broker:getAggregatedQuotes') return [];
      if (channel === 'strategy:list') return [];
      return { success: true };
    },

    file: {
      read: async (path: string) => { log('file.read', path); await delay(); return ''; },
      write: async (path: string, _data: string) => { log('file.write', path); await delay(); },
      exists: async (path: string) => { log('file.exists', path); await delay(); return false; },
      list: async (dirPath: string) => { log('file.list', dirPath); await delay(); return []; },
    },

    shell: {
      openExternal: async (url: string) => { log('shell.openExternal', url); window.open(url, '_blank'); },
      showItemInFolder: async (p: string) => { log('shell.showItem', p); },
    },

    app: {
      getPath: async (name: string) => { log('app.getPath', name); await delay(); return '/mock/path'; },
      quit: async () => { log('app.quit'); },
      getVersion: async () => { await delay(); return '2.0.0-mock'; },
    },

    broker: {
      connect: async (id: string, _config: any) => { log('broker.connect', id); await delay(200); return { success: true, brokerId: id }; },
      disconnect: async (id: string) => { log('broker.disconnect', id); await delay(); },
      getBrokers: async () => { await delay(); return []; },
      subscribe: async (id: string, codes: string[]) => { log('broker.subscribe', id, codes); await delay(); },
      placeOrder: async (order: any) => { log('broker.placeOrder', order); await delay(100); return { orderId: 'mock-' + Date.now(), status: 'filled' }; },
    },

    strategy: {
      create: async (cfg: any) => { log('strategy.create', cfg); await delay(); return { id: 'mock-s-' + Date.now() }; },
      list: async () => { await delay(); return []; },
      start: async (id: string) => { log('strategy.start', id); await delay(); },
      stop: async (id: string) => { log('strategy.stop', id); await delay(); },
    },

    platform: {
      isElectron: false,
      isSandbox: false,
      os: 'browser',
      arch: 'unknown',
    },
  };
}

// ═══════════ Re-export for convenience ═══════════
export const api = getSandboxAPI();
export default getSandboxAPI;
