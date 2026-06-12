// @ts-nocheck
// ── Stock Screener Backend — EM Script Integration ─────────────────────────
// JVS-4: Natural language stock screening via em-mx-stocks-screener
// Calls Python script → parses CSV → maps Chinese columns → returns typed results

import log from 'electron-log';
import { EngineError, ErrorDomain, ErrorCode } from '../core/engine-error';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export type SelectType = i18n.t('stockScreener.k1') | i18n.t('stockScreener.k2') | i18n.t('stockScreener.k3') | i18n.t('stockScreener.k4') | i18n.t('stockScreener.k5') | 'ETF' | i18n.t('stockScreener.k6');

export interface ScreenerRequest {
  query: string;
  selectType?: SelectType;
  limit?: number;           // Max results to return
  timeout?: number;         // Script timeout in ms (default 30000)
}

export interface StockRecord {
  code: string;             // Stock code
  name: string;             // Stock name
  price: number | null;     // Current price
  changePct: number | null; // Change %
  changeAmt: number | null; // Change amount
  volume: number | null;    // Turnover (yuan)
  turnoverRate: number | null;
  pe: number | null;        // P/E ratio
  pb: number | null;        // P/B ratio
  marketCap: number | null; // Market cap (yuan)
  totalShares: number | null;
  floatShares: number | null;
  industry: string;         // Industry/sector
  extra: Record<string, any>; // Any additional columns
}

export interface ScreenerResult {
  success: boolean;
  records: StockRecord[];
  total: number;
  query: string;
  selectType: SelectType;
  durationMs: number;
  description: string;
  csvPath: string;
  error?: string;
}

// ── Column Mapping ─────────────────────────────────────────────────────────
// EM screener returns Chinese column names. Map to our typed fields.

const COLUMN_MAP: Record<string, keyof StockRecord> = {
  // Common
  [i18n.t('stockScreener.k7')]: 'code',
  [i18n.t('stockScreener.k8')]: 'code',
  [i18n.t('stockScreener.k9')]: 'name',
  [i18n.t('stockScreener.k10')]: 'name',
  [i18n.t('stockScreener.k11')]: 'price',
  [i18n.t('stockScreener.k12')]: 'changePct',
  [i18n.t('stockScreener.k13')]: 'changeAmt',
  [i18n.t('stockScreener.k14')]: 'volume',
  [i18n.t('stockScreener.k15')]: 'turnoverRate',

  // Valuation
  [i18n.t('stockScreener.k16')]: 'pe',
  [i18n.t('stockScreener.k17')]: 'pe',
  'PE': 'pe',
  [i18n.t('stockScreener.k18')]: 'pb',
  'PB': 'pb',
  [i18n.t('stockScreener.k19')]: 'marketCap',
  [i18n.t('stockScreener.k20')]: 'marketCap',

  // Shares
  [i18n.t('stockScreener.k21')]: 'totalShares',
  [i18n.t('stockScreener.k22')]: 'floatShares',
  [i18n.t('stockScreener.k23')]: 'extra', // Will be put in extra

  // Sector
  [i18n.t('stockScreener.k24')]: 'industry',
  [i18n.t('stockScreener.k25')]: 'industry',
  [i18n.t('stockScreener.k26')]: 'industry',

  // ETF/Fund specific
  [i18n.t('stockScreener.k27')]: 'code',
  [i18n.t('stockScreener.k28')]: 'name',
  [i18n.t('stockScreener.k29')]: 'extra',
  [i18n.t('stockScreener.k30')]: 'marketCap',
  [i18n.t('stockScreener.k31')]: 'changePct',

  // Bond specific
  [i18n.t('stockScreener.k32')]: 'code',
  [i18n.t('stockScreener.k33')]: 'name',
  [i18n.t('stockScreener.k34')]: 'name',
  [i18n.t('stockScreener.k35')]: 'price',
  [i18n.t('stockScreener.k36')]: 'extra',

  // Sector/Board specific
  [i18n.t('stockScreener.k37')]: 'code',
  [i18n.t('stockScreener.k38')]: 'name',
  [i18n.t('stockScreener.k39')]: 'extra',
  [i18n.t('stockScreener.k40')]: 'extra',
  [i18n.t('stockScreener.k41')]: 'extra',
};

// ── Script Paths ───────────────────────────────────────────────────────────

const SCRIPT_PATHS = [
  // Global skills
  path.join('C:', 'Users', 'vx107', '.easyclaw', 'workspace', 'skills', 'em-mx-stocks-screener', 'scripts', 'get_data.py'),
  // Project-level skills
  path.join('C:', 'Users', 'vx107', '.easyclaw', 'workspace', 'skills', 'mx-select-stock', 'scripts', 'get_data.py'),
];

// ── Python Executable Detection ────────────────────────────────────────────

function findPython(): string {
  // Try python3 first, then python
  const candidates = ['python3', 'python'];
  // On Windows, python might be python.exe
  if (process.platform === 'win32') {
    candidates.push('py');
  }
  return candidates[0]; // Default to python3, will be resolved by exec
}

// ── CSV Parser (simple, handles quoted fields) ─────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    rows.push(parseCSVLine(lines[i]));
  }

  return { headers, rows };
}

// ── Stock Screener Service ─────────────────────────────────────────────────

export class StockScreenerService {
  private scriptPath: string | null = null;
  private pythonExe: string = 'python3';

  constructor() {
    this.detectScript();
    this.detectPython();
    log.info(`[StockScreener] Initialized, script: ${this.scriptPath || 'NOT FOUND'}, python: ${this.pythonExe}`);
  }

  private detectScript(): void {
    for (const p of SCRIPT_PATHS) {
      if (fs.existsSync(p)) {
        this.scriptPath = p;
        return;
      }
    }
    log.warn('[StockScreener] Script not found in expected paths');
  }

  private detectPython(): void {
    // Will be resolved at runtime; keep python3 as default
    this.pythonExe = findPython();
  }

  /**
   * Execute a screening query
   */
  async search(request: ScreenerRequest): Promise<ScreenerResult> {
    const startTime = Date.now();
    const selectType = request.selectType || i18n.t('stockScreener.k42');
    const limit = request.limit || 50;
    const timeout = request.timeout || 30000;

    if (!this.scriptPath) {
      return {
        success: false,
        records: [],
        total: 0,
        query: request.query,
        selectType,
        durationMs: Date.now() - startTime,
        description: 'Script not found',
        csvPath: '',
        error: 'EM screener script not found. Please install em-mx-stocks-screener skill.',
      };
    }

    try {
      // Build command
      const cmd = `"${this.pythonExe}" "${this.scriptPath}" --query "${request.query.replace(/"/g, '\\"')}" --select-type "${selectType}"`;
      log.info(`[StockScreener] Executing: ${cmd}`);

      const stdout = await this.execAsync(cmd, timeout);

      // Parse output to find CSV path
      const csvPath = this.extractCSVPath(stdout);
      const description = this.extractDescription(stdout);

      if (!csvPath || !fs.existsSync(csvPath)) {
        return {
          success: false,
          records: [],
          total: 0,
          query: request.query,
          selectType,
          durationMs: Date.now() - startTime,
          description: description || 'CSV output not found',
          csvPath: csvPath || '',
          error: `CSV file not found: ${csvPath}`,
        };
      }

      // Read and parse CSV
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const { headers, rows } = parseCSV(csvContent);

      // Map to typed records
      const records = this.mapRecords(headers, rows, limit);

      const durationMs = Date.now() - startTime;
      log.info(`[StockScreener] Done: ${records.length}/${rows.length} records, ${durationMs}ms`);

      return {
        success: true,
        records,
        total: rows.length,
        query: request.query,
        selectType,
        durationMs,
        description: description || `${records.length} results for "${request.query}"`,
        csvPath,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      log.error('[StockScreener] Error:', err.message);
      return {
        success: false,
        records: [],
        total: 0,
        query: request.query,
        selectType,
        durationMs,
        description: '',
        csvPath: '',
        error: err.message,
      };
    }
  }

  /**
   * Map raw CSV rows to typed StockRecord objects
   */
  private mapRecords(headers: string[], rows: string[][], limit: number): StockRecord[] {
    const records: StockRecord[] = [];

    for (let i = 0; i < Math.min(rows.length, limit); i++) {
      const row = rows[i];
      const record: StockRecord = {
        code: '',
        name: '',
        price: null,
        changePct: null,
        changeAmt: null,
        volume: null,
        turnoverRate: null,
        pe: null,
        pb: null,
        marketCap: null,
        totalShares: null,
        floatShares: null,
        industry: '',
        extra: {},
      };

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j].trim();
        const value = j < row.length ? row[j].trim() : '';
        const mappedField = COLUMN_MAP[header];

        if (!mappedField) {
          // Unmapped column → extra
          if (value) record.extra[header] = value;
          continue;
        }

        if (mappedField === 'extra') {
          record.extra[header] = value;
          continue;
        }

        // Assign to known field
        switch (mappedField) {
          case 'code':
            record.code = value;
            break;
          case 'name':
            record.name = value;
            break;
          case 'industry':
            record.industry = value;
            break;
          case 'price':
          case 'changePct':
          case 'changeAmt':
          case 'volume':
          case 'turnoverRate':
          case 'pe':
          case 'pb':
          case 'marketCap':
          case 'totalShares':
          case 'floatShares':
            (record as any)[mappedField] = this.parseNum(value);
            break;
        }
      }

      if (record.code || record.name) {
        records.push(record);
      }
    }

    return records;
  }

  /**
   * Extract CSV file path from script stdout
   */
  private extractCSVPath(stdout: string): string | null {
    // Pattern: "CSV: /path/to/file.csv" or just look for .csv path
    const csvMatch = stdout.match(/(?:CSV|csv)[:\s]+([^\r\n]+\.csv)/i);
    if (csvMatch) return csvMatch[1].trim();

    // Fallback: find any .csv path in output
    const pathMatch = stdout.match(/([A-Za-z]:\\[^\s]+\.csv|\/[^\s]+\.csv)/);
    if (pathMatch) return pathMatch[1].trim();

    return null;
  }

  /**
   * Extract description text from stdout
   */
  private extractDescription(stdout: string): string {
    const descMatch = stdout.match(/(?:\\u63cf\\u8ff0|Description|\\u63cf\\u8ff0)[:\s]+([^\r\n]+)/i);
    if (descMatch) return descMatch[1].trim();

    const rowsMatch = stdout.match(/(?:\\u884c\\u6570|Rows|\\u884c\\u6570)[:\s]+(\d+)/i);
    if (rowsMatch) return `${rowsMatch[1]} rows returned`;

    return '';
  }

  /**
   * Parse numeric value from string
   */
  private parseNum(value: string): number | null {
    if (!value || value === '-' || value === '--' || value === 'N/A') return null;
    // Remove Chinese unit suffixes
    const cleaned = value.replace(/[BW%]/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Execute shell command async
   */
  private execAsync(cmd: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(cmd, {
        encoding: 'utf-8',
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: { ...process.env },
      }, (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
            reject(new EngineError(ErrorDomain.DATA, ErrorCode.INTERNAL_ERROR, `Script timeout (${timeoutMs}ms)`));
          } else {
            reject(new Error(stderr || error.message));
          }
          return;
        }
        resolve(stdout || '');
      });
    });
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let screenerInstance: StockScreenerService | null = null;

export function getStockScreener(): StockScreenerService {
  if (!screenerInstance) {
    screenerInstance = new StockScreenerService();
  }
  return screenerInstance;
}
