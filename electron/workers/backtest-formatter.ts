// T77: Backtest Report Data Formatter for Charts
export interface BacktestMetrics {
  totalReturn: number;
  annualReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgWin: number;
  avgLoss: number;
  calmarRatio: number;
}

export interface EquityCurvePoint {
  date: string;
  value: number;
  drawdown: number;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
}

export interface TradeRecord {
  entryDate: string;
  exitDate: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
}

export interface FormattedReport {
  metrics: BacktestMetrics;
  equityCurve: EquityCurvePoint[];
  monthlyReturns: MonthlyReturn[];
  trades: TradeRecord[];
  summary: string;
}

export class BacktestFormatter {
  format(metrics: BacktestMetrics, equity: EquityCurvePoint[], trades: TradeRecord[]): FormattedReport {
    return {
      metrics,
      equityCurve: equity,
      monthlyReturns: this._computeMonthlyReturns(equity),
      trades,
      summary: this._generateSummary(metrics),
    };
  }

  private _computeMonthlyReturns(equity: EquityCurvePoint[]): MonthlyReturn[] {
    if (equity.length < 2) return [];
    const monthly = new Map<string, { open: number; close: number }>();

    for (const point of equity) {
      const date = new Date(point.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthly.has(key)) {
        monthly.set(key, { open: point.value, close: point.value });
      } else {
        monthly.get(key)!.close = point.value;
      }
    }

    return Array.from(monthly.entries()).map(([key, val]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        year,
        month,
        return: val.open > 0 ? (val.close - val.open) / val.open : 0,
      };
    });
  }

  private _generateSummary(metrics: BacktestMetrics): string {
    const lines = [
      `Total Return: ${(metrics.totalReturn * 100).toFixed(2)}%`,
      `Annual Return: ${(metrics.annualReturn * 100).toFixed(2)}%`,
      `Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`,
      `Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%`,
      `Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`,
      `Profit Factor: ${metrics.profitFactor.toFixed(2)}`,
      `Total Trades: ${metrics.totalTrades}`,
      `Calmar Ratio: ${metrics.calmarRatio.toFixed(2)}`,
    ];
    return lines.join('\n');
  }
}
