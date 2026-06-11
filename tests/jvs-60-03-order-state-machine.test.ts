/**
 * J-60-03 Tests: Order State Machine & Audit Trail (R60 v19)
 *
 * Tests:
 * 01-02: Order creation + state transitions
 * 03-04: Fill updates (partial/full)
 * 05-06: Cancel/Reject flows
 * 07-08: Timeout detection + audit
 * 09-10: State validation + active orders
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  OrderStateManager,
  getOrderManager,
  resetOrderManager,
  VALID_TRANSITIONS,
} from '../electron/engine/analysis/order-state-machine';

describe('J-60-03: OrderStateManager', () => {
  let manager: OrderStateManager;

  beforeEach(() => {
    resetOrderManager();
    manager = getOrderManager();
  });

  describe('Order Creation', () => {
    it('01: createOrder starts in pending state', () => {
      const order = manager.createOrder({
        symbol: '00700', side: 'buy', quantity: 100, price: 350,
        orderType: 'limit', market: 'HK',
      });
      expect(order.state).toBe('pending');
      expect(order.orderId.startsWith('LIVE-')).toBe(true);
      expect(order.auditTrail.length).toBe(1); // initial creation
    });

    it('02: createOrder market order has no price', () => {
      const order = manager.createOrder({
        symbol: 'AAPL', side: 'sell', quantity: 10,
        orderType: 'market', market: 'US',
      });
      expect(order.price).toBeUndefined();
      expect(order.orderType).toBe('market');
    });
  });

  describe('State Transitions', () => {
    it('03: pending → submitted is valid', () => {
      const order = manager.createOrder({
        symbol: '00700', side: 'buy', quantity: 100, price: 350,
        orderType: 'limit', market: 'HK',
      });
      manager.transition(order.orderId, 'submitted', 'Sent to OpenD');
      expect(order.state).toBe('submitted');
      expect(order.submittedAt).toBeDefined();
    });

    it('04: pending → filled is INVALID (must go through submitted)', () => {
      const order = manager.createOrder({
        symbol: '00700', side: 'buy', quantity: 100, price: 350,
        orderType: 'limit', market: 'HK',
      });
      expect(() => manager.transition(order.orderId, 'filled', 'Direct'))
        .toThrow('Invalid transition');
    });

    it('05: submitted → partial_filled → filled is valid chain', () => {
      const order = manager.createOrder({
        symbol: '00700', side: 'buy', quantity: 100, price: 350,
        orderType: 'limit', market: 'HK',
      });
      manager.transition(order.orderId, 'submitted', 'Sent');
      manager.updateFill(order.orderId, 60, 350);
      expect(order.state).toBe('partial_filled');
      expect(order.remainingQuantity).toBe(40);

      manager.updateFill(order.orderId, 100, 351);
      expect(order.state).toBe('filled');
      expect(order.remainingQuantity).toBe(0);
      expect(order.filledAt).toBeDefined();
    });
  });

  describe('Cancel and Reject', () => {
    it('06: submitted → cancelled is valid', () => {
      const order = manager.createOrder({
        symbol: '09988', side: 'sell', quantity: 200, price: 95,
        orderType: 'limit', market: 'HK',
      });
      manager.transition(order.orderId, 'submitted', 'Sent');
      manager.cancelOrder(order.orderId, 'User requested');
      expect(order.state).toBe('cancelled');
      expect(order.cancelledAt).toBeDefined();
    });

    it('07: pending → rejected is valid', () => {
      const order = manager.createOrder({
        symbol: 'AAPL', side: 'buy', quantity: 10,
        orderType: 'market', market: 'US',
      });
      manager.rejectOrder(order.orderId, 'Risk check failed');
      expect(order.state).toBe('rejected');
      expect(order.rejectReason).toBeUndefined(); // rejected via rejectOrder
    });
  });

  describe('Timeout Management', () => {
    it('08: submitted order over 60s is expired', () => {
      const order = manager.createOrder({
        symbol: '00700', side: 'buy', quantity: 100, price: 350,
        orderType: 'limit', market: 'HK',
      });
      manager.transition(order.orderId, 'submitted', 'Sent');
      // Simulate old submittedAt
      order.submittedAt = new Date(Date.now() - 65000).toISOString(); // 65s ago

      const timedOut = manager.checkTimeouts();
      expect(timedOut.length).toBe(1);
      expect(order.state).toBe('expired');
    });

    it('09: recent submitted order is not expired', () => {
      const order = manager.createOrder({
        symbol: '00700', side: 'buy', quantity: 100, price: 350,
        orderType: 'limit', market: 'HK',
      });
      manager.transition(order.orderId, 'submitted', 'Sent');

      const timedOut = manager.checkTimeouts();
      expect(timedOut.length).toBe(0);
    });
  });

  describe('Audit Trail', () => {
    it('10: each transition creates audit entry', () => {
      const order = manager.createOrder({
        symbol: '00700', side: 'buy', quantity: 100, price: 350,
        orderType: 'limit', market: 'HK',
      });
      manager.transition(order.orderId, 'submitted', 'To OpenD');
      manager.updateFill(order.orderId, 100, 351);

      const audit = manager.getAuditTrail(order.orderId);
      expect(audit.length).toBe(3); // create + submitted + filled
      expect(audit[0].toState).toBe('pending');
      expect(audit[1].toState).toBe('submitted');
      expect(audit[2].toState).toBe('filled');
    });

    it('11: getFullAuditTrail returns all orders sorted', () => {
      const o1 = manager.createOrder({ symbol: 'A', side: 'buy', quantity: 100, orderType: 'market', market: 'US' });
      const o2 = manager.createOrder({ symbol: 'B', side: 'sell', quantity: 10, orderType: 'market', market: 'US' });

      const full = manager.getFullAuditTrail();
      expect(full.length).toBe(2);
      expect(new Date(full[0].timestamp).getTime()).toBeLessThanOrEqual(new Date(full[1].timestamp).getTime());
    });
  });

  describe('Order Queries', () => {
    it('12: getActiveOrders excludes terminal states', () => {
      const o1 = manager.createOrder({ symbol: 'A', side: 'buy', quantity: 100, orderType: 'market', market: 'US' });
      const o2 = manager.createOrder({ symbol: 'B', side: 'sell', quantity: 10, orderType: 'market', market: 'US' });
      manager.transition(o1.orderId, 'rejected', 'Risk');
      manager.transition(o2.orderId, 'submitted', 'Sent');

      const active = manager.getActiveOrders();
      expect(active.length).toBe(1);
      expect(active[0].orderId).toBe(o2.orderId);
    });

    it('13: terminal states are not in active', () => {
      const o = manager.createOrder({ symbol: 'AA', side: 'buy', quantity: 100, orderType: 'market', market: 'US' });
      manager.transition(o.orderId, 'rejected', 'Bad');

      const active = manager.getActiveOrders();
      expect(active.length).toBe(0);
    });
  });
});
