// T75: Multi-Broker Account Aggregator
export interface AccountSummary {
  brokerId: string;
  brokerName: string;
  totalValue: number;
  cash: number;
  marketValue: number;
  currency: string;
  todayPnl: number;
  totalPnl: number;
  positions: number;
  lastUpdated: number;
}

export interface AggregatedAccount {
  totalValue: number; // in base currency
  totalCash: number;
  totalMarketValue: number;
  totalPnl: number;
  todayPnl: number;
  totalPositions: number;
  accounts: AccountSummary[];
  lastUpdated: number;
}

export type AccountListener = (summary: AccountSummary) => void;

export class AccountAggregator {
  private accounts = new Map<string, AccountSummary>();
  private listeners: AccountListener[] = [];
  private baseCurrency = 'HKD';

  setBaseCurrency(currency: string): void {
    this.baseCurrency = currency;
  }

  updateAccount(summary: AccountSummary): void {
    summary.lastUpdated = Date.now();
    this.accounts.set(summary.brokerId, summary);
    for (const listener of this.listeners) {
      try { listener(summary); } catch { /* silent */ }
    }
  }

  removeAccount(brokerId: string): void {
    this.accounts.delete(brokerId);
  }

  onUpdate(listener: AccountListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  aggregate(): AggregatedAccount {
    const accountList = Array.from(this.accounts.values());

    if (accountList.length === 0) {
      return {
        totalValue: 0, totalCash: 0, totalMarketValue: 0,
        totalPnl: 0, todayPnl: 0, totalPositions: 0,
        accounts: [], lastUpdated: 0,
      };
    }

    return {
      totalValue: this._sum(accountList, 'totalValue'),
      totalCash: this._sum(accountList, 'cash'),
      totalMarketValue: this._sum(accountList, 'marketValue'),
      totalPnl: this._sum(accountList, 'totalPnl'),
      todayPnl: this._sum(accountList, 'todayPnl'),
      totalPositions: this._sum(accountList, 'positions'),
      accounts: accountList,
      lastUpdated: Math.max(...accountList.map(a => a.lastUpdated)),
    };
  }

  getAccount(brokerId: string): AccountSummary | undefined {
    return this.accounts.get(brokerId);
  }

  listAccounts(): AccountSummary[] {
    return Array.from(this.accounts.values());
  }

  private _sum(items: AccountSummary[], key: keyof AccountSummary): number {
    return items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
  }
}

export const accountAggregator = new AccountAggregator();
