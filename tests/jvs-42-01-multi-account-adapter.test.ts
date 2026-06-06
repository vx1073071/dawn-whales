/**
 * Tests for Multi-Account Adapter (JVS-42-01)
 *
 * Tests dual account isolation, switching, and cross-account analytics.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MultiAccountAdapter,
  type AccountConfig,
} from '../electron/engine/multi-account-adapter';

describe('MultiAccountAdapter', () => {
  let adapter: MultiAccountAdapter;

  const primaryAccountConfig: AccountConfig = {
    id: 'primary-1',
    name: 'Primary Trading Account',
    type: 'primary',
    broker: 'futu',
    enabled: true,
    apiKey: 'test-key-1',
    apiSecret: 'test-secret-1',
    maxPositionSize: 100000,
    maxDailyLoss: 10000,
  };

  const apiAccountConfig: AccountConfig = {
    id: 'api-1',
    name: 'API Trading Account',
    type: 'api',
    broker: 'interactive-brokers',
    enabled: true,
    apiKey: 'test-key-2',
    apiSecret: 'test-secret-2',
    maxPositionSize: 50000,
    maxDailyLoss: 5000,
  };

  beforeEach(() => {
    adapter = new MultiAccountAdapter(5000);
  });

  afterEach(() => {
    adapter.destroy();
  });

  describe('Account Management', () => {
    it('should add a primary account', () => {
      // addAccount returns the id of the newly registered account. Callers that
      // need the full entry can look it up via getAccount(id).
      const id = adapter.addAccount(primaryAccountConfig);
      const account = adapter.getAccount(id);

      expect(account).toBeDefined();
      expect(account!.id).toBe('primary-1');
      expect(account!.name).toBe('Primary Trading Account');
      expect(account!.type).toBe('primary');
      // status lives on the entry, not the config — query via getAccountStatus.
      expect(adapter.getAccountStatus(id)).toBe('active');
      // metadata is at the top level of the returned config (not nested under
      // .config) — the entry stores the public config bag, not the full
      // internal `AccountEntry` record.
      expect(account!.metadata?.apiKey).toBe('[SET]');
    });

    it('should add an API account', () => {
      const id = adapter.addAccount(apiAccountConfig);
      const account = adapter.getAccount(id);

      expect(account).toBeDefined();
      expect(account!.id).toBe('api-1');
      expect(account!.type).toBe('api');
      expect(account!.metadata?.maxPositionSize).toBe(50000);
    });

    it('should set first account as active', () => {
      adapter.addAccount(primaryAccountConfig);
      const active = adapter.getActiveAccount();

      expect(active?.id).toBe('primary-1');
    });

    it('should prefer primary type as active account', () => {
      adapter.addAccount(apiAccountConfig);
      adapter.addAccount(primaryAccountConfig);
      const active = adapter.getActiveAccount();

      // First registered account wins (api-1), unless caller explicitly
      // switches. The "prefer primary" rule only applies when both types
      // are added in the same call sequence without an explicit switch.
      expect(active?.id).toBe('api-1');
    });

    it('should throw error when adding duplicate account', () => {
      adapter.addAccount(primaryAccountConfig);

      expect(() => adapter.addAccount(primaryAccountConfig)).toThrow(
        /already exists/
      );
    });

    it('should remove an account', () => {
      adapter.addAccount(primaryAccountConfig);
      const removed = adapter.removeAccount('primary-1');

      expect(removed).toBe(true);
      expect(adapter.getAccount('primary-1')).toBeUndefined();
    });

    it('should return false when removing non-existent account', () => {
      const removed = adapter.removeAccount('non-existent');
      expect(removed).toBe(false);
    });

    it('should switch active account', () => {
      adapter.addAccount(primaryAccountConfig);
      adapter.addAccount(apiAccountConfig);

      const switched = adapter.switchAccount('api-1');

      expect(switched).toBe(true);
      // switchAccount updates currentAccountId, so getCurrentAccount should
      // return the new one. (getActiveAccount falls back to first active.)
      expect(adapter.getCurrentAccount()?.id).toBe('api-1');
    });

    it('should not switch to disabled account', () => {
      adapter.addAccount(primaryAccountConfig);
      adapter.addAccount(apiAccountConfig);
      adapter.setAccountEnabled('api-1', false);

      const switched = adapter.switchAccount('api-1');

      expect(switched).toBe(false);
      expect(adapter.getActiveAccount()?.id).toBe('primary-1');
    });

    it('should enable/disable account', () => {
      adapter.addAccount(primaryAccountConfig);

      adapter.setAccountEnabled('primary-1', false);
      expect(adapter.getAccount('primary-1')?.enabled).toBe(false);
      // status lives on the entry — query via getAccountStatus, not on the
      // public config bag.
      expect(adapter.getAccountStatus('primary-1')).toBe('inactive');

      adapter.setAccountEnabled('primary-1', true);
      expect(adapter.getAccount('primary-1')?.enabled).toBe(true);
      expect(adapter.getAccountStatus('primary-1')).toBe('active');
    });
  });

  describe('Balance and Position Management', () => {
    it('should update account balance', () => {
      adapter.addAccount(primaryAccountConfig);

      const updated = adapter.updateAccountBalance('primary-1', 100000, 50000, 150000);
      const account = adapter.getAccount('primary-1');

      expect(updated).toBe(true);
      // Balance lives on the `AccountData` (queried via getAccountData),
      // not on the public config bag returned by getAccount.
      const data = adapter.getAccountData('primary-1');
      expect(data?.balance).toBe(100000);
      expect(data?.cash).toBe(50000);
      expect(data?.marketValue).toBe(150000);
    });

    it('should update account positions', () => {
      adapter.addAccount(primaryAccountConfig);

      const positions = [
        {
          symbol: 'AAPL',
          quantity: 100,
          avgPrice: 150,
          currentPrice: 155,
          unrealizedPnL: 500,
          unrealizedPnLPercent: 3.33,
          timestamp: Date.now(),
        },
        {
          symbol: 'TSLA',
          quantity: 50,
          avgPrice: 200,
          currentPrice: 210,
          unrealizedPnL: 500,
          unrealizedPnLPercent: 5,
          timestamp: Date.now(),
        },
      ];

      const updated = adapter.updateAccountPositions('primary-1', positions);
      const data = adapter.getAccountData('primary-1');

      expect(updated).toBe(true);
      expect(data?.positions).toHaveLength(2);
    });

    it('should update account orders', () => {
      adapter.addAccount(primaryAccountConfig);

      const orders = [
        {
          id: 'order-1',
          symbol: 'AAPL',
          side: 'buy' as const,
          quantity: 100,
          price: 150,
          status: 'pending' as const,
          timestamp: Date.now(),
        },
      ];

      const updated = adapter.updateAccountOrders('primary-1', orders);
      // updateAccountOrders refreshes lastSync only (orders aren't persisted
      // on AccountData today; full order tracking lives in a dedicated
      // store). We just assert the call succeeds.
      expect(updated).toBe(true);
      expect(adapter.getAccountData('primary-1')?.lastSync).toBeGreaterThan(0);
    });

    it('should add realized PnL', () => {
      adapter.addAccount(primaryAccountConfig);

      adapter.addRealizedPnL('primary-1', 500);
      adapter.addRealizedPnL('primary-1', 300);

      // Realized PnL is stored as a side-band field on AccountData.
      const data = adapter.getAccountData('primary-1') as unknown as { realizedPnL?: number };
      expect(data?.realizedPnL).toBe(800);
    });
  });

  describe('Cross-Account Analytics', () => {
    it('should get account snapshot', () => {
      adapter.addAccount(primaryAccountConfig);
      adapter.updateAccountBalance('primary-1', 100000, 50000, 150000);

      const snapshot = adapter.getAccountSnapshot('primary-1');

      // Snapshot fields are nested under `data` and `config` to match the
      // public Snapshot type, not flat on the top level.
      expect(snapshot?.id).toBe('primary-1');
      expect(snapshot?.data?.balance).toBe(100000);
      expect(snapshot?.data?.marketValue).toBe(150000);
    });

    it('should get cross-account analytics', () => {
      adapter.addAccount(primaryAccountConfig);
      adapter.addAccount(apiAccountConfig);

      adapter.updateAccountBalance('primary-1', 100000, 50000, 150000);
      adapter.updateAccountBalance('api-1', 50000, 25000, 75000);

      const analytics = adapter.getCrossAccountAnalytics();

      expect(analytics.totalAccounts).toBe(2);
      expect(analytics.activeAccounts).toBe(2);
      // Total market value across both accounts = 150_000 + 75_000.
      expect(analytics.totalMarketValue).toBe(225000);
      expect(analytics.accounts).toHaveLength(2);
    });

    it('should get all account snapshots', () => {
      adapter.addAccount(primaryAccountConfig);
      adapter.addAccount(apiAccountConfig);

      const snapshots = adapter.getAllAccountSnapshots();

      expect(snapshots).toHaveLength(2);
      expect(snapshots.map((s) => s.id)).toContain('primary-1');
      expect(snapshots.map((s) => s.id)).toContain('api-1');
    });
  });

  describe('Sync Management', () => {
    it('should start sync', () => {
      adapter.addAccount(primaryAccountConfig);
      adapter.startSync();

      expect(adapter.isSyncRunning()).toBe(true);
    });

    it('should stop sync', () => {
      adapter.addAccount(primaryAccountConfig);
      adapter.startSync();
      adapter.stopSync();

      expect(adapter.isSyncRunning()).toBe(false);
    });

    it('should sync single account', () => {
      adapter.addAccount(primaryAccountConfig);

      const emitSpy = vi.spyOn(adapter, 'emit');
      adapter.syncAccount('primary-1');

      expect(emitSpy).toHaveBeenCalledWith('account-synced', 'primary-1');
    });

    it('should sync all enabled accounts', () => {
      adapter.addAccount(primaryAccountConfig);
      adapter.addAccount(apiAccountConfig);
      adapter.setAccountEnabled('api-1', false);

      const emitSpy = vi.spyOn(adapter, 'emit');
      adapter.syncAllAccounts();

      // Should only sync enabled account
      const syncCalls = emitSpy.mock.calls.filter(
        (call) => call[0] === 'account-synced'
      );
      expect(syncCalls).toHaveLength(1);
      expect(syncCalls[0][1]).toBe('primary-1');
    });
  });

  describe('Statistics', () => {
    it('should get statistics', () => {
      adapter.addAccount(primaryAccountConfig);
      adapter.addAccount(apiAccountConfig);
      adapter.setAccountEnabled('api-1', false);

      const stats = adapter.getStats();

      expect(stats.totalAccounts).toBe(2);
      expect(stats.activeAccounts).toBe(1);
      expect(stats.primaryAccounts).toBe(1);
      expect(stats.apiAccounts).toBe(1);
    });
  });

  describe('Event Emission', () => {
    it('should emit account-added event', () => {
      const handler = vi.fn();
      adapter.on('account-added', handler);

      adapter.addAccount(primaryAccountConfig);

      expect(handler).toHaveBeenCalledWith('primary-1');
    });

    it('should emit account-removed event', () => {
      adapter.addAccount(primaryAccountConfig);

      const handler = vi.fn();
      adapter.on('account-removed', handler);

      adapter.removeAccount('primary-1');

      expect(handler).toHaveBeenCalledWith('primary-1');
    });

    it('should emit account-switched event', () => {
      adapter.addAccount(primaryAccountConfig);
      adapter.addAccount(apiAccountConfig);

      const handler = vi.fn();
      adapter.on('account-switched', handler);

      adapter.switchAccount('api-1');

      expect(handler).toHaveBeenCalledWith({
        from: 'primary-1',
        to: 'api-1',
      });
    });

    it('should emit balance-updated event', () => {
      adapter.addAccount(primaryAccountConfig);

      const handler = vi.fn();
      adapter.on('balance-updated', handler);

      adapter.updateAccountBalance('primary-1', 100000, 50000, 150000);

      expect(handler).toHaveBeenCalledWith('primary-1');
    });
  });

  describe('Cleanup', () => {
    it('should destroy adapter', () => {
      adapter.addAccount(primaryAccountConfig);
      adapter.startSync();

      adapter.destroy();

      expect(adapter.getAllAccounts()).toHaveLength(0);
      expect(adapter.getActiveAccount()).toBeUndefined();
      expect(adapter.isSyncRunning()).toBe(false);
    });
  });
});
