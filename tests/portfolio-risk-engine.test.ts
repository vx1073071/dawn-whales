// =============================================================================
// PortfolioRiskEngine Tests (Q-39-01)
// J-39-03: Portfolio risk engine — VaR/CVaR/correlation/stress testing
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PortfolioRiskEngine,
  getPortfolioRiskEngine,
  Portfolio,
  VaRResult,
  CorrelationMatrix,
  StressScenario,
  StressTestResult,
  RiskMetrics,
  HistoricalReturn,
} from '../electron/engine/portfolio/portfolio-risk-engine';

function makePortfolio(symbols = ['BTCUSDT', 'ETHUSDT'], weights = [0.6, 0.4]): Portfolio {
  const positions = symbols.map((symbol, i) => ({
    symbol,
    quantity: 100,
    avgPrice: 50000,
    currentPrice: 50000 + i * 1000,
    marketValue: (50000 + i * 1000) * 100,
    weight: weights[i],
  }));
  return {
    positions,
    totalValue: positions.reduce((s, p) => s + p.marketValue, 0),
    cashPosition: 10000,
    timestamp: Date.now(),
  };
}

function makeReturns(symbol: string, values: number[]): HistoricalReturn[] {
  return values.map((ret, i) => ({
    symbol,
    date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    return: ret,
  }));
}

describe('PortfolioRiskEngine', () => {
  // ── Initialization ───────────────────────────────────────────────────────

  describe('Initialization', () => {
    it('should initialize', () => {
      const engine = new PortfolioRiskEngine();
      expect(engine.getPortfolio()).toBeNull();
    });
  });

  // ── Portfolio Management ───────────────────────────────────────────────

  describe('Portfolio Management', () => {
    it('should set and get portfolio', () => {
      const engine = new PortfolioRiskEngine();
      const portfolio = makePortfolio();
      engine.setPortfolio(portfolio);
      const retrieved = engine.getPortfolio();
      expect(retrieved).not.toBeNull();
      expect(retrieved!.positions).toHaveLength(2);
      expect(retrieved!.totalValue).toBe(portfolio.totalValue);
    });

    it('should add historical returns', () => {
      const engine = new PortfolioRiskEngine();
      const returns: HistoricalReturn[] = makeReturns('BTCUSDT', [0.01, -0.02, 0.03]);
      engine.addHistoricalReturns('BTCUSDT', returns);
      // No public getter but internal state is set
    });

    it('should set benchmark returns', () => {
      const engine = new PortfolioRiskEngine();
      engine.setBenchmarkReturns([0.01, 0.02, -0.01]);
    });

    it('should set risk-free rate', () => {
      const engine = new PortfolioRiskEngine();
      engine.setRiskFreeRate(0.03);
    });
  });

  // ── Historical VaR ──────────────────────────────────────────────────

  describe('calculateHistoricalVaR', () => {
    it('should throw without portfolio', () => {
      const engine = new PortfolioRiskEngine();
      expect(() => engine.calculateHistoricalVaR()).toThrow('Portfolio not set');
    });

    it('should calculate VaR with portfolio and returns', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      engine.addHistoricalReturns('BTCUSDT', makeReturns('BTCUSDT', [0.05, -0.03, 0.02, 0.01, -0.05, 0.03, 0.04, -0.02, 0.01, 0.02]));
      engine.addHistoricalReturns('ETHUSDT', makeReturns('ETHUSDT', [0.03, -0.02, 0.01, 0.02, -0.03, 0.02, 0.03, -0.01, 0.02, 0.01]));
      const result = engine.calculateHistoricalVaR(1, 95);
      expect(result.var_95).toBeGreaterThanOrEqual(0);
      expect(result.method).toBe('historical');
      expect(result.horizon).toBe(1);
    });

    it('should return zero VaR without returns', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      const result = engine.calculateHistoricalVaR(1, 95);
      expect(result.var_95).toBe(0);
      expect(result.var_99).toBe(0);
    });

    it('should scale VaR by horizon', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      engine.addHistoricalReturns('BTCUSDT', makeReturns('BTCUSDT', [0.05, -0.03, 0.02, 0.01, -0.05]));
      engine.addHistoricalReturns('ETHUSDT', makeReturns('ETHUSDT', [0.03, -0.02, 0.01, 0.02, -0.03]));
      const var1 = engine.calculateHistoricalVaR(1, 95);
      const var5 = engine.calculateHistoricalVaR(5, 95);
      expect(var5.var_95).toBeGreaterThanOrEqual(var1.var_95);
    });
  });

  // ── Parametric VaR ───────────────────────────────────────────────────

  describe('calculateParametricVaR', () => {
    it('should throw without portfolio', () => {
      const engine = new PortfolioRiskEngine();
      expect(() => engine.calculateParametricVaR()).toThrow('Portfolio not set');
    });

    it('should calculate parametric VaR with returns', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      engine.addHistoricalReturns('BTCUSDT', makeReturns('BTCUSDT', [0.05, -0.03, 0.02, 0.01, -0.05]));
      engine.addHistoricalReturns('ETHUSDT', makeReturns('ETHUSDT', [0.03, -0.02, 0.01, 0.02, -0.03]));
      const result = engine.calculateParametricVaR(1);
      expect(result.method).toBe('parametric');
      expect(result.var_95).toBeGreaterThanOrEqual(0);
    });

    it('should return zero when no returns', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      const result = engine.calculateParametricVaR();
      expect(result.var_95).toBe(0);
    });
  });

  // ── Correlation Matrix ───────────────────────────────────────────────

  describe('calculateCorrelationMatrix', () => {
    it('should throw without portfolio', () => {
      const engine = new PortfolioRiskEngine();
      expect(() => engine.calculateCorrelationMatrix()).toThrow('Portfolio not set');
    });

    it('should calculate correlation matrix', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      engine.addHistoricalReturns('BTCUSDT', makeReturns('BTCUSDT', [0.05, -0.03, 0.02, 0.01, -0.05, 0.03, 0.04, -0.02, 0.01, 0.02]));
      engine.addHistoricalReturns('ETHUSDT', makeReturns('ETHUSDT', [0.03, -0.02, 0.01, 0.02, -0.03, 0.02, 0.03, -0.01, 0.02, 0.01]));
      const matrix = engine.calculateCorrelationMatrix();
      expect(matrix.symbols).toContain('BTCUSDT');
      expect(matrix.symbols).toContain('ETHUSDT');
      expect(matrix.matrix).toHaveLength(2);
      expect(matrix.matrix[0][0]).toBe(1.0); // diagonal
      expect(matrix.matrix[1][1]).toBe(1.0); // diagonal
    });

    it('should return 0 correlation for insufficient data', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      engine.addHistoricalReturns('BTCUSDT', makeReturns('BTCUSDT', [0.01]));
      engine.addHistoricalReturns('ETHUSDT', makeReturns('ETHUSDT', [0.02]));
      const matrix = engine.calculateCorrelationMatrix();
      expect(matrix.matrix[0][1]).toBe(0);
    });
  });

  // ── Stress Testing ─────────────────────────────────────────────────

  describe('runStressTest', () => {
    it('should throw without portfolio', () => {
      const engine = new PortfolioRiskEngine();
      const scenario: StressScenario = { name: 'Test', description: 'Test', shocks: { BTCUSDT: -10 } };
      expect(() => engine.runStressTest(scenario)).toThrow('Portfolio not set');
    });

    it('should run stress test scenario', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      const scenario: StressScenario = {
        name: 'Market Crash',
        description: '40% drop',
        shocks: { BTCUSDT: -40, ETHUSDT: -40 },
      };
      const result = engine.runStressTest(scenario);
      expect(result.portfolioLoss).toBeLessThan(0); // negative = loss
      expect(result.totalValueAfter).toBeLessThan(makePortfolio().totalValue);
      expect(result.scenario.name).toBe('Market Crash');
      expect(result.positionImpacts).toHaveLength(2);
    });

    it('should handle wildcard shock', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      const scenario: StressScenario = {
        name: 'All Down',
        description: 'All down 20%',
        shocks: { '*': -20 },
      };
      const result = engine.runStressTest(scenario);
      expect(result.portfolioLoss).toBeLessThan(0);
    });

    it('should get predefined scenarios', () => {
      const engine = new PortfolioRiskEngine();
      const scenarios = engine.getPredefinedScenarios();
      expect(scenarios.length).toBeGreaterThan(0);
      expect(scenarios[0].name).toBe('Market Crash');
    });
  });

  // ── Risk Metrics ───────────────────────────────────────────────────

  describe('calculateRiskMetrics', () => {
    it('should throw without portfolio', () => {
      const engine = new PortfolioRiskEngine();
      expect(() => engine.calculateRiskMetrics()).toThrow('Portfolio not set');
    });

    it('should calculate comprehensive risk metrics', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      engine.addHistoricalReturns('BTCUSDT', makeReturns('BTCUSDT', [0.05, -0.03, 0.02, 0.01, -0.05, 0.03, 0.04, -0.02, 0.01, 0.02]));
      engine.addHistoricalReturns('ETHUSDT', makeReturns('ETHUSDT', [0.03, -0.02, 0.01, 0.02, -0.03, 0.02, 0.03, -0.01, 0.02, 0.01]));
      const metrics = engine.calculateRiskMetrics();
      expect(metrics.sharpeRatio).toBeDefined();
      expect(metrics.sortinoRatio).toBeDefined();
      expect(metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(metrics.portfolioVaR.var_95).toBeGreaterThanOrEqual(0);
      expect(metrics.correlationMatrix.symbols).toContain('BTCUSDT');
    });
  });

  // ── Risk Budget ───────────────────────────────────────────────────

  describe('calculateRiskBudget', () => {
    it('should throw without portfolio', () => {
      const engine = new PortfolioRiskEngine();
      expect(() => engine.calculateRiskBudget()).toThrow('Portfolio not set');
    });

    it('should calculate risk budget', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      const budgets = engine.calculateRiskBudget();
      expect(budgets).toHaveLength(2);
      expect(budgets[0].symbol).toBe('BTCUSDT');
      expect(budgets[0].currentWeight).toBe(0.6);
    });

    it('should use target weights when provided', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      const budgets = engine.calculateRiskBudget({ BTCUSDT: 0.5, ETHUSDT: 0.5 });
      const btc = budgets.find(b => b.symbol === 'BTCUSDT')!;
      expect(btc.targetWeight).toBe(0.5);
      expect(btc.deviation).toBeCloseTo(0.1, 2); // 0.6 - 0.5
    });
  });

  // ── Cleanup ───────────────────────────────────────────────────────

  describe('Cleanup', () => {
    it('should clear all data', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      engine.addHistoricalReturns('BTCUSDT', makeReturns('BTCUSDT', [0.01]));
      engine.clearAll();
      expect(engine.getPortfolio()).toBeNull();
    });

    it('should reset engine', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      engine.reset();
      expect(engine.getPortfolio()).toBeNull();
    });

    it('should destroy engine', () => {
      const engine = new PortfolioRiskEngine();
      engine.setPortfolio(makePortfolio());
      engine.destroy();
      expect(engine.getPortfolio()).toBeNull();
    });
  });
});