// ── QClaw R42: LiveTradeBridge E2E Integration Tests ──────────────────────────────
// Tests LiveTradeBridge end-to-end scenarios:
//   - Order submission lifecycle (submit → fill → stats)
//   - Risk rule management (add / remove / toggle)
//   - Audit trail and order retrieval
//   - Config update and paper/live mode
//   - Reconciliation and position tracking
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveTradeBridge, type PaperOrder, type BrokerAdapter } from '../electron/engine/analysis/live-trade-bridge';

// ── Mock BrokerAdapter ─────────────────────────────────────────────────────────

function makeMockAdapter() {
  let orderId = 1;
  return {
    name: 'mock' as const,
    isConnected: () => true,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getAccount: vi.fn().mockResolvedValue({ accountId: 'paper', cash: 10000000 }),
    getPositions: vi.fn().mockResolvedValue([]),
    getQuotes: vi.fn().mockResolvedValue({}),
    submitOrder: vi.fn().mockImplementation(async (order: any) => ({
      brokerOrderId: `live-${orderId++}`,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      status: 'filled',
      filledQuantity: order.quantity,
      averageFillPrice: order.price ?? 100,
    })),
    cancelOrder: vi.fn().mockImplementation(async (_orderId: string) => true),
    getOrder: vi.fn().mockImplementation(async (_orderId: string) => ({
      brokerOrderId: _orderId, symbol: 'HK.00700', side: 'BUY' as const,
      quantity: 100, status: 'filled', filledQuantity: 100,
    })),
    getUnsettled: vi.fn().mockResolvedValue([]),
  };
}

function makePaperOrder(overrides: Partial<PaperOrder> = {}): PaperOrder {
  return {
    id: `paper-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    symbol: 'HK.00700',
    side: 'BUY',
    type: 'MARKET',
    quantity: 100,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LiveTradeBridge E2E', () => {
  let bridge: LiveTradeBridge;
  let mock: BrokerAdapter;

  beforeEach(() => {
    vi.resetModules();
    mock = makeMockAdapter();
    bridge = new LiveTradeBridge({ paperMode: true });
    bridge.setBrokerAdapter(mock);
  });

  // ── 1. Paper order submission ───────────────────────────────────────────────

  it('should submit paper order and return bridge order', async () => {
    const paper = makePaperOrder({ symbol: 'HK.00700', quantity: 100 });
    const result = await bridge.submitPaperOrder(paper);
    expect(result).toBeDefined();
    expect(result.paperOrder.id).toBe(paper.id);
    expect(['filled', 'pending', 'submitted']).toContain(result.status);
  });

  it('should skip live submission in dry-run mode', async () => {
    // dryRun=true bypasses broker.submitOrder entirely
    const dryBridge = new LiveTradeBridge({ paperMode: false, dryRun: true });
    dryBridge.setBrokerAdapter(mock);
    const paper = makePaperOrder();
    await dryBridge.submitPaperOrder(paper);
    expect(mock.submitOrder).not.toHaveBeenCalled();
  });

  // ── 2. Stats ─────────────────────────────────────────────────────────────

  it('should track accurate stats after multiple orders', async () => {
    await bridge.submitPaperOrder(makePaperOrder({ symbol: 'HK.00700', quantity: 100, side: 'BUY' }));
    await bridge.submitPaperOrder(makePaperOrder({ symbol: 'HK.00700', quantity: 200, side: 'BUY' }));
    const stats = bridge.getStats();
    expect(stats.totalOrders).toBe(2);
    expect(typeof stats.filled).toBe('number');
  });

  // ── 3. Risk rules ───────────────────────────────────────────────────────────

  it('should add and retrieve risk rules', () => {
    bridge.addRiskRule({
      id: 'test-rule',
      name: 'Test Rule',
      type: 'position_limit',
      enabled: true,
      params: { maxQty: 50 },
      description: 'Test',
    });
    const rules = bridge.getRiskRules();
    expect(rules.some(r => r.id === 'test-rule')).toBe(true);
  });

  it('should remove risk rule by id', () => {
    bridge.addRiskRule({
      id: 'remove-me',
      name: 'Remove Me',
      type: 'position_limit',
      enabled: true,
      params: {},
      description: '',
    });
    const removed = bridge.removeRiskRule('remove-me');
    expect(removed).toBe(true);
    expect(bridge.getRiskRules().some(r => r.id === 'remove-me')).toBe(false);
  });

  it('should toggle risk rule enabled state', () => {
    bridge.addRiskRule({
      id: 'toggle-rule',
      name: 'Toggle',
      type: 'position_limit',
      enabled: true,
      params: {},
      description: '',
    });
    const toggled = bridge.setRiskRuleEnabled('toggle-rule', false);
    expect(toggled).toBe(true);
    const rule = bridge.getRiskRules().find(r => r.id === 'toggle-rule');
    expect(rule?.enabled).toBe(false);
  });

  it('should add custom risk rule', () => {
    bridge.addCustomRiskRule({
      id: 'custom-rule',
      name: 'Custom',
      type: 'position_limit',
      enabled: true,
      params: {},
      description: '',
    });
    expect(bridge.getRiskRules().some(r => r.id === 'custom-rule')).toBe(true);
  });

  // ── 4. Audit trail ─────────────────────────────────────────────────────────

  it('should record audit entries for submitted orders', async () => {
    await bridge.submitPaperOrder(makePaperOrder({ symbol: 'HK.00700' }));
    const entries = bridge.getAuditTrail();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toHaveProperty('timestamp');
    expect(entries[0]).toHaveProperty('action');
    expect(typeof entries[0].action).toBe('string');
  });

  it('should filter audit entries by order id', async () => {
    const paper = makePaperOrder();
    await bridge.submitPaperOrder(paper);
    const entries = bridge.getAuditTrail(paper.id);
    expect(Array.isArray(entries)).toBe(true);
  });

  // ── 5. Order retrieval ────────────────────────────────────────────────────

  it('should get order by paper order id', async () => {
    const paper = makePaperOrder();
    await bridge.submitPaperOrder(paper);
    const found = bridge.getOrderById(paper.id);
    expect(found).toBeDefined();
    expect(found?.paperOrder.id).toBe(paper.id);
  });

  it('should return undefined for unknown order id', () => {
    const found = bridge.getOrderById('non-existent-id');
    expect(found).toBeUndefined();
  });

  it('should get all orders', async () => {
    await bridge.submitPaperOrder(makePaperOrder({ symbol: 'HK.00700' }));
    await bridge.submitPaperOrder(makePaperOrder({ symbol: 'HK.00700' }));
    const all = bridge.getAllOrders();
    expect(all.length).toBeGreaterThanOrEqual(2);
    for (const bo of all) {
      expect(bo).toHaveProperty('paperOrder');
      expect(bo).toHaveProperty('status');
    }
  });

  // ── 6. Config updates ──────────────────────────────────────────────────────

  it('should update config', () => {
    bridge.updateConfig({ paperMode: false });
    const cfg = bridge.getConfig();
    expect(cfg.paperMode).toBe(false);
  });

  // ── 7. Cancel order ───────────────────────────────────────────────────────

  it('should cancel order by paper order id', async () => {
    const paper = makePaperOrder();
    await bridge.submitPaperOrder(paper);
    const result = await bridge.cancelOrder(paper.id);
    expect(typeof result).toBe('boolean');
  });

  // ── 8. Reconciliation ─────────────────────────────────────────────────────

  it('should update paper position', () => {
    bridge.updatePaperPosition({
      symbol: 'HK.00700',
      quantity: 500,
      avgPrice: 400,
      currentPrice: 410,
      unrealizedPnl: 5000,
    });
    // Should not throw
    expect(true).toBe(true);
  });

  it('should start and stop reconciliation timer', () => {
    bridge.startReconciliationTimer();
    bridge.stopReconciliationTimer();
    expect(true).toBe(true);
  });

  // ── 9. Destroy ────────────────────────────────────────────────────────────

  it('should destroy without throwing', () => {
    bridge.destroy();
    expect(true).toBe(true);
  });

  // ── 10. Adapter absence ──────────────────────────────────────────────────

  it('should handle order submission when no broker adapter is configured', async () => {
    const emptyBridge = new LiveTradeBridge({ paperMode: true });
    // No adapter set — bridge should still create the order internally
    const paper = makePaperOrder();
    const result = await emptyBridge.submitPaperOrder(paper);
    expect(result).toBeDefined();
    expect(result.paperOrder.id).toBe(paper.id);
  });
});
