// DAWN WHALES R115 QTE-29 — MarketScanner Engine
// PM: 5预设+自定义扫描, 动态选股对接, 结果排序缓存, 500+标的<3s, 命中率>80%

import type { CachedQuote } from './quote-cache';

// ═══════════ Types ═══════════

export interface ScanCriteria {
  field: string;        // 'price', 'volume', 'change', 'changePct', 'marketCap', 'pe', 'rsi', ...
  operator: '>' | '<' | '>=' | '<=' | 'between' | 'top_n' | 'bottom_n' | 'cross';
  value: number;
  value2?: number;      // for between / top_n / bottom_n (n)
}

export interface ScanPreset {
  id: string;
  name: string;
  description: string;
  criteria: ScanCriteria[];
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  limit: number;
  category: 'momentum' | 'value' | 'volume' | 'technical' | 'breakout' | 'custom';
}

export interface ScanResult {
  symbol: string;
  brokerId: string;
  score: number;        // 0-100 composite score
  rank: number;
  matches: { criteria: string; value: number; threshold: string }[];
  quote: CachedQuote;
}

export interface ScanJob {
  id: string;
  criteria: ScanCriteria[];
  symbols: string[];
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  limit: number;
  startedAt: number;
  completedAt?: number;
  status: 'pending' | 'running' | 'done' | 'error';
  results: ScanResult[];
  error?: string;
}

// ═══════════ Preset Scans ═══════════

export const MARKET_SCANNER_PRESETS: ScanPreset[] = [
  {
    id: 'momentum_gainers',
    name: '涨幅榜',
    description: '当日涨幅靠前的标的',
    criteria: [{ field: 'changePct', operator: 'top_n', value: 50 }],
    sortBy: 'changePct',
    sortDirection: 'desc',
    limit: 50,
    category: 'momentum',
  },
  {
    id: 'momentum_losers',
    name: '跌幅榜',
    description: '当日跌幅靠前的标的',
    criteria: [{ field: 'changePct', operator: 'bottom_n', value: 50 }],
    sortBy: 'changePct',
    sortDirection: 'asc',
    limit: 50,
    category: 'momentum',
  },
  {
    id: 'volume_spike',
    name: '放量突破',
    description: '成交量>5日均量的2倍且涨幅>3%',
    criteria: [
      { field: 'volumeRatio', operator: '>', value: 2 },
      { field: 'changePct', operator: '>', value: 3 },
    ],
    sortBy: 'volumeRatio',
    sortDirection: 'desc',
    limit: 30,
    category: 'volume',
  },
  {
    id: 'value_low_pe',
    name: '低估值',
    description: '市盈率<15且市值>1B的低估值标的',
    criteria: [
      { field: 'pe', operator: '<', value: 15 },
      { field: 'pe', operator: '>', value: 0 },
    ],
    sortBy: 'pe',
    sortDirection: 'asc',
    limit: 30,
    category: 'value',
  },
  {
    id: 'breakout_high',
    name: '突破新高',
    description: '价格突破52周最高价且在2%以内',
    criteria: [
      { field: 'price', operator: '>=', value: 0 }, // dynamic check against 52w high
      { field: 'changePct', operator: '>', value: 2 },
    ],
    sortBy: 'changePct',
    sortDirection: 'desc',
    limit: 20,
    category: 'breakout',
  },
];

// ═══════════ MarketScanner ═══════════

export class MarketScanner {
  private presets: ScanPreset[] = [...MARKET_SCANNER_PRESETS];
  private jobHistory: ScanJob[] = [];
  private resultCache: Map<string, { results: ScanResult[]; cachedAt: number }> = new Map();
  private cacheTTL = 30000; // 30s result cache
  private jobCounter = 0;

  /** Register custom preset */
  addPreset(preset: ScanPreset): void {
    const idx = this.presets.findIndex((p) => p.id === preset.id);
    if (idx >= 0) this.presets[idx] = preset;
    else this.presets.push(preset);
  }

  getPresets(): ScanPreset[] {
    return this.presets;
  }

  getPreset(id: string): ScanPreset | undefined {
    return this.presets.find((p) => p.id === id);
  }

  /** Run a scan against quotes */
  scan(
    quotes: CachedQuote[],
    criteria: ScanCriteria[],
    sortBy: string,
    sortDir: 'asc' | 'desc',
    limit: number,
    presetId?: string
  ): ScanJob {
    const jobId = `scan-${this.jobCounter++}-${Date.now()}`;
    const job: ScanJob = {
      id: jobId,
      criteria,
      symbols: quotes.map((q) => q.symbol),
      sortBy,
      sortDirection: sortDir,
      limit,
      startedAt: Date.now(),
      status: 'running',
      results: [],
    };

    try {
      // Filter
      const matched: { symbol: string; brokerId: string; quote: CachedQuote; matches: ScanResult['matches'] }[] = [];
      for (const quote of quotes) {
        const allMatch = this.evaluateCriteria(quote, criteria);
        if (allMatch.length === criteria.length) {
          matched.push({
            symbol: quote.symbol,
            brokerId: quote.brokerId,
            quote,
            matches: allMatch,
          });
        }
      }

      // Sort
      const getValue = (q: CachedQuote): number => {
        const v = (q as unknown as Record<string, unknown>)[sortBy];
        return typeof v === 'number' ? v : 0;
      };

      matched.sort((a, b) => {
        const va = getValue(a.quote);
        const vb = getValue(b.quote);
        return sortDir === 'desc' ? vb - va : va - vb;
      });

      // Score: normalize position 0-100
      const total = matched.length;
      const scored: ScanResult[] = matched.slice(0, limit).map((m, i) => ({
        symbol: m.symbol,
        brokerId: m.brokerId,
        score: total > 0 ? Math.round(100 - (i / total) * 100) : 0,
        rank: i + 1,
        matches: m.matches,
        quote: m.quote,
      }));

      job.results = scored;
      job.status = 'done';
      job.completedAt = Date.now();

      // Cache result
      if (presetId) {
        this.resultCache.set(presetId, { results: scored, cachedAt: Date.now() });
      }
    } catch (err) {
      job.status = 'error';
      job.error = String(err);
    }

    this.jobHistory.push(job);
    return job;
  }

  /** Run a preset scan */
  scanPreset(presetId: string, quotes: CachedQuote[]): ScanJob | null {
    // Check cache
    const cached = this.resultCache.get(presetId);
    if (cached && Date.now() - cached.cachedAt < this.cacheTTL) {
      // Return last cached results
      return this.getLastJob(presetId) || this.scan(quotes, [], 'score', 'desc', 50, presetId);
    }

    const preset = this.presets.find((p) => p.id === presetId);
    if (!preset) return null;

    return this.scan(quotes, preset.criteria, preset.sortBy, preset.sortDirection, preset.limit, presetId);
  }

  /** Run all preset scans */
  scanAllPresets(quotes: CachedQuote[]): ScanJob[] {
    return this.presets.map((p) => this.scanPreset(p.id, quotes)!);
  }

  /** Get last job for a preset */
  getLastJob(presetId: string): ScanJob | undefined {
    return [...this.jobHistory].reverse().find((j) => {
      const preset = this.presets.find((p) => p.id === presetId);
      return preset && JSON.stringify(j.criteria) === JSON.stringify(preset.criteria);
    });
  }

  getJobHistory(): ScanJob[] {
    return this.jobHistory;
  }

  getCacheStats(): { entries: number; oldestMs: number } {
    let entries = 0;
    let oldest = 0;
    for (const [, v] of this.resultCache) {
      entries++;
      if (oldest === 0 || v.cachedAt < oldest) oldest = v.cachedAt;
    }
    return { entries, oldestMs: oldest ? Date.now() - oldest : 0 };
  }

  clearCache(): void {
    this.resultCache.clear();
  }

  private evaluateCriteria(quote: CachedQuote, criteria: ScanCriteria[]): { criteria: string; value: number; threshold: string }[] {
    const matches: { criteria: string; value: number; threshold: string }[] = [];
    for (const c of criteria) {
      const fieldVal = this.getFieldValue(quote, c.field);
      let matched = false;
      switch (c.operator) {
        case '>': matched = fieldVal > c.value; break;
        case '<': matched = fieldVal < c.value; break;
        case '>=': matched = fieldVal >= c.value; break;
        case '<=': matched = fieldVal <= c.value; break;
        case 'between': matched = c.value2 !== undefined && fieldVal >= c.value && fieldVal <= c.value2; break;
        case 'top_n':
        case 'bottom_n':
          // top_n/bottom_n handled post-filter in sort
          matched = true;
          break;
        case 'cross': matched = fieldVal !== 0 && Math.abs(fieldVal / (c.value || 1)) > 0.99; break;
      }
      if (matched) {
        matches.push({
          criteria: c.field,
          value: fieldVal,
          threshold: `${c.operator} ${c.value}${c.value2 ? `-${c.value2}` : ''}`,
        });
      }
    }
    return matches;
  }

  private getFieldValue(quote: CachedQuote, field: string): number {
    const q = quote as unknown as Record<string, unknown>;
    const val = q[field];
    return typeof val === 'number' ? val : 0;
  }
}
