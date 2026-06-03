// ── Preload Script — IPC Bridge (安全暴露 API 给渲染进程) ──────────────────
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // ── Broker ────────────────────────────────────────────────────────
  broker: {
    connect: (config: any) => ipcRenderer.invoke('broker:connect', config),
    disconnect: () => ipcRenderer.invoke('broker:disconnect'),
    getAccounts: () => ipcRenderer.invoke('broker:getAccounts'),
    getFunds: (accountId: string) => ipcRenderer.invoke('broker:getFunds', accountId),
    getPositions: (accountId: string) => ipcRenderer.invoke('broker:getPositions', accountId),
    getQuotes: (codes: string[]) => ipcRenderer.invoke('broker:getQuotes', codes),
    getKlines: (code: string, period: string, count: number) => ipcRenderer.invoke('broker:getKlines', code, period, count),
    placeOrder: (order: any) => ipcRenderer.invoke('broker:placeOrder', order),
    cancelOrder: (orderId: string) => ipcRenderer.invoke('broker:cancelOrder', orderId),
    getOrders: (accountId: string) => ipcRenderer.invoke('broker:getOrders', accountId),
  },

  // ── Strategy ──────────────────────────────────────────────────────
  strategy: {
    create: (dsl: any) => ipcRenderer.invoke('strategy:create', dsl),
    getAll: () => ipcRenderer.invoke('strategy:getAll'),
    delete: (id: string) => ipcRenderer.invoke('strategy:delete', id),
    backtest: (config: any) => ipcRenderer.invoke('strategy:backtest', config),
    startLive: (id: string) => ipcRenderer.invoke('strategy:startLive', id),
    stopLive: (id: string) => ipcRenderer.invoke('strategy:stopLive', id),
  },

  // ── NL Parser ─────────────────────────────────────────────────────
  nl: {
    parse: (text: string) => ipcRenderer.invoke('nl:parse', text),
    templates: () => ipcRenderer.invoke('nl:templates'),
  },

  // ── Risk ──────────────────────────────────────────────────────────
  risk: {
    getConfig: () => ipcRenderer.invoke('risk:getConfig'),
    updateConfig: (config: any) => ipcRenderer.invoke('risk:updateConfig', config),
    getAlerts: () => ipcRenderer.invoke('risk:getAlerts'),
  },

  // ── Database ──────────────────────────────────────────────────────
  db: {
    getStrategies: () => ipcRenderer.invoke('db:getStrategies'),
    saveStrategy: (s: any) => ipcRenderer.invoke('db:saveStrategy', s),
    getSettings: () => ipcRenderer.invoke('db:getSettings'),
    saveSettings: (s: any) => ipcRenderer.invoke('db:saveSettings', s),
    getTrades: (strategyId?: string) => ipcRenderer.invoke('db:getTrades', strategyId),
    getBacktestResults: (strategyId: string) => ipcRenderer.invoke('db:getBacktestResults', strategyId),
    getWatchlist: () => ipcRenderer.invoke('db:getWatchlist'),
    saveWatchlist: (codes: string[]) => ipcRenderer.invoke('db:saveWatchlist', codes),
    getSignals: (strategyId?: string) => ipcRenderer.invoke('db:getSignals', strategyId),
  },

  // ── App ───────────────────────────────────────────────────────────
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
    getMemoryUsage: () => ipcRenderer.invoke('app:getMemoryUsage'),
    checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
    downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate'),
    installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  },

  // ── Events (Main → Renderer) ─────────────────────────────────────
  on: (channel: string, callback: (...args: any[]) => void) => {
    const allowed = [
      'quotes:push',
      'quote-update',
      'order-update',
      'strategy-signal',
      'risk-alert',
      'notification',
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
});
