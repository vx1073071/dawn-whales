// ── Data Export Service (JVS-37) ─────────────────────────────────────────────
// Export any JVS module data as JSON, CSV, or Excel
// IPC: data:export

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { getSmartCacheManager } from '../core/smart-cache';
import { getMarketOverview } from '../core/emi-unified';
import { getStockCapitalFlowRank, getSectorCapitalFlowRank } from '../analysis/capital-flow-rank';
import { getDragonTigerList } from './dragon-tiger-list';
import { getMacroDataReport } from '../risk/macro-data';
import { getMarginDataReport } from './margin-data';
import { getConsumerDataReport } from './consumer-data';
import { getUnlockCalendar } from './unlock-calendar';
import { getDividendCalendar } from './dividend-calendar';
import { getEarningsCalendar } from './earnings-calendar';
import { EngineError, ErrorCode } from '../../errors';


// ── Types ──────────────────────────────────────────────────────────────────

export type ExportFormat = 'json' | 'csv' | 'excel';

export interface ExportRequest {
  module: string;           // Module name or 'all'
  format: ExportFormat;
  filters?: Record<string, any>;
  fields?: string[];        // Specific fields to export
  outputPath?: string;      // Custom output path
}

export interface ExportResult {
  success: boolean;
  filePath: string;
  format: ExportFormat;
  rowCount: number;
  fileSize: number;         // bytes
  duration: number;         // ms
  error?: string;
}

// ── Data Sources ───────────────────────────────────────────────────────────

const DATA_SOURCES: Record<string, () => Promise<any>> = {
  'market-overview': () => getMarketOverview(),
  'capital-flow-stock': () => getStockCapitalFlowRank(100),
  'capital-flow-sector': () => getSectorCapitalFlowRank(100),
  'dragon-tiger': () => getDragonTigerList(),
  'macro-data': () => getMacroDataReport(),
  'margin-data': () => getMarginDataReport(),
  'consumer-data': () => getConsumerDataReport(),
  'unlock-calendar': () => getUnlockCalendar(),
  'dividend-calendar': () => getDividendCalendar(),
  'earnings-calendar': () => getEarningsCalendar(),
};

// ── CSV Helpers ────────────────────────────────────────────────────────────

function toCSV(data: unknown[], fields?: string[]): string {
  if (!data || data.length === 0) return '';

  const keys = fields || Object.keys(data[0]);
  const header = keys.join(',');
  const rows = data.map(row =>
    keys.map(key => {
      const val = row[key];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
      return val;
    }).join(',')
  );

  return [header, ...rows].join('\n');
}

function flattenObject(obj: unknown, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];

    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenObject(val, fullKey));
    } else {
      result[fullKey] = val;
    }
  }

  return result;
}

function extractArray(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    // Find first array property
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) return data[key];
    }
    // Return as single row
    return [flattenObject(data)];
  }
  return [];
}

// ── Excel Helper (Simple XLSX-like CSV with .xlsx extension) ──────────────

function toExcelCSV(data: unknown[], fields?: string[]): string {
  // For simplicity, use CSV format with .xlsx extension
  // Real implementation would use xlsx library
  return toCSV(data, fields);
}

// ── Export Service ─────────────────────────────────────────────────────────

export async function exportData(request: ExportRequest): Promise<ExportResult> {
  const startTime = Date.now();
  const { module, format, fields, outputPath } = request;

  try {
    log.info(`[DataExport] Exporting ${module} as ${format}`);

    // Fetch data
    let rawData: unknown;

    if (module === 'all') {
      // Export all modules
      rawData = {};
      for (const [name, fetcher] of Object.entries(DATA_SOURCES)) {
        try {
          rawData[name] = await fetcher();
        } catch (err: unknown) {
          log.warn(`[DataExport] Failed to fetch ${name}: ${err.message}`);
          rawData[name] = { error: err.message };
        }
      }
    } else if (module === 'cache') {
      // Export cache contents
      const cache = getSmartCacheManager();
      const allStats = cache.getAllStats();
      rawData = {};
      for (const [ns, stats] of Object.entries(allStats)) {
        const nsCache = cache.getCache(ns);
        rawData[ns] = { stats, keys: nsCache.keys() };
      }
    } else if (DATA_SOURCES[module]) {
      rawData = await DATA_SOURCES[module]();
    } else {
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Unknown module: ${module}`);
    }

    // Extract array from data
    let dataArray = module === 'all' || module === 'cache'
      ? Object.entries(rawData).map(([name, data]) => ({ module: name, ...flattenObject(data) }))
      : extractArray(rawData);

    // Apply field filtering
    if (fields && fields.length > 0) {
      dataArray = dataArray.map(row => {
        const filtered: Record<string, any> = {};
        for (const field of fields) {
          if (field in row) filtered[field] = row[field];
        }
        return filtered;
      });
    }

    // Generate output
    let content: string;
    let extension: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(dataArray, null, 2);
        extension = 'json';
        break;
      case 'csv':
        content = toCSV(dataArray, fields);
        extension = 'csv';
        break;
      case 'excel':
        content = toExcelCSV(dataArray, fields);
        extension = 'xlsx';
        break;
      default:
        throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, `Unsupported format: ${format}`);
    }

    // Determine output path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = outputPath || `dawn-whales-${module}-${timestamp}.${extension}`;
    const filePath = path.isAbsolute(fileName) ? fileName : path.join(process.cwd(), 'exports', fileName);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');

    const stats = fs.statSync(filePath);
    const duration = Date.now() - startTime;

    log.info(`[DataExport] Exported ${dataArray.length} rows to ${filePath} (${stats.size} bytes, ${duration}ms)`);

    return {
      success: true,
      filePath,
      format,
      rowCount: dataArray.length,
      fileSize: stats.size,
      duration,
    };
  } catch (err: unknown) {
    const duration = Date.now() - startTime;
    log.error(`[DataExport] Export failed: ${err.message}`);
    return {
      success: false,
      filePath: '',
      format,
      rowCount: 0,
      fileSize: 0,
      duration,
      error: err.message,
    };
  }
}

export function getAvailableModules(): string[] {
  return ['all', 'cache', ...Object.keys(DATA_SOURCES)];
}
