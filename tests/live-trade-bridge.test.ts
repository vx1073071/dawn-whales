// ── JVS-39-03: LiveTradeBridge Test ─────────────────────────────────────────
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LiveTradeBridge,
  PaperOrder,
  BrokerAdapter,
  LiveOrder,
  LivePosition,
  PaperPosition,
} from '../electron/engine/live-trade-bridge';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<PaperOrder> = {}): PaperOrder {
  return {
    id: `order-${Math.random().toString(36).slice(2, 8)}`,
    symbol: 'US.AAPL',
    side: 'BUY',
    type: 'MARKET',
    quantity: 100,
    price: 150,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeLiveOrder(order: PaperOrder, status = 'filled'): LiveOrder {
  return {
    id: `live-${order.id}`,
    brokerOrderId: `BRK-${order.id}`,
    paperOrderId: order.id,
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    quantity: order.quantity,
    filledQuantity: status === 'filled' ? order.quantity : 50,
    price: order.price,
    averageFillPrice: order.price,
    status: status as any,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function mockBroker(overrides: Partial<BrokerAdapter> = {}): BrokerAdapter {
  return {
    submitOrder: vi.fn(async (o: PaperOrder) => makeLiveOrder(o, 'filled')),
    cancelOrder: vi.fn(async () => true),
    getPositions: vi.fn(async () => []),
    getOrderStatus: vi.fn(async () => null),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('JVS-39-03: LiveTradeBridge', () => {
  let bridge: LiveTradeBridge;
  let broker: BrokerAdapter;

  beforeEach(() => {
    bridge = new LiveTradeBridge({ riskCheckEnabled: false, minOrderIntervalMs: 0 });
    broker = mockBroker();
    bridge.setBrokerAdapter(broker);
  });

  // ── 1. Basic order submission ──

  it('should submit paper order and sync to live', async () => {
    const order = makeOrder();
    const result = await bridge.submitPaperOrder(order);

    expect(result.status).toBe('filled');
    expect(result.liveOrder).toBeDefined();
    expect(result.riskPassed).toBe(true);
    expect(broker.submitOrder).toHaveBeenCalledOnce();
  });

  // ── 2. Dry-run mode ──

  it('should skip live submission in dry-run mode', async () => {
    bridge = new LiveTradeBridge({ dryRun: true, riskCheckEnabled: false });
    const order = makeOrder();
    const result = await bridge.submitPaperOrder(order);

    expect(result.status).toBe('filled');
    expect(result.liveOrder?.brokerOrderId).toContain('DRY-');
  });

  // ── 3. No broker adapter ──

  it('should fail when no broker adapter is configured', async () => {
    bridge = new LiveTradeBridge({ riskCheckEnabled: false });
    const order = makeOrder();
    const result = await bridge.submitPaperOrder(order);

    expect(result.status).toBe('failed');
    expect(result.riskReason).toContain('No broker adapter');
  });

  // ── 4. Risk: daily order limit ──

  it('should reject order when daily limit reached', async () => {
    bridge = new LiveTradeBridge({ riskCheckEnabled: true, maxDailyOrders: 2, minOrderIntervalMs: 0 });
    bridge.setBrokerAdapter(broker);

    await bridge.submitPaperOrder(makeOrder({ id: 'o1' }));
    await bridge.submitPaperOrder(makeOrder({ id: 'o2' }));
    const result = await bridge.submitPaperOrder(makeOrder({ id: 'o3' }));

    expect(result.status).toBe('rejected');
    expect(result.riskReason).toContain('每日订单上限');
  });

  // ── 5. Risk: max order value ──

  it('should reject order exceeding max order value', async () => {
    bridge = new LiveTradeBridge({
      riskCheckEnabled: true,
      maxOrderValue: 1000,
      minOrderIntervalMs: 0,
    });
    bridge.setBrokerAdapter(broker);

    const order = makeOrder({ quantity: 100, price: 150 }); // value = 15000
    const result = await bridge.submitPaperOrder(order);

    expect(result.status).toBe('rejected');
    expect(result.riskReason).toContain('单笔金额');
  });

  // ── 6. Risk: min order interval ──

  it('should reject order placed too quickly', async () => {
    bridge = new LiveTradeBridge({
      riskCheckEnabled: true,
      minOrderIntervalMs: 60_000,
    });
    bridge.setBrokerAdapter(broker);

    await bridge.submitPaperOrder(makeOrder({ id: 'fast1', timestamp: Date.now() }));
    const result = await bridge.submitPaperOrder(makeOrder({ id: 'fast2', timestamp: Date.now() }));

    expect(result.status).toBe('rejected');
    expect(result.riskReason).toContain('下单间隔过短');
  });

  // ── 7. Risk: custom rule ──

  it('should apply custom risk rules', async () => {
    bridge = new LiveTradeBridge({ riskCheckEnabled: true, minOrderIntervalMs: 0 });
    bridge.setBrokerAdapter(broker);
    bridge.addRiskRule({
      id: 'no_tsla',
      name: '禁止TSLA',
      enabled: true,
      check: (order) => {
        if (order.symbol === 'US.TSLA') return { pass: false, reason: 'TSLA 已被禁止' };
        return { pass: true };
      },
    });

    const result = await bridge.submitPaperOrder(makeOrder({ symbol: 'US.TSLA' }));
    expect(result.status).toBe('rejected');
    expect(result.riskReason).toContain('TSLA 已被禁止');
  });

  // ── 8. Risk: disable custom rule ──

  it('should skip disabled risk rules', async () => {
    bridge = new LiveTradeBridge({ riskCheckEnabled: true, minOrderIntervalMs: 0 });
    bridge.setBrokerAdapter(broker);
    bridge.addRiskRule({
      id: 'always_fail',
      name: 'Always fail',
      enabled: false,
      check: () => ({ pass: false, reason: 'disabled' }),
    });

    const result = await bridge.submitPaperOrder(makeOrder());
    expect(result.status).toBe('filled');
  });

  // ── 9. Cancel order ──

  it('should cancel a pending order', async () => {
    (broker.submitOrder as any).mockResolvedValueOnce(makeLiveOrder(makeOrder(), 'submitted'));
    const order = makeOrder();
    await bridge.submitPaperOrder(order);

    const cancelled = await bridge.cancelOrder(order.id);
    expect(cancelled).toBe(true);
    expect(bridge.getOrder(order.id)?.status).toBe('cancelled');
    expect(broker.cancelOrder).toHaveBeenCalledOnce();
  });

  // ── 10. Cancel non-existent order ──

  it('should return false when cancelling unknown order', async () => {
    const result = await bridge.cancelOrder('nonexistent');
    expect(result).toBe(false);
  });

  // ── 11. Cancel already filled order ──

  it('should not cancel a filled order', async () => {
    const order = makeOrder();
    await bridge.submitPaperOrder(order);

    const result = await bridge.cancelOrder(order.id);
    expect(result).toBe(false);
  });

  // ── 12. Partial fill ──

  it('should handle partial fills', async () => {
    const partialLive = makeLiveOrder(makeOrder(), 'partial_fill');
    (broker.submitOrder as any).mockResolvedValueOnce(partialLive);

    const order = makeOrder();
    const result = await bridge.submitPaperOrder(order);

    expect(result.status).toBe('partial_fill');
    expect(result.liveOrder?.filledQuantity).toBe(50);
  });

  // ── 13. Update partial fill to full ──

  it('should upgrade partial fill to full fill', async () => {
    const partialLive = makeLiveOrder(makeOrder(), 'partial_fill');
    (broker.submitOrder as any).mockResolvedValueOnce(partialLive);

    const order = makeOrder({ id: 'partial-order' });
    await bridge.submitPaperOrder(order);
    expect(bridge.getOrder(order.id)?.status).toBe('partial_fill');

    bridge.updatePartialFill(order.id, 100, 151);
    expect(bridge.getOrder(order.id)?.status).toBe('filled');
  });

  // ── 14. Position reconciliation (no diff) ──

  it('should reconcile positions with no diff', async () => {
    bridge = new LiveTradeBridge({ riskCheckEnabled: false });
    broker = mockBroker({
      getPositions: vi.fn(async (): Promise<LivePosition[]> => [
        { symbol: 'US.AAPL', quantity: 100, avgPrice: 150, currentPrice: 155, unrealizedPnl: 500 },
      ]),
    });
    bridge.setBrokerAdapter(broker);
    bridge.updatePaperPosition({
      symbol: 'US.AAPL',
      quantity: 100,
      avgPrice: 150,
      currentPrice: 155,
      unrealizedPnl: 500,
    });

    const results = await bridge.reconcilePositions();
    expect(results.length).toBe(1);
    expect(results[0].delta).toBe(0);
    expect(results[0].action).toBe('none');
  });

  // ── 15. Position reconciliation (diff found) ──

  it('should detect position discrepancies', async () => {
    bridge = new LiveTradeBridge({ riskCheckEnabled: false });
    broker = mockBroker({
      getPositions: vi.fn(async (): Promise<LivePosition[]> => [
        { symbol: 'US.AAPL', quantity: 80, avgPrice: 150, currentPrice: 155, unrealizedPnl: 400 },
      ]),
    });
    bridge.setBrokerAdapter(broker);
    bridge.updatePaperPosition({
      symbol: 'US.AAPL',
      quantity: 100,
      avgPrice: 150,
      currentPrice: 155,
      unrealizedPnl: 500,
    });

    const results = await bridge.reconcilePositions();
    expect(results.length).toBe(1);
    expect(results[0].delta).toBe(20);
    expect(results[0].action).toBe('manual_review');
  });

  // ── 16. Audit trail ──

  it('should maintain audit trail for each order', async () => {
    const order = makeOrder();
    await bridge.submitPaperOrder(order);

    const audit = bridge.getAuditTrail(order.id);
    expect(audit.length).toBeGreaterThanOrEqual(3); // received, risk_passed, submitted, filled
    expect(audit.some((e) => e.action === 'order_received')).toBe(true);
    expect(audit.some((e) => e.action === 'order_filled')).toBe(true);
  });

  // ── 17. Full audit log ──

  it('should return all audit entries when no orderId filter', async () => {
    await bridge.submitPaperOrder(makeOrder({ id: 'a1' }));
    await bridge.submitPaperOrder(makeOrder({ id: 'a2' }));

    const all = bridge.getAuditTrail();
    expect(all.length).toBeGreaterThanOrEqual(4);
  });

  // ── 18. getStats ──

  it('should return accurate statistics', async () => {
    await bridge.submitPaperOrder(makeOrder({ id: 's1' }));
    await bridge.submitPaperOrder(makeOrder({ id: 's2' }));

    const stats = bridge.getStats();
    expect(stats.totalOrders).toBe(2);
    expect(stats.filled).toBe(2);
  });

  // ── 19. Event emitter ──

  it('should emit events on order lifecycle', async () => {
    const receivedHandler = vi.fn();
    const filledHandler = vi.fn();
    bridge.on('order:received', receivedHandler);
    bridge.on('order:filled', filledHandler);

    await bridge.submitPaperOrder(makeOrder());

    expect(receivedHandler).toHaveBeenCalledOnce();
    expect(filledHandler).toHaveBeenCalledOnce();
  });

  // ── 20. Broker rejection ──

  it('should handle broker rejection', async () => {
    const rejectedLive = makeLiveOrder(makeOrder(), 'rejected');
    rejectedLive.error = 'Insufficient margin';
    (broker.submitOrder as any).mockResolvedValueOnce(rejectedLive);

    const result = await bridge.submitPaperOrder(makeOrder());
    expect(result.status).toBe('rejected');
    expect(result.auditEntries.some((e) => e.detail.includes('Insufficient margin'))).toBe(true);
  });

  // ── 21. Broker submission error ──

  it('should handle broker submission exception', async () => {
    (broker.submitOrder as any).mockRejectedValueOnce(new Error('Network timeout'));

    const result = await bridge.submitPaperOrder(makeOrder());
    expect(result.status).toBe('failed');
    expect(result.auditEntries.some((e) => e.detail.includes('Network timeout'))).toBe(true);
  });

  // ── 22. Remove risk rule ──

  it('should remove risk rule by id', () => {
    bridge.addRiskRule({
      id: 'temp',
      name: 'temp',
      enabled: true,
      check: () => ({ pass: true }),
    });
    expect(bridge.removeRiskRule('temp')).toBe(true);
    expect(bridge.removeRiskRule('nonexistent')).toBe(false);
  });

  // ── 23. Config update ──

  it('should update config', () => {
    bridge.updateConfig({ maxDailyOrders: 200 });
    expect(bridge.getConfig().maxDailyOrders).toBe(200);
  });

  // ── 24. Reconciliation skip in dry-run ──

  it('should skip reconciliation in dry-run mode', async () => {
    bridge = new LiveTradeBridge({ dryRun: true });
    const results = await bridge.reconcilePositions();
    expect(results).toEqual([]);
  });

  // ── 25. Destroy cleans up ──

  it('should clean up on destroy', () => {
    bridge.startReconciliationTimer();
    bridge.destroy();
    // Should not throw; timer should be cleared
    expect(bridge.getAllOrders()).toEqual([]);
  });
});
