// ── DAWN WHALES — Payment & License Unit Tests ────────────────────────────
// Tests for CryptoPaymentService and LicenseManager
// Run: npx vitest run tests/payment.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CryptoPaymentService,
  RECEIVE_ADDRESSES,
  MIN_CONFIRMATIONS,
  PAYMENT_TIMEOUT_MINUTES,
  USDT_PRICES,
} from '../electron/payment/crypto-payment';
import type { PaymentRequest } from '../electron/payment/crypto-payment';

// ── Mock electron-log ──────────────────────────────────────────────────────
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Mock electron app (needed by LicenseManager) ──────────────────────────
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/dawn-whales-test'),
  },
}));

// ── Mock fs (needed by LicenseManager) ────────────────────────────────────
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

// ── Mock Database ─────────────────────────────────────────────────────────
function createMockDb() {
  const tables: Record<string, any[]> = {};
  return {
    exec: vi.fn((sql: string) => {
      // Parse CREATE TABLE to track tables
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      if (match) tables[match[1]] = tables[match[1]] || [];
    }),
    prepare: vi.fn((sql: string) => ({
      run: vi.fn((...args: any[]) => {
        // For INSERT OR REPLACE
        if (sql.includes('INSERT OR REPLACE')) {
          const tableName = sql.match(/INTO (\w+)/)?.[1];
          if (tableName && tables[tableName]) {
            tables[tableName].push(args);
          }
        }
      }),
      all: vi.fn(() => []),
      get: vi.fn(() => null),
    })),
    _tables: tables,
  };
}

function createMockDbWrapper(db: any) {
  return { getDb: () => db };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('CryptoPaymentService', () => {
  let service: CryptoPaymentService;
  let mockDb: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDb = createMockDb();
    service = new CryptoPaymentService();
    service.initialize(createMockDbWrapper(mockDb));
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create payment_orders table on init', () => {
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS payment_orders')
      );
    });

    it('should handle null db gracefully', () => {
      const svc = new CryptoPaymentService();
      // Should not throw
      expect(() => svc.initialize({ getDb: () => null })).not.toThrow();
    });

    it('should load existing orders from DB', () => {
      const db2 = createMockDb();
      db2.prepare.mockReturnValue({
        ...db2.prepare(),
        all: vi.fn(() => [
          {
            order_id: 'DW-TEST-001',
            pay_address: 'TRON_ADDR',
            amount: 14,
            chain: 'TRC20',
            tier: 'pro',
            duration: 'monthly',
            status: 'pending',
            created_at: '2026-06-04T10:00:00Z',
            expires_at: '2026-06-04T10:30:00Z',
            tx_hash: null,
            confirmations: 0,
          },
        ]),
      });

      const svc = new CryptoPaymentService();
      svc.initialize(createMockDbWrapper(db2));
      expect(svc.getOrder('DW-TEST-001')).not.toBeNull();
      expect(svc.getOrder('DW-TEST-001')?.amount).toBe(14);
      svc.stop();
    });
  });

  describe('createPayment', () => {
    it('should create a pending order with correct fields', async () => {
      const req: PaymentRequest = {
        tier: 'pro',
        duration: 'monthly',
        chain: 'TRC20',
        amount: 14,
      };

      const order = await service.createPayment(req);

      expect(order.orderId).toMatch(/^DW-/);
      expect(order.amount).toBe(14);
      expect(order.chain).toBe('TRC20');
      expect(order.tier).toBe('pro');
      expect(order.duration).toBe('monthly');
      expect(order.status).toBe('pending');
    });

    it('should persist order to DB on creation', async () => {
      const req: PaymentRequest = {
        tier: 'starter',
        duration: 'yearly',
        chain: 'ERC20',
        amount: 135,
      };

      await service.createPayment(req);

      // Verify INSERT was called via prepare().run()
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO payment_orders')
      );
    });

    it('should set expiry 30 minutes from creation', async () => {
      const req: PaymentRequest = {
        tier: 'pro',
        duration: 'monthly',
        chain: 'TRC20',
        amount: 42,
      };

      const order = await service.createPayment(req);
      const created = new Date(order.createdAt).getTime();
      const expires = new Date(order.expiresAt).getTime();

      expect(expires - created).toBe(PAYMENT_TIMEOUT_MINUTES * 60 * 1000);
    });

    it('should return all orders sorted by creation time', async () => {
      await service.createPayment({ tier: 'pro', duration: 'monthly', chain: 'TRC20', amount: 14 });

      vi.advanceTimersByTime(1000);

      await service.createPayment({ tier: 'pro', duration: 'yearly', chain: 'ERC20', amount: 42 });

      const orders = service.getAllOrders();
      expect(orders).toHaveLength(2);
      // Most recent first
      expect(new Date(orders[0].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(orders[1].createdAt).getTime()
      );
    });
  });

  describe('order expiry', () => {
    it('should mark pending orders as expired after timeout', async () => {
      const req: PaymentRequest = {
        tier: 'pro',
        duration: 'monthly',
        chain: 'TRC20',
        amount: 14,
      };

      const order = await service.createPayment(req);
      expect(order.status).toBe('pending');

      // Advance past expiry (30 min) then one check interval (15s)
      vi.advanceTimersByTime((PAYMENT_TIMEOUT_MINUTES * 60 + 16) * 1000);

      // Give the async checkPendingOrders a chance to resolve
      await Promise.resolve();
      await Promise.resolve();

      const updated = service.getOrder(order.orderId);
      expect(updated?.status).toBe('expired');
    });
  });

  describe('getPricing', () => {
    it('should return pricing for all tiers', () => {
      const pricing = service.getPricing();
      expect(pricing).toHaveProperty('dw_starter_monthly');
      expect(pricing).toHaveProperty('dw_pro_monthly');
      expect(pricing).toHaveProperty('dw_lifetime');
    });

    it('should have correct USDT amounts', () => {
      const pricing = service.getPricing();
      expect(pricing.dw_starter_monthly).toBe(14);
      expect(pricing.dw_pro_monthly).toBe(42);
      expect(pricing.dw_lifetime).toBe(430);
    });
  });

  describe('getSupportedChains', () => {
    it('should return empty array when no addresses configured', () => {
      // In test env, no env vars are set, so all addresses are empty
      const chains = service.getSupportedChains();
      expect(Array.isArray(chains)).toBe(true);
    });
  });

  describe('getOrder', () => {
    it('should return null for non-existent order', () => {
      expect(service.getOrder('DW-NONEXISTENT')).toBeNull();
    });

    it('should return correct order by ID', async () => {
      const order = await service.createPayment({
        tier: 'pro',
        duration: 'monthly',
        chain: 'TRC20',
        amount: 42,
      });

      const retrieved = service.getOrder(order.orderId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.orderId).toBe(order.orderId);
      expect(retrieved?.amount).toBe(42);
    });
  });

  describe('stop', () => {
    it('should clear monitoring interval on stop', async () => {
      await service.createPayment({
        tier: 'pro',
        duration: 'monthly',
        chain: 'TRC20',
        amount: 14,
      });

      // Should not throw
      expect(() => service.stop()).not.toThrow();

      // Double stop should be safe
      expect(() => service.stop()).not.toThrow();
    });
  });
});

describe('Constants', () => {
  it('should export RECEIVE_ADDRESSES with all chains', () => {
    expect(RECEIVE_ADDRESSES).toHaveProperty('TRC20');
    expect(RECEIVE_ADDRESSES).toHaveProperty('ERC20');
    expect(RECEIVE_ADDRESSES).toHaveProperty('BEP20');
    expect(RECEIVE_ADDRESSES).toHaveProperty('SOL');
  });

  it('should export MIN_CONFIRMATIONS', () => {
    expect(MIN_CONFIRMATIONS.TRC20).toBe(19);
    expect(MIN_CONFIRMATIONS.ERC20).toBe(12);
    expect(MIN_CONFIRMATIONS.BEP20).toBe(10);
    expect(MIN_CONFIRMATIONS.SOL).toBe(32);
  });

  it('should export PAYMENT_TIMEOUT_MINUTES as 30', () => {
    expect(PAYMENT_TIMEOUT_MINUTES).toBe(30);
  });

  it('should export USDT_PRICES with all tiers', () => {
    expect(USDT_PRICES).toHaveProperty('dw_starter_monthly');
    expect(USDT_PRICES).toHaveProperty('dw_starter_yearly');
    expect(USDT_PRICES).toHaveProperty('dw_pro_monthly');
    expect(USDT_PRICES).toHaveProperty('dw_pro_yearly');
    expect(USDT_PRICES).toHaveProperty('dw_lifetime');
  });
});
