import { describe, it, expect, vi } from 'vitest';
import { AuditLogger } from '../electron/workers/audit-logger';

describe('AuditLogger', () => {
  it('should log and query', () => {
    const log = new AuditLogger();
    log.log('order.place', 'user1', { symbol: 'AAPL', qty: 100 });
    log.log('strategy.create', 'user1', { name: 'MA' });
    log.log('config.change', 'admin', { key: 'endpoint' }, false);

    const orders = log.query({ action: 'order.place' });
    expect(orders).toHaveLength(1);
    expect(orders[0].details.symbol).toBe('AAPL');

    const failed = log.query({ success: false });
    expect(failed).toHaveLength(1);
  });

  it('should notify subscribers', () => {
    const log = new AuditLogger();
    const fn = vi.fn();
    log.subscribe(fn);
    log.log('user.login', 'user2', {});
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should export CSV', () => {
    const log = new AuditLogger();
    log.log('system.startup', 'system', { version: '0.7.0' });
    const csv = log.export('csv');
    expect(csv).toContain('system.startup');
  });

  it('should cap entries', () => {
    const log = new AuditLogger(10);
    for (let i = 0; i < 15; i++) {
      log.log('user.login', 'u', { i });
    }
    const all = log.query({});
    expect(all.length).toBeLessThanOrEqual(10);
  });
});
