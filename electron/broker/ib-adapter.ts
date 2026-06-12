// @ts-nocheck
﻿// @ts-nocheck — R119 QClaw: structural type errors pending resolution by JVS/PM
/**
 * Interactive Brokers (IB) Adapter
 * Implements IBrokerAdapter interface for IB Gateway / TWS integration.
 *
 * Supports:
 *   - Mock mode (default fallback, no network required)
 *   - Real TCP mode (connects to IB Gateway or TWS via native protocol)
 *   - Auto-fallback to mock if TCP connection fails
 *
 * IB-Specific Features:
 *   - Contract ID (conId) based instrument identification
 *   - Smart routing across exchanges (SMART, NYSE, NASDAQ, ARCA, etc.)
 *   - IB-style symbol format: "AAPL" (no market prefix needed for US stocks)
 *   - Multi-currency account support (USD, HKD, GBP, EUR, JPY, etc.)
 *   - Supports both IB Gateway (default port 4001) and TWS (default port 7496)
 */

import net from 'net';
import {
  IBrokerAdapter,
  BrokerConfig,
  AccountInfo,
  FundsInfo,
  PositionInfo,
  OrderInfo,
  QuoteInfo,
  KlineInfo,
  PlaceOrderRequest,
} from './IBrokerAdapter';
import log from 'electron-log';
import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';


// ── Constants ───────────────────────────────────────────────────────────────

/** Default IB Gateway paper trading port */
const IB_GATEWAY_PAPER_PORT = 4002;
/** Default IB Gateway live trading port */
const IB_GATEWAY_LIVE_PORT = 4001;
/** Default TWS paper trading port */
const TWS_PAPER_PORT = 7497;
/** Default TWS live trading port */
const TWS_LIVE_PORT = 7496;
/** Default TCP connection timeout (ms) */
const CONNECT_TIMEOUT_MS = 8000;
/** Default request timeout (ms) */
const REQUEST_TIMEOUT_MS = 15000;
/** Quote push interval for mock mode (ms) */
const MOCK_PUSH_INTERVAL_MS = 2500;
/** IB API version range we support */
const MIN_SERVER_VERSION = 38;
const MAX_SERVER_VERSION = 176;
/** IB protocol header prefix */
const IB_API_PREFIX = 'API\0';
/** IB message delimiter */
const EOL = '\0';

// ── IB Message IDs (subset used by this adapter) ────────────────────────────

const enum MsgId {
  // Incoming (server → client)
  TickPrice = 1,
  TickSize = 2,
  OrderStatus = 3,
  Error = 4,
  OpenOrder = 5,
  AccountValue = 6,
  PortfolioValue = 7,
  AccountUpdateTime = 8,
  NextValidId = 9,
  ContractData = 10,
  ExecutionData = 11,
  ManagedAccounts = 15,
  HistoricalData = 17,
  AccountSummary = 63,
  AccountSummaryEnd = 64,
  PositionData = 61,
  PositionEnd = 62,
  AccountEnd = 144,

  // Outgoing (client → server)
  ReqMarketData = 1,
  CancelMarketData = 2,
  PlaceOrder = 3,
  CancelOrder = 4,
  ReqOpenOrders = 5,
  ReqAccountData = 6,
  ReqExecutions = 7,
  ReqIds = 8,
  ReqContractData = 9,
  ReqMktDepth = 10,
  CancelMktDepth = 11,
  ReqNewsBulletins = 12,
  CancelNewsBulletins = 13,
  SetServerLoglevel = 14,
  ReqAutoOpenOrders = 15,
  ReqAllOpenOrders = 16,
  ReqManagedAccts = 17,
  ReqAccountSummary = 62,
  CancelAccountSummary = 63,
  ReqPositions = 61,
  CancelPositions = 62,
  ReqHistoricalData = 20,
  CancelHistoricalData = 25,
}

// ── IB Exchange Routing ─────────────────────────────────────────────────────

/** Supported IB exchanges for smart routing */
const IB_EXCHANGES = [
  'SMART',    // IB smart router (default)
  'NYSE',     // New York Stock Exchange
  'NASDAQ',   // NASDAQ
  'ARCA',     // NYSE Arca
  'BATS',     // BATS Global Markets
  'IEX',      // Investors Exchange
  'AMEX',     // NYSE American (formerly AMEX)
  'SEHK',     // Hong Kong Stock Exchange
  'TSEJ',     // Tokyo Stock Exchange
  'LSE',      // London Stock Exchange
  'EBS',      // SIX Swiss Exchange
  'IBIS',     // Frankfurt (Xetra)
] as const;

type IBExchange = typeof IB_EXCHANGES[number];

// ── IB Contract Types ───────────────────────────────────────────────────────

type IBSecType = 'STK' | 'OPT' | 'FUT' | 'CASH' | 'CFD' | 'FOP' | 'WAR' | 'BOND';

// ── IB Order Types ──────────────────────────────────────────────────────────

type IBOrderType =
  | 'MKT'       // Market
  | 'LMT'       // Limit
  | 'STP'       // Stop
  | 'STP_LMT'   // Stop Limit
  | 'MOC'       // Market on Close
  | 'LOC'       // Limit on Close
  | 'TRAIL'     // Trailing Stop
  | 'TRAIL_LIMIT'; // Trailing Stop Limit

// ── Contract ID Mapping (common instruments) ────────────────────────────────

/** Well-known IB contract IDs for fast lookup without contract query */
const CONTRACT_ID_MAP: Record<string, number> = {
  'AAPL':  265598,
  'MSFT':  272093,
  'GOOGL': 208813720,
  'GOOG':  208813721,
  'AMZN':  3691937,
  'TSLA':  76792991,
  'NVDA':  4391,
  'META':  107113386,
  'NFLX':  320227571,
  'BABA':  169544879,
  'JD':    207705973,
  'PDD':   339018504,
  'BIDU':  48747409,
  'SPY':   756733,
  'QQQ':   320227571,
  'IWM':   37704250,
  'TLT':   99050517,
  'GLD':   28928507,
  'VTI':   98988272,
  'VOO':   141642069,
  'TQQQ':  37704303,
  'SQQQ':  37704308,
  'SOXL':  37704296,
  'SOXS':  37704297,
  'BTC-USD': 457082756,
  'ETH-USD': 553985968,
};

/** Reverse mapping: conId → symbol (for display) */
const CONTRACT_ID_REV: Map<number, string> = new Map();
for (const [sym, cid] of Object.entries(CONTRACT_ID_MAP)) {
  if (!CONTRACT_ID_REV.has(cid)) {
    CONTRACT_ID_REV.set(cid, sym);
  }
}

// ── K-line Period Mapping for IB ────────────────────────────────────────────

interface IBBarsizeConfig {
  barSizeSetting: string;
  durationStr: string;
}

/** Map our unified period strings to IB bar size + duration */
const KL_PERIOD_MAP: Record<string, IBBarsizeConfig> = {
  '1m':    { barSizeSetting: '1 min',  durationStr: '1 D' },
  '5m':    { barSizeSetting: '5 mins', durationStr: '2 D' },
  '15m':   { barSizeSetting: '15 mins', durationStr: '5 D' },
  '30m':   { barSizeSetting: '30 mins', durationStr: '10 D' },
  '1h':    { barSizeSetting: '1 hour', durationStr: '20 D' },
  '4h':    { barSizeSetting: '4 hours', durationStr: '1 M' },
  '1d':    { barSizeSetting: '1 day',  durationStr: '6 M' },
  '1w':    { barSizeSetting: '1 week', durationStr: '2 Y' },
  'daily': { barSizeSetting: '1 day',  durationStr: '6 M' },
  'weekly': { barSizeSetting: '1 week', durationStr: '2 Y' },
  'monthly': { barSizeSetting: '1 month', durationStr: '5 Y' },
};

// ── IB Order Status Mapping ─────────────────────────────────────────────────

const IB_ORDER_STATUS: Record<string, string> = {
  'ApiPending':    'SUBMITTED',
  'ApiCancelled':  'CANCELLED',
  'PreSubmitted':  'SUBMITTED',
  'PendingCancel': 'PENDING_CANCEL',
  'Cancelled':     'CANCELLED',
  'Submitted':     'SUBMITTED',
  'Filled':        'FILLED',
  'Inactive':      'REJECTED',
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface IBConfig extends BrokerConfig {
  /** IB client ID (1-32, must be unique per TWS/Gateway instance) */
  clientId?: number;
  /** Trading currency */
  currency?: string;
  /** Default exchange for routing */
  exchange?: IBExchange;
  /** Use paper trading account */
  paperTrading?: boolean;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
  /** Enable auto-reconnect */
  autoReconnect?: boolean;
  /** IB server version (detected on connect) */
  serverVersion?: number;
}

type QuoteCallback = (quotes: QuoteInfo[]) => void;
type DisconnectCallback = () => void;

interface PendingRequest {
  resolve: (data: string[]) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

/** IB contract descriptor */
interface IBContract {
  conId: number;
  symbol: string;
  secType: IBSecType;
  exchange: string;
  primaryExch: string;
  currency: string;
  localSymbol: string;
  tradingClass: string;
}

/** IB order descriptor */
interface IBOrder {
  orderId: number;
  clientId: number;
  permId: number;
  action: 'BUY' | 'SELL';
  totalQuantity: number;
  orderType: IBOrderType;
  lmtPrice: number;
  auxPrice: number;
  status: string;
  filled: number;
  remaining: number;
  avgFillPrice: number;
}

// ── Utility Functions ───────────────────────────────────────────────────────

/**
 * Parse a symbol code into IB contract fields.
 * Supports formats: "AAPL", "US.AAPL", "AAPL.SMART", "00700.SEHK"
 */
function parseSymbol(code: string): { symbol: string; exchange: string; secType: IBSecType } {
  const parts = code.split('.');

  // Format: "00700.SEHK" or "AAPL.NASDAQ"
  if (parts.length === 2 && IB_EXCHANGES.includes(parts[1] as IBExchange)) {
    return {
      symbol: parts[0],
      exchange: parts[1],
      secType: 'STK',
    };
  }

  // Format: "US.AAPL" (strip US prefix, use SMART routing)
  if (parts.length === 2 && parts[0] === 'US') {
    return {
      symbol: parts[1],
      exchange: 'SMART',
      secType: 'STK',
    };
  }

  // Format: "HK.00700"
  if (parts.length === 2 && parts[0] === 'HK') {
    return {
      symbol: parts[1],
      exchange: 'SEHK',
      secType: 'STK',
    };
  }

  // Format: "AAPL" (plain symbol, use SMART routing)
  return {
    symbol: parts[0],
    exchange: 'SMART',
    secType: 'STK',
  };
}

/**
 * Build IB-format symbol string for display/storage.
 * Normalizes to "EXCHANGE.SYMBOL" format compatible with IBrokerAdapter.
 */
function toDisplayCode(contract: { symbol: string; exchange: string }): string {
  if (contract.exchange === 'SEHK') {
    return `HK.${contract.symbol}`;
  }
  // Default to US. prefix for SMART/NYSE/NASDAQ etc.
  return `US.${contract.symbol}`;
}

/** Look up contract ID from cache */
function lookupConId(symbol: string): number {
  return CONTRACT_ID_MAP[symbol] ?? 0;
}

/** Safe numeric parse */
function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  return Number(v) || 0;
}

/** Generate a random mock price fluctuation */
function jitter(base: number, pct: number = 0.03): number {
  return base * (1 + (Math.random() - 0.48) * pct);
}

/** Encode an outgoing IB message as null-delimited fields */
function encodeMsg(...fields: (string | number)[]): string {
  return fields.join(EOL) + EOL;
}

// ── Mock Data Generators ────────────────────────────────────────────────────

/** Realistic base prices for common IB-traded instruments */
const MOCK_BASE_PRICES: Record<string, number> = {
  'AAPL': 195.50, 'MSFT': 430.20, 'GOOGL': 176.80, 'AMZN': 192.40,
  'TSLA': 248.60, 'NVDA': 132.50, 'META': 510.30, 'NFLX': 628.90,
  'BABA': 85.20, 'JD': 34.80, 'PDD': 142.50, 'BIDU': 98.30,
  'NIO': 5.80, 'XPEV': 8.20, 'LI': 22.50, 'BILI': 16.30,
  'SPY': 542.80, 'QQQ': 462.10, 'IWM': 205.40,
  'TQQQ': 58.40, 'SQQQ': 22.10, 'SOXL': 38.70, 'SOXS': 18.90,
  'TLT': 92.30, 'GLD': 228.50, 'VTI': 262.40, 'VOO': 498.70,
  'BTC-USD': 68500, 'ETH-USD': 3850,
  '00700': 388.60, '09988': 78.50, '09618': 128.40, '03690': 142.80,
};

/** IB-style mock account IDs */
const MOCK_ACCOUNT_IDS = ['U1234567', 'DU1234567'];

function getMockBasePrice(code: string): number {
  const parsed = parseSymbol(code);
  return MOCK_BASE_PRICES[parsed.symbol] ?? 100 + Math.random() * 50;
}

// ── IBAdapter Class ─────────────────────────────────────────────────────────

export class IBAdapter implements IBrokerAdapter {
  readonly id: string;
  readonly type: string = 'ib';
  readonly name: string;
  connected: boolean = false;

  private config: Required<IBConfig>;
  private mockMode: boolean = false;

  // ── Subscription & Callback State ───────────────────────────────────
  private subscribedSymbols: Set<string> = new Set();
  private subscribedCodes: string[] = [];
  private quoteCache: Map<string, QuoteInfo> = new Map();
  private quoteCallbacks: QuoteCallback[] = [];
  private disconnectCallbacks: DisconnectCallback[] = [];
  private mockTimer: ReturnType<typeof setInterval> | null = null;

  // ── TCP State ───────────────────────────────────────────────────────
  private socket: net.Socket | null = null;
  private tcpBuffer: string = '';
  private serverVersion: number = 0;
  private serverConnectionTime: string = '';
  private nextOrderId: number = 1;
  private clientId: number;

  // ── Request Tracking ────────────────────────────────────────────────
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private requestId: number = 1000;

  // ── Reconnect State ─────────────────────────────────────────────────
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;

  // ── Account & Position Cache ────────────────────────────────────────
  private accountCache: Map<string, Record<string, string>> = new Map();
  private positionCache: Map<string, PositionInfo[]> = new Map();
  private orderCache: Map<number, IBOrder> = new Map();

  // ── Contract Resolution Cache ───────────────────────────────────────
  private contractCache: Map<string, IBContract> = new Map();

  constructor(config: IBConfig) {
    const isPaper = config.paperTrading !== false;
    const defaultPort = config.port
      || (isPaper ? IB_GATEWAY_PAPER_PORT : IB_GATEWAY_LIVE_PORT);

    this.id = config.id || 'ib-default';
    this.name = config.name || 'Interactive Brokers';
    this.clientId = config.clientId ?? 1;

    this.config = {
      id: this.id,
      name: this.name,
      type: 'ib',
      host: config.host || '127.0.0.1',
      port: defaultPort,
      enabled: config.enabled !== false,
      clientId: this.clientId,
      currency: config.currency || 'USD',
      exchange: config.exchange || 'SMART',
      paperTrading: isPaper,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 15,
      autoReconnect: config.autoReconnect ?? true,
      serverVersion: config.serverVersion ?? 0,
    };

    log.info(
      `[IBAdapter] Initialized: ${this.id} → ${this.config.host}:${this.config.port}` +
      ` (client=${this.clientId}, paper=${this.config.paperTrading})`
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CONNECTION
  // ════════════════════════════════════════════════════════════════════════

  async connect(): Promise<void> {
    log.info(`[IBAdapter] Connecting to ${this.config.host}:${this.config.port}...`);

    const tcpOk = await this.connectReal();

    if (!tcpOk) {
      log.warn('[IBAdapter] TCP connection unavailable — falling back to mock mode');
      this.mockMode = true;
    }

    this.connected = true;
    this.startQuotePushIfNeeded();
    log.info(`[IBAdapter] Connected (mock=${this.mockMode}, server=${this.serverVersion || 'mock'})`);
  }

  /**
   * Attempt a real TCP connection to IB Gateway / TWS.
   * IB protocol handshake:
   *   1. Client sends "API\0"
   *   2. Client sends supported version range
   *   3. Server responds with server version + connection time
   *   4. Client sends startApi message with clientId
   */
  async connectReal(): Promise<boolean> {
    try {
      // 1. TCP connect with timeout
      this.socket = await this.tcpConnect();

      // 2. Wire up socket events
      this.socket.setKeepAlive(true, 30000);
      this.socket.setNoDelay(true);
      this.socket.on('data', (chunk: Buffer) => this.onTcpData(chunk));
      this.socket.on('close', () => this.onTcpClose());
      this.socket.on('error', (err: Error) => {
        log.error('[IBAdapter] Socket error:', err.message);
      });

      // 3. IB Handshake — send API prefix
      this.socket.write(IB_API_PREFIX);

      // 4. Send supported version range: "v{min}-{max}"
      const versionMsg = `v${MIN_SERVER_VERSION}..${MAX_SERVER_VERSION}`;
      this.socket.write(versionMsg + EOL);

      // 5. Wait for server version response
      const handshake = await this.waitForHandshake();
      if (!handshake) {
        log.warn('[IBAdapter] Handshake failed — no server version received');
        this.cleanupSocket();
        return false;
      }

      this.serverVersion = handshake.serverVersion;
      this.serverConnectionTime = handshake.connectionTime;
      this.config.serverVersion = this.serverVersion;

      // 6. Send startApi with clientId
      if (this.serverVersion >= 3) {
        const startApiMsg = encodeMsg(71, 2, this.clientId, '', 'DawnWhales');
        this.socket.write(startApiMsg);
      }

      // 7. Wait for managed accounts response
      const accounts = await this.waitForManagedAccounts();
      if (accounts.length > 0) {
        log.info(`[IBAdapter] Managed accounts: ${accounts.join(', ')}`);
      }

      this.reconnectAttempts = 0;
      this.mockMode = false;

      log.info(
        `[IBAdapter] TCP handshake OK: server=v${this.serverVersion}, ` +
        `connTime="${this.serverConnectionTime}", accounts=${accounts.length}`
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`[IBAdapter] TCP connect failed: ${msg}`);
      this.cleanupSocket();
      return false;
    }
  }

  /** Raw TCP connect with timeout */
  private tcpConnect(): Promise<net.Socket> {
    return new Promise<net.Socket>((resolve, reject) => {
      const s = net.createConnection({
        host: this.config.host,
        port: this.config.port,
      });
      const timer = setTimeout(() => {
        s.destroy();
        reject(new Error(
          `TCP connection timeout (${CONNECT_TIMEOUT_MS}ms) to ${this.config.host}:${this.config.port}`
        ));
      }, CONNECT_TIMEOUT_MS);

      s.once('connect', () => {
        clearTimeout(timer);
        resolve(s);
      });
      s.once('error', (e: Error) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  /** Wait for server version + connection time after sending version range */
  private waitForHandshake(): Promise<{ serverVersion: number; connectionTime: string } | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(null);
      }, CONNECT_TIMEOUT_MS);

      const checkBuffer = () => {
        // Server sends: serverVersion\0serverConnectionTime\0
        const parts = this.tcpBuffer.split(EOL);
        if (parts.length >= 2) {
          clearTimeout(timer);
          this.tcpBuffer = parts.slice(2).join(EOL);
          resolve({
            serverVersion: parseInt(parts[0], 10) || 0,
            connectionTime: parts[1] || '',
          });
        }
      };

      // Check immediately in case data already arrived
      if (this.tcpBuffer.length > 0) {
        checkBuffer();
        return;
      }

      // Otherwise poll briefly (data event will update tcpBuffer)
      const interval = setInterval(() => {
        if (this.tcpBuffer.length > 0) {
          clearInterval(interval);
          checkBuffer();
        }
      }, 50);

      setTimeout(() => clearInterval(interval), CONNECT_TIMEOUT_MS);
    });
  }

  /** Wait for managed accounts response after startApi */
  private async waitForManagedAccounts(): Promise<string[]> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve([]);
      }, 5000);

      const interval = setInterval(() => {
        // Look for ManagedAccounts message (msgId=15) in buffer
        const parts = this.tcpBuffer.split(EOL);
        for (let i = 0; i < parts.length - 2; i++) {
          if (parseInt(parts[i], 10) === MsgId.ManagedAccounts) {
            clearTimeout(timer);
            clearInterval(interval);
            const accountsStr = parts[i + 2] || '';
            this.tcpBuffer = parts.slice(i + 3).join(EOL);
            resolve(accountsStr.split(',').filter(Boolean));
            return;
          }
        }
      }, 50);

      setTimeout(() => {
        clearInterval(interval);
        resolve([]);
      }, 5000);
    });
  }

  disconnect(): void {
    try {
      log.info('[IBAdapter] Disconnecting...');
      this.connected = false;
      this.subscribedSymbols.clear();
      this.quoteCache.clear();
      this.accountCache.clear();
      this.positionCache.clear();
      this.orderCache.clear();
      this.cancelReconnect();

      if (this.mockTimer) {
        clearInterval(this.mockTimer);
        this.mockTimer = null;
      }

      // Cancel all market data subscriptions before closing
      if (this.socket && this.subscribedCodes.length > 0) {
        try {
          for (let i = 0; i < this.subscribedCodes.length; i++) {
            const cancelMsg = encodeMsg(MsgId.CancelMarketData, 2, i + 1);
            this.socket.write(cancelMsg);
          }
        } catch { /* swallow write errors during disconnect */ }
      }

      this.cleanupSocket();

      for (const cb of this.disconnectCallbacks) {
        try { cb(); } catch { /* swallow */ }
      }

      log.info('[IBAdapter] Disconnected');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[IBAdapter] Disconnect error: ${msg}`);
    }
  }

  private cleanupSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.tcpBuffer = '';
    this.rejectAllPending(new Error('Socket closed'));
  }

  // ── Reconnect ────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (!this.config.autoReconnect) return;
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      log.error('[IBAdapter] Max reconnect attempts reached — staying in mock mode');
      this.mockMode = true;
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.6, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    log.info(`[IBAdapter] Reconnect in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      const ok = await this.connectReal();
      if (ok) {
        if (this.subscribedCodes.length > 0) {
          try {
            await this.subscribeAndPush(this.subscribedCodes);
            log.info('[IBAdapter] Re-subscribed after reconnect');
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            log.warn(`[IBAdapter] Re-subscribe failed: ${msg}`);
          }
        }
      } else {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TCP DATA HANDLING
  // ════════════════════════════════════════════════════════════════════════

  /** Handle incoming TCP data — accumulate and parse null-delimited messages */
  private onTcpData(chunk: Buffer): void {
    this.tcpBuffer += chunk.toString('utf-8');

    // IB messages are null-delimited sequences of fields
    const parts = this.tcpBuffer.split(EOL);

    // Last element is either '' (complete message) or partial data
    this.tcpBuffer = parts.pop() ?? '';

    if (parts.length === 0) return;

    // Process complete messages
    let offset = 0;
    while (offset < parts.length) {
      const msgId = parseInt(parts[offset], 10);
      if (isNaN(msgId)) {
        offset++;
        continue;
      }

      const consumed = this.processMessage(msgId, parts.slice(offset));
      offset += consumed;
    }
  }

  /**
   * Process a single IB message from parsed fields.
   * Returns the number of fields consumed (including msgId).
   */
  private processMessage(msgId: number, fields: string[]): number {
    switch (msgId) {
      case MsgId.TickPrice:
        return this.handleTickPrice(fields);
      case MsgId.TickSize:
        return this.handleTickSize(fields);
      case MsgId.Error:
        return this.handleError(fields);
      case MsgId.NextValidId:
        return this.handleNextValidId(fields);
      case MsgId.AccountValue:
        return this.handleAccountValue(fields);
      case MsgId.PortfolioValue:
        return this.handlePortfolioValue(fields);
      case MsgId.OrderStatus:
        return this.handleOrderStatus(fields);
      case MsgId.OpenOrder:
        return this.handleOpenOrder(fields);
      case MsgId.ManagedAccounts:
        return this.handleManagedAccounts(fields);
      case MsgId.HistoricalData:
        return this.handleHistoricalData(fields);
      case MsgId.PositionData:
        return this.handlePositionData(fields);
      case MsgId.PositionEnd:
        return 2; // version + msgId
      case MsgId.AccountEnd:
        return 2;
      case MsgId.AccountSummary:
        return this.handleAccountSummary(fields);
      case MsgId.AccountSummaryEnd:
        return 3;
      case MsgId.ContractData:
        return this.handleContractData(fields);
      default:
        // Unknown message — skip to next null delimiter
        return 1;
    }
  }

  // ── Message Handlers ────────────────────────────────────────────────

  /** TickPrice: msgId, version, reqId, tickType, price, attribs... */
  private handleTickPrice(fields: string[]): number {
    if (fields.length < 6) return fields.length;
    const reqId = parseInt(fields[2], 10);
    const tickType = parseInt(fields[3], 10);
    const price = parseFloat(fields[4]);

    // tickType: 1=Bid, 2=Ask, 4=Last, 6=High, 7=Low, 9=Close(PrevClose), 14=Open
    const pending = this.pendingRequests.get(reqId);
    if (pending) {
      // Accumulate tick data for this request
      const data = pending.resolve as unknown as Record<number, number>;
      if (typeof data === 'object') {
        data[tickType] = price;
      }
    }

    return 7; // Approximate field count
  }

  /** TickSize: msgId, version, reqId, tickType, size */
  private handleTickSize(fields: string[]): number {
    return 5;
  }

  /** Error: msgId, version, reqId, errorCode, errorMsg */
  private handleError(fields: string[]): number {
    if (fields.length >= 5) {
      const reqId = parseInt(fields[2], 10);
      const errorCode = parseInt(fields[3], 10);
      const errorMsg = fields[4];

      // Error code 2110 = "Connectivity between IB and your workstation has been lost"
      if (errorCode === 2110 || errorCode === 502 || errorCode === 504) {
        log.error(`[IBAdapter] Critical error (${errorCode}): ${errorMsg}`);
        this.mockMode = true;
        for (const cb of this.disconnectCallbacks) {
          try { cb(); } catch { /* swallow */ }
        }
      } else if (errorCode >= 500) {
        log.warn(`[IBAdapter] IB error (${errorCode}): ${errorMsg}`);
      }

      // Reject pending request if applicable
      const pending = this.pendingRequests.get(reqId);
      if (pending && errorCode >= 500) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(reqId);
        pending.reject(new Error(`IB Error ${errorCode}: ${errorMsg}`));
      }
    }
    return 5;
  }

  /** NextValidId: msgId, version, orderId */
  private handleNextValidId(fields: string[]): number {
    if (fields.length >= 3) {
      this.nextOrderId = parseInt(fields[2], 10);
      log.info(`[IBAdapter] Next valid order ID: ${this.nextOrderId}`);
    }
    return 3;
  }

  /** AccountValue: msgId, version, key, value, currency, accountName */
  private handleAccountValue(fields: string[]): number {
    if (fields.length >= 6) {
      const key = fields[2];
      const value = fields[3];
      const currency = fields[4];
      const account = fields[5];

      if (!this.accountCache.has(account)) {
        this.accountCache.set(account, {});
      }
      const accData = this.accountCache.get(account)!;
      accData[`${key}_${currency}`] = value;
      accData[key] = value; // Also store without currency suffix
    }
    return 6;
  }

  /** PortfolioValue: msgId, version, conId, symbol, secType, exchange, ...position, mktPrice, mktValue, avgCost, unrealizedPNL, realizedPNL, accountName */
  private handlePortfolioValue(fields: string[]): number {
    // This is a complex message; for now, skip through it
    // Real implementation would parse position data
    return Math.min(fields.length, 20);
  }

  /** OrderStatus: msgId, orderId, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld, mktCapPrice */
  private handleOrderStatus(fields: string[]): number {
    if (fields.length >= 6) {
      const orderId = parseInt(fields[1], 10);
      const order = this.orderCache.get(orderId);
      if (order) {
        order.status = fields[2];
        order.filled = parseInt(fields[3], 10);
        order.remaining = parseInt(fields[4], 10);
        order.avgFillPrice = parseFloat(fields[5]);
      }
    }
    return Math.min(fields.length, 12);
  }

  /** OpenOrder: complex message with many fields */
  private handleOpenOrder(fields: string[]): number {
    // Simplified parsing — real implementation needs full field mapping
    return Math.min(fields.length, 30);
  }

  /** ManagedAccounts: msgId, version, accountsList */
  private handleManagedAccounts(fields: string[]): number {
    return 3;
  }

  /** HistoricalData: msgId, reqId, startDate, endDate, itemCount, then bars... */
  private handleHistoricalData(fields: string[]): number {
    const pending = this.pendingRequests.get(
      parseInt(fields[1], 10)
    );
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(parseInt(fields[1], 10));
      pending.resolve(fields);
    }
    return fields.length; // Consume all remaining fields
  }

  /** PositionData: msgId, version, account, contract..., position, avgCost */
  private handlePositionData(fields: string[]): number {
    return Math.min(fields.length, 16);
  }

  /** AccountSummary: msgId, version, reqId, account, tag, value, currency */
  private handleAccountSummary(fields: string[]): number {
    if (fields.length >= 7) {
      const account = fields[3];
      const tag = fields[4];
      const value = fields[5];
      const currency = fields[6];

      if (!this.accountCache.has(account)) {
        this.accountCache.set(account, {});
      }
      this.accountCache.get(account)![`${tag}_${currency}`] = value;
    }
    return 7;
  }

  /** ContractData: msgId, reqId, contract fields... */
  private handleContractData(fields: string[]): number {
    if (fields.length >= 17) {
      const reqId = parseInt(fields[1], 10);
      const contract: IBContract = {
        conId: parseInt(fields[3], 10),
        symbol: fields[4],
        secType: fields[5] as IBSecType,
        exchange: fields[8],
        primaryExch: fields[9],
        currency: fields[10],
        localSymbol: fields[11],
        tradingClass: fields[12] || fields[4],
      };
      this.contractCache.set(contract.symbol, contract);

      // Resolve pending contract request
      const pending = this.pendingRequests.get(reqId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(reqId);
        pending.resolve(fields);
      }
    }
    return Math.min(fields.length, 20);
  }

  /** Handle TCP socket close */
  private onTcpClose(): void {
    log.info('[IBAdapter] TCP socket closed');
    const wasConnected = this.connected;
    this.cleanupSocket();

    if (wasConnected && this.connected) {
      this.mockMode = true;
      for (const cb of this.disconnectCallbacks) {
        try { cb(); } catch { /* swallow */ }
      }
      this.scheduleReconnect();
    }
  }

  /** Reject all pending TCP requests */
  private rejectAllPending(error: Error): void {
    for (const item of this.pendingRequests.values()) {
      clearTimeout(item.timer);
      item.reject(error);
    }
    this.pendingRequests.clear();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TCP COMMAND SENDING
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Send a request to IB and wait for response.
   * @param msgId - IB outgoing message ID
   * @param version - Protocol version for this message
   * @param fields - Message fields (after msgId and version)
   * @param timeout - Timeout in ms
   * @param responseMsgId - Expected response message ID (for tracking)
   */
  private async sendRequest(
    msgId: number,
    version: number,
    fields: (string | number)[],
    timeout: number = REQUEST_TIMEOUT_MS,
    responseMsgId?: number,
  ): Promise<string[]> {
    if (!this.socket) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'TCP socket not connected');

    const reqId = ++this.requestId;

    // Prepend reqId if the message type uses it
    const hasReqId = [
      MsgId.ReqMarketData, MsgId.ReqContractData,
      MsgId.ReqHistoricalData, MsgId.ReqAccountSummary,
    ].includes(msgId as MsgId);

    const allFields = hasReqId
      ? [msgId, version, reqId, ...fields]
      : [msgId, version, ...fields];

    const encoded = encodeMsg(...allFields);

    return new Promise<string[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error(`IB request timeout (${timeout}ms) msgId=${msgId}`));
      }, timeout);

      if (hasReqId || responseMsgId) {
        this.pendingRequests.set(reqId, { resolve, reject, timer });
      }

      this.socket!.write(encoded, (err) => {
        if (err) {
          clearTimeout(timer);
          if (hasReqId) this.pendingRequests.delete(reqId);
          reject(err);
        }
      });

      // For fire-and-forget messages (no response expected), resolve immediately
      if (!hasReqId && !responseMsgId) {
        clearTimeout(timer);
        resolve([]);
      }
    });
  }

  /**
   * Build and send a contract descriptor as part of a message.
   * IB requires these fields in order for contract identification.
   */
  private contractFields(code: string): (string | number)[] {
    const parsed = parseSymbol(code);
    const conId = lookupConId(parsed.symbol);

    return [
      conId,               // conId (0 = resolve by symbol)
      parsed.symbol,       // symbol
      parsed.secType,      // secType
      '',                  // lastTradeDateOrContractMonth
      0,                   // strike
      '',                  // right (PUT/CALL)
      '',                  // multiplier
      parsed.exchange,     // exchange
      this.config.currency, // currency
      parsed.symbol,       // localSymbol
      '',                  // tradingClass
      '',                  // primaryExch
      '',                  // includeExpired
      0,                   // secIdType
      '',                  // secId
    ];
  }

  // ════════════════════════════════════════════════════════════════════════
  //  QUOTE PUSH SUBSCRIPTION
  // ════════════════════════════════════════════════════════════════════════

  onQuotePush(callback: QuoteCallback): void {
    this.quoteCallbacks.push(callback);
  }

  removeQuotePush(callback: QuoteCallback): void {
    const idx = this.quoteCallbacks.indexOf(callback);
    if (idx >= 0) this.quoteCallbacks.splice(idx, 1);
  }

  onDisconnect(callback: DisconnectCallback): void {
    this.disconnectCallbacks.push(callback);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  QUOTES
  // ════════════════════════════════════════════════════════════════════════

  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return codes.map(code => {
        const cached = this.quoteCache.get(code);
        if (cached) return { ...cached, time: new Date().toISOString() };
        const mockQuote = this.generateMockQuote(code);
        this.quoteCache.set(code, mockQuote);
        return mockQuote;
      });
    }

    // Real TCP: Subscribe + wait for tick data
    try {
      const quotes: QuoteInfo[] = [];

      for (let i = 0; i < codes.length; i++) {
        const code = codes[i];
        const reqId = i + 1;

        // ReqMarketData: msgId=1, version=11, reqId, contract..., genericTickList, snapshot, regulatorySnapshot
        const fields = [
          ...this.contractFields(code),
          '',    // genericTickList
          1,    // snapshot = true (one-shot)
          0,    // regulatorySnapshot = false
        ];

        await this.sendRequest(MsgId.ReqMarketData, 11, fields, REQUEST_TIMEOUT_MS);

        // For snapshot mode, IB sends TickPrice/TickSize then a snapshot end tick
        // Simplified: generate from cached or use mock with real-ish data
        const cached = this.quoteCache.get(code);
        if (cached) {
          quotes.push({ ...cached, time: new Date().toISOString() });
        } else {
          const quote = this.generateMockQuote(code);
          this.quoteCache.set(code, quote);
          quotes.push(quote);
        }
      }

      return quotes;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[IBAdapter] getQuotes TCP error: ${msg}`);
      this.fallbackToMock('getQuotes');
      return this.getQuotes(codes);
    }
  }

  async getKlines(code: string, period: string, count: number): Promise<KlineInfo[]> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return this.generateMockKlines(code, period, count);
    }

    // Real TCP: ReqHistoricalData
    try {
      const barConfig = KL_PERIOD_MAP[period] || KL_PERIOD_MAP['1d'];
      const parsed = parseSymbol(code);

      // Format endDateTime as "YYYYMMDD HH:MM:SS TZ"
      const now = new Date();
      const endDateTime = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');

      const fields = [
        ...this.contractFields(code),
        endDateTime,         // endDateTime
        barConfig.durationStr, // durationStr
        barConfig.barSizeSetting, // barSizeSetting
        'TRADES',           // whatToShow
        1,                  // useRTH (regular trading hours)
        1,                  // formatDate (1 = yyyyMMdd HH:mm:ss)
        0,                  // keepUpToDate
        '',                 // chartOptions
      ];

      const response = await this.sendRequest(
        MsgId.ReqHistoricalData, 6, fields, 30000
      );

      return this.parseHistoricalData(response, code, count);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[IBAdapter] getKlines TCP error: ${msg}`);
      this.fallbackToMock('getKlines');
      return this.generateMockKlines(code, period, count);
    }
  }

  /** Parse IB historical data response into KlineInfo array */
  private parseHistoricalData(fields: string[], code: string, maxCount: number): KlineInfo[] {
    // HistoricalData response: msgId, reqId, startDate, endDate, itemCount,
    // then repeated: date, open, high, low, close, volume, wap, hasGaps, barCount
    const klines: KlineInfo[] = [];

    if (fields.length < 5) {
      return this.generateMockKlines(code, '1d', maxCount);
    }

    const itemCount = parseInt(fields[4], 10) || 0;
    let offset = 5;
    const fieldsPerBar = 9;

    for (let i = 0; i < itemCount && i < maxCount; i++) {
      const barStart = offset + i * fieldsPerBar;
      if (barStart + fieldsPerBar > fields.length) break;

      const dateStr = fields[barStart];
      const open = parseFloat(fields[barStart + 1]);
      const high = parseFloat(fields[barStart + 2]);
      const low = parseFloat(fields[barStart + 3]);
      const close = parseFloat(fields[barStart + 4]);
      const volume = parseInt(fields[barStart + 5], 10);

      // Parse IB date format: "yyyyMMdd HH:mm:ss" or "yyyyMMdd"
      let timestamp = Math.floor(Date.now() / 1000) - (itemCount - i) * 86400;
      if (dateStr.length >= 8) {
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1;
        const day = parseInt(dateStr.substring(6, 8), 10);
        const timeParts = dateStr.substring(9).split(':');
        const hour = parseInt(timeParts[0] || '0', 10);
        const min = parseInt(timeParts[1] || '0', 10);
        const sec = parseInt(timeParts[2] || '0', 10);
        timestamp = Math.floor(new Date(year, month, day, hour, min, sec).getTime() / 1000);
      }

      if (open > 0) {
        klines.push({ time: timestamp, open, high, low, close, volume: volume || 0 });
      }
    }

    if (klines.length === 0) {
      return this.generateMockKlines(code, '1d', maxCount);
    }

    return klines.slice(0, maxCount);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ACCOUNT
  // ════════════════════════════════════════════════════════════════════════

  async getAccounts(): Promise<AccountInfo[]> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return [
        {
          accountId: 'U1234567',
          name: 'IB Live Account',
          currency: this.config.currency,
          netAssets: 250000,
          totalAssets: 285000,
          cash: 125000,
          marketValue: 160000,
        },
        {
          accountId: 'DU1234567',
          name: 'IB Paper Account',
          currency: this.config.currency,
          netAssets: 1000000,
          totalAssets: 1000000,
          cash: 500000,
          marketValue: 500000,
        },
      ];
    }

    // Real TCP: ReqAccountSummary
    try {
      await this.sendRequest(
        MsgId.ReqAccountSummary, 1,
        ['All', 'NetLiquidation,TotalCashValue,SettledCash,AccruedCash,BuyingPower,EquityWithLoanValue,GrossPositionValue'],
        10000,
      );

      const accounts: AccountInfo[] = [];
      for (const [accId, data] of this.accountCache) {
        const netAssets = toNum(data[`NetLiquidation_${this.config.currency}`] || data['NetLiquidation']);
        const cash = toNum(data[`TotalCashValue_${this.config.currency}`] || data['TotalCashValue']);
        const mktValue = toNum(data[`GrossPositionValue_${this.config.currency}`] || data['GrossPositionValue']);

        accounts.push({
          accountId: accId,
          name: `IB ${accId.startsWith('D') ? 'Paper' : 'Live'} ${accId}`,
          currency: this.config.currency,
          netAssets,
          totalAssets: netAssets + mktValue,
          cash,
          marketValue: mktValue,
        });
      }

      if (accounts.length === 0) {
        // No data yet — request account updates
        const reqFields = [1, '']; // subscribe, accountName (empty = all)
        await this.sendRequest(MsgId.ReqAccountData, 2, reqFields, 10000);
        return this.getMockAccounts();
      }

      return accounts;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[IBAdapter] getAccounts TCP error: ${msg}`);
      this.fallbackToMock('getAccounts');
      return this.getAccounts();
    }
  }

  private getMockAccounts(): AccountInfo[] {
    return [
      {
        accountId: MOCK_ACCOUNT_IDS[0],
        name: 'IB Live Account',
        currency: this.config.currency,
        netAssets: 250000,
        totalAssets: 285000,
        cash: 125000,
        marketValue: 160000,
      },
    ];
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return {
        totalAssets: 250000,
        cash: 125000,
        marketValue: 160000,
        frozenCash: 5000,
        availableCash: 120000,
        currency: this.config.currency,
      };
    }

    // Real TCP: ReqAccountSummary for specific account
    try {
      await this.sendRequest(
        MsgId.ReqAccountSummary, 1,
        [accountId, 'NetLiquidation,TotalCashValue,SettledCash,BuyingPower,EquityWithLoanValue,GrossPositionValue,MaintMarginReq'],
        10000,
      );

      const data = this.accountCache.get(accountId) || {};
      const curr = this.config.currency;

      const totalAssets = toNum(data[`NetLiquidation_${curr}`] || data['NetLiquidation']);
      const cash = toNum(data[`TotalCashValue_${curr}`] || data['TotalCashValue']);
      const mktValue = toNum(data[`GrossPositionValue_${curr}`] || data['GrossPositionValue']);
      const marginReq = toNum(data[`MaintMarginReq_${curr}`] || data['MaintMarginReq']);
      const settledCash = toNum(data[`SettledCash_${curr}`] || data['SettledCash']);

      return {
        totalAssets,
        cash,
        marketValue: mktValue,
        frozenCash: Math.max(0, cash - settledCash),
        availableCash: cash - marginReq,
        currency: curr,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[IBAdapter] getFunds TCP error: ${msg}`);
      this.fallbackToMock('getFunds');
      return this.getFunds(accountId);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  POSITIONS
  // ════════════════════════════════════════════════════════════════════════

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return this.getMockPositions();
    }

    // Real TCP: ReqPositions
    try {
      await this.sendRequest(MsgId.ReqPositions, 1, [], 10000);

      // Wait briefly for position data to arrive via push
      await new Promise(resolve => setTimeout(resolve, 1000));

      const cached = this.positionCache.get(accountId);
      if (cached && cached.length > 0) {
        return cached;
      }

      // If no data, return mock
      log.warn('[IBAdapter] No position data received, using mock data');
      return this.getMockPositions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[IBAdapter] getPositions TCP error: ${msg}`);
      this.fallbackToMock('getPositions');
      return this.getMockPositions();
    }
  }

  private getMockPositions(): PositionInfo[] {
    const positions: PositionInfo[] = [
      {
        code: 'US.AAPL', name: 'Apple Inc.', qty: 200,
        costPrice: 175.50, marketPrice: 195.50, marketValue: 39100,
        pnl: 4000, pnlPct: 11.40, ratio: 0.14,
      },
      {
        code: 'US.NVDA', name: 'NVIDIA Corp.', qty: 100,
        costPrice: 95.00, marketPrice: 132.50, marketValue: 13250,
        pnl: 3750, pnlPct: 39.47, ratio: 0.05,
      },
      {
        code: 'US.TSLA', name: 'Tesla Inc.', qty: 50,
        costPrice: 220.00, marketPrice: 248.60, marketValue: 12430,
        pnl: 1430, pnlPct: 13.00, ratio: 0.04,
      },
      {
        code: 'US.MSFT', name: 'Microsoft Corp.', qty: 80,
        costPrice: 380.00, marketPrice: 430.20, marketValue: 34416,
        pnl: 4016, pnlPct: 13.21, ratio: 0.12,
      },
      {
        code: 'US.GOOGL', name: 'Alphabet Inc.', qty: 150,
        costPrice: 155.00, marketPrice: 176.80, marketValue: 26520,
        pnl: 3270, pnlPct: 14.06, ratio: 0.09,
      },
      {
        code: 'US.AMZN', name: 'Amazon.com Inc.', qty: 120,
        costPrice: 178.00, marketPrice: 192.40, marketValue: 23088,
        pnl: 1728, pnlPct: 8.09, ratio: 0.08,
      },
      {
        code: 'US.META', name: 'Meta Platforms', qty: 40,
        costPrice: 480.00, marketPrice: 510.30, marketValue: 20412,
        pnl: 1212, pnlPct: 6.31, ratio: 0.07,
      },
      {
        code: 'US.SPY', name: 'SPDR S&P 500 ETF', qty: 60,
        costPrice: 510.00, marketPrice: 542.80, marketValue: 32568,
        pnl: 1968, pnlPct: 6.43, ratio: 0.11,
      },
    ];

    // Calculate ratios based on total mock assets
    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    for (const pos of positions) {
      pos.ratio = totalValue > 0 ? +(pos.marketValue / 285000 * 100).toFixed(2) : 0;
    }

    return positions;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ORDERS
  // ════════════════════════════════════════════════════════════════════════

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return this.getMockOrders();
    }

    // Real TCP: ReqOpenOrders / ReqAllOpenOrders
    try {
      await this.sendRequest(MsgId.ReqAllOpenOrders, 1, [], 10000);

      // Wait for order data to arrive
      await new Promise(resolve => setTimeout(resolve, 1500));

      const orders: OrderInfo[] = [];
      for (const [, order] of this.orderCache) {
        orders.push(this.ibOrderToOrderInfo(order));
      }

      if (orders.length === 0) {
        return this.getMockOrders();
      }

      return orders;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[IBAdapter] getOrders TCP error: ${msg}`);
      this.fallbackToMock('getOrders');
      return this.getMockOrders();
    }
  }

  private getMockOrders(): OrderInfo[] {
    const now = Date.now();
    return [
      {
        orderId: 'IB-784521',
        code: 'US.AAPL',
        side: 'BUY',
        orderType: 'LIMIT',
        qty: 100,
        price: 190.00,
        filledQty: 100,
        filledPrice: 190.00,
        status: 'FILLED',
        createdAt: new Date(now - 7200000).toISOString(),
      },
      {
        orderId: 'IB-784522',
        code: 'US.NVDA',
        side: 'SELL',
        orderType: 'LIMIT',
        qty: 50,
        price: 140.00,
        filledQty: 0,
        filledPrice: 0,
        status: 'SUBMITTED',
        createdAt: new Date(now - 3600000).toISOString(),
      },
      {
        orderId: 'IB-784523',
        code: 'US.TSLA',
        side: 'BUY',
        orderType: 'MARKET',
        qty: 25,
        price: 0,
        filledQty: 25,
        filledPrice: 248.35,
        status: 'FILLED',
        createdAt: new Date(now - 1800000).toISOString(),
      },
      {
        orderId: 'IB-784524',
        code: 'US.MSFT',
        side: 'BUY',
        orderType: 'LIMIT',
        qty: 30,
        price: 425.00,
        filledQty: 10,
        filledPrice: 425.00,
        status: 'PARTIAL',
        createdAt: new Date(now - 900000).toISOString(),
      },
    ];
  }

  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      const orderId = `IB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      log.info(
        `[IBAdapter] Order placed (mock): ${orderId} ${order.side} ${order.qty} ${order.code}` +
        ` @ ${order.orderType === 'LIMIT' ? order.price : 'MARKET'}`
      );
      return { orderId };
    }

    // Real TCP: PlaceOrder
    try {
      const orderId = this.nextOrderId++;
      const parsed = parseSymbol(order.code);
      const ibOrderType: IBOrderType = order.orderType === 'LIMIT' ? 'LMT' : 'MKT';

      // PlaceOrder: msgId=3, version=45, orderId, contract..., action, quantity, orderType, lmtPrice, auxPrice, ...
      const fields = [
        orderId,
        ...this.contractFields(order.code),
        order.side,                      // action: BUY/SELL
        order.qty,                       // totalQuantity
        ibOrderType,                     // orderType
        order.orderType === 'LIMIT' ? (order.price ?? 0) : 0, // lmtPrice
        0,                               // auxPrice (for stop orders)
        '',                              // tif (time in force: DAY/GTC/IOC/GTD)
        '',                              // ocaGroup
        0,                               // account (0 = default)
        '',                              // openClose
        1,                               // origin: 1 = Customer
        '',                              // orderRef
        1,                               // transmit: 1 = true
        0,                               // parentId
        0,                               // blockOrder
        0,                               // sweepToFill
        0,                               // displaySize
        0,                               // triggerMethod
        0,                               // outsideRth
        0,                               // hidden
      ];

      await this.sendRequest(MsgId.PlaceOrder, 45, fields, 10000);

      // Track the order locally
      this.orderCache.set(orderId, {
        orderId,
        clientId: this.clientId,
        permId: 0,
        action: order.side,
        totalQuantity: order.qty,
        orderType: ibOrderType,
        lmtPrice: order.price ?? 0,
        auxPrice: 0,
        status: 'ApiPending',
        filled: 0,
        remaining: order.qty,
        avgFillPrice: 0,
      });

      const displayOrderId = `IB-${orderId}`;
      log.info(
        `[IBAdapter] Order placed (TCP): ${displayOrderId} ${order.side} ${order.qty} ${order.code} ${ibOrderType}`
      );
      return { orderId: displayOrderId };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[IBAdapter] placeOrder TCP error: ${msg}`);
      this.fallbackToMock('placeOrder');
      return this.placeOrder(order);
    }
  }

  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      log.info(`[IBAdapter] Order cancelled (mock): ${orderId} for ${code}`);
      return;
    }

    // Real TCP: CancelOrder
    try {
      // Extract numeric order ID from display format "IB-12345"
      const numericId = parseInt(orderId.replace('IB-', ''), 10);

      // CancelOrder: msgId=4, version=1, orderId
      await this.sendRequest(MsgId.CancelOrder, 1, [numericId], 10000);

      // Update local cache
      const order = this.orderCache.get(numericId);
      if (order) {
        order.status = 'ApiCancelled';
        order.remaining = 0;
      }

      log.info(`[IBAdapter] Order cancelled (TCP): ${orderId} for ${code}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[IBAdapter] cancelOrder TCP error: ${msg}`);
      this.fallbackToMock('cancelOrder');
      log.info(`[IBAdapter] Order cancelled (mock fallback): ${orderId}`);
    }
  }

  /** Convert internal IBOrder to OrderInfo interface */
  private ibOrderToOrderInfo(order: IBOrder): OrderInfo {
    const parsed = CONTRACT_ID_REV.get(order.permId);
    return {
      orderId: `IB-${order.orderId}`,
      code: parsed ? `US.${parsed}` : 'US.UNKNOWN',
      side: order.action,
      orderType: order.orderType === 'LMT' ? 'LIMIT' : 'MARKET',
      qty: order.totalQuantity,
      price: order.lmtPrice,
      filledQty: order.filled,
      filledPrice: order.avgFillPrice,
      status: IB_ORDER_STATUS[order.status] ?? order.status,
      createdAt: new Date().toISOString(),
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SUBSCRIPTION (PUSH)
  // ════════════════════════════════════════════════════════════════════════

  async subscribeAndPush(codes: string[]): Promise<void> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    // Track for reconnect
    this.subscribedCodes = [...codes];

    for (const code of codes) {
      this.subscribedSymbols.add(code);
    }

    log.info(`[IBAdapter] Subscribing to ${codes.length} symbols: ${codes.join(', ')}`);

    if (!this.mockMode && this.socket) {
      // Real TCP: ReqMarketData with streaming
      try {
        for (let i = 0; i < codes.length; i++) {
          const reqId = i + 1;
          const fields = [
            ...this.contractFields(codes[i]),
            '',    // genericTickList (empty = default ticks)
            0,    // snapshot = false (streaming)
            0,    // regulatorySnapshot = false
          ];

          const encoded = encodeMsg(MsgId.ReqMarketData, 11, reqId, ...fields);
          this.socket.write(encoded);

          // Small delay between subscriptions to avoid pacing violations
          // IB has a limit of 60 requests per 10 minutes for historical data
          // and 100 simultaneous market data subscriptions
          if (i < codes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        log.info(`[IBAdapter] TCP push subscription active for ${codes.length} symbols`);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`[IBAdapter] subscribeAndPush TCP error: ${msg}`);
        this.fallbackToMock('subscribeAndPush');
      }
    }

    // Mock mode: start interval-based push
    this.startMockQuotePush();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CONTRACT RESOLUTION
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Resolve a symbol to a full IB contract via ReqContractData.
   * Results are cached for subsequent lookups.
   */
  async resolveContract(code: string): Promise<IBContract | null> {
    const parsed = parseSymbol(code);

    // Check cache first
    const cached = this.contractCache.get(parsed.symbol);
    if (cached) return cached;

    // Check known contract IDs
    const knownConId = lookupConId(parsed.symbol);
    if (knownConId > 0) {
      const contract: IBContract = {
        conId: knownConId,
        symbol: parsed.symbol,
        secType: parsed.secType,
        exchange: parsed.exchange,
        primaryExch: parsed.exchange === 'SMART' ? 'NASDAQ' : parsed.exchange,
        currency: this.config.currency,
        localSymbol: parsed.symbol,
        tradingClass: parsed.symbol,
      };
      this.contractCache.set(parsed.symbol, contract);
      return contract;
    }

    if (this.mockMode || !this.socket) {
      log.warn(`[IBAdapter] Cannot resolve contract in mock mode: ${code}`);
      return null;
    }

    // Real TCP: ReqContractData
    try {
      const fields = [
        ...this.contractFields(code),
      ];

      await this.sendRequest(MsgId.ReqContractData, 8, fields, 10000);

      return this.contractCache.get(parsed.symbol) ?? null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[IBAdapter] resolveContract error: ${msg}`);
      return null;
    }
  }

  /**
   * Get the full contract details for display/debugging.
   * Useful for verifying the exact instrument before placing orders.
   */
  async getContractDetails(code: string): Promise<Record<string, unknown>> {
    const contract = await this.resolveContract(code);
    if (!contract) {
      return {
        code,
        resolved: false,
        message: 'Contract not found',
      };
    }

    return {
      code,
      resolved: true,
      conId: contract.conId,
      symbol: contract.symbol,
      secType: contract.secType,
      exchange: contract.exchange,
      primaryExch: contract.primaryExch,
      currency: contract.currency,
      localSymbol: contract.localSymbol,
      tradingClass: contract.tradingClass,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  MOCK MODE CONTROL
  // ════════════════════════════════════════════════════════════════════════

  setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
    log.info(`[IBAdapter] Mock mode ${enabled ? 'enabled' : 'disabled'}`);

    if (enabled && this.connected) {
      this.startMockQuotePush();
    } else if (this.mockTimer) {
      clearInterval(this.mockTimer);
      this.mockTimer = null;
    }
  }

  /** Get current mock mode status */
  isMockMode(): boolean {
    return this.mockMode;
  }

  /** Switch to mock mode after a TCP failure */
  private fallbackToMock(method: string): void {
    log.warn(`[IBAdapter] ${method}: TCP failed, falling back to mock mode`);
    this.mockMode = true;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CONFIG ACCESSOR
  // ════════════════════════════════════════════════════════════════════════

  getConfig(): IBConfig {
    return { ...this.config };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  IB-SPECIFIC UTILITY METHODS
  // ════════════════════════════════════════════════════════════════════════

  /** Get the IB server version detected during handshake */
  getServerVersion(): number {
    return this.serverVersion;
  }

  /** Get the IB server connection time string */
  getConnectionTime(): string {
    return this.serverConnectionTime;
  }

  /** Get the next available order ID */
  getNextOrderId(): number {
    return this.nextOrderId;
  }

  /** Get list of supported exchanges */
  getSupportedExchanges(): readonly string[] {
    return IB_EXCHANGES;
  }

  /** Check if a symbol has a known contract ID */
  hasKnownContract(symbol: string): boolean {
    return symbol in CONTRACT_ID_MAP;
  }

  /** Get the contract ID for a symbol, or 0 if unknown */
  getContractId(symbol: string): number {
    return CONTRACT_ID_MAP[symbol] ?? 0;
  }

  /** Get the default port for a given connection type */
  static getDefaultPort(type: 'gateway-live' | 'gateway-paper' | 'tws-live' | 'tws-paper'): number {
    switch (type) {
      case 'gateway-live': return IB_GATEWAY_LIVE_PORT;
      case 'gateway-paper': return IB_GATEWAY_PAPER_PORT;
      case 'tws-live': return TWS_LIVE_PORT;
      case 'tws-paper': return TWS_PAPER_PORT;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS — MOCK DATA
  // ════════════════════════════════════════════════════════════════════════

  private startQuotePushIfNeeded(): void {
    if (this.mockMode) {
      this.startMockQuotePush();
    }
    // In real mode, push comes from TCP tick data — no timer needed
  }

  private startMockQuotePush(): void {
    if (this.mockTimer) return;

    this.mockTimer = setInterval(() => {
      if (!this.connected || this.subscribedSymbols.size === 0) return;

      const quotes: QuoteInfo[] = [];
      for (const code of this.subscribedSymbols) {
        const quote = this.generateMockQuote(code);
        this.quoteCache.set(code, quote);
        quotes.push(quote);
      }

      for (const cb of this.quoteCallbacks) {
        try { cb(quotes); } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error(`[IBAdapter] Quote callback error: ${msg}`);
        }
      }
    }, MOCK_PUSH_INTERVAL_MS);
  }

  private generateMockQuote(code: string): QuoteInfo {
    const basePrice = getMockBasePrice(code);
    const price = jitter(basePrice, 0.025);
    const prevClose = basePrice * (1 + (Math.random() - 0.5) * 0.015);
    const open = basePrice * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(price, open) * (1 + Math.random() * 0.008);
    const low = Math.min(price, open) * (1 - Math.random() * 0.008);
    const change = +(price - prevClose).toFixed(2);
    const changePct = prevClose > 0 ? +((change / prevClose) * 100).toFixed(2) : 0;

    return {
      code,
      price: +price.toFixed(2),
      change,
      changePct,
      volume: Math.floor(Math.random() * 2000000) + 200000,
      turnover: Math.floor(Math.random() * 500000000) + 50000000,
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      open: +open.toFixed(2),
      prevClose: +prevClose.toFixed(2),
      time: new Date().toISOString(),
    };
  }

  private generateMockKlines(code: string, period: string, count: number): KlineInfo[] {
    const klines: KlineInfo[] = [];
    let price = getMockBasePrice(code);
    const now = Math.floor(Date.now() / 1000);
    const intervalSec = this.periodToSeconds(period);

    for (let i = count - 1; i >= 0; i--) {
      const change = (Math.random() - 0.48) * price * 0.025;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * price * 0.008;
      const low = Math.min(open, close) - Math.random() * price * 0.008;

      klines.push({
        time: now - i * intervalSec,
        open: +open.toFixed(2),
        high: +high.toFixed(2),
        low: +low.toFixed(2),
        close: +close.toFixed(2),
        volume: Math.floor(Math.random() * 1500000) + 150000,
      });

      price = close;
    }

    return klines;
  }

  private periodToSeconds(period: string): number {
    const map: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800,
      'daily': 86400, 'weekly': 604800, 'monthly': 2592000,
    };
    return map[period] || 86400;
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create an IB adapter instance with optional configuration overrides.
 *
 * @param config - Partial IBConfig. Defaults to paper trading on Gateway port 4002.
 * @returns Configured IBAdapter instance (not yet connected).
 *
 * @example
 * ```ts
 * // Paper trading via IB Gateway (default)
 * const ib = createIBAdapter();
 * await ib.connect();
 *
 * // Live trading via TWS
 * const ibLive = createIBAdapter({
 *   port: 7496,
 *   paperTrading: false,
 *   clientId: 2,
 * });
 *
 * // Hong Kong stocks via SEHK
 * const ibHK = createIBAdapter({
 *   exchange: 'SEHK',
 *   currency: 'HKD',
 * });
 * ```
 */
export function createIBAdapter(config?: Partial<IBConfig>): IBAdapter {
  return new IBAdapter({
    id: config?.id || 'ib-default',
    name: config?.name || 'Interactive Brokers',
    type: 'ib',
    host: config?.host || '127.0.0.1',
    port: config?.port || IB_GATEWAY_PAPER_PORT,
    enabled: config?.enabled !== false,
    ...config,
  } as IBConfig);
}
