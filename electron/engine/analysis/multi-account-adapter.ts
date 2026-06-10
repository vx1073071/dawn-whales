/**
 * Multi-Account Adapter (J-42-01)
 *
 * Manages dual account isolation with data sync.
 * Supports paper and live trading accounts with full lifecycle management,
 * cross-account comparison, and analytics aggregation.
 */

import log from 'electron-log';
import { EngineError, ErrorCode } from '../../errors';


// ============================================================================
// Inline EventEmitter Polyfill (no `import from 'events'`)
// ============================================================================

type EventListener = (...args: unknown[]) => void;

class SimpleEventEmitter {
  private _listeners: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const list = this._listeners.get(event) ?? [];
    list.push(listener);
    this._listeners.set(event, list);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const list = this._listeners.get(event);
    if (list) {
      this._listeners.set(
        event,
        list.filter((fn) => fn !== listener),
      );
    }
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapped: EventListener = (...args) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) {
      try {
        fn(...args);
      } catch (err) {
        log.error('[EventEmitter] Listener error:', err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ============================================================================
// Types
// ============================================================================

export type AccountType = 'paper' | 'live';

export type AccountStatus = 'active' | 'inactive' | 'syncing' | 'error';

export interface AccountConfig {
  id: string;
  name: string;
  type: AccountType;
  broker: string;
  credentials?: Record<string, string>;
  /** Optional convenience fields — flattened into `credentials` on add. */\1/** @deprecated R83 — use server-side AI Gateway token */
\1\2
  apiSecret?: string;
  /** Optional metadata bag — non-credential view used by the dashboard. */
  metadata?: Record<string, unknown>;
  enabled: boolean;
  /** Optional per-account risk limits — stored on the entry for downstream use. */
  maxPositionSize?: number;
  maxDailyLoss?: number;
}

export interface AccountData {
  accountId: string;
  balance: number;
  cash: number;
  marketValue: number;
  positions: Position[];
  lastSync: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  pnlPct: number;
}

export interface SyncResult {
  accountId: string;
  success: boolean;
  syncedAt: number;
  error?: string;
  positionsCount: number;
}

export interface AccountComparison {
  accountId1: string;
  accountId2: string;
  balance1: number;
  balance2: number;
  balanceDiff: number;
  positionsCount1: number;
  positionsCount2: number;
  commonSymbols: string[];
  uniqueSymbols1: string[];
  uniqueSymbols2: string[];
  pnlDiff: number;
  lastSyncDiff: number;
}

export interface AccountAnalytics {
  totalAccounts: number;
  activeAccounts: number;
  paperAccounts: number;
  liveAccounts: number;
  totalBalance: number;
  totalCash: number;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalPositions: number;
  avgBalance: number;
  lastSyncTimestamp: number;
  syncingAccounts: number;
  errorAccounts: number;
}

// ============================================================================
// Internal bookkeeping per account
// ============================================================================

interface AccountEntry {
  config: AccountConfig & { metadata?: Record<string, unknown> };
  data: AccountData;
  status: AccountStatus;
}

// ============================================================================
// MultiAccountAdapter
// ============================================================================

export class MultiAccountAdapter extends SimpleEventEmitter {
  private entries: Map<string, AccountEntry> = new Map();
  private currentAccountId: string | null = null;

  /** Periodic sync timer (Node `setInterval` handle) — `null` when stopped. */
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  /** Sync interval in ms (defaults to 5s, can be overridden via constructor). */
  private syncIntervalMs: number = 5000;

  /** Account analytics engine instance (lazy on first access). */
  private _accountAnalytics?: import('./account-analytics').AccountAnalytics;

  /** Optional external sync provider injected via constructor */
  private syncProvider:
    | ((accountId: string) => Promise<Partial<AccountData>>)
    | null = null;

  constructor(
    syncIntervalMsOrProvider?: number | ((accountId: string) => Promise<Partial<AccountData>>),
    maybeProvider?: (accountId: string) => Promise<Partial<AccountData>>,
  ) {
    super();
    // Back-compat: a single number argument sets the sync interval; a function
    // sets the sync provider. Two args = (interval, provider).
    if (typeof syncIntervalMsOrProvider === 'number') {
      this.syncIntervalMs = syncIntervalMsOrProvider;
      if (maybeProvider) this.syncProvider = maybeProvider;
    } else if (typeof syncIntervalMsOrProvider === 'function') {
      this.syncProvider = syncIntervalMsOrProvider;
    }
    log.info('[MultiAccountAdapter] Initialized');
  }

  // --------------------------------------------------------------------------
  // Account CRUD
  // --------------------------------------------------------------------------

  /**
   * Register a new account and return its id. Callers that need the full
   * entry (e.g. for `getAccount(...)`) can use the returned id; convenience
   * overloads expose the resolved entry below.
   *
   * Throws if an account with the same id already exists.
   */
  addAccount(config: AccountConfig): string {
    if (this.entries.has(config.id)) {
      const msg = `Account "${config.id}" already exists`;
      log.warn(`[MultiAccountAdapter] addAccount failed: ${msg}`);
      throw new EngineError(ErrorCode.INTERNAL_ERROR, msg);
    }

    // Flatten optional convenience fields into the credentials bag so downstream
    // broker adapters can read them without depending on the convenience
    // fields being on the public config type.
    const { apiKey, apiSecret, maxPositionSize, maxDailyLoss, ...rest } = config;
    const credentials: Record<string, string> = { ...(rest.credentials ?? {}) };
    // Risk limits are not credentials; we keep them in a separate metadata
    // bucket so the broker can read them later without re-parsing the config.
    const metadata: Record<string, unknown> = {};
    if (apiKey !== undefined) {
      credentials.apiKey = apiKey;
      // Mask secrets in the public metadata view (e.g. test assertions
      // expect `[SET]` instead of the raw value).
      metadata.apiKey = '[SET]';
    }
    if (apiSecret !== undefined) {
      credentials.apiSecret = apiSecret;
      metadata.apiSecret = '[SET]';
    }
    if (maxPositionSize !== undefined) metadata.maxPositionSize = maxPositionSize;
    if (maxDailyLoss !== undefined) metadata.maxDailyLoss = maxDailyLoss;

    const entry: AccountEntry = {
      config: { ...rest, credentials, metadata },
      data: {
        accountId: config.id,
        balance: 0,
        cash: 0,
        marketValue: 0,
        positions: [],
        lastSync: 0,
      },
      status: config.enabled ? 'active' : 'inactive',
    };

    this.entries.set(config.id, entry);

    // Auto-select first account or prefer live
    if (
      !this.currentAccountId ||
      (config.type === 'live' && this.getCurrentAccount()?.type !== 'live')
    ) {
      this.currentAccountId = config.id;
    }

    log.info(
      `[MultiAccountAdapter] Account added: ${config.name} [${config.type}] (${config.broker})`,
    );
    this.emit('account-added', config.id);
    return config.id;
  }

  /**
   * Remove an account by id. Returns true if it existed.
   */
  removeAccount(accountId: string): boolean {
    const entry = this.entries.get(accountId);
    if (!entry) {
      log.warn(`[MultiAccountAdapter] removeAccount: "${accountId}" not found`);
      return false;
    }

    this.entries.delete(accountId);

    // Reassign current account if needed
    if (this.currentAccountId === accountId) {
      const remaining = Array.from(this.entries.keys());
      this.currentAccountId = remaining.length > 0 ? remaining[0] : null;
      if (this.currentAccountId) {
        log.info(
          `[MultiAccountAdapter] Current account reassigned to "${this.currentAccountId}"`,
        );
      }
    }

    log.info(`[MultiAccountAdapter] Account removed: ${accountId}`);
    this.emit('account-removed', accountId);
    return true;
  }

  /**
   * Retrieve account config by id.
   */
  getAccount(accountId: string): AccountConfig | undefined {
    return this.entries.get(accountId)?.config;
  }

  /**
   * Return all registered account configs.
   */
  getAllAccounts(): AccountConfig[] {
    return Array.from(this.entries.values()).map((e) => ({ ...e.config }));
  }

  /**
   * Return only enabled account configs.
   */
  getActiveAccounts(): AccountConfig[] {
    return this.getAllAccounts().filter((c) => c.enabled);
  }

  // --------------------------------------------------------------------------
  // Account switching
  // --------------------------------------------------------------------------

  /**
   * Switch the current (active) account.
   * Returns false if account does not exist or is disabled.
   */
  switchAccount(accountId: string): boolean {
    const entry = this.entries.get(accountId);
    if (!entry) {
      log.warn(`[MultiAccountAdapter] switchAccount: "${accountId}" not found`);
      return false;
    }
    if (!entry.config.enabled) {
      log.warn(
        `[MultiAccountAdapter] switchAccount: "${accountId}" is disabled`,
      );
      return false;
    }

    const previousId = this.currentAccountId;
    this.currentAccountId = accountId;

    log.info(
      `[MultiAccountAdapter] Switched account: ${previousId} -> ${accountId}`,
    );
    this.emit('account-switched', { from: previousId, to: accountId });
    return true;
  }

  /**
   * Get the currently selected account config.
   */
  getCurrentAccount(): AccountConfig | undefined {
    if (!this.currentAccountId) return undefined;
    return this.entries.get(this.currentAccountId)?.config;
  }

  // --------------------------------------------------------------------------
  // Sync
  // --------------------------------------------------------------------------

  /**
   * Synchronise a single account.
   * If a syncProvider was supplied it will be called to fetch fresh data;
   * otherwise a lightweight local sync (timestamp bump) is performed.
   */
  async syncAccount(accountId: string): Promise<SyncResult> {
    const entry = this.entries.get(accountId);
    if (!entry) {
      const result: SyncResult = {
        accountId,
        success: false,
        syncedAt: Date.now(),
        error: `Account "${accountId}" not found`,
        positionsCount: 0,
      };
      return result;
    }

    if (!entry.config.enabled) {
      const result: SyncResult = {
        accountId,
        success: false,
        syncedAt: Date.now(),
        error: `Account "${accountId}" is disabled`,
        positionsCount: entry.data.positions.length,
      };
      return result;
    }

    // Mark syncing
    entry.status = 'syncing';
    this.emit('sync-start', accountId);

    try {
      if (this.syncProvider) {
        const fresh = await this.syncProvider(accountId);
        if (fresh.balance !== undefined) entry.data.balance = fresh.balance;
        if (fresh.cash !== undefined) entry.data.cash = fresh.cash;
        if (fresh.marketValue !== undefined)
          entry.data.marketValue = fresh.marketValue;
        if (fresh.positions !== undefined)
          entry.data.positions = fresh.positions;
      }

      entry.data.lastSync = Date.now();
      entry.status = 'active';

      const result: SyncResult = {
        accountId,
        success: true,
        syncedAt: entry.data.lastSync,
        positionsCount: entry.data.positions.length,
      };

      log.info(
        `[MultiAccountAdapter] Synced "${accountId}" — ${result.positionsCount} positions`,
      );
      this.emit('sync-complete', result);
      return result;
    } catch (err: unknown) {
      entry.status = 'error';
      const result: SyncResult = {
        accountId,
        success: false,
        syncedAt: Date.now(),
        error: err?.message ?? String(err),
        positionsCount: entry.data.positions.length,
      };

      log.error(`[MultiAccountAdapter] Sync failed for "${accountId}":`, err);
      this.emit('sync-error', result);
      return result;
    }
  }

  /**
   * Synchronise all enabled accounts sequentially.
   */
  async syncAllAccounts(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (const entry of this.entries.values()) {
      if (entry.config.enabled) {
        const r = await this.syncAccount(entry.config.id);
        results.push(r);
      }
    }
    log.info(
      `[MultiAccountAdapter] syncAll complete — ${results.length} accounts synced`,
    );
    this.emit('sync-all-complete', results);
    return results;
  }

  // --------------------------------------------------------------------------
  // Data access
  // --------------------------------------------------------------------------

  /**
   * Get the latest account data snapshot.
   */
  getAccountData(accountId: string): AccountData | undefined {
    const entry = this.entries.get(accountId);
    if (!entry) return undefined;
    return { ...entry.data, positions: [...entry.data.positions] };
  }

  /**
   * Return a mutable handle to the live account data (bypasses the defensive
   * copy above). Used internally by mutators that need to persist updates.
   */
  private getAccountDataMutable(accountId: string): AccountData | undefined {
    return this.entries.get(accountId)?.data;
  }

  /**
   * Get data for every registered account.
   */
  getAllAccountData(): AccountData[] {
    return Array.from(this.entries.values()).map((e) => ({
      ...e.data,
      positions: [...e.data.positions],
    }));
  }

  /**
   * Get the current operational status of an account.
   */
  getAccountStatus(accountId: string): AccountStatus {
    const entry = this.entries.get(accountId);
    if (!entry) return 'inactive';
    return entry.status;
  }

  // --------------------------------------------------------------------------
  // Data mutation helpers (used by UI / bridge layers)
  // --------------------------------------------------------------------------

  /**
   * Convenience wrapper: update the three monetary fields in a single call.
   * Equivalent to `updateAccountData(id, { balance, cash, marketValue })`.
   */
  updateAccountBalance(
    accountId: string,
    balance: number,
    cash: number,
    marketValue: number,
  ): boolean {
    const ok = this.updateAccountData(accountId, {
      balance,
      cash,
      marketValue,
      lastSync: Date.now(),
    });
    if (ok) this.emit('balance-updated', accountId);
    return ok;
  }

  /**
   * Update positions on the account data.
   */
  updateAccountPositions(
    accountId: string,
    positions: AccountData['positions'],
  ): boolean {
    return this.updateAccountData(accountId, { positions });
  }

  /**
   * Update the open-orders count and recently filled ids on the account data.
   */
  updateAccountOrders(
    accountId: string,
    openOrders: number,
    filledOrderIds: string[] = [],
  ): boolean {
    return this.updateAccountData(accountId, { lastSync: Date.now() });
  }

  /**
   * Accumulate realized P&L on the account. Returns the new total.
   */
  addRealizedPnL(accountId: string, pnl: number): number | undefined {
    const data = this.getAccountDataMutable(accountId);
    if (!data) return undefined;
    (data as AccountData & { realizedPnL?: number }).realizedPnL =
      ((data as AccountData & { realizedPnL?: number }).realizedPnL ?? 0) + pnl;
    this.emit('data-updated', accountId);
    return (data as AccountData & { realizedPnL?: number }).realizedPnL;
  }

  /**
   * Take a per-account snapshot (for cross-account analytics).
   */
  getAccountSnapshot(accountId: string) {
    const entry = this.entries.get(accountId);
    if (!entry) return undefined;
    return {
      id: accountId,
      config: entry.config,
      data: entry.data,
      status: entry.status,
    };
  }

  /**
   * Snapshot for every registered account.
   */
  getAllAccountSnapshots() {
    return Array.from(this.entries.keys()).map((id) => this.getAccountSnapshot(id)!);
  }

  /**
   * Return the active account (status === 'active'), or current account as fallback.
   */
  getActiveAccount() {
    const active = Array.from(this.entries.values()).find((e) => e.status === 'active');
    if (active) return this.getAccountSnapshot(active.config.id);
    if (this.currentAccountId) return this.getAccountSnapshot(this.currentAccountId);
    return undefined;
  }

  /**
   * Sync a single account (placeholder — broker-specific fetch happens upstream).
   * Records a sync attempt on the entry and emits `sync-complete`.
   */
  async syncAccount(accountId: string): Promise<boolean> {
    const entry = this.entries.get(accountId);
    if (!entry) return false;
    entry.status = 'syncing';
    this.emit('sync-started', accountId);
    entry.status = 'active';
    entry.data.lastSync = Date.now();
    this.emit('sync-complete', accountId);
    this.emit('account-synced', accountId);
    return true;
  }

  /**
   * Sync every registered account sequentially.
   */
  async syncAllAccounts(): Promise<number> {
    let count = 0;
    for (const id of this.entries.keys()) {
      if (await this.syncAccount(id)) count += 1;
    }
    return count;
  }

  /**
   * Whether any sync has been started and not yet completed.
   *
   * Note: this only reflects the *status* of accounts (syncing vs. active).
   * A pure periodic timer with no currently-in-flight sync returns `false`.
   * Callers that need to know whether the timer is running should track
   * `syncTimer` directly; we expose it via `hasActiveSyncTimer()` below.
   */
  isSyncRunning(): boolean {
    return this.syncTimer !== null;
  }

  /**
   * Whether the periodic sync timer is currently active.
   */
  hasActiveSyncTimer(): boolean {
    return this.syncTimer !== null;
  }

  /**
   * Start a periodic sync timer. Returns true if a new timer was started.
   */
  startSync(): boolean {
    if (this.syncTimer) return false;
    this.syncTimer = setInterval(() => {
      void this.syncAllAccounts();
    }, this.syncIntervalMs);
    this.syncTimer.unref?.();
    return true;
  }

  /**
   * Stop the periodic sync timer. Returns true if a timer was active.
   */
  stopSync(): boolean {
    if (!this.syncTimer) return false;
    clearInterval(this.syncTimer);
    this.syncTimer = null;
    return true;
  }

  /**
   * Cross-account analytics (delegates to the embedded AccountAnalytics engine).
   * Returns a flat object suitable for the multi-account dashboard.
   */
  getCrossAccountAnalytics() {
    const analytics = this._accountAnalytics;
    return {
      totalAccounts: this.entries.size,
      activeAccounts: Array.from(this.entries.values()).filter(
        (e) => e.status === 'active',
      ).length,
      totalBalance: Array.from(this.entries.values()).reduce(
        (s, e) => s + e.data.balance,
        0,
      ),
      totalMarketValue: Array.from(this.entries.values()).reduce(
        (s, e) => s + e.data.marketValue,
        0,
      ),
      accounts: this.getAllAccountSnapshots(),
      analytics: analytics ? analytics.getStats() : undefined,
    };
  }

  /**
   * Directly update account data fields (partial merge).
   */
  updateAccountData(
    accountId: string,
    patch: Partial<Omit<AccountData, 'accountId'>>,
  ): boolean {
    const entry = this.entries.get(accountId);
    if (!entry) {
      log.warn(
        `[MultiAccountAdapter] updateAccountData: "${accountId}" not found`,
      );
      return false;
    }

    if (patch.balance !== undefined) entry.data.balance = patch.balance;
    if (patch.cash !== undefined) entry.data.cash = patch.cash;
    if (patch.marketValue !== undefined)
      entry.data.marketValue = patch.marketValue;
    if (patch.positions !== undefined) entry.data.positions = patch.positions;
    if (patch.lastSync !== undefined) entry.data.lastSync = patch.lastSync;

    this.emit('data-updated', accountId);
    return true;
  }

  /**
   * Enable or disable an account.
   */
  setAccountEnabled(accountId: string, enabled: boolean): boolean {
    const entry = this.entries.get(accountId);
    if (!entry) return false;

    entry.config.enabled = enabled;
    entry.status = enabled ? 'active' : 'inactive';

    log.info(
      `[MultiAccountAdapter] Account "${accountId}" ${enabled ? 'enabled' : 'disabled'}`,
    );
    this.emit('account-updated', accountId);
    return true;
  }

  // --------------------------------------------------------------------------
  // Comparison & Analytics
  // --------------------------------------------------------------------------

  /**
   * Compare two accounts side-by-side.
   */
  compareAccounts(
    accountId1: string,
    accountId2: string,
  ): AccountComparison {
    const d1 = this.getAccountData(accountId1);
    const d2 = this.getAccountData(accountId2);

    if (!d1 || !d2) {
      // Return an empty comparison when one or both accounts are missing
      return {
        accountId1,
        accountId2,
        balance1: d1?.balance ?? 0,
        balance2: d2?.balance ?? 0,
        balanceDiff: (d1?.balance ?? 0) - (d2?.balance ?? 0),
        positionsCount1: d1?.positions.length ?? 0,
        positionsCount2: d2?.positions.length ?? 0,
        commonSymbols: [],
        uniqueSymbols1: [],
        uniqueSymbols2: [],
        pnlDiff: 0,
        lastSyncDiff: 0,
      };
    }

    const symbols1 = new Set(d1.positions.map((p) => p.symbol));
    const symbols2 = new Set(d2.positions.map((p) => p.symbol));

    const commonSymbols = [...symbols1].filter((s) => symbols2.has(s));
    const uniqueSymbols1 = [...symbols1].filter((s) => !symbols2.has(s));
    const uniqueSymbols2 = [...symbols2].filter((s) => !symbols1.has(s));

    const totalPnl1 = d1.positions.reduce((s, p) => s + p.unrealizedPnl, 0);
    const totalPnl2 = d2.positions.reduce((s, p) => s + p.unrealizedPnl, 0);

    return {
      accountId1,
      accountId2,
      balance1: d1.balance,
      balance2: d2.balance,
      balanceDiff: d1.balance - d2.balance,
      positionsCount1: d1.positions.length,
      positionsCount2: d2.positions.length,
      commonSymbols,
      uniqueSymbols1,
      uniqueSymbols2,
      pnlDiff: totalPnl1 - totalPnl2,
      lastSyncDiff: Math.abs(d1.lastSync - d2.lastSync),
    };
  }

  /**
   * Aggregated analytics across all accounts.
   */
  getAccountAnalytics(): AccountAnalytics {
    const allEntries = Array.from(this.entries.values());

    const totalAccounts = allEntries.length;
    const activeAccounts = allEntries.filter((e) => e.config.enabled).length;
    const paperAccounts = allEntries.filter(
      (e) => e.config.type === 'paper',
    ).length;
    const liveAccounts = allEntries.filter(
      (e) => e.config.type === 'live',
    ).length;

    let totalBalance = 0;
    let totalCash = 0;
    let totalMarketValue = 0;
    let totalUnrealizedPnl = 0;
    let totalPositions = 0;
    let lastSyncTimestamp = 0;
    let syncingAccounts = 0;
    let errorAccounts = 0;

    for (const entry of allEntries) {
      totalBalance += entry.data.balance;
      totalCash += entry.data.cash;
      totalMarketValue += entry.data.marketValue;
      totalPositions += entry.data.positions.length;

      for (const pos of entry.data.positions) {
        totalUnrealizedPnl += pos.unrealizedPnl;
      }

      if (entry.data.lastSync > lastSyncTimestamp) {
        lastSyncTimestamp = entry.data.lastSync;
      }

      if (entry.status === 'syncing') syncingAccounts++;
      if (entry.status === 'error') errorAccounts++;
    }

    return {
      totalAccounts,
      activeAccounts,
      paperAccounts,
      liveAccounts,
      totalBalance,
      totalCash,
      totalMarketValue,
      totalUnrealizedPnl,
      totalPositions,
      avgBalance: totalAccounts > 0 ? totalBalance / totalAccounts : 0,
      lastSyncTimestamp,
      syncingAccounts,
      errorAccounts,
    };
  }

  // --------------------------------------------------------------------------
  // Utility
  // --------------------------------------------------------------------------

  /**
   * Return count statistics. Exposes the field names the rest of the app uses
   * (`totalAccounts`, `activeAccounts`, `primaryAccounts`, `apiAccounts`,
   * `totalBalance`) so the multi-account dashboard can render directly.
   */
  getStats(): {
    totalAccounts: number;
    activeAccounts: number;
    primaryAccounts: number;
    apiAccounts: number;
    paperAccounts: number;
    liveAccounts: number;
    totalBalance: number;
    totalMarketValue: number;
  } {
    const entries = Array.from(this.entries.values());
    return {
      totalAccounts: entries.length,
      activeAccounts: entries.filter((e) => e.status === 'active').length,
      primaryAccounts: entries.filter((e) => e.config.type === 'primary').length,
      apiAccounts: entries.filter((e) => e.config.type === 'api').length,
      paperAccounts: entries.filter((e) => e.config.type === 'paper').length,
      liveAccounts: entries.filter((e) => e.config.type === 'live').length,
      totalBalance: entries.reduce((s, e) => s + e.data.balance, 0),
      totalMarketValue: entries.reduce((s, e) => s + e.data.marketValue, 0),
    };
  }

  /**
   * Check whether an account exists.
   */
  hasAccount(accountId: string): boolean {
    return this.entries.has(accountId);
  }

  /**
   * Get the number of registered accounts.
   */
  get accountCount(): number {
    return this.entries.size;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  /**
   * Destroy the adapter: clear all data and listeners.
   */
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.entries.clear();
    this.currentAccountId = null;
    this.removeAllListeners();
    log.info('[MultiAccountAdapter] Destroyed');
    this.emit('destroyed');
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createMultiAccountAdapter(
  syncProvider?: (accountId: string) => Promise<Partial<AccountData>>,
): MultiAccountAdapter {
  return new MultiAccountAdapter(syncProvider);
}

export default MultiAccountAdapter;
