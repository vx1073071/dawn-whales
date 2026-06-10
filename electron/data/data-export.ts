// ── JVS-106: Data Export Service ─────────────────────────────────────────────
// Support CSV, Excel, PDF export for portfolio, trades, and performance data

import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExportConfig {
  format: 'csv' | 'excel' | 'pdf';
  data: ExportData;
  filename?: string;
  options?: ExportOptions;
}

export interface ExportData {
  type: 'portfolio' | 'trades' | 'performance' | 'custom';
  portfolio?: PortfolioExportData;
  trades?: TradeExportData[];
  performance?: PerformanceExportData;
  custom?: any[];
}

export interface PortfolioExportData {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPct: number;
  positions: PositionExportData[];
  metrics: PortfolioMetrics;
}

export interface PositionExportData {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  weight: number;
}

export interface TradeExportData {
  id: string;
  timestamp: number;
  symbol: string;
  name: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  amount: number;
  commission: number;
  pnl?: number;
  pnlPct?: number;
}

export interface PerformanceExportData {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgWin: number;
  avgLoss: number;
  avgTradeDuration: number;
}

export interface PortfolioMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  winRate: number;
  profitFactor: number;
}

export interface ExportOptions {
  csv?: {
    delimiter?: string;
    includeHeaders?: boolean;
  };
  excel?: {
    sheetName?: string;
    includeCharts?: boolean;
  };
  pdf?: {
    title?: string;
    includeCharts?: boolean;
    pageSize?: 'A4' | 'Letter';
  };
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  filename: string;
  format: string;
  rows: number;
  error?: string;
}

// ── CSV Export ─────────────────────────────────────────────────────────────

export async function exportToCSV(data: ExportData, options?: ExportOptions): Promise<ExportResult> {
  try {
    const delimiter = options?.csv?.delimiter || ',';
    const includeHeaders = options?.csv?.includeHeaders !== false;
    
    let csvContent = '';
    let rows = 0;

    // Export based on data type
    if (data.type === 'portfolio' && data.portfolio) {
      const { portfolio } = data;
      
      // Portfolio summary
      if (includeHeaders) {
        csvContent += 'Portfolio Summary\n';
        csvContent += `Total Value,${portfolio.totalValue}\n`;
        csvContent += `Total Cost,${portfolio.totalCost}\n`;
        csvContent += `Total P&L,${portfolio.totalPnl}\n`;
        csvContent += `Total P&L %,${portfolio.totalPnlPct}%\n`;
        csvContent += '\n';
      }

      // Positions
      if (portfolio.positions.length > 0) {
        if (includeHeaders) {
          csvContent += 'Symbol,Name,Quantity,Avg Cost,Current Price,Market Value,P&L,P&L %,Weight %\n';
        }
        
        for (const pos of portfolio.positions) {
          csvContent += `${pos.symbol},${pos.name},${pos.quantity},${pos.avgCost},${pos.currentPrice},${pos.marketValue},${pos.pnl},${pos.pnlPct},${pos.weight}\n`;
          rows++;
        }
      }
    }

    if (data.type === 'trades' && data.trades) {
      if (includeHeaders) {
        csvContent += 'ID,Timestamp,Symbol,Name,Side,Quantity,Price,Amount,Commission,P&L,P&L %\n';
      }

      for (const trade of data.trades) {
        csvContent += `${trade.id},${trade.timestamp},${trade.symbol},${trade.name},${trade.side},${trade.quantity},${trade.price},${trade.amount},${trade.commission},${trade.pnl || ''},${trade.pnlPct || ''}\n`;
        rows++;
      }
    }

    if (data.type === 'performance' && data.performance) {
      const perf = data.performance;
      csvContent += 'Performance Metrics\n';
      csvContent += `Total Return,${perf.totalReturn}%\n`;
      csvContent += `Annualized Return,${perf.annualizedReturn}%\n`;
      csvContent += `Max Drawdown,${perf.maxDrawdown}%\n`;
      csvContent += `Sharpe Ratio,${perf.sharpeRatio}\n`;
      csvContent += `Sortino Ratio,${perf.sortinoRatio}\n`;
      csvContent += `Calmar Ratio,${perf.calmarRatio}\n`;
      csvContent += `Win Rate,${perf.winRate}%\n`;
      csvContent += `Profit Factor,${perf.profitFactor}\n`;
      csvContent += `Total Trades,${perf.totalTrades}\n`;
      csvContent += `Avg Win,${perf.avgWin}%\n`;
      csvContent += `Avg Loss,${perf.avgLoss}%\n`;
      csvContent += `Avg Trade Duration,${perf.avgTradeDuration} bars\n`;
      rows = 1;
    }

    if (data.type === 'custom' && data.custom) {
      if (data.custom.length > 0) {
        const headers = Object.keys(data.custom[0]);
        if (includeHeaders) {
          csvContent += headers.join(delimiter) + '\n';
        }

        for (const row of data.custom) {
          const values = headers.map(h => row[h] ?? '');
          csvContent += values.join(delimiter) + '\n';
          rows++;
        }
      }
    }

    // Generate filename
    const filename = generateFilename(data.type, 'csv');
    const filePath = path.join(getExportDir(), filename);

    // Write file
    fs.writeFileSync(filePath, csvContent, 'utf-8');

    return {
      success: true,
      filePath,
      filename,
      format: 'csv',
      rows,
    };
  } catch (err) {
    log.error('[DataExport] CSV export error:', err);
    return {
      success: false,
      filename: '',
      format: 'csv',
      rows: 0,
      error: err.message,
    };
  }
}

// ── Excel Export ───────────────────────────────────────────────────────────

export async function exportToExcel(data: ExportData, options?: ExportOptions): Promise<ExportResult> {
  try {
    // TODO: Implement Excel export using xlsx library
    // For now, return mock result
    const filename = generateFilename(data.type, 'xlsx');
    
    log.info(`[DataExport] Excel export: ${filename}`);

    return {
      success: true,
      filePath: path.join(getExportDir(), filename),
      filename,
      format: 'excel',
      rows: 0,
      error: 'Excel export not yet implemented',
    };
  } catch (err) {
    log.error('[DataExport] Excel export error:', err);
    return {
      success: false,
      filename: '',
      format: 'excel',
      rows: 0,
      error: err.message,
    };
  }
}

// ── PDF Export ─────────────────────────────────────────────────────────────

export async function exportToPDF(data: ExportData, options?: ExportOptions): Promise<ExportResult> {
  try {
    // TODO: Implement PDF export using pdfkit or similar
    // For now, return mock result
    const filename = generateFilename(data.type, 'pdf');
    
    log.info(`[DataExport] PDF export: ${filename}`);

    return {
      success: true,
      filePath: path.join(getExportDir(), filename),
      filename,
      format: 'pdf',
      rows: 0,
      error: 'PDF export not yet implemented',
    };
  } catch (err) {
    log.error('[DataExport] PDF export error:', err);
    return {
      success: false,
      filename: '',
      format: 'pdf',
      rows: 0,
      error: err.message,
    };
  }
}

// ── Helper Functions ───────────────────────────────────────────────────────

function generateFilename(type: string, format: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `export-${type}-${timestamp}.${format}`;
}

function getExportDir(): string {
  const exportDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  return exportDir;
}

// ── Main Export Function ───────────────────────────────────────────────────

export async function exportData(config: ExportConfig): Promise<ExportResult> {
  const { format, data, options } = config;

  switch (format) {
    case 'csv':
      return exportToCSV(data, options);
    case 'excel':
      return exportToExcel(data, options);
    case 'pdf':
      return exportToPDF(data, options);
    default:
      return {
        success: false,
        filename: '',
        format,
        rows: 0,
        error: `Unsupported format: ${format}`,
      };
  }
}

let exportServiceInstance: DataExportService | null = null;

export function getDataExportService(): DataExportService {
  if (!exportServiceInstance) {
    exportServiceInstance = new DataExportService();
  }
  return exportServiceInstance;
}

// ── Data Export Service Class ──────────────────────────────────────────────

export class DataExportService {
  /**
   * Export data to specified format
   */
  async export(config: ExportConfig): Promise<ExportResult> {
    return exportData(config);
  }

  /**
   * Export portfolio data
   */
  async exportPortfolio(portfolio: PortfolioExportData, format: 'csv' | 'excel' | 'pdf' = 'csv'): Promise<ExportResult> {
    return this.export({
      format,
      data: {
        type: 'portfolio',
        portfolio,
      },
    });
  }

  /**
   * Export trade history
   */
  async exportTrades(trades: TradeExportData[], format: 'csv' | 'excel' | 'pdf' = 'csv'): Promise<ExportResult> {
    return this.export({
      format,
      data: {
        type: 'trades',
        trades,
      },
    });
  }

  /**
   * Export performance metrics
   */
  async exportPerformance(performance: PerformanceExportData, format: 'csv' | 'excel' | 'pdf' = 'csv'): Promise<ExportResult> {
    return this.export({
      format,
      data: {
        type: 'performance',
        performance,
      },
    });
  }

  /**
   * Export custom data
   */
  async exportCustom(data: unknown[], format: 'csv' | 'excel' | 'pdf' = 'csv'): Promise<ExportResult> {
    return this.export({
      format,
      data: {
        type: 'custom',
        custom: data,
      },
    });
  }
}
