// ── Q16: Dynamic Position Sizing ──────────────────────────────────────
// Kelly Criterion + Volatility-Adjusted + Regime-Aware sizing
// Consumes JVS macro data for regime detection

import log from 'electron-log';
import { RegimeDetector, MarketRegime } from './regime-detector';
import { SentimentIndexEngine } from './sentiment-index';

// ── Types ─────────────────────────────────────────────────────────────────

export interface SizingConfig {
  // Kelly Criterion
  kellyFraction: number;        // 0.25 (quarter-Kelly by default)
  kellyLookback: number;       // 252 (1 year of trades)
  kellyMinTrades: number;      // 30 (min trades before using Kelly)
  
  // Volatility adjustment
  volLookback: number;         // 20 (days)
  volTarget: number;            // 0.15 (15% annualized vol target)
  volMaxPosition: number;       // 0.30 (max 30% of capital)
  
  // Regime adjustment
  regimeMultiplier: Record<MarketRegime, number>;
  // default: { bull: 1.2, bear: 0.5, neutral: 1.0, crisis: 0.2 }
  
  // Risk limits
  maxPositionPct: number;       // 0.25 (max 25% per position)
  maxTotalExposure: number;     // 0.90 (max 90% total exposure)
  stopLossPct: number;          // 0.05 (5% stop-loss)
  
  // Sentiment overlay
  sentimentWeight: number;      // 0.20 (20% weight)
  sentimentMin: number;         // 30 (min sentiment score)
  sentimentMax: number;        // 80 (max sentiment score)
}

export interface PositionSizeRequest {
  strategyId: string;
  symbol: string;
  capital: number;             // Available capital (RMB)
  currentPrice: number;        // Current stock price
  volatility?: number;          // Optional pre-computed volatility
  regime?: MarketRegime;       // Optional pre-detected regime
  sentiment?: number;           // Optional pre-fetched sentiment (0-100)
  winRate?: number;             // Optional historical win rate (0-1)
  avgWinLossRatio?: number;     // Optional avg win/loss ratio
  riskPerTradePct?: number;     // Optional risk budget (0-1)
}

export interface PositionSizeResult {
  success: boolean;
  strategyId: string;
  symbol: string;
  
  // Sizing outputs
  recommendedShares: number;    // Number of shares to buy
  recommendedValue: number;     // Total value (shares × price)
  positionPct: number;          // % of capital
  
  // Component breakdown
  kellyFraction: number;        // Kelly fraction (0-1)
  volAdjustment: number;        // Vol adjustment factor (0-1)
  regimeMultiplier: number;     // Regime multiplier
  sentimentMultiplier: number;   // Sentiment multiplier
  
  // Risk metrics
  stopLossPrice: number;        // Stop-loss price
  maxLossPct: number;          // Max loss % if stop-loss hit
  expectedValue: number;        // Expected value per trade
  
  // Debug info
  debug: {
    kellyRaw: number;
    kellyAdjusted: number;
    volatility: number;
    regime: MarketRegime;
    sentiment: number;
    warnings: string[];
  };
  
  error?: string;
}

export interface PortfolioSizingRequest {
  strategyId: string;
  positions: Array<{
    symbol: string;
    currentShares: number;
    currentPrice: number;
    entryPrice: number;
  }>;
  capital: number;
  maxTotalExposure?: number;
}

export interface PortfolioSizingResult {
  success: boolean;
  strategyId: string;
  totalExposurePct: number;
  positionSizes: Array<{
    symbol: string;
    currentShares: number;
    recommendedShares: number;
    recommendedValue: number;
    positionPct: number;
    action: 'INCREASE' | 'DECREASE' | 'HOLD' | 'CLOSE';
  }>;
  error?: string;
}

// ── Default Config ──────────────────────────────────────────────────────

const DEFAULT_CONFIG: SizingConfig = {
  kellyFraction: 0.25,
  kellyLookback: 252,
  kellyMinTrades: 30,
  
  volLookback: 20,
  volTarget: 0.15,
  volMaxPosition: 0.30,
  
  regimeMultiplier: {
    bull: 1.2,
    bear: 0.5,
    neutral: 1.0,
    crisis: 0.2,
  },
  
  maxPositionPct: 0.25,
  maxTotalExposure: 0.90,
  stopLossPct: 0.05,
  
  sentimentWeight: 0.20,
  sentimentMin: 30,
  sentimentMax: 80,
};

// ── Dynamic Sizer ─────────────────────────────────────────────────────────

export class DynamicSizer {
  private config: SizingConfig;
  private regimeDetector: RegimeDetector | null = null;
  private sentimentEngine: SentimentIndexEngine | null = null;
  
  // Trade history (for Kelly calculation)
  private tradeHistory: Array<{
    strategyId: string;
    symbol: string;
    entryPrice: number;
    exitPrice: number;
    shares: number;
    pnl: number;
    pnlPct: number;
    timestamp: number;
  }> = [];

  constructor(config?: Partial<SizingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info('[DynamicSizer] Initialized with config:', this.config);
  }

  // ── Initialization (call from main.ts) ─────────────────────────────
  
  useRegimeDetector(detector: RegimeDetector): void {
    this.regimeDetector = detector;
    log.info('[DynamicSizer] RegimeDetector connected');
  }
  
  useSentimentEngine(engine: SentimentIndexEngine): void {
    this.sentimentEngine = engine;
    log.info('[DynamicSizer] SentimentIndexEngine connected');
  }

  // ── Core Sizing ─────────────────────────────────────────────────

  async calculateSize(request: PositionSizeRequest): Promise<PositionSizeResult> {
    const { strategyId, symbol, capital, currentPrice } = request;
    const warnings: string[] = [];
    
    try {
      // 1. Kelly Criterion
      const kellyRaw = this.calculateKelly(request);
      let kellyAdjusted = kellyRaw * this.config.kellyFraction;
      
      if (kellyRaw < 0) {
        kellyAdjusted = 0;
        warnings.push('Kelly fraction negative, setting to 0');
      }
      
      // 2. Volatility adjustment
      const volatility = request.volatility || await this.calculateVolatility(symbol);
      const volAdjustment = this.calculateVolAdjustment(volatility);
      
      // 3. Regime adjustment
      const regime = request.regime || await this.detectRegime();
      const regimeMultiplier = this.config.regimeMultiplier[regime] || 1.0;
      
      // 4. Sentiment overlay
      const sentiment = request.sentiment ?? await this.fetchSentiment();
      const sentimentMultiplier = this.calculateSentimentMultiplier(sentiment);
      
      // 5. Combined fraction
      let fraction = kellyAdjusted * volAdjustment * regimeMultiplier * sentimentMultiplier;
      
      // 6. Apply risk limits
      fraction = Math.min(fraction, this.config.maxPositionPct);
      fraction = Math.max(fraction, 0);
      
      // 7. Calculate shares
      const positionValue = capital * fraction;
      const recommendedShares = Math.floor(positionValue / currentPrice / 100) * 100; // Round to 100 shares
      const recommendedValue = recommendedShares * currentPrice;
      const positionPct = recommendedValue / capital;
      
      // 8. Stop-loss
      const stopLossPrice = currentPrice * (1 - this.config.stopLossPct);
      const maxLossPct = this.config.stopLossPct * positionPct;
      
      // 9. Expected value
      const winRate = request.winRate || 0.5;
      const avgWinLossRatio = request.avgWinLossRatio || 1.5;
      const expectedValue = winRate * avgWinLossRatio - (1 - winRate);
      
      // 10. Debug info
      const debug = {
        kellyRaw,
        kellyAdjusted,
        volatility,
        regime,
        sentiment,
        warnings,
      };
      
      log.info(`[DynamicSizer] ${strategyId}/${symbol}: fraction=${(fraction * 100).toFixed(1)}%, shares=${recommendedShares}, value=¥${recommendedValue.toFixed(0)}`);
      
      return {
        success: true,
        strategyId,
        symbol,
        recommendedShares,
        recommendedValue,
        positionPct,
        kellyFraction: kellyAdjusted,
        volAdjustment,
        regimeMultiplier,
        sentimentMultiplier,
        stopLossPrice,
        maxLossPct,
        expectedValue,
        debug,
      };
    } catch (err: unknown) {
      log.error('[DynamicSizer] Calculation failed:', err.message);
      return {
        success: false,
        strategyId,
        symbol,
        recommendedShares: 0,
        recommendedValue: 0,
        positionPct: 0,
        kellyFraction: 0,
        volAdjustment: 1,
        regimeMultiplier: 1,
        sentimentMultiplier: 1,
        stopLossPrice: 0,
        maxLossPct: 0,
        expectedValue: 0,
        debug: { kellyRaw: 0, kellyAdjusted: 0, volatility: 0, regime: 'neutral', sentiment: 50, warnings: [err.message] },
        error: err.message,
      };
    }
  }

  // ── Portfolio Sizing ─────────────────────────────────────────────

  async calculatePortfolioSizes(request: PortfolioSizingRequest): Promise<PortfolioSizingResult> {
    const { strategyId, positions, capital, maxTotalExposure } = request;
    const maxExposure = maxTotalExposure || this.config.maxTotalExposure;
    const warnings: string[] = [];
    
    try {
      // Calculate current exposure
      let totalExposure = 0;
      for (const pos of positions) {
        totalExposure += (pos.currentShares * pos.currentPrice) / capital;
      }
      
      // Check if already at max exposure
      if (totalExposure >= maxExposure) {
        return {
          success: true,
          strategyId,
          totalExposurePct: totalExposure,
          positionSizes: positions.map((p) => ({
            symbol: p.symbol,
            currentShares: p.currentShares,
            recommendedShares: 0,
            recommendedValue: 0,
            positionPct: 0,
            action: 'HOLD' as const,
          })),
        };
      }
      
      // Calculate target sizes for each position
      const results = await Promise.all(
        positions.map(async (pos) => {
          const sizeResult = await this.calculateSize({
            strategyId,
            symbol: pos.symbol,
            capital,
            currentPrice: pos.currentPrice,
          });
          
          const currentValue = pos.currentShares * pos.currentPrice;
          const targetValue = sizeResult.recommendedValue;
          const diffPct = (targetValue - currentValue) / currentValue;
          
          let action: 'INCREASE' | 'DECREASE' | 'HOLD' | 'CLOSE' = 'HOLD';
          if (diffPct > 0.05) action = 'INCREASE';
          else if (diffPct < -0.05) action = 'DECREASE';
          else if (targetValue === 0) action = 'CLOSE';
          
          return {
            symbol: pos.symbol,
            currentShares: pos.currentShares,
            recommendedShares: sizeResult.recommendedShares,
            recommendedValue: sizeResult.recommendedValue,
            positionPct: sizeResult.positionPct,
            action,
          };
        })
      );
      
      // Check total exposure after adjustment
      let newExposure = 0;
      for (const res of results) {
        newExposure += res.positionPct;
      }
      
      if (newExposure > maxExposure) {
        warnings.push(`Total exposure ${(newExposure * 100).toFixed(1)}% exceeds max ${(maxExposure * 100).toFixed(1)}%, scaling down`);
        // Scale down proportionally
        const scale = maxExposure / newExposure;
        results.forEach((res) => {
          res.recommendedShares = Math.floor(res.recommendedShares * scale / 100) * 100;
          res.recommendedValue = res.recommendedShares * (positions.find((p) => p.symbol === res.symbol)!.currentPrice);
          res.positionPct = res.recommendedValue / capital;
        });
      }
      
      return {
        success: true,
        strategyId,
        totalExposurePct: newExposure,
        positionSizes: results,
      };
    } catch (err: unknown) {
      log.error('[DynamicSizer] Portfolio calculation failed:', err.message);
      return {
        success: false,
        strategyId,
        totalExposurePct: 0,
        positionSizes: [],
        error: err.message,
      };
    }
  }

  // ── Kelly Criterion ───────────────────────────────────────────────

  private calculateKelly(request: PositionSizeRequest): number {
    const { strategyId, winRate, avgWinLossRatio } = request;
    
    // If winRate and avgWinLossRatio provided, use them
    if (winRate !== undefined && avgWinLossRatio !== undefined) {
      const kelly = winRate - (1 - winRate) / avgWinLossRatio;
      return Math.max(0, kelly);
    }
    
    // Otherwise, use trade history
    const trades = this.tradeHistory.filter((t) => t.strategyId === strategyId);
    
    if (trades.length < this.config.kellyMinTrades) {
      log.warn(`[DynamicSizer] Only ${trades.length} trades, need ${this.config.kellyMinTrades}, using fixed fraction`);
      return 0.10; // Default 10% if not enough trades
    }
    
    const wins = trades.filter((t) => t.pnl > 0).length;
    const winRateHist = wins / trades.length;
    
    const avgWin = trades.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnlPct, 0) / (wins || 1);
    const avgLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((sum, t) => sum + t.pnlPct, 0) / (trades.length - wins || 1));
    
    const winLossRatio = avgWin / (avgLoss || 1);
    
    const kelly = winRateHist - (1 - winRateHist) / winLossRatio;
    return Math.max(0, kelly);
  }

  // ── Volatility Adjustment ──────────────────────────────────────────

  private async calculateVolatility(symbol: string): Promise<number> {
    // v1.9.0: calculated from EMScript kline data
    // Fallback: return 0.20 (20% annualized)
    return 0.20;
  }

  private calculateVolAdjustment(volatility: number): number {
    if (volatility <= 0) return 1.0;
    
    // Target volatility = volTarget (15%)
    // If actual vol > target, reduce position; if < target, increase
    const adjustment = this.config.volTarget / volatility;
    
    // Cap adjustment to [0.5, 2.0]
    return Math.max(0.5, Math.min(2.0, adjustment));
  }

  // ── Regime Detection ──────────────────────────────────────────────

  private async detectRegime(): Promise<MarketRegime> {
    if (!this.regimeDetector) {
      return 'neutral';
    }
    
    try {
      const result = await this.regimeDetector.detect();
      return result.regime || 'neutral';
    } catch (err: unknown) {
      log.error('[DynamicSizer] Regime detection failed:', err.message);
      return 'neutral';
    }
  }

  // ── Sentiment Overlay ────────────────────────────────────────────

  private async fetchSentiment(): Promise<number> {
    if (!this.sentimentEngine) {
      return 50; // Neutral
    }
    
    try {
      const result = await this.sentimentEngine.compute();
      return result.index?.overallScore || 50;
    } catch (err: unknown) {
      log.error('[DynamicSizer] Sentiment fetch failed:', err.message);
      return 50;
    }
  }

  private calculateSentimentMultiplier(sentiment: number): number {
    // sentiment: 0-100
    // multiplier: 0.5 (extreme fear) to 1.5 (extreme greed)
    // neutral (50) = 1.0
    
    if (sentiment <= this.config.sentimentMin) {
      return 0.5; // Very bearish, reduce size
    }
    
    if (sentiment >= this.config.sentimentMax) {
      return 1.5; // Very bullish, increase size
    }
    
    // Linear interpolation
    const mid = (this.config.sentimentMin + this.config.sentimentMax) / 2;
    const range = (this.config.sentimentMax - this.config.sentimentMin) / 2;
    const normalized = (sentiment - mid) / range; // -1 to 1
    
    return 1.0 + normalized * 0.5; // 0.5 to 1.5
  }

  // ── Trade History ─────────────────────────────────────────────────

  recordTrade(trade: {
    strategyId: string;
    symbol: string;
    entryPrice: number;
    exitPrice: number;
    shares: number;
    timestamp?: number;
  }): void {
    const pnl = (trade.exitPrice - trade.entryPrice) * trade.shares;
    const pnlPct = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;
    
    this.tradeHistory.push({
      ...trade,
      pnl,
      pnlPct,
      timestamp: trade.timestamp || Date.now(),
    });
    
    // Keep only last kellyLookback trades
    if (this.tradeHistory.length > this.config.kellyLookback) {
      this.tradeHistory = this.tradeHistory.slice(-this.config.kellyLookback);
    }
    
    log.info(`[DynamicSizer] Recorded trade: ${trade.strategyId}/${trade.symbol}, P&L: ¥${pnl.toFixed(2)} (${(pnlPct * 100).toFixed(2)}%)`);
  }

  getTradeHistory(strategyId?: string): Array<any> {
    if (strategyId) {
      return this.tradeHistory.filter((t) => t.strategyId === strategyId);
    }
    return this.tradeHistory;
  }

  getWinRate(strategyId?: string): number {
    const trades = strategyId ? this.tradeHistory.filter((t) => t.strategyId === strategyId) : this.tradeHistory;
    if (trades.length === 0) return 0.5;
    const wins = trades.filter((t) => t.pnl > 0).length;
    return wins / trades.length;
  }

  // ── Config Management ────────────────────────────────────────────

  updateConfig(updates: Partial<SizingConfig>): void {
    this.config = { ...this.config, ...updates };
    log.info('[DynamicSizer] Config updated:', this.config);
  }

  getConfig(): SizingConfig {
    return { ...this.config };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let sizerInstance: DynamicSizer | null = null;

export function initDynamicSizer(config?: Partial<SizingConfig>): DynamicSizer {
  if (!sizerInstance) {
    sizerInstance = new DynamicSizer(config);
  }
  return sizerInstance;
}

export function getDynamicSizer(): DynamicSizer | null {
  return sizerInstance;
}

export function getKellyFraction(wins: number, losses: number, avgWin: number, avgLoss: number): number {
  const total = wins + losses;
  if (total === 0) return 0.25;
  const winRate = wins / total;
  const avgWinLossRatio = avgLoss > 0 ? avgWin / avgLoss : 1;
  const kelly = winRate - (1 - winRate) / avgWinLossRatio;
  return Math.max(0, Math.min(kelly, 1));
}

export default DynamicSizer;
