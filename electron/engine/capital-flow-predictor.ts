// ── Q62: Capital Flow Predictor ────────────────────────────────────────────────
// Short-term capital flow forecasting based on historical patterns
// Money flow momentum + institutional tracking + ETF flows + Margin data

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CapitalFlowPrediction {
  symbol: string;
  direction: 'INFLOW' | 'OUTFLOW' | 'NEUTRAL';
  confidence: number;          // 0-1

  // Predictions
  predicted1d: number;        // 1-day flow in HKD
  predicted5d: number;        // 5-day cumulative
  predicted20d: number;       // 20-day cumulative

  // Momentum signals
  momentumScore: number;       // -1 to +1
  momentumSignal: 'STRONG_INFLOW' | 'INFLOW' | 'NEUTRAL' | 'OUTFLOW' | 'STRONG_OUTFLOW';

  // Contributing factors
  factors: Array<{
    name: string;
    contribution: number;     // Weight in prediction
    direction: 'POSITIVE' | 'NEGATIVE';
    description: string;
  }>;

  // Support/resistance levels from flow
  supportLevel: number;
  resistanceLevel: number;

  // Forecast confidence bands
  upperBand: number;          // Optimistic (HKD)
  lowerBand: number;          // Pessimistic (HKD)
  timestamp: number;
}

export interface SectorCapitalFlow {
  sector: string;
  flow: number;               // HKD net flow
  momentum: number;            // vs 20-day average
  daysSinceReversal: number;
  signal: 'ACCUMULATION' | 'DISTRIBUTION' | 'STABLE';
}

export interface CapitalFlowReport {
  date: string;
  predictions: CapitalFlowPrediction[];
  sectorFlows: SectorCapitalFlow[];
  marketFlow: {
    totalInflow: number;
    totalOutflow: number;
    netFlow: number;
    momentum: number;
  };
  topInflows: Array<{ symbol: string; flow: number }>;
  topOutflows: Array<{ symbol: string; flow: number }>;
  timestamp: number;
}

// ── Exponential Smoothing ─────────────────────────────────────────────────

function exponentialSmooth(values: number[], alpha = 0.3): number[] {
  const smoothed: number[] = [values[0] ?? 0];
  for (let i = 1; i < values.length; i++) {
    smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
  }
  return smoothed;
}

// ── Capital Flow Predictor ─────────────────────────────────────────────

export class CapitalFlowPredictor {
  constructor() {
    log.info('[CapitalFlowPredictor] Initialized');
  }

  // ── Predict for Symbol ───────────────────────────────────────────────

  predict(
    symbol: string,
    historicalFlows: number[],  // Last 20 days HKD flow (+ = inflow)
    etfFlow: number,           // Today's ETF creation/redemption HKD
    marginBalance: number,      // Current margin balance HKD
    shortSelling: number,       // Short selling HKD
    institutionalActivity: number, // -1 to +1 score
    priceMomentum: number,     // 20d return %
    volumeRatio: number         // Today's vol / avg vol
  ): CapitalFlowPrediction {
    // Smooth historical flows
    const smoothedFlows = exponentialSmooth(historicalFlows.slice(-20), 0.3);
    const avgFlow = smoothedFlows[smoothedFlows.length - 1] ?? 0;

    // 1-day prediction: weighted blend
    const flowMomentum = (historicalFlows[historicalFlows.length - 1] ?? 0) - avgFlow;
    const basePred = avgFlow + flowMomentum * 0.5;

    // Factor weights (must sum to ~1)
    const factors = [
      {
        name: 'Historical Momentum',
        contribution: 0.3,
        direction: basePred >= 0 ? 'POSITIVE' as const : 'NEGATIVE' as const,
        description: `${flowMomentum >= 0 ? 'Inflow' : 'Outflow'} momentum: ${(flowMomentum / 1e6).toFixed(1)}M HKD`,
      },
      {
        name: 'ETF Activity',
        contribution: 0.25,
        direction: etfFlow >= 0 ? 'POSITIVE' as const : 'NEGATIVE' as const,
        description: `ETF ${etfFlow >= 0 ? 'creation (bullish)' : 'redemption (bearish)'}: ${(etfFlow / 1e6).toFixed(1)}M HKD`,
      },
      {
        name: 'Margin Balance Change',
        contribution: 0.2,
        direction: marginBalance >= 0 ? 'POSITIVE' as const : 'NEGATIVE' as const,
        description: `Margin ${marginBalance >= 0 ? 'increasing (bullish leverage)' : 'decreasing (deleveraging)'}`,
      },
      {
        name: 'Short Selling Pressure',
        contribution: 0.15,
        direction: shortSelling >= 0 ? 'NEGATIVE' as const : 'POSITIVE' as const,
        description: `Short selling: ${(shortSelling / 1e6).toFixed(1)}M HKD ${shortSelling > 0 ? '(bearish signal)' : '(covering)'}`,
      },
      {
        name: 'Volume Surge',
        contribution: 0.1,
        direction: volumeRatio > 1.2 ? 'POSITIVE' as const : volumeRatio < 0.8 ? 'NEGATIVE' as const : 'POSITIVE' as const,
        description: `Volume ratio ${volumeRatio.toFixed(2)}x average ${volumeRatio > 1 ? '(increased interest)' : '(decreased activity)'}`,
      },
    ];

    // Weighted sum
    const factorSum = factors.reduce((s, f) =>
      s + f.contribution * (f.direction === 'POSITIVE' ? 1 : -1), 0
    );

    // Price momentum adjustment
    const priceAdjustment = priceMomentum * avgFlow * 0.1;

    const predicted1d = basePred + etfFlow * 0.25 + priceAdjustment;
    const predicted5d = predicted1d * 4.5;
    const predicted20d = predicted1d * 18;

    // Confidence
    const volatility = Math.sqrt(
      historicalFlows.reduce((s, v) => s + (v - avgFlow) ** 2, 0) / historicalFlows.length
    );
    const confidence = Math.max(0.1, Math.min(0.95, 1 - volatility / (Math.abs(avgFlow) + volatility)));

    // Momentum
    const momentumScore = Math.max(-1, Math.min(1,
      (predicted1d - avgFlow) / (Math.abs(avgFlow) + 1e6)
    ));

    // Direction
    let direction: CapitalFlowPrediction['direction'];
    if (predicted1d > avgFlow * 0.5) direction = 'INFLOW';
    else if (predicted1d < avgFlow * 0.5 && predicted1d < 0) direction = 'OUTFLOW';
    else direction = 'NEUTRAL';

    // Momentum signal
    let momentumSignal: CapitalFlowPrediction['momentumSignal'];
    if (momentumScore > 0.6) momentumSignal = 'STRONG_INFLOW';
    else if (momentumScore > 0.2) momentumSignal = 'INFLOW';
    else if (momentumScore < -0.6) momentumSignal = 'STRONG_OUTFLOW';
    else if (momentumScore < -0.2) momentumSignal = 'OUTFLOW';
    else momentumSignal = 'NEUTRAL';

    // Support/resistance from flow
    const supportLevel = avgFlow > 0 ? avgFlow * 0.7 : avgFlow * 1.3;
    const resistanceLevel = avgFlow > 0 ? avgFlow * 1.3 : avgFlow * 0.7;

    return {
      symbol,
      direction,
      confidence: Math.round(confidence * 100) / 100,
      predicted1d: Math.round(predicted1d / 1000) * 1000,
      predicted5d: Math.round(predicted5d / 1000) * 1000,
      predicted20d: Math.round(predicted20d / 1000) * 1000,
      momentumScore: Math.round(momentumScore * 100) / 100,
      momentumSignal,
      factors,
      supportLevel: Math.round(supportLevel / 1000) * 1000,
      resistanceLevel: Math.round(resistanceLevel / 1000) * 1000,
      upperBand: Math.round((predicted1d * 1.5) / 1000) * 1000,
      lowerBand: Math.round((predicted1d * 0.5) / 1000) * 1000,
      timestamp: Date.now(),
    };
  }

  // ── Sector Flows ─────────────────────────────────────────────────────

  analyzeSectorFlows(
    sectorFlows: Array<{ sector: string; flow: number; avgFlow: number }>
  ): SectorCapitalFlow[] {
    return sectorFlows.map(s => {
      const momentum = s.avgFlow !== 0 ? (s.flow - s.avgFlow) / Math.abs(s.avgFlow) : 0;

      let signal: SectorCapitalFlow['signal'];
      if (momentum > 0.3) signal = 'ACCUMULATION';
      else if (momentum < -0.3) signal = 'DISTRIBUTION';
      else signal = 'STABLE';

      // Days since reversal (simplified)
      const daysSinceReversal = Math.round(5 / Math.abs(momentum));

      return {
        sector: s.sector,
        flow: Math.round(s.flow / 1000) * 1000,
        momentum: Math.round(momentum * 100) / 100,
        daysSinceReversal,
        signal,
      };
    });
  }

  // ── Generate Report ──────────────────────────────────────────────────

  generateReport(
    predictions: CapitalFlowPrediction[],
    sectorFlows: SectorCapitalFlow[]
  ): CapitalFlowReport {
    const sorted = [...predictions].sort((a, b) => b.predicted1d - a.predicted1d);

    return {
      date: new Date().toISOString().split('T')[0],
      predictions,
      sectorFlows,
      marketFlow: {
        totalInflow: predictions.filter(p => p.predicted1d > 0).reduce((s, p) => s + p.predicted1d, 0),
        totalOutflow: Math.abs(predictions.filter(p => p.predicted1d < 0).reduce((s, p) => s + p.predicted1d, 0)),
        netFlow: predictions.reduce((s, p) => s + p.predicted1d, 0),
        momentum: predictions.reduce((s, p) => s + p.momentumScore, 0) / Math.max(predictions.length, 1),
      },
      topInflows: sorted.filter(p => p.predicted1d > 0).slice(0, 5).map(p => ({
        symbol: p.symbol,
        flow: p.predicted1d,
      })),
      topOutflows: sorted.filter(p => p.predicted1d < 0).sort((a, b) => a.predicted1d - b.predicted1d).slice(0, 5).map(p => ({
        symbol: p.symbol,
        flow: p.predicted1d,
      })),
      timestamp: Date.now(),
    };
  }
}

export default CapitalFlowPredictor;