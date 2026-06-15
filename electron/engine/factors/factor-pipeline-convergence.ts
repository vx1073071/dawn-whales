// ── R177: Pipeline Convergence Validation ───────────────────────────────────
// End-to-end verification of the three core pipelines:
//   D3: Factor Backtest Pipeline (backtest-engine.ts)
//   D4: Signal Pipeline (factor-signal-pipeline.ts)
//   D5: Trade Pipeline (factor-trade-pipeline.ts)
//
// Validates: end-to-end flow, edge cases, boundary conditions, error handling.
//
// Test sequence:
//   1. D3→D4: Backtest result → signal emission
//   2. D4→D5: Signal → strategy → position sizing → order execution
//   3. D3→D4→D5: Full pipeline convergence
//   4. Edge cases: empty input, single factor, zero weight, invalid dates

import log from 'electron-log';
import { runFactorBacktest, type FactorBacktestRequest } from '../backtest/backtest-engine';
import { getFactorSignalPipeline, type FactorAnalysisInput } from '../factors/factor-signal-pipeline';
import { getFactorTradePipeline, FactorTradePipeline } from '../factors/factor-trade-pipeline';
import { PositionSizer, FeeCalculator, OrderExecutor } from '../factors/factor-trade-pipeline';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ConvergenceTestResult {
  testName: string;
  passed: boolean;
  duration: number;           // ms
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  error?: string;
}

export interface ConvergenceReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: ConvergenceTestResult[];
  summary: string;
}

// ── Test Runner ─────────────────────────────────────────────────────────────

async function runTest(
  name: string,
  fn: () => Promise<void>,
): Promise<ConvergenceTestResult> {
  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
  const addCheck = (name: string, passed: boolean, detail: string) => {
    checks.push({ name, passed, detail });
  };

  const start = Date.now();
  try {
    await fn();
    return { testName: name, passed: true, duration: Date.now() - start, checks };
  } catch (e) {
    addCheck('exception', false, (e as Error).message);
    return { testName: name, passed: false, duration: Date.now() - start, checks, error: (e as Error).message };
  }
}

// ── Pipeline Convergence Validation ─────────────────────────────────────────

export async function validatePipelineConvergence(): Promise<ConvergenceReport> {
  const results: ConvergenceTestResult[] = [];
  log.info('[Convergence] Starting pipeline convergence validation...');

  // ── Test 1: D3 → D4 (Backtest → Signal Emission) ──────────────────────

  results.push(await runTest('D3→D4: Backtest-to-Signal', async () => {
    const request: FactorBacktestRequest = {
      factorWeights: { MOM_12M: 0.30, QUAL: 0.25, VOL_60D: 0.20, HML: 0.15, LIQ: 0.10 },
      startDate: '2024-01-02',
      endDate: '2024-06-30',
    };

    const btResult = await runFactorBacktest(request);
    if (!btResult.success) throw new Error(`D3 backtest failed: ${btResult.error}`);
    if (btResult.tradingDays < 5) throw new Error(`Insufficient data: ${btResult.tradingDays} days`);
    if (btResult.sharpeRatio === 0 && btResult.annualReturn === 0) throw new Error('Zero returns — likely no data');
    if (btResult.factorContributions.length === 0) throw new Error('No factor contributions computed');

    // Feed into D4 as analysis input
    const analyses: FactorAnalysisInput[] = btResult.factorContributions.map(fc => {
      const ic = Math.abs(fc.annualizedReturn) / Math.max(1, fc.annualizedVol) / 100;
      return {
        factorId: fc.factorId,
        ic: Math.min(0.1, ic),
        ir: Math.min(2, fc.sharpeRatio),
        icRank: btResult.factorContributions.indexOf(fc) + 1,
        decayRate: fc.sharpeRatio < 0.5 ? 0.6 : fc.sharpeRatio < 1 ? 0.3 : 0.1,
        crowdingLevel: fc.maxDrawdown < -30 ? 'critical' : fc.maxDrawdown < -15 ? 'warning' : 'normal',
        momentum: fc.annualizedReturn > 0 ? 0.01 : -0.005,
        volatility: fc.annualizedVol / 100,
        lastUpdated: Date.now(),
      };
    });

    const pipeline = getFactorSignalPipeline();
    const signals = pipeline.emitSignals(analyses);
    if (signals.length === 0) throw new Error('D4 emitted 0 signals from valid analysis');

    log.info(`[Convergence] D3→D4: ${btResult.tradingDays} trading days → ${analyses.length} analyses → ${signals.length} signals`);
  }));

  // ── Test 2: D4 → D5 (Signal → Strategy → Execution) ───────────────────

  results.push(await runTest('D4→D5: Signal-to-Trade', async () => {
    const pipeline = getFactorSignalPipeline();

    // Generate signals from synthetic analysis
    const analyses: FactorAnalysisInput[] = [
      { factorId: 'MOM_12M', ic: 0.055, ir: 1.2, icRank: 1, decayRate: 0.15, crowdingLevel: 'normal', momentum: 0.012, volatility: 0.008, lastUpdated: Date.now() },
      { factorId: 'QUAL', ic: 0.042, ir: 0.9, icRank: 2, decayRate: 0.08, crowdingLevel: 'watch', momentum: 0.005, volatility: 0.006, lastUpdated: Date.now() },
      { factorId: 'VOL_60D', ic: 0.038, ir: 0.7, icRank: 3, decayRate: 0.45, crowdingLevel: 'warning', momentum: -0.003, volatility: 0.005, lastUpdated: Date.now() },
    ];

    const signals = pipeline.emitSignals(analyses);
    if (signals.length < 2) throw new Error(`Expected ≥2 signals, got ${signals.length}`);

    // Generate strategy
    const strategy = await pipeline.generateStrategy(signals, {
      name: 'Convergence Test Strategy',
      targetMarket: 'US',
      userId: 'test-convergence',
    });

    if (strategy.factors.length === 0) throw new Error('Strategy has 0 factors');
    if (strategy.expectedIC <= 0) throw new Error(`Invalid expectedIC: ${strategy.expectedIC}`);

    // Feed into D5
    const symbols = [
      { symbol: 'AAPL', assetClass: 'US_STOCK' as const, currentPrice: 185.50, volatility20d: 0.22 },
      { symbol: 'MSFT', assetClass: 'US_STOCK' as const, currentPrice: 420.30, volatility20d: 0.18 },
      { symbol: 'GOOGL', assetClass: 'US_STOCK' as const, currentPrice: 175.20, volatility20d: 0.25 },
    ];

    const tradePipeline = getFactorTradePipeline();
    const execResult = await tradePipeline.executeStrategy({
      strategy,
      symbols,
      accountEquity: 100000,
    });

    if (execResult.orders.length === 0) throw new Error('D5 produced 0 orders');
    if (execResult.totalNotional <= 0) throw new Error(`Invalid notional: ${execResult.totalNotional}`);

    log.info(`[Convergence] D4→D5: ${signals.length} signals → ${strategy.factors.length} factor strategy → ${execResult.orders.length} orders, fee=${execResult.totalFee}U`);
  }));

  // ── Test 3: D3→D4→D5 Full Pipeline ───────────────────────────────────

  results.push(await runTest('D3→D4→D5: Full Pipeline', async () => {
    const request: FactorBacktestRequest = {
      factorWeights: { MOM_12M: 0.35, QUAL: 0.30, HML: 0.20, SIZE: 0.15 },
      startDate: '2024-01-02',
      endDate: '2024-03-31',
    };

    // D3
    const btResult = await runFactorBacktest(request);
    if (!btResult.success) throw new Error(`D3: ${btResult.error}`);

    // D4
    const analyses: FactorAnalysisInput[] = btResult.factorContributions.map((fc, i) => ({
      factorId: fc.factorId,
      ic: Math.min(0.1, Math.abs(fc.annualizedReturn) / Math.max(1, fc.annualizedVol) / 100),
      ir: Math.min(2, fc.sharpeRatio),
      icRank: i + 1,
      decayRate: fc.maxDrawdown < -20 ? 0.5 : 0.15,
      crowdingLevel: fc.maxDrawdown < -25 ? 'critical' : fc.sharpeRatio < 0.3 ? 'warning' : 'normal',
      momentum: fc.annualizedReturn > 0 ? 0.008 : -0.003,
      volatility: fc.annualizedVol / 100,
      lastUpdated: Date.now(),
    }));

    const pipeline = getFactorSignalPipeline();
    const signals = pipeline.emitSignals(analyses);
    if (signals.length === 0) throw new Error('D4: 0 signals');

    const strategy = await pipeline.generateStrategy(signals, {
      name: 'Full Pipeline Strategy',
      targetMarket: 'US',
      userId: 'test-full-pipeline',
    });

    // D5
    const symbols = [
      { symbol: 'SPY', assetClass: 'ETF' as const, currentPrice: 520.00, volatility20d: 0.12 },
      { symbol: 'QQQ', assetClass: 'ETF' as const, currentPrice: 450.00, volatility20d: 0.18 },
      { symbol: 'IWM', assetClass: 'ETF' as const, currentPrice: 210.00, volatility20d: 0.22 },
      { symbol: 'IWD', assetClass: 'ETF' as const, currentPrice: 175.00, volatility20d: 0.15 },
    ];

    const tradePipeline = getFactorTradePipeline();
    const execResult = await tradePipeline.executeStrategy({
      strategy,
      symbols,
      accountEquity: 50000,
      maxPositionPct: 0.25,
    });

    if (!execResult.viable && execResult.orders.some(o => o.status !== 'REJECTED')) {
      throw new Error('Non-viable trade not caught');
    }

    log.info(`[Convergence] Full pipeline: D3(${btResult.tradingDays}d) → D4(${signals.length}sigs,${strategy.factors.length}factors) → D5(${execResult.orders.length}ords,${execResult.totalFee}U)`);
  }));

  // ── Test 4: Edge Cases ────────────────────────────────────────────────

  results.push(await runTest('Edge: Empty factor list', async () => {
    const request: FactorBacktestRequest = {
      factorWeights: {},
      startDate: '2024-01-02',
      endDate: '2024-06-30',
    };
    const btResult = await runFactorBacktest(request);
    if (btResult.success) throw new Error('Should fail with empty factors');
    if (!btResult.error?.includes('至少需要')) throw new Error('Wrong error message');
  }));

  results.push(await runTest('Edge: Single factor', async () => {
    const request: FactorBacktestRequest = {
      factorWeights: { MOM_12M: 1.0 },
      startDate: '2024-01-02',
      endDate: '2024-03-31',
    };
    const btResult = await runFactorBacktest(request);
    if (!btResult.success) throw new Error(`Single factor failed: ${btResult.error}`);
    if (btResult.factorContributions.length !== 1) throw new Error('Should have exactly 1 factor contribution');
  }));

  results.push(await runTest('Edge: Weights not summing to 1', async () => {
    const request: FactorBacktestRequest = {
      factorWeights: { MOM_12M: 0.5, QUAL: 0.3 },
      startDate: '2024-01-02',
      endDate: '2024-03-31',
    };
    const btResult = await runFactorBacktest(request);
    if (btResult.success) throw new Error('Should fail with non-1.0 weights');
  }));

  results.push(await runTest('Edge: Invalid date range', async () => {
    const request: FactorBacktestRequest = {
      factorWeights: { MOM_12M: 1.0 },
      startDate: '2025-12-31',
      endDate: '2024-01-01',
    };
    const btResult = await runFactorBacktest(request);
    if (btResult.success) throw new Error('Should fail with end before start');
  }));

  results.push(await runTest('Edge: Zero position from tiny signal', async () => {
    const sizer = new PositionSizer();
    const size = sizer.calc({
      symbol: 'PENNY',
      assetClass: 'US_STOCK',
      currentPrice: 0.50,
      accountEquity: 100,
      factorWeight: 0.01,
      maxPositionPct: 0.20,
      riskPerTradePct: 0.02,
    });
    // Should produce at least 1 share even for tiny account
    if (size.quantity < 1) throw new Error('Should produce at least 1 share');
    if (size.notionalValue > 100) throw new Error('Notional exceeds account');
  }));

  results.push(await runTest('Edge: High fee small trade rejection', async () => {
    const feeCalc = new FeeCalculator();
    const fee = feeCalc.estimate('HK_STOCK', 50); // HK$50 trade
    if (fee.effective) throw new Error('HK$50 trade should NOT be fee-effective (fee too high %)');
    const viable = feeCalc.isViable('HK_STOCK', 50);
    if (viable) throw new Error('isViable should return false for tiny trade');
  }));

  results.push(await runTest('Edge: Crypto futures minimum', async () => {
    const feeCalc = new FeeCalculator();
    const fee = feeCalc.estimate('CRYPTO_FUTURES', 1000);
    // Futures should be viable at $1000 (0.02% + min)
    if (fee.totalFee < 0) throw new Error('Negative fee');
  }));

  results.push(await runTest('Edge: All factors decayed', async () => {
    const pipeline = getFactorSignalPipeline();
    const deadAnalyses: FactorAnalysisInput[] = [
      { factorId: 'DEAD1', ic: 0.001, ir: 0.01, icRank: 100, decayRate: 0.9, crowdingLevel: 'critical', momentum: -0.02, volatility: 0.05, lastUpdated: Date.now() },
      { factorId: 'DEAD2', ic: 0.002, ir: 0.02, icRank: 101, decayRate: 0.8, crowdingLevel: 'critical', momentum: -0.015, volatility: 0.04, lastUpdated: Date.now() },
    ];
    const signals = pipeline.emitSignals(deadAnalyses);
    // Decay + crowding signals should still fire even for dead factors
    const hasCrowding = signals.some(s => s.type === 'crowding_signal');
    if (!hasCrowding) throw new Error('Dead factors should still emit crowding signals');
  }));

  // ── Compile Report ────────────────────────────────────────────────────

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;

  const report: ConvergenceReport = {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passed,
    failed,
    results,
    summary: failed === 0
      ? `全部${results.length}项管道收敛验证通过 ✅ — D3/D4/D5端到端就绪`
      : `${passed}/${results.length}通过，${failed}失败 ⚠️`,
  };

  log.info(`[Convergence] ${report.summary}`);
  return report;
}

/**
 * Quick smoke test — runs the most critical path only.
 * Returns true if full pipeline converges.
 */
export async function smokeTestPipeline(): Promise<boolean> {
  try {
    const request: FactorBacktestRequest = {
      factorWeights: { MOM_12M: 0.5, QUAL: 0.5 },
      startDate: '2024-01-02',
      endDate: '2024-01-31',
    };
    const btResult = await runFactorBacktest(request);
    if (!btResult.success) return false;

    const analyses: FactorAnalysisInput[] = btResult.factorContributions.map((fc, i) => ({
      factorId: fc.factorId, ic: 0.04, ir: 0.8, icRank: i + 1,
      decayRate: 0.2, crowdingLevel: 'normal', momentum: 0.005,
      volatility: 0.01, lastUpdated: Date.now(),
    }));
    const pipeline = getFactorSignalPipeline();
    const signals = pipeline.emitSignals(analyses);
    if (signals.length === 0) return false;

    const strategy = await pipeline.generateStrategy(signals, {
      name: 'Smoke Test', targetMarket: 'US', userId: 'smoke',
    });
    return strategy.factors.length > 0;
  } catch {
    return false;
  }
}

// ── Singleton runner ────────────────────────────────────────────────────────

let _report: ConvergenceReport | null = null;

export async function getConvergenceReport(): Promise<ConvergenceReport> {
  if (!_report) _report = await validatePipelineConvergence();
  return _report;
}

export function resetConvergenceReport(): void {
  _report = null;
}
