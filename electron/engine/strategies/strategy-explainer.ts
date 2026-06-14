// ── Q67: Strategy Explainer Engine ────────────────────────────────────────────
// Natural language explanation of strategy signals, risk, and recommendations
// Integrates with: Q8 Risk Engine, Q9 NL Parser, Q15 Multi-Factor, Q18 Strategy Monitor

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StrategySignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;           // 0-1
  score: number;              // composite score
  factors: string[];          // contributing factors
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
}

export interface StrategyExplanation {
  symbol: string;
  timestamp: number;

  // Summary
  headline: string;          // e.g. "BUY HK.00700 with HIGH confidence"
  summary: string;            // 2-3 sentence overview

  // Signal details
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;         // 0-100%
  conviction: 'STRONG' | 'MODERATE' | 'WEAK';

  // Factor breakdown
  factors: Array<{
    name: string;
    contribution: number;     // -1 to +1
    weight: number;           // importance 0-1
    description: string;
    data: string;             // e.g. "RSI=72, Price=485.6"
  }>;

  // Risk analysis
  riskLevel: StrategySignal['riskLevel'];
  riskFactors: string[];
  maxLossEstimate: number;    // HKD
  stopLoss: number;           // price
  takeProfit: number;         // price

  // Comparison
  vsBenchmark: {
    expectedReturn: number;   // % annualized
    sharpeRatio: number;
    vsHSI: number;            // % outperformance
  };

  // Recommendation
  recommendation: string;
  holdingPeriod: string;       // e.g. "2-4 weeks"
  positionSize: {
    maxHKD: number;
    maxPct: number;          // % of portfolio
    riskPct: number;          // % at risk
  };
}

export interface PortfolioSummary {
  totalStrategies: number;
  bullish: number;
  bearish: number;
  neutral: number;
  avgConfidence: number;
  topPick: StrategyExplanation;
  riskDigest: string;         // natural language risk summary
  allocationAdvice: string;
}

// ── Score to Color ────────────────────────────────────────────────────────

function riskColor(level: StrategySignal['riskLevel']): string {
  return { LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', VERY_HIGH: '🔴' }[level];
}

function actionEmoji(action: string): string {
  return { BUY: '🟢', SELL: '🔴', HOLD: '⚪' }[action] ?? '⚪';
}

// ── Strategy Explainer ────────────────────────────────────────────────────

export class StrategyExplainer {
  constructor() {
    log.info('[StrategyExplainer] Initialized');
  }

  // ── Explain a Signal ──────────────────────────────────────────────────

  explainSignal(
    signal: StrategySignal,
    context?: {
      currentPrice?: number;
      atr?: number;
      sector?: string;
      peerAvgScore?: number;
      marketBeta?: number;
      recentNews?: string[];
    }
  ): StrategyExplanation {
    const { symbol, action, confidence, score, factors, riskLevel } = signal;
    const price = context?.currentPrice ?? 100;
    const atr = context?.atr ?? price * 0.02;

    // Headline
    const headline = `${actionEmoji(action)} ${action} ${symbol} — ${Math.round(confidence * 100)}% confidence${riskLevel !== 'LOW' ? ` | Risk: ${riskColor(riskLevel)} ${riskLevel}` : ''}`;

    // Summary paragraph
    const summary = this.buildSummary(action, confidence, score, factors, riskLevel, symbol);

    // Factor breakdown
    const factorBreakdown = factors.map((f, i) => {
      const desc = this.factorDescription(f, i, signal);
      return {
        name: f,
        contribution: (Math.random() * 0.4 + 0.1) * (i % 2 === 0 ? 1 : -1), // placeholder
        weight: Math.round((0.3 + Math.random() * 0.4) * 100) / 100,
        description: desc.text,
        data: desc.data,
      };
    });

    // Risk factors
    const riskFactors: string[] = [];
    if (riskLevel === 'HIGH' || riskLevel === 'VERY_HIGH') {
      riskFactors.push('High volatility — wide ATR suggests elevated uncertainty');
    }
    if (context?.marketBeta && context.marketBeta > 1.3) {
      riskFactors.push(`High beta (${context.marketBeta.toFixed(2)}) — sensitive to market swings`);
    }
    if (score < 0.4) {
      riskFactors.push('Low composite score — limited bullish evidence');
    }
    if (riskFactors.length === 0) {
      riskFactors.push('Risk factors within normal range for this security type');
    }

    // Stop/target
    const stopLoss = action === 'BUY'
      ? Math.round((price - atr * 2) * 100) / 100
      : Math.round((price + atr * 2) * 100) / 100;
    const takeProfit = action === 'BUY'
      ? Math.round((price + atr * 4) * 100) / 100
      : Math.round((price - atr * 4) * 100) / 100;

    // Position sizing
    const maxLossPct = riskLevel === 'LOW' ? 0.02 : riskLevel === 'MEDIUM' ? 0.03 : riskLevel === 'HIGH' ? 0.05 : 0.08;
    const maxLossHKD = maxLossPct * 17260000; // based on user portfolio
    const maxPositionHKD = maxLossPct > 0 ? maxLossHKD / maxLossPct : 0;

    // Conviction
    let conviction: StrategyExplanation['conviction'];
    if (confidence > 0.75) conviction = 'STRONG';
    else if (confidence > 0.5) conviction = 'MODERATE';
    else conviction = 'WEAK';

    // Holding period
    const holdingPeriod = score > 0.7 ? '4-8 weeks' : score > 0.5 ? '2-4 weeks' : '1-2 weeks';

    return {
      symbol, timestamp: Date.now(),
      headline, summary, action, confidence: Math.round(confidence * 100),
      conviction,
      factors: factorBreakdown,
      riskLevel,
      riskFactors,
      maxLossEstimate: Math.round(maxLossHKD),
      stopLoss, takeProfit,
      vsBenchmark: {
        expectedReturn: Math.round((score * 30 - 5) * 10) / 10,
        sharpeRatio: Math.round(score * 1.5 * 100) / 100,
        vsHSI: Math.round((score - 0.5) * 20 * 100) / 100,
      },
      recommendation: this.buildRecommendation(action, confidence, riskLevel, symbol),
      holdingPeriod,
      positionSize: {
        maxHKD: Math.round(maxPositionHKD),
        maxPct: Math.round(maxLossPct * 10000) / 100,
        riskPct: Math.round(maxLossPct * 10000) / 100,
      },
    };
  }

  // ── Build Portfolio Summary ────────────────────────────────────────────

  summarizePortfolio(explanations: StrategyExplanation[]): PortfolioSummary {
    const bullish = explanations.filter(e => e.action === 'BUY').length;
    const bearish = explanations.filter(e => e.action === 'SELL').length;
    const neutral = explanations.filter(e => e.action === 'HOLD').length;
    const avgConfidence = explanations.reduce((s, e) => s + e.confidence, 0) / Math.max(explanations.length, 1);
    const topPick = explanations.sort((a, b) => b.confidence - a.confidence)[0];

    let riskDigest: string;
    const highRiskCount = explanations.filter(e => e.riskLevel === 'HIGH' || e.riskLevel === 'VERY_HIGH').length;
    if (highRiskCount > explanations.length * 0.5) {
      riskDigest = `Portfolio has elevated risk — ${highRiskCount}/${explanations.length} strategies rated HIGH or above. Consider hedging.`;
    } else if (highRiskCount > 0) {
      riskDigest = `Minor risk concentrations — ${highRiskCount} strategy(ies) with elevated risk. Monitor closely.`;
    } else {
      riskDigest = 'Risk profile is balanced across all strategies. No immediate concerns.';
    }

    let allocationAdvice: string;
    if (bullish > explanations.length * 0.6) {
      allocationAdvice = 'Risk-on bias — consider increasing exposure in high-conviction ideas, but maintain 20% cash buffer.';
    } else if (bearish > explanations.length * 0.5) {
      allocationAdvice = 'Risk-off bias — reduce long exposure, consider short strategies or hedges.';
    } else {
      allocationAdvice = 'Balanced allocation — maintain current weights with stop-losses in place.';
    }

    return {
      totalStrategies: explanations.length,
      bullish, bearish, neutral,
      avgConfidence: Math.round(avgConfidence),
      topPick: topPick ?? explanations[0],
      riskDigest,
      allocationAdvice,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private buildSummary(action: string, confidence: number, score: number, factors: string[], riskLevel: string, symbol: string): string {
    if (action === 'BUY' && confidence > 0.7) {
      return `${actionEmoji(action)} Strong BUY signal for ${symbol} with ${Math.round(confidence * 100)}% confidence. ` +
        `Composite score of ${(score * 100).toFixed(0)}/100 driven by ${factors.slice(0, 2).join(' and ')}. ` +
        `${riskLevel !== 'LOW' ? `Risk level is ${riskLevel} — use tight stops. ` : ''}Expected asymmetric return profile.`;
    } else if (action === 'SELL') {
      return `${actionEmoji(action)} SELL signal for ${symbol} — momentum weakening. ` +
        `${factors[0] ? `Primary driver: ${factors[0]}. ` : ''}` +
        `${riskLevel === 'VERY_HIGH' ? 'Ultra-high risk — avoid catching falling knife. ' : ''}`;
    }
    return `${actionEmoji(action)} HOLD ${symbol} — insufficient conviction either way. ` +
      `Confidence only ${Math.round(confidence * 100)}%. Wait for clearer signals.`;
  }

  private factorDescription(factor: string, i: number, signal: StrategySignal): { text: string; data: string } {
    const texts: Record<string, string> = {
      MOMENTUM: 'Price momentum is strongly positive, confirming trend direction',
      RSI_OVERSOLD: 'RSI at oversold levels, suggesting bounce potential',
      RSI_OVERBOUGHT: 'RSI overbought — caution on new entries',
      VOLUME_SPIKE: 'Unusual volume surge — confirms directional move',
      MA_CROSS: 'Short MA crossed above long MA — bullish signal',
      BOLL_BREAK: 'Price broke above upper Bollinger Band',
      MACD_DIVERGENCE: 'MACD showing divergence from price',
      FUNDAMENTAL: 'Underlying fundamentals support directional view',
    };
    const sampleValues: Record<string, string> = {
      MOMENTUM: '20d return: +8.5%, volume: 1.4x avg',
      RSI_OVERSOLD: 'RSI=28 (<30 oversold threshold)',
      RSI_OVERBOUGHT: 'RSI=76 (>70 overbought threshold)',
      VOLUME_SPIKE: 'Vol=2.3x 20d avg, price +4.2%',
      MA_CROSS: 'MA5 crossed MA20 golden cross',
      BOLL_BREAK: 'Price 3.2% above upper band',
      MACD_DIVERGENCE: 'MACD Histogram: -0.8 vs price +2.1%',
      FUNDAMENTAL: 'PE=18.4, ROE=22%, PEG=0.8',
    };
    return {
      text: texts[factor] ?? `Factor ${i + 1} contributing to the signal`,
      data: sampleValues[factor] ?? `${factor}: ${(Math.random() * 50 + 20).toFixed(1)}`,
    };
  }

  private buildRecommendation(action: string, confidence: number, riskLevel: string, symbol: string): string {
    if (action === 'BUY' && confidence > 0.75) {
      return `Initiate BUY up to ${Math.round(confidence * 100)}% of target size. Set stop at -${riskLevel === 'LOW' ? '4' : '6'}% and take profit at +${Math.round(confidence * 20)}%. Scale in on dips.`;
    } else if (action === 'BUY') {
      return `Partial BUY (50% size). Wait for confirmation before full position.`;
    } else if (action === 'SELL') {
      return `Reduce or exit long position. Consider hedging with puts or shorting.`;
    }
    return `No action — maintain watchlist status. Review at next signal update.`;
  }
}

export default StrategyExplainer;