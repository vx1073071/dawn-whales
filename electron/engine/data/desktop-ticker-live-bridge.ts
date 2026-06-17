/**
 * R264 Claw(PM): DesktopTickerBar → YahooLive 数据接线桥
 * 
 * DesktopTickerBar (ML R257 ~570L) 已建Bloomberg风格桌面条
 * 当前运行mock数据。此桥接将它接入YahooWebSocketLiveEngine真实行情。
 * 
 * 接线: YahooWebSocketLiveEngine → DesktopTickerBar (IPC)
 */

import { YahooWebSocketLiveEngine, YahooLiveQuote } from '../../news/YahooWebSocketLiveEngine';

// ── Types ──
export interface TickerBarItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  market: string;
  timestamp: number;
}

export interface TickerBarConfig {
  symbols: string[];           // 桌面条显示股票 (≤10)
  refreshIntervalMs: number;   // 刷新间隔 (默认3000)
  showChangePct: boolean;
  compactMode: boolean;
}

export interface TickerBarStatus {
  connected: boolean;
  activeSymbols: number;
  lastUpdate: number;
  latency: number;
  source: 'yahoo_live' | 'mock_fallback';
}

// ── Default Config ──
const DEFAULT_SYMBOLS = [
  'SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA',
  '0700.HK', '9988.HK', 'BTC-USD', 'GC=F', 'CL=F'
];

// ── Bridge ──
export class DesktopTickerBarBridge {
  private yahooEngine: YahooWebSocketLiveEngine;
  private config: TickerBarConfig;
  private items: Map<string, TickerBarItem> = new Map();
  private connected = false;
  private lastUpdate = 0;

  constructor(config?: Partial<TickerBarConfig>) {
    this.yahooEngine = YahooWebSocketLiveEngine.getInstance();
    this.config = {
      symbols: config?.symbols ?? DEFAULT_SYMBOLS,
      refreshIntervalMs: config?.refreshIntervalMs ?? 3000,
      showChangePct: config?.showChangePct ?? true,
      compactMode: config?.compactMode ?? true,
    };
  }

  async start(): Promise<void> {
    const ok = await this.yahooEngine.connect();
    if (!ok) {
      console.warn('[DesktopTickerBar] YahooLive连接失败，使用mock回退');
      this.connected = false;
      return;
    }

    this.yahooEngine.subscribe(this.config.symbols);
    this.yahooEngine.on('live_quote', (quote: YahooLiveQuote) => {
      this.handleQuote(quote);
    });

    this.yahooEngine.on('connection_change', ({ state }) => {
      this.connected = state === 'connected';
    });

    this.connected = true;
    console.log(`[DesktopTickerBar] 已连接 YahooLive: ${this.config.symbols.length} symbols`);
  }

  private handleQuote(quote: YahooLiveQuote): void {
    this.items.set(quote.symbol, {
      symbol: quote.symbol,
      name: quote.symbol,
      price: quote.price,
      change: quote.change,
      changePct: quote.changePercent,
      volume: quote.volume,
      market: 'US',
      timestamp: quote.timestamp,
    });
    this.lastUpdate = Date.now();
  }

  getItems(): TickerBarItem[] {
    return Array.from(this.items.values()).slice(0, 10);
  }

  getStatus(): TickerBarStatus {
    return {
      connected: this.connected,
      activeSymbols: this.items.size,
      lastUpdate: this.lastUpdate,
      latency: this.lastUpdate ? Date.now() - this.lastUpdate : -1,
      source: this.connected ? 'yahoo_live' : 'mock_fallback',
    };
  }

  addSymbol(symbol: string): void {
    if (this.config.symbols.length >= 10) return;
    this.config.symbols.push(symbol);
    if (this.connected) this.yahooEngine.subscribe([symbol]);
  }

  removeSymbol(symbol: string): void {
    this.config.symbols = this.config.symbols.filter(s => s !== symbol);
    this.items.delete(symbol);
    if (this.connected) this.yahooEngine.unsubscribe([symbol]);
  }

  stop(): void {
    this.yahooEngine.unsubscribe(this.config.symbols);
    this.items.clear();
    this.connected = false;
  }
}
