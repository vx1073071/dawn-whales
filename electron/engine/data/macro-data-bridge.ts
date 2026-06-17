/**
 * R257 P1-4: 宏观数据桥接 (MacroDataBridge)
 * 
 * 经济日历API集成 — 连接宏观数据源到策略引擎
 * 
 * 功能:
 *   1. 经济日历事件管理 (来自 Investing.com / FRED)
 *   2. 宏观影响度评分 (对各类资产的影响矩阵)
 *   3. 跨市场相关性数据
 *   4. 事件前提醒与事后复盘
 *   5. 与策略/归因引擎对接
 * 
 * 下游: move-attribution-engine.ts (macro维度), market-to-strategy-bridge.ts
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type MacroRegion = 'US' | 'EU' | 'CN' | 'JP' | 'UK' | 'GLOBAL';

export type MacroCategory =
  | 'interest_rate'
  | 'inflation'
  | 'employment'
  | 'gdp'
  | 'trade'
  | 'consumer'
  | 'housing'
  | 'manufacturing'
  | 'monetary_policy'
  | 'commodity'
  | 'geopolitical';

export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

export interface EconomicEvent {
  eventId: string;
  title: string;
  titleCn: string;
  category: MacroCategory;
  region: MacroRegion;
  scheduledAt: number;          // expected release time
  actualAt?: number;
  importance: ImpactLevel;
  forecast?: number;
  previous?: number;
  actual?: number | null;       // null = not yet released
  unit: string;
  affectedAssets: AffectedAsset[];
  description?: string;
}

export interface AffectedAsset {
  assetType: 'forex' | 'index' | 'commodity' | 'bond' | 'crypto' | 'stock_sector';
  symbol: string;
  name: string;
  expectedDirection?: 'positive' | 'negative' | 'volatile';
  impactScore: number;          // 0-1
}

export interface CrossMarketCorrelation {
  pair: [string, string];
  pairNames: [string, string];
  correlation: number;          // -1 to 1
  period: string;               // e.g. '1M', '3M', '1Y'
  lastUpdated: number;
  significance: 'strong' | 'moderate' | 'weak' | 'negligible';
}

export interface MacroSnapshot {
  timestamp: number;
  region: MacroRegion;
  indicators: MacroIndicator[];
  summary: string;
  summaryCn: string;
  riskLevel: 'low' | 'elevated' | 'high' | 'extreme';
}

export interface MacroIndicator {
  name: string;
  nameCn: string;
  category: MacroCategory;
  value: number;
  previousValue: number;
  trend: 'improving' | 'stable' | 'deteriorating';
  deviationFromConsensus?: number;  // %
}

export interface EventAlert {
  alertId: string;
  event: EconomicEvent;
  minutesBefore: number;        // how many minutes before event
  triggered: boolean;
  triggeredAt?: number;
}

// ── Default correlation matrix ─────────────────────────────────────────────

const CORRELATION_MATRIX: CrossMarketCorrelation[] = [
  { pair: ['SPX', 'HSI'],    pairNames: ['S&P 500', '恒生指数'],   correlation: 0.72, period: '1Y', lastUpdated: 0, significance: 'strong' },
  { pair: ['SPX', 'BTC'],    pairNames: ['S&P 500', '比特币'],     correlation: 0.65, period: '1Y', lastUpdated: 0, significance: 'strong' },
  { pair: ['USDX', 'GLD'],   pairNames: ['美元指数', '黄金'],      correlation: -0.81, period: '1Y', lastUpdated: 0, significance: 'strong' },
  { pair: ['VIX', 'SPX'],    pairNames: ['VIX恐慌', 'S&P 500'],    correlation: -0.78, period: '1Y', lastUpdated: 0, significance: 'strong' },
  { pair: ['US10Y', 'NDX'],  pairNames: ['美10年债', '纳斯达克'], correlation: -0.45, period: '1Y', lastUpdated: 0, significance: 'moderate' },
  { pair: ['CL', 'XLE'],     pairNames: ['原油', '能源板块'],      correlation: 0.88, period: '1Y', lastUpdated: 0, significance: 'strong' },
  { pair: ['CNY', 'A50'],    pairNames: ['人民币', 'A50期货'],     correlation: 0.56, period: '1Y', lastUpdated: 0, significance: 'moderate' },
  { pair: ['BTC', 'ETH'],    pairNames: ['比特币', '以太坊'],      correlation: 0.91, period: '1Y', lastUpdated: 0, significance: 'strong' },
  { pair: ['DXY', 'EEM'],    pairNames: ['美元指数', '新兴市场'],  correlation: -0.64, period: '1Y', lastUpdated: 0, significance: 'strong' },
  { pair: ['SPX', 'CN50'],   pairNames: ['S&P 500', '富时中国50'], correlation: 0.51, period: '1Y', lastUpdated: 0, significance: 'moderate' },
];

// ── Category → affected asset defaults ────────────────────────────────────

const CATEGORY_AFFECTED: Record<MacroCategory, Partial<AffectedAsset>[]> = {
  interest_rate: [
    { assetType: 'bond', symbol: 'US10Y', expectedDirection: 'volatile', impactScore: 0.95 },
    { assetType: 'index', symbol: 'NDX', expectedDirection: 'negative', impactScore: 0.85 },
    { assetType: 'forex', symbol: 'USDJPY', expectedDirection: 'positive', impactScore: 0.80 },
  ],
  inflation: [
    { assetType: 'commodity', symbol: 'GLD', expectedDirection: 'positive', impactScore: 0.90 },
    { assetType: 'bond', symbol: 'US02Y', expectedDirection: 'volatile', impactScore: 0.85 },
    { assetType: 'forex', symbol: 'EURUSD', expectedDirection: 'volatile', impactScore: 0.75 },
  ],
  employment: [
    { assetType: 'index', symbol: 'SPX', expectedDirection: 'volatile', impactScore: 0.90 },
    { assetType: 'forex', symbol: 'DXY', expectedDirection: 'volatile', impactScore: 0.85 },
  ],
  gdp: [
    { assetType: 'index', symbol: 'SPX', expectedDirection: 'positive', impactScore: 0.80 },
    { assetType: 'forex', symbol: 'DXY', expectedDirection: 'positive', impactScore: 0.75 },
  ],
  trade: [
    { assetType: 'forex', symbol: 'USDCNY', expectedDirection: 'volatile', impactScore: 0.85 },
    { assetType: 'commodity', symbol: 'HG', expectedDirection: 'volatile', impactScore: 0.70 },
  ],
  consumer: [
    { assetType: 'index', symbol: 'SPX', expectedDirection: 'positive', impactScore: 0.65 },
    { assetType: 'stock_sector', symbol: 'XLY', expectedDirection: 'positive', impactScore: 0.75 },
  ],
  housing: [
    { assetType: 'stock_sector', symbol: 'XHB', expectedDirection: 'volatile', impactScore: 0.70 },
    { assetType: 'bond', symbol: 'US10Y', expectedDirection: 'volatile', impactScore: 0.60 },
  ],
  manufacturing: [
    { assetType: 'commodity', symbol: 'HG', expectedDirection: 'positive', impactScore: 0.65 },
    { assetType: 'index', symbol: 'SPX', expectedDirection: 'positive', impactScore: 0.55 },
  ],
  monetary_policy: [
    { assetType: 'forex', symbol: 'DXY', expectedDirection: 'volatile', impactScore: 0.95 },
    { assetType: 'index', symbol: 'SPX', expectedDirection: 'volatile', impactScore: 0.90 },
    { assetType: 'bond', symbol: 'US02Y', expectedDirection: 'volatile', impactScore: 0.90 },
  ],
  commodity: [
    { assetType: 'commodity', symbol: 'GLD', expectedDirection: 'positive', impactScore: 0.85 },
    { assetType: 'commodity', symbol: 'CL', expectedDirection: 'volatile', impactScore: 0.80 },
    { assetType: 'forex', symbol: 'AUDUSD', expectedDirection: 'positive', impactScore: 0.75 },
  ],
  geopolitical: [
    { assetType: 'commodity', symbol: 'GLD', expectedDirection: 'positive', impactScore: 0.90 },
    { assetType: 'commodity', symbol: 'CL', expectedDirection: 'volatile', impactScore: 0.85 },
    { assetType: 'crypto', symbol: 'BTC', expectedDirection: 'positive', impactScore: 0.55 },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// MacroDataBridge
// ═══════════════════════════════════════════════════════════════════════════

export class MacroDataBridge {
  private events: EconomicEvent[] = [];
  private snapshots: MacroSnapshot[] = [];
  private alerts: EventAlert[] = [];
  private correlations: CrossMarketCorrelation[] = [];
  private watchedRegions: Set<MacroRegion> = new Set(['US', 'CN', 'GLOBAL']);
  private stats_ = {
    totalEvents: 0,
    activeAlerts: 0,
    lastSnapshotAt: 0,
    lastEventAt: 0,
  };

  constructor() {
    this.correlations = [...CORRELATION_MATRIX];
  }

  // ── Public API: Economic Events ─────────────────────────────────────────

  /**
   * Add an economic calendar event.
   * Auto-generates affected assets based on category.
   */
  addEvent(event: Omit<EconomicEvent, 'eventId' | 'affectedAssets'> & {
    affectedAssets?: AffectedAsset[];
  }): EconomicEvent {
    const eventId = `econ:${event.region}:${event.category}:${event.scheduledAt}:${this._hash(event.title).toString(36).slice(0, 4)}`;

    const affectedAssets: AffectedAsset[] = event.affectedAssets ?? 
      CATEGORY_AFFECTED[event.category]?.map((a, i) => ({
        ...a,
        name: a.symbol ?? '',
        impactScore: a.impactScore ?? 0,
      } as AffectedAsset)) ?? [];

    const fullEvent: EconomicEvent = {
      ...event,
      eventId,
      affectedAssets,
    };

    this.events.push(fullEvent);
    this.stats_.totalEvents++;
    this.stats_.lastEventAt = Date.now();

    return fullEvent;
  }

  /**
   * Update event with actual value (post-release).
   */
  updateEventActual(eventId: string, actual: number): EconomicEvent | null {
    const event = this.events.find(e => e.eventId === eventId);
    if (!event) return null;
    event.actual = actual;
    event.actualAt = Date.now();
    return event;
  }

  /**
   * Get upcoming events (next N hours).
   */
  getUpcomingEvents(hours = 24, regions?: MacroRegion[]): EconomicEvent[] {
    const now = Date.now();
    const cutoff = now + hours * 3_600_000;
    const filterRegions = regions ? new Set(regions) : this.watchedRegions;

    return this.events
      .filter(e => e.scheduledAt >= now && e.scheduledAt <= cutoff)
      .filter(e => filterRegions.has(e.region))
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
  }

  /**
   * Get events by importance (today's critical/high impact events).
   */
  getHighImpactEvents(regions?: MacroRegion[]): EconomicEvent[] {
    const today = this._todayRange();
    const filterRegions = regions ? new Set(regions) : this.watchedRegions;

    return this.events
      .filter(e => e.scheduledAt >= today.start && e.scheduledAt <= today.end)
      .filter(e => e.importance === 'high' || e.importance === 'critical')
      .filter(e => filterRegions.has(e.region))
      .sort((a, b) => {
        const priority: Record<ImpactLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return priority[a.importance] - priority[b.importance];
      });
  }

  /**
   * Get event by ID.
   */
  getEvent(eventId: string): EconomicEvent | null {
    return this.events.find(e => e.eventId === eventId) ?? null;
  }

  /**
   * Get all events (with optional filter).
   */
  getAllEvents(filter?: {
    region?: MacroRegion;
    category?: MacroCategory;
    importance?: ImpactLevel;
    from?: number;
    to?: number;
  }): EconomicEvent[] {
    return this.events.filter(e => {
      if (filter?.region && e.region !== filter.region) return false;
      if (filter?.category && e.category !== filter.category) return false;
      if (filter?.importance && e.importance !== filter.importance) return false;
      if (filter?.from && e.scheduledAt < filter.from) return false;
      if (filter?.to && e.scheduledAt > filter.to) return false;
      return true;
    });
  }

  // ── Public API: Correlation ─────────────────────────────────────────────

  /**
   * Get cross-market correlations for a symbol.
   */
  getCorrelations(symbol: string): CrossMarketCorrelation[] {
    return this.correlations
      .filter(c => c.pair[0] === symbol || c.pair[1] === symbol)
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  /**
   * Get all correlation pairs.
   */
  getAllCorrelations(): CrossMarketCorrelation[] {
    return [...this.correlations];
  }

  /**
   * Add a custom correlation.
   */
  addCorrelation(corr: CrossMarketCorrelation): void {
    const existing = this.correlations.findIndex(
      c => (c.pair[0] === corr.pair[0] && c.pair[1] === corr.pair[1]) ||
           (c.pair[0] === corr.pair[1] && c.pair[1] === corr.pair[0]),
    );
    if (existing >= 0) {
      this.correlations[existing] = { ...corr, lastUpdated: Date.now() };
    } else {
      this.correlations.push(corr);
    }
  }

  // ── Public API: Alerts ──────────────────────────────────────────────────

  /**
   * Set an alert for an upcoming event (N minutes before).
   */
  setAlert(eventId: string, minutesBefore: number): EventAlert | null {
    const event = this.events.find(e => e.eventId === eventId);
    if (!event || event.scheduledAt < Date.now()) return null;

    const alert: EventAlert = {
      alertId: `alert:${eventId}:${minutesBefore}`,
      event,
      minutesBefore,
      triggered: false,
    };

    this.alerts.push(alert);
    this.stats_.activeAlerts++;

    return alert;
  }

  /**
   * Check and trigger due alerts.
   * Returns alerts that should fire now.
   */
  checkAlerts(): EventAlert[] {
    const now = Date.now();
    const due: EventAlert[] = [];

    for (const alert of this.alerts) {
      if (alert.triggered) continue;
      const triggerAt = alert.event.scheduledAt - alert.minutesBefore * 60_000;
      if (now >= triggerAt) {
        alert.triggered = true;
        alert.triggeredAt = now;
        this.stats_.activeAlerts--;
        due.push(alert);
      }
    }

    return due;
  }

  /** Get all active alerts */
  getActiveAlerts(): EventAlert[] {
    return this.alerts.filter(a => !a.triggered);
  }

  /** Cancel an alert */
  cancelAlert(alertId: string): boolean {
    const idx = this.alerts.findIndex(a => a.alertId === alertId);
    if (idx < 0) return false;
    if (!this.alerts[idx].triggered) this.stats_.activeAlerts--;
    this.alerts.splice(idx, 1);
    return true;
  }

  // ── Public API: Macro Snapshot ──────────────────────────────────────────

  /**
   * Take a macro snapshot for a region.
   * Summarizes current indicator state.
   */
  takeSnapshot(region: MacroRegion, indicators: MacroIndicator[]): MacroSnapshot {
    const deteriorating = indicators.filter(i => i.trend === 'deteriorating').length;
    const improving = indicators.filter(i => i.trend === 'improving').length;

    let riskLevel: MacroSnapshot['riskLevel'] = 'low';
    if (deteriorating >= 4) riskLevel = 'extreme';
    else if (deteriorating >= 2) riskLevel = 'high';
    else if (deteriorating >= 1 && improving < deteriorating) riskLevel = 'elevated';

    const snapshot: MacroSnapshot = {
      timestamp: Date.now(),
      region,
      indicators,
      summary: this._generateSummary(region, indicators, riskLevel),
      summaryCn: this._generateSummaryCn(region, indicators, riskLevel),
      riskLevel,
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > 100) this.snapshots.shift();
    this.stats_.lastSnapshotAt = Date.now();

    return snapshot;
  }

  /** Get latest snapshot for a region */
  getLatestSnapshot(region: MacroRegion): MacroSnapshot | null {
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].region === region) return this.snapshots[i];
    }
    return null;
  }

  // ── Public API: Region Watch ─────────────────────────────────────────────

  /** Set which regions to watch */
  setWatchedRegions(regions: MacroRegion[]): void {
    this.watchedRegions = new Set(regions);
  }

  getWatchedRegions(): MacroRegion[] {
    return Array.from(this.watchedRegions);
  }

  // ── Public API: Stats & Reset ────────────────────────────────────────────

  getStats() {
    return { ...this.stats_, totalCorrelations: this.correlations.length };
  }

  reset(): void {
    this.events = [];
    this.snapshots = [];
    this.alerts = [];
    this.correlations = [...CORRELATION_MATRIX];
    this.watchedRegions = new Set(['US', 'CN', 'GLOBAL']);
    this.stats_ = { totalEvents: 0, activeAlerts: 0, lastSnapshotAt: 0, lastEventAt: 0 };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _todayRange(): { start: number; end: number } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 86_400_000;
    return { start, end };
  }

  private _generateSummary(region: MacroRegion, indicators: MacroIndicator[], risk: string): string {
    const regionName: Record<MacroRegion, string> = {
      US: 'US', EU: 'Eurozone', CN: 'China', JP: 'Japan', UK: 'UK', GLOBAL: 'Global',
    };
    const improving = indicators.filter(i => i.trend === 'improving').length;
    const deteriorating = indicators.filter(i => i.trend === 'deteriorating').length;
    return `${regionName[region]} macro: ${improving}/${indicators.length} improving, ${deteriorating} deteriorating — risk ${risk}`;
  }

  private _generateSummaryCn(region: MacroRegion, indicators: MacroIndicator[], risk: string): string {
    const regionName: Record<MacroRegion, string> = {
      US: '美国', EU: '欧元区', CN: '中国', JP: '日本', UK: '英国', GLOBAL: '全球',
    };
    const improving = indicators.filter(i => i.trend === 'improving').length;
    const deteriorating = indicators.filter(i => i.trend === 'deteriorating').length;
    const riskCn: Record<string, string> = { low: '低', elevated: '偏高', high: '高', extreme: '极危' };
    return `${regionName[region]}宏观: ${improving}/${indicators.length}项改善, ${deteriorating}项恶化 — 风险${riskCn[risk]}`;
  }

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }
}

export const macroDataBridge = new MacroDataBridge();
