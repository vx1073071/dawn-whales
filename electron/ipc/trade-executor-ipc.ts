/**
 * Trade Executor IPC Handlers
 * Sprint 2 Phase 2 - Dawn Whales
 *
 * Registers Electron IPC handlers for the Trade Execution Engine,
 * enabling renderer process to interact with the trading engine.
 */

import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import log from 'electron-log';
import { TradeExecutor, getTradeExecutor, TradeSignal, ExecutionConfig, TradeOrder } from '../engine/trade-executor';

// ============================================================
// Types
// ============================================================

interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

interface OrderFilter {
  status?: string;
  code?: string;
}

// ============================================================
// Shared State
// ============================================================

let tradeExecutor: TradeExecutor | null = null;
let registeredWindows: Set<BrowserWindow> = new Set();
let isRegistered = false;

function getExecutor(): TradeExecutor {
  if (!tradeExecutor) {
    tradeExecutor = getTradeExecutor();
  }
  return tradeExecutor;
}

function createResponse<T>(data: T): IPCResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

function createErrorResponse(error: string | Error): IPCResponse<null> {
  const message = error instanceof Error ? error.message : error;
  return {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// Event Broadcasting
// ============================================================

function broadcastToRenderers(channel: string, data: any): void {
  for (const win of registeredWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

function setupEventForwarding(executor: TradeExecutor): void {
  executor.on('order:created', (order: TradeOrder) => {
    broadcastToRenderers('trade:order-created', order);
  });

  executor.on('order:filled', (order: TradeOrder) => {
    broadcastToRenderers('trade:order-filled', order);
  });

  executor.on('order:cancelled', (order: TradeOrder) => {
    broadcastToRenderers('trade:order-cancelled', order);
  });

  executor.on('order:rejected', (order: TradeOrder, reason: string) => {
    broadcastToRenderers('trade:order-rejected', { order, reason });
  });

  executor.on('risk:rejected', (signal: TradeSignal, riskCheck: any) => {
    broadcastToRenderers('trade:risk-rejected', { signal, riskCheck });
  });

  executor.on('signal:processed', (signal: TradeSignal, order: TradeOrder | null) => {
    broadcastToRenderers('trade:signal-processed', { signal, order });
  });

  executor.on('mode:changed', (mode: string) => {
    broadcastToRenderers('trade:mode-changed', { mode });
  });

  executor.on('emergency:stop', (cancelledCount: number) => {
    broadcastToRenderers('trade:emergency-stop', { cancelledCount });
  });

  executor.on('position:updated', (position: any) => {
    broadcastToRenderers('trade:position-updated', position);
  });

  executor.on('config:updated', (config: ExecutionConfig) => {
    broadcastToRenderers('trade:config-updated', config);
  });

  log.info('[TradeExecutorIPC] Event forwarding configured');
}

// ============================================================
// IPC Handler Registration
// ============================================================

export function registerTradeExecutorIPC(win?: BrowserWindow): void {
  if (win) {
    registeredWindows.add(win);
    win.on('closed', () => {
      registeredWindows.delete(win);
    });
  }

  if (isRegistered) {
    log.info('[TradeExecutorIPC] Handlers already registered');
    return;
  }

  const executor = getExecutor();
  setupEventForwarding(executor);

  // trade:execute - Execute a trade signal
  ipcMain.handle('trade:execute', async (_event: IpcMainInvokeEvent, signal: TradeSignal) => {
    try {
      log.info('[TradeExecutorIPC] trade:execute', signal.code, signal.side);
      const order = await executor.processSignal(signal);
      return createResponse(order);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:execute error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:cancel - Cancel an order
  ipcMain.handle('trade:cancel', async (_event: IpcMainInvokeEvent, orderId: string) => {
    try {
      log.info('[TradeExecutorIPC] trade:cancel', orderId);
      const success = await executor.cancelOrder(orderId);
      return createResponse({ orderId, cancelled: success });
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:cancel error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:get-orders - Get current orders with optional filter
  ipcMain.handle('trade:get-orders', async (_event: IpcMainInvokeEvent, filter?: OrderFilter) => {
    try {
      const orders = executor.getOrders(filter);
      return createResponse(orders);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:get-orders error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:get-history - Get order history
  ipcMain.handle('trade:get-history', async (_event: IpcMainInvokeEvent, limit?: number) => {
    try {
      const history = executor.getOrderHistory(limit);
      return createResponse(history);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:get-history error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:get-config - Get current execution config
  ipcMain.handle('trade:get-config', async () => {
    try {
      const config = executor.getConfig();
      return createResponse(config);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:get-config error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:update-config - Update execution config
  ipcMain.handle('trade:update-config', async (_event: IpcMainInvokeEvent, updates: Partial<ExecutionConfig>) => {
    try {
      log.info('[TradeExecutorIPC] trade:update-config', JSON.stringify(updates));
      executor.updateConfig(updates);
      return createResponse(executor.getConfig());
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:update-config error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:emergency-stop - Trigger emergency stop
  ipcMain.handle('trade:emergency-stop', async () => {
    try {
      log.warn('[TradeExecutorIPC] trade:emergency-stop triggered!');
      const cancelledCount = await executor.emergencyStop();
      return createResponse({ cancelledCount });
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:emergency-stop error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:set-mode - Switch between paper and real mode
  ipcMain.handle('trade:set-mode', async (_event: IpcMainInvokeEvent, mode: 'paper' | 'real') => {
    try {
      log.info('[TradeExecutorIPC] trade:set-mode', mode);
      executor.setMode(mode);
      return createResponse({ mode });
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:set-mode error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:get-summary - Get executor summary
  ipcMain.handle('trade:get-summary', async () => {
    try {
      const summary = executor.getSummary();
      return createResponse(summary);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:get-summary error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:get-positions - Get current positions
  ipcMain.handle('trade:get-positions', async () => {
    try {
      const positions = executor.getPositions();
      return createResponse(positions);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:get-positions error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:get-stats - Get trade statistics
  ipcMain.handle('trade:get-stats', async () => {
    try {
      const stats = executor.calculateTradeStats();
      return createResponse(stats);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:get-stats error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:get-trade-log - Get trade log
  ipcMain.handle('trade:get-trade-log', async (_event: IpcMainInvokeEvent, limit?: number) => {
    try {
      const tradeLog = executor.getTradeLog(limit);
      return createResponse(tradeLog);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:get-trade-log error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:get-daily-pnl - Get daily P&L
  ipcMain.handle('trade:get-daily-pnl', async (_event: IpcMainInvokeEvent, date?: string) => {
    try {
      const pnl = executor.calculateDailyPnL(date);
      return createResponse(pnl);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:get-daily-pnl error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:get-pending-signals - Get signals awaiting confirmation
  ipcMain.handle('trade:get-pending-signals', async () => {
    try {
      const signals = executor.getPendingSignals();
      return createResponse(signals);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:get-pending-signals error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:confirm-signal - Confirm a pending signal
  ipcMain.handle('trade:confirm-signal', async (_event: IpcMainInvokeEvent, index: number) => {
    try {
      const order = await executor.confirmPendingSignal(index);
      return createResponse(order);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:confirm-signal error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:reject-signal - Reject a pending signal
  ipcMain.handle('trade:reject-signal', async (_event: IpcMainInvokeEvent, index: number) => {
    try {
      const success = executor.rejectPendingSignal(index);
      return createResponse({ success });
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:reject-signal error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:reset-emergency - Reset emergency stop
  ipcMain.handle('trade:reset-emergency', async () => {
    try {
      executor.resetEmergencyStop();
      return createResponse({ reset: true });
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:reset-emergency error:', err);
      return createErrorResponse(err);
    }
  });

  // trade:get-diagnostics - Get diagnostic info
  ipcMain.handle('trade:get-diagnostics', async () => {
    try {
      const diagnostics = executor.getDiagnostics();
      return createResponse(diagnostics);
    } catch (err: any) {
      log.error('[TradeExecutorIPC] trade:get-diagnostics error:', err);
      return createErrorResponse(err);
    }
  });

  isRegistered = true;
  log.info('[TradeExecutorIPC] All IPC handlers registered successfully');
}

// ============================================================
// Cleanup
// ============================================================

export function unregisterTradeExecutorIPC(): void {
  const channels = [
    'trade:execute',
    'trade:cancel',
    'trade:get-orders',
    'trade:get-history',
    'trade:get-config',
    'trade:update-config',
    'trade:emergency-stop',
    'trade:set-mode',
    'trade:get-summary',
    'trade:get-positions',
    'trade:get-stats',
    'trade:get-trade-log',
    'trade:get-daily-pnl',
    'trade:get-pending-signals',
    'trade:confirm-signal',
    'trade:reject-signal',
    'trade:reset-emergency',
    'trade:get-diagnostics',
  ];

  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }

  registeredWindows.clear();
  isRegistered = false;
  log.info('[TradeExecutorIPC] All IPC handlers unregistered');
}

export function registerWindow(win: BrowserWindow): void {
  registeredWindows.add(win);
  win.on('closed', () => {
    registeredWindows.delete(win);
  });
  log.info('[TradeExecutorIPC] Window registered for trade events');
}

export default registerTradeExecutorIPC;
