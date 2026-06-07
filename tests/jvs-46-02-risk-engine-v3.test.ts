/**
 * JVS-46-02: Risk Engine V3 Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RiskEngineV3, getRiskEngineV3, resetRiskEngineV3 } from '../electron/engine/risk-engine-v3';

describe('JVS-46-02: Risk Engine V3', () => {
  let engine: RiskEngineV3;

  beforeEach(() => {
    resetRiskEngineV3();
    engine = getRiskEngineV3();
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const e1 = getRiskEngineV3();
      const e2 = getRiskEngineV3();
      expect(e1).toBe(e2);
    });

    it('should reset instance', () => {
      const e1 = getRiskEngineV3();
      resetRiskEngineV3();
      const e2 = getRiskEngineV3();
      expect(e1).not.toBe(e2);
    });
  });

  describe('Risk Evaluation', () => {
    it('should evaluate risk with low risk portfolio', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 0.3, value: 30000, pnl: 1000, pnlPct: 3.33 },
        { symbol: 'MSFT', weight: 0.3, value: 30000, pnl: 500, pnlPct: 1.67 },
        { symbol: 'GOOGL', weight: 0.4, value: 40000, pnl: 800, pnlPct: 2.0 },
      ];

      const marketData = {
        returns: [0.01, 0.02, -0.01, 0.015, 0.02],
        currentPrice: 100,
        historicalPrices: [100, 101, 102, 101, 103, 105],
      };

      const result = engine.evaluateRisk(portfolio, marketData);

      expect(result).toBeDefined();
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
      expect(result.drawdown).toBeGreaterThanOrEqual(0);
      expect(result.volatility).toBeGreaterThanOrEqual(0);
      expect(result.concentration).toBeGreaterThanOrEqual(0);
      expect(result.correlation).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should detect high drawdown risk', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 1.0, value: 100000, pnl: -5000, pnlPct: -5.0 },
      ];

      const marketData = {
        returns: [-0.05, -0.03, -0.02, -0.04, -0.06],
        currentPrice: 95,
        historicalPrices: [100, 98, 95, 92, 90, 88, 85, 82, 80, 78],
      };

      const result = engine.evaluateRisk(portfolio, marketData);

      expect(result.drawdown).toBeGreaterThan(20);
      expect(result.overall).toBeGreaterThan(20);
    });

    it('should detect high concentration risk', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 0.8, value: 80000, pnl: 1000, pnlPct: 1.25 },
        { symbol: 'MSFT', weight: 0.2, value: 20000, pnl: 200, pnlPct: 1.0 },
      ];

      const marketData = {
        returns: [0.01, 0.02, -0.01, 0.015, 0.02],
        currentPrice: 100,
        historicalPrices: [100, 101, 102, 101, 103, 105],
      };

      const result = engine.evaluateRisk(portfolio, marketData);

      expect(result.concentration).toBeGreaterThan(20);
    });

    it('should handle empty portfolio', () => {
      const portfolio = [];
      const marketData = {
        returns: [0.01, 0.02, -0.01],
        currentPrice: 100,
        historicalPrices: [100, 101, 102],
      };

      const result = engine.evaluateRisk(portfolio, marketData);

      expect(result.concentration).toBe(0);
    });

    it('should handle empty market data', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 1.0, value: 100000, pnl: 1000, pnlPct: 1.0 },
      ];

      const marketData = {
        returns: [],
        currentPrice: 100,
        historicalPrices: [],
      };

      const result = engine.evaluateRisk(portfolio, marketData);

      expect(result.volatility).toBe(0);
      expect(result.drawdown).toBe(0);
    });
  });

  describe('Thresholds', () => {
    it('should set custom thresholds', () => {
      const thresholds = {
        drawdown: 15,
        volatility: 25,
        concentration: 35,
        correlation: 0.7,
      };

      engine.setThresholds(thresholds);

      // Verify by evaluating a portfolio that exceeds thresholds
      const portfolio = [
        { symbol: 'AAPL', weight: 0.5, value: 50000, pnl: -2000, pnlPct: -4.0 },
      ];

      const marketData = {
        returns: [-0.04, -0.03, -0.02, -0.05],
        currentPrice: 98,
        historicalPrices: [100, 98, 96, 94, 92],
      };

      const result = engine.evaluateRisk(portfolio, marketData);
      const alerts = engine.getAlerts();

      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should emit thresholds-updated event', () => {
      let emitted = false;
      engine.on('thresholds-updated', () => {
        emitted = true;
      });

      engine.setThresholds({
        drawdown: 15,
        volatility: 25,
        concentration: 35,
        correlation: 0.7,
      });

      expect(emitted).toBe(true);
    });
  });

  describe('Alerts', () => {
    it('should generate alerts for high risk', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 0.6, value: 60000, pnl: -3000, pnlPct: -5.0 },
      ];

      const marketData = {
        returns: [-0.05, -0.04, -0.03, -0.06, -0.07],
        currentPrice: 95,
        historicalPrices: [100, 97, 94, 91, 88, 85, 82, 79, 76],
      };

      engine.evaluateRisk(portfolio, marketData);
      const alerts = engine.getAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBeDefined();
      expect(alerts[0].severity).toBeDefined();
      expect(alerts[0].message).toBeDefined();
      expect(alerts[0].timestamp).toBeGreaterThan(0);
    });

    it('should emit alert event', () => {
      let alertEmitted = false;
      engine.on('alert', () => {
        alertEmitted = true;
      });

      const portfolio = [
        { symbol: 'AAPL', weight: 0.6, value: 60000, pnl: -3000, pnlPct: -5.0 },
      ];

      const marketData = {
        returns: [-0.05, -0.04, -0.03, -0.06, -0.07],
        currentPrice: 95,
        historicalPrices: [100, 97, 94, 91, 88, 85, 82, 79, 76],
      };

      engine.evaluateRisk(portfolio, marketData);

      expect(alertEmitted).toBe(true);
    });

    it('should limit alert history size', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 0.6, value: 60000, pnl: -3000, pnlPct: -5.0 },
      ];

      const marketData = {
        returns: [-0.05, -0.04, -0.03, -0.06, -0.07],
        currentPrice: 95,
        historicalPrices: [100, 97, 94, 91, 88, 85, 82, 79, 76],
      };

      // Generate many alerts
      for (let i = 0; i < 150; i++) {
        engine.evaluateRisk(portfolio, marketData);
      }

      const alerts = engine.getAlerts();
      expect(alerts.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Rebalance Suggestions', () => {
    it('should suggest rebalance for high concentration', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 0.6, value: 60000, pnl: 1000, pnlPct: 1.67 },
        { symbol: 'MSFT', weight: 0.4, value: 40000, pnl: 500, pnlPct: 1.25 },
      ];

      engine.setThresholds({
        drawdown: 20,
        volatility: 30,
        concentration: 35, // Lower threshold to trigger alert
        correlation: 0.8,
      });

      const marketData = {
        returns: [0.01, 0.02, -0.01],
        currentPrice: 100,
        historicalPrices: [100, 101, 102],
      };

      engine.evaluateRisk(portfolio, marketData);
      const signals = engine.suggestRebalance(portfolio);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].action).toBeDefined();
      expect(signals[0].reason).toBeDefined();
    });

    it('should emit rebalance-suggested event', () => {
      let rebalanceEmitted = false;
      engine.on('rebalance-suggested', () => {
        rebalanceEmitted = true;
      });

      const portfolio = [
        { symbol: 'AAPL', weight: 0.6, value: 60000, pnl: 1000, pnlPct: 1.67 },
      ];

      engine.setThresholds({
        drawdown: 20,
        volatility: 30,
        concentration: 35,
        correlation: 0.8,
      });

      const marketData = {
        returns: [0.01, 0.02, -0.01],
        currentPrice: 100,
        historicalPrices: [100, 101, 102],
      };

      engine.evaluateRisk(portfolio, marketData);
      engine.suggestRebalance(portfolio);

      expect(rebalanceEmitted).toBe(true);
    });

    it('should not suggest rebalance for low risk portfolio', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 0.3, value: 30000, pnl: 1000, pnlPct: 3.33 },
        { symbol: 'MSFT', weight: 0.3, value: 30000, pnl: 500, pnlPct: 1.67 },
        { symbol: 'GOOGL', weight: 0.4, value: 40000, pnl: 800, pnlPct: 2.0 },
      ];

      const marketData = {
        returns: [0.01, 0.02, -0.01, 0.015, 0.02],
        currentPrice: 100,
        historicalPrices: [100, 101, 102, 101, 103, 105],
      };

      engine.evaluateRisk(portfolio, marketData);
      const signals = engine.suggestRebalance(portfolio);

      expect(signals.length).toBe(0);
    });
  });

  describe('Metrics', () => {
    it('should return metrics', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 0.5, value: 50000, pnl: 1000, pnlPct: 2.0 },
      ];

      const marketData = {
        returns: [0.01, 0.02, -0.01, 0.015, 0.02],
        currentPrice: 100,
        historicalPrices: [100, 101, 102, 101, 103, 105],
      };

      engine.evaluateRisk(portfolio, marketData);
      const metrics = engine.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.avgRiskScore).toBeGreaterThanOrEqual(0);
      expect(metrics.alertCount).toBeGreaterThanOrEqual(0);
      expect(metrics.rebalanceCount).toBeGreaterThanOrEqual(0);
    });

    it('should track risk history', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 0.5, value: 50000, pnl: 1000, pnlPct: 2.0 },
      ];

      const marketData = {
        returns: [0.01, 0.02, -0.01, 0.015, 0.02],
        currentPrice: 100,
        historicalPrices: [100, 101, 102, 101, 103, 105],
      };

      engine.evaluateRisk(portfolio, marketData);
      engine.evaluateRisk(portfolio, marketData);

      const history = engine.getRiskHistory();
      expect(history.length).toBe(2);
    });

    it('should track rebalance history', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 0.6, value: 60000, pnl: 1000, pnlPct: 1.67 },
      ];

      engine.setThresholds({
        drawdown: 20,
        volatility: 30,
        concentration: 35,
        correlation: 0.8,
      });

      const marketData = {
        returns: [0.01, 0.02, -0.01],
        currentPrice: 100,
        historicalPrices: [100, 101, 102],
      };

      engine.evaluateRisk(portfolio, marketData);
      engine.suggestRebalance(portfolio);

      const history = engine.getRebalanceHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    it('should reset all data', () => {
      const portfolio = [
        { symbol: 'AAPL', weight: 0.5, value: 50000, pnl: 1000, pnlPct: 2.0 },
      ];

      const marketData = {
        returns: [0.01, 0.02, -0.01, 0.015, 0.02],
        currentPrice: 100,
        historicalPrices: [100, 101, 102, 101, 103, 105],
      };

      engine.evaluateRisk(portfolio, marketData);
      engine.reset();

      const history = engine.getRiskHistory();
      const alerts = engine.getAlerts();
      const rebalanceHistory = engine.getRebalanceHistory();

      expect(history.length).toBe(0);
      expect(alerts.length).toBe(0);
      expect(rebalanceHistory.length).toBe(0);
    });

    it('should emit reset event', () => {
      let resetEmitted = false;
      engine.on('reset', () => {
        resetEmitted = true;
      });

      engine.reset();

      expect(resetEmitted).toBe(true);
    });
  });

  describe('Event Emitter', () => {
    it('should emit risk-evaluated event', () => {
      let evaluatedEmitted = false;
      engine.on('risk-evaluated', () => {
        evaluatedEmitted = true;
      });

      const portfolio = [
        { symbol: 'AAPL', weight: 0.5, value: 50000, pnl: 1000, pnlPct: 2.0 },
      ];

      const marketData = {
        returns: [0.01, 0.02, -0.01, 0.015, 0.02],
        currentPrice: 100,
        historicalPrices: [100, 101, 102, 101, 103, 105],
      };

      engine.evaluateRisk(portfolio, marketData);

      expect(evaluatedEmitted).toBe(true);
    });

    it('should remove event listeners', () => {
      let callCount = 0;
      const listener = () => {
        callCount++;
      };

      engine.on('risk-evaluated', listener);
      engine.off('risk-evaluated', listener);

      const portfolio = [
        { symbol: 'AAPL', weight: 0.5, value: 50000, pnl: 1000, pnlPct: 2.0 },
      ];

      const marketData = {
        returns: [0.01, 0.02, -0.01, 0.015, 0.02],
        currentPrice: 100,
        historicalPrices: [100, 101, 102, 101, 103, 105],
      };

      engine.evaluateRisk(portfolio, marketData);

      expect(callCount).toBe(0);
    });

    it('should remove all listeners', () => {
      let callCount = 0;
      engine.on('risk-evaluated', () => { callCount++; });
      engine.on('alert', () => { callCount++; });

      engine.removeAllListeners();

      const portfolio = [
        { symbol: 'AAPL', weight: 0.5, value: 50000, pnl: 1000, pnlPct: 2.0 },
      ];

      const marketData = {
        returns: [0.01, 0.02, -0.01, 0.015, 0.02],
        currentPrice: 100,
        historicalPrices: [100, 101, 102, 101, 103, 105],
      };

      engine.evaluateRisk(portfolio, marketData);

      expect(callCount).toBe(0);
    });
  });
});
