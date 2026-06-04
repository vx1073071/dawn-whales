// ── Unit Tests — CryptoPaymentService ──────────────────────────────────────
// Run: npx tsx tests/crypto-payment.test.ts
//
// Tests cover: order creation, DB persistence, expiration, LicenseManager
// integration, pricing, chain support, and edge cases.
// Chain RPC calls are mocked via global fetch override.

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ── Mock better-sqlite3 Database ──────────────────────────────────────────
class MockDatabase {
  private tables: Map<string, any[]> = new Map();
  private preparedStatements: Map<string, any> = new Map();

  exec(sql: string) {
    // Parse CREATE TABLE IF NOT EXISTS
    const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
    if (match) {
      const table = match[1];
      if (!this.tables.has(table)) this.tables.set(table, []);
    }
  }

  prepare(sql: string) {
    const self = this;
    return {
      run(...params: any[]) {
        // INSERT OR REPLACE
        const insertMatch = sql.match(/INSERT OR REPLACE INTO (\w+)/);
        if (insertMatch) {
          const table = insertMatch[1];
          const rows = self.tables.get(table) || [];
          // Simple upsert by first param (order_id)
          const idx = rows.findIndex((r: any) => r.order_id === params[0]);
          const row: any = {
            order_id: params[0],
            pay_address: params[1],
            amount: params[2],
            chain: params[3],
            tier: params[4],
            duration: params[5],
            status: params[6],
            created_at: params[7],
            expires_at: params[8],
            tx_hash: params[9],
            confirmations: params[10],
          };
          if (idx >= 0) rows[idx] = row;
          else rows.push(row);
          self.tables.set(table, rows);
        }
      },
      all(...params: any[]) {
        // SELECT queries
        const selectMatch = sql.match(/SELECT (.+?) FROM (\w+)(?: WHERE (.+))?/);
        if (!selectMatch) return [];
        const table = selectMatch[2];
        const rows = self.tables.get(table) || [];

        // Simple WHERE parsing for status IN (...)
        if (selectMatch[3]) {
          const inMatch = selectMatch[3].match(/status IN \(([^)]+)\)/);
          if (inMatch) {
            const statuses = inMatch[1].replace(/'/g, '').split(',').map(s => s.trim());
            const filtered = rows.filter((r: any) => statuses.includes(r.status));

            // Check for additional AND conditions
            const andTxHash = selectMatch[3].includes('tx_hash IS NOT NULL');
            if (andTxHash) {
              return filtered.filter((r: any) => r.tx_hash != null);
            }
            return filtered;
          }
        }
        return rows;
      },
    };
  }
}

// Mock DatabaseLike
const mockDb = {
  getDb: () => new MockDatabase(),
};

// ── Mock LicenseManager ───────────────────────────────────────────────────
class MockLicenseManager {
  activated: Array<{ key: string; tier: string; months: number }> = [];

  activateLicense(key: string, tier: any, durationMonths: number) {
    this.activated.push({ key, tier, months: durationMonths });
  }
}

// ── Mock fetch for chain RPC calls ────────────────────────────────────────
const originalFetch = globalThis.fetch;

function mockFetchEmpty() {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: [], result: [] }),
  }) as any;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  // Dynamic import to avoid electron-log issues in test env
  // We test the class directly with mocks
  const { CryptoPaymentService, USDT_PRICES, MIN_CONFIRMATIONS, PAYMENT_TIMEOUT_MINUTES } =
    await import('../electron/payment/crypto-payment');

  // ── Pricing & Constants ────────────────────────────────────────────────
  section('Pricing Constants');
  {
    assert(USDT_PRICES.dw_starter_monthly === 14, 'Starter monthly = 14 USDT');
    assert(USDT_PRICES.dw_starter_yearly === 135, 'Starter yearly = 135 USDT');
    assert(USDT_PRICES.dw_pro_monthly === 42, 'Pro monthly = 42 USDT');
    assert(USDT_PRICES.dw_pro_yearly === 403, 'Pro yearly = 403 USDT');
    assert(USDT_PRICES.dw_lifetime === 430, 'Lifetime = 430 USDT');
  }

  section('Min Confirmations');
  {
    assert(MIN_CONFIRMATIONS.TRC20 === 19, 'TRC20 requires 19 confirmations');
    assert(MIN_CONFIRMATIONS.ERC20 === 12, 'ERC20 requires 12 confirmations');
    assert(MIN_CONFIRMATIONS.BEP20 === 10, 'BEP20 requires 10 confirmations');
    assert(MIN_CONFIRMATIONS.SOL === 32, 'SOL requires 32 confirmations');
  }

  section('Payment Timeout');
  {
    assert(PAYMENT_TIMEOUT_MINUTES === 30, 'Payment timeout = 30 minutes');
  }

  // ── Order Creation ───────────────────────────────────────────────────
  section('Order Creation — Basic');
  mockFetchEmpty();
  {
    const service = new CryptoPaymentService();
    service.initialize(mockDb);

    const order = await service.createPayment({
      tier: 'pro',
      duration: 'monthly',
      chain: 'TRC20',
      amount: 42,
    });

    assert(!!order.orderId, `Order ID generated: ${order.orderId}`);
    assert(order.orderId.startsWith('DW-'), 'Order ID starts with DW-');
    assert(order.amount === 42, 'Amount = 42 USDT');
    assert(order.chain === 'TRC20', 'Chain = TRC20');
    assert(order.tier === 'pro', 'Tier = pro');
    assert(order.duration === 'monthly', 'Duration = monthly');
    assert(order.status === 'pending', 'Status = pending');
    assert(!!order.createdAt, 'createdAt is set');
    assert(!!order.expiresAt, 'expiresAt is set');

    // Check expiry is ~30 min from now
    const expiryMs = new Date(order.expiresAt).getTime() - new Date(order.createdAt).getTime();
    assert(Math.abs(expiryMs - 30 * 60000) < 1000, 'Expiry is ~30 minutes from creation');

    service.stop();
  }

  section('Order Creation — Multiple Chains');
  mockFetchEmpty();
  {
    const service = new CryptoPaymentService();
    service.initialize(mockDb);

    const chains = ['TRC20', 'ERC20', 'BEP20', 'SOL'] as const;
    for (const chain of chains) {
      const order = await service.createPayment({
        tier: 'starter',
        duration: 'yearly',
        chain,
        amount: 135,
      });
      assert(order.chain === chain, `${chain} order created`);
    }
    assert(service.getAllOrders().length === 4, 'All 4 orders tracked');

    service.stop();
  }

  // ── Order Retrieval ──────────────────────────────────────────────────
  section('Order Retrieval');
  mockFetchEmpty();
  {
    const service = new CryptoPaymentService();
    service.initialize(mockDb);

    const order = await service.createPayment({
      tier: 'starter',
      duration: 'monthly',
      chain: 'ERC20',
      amount: 14,
    });

    const retrieved = service.getOrder(order.orderId);
    assert(retrieved !== null, 'getOrder returns order');
    assert(retrieved!.orderId === order.orderId, 'Retrieved order matches');

    const missing = service.getOrder('DW-NONEXISTENT');
    assert(missing === null, 'getOrder returns null for missing order');

    service.stop();
  }

  // ── Pricing API ──────────────────────────────────────────────────────
  section('Pricing API');
  {
    const service = new CryptoPaymentService();
    service.initialize(mockDb);

    const pricing = service.getPricing();
    assert(typeof pricing === 'object', 'getPricing returns object');
    assert(pricing.dw_starter_monthly === 14, 'Pricing starter monthly correct');
    assert(pricing.dw_lifetime === 430, 'Pricing lifetime correct');

    // Ensure it's a copy (not mutable reference)
    pricing.dw_starter_monthly = 999;
    const pricing2 = service.getPricing();
    assert(pricing2.dw_starter_monthly === 14, 'getPricing returns copy, not reference');

    service.stop();
  }

  // ── Supported Chains ─────────────────────────────────────────────────
  section('Supported Chains');
  {
    const service = new CryptoPaymentService();
    service.initialize(mockDb);

    const chains = service.getSupportedChains();
    // Without env vars, no chains are configured
    assert(Array.isArray(chains), 'getSupportedChains returns array');
    // In test env, env vars are not set, so chains should be empty
    assert(chains.length === 0, 'No chains configured without env vars');

    service.stop();
  }

  // ── DB Persistence ───────────────────────────────────────────────────
  section('DB Persistence — Load on Init');
  mockFetchEmpty();
  {
    const sharedDb = new MockDatabase();
    const db = { getDb: () => sharedDb };
    const service1 = new CryptoPaymentService();
    service1.initialize(db);

    const order = await service1.createPayment({
      tier: 'pro',
      duration: 'yearly',
      chain: 'BEP20',
      amount: 403,
    });

    // Create new service with same DB — should load existing orders
    const service2 = new CryptoPaymentService();
    service2.initialize(db);

    const loaded = service2.getOrder(order.orderId);
    assert(loaded !== null, 'Order loaded from DB on re-init');
    assert(loaded!.amount === 403, 'Loaded order has correct amount');
    assert(loaded!.tier === 'pro', 'Loaded order has correct tier');

    service1.stop();
    service2.stop();
  }

  // ── LicenseManager Integration ───────────────────────────────────────
  section('LicenseManager Integration');
  mockFetchEmpty();
  {
    const licenseManager = new MockLicenseManager();
    const service = new CryptoPaymentService();
    service.initialize(mockDb, licenseManager as any);

    // Simulate payment completion via onPaymentCompleted
    const order = await service.createPayment({
      tier: 'pro',
      duration: 'monthly',
      chain: 'TRC20',
      amount: 42,
    });

    // Manually trigger completion (bypassing chain check)
    order.status = 'completed';
    order.confirmations = 20;
    order.txHash = 'test-tx-hash-123';

    // Access private method via cast
    (service as any).onPaymentCompleted(order);

    assert(licenseManager.activated.length === 1, 'LicenseManager.activateLicense called');
    assert(licenseManager.activated[0].key === order.orderId, 'Activation key = orderId');
    assert(licenseManager.activated[0].tier === 'pro', 'Activation tier = pro');
    assert(licenseManager.activated[0].months === 1, 'Monthly duration = 1');

    service.stop();
  }

  section('LicenseManager Integration — Yearly');
  mockFetchEmpty();
  {
    const licenseManager = new MockLicenseManager();
    const service = new CryptoPaymentService();
    service.initialize(mockDb, licenseManager as any);

    const order = await service.createPayment({
      tier: 'starter',
      duration: 'yearly',
      chain: 'ERC20',
      amount: 135,
    });

    order.status = 'completed';
    order.confirmations = 15;
    order.txHash = 'eth-tx-hash-456';
    (service as any).onPaymentCompleted(order);

    assert(licenseManager.activated.length === 1, 'Yearly activation called');
    assert(licenseManager.activated[0].months === 12, 'Yearly duration = 12 months');

    service.stop();
  }

  section('LicenseManager Integration — Lifetime');
  mockFetchEmpty();
  {
    const licenseManager = new MockLicenseManager();
    const service = new CryptoPaymentService();
    service.initialize(mockDb, licenseManager as any);

    const order = await service.createPayment({
      tier: 'lifetime',
      duration: 'lifetime',
      chain: 'SOL',
      amount: 430,
    });

    order.status = 'completed';
    order.confirmations = 35;
    order.txHash = 'sol-sig-789';
    (service as any).onPaymentCompleted(order);

    assert(licenseManager.activated.length === 1, 'Lifetime activation called');
    assert(licenseManager.activated[0].months === 0, 'Lifetime duration = 0 (permanent)');

    service.stop();
  }

  section('No LicenseManager — Graceful Skip');
  mockFetchEmpty();
  {
    const service = new CryptoPaymentService();
    service.initialize(mockDb); // No licenseManager passed

    const order = await service.createPayment({
      tier: 'pro',
      duration: 'monthly',
      chain: 'TRC20',
      amount: 42,
    });

    order.status = 'completed';
    order.confirmations = 20;
    order.txHash = 'test-tx-no-lm';

    // Should not throw
    let threw = false;
    try {
      (service as any).onPaymentCompleted(order);
    } catch {
      threw = true;
    }
    assert(!threw, 'onPaymentCompleted without LicenseManager does not throw');

    service.stop();
  }

  // ── Order Expiration ─────────────────────────────────────────────────
  section('Order Expiration');
  mockFetchEmpty();
  {
    const service = new CryptoPaymentService();
    service.initialize(mockDb);

    const order = await service.createPayment({
      tier: 'starter',
      duration: 'monthly',
      chain: 'TRC20',
      amount: 14,
    });

    // Set expiresAt to the past
    order.expiresAt = new Date(Date.now() - 1000).toISOString();

    // Trigger checkPendingOrders
    await (service as any).checkPendingOrders();

    assert(order.status === 'expired', 'Expired order status = expired');

    service.stop();
  }

  // ── Order Sorting ────────────────────────────────────────────────────
  section('Order Sorting');
  mockFetchEmpty();
  {
    const service = new CryptoPaymentService();
    service.initialize(mockDb);

    await service.createPayment({ tier: 'starter', duration: 'monthly', chain: 'TRC20', amount: 14 });
    await new Promise(r => setTimeout(r, 10));
    await service.createPayment({ tier: 'pro', duration: 'monthly', chain: 'ERC20', amount: 42 });
    await new Promise(r => setTimeout(r, 10));
    await service.createPayment({ tier: 'lifetime', duration: 'lifetime', chain: 'SOL', amount: 430 });

    const orders = service.getAllOrders();
    assert(orders.length === 3, '3 orders total');
    assert(orders[0].tier === 'lifetime', 'Newest order first');
    assert(orders[2].tier === 'starter', 'Oldest order last');

    service.stop();
  }

  // ── Order ID Uniqueness ──────────────────────────────────────────────
  section('Order ID Uniqueness');
  mockFetchEmpty();
  {
    const service = new CryptoPaymentService();
    service.initialize(mockDb);

    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const order = await service.createPayment({
        tier: 'starter',
        duration: 'monthly',
        chain: 'TRC20',
        amount: 14,
      });
      ids.add(order.orderId);
    }
    assert(ids.size === 50, '50 unique order IDs generated');

    service.stop();
  }

  // ── Stop & Cleanup ───────────────────────────────────────────────────
  section('Stop & Cleanup');
  mockFetchEmpty();
  {
    const service = new CryptoPaymentService();
    service.initialize(mockDb);

    await service.createPayment({ tier: 'starter', duration: 'monthly', chain: 'TRC20', amount: 14 });

    service.stop();
    // Calling stop again should not throw
    let threw = false;
    try {
      service.stop();
    } catch {
      threw = true;
    }
    assert(!threw, 'Double stop does not throw');
  }

  // ── Cleanup ──────────────────────────────────────────────────────────
  restoreFetch();

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed > 0) {
    console.log('❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
  }
}

main().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
