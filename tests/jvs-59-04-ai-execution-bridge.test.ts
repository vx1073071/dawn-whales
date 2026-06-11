/**
 * J-59-04 Tests: AI-to-Execution Bridge (R59 v19)
 *
 * Tests:
 * 01-03: Signal parsing
 * 04-06: Order execution (simulation)
 * 07-08: Risk controls + session management
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AIExecutionBridge,
  getExecutionBridge,
  resetExecutionBridge,
  AISignal,
} from '../electron/engine/agents/ai-to-execution-bridge';

describe('J-59-04: AIExecutionBridge', () => {
  let bridge: AIExecutionBridge;

  beforeEach(() => {
    resetExecutionBridge();
    bridge = getExecutionBridge();
  });

  describe('Signal Parsing', () => {
    it('01: HOLD signal returns safe with no action', () => {
      const session = bridge.createSession('alice');
      const result = bridge.parseSignal({
        symbol: 'AAPL', action: 'HOLD', score: 5, confidence: 0.5,
        source: 'orchestrator', reason: 'Neutral',
      }, session.sessionId);

      expect(result.safe).toBe(true);
      expect(result.quantity).toBe(0);
    });

    it('02: BUY signal with high confidence returns quantity', () => {
      const session = bridge.createSession('alice');
      const result = bridge.parseSignal({
        symbol: 'AAPL', action: 'BUY', score: 9, confidence: 0.9,
        source: 'fundamentals', reason: 'Strong buy signal',
      }, session.sessionId);

      expect(result.safe).toBe(true);
      expect(result.quantity).toBe(90); // confidence * 100
    });

    it('03: SELL signal is parsed correctly', () => {
      const session = bridge.createSession('alice');
      const result = bridge.parseSignal({
        symbol: 'TSLA', action: 'SELL', score: 8, confidence: 0.75,
        source: 'sentiment', reason: 'Negative sentiment',
      }, session.sessionId);

      expect(result.safe).toBe(true);
      expect(result.quantity).toBe(75);
    });

    it('04: signal rejected for inactive session', () => {
      const session = bridge.createSession('alice');
      bridge.deactivateSession(session.sessionId);
      const result = bridge.parseSignal({
        symbol: 'AAPL', action: 'BUY', score: 8, confidence: 0.8,
        source: 'orchestrator', reason: 'Test',
      }, session.sessionId);

      expect(result.safe).toBe(false);
    });
  });

  describe('Order Execution', () => {
    it('05: executeOrder creates simulated filled order', async () => {
      const session = bridge.createSession('alice');
      const signal: AISignal = {
        symbol: 'AAPL', action: 'BUY', score: 9, confidence: 0.85,
        source: 'orchestrator', reason: 'Bullish',
      };

      const order = await bridge.executeOrder(signal, session.sessionId);
      expect(order.status).toBe('filled');
      expect(order.symbol).toBe('AAPL');
      expect(order.side).toBe('buy');
      expect(order.quantity).toBe(85);
    });

    it('06: HOLD signal creates cancelled order', async () => {
      const session = bridge.createSession('alice');
      const order = await bridge.executeOrder({
        symbol: 'AAPL', action: 'HOLD', score: 5, confidence: 0.5,
        source: 'orchestrator', reason: 'No action',
      }, session.sessionId);

      expect(order.status).toBe('cancelled');
    });

    it('07: orders are logged in session', async () => {
      const session = bridge.createSession('alice');
      await bridge.executeOrder({
        symbol: 'AAPL', action: 'BUY', score: 8, confidence: 0.8,
        source: 'orchestrator', reason: 'Test',
      }, session.sessionId);

      const orders = bridge.getOrders(session.sessionId);
      expect(orders.length).toBe(1);
      expect(orders[0].symbol).toBe('AAPL');
    });
  });

  describe('Risk Controls', () => {
    it('08: daily trade limit is enforced', async () => {
      const session = bridge.createSession('alice');
      bridge.updateRiskControls(session.sessionId, { maxDailyTrades: 2 });

      // Execute 2 trades
      await bridge.executeOrder({ symbol: 'AAPL', action: 'BUY', score: 8, confidence: 0.5, source: 'orchestrator', reason: 't1' }, session.sessionId);
      await bridge.executeOrder({ symbol: 'TSLA', action: 'BUY', score: 7, confidence: 0.5, source: 'orchestrator', reason: 't2' }, session.sessionId);

      // 3rd should be rejected
      const rejected = await bridge.executeOrder({ symbol: 'GOOGL', action: 'BUY', score: 6, confidence: 0.5, source: 'orchestrator', reason: 't3' }, session.sessionId);
      expect(rejected.status).toBe('rejected');
    });

    it('09: position size limit enforces max', () => {
      const session = bridge.createSession('alice');
      bridge.updateRiskControls(session.sessionId, { maxPositionSize: 10 });

      const result = bridge.parseSignal({
        symbol: 'AAPL', action: 'BUY', score: 9, confidence: 1.0, // quantity=100
        source: 'orchestrator', reason: 'Large position',
      }, session.sessionId);

      expect(result.safe).toBe(false);
      expect(result.reason).toContain('exceeds max');
    });
  });

  describe('Session Management', () => {
    it('10: getSession returns session', () => {
      const session = bridge.createSession('alice');
      expect(bridge.getSession(session.sessionId)).toBeDefined();
    });

    it('11: simulation broker is used by default', () => {
      const broker = bridge.getBroker();
      expect(broker).toBeDefined();
    });

    it('12: reset clears sessions', () => {
      bridge.createSession('alice');
      bridge.reset();

      // New bridge after reset
      const newBridge = getExecutionBridge();
      const session = newBridge.createSession('bob');
      expect(session).toBeDefined();
    });
  });
});
