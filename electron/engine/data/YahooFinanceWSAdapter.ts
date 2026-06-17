// R256 Claw(PM)代工: Yahoo Finance WebSocket 适配器骨架
// 替代 futu-mock-feed.ts 成为主力行情源
// 实时/免费/匿名/22+交易所 — 无需注册，无需API Key
//
// Yahoo Finance WebSocket协议:
//   wss://streamer.finance.yahoo.com/
//   订阅格式: {"subscribe":["AAPL","0700.HK","7203.T","NIFTY.NS",...]}
//   推送格式: {"id":"AAPL","price":185.23,"change":2.1,"changePercent":1.15,...}
//
// TODO JVS: 实现实际WebSocket连接和数据解析

import { EventEmitter } from 'events';
import type {
  DataSourceId, DataSourceConfig, DataPoint, SourceHealth,
  RegisteredSource, FetchAttemptResult
} from '../multi-source-aggregator/types';

// ── Const ──
const YAHOO_WS_URL = 'wss://streamer.finance.yahoo.com/';

// Yahoo Finance symbol suffixes for 22+ exchanges
export const YAHOO_EXCHANGE_SUFFIX: Record<string, string> = {
  HK: '.HK', JP: '.T', UK: '.L', DE: '.DE', FR: '.PA', NL: '.AS',
  CA: '.TO', AU: '.AX', KR: '.KS', KQ: '.KQ', TW: '.TW', TWO: '.TWO',
  SG: '.SI', IN_NS: '.NS', IN_BO: '.BO', BR: '.SA', SA: '.SR',
  ID: '.JK', TH: '.BK', VN: '.VN', ZA: '.JO', MY: '.KL',
  PH: '.PS', CH: '.SW', AE: '.DU', IL: '.TA',
  // US has no suffix
};

// ── Config ──
export const YAHOO_SOURCE_CONFIG: DataSourceConfig = {
  id: 'yahoo',
  name: 'Yahoo Finance',
  wsUrl: YAHOO_WS_URL,
  priority: 3,               // below broker(1) and binance(2)
  marketCoverage: [
    'US','HK','CN','JP','UK','DE','FR','NL','CA','AU',
    'KR','TW','SG','IN','BR','SA','ID','TH','VN','ZA','MY','PH','CH','AE','IL'
  ],
  realtime: true,
  maxLatency: 1000,
  requiresAuth: false,
};

// ── Adapter Class ──
export class YahooFinanceWSAdapter extends EventEmitter {
  private config: DataSourceConfig;
  private ws: WebSocket | null = null;
  private subscribed: Set<string> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  public health: SourceHealth = {
    sourceId: 'yahoo',
    status: 'offline',
    latency: 0,
    uptime: 0,
    lastHeartbeat: 0,
    failCount: 0,
    marketsUnavailable: [],
  };

  constructor() {
    super();
    this.config = YAHOO_SOURCE_CONFIG;
  }

  // TODO JVS: 实现实际连接
  connect(symbols: string[]): void {
    // 1. Convert symbols to Yahoo format: '0700' → '0700.HK'
    // 2. Connect WebSocket to YAHOO_WS_URL
    // 3. Subscribe: {"subscribe":[...symbols]}
    // 4. Parse incoming messages → emit('tick', DataPoint)
    // 5. Implement heartbeat every 30s
    // 6. On disconnect → exponential backoff reconnect (1s,2s,4s,8s...max 60s)
    throw new Error('YahooFinanceWSAdapter.connect() — TODO JVS implement');
  }

  disconnect(): void {
    if (this.ws) { this.ws.close(); this.ws = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); }
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); }
    this.subscribed.clear();
  }

  // Convert DW internal symbol to Yahoo format
  static toYahooSymbol(internalSymbol: string, market: string): string {
    const suffix = YAHOO_EXCHANGE_SUFFIX[market];
    if (!suffix) return internalSymbol; // US market, no suffix
    return internalSymbol + suffix;
  }

  getRegisteredSource(): RegisteredSource {
    return {
      config: this.config,
      health: this.health,
      connected: this.ws !== null && this.ws.readyState === WebSocket.OPEN,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Singleton
let _instance: YahooFinanceWSAdapter | null = null;
export function getYahooFinanceWS(): YahooFinanceWSAdapter {
  if (!_instance) _instance = new YahooFinanceWSAdapter();
  return _instance;
}
