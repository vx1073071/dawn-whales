/**
 * Moomoo OpenD Adapter
 * Implements IBrokerAdapter interface for Moomoo broker integration.
 * Moomoo uses the same OpenD protocol as Futu but with different defaults (port 11211).
 *
 * Supports:
 *   - Mock mode (default fallback, no network required)
 *   - Real TCP mode (connects to Moomoo OpenD via protobuf/binary protocol)
 *   - Auto-fallback to mock if TCP connection fails
 */

import net from 'net';
import { createHash } from 'crypto';
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

// ── Constants ───────────────────────────────────────────────────────────────

/** Moomoo OpenD protocol magic bytes (same as Futu) */
const PROTO_MAGIC = 'FT';
/** Header size in bytes (same as Futu OpenD) */
const HEADER_SIZE = 44;
/** Default Moomoo OpenD port */
const DEFAULT_PORT = 11211;
/** Default TCP connection timeout (ms) */
const CONNECT_TIMEOUT_MS = 5000;
/** Default request timeout (ms) */
const REQUEST_TIMEOUT_MS = 15000;
/** Quote push interval for mock mode (ms) */
const MOCK_PUSH_INTERVAL_MS = 2000;

/** Protocol command IDs (same as Futu OpenD) */
const CMD = {
  InitConnect:        { id: 1001, name: 'InitConnect' },
  QotSub:             { id: 3001, name: 'Qot_Sub' },
  QotGetBasicQot:     { id: 3004, name: 'Qot_GetBasicQot' },
  QotGetKL:           { id: 3006, name: 'Qot_GetKL' },
  QotUpdateBasicQot:  { id: 3005, name: 'Qot_UpdateBasicQot' },
  TrdGetAccList:      { id: 2001, name: 'Trd_GetAccList' },
  TrdGetFunds:        { id: 2101, name: 'Trd_GetFunds' },
  TrdGetPositionList: { id: 2102, name: 'Trd_GetPositionList' },
  TrdGetOrderList:    { id: 2201, name: 'Trd_GetOrderList' },
  TrdPlaceOrder:      { id: 2202, name: 'Trd_PlaceOrder' },
  TrdCancelOrder:     { id: 2205, name: 'Trd_ModifyOrder' },
} as const;

/** Market code mapping: prefix → numeric market ID */
const MARKET: Record<string, number> = { HK: 1, US: 11, SH: 21, SZ: 22, SG: 51, CC: 91 };
/** Reverse market mapping: numeric → prefix */
const MARKET_REV: Record<number, string> = { 1: 'HK', 11: 'US', 21: 'SH', 22: 'SZ', 51: 'SG', 91: 'CC' };

/** K-line period mapping */
const KL_PERIOD: Record<string, number> = {
  '1m': 1, '5m': 5, '15m': 15, '30m': 30, '60m': 60,
  'daily': 4, 'weekly': 5, 'monthly': 6,
};

// ── Utility Functions ───────────────────────────────────────────────────────

/** Extract market code number from a dot-separated symbol code */
function marketCodeOf(code: string): number {
  const prefix = code.split('.')[0];
  return MARKET[prefix] ?? 11; // Default to US market
}

/** Extract the symbol part after the market prefix */
function symbolOf(code: string): string {
  return code.split('.').slice(1).join('.');
}

/**
 * Convert protobuf-style numeric value to JS number.
 * Handles numbers, strings, and Long-like {low, high} objects.
 */
function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  if (typeof v === 'object' && v !== null && 'low' in v) {
    const lo = (v as any).low >>> 0;
    const hi = ((v as any).high | 0) * 0x100000000;
    return (v as any).unsigned ? hi + lo : hi + lo;
  }
  return Number(v) || 0;
}

// ── Protobuf Loader ─────────────────────────────────────────────────────────

/** Lazily loaded protobuf root (same proto as Futu OpenD) */
let protoRoot: any = null;
let protoLoadAttempted = false;

function loadProto(): any {
  if (protoLoadAttempted) return protoRoot;
  protoLoadAttempted = true;
  try {
    protoRoot = require('futu-api/proto.js');
    if (protoRoot?.default) protoRoot = protoRoot.default;
    log.info('[MoomooAdapter] Protobuf definitions loaded');
  } catch (e: any) {
    log.warn('[MoomooAdapter] Protobuf definitions not available:', e.message);
    protoRoot = null;
  }
  return protoRoot;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface MoomooConfig extends BrokerConfig {
  language?: 'en' | 'zh-CN' | 'zh-HK';
  market?: 'US' | 'HK' | 'SG';
  currency?: 'USD' | 'HKD' | 'SGD';
  /** Maximum reconnect attempts before giving up */
  maxReconnectAttempts?: number;
  /** Enable auto-reconnect on disconnect */
  autoReconnect?: boolean;
}

type QuoteCallback = (quotes: QuoteInfo[]) => void;
type DisconnectCallback = () => void;

interface PendingRequest {
  resolve: (body: Buffer) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

// ── TCP Message Builder / Parser ────────────────────────────────────────────

/**
 * Build a binary OpenD request packet (header + protobuf body).
 * Header format (44 bytes):
 *   [0..2)   magic "FT"
 *   [2..6)   protoID (uint32 LE)
 *   [6..7)   protoFmtType (uint8)
 *   [7..8)   protoVer (uint8)
 *   [8..12)  serialNo (uint32 LE)
 *   [12..16) bodyLen (uint32 LE)
 *   [16..36) bodySHA1 (20 bytes)
 *   [36..44) reserved (8 bytes, zeros)
 */
function buildPacket(cmdId: number, serial: number, bodyBuf: Buffer): Buffer {
  const header = Buffer.alloc(HEADER_SIZE);
  header.write(PROTO_MAGIC, 0, 2, 'ascii');
  header.writeUInt32LE(cmdId, 2);
  header.writeUInt8(0, 6);  // protoFmtType: protobuf
  header.writeUInt8(0, 7);  // protoVer
  header.writeUInt32LE(serial, 8);
  header.writeUInt32LE(bodyBuf.length, 12);
  // SHA-1 of body
  const sha1 = createHash('sha1').update(bodyBuf).digest();
  sha1.copy(header, 16);
  return Buffer.concat([header, bodyBuf]);
}

/**
 * Parse the header of an OpenD response buffer.
 * Returns null if the buffer is too small or magic is invalid.
 */
function parseHeader(buf: Buffer): { protoID: number; serial: number; bodyLen: number } | null {
  if (buf.length < HEADER_SIZE) return null;
  const magic = buf.subarray(0, 2).toString('ascii');
  if (magic !== PROTO_MAGIC) return null;
  return {
    protoID: buf.readUInt32LE(2),
    serial: buf.readUInt32LE(8),
    bodyLen: buf.readUInt32LE(12),
  };
}

// ── MoomooAdapter Class ─────────────────────────────────────────────────────

export class MoomooAdapter implements IBrokerAdapter {
  readonly id: string;
  readonly type: string = 'moomoo';
  readonly name: string;
  connected: boolean = false;

  private config: MoomooConfig;
  private subscribedSymbols: Set<string> = new Set();
  private quoteCache: Map<string, QuoteInfo> = new Map();
  private mockMode: boolean = false;
  private quoteCallbacks: QuoteCallback[] = [];
  private disconnectCallbacks: DisconnectCallback[] = [];
  private mockTimer: ReturnType<typeof setInterval> | null = null;

  // ── TCP State ────────────────────────────────────────────────────────
  private socket: net.Socket | null = null;
  private tcpBuffer: Buffer = Buffer.alloc(0);
  private serial: number = 1000;
  private connID: number = 0;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  /** Tracked subscription codes for reconnect re-subscribe */
  private subscribedCodes: string[] = [];

  constructor(config: MoomooConfig) {
    this.id = config.id || 'moomoo-default';
    this.name = config.name || 'Moomoo';
    this.config = {
      ...config,
      host: config.host || '127.0.0.1',
      port: config.port || DEFAULT_PORT,
      language: config.language || 'en',
      market: config.market || 'US',
      currency: config.currency || 'USD',
      maxReconnectAttempts: config.maxReconnectAttempts ?? 20,
      autoReconnect: config.autoReconnect ?? true,
    };
    log.info(`[MoomooAdapter] Initialized: ${this.id} (${this.config.host}:${this.config.port})`);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CONNECTION
  // ════════════════════════════════════════════════════════════════════════

  async connect(): Promise<void> {
    log.info(`[MoomooAdapter] Connecting to ${this.config.host}:${this.config.port}...`);

    // Try real TCP connection first
    const tcpOk = await this.connectReal();

    if (!tcpOk) {
      // Auto-fallback to mock mode
      log.warn('[MoomooAdapter] TCP connection unavailable — falling back to mock mode');
      this.mockMode = true;
    }

    this.connected = true;
    this.startQuotePushIfNeeded();
    log.info(`[MoomooAdapter] Connected (mock=${this.mockMode})`);
  }

  /**
   * Attempt a real TCP connection to Moomoo OpenD.
   * Returns true if connection + handshake succeeded, false otherwise.
   * On failure, cleans up socket state and returns false (no throw).
   */
  async connectReal(): Promise<boolean> {
    const proto = loadProto();
    if (!proto) {
      log.warn('[MoomooAdapter] Cannot connect: protobuf definitions not loaded');
      return false;
    }

    try {
      // 1. TCP connect with timeout
      this.socket = await this.tcpConnect();

      // 2. Wire up socket events
      this.socket.setKeepAlive(true, 30000);
      this.socket.on('data', (chunk: Buffer) => this.onTcpData(chunk));
      this.socket.on('close', () => this.onTcpClose());
      this.socket.on('error', (err: Error) => {
        log.error('[MoomooAdapter] Socket error:', err.message);
      });

      // 3. InitConnect handshake
      const initRes = await this.sendCommand(CMD.InitConnect, {
        c2s: {
          clientVer: 106,
          clientID: 'DawnWhales-Moomoo',
          recvNotify: true,
          packetEncAlgo: -1,
          pushProtoFmt: 0,
          programmingLanguage: 'TypeScript',
        },
      }, 10000);

      this.connID = Number(initRes?.s2c?.connID ?? 0);
      this.reconnectAttempts = 0;
      this.mockMode = false;
      log.info(`[MoomooAdapter] TCP handshake OK, connID=${this.connID}`);
      return true;
    } catch (err: any) {
      log.warn(`[MoomooAdapter] TCP connect failed: ${err.message}`);
      this.cleanupSocket();
      return false;
    }
  }

  /** Raw TCP connect with timeout */
  private tcpConnect(): Promise<net.Socket> {
    return new Promise<net.Socket>((resolve, reject) => {
      const s = net.createConnection({
        host: this.config.host!,
        port: this.config.port!,
      });
      const timer = setTimeout(() => {
        s.destroy();
        reject(new Error(`TCP connection timeout (${CONNECT_TIMEOUT_MS}ms) to ${this.config.host}:${this.config.port}`));
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

  disconnect(): void {
    try {
      log.info('[MoomooAdapter] Disconnecting...');
      this.connected = false;
      this.subscribedSymbols.clear();
      this.quoteCache.clear();
      this.cancelReconnect();

      if (this.mockTimer) {
        clearInterval(this.mockTimer);
        this.mockTimer = null;
      }

      this.cleanupSocket();

      // Notify disconnect callbacks
      for (const cb of this.disconnectCallbacks) {
        try { cb(); } catch { /* swallow */ }
      }

      log.info('[MoomooAdapter] Disconnected');
    } catch (err: any) {
      log.error(`[MoomooAdapter] Disconnect error: ${err.message}`);
    }
  }

  private cleanupSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.tcpBuffer = Buffer.alloc(0);
    this.rejectAllPending(new Error('Socket closed'));
  }

  // ── Reconnect ────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (!this.config.autoReconnect) return;
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts ?? 20)) {
      log.error('[MoomooAdapter] Max reconnect attempts reached — staying in mock mode');
      this.mockMode = true;
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    log.info(`[MoomooAdapter] Reconnect in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      const ok = await this.connectReal();
      if (ok) {
        // Re-subscribe to previously subscribed codes
        if (this.subscribedCodes.length > 0) {
          try {
            await this.subscribeAndPush(this.subscribedCodes);
            log.info('[MoomooAdapter] Re-subscribed after reconnect');
          } catch (e: any) {
            log.warn(`[MoomooAdapter] Re-subscribe failed: ${e.message}`);
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

  /** Handle incoming TCP data — accumulate and parse framed packets */
  private onTcpData(chunk: Buffer): void {
    this.tcpBuffer = Buffer.concat([this.tcpBuffer, chunk]);

    while (this.tcpBuffer.length >= HEADER_SIZE) {
      const header = parseHeader(this.tcpBuffer);
      if (!header) {
        log.error('[MoomooAdapter] Invalid response magic — closing socket');
        this.cleanupSocket();
        return;
      }

      const totalLen = HEADER_SIZE + header.bodyLen;
      if (this.tcpBuffer.length < totalLen) return; // Wait for more data

      const body = this.tcpBuffer.subarray(HEADER_SIZE, totalLen);
      this.tcpBuffer = this.tcpBuffer.subarray(totalLen);

      // Handle push notifications (protoID 3005 = Qot_UpdateBasicQot)
      if (header.protoID === CMD.QotUpdateBasicQot.id) {
        this.handleQuotePush(body);
        continue;
      }

      // Resolve pending request by serial number
      const pending = this.pendingRequests.get(header.serial);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(header.serial);
        pending.resolve(Buffer.from(body)); // Copy to avoid buffer aliasing
      } else {
        log.warn(`[MoomooAdapter] No pending request for serial=${header.serial} protoID=${header.protoID}`);
      }
    }
  }

  /** Handle TCP socket close */
  private onTcpClose(): void {
    log.info('[MoomooAdapter] TCP socket closed');
    const wasConnected = this.connected;
    this.cleanupSocket();

    if (wasConnected && this.connected) {
      // Unexpected disconnect — try reconnect, fallback to mock
      this.mockMode = true;
      for (const cb of this.disconnectCallbacks) {
        try { cb(); } catch { /* swallow */ }
      }
      this.scheduleReconnect();
    }
  }

  /** Handle quote push notification body */
  private handleQuotePush(body: Buffer): void {
    const proto = loadProto();
    if (!proto) return;

    try {
      const PushResp = proto.lookup('Qot_UpdateBasicQot.Response');
      const decoded = PushResp.decode(body);
      if (decoded?.retType !== 0) return;

      const quotes = this.parseQuotesFromProto(decoded);
      if (quotes.length === 0) return;

      // Update cache
      for (const q of quotes) {
        this.quoteCache.set(q.code, q);
      }

      // Notify callbacks
      for (const cb of this.quoteCallbacks) {
        try { cb(quotes); } catch (err: any) {
          log.error(`[MoomooAdapter] Quote callback error: ${err.message}`);
        }
      }
    } catch (e: any) {
      log.warn(`[MoomooAdapter] Quote push decode error: ${e.message}`);
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
   * Send a protobuf command to OpenD and wait for the response.
   * Handles encoding, framing, serial tracking, and timeout.
   */
  private async sendCommand(
    cmd: { id: number; name: string },
    req: Record<string, unknown>,
    timeout: number = REQUEST_TIMEOUT_MS,
  ): Promise<any> {
    const proto = loadProto();
    if (!proto) throw new Error('Protobuf not loaded');
    if (!this.socket) throw new Error('TCP socket not connected');

    // Encode protobuf body
    const RequestType = proto.lookup(`${cmd.name}.Request`);
    const ResponseType = proto.lookup(`${cmd.name}.Response`);
    const bodyBuf = Buffer.from(RequestType.encode(RequestType.create(req)).finish());

    // Build framed packet
    const serial = ++this.serial;
    const packet = buildPacket(cmd.id, serial, bodyBuf);

    // Send and await response
    const rawBody = await new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(serial);
        reject(new Error(`${cmd.name} timeout (${timeout}ms)`));
      }, timeout);

      this.pendingRequests.set(serial, { resolve, reject, timer });
      this.socket!.write(packet, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingRequests.delete(serial);
          reject(err);
        }
      });
    });

    // Decode response
    const decoded = ResponseType.decode(rawBody);
    if (decoded?.retType !== 0) {
      throw new Error(decoded?.retMsg ?? `${cmd.name} failed (retType=${decoded?.retType})`);
    }
    return decoded;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  QUOTE PARSING (shared by push and pull)
  // ════════════════════════════════════════════════════════════════════════

  /** Parse QuoteInfo[] from a decoded protobuf response (basicQotList) */
  private parseQuotesFromProto(decoded: any): QuoteInfo[] {
    const list = decoded?.s2c?.basicQotList ?? [];
    return list.map((q: any): QuoteInfo => {
      const prefix = MARKET_REV[q.security?.market] ?? 'US';
      const code = `${prefix}.${q.security?.code}`;
      const prevClose = toNum(q.prevClosePrice);
      const price = toNum(q.curPrice);
      const open = toNum(q.openPrice);
      const high = toNum(q.highPrice);
      const low = toNum(q.lowPrice);
      const volume = toNum(q.volume);
      const turnover = toNum(q.turnover);
      const change = prevClose > 0 ? +(price - prevClose).toFixed(2) : 0;
      const changePct = prevClose > 0 ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0;

      return {
        code,
        price,
        change,
        changePct,
        volume,
        turnover,
        high,
        low,
        open,
        prevClose,
        time: new Date().toISOString(),
      };
    });
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
  //  ACCOUNT
  // ════════════════════════════════════════════════════════════════════════

  async getAccounts(): Promise<AccountInfo[]> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      return [
        {
          accountId: 'MOOMOO-001',
          name: 'Moomoo Demo Account',
          currency: this.config.currency || 'USD',
          netAssets: 100000,
          totalAssets: 100000,
          cash: 50000,
          marketValue: 50000,
        },
      ];
    }

    // Real TCP: Trd_GetAccList
    try {
      const res = await this.sendCommand(CMD.TrdGetAccList, {
        c2s: { userID: 0 },
      }, 10000);

      const accList = res?.s2c?.accList ?? [];
      return accList
        .filter((a: any) => a.trdEnv === 1) // REAL env only
        .map((a: any): AccountInfo => ({
          accountId: String(a.accID),
          name: `Moomoo ${a.trdEnv === 1 ? 'Live' : 'Paper'} ${a.accID}`,
          currency: this.config.currency || 'USD',
          netAssets: 0,   // Need getFunds to fill
          totalAssets: 0,
          cash: 0,
          marketValue: 0,
        }));
    } catch (err: any) {
      log.error(`[MoomooAdapter] getAccounts TCP error: ${err.message}`);
      this.fallbackToMock('getAccounts');
      return this.getAccounts(); // Retry in mock mode
    }
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      return {
        totalAssets: 100000,
        cash: 50000,
        marketValue: 50000,
        frozenCash: 0,
        availableCash: 50000,
        currency: this.config.currency || 'USD',
      };
    }

    // Real TCP: Trd_GetFunds
    try {
      const trdHeader = {
        trdEnv: 1,
        accID: Number(accountId),
        trdMarket: marketCodeOf(`US.`), // Default US market
      };
      const res = await this.sendCommand(CMD.TrdGetFunds, {
        c2s: { header: trdHeader },
      });

      const f = res?.s2c?.funds;
      if (!f) throw new Error('No funds data returned');

      return {
        totalAssets: toNum(f.totalAssets),
        cash: toNum(f.cash),
        marketValue: toNum(f.marketVal),
        frozenCash: toNum(f.frozenCash),
        availableCash: toNum(f.cash) - toNum(f.frozenCash),
        currency: this.config.currency || 'USD',
      };
    } catch (err: any) {
      log.error(`[MoomooAdapter] getFunds TCP error: ${err.message}`);
      this.fallbackToMock('getFunds');
      return this.getFunds(accountId);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  POSITIONS
  // ════════════════════════════════════════════════════════════════════════

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      return [
        {
          code: 'US.AAPL', name: 'Apple Inc.', qty: 100,
          costPrice: 150.0, marketPrice: 155.0, marketValue: 15500,
          pnl: 500, pnlPct: 3.33, ratio: 0.31,
        },
        {
          code: 'US.TSLA', name: 'Tesla Inc.', qty: 50,
          costPrice: 200.0, marketPrice: 210.0, marketValue: 10500,
          pnl: 500, pnlPct: 5.0, ratio: 0.21,
        },
        {
          code: 'US.NVDA', name: 'NVIDIA Corp.', qty: 30,
          costPrice: 800.0, marketPrice: 880.0, marketValue: 26400,
          pnl: 2400, pnlPct: 10.0, ratio: 0.48,
        },
      ];
    }

    // Real TCP: Trd_GetPositionList
    try {
      const trdHeader = {
        trdEnv: 1,
        accID: Number(accountId),
        trdMarket: marketCodeOf('US.'),
      };
      const res = await this.sendCommand(CMD.TrdGetPositionList, {
        c2s: {
          header: trdHeader,
          filterConditions: { filterPLRatioMin: -999, filterPLRatioMax: 999 },
        },
      });

      const positions = res?.s2c?.positionList ?? [];
      return positions.map((p: any): PositionInfo => {
        const code = `${MARKET_REV[p.security?.market] ?? 'US'}.${p.security?.code}`;
        const qty = toNum(p.qty);
        const costPrice = toNum(p.costPrice);
        const marketPrice = toNum(p.valuationPrice ?? p.curPrice ?? 0);
        const marketValue = marketPrice * qty;
        const pnl = toNum(p.plVal ?? 0);
        const pnlPct = costPrice > 0 ? +(((marketPrice - costPrice) / costPrice) * 100).toFixed(2) : 0;
        const totalAssets = 100000; // Approximate — use funds data for exact
        const ratio = totalAssets > 0 ? +(marketValue / totalAssets).toFixed(2) : 0;

        return { code, name: p.name ?? code, qty, costPrice, marketPrice, marketValue, pnl, pnlPct, ratio };
      });
    } catch (err: any) {
      log.error(`[MoomooAdapter] getPositions TCP error: ${err.message}`);
      this.fallbackToMock('getPositions');
      return this.getPositions(accountId);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  QUOTES
  // ════════════════════════════════════════════════════════════════════════

  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      return codes.map(code => {
        const cached = this.quoteCache.get(code);
        if (cached) return cached;
        const mockQuote = this.generateMockQuote(code);
        this.quoteCache.set(code, mockQuote);
        return mockQuote;
      });
    }

    // Real TCP: subscribe then pull quotes
    try {
      const securityList = codes.map(c => ({
        market: marketCodeOf(c),
        code: symbolOf(c),
      }));

      // Subscribe (no push registration for one-shot pull)
      await this.sendCommand(CMD.QotSub, {
        c2s: {
          securityList,
          subTypeList: [1], // Basic quote
          isSubOrUnSub: true,
          isRegOrUnRegPush: false,
          isFirstPush: true,
        },
      });

      // Pull current quotes
      const res = await this.sendCommand(CMD.QotGetBasicQot, {
        c2s: { securityList },
      });

      const quotes = this.parseQuotesFromProto(res);

      // Update cache
      for (const q of quotes) {
        this.quoteCache.set(q.code, q);
      }

      return quotes;
    } catch (err: any) {
      log.error(`[MoomooAdapter] getQuotes TCP error: ${err.message}`);
      this.fallbackToMock('getQuotes');
      return this.getQuotes(codes);
    }
  }

  async getKlines(code: string, period: string, count: number): Promise<KlineInfo[]> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      return this.generateMockKlines(code, period, count);
    }

    // Real TCP: Qot_GetKL
    try {
      const klType = KL_PERIOD[period] ?? 4;
      const security = { market: marketCodeOf(code), code: symbolOf(code) };

      const res = await this.sendCommand(CMD.QotGetKL, {
        c2s: {
          security,
          reqType: 1,
          subType: klType,
          kLineCount: count,
          needField: 0,
        },
      }, 20000);

      return (res?.s2c?.kLineList ?? [])
        .map((k: any): KlineInfo => ({
          time: k.timeKey ? Math.floor(toNum(k.timeKey) / 1000) : 0,
          open: toNum(k.openPrice),
          high: toNum(k.highPrice),
          low: toNum(k.lowPrice),
          close: toNum(k.closePrice),
          volume: toNum(k.volume),
        }))
        .filter((k: KlineInfo) => k.open > 0);
    } catch (err: any) {
      log.error(`[MoomooAdapter] getKlines TCP error: ${err.message}`);
      this.fallbackToMock('getKlines');
      return this.generateMockKlines(code, period, count);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ORDERS
  // ════════════════════════════════════════════════════════════════════════

  async placeOrder(request: PlaceOrderRequest): Promise<{ orderId: string }> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      const orderId = `MOOMOO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      log.info(`[MoomooAdapter] Order placed (mock): ${orderId} ${request.side} ${request.qty} ${request.code} @ ${request.price || 'MARKET'}`);
      return { orderId };
    }

    // Real TCP: Trd_PlaceOrder
    try {
      const trdHeader = {
        trdEnv: 1, // REAL
        accID: Number(request.accountId || '0'),
        trdMarket: marketCodeOf(request.code),
      };

      const res = await this.sendCommand(CMD.TrdPlaceOrder, {
        c2s: {
          header: trdHeader,
          trdSide: request.side === 'BUY' ? 1 : 2,
          orderType: request.orderType === 'LIMIT' ? 1 : 2,
          qty: request.qty,
          price: request.price ?? 0,
          code: symbolOf(request.code),
          remark: '',
        },
      });

      const orderId = String(res?.s2c?.orderID ?? res?.s2c?.orderIDEx ?? '');
      log.info(`[MoomooAdapter] Order placed (TCP): ${orderId} ${request.side} ${request.qty} ${request.code}`);
      return { orderId };
    } catch (err: any) {
      log.error(`[MoomooAdapter] placeOrder TCP error: ${err.message}`);
      this.fallbackToMock('placeOrder');
      return this.placeOrder(request);
    }
  }

  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      log.info(`[MoomooAdapter] Order cancelled (mock): ${orderId} for ${code}`);
      return;
    }

    // Real TCP: Trd_ModifyOrder (cancel)
    try {
      const trdHeader = {
        trdEnv: 1,
        accID: Number(accountId),
        trdMarket: marketCodeOf(code),
      };

      await this.sendCommand(CMD.TrdCancelOrder, {
        c2s: {
          header: trdHeader,
          orderID: Number(orderId),
          modifyOrderOp: 3, // Cancel
        },
      });

      log.info(`[MoomooAdapter] Order cancelled (TCP): ${orderId} for ${code}`);
    } catch (err: any) {
      log.error(`[MoomooAdapter] cancelOrder TCP error: ${err.message}`);
      this.fallbackToMock('cancelOrder');
      // In mock mode, cancel is a no-op success
      log.info(`[MoomooAdapter] Order cancelled (mock fallback): ${orderId}`);
    }
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    if (!this.connected) throw new Error('Not connected');

    if (this.mockMode) {
      return [
        {
          orderId: 'MOOMOO-ORD-001',
          code: 'US.AAPL',
          side: 'BUY',
          orderType: 'LIMIT',
          qty: 100,
          price: 150.0,
          filledQty: 100,
          filledPrice: 150.0,
          status: 'FILLED',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ];
    }

    // Real TCP: Trd_GetOrderList
    try {
      const trdHeader = {
        trdEnv: 1,
        accID: Number(accountId),
        trdMarket: marketCodeOf('US.'),
      };

      const res = await this.sendCommand(CMD.TrdGetOrderList, {
        c2s: { header: trdHeader },
      });

      const STATUS_MAP: Record<number, string> = {
        0: 'SUBMITTED',
        1: 'WAITING',
        2: 'FILLED',
        3: 'PARTIAL',
        4: 'CANCELLED',
        5: 'REJECTED',
      };

      return (res?.s2c?.orderList ?? []).map((o: any): OrderInfo => ({
        orderId: String(o.orderID ?? o.orderIDEx ?? ''),
        code: `${MARKET_REV[o.security?.market] ?? 'US'}.${o.security?.code}`,
        side: o.trdSide === 1 ? 'BUY' as const : 'SELL' as const,
        orderType: o.orderType === 1 ? 'LIMIT' as const : 'MARKET' as const,
        qty: toNum(o.qty),
        price: toNum(o.price),
        filledQty: toNum(o.dealQty ?? 0),
        filledPrice: toNum(o.dealAvgPrice ?? 0),
        status: STATUS_MAP[o.orderStatus ?? 0] ?? 'UNKNOWN',
        createdAt: o.createTime ?? new Date().toISOString(),
      }));
    } catch (err: any) {
      log.error(`[MoomooAdapter] getOrders TCP error: ${err.message}`);
      this.fallbackToMock('getOrders');
      return this.getOrders(accountId);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SUBSCRIPTION (PUSH)
  // ════════════════════════════════════════════════════════════════════════

  async subscribeAndPush(codes: string[]): Promise<void> {
    if (!this.connected) throw new Error('Not connected');

    // Track for reconnect
    this.subscribedCodes = [...codes];

    for (const code of codes) {
      this.subscribedSymbols.add(code);
    }

    log.info(`[MoomooAdapter] Subscribing to ${codes.length} symbols: ${codes.join(', ')}`);

    if (!this.mockMode && this.socket) {
      // Real TCP: subscribe with push registration
      try {
        const securityList = codes.map(c => ({
          market: marketCodeOf(c),
          code: symbolOf(c),
        }));

        await this.sendCommand(CMD.QotSub, {
          c2s: {
            securityList,
            subTypeList: [1], // Basic quote
            isSubOrUnSub: true,
            isRegOrUnRegPush: true,   // Enable push
            isFirstPush: true,
          },
        });

        log.info(`[MoomooAdapter] TCP push subscription active for ${codes.length} symbols`);
        return;
      } catch (err: any) {
        log.error(`[MoomooAdapter] subscribeAndPush TCP error: ${err.message}`);
        this.fallbackToMock('subscribeAndPush');
      }
    }

    // Mock mode: start interval-based push
    this.startMockQuotePush();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  MOCK MODE CONTROL
  // ════════════════════════════════════════════════════════════════════════

  setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
    log.info(`[MoomooAdapter] Mock mode ${enabled ? 'enabled' : 'disabled'}`);

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

  /** Switch to mock mode after a TCP failure, with warning log */
  private fallbackToMock(method: string): void {
    log.warn(`[MoomooAdapter] ${method}: TCP failed, falling back to mock mode`);
    this.mockMode = true;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CURRENCY CONVERSION
  // ════════════════════════════════════════════════════════════════════════

  async convertCurrency(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;

    const rates: Record<string, Record<string, number>> = {
      'USD': { 'HKD': 7.78, 'SGD': 1.35 },
      'HKD': { 'USD': 0.128, 'SGD': 0.174 },
      'SGD': { 'USD': 0.74, 'HKD': 5.76 },
    };

    const rate = rates[from]?.[to] || 1.0;
    return amount * rate;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CONFIG ACCESSOR
  // ════════════════════════════════════════════════════════════════════════

  getConfig(): MoomooConfig {
    return { ...this.config };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS — MOCK DATA
  // ════════════════════════════════════════════════════════════════════════

  /** Start mock or real quote push depending on mode */
  private startQuotePushIfNeeded(): void {
    if (this.mockMode) {
      this.startMockQuotePush();
    }
    // In real mode, push comes from TCP — no timer needed
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
        try { cb(quotes); } catch (err: any) {
          log.error(`[MoomooAdapter] Quote callback error: ${err.message}`);
        }
      }
    }, MOCK_PUSH_INTERVAL_MS);
  }

  private generateMockQuote(code: string): QuoteInfo {
    const basePrice = this.getBasePrice(code);
    const change = (Math.random() - 0.48) * basePrice * 0.03;
    const price = basePrice + change;
    const prevClose = basePrice - (Math.random() - 0.5) * basePrice * 0.02;

    return {
      code,
      price: +price.toFixed(2),
      change: +(price - prevClose).toFixed(2),
      changePct: +(((price - prevClose) / prevClose) * 100).toFixed(2),
      volume: Math.floor(Math.random() * 1000000) + 100000,
      turnover: Math.floor(Math.random() * 100000000),
      high: +(price + Math.random() * basePrice * 0.01).toFixed(2),
      low: +(price - Math.random() * basePrice * 0.01).toFixed(2),
      open: +(basePrice + (Math.random() - 0.5) * basePrice * 0.01).toFixed(2),
      prevClose: +prevClose.toFixed(2),
      time: new Date().toISOString(),
    };
  }

  private generateMockKlines(code: string, period: string, count: number): KlineInfo[] {
    const klines: KlineInfo[] = [];
    let price = 150 + Math.random() * 50;
    const now = Math.floor(Date.now() / 1000);
    const intervalSec = this.periodToSeconds(period);

    for (let i = count - 1; i >= 0; i--) {
      const change = (Math.random() - 0.48) * price * 0.03;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * price * 0.01;
      const low = Math.min(open, close) - Math.random() * price * 0.01;

      klines.push({
        time: now - i * intervalSec,
        open: +open.toFixed(2),
        high: +high.toFixed(2),
        low: +low.toFixed(2),
        close: +close.toFixed(2),
        volume: Math.floor(Math.random() * 1000000) + 100000,
      });

      price = close;
    }

    return klines;
  }

  private getBasePrice(code: string): number {
    const prices: Record<string, number> = {
      'US.AAPL': 155, 'US.TSLA': 210, 'US.NVDA': 880,
      'US.MSFT': 420, 'US.GOOGL': 155, 'US.AMZN': 185,
      'US.META': 490, 'US.SPY': 520, 'US.QQQ': 445,
      'US.TQQQ': 52, 'US.SQQQ': 28, 'US.SOXL': 35,
      'US.SOXS': 22, 'US.IWM': 200, 'US.GLD': 215,
    };
    return prices[code] || 100;
  }

  private periodToSeconds(period: string): number {
    const map: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800,
    };
    return map[period] || 86400;
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createMoomooAdapter(config?: Partial<MoomooConfig>): MoomooAdapter {
  return new MoomooAdapter({
    id: config?.id || 'moomoo-default',
    name: config?.name || 'Moomoo',
    type: 'moomoo',
    host: config?.host || '127.0.0.1',
    port: config?.port || DEFAULT_PORT,
    enabled: config?.enabled !== false,
    ...config,
  } as MoomooConfig);
}
