var R = Object.defineProperty;
var v = (s, e, t) => e in s ? R(s, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : s[e] = t;
var l = (s, e, t) => v(s, typeof e != "symbol" ? e + "" : e, t);
import { app as h, BrowserWindow as y, ipcMain as a, shell as O, nativeImage as D, Tray as w, Menu as _ } from "electron";
import p from "path";
import L from "net";
import r from "electron-log";
import P from "better-sqlite3";
class A {
  constructor(e, t) {
    l(this, "host");
    l(this, "port");
    l(this, "socket", null);
    l(this, "version", "");
    l(this, "connected", !1);
    l(this, "reqId", 0);
    l(this, "pendingRequests", /* @__PURE__ */ new Map());
    this.host = e, this.port = t;
  }
  async connect() {
    return new Promise((e, t) => {
      this.socket = new L.Socket(), this.socket.connect(this.port, this.host, () => {
        this.connected = !0, this.version = "OpenD connected", r.info(`[FutuOpenD] Connected to ${this.host}:${this.port}`), e();
      }), this.socket.on("error", (c) => {
        r.error("[FutuOpenD] Connection error:", c.message), this.connected = !1, t(c);
      }), this.socket.on("close", () => {
        this.connected = !1, r.info("[FutuOpenD] Disconnected");
      }), this.socket.on("data", (c) => {
        this.handleData(c);
      });
    });
  }
  disconnect() {
    var e;
    (e = this.socket) == null || e.destroy(), this.socket = null, this.connected = !1;
    for (const [, t] of this.pendingRequests)
      clearTimeout(t.timer), t.reject(new Error("Disconnected"));
    this.pendingRequests.clear();
  }
  handleData(e) {
    r.debug("[FutuOpenD] Received", e.length, "bytes");
  }
  // ── Market Data API ─────────────────────────────────────────────
  async getQuotes(e) {
    return { success: !0, quotes: e.map((t) => ({
      code: t,
      name: "",
      price: 0,
      change: 0,
      changePct: 0,
      volume: 0,
      high: 0,
      low: 0,
      open: 0,
      prevClose: 0
    })) };
  }
  async getKlines(e, t, c) {
    return { success: !0, klines: [] };
  }
  // ── Trading API ─────────────────────────────────────────────────
  async getAccounts() {
    return { success: !0, accounts: [] };
  }
  async getFunds(e) {
    return { success: !0, funds: {} };
  }
  async getPositions(e) {
    return { success: !0, positions: [] };
  }
  async getOrders(e) {
    return { success: !0, orders: [] };
  }
  async placeOrder(e) {
    return r.info("[FutuOpenD] Place order:", e), { success: !0, orderId: `ORD-${Date.now()}` };
  }
  async cancelOrder(e) {
    return r.info("[FutuOpenD] Cancel order:", e), { success: !0 };
  }
}
class N {
  constructor() {
    l(this, "liveStrategies", /* @__PURE__ */ new Map());
  }
  createStrategy(e) {
    const t = `strat_${Date.now()}`;
    return r.info(`[StrategyEngine] Created strategy: ${t}`, e.name), t;
  }
  startLive(e) {
    this.liveStrategies.has(e) || (r.info(`[StrategyEngine] Starting live: ${e}`), this.liveStrategies.set(e, { timer: setInterval(() => {
    }, 6e4), status: "running" }));
  }
  stopLive(e) {
    const t = this.liveStrategies.get(e);
    t && (clearInterval(t.timer), this.liveStrategies.delete(e), r.info(`[StrategyEngine] Stopped live: ${e}`));
  }
  emergencyStop() {
    r.warn("[StrategyEngine] 🚨 EMERGENCY STOP — stopping all live strategies");
    for (const [e, t] of this.liveStrategies)
      clearInterval(t.timer), r.info(`[StrategyEngine] Emergency stopped: ${e}`);
    this.liveStrategies.clear();
  }
}
class F {
  async run(e) {
    return r.info("[BacktestEngine] Running backtest:", e.strategyId, e.startDate, "→", e.endDate), {
      success: !0,
      result: {
        totalReturn: 0,
        annualReturn: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        totalTrades: 0,
        winRate: 0,
        equityCurve: [],
        trades: []
      }
    };
  }
}
const I = "quantdesk.db";
class X {
  constructor() {
    l(this, "db", null);
    l(this, "dbPath", "");
  }
  initialize() {
    const e = h.getPath("userData");
    this.dbPath = p.join(e, I), r.info("[Database] Opening:", this.dbPath), this.db = new P(this.dbPath), this.db.pragma("journal_mode = WAL"), this.db.pragma("foreign_keys = ON"), this.createTables();
  }
  createTables() {
    this.db && (this.db.exec(`
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        dsl_json TEXT NOT NULL,
        version TEXT DEFAULT '1.0.0',
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS backtest_runs (
        id TEXT PRIMARY KEY,
        strategy_id TEXT REFERENCES strategies(id),
        start_date TEXT,
        end_date TEXT,
        initial_capital REAL,
        result_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        strategy_id TEXT REFERENCES strategies(id),
        account_id TEXT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity REAL,
        price REAL,
        commission REAL,
        pnl REAL,
        executed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `), r.info("[Database] Tables initialized"));
  }
  // ── Strategies ──────────────────────────────────────────────────
  getStrategies() {
    return this.db ? this.db.prepare("SELECT * FROM strategies ORDER BY updated_at DESC").all() : [];
  }
  saveStrategy(e) {
    if (!this.db) return;
    this.db.prepare(`
      INSERT OR REPLACE INTO strategies (id, name, description, dsl_json, version, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(e.id, e.name, e.description || "", JSON.stringify(e), e.version || "1.0.0", e.status || "draft");
  }
  deleteStrategy(e) {
    var t;
    (t = this.db) == null || t.prepare("DELETE FROM strategies WHERE id = ?").run(e);
  }
  // ── Settings ────────────────────────────────────────────────────
  getSettings() {
    if (!this.db) return {};
    const e = this.db.prepare("SELECT key, value FROM settings").all(), t = {};
    for (const c of e) t[c.key] = c.value;
    return t;
  }
  saveSettings(e) {
    if (!this.db) return;
    const t = this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    for (const [c, d] of Object.entries(e))
      t.run(c, typeof d == "string" ? d : JSON.stringify(d));
  }
  // ── Lifecycle ───────────────────────────────────────────────────
  close() {
    var e;
    (e = this.db) == null || e.close(), this.db = null, r.info("[Database] Closed");
  }
}
class C {
  constructor() {
    l(this, "config", {
      maxSinglePositionPct: 0.2,
      // 单品种最大 20%
      maxTotalPositionPct: 0.95,
      // 总持仓最大 95%
      dailyLossLimitPct: 0.05,
      // 日最大亏损 5%
      maxOrdersPerMinute: 10
      // 频率限制
    });
    l(this, "orderTimestamps", []);
  }
  checkOrder(e) {
    const t = Date.now();
    return this.orderTimestamps = this.orderTimestamps.filter((c) => t - c < 6e4), this.orderTimestamps.length >= this.config.maxOrdersPerMinute ? (r.warn("[RiskEngine] ⚠️ Rate limit: too many orders"), { pass: !1, reason: "下单频率过高（每分钟最多10单）" }) : e.qty <= 0 ? { pass: !1, reason: "数量必须大于0" } : e.price && e.price <= 0 ? { pass: !1, reason: "价格必须大于0" } : (this.orderTimestamps.push(t), { pass: !0 });
  }
  updateConfig(e) {
    Object.assign(this.config, e), r.info("[RiskEngine] Config updated:", this.config);
  }
}
const b = !h.isPackaged, M = b ? p.join(__dirname, "..") : p.join(process.resourcesPath, "resources");
let i = null, T = null, n = null, u = null, m = null, E = null, o = null;
function S() {
  i = new y({
    width: 1400,
    height: 900,
    minWidth: 1e3,
    minHeight: 600,
    title: "QuantDesk Pro",
    icon: p.join(M, "icons", "icon.png"),
    backgroundColor: "#0d1117",
    show: !1,
    webPreferences: {
      preload: p.join(__dirname, "preload.js"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !0
    }
  }), b ? (i.loadURL("http://localhost:5173"), i.webContents.openDevTools({ mode: "detach" })) : i.loadFile(p.join(__dirname, "../dist/index.html")), i.once("ready-to-show", () => {
    i == null || i.show();
  }), i.webContents.setWindowOpenHandler(({ url: s }) => (O.openExternal(s), { action: "deny" })), i.on("closed", () => {
    i = null;
  });
}
function x() {
  a.handle("broker:connect", async (s, e) => {
    try {
      return n = new A(e.host, e.port), await n.connect(), r.info("[Broker] OpenD connected", e), { success: !0, version: n.version };
    } catch (t) {
      return r.error("[Broker] OpenD connect failed:", t.message), { success: !1, error: t.message };
    }
  }), a.handle("broker:disconnect", async () => (n == null || n.disconnect(), n = null, { success: !0 })), a.handle("broker:getAccounts", async () => n ? n.getAccounts() : { success: !1, error: "Not connected" }), a.handle("broker:getFunds", async (s, e) => n ? n.getFunds(e) : { success: !1, error: "Not connected" }), a.handle("broker:getPositions", async (s, e) => n ? n.getPositions(e) : { success: !1, error: "Not connected" }), a.handle("broker:getQuotes", async (s, e) => n ? n.getQuotes(e) : { success: !1, error: "Not connected" }), a.handle("broker:getKlines", async (s, e, t, c) => n ? n.getKlines(e, t, c) : { success: !1, error: "Not connected" }), a.handle("broker:placeOrder", async (s, e) => {
    if (!n) return { success: !1, error: "Not connected" };
    const t = E == null ? void 0 : E.checkOrder(e);
    return t && !t.pass ? { success: !1, error: `风控拦截: ${t.reason}` } : n.placeOrder(e);
  }), a.handle("broker:cancelOrder", async (s, e) => n ? n.cancelOrder(e) : { success: !1, error: "Not connected" }), a.handle("broker:getOrders", async (s, e) => n ? n.getOrders(e) : { success: !1, error: "Not connected" }), a.handle("strategy:create", async (s, e) => ({ success: !0, id: u == null ? void 0 : u.createStrategy(e) })), a.handle("strategy:backtest", async (s, e) => m ? m.run(e) : { success: !1, error: "Backtest engine not ready" }), a.handle("strategy:startLive", async (s, e) => (u == null || u.startLive(e), { success: !0 })), a.handle("strategy:stopLive", async (s, e) => (u == null || u.stopLive(e), { success: !0 })), a.handle("db:getStrategies", async () => (o == null ? void 0 : o.getStrategies()) || []), a.handle("db:saveStrategy", async (s, e) => o == null ? void 0 : o.saveStrategy(e)), a.handle("db:getSettings", async () => (o == null ? void 0 : o.getSettings()) || {}), a.handle("db:saveSettings", async (s, e) => o == null ? void 0 : o.saveSettings(e)), a.handle("app:getInfo", () => ({
    version: h.getVersion(),
    name: "QuantDesk Pro",
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome
  })), a.handle("app:getMemoryUsage", () => ({
    mainProcess: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    total: Math.round(process.memoryUsage().rss / 1024 / 1024)
  }));
}
function U() {
  const e = D.createFromBuffer(j(16));
  T = new w(e);
  const t = _.buildFromTemplate([
    { label: "QuantDesk Pro", enabled: !1 },
    { type: "separator" },
    { label: "显示主窗口", click: () => i == null ? void 0 : i.show() },
    { label: "紧急停止所有策略", click: () => u == null ? void 0 : u.emergencyStop() },
    { type: "separator" },
    { label: "退出", click: () => h.quit() }
  ]);
  T.setToolTip("QuantDesk Pro"), T.setContextMenu(t), T.on("double-click", () => i == null ? void 0 : i.show());
}
h.whenReady().then(async () => {
  r.info("[App] QuantDesk Pro starting..."), o = new X(), o.initialize(), u = new N(), m = new F(), E = new C(), x(), S(), U(), r.info("[App] QuantDesk Pro ready");
});
h.on("window-all-closed", () => {
  process.platform;
});
h.on("activate", () => {
  y.getAllWindows().length === 0 && S();
});
h.on("before-quit", () => {
  n == null || n.disconnect(), o == null || o.close(), u == null || u.emergencyStop();
});
function j(s) {
  const e = Buffer.alloc(s * s * 4), t = s / 2, c = s / 2;
  for (let d = 0; d < s; d++)
    for (let g = 0; g < s; g++) {
      const k = Math.abs(g - t) + Math.abs(d - c), f = (d * s + g) * 4;
      k < s / 2 - 1 && (e[f] = 201, e[f + 1] = 169, e[f + 2] = 110, e[f + 3] = 255);
    }
  return e;
}
