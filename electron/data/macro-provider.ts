// ── Macro Data Provider — Macroeconomic Time Series ────────────────────────
// JVS-2: GDP/CPI/PMI/M2/LPR/Interest Rate data for dashboard
// Data source: East Money datacenter API
// Cache: SQLite + memory, 1h TTL (macro data changes infrequently)

import log from 'electron-log';
import https from 'https';
import http from 'http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MacroPoint {
  indicator: string;   // 'GDP' | 'CPI' | 'PMI' | 'PPI' | 'M2' | 'LPR' | 'UNEMPLOYMENT' | 'INDUSTRIAL'
  date: string;        // YYYY-MM or YYYY-MM-DD
  value: number;
  yoy: number;         // Year-over-year %
  mom: number;         // Month-over-month %
  unit: string;        // '%', 'billion', 'index'
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export interface MacroIndicatorSummary {
  indicator: string;
  latest: MacroPoint | null;
  trend: 'up' | 'down' | 'flat';
  history: MacroPoint[];
  lastUpdated: number;
}

export interface MacroDashboardData {
  success: boolean;
  indicators: MacroIndicatorSummary[];
  timestamp: number;
  source: string;
  error?: string;
}

export type IndicatorType = 'GDP' | 'CPI' | 'PMI' | 'PPI' | 'M2' | 'LPR' | 'UNEMPLOYMENT' | 'INDUSTRIAL';

// ── API Configuration ──────────────────────────────────────────────────────

// East Money datacenter API endpoints for each indicator
const EM_MACRO_APIS: Record<IndicatorType, {
  reportName: string;
  columns: string;
  filter?: string;
  sortColumn?: string;
  sortType?: number;
  valueField: string;
  dateField: string;
  yoyField?: string;
  momField?: string;
  unit: string;
  frequency: MacroPoint['frequency'];
}> = {
  GDP: {
    reportName: 'RPT_ECONOMY_GDP',
    columns: 'REPORT_DATE,FIRST_INDUSTRY,SECOND_INDUSTRY,THIRD_INDUSTRY,GDP_SAME_RATIO',
    valueField: 'GDP_SAME_RATIO',
    dateField: 'REPORT_DATE',
    yoyField: 'GDP_SAME_RATIO',
    unit: '%',
    frequency: 'quarterly',
  },
  CPI: {
    reportName: 'RPT_ECONOMY_CPI',
    columns: 'REPORT_DATE,NATIONAL_SAME,NATIONAL_SEQUENTIAL,NATIONAL_ACCUMULATE',
    valueField: 'NATIONAL_SAME',
    dateField: 'REPORT_DATE',
    yoyField: 'NATIONAL_SAME',
    momField: 'NATIONAL_SEQUENTIAL',
    unit: '%',
    frequency: 'monthly',
  },
  PMI: {
    reportName: 'RPT_ECONOMY_PMI',
    columns: 'REPORT_DATE,PMI,MAKE_PMI,NON_MANUFACTURING_PMI',
    valueField: 'PMI',
    dateField: 'REPORT_DATE',
    yoyField: 'PMI',
    unit: '%',
    frequency: 'monthly',
  },
  PPI: {
    reportName: 'RPT_ECONOMY_PPI',
    columns: 'REPORT_DATE,PPI_SAME,PPI_SEQUENTIAL',
    valueField: 'PPI_SAME',
    dateField: 'REPORT_DATE',
    yoyField: 'PPI_SAME',
    momField: 'PPI_SEQUENTIAL',
    unit: '%',
    frequency: 'monthly',
  },
  M2: {
    reportName: 'RPT_ECONOMY_MONEY_SUPPLY',
    columns: 'REPORT_DATE,M2,M2_SAME,M2_SEQUENTIAL,M1,M1_SAME',
    valueField: 'M2_SAME',
    dateField: 'REPORT_DATE',
    yoyField: 'M2_SAME',
    momField: 'M2_SEQUENTIAL',
    unit: '%',
    frequency: 'monthly',
  },
  LPR: {
    reportName: 'RPT_ECONOMY_LPR',
    columns: 'REPORT_DATE,LPR1Y,LPR5Y',
    valueField: 'LPR1Y',
    dateField: 'REPORT_DATE',
    unit: '%',
    frequency: 'monthly',
  },
  UNEMPLOYMENT: {
    reportName: 'RPT_ECONOMY_UNEMPLOYMENT',
    columns: 'REPORT_DATE,URBAN_SURVEY_RATE',
    valueField: 'URBAN_SURVEY_RATE',
    dateField: 'REPORT_DATE',
    unit: '%',
    frequency: 'monthly',
  },
  INDUSTRIAL: {
    reportName: 'RPT_ECONOMY_INDUSTRIAL',
    columns: 'REPORT_DATE,INDUSTRIAL_YOY,INDUSTRIAL_MOM',
    valueField: 'INDUSTRIAL_YOY',
    dateField: 'REPORT_DATE',
    yoyField: 'INDUSTRIAL_YOY',
    momField: 'INDUSTRIAL_MOM',
    unit: '%',
    frequency: 'monthly',
  },
};

const BASE_URL = 'https://datacenter.eastmoney.com/api/data/v1/get';
const MACRO_TTL = 60 * 60 * 1000; // 1 hour (macro data rarely changes intra-day)

// ── HTTP Helper ────────────────────────────────────────────────────────────

function httpGet(url: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

// ── Macro Data Provider ────────────────────────────────────────────────────

export class MacroDataProvider {
  private memoryCache = new Map<string, { data: MacroIndicatorSummary; expires: number }>();
  private db: any = null;

  initialize(db: any): void {
    this.db = db;
    this.createTables();
    log.info('[MacroDataProvider] Initialized — macro dashboard ready');
  }

  private createTables(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS macro_data_cache (
        indicator TEXT NOT NULL,
        date TEXT NOT NULL,
        value REAL,
        yoy REAL,
        mom REAL,
        unit TEXT,
        frequency TEXT,
        fetched_at INTEGER NOT NULL,
        PRIMARY KEY (indicator, date)
      );
      CREATE INDEX IF NOT EXISTS idx_macro_indicator ON macro_data_cache(indicator);
      CREATE INDEX IF NOT EXISTS idx_macro_date ON macro_data_cache(date DESC);
    `);
  }

  /**
   * Get a single indicator's time series
   */
  async getIndicator(type: IndicatorType, limit = 24): Promise<MacroIndicatorSummary> {
    const cacheKey = `macro-${type}`;
    const now = Date.now();

    // 1. Memory cache
    const cached = this.memoryCache.get(cacheKey);
    if (cached && cached.expires > now) {
      return cached.data;
    }

    // 2. SQLite cache
    if (this.db) {
      const rows = this.db.prepare(
        'SELECT * FROM macro_data_cache WHERE indicator = ? ORDER BY date DESC LIMIT ?'
      ).all(type, limit) as any[];

      if (rows && rows.length >= 3) { // At least 3 data points
        const history = rows.reverse().map((r: any) => ({
          indicator: r.indicator,
          date: r.date,
          value: r.value ?? 0,
          yoy: r.yoy ?? 0,
          mom: r.mom ?? 0,
          unit: r.unit || '',
          frequency: r.frequency || 'monthly',
        }));

        const latest = history[history.length - 1];
        const trend = this.computeTrend(history);

        const summary: MacroIndicatorSummary = {
          indicator: type,
          latest,
          trend,
          history,
          lastUpdated: rows[rows.length - 1]?.fetched_at || now,
        };

        this.memoryCache.set(cacheKey, { data: summary, expires: now + MACRO_TTL });
        return summary;
      }
    }

    // 3. Fetch from API
    try {
      const summary = await this.fetchIndicator(type, limit);
      if (summary.latest) {
        this.saveIndicator(type, summary);
        this.memoryCache.set(cacheKey, { data: summary, expires: now + MACRO_TTL });
      }
      return summary;
    } catch (err: any) {
      log.warn(`[MacroDataProvider] API fetch failed for ${type}:`, err.message);
      return this.getStaleData(type, limit) || this.emptyIndicator(type);
    }
  }

  /**
   * Get all macro indicators for dashboard
   */
  async getDashboard(indicators?: IndicatorType[]): Promise<MacroDashboardData> {
    const types = indicators || (['GDP', 'CPI', 'PMI', 'PPI', 'M2', 'LPR', 'UNEMPLOYMENT', 'INDUSTRIAL'] as IndicatorType[]);

    const results = await Promise.allSettled(
      types.map(type => this.getIndicator(type))
    );

    const summaries: MacroIndicatorSummary[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        summaries.push(r.value);
      }
    }

    return {
      success: summaries.length > 0,
      indicators: summaries,
      timestamp: Date.now(),
      source: 'eastmoney',
    };
  }

  /**
   * Fetch indicator from East Money API
   */
  private async fetchIndicator(type: IndicatorType, limit: number): Promise<MacroIndicatorSummary> {
    const api = EM_MACRO_APIS[type];
    const pageSize = Math.min(limit * 2, 100); // Fetch extra to handle nulls

    const url = `${BASE_URL}?reportName=${api.reportName}&columns=${api.columns}` +
      `&pageNumber=1&pageSize=${pageSize}&sortColumns=${api.sortColumn || api.dateField}` +
      `&sortTypes=${api.sortType ?? -1}&source=WEB&client=WEB`;

    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.result || !json.result.data) {
      return this.emptyIndicator(type);
    }

    const history: MacroPoint[] = [];
    for (const item of json.result.data) {
      const dateStr = item[api.dateField];
      const value = this.safeNum(item[api.valueField]);
      const yoy = api.yoyField ? this.safeNum(item[api.yoyField]) : 0;
      const mom = api.momField ? this.safeNum(item[api.momField]) : 0;

      // Parse date
      let date = '';
      if (dateStr) {
        date = dateStr.slice(0, 10); // YYYY-MM-DD or YYYY-MM
      }

      if (date && value !== 0) {
        history.push({
          indicator: type,
          date,
          value,
          yoy,
          mom,
          unit: api.unit,
          frequency: api.frequency,
        });
      }
    }

    // Sort ascending by date
    history.sort((a, b) => a.date.localeCompare(b.date));

    // Keep only requested limit
    const trimmed = history.slice(-limit);
    const latest = trimmed.length > 0 ? trimmed[trimmed.length - 1] : null;
    const trend = this.computeTrend(trimmed);

    return {
      indicator: type,
      latest,
      trend,
      history: trimmed,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Save indicator data to SQLite
   */
  private saveIndicator(type: IndicatorType, summary: MacroIndicatorSummary): void {
    if (!this.db || summary.history.length === 0) return;

    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO macro_data_cache
      (indicator, date, value, yoy, mom, unit, frequency, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction((points: MacroPoint[]) => {
      for (const p of points) {
        stmt.run(type, p.date, p.value, p.yoy, p.mom, p.unit, p.frequency, now);
      }
    });

    tx(summary.history);
  }

  /**
   * Fallback: return stale data from SQLite
   */
  private getStaleData(type: IndicatorType, limit: number): MacroIndicatorSummary | null {
    if (!this.db) return null;

    const rows = this.db.prepare(
      'SELECT * FROM macro_data_cache WHERE indicator = ? ORDER BY date DESC LIMIT ?'
    ).all(type, limit) as any[];

    if (!rows || rows.length === 0) return null;

    const history = rows.reverse().map((r: any) => ({
      indicator: r.indicator,
      date: r.date,
      value: r.value ?? 0,
      yoy: r.yoy ?? 0,
      mom: r.mom ?? 0,
      unit: r.unit || '',
      frequency: r.frequency || 'monthly',
    }));

    const latest = history[history.length - 1];
    const trend = this.computeTrend(history);

    log.info(`[MacroDataProvider] Using stale cache for ${type}, ${history.length} points`);

    return {
      indicator: type,
      latest,
      trend,
      history,
      lastUpdated: 0,
    };
  }

  /**
   * Compute trend direction from recent history
   */
  private computeTrend(history: MacroPoint[]): 'up' | 'down' | 'flat' {
    if (history.length < 3) return 'flat';
    const recent = history.slice(-3);
    const values = recent.map(p => p.value);
    const diffs = [];
    for (let i = 1; i < values.length; i++) {
      diffs.push(values[i] - values[i - 1]);
    }
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    if (avgDiff > 0.1) return 'up';
    if (avgDiff < -0.1) return 'down';
    return 'flat';
  }

  private emptyIndicator(type: IndicatorType): MacroIndicatorSummary {
    return {
      indicator: type,
      latest: null,
      trend: 'flat',
      history: [],
      lastUpdated: 0,
    };
  }

  private safeNum(v: any): number {
    if (v === null || v === undefined || v === '-') return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  /**
   * Clear expired cache
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, val] of this.memoryCache) {
      if (val.expires < now) this.memoryCache.delete(key);
    }
    if (this.db) {
      this.db.prepare('DELETE FROM macro_data_cache WHERE fetched_at < ?').run(now - 7 * 24 * 60 * 60 * 1000);
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let macroDataProviderInstance: MacroDataProvider | null = null;

export function getMacroDataProvider(): MacroDataProvider {
  if (!macroDataProviderInstance) {
    macroDataProviderInstance = new MacroDataProvider();
  }
  return macroDataProviderInstance;
}
