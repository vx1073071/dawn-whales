import { contextBridge as i, ipcRenderer as t } from "electron";
i.exposeInMainWorld("api", {
  // ── Broker ────────────────────────────────────────────────────────
  broker: {
    connect: (e) => t.invoke("broker:connect", e),
    disconnect: () => t.invoke("broker:disconnect"),
    getAccounts: () => t.invoke("broker:getAccounts"),
    getFunds: (e) => t.invoke("broker:getFunds", e),
    getPositions: (e) => t.invoke("broker:getPositions", e),
    getQuotes: (e) => t.invoke("broker:getQuotes", e),
    getKlines: (e, o, r) => t.invoke("broker:getKlines", e, o, r),
    placeOrder: (e) => t.invoke("broker:placeOrder", e),
    cancelOrder: (e) => t.invoke("broker:cancelOrder", e),
    getOrders: (e) => t.invoke("broker:getOrders", e)
  },
  // ── Strategy ──────────────────────────────────────────────────────
  strategy: {
    create: (e) => t.invoke("strategy:create", e),
    backtest: (e) => t.invoke("strategy:backtest", e),
    startLive: (e) => t.invoke("strategy:startLive", e),
    stopLive: (e) => t.invoke("strategy:stopLive", e)
  },
  // ── Database ──────────────────────────────────────────────────────
  db: {
    getStrategies: () => t.invoke("db:getStrategies"),
    saveStrategy: (e) => t.invoke("db:saveStrategy", e),
    getSettings: () => t.invoke("db:getSettings"),
    saveSettings: (e) => t.invoke("db:saveSettings", e)
  },
  // ── App ───────────────────────────────────────────────────────────
  app: {
    getInfo: () => t.invoke("app:getInfo"),
    getMemoryUsage: () => t.invoke("app:getMemoryUsage")
  },
  // ── Events (Main → Renderer) ─────────────────────────────────────
  on: (e, o) => {
    ["quote-update", "order-update", "strategy-signal", "risk-alert", "notification"].includes(e) && t.on(e, (s, ...n) => o(...n));
  }
});
