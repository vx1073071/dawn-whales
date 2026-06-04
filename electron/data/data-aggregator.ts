// ── Data Aggregator — Multi-source Data Aggregation Engine ─────────────────
// JVS-56: Aggregates data from OpenD + Yahoo Finance + Alpha Vantage + local cache
// Features: data quality scoring, auto-switch primary/backup sources
// Output: unified data interface with quality metrics

import log from 'electron-log';
import https from 'https';
import http from 'http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DataSource {
  name: string;
  type: 'opend' | 'yahoo' | 'alphavantage' | 'cache';
  priority: number;        // Lower number = higher priority
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  config?: any;
}

export interface QuoteData {
  code: string;
  name?: string;
  price: number;
  change: number;          // Change amount
  changePct: number;       // Change percentage
  volume: number;
  turnover?: number;
  high?: number;
  low?: number;
  open?: number;
  timestamp: number;
  source: string;          // Data source name
}

export interface DataQualityScore {
  overall: number;         // 0-100
  freshness: number;       // How recent is the data
  completeness: number;    // How many fields are filled
  consistency: number;     // Consistency across sources
  latency: number;         // Response time score
}

export interface AggregatedQuote {
  code: string;
  name?: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  turnover?: number;
  high?: number;
  low?: number;
  open?: number;
  timestamp: number;
  source: string;
  quality: DataQualityScore;
  sources: string[];       // All sources that provided this quote
  latencyMs: number;
}

export interface AggregationResult {
  success: boolean;
  quotes: AggregatedQuote[];
  total: number;
  timestamp: number;
  sourcesUsed: string[];
  sourcesFailed: string[];
  qualityScore: number;
  latencyMs: number;
  error?: string;
}

export interface AggregatorConfig {
  sources: DataSource[];
  qualityThreshold: number;     // Minimum quality score (0-100)
  fallbackEnabled: boolean;     // Enable fallback to lower priority sources
  cacheEnabled: boolean;        // Enable local cache
  cacheTTL: number;             // Cache TTL in ms
}

// ── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_CONFIG: AggregatorConfig = {
  sources: [
    {
      name: 'opend',
      type: 'opend',
      priority: 1,
      enabled: true,
      timeoutMs: 5000,
      maxRetries: 2,
    },
    {
      name: 'yahoo',
      type: 'yahoo',
      priority: 2,
      enabled: true,
      timeoutMs: 8000,
      maxRetries: 1,
    },
    {
      name: 'alphavantage',
      type: 'alphavantage',
      priority: 3,
      enabled: false,  // Requires API key
      timeoutMs: 10000,
      maxRetries: 1,
      config: { apiKey: '' },
    },
    {
      name: 'cache',
      type: 'cache',
      priority: 99,
      enabled: true,
      timeoutMs: 1000,
      maxRetries: 0,
    },
  ],
  qualityThreshold: 60,
  fallbackEnabled: true,
  cacheEnabled: true,
  cacheTTL: 300000, // 5 minutes
};

// ── HTTP Helper ────────────────────────────────────────────────────────────

function httpGet(url: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    };
    const req = client.get(opts, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (location) {
          httpGet(location, timeoutMs).then(resolve).catch(reject);
          return;
        }
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

// ── Data Fetchers ──────────────────────────────────────────────────────────

async function fetchFromOpenD(codes: string[], config?: any): Promise<QuoteData[]> {
  // OpenD integration via TCP socket
  // For now, return empty array (requires OpenD connection)
  log.debug('[DataAggregator] OpenD fetch not implemented yet');
  return [];
}

async function fetchFromYahoo(codes: string[]): Promise<QuoteData[]> {
  try {
    const quotes: QuoteData[] = [];
    
    // Yahoo Finance API
    for (const code of codes.slice(0, 10)) {  // Limit to avoid rate limiting
      const symbol = code.includes('.') ? code.split('.')[1] + '.HK' : code;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&count=1`;
      
      try {
        const response = await httpGet(url, 8000);
        const data = JSON.parse(response);
        
        if (data.chart && data.chart.result && data.chart.result[0]) {
          const result = data.chart.result[0];
          const meta = result.meta;
          const timestamp = meta.regularMarketTime || Date.now() / 1000;
          
          quotes.push({
            code: code,
            name: meta.symbol || code,
            price: meta.regularMarketPrice || 0,
            change: meta.regularMarketChange || 0,
            changePct: meta.regularMarketChangePercent || 0,
            volume: meta.regularMarketVolume || 0,
            high: meta.regularMarketDayHigh,
            low: meta.regularMarketDayLow,
            open: meta.regularMarketOpen,
            timestamp: timestamp * 1000,
            source: 'yahoo',
          });
        }
      } catch (err: any) {
        log.debug(`[DataAggregator] Yahoo fetch failed for ${code}:`, err.message);
      }
    }
    
    return quotes;
  } catch (err: any) {
    log.error('[DataAggregator] Yahoo fetch error:', err.message);
    return [];
  }
}

async function fetchFromAlphaVantage(codes: string[], apiKey: string): Promise<QuoteData[]> {
  if (!apiKey) return [];
  
  try {
    const quotes: QuoteData[] = [];
    
    for (const code of codes.slice(0, 5)) {  // Strict rate limit
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${code}&apikey=${apiKey}`;
      
      try {
        const response = await httpGet(url, 10000);
        const data = JSON.parse(response);
        
        if (data['Global Quote']) {
          const quote = data['Global Quote'];
          quotes.push({
            code: code,
            name: code,
            price: parseFloat(quote['05. price'] || '0'),
            change: parseFloat(quote['09. change'] || '0'),
            changePct: parseFloat((quote['10. change percent'] || '0').replace('%', '')),
            volume: parseFloat(quote['06. volume'] || '0'),
            high: parseFloat(quote['03. high'] || '0'),
            low: parseFloat(quote['04. low'] || '0'),
            open: parseFloat(quote['02. open'] || '0'),
            timestamp: Date.now(),
            source: 'alphavantage',
          });
        }
      } catch (err: any) {
        log.debug(`[DataAggregator] AlphaVantage fetch failed for ${code}:`, err.message);
      }
    }
    
    return quotes;
  } catch (err: any) {
    log.error('[DataAggregator] AlphaVantage fetch error:', err.message);
    return [];
  }
}

// ── Data Quality Scoring ───────────────────────────────────────────────────

function calculateQualityScore(quote: QuoteData, timestamp: number): DataQualityScore {
  // Freshness: how recent is the data (within 5 minutes = 100, older = lower score)
  const ageMs = timestamp - quote.timestamp;
  const freshness = Math.max(0, 100 - (ageMs / (5 * 60 * 1000)) * 100);
  
  // Completeness: how many fields are filled
  const fields = ['price', 'change', 'changePct', 'volume', 'high', 'low', 'open'];
  const filledFields = fields.filter(f => (quote as any)[f] !== undefined && (quote as any)[f] !== 0);
  const completeness = (filledFields.length / fields.length) * 100;
  
  // Consistency: based on price/volume relationship
  let consistency = 100;
  if (quote.volume === 0 && quote.price > 0) {
    consistency = 50;  // Price but no volume is suspicious
  }
  
  // Latency score (placeholder, would need actual latency measurement)
  const latency = 100;
  
  const overall = (freshness * 0.4 + completeness * 0.3 + consistency * 0.2 + latency * 0.1);
  
  return {
    overall: Math.round(overall),
    freshness: Math.round(freshness),
    completeness: Math.round(completeness),
    consistency: Math.round(consistency),
    latency: Math.round(latency),
  };
}

// ── Data Aggregator Class ──────────────────────────────────────────────────

export class DataAggregator {
  private config: AggregatorConfig;
  private cache: Map<string, { quote: QuoteData; timestamp: number }> = new Map();

  constructor(config?: Partial<AggregatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async aggregate(codes: string[]): Promise<AggregationResult> {
    const startTime = Date.now();
    const enabledSources = this.config.sources
      .filter(s => s.enabled)
      .sort((a, b) => a.priority - b.priority);
    
    const sourcesUsed: string[] = [];
    const sourcesFailed: string[] = [];
    const allQuotes: Map<string, QuoteData> = new Map();
    
    // Try each source in priority order
    for (const source of enabledSources) {
      try {
        let quotes: QuoteData[] = [];
        
        switch (source.type) {
          case 'opend':
            quotes = await fetchFromOpenD(codes, source.config);
            break;
          case 'yahoo':
            quotes = await fetchFromYahoo(codes);
            break;
          case 'alphavantage':
            quotes = await fetchFromAlphaVantage(codes, source.config?.apiKey || '');
            break;
          case 'cache':
            quotes = this.getFromCache(codes);
            break;
        }
        
        if (quotes.length > 0) {
          sourcesUsed.push(source.name);
          
          // Merge quotes (first source wins for each code)
          for (const quote of quotes) {
            if (!allQuotes.has(quote.code)) {
              allQuotes.set(quote.code, quote);
            }
          }
          
          // Stop if we have enough data
          if (allQuotes.size >= codes.length) {
            break;
          }
        } else {
          sourcesFailed.push(source.name);
        }
      } catch (err: any) {
        log.error(`[DataAggregator] ${source.name} failed:`, err.message);
        sourcesFailed.push(source.name);
      }
    }
    
    // Calculate quality scores and build aggregated quotes
    const aggregatedQuotes: AggregatedQuote[] = [];
    const qualityScores: number[] = [];
    
    for (const [code, quote] of allQuotes) {
      const quality = calculateQualityScore(quote, Date.now());
      qualityScores.push(quality.overall);
      
      const sources = [quote.source];
      if (this.cache.has(code)) {
        sources.push('cache');
      }
      
      aggregatedQuotes.push({
        code: quote.code,
        name: quote.name,
        price: quote.price,
        change: quote.change,
        changePct: quote.changePct,
        volume: quote.volume,
        turnover: quote.turnover,
        high: quote.high,
        low: quote.low,
        open: quote.open,
        timestamp: quote.timestamp,
        source: quote.source,
        quality,
        sources,
        latencyMs: Date.now() - startTime,
      });
      
      // Update cache
      this.updateCache(code, quote);
    }
    
    // Calculate overall quality score
    const avgQuality = qualityScores.length > 0
      ? qualityScores.reduce((sum, s) => sum + s, 0) / qualityScores.length
      : 0;
    
    const latencyMs = Date.now() - startTime;
    
    log.info(`[DataAggregator] Aggregated ${aggregatedQuotes.length}/${codes.length} quotes from ${sourcesUsed.length} sources in ${latencyMs}ms`);
    
    return {
      success: aggregatedQuotes.length > 0,
      quotes: aggregatedQuotes,
      total: aggregatedQuotes.length,
      timestamp: Date.now(),
      sourcesUsed,
      sourcesFailed,
      qualityScore: Math.round(avgQuality),
      latencyMs,
      error: aggregatedQuotes.length === 0 ? 'No data from any source' : undefined,
    };
  }

  private getFromCache(codes: string[]): QuoteData[] {
    if (!this.config.cacheEnabled) return [];
    
    const quotes: QuoteData[] = [];
    const cutoff = Date.now() - this.config.cacheTTL;
    
    for (const code of codes) {
      const cached = this.cache.get(code);
      if (cached && cached.timestamp > cutoff) {
        quotes.push({
          ...cached.quote,
          timestamp: cached.timestamp,
          source: 'cache',
        });
      }
    }
    
    return quotes;
  }

  private updateCache(code: string, quote: QuoteData): void {
    if (!this.config.cacheEnabled) return;
    this.cache.set(code, { quote, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
    log.info('[DataAggregator] Cache cleared');
  }

  getStats(): { cacheSize: number; cachedCodes: string[] } {
    return {
      cacheSize: this.cache.size,
      cachedCodes: Array.from(this.cache.keys()),
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let aggregatorInstance: DataAggregator | null = null;

export function getDataAggregator(config?: Partial<AggregatorConfig>): DataAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new DataAggregator(config);
  }
  return aggregatorInstance;
}
