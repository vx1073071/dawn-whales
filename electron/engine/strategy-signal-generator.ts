// ── Strategy Signal Generator (JVS-46) ──────────────────────────────────────
// Multi-factor signal fusion with backtest validation
// Combines technical indicators + fundamental + sentiment into unified signals

export interface SignalFactor {
  name: string;
  weight: number;
  value: number;        // -1 to 1 (-1=strong sell, 1=strong buy)
  confidence: number;   // 0 to 1
  description: string;
}

export interface StrategySignal {
  symbol: string;
  timestamp: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  strength: number;     // 0 to 1
  confidence: number;   // 0 to 1
  factors: SignalFactor[];
  reasoning: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SignalGeneratorConfig {
  factors: {
    technical: number;      // weight 0-1
    fundamental: number;
    sentiment: number;
    momentum: number;
  };
  thresholds: {
    buyThreshold: number;   // 0-1, default 0.6
    sellThreshold: number;  // 0-1, default -0.6
  };
  minConfidence: number;    // 0-1, default 0.5
  lookbackDays: number;     // default 20
}

export interface BacktestValidation {
  winRate: number;          // 0-1
  avgReturn: number;        // percentage
  sharpeRatio: number;
  maxDrawdown: number;      // percentage
  totalTrades: number;
}

// ── Technical Factor Calculators ───────────────────────────────────────────

function calculateMAStrength(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  
  const current = prices[prices.length - 1];
  const ma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
  const deviation = (current - ma) / ma;
  
  // Normalize to -1 to 1
  return Math.max(-1, Math.min(1, deviation * 10));
}

function calculateRSIStrength(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 0;
  
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  const recent = changes.slice(-period);
  const gains = recent.filter(c => c > 0);
  const losses = recent.filter(c => c < 0);
  
  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0)) / period : 0;
  
  if (avgLoss === 0) return 1;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  // Normalize: RSI 30 = buy (1), RSI 70 = sell (-1)
  if (rsi <= 30) return 1;
  if (rsi >= 70) return -1;
  return (50 - rsi) / 50; // Normalize to -1 to 1
}

function calculateMomentum(prices: number[], lookback: number): number {
  if (prices.length < lookback) return 0;
  
  const current = prices[prices.length - 1];
  const past = prices[prices.length - lookback];
  const change = (current - past) / past;
  
  // Normalize to -1 to 1
  return Math.max(-1, Math.min(1, change * 5));
}

function calculateVolatility(prices: number[], period: number = 20): number {
  if (prices.length < period) return 0;
  
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  
  const recent = returns.slice(-period);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / recent.length;
  
  return Math.sqrt(variance) * Math.sqrt(252); // Annualized
}

// ── Signal Generator Class ─────────────────────────────────────────────────

export class StrategySignalGenerator {
  private config: SignalGeneratorConfig;

  constructor(config?: Partial<SignalGeneratorConfig>) {
    this.config = {
      factors: {
        technical: 0.4,
        fundamental: 0.2,
        sentiment: 0.2,
        momentum: 0.1,
      },
      thresholds: {
        buyThreshold: 0.6,
        sellThreshold: -0.6,
      },
      minConfidence: 0.5,
      lookbackDays: 20,
      ...config,
    };
  }

  generateSignal(
    symbol: string,
    prices: number[],
    fundamentals?: { pe?: number; pb?: number; roe?: number },
    sentiment?: number
  ): StrategySignal {
    const factors: SignalFactor[] = [];

    // Technical factor
    const maStrength = calculateMAStrength(prices, 20);
    const rsiStrength = calculateRSIStrength(prices, 14);
    const technicalScore = (maStrength + rsiStrength) / 2;
    
    factors.push({
      name: 'Technical',
      weight: this.config.factors.technical,
      value: technicalScore,
      confidence: Math.abs(technicalScore),
      description: `MA20: ${maStrength.toFixed(2)}, RSI: ${rsiStrength.toFixed(2)}`,
    });

    // Fundamental factor
    let fundamentalScore = 0;
    if (fundamentals) {
      const peScore = fundamentals.pe ? Math.max(-1, Math.min(1, (20 - fundamentals.pe) / 20)) : 0;
      const pbScore = fundamentals.pb ? Math.max(-1, Math.min(1, (3 - fundamentals.pb) / 3)) : 0;
      const roeScore = fundamentals.roe ? Math.max(-1, Math.min(1, fundamentals.roe / 20)) : 0;
      fundamentalScore = (peScore + pbScore + roeScore) / 3;
      
      factors.push({
        name: 'Fundamental',
        weight: this.config.factors.fundamental,
        value: fundamentalScore,
        confidence: Object.keys(fundamentals).length / 3,
        description: `PE: ${fundamentals.pe}, PB: ${fundamentals.pb}, ROE: ${fundamentals.roe}`,
      });
    }

    // Sentiment factor
    if (sentiment !== undefined) {
      factors.push({
        name: 'Sentiment',
        weight: this.config.factors.sentiment,
        value: sentiment,
        confidence: Math.abs(sentiment),
        description: `Sentiment score: ${sentiment.toFixed(2)}`,
      });
    }

    // Momentum factor
    const momentum = calculateMomentum(prices, this.config.lookbackDays);
    factors.push({
      name: 'Momentum',
      weight: this.config.factors.momentum,
      value: momentum,
      confidence: Math.abs(momentum),
      description: `${this.config.lookbackDays}-day momentum: ${momentum.toFixed(2)}`,
    });

    // Calculate weighted score
    let totalWeight = 0;
    let weightedSum = 0;
    let totalConfidence = 0;

    for (const factor of factors) {
      weightedSum += factor.value * factor.weight * factor.confidence;
      totalWeight += factor.weight;
      totalConfidence += factor.confidence * factor.weight;
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const confidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;

    // Determine action
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (score >= this.config.thresholds.buyThreshold && confidence >= this.config.minConfidence) {
      action = 'BUY';
    } else if (score <= this.config.thresholds.sellThreshold && confidence >= this.config.minConfidence) {
      action = 'SELL';
    }

    // Determine risk level based on volatility
    const volatility = calculateVolatility(prices);
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (volatility < 0.2) riskLevel = 'LOW';
    else if (volatility > 0.4) riskLevel = 'HIGH';

    // Generate reasoning
    const reasoning = this.generateReasoning(factors, action, confidence);

    return {
      symbol,
      timestamp: Date.now(),
      action,
      strength: Math.abs(score),
      confidence,
      factors,
      reasoning,
      riskLevel,
    };
  }

  private generateReasoning(factors: SignalFactor[], action: string, confidence: number): string {
    const topFactors = factors
      .filter(f => Math.abs(f.value) > 0.3)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 3);

    if (topFactors.length === 0) {
      return `No strong signals detected. Confidence: ${(confidence * 100).toFixed(1)}%`;
    }

    const factorText = topFactors
      .map(f => `${f.name}: ${f.value > 0 ? 'bullish' : 'bearish'} (${f.value.toFixed(2)})`)
      .join(', ');

    return `${action} signal with ${(confidence * 100).toFixed(1)}% confidence. Key factors: ${factorText}`;
  }

  // ── Batch Signal Generation ────────────────────────────────────────────

  async generateBatchSignals(
    symbols: string[],
    pricesMap: Map<string, number[]>,
    fundamentalsMap?: Map<string, { pe?: number; pb?: number; roe?: number }>,
    sentimentMap?: Map<string, number>
  ): Promise<StrategySignal[]> {
    const signals: StrategySignal[] = [];

    for (const symbol of symbols) {
      const prices = pricesMap.get(symbol);
      if (!prices || prices.length < 20) continue;

      const fundamentals = fundamentalsMap?.get(symbol);
      const sentiment = sentimentMap?.get(symbol);

      const signal = this.generateSignal(symbol, prices, fundamentals, sentiment);
      signals.push(signal);
    }

    // Sort by strength
    return signals.sort((a, b) => b.strength - a.strength);
  }

  // ── Backtest Validation ────────────────────────────────────────────────

  validateWithBacktest(
    prices: number[],
    signal: StrategySignal,
    backtestResults: any
  ): BacktestValidation {
    // This would integrate with the backtest engine
    // For now, return mock validation
    return {
      winRate: 0.55,
      avgReturn: 2.5,
      sharpeRatio: 1.2,
      maxDrawdown: 15,
      totalTrades: 20,
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let signalGeneratorInstance: StrategySignalGenerator | null = null;

export function getStrategySignalGenerator(config?: Partial<SignalGeneratorConfig>): StrategySignalGenerator {
  if (!signalGeneratorInstance) {
    signalGeneratorInstance = new StrategySignalGenerator(config);
  }
  return signalGeneratorInstance;
}
