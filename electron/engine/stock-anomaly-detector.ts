// ── Stock Anomaly Detector — Real-time Anomaly Detection ───────────────────
// JVS-7: Detects price/volume anomalies, limit up/down, large order alerts
// Integrates with futu-technical-anomaly + futu-capital-anomaly skills

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StockQuote {
  code: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;         // Turnover in yuan
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  prevClose: number;
  timestamp: number;
}

export interface AnomalyAlert {
  id: string;
  code: string;
  name: string;
  type: AnomalyType;
  level: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  price: number;
  changePct: number;
  metrics: Record<string, number>;
  timestamp: number;
  acknowledged: boolean;
}

export type AnomalyType =
  | 'limit_up'           // Price hit daily limit up (+10% or +20%)
  | 'limit_down'         // Price hit daily limit down
  | 'volume_surge'       // Volume > 3x average
  | 'price_breakout'     // Price breaks recent high/low
  | 'large_order'        // Unusually large order detected
  | 'rapid_change'       // Price changed > 3% in < 5 min
  | 'gap_up'             // Open > prevClose + 3%
  | 'gap_down'           // Open < prevClose - 3%
  | 'turnover_spike'     // Turnover rate spike
  | 'capital_inflow'     // Main force net inflow anomaly
  | 'capital_outflow'    // Main force net outflow anomaly
  | 'technical_breakout' // MA/MACD/RSI signal
  | 'derivatives_anomaly'; // Options/futures unusual activity

export interface AnomalyConfig {
  volumeSurgeMultiplier: number;    // Default: 3.0 (3x avg volume)
  rapidChangeThreshold: number;     // Default: 3.0 (%)
  rapidChangeWindowMs: number;      // Default: 300000 (5 min)
  gapThreshold: number;             // Default: 3.0 (%)
  limitUpPct: number;               // Default: 9.8 (%)
  limitDownPct: number;             // Default: -9.8 (%)
  largeOrderThreshold: number;      // Default: 5000000 (500万 yuan)
  enabledTypes: AnomalyType[];
}

export interface AnomalySummary {
  totalAlerts: number;
  critical: number;
  warning: number;
  info: number;
  topMovers: AnomalyAlert[];
  byType: Record<AnomalyType, number>;
  lastScanTime: number;
}

// ── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AnomalyConfig = {
  volumeSurgeMultiplier: 3.0,
  rapidChangeThreshold: 3.0,
  rapidChangeWindowMs: 5 * 60 * 1000,
  gapThreshold: 3.0,
  limitUpPct: 9.8,
  limitDownPct: -9.8,
  largeOrderThreshold: 5000000,
  enabledTypes: [
    'limit_up', 'limit_down', 'volume_surge', 'price_breakout',
    'rapid_change', 'gap_up', 'gap_down', 'turnover_spike',
  ],
};

// ── Stock Anomaly Detector ─────────────────────────────────────────────────

export class StockAnomalyDetector {
  private config: AnomalyConfig;
  private alerts: AnomalyAlert[] = [];
  private quoteHistory = new Map<string, StockQuote[]>();
  private avgVolumes = new Map<string, number>(); // code -> avg daily volume
  private db: any = null;
  private maxAlerts = 500;
  private maxHistory = 100; // Per stock

  constructor(config?: Partial<AnomalyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info('[StockAnomaly] Initialized with', this.config.enabledTypes.length, 'enabled types');
  }

  initialize(db: any): void {
    this.db = db;
    this.createTables();
    this.loadAlerts();
  }

  private createTables(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stock_anomaly_alerts (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        name TEXT,
        type TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        title TEXT NOT NULL,
        description TEXT,
        price REAL,
        change_pct REAL,
        metrics_json TEXT,
        acknowledged INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_anomaly_stock ON stock_anomaly_alerts(code);
      CREATE INDEX IF NOT EXISTS idx_anomaly_type ON stock_anomaly_alerts(type);
      CREATE INDEX IF NOT EXISTS idx_anomaly_level ON stock_anomaly_alerts(level);
      CREATE INDEX IF NOT EXISTS idx_anomaly_time ON stock_anomaly_alerts(created_at DESC);

      CREATE TABLE IF NOT EXISTS stock_avg_volumes (
        code TEXT PRIMARY KEY,
        avg_volume REAL NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  private loadAlerts(): void {
    if (!this.db) return;
    try {
      const rows = this.db.prepare(
        'SELECT * FROM stock_anomaly_alerts WHERE created_at > ? ORDER BY created_at DESC LIMIT ?'
      ).all(Date.now() - 24 * 60 * 60 * 1000, this.maxAlerts) as any[];

      this.alerts = rows.map((r: any) => ({
        id: r.id,
        code: r.code,
        name: r.name || '',
        type: r.type as AnomalyType,
        level: r.level,
        title: r.title,
        description: r.description || '',
        price: r.price ?? 0,
        changePct: r.change_pct ?? 0,
        metrics: JSON.parse(r.metrics_json || '{}'),
        timestamp: r.created_at,
        acknowledged: !!r.acknowledged,
      }));

      // Load avg volumes
      const volRows = this.db.prepare('SELECT * FROM stock_avg_volumes').all() as any[];
      for (const r of volRows) {
        this.avgVolumes.set(r.code, r.avg_volume);
      }

      log.info(`[StockAnomaly] Loaded ${this.alerts.length} alerts, ${this.avgVolumes.size} avg volumes`);
    } catch (err: unknown) {
      log.warn('[StockAnomaly] Load failed:', err.message);
    }
  }

  /**
   * Process a batch of real-time quotes and detect anomalies
   */
  processQuotes(quotes: StockQuote[]): AnomalyAlert[] {
    const newAlerts: AnomalyAlert[] = [];

    for (const quote of quotes) {
      // Update history
      this.updateHistory(quote);

      // Run each enabled detection
      for (const type of this.config.enabledTypes) {
        const alert = this.detect(quote, type);
        if (alert) {
          newAlerts.push(alert);
          this.saveAlert(alert);
        }
      }
    }

    // Add to alerts list
    this.alerts.unshift(...newAlerts);
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }

    if (newAlerts.length > 0) {
      log.info(`[StockAnomaly] ${newAlerts.length} new alerts from ${quotes.length} quotes`);
    }

    return newAlerts;
  }

  /**
   * Detect a specific type of anomaly for a quote
   */
  private detect(quote: StockQuote, type: AnomalyType): AnomalyAlert | null {
    switch (type) {
      case 'limit_up': return this.detectLimitUp(quote);
      case 'limit_down': return this.detectLimitDown(quote);
      case 'volume_surge': return this.detectVolumeSurge(quote);
      case 'rapid_change': return this.detectRapidChange(quote);
      case 'gap_up': return this.detectGap(quote, 'up');
      case 'gap_down': return this.detectGap(quote, 'down');
      case 'price_breakout': return this.detectBreakout(quote);
      case 'turnover_spike': return this.detectTurnoverSpike(quote);
      default: return null;
    }
  }

  private detectLimitUp(q: StockQuote): AnomalyAlert | null {
    if (q.changePct < this.config.limitUpPct) return null;
    // Check if actually at limit (price barely moving)
    const limitPrice = q.prevClose * (1 + (q.code.startsWith('68') || q.code.startsWith('30') ? 0.20 : 0.10));
    if (q.price < limitPrice * 0.995) return null; // Not quite at limit

    return this.createAlert(q, 'limit_up', 'critical',
      `${q.name} hit limit up`,
      `${q.name}(${q.code}) price ${q.price} (+${q.changePct.toFixed(2)}%), near daily limit`,
      { changePct: q.changePct, limitPrice }
    );
  }

  private detectLimitDown(q: StockQuote): AnomalyAlert | null {
    if (q.changePct > this.config.limitDownPct) return null;
    const limitPrice = q.prevClose * (1 - (q.code.startsWith('68') || q.code.startsWith('30') ? 0.20 : 0.10));
    if (q.price > limitPrice * 1.005) return null;

    return this.createAlert(q, 'limit_down', 'critical',
      `${q.name} hit limit down`,
      `${q.name}(${q.code}) price ${q.price} (${q.changePct.toFixed(2)}%), near daily limit`,
      { changePct: q.changePct, limitPrice }
    );
  }

  private detectVolumeSurge(q: StockQuote): AnomalyAlert | null {
    const avgVol = this.avgVolumes.get(q.code);
    if (!avgVol || avgVol === 0) return null;

    const ratio = q.volume / avgVol;
    if (ratio < this.config.volumeSurgeMultiplier) return null;

    // Avoid duplicate alerts for same stock within 10 min
    if (this.hasRecentAlert(q.code, 'volume_surge', 10 * 60 * 1000)) return null;

    return this.createAlert(q, 'volume_surge', ratio > 5 ? 'critical' : 'warning',
      `${q.name} volume surge ${ratio.toFixed(1)}x`,
      `${q.name}(${q.code}) volume ${ratio.toFixed(1)}x above average`,
      { volumeRatio: ratio, avgVolume: avgVol, currentVolume: q.volume }
    );
  }

  private detectRapidChange(q: StockQuote): AnomalyAlert | null {
    const history = this.quoteHistory.get(q.code);
    if (!history || history.length < 2) return null;

    const windowStart = q.timestamp - this.config.rapidChangeWindowMs;
    const oldQuotes = history.filter(h => h.timestamp >= windowStart && h.timestamp < q.timestamp);
    if (oldQuotes.length === 0) return null;

    const oldest = oldQuotes[0];
    const pctChange = ((q.price - oldest.price) / oldest.price) * 100;

    if (Math.abs(pctChange) < this.config.rapidChangeThreshold) return null;
    if (this.hasRecentAlert(q.code, 'rapid_change', 10 * 60 * 1000)) return null;

    return this.createAlert(q, 'rapid_change', 'warning',
      `${q.name} rapid ${pctChange > 0 ? 'rise' : 'drop'} ${pctChange.toFixed(2)}% in ${Math.round((q.timestamp - oldest.timestamp) / 1000)}s`,
      `${q.name}(${q.code}) moved ${pctChange.toFixed(2)}% in ${Math.round((q.timestamp - oldest.timestamp) / 60000)}min`,
      { rapidChangePct: pctChange, timeSpanMs: q.timestamp - oldest.timestamp }
    );
  }

  private detectGap(q: StockQuote, direction: 'up' | 'down'): AnomalyAlert | null {
    if (!q.openPrice || !q.prevClose) return null;
    const gapPct = ((q.openPrice - q.prevClose) / q.prevClose) * 100;

    if (direction === 'up' && gapPct < this.config.gapThreshold) return null;
    if (direction === 'down' && gapPct > -this.config.gapThreshold) return null;

    const type = direction === 'up' ? 'gap_up' : 'gap_down';
    if (this.hasRecentAlert(q.code, type, 4 * 60 * 60 * 1000)) return null; // Once per session

    return this.createAlert(q, type, 'info',
      `${q.name} gap ${direction} ${gapPct.toFixed(2)}%`,
      `${q.name}(${q.code}) opened at ${q.openPrice} vs prev close ${q.prevClose} (${gapPct.toFixed(2)}%)`,
      { gapPct, openPrice: q.openPrice, prevClose: q.prevClose }
    );
  }

  private detectBreakout(q: StockQuote): AnomalyAlert | null {
    const history = this.quoteHistory.get(q.code);
    if (!history || history.length < 10) return null;

    // Find 20-day high/low from history
    const highs = history.map(h => h.highPrice).filter(h => h > 0);
    const lows = history.map(h => h.lowPrice).filter(h => h > 0);
    if (highs.length < 5) return null;

    const recentHigh = Math.max(...highs.slice(0, -1)); // Exclude current
    const recentLow = Math.min(...lows.slice(0, -1));

    if (q.price > recentHigh && q.price > 0) {
      if (this.hasRecentAlert(q.code, 'price_breakout', 60 * 60 * 1000)) return null;
      return this.createAlert(q, 'price_breakout', 'info',
        `${q.name} breakout above ${recentHigh.toFixed(2)}`,
        `${q.name}(${q.code}) price ${q.price} broke above recent high ${recentHigh.toFixed(2)}`,
        { breakoutLevel: recentHigh, currentPrice: q.price }
      );
    }

    if (q.price < recentLow && q.price > 0) {
      if (this.hasRecentAlert(q.code, 'price_breakout', 60 * 60 * 1000)) return null;
      return this.createAlert(q, 'price_breakout', 'warning',
        `${q.name} breakdown below ${recentLow.toFixed(2)}`,
        `${q.name}(${q.code}) price ${q.price} broke below recent low ${recentLow.toFixed(2)}`,
        { breakdownLevel: recentLow, currentPrice: q.price }
      );
    }

    return null;
  }

  private detectTurnoverSpike(q: StockQuote): AnomalyAlert | null {
    // Simplified: if volume is very high relative to typical
    const avgVol = this.avgVolumes.get(q.code);
    if (!avgVol) return null;
    const ratio = q.volume / avgVol;
    if (ratio < 5) return null; // Very strict for turnover spike
    if (this.hasRecentAlert(q.code, 'turnover_spike', 30 * 60 * 1000)) return null;

    return this.createAlert(q, 'turnover_spike', 'warning',
      `${q.name} extreme turnover ${ratio.toFixed(1)}x`,
      `${q.name}(${q.code}) turnover rate extremely elevated`,
      { turnoverRatio: ratio }
    );
  }

  // ── Helper Methods ───────────────────────────────────────────────────────

  private updateHistory(quote: StockQuote): void {
    if (!this.quoteHistory.has(quote.code)) {
      this.quoteHistory.set(quote.code, []);
    }
    const history = this.quoteHistory.get(quote.code)!;
    history.push({ ...quote });
    if (history.length > this.maxHistory) history.shift();
  }

  private hasRecentAlert(code: string, type: AnomalyType, windowMs: number): boolean {
    const cutoff = Date.now() - windowMs;
    return this.alerts.some(a => a.code === code && a.type === type && a.timestamp > cutoff);
  }

  private createAlert(
    quote: StockQuote, type: AnomalyType, level: AnomalyAlert['level'],
    title: string, description: string, metrics: Record<string, number>
  ): AnomalyAlert {
    return {
      id: `anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: quote.code,
      name: quote.name,
      type,
      level,
      title,
      description,
      price: quote.price,
      changePct: quote.changePct,
      metrics,
      timestamp: Date.now(),
      acknowledged: false,
    };
  }

  private saveAlert(alert: AnomalyAlert): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT OR REPLACE INTO stock_anomaly_alerts
      (id, code, name, type, level, title, description, price, change_pct, metrics_json, acknowledged, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      alert.id, alert.code, alert.name, alert.type, alert.level,
      alert.title, alert.description, alert.price, alert.changePct,
      JSON.stringify(alert.metrics), alert.acknowledged ? 1 : 0, alert.timestamp
    );
  }

  /**
   * Update average volumes (call daily after market close)
   */
  updateAverageVolumes(volumes: Map<string, number>): void {
    for (const [code, vol] of volumes) {
      this.avgVolumes.set(code, vol);
    }

    if (this.db) {
      const now = Date.now();
      const stmt = this.db.prepare(
        'INSERT OR REPLACE INTO stock_avg_volumes (code, avg_volume, updated_at) VALUES (?, ?, ?)'
      );
      const tx = this.db.transaction((vols: Map<string, number>) => {
        for (const [code, vol] of vols) {
          stmt.run(code, vol, now);
        }
      });
      tx(volumes);
    }

    log.info(`[StockAnomaly] Updated ${volumes.size} avg volumes`);
  }

  /**
   * Get current alerts summary
   */
  getSummary(hoursBack = 4): AnomalySummary {
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    const recent = this.alerts.filter(a => a.timestamp > cutoff);

    const byType: Partial<Record<AnomalyType, number>> = {};
    for (const a of recent) {
      byType[a.type] = (byType[a.type] || 0) + 1;
    }

    const topMovers = recent
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 10);

    return {
      totalAlerts: recent.length,
      critical: recent.filter(a => a.level === 'critical').length,
      warning: recent.filter(a => a.level === 'warning').length,
      info: recent.filter(a => a.level === 'info').length,
      topMovers,
      byType: byType as Record<AnomalyType, number>,
      lastScanTime: Date.now(),
    };
  }

  /**
   * Get all active alerts
   */
  getAlerts(options?: {
    level?: AnomalyAlert['level'];
    type?: AnomalyType;
    code?: string;
    limit?: number;
    unacknowledgedOnly?: boolean;
  }): AnomalyAlert[] {
    let filtered = [...this.alerts];

    if (options?.level) filtered = filtered.filter(a => a.level === options.level);
    if (options?.type) filtered = filtered.filter(a => a.type === options.type);
    if (options?.code) filtered = filtered.filter(a => a.code === options.code);
    if (options?.unacknowledgedOnly) filtered = filtered.filter(a => !a.acknowledged);

    return filtered.slice(0, options?.limit || 50);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(id: string): boolean {
    const alert = this.alerts.find(a => a.id === id);
    if (!alert) return false;
    alert.acknowledged = true;

    if (this.db) {
      this.db.prepare('UPDATE stock_anomaly_alerts SET acknowledged = 1 WHERE id = ?').run(id);
    }
    return true;
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(daysBack = 7): number {
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    const before = this.alerts.length;
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);

    if (this.db) {
      this.db.prepare('DELETE FROM stock_anomaly_alerts WHERE created_at < ?').run(cutoff);
    }

    return before - this.alerts.length;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let anomalyDetectorInstance: StockAnomalyDetector | null = null;

export function getStockAnomalyDetector(): StockAnomalyDetector {
  if (!anomalyDetectorInstance) {
    anomalyDetectorInstance = new StockAnomalyDetector();
  }
  return anomalyDetectorInstance;
}
