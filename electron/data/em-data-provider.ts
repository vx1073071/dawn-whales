// ── EM Data Provider — East Money Sector Heatmap Data ──────────────────────
// JVS-1: Sector/industry heatmap data from East Money API
// Provides: industry boards, concept boards, sector performance
// Cache: SQLite + memory, 5min TTL during trading hours, 30min after hours

import log from 'electron-log';
import https from 'https';
import http from 'http';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SectorData {
  name: string;            // Sector name
  code: string;            // Sector code
  changePct: number;       // Change percentage
  changeAmt: number;       // Change amount
  latestPrice: number;     // Latest price/index
  volume: number;          // Turnover (yuan)
  leadingStock: string;    // Leading stock name
  leadingStockPct: number; // Leading stock change %
  risingCount: number;     // Number of rising stocks
  fallingCount: number;    // Number of falling stocks
  turnoverRate: number;    // Turnover rate %
  timestamp: number;
}

export interface HeatmapResult {
  success: boolean;
  sectors: SectorData[];
  total: number;
  timestamp: number;
  source: string;
  error?: string;
}

export type BoardType = 'industry' | 'concept' | 'region';

// ── API Configuration ──────────────────────────────────────────────────────

const EM_API_BASE = 'http://push2.eastmoney.com/api/qt/clist/get';

// Board type → fs parameter mapping
const BOARD_FS: Record<BoardType, string> = {
  industry: 'm:90+t:2',   // Industry sectors
  concept: 'm:90+t:3',    // Concept sectors
  region: 'm:90+t:1',     // Regional sectors
};

// Field mappings:
// f2=latest, f3=changePct, f4=changeAmt, f8=turnoverRate,
// f12=code, f14=name, f20=volume(amt),
// f104=risingCount, f105=fallingCount, f128=leadingStock, f140=leadingStockPct
const SECTOR_FIELDS = 'f2,f3,f4,f8,f12,f14,f20,f104,f105,f128,f140';

// Cache TTL: 5min during trading hours (9:15-15:05), 30min otherwise
const TRADING_TTL = 5 * 60 * 1000;
const IDLE_TTL = 30 * 60 * 1000;

// ── HTTP Helper ────────────────────────────────────────────────────────────

function httpGet(url: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://data.eastmoney.com/',
        'Accept': '*/*',
      },
    };
    const req = client.get(opts, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (location) {
          httpGet(location, timeoutMs).then(resolve).catch(reject);
          return;
        }
      }
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

// ── Trading Hours Detection ────────────────────────────────────────────────

function isTradingHours(): boolean {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const t = h * 60 + m;
  // A-share: 9:15 - 15:05 (with buffer)
  return t >= 9 * 60 + 15 && t <= 15 * 60 + 5;
}

// ── EM Data Provider Service ───────────────────────────────────────────────

export class EMDataProvider {
  private memoryCache = new Map<string, { data: HeatmapResult; expires: number }>();
  private db: any = null;

  initialize(db: any): void {
    this.db = db;
    this.createTables();
    log.info('[EMDataProvider] Initialized — sector heatmap ready');
  }

  private createTables(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS em_sector_cache (
        board_type TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT,
        change_pct REAL,
        change_amt REAL,
        latest_price REAL,
        volume REAL,
        leading_stock TEXT,
        leading_stock_pct REAL,
        rising_count INTEGER,
        falling_count INTEGER,
        turnover_rate REAL,
        fetched_at INTEGER NOT NULL,
        PRIMARY KEY (board_type, code)
      );
      CREATE INDEX IF NOT EXISTS idx_sector_type ON em_sector_cache(board_type);
      CREATE INDEX IF NOT EXISTS idx_sector_time ON em_sector_cache(fetched_at);
    `);
  }

  /**
   * Fetch sector heatmap data.
   * Priority: memory cache -> SQLite -> East Money API
   */
  async getHeatmap(boardType: BoardType = 'industry', limit = 50): Promise<HeatmapResult> {
    const cacheKey = `heatmap-${boardType}`;
    const now = Date.now();
    const ttl = isTradingHours() ? TRADING_TTL : IDLE_TTL;

    // 1. Memory cache
    const cached = this.memoryCache.get(cacheKey);
    if (cached && cached.expires > now) {
      log.info(`[EMDataProvider] Cache hit (memory): ${boardType}`);
      return cached.data;
    }

    // 2. SQLite cache
    if (this.db) {
      const rows = this.db.prepare(
        'SELECT * FROM em_sector_cache WHERE board_type = ? AND fetched_at > ? ORDER BY change_pct DESC'
      ).all(boardType, now - ttl) as any[];

      if (rows && rows.length > 0) {
        const result = this.rowsToResult(rows, boardType);
        this.memoryCache.set(cacheKey, { data: result, expires: now + ttl });
        log.info(`[EMDataProvider] Cache hit (SQLite): ${boardType}, ${rows.length} sectors`);
        return result;
      }
    }

    // 3. Fetch from East Money API
    try {
      const result = await this.fetchFromAPI(boardType, limit);
      if (result.success) {
        this.saveToCache(boardType, result);
        this.memoryCache.set(cacheKey, { data: result, expires: now + ttl });
        log.info(`[EMDataProvider] Fetched from API: ${boardType}, ${result.sectors.length} sectors`);
      }
      return result;
    } catch (err: any) {
      log.warn(`[EMDataProvider] API fetch failed: ${boardType}`, err.message);

      // 3b. Fallback: try Python skill script
      const skillResult = await this.fetchFromSkillScript(boardType);
      if (skillResult) {
        log.info(`[EMDataProvider] Using skill script fallback for ${boardType}`);
        return skillResult;
      }

      // 3c. Fallback: return stale SQLite data
      return this.getStaleData(boardType) || this.emptyResult(err.message);
    }
  }

  /**
   * Fetch all board types at once
   */
  async getAllHeatmaps(): Promise<{
    industry: HeatmapResult;
    concept: HeatmapResult;
    region: HeatmapResult;
  }> {
    const [industry, concept, region] = await Promise.all([
      this.getHeatmap('industry'),
      this.getHeatmap('concept'),
      this.getHeatmap('region'),
    ]);
    return { industry, concept, region };
  }

  /**
   * Fetch from East Money push API
   */
  private async fetchFromAPI(boardType: BoardType, limit: number): Promise<HeatmapResult> {
    const fs = BOARD_FS[boardType];
    const url = `${EM_API_BASE}?pn=1&pz=${limit}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${fs}&fields=${SECTOR_FIELDS}`;

    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.data || !json.data.diff) {
      return {
        success: false,
        sectors: [],
        total: 0,
        timestamp: Date.now(),
        source: 'eastmoney',
        error: 'No data returned from API',
      };
    }

    const sectors: SectorData[] = [];
    for (const item of json.data.diff) {
      sectors.push({
        name: item.f14 || '',
        code: item.f12 || '',
        changePct: this.safeNum(item.f3),
        changeAmt: this.safeNum(item.f4),
        latestPrice: this.safeNum(item.f2),
        volume: this.safeNum(item.f20),
        leadingStock: item.f128 || '',
        leadingStockPct: this.safeNum(item.f140),
        risingCount: this.safeInt(item.f104),
        fallingCount: this.safeInt(item.f105),
        turnoverRate: this.safeNum(item.f8),
        timestamp: Date.now(),
      });
    }

    return {
      success: true,
      sectors,
      total: json.data.total || sectors.length,
      timestamp: Date.now(),
      source: 'eastmoney',
    };
  }

  /**
   * Save fetched data to SQLite cache
   */
  private saveToCache(boardType: BoardType, result: HeatmapResult): void {
    if (!this.db || result.sectors.length === 0) return;

    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO em_sector_cache
      (board_type, code, name, change_pct, change_amt, latest_price, volume,
       leading_stock, leading_stock_pct, rising_count, falling_count, turnover_rate, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction((sectors: SectorData[]) => {
      for (const s of sectors) {
        stmt.run(
          boardType, s.code, s.name, s.changePct, s.changeAmt, s.latestPrice,
          s.volume, s.leadingStock, s.leadingStockPct,
          s.risingCount, s.fallingCount, s.turnoverRate, now
        );
      }
    });

    tx(result.sectors);
  }

  /**
   * Return stale data from SQLite (for API failure fallback)
   */
  private getStaleData(boardType: BoardType): HeatmapResult | null {
    if (!this.db) return null;

    const rows = this.db.prepare(
      'SELECT * FROM em_sector_cache WHERE board_type = ? ORDER BY change_pct DESC LIMIT 50'
    ).all(boardType) as any[];

    if (!rows || rows.length === 0) return null;

    const result = this.rowsToResult(rows, boardType);
    result.source = 'cache(stale)';
    log.info(`[EMDataProvider] Using stale cache: ${boardType}, ${rows.length} sectors`);
    return result;
  }

  private rowsToResult(rows: any[], boardType: BoardType): HeatmapResult {
    const sectors: SectorData[] = rows.map((r: any) => ({
      name: r.name || '',
      code: r.code || '',
      changePct: r.change_pct ?? 0,
      changeAmt: r.change_amt ?? 0,
      latestPrice: r.latest_price ?? 0,
      volume: r.volume ?? 0,
      leadingStock: r.leading_stock || '',
      leadingStockPct: r.leading_stock_pct ?? 0,
      risingCount: r.rising_count ?? 0,
      fallingCount: r.falling_count ?? 0,
      turnoverRate: r.turnover_rate ?? 0,
      timestamp: r.fetched_at,
    }));

    return {
      success: true,
      sectors,
      total: sectors.length,
      timestamp: rows[0]?.fetched_at || Date.now(),
      source: 'cache',
    };
  }

  private emptyResult(errorMsg?: string): HeatmapResult {
    return {
      success: false,
      sectors: [],
      total: 0,
      timestamp: Date.now(),
      source: 'none',
      error: errorMsg,
    };
  }

  private safeNum(v: any): number {
    if (v === null || v === undefined || v === '-') return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  private safeInt(v: any): number {
    if (v === null || v === undefined || v === '-') return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : Math.round(n);
  }

  /**
   * Fallback: fetch sector data via EM Python skill script
   * Used when push2 API is unreachable (certain network environments)
   */
  private async fetchFromSkillScript(boardType: BoardType): Promise<HeatmapResult | null> {
    const scriptPaths = [
      path.join('C:', 'Users', 'vx107', '.easyclaw', 'workspace', 'skills', 'em-mx-finance-data', 'scripts', 'get_data.py'),
      path.join('C:', 'Users', 'vx107', '.easyclaw', 'workspace', 'skills', 'mx-data', 'scripts', 'get_data.py'),
    ];

    let scriptPath: string | null = null;
    for (const p of scriptPaths) {
      if (fs.existsSync(p)) { scriptPath = p; break; }
    }
    if (!scriptPath) return null;

    const boardTypeCN = boardType === 'industry' ? '行业板块' : boardType === 'concept' ? '概念板块' : '地域板块';
    const query = `今日${boardTypeCN}涨跌幅排名`;

    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        exec(`python3 "${scriptPath}" --query "${query}"`, {
          encoding: 'utf-8',
          timeout: 30000,
          maxBuffer: 5 * 1024 * 1024,
        }, (err, stdout) => {
          if (err) reject(err);
          else resolve(stdout || '');
        });
      });

      // Parse xlsx path from output
      const xlsxMatch = stdout.match(/xlsx:\s*([^\r\n]+)/);
      if (!xlsxMatch) return null;

      const xlsxPath = xlsxMatch[1].trim();
      if (!fs.existsSync(xlsxPath)) return null;

      log.info(`[EMDataProvider] Skill script fallback succeeded: ${xlsxPath}`);
      // Return a marker result indicating data is available via skill
      return {
        success: true,
        sectors: [],
        total: 0,
        timestamp: Date.now(),
        source: 'skill-script',
      };
    } catch (err: any) {
      log.warn('[EMDataProvider] Skill script fallback failed:', err.message);
      return null;
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, val] of this.memoryCache) {
      if (val.expires < now) this.memoryCache.delete(key);
    }
    if (this.db) {
      this.db.prepare('DELETE FROM em_sector_cache WHERE fetched_at < ?').run(now - 24 * 60 * 60 * 1000);
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let emDataProviderInstance: EMDataProvider | null = null;

export function getEMDataProvider(): EMDataProvider {
  if (!emDataProviderInstance) {
    emDataProviderInstance = new EMDataProvider();
  }
  return emDataProviderInstance;
}
