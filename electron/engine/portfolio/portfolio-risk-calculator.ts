// ── Portfolio Risk Calculator ─────────────────────────────────────────────
import i18n from '../../../src/i18n';
// Calculates portfolio risk metrics including VaR, CVaR, Sharpe ratio, etc.
// Supports both historical and parametric methods

export interface Position {
  symbol: string;
  quantity: number;
  currentPrice: number;
  costPrice: number;
}

export interface PortfolioRiskMetrics {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  
  // Risk metrics
  var95: number;  // 95% Value at Risk
  var99: number;  // 99% Value at Risk
  cvar95: number; // 95% Conditional VaR (Expected Shortfall)
  cvar99: number; // 99% Conditional VaR
  
  // Performance metrics
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  volatility: number;
  
  // Position analysis
  positionCount: number;
  concentratedPositions: number; // positions > 20% of portfolio
  diversifiedCount: number; // positions < 10% of portfolio
  
  // Risk warnings
  warnings: RiskWarning[];
}

export interface RiskWarning {
  level: 'info' | 'warning' | 'critical';
  message: string;
  symbol?: string;
  value?: number;
}

export interface PortfolioRiskConfig {
  varConfidence: 0.95 | 0.99;
  riskFreeRate: number; // annual risk-free rate (e.g., 0.03 for 3%)
  lookbackDays: number; // days to look back for volatility calculation
  maxPositionPercent: number; // max % of portfolio for single position
}

export class PortfolioRiskCalculator {
  private config: PortfolioRiskConfig;

  constructor(config?: Partial<PortfolioRiskConfig>) {
    this.config = {
      varConfidence: config?.varConfidence ?? 0.95,
      riskFreeRate: config?.riskFreeRate ?? 0.03,
      lookbackDays: config?.lookbackDays ?? 252,
      maxPositionPercent: config?.maxPositionPercent ?? 20,
    };
  }

  /**
   * Calculate portfolio risk metrics
   */
  calculate(positions: Position[], historicalReturns?: Map<string, number[]>): PortfolioRiskMetrics {
    const totalValue = this.calculateTotalValue(positions);
    const totalCost = this.calculateTotalCost(positions);
    const totalPnL = totalValue - totalCost;
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    // Calculate daily PnL (simplified - would need previous day data in production)
    const dailyPnL = this.estimateDailyPnL(positions);
    const dailyPnLPercent = totalValue > 0 ? (dailyPnL / (totalValue - dailyPnL)) * 100 : 0;

    // Calculate position returns for risk metrics
    const positionReturns = this.calculatePositionReturns(positions, historicalReturns);
    
    // Calculate portfolio returns (weighted average)
    const portfolioReturns = this.calculatePortfolioReturns(positions, positionReturns, totalValue);

    // Calculate risk metrics
    const var95 = this.calculateVaR(portfolioReturns, 0.95);
    const var99 = this.calculateVaR(portfolioReturns, 0.99);
    const cvar95 = this.calculateCVaR(portfolioReturns, 0.95);
    const cvar99 = this.calculateCVaR(portfolioReturns, 0.99);

    const volatility = this.calculateVolatility(portfolioReturns);
    const sharpeRatio = this.calculateSharpeRatio(portfolioReturns);
    const sortinoRatio = this.calculateSortinoRatio(portfolioReturns);
    const maxDrawdown = this.calculateMaxDrawdown(portfolioReturns);

    // Analyze positions
    const positionAnalysis = this.analyzePositions(positions, totalValue);

    // Generate risk warnings
    const warnings = this.generateRiskWarnings(positions, totalValue, positionAnalysis, portfolioReturns);

    return {
      totalValue,
      totalCost,
      totalPnL,
      totalPnLPercent,
      dailyPnL,
      dailyPnLPercent,
      var95,
      var99,
      cvar95,
      cvar99,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      volatility,
      positionCount: positions.length,
      concentratedPositions: positionAnalysis.concentratedCount,
      diversifiedCount: positionAnalysis.diversifiedCount,
      warnings,
    };
  }

  /**
   * Calculate total portfolio value
   */
  private calculateTotalValue(positions: Position[]): number {
    return positions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0);
  }

  /**
   * Calculate total portfolio cost
   */
  private calculateTotalCost(positions: Position[]): number {
    return positions.reduce((sum, pos) => sum + (pos.quantity * pos.costPrice), 0);
  }

  /**
   * Estimate daily PnL (simplified)
   */
  private estimateDailyPnL(positions: Position[]): number {
    // In production, this would use actual previous day closing prices
    // For now, estimate based on a small random daily change
    return positions.reduce((sum, pos) => {
      const dailyChange = (Math.random() - 0.5) * 0.02 * pos.currentPrice * pos.quantity;
      return sum + dailyChange;
    }, 0);
  }

  /**
   * Calculate returns for each position
   */
  private calculatePositionReturns(
    positions: Position[],
    historicalReturns?: Map<string, number[]>
  ): Map<string, number[]> {
    const returns = new Map<string, number[]>();

    for (const pos of positions) {
      if (historicalReturns?.has(pos.symbol)) {
        returns.set(pos.symbol, historicalReturns.get(pos.symbol)!);
      } else {
        // Generate synthetic returns if historical data not available
        const syntheticReturns = this.generateSyntheticReturns(this.config.lookbackDays);
        returns.set(pos.symbol, syntheticReturns);
      }
    }

    return returns;
  }

  /**
   * Calculate weighted portfolio returns
   */
  private calculatePortfolioReturns(
    positions: Position[],
    positionReturns: Map<string, number[]>,
    totalValue: number
  ): number[] {
    if (positions.length === 0) return [];

    const days = Math.min(
      ...Array.from(positionReturns.values()).map(r => r.length)
    );

    const portfolioReturns: number[] = [];

    for (let day = 0; day < days; day++) {
      let weightedReturn = 0;

      for (const pos of positions) {
        const weight = (pos.quantity * pos.currentPrice) / totalValue;
        const returns = positionReturns.get(pos.symbol);
        if (returns && day < returns.length) {
          weightedReturn += weight * returns[day];
        }
      }

      portfolioReturns.push(weightedReturn);
    }

    return portfolioReturns;
  }

  /**
   * Generate synthetic returns for testing
   */
  private generateSyntheticReturns(days: number): number[] {
    const returns: number[] = [];
    const mu = 0.0005; // daily drift
    const sigma = 0.02; // daily volatility

    for (let i = 0; i < days; i++) {
      // Simple normal distribution approximation
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const dailyReturn = mu + sigma * z;
      returns.push(dailyReturn);
    }

    return returns;
  }

  /**
   * Calculate Value at Risk using historical method
   */
  private calculateVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0;

    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    return -sorted[index]; // Return as positive number (loss)
  }

  /**
   * Calculate Conditional VaR (Expected Shortfall)
   */
  private calculateCVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0;

    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    const tailReturns = sorted.slice(0, index);

    if (tailReturns.length === 0) return 0;

    const avgLoss = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
    return -avgLoss; // Return as positive number (loss)
  }

  /**
   * Calculate portfolio volatility (annualized)
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const dailyVol = Math.sqrt(variance);
    
    // Annualize (assuming 252 trading days)
    return dailyVol * Math.sqrt(252);
  }

  /**
   * Calculate Sharpe Ratio
   */
  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const annualizedReturn = mean * 252;
    const annualizedVol = stdDev * Math.sqrt(252);

    return (annualizedReturn - this.config.riskFreeRate) / annualizedVol;
  }

  /**
   * Calculate Sortino Ratio (uses downside deviation)
   */
  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    // Calculate downside deviation (only negative returns)
    const downsideReturns = returns.filter(r => r < 0);
    if (downsideReturns.length === 0) return Infinity;

    const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length;
    const downsideDev = Math.sqrt(downsideVariance);

    if (downsideDev === 0) return Infinity;

    const annualizedReturn = mean * 252;
    const annualizedDownside = downsideDev * Math.sqrt(252);

    return (annualizedReturn - this.config.riskFreeRate) / annualizedDownside;
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;

    let cumulativeReturn = 1;
    let peak = 1;
    let maxDrawdown = 0;

    for (const ret of returns) {
      cumulativeReturn *= (1 + ret);
      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
      }
      const drawdown = (peak - cumulativeReturn) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown * 100; // Return as percentage
  }

  /**
   * Analyze position concentrations
   */
  private analyzePositions(
    positions: Position[],
    totalValue: number
  ): { concentratedCount: number; diversifiedCount: number } {
    let concentratedCount = 0;
    let diversifiedCount = 0;

    for (const pos of positions) {
      const positionValue = pos.quantity * pos.currentPrice;
      const positionPercent = totalValue > 0 ? (positionValue / totalValue) * 100 : 0;

      if (positionPercent > this.config.maxPositionPercent) {
        concentratedCount++;
      } else if (positionPercent < 10) {
        diversifiedCount++;
      }
    }

    return { concentratedCount, diversifiedCount };
  }

  /**
   * Generate risk warnings based on portfolio analysis
   */
  private generateRiskWarnings(
    positions: Position[],
    totalValue: number,
    positionAnalysis: { concentratedCount: number; diversifiedCount: number },
    portfolioReturns: number[]
  ): RiskWarning[] {
    const warnings: RiskWarning[] = [];

    // Check for concentrated positions
    if (positionAnalysis.concentratedCount > 0) {
      const concentrated = positions.filter(pos => {
        const posValue = pos.quantity * pos.currentPrice;
        const posPercent = totalValue > 0 ? (posValue / totalValue) * 100 : 0;
        return posPercent > this.config.maxPositionPercent;
      });

      for (const pos of concentrated) {
        const posPercent = (pos.quantity * pos.currentPrice / totalValue) * 100;
        warnings.push({
          level: posPercent > 30 ? 'critical' : 'warning',
          message: `${pos.symbol} 持仓占比 ${posPercent.toFixed(1)}%，超过 ${this.config.maxPositionPercent}% 阈值`,
          symbol: pos.symbol,
          value: posPercent,
        });
      }
    }

    // Check portfolio volatility
    const volatility = this.calculateVolatility(portfolioReturns);
    if (volatility > 0.30) {
      warnings.push({
        level: volatility > 0.40 ? 'critical' : 'warning',
        message: `组合波动率 ${(volatility * 100).toFixed(1)}% 较高`,
        value: volatility,
      });
    }

    // Check maximum drawdown
    const maxDrawdown = this.calculateMaxDrawdown(portfolioReturns);
    if (maxDrawdown > 20) {
      warnings.push({
        level: maxDrawdown > 30 ? 'critical' : 'warning',
        message: `最大回撤 ${maxDrawdown.toFixed(1)}% 较大`,
        value: maxDrawdown,
      });
    }

    // Check for low diversification
    if (positionAnalysis.diversifiedCount < 3 && positions.length > 3) {
      warnings.push({
        level: 'info',
        message: i18n.t('PortfolioRiskCalculator.k0'),
      });
    }

    return warnings;
  }

  /**
   * Calculate portfolio beta (relative to benchmark)
   */
  calculateBeta(
    portfolioReturns: number[],
    benchmarkReturns: number[]
  ): number {
    if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length < 2) {
      return 0;
    }

    const n = portfolioReturns.length;
    const meanP = portfolioReturns.reduce((sum, r) => sum + r, 0) / n;
    const meanB = benchmarkReturns.reduce((sum, r) => sum + r, 0) / n;

    let covariance = 0;
    let benchmarkVariance = 0;

    for (let i = 0; i < n; i++) {
      const pDiff = portfolioReturns[i] - meanP;
      const bDiff = benchmarkReturns[i] - meanB;
      covariance += pDiff * bDiff;
      benchmarkVariance += bDiff * bDiff;
    }

    if (benchmarkVariance === 0) return 0;

    return covariance / benchmarkVariance;
  }

  /**
   * Calculate portfolio correlation with benchmark
   */
  calculateCorrelation(
    portfolioReturns: number[],
    benchmarkReturns: number[]
  ): number {
    if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length < 2) {
      return 0;
    }

    const n = portfolioReturns.length;
    const meanP = portfolioReturns.reduce((sum, r) => sum + r, 0) / n;
    const meanB = benchmarkReturns.reduce((sum, r) => sum + r, 0) / n;

    let covariance = 0;
    let varianceP = 0;
    let varianceB = 0;

    for (let i = 0; i < n; i++) {
      const pDiff = portfolioReturns[i] - meanP;
      const bDiff = benchmarkReturns[i] - meanB;
      covariance += pDiff * bDiff;
      varianceP += pDiff * pDiff;
      varianceB += bDiff * bDiff;
    }

    if (varianceP === 0 || varianceB === 0) return 0;

    return covariance / Math.sqrt(varianceP * varianceB);
  }
}

// Export singleton instance
let calculatorInstance: PortfolioRiskCalculator | null = null;

export function getPortfolioRiskCalculator(
  config?: Partial<PortfolioRiskConfig>
): PortfolioRiskCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new PortfolioRiskCalculator(config);
  }
  return calculatorInstance;
}
