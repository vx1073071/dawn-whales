/**
 * DataChannelEngine.ts — R208 J1: VIP Data Channel Engine
 * 
 * 3-level data latency pricing:
 *   FREE — 15 min delay, free
 *   PAID 0.5U — 1 min delay, 0.5 USDT per switch
 *   Realtime 1U — real-time, 1 USDT per switch
 * 
 * Charging: per-switch (upgrade-only charge, no refund on downgrade)
 * Auto-degrade: if PAID/REALTIME unavailable → fall back to FREE
 */
import { EventEmitter } from 'events';

export enum DataTier { FREE = 0, PAID_1MIN = 1, REALTIME = 2 }

export const DATA_TIER_LABELS: Record<DataTier, string> = {
  [DataTier.FREE]: 'FREE 15min', [DataTier.PAID_1MIN]: 'PAID 1min 0.5U', [DataTier.REALTIME]: 'REALTIME 1U',
};

export const DATA_TIER_PRICES: Record<DataTier, number> = {
  [DataTier.FREE]: 0, [DataTier.PAID_1MIN]: 0.5, [DataTier.REALTIME]: 1,
};

export const DATA_TIER_DELAY_MS: Record<DataTier, number> = {
  [DataTier.FREE]: 15 * 60 * 1000, [DataTier.PAID_1MIN]: 1 * 60 * 1000, [DataTier.REALTIME]: 0,
};

export enum DataSourceType {
  OPTION_IV = 'option_iv', FUND_FLOW = 'fund_flow', ON_CHAIN = 'on_chain',
  FUTURES_COT = 'futures_cot', TICK_ORDERBOOK = 'tick_orderbook', CROSS_PRICE = 'cross_price',
}

export const DATA_SOURCE_LABELS: Record<DataSourceType, string> = {
  [DataSourceType.OPTION_IV]: 'Option IV', [DataSourceType.FUND_FLOW]: 'Fund Flow',
  [DataSourceType.ON_CHAIN]: 'On-Chain', [DataSourceType.FUTURES_COT]: 'Futures COT',
  [DataSourceType.TICK_ORDERBOOK]: 'Tick Orderbook', [DataSourceType.CROSS_PRICE]: 'Cross-Market Price',
};

export interface DataChannelConfig { userId: string; sourceType: DataSourceType; tier: DataTier; updatedAt: number; }
export interface DataChannelSnapshot { userId: string; channels: DataChannelConfig[]; totalSpentUSDT: number; lastSwitchAt: number; }
export interface TierSwitchRequest { userId: string; sourceType: DataSourceType; targetTier: DataTier; balanceUSDT: number; }
export interface TierSwitchResult { success: boolean; previousTier: DataTier; newTier: DataTier; chargedUSDT: number; error?: string; }

export class DataChannelEngine extends EventEmitter {
  private channels = new Map<string, DataChannelConfig>();
  private adapters = new Map<DataSourceType, Map<DataTier, any>>();
  private health = new Map<string, { available: boolean; lastCheck: number }>();
  private totalSpent = new Map<string, number>();

  private key(userId: string, sourceType: DataSourceType): string {
    return userId + ':' + sourceType;
  }

  registerAdapter(sourceType: DataSourceType, tier: DataTier, adapter: any): void {
    if (!this.adapters.has(sourceType)) this.adapters.set(sourceType, new Map());
    this.adapters.get(sourceType)!.set(tier, adapter);
  }

  getAdapter(sourceType: DataSourceType, tier: DataTier): any | null {
    return this.adapters.get(sourceType)?.get(tier) ?? null;
  }

  getChannel(userId: string, sourceType: DataSourceType): DataChannelConfig {
    const k = this.key(userId, sourceType);
    if (!this.channels.has(k)) {
      this.channels.set(k, { userId, sourceType, tier: DataTier.FREE, updatedAt: Date.now() });
    }
    return this.channels.get(k)!;
  }

  getSnapshot(userId: string): DataChannelSnapshot {
    const chs: DataChannelConfig[] = [];
    for (const [k, cfg] of this.channels) {
      if (cfg.userId === userId) chs.push({ ...cfg });
    }
    return { userId, channels: chs, totalSpentUSDT: this.totalSpent.get(userId) ?? 0, lastSwitchAt: Date.now() };
  }

  switchTier(req: TierSwitchRequest): TierSwitchResult {
    const current = this.getChannel(req.userId, req.sourceType);
    const prev = current.tier;
    if (prev === req.targetTier) return { success: true, previousTier: prev, newTier: req.targetTier, chargedUSDT: 0 };

    const targetAdapter = this.getAdapter(req.sourceType, req.targetTier);
    if (!targetAdapter) {
      if (req.targetTier > DataTier.FREE && this.getAdapter(req.sourceType, DataTier.FREE)) {
        current.tier = DataTier.FREE; current.updatedAt = Date.now();
        this.emit('autoDegrade', { userId: req.userId, sourceType: req.sourceType, to: DataTier.FREE, reason: 'Target tier unavailable' });
        return { success: true, previousTier: prev, newTier: DataTier.FREE, chargedUSDT: 0, error: 'Auto-degraded to FREE' };
      }
      return { success: false, previousTier: prev, newTier: prev, chargedUSDT: 0, error: 'No adapter for target tier' };
    }

    const adapterKey = req.sourceType + ':' + req.targetTier;
    const h = this.health.get(adapterKey);
    if (h && !h.available && req.targetTier > DataTier.FREE) {
      return this.switchTier({ ...req, targetTier: DataTier.FREE });
    }

    let charged = 0;
    if (req.targetTier > prev) charged = DATA_TIER_PRICES[req.targetTier] - DATA_TIER_PRICES[prev];
    if (charged > 0 && req.balanceUSDT < charged) {
      return { success: false, previousTier: prev, newTier: prev, chargedUSDT: 0, error: 'Insufficient balance' };
    }

    current.tier = req.targetTier; current.updatedAt = Date.now();
    this.totalSpent.set(req.userId, (this.totalSpent.get(req.userId) ?? 0) + charged);
    this.emit('tierSwitch', { userId: req.userId, sourceType: req.sourceType, from: prev, to: req.targetTier, chargedUSDT: charged });
    return { success: true, previousTier: prev, newTier: req.targetTier, chargedUSDT: charged };
  }

  markHealth(sourceType: DataSourceType, tier: DataTier, available: boolean): void {
    this.health.set(sourceType + ':' + tier, { available, lastCheck: Date.now() });
  }

  isHealthy(sourceType: DataSourceType, tier: DataTier): boolean {
    return this.health.get(sourceType + ':' + tier)?.available ?? true;
  }

  runHealthCheck(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [src, tierMap] of this.adapters) {
      for (const [tier, adapter] of tierMap) {
        const key = src + ':' + tier;
        try {
          const h = typeof adapter.isHealthy === 'function' ? adapter.isHealthy() : true;
          this.markHealth(src, tier, h); result[key] = h;
        } catch { this.markHealth(src, tier, false); result[key] = false; }
      }
    }
    return result;
  }

  getHealthReport(): Record<string, { available: boolean; ageMs: number }> {
    const now = Date.now();
    const report: Record<string, { available: boolean; ageMs: number }> = {};
    for (const [k, h] of this.health) report[k] = { available: h.available, ageMs: now - h.lastCheck };
    return report;
  }

  getStats() {
    const byTier: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
    const bySource: Record<string, number> = {};
    let totalCh = 0, totalSp = 0;
    for (const [, cfg] of this.channels) {
      totalCh++; byTier[cfg.tier] = (byTier[cfg.tier] ?? 0) + 1;
      bySource[cfg.sourceType] = (bySource[cfg.sourceType] ?? 0) + 1;
    }
    for (const [, amt] of this.totalSpent) totalSp += amt;
    return { totalChannels: totalCh, byTier, bySource, totalSpentUSDT: totalSp };
  }

  reset(): void {
    this.channels.clear(); this.health.clear(); this.totalSpent.clear(); this.adapters.clear(); this.removeAllListeners();
  }
}

export const dataChannelEngine = new DataChannelEngine();

// ─── IPC Handlers ────────────────────────────────────────────────────
export function registerDataChannelIPC(mainProcess: any): void {
  const engine = dataChannelEngine;
  mainProcess.handle('data-channel:get-snapshot', async (_e: any, userId: string) => engine.getSnapshot(userId));
  mainProcess.handle('data-channel:switch-tier', async (_e: any, req: TierSwitchRequest) => engine.switchTier(req));
  mainProcess.handle('data-channel:get-stats', async () => engine.getStats());
  mainProcess.handle('data-channel:health-report', async () => engine.getHealthReport());
  mainProcess.handle('data-channel:run-health-check', async () => engine.runHealthCheck());
}
