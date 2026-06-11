// ── JVS-110: Advanced Analytics & Reporting System ──────────────────────────
// Comprehensive analytics and reporting for portfolio performance

import log from 'electron-log';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnalyticsConfig {
  timeRange: '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL';
  benchmark?: string;
  riskFreeRate?: number;
}

export interface PortfolioAnalytics {
  // Basic metrics
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  
  // Risk-adjusted returns
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio: number;
  
  // Risk metrics
  volatility: number;
  downsideVolatility: number;
  beta: number;
  alpha: number;
  
  // Trade statistics
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgTradeDuration: number;
  largestWin: number;
  largestLoss: number;
  
  // Advanced metrics
  kellycriterion: number;
  valueAtRisk95: number;
  conditionalVaR95: number;
  omegaRatio: number;
  
  // Time-based analysis
  monthlyReturns: MonthlyReturn[];
  drawdownPeriods: DrawdownPeriod[];
  
  // Benchmark comparison
  benchmarkComparison?: BenchmarkComparison;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
  trades: number;
  winRate: number;
}

export interface DrawdownPeriod {
  start: number;
  end: number;
  depth: number;
  duration: number;
  recoveryTime: number;
}

export interface BenchmarkComparison {
  benchmarkReturn: number;
  excessReturn: number;
  trackingError: number;
  informationRatio: number;
  correlation: number;
  beta: number;
  alpha: number;
}

export interface PerformanceReport {
  summary: PortfolioAnalytics;
  charts: ReportCharts;
  insights: AnalyticsInsight[];
  recommendations: string[];
}

export interface ReportCharts {
  equityCurve: ChartPoint[];
  drawdownChart: ChartPoint[];
  monthlyReturns: MonthlyReturnChartData;
  tradeDistribution: TradeDistribution;
  rollingMetrics: RollingMetrics;
}

export interface ChartPoint {
  timestamp: number;
  value: number;
}

export interface MonthlyReturnChartData {
  years: number[];
  months: string[];
  data: number[][];
}

export interface TradeDistribution {
  bins: number[];
  counts: number[];
  mean: number;
  median: number;
  stdDev: number;
}

export interface RollingMetrics {
  sharpe: RollingMetric[];
  volatility: RollingMetric[];
  drawdown: RollingMetric[];
}

export interface RollingMetric {
  timestamp: number;
  window: number;
  value: number;
}

export interface AnalyticsInsight {
  type: 'positive' | 'negative' | 'neutral';
  category: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

// ── Analytics Engine ───────────────────────────────────────────────────────

export class AnalyticsEngine {
  private config: AnalyticsConfig;

  constructor(config?: AnalyticsConfig) {
    this.config = config || {
      timeRange: '1Y',
      riskFreeRate: 0.02,
    };
  }

  /**
   * Generate comprehensive portfolio analytics
   */
  async generateAnalytics(
    equityCurve: ChartPoint[],
    trades: any[],
    benchmarkCurve?: ChartPoint[]
  ): Promise<PortfolioAnalytics> {
    log.info(`[AnalyticsEngine] Generating analytics for ${equityCurve.length} data points`);

    // Calculate basic metrics
    const totalReturn = this.calculateTotalReturn(equityCurve);
    const annualizedReturn = this.calculateAnnualizedReturn(equityCurve);
    const maxDrawdown = this.calculateMaxDrawdown(equityCurve);

    // Risk-adjusted returns
    const volatility = this.calculateVolatility(equityCurve);
    const downsideVolatility = this.calculateDownsideVolatility(equityCurve);
    const sharpeRatio = this.calculateSharpeRatio(equityCurve, this.config.riskFreeRate || 0.02);
    const sortinoRatio = this.calculateSortinoRatio(equityCurve, this.config.riskFreeRate || 0.02);
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    // Trade statistics
    const tradeStats = this.calculateTradeStatistics(trades);

    // Advanced metrics
    const kellycriterion = this.calculateKellyCriterion(trades);
    const valueAtRisk95 = this.calculateVaR(equityCurve, 0.95);
    const conditionalVaR95 = this.calculateCVaR(equityCurve, 0.95);
    const omegaRatio = this.calculateOmegaRatio(equityCurve);

    // Monthly returns
    const monthlyReturns = this.calculateMonthlyReturns(trades);

    // Drawdown periods
    const drawdownPeriods = this.identifyDrawdownPeriods(equityCurve);

    // Benchmark comparison
    let benchmarkComparison: BenchmarkComparison | undefined;
    if (benchmarkCurve) {
      benchmarkComparison = this.compareWithBenchmark(equityCurve, benchmarkCurve);
    }

    return {
      totalReturn,
      annualizedReturn,
      maxDrawdown,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      informationRatio: benchmarkComparison?.informationRatio || 0,
      volatility,
      downsideVolatility,
      beta: benchmarkComparison?.beta || 0,
      alpha: benchmarkComparison?.alpha || 0,
      totalTrades: tradeStats.totalTrades,
      winRate: tradeStats.winRate,
      profitFactor: tradeStats.profitFactor,
      avgWin: tradeStats.avgWin,
      avgLoss: tradeStats.avgLoss,
      avgTradeDuration: tradeStats.avgTradeDuration,
      largestWin: tradeStats.largestWin,
      largestLoss: tradeStats.largestLoss,
      kellycriterion,
      valueAtRisk95,
      conditionalVaR95,
      omegaRatio,
      monthlyReturns,
      drawdownPeriods,
      benchmarkComparison,
    };
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(
    equityCurve: ChartPoint[],
    trades: any[],
    benchmarkCurve?: ChartPoint[]
  ): Promise<PerformanceReport> {
    const summary = await this.generateAnalytics(equityCurve, trades, benchmarkCurve);
    const charts = await this.generateCharts(equityCurve, trades);
    const insights = this.generateInsights(summary);
    const recommendations = this.generateRecommendations(summary);

    return {
      summary,
      charts,
      insights,
      recommendations,
    };
  }

  // ── Calculation Methods ──────────────────────────────────────────────────

  private calculateTotalReturn(equityCurve: ChartPoint[]): number {
    if (equityCurve.length < 2) return 0;
    const start = equityCurve[0].value;
    const end = equityCurve[equityCurve.length - 1].value;
    return ((end - start) / start) * 100;
  }

  private calculateAnnualizedReturn(equityCurve: ChartPoint[]): number {
    if (equityCurve.length < 2) return 0;
    const totalReturn = this.calculateTotalReturn(equityCurve);
    const days = (equityCurve[equityCurve.length - 1].timestamp - equityCurve[0].timestamp) / (1000 * 60 * 60 * 24);
    const years = days / 365.25;
    if (years === 0) return 0;
    return (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100;
  }

  private calculateMaxDrawdown(equityCurve: ChartPoint[]): number {
    let maxDD = 0;
    let peak = equityCurve[0].value;

    for (const point of equityCurve) {
      if (point.value > peak) {
        peak = point.value;
      }
      const drawdown = ((peak - point.value) / peak) * 100;
      if (drawdown > maxDD) {
        maxDD = drawdown;
      }
    }

    return maxDD;
  }

  private calculateVolatility(equityCurve: ChartPoint[]): number {
    const returns = this.calculateReturns(equityCurve);
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const dailyVol = Math.sqrt(variance);
    
    // Annualize
    return dailyVol * Math.sqrt(252) * 100;
  }

  private calculateDownsideVolatility(equityCurve: ChartPoint[]): number {
    const returns = this.calculateReturns(equityCurve);
    const downsideReturns = returns.filter(r => r < 0);
    
    if (downsideReturns.length < 2) return 0;

    const mean = 0; // Downside deviation uses 0 as target
    const variance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / downsideReturns.length;
    const dailyVol = Math.sqrt(variance);
    
    return dailyVol * Math.sqrt(252) * 100;
  }

  private calculateSharpeRatio(equityCurve: ChartPoint[], riskFreeRate: number): number {
    const returns = this.calculateReturns(equityCurve);
    if (returns.length < 2) return 0;

    const annualizedReturn = this.calculateAnnualizedReturn(equityCurve);
    const volatility = this.calculateVolatility(equityCurve) / 100;
    
    if (volatility === 0) return 0;
    return (annualizedReturn - riskFreeRate) / volatility;
  }

  private calculateSortinoRatio(equityCurve: ChartPoint[], riskFreeRate: number): number {
    const annualizedReturn = this.calculateAnnualizedReturn(equityCurve);
    const downsideVol = this.calculateDownsideVolatility(equityCurve) / 100;
    
    if (downsideVol === 0) return 0;
    return (annualizedReturn - riskFreeRate) / downsideVol;
  }

  private calculateKellyCriterion(trades: any[]): number {
    if (trades.length === 0) return 0;

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    if (wins.length === 0 || losses.length === 0) return 0;

    const winRate = wins.length / trades.length;
    const avgWin = wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length);

    if (avgLoss === 0) return 0;

    const winLossRatio = avgWin / avgLoss;
    const kelly = winRate - (1 - winRate) / winLossRatio;

    return Math.max(0, Math.min(1, kelly)); // Cap between 0 and 1
  }

  private calculateVaR(equityCurve: ChartPoint[], confidence: number): number {
    const returns = this.calculateReturns(equityCurve);
    if (returns.length === 0) return 0;

    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    
    return Math.abs(sorted[index]) * 100;
  }

  private calculateCVaR(equityCurve: ChartPoint[], confidence: number): number {
    const returns = this.calculateReturns(equityCurve);
    if (returns.length === 0) return 0;

    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    const tailReturns = sorted.slice(0, index + 1);

    if (tailReturns.length === 0) return 0;

    const avgTailReturn = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
    return Math.abs(avgTailReturn) * 100;
  }

  private calculateOmegaRatio(equityCurve: ChartPoint[]): number {
    const returns = this.calculateReturns(equityCurve);
    if (returns.length === 0) return 0;

    const threshold = 0; // Can be customized
    const gains = returns.filter(r => r > threshold).reduce((sum, r) => sum + (r - threshold), 0);
    const losses = returns.filter(r => r <= threshold).reduce((sum, r) => sum + (threshold - r), 0);

    if (losses === 0) return Infinity;
    return gains / losses;
  }

  private calculateReturns(equityCurve: ChartPoint[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const ret = (equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value;
      returns.push(ret);
    }
    return returns;
  }

  private calculateTradeStatistics(trades: any[]): any {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        avgTradeDuration: 0,
        largestWin: 0,
        largestLoss: 0,
      };
    }

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    const winRate = (wins.length / trades.length) * 100;
    const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0;

    const avgTradeDuration = trades.reduce((sum, t) => sum + (t.duration || 0), 0) / trades.length;

    const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0;

    return {
      totalTrades: trades.length,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      avgTradeDuration,
      largestWin,
      largestLoss,
    };
  }

  private calculateMonthlyReturns(trades: any[]): MonthlyReturn[] {
    const monthlyMap = new Map<string, { returns: number[]; trades: number; wins: number }>();

    for (const trade of trades) {
      const date = new Date(trade.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { returns: [], trades: 0, wins: 0 });
      }

      const month = monthlyMap.get(key)!;
      month.returns.push(trade.pnl);
      month.trades++;
      if (trade.pnl > 0) month.wins++;
    }

    const monthlyReturns: MonthlyReturn[] = [];
    for (const [key, data] of monthlyMap.entries()) {
      const [year, month] = key.split('-').map(Number);
      const totalReturn = data.returns.reduce((sum, r) => sum + r, 0);
      const winRate = (data.wins / data.trades) * 100;

      monthlyReturns.push({
        year,
        month,
        return: totalReturn,
        trades: data.trades,
        winRate,
      });
    }

    return monthlyReturns.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }

  private identifyDrawdownPeriods(equityCurve: ChartPoint[]): DrawdownPeriod[] {
    const periods: DrawdownPeriod[] = [];
    let peak = equityCurve[0].value;
    let peakTime = equityCurve[0].timestamp;
    let drawdownStart = 0;
    let inDrawdown = false;

    for (let i = 0; i < equityCurve.length; i++) {
      const point = equityCurve[i];
      
      if (point.value > peak) {
        if (inDrawdown) {
          // End of drawdown
          const duration = point.timestamp - drawdownStart;
          const depth = ((peak - drawdownStart) / peak) * 100;
          
          periods.push({
            start: drawdownStart,
            end: point.timestamp,
            depth,
            duration,
            recoveryTime: duration,
          });
          
          inDrawdown = false;
        }
        
        peak = point.value;
        peakTime = point.timestamp;
      } else if (point.value < peak && !inDrawdown) {
        inDrawdown = true;
        drawdownStart = point.timestamp;
      }
    }

    return periods;
  }

  private compareWithBenchmark(
    equityCurve: ChartPoint[],
    benchmarkCurve: ChartPoint[]
  ): BenchmarkComparison {
    const portfolioReturns = this.calculateReturns(equityCurve);
    const benchmarkReturns = this.calculateReturns(benchmarkCurve);

    const portfolioReturn = this.calculateTotalReturn(equityCurve);
    const benchmarkReturn = this.calculateTotalReturn(benchmarkCurve);
    const excessReturn = portfolioReturn - benchmarkReturn;

    // Calculate tracking error
    const excessReturns = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
    const trackingError = Math.sqrt(
      excessReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / excessReturns.length
    ) * Math.sqrt(252) * 100;

    // Calculate correlation
    const correlation = this.calculateCorrelation(portfolioReturns, benchmarkReturns);

    // Calculate beta
    const beta = this.calculateBeta(portfolioReturns, benchmarkReturns);

    // Calculate alpha (Jensen's alpha)
    const portfolioReturnAnn = this.calculateAnnualizedReturn(equityCurve);
    const benchmarkReturnAnn = this.calculateAnnualizedReturn(benchmarkCurve);
    const riskFreeRate = this.config.riskFreeRate || 0.02;
    const alpha = portfolioReturnAnn - (riskFreeRate + beta * (benchmarkReturnAnn - riskFreeRate));

    // Information ratio
    const informationRatio = trackingError > 0 ? excessReturn / trackingError : 0;

    return {
      benchmarkReturn,
      excessReturn,
      trackingError,
      informationRatio,
      correlation,
      beta,
      alpha,
    };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const n = x.length;
    const meanX = x.reduce((sum, v) => sum + v, 0) / n;
    const meanY = y.reduce((sum, v) => sum + v, 0) / n;

    let numerator = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }

    const denominator = Math.sqrt(sumX2 * sumY2);
    return denominator > 0 ? numerator / denominator : 0;
  }

  private calculateBeta(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length < 2) {
      return 0;
    }

    const n = portfolioReturns.length;
    const meanP = portfolioReturns.reduce((sum, r) => sum + r, 0) / n;
    const meanB = benchmarkReturns.reduce((sum, r) => sum + r, 0) / n;

    let covariance = 0;
    let varianceB = 0;

    for (let i = 0; i < n; i++) {
      const dp = portfolioReturns[i] - meanP;
      const db = benchmarkReturns[i] - meanB;
      covariance += dp * db;
      varianceB += db * db;
    }

    return varianceB > 0 ? covariance / varianceB : 0;
  }

  private generateCharts(equityCurve: ChartPoint[], trades: any[]): ReportCharts {
    // Equity curve
    const equityChartData = equityCurve.map(p => ({
      timestamp: p.timestamp,
      value: p.value,
    }));

    // Drawdown chart
    const drawdownChart = this.generateDrawdownChart(equityCurve);

    // Monthly returns heatmap
    const monthlyReturns = this.calculateMonthlyReturns(trades);
    const monthlyReturnChart = this.generateMonthlyReturnChart(monthlyReturns);

    // Trade distribution
    const tradeDistribution = this.generateTradeDistribution(trades);

    // Rolling metrics
    const rollingMetrics = this.calculateRollingMetrics(equityCurve);

    return {
      equityCurve: equityChartData,
      drawdownChart,
      monthlyReturns: monthlyReturnChart,
      tradeDistribution,
      rollingMetrics,
    };
  }

  private generateDrawdownChart(equityCurve: ChartPoint[]): ChartPoint[] {
    let peak = equityCurve[0].value;
    const drawdowns: ChartPoint[] = [];

    for (const point of equityCurve) {
      if (point.value > peak) {
        peak = point.value;
      }
      const drawdown = ((peak - point.value) / peak) * 100;
      drawdowns.push({
        timestamp: point.timestamp,
        value: -drawdown, // Negative for visualization
      });
    }

    return drawdowns;
  }

  private generateMonthlyReturnChart(monthlyReturns: MonthlyReturn[]): MonthlyReturnChartData {
    const years = [...new Set(monthlyReturns.map(m => m.year))].sort();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const data: number[][] = [];
    for (const year of years) {
      const yearData = new Array(12).fill(0);
      const yearReturns = monthlyReturns.filter(m => m.year === year);
      
      for (const monthReturn of yearReturns) {
        yearData[monthReturn.month - 1] = monthReturn.return;
      }
      
      data.push(yearData);
    }

    return { years, months, data };
  }

  private generateTradeDistribution(trades: any[]): TradeDistribution {
    if (trades.length === 0) {
      return { bins: [], counts: [], mean: 0, median: 0, stdDev: 0 };
    }

    const pnls = trades.map(t => t.pnl);
    const min = Math.min(...pnls);
    const max = Math.max(...pnls);
    const binCount = 20;
    const binSize = (max - min) / binCount;

    const bins: number[] = [];
    const counts: number[] = new Array(binCount).fill(0);

    for (let i = 0; i < binCount; i++) {
      bins.push(min + i * binSize);
    }

    for (const pnl of pnls) {
      const binIndex = Math.min(Math.floor((pnl - min) / binSize), binCount - 1);
      counts[binIndex]++;
    }

    const mean = pnls.reduce((sum, p) => sum + p, 0) / pnls.length;
    const sorted = [...pnls].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const variance = pnls.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pnls.length;
    const stdDev = Math.sqrt(variance);

    return { bins, counts, mean, median, stdDev };
  }

  private calculateRollingMetrics(equityCurve: ChartPoint[]): RollingMetrics {
    const windows = [20, 60, 120]; // 20, 60, 120 days
    const sharpe: RollingMetric[] = [];
    const volatility: RollingMetric[] = [];
    const drawdown: RollingMetric[] = [];

    for (const window of windows) {
      for (let i = window; i < equityCurve.length; i++) {
        const windowCurve = equityCurve.slice(i - window, i);
        
        // Rolling Sharpe
        const sharpeValue = this.calculateSharpeRatio(windowCurve, 0.02);
        sharpe.push({ timestamp: equityCurve[i].timestamp, window, value: sharpeValue });

        // Rolling volatility
        const volValue = this.calculateVolatility(windowCurve);
        volatility.push({ timestamp: equityCurve[i].timestamp, window, value: volValue });

        // Rolling drawdown
        const ddValue = this.calculateMaxDrawdown(windowCurve);
        drawdown.push({ timestamp: equityCurve[i].timestamp, window, value: ddValue });
      }
    }

    return { sharpe, volatility, drawdown };
  }

  private generateInsights(analytics: PortfolioAnalytics): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];

    // Sharpe ratio insight
    if (analytics.sharpeRatio > 2) {
      insights.push({
        type: 'positive',
        category: 'Risk-Adjusted Return',
        message: `Excellent Sharpe ratio of ${analytics.sharpeRatio.toFixed(2)} indicates strong risk-adjusted returns`,
        severity: 'high',
      });
    } else if (analytics.sharpeRatio < 0.5) {
      insights.push({
        type: 'negative',
        category: 'Risk-Adjusted Return',
        message: `Low Sharpe ratio of ${analytics.sharpeRatio.toFixed(2)} suggests poor risk-adjusted returns`,
        severity: 'high',
      });
    }

    // Drawdown insight
    if (analytics.maxDrawdown > 20) {
      insights.push({
        type: 'negative',
        category: 'Risk',
        message: `Maximum drawdown of ${analytics.maxDrawdown.toFixed(2)}% is high. Consider risk management`,
        severity: 'high',
      });
    }

    // Win rate insight
    if (analytics.winRate < 40) {
      insights.push({
        type: 'negative',
        category: 'Trading',
        message: `Low win rate of ${analytics.winRate.toFixed(2)}%. Consider reviewing entry criteria`,
        severity: 'medium',
      });
    } else if (analytics.winRate > 70) {
      insights.push({
        type: 'positive',
        category: 'Trading',
        message: `High win rate of ${analytics.winRate.toFixed(2)}%`,
        severity: 'low',
      });
    }

    // Profit factor insight
    if (analytics.profitFactor > 2) {
      insights.push({
        type: 'positive',
        category: 'Trading',
        message: `Strong profit factor of ${analytics.profitFactor.toFixed(2)}`,
        severity: 'low',
      });
    } else if (analytics.profitFactor < 1) {
      insights.push({
        type: 'negative',
        category: 'Trading',
        message: `Profit factor below 1.0 indicates strategy is not profitable`,
        severity: 'high',
      });
    }

    return insights;
  }

  private generateRecommendations(analytics: PortfolioAnalytics): string[] {
    const recommendations: string[] = [];

    if (analytics.maxDrawdown > 25) {
      recommendations.push('Consider implementing stop-loss to reduce maximum drawdown');
    }

    if (analytics.winRate < 45 && analytics.profitFactor < 1.5) {
      recommendations.push('Review entry and exit criteria to improve win rate and profit factor');
    }

    if (analytics.kellycriterion > 0.5) {
      recommendations.push('Kelly criterion suggests aggressive position sizing. Consider using fractional Kelly for safety');
    }

    if (analytics.valueAtRisk95 > 5) {
      recommendations.push(`95% VaR of ${analytics.valueAtRisk95.toFixed(2)}% indicates significant daily risk`);
    }

    if (analytics.sharpeRatio < 1) {
      recommendations.push('Consider improving risk-adjusted returns through better entry timing or risk management');
    }

    return recommendations;
  }
}

let analyticsEngineInstance: AnalyticsEngine | null = null;

export function getAnalyticsEngine(config?: AnalyticsConfig): AnalyticsEngine {
  if (!analyticsEngineInstance) {
    analyticsEngineInstance = new AnalyticsEngine(config);
  }
  return analyticsEngineInstance;
}
