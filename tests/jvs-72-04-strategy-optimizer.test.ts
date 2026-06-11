// ── J-72-04 Tests: Strategy Comparison + Portfolio Optimization (6 tests)
import { describe, it, expect } from "vitest";
import {
  StrategyComparisonEngine,
  PortfolioOptimizer,
  createStrategyComparisonEngine,
  createPortfolioOptimizer,
  StrategyMetrics,
} from "../electron/engine/analysis/strategy-comparison-optimizer";

describe("J-72-04: Strategy Comparison + Portfolio Optimization", () => {
  const compare = createStrategyComparisonEngine();
  const optimizer = createPortfolioOptimizer();

  const mockStrategies: StrategyMetrics[] = [
    { name: "Alpha Momentum", totalReturn: 25.5, sharpe: 1.8, maxDrawdown: 0.12, winRate: 0.65, volatility: 0.18, alpha: 8.2 },
    { name: "Mean Reversion", totalReturn: 18.3, sharpe: 1.5, maxDrawdown: 0.08, winRate: 0.72, volatility: 0.14, alpha: 5.1 },
    { name: "ML Trend", totalReturn: 30.1, sharpe: 2.1, maxDrawdown: 0.15, winRate: 0.58, volatility: 0.22, alpha: 12.0 },
  ];

  // ── Strategy Comparison ───────────────────────────────────────────────

  it("01: computeRadar normalizes 6 dimensions 0-100", () => {
    const radar = compare.computeRadar(mockStrategies);

    expect(radar.size).toBe(3);

    for (const [name, points] of radar) {
      expect(points).toHaveLength(6);
      expect(points.find((p) => p.dimension === "Sharpe")!.value).toBeGreaterThanOrEqual(0);
      expect(points.find((p) => p.dimension === "Weighted α")!.value).toBeLessThanOrEqual(100);
    }
  });

  it("02: compare ranks strategies by composite score", () => {
    const result = compare.compare(mockStrategies);
    expect(result.ranking).toHaveLength(3);
    expect(result.best).not.toBeNull();
    // Alpha Momentum edges out ML Trend on composite (winRate+drawdown bonus)
    // Verify ranking is sorted desc
    expect(result.best).toBe(result.ranking[0].name);
    expect(result.ranking[0].compositeScore).toBeGreaterThan(result.ranking[1].compositeScore);
  });

  it("03: empty strategies returns empty results", () => {
    const radar = compare.computeRadar([]);
    expect(radar.size).toBe(0);

    const comp = compare.compare([]);
    expect(comp.best).toBeNull();
    expect(comp.ranking).toEqual([]);
  });

  // ── Portfolio Optimization ────────────────────────────────────────────

  it("04: computeEfficientFrontier generates Pareto-efficient points", () => {
    const returns = [0.25, 0.18, 0.30]; // annualized
    const cov = [
      [0.0324, 0.0108, 0.0162],
      [0.0108, 0.0196, 0.0084],
      [0.0162, 0.0084, 0.0484],
    ];
    const names = ["Alpha Momentum", "Mean Reversion", "ML Trend"];

    const frontier = optimizer.computeEfficientFrontier(returns, cov, names, 30);
    expect(frontier.length).toBeGreaterThan(0);

    // Pareto-efficient: risk monotonically increases, return non-decreasing
    for (let i = 1; i < frontier.length; i++) {
      expect(frontier[i].risk).toBeGreaterThanOrEqual(frontier[i - 1].risk);
      expect(frontier[i].return_).toBeGreaterThanOrEqual(frontier[i - 1].return_);
    }

    // Has weights for all strategies
    expect(Object.keys(frontier[0].weights)).toHaveLength(3);
  });

  it("05: computeRiskBudget sums to ~100%", () => {
    const weights = [0.4, 0.35, 0.25];
    const cov = [
      [0.0324, 0.0108, 0.0162],
      [0.0108, 0.0196, 0.0084],
      [0.0162, 0.0084, 0.0484],
    ];
    const names = ["A", "B", "C"];

    const budget = optimizer.computeRiskBudget(weights, cov, names);
    expect(budget).toHaveLength(3);

    const totalRiskBudget = budget.reduce((sum, b) => sum + b.riskBudget, 0);
    expect(totalRiskBudget).toBeCloseTo(100, 0);
  });

  it("06: computeRebalanceActions identifies buy/sell/hold + computeMaxSharpe", () => {
    const current = { A: 0.3, B: 0.5, C: 0.2 };
    const target = { A: 0.4, B: 0.3, C: 0.3 };

    const actions = optimizer.computeRebalanceActions(current, target, 0.03);
    expect(actions).toHaveLength(3);

    const buyAction = actions.find((a) => a.action === "buy");
    const sellAction = actions.find((a) => a.action === "sell");
    expect(buyAction).toBeDefined();
    expect(sellAction).toBeDefined();

    // Max Sharpe
    const returns = [0.25, 0.18, 0.30];
    const cov = [
      [0.0324, 0.0108, 0.0162],
      [0.0108, 0.0196, 0.0084],
      [0.0162, 0.0084, 0.0484],
    ];
    const ms = optimizer.computeMaxSharpe(returns, cov);
    expect(ms.weights).toHaveLength(3);
    expect(ms.sharpe).toBeGreaterThan(0);
    expect(ms.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
  });
});
