// ── DAWN WHALES — Account Aggregator (Cross-Broker Asset Aggregation) ────────
// Aggregates account data, positions, and summary across multiple brokers.

import log from 'electron-log';
import type { BrokerManager } from './BrokerManager';
import type { AccountInfo, PositionInfo, IBrokerAdapter } from './IBrokerAdapter';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface AggregatedAccount {
  brokerId: string;
  brokerName: string;
  accountId: string;
  currency: string;
  totalAssets: number;
  cash: number;
  marketValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export interface AggregatedPosition {
  code: string;
  name: string;
  totalQty: number;
  avgCost: number;
  marketPrice: number;
  totalValue: number;
  totalPnl: number;
  pnlPct: number;
  brokers: { brokerId: string; qty: number; cost: number }[];
}

export interface AggregatedSummary {
  totalAssets: number;
  totalCash: number;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  currency: string; // normalized to USD
  accountCount: number;
  positionCount: number;
}

// ── Currency Rates (simplified, hardcoded) ──────────────────────────────────

const FX_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  HKD: 0.1282,     // ~7.80 HKD/USD
  CNY: 0.1380,     // ~7.25 CNY/USD
  CNH: 0.1380,
  JPY: 0.00667,    // ~150 JPY/USD
  GBP: 1.2600,
  EUR: 1.0800,
  AUD: 0.6500,
  SGD: 0.7400,
  KRW: 0.000735,
  TWD: 0.0310,
};

// ── Helper: Safe numeric extraction ─────────────────────────────────────────

function safeNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

// ── Aggregator Class ────────────────────────────────────────────────────────

export class AccountAggregator {
  private brokerManager: BrokerManager;

  constructor(brokerManager: BrokerManager) {
    this.brokerManager = brokerManager;
  }

  // ── Currency Conversion ─────────────────────────────────────────────────

  /**
   * Convert an amount from a given currency to USD using hardcoded rates.
   * Returns the original amount if the currency is not found (with a warning).
   */
  convertToUSD(amount: number, fromCurrency: string): number {
    const currency = (fromCurrency || 'USD').toUpperCase();
    const rate = FX_RATES_TO_USD[currency];
    if (rate === undefined) {
      log.warn(`[AccountAggregator] Unknown currency "${fromCurrency}", treating as 1:1 USD`);
      return amount;
    }
    return amount * rate;
  }

  // ── Get Connected Brokers ──────────────────────────────────────────────

  /**
   * Retrieve the list of connected broker adapters from BrokerManager.
   * Filters out any brokers that are not currently connected.
   */
  private getConnectedBrokers(): { id: string; name: string; adapter: IBrokerAdapter }[] {
    const statusList = this.brokerManager.getStatus();
    const connected: { id: string; name: string; adapter: IBrokerAdapter }[] = [];

    for (const status of statusList) {
      if (!status.connected) {
        log.warn(`[AccountAggregator] Broker "${status.name}" (${status.id}) is disconnected, skipping.`);
        continue;
      }
      const adapter = this.brokerManager.getBroker(status.id);
      if (adapter) {
        connected.push({ id: status.id, name: status.name, adapter });
      } else {
        log.warn(`[AccountAggregator] Broker adapter not found for "${status.id}" despite connected status.`);
      }
    }

    return connected;
  }

  // ── Get All Accounts ────────────────────────────────────────────────────

  /**
   * Fetch all accounts from all connected brokers.
   * Each account is enriched with broker metadata and P&L figures.
   * Disconnected brokers are skipped with a warning.
   */
  async getAllAccounts(): Promise<AggregatedAccount[]> {
    const brokers = this.getConnectedBrokers();
    const results: AggregatedAccount[] = [];

    for (const broker of brokers) {
      try {
        const accounts: AccountInfo[] = await broker.adapter.getAccounts();

        for (const acct of accounts) {
          // Fetch funds for more detailed asset info
          let funds;
          try {
            funds = await broker.adapter.getFunds(acct.accountId);
          } catch (fundsErr) {
            log.warn(`[AccountAggregator] Failed to fetch funds for account ${acct.accountId} on broker ${broker.id}: ${fundsErr}`);
          }

          // Fetch positions to compute unrealized P&L
          let positions: PositionInfo[] = [];
          try {
            positions = await broker.adapter.getPositions(acct.accountId);
          } catch (posErr) {
            log.warn(`[AccountAggregator] Failed to fetch positions for account ${acct.accountId} on broker ${broker.id}: ${posErr}`);
          }

          const unrealizedPnl = positions.reduce(
            (sum, p) => sum + safeNumber(p.pnl),
            0
          );

          // Realized P&L: derive from total assets minus (cash + market value) if available,
          // or default to 0 when we cannot determine it.
          const totalAssets = safeNumber(funds?.totalAssets ?? acct.totalAssets);
          const cash = safeNumber(funds?.cash ?? acct.cash);
          const marketValue = safeNumber(funds?.marketValue ?? acct.marketValue);
          const realizedPnl = totalAssets - cash - marketValue;

          results.push({
            brokerId: broker.id,
            brokerName: broker.name,
            accountId: acct.accountId,
            currency: acct.currency || funds?.currency || 'USD',
            totalAssets,
            cash,
            marketValue,
            unrealizedPnl,
            realizedPnl: Number.isFinite(realizedPnl) ? realizedPnl : 0,
          });
        }
      } catch (err) {
        log.error(`[AccountAggregator] Error fetching accounts from broker "${broker.id}": ${err}`);
      }
    }

    log.info(`[AccountAggregator] Retrieved ${results.length} accounts from ${brokers.length} connected brokers.`);
    return results;
  }

  // ── Get Aggregated Positions ───────────────────────────────────────────

  /**
   * Aggregate positions across all brokers.
   * Positions with the same stock code are merged:
   *  - totalQty: sum of quantities
   *  - avgCost: weighted average cost
   *  - marketPrice: last available market price (from the broker with the largest position)
   *  - totalValue, totalPnl, pnlPct: computed from merged data
   *  - brokers: per-broker breakdown
   */
  async getAggregatedPositions(): Promise<AggregatedPosition[]> {
    const brokers = this.getConnectedBrokers();

    // Map: code -> aggregated position data
    const positionMap = new Map<string, {
      name: string;
      totalQty: number;
      totalCostBasis: number;
      marketPrice: number;
      maxQty: number; // track which broker has the most for price reference
      totalValue: number;
      brokers: { brokerId: string; qty: number; cost: number }[];
    }>();

    for (const broker of brokers) {
      try {
        const accounts: AccountInfo[] = await broker.adapter.getAccounts();

        for (const acct of accounts) {
          let positions: PositionInfo[] = [];
          try {
            positions = await broker.adapter.getPositions(acct.accountId);
          } catch (posErr) {
            log.warn(`[AccountAggregator] Failed to fetch positions for account ${acct.accountId} on broker ${broker.id}: ${posErr}`);
            continue;
          }

          for (const pos of positions) {
            const code = pos.code;
            const qty = safeNumber(pos.qty);
            const costPrice = safeNumber(pos.costPrice);
            const marketPrice = safeNumber(pos.marketPrice);
            const marketValue = safeNumber(pos.marketValue);

            if (qty <= 0) continue; // Skip empty or closed positions

            const existing = positionMap.get(code);
            const costBasis = qty * costPrice;

            if (existing) {
              existing.totalQty += qty;
              existing.totalCostBasis += costBasis;
              existing.totalValue += marketValue;

              // Use market price from the broker with the largest position
              if (qty > existing.maxQty) {
                existing.marketPrice = marketPrice;
                existing.maxQty = qty;
              }

              existing.brokers.push({
                brokerId: broker.id,
                qty,
                cost: costPrice,
              });
            } else {
              positionMap.set(code, {
                name: pos.name || code,
                totalQty: qty,
                totalCostBasis: costBasis,
                marketPrice,
                maxQty: qty,
                totalValue: marketValue,
                brokers: [{ brokerId: broker.id, qty, cost: costPrice }],
              });
            }
          }
        }
      } catch (err) {
        log.error(`[AccountAggregator] Error fetching positions from broker "${broker.id}": ${err}`);
      }
    }

    // Convert map to array with computed fields
    const results: AggregatedPosition[] = [];

    for (const [code, data] of positionMap.entries()) {
      const avgCost = data.totalQty > 0
        ? data.totalCostBasis / data.totalQty
        : 0;

      const totalValue = data.totalValue;
      const totalCost = data.totalCostBasis;
      const totalPnl = totalValue - totalCost;
      const pnlPct = totalCost > 0
        ? (totalPnl / totalCost) * 100
        : 0;

      results.push({
        code,
        name: data.name,
        totalQty: data.totalQty,
        avgCost: Math.round(avgCost * 100) / 100,
        marketPrice: data.marketPrice,
        totalValue: Math.round(totalValue * 100) / 100,
        totalPnl: Math.round(totalPnl * 100) / 100,
        pnlPct: Math.round(pnlPct * 100) / 100,
        brokers: data.brokers,
      });
    }

    // Sort by total value descending
    results.sort((a, b) => b.totalValue - a.totalValue);

    log.info(`[AccountAggregator] Aggregated ${results.length} unique positions from ${brokers.length} brokers.`);
    return results;
  }

  // ── Get Summary ────────────────────────────────────────────────────────

  /**
   * Compute an overall summary across all brokers, normalized to USD.
   * Includes total assets, cash, market value, unrealized P&L, realized P&L,
   * the number of accounts, and the number of unique positions.
   */
  async getSummary(): Promise<AggregatedSummary> {
    const [accounts, positions] = await Promise.all([
      this.getAllAccounts(),
      this.getAggregatedPositions(),
    ]);

    let totalAssets = 0;
    let totalCash = 0;
    let totalMarketValue = 0;
    let totalUnrealizedPnl = 0;
    let totalRealizedPnl = 0;

    for (const acct of accounts) {
      totalAssets += this.convertToUSD(acct.totalAssets, acct.currency);
      totalCash += this.convertToUSD(acct.cash, acct.currency);
      totalMarketValue += this.convertToUSD(acct.marketValue, acct.currency);
      totalUnrealizedPnl += this.convertToUSD(acct.unrealizedPnl, acct.currency);
      totalRealizedPnl += this.convertToUSD(acct.realizedPnl, acct.currency);
    }

    // Round all values to 2 decimal places for display
    const summary: AggregatedSummary = {
      totalAssets: Math.round(totalAssets * 100) / 100,
      totalCash: Math.round(totalCash * 100) / 100,
      totalMarketValue: Math.round(totalMarketValue * 100) / 100,
      totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
      totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100,
      currency: 'USD',
      accountCount: accounts.length,
      positionCount: positions.length,
    };

    log.info(
      `[AccountAggregator] Summary: ${summary.accountCount} accounts, ` +
      `${summary.positionCount} positions, ` +
      `Total Assets: $${summary.totalAssets.toLocaleString()}`
    );

    return summary;
  }
}
