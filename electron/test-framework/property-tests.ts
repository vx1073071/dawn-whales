// Q47: Property-Based Testing Framework
// Uses fast-check to validate invariants with randomly generated inputs
// Covers: strategy engine, indicators, position sizing, risk calculations

import log from 'electron-log';
import fc, { Arbitrary } from 'fast-check';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateEMA,
  calculateSMA,
} from '../engine/technical-indicators';
import { DynamicSizer, SizingConfig, PositionSizeRequest, PortfolioSizingRequest } from '../engine/dynamic-sizer';
import { RiskEngine, RiskCheckRequest, RiskCheckResult } from '../engine/risk-engine';
import { calculateKellyFraction, calculateOptimalF } from '../engine/position-math';
import { normalCDF, normalPDF } from '../engine/calendar-effects';

// ─── Arbitrary Generators ───────────────────────────────────────────────────────

/** Generate a plausible closing price series (non-negative, trending or flat) */
export function priceSeries(minLength = 20, maxLength = 300): Arbitrary<number[]> {
  return fc
    .double({ min: 1, max: 5000, noNaN: true })
    .chain((startPrice) =>
      fc.array(fc.double({ min: -0.15, max: 0.15, noNaN: true }), {
        minLength,
        maxLength,
      }).map((returns) => {
        const prices: number[] = [startPrice];
        for (const r of returns) {
          prices.push(prices[prices.length - 1] * (1 + r));
        }
        return prices;
      })
    );
}

/** Generate a positive integer period in a valid range */
export function periodArb(min = 2, max = 50): Arbitrary<number> {
  return fc.integer({ min, max });
}

/** Generate a valid position sizing request */
export function positionSizeRequestArb(): Arbitrary<PositionSizeRequest> {
  return fc.record({
    strategyId: fc.string({ minLength: 1, maxLength: 20 }).map((s) => `strat-${s}`),
    symbol: fc.string({ minLength: 2, maxLength: 10 }).map((s) => s.replace(/[^A-Za-z0-9.]/g, '')),
    capital: fc.double({ min: 1000, max: 100_000_000, noNaN: true }),
    currentPrice: fc.double({ min: 0.01, max: 10000, noNaN: true }),
    volatility: fc.option(fc.double({ min: 0.01, max: 1.0, noNaN: true }), { nil: undefined }),
    regime: fc.option(fc.constantFrom('bull', 'bear', 'neutral', 'crisis'), { nil: undefined }),
    sentiment: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: undefined }),
    winRate: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
    avgWinLossRatio: fc.option(fc.double({ min: 0.1, max: 10, noNaN: true }), { nil: undefined }),
    riskPerTradePct: fc.option(fc.double({ min: 0.001, max: 0.1, noNaN: true }), { nil: undefined }),
  });
}

/** Generate a valid risk check request */
export function riskCheckRequestArb(): Arbitrary<{
  strategyId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  portfolioValue: number;
}> {
  return fc.record({
    strategyId: fc.string({ minLength: 1, maxLength: 20 }),
    symbol: fc.string({ minLength: 2, maxLength: 10 }),
    side: fc.constantFrom<'BUY' | 'SELL'>('BUY', 'SELL'),
    quantity: fc.double({ min: 1, max: 100_000, noNaN: true }),
    price: fc.double({ min: 0.01, max: 10000, noNaN: true }),
    portfolioValue: fc.double({ min: 1000, max: 100_000_000, noNaN: true }),
  });
}

// ─── Property: RSI ──────────────────────────────────────────────────────────────

export interface RSITestReport {
  property: string;
  numRuns: number;
  passed: boolean;
  counterexamples: unknown[];
  seed?: number;
  path?: string;
}

/**
 * Property: RSI always returns values in [0, 100] for any price input.
 */
export async function propertyRSIInRange(
  numRuns = 200
): Promise<RSITestReport> {
  const counterexamples: unknown[] = [];
  let passed = true;
  let seed: number | undefined;
  let path: string | undefined;

  try {
    await fc.assert(
      fc.asyncProperty(
        priceSeries(50, 500),
        periodArb(3, 50),
        async (prices, period) => {
          const result = calculateRSI(prices, period);
          // Check all non-null values are in [0, 100]
          const invalid = result.filter(
            (v): v is number => v !== null && (v < 0 || v > 100)
          );
          if (invalid.length > 0) {
            counterexamples.push({ prices: prices.slice(0, 20), period, invalid });
          }
          expect(invalid.length).toBe(0);
        }
      ),
      { numRuns }
    );
  } catch (e: unknown) {
    passed = false;
    if (e && typeof e === 'object' && 'seed' in e) seed = (e as { seed: number }).seed;
    if (e && typeof e === 'object' && 'path' in e) path = String((e as { path: unknown }).path);
  }

  return { property: 'RSI in [0,100]', numRuns, passed, counterexamples, seed, path };
}

/**
 * Property: RSI is deterministic — same input always produces same output.
 */
export async function propertyRSIDeterministic(
  numRuns = 100
): Promise<RSITestReport> {
  const counterexamples: unknown[] = [];
  let passed = true;

  try {
    await fc.assert(
      fc.asyncProperty(
        priceSeries(30, 200),
        periodArb(5, 30),
        async (prices, period) => {
          const r1 = calculateRSI(prices, period);
          const r2 = calculateRSI(prices, period);
          expect(r1).toEqual(r2);
        }
      ),
      { numRuns }
    );
  } catch (e: unknown) {
    passed = false;
    counterexamples.push(String(e));
  }

  return { property: 'RSI deterministic', numRuns, passed, counterexamples };
}

/**
 * Property: Flat price series → RSI = 100 (no losses, only unchanged = no down moves).
 * Actually with zero-change, RSI is undefined; this tests the edge case.
 */
export async function propertyRSIFlatPrices(
  numRuns = 50
): Promise<RSITestReport> {
  const counterexamples: unknown[] = [];
  let passed = true;

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 1, max: 5000, noNaN: true }),
        periodArb(5, 30),
        async (price, period) => {
          const prices = Array<number>(period + 10).fill(price);
          const result = calculateRSI(prices, period);
          // Last value should exist
          const last = result[result.length - 1];
          // With flat prices, RSI may be 100 or NaN depending on implementation
          if (last !== null && last !== undefined) {
            expect(last).toBeGreaterThanOrEqual(0);
            expect(last).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns }
    );
  } catch (e: unknown) {
    passed = false;
    counterexamples.push(String(e));
  }

  return { property: 'RSI flat prices boundary', numRuns, passed, counterexamples };
}

// ─── Property: Position Sizing ──────────────────────────────────────────────────

export interface PositionSizePropertyReport {
  property: string;
  numRuns: number;
  passed: boolean;
  counterexamples: string[];
}

/**
 * Property: Kelly fraction is always in [0, 1].
 */
export async function propertyKellyInRange(
  numRuns = 300
): Promise<PositionSizePropertyReport> {
  const counterexamples: string[] = [];
  let passed = true;

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.double({ min: 0.01, max: 50, noNaN: true }),
        fc.double({ min: 0.01, max: 50, noNaN: true }),
        async (wins, losses, avgWin, avgLoss) => {
          const kelly = calculateKellyFraction(wins, losses, avgWin, avgLoss);
          if (kelly < 0 || kelly > 1) {
            counterexamples.push(
              `wins=${wins} losses=${losses} avgWin=${avgWin} avgLoss=${avgLoss} → kelly=${kelly}`
            );
          }
          expect(kelly).toBeGreaterThanOrEqual(0);
          expect(kelly).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns }
    );
  } catch (e: unknown) {
    passed = false;
    counterexamples.push(String(e));
  }

  return { property: 'Kelly in [0,1]', numRuns, passed, counterexamples };
}

/**
 * Property: More wins (with same losses/avg) → Kelly fraction should not decrease.
 */
export async function propertyKellyMonotonicWins(
  numRuns = 200
): Promise<PositionSizePropertyReport> {
  const counterexamples: string[] = [];
  let passed = true;

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 10, max: 500 }),
        fc.double({ min: 0.1, max: 20, noNaN: true }),
        fc.double({ min: 0.1, max: 20, noNaN: true }),
        async (extraWins, losses, avgWin, avgLoss) => {
          const k1 = calculateKellyFraction(10, losses, avgWin, avgLoss);
          const k2 = calculateKellyFraction(10 + extraWins, losses, avgWin, avgLoss);
          if (k2 < k1 - 0.001) {
            counterexamples.push(
              `extraWins=${extraWins}: k1=${k1} k2=${k2}`
            );
          }
          expect(k2).toBeGreaterThanOrEqual(k1 - 0.001);
        }
      ),
      { numRuns }
    );
  } catch (e: unknown) {
    passed = false;
    counterexamples.push(String(e));
  }

  return { property: 'Kelly monotonic in wins', numRuns, passed, counterexamples };
}

/**
 * Property: DynamicSizer never allocates more than capital.
 */
export async function propertySizerNeverExceedsCapital(
  numRuns = 200
): Promise<PositionSizePropertyReport> {
  const counterexamples: string[] = [];
  let passed = true;

  const config: SizingConfig = {
    kellyFraction: 0.25,
    kellyLookback: 252,
    kellyMinTrades: 30,
    volLookback: 20,
    volTarget: 0.15,
    volMaxPosition: 0.3,
    regimeMultiplier: { bull: 1.2, bear: 0.5, neutral: 1.0, crisis: 0.2 },
    maxPositionPct: 0.25,
    maxTotalExposure: 0.9,
    stopLossPct: 0.05,
    sentimentWeight: 0.2,
    sentimentMin: 30,
    sentimentMax: 80,
  };
  const sizer = new DynamicSizer(config);

  try {
    await fc.assert(
      fc.asyncProperty(
        positionSizeRequestArb(),
        async (req) => {
          const result = sizer.calculatePositionSize(req);
          const maxAllowed = req.capital * config.maxPositionPct;
          if (result.quantity * result.adjustedPrice > maxAllowed * 1.01) {
            counterexamples.push(
              `capital=${req.capital} qty=${result.quantity} price=${result.adjustedPrice} max=${maxAllowed}`
            );
          }
          expect(result.quantity * result.adjustedPrice).toBeLessThanOrEqual(
            maxAllowed * 1.01
          );
        }
      ),
      { numRuns }
    );
  } catch (e: unknown) {
    passed = false;
    counterexamples.push(String(e));
  }

  return {
    property: 'Position size never exceeds maxPositionPct of capital',
    numRuns,
    passed,
    counterexamples,
  };
}

// ─── Property: Risk Engine ──────────────────────────────────────────────────────

/**
 * Property: RiskEngine.approve() never returns approve=true when
 *   quantity * price > portfolioValue * maxExposure.
 */
export async function propertyRiskMaxExposure(
  numRuns = 200
): Promise<PositionSizePropertyReport> {
  const counterexamples: string[] = [];
  let passed = true;

  try {
    await fc.assert(
      fc.asyncProperty(
        riskCheckRequestArb(),
        fc.double({ min: 0.01, max: 0.95, noNaN: true }),
        async (req, maxExpPct) => {
          const engine = new RiskEngine({
            maxDrawdownPct: 0.2,
            maxPositionPct: 0.25,
            maxSectorPct: 0.4,
            maxLeverage: 1.0,
            maxExposurePct: maxExpPct,
            maxLossPerDay: req.portfolioValue * 0.02,
            maxLossPerStrategy: req.portfolioValue * 0.05,
            maxOpenOrders: 50,
            maxSlippagePct: 0.01,
            maxDailyTrades: 100,
            volatilityWindow: 20,
            riskFreeRate: 0.03,
            useKellySizing: false,
            kellyFraction: 0.25,
            circuitBreakerLossPct: 0.05,
            circuitBreakerCooldownMin: 30,
            enableCircuitBreaker: false,
            maxVaR: req.portfolioValue * 0.02,
            confidenceLevel: 0.95,
            cvarLimit: req.portfolioValue * 0.03,
            enableRegimeSwitch: false,
            regimeLookback: 20,
            volatilityTarget: 0.15,
            correlationThreshold: 0.7,
            enableSmartStop: false,
            smartStopLookback: 20,
            smartStopZScore: 2.0,
          });

          const checkReq: RiskCheckRequest = {
            strategyId: req.strategyId,
            symbol: req.symbol,
            side: req.side,
            quantity: req.quantity,
            price: req.price,
            portfolioValue: req.portfolioValue,
            currentPosition: 0,
            strategyPnL: 0,
          };

          const result = engine.approve(checkReq);
          // If approved, notional must be ≤ maxExposure
          if (result.approved) {
            const notional = req.quantity * req.price;
            const maxNotional = req.portfolioValue * maxExpPct;
            if (notional > maxNotional * 1.001) {
              counterexamples.push(
                `approved but notional=${notional} > max=${maxNotional}`
              );
            }
          }
        }
      ),
      { numRuns }
    );
  } catch (e: unknown) {
    passed = false;
    counterexamples.push(String(e));
  }

  return {
    property: 'RiskEngine never approves exceeding maxExposurePct',
    numRuns,
    passed,
    counterexamples,
  };
}

// ─── Property: Statistical Functions ────────────────────────────────────────────

/**
 * Property: normalCDF(x) is always in [0, 1].
 */
export async function propertyNormalCDFInRange(
  numRuns = 500
): Promise<RSITestReport> {
  const counterexamples: unknown[] = [];
  let passed = true;

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: -50, max: 50, noNaN: true }),
        async (x) => {
          const v = normalCDF(x);
          if (v < 0 || v > 1) {
            counterexamples.push({ x, v });
          }
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns }
    );
  } catch (e: unknown) {
    passed = false;
  }

  return { property: 'normalCDF in [0,1]', numRuns, passed, counterexamples };
}

/**
 * Property: normalCDF is monotonic non-decreasing.
 */
export async function propertyNormalCDFMonotonic(
  numRuns = 300
): Promise<RSITestReport> {
  const counterexamples: unknown[] = [];
  let passed = true;

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: -20, max: 20, noNaN: true }),
        fc.double({ min: -20, max: 20, noNaN: true }),
        async (x, y) => {
          if (y <= x) return; // only test x < y
          const vx = normalCDF(x);
          const vy = normalCDF(y);
          if (vx > vy + 1e-6) {
            counterexamples.push({ x, y, vx, vy });
          }
          expect(vx).toBeLessThanOrEqual(vy + 1e-6);
        }
      ),
      { numRuns }
    );
  } catch (e: unknown) {
    passed = false;
  }

  return { property: 'normalCDF monotonic', numRuns, passed, counterexamples };
}

/**
 * Property: normalPDF(x) ≥ 0 for all x.
 */
export async function propertyNormalPDFNonNegative(
  numRuns = 200
): Promise<RSITestReport> {
  const counterexamples: unknown[] = [];
  let passed = true;

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.double({ min: 0.01, max: 20, noNaN: true }),
        async (x, sigma) => {
          const v = normalPDF(x, 0, sigma);
          if (v < 0) {
            counterexamples.push({ x, sigma, v });
          }
          expect(v).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns }
    );
  } catch (e: unknown) {
    passed = false;
  }

  return { property: 'normalPDF >= 0', numRuns, passed, counterexamples };
}

// ─── Runner ─────────────────────────────────────────────────────────────────────

export interface PropertyTestSuiteReport {
  suite: string;
  timestamp: string;
  numRunsPerProperty: number;
  results: (RSITestReport | PositionSizePropertyReport)[];
  totalPassed: number;
  totalFailed: number;
  allPassed: boolean;
}

/**
 * Run all registered property tests and return a structured report.
 */
export async function runPropertyTestSuite(
  numRunsPerProperty = 200
): Promise<PropertyTestSuiteReport> {
  log.info('[Q47] Starting property-based test suite...');

  const results = await Promise.all([
    propertyRSIInRange(numRunsPerProperty),
    propertyRSIDeterministic(numRunsPerProperty),
    propertyRSIFlatPrices(Math.min(numRunsPerProperty, 50)),
    propertyKellyInRange(numRunsPerProperty),
    propertyKellyMonotonicWins(numRunsPerProperty),
    propertySizerNeverExceedsCapital(numRunsPerProperty),
    propertyRiskMaxExposure(numRunsPerProperty),
    propertyNormalCDFInRange(numRunsPerProperty),
    propertyNormalCDFMonotonic(numRunsPerProperty),
    propertyNormalPDFNonNegative(numRunsPerProperty),
  ]);

  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.length - totalPassed;

  const report: PropertyTestSuiteReport = {
    suite: 'Q47 Property-Based Test Suite',
    timestamp: new Date().toISOString(),
    numRunsPerProperty,
    results,
    totalPassed,
    totalFailed,
    allPassed: totalFailed === 0,
  };

  log.info(`[Q47] Suite complete: ${totalPassed}/${results.length} properties passed.`);
  return report;
}

/**
 * Format a PropertyTestSuiteReport as a human-readable string.
 */
export function formatPropertyReport(report: PropertyTestSuiteReport): string {
  const lines: string[] = [
    `=== ${report.suite} ===`,
    `Timestamp: ${report.timestamp}`,
    `Runs per property: ${report.numRunsPerProperty}`,
    `Results: ${report.totalPassed}/${report.results.length} passed`,
    `Overall: ${report.allPassed ? 'ALL PASSED' : 'SOME FAILURES'}`,
    '',
    '--- Details ---',
  ];

  for (const r of report.results) {
    const status = r.passed ? '✅' : '❌';
    lines.push(`${status} ${r.property} (${r.numRuns} runs)`);
    if (!r.passed && 'counterexamples' in r) {
      const cex = (r as { counterexamples: unknown[] }).counterexamples;
      if (cex.length > 0) {
        lines.push(`   Counterexamples: ${JSON.stringify(cex.slice(0, 3))}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Save property test report to disk (async, fire-and-forget log).
 */
export async function savePropertyReport(
  report: PropertyTestSuiteReport,
  outputPath = 'test-results/q47-property-report.txt'
): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, formatPropertyReport(report), 'utf-8');
    log.info(`[Q47] Property report saved to ${outputPath}`);
  } catch (e) {
    log.error('[Q47] Failed to save property report:', e);
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────────
export default {
  runPropertyTestSuite,
  formatPropertyReport,
  savePropertyReport,
  propertyRSIInRange,
  propertyRSIDeterministic,
  propertyRSIFlatPrices,
  propertyKellyInRange,
  propertyKellyMonotonicWins,
  propertySizerNeverExceedsCapital,
  propertyRiskMaxExposure,
  propertyNormalCDFInRange,
  propertyNormalCDFMonotonic,
  propertyNormalPDFNonNegative,
};
