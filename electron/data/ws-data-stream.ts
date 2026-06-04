// ── JVS-29: WebSocket Real-time Data Stream ──────────────────────────────
// Connects to futu-opend for real-time tick data, feeds into push2-proxy
// Falls back to push2 polling when OpenD is unavailable
// IPC: ws:start-stream, ws:subscribe, ws:unsubscribe, ws:stream-status

import { EventEmitter } from 'events';
import log from 'electron-log';
import { FutuOpenDClient } from '../broker/futu-opend';
import { getPush2Proxy, Push2ProxyService } from './push2-proxy';
import { StockAnomalyDetector } from '../engine/stock-anomaly-detector';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WsStreamConfig {
  opendHost?: string;         // Default: 127.0.0.1
  opendPort?: number;         // Default: 11111
  fallbackIntervalMs?: number; // Default: 3000 (push2 polling fallback)
  enableAnomalyDetection?: boolean;
  maxSymbols?: number;        // Default: 100
}

export interface StreamTick {
  code: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  turnover: number;
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  prevClose: number;
  timestamp: number;
  source: 'opend' | 'push2';
}

export interface StreamState {
  mode: 'opend' | 'push2' | 'idle';
  connected: boolean;
  subscribedCount: number;
  totalTicks: number;
  lastTickTime: number;
  anomalyAlerts: number;
  uptimeMs: number;
}

type TickCallback = (ticks: StreamTick[]) => void;

// ── Default watchlist ──────────────────────────────────────────────────────

const DEFAULT_SYMBOLS = [
  'SH.600519', 'SH.601318', 'SZ.000858', 'SZ.000001', 'SZ.300750',
  'SH.600036', 'SH.601166', 'SZ.002594', 'SH.600276', 'SZ.000333',
];

// ── WebSocket Data Stream Service ──────────────────────────────────────────

export class WsDataStreamService extends EventEmitter {
  private config: WsStreamConfig;
  private opendClient: FutuOpenDClient | null = null;
  private push2Proxy: Push2ProxyService;
  private anomalyDetector: StockAnomalyDetector;
  private subscribedCodes: Set<string> = new Set();
  private tickCallback: TickCallback | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;
  private startTime = 0;
  private totalTicks = 0;
  private lastTickTime = 0;
  private anomalyAlerts = 0;
  private mode: 'opend' | 'push2' | 'idle' = 'idle';

  constructor(config: WsStreamConfig = {}) {
    super();
    this.config = {
      opendHost: '127.0.0.1',
      opendPort: 11111,
      fallbackIntervalMs: 3000,
      enableAnomalyDetection: true,
      maxSymbols: 100,
      ...config,
    };

    this.push2Proxy = getPush2Proxy();
    this.anomalyDetector = new StockAnomalyDetector();
    log.info(`[WsDataStream] Initialized (OpenD: ${this.config.opendHost}:${this.config.opendPort})`);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async startStream(codes?: string[]): Promise<{ success: boolean; mode: string; message: string }> {
    if (this.mode !== 'idle') {
      return { success: false, mode: this.mode, message: 'Stream already active' };
    }

    const symbols = codes ?? DEFAULT_SYMBOLS;
    if (symbols.length > (this.config.maxSymbols ?? 100)) {
      return { success: false, mode: 'idle', message: `Too many symbols: ${symbols.length} > ${this.config.maxSymbols}` };
    }

    symbols.forEach(s => this.subscribedCodes.add(s));

    // Try OpenD first
    try {
      await this.startOpendStream(Array.from(this.subscribedCodes));
      this.mode = 'opend';
      this.startTime = Date.now();
      log.info(`[WsDataStream] OpenD stream started: ${this.subscribedCodes.size} symbols`);
      return { success: true, mode: 'opend', message: `OpenD connected, ${this.subscribedCodes.size} symbols` };
    } catch (err: any) {
      log.warn(`[WsDataStream] OpenD failed: ${err.message}, falling back to push2 polling`);
    }

    // Fallback to push2 polling
    this.startPush2Fallback(Array.from(this.subscribedCodes));
    this.mode = 'push2';
    this.startTime = Date.now();
    log.info(`[WsDataStream] Push2 fallback started: ${this.subscribedCodes.size} symbols`);
    return { success: true, mode: 'push2', message: `Push2 polling, ${this.subscribedCodes.size} symbols` };
  }

  async subscribe(codes: string[]): Promise<{ success: boolean; added: number; total: number }> {
    let added = 0;
    for (const code of codes) {
      if (!this.subscribedCodes.has(code) && this.subscribedCodes.size < (this.config.maxSymbols ?? 100)) {
        this.subscribedCodes.add(code);
        added++;
      }
    }

    if (added > 0) {
      if (this.mode === 'opend' && this.opendClient?.connected) {
        try {
          await this.opendClient.subscribeAndPush(Array.from(this.subscribedCodes));
        } catch (err: any) {
          log.warn(`[WsDataStream] OpenD subscribe failed: ${err.message}`);
        }
      }
      this.emit('subscription:changed', { codes: Array.from(this.subscribedCodes) });
    }

    return { success: true, added, total: this.subscribedCodes.size };
  }

  unsubscribe(codes: string[]): { success: boolean; removed: number; total: number } {
    let removed = 0;
    for (const code of codes) {
      if (this.subscribedCodes.delete(code)) removed++;
    }
    this.emit('subscription:changed', { codes: Array.from(this.subscribedCodes) });
    return { success: true, removed, total: this.subscribedCodes.size };
  }

  onTick(callback: TickCallback): void {
    this.tickCallback = callback;
  }

  getStatus(): StreamState {
    return {
      mode: this.mode,
      connected: this.mode === 'opend' ? (this.opendClient?.connected ?? false) : this.mode === 'push2',
      subscribedCount: this.subscribedCodes.size,
      totalTicks: this.totalTicks,
      lastTickTime: this.lastTickTime,
      anomalyAlerts: this.anomalyAlerts,
      uptimeMs: this.startTime > 0 ? Date.now() - this.startTime : 0,
    };
  }

  stop(): void {
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.opendClient) {
      this.opendClient.disconnect();
      this.opendClient = null;
    }
    this.mode = 'idle';
    this.subscribedCodes.clear();
    this.totalTicks = 0;
    this.startTime = 0;
    this.anomalyAlerts = 0;
    log.info('[WsDataStream] Stopped');
    this.emit('stream:stopped');
  }

  // ── OpenD Stream ─────────────────────────────────────────────────────────

  private async startOpendStream(codes: string[]): Promise<void> {
    this.opendClient = new FutuOpenDClient(this.config.opendHost, this.config.opendPort);

    this.opendClient.onDisconnect(() => {
      log.warn('[WsDataStream] OpenD disconnected, switching to push2 fallback');
      this.mode = 'push2';
      this.startPush2Fallback(Array.from(this.subscribedCodes));
      this.emit('mode:changed', { mode: 'push2', reason: 'opend_disconnected' });
    });

    this.opendClient.onQuotePush((quotes: any[]) => {
      const ticks: StreamTick[] = quotes.map((q: any) => ({
        code: q.code,
        name: q.name || q.code,
        price: q.price ?? 0,
        changePct: q.changePct ?? 0,
        volume: q.volume ?? 0,
        turnover: q.amount ?? 0,
        highPrice: q.high ?? 0,
        lowPrice: q.low ?? 0,
        openPrice: q.open ?? 0,
        prevClose: q.prevClose ?? 0,
        timestamp: Date.now(),
        source: 'opend' as const,
      }));

      this.processTicks(ticks);
    });

    await this.opendClient.connect();
    await this.opendClient.subscribeAndPush(codes);
  }

  // ── Push2 Fallback ───────────────────────────────────────────────────────

  private startPush2Fallback(codes: string[]): void {
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
    }

    // Immediate first fetch
    this.fetchPush2Quotes(codes);

    this.fallbackTimer = setInterval(() => {
      this.fetchPush2Quotes(Array.from(this.subscribedCodes));
    }, this.config.fallbackIntervalMs);
  }

  private async fetchPush2Quotes(codes: string[]): Promise<void> {
    try {
      const ticks: StreamTick[] = [];

      for (const code of codes) {
        const secid = this.codeToSecid(code);
        const result = await this.push2Proxy.getStockQuote(secid);
        if (result.success && result.data) {
          const q = result.data;
          ticks.push({
            code: q.code || code,
            name: q.name || code,
            price: q.price,
            changePct: q.changePct,
            volume: q.volume,
            turnover: q.turnover,
            highPrice: 0,
            lowPrice: 0,
            openPrice: 0,
            prevClose: 0,
            timestamp: Date.now(),
            source: 'push2',
          });
        }
      }

      if (ticks.length > 0) {
        this.processTicks(ticks);
      }
    } catch (err: any) {
      log.debug(`[WsDataStream] Push2 fetch error: ${err.message}`);
    }
  }

  // ── Tick Processing ──────────────────────────────────────────────────────

  private processTicks(ticks: StreamTick[]): void {
    this.totalTicks += ticks.length;
    this.lastTickTime = Date.now();

    // Emit to listeners
    this.emit('tick', ticks);
    this.tickCallback?.(ticks);

    // Anomaly detection
    if (this.config.enableAnomalyDetection) {
      const stockQuotes = ticks.map(t => ({
        code: t.code,
        name: t.name,
        price: t.price,
        changePct: t.changePct,
        volume: t.volume,
        highPrice: t.highPrice,
        lowPrice: t.lowPrice,
        openPrice: t.openPrice,
        prevClose: t.prevClose,
        timestamp: t.timestamp,
      }));

      const alerts = this.anomalyDetector.processQuotes(stockQuotes);
      if (alerts.length > 0) {
        this.anomalyAlerts += alerts.length;
        this.emit('anomaly', alerts);
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private codeToSecid(code: string): string {
    // Convert "SH.600519" -> "1.600519", "SZ.000001" -> "0.000001"
    const parts = code.split('.');
    if (parts.length === 2) {
      const market = parts[0].toUpperCase();
      if (market === 'SH') return `1.${parts[1]}`;
      if (market === 'SZ') return `0.${parts[1]}`;
      if (market === 'HK') return `116.${parts[1]}`;
      if (market === 'US') return `105.${parts[1]}`;
    }
    return code;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let wsStreamInstance: WsDataStreamService | null = null;

export function getWsDataStream(): WsDataStreamService {
  if (!wsStreamInstance) {
    wsStreamInstance = new WsDataStreamService();
  }
  return wsStreamInstance;
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

export function registerWsStreamIPC(ipcMain: any): void {
  const service = getWsDataStream();

  ipcMain.handle('ws:start-stream', async (_event: any, codes?: string[]) => {
    return service.startStream(codes);
  });

  ipcMain.handle('ws:subscribe', async (_event: any, codes: string[]) => {
    return service.subscribe(codes);
  });

  ipcMain.handle('ws:unsubscribe', (_event: any, codes: string[]) => {
    return service.unsubscribe(codes);
  });

  ipcMain.handle('ws:stream-status', () => {
    return service.getStatus();
  });

  ipcMain.handle('ws:stop-stream', () => {
    service.stop();
    return { success: true };
  });

  // Forward events to renderer
  service.on('tick', (ticks: StreamTick[]) => {
    try {
      // Broadcast via BrowserWindow
      const { BrowserWindow } = require('electron');
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send('ws:tick', ticks);
        }
      }
    } catch (e) { logger.error('[backend:ws-data-stream]', e); }
  });

  service.on('anomaly', (alerts: any[]) => {
    try {
      const { BrowserWindow } = require('electron');
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send('ws:anomaly', alerts);
        }
      }
    } catch (e) { logger.error('[backend:ws-data-stream]', e); }
  });

  service.on('mode:changed', (info: any) => {
    try {
      const { BrowserWindow } = require('electron');
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send('ws:mode-changed', info);
        }
      }
    } catch (e) { logger.error('[backend:ws-data-stream]', e); }
  });

  log.info('[WsDataStream] IPC handlers registered');
}
