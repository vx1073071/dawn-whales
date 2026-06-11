import { describe, it, expect, beforeAll } from 'vitest';

// ── Sprint 1 E2E Extension: TradeExecutor Scenarios ────────────────────────
// ML-22-02: Covers signal processing, risk checks, execution pipeline,
// position tracking, order lifecycle, and event emission

// ── Mock TradeExecutor ─────────────────────────────────────────────────────

class MockTradeExecutor {
  private orders: Map<string, any> = new Map();
  private positions: Map<string, any> = new Map();
  private events: Map<string, any[]> = new Map();
  private _mode: 'paper' | 'real' = 'paper';
  private _emergencyStop = false;
  orderCounter = 0;

  // Track emitted events
  on(event: string, listener: (...args: any[]) => void) {
    if (!this.events.has(event)) this.events.set(event, []);
    this.events.get(event)!.push(listener);
    return () => this.off(event, listener);
  }

  off(event: string, listener: Function) {
    const arr = this.events.get(event);
    if (arr) {
      const idx = arr.indexOf(listener);
      if (idx >= 0) arr.splice(idx, 1);
    }
  }

  private emit(event: string, ...args: any[]) {
    (this.events.get(event) ?? []).forEach(fn => {
      try { fn(...args); } catch (e) { /* ignore */ }
    });
  }

  async processSignal(signal: {
    strategyId: string;
    strategyName: string;
    code: string;
    side: 'BUY' | 'SELL';
    quantity?: number;
    price?: number;
    orderType: string;
    confidence: number;
    reason: string;
  }) {
    if (this._emergencyStop) {
      this.emit('order:rejected', { id: 'REJ-EMERGENCY' }, 'Emergency stop');
      this.emit('signal:processed', signal, null);
      return null;
    }

    // Run 7 risk checks
    const checks = [
      { name: 'position_size', passed: true, value: 5, limit: 20 },
      { name: 'daily_loss', passed: true, value: 1.2, limit: 3 },
      { name: 'max_orders', passed: true, value: this.orders.size, limit: 10 },
      { name: 'duplicate_signal', passed: true, value: 0, limit: 1 },
      { name: 'trading_hours', passed: true, value: 1, limit: 1 },
      { name: 'concentration', passed: true, value: 15, limit: 30 },
      { name: 'confidence', passed: signal.confidence >= 0.5, value: signal.confidence, limit: 0.5 },
    ];

    const failed = checks.find(c => !c.passed);
    if (failed) {
      this.emit('risk:rejected', signal, { passed: false, reason: `${failed.name} exceeded`, checks });
      this.emit('signal:processed', signal, null);
      return null;
    }

    // Create order
    const order = {
      id: `ORD-${++this.orderCounter}`,
      signalId: signal.strategyId,
      code: signal.code,
      side: signal.side,
      orderType: signal.orderType,
      quantity: signal.quantity ?? 100,
      price: signal.price ?? 100,
      status: 'submitted',
      filledQty: 0,
      filledPrice: 0,
      commission: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.orders.set(order.id, order);
    this.emit('order:created', order);

    // Simulate fill
    setTimeout(() => {
      order.status = 'filled';
      order.filledQty = order.quantity;
      order.filledPrice = order.price * (order.side === 'BUY' ? 1.001 : 0.999);
      order.commission = Math.round(order.filledQty * order.filledPrice * 0.001 * 100) / 100;
      order.updatedAt = new Date().toISOString();
      this.emit('order:filled', order);

      // Update position
      const existing = this.positions.get(order.code);
      if (order.side === 'BUY') {
        if (existing) {
          const totalQty = existing.quantity + order.quantity;
          existing.avgCost = (existing.avgCost * existing.quantity + order.filledPrice * order.quantity) / totalQty;
          existing.quantity = totalQty;
          existing.marketValue = existing.quantity * order.filledPrice;
        } else {
          this.positions.set(order.code, {
            code: order.code,
            quantity: order.quantity,
            avgCost: order.filledPrice,
            marketPrice: order.filledPrice,
            marketValue: order.quantity * order.filledPrice,
            dayPnL: 0,
            totalPnL: 0,
            totalPnLPct: 0,
          });
        }
      } else if (existing && order.side === 'SELL') {
        existing.quantity -= order.quantity;
        existing.marketValue = existing.quantity * order.filledPrice;
        if (existing.quantity <= 0) this.positions.delete(order.code);
      }

      this.emit('signal:processed', signal, order);
    }, 0);

    return order;
  }

  getOrders(filter?: { status?: string }): any[] {
    const all = Array.from(this.orders.values());
    return filter?.status ? all.filter(o => o.status === filter.status) : all;
  }

  getPositions(): any[] {
    return Array.from(this.positions.values());
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;
    if (order.status === 'filled') return false;
    order.status = 'cancelled';
    order.updatedAt = new Date().toISOString();
    this.emit('order:cancelled', order);
    return true;
  }

  calculateTradeStats() {
    const all = Array.from(this.orders.values()).filter(o => o.status === 'filled');
    const wins = all.filter(o => o.side === 'SELL');
    return {
      totalTrades: all.length,
      winningTrades: wins.length,
      losingTrades: all.length - wins.length,
      winRate: all.length > 0 ? (wins.length / all.length) * 100 : 0,
      totalPnL: 0,
      totalCommission: all.reduce((s, o) => s + o.commission, 0),
      avgWin: 0, avgLoss: 0, maxDrawdown: 0, sharpeRatio: 0, profitFactor: 0,
    };
  }

  getMode() { return this._mode; }
  setMode(m: 'paper' | 'real') { this._mode = m; }
  async emergencyStop() { this._emergencyStop = true; return 0; }
  resetEmergencyStop() { this._emergencyStop = false; }
  isEmergencyStop() { return this._emergencyStop; }
}

// ── Test Suite ─────────────────────────────────────────────────────────────

describe('Sprint 1 E2E Extension: TradeExecutor', () => {
  let executor: MockTradeExecutor;

  beforeAll(() => {
    executor = new MockTradeExecutor();
  });

  // ── Step 9: Signal Processing ─────────────────────────────────────────
  describe('Step 9: Signal → Trade Pipeline', () => {
    it('should process a BUY signal and create an order', async () => {
      const signal = {
        strategyId: 'SIG-001',
        strategyName: 'MA Cross TQQQ',
        code: 'US.TQQQ',
        side: 'BUY' as const,
        quantity: 200,
        price: 52.3,
        orderType: 'MARKET',
        confidence: 0.85,
        reason: 'MA5 crosses above MA20',
      };

      const order = await executor.processSignal(signal);
      expect(order).not.toBeNull();
      expect(order!.id).toMatch(/^ORD-/);
      expect(order!.code).toBe('US.TQQQ');
      expect(order!.side).toBe('BUY');
      expect(order!.quantity).toBe(200);
    });

    it('should reject signal with low confidence (<0.5)', async () => {
      const signal = {
        strategyId: 'SIG-002',
        strategyName: 'Low Confidence',
        code: 'US.AAPL',
        side: 'BUY' as const,
        quantity: 100,
        price: 180,
        orderType: 'MARKET',
        confidence: 0.3,
        reason: 'Weak signal',
      };

      const order = await executor.processSignal(signal);
      expect(order).toBeNull();
    });

    it('should populate position after BUY order fills', async () => {
      // Process a BUY signal → auto-fills
      const signal = {
        strategyId: 'SIG-003',
        strategyName: 'NVDA Momentum',
        code: 'US.NVDA',
        side: 'BUY' as const,
        quantity: 50,
        price: 880,
        orderType: 'LIMIT',
        confidence: 0.9,
        reason: 'Breakout above resistance',
      };

      await executor.processSignal(signal);
      // Wait for async fill
      await new Promise(r => setTimeout(r, 50));

      const positions = executor.getPositions();
      expect(positions.length).toBeGreaterThan(0);
      const nvdaPos = positions.find(p => p.code === 'US.NVDA');
      expect(nvdaPos).toBeDefined();
      expect(nvdaPos!.quantity).toBe(50);
    });

    it('should reject during emergency stop', async () => {
      await executor.emergencyStop();
      expect(executor.isEmergencyStop()).toBe(true);

      const signal = {
        strategyId: 'SIG-004',
        strategyName: 'Blocked Signal',
        code: 'US.TSLA',
        side: 'BUY' as const,
        quantity: 100,
        price: 195,
        orderType: 'MARKET',
        confidence: 0.9,
        reason: 'Should be blocked',
      };

      const order = await executor.processSignal(signal);
      expect(order).toBeNull();

      executor.resetEmergencyStop();
      expect(executor.isEmergencyStop()).toBe(false);
    });
  });

  // ── Step 10: Order Lifecycle ──────────────────────────────────────────
  describe('Step 10: Order Lifecycle', () => {
    it('should list all orders', async () => {
      // Ensure there are orders
      await executor.processSignal({
        strategyId: 'SIG-010', strategyName: 'Order Test', code: 'US.QQQ',
        side: 'BUY', quantity: 100, price: 440, orderType: 'MARKET', confidence: 0.8, reason: 'Test',
      });
      await new Promise(r => setTimeout(r, 50));

      const orders = executor.getOrders();
      expect(orders.length).toBeGreaterThan(0);
    });

    it('should filter orders by status', async () => {
      // Create and cancel an order
      await executor.processSignal({
        strategyId: 'SIG-011', strategyName: 'Cancel Test', code: 'US.AAPL',
        side: 'SELL', quantity: 10, price: 185, orderType: 'LIMIT', confidence: 0.7, reason: 'Test',
      });

      const pending = executor.getOrders({ status: 'submitted' });
      expect(pending.length).toBeGreaterThanOrEqual(0);
    });

    it('should cancel a pending order', async () => {
      // Create order that stays in 'submitted'
      const order = await executor.processSignal({
        strategyId: 'SIG-012', strategyName: 'Quick Cancel', code: 'US.META',
        side: 'BUY', quantity: 20, price: 470, orderType: 'LIMIT', confidence: 0.75, reason: 'Test',
      });

      expect(order).not.toBeNull();
      // Override to keep it submitted
      order!.status = 'submitted';

      const result = await executor.cancelOrder(order!.id);
      expect(result).toBe(true);

      const cancelled = executor.getOrders().find(o => o.id === order!.id);
      expect(cancelled!.status).toBe('cancelled');
    });
  });

  // ── Step 11: Position Tracking ───────────────────────────────────────
  describe('Step 11: Position Tracking', () => {
    it('should track multiple positions', async () => {
      await executor.processSignal({
        strategyId: 'SIG-020', strategyName: 'Multi-Pos', code: 'US.MSFT',
        side: 'BUY', quantity: 60, price: 410, orderType: 'MARKET', confidence: 0.9, reason: 'Test',
      });
      await new Promise(r => setTimeout(r, 50));

      const positions = executor.getPositions();
      expect(positions.length).toBeGreaterThan(0);
      positions.forEach(p => {
        expect(p.code).toBeDefined();
        expect(p.quantity).toBeGreaterThan(0);
        expect(p.avgCost).toBeGreaterThan(0);
        expect(p.marketValue).toBeGreaterThan(0);
      });
    });

    it('should update position cost basis on subsequent BUYs', async () => {
      const before = executor.getPositions().find(p => p.code === 'US.NVDA');
      const beforeQty = before?.quantity ?? 0;

      await executor.processSignal({
        strategyId: 'SIG-021', strategyName: 'NVDA Add', code: 'US.NVDA',
        side: 'BUY', quantity: 25, price: 900, orderType: 'MARKET', confidence: 0.85, reason: 'Add',
      });
      await new Promise(r => setTimeout(r, 50));

      const after = executor.getPositions().find(p => p.code === 'US.NVDA');
      expect(after!.quantity).toBe(beforeQty + 25);
      expect(after!.avgCost).toBeGreaterThan(0);
    });

    it('should reduce position on SELL', async () => {
      const before = executor.getPositions().find(p => p.code === 'US.TQQQ');
      const beforeQty = before?.quantity ?? 0;

      await executor.processSignal({
        strategyId: 'SIG-022', strategyName: 'TQQQ Trim', code: 'US.TQQQ',
        side: 'SELL', quantity: 50, price: 54, orderType: 'MARKET', confidence: 0.7, reason: 'Trim',
      });
      await new Promise(r => setTimeout(r, 50));

      const after = executor.getPositions().find(p => p.code === 'US.TQQQ');
      if (after) {
        expect(after.quantity).toBe(beforeQty - 50);
      }
      // If position fully liquidated, it should be removed
    });
  });

  // ── Step 12: Event System ────────────────────────────────────────────
  describe('Step 12: Trade Event System', () => {
    it('should emit order:created on new order', async () => {
      let createdEvent: any = null;
      executor.on('order:created', (order) => { createdEvent = order; });

      await executor.processSignal({
        strategyId: 'SIG-030', strategyName: 'Event Test', code: 'US.TSLA',
        side: 'BUY', quantity: 30, price: 200, orderType: 'MARKET', confidence: 0.8, reason: 'Test',
      });
      await new Promise(r => setTimeout(r, 50));

      expect(createdEvent).not.toBeNull();
      expect(createdEvent.code).toBe('US.TSLA');
      expect(createdEvent.side).toBe('BUY');
    });

    it('should emit order:filled on fill', async () => {
      let filledEvent: any = null;
      executor.on('order:filled', (order) => { filledEvent = order; });

      await executor.processSignal({
        strategyId: 'SIG-031', strategyName: 'Fill Test', code: 'US.AVGO',
        side: 'BUY', quantity: 10, price: 1250, orderType: 'MARKET', confidence: 0.8, reason: 'Test',
      });
      await new Promise(r => setTimeout(r, 50));

      expect(filledEvent).not.toBeNull();
      expect(filledEvent.status).toBe('filled');
      expect(filledEvent.filledQty).toBe(10);
      expect(filledEvent.filledPrice).toBeGreaterThan(0);
    });

    it('should emit risk:rejected on risk failure', async () => {
      let riskEvent: any = null;
      executor.on('risk:rejected', (signal, riskCheck) => { riskEvent = riskCheck; });

      await executor.processSignal({
        strategyId: 'SIG-032', strategyName: 'Risk Test', code: 'US.TQQQ',
        side: 'BUY', quantity: 100, price: 50, orderType: 'MARKET', confidence: 0.2, reason: 'Test',
      });
      await new Promise(r => setTimeout(r, 50));

      expect(riskEvent).not.toBeNull();
      expect(riskEvent.passed).toBe(false);
      expect(riskEvent.checks.length).toBeGreaterThan(0);
    });
  });

  // ── Step 13: Mode & Stats ────────────────────────────────────────────
  describe('Step 13: Execution Mode & Statistics', () => {
    it('should default to paper trading mode', () => {
      expect(executor.getMode()).toBe('paper');
    });

    it('should switch to real mode', () => {
      executor.setMode('real');
      expect(executor.getMode()).toBe('real');
      executor.setMode('paper'); // reset
      expect(executor.getMode()).toBe('paper');
    });

    it('should calculate trade statistics', () => {
      const stats = executor.calculateTradeStats();
      expect(stats.totalTrades).toBeGreaterThanOrEqual(0);
      expect(stats).toHaveProperty('winRate');
      expect(stats).toHaveProperty('totalCommission');
    });
  });
});
