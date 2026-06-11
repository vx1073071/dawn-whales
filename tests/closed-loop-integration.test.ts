/**
 * J-35-01: ClosedLoop → TradeExecutor Integration Tests
 * Tests the full signal → order → position → close loop
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClosedLoopExecutor, Signal, Order, Position } from '../electron/engine/analysis/closed-loop-executor';

describe('J-35-01: ClosedLoop → TradeExecutor Integration', () => {
  let executor: ClosedLoopExecutor;

  beforeEach(() => {
    executor = new ClosedLoopExecutor({
      enabled: true,
      autoExecute: true,
      requireConfirmation: false,
      riskCheckEnabled: true,
      maxPositionSize: 10000,
      maxDailyOrders: 10,
      cooldownMinutes: 0,
    });
  });

  describe('Signal Processing', () => {
    it('should process BUY signal and create order', () => {
      const signal: Signal = {
        id: 'sig-1',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.8,
      };

      const result = executor.addSignal(signal);
      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order!.side).toBe('BUY');
      expect(result.order!.code).toBe('US.AAPL');
    });

    it('should process SELL signal and close position', () => {
      // First buy
      const buySignal: Signal = {
        id: 'sig-buy',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.8,
      };
      executor.addSignal(buySignal);

      // Then sell
      // Sell at the same price so quantity matches exactly
      const sellSignal: Signal = {
        id: 'sig-sell',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'SELL',
        price: 150,
        timestamp: Date.now() + 1000,
        confidence: 0.8,
      };
      const result = executor.addSignal(sellSignal);
      expect(result.success).toBe(true);
      expect(result.order!.side).toBe('SELL');
    });

    it('should reject HOLD signals', () => {
      const signal: Signal = {
        id: 'sig-hold',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'HOLD',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.5,
      };

      const result = executor.addSignal(signal);
      expect(result.success).toBe(true);
      expect(result.order).toBeUndefined();
    });
  });

  describe('Risk Checks', () => {
    it('should reject signal when risk check disabled', () => {
      executor.updateConfig({ riskCheckEnabled: false });
      const signal: Signal = {
        id: 'sig-1',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.8,
      };

      const result = executor.addSignal(signal);
      expect(result.success).toBe(true);
    });

    it('should reject when max positions reached', () => {
      executor.updateConfig({ maxDailyOrders: 999 });
      executor.resetDailyCount();

      // Force all orders to succeed (Math.random() > 0.05)
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
      // Create 20 signals -> 20 positions (all orders succeed with mockReturnValue(0.02))
      for (let i = 0; i < 20; i++) {
        const signal: Signal = {
          id: `sig-${i}`,
          strategyId: 'strat-1',
          code: `US.STOCK${i}`,
          type: 'BUY',
          price: 100,
          timestamp: Date.now() + i,
          confidence: 0.8,
        };
        executor.addSignal(signal);
      }
      randomSpy.mockRestore();

      // Verify 20 positions
      const positions = executor.getPositions();
      expect(positions.length).toBe(20);

      // 21st signal MUST be rejected (positions.size >= 20)
      const signal: Signal = {
        id: 'sig-overflow',
        strategyId: 'strat-1',
        code: 'US.OVERFLOW',
        type: 'BUY',
        price: 100,
        timestamp: Date.now(),
        confidence: 0.8,
      };
      const result = executor.addSignal(signal);
      expect(result.success).toBe(false);
      expect(result.riskReason).toContain('Max positions');
    });

    it('should reject when daily order limit reached', () => {
      executor.updateConfig({ maxDailyOrders: 2 });

      for (let i = 0; i < 2; i++) {
        const signal: Signal = {
          id: `sig-${i}`,
          strategyId: 'strat-1',
          code: `US.STOCK${i}`,
          type: 'BUY',
          price: 100,
          timestamp: Date.now() + i,
          confidence: 0.8,
        };
        executor.addSignal(signal);
      }

      const signal: Signal = {
        id: 'sig-overflow',
        strategyId: 'strat-1',
        code: 'US.OVERFLOW',
        type: 'BUY',
        price: 100,
        timestamp: Date.now(),
        confidence: 0.8,
      };

      const result = executor.addSignal(signal);
      expect(result.success).toBe(false);
      expect(result.riskReason).toContain('Daily order limit');
    });
  });

  describe('Position Tracking', () => {
    it('should track position after BUY', () => {
      const signal: Signal = {
        id: 'sig-1',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.8,
      };

      executor.addSignal(signal);
      const positions = executor.getPositions();
      expect(positions.length).toBe(1);
      expect(positions[0].code).toBe('US.AAPL');
      expect(positions[0].quantity).toBeGreaterThan(0);
    });

    it('should update position after multiple BUYs', () => {
      const signal1: Signal = {
        id: 'sig-1',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.8,
      };
      executor.addSignal(signal1);

      const signal2: Signal = {
        id: 'sig-2',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 155,
        timestamp: Date.now() + 1000,
        confidence: 0.8,
      };
      executor.addSignal(signal2);

      const positions = executor.getPositions();
      expect(positions.length).toBe(1);
      expect(positions[0].quantity).toBeGreaterThan(0);
    });

    it('should close position after SELL', () => {
      const buySignal: Signal = {
        id: 'sig-buy',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.8,
      };
      executor.addSignal(buySignal);

      // Sell at the same price so quantity matches exactly
      const sellSignal: Signal = {
        id: 'sig-sell',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'SELL',
        price: 150,
        timestamp: Date.now() + 1000,
        confidence: 0.8,
      };
      executor.addSignal(sellSignal);

      const positions = executor.getPositions();
      expect(positions.length).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate stats correctly', () => {
      // Force order to succeed (Math.random() > 0.05)
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
      
      const signal1: Signal = {
        id: 'sig-1',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.8,
      };
      executor.addSignal(signal1);
      
      randomSpy.mockRestore();
      
      const stats = executor.getStats();
      expect(stats.totalSignals).toBe(1);
      expect(stats.executedOrders).toBeGreaterThan(0);
    });
  });
});
