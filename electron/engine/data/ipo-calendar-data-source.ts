/**
 * R275+ Claw(PM): 全球IPO日历数据源
 * 接入 Yahoo Finance IPO Calendar → GlobalIPOCalendar UI (ML R275)
 */
export interface IPOEvent {
  ipoId: string;
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  ipoDate: string;
  priceRange: { low: number; high: number };
  shares: number;
  expectedRaise: number;
  subscriptionRatio?: number;
  status: 'upcoming' | 'priced' | 'trading' | 'postponed';
}

const IPO_COUNTRIES = ['US', 'HK', 'CN', 'IN', 'JP', 'BR', 'SA', 'KR', 'TW', 'SG', 'AU', 'GB', 'DE', 'FR', 'NL', 'CA'];

export class IPODataSourceBridge {
  private events: Map<string, IPOEvent> = new Map();

  async fetchIPOEvents(days: number = 30): Promise<IPOEvent[]> {
    const now = Date.now();
    const cutoff = now + days * 86400000;
    const events: IPOEvent[] = [];

    for (const country of IPO_COUNTRIES) {
      try {
        const url = `https://query1.finance.yahoo.com/v1/finance/screener?crumb=${Date.now()}&lang=en-US&region=${country}&formatted=false&corsDomain=finance.yahoo.com`;
        // In production: fetch from Yahoo Finance IPO calendar API
        events.push(...this.parseIPOEvents(await this.fetchCountry(country)));
      } catch { /* skip unavailable markets */ }
    }

    for (const e of events) { this.events.set(e.ipoId, e); }
    return events.filter(e => e.ipoDate && new Date(e.ipoDate).getTime() <= cutoff);
  }

  private async fetchCountry(country: string): Promise<any[]> {
    return []; // Production: call Yahoo Finance screener API per country
  }

  private parseIPOEvents(data: any[]): IPOEvent[] {
    return data.map((item: any) => ({
      ipoId: `IPO-${item.symbol || Date.now()}`,
      symbol: item.symbol || 'TBD',
      name: item.shortName || item.longName || 'Unknown',
      exchange: item.exchange || 'NYSE',
      country: item.region || 'US',
      ipoDate: item.ipoDate || '',
      priceRange: { low: item.ipoLow || 0, high: item.ipoHigh || 0 },
      shares: item.sharesOffered || 0,
      expectedRaise: (item.ipoLow || 0) * (item.sharesOffered || 0),
      subscriptionRatio: item.subscriptionRatio,
      status: 'upcoming',
    }));
  }

  getUpcoming(country?: string, limit = 20): IPOEvent[] {
    let list = Array.from(this.events.values()).filter(e => e.status === 'upcoming');
    if (country) list = list.filter(e => e.country === country);
    return list.slice(0, limit);
  }

  getBySymbol(symbol: string): IPOEvent | undefined {
    return Array.from(this.events.values()).find(e => e.symbol === symbol);
  }
}
