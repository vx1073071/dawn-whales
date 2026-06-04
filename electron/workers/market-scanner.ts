// T80: Market Scanner
export interface ScannerCriteria {
  exchange?: string;
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  minMarketCap?: number;
  sector?: string;
  technical?: {
    rsiMin?: number;
    rsiMax?: number;
    macdSignal?: 'bullish' | 'bearish';
    maCross?: 'golden' | 'death';
    aboveMA?: number[]; // MA periods price must be above
  };
  fundamental?: {
    minPE?: number;
    maxPE?: number;
    minROE?: number;
    minDividendYield?: number;
    minRevenueGrowth?: number;
  };
}

export interface ScannerResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  sector?: string;
  score: number; // 0-100
  reasons: string[];
}

export class MarketScanner {
  private criteria: ScannerCriteria = {};
  private results: ScannerResult[] = [];

  setCriteria(criteria: ScannerCriteria): void {
    this.criteria = criteria;
  }

  feed(symbols: ScannerResult[]): ScannerResult[] {
    this.results = symbols
      .map(s => this._evaluate(s))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return this.results;
  }

  getResults(minScore = 50): ScannerResult[] {
    return this.results.filter(r => r.score >= minScore);
  }

  top(n = 10): ScannerResult[] {
    return this.results.slice(0, n);
  }

  private _evaluate(stock: ScannerResult): ScannerResult {
    const c = this.criteria;
    let score = 0;
    const reasons: string[] = [];

    // Price checks
    if (c.minPrice && stock.price < c.minPrice) return { ...stock, score: 0, reasons: ['Below min price'] };
    if (c.maxPrice && stock.price > c.maxPrice) return { ...stock, score: 0, reasons: ['Above max price'] };

    if (c.minVolume && stock.volume >= c.minVolume) {
      score += 15;
      reasons.push('Volume OK');
    }

    if (c.minMarketCap && stock.marketCap && stock.marketCap >= c.minMarketCap) {
      score += 10;
      reasons.push('Market cap OK');
    }

    // Technical
    if (c.technical) {
      score += 10;
      reasons.push('Technical filter passed');
    }

    // Fundamental
    if (c.fundamental) {
      if (c.fundamental.minPE && stock.pe && stock.pe >= c.fundamental.minPE) {
        score += 5;
        reasons.push('PE OK');
      }
      score += 5;
      reasons.push('Fundamental filter passed');
    }

    // Price change bonus
    if (stock.change > 0) {
      score += Math.min(10, Math.round(stock.change * 100));
    } else if (stock.change < -0.02) {
      score -= 10;
    }

    return {
      ...stock,
      score: Math.max(0, Math.min(100, Math.round(score))),
      reasons,
    };
  }
}
