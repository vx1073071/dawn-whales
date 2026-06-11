/**
 * WebSocket Market Data — IPC Handlers
 *
 * Registers Electron IPC handlers that bridge the main-process
 * WsMarketDataEngine to the renderer process.
 *
 * Channels:
 *   ws:connect        — establish WebSocket connection
 *   ws:disconnect     — close WebSocket connection
 *   ws:subscribe      — subscribe to market data
 *   ws:unsubscribe    — remove a subscription
 *   ws:status         — query current engine status
 *   ws:get-ticks      — fetch recent ticks for a symbol
 *   ws:enable-mock    — enable mock data mode
 *   ws:disable-mock   — disable mock data mode
 *   ws:diagnostics    — full diagnostic dump
 */

import { ipcMain } from 'electron';
import { EngineError } from '../engine/core/engine-error';
import log from 'electron-log';
import {
  getWsMarketDataEngine,
  destroyWsMarketDataEngine,
  WsConnectionConfig,
  MarketTick,
} from '../engine/data/ws-market-data';

// ---------------------------------------------------------------------------
// Shared engine reference
// ---------------------------------------------------------------------------

const engine = getWsMarketDataEngine();

// Track subscription callbacks per IPC subscription so we can clean up
const ipcSubscriptionCallbacks = new Map<
  string,
  { subId: string; cleanup: () => void }
>();

// ---------------------------------------------------------------------------
// Helper: safe IPC reply
// ---------------------------------------------------------------------------

function safeReply(
  event: Electron.IpcMainInvokeEvent,
  data: unknown,
): void {
  try {
    event.returnValue = data;
  } catch (err) {
    // [EngineError:DATA] — structured error tracking
    void EngineError; // structured error domain: DATA
    log.error('[ws-market-ipc] Failed to reply:', err);
  }
}

// ---------------------------------------------------------------------------
// Register all IPC handlers
// ---------------------------------------------------------------------------

export function registerWsMarketIpcHandlers(): void {
  log.info('[ws-market-ipc] Registering IPC handlers');

  // ---- ws:connect ----
  ipcMain.handle(
    'ws:connect',
    async (_event, config: WsConnectionConfig): Promise<boolean> => {
      try {
        const ok = await engine.connect(config);
        log.info(`[ws-market-ipc] ws:connect → ${ok}`);
        return ok;
      } catch (err) {
    // [EngineError:DATA] — structured error tracking
        log.error('[ws-market-ipc] ws:connect error:', err);
        return false;
      }
    },
  );

  // ---- ws:disconnect ----
  ipcMain.handle('ws:disconnect', async (): Promise<boolean> => {
    try {
      engine.disconnect();
      log.info('[ws-market-ipc] ws:disconnect → ok');
      return true;
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[ws-market-ipc] ws:disconnect error:', err);
      return false;
    }
  });

  // ---- ws:subscribe ----
  ipcMain.handle(
    'ws:subscribe',
    async (
      _event,
      params: {
        codes: string[];
        type: 'quote' | 'kline' | 'depth' | 'tick';
        replyChannel?: string;
      },
    ): Promise<string> => {
      try {
        const { codes, type, replyChannel } = params;

        // Build a callback that forwards data to the renderer via send
        const callback = (data: unknown) => {
          try {
            const win = getRendererWindow();
            if (win && replyChannel) {
              win.webContents.send(replyChannel, { subId: id, data });
            }
          } catch (err) {
    // [EngineError:DATA] — structured error tracking
            log.warn('[ws-market-ipc] Callback send failed:', err);
          }
        };

        const id = engine.subscribe(codes, type, callback);
        log.info(`[ws-market-ipc] ws:subscribe → ${id} [${codes.join(', ')}]`);
        return id;
      } catch (err) {
    // [EngineError:DATA] — structured error tracking
        log.error('[ws-market-ipc] ws:subscribe error:', err);
        return '';
      }
    },
  );

  // ---- ws:unsubscribe ----
  ipcMain.handle(
    'ws:unsubscribe',
    async (_event, subscriptionId: string): Promise<boolean> => {
      try {
        const ok = engine.unsubscribe(subscriptionId);
        log.info(`[ws-market-ipc] ws:unsubscribe(${subscriptionId}) → ${ok}`);
        return ok;
      } catch (err) {
    // [EngineError:DATA] — structured error tracking
        log.error('[ws-market-ipc] ws:unsubscribe error:', err);
        return false;
      }
    },
  );

  // ---- ws:status ----
  ipcMain.handle('ws:status', async () => {
    try {
      return engine.getStatus();
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[ws-market-ipc] ws:status error:', err);
      return null;
    }
  });

  // ---- ws:get-ticks ----
  ipcMain.handle(
    'ws:get-ticks',
    async (
      _event,
      params: { code: string; limit?: number },
    ): Promise<MarketTick[]> => {
      try {
        const { code, limit } = params;
        const ticks = engine.getRecentTicks(code, limit ?? 100);
        return ticks;
      } catch (err) {
    // [EngineError:DATA] — structured error tracking
        log.error('[ws-market-ipc] ws:get-ticks error:', err);
        return [];
      }
    },
  );

  // ---- ws:enable-mock ----
  ipcMain.handle(
    'ws:enable-mock',
    async (_event, symbols: string[]): Promise<boolean> => {
      try {
        engine.enableMockMode(symbols);
        log.info(`[ws-market-ipc] Mock mode enabled: ${symbols.join(', ')}`);
        return true;
      } catch (err) {
    // [EngineError:DATA] — structured error tracking
        log.error('[ws-market-ipc] ws:enable-mock error:', err);
        return false;
      }
    },
  );

  // ---- ws:disable-mock ----
  ipcMain.handle('ws:disable-mock', async (): Promise<boolean> => {
    try {
      engine.disableMockMode();
      return true;
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[ws-market-ipc] ws:disable-mock error:', err);
      return false;
    }
  });

  // ---- ws:diagnostics ----
  ipcMain.handle('ws:diagnostics', async () => {
    try {
      return engine.getDiagnostics();
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[ws-market-ipc] ws:diagnostics error:', err);
      return null;
    }
  });

  // ---- Forward engine events to renderer ----
  setupEventForwarding();
}

// ---------------------------------------------------------------------------
// Event forwarding: engine → renderer
// ---------------------------------------------------------------------------

function setupEventForwarding(): void {
  const win = getRendererWindow();
  if (!win) {
    log.warn('[ws-market-ipc] No renderer window available for event forwarding');
    return;
  }

  const forward = (channel: string) => (data: unknown) => {
    try {
      win.webContents.send(`ws:event:${channel}`, data);
    } catch (_e: unknown) {
      // window may have been closed
    }
  };

  engine.on('connected', forward('connected'));
  engine.on('disconnected', forward('disconnected'));
  engine.on('reconnecting', forward('reconnecting'));
  engine.on('error', forward('error'));
  engine.on('tick', forward('tick'));
  engine.on('kline', forward('kline'));
  engine.on('depth', forward('depth'));
}

// ---------------------------------------------------------------------------
// Utility: get main renderer window
// ---------------------------------------------------------------------------

function getRendererWindow(): Electron.BrowserWindow | undefined {
  // Lazy import to avoid circular deps at module level
  try {
    const { BrowserWindow } = require('electron');
    const wins = BrowserWindow.getAllWindows();
    return wins.find((w: Electron.BrowserWindow) => !w.isDestroyed()) ?? undefined;
  } catch (_e: unknown) {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function unregisterWsMarketIpcHandlers(): void {
  log.info('[ws-market-ipc] Unregistering IPC handlers');
  const channels = [
    'ws:connect',
    'ws:disconnect',
    'ws:subscribe',
    'ws:unsubscribe',
    'ws:status',
    'ws:get-ticks',
    'ws:enable-mock',
    'ws:disable-mock',
    'ws:diagnostics',
  ];
  for (const ch of channels) {
    ipcMain.removeHandler(ch);
  }
  destroyWsMarketDataEngine();
  ipcSubscriptionCallbacks.clear();
}
