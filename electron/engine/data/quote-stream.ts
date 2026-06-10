// ── JVS-9: Real-time Quote Stream Service ──────────────────────────────────
// Provides real-time market data streaming via simulated WebSocket
// Integrates with StockAnomalyDetector for automatic anomaly detection

import { EventEmitter } from 'events';
import log from 'electron-log';
import https from 'https';
import http from 'http';
import { StockAnomalyDetector } from './stock-anomaly-detector';

// ── Types ──────────────────────────────────────────────────────────────────

export interface QuoteTick {
  code: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  prevClose: number;
  timestamp: number;
  bid?: number;      // 买一价
  ask?: number;      // 卖一价
  bidVolume?: number; // 买一量
  askVolume?: number; // 卖一量
}

export interface QuoteStreamConfig {
  symbols: string[];           // Stock codes to subscribe
  refreshIntervalMs?: number;  // Default: 3000ms (3 seconds)
  enableAnomalyDetection?: boolean;
  anomalyDetector?: StockAnomalyDetector;
}

export interface StreamStatus {
  isStreaming: boolean;
  subscribedSymbols: string[];
  lastUpdate: number;
  totalTicks: number;
  anomalyAlertsCount: number;
}

// ── Quote Stream Service ───────────────────────────────────────────────────

export class QuoteStreamService extends EventEmitter {
  private config: QuoteStreamConfig;
  private symbols: Set<string> = new Set();
  private streaming = false;
  private intervalId: NodeJS.Timeout | null = null;
  private totalTicks = 0;
  private lastUpdate = 0;
  private anomalyAlertsCount = 0;
  private anomalyDetector: StockAnomalyDetector | null = null;

  constructor(config: QuoteStreamConfig) {
    super();
    this.config = {
      refreshIntervalMs: 3000,
      enableAnomalyDetection: true,
      ...config,
    };

    if (config.anomalyDetector) {
      this.anomalyDetector = config.anomalyDetector;
    }

    // Initialize symbols
    config.symbols.forEach(s => this.symbols.add(s));

    log.info(`[QuoteStream] Initialized with ${this.symbols.size} symbols, interval: ${this.config.refreshIntervalMs}ms`);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  start(): void {
    if (this.streaming) {
      log.warn('[QuoteStream] Already streaming');
      return;
    }

    this.streaming = true;
    this.intervalId = setInterval(() => this.fetchAndEmit(), this.config.refreshIntervalMs);
    
    // Initial fetch
    this.fetchAndEmit();

    log.info(`[QuoteStream] Started streaming ${this.symbols.size} symbols`);
    this.emit('stream:started', { symbols: Array.from(this.symbols) });
  }

  stop(): void {
    if (!this.streaming) return;

    this.streaming = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    log.info('[QuoteStream] Stopped streaming');
    this.emit('stream:stopped');
  }

  subscribe(symbols: string | string[]): void {
    const newSymbols = Array.isArray(symbols) ? symbols : [symbols];
    let added = 0;

    newSymbols.forEach(s => {
      if (!this.symbols.has(s)) {
        this.symbols.add(s);
        added++;
      }
    });

    if (added > 0) {
      log.info(`[QuoteStream] Subscribed ${added} new symbols, total: ${this.symbols.size}`);
      this.emit('subscription:changed', { symbols: Array.from(this.symbols) });
    }
  }

  unsubscribe(symbols: string | string[]): void {
    const removeSymbols = Array.isArray(symbols) ? symbols : [symbols];
    let removed = 0;

    removeSymbols.forEach(s => {
      if (this.symbols.delete(s)) {
        removed++;
      }
    });

    if (removed > 0) {
      log.info(`[QuoteStream] Unsubscribed ${removed} symbols, remaining: ${this.symbols.size}`);
      this.emit('subscription:changed', { symbols: Array.from(this.symbols) });
    }
  }

  getStatus(): StreamStatus {
    return {
      isStreaming: this.streaming,
      subscribedSymbols: Array.from(this.symbols),
      lastUpdate: this.lastUpdate,
      totalTicks: this.totalTicks,
      anomalyAlertsCount: this.anomalyAlertsCount,
    };
  }

  // ── Private Methods ──────────────────────────────────────────────────────

  private async fetchAndEmit(): Promise<void> {
    try {
      const quotes = await this.fetchQuotes(Array.from(this.symbols));
      
      if (quotes.length === 0) {
        return;
      }

      this.lastUpdate = Date.now();
      this.totalTicks += quotes.length;

      // Emit quote update
      this.emit('quote:update', quotes);

      // Run anomaly detection if enabled
      if (this.config.enableAnomalyDetection && this.anomalyDetector) {
        const stockQuotes = quotes.map(q => ({
          code: q.code,
          name: q.name,
          price: q.price,
          changePct: q.changePct,
          volume: q.volume,
          highPrice: q.highPrice,
          lowPrice: q.lowPrice,
          openPrice: q.openPrice,
          prevClose: q.prevClose,
          timestamp: q.timestamp,
        }));

        const alerts = this.anomalyDetector.processQuotes(stockQuotes);
        
        if (alerts.length > 0) {
          this.anomalyAlertsCount += alerts.length;
          this.emit('anomaly:detected', alerts);
          log.info(`[QuoteStream] Detected ${alerts.length} anomalies`);
        }
      }

    } catch (err: unknown) {
      log.error('[QuoteStream] Fetch error:', err.message);
      this.emit('error', err);
    }
  }

  private async fetchQuotes(symbols: string[]): Promise<QuoteTick[]> {
    // Try East Money push2 API (works in Electron browser context)
    // Fallback: generate simulated data for development/testing
    
    const quotes: QuoteTick[] = [];
    
    for (const symbol of symbols) {
      try {
        const quote = await this.fetchSingleQuote(symbol);
        if (quote) {
          quotes.push(quote);
        }
      } catch (err) {
        // Silent fail for individual quotes
      }
    }

    // If no real data, use simulation (for development)
    if (quotes.length === 0 && symbols.length > 0) {
      return this.generateSimulatedQuotes(symbols);
    }

    return quotes;
  }

  private async fetchSingleQuote(symbol: string): Promise<QuoteTick | null> {
    // East Money quote API
    // Format: https://push2.eastmoney.com/api/qt/stock/get?secid=1.600519&fields=f43,f44,f45,f46,f47,f48,f57,f58,f169,f170
    
    const secid = this.getSecId(symbol);
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f169,f170`;

    const response = await this.httpGet(url);
    const data = JSON.parse(response);

    if (!data.data) {
      return null;
    }

    const d = data.data;
    
    return {
      code: d.f57 || symbol,
      name: d.f58 || '',
      price: this.parsePrice(d.f43),      // 最新价
      changePct: this.parsePrice(d.f170),  // 涨跌幅
      volume: d.f47 || 0,                  // 成交量
      highPrice: this.parsePrice(d.f44),   // 最高价
      lowPrice: this.parsePrice(d.f45),    // 最低价
      openPrice: this.parsePrice(d.f46),   // 开盘价
      prevClose: this.parsePrice(d.f48),   // 昨收价
      timestamp: Date.now(),
    };
  }

  private getSecId(symbol: string): string {
    // Convert stock code to East Money secid format
    // Shanghai: 1.600xxx, 1.601xxx, 1.603xxx
    // Shenzhen: 0.000xxx, 0.002xxx, 0.300xxx
    
    if (symbol.startsWith('6')) {
      return `1.${symbol}`;  // Shanghai
    } else if (symbol.startsWith('0') || symbol.startsWith('3')) {
      return `0.${symbol}`;  // Shenzhen
    }
    
    // Default to Shanghai
    return `1.${symbol}`;
  }

  private parsePrice(value: unknown): number {
    if (value === null || value === undefined || value === '-') {
      return 0;
    }
    const num = Number(value);
    return isNaN(num) ? 0 : num / 100;  // East Money prices are in cents
  }

  private generateSimulatedQuotes(symbols: string[]): QuoteTick[] {
    // Generate simulated data for development/testing
    const quotes: QuoteTick[] = [];
    const now = Date.now();

    for (const symbol of symbols) {
      const basePrice = 50 + Math.random() * 100;
      const changePct = (Math.random() - 0.5) * 10;  // -5% to +5%
      const price = basePrice * (1 + changePct / 100);

      quotes.push({
        code: symbol,
        name: `模拟股票 ${symbol}`,
        price: Math.round(price * 100) / 100,
        changePct: Math.round(changePct * 100) / 100,
        volume: Math.floor(Math.random() * 10000000),
        highPrice: price * 1.02,
        lowPrice: price * 0.98,
        openPrice: basePrice,
        prevClose: basePrice,
        timestamp: now,
      });
    }

    return quotes;
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      
      client.get(url, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      }).on('error', reject);
    });
  }
}

// ── Singleton Instance ─────────────────────────────────────────────────────

let quoteStreamInstance: QuoteStreamService | null = null;

export function initQuoteStream(
  symbols: string[],
  anomalyDetector?: StockAnomalyDetector
): QuoteStreamService {
  if (quoteStreamInstance) {
    return quoteStreamInstance;
  }

  quoteStreamInstance = new QuoteStreamService({
    symbols,
    refreshIntervalMs: 3000,
    enableAnomalyDetection: true,
    anomalyDetector,
  });

  return quoteStreamInstance;
}

export function getQuoteStream(): QuoteStreamService | null {
  return quoteStreamInstance;
}
