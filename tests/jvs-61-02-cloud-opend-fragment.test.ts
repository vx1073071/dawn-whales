/**
 * J-61-02 Tests: 云OpenD + 碎股 (R61 v19 — v1.4.0-beta)
 *
 * Tests:
 * 01-02: Cloud OpenD connection lifecycle
 * 03-04: Fragment order detection
 * 05-06: Fragment fee multiplier
 * 07: Connection pool multi-market
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CloudOpenDManager,
  FragmentEngine,
  OpenDConnectionPool,
  getCloudOpenDManager,
  getFragmentEngine,
  getConnectionPool,
  resetCloudOpenD,
  ConnectionHealth,
} from '../electron/engine/cloud-opend-fragment';

describe('J-61-02: CloudOpenD + Fragment', () => {
  beforeEach(() => {
    resetCloudOpenD();
  });

  afterEach(async () => {
    await getConnectionPool().disconnectAll();
  });

  describe('Cloud OpenD Connection', () => {
    it('01: connect establishes connection and returns health', async () => {
      const manager = getCloudOpenDManager();
      const health = await manager.connect();
      expect(health.state).toBe('connected');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.reconnectCount).toBe(0);
    });

    it('02: connection URL uses wss when tls enabled', () => {
      const manager = new CloudOpenDManager({ host: 'test.opend.io', port: 22222, tlsEnabled: true });
      const url = manager.getConnectionUrl();
      expect(url).toBe('wss://test.opend.io:22222');
    });

    it('03: connection URL uses ws when tls disabled', () => {
      const manager = new CloudOpenDManager({ host: 'local.opend', port: 11111, tlsEnabled: false });
      const url = manager.getConnectionUrl();
      expect(url).toBe('ws://local.opend:11111');
    });

    it('04: disconnect clears health state', async () => {
      const manager = getCloudOpenDManager();
      await manager.connect();
      await manager.disconnect();
      expect(manager.getHealth().state).toBe('disconnected');
    });

    it('05: config is preserved on health query', async () => {
      const manager = new CloudOpenDManager({ host: 'custom.opend.cloud', port: 33333 });
      await manager.connect();
      const health = manager.getHealth();
      expect(health.errors).toEqual([]);
      expect(manager.getConfig().host).toBe('custom.opend.cloud');
    });
  });

  describe('Fragment Orders', () => {
    it('06: A-share 100 is NOT a fragment', () => {
      const engine = getFragmentEngine();
      expect(engine.isFragmentOrder(100, 'A-SH')).toBe(false);
    });

    it('07: A-share 50 IS a fragment', () => {
      const engine = getFragmentEngine();
      expect(engine.isFragmentOrder(50, 'A-SZ')).toBe(true);
    });

    it('08: US 5 shares is NOT fragment (min 1)', () => {
      const engine = getFragmentEngine();
      expect(engine.isFragmentOrder(5, 'US-NYSE')).toBe(false);
    });

    it('09: fragments disabled blocks A-share <100', () => {
      const engine = new FragmentEngine({ enabled: false });
      const result = engine.validateOrder({
        symbol: '000001', market: 'A-SZ', quantity: 50, isFragment: true,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('10: fragment fee is 1.5x base', () => {
      const engine = getFragmentEngine();
      const fee = engine.calculateFragmentFee(100, true);
      expect(fee).toBe(150);
    });

    it('11: non-fragment fee is unchanged', () => {
      const engine = getFragmentEngine();
      const fee = engine.calculateFragmentFee(100, false);
      expect(fee).toBe(100);
    });

    it('12: custom fragment multiplier', () => {
      const engine = new FragmentEngine({ fragmentFeeMultiplier: 2.0 });
      expect(engine.calculateFragmentFee(50, true)).toBe(100);
    });
  });

  describe('Connection Pool', () => {
    it('13: pool connects to multiple markets', async () => {
      const pool = getConnectionPool();
      pool.addConnection('hk', { host: 'hk.opend.cloud', port: 11111, timeoutMs: 5000 });
      pool.addConnection('us', { host: 'us.opend.cloud', port: 11111, timeoutMs: 5000 });

      const results = await pool.connectAll();
      expect(results.size).toBe(2);
      expect(results.get('hk')?.state).toBe('connected');
      expect(results.get('us')?.state).toBe('connected');
    });

    it('14: isMarketConnected reflects connection state', async () => {
      const pool = getConnectionPool();
      pool.addConnection('hk', { host: 'hk.opend.cloud', port: 11111, timeoutMs: 5000 });
      expect(pool.isMarketConnected('hk')).toBe(false);
      await pool.connectAll();
      expect(pool.isMarketConnected('hk')).toBe(true);
    });
  });
});
