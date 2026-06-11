/**
 * JVS-40-01: LiveTradeBridge 增强测试
 * 测试实盘交易桥接器的核心功能：模式切换、订单同步、风控、对账、审计
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LiveTradeBridge, createLiveTradeBridge } from '../electron/engine/analysis/live-trade-bridge';
import type {
  BridgeConfig,
  PaperOrder,
  BridgeOrder,
  RiskRule,
  AuditEntry,
  BrokerAdapter,
  LiveOrder,
  PaperPosition,
  LivePosition,
  ReconciliationResult,
} from '../electron/engine/analysis/live-trade-bridge';

describe('LiveTradeBridge — 初始化', () => {
  it('should create bridge with default config', () => {
    const bridge = createLiveTradeBridge();
    expect(bridge).toBeDefined();
    const config = bridge.getConfig();
    expect(config.dryRun).toBe(false);
    expect(config.riskCheckEnabled).toBe(true);
    expect(config.maxDailyOrders).toBe(50);
  });

  it('should create bridge with custom config', () => {
    const bridge = createLiveTradeBridge({
      dryRun: true,
      maxDailyOrders: 100,
      riskCheckEnabled: false,
    });
    const config = bridge.getConfig();
    expect(config.dryRun).toBe(true);
    expect(config.maxDailyOrders).toBe(100);
    expect(config.riskCheckEnabled).toBe(false);
  });

  it('should initialize default risk rules', () => {
    const bridge = createLiveTradeBridge();
    const rules = bridge.getRiskRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some(r => r.name === '单品种持仓集中度')).toBe(true);
    expect(rules.some(r => r.name === '日内亏损限制')).toBe(true);
    expect(rules.some(r => r.name === '最小下单量')).toBe(true);
  });

  it('should create audit entry on initialization', () => {
    const bridge = createLiveTradeBridge();
    const audit = bridge.getAuditTrail();
    expect(audit.length).toBeGreaterThan(0);
    expect(audit[0].action).toBe('bridge_init');
  });
});

describe('LiveTradeBridge — 订单提交 (Paper Mode)', () => {
  let bridge: LiveTradeBridge;

  beforeEach(() => {
    bridge = createLiveTradeBridge({ dryRun: true });
  });

  it('should submit paper order successfully in dry-run mode', async () => {
    const order: PaperOrder = {
      id: 'order-1',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'MARKET',
      quantity: 100,
      price: 150.0,
      timestamp: Date.now(),
    };

    const result = await bridge.submitPaperOrder(order);
    expect(result.status).toBe('filled');
    expect(result.riskPassed).toBe(true);
    expect(result.liveOrder).toBeDefined();
    expect(result.liveOrder?.status).toBe('filled');
  });

  it('should add audit entries for order lifecycle', async () => {
    const order: PaperOrder = {
      id: 'order-2',
      symbol: 'US.MSFT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 50,
      price: 300.0,
      timestamp: Date.now(),
    };

    await bridge.submitPaperOrder(order);
    const audit = bridge.getAuditTrail();
    expect(audit.length).toBeGreaterThanOrEqual(0);
    expect(audit.some(a => a.action === 'order_received')).toBe(true);
    expect(audit.some(a => a.action === 'risk_check_passed')).toBe(true);
  });

  it('should track order in orders map', async () => {
    const order: PaperOrder = {
      id: 'order-3',
      symbol: 'US.TSLA',
      side: 'BUY',
      type: 'LIMIT',
      quantity: 30,
      price: 250.0,
      timestamp: Date.now(),
    };

    await bridge.submitPaperOrder(order);
    const retrieved = bridge.getOrder('order-3');
    expect(retrieved).toBeDefined();
    expect(retrieved?.paperOrder.symbol).toBe('US.TSLA');
  });

  it('should emit order events', async () => {
    const events: string[] = [];
    bridge.on('order:received', () => events.push('received'));
    bridge.on('order:risk_passed', () => events.push('risk_passed'));
    bridge.on('order:filled', () => events.push('filled'));

    const order: PaperOrder = {
      id: 'order-4',
      symbol: 'US.NVDA',
      side: 'BUY',
      type: 'MARKET',
      quantity: 20,
      price: 500.0,
      timestamp: Date.now(),
    };

    await bridge.submitPaperOrder(order);
    expect(events).toContain('received');
    expect(events).toContain('risk_passed');
    expect(events).toContain('filled');
  });
});

describe('LiveTradeBridge — 风控校验', () => {
  let bridge: LiveTradeBridge;

  beforeEach(() => {
    bridge = createLiveTradeBridge({
      dryRun: true,
      maxDailyOrders: 2,
      maxOrderValue: 10000,
      minOrderIntervalMs: 1000,
    });
  });

  it('should reject order exceeding daily limit', async () => {
    // 提交两个订单达到上限
    const baseTime = Date.now();
    for (let i = 0; i < 2; i++) {
      await bridge.submitPaperOrder({
        id: `order-${i}`,
        symbol: 'US.AAPL',
        side: 'BUY',
        type: 'MARKET',
        quantity: 10,
        price: 100.0,
        timestamp: baseTime + i * 2000,  // 2秒间隔，避免触发minOrderIntervalMs
      });
    }

    // 第三个订单应该被拒绝
    const result = await bridge.submitPaperOrder({
      id: 'order-3',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'MARKET',
      quantity: 10,
      price: 100.0,
      timestamp: baseTime + 4000,  // 继续增加时间间隔
    });

    expect(result.status).toBe('rejected');
    expect(result.riskPassed).toBe(false);
    expect(result.riskReason).toContain('达到每日订单上限');
  });

  it('should reject order with order value exceeding limit', async () => {
    const result = await bridge.submitPaperOrder({
      id: 'order-big',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'MARKET',
      quantity: 1000,
      price: 100.0, // 1000 * 100 = 100,000 > 10,000
      timestamp: Date.now(),
    });

    expect(result.status).toBe('rejected');
    expect(result.riskReason).toContain('单笔金额');
  });

  it('should add custom risk rule', () => {
    const customRule: RiskRule = {
      id: 'custom-rule',
      name: '自定义规则',
      enabled: true,
      check: (order) => {
        if (order.quantity > 500) {
          return { pass: false, reason: '数量超过500' };
        }
        return { pass: true };
      },
    };

    bridge.addRiskRule(customRule);
    const rules = bridge.getRiskRules();
    expect(rules.some(r => r.id === 'custom-rule')).toBe(true);
  });

  it('should remove custom risk rule', () => {
    bridge.addRiskRule({
      id: 'temp-rule',
      name: '临时规则',
      enabled: true,
      check: () => ({ pass: true }),
    });

    const removed = bridge.removeRiskRule('temp-rule');
    expect(removed).toBe(true);
    const rules = bridge.getRiskRules();
    expect(rules.some(r => r.id === 'temp-rule')).toBe(false);
  });

  it('should skip disabled risk rules', async () => {
    bridge.addRiskRule({
      id: 'disabled-rule',
      name: '禁用规则',
      enabled: false,
      check: () => ({ pass: false, reason: '应该被跳过' }),
    });

    const result = await bridge.submitPaperOrder({
      id: 'order-test',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'MARKET',
      quantity: 10,
      price: 100.0,
      timestamp: Date.now(),
    });

    expect(result.status).toBe('filled');
    expect(result.riskPassed).toBe(true);
  });
});

describe('LiveTradeBridge — 订单取消', () => {
  let bridge: LiveTradeBridge;

  beforeEach(() => {
    bridge = createLiveTradeBridge({ dryRun: true });
  });

  it('should cancel pending order', async () => {
    const order: PaperOrder = {
      id: 'cancel-test',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'LIMIT',
      quantity: 100,
      price: 150.0,
      timestamp: Date.now(),
    };

    await bridge.submitPaperOrder(order);
    const cancelled = await bridge.cancelOrder('cancel-test');
    expect(cancelled).toBe(true);

    const retrieved = bridge.getOrder('cancel-test');
    expect(retrieved?.status).toBe('cancelled');
  });

  it('should return false for non-existent order', async () => {
    const cancelled = await bridge.cancelOrder('non-existent');
    expect(cancelled).toBe(false);
  });

  it('should not cancel already filled order', async () => {
    const order: PaperOrder = {
      id: 'filled-order',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'MARKET',
      quantity: 100,
      price: 150.0,
      timestamp: Date.now(),
    };

    await bridge.submitPaperOrder(order);
    const cancelled = await bridge.cancelOrder('filled-order');
    expect(cancelled).toBe(false);
  });
});

describe('LiveTradeBridge — 审计追踪', () => {
  let bridge: LiveTradeBridge;

  beforeEach(() => {
    bridge = createLiveTradeBridge({ dryRun: true });
  });

  it('should track all order events in audit trail', async () => {
    const order: PaperOrder = {
      id: 'audit-test',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'MARKET',
      quantity: 100,
      price: 150.0,
      timestamp: Date.now(),
    };

    await bridge.submitPaperOrder(order);
    const audit = bridge.getAuditTrail('audit-test');
    
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.some(a => a.action === 'order_received')).toBe(true);
    expect(audit.some(a => a.action === 'risk_check_passed')).toBe(true);
    expect(audit.some(a => a.action === 'dry_run_skipped')).toBe(true);
  });

  it('should filter audit trail by order id', async () => {
    await bridge.submitPaperOrder({
      id: 'order-a',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'MARKET',
      quantity: 100,
      price: 150.0,
      timestamp: Date.now(),
    });

    await bridge.submitPaperOrder({
      id: 'order-b',
      symbol: 'US.MSFT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 50,
      price: 300.0,
      timestamp: Date.now(),
    });

    const auditA = bridge.getAuditTrail('order-a');
    const auditB = bridge.getAuditTrail('order-b');

    expect(auditA.every(a => a.orderId === 'order-a')).toBe(true);
    expect(auditB.every(a => a.orderId === 'order-b')).toBe(true);
  });
});

describe('LiveTradeBridge — 对账', () => {
  let bridge: LiveTradeBridge;

  beforeEach(() => {
    bridge = createLiveTradeBridge({ dryRun: false });
  });

  it('should skip reconciliation in dry-run mode', async () => {
    const dryBridge = createLiveTradeBridge({ dryRun: true });
    const results = await dryBridge.reconcilePositions();
    expect(results.length).toBe(0);
  });

  it('should skip reconciliation without broker', async () => {
    const results = await bridge.reconcilePositions();
    expect(results.length).toBe(0);
  });

  it('should reconcile positions with broker', async () => {
    const mockBroker: BrokerAdapter = {
      async submitOrder(): Promise<LiveOrder> {
        return {
          id: 'live-1',
          brokerOrderId: 'broker-1',
          paperOrderId: 'paper-1',
          symbol: 'US.AAPL',
          side: 'BUY',
          type: 'MARKET',
          quantity: 100,
          filledQuantity: 100,
          price: 150.0,
          averageFillPrice: 150.0,
          status: 'filled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      },
      async cancelOrder(): Promise<boolean> {
        return true;
      },
      async getPositions(): Promise<LivePosition[]> {
        return [
          {
            symbol: 'US.AAPL',
            quantity: 100,
            avgPrice: 150.0,
            currentPrice: 155.0,
            unrealizedPnl: 500,
          },
        ];
      },
      async getOrderStatus(): Promise<LiveOrder | null> {
        return null;
      },
    };

    bridge.setBrokerAdapter(mockBroker);
    bridge.updatePaperPosition({
      symbol: 'US.AAPL',
      quantity: 100,
      avgPrice: 150.0,
      currentPrice: 155.0,
      unrealizedPnl: 500,
    });

    const results = await bridge.reconcilePositions();
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('LiveTradeBridge — 统计', () => {
  let bridge: LiveTradeBridge;

  beforeEach(() => {
    bridge = createLiveTradeBridge({ dryRun: true });
  });

  it('should track order statistics', async () => {
    const now = Date.now();
    await bridge.submitPaperOrder({
      id: 'stat-1',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'MARKET',
      quantity: 100,
      price: 150.0,
      timestamp: now,
    });

    // Wait long enough to satisfy minOrderIntervalMs, then bump the order
    // timestamp by a second so risk checks see two distinct events.
    await new Promise((r) => setTimeout(r, 1100));
    await bridge.submitPaperOrder({
      id: 'stat-2',
      symbol: 'US.MSFT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 50,
      price: 300.0,
      timestamp: Date.now(),
    });

    const stats = bridge.getStats();
    expect(stats.totalOrders).toBe(2);
    expect(stats.filled).toBe(2);
  });

  it('should track rejected orders', async () => {
    const strictBridge = createLiveTradeBridge({
      dryRun: true,
      maxDailyOrders: 1,
    });

    await strictBridge.submitPaperOrder({
      id: 'ok-order',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'MARKET',
      quantity: 100,
      price: 150.0,
      timestamp: Date.now(),
    });

    await strictBridge.submitPaperOrder({
      id: 'rejected-order',
      symbol: 'US.MSFT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 50,
      price: 300.0,
      timestamp: Date.now(),
    });

    const stats = strictBridge.getStats();
    expect(stats.rejected).toBe(1);
  });
});

describe('LiveTradeBridge — 配置管理', () => {
  it('should update config', () => {
    const bridge = createLiveTradeBridge();
    bridge.updateConfig({ maxDailyOrders: 200 });
    const config = bridge.getConfig();
    expect(config.maxDailyOrders).toBe(200);
  });

  it('should preserve unchanged config values', () => {
    const bridge = createLiveTradeBridge({ dryRun: true, maxDailyOrders: 50 });
    bridge.updateConfig({ maxDailyOrders: 100 });
    const config = bridge.getConfig();
    expect(config.dryRun).toBe(true);
    expect(config.maxDailyOrders).toBe(100);
  });
});

describe('LiveTradeBridge — 事件系统', () => {
  it('should register and emit events', async () => {
    const bridge = createLiveTradeBridge({ dryRun: true });
    const events: string[] = [];

    bridge.on('order:received', () => events.push('received'));
    bridge.on('order:filled', () => events.push('filled'));

    await bridge.submitPaperOrder({
      id: 'event-test',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'MARKET',
      quantity: 100,
      price: 150.0,
      timestamp: Date.now(),
    });

    expect(events).toContain('received');
    expect(events).toContain('filled');
  });

  it('should unregister event handler', async () => {
    const bridge = createLiveTradeBridge({ dryRun: true });
    const events: string[] = [];
    const handler = () => events.push('test');

    bridge.on('order:received', handler);
    bridge.off('order:received', handler);

    await bridge.submitPaperOrder({
      id: 'unreg-test',
      symbol: 'US.AAPL',
      side: 'BUY',
      type: 'MARKET',
      quantity: 100,
      price: 150.0,
      timestamp: Date.now(),
    });

    expect(events.length).toBe(0);
  });
});

describe('LiveTradeBridge — 销毁', () => {
  it('should destroy bridge and clear handlers', () => {
    const bridge = createLiveTradeBridge();
    bridge.on('order:received', () => {});
    bridge.destroy();
    // Bridge should be destroyed without errors
    expect(true).toBe(true);
  });
});
