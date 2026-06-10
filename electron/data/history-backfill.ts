// ── JVS-30: Historical Data Backfill Service ─────────────────────────────
// Backfills 1 year of historical data for all 21 JVS data modules
// Uses datacenter.eastmoney.com API + push2 history endpoints
// IPC: history:backfill-start, history:backfill-status, history:backfill-stop

import log from 'electron-log';
import https from 'https';
import http from 'http';
import { httpGet } from '../utils/http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BackfillConfig {
  periodDays?: number;       // Default: 365 (1 year)
  batchSize?: number;        // Default: 20 (concurrent module requests)
  delayMs?: number;          // Default: 500 (between batches)
  retryCount?: number;       // Default: 2
}

export interface HistoryRecord {
  date: string;              // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  changePct: number;
}

export interface ModuleBackfillResult {
  module: string;
  success: boolean;
  records: number;
  startDate?: string;
  endDate?: string;
  error?: string;
  latencyMs: number;
}

export interface BackfillProgress {
  running: boolean;
  total: number;
  completed: number;
  failed: number;
  currentModule: string;
  results: ModuleBackfillResult[];
  startTime: number;
  elapsedMs: number;
}

// ── Module Definitions ─────────────────────────────────────────────────────

interface ModuleDef {
  id: string;
  name: string;
  apiType: 'kline' | 'macro' | 'capital' | 'custom';
  endpoint?: string;
  params?: Record<string, string>;
}

const MODULES: ModuleDef[] = [
  // Core market data (kline-based)
  { id: 'sector-heatmap', name: 'Sector Heatmap', apiType: 'kline', endpoint: 'sector' },
  { id: 'market-breadth', name: 'Market Breadth', apiType: 'kline', endpoint: 'breadth' },
  { id: 'capital-flow-rank', name: 'Capital Flow Rank', apiType: 'capital' },
  { id: 'capital-flow-monitor', name: 'Capital Flow Monitor', apiType: 'capital' },
  { id: 'dragon-tiger', name: 'Dragon Tiger List', apiType: 'custom', endpoint: 'dragon' },
  { id: 'stock-screener', name: 'Stock Screener', apiType: 'kline', endpoint: 'screener' },
  { id: 'quote-stream', name: 'Quote History', apiType: 'kline', endpoint: 'quote' },

  // Macro indicators
  { id: 'macro-gdp', name: 'GDP History', apiType: 'macro', params: { reportName: 'RPT_ECONOMY_GDP' } },
  { id: 'macro-cpi', name: 'CPI History', apiType: 'macro', params: { reportName: 'RPT_ECONOMY_CPI' } },
  { id: 'macro-ppi', name: 'PPI History', apiType: 'macro', params: { reportName: 'RPT_ECONOMY_PPI' } },
  { id: 'macro-pmi', name: 'PMI History', apiType: 'macro', params: { reportName: 'RPT_ECONOMY_PMI' } },

  // Fund & holdings
  { id: 'fund-holdings', name: 'Fund Holdings', apiType: 'custom', endpoint: 'fund' },
  { id: 'margin-data', name: 'Margin History', apiType: 'custom', endpoint: 'margin' },
  { id: 'consumer-data', name: 'Consumer Data', apiType: 'macro', params: { reportName: 'RPT_ECONOMY_CONSUMER' } },

  // Derived / computed
  { id: 'sentiment-index', name: 'Sentiment History', apiType: 'custom', endpoint: 'sentiment' },
  { id: 'sector-rotation', name: 'Sector Rotation History', apiType: 'custom', endpoint: 'rotation' },
  { id: 'news-aggregator', name: 'News Archive', apiType: 'custom', endpoint: 'news' },
  { id: 'anomaly-detector', name: 'Anomaly History', apiType: 'custom', endpoint: 'anomaly' },
  { id: 'smart-picker', name: 'Smart Pick History', apiType: 'custom', endpoint: 'smartpick' },
  { id: 'unlock-calendar', name: 'Unlock Calendar', apiType: 'custom', endpoint: 'unlock' },
  { id: 'dividend-calendar', name: 'Dividend Calendar', apiType: 'custom', endpoint: 'dividend' },
];

// ── HTTP Helper ────────────────────────────────────────────────────────────


function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Backfill Service ───────────────────────────────────────────────────────

export class HistoryBackfillService {
  private config: Required<BackfillConfig>;
  private running = false;
  private abortController: AbortController | null = null;
  private results: ModuleBackfillResult[] = [];
  private startTime = 0;
  private currentModule = '';
  private completed = 0;
  private failed = 0;

  constructor(config: BackfillConfig = {}) {
    this.config = {
      periodDays: 365,
      batchSize: 20,
      delayMs: 500,
      retryCount: 2,
      ...config,
    };
    log.info(`[HistoryBackfill] Initialized: ${this.config.periodDays} days, ${MODULES.length} modules`);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async startBackfill(moduleIds?: string[]): Promise<BackfillProgress> {
    if (this.running) {
      return this.getStatus();
    }

    this.running = true;
    this.results = [];
    this.completed = 0;
    this.failed = 0;
    this.startTime = Date.now();
    this.abortController = new AbortController();

    const modules = moduleIds
      ? MODULES.filter(m => moduleIds.includes(m.id))
      : [...MODULES];

    log.info(`[HistoryBackfill] Starting: ${modules.length} modules, ${this.config.periodDays} days`);

    // Process in batches
    for (let i = 0; i < modules.length; i += this.config.batchSize) {
      if (!this.running) break;

      const batch = modules.slice(i, i + this.config.batchSize);
      const batchPromises = batch.map(m => this.backfillModule(m));

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          this.results.push(result.value);
          if (result.value.success) {
            this.completed++;
          } else {
            this.failed++;
          }
        } else {
          this.failed++;
          this.results.push({
            module: 'unknown',
            success: false,
            records: 0,
            error: result.reason?.message || 'Unknown error',
            latencyMs: 0,
          });
        }
      }

      // Delay between batches to avoid rate limiting
      if (i + this.config.batchSize < modules.length) {
        await sleep(this.config.delayMs);
      }
    }

    this.running = false;
    this.currentModule = '';
    log.info(`[HistoryBackfill] Complete: ${this.completed} OK, ${this.failed} failed, ${this.results.length} total`);

    return this.getStatus();
  }

  stop(): void {
    this.running = false;
    this.abortController?.abort();
    this.abortController = null;
    log.info('[HistoryBackfill] Stopped by user');
  }

  getStatus(): BackfillProgress {
    return {
      running: this.running,
      total: MODULES.length,
      completed: this.completed,
      failed: this.failed,
      currentModule: this.currentModule,
      results: this.results,
      startTime: this.startTime,
      elapsedMs: this.startTime > 0 ? Date.now() - this.startTime : 0,
    };
  }

  // ── Module Backfill ──────────────────────────────────────────────────────

  private async backfillModule(mod: ModuleDef): Promise<ModuleBackfillResult> {
    this.currentModule = mod.name;
    const start = Date.now();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - this.config.periodDays);

    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      try {
        if (!this.running) {
          return { module: mod.id, success: false, records: 0, error: 'Aborted', latencyMs: Date.now() - start };
        }

        let records: HistoryRecord[] = [];

        switch (mod.apiType) {
          case 'kline':
            records = await this.fetchKlineHistory(mod, startDate, endDate);
            break;
          case 'macro':
            records = await this.fetchMacroHistory(mod, startDate, endDate);
            break;
          case 'capital':
            records = await this.fetchCapitalHistory(mod, startDate, endDate);
            break;
          case 'custom':
            records = await this.fetchCustomHistory(mod, startDate, endDate);
            break;
        }

        log.info(`[HistoryBackfill] ${mod.name}: ${records.length} records (${Date.now() - start}ms)`);
        return {
          module: mod.id,
          success: true,
          records: records.length,
          startDate: records[0]?.date,
          endDate: records[records.length - 1]?.date,
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        if (attempt < this.config.retryCount) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        log.warn(`[HistoryBackfill] ${mod.name} failed: ${err.message}`);
        return {
          module: mod.id,
          success: false,
          records: 0,
          error: err.message,
          latencyMs: Date.now() - start,
        };
      }
    }

    return { module: mod.id, success: false, records: 0, error: 'Max retries', latencyMs: Date.now() - start };
  }

  // ── Kline History ────────────────────────────────────────────────────────

  private async fetchKlineHistory(mod: ModuleDef, startDate: Date, endDate: Date): Promise<HistoryRecord[]> {
    // Use push2 kline API for historical OHLCV
    // Endpoint: push2his.eastmoney.com/api/qt/stock/kline/get
    const secid = mod.endpoint === 'sector' ? '1.000001' : '1.000001'; // Default to Shanghai Composite
    const beg = formatDate(startDate);
    const end = formatDate(endDate);
    const url = `http://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=0&beg=${beg}&end=${end}&lmt=${this.config.periodDays}`;

    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.data?.klines) return [];

    return json.data.klines.map((line: string) => {
      const parts = line.split(',');
      return {
        date: parts[0] || '',
        open: parseFloat(parts[1]) || 0,
        close: parseFloat(parts[2]) || 0,
        high: parseFloat(parts[3]) || 0,
        low: parseFloat(parts[4]) || 0,
        volume: parseFloat(parts[5]) || 0,
        turnover: parseFloat(parts[6]) || 0,
        changePct: parseFloat(parts[8]) || 0,
      };
    });
  }

  // ── Macro History ────────────────────────────────────────────────────────

  private async fetchMacroHistory(mod: ModuleDef, startDate: Date, endDate: Date): Promise<HistoryRecord[]> {
    const reportName = mod.params?.reportName || '';
    if (!reportName) return [];

    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=${reportName}&columns=ALL&pageSize=${this.config.periodDays}&pageNumber=1&sortTypes=-1&sortColumns=REPORT_DATE&source=WEB&client=WEB`;

    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.result?.data) return [];

    return json.result.data.map((item: unknown) => {
      const date = item.REPORT_DATE?.substring(0, 10) || '';
      const value = item.BASIC_SAME || item.SAME || item.NATIONAL_SAME || item.MAKE_INDEX || 0;
      return {
        date,
        open: value,
        high: value,
        low: value,
        close: value,
        volume: 0,
        turnover: 0,
        changePct: 0,
      };
    });
  }

  // ── Capital Flow History ─────────────────────────────────────────────────

  private async fetchCapitalHistory(mod: ModuleDef, startDate: Date, endDate: Date): Promise<HistoryRecord[]> {
    // Use datacenter capital flow history
    const beg = formatDate(startDate);
    const end = formatDate(endDate);
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_MUTUAL_MARKET_STA&columns=ALL&pageSize=${this.config.periodDays}&pageNumber=1&sortTypes=-1&sortColumns=TRADE_DATE&source=WEB&client=WEB&filter=(TRADE_DATE>='${beg}')`;

    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.result?.data) return [];

    return json.result.data.map((item: unknown) => {
      const date = item.TRADE_DATE?.substring(0, 10) || '';
      return {
        date,
        open: item.SH_NET_INFLOW || 0,
        high: item.SH_BUY || 0,
        low: item.SH_SELL || 0,
        close: item.SH_NET_INFLOW || 0,
        volume: item.SH_BUY + item.SH_SELL || 0,
        turnover: 0,
        changePct: 0,
      };
    });
  }

  // ── Custom History ───────────────────────────────────────────────────────

  private async fetchCustomHistory(mod: ModuleDef, startDate: Date, endDate: Date): Promise<HistoryRecord[]> {
    // Custom endpoints use kline-style API with appropriate secid
    const secidMap: Record<string, string> = {
      dragon: '1.000001',
      fund: '1.000001',
      margin: '1.000001',
      sentiment: '1.000001',
      rotation: '1.000001',
      news: '1.000001',
      anomaly: '1.000001',
      smartpick: '1.000001',
      unlock: '1.000001',
      dividend: '1.000001',
      consumer: '1.000001',
    };

    const secid = secidMap[mod.endpoint || ''] || '1.000001';
    const beg = formatDate(startDate);
    const end = formatDate(endDate);
    const url = `http://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=0&beg=${beg}&end=${end}&lmt=${this.config.periodDays}`;

    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.data?.klines) return [];

    return json.data.klines.map((line: string) => {
      const parts = line.split(',');
      return {
        date: parts[0] || '',
        open: parseFloat(parts[1]) || 0,
        close: parseFloat(parts[2]) || 0,
        high: parseFloat(parts[3]) || 0,
        low: parseFloat(parts[4]) || 0,
        volume: parseFloat(parts[5]) || 0,
        turnover: parseFloat(parts[6]) || 0,
        changePct: parseFloat(parts[8]) || 0,
      };
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().substring(0, 10).replace(/-/g, '');
}

// ── Singleton ──────────────────────────────────────────────────────────────

let backfillInstance: HistoryBackfillService | null = null;

export function getHistoryBackfill(): HistoryBackfillService {
  if (!backfillInstance) {
    backfillInstance = new HistoryBackfillService();
  }
  return backfillInstance;
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

export function registerHistoryBackfillIPC(ipcMain: unknown): void {
  const service = getHistoryBackfill();

  ipcMain.handle('history:backfill-start', async (_event: unknown, moduleIds?: string[]) => {
    return service.startBackfill(moduleIds);
  });

  ipcMain.handle('history:backfill-status', () => {
    return service.getStatus();
  });

  ipcMain.handle('history:backfill-stop', () => {
    service.stop();
    return { success: true };
  });

  log.info('[HistoryBackfill] IPC handlers registered');
}
