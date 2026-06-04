// ── JVS-26: Data Exporter (全量数据导出) ──────────────────────────────────
// Export all JVS data modules as JSON or CSV
// IPC: em:export-data(type, format)

import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getStockCapitalFlowRank, getSectorCapitalFlowRank } from './capital-flow-rank';
import { getDragonTigerList } from './dragon-tiger-list';
import { getFundIncreaseRank, getFundDecreaseRank } from './fund-holdings';
import { getMarketBreadth } from './market-breadth';
import { getConsumerDataReport } from './consumer-data';
import { getMarginDataReport } from './margin-data';
import { getUnlockCalendar } from './unlock-calendar';
import { getDividendCalendar } from './dividend-calendar';
import { getEarningsCalendar } from './earnings-calendar';

// ── Types ──────────────────────────────────────────────────────────────────

export type ExportDataType =
  | 'capital-flow-stock'
  | 'capital-flow-sector'
  | 'dragon-tiger'
  | 'fund-increase'
  | 'fund-decrease'
  | 'market-breadth'
  | 'consumer-data'
  | 'margin-data'
  | 'unlock-calendar'
  | 'dividend-calendar'
  | 'earnings-calendar'
  | 'all';

export type ExportFormat = 'json' | 'csv';

export interface ExportResult {
  success: boolean;
  filePath: string;
  fileName: string;
  format: ExportFormat;
  dataType: ExportDataType;
  rowCount: number;
  fileSizeBytes: number;
  durationMs: number;
  error?: string;
}

// ── Export Functions ───────────────────────────────────────────────────────

export async function exportData(
  dataType: ExportDataType,
  format: ExportFormat = 'json'
): Promise<ExportResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `jvs-${dataType}-${timestamp}.${format}`;
  
  let exportDir: string;
  try {
    exportDir = path.join(app.getPath('downloads'), 'dawn-whales-exports');
  } catch {
    exportDir = path.join(process.cwd(), 'exports');
  }
  
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const filePath = path.join(exportDir, fileName);

  try {
    let data: any;
    let rowCount = 0;

    switch (dataType) {
      case 'capital-flow-stock': {
        const result = await getStockCapitalFlowRank('mainNetInflow', 'desc', 100);
        data = result.success ? result.items : [];
        rowCount = data.length;
        break;
      }
      case 'capital-flow-sector': {
        const result = await getSectorCapitalFlowRank('mainNetInflow', 'desc', 50);
        data = result.success ? result.items : [];
        rowCount = data.length;
        break;
      }
      case 'dragon-tiger': {
        const result = await getDragonTigerList();
        data = result.success ? result.entries : [];
        rowCount = data.length;
        break;
      }
      case 'fund-increase': {
        const result = await getFundIncreaseRank(50);
        data = result;
        rowCount = Array.isArray(data) ? data.length : 0;
        break;
      }
      case 'fund-decrease': {
        const result = await getFundDecreaseRank(50);
        data = result;
        rowCount = Array.isArray(data) ? data.length : 0;
        break;
      }
      case 'market-breadth': {
        const result = await getMarketBreadth();
        data = result;
        rowCount = 1;
        break;
      }
      case 'consumer-data': {
        const result = await getConsumerDataReport();
        data = result;
        rowCount = (result.cpiSubIndexes?.length || 0) + (result.retailSales?.length || 0);
        break;
      }
      case 'margin-data': {
        const result = await getMarginDataReport();
        data = result;
        rowCount = (result.marketBalance?.length || 0) + (result.topMarginStocks?.length || 0);
        break;
      }
      case 'unlock-calendar': {
        const result = await getUnlockCalendar();
        data = result.success ? result.events : [];
        rowCount = data.length;
        break;
      }
      case 'dividend-calendar': {
        const result = await getDividendCalendar();
        data = result.success ? result.events : [];
        rowCount = data.length;
        break;
      }
      case 'earnings-calendar': {
        const result = await getEarningsCalendar();
        data = result.success ? result.events : [];
        rowCount = data.length;
        break;
      }
      case 'all': {
        // Export all data types
        const [cfStock, cfSector, dt, fundInc, fundDec, breadth, consumer, margin, unlock, dividend, earnings] = await Promise.all([
          getStockCapitalFlowRank('mainNetInflow', 'desc', 100),
          getSectorCapitalFlowRank('mainNetInflow', 'desc', 50),
          getDragonTigerList(),
          getFundIncreaseRank(50),
          getFundDecreaseRank(50),
          getMarketBreadth(),
          getConsumerDataReport(),
          getMarginDataReport(),
          getUnlockCalendar(),
          getDividendCalendar(),
          getEarningsCalendar(),
        ]);

        data = {
          capitalFlowStock: cfStock.success ? cfStock.items : [],
          capitalFlowSector: cfSector.success ? cfSector.items : [],
          dragonTiger: dt.success ? dt.entries : [],
          fundIncrease: Array.isArray(fundInc) ? fundInc : [],
          fundDecrease: Array.isArray(fundDec) ? fundDec : [],
          marketBreadth: breadth,
          consumerData: consumer,
          marginData: margin,
          unlockCalendar: unlock.success ? unlock.events : [],
          dividendCalendar: dividend.success ? dividend.events : [],
          earningsCalendar: earnings.success ? earnings.events : [],
          exportedAt: new Date().toISOString(),
        };
        rowCount = Object.values(data).filter(Array.isArray).reduce((s: number, v: any) => s + v.length, 0);
        break;
      }
      default:
        return {
          success: false, filePath, fileName, format, dataType,
          rowCount: 0, fileSizeBytes: 0, durationMs: Date.now() - startTime,
          error: `Unknown data type: ${dataType}`,
        };
    }

    // Write file
    let content: string;
    if (format === 'csv' && Array.isArray(data) && data.length > 0) {
      content = toCSV(data);
    } else {
      content = JSON.stringify(data, null, 2);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    const fileSizeBytes = fs.statSync(filePath).size;
    const durationMs = Date.now() - startTime;

    log.info(`[DataExporter] Exported ${dataType} (${format}): ${rowCount} rows, ${(fileSizeBytes / 1024).toFixed(1)}KB`);

    return {
      success: true, filePath, fileName, format, dataType,
      rowCount, fileSizeBytes, durationMs,
    };
  } catch (err: any) {
    log.error(`[DataExporter] Export failed: ${dataType}`, err.message);
    return {
      success: false, filePath, fileName, format, dataType,
      rowCount: 0, fileSizeBytes: 0, durationMs: Date.now() - startTime,
      error: err.message,
    };
  }
}

// ── CSV Helper ─────────────────────────────────────────────────────────────

function toCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const lines = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return String(val);
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}
