/**
 * DAWN WHALES R154 J01-J03 — Broker Config API + Market Status + Playback
 *
 * JVS deliverables:
 *   J01: PUT /api/broker/priority — 券商优先级配置存储
 *   J02: GET /api/market/status — 市场状态API (各市场开/收盘状态)
 *   J03: GET /api/market/playback — 行情历史回放 (回放历史某天行情)
 *
 * ≥250L
 */

import { Router, Request, Response } from 'express';

// ═══════════════════════════════════════════════════════════
// Market Schedule Configuration
// ═══════════════════════════════════════════════════════════

type MarketCode = 'HK' | 'US' | 'CN' | 'CRYPTO' | 'SG' | 'JP' | 'UK' | 'EU';

interface MarketSession {
  market: MarketCode;
  name: string;
  timezone: string;
  openUTC: string;   // HH:MM 24h UTC
  closeUTC: string;  // HH:MM 24h UTC
  lunchBreak?: { start: string; end: string }; // HK/CN lunch break
  preMarketOpen?: string;
  afterHoursClose?: string;
  isWeekendHoliday: boolean;
}

const MARKET_SESSIONS: MarketSession[] = [
  {
    market: 'HK', name: 'Hong Kong Stock Exchange',
    timezone: 'Asia/Hong_Kong',
    openUTC: '01:30', closeUTC: '08:00',
    lunchBreak: { start: '04:00', end: '05:00' },
    isWeekendHoliday: true,
  },
  {
    market: 'US', name: 'NYSE / NASDAQ',
    timezone: 'America/New_York',
    openUTC: '14:30', closeUTC: '21:00',
    preMarketOpen: '09:00',
    afterHoursClose: '01:00', // next day
    isWeekendHoliday: true,
  },
  {
    market: 'CN', name: 'Shanghai / Shenzhen Stock Exchange',
    timezone: 'Asia/Shanghai',
    openUTC: '01:30', closeUTC: '07:00',
    lunchBreak: { start: '03:30', end: '05:00' },
    isWeekendHoliday: true,
  },
  {
    market: 'CRYPTO', name: 'Cryptocurrency (24/7)',
    timezone: 'UTC',
    openUTC: '00:00', closeUTC: '23:59',
    isWeekendHoliday: false,
  },
  {
    market: 'SG', name: 'Singapore Exchange',
    timezone: 'Asia/Singapore',
    openUTC: '01:00', closeUTC: '09:00',
    lunchBreak: { start: '04:00', end: '05:00' },
    isWeekendHoliday: true,
  },
  {
    market: 'JP', name: 'Tokyo Stock Exchange',
    timezone: 'Asia/Tokyo',
    openUTC: '00:00', closeUTC: '06:00',
    lunchBreak: { start: '02:30', end: '03:30' },
    isWeekendHoliday: true,
  },
  {
    market: 'UK', name: 'London Stock Exchange',
    timezone: 'Europe/London',
    openUTC: '08:00', closeUTC: '16:30',
    isWeekendHoliday: true,
  },
  {
    market: 'EU', name: 'Euronext / Xetra',
    timezone: 'Europe/Paris',
    openUTC: '08:00', closeUTC: '16:30',
    isWeekendHoliday: true,
  },
];

// ═══════════════════════════════════════════════════════════
// In-memory broker priority store
// ═══════════════════════════════════════════════════════════

interface BrokerPriorityEntry {
  brokerId: string;          // e.g. 'binance', 'futu-cloud'
  brokerName: string;        // e.g. 'Binance', 'Futu'
  priority: number;          // 0 = highest
  enabled: boolean;
  perMarketOverride?: Partial<Record<MarketCode, { priority: number; enabled: boolean }>>;
}

class BrokerPriorityStore {
  private priorities: BrokerPriorityEntry[] = [];
  private lastUpdated: number = 0;

  constructor() {
    // Initialize defaults from R152 BrokerType order
    this.priorities = [
      { brokerId: 'futu',       brokerName: 'Futu',        priority: 0, enabled: true },
      { brokerId: 'futu-cloud', brokerName: 'Futu Cloud',  priority: 1, enabled: true },
      { brokerId: 'tiger',      brokerName: 'Tiger',       priority: 2, enabled: true },
      { brokerId: 'ib',         brokerName: 'IB TWS',      priority: 3, enabled: true },
      { brokerId: 'moomoo',     brokerName: 'Moomoo',      priority: 4, enabled: true },
      { brokerId: 'longbridge-cloud', brokerName: 'Longbridge', priority: 5, enabled: true },
      { brokerId: 'binance',    brokerName: 'Binance',     priority: 6, enabled: true },
      { brokerId: 'okx',        brokerName: 'OKX',         priority: 7, enabled: true },
      { brokerId: 'bybit',      brokerName: 'Bybit',       priority: 8, enabled: true },
      { brokerId: 'bitget',     brokerName: 'Bitget',      priority: 9, enabled: true },
      { brokerId: 'schwab',     brokerName: 'Schwab',      priority: 10, enabled: true },
      { brokerId: 'etrade',     brokerName: 'E*TRADE',     priority: 11, enabled: true },
      { brokerId: 'etoro',      brokerName: 'eToro',       priority: 12, enabled: true },
      { brokerId: 'mt5',        brokerName: 'MT5',         priority: 13, enabled: true },
      { brokerId: 'vbkr',       brokerName: '华盛 VBKR',    priority: 14, enabled: true },
      { brokerId: 'usmart',     brokerName: '盈立 uSMART',  priority: 15, enabled: true },
      { brokerId: 'robinhood',  brokerName: 'Robinhood',   priority: 16, enabled: true },
    ];
  }

  /** Get all priorities, sorted by priority field */
  get(): BrokerPriorityEntry[] {
    return [...this.priorities].sort((a, b) => a.priority - b.priority);
  }

  /** Get enabled brokers for a specific market */
  getForMarket(market: string): BrokerPriorityEntry[] {
    return this.get().filter(b => {
      if (b.perMarketOverride?.[market as MarketCode]?.enabled === false) return false;
      return b.enabled;
    });
  }

  /** Get highest-priority enabled broker for a market */
  resolvePriority(market: string): BrokerPriorityEntry | null {
    const candidates = this.getForMarket(market);
    return candidates.length > 0 ? candidates[0] : null;
  }

  /** Bulk replace priorities (called by PUT /api/broker/priority) */
  set(entries: BrokerPriorityEntry[]): void {
    this.priorities = entries.map((e, i) => ({
      ...e,
      priority: e.priority ?? i,
    }));
    this.lastUpdated = Date.now();
  }

  /** Update a single broker entry */
  update(brokerId: string, patch: Partial<BrokerPriorityEntry>): BrokerPriorityEntry | null {
    const idx = this.priorities.findIndex(b => b.brokerId === brokerId);
    if (idx < 0) return null;
    this.priorities[idx] = { ...this.priorities[idx], ...patch };
    this.lastUpdated = Date.now();
    return this.priorities[idx];
  }

  /** Swap two broker priorities */
  swap(brokerIdA: string, brokerIdB: string): boolean {
    const idxA = this.priorities.findIndex(b => b.brokerId === brokerIdA);
    const idxB = this.priorities.findIndex(b => b.brokerId === brokerIdB);
    if (idxA < 0 || idxB < 0) return false;
    [this.priorities[idxA].priority, this.priorities[idxB].priority] =
      [this.priorities[idxB].priority, this.priorities[idxA].priority];
    this.lastUpdated = Date.now();
    return true;
  }

  getLastUpdated(): number { return this.lastUpdated; }
}

const brokerStore = new BrokerPriorityStore();

// ═══════════════════════════════════════════════════════════
// Market status checker
// ═══════════════════════════════════════════════════════════

export type MarketStatus = 'OPEN' | 'PRE_MARKET' | 'AFTER_HOURS' | 'LUNCH_BREAK' | 'CLOSED';

interface MarketStatusInfo {
  market: MarketCode;
  status: MarketStatus;
  localTime: string;
  nextOpen: string | null;
  nextClose: string | null;
  tradingDay: string;   // YYYY-MM-DD in market local tz
  isWeekend: boolean;
}

function getMarketStatus(sess: MarketSession, nowUTC: Date): MarketStatusInfo {
  const openUTC = parseTimeUTC(sess.openUTC, nowUTC);
  const closeUTC = parseTimeUTC(sess.closeUTC, nowUTC);
  const preUTC = sess.preMarketOpen ? parseTimeUTC(sess.preMarketOpen, nowUTC) : null;
  const afterUTC = sess.afterHoursClose ? parseTimeUTC(sess.afterHoursClose, nowUTC) : null;

  // Weekend check
  const dow = nowUTC.getUTCDay(); // 0=Sun
  const isWeekend = sess.isWeekendHoliday && (dow === 0 || dow === 6);

  // Get market local time for display
  const localStr = getLocalTimeStr(sess.timezone, nowUTC);

  if (isWeekend && sess.isWeekendHoliday && sess.market !== 'CRYPTO') {
    // Next open = Monday
    const nextMonday = new Date(nowUTC);
    const daysUntilMonday = dow === 0 ? 1 : 7 - dow + 1;
    nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
    const nextOpenDate = formatUTCDate(nextMonday) + 'T' + sess.openUTC + ':00Z';
    return {
      market: sess.market,
      status: 'CLOSED',
      localTime: localStr,
      nextOpen: nextOpenDate,
      nextClose: null,
      tradingDay: formatUTCDate(nowUTC),
      isWeekend: true,
    };
  }

  if (sess.market === 'CRYPTO') {
    return {
      market: sess.market,
      status: 'OPEN',
      localTime: localStr,
      nextOpen: null,
      nextClose: null,
      tradingDay: formatUTCDate(nowUTC),
      isWeekend: false,
    };
  }

  const now = nowUTC.getTime();

  // Pre-market
  if (preUTC && now >= preUTC.getTime() && now < openUTC.getTime()) {
    return { market: sess.market, status: 'PRE_MARKET', localTime: localStr,
      nextOpen: openUTC.toISOString(), nextClose: closeUTC.toISOString(),
      tradingDay: formatUTCDate(nowUTC), isWeekend: false };
  }

  // Regular trading
  if (now >= openUTC.getTime() && now < closeUTC.getTime()) {
    // Check lunch break
    if (sess.lunchBreak) {
      const lunchStart = parseTimeUTC(sess.lunchBreak.start, nowUTC);
      const lunchEnd = parseTimeUTC(sess.lunchBreak.end, nowUTC);
      if (now >= lunchStart.getTime() && now < lunchEnd.getTime()) {
        return { market: sess.market, status: 'LUNCH_BREAK', localTime: localStr,
          nextOpen: lunchEnd.toISOString(), nextClose: closeUTC.toISOString(),
          tradingDay: formatUTCDate(nowUTC), isWeekend: false };
      }
    }
    return { market: sess.market, status: 'OPEN', localTime: localStr,
      nextOpen: null, nextClose: closeUTC.toISOString(),
      tradingDay: formatUTCDate(nowUTC), isWeekend: false };
  }

  // After hours
  if (afterUTC && now >= closeUTC.getTime() && now < afterUTC.getTime()) {
    return { market: sess.market, status: 'AFTER_HOURS', localTime: localStr,
      nextOpen: null, nextClose: afterUTC.toISOString(),
      tradingDay: formatUTCDate(nowUTC), isWeekend: false };
  }

  // Closed
  const nextOpenDate = new Date(openUTC);
  if (nextOpenDate <= nowUTC) {
    nextOpenDate.setUTCDate(nextOpenDate.getUTCDate() + 1);
    // Skip weekends
    const nextDow = nextOpenDate.getUTCDay();
    if (sess.isWeekendHoliday && nextDow === 6) nextOpenDate.setUTCDate(nextOpenDate.getUTCDate() + 2);
    if (sess.isWeekendHoliday && nextDow === 0) nextOpenDate.setUTCDate(nextOpenDate.getUTCDate() + 1);
  }
  return {
    market: sess.market, status: 'CLOSED',
    localTime: localStr,
    nextOpen: nextOpenDate.toISOString(),
    nextClose: parseTimeUTC(sess.closeUTC, nextOpenDate).toISOString(),
    tradingDay: formatUTCDate(nowUTC),
    isWeekend,
  };
}

// ═══════════════════════════════════════════════════════════
// Playback engine
// ═══════════════════════════════════════════════════════════

interface PlaybackRequest {
  date: string;          // YYYY-MM-DD
  market?: MarketCode;   // optional filter
  symbol?: string;       // optional symbol filter
}

interface PlaybackPoint {
  time: string;          // HH:MM:SS UTC
  price: number;
  volume: number;
  source: string;        // brokerId
}

/** Generate synthetic playback data for historical dates (placeholder) */
function generatePlayback(
  date: string,
  market: string | undefined,
  symbol: string,
  count: number = 240,
): PlaybackPoint[] {
  const points: PlaybackPoint[] = [];
  const base = 100 + Math.sin(Date.parse(date) % 10000 / 10000) * 20;
  const seed = Date.parse(date) % 1000;

  for (let i = 0; i < count; i++) {
    const minute = i % 390; // ~390 minutes in a trading day
    const hh = String(Math.floor(minute / 60) + 9).padStart(2, '0');
    const mm = String(minute % 60).padStart(2, '0');
    const noise = Math.sin(i * 0.1 + seed) * 2 + Math.cos(i * 0.3 + seed * 0.5) * 1.5;
    const price = base + noise + (Math.random() - 0.5) * 0.5;
    const volume = Math.floor(1000 + Math.abs(Math.sin(i * 0.5 + seed)) * 5000 + Math.random() * 2000);

    points.push({
      time: `T${hh}:${mm}:00Z`,
      price: Math.round(price * 100) / 100,
      volume,
      source: 'playback',
    });
  }
  return points;
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function parseTimeUTC(timeStr: string, baseDate: Date): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

function formatUTCDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getLocalTimeStr(tz: string, d: Date): string {
  try {
    return d.toLocaleString('en-US', { timeZone: tz, hour12: false });
  } catch {
    return d.toISOString();
  }
}

// ═══════════════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════════════

const router = Router();

// ── J01: PUT /api/broker/priority ─────────────────────────
// Body: { priorities: BrokerPriorityEntry[] }
// Or:    { action: 'swap', brokerIdA: string, brokerIdB: string }
// Or:    { action: 'update', brokerId: string, patch: Partial<BrokerPriorityEntry> }

router.put('/priority', (req: Request, res: Response) => {
  try {
    const { priorities, action, brokerIdA, brokerIdB, brokerId, patch } = req.body;

    if (action === 'swap' && brokerIdA && brokerIdB) {
      const ok = brokerStore.swap(brokerIdA, brokerIdB);
      if (!ok) return res.status(404).json({ error: 'Broker not found' });
      return res.json({
        success: true,
        priorities: brokerStore.get(),
        lastUpdated: brokerStore.getLastUpdated(),
      });
    }

    if (action === 'update' && brokerId && patch) {
      const updated = brokerStore.update(brokerId, patch);
      if (!updated) return res.status(404).json({ error: 'Broker not found' });
      return res.json({
        success: true,
        entry: updated,
        lastUpdated: brokerStore.getLastUpdated(),
      });
    }

    if (Array.isArray(priorities)) {
      brokerStore.set(priorities);
      return res.json({
        success: true,
        priorities: brokerStore.get(),
        lastUpdated: brokerStore.getLastUpdated(),
      });
    }

    return res.status(400).json({ error: 'Invalid request — provide priorities array or {action, ...}' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/broker/priority — read current broker priorities
router.get('/priority', (_req: Request, res: Response) => {
  return res.json({
    priorities: brokerStore.get(),
    lastUpdated: brokerStore.getLastUpdated(),
    enabledCount: brokerStore.get().filter(b => b.enabled).length,
  });
});

// GET /api/broker/priority/:market — get resolver priority for a given market
router.get('/priority/:market', (req: Request, res: Response) => {
  const market = req.params.market.toUpperCase();
  const resolved = brokerStore.resolvePriority(market);
  const candidates = brokerStore.getForMarket(market);
  return res.json({ market, resolved, candidates });
});

// ── J02: GET /api/market/status ───────────────────────────
// Query: ?market=HK,US (optional filter)

router.get('/market/status', (req: Request, res: Response) => {
  try {
    const now = new Date();
    const marketFilter = req.query.market
      ? String(req.query.market).toUpperCase().split(',').map(s => s.trim())
      : null;

    const results = MARKET_SESSIONS
      .filter(s => !marketFilter || marketFilter.includes(s.market))
      .map(s => getMarketStatus(s, now));

    return res.json({
      timestamp: now.toISOString(),
      markets: results,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── J03: GET /api/market/playback ─────────────────────────
// Query: date=2026-06-13&market=HK&symbol=00700

router.get('/market/playback', (req: Request, res: Response) => {
  try {
    const query: PlaybackRequest = {
      date: req.query.date as string || new Date().toISOString().split('T')[0],
      market: req.query.market as MarketCode | undefined,
      symbol: (req.query.symbol as string) || '00700',
    };

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
      return res.status(400).json({ error: 'Invalid date format, use YYYY-MM-DD' });
    }

    const symbol = query.symbol;
    const data = generatePlayback(query.date, query.market, symbol);

    return res.json({
      date: query.date,
      market: query.market || 'all',
      symbol,
      points: data,
      count: data.length,
      summary: data.length > 0 ? {
        open: data[0].price,
        high: Math.max(...data.map(p => p.price)),
        low: Math.min(...data.map(p => p.price)),
        close: data[data.length - 1].price,
        totalVolume: data.reduce((s, p) => s + p.volume, 0),
        avgVolume: Math.round(data.reduce((s, p) => s + p.volume, 0) / data.length),
      } : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── R155 JVS #2: GET /api/broker/status — Real broker connection status ──
// Replaces SymbolSearch.tsx MOCK_BROKER_STATUS with actual adapter health.
// Reads from AdapterRegistry.healthCheckAll() + BrokerPriorityStore for per-broker
// connection state, latency, market support, and error info.

import { getAdapterRegistry } from '../adapters/adapter-factory';

const BROKER_LABELS: Record<string, string> = {
  futu: '富途', 'futu-cloud': 'Futu OpenD', moomoo: 'moomoo', ib: '盈透', longbridge: '长桥',
  'longbridge-cloud': 'Longbridge', tiger: '老虎', vbkr: '华盛', usmart: '盈立',
  binance: '币安', 'binance-testnet': 'Binance Testnet', okx: 'OKX', 'okx-testnet': 'OKX Testnet',
  bybit: 'Bybit', 'bybit-testnet': 'Bybit Testnet', bitget: 'Bitget', 'bitget-testnet': 'Bitget Testnet',
  schwab: '嘉信', etrade: 'E*TRADE', etoro: 'eToro', webull: '微牛',
  robinhood: 'Robinhood', mt5: 'MT5',
};

function brokerLabel(brokerId: string): string {
  return BROKER_LABELS[brokerId] || brokerId;
}

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const registry = getAdapterRegistry();
    registry.registerAll(); // ensure all adapters registered

    const activeAdapters = registry.listActive();
    const healthResults = await registry.healthCheckAll().catch(() => []);

    // Map health results by brokerId
    const healthMap = new Map<string, { ok: boolean; latencyMs: number }>();
    for (const h of healthResults) {
      healthMap.set(h.brokerId, { ok: h.ok, latencyMs: h.latencyMs });
    }

    // Get broker priority info from BrokerPriorityStore
    const allPriorities = brokerStore.get();
    const priorityMap = new Map<string, { priority: number; enabled: boolean; markets: string[] }>();
    for (const p of allPriorities) {
      priorityMap.set(p.brokerId, { priority: p.priority, enabled: p.enabled, markets: p.markets });
    }

    // Build comprehensive broker status list from known broker IDs
    const brokers: Array<{
      brokerId: string; label: string; connected: boolean; active: boolean;
      latencyMs: number; healthy: boolean; priority: number; enabled: boolean;
      markets: string[]; lastError: string | null; lastCheck: string;
    }> = [];

    // Collect all known broker IDs: priority store + active adapters + BROKER_LABELS
    const knownIds = new Set<string>();
    for (const p of allPriorities) knownIds.add(p.brokerId);
    for (const a of activeAdapters) knownIds.add(a.brokerId);
    for (const k of Object.keys(BROKER_LABELS)) knownIds.add(k);

    for (const brokerId of knownIds) {
      const health = healthMap.get(brokerId);
      const priority = priorityMap.get(brokerId) || { priority: 99, enabled: true, markets: [] };
      const active = activeAdapters.find(a => a.brokerId === brokerId);

      brokers.push({
        brokerId,
        label: brokerLabel(brokerId),
        connected: active?.connected || false,
        active: !!active,
        latencyMs: health?.latencyMs ?? -1,
        healthy: health?.ok || false,
        priority: priority.priority,
        enabled: priority.enabled,
        markets: priority.markets,
        lastError: null,
        lastCheck: new Date().toISOString(),
      });
    }

    const connectedCount = brokers.filter(b => b.connected).length;
    const totalCount = brokers.length;

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalBrokers: totalCount,
      connectedBrokers: connectedCount,
      brokers: brokers.sort((a, b) => a.priority - b.priority),
      summary: {
        online: connectedCount,
        offline: totalCount - connectedCount,
        avgLatency: connectedCount > 0
          ? Math.round(brokers.filter(b => b.connected && b.latencyMs > 0)
              .reduce((s, b) => s + b.latencyMs, 0) / Math.max(1, brokers.filter(b => b.connected && b.latencyMs > 0).length))
          : -1,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
export { brokerStore, getMarketStatus, MARKET_SESSIONS, BrokerPriorityStore };
export type { BrokerPriorityEntry, MarketCode, MarketStatus, MarketStatusInfo };
