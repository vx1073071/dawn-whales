// ── Stock Screener Backend — EM Script Integration ─────────────────────────
// JVS-4: Natural language stock screening via em-mx-stocks-screener
// Calls Python script → parses CSV → maps Chinese columns → returns typed results

import log from 'electron-log';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

// ── Types ──────────────────────────────────────────────────────────────────

export type SelectType = 'A股' | '港股' | '美股' | '板块' | '基金' | 'ETF' | '可转债';

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
  '代码': 'code',
  '股票代码': 'code',
  '名称': 'name',
  '股票名称': 'name',
  '最新价': 'price',
  '涨跌幅': 'changePct',
  '涨跌额': 'changeAmt',
  '成交额': 'volume',
  '换手率': 'turnoverRate',

  // Valuation
  '市盈率': 'pe',
  '市盈率(动态)': 'pe',
  'PE': 'pe',
  '市净率': 'pb',
  'PB': 'pb',
  '总市值': 'marketCap',
  '总市值(元)': 'marketCap',

  // Shares
  '总股本': 'totalShares',
  '流通股本': 'floatShares',
  '流通市值': 'extra', // Will be put in extra

  // Sector
  '所属行业': 'industry',
  '行业': 'industry',
  '所属板块': 'industry',

  // ETF/Fund specific
  '基金代码': 'code',
  '基金名称': 'name',
  '基金类型': 'extra',
  '最新规模': 'marketCap',
  '近1年收益': 'changePct',

  // Bond specific
  '债券代码': 'code',
  '债券名称': 'name',
  '债券简称': 'name',
  '转债价格': 'price',
  '转股溢价率': 'extra',

  // Sector/Board specific
  '板块代码': 'code',
  '板块名称': 'name',
  '领涨股': 'extra',
  '上涨家数': 'extra',
  '下跌家数': 'extra',
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
    const selectType = request.selectType || 'A股';
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
    } catch (err: any) {
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
    const descMatch = stdout.match(/(?:描述|Description|描述)[:\s]+([^\r\n]+)/i);
    if (descMatch) return descMatch[1].trim();

    const rowsMatch = stdout.match(/(?:行数|Rows|行数)[:\s]+(\d+)/i);
    if (rowsMatch) return `${rowsMatch[1]} rows returned`;

    return '';
  }

  /**
   * Parse numeric value from string
   */
  private parseNum(value: string): number | null {
    if (!value || value === '-' || value === '--' || value === 'N/A') return null;
    // Remove Chinese unit suffixes
    const cleaned = value.replace(/[亿万元%]/g, '');
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
            reject(new Error(`Script timeout (${timeoutMs}ms)`));
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
