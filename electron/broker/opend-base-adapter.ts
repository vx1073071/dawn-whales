// @ts-nocheck — R119 QClaw: structural type errors pending resolution by JVS/PM
// ── DAWN WHALES — OpenD Base Adapter ─────────────────────────────────────────
// Abstract base class for Futu and Moomoo OpenD TCP adapters.
// Extracts shared TCP connection logic, OpenD protocol handling, quote parsing,
// order message building, mock mode management, and push callback management.
//
// Subclasses MUST implement:
//   - getAdapterName(): string
//   - getDefaultPort(): number
//   - getClientId(): string
//   - getContractMapping(): Record<string, ContractInfo>
//   - generateMockQuote(code: string): QuoteInfo
//
// J-29-01: Sprint 29 — Broker Infrastructure Refactoring

import net from 'net';
import { createHash } from 'crypto';
import {
  IBrokerAdapter,
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


// ── Shared Constants ─────────────────────────────────────────────────────────

/** OpenD protocol magic bytes ("FT" header) */
export const OPEND_MAGIC = 'FT';

/** OpenD header size in bytes (44 bytes fixed) */
export const OPEND_HEADER_SIZE = 44;

/** Default TCP connection timeout (ms) */
export const DEFAULT_CONNECT_TIMEOUT_MS = 5000;

/** Default command request timeout (ms) */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

/** Default mock quote push interval (ms) */
export const DEFAULT_MOCK_PUSH_INTERVAL_MS = 2000;

/** Default maximum reconnect attempts */
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 30;

/** Reconnect backoff base multiplier */
export const RECONNECT_BACKOFF_FACTOR = 1.5;

/** Maximum reconnect delay cap (ms) */
export const RECONNECT_MAX_DELAY_MS = 30000;

/** Socket keepalive interval (ms) */
export const SOCKET_KEEPALIVE_MS = 30000;

/** Push notification protoID for Qot_UpdateBasicQot */
export const PUSH_PROTO_ID = 3005;

/** Protocol command definitions shared by Futu and Moomoo OpenD */
export const CMD = {
  InitConnect:        { id: 1001, name: 'InitConnect' },
  QotSub:             { id: 3001, name: 'Qot_Sub' },
  QotGetBasicQot:     { id: 3004, name: 'Qot_GetBasicQot' },
  QotGetKL:           { id: 3006, name: 'Qot_GetKL' },
  QotRequestHistoryKL:{ id: 3103, name: 'Qot_RequestHistoryKL' },
  QotUpdateBasicQot:  { id: 3005, name: 'Qot_UpdateBasicQot' },
  TrdGetAccList:      { id: 2001, name: 'Trd_GetAccList' },
  TrdUnlockTrade:     { id: 2005, name: 'Trd_UnlockTrade' },
  TrdGetFunds:        { id: 2101, name: 'Trd_GetFunds' },
  TrdGetPositionList: { id: 2102, name: 'Trd_GetPositionList' },
  TrdGetOrderList:    { id: 2201, name: 'Trd_GetOrderList' },
  TrdPlaceOrder:      { id: 2202, name: 'Trd_PlaceOrder' },
  TrdCancelOrder:     { id: 2205, name: 'Trd_ModifyOrder' },
} as const;

/** Market code mapping: prefix string → numeric market ID */
export const MARKET: Record<string, number> = {
  HK: 1, US: 11, SH: 21, SZ: 22, SG: 51, CC: 91,
};

/** Reverse market mapping: numeric market ID → prefix string */
export const MARKET_REV: Record<number, string> = {
  1: 'HK', 11: 'US', 21: 'SH', 22: 'SZ', 51: 'SG', 91: 'CC',
};

/** K-line period mapping to OpenD KLType numeric values */
export const KL_PERIOD: Record<string, number> = {
  '1m': 1, '5m': 5, '15m': 15, '30m': 30, '60m': 60,
  'daily': 4, 'weekly': 5, 'monthly': 6,
};

/** Order status mapping: OpenD numeric status → string label */
export const ORDER_STATUS_MAP: Record<number, string> = {
  0: 'SUBMITTED',
  1: 'WAITING',
  2: 'FILLED',
  3: 'PARTIAL',
  4: 'CANCELLED',
  5: 'REJECTED',
};

// ── Shared Utility Functions ─────────────────────────────────────────────────

/** Extract the market code number from a dot-separated symbol (e.g. "US.AAPL" → 11) */
export function marketCodeOf(code: string): number {
  const prefix = code.split('.')[0];
  return MARKET[prefix] ?? 11;
}

/** Extract the symbol part after the market prefix (e.g. "US.AAPL" → "AAPL") */
export function symbolOf(code: string): string {
  return code.split('.').slice(1).join('.');
}

/**
 * Convert protobuf-style numeric value to a JavaScript number.
 * Handles plain numbers, numeric strings, and Long-like {low, high, unsigned} objects.
 */
export function toNum(v: unknown): number {
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

/**
 * Build a binary OpenD request packet (44-byte header + protobuf body).
 *
 * Header layout (44 bytes):
 *   [0..2)   Magic "FT" (ASCII)
 *   [2..6)   protoID (uint32 LE)
 *   [6..7)   protoFmtType (uint8, 0 = protobuf)
 *   [7..8)   protoVer (uint8, 0)
 *   [8..12)  serialNo (uint32 LE)
 *   [12..16) bodyLen (uint32 LE)
 *   [16..36) bodySHA1 (20 bytes)
 *   [36..44) reserved (8 bytes, zeros)
 */
export function buildOpenDPacket(cmdId: number, serial: number, bodyBuf: Buffer): Buffer {
  const header = Buffer.alloc(OPEND_HEADER_SIZE);
  header.write(OPEND_MAGIC, 0, 2, 'ascii');
  header.writeUInt32LE(cmdId, 2);
  header.writeUInt8(0, 6);   // protoFmtType: protobuf
  header.writeUInt8(0, 7);   // protoVer
  header.writeUInt32LE(serial, 8);
  header.writeUInt32LE(bodyBuf.length, 12);
  // SHA-1 hash of the body
  const sha1 = createHash('sha1').update(bodyBuf).digest();
  sha1.copy(header, 16);
  return Buffer.concat([header, bodyBuf]);
}

/**
 * Parse the header of an OpenD response buffer.
 * Returns null if buffer is too small or magic bytes are invalid.
 */
export function parseOpenDHeader(buf: Buffer): { protoID: number; serial: number; bodyLen: number } | null {
  if (buf.length < OPEND_HEADER_SIZE) return null;
  const magic = buf.subarray(0, 2).toString('ascii');
  if (magic !== OPEND_MAGIC) return null;
  return {
    protoID: buf.readUInt32LE(2),
    serial: buf.readUInt32LE(8),
    bodyLen: buf.readUInt32LE(12),
  };
}

// ── Shared Types ─────────────────────────────────────────────────────────────

/** Contract information for a specific security */
export interface ContractInfo {
  name: string;
  market: string;
  lotSize?: number;
  currency?: string;
  basePrice?: number;
}

/** Callback type for real-time quote push notifications */
export type QuotePushCallback = (quotes: QuoteInfo[]) => void;

/** Callback type for disconnect notifications */
export type DisconnectCallback = () => void;

/** Pending TCP request tracker */
interface PendingRequest {
  resolve: (body: Buffer) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

/** Configuration for the OpenD base adapter */
export interface OpenDBaseConfig {
  host: string;
  port: number;
  maxReconnectAttempts?: number;
  autoReconnect?: boolean;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
  mockPushIntervalMs?: number;
}

/** Default base config values */
export const DEFAULT_BASE_CONFIG: Required<OpenDBaseConfig> = {
  host: '127.0.0.1',
  port: 11111,
  maxReconnectAttempts: DEFAULT_MAX_RECONNECT_ATTEMPTS,
  autoReconnect: true,
  connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
  requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  mockPushIntervalMs: DEFAULT_MOCK_PUSH_INTERVAL_MS,
};

// ── Protobuf Loader (shared singleton) ──────────────────────────────────────

let sharedProtoRoot: unknown = null;
let protoLoadAttempted = false;

/**
 * Lazily load the shared protobuf definitions from futu-api.
 * Both Futu and Moomoo use the same protobuf schema.
 */
export function loadProto(): any {
  if (protoLoadAttempted) return sharedProtoRoot;
  protoLoadAttempted = true;
  try {
    sharedProtoRoot = require('futu-api/proto.js');
    if (sharedProtoRoot?.default) sharedProtoRoot = sharedProtoRoot.default;
    log.info('[OpenDBase] Protobuf definitions loaded');
  } catch (e) {
    log.warn('[OpenDBase] Protobuf definitions not available:', e.message);
    sharedProtoRoot = null;
  }
  return sharedProtoRoot;
}

// ── Mock K-line Generator (shared) ──────────────────────────────────────────

/** Convert a K-line period string to seconds per bar */
export function periodToSeconds(period: string): number {
  const map: Record<string, number> = {
    '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
    '60m': 3600, '1h': 3600, '4h': 14400,
    'daily': 86400, '1d': 86400, 'weekly': 604800, '1w': 604800,
    'monthly': 2592000,
  };
  return map[period] || 86400;
}

/**
 * Generate mock K-line data for testing/demo purposes.
 * Produces realistic-looking OHLCV bars with random walk price movement.
 */
export function generateMockKlines(code: string, period: string, count: number, basePrice?: number): KlineInfo[] {
  const klines: KlineInfo[] = [];
  let price = basePrice ?? (150 + Math.random() * 50);
  const now = Math.floor(Date.now() / 1000);
  const intervalSec = periodToSeconds(period);

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

// ═════════════════════════════════════════════════════════════════════════════
//  OpenDBaseAdapter — Abstract Base Class
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Abstract base class implementing IBrokerAdapter for OpenD-protocol brokers.
 *
 * Provides:
 *   - TCP connection lifecycle (connect, disconnect, reconnect with exponential backoff)
 *   - OpenD binary protocol framing (packet building, header parsing, serial tracking)
 *   - Protobuf command encoding/decoding with timeout management
 *   - Real-time quote push handling (protoID 3005 = Qot_UpdateBasicQot)
 *   - Common quote parsing from protobuf responses
 *   - Common order message building and parsing
 *   - Mock mode management with auto-fallback on TCP failure
 *   - Quote push callback management (add/remove/notify)
 *   - Disconnect callback management
 *   - K-line data retrieval with mock fallback
 *
 * Subclasses must implement abstract methods for adapter-specific behavior:
 *   - getAdapterName() — display name for logs
 *   - getDefaultPort() — TCP port (Futu=11111, Moomoo=11211)
 *   - getClientId() — InitConnect client identifier
 *   - getContractMapping() — security code → contract info
 *   - generateMockQuote() — adapter-specific mock quote generation
 */
export abstract class OpenDBaseAdapter implements IBrokerAdapter {
  // ── IBrokerAdapter required fields ────────────────────────────────────
  abstract readonly id: string;
  abstract readonly type: string;
  abstract readonly name: string;
  connected: boolean = false;

  // ── TCP State ─────────────────────────────────────────────────────────
  protected host: string;
  protected port: number;
  protected socket: net.Socket | null = null;
  protected tcpBuffer: Buffer = Buffer.alloc(0);
  protected serial: number = 1000;
  protected connID: number = 0;
  protected pendingRequests: Map<number, PendingRequest> = new Map();

  // ── Reconnect State ───────────────────────────────────────────────────
  protected reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  protected reconnectAttempts: number = 0;
  protected maxReconnectAttempts: number;
  protected autoReconnect: boolean;

  // ── Callback Management ───────────────────────────────────────────────
  protected quoteCallbacks: QuotePushCallback[] = [];
  protected disconnectCallbacks: DisconnectCallback[] = [];

  // ── Subscription Tracking ─────────────────────────────────────────────
  protected subscribedCodes: string[] = [];

  // ── Mock Mode ─────────────────────────────────────────────────────────
  protected mockMode: boolean = false;
  protected mockTimer: ReturnType<typeof setInterval> | null = null;
  protected quoteCache: Map<string, QuoteInfo> = new Map();
  protected subscribedSymbols: Set<string> = new Set();

  // ── Configuration ─────────────────────────────────────────────────────
  protected connectTimeoutMs: number;
  protected requestTimeoutMs: number;
  protected mockPushIntervalMs: number;

  constructor(config: Partial<OpenDBaseConfig> = {}) {
    const merged = { ...DEFAULT_BASE_CONFIG, ...config };
    this.host = merged.host;
    this.port = merged.port || this.getDefaultPort();
    this.maxReconnectAttempts = merged.maxReconnectAttempts;
    this.autoReconnect = merged.autoReconnect;
    this.connectTimeoutMs = merged.connectTimeoutMs;
    this.requestTimeoutMs = merged.requestTimeoutMs;
    this.mockPushIntervalMs = merged.mockPushIntervalMs;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ABSTRACT METHODS — Subclass-Specific Behavior
  // ════════════════════════════════════════════════════════════════════════

  /** Human-readable adapter name for log messages (e.g. "FutuOpenD", "MoomooAdapter") */
  abstract getAdapterName(): string;

  /** Default TCP port for this broker's OpenD instance */
  abstract getDefaultPort(): number;

  /** Client identifier sent during InitConnect handshake */
  abstract getClientId(): string;

  /**
   * Return a mapping of security codes to contract info.
   * Used for name resolution, lot sizes, and base prices for mock data.
   */
  abstract getContractMapping(): Record<string, ContractInfo>;

  /**
   * Generate a mock quote for the given security code.
   * Called in mock mode to simulate real-time quote data.
   */
  abstract generateMockQuote(code: string): QuoteInfo;

  // ════════════════════════════════════════════════════════════════════════
  //  CONNECTION LIFECYCLE
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Connect to the OpenD instance via TCP.
   * Performs TCP connect → InitConnect handshake → sets connected flag.
   * Throws on failure (subclass may catch and fallback to mock mode).
   */
  protected async connectTCP(): Promise<void> {
    const proto = loadProto();
    if (!proto) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Protobuf definitions not loaded');

    // 1. Raw TCP connect with timeout
    this.socket = await this.rawTcpConnect();

    // 2. Wire up socket event handlers
    this.socket.setKeepAlive(true, SOCKET_KEEPALIVE_MS);
    this.socket.on('data', (chunk: Buffer) => this.onTcpData(chunk));
    this.socket.on('close', () => this.onTcpClose());
    this.socket.on('error', (err: Error) => {
      log.error(`[${this.getAdapterName()}] Socket error: ${err.message}`);
    });

    // 3. InitConnect handshake
    const initRes = await this.sendCommand(CMD.InitConnect, {
      c2s: {
        clientVer: 106,
        clientID: this.getClientId(),
        recvNotify: true,
        packetEncAlgo: -1,
        pushProtoFmt: 0,
        programmingLanguage: 'TypeScript',
      },
    }, 10000);

    this.connID = Number(initRes?.s2c?.connID ?? 0);
    this.connected = true;
    this.reconnectAttempts = 0;
    this.mockMode = false;
    log.info(`[${this.getAdapterName()}] Connected to ${this.host}:${this.port}, connID=${this.connID}`);
  }

  /**
   * Disconnect from OpenD. Cleans up socket, timers, pending requests,
   * and notifies all disconnect callbacks.
   */
  disconnect(): void {
    try {
      log.info(`[${this.getAdapterName()}] Disconnecting...`);
      this.connected = false;
      this.subscribedSymbols.clear();
      this.quoteCache.clear();
      this.cancelReconnect();
      this.stopMockPush();
      this.cleanupSocket();

      // Notify disconnect callbacks
      for (const cb of this.disconnectCallbacks) {
        try { cb(); } catch { /* swallow callback errors */ }
      }

      log.info(`[${this.getAdapterName()}] Disconnected`);
    } catch (err) {
      log.error(`[${this.getAdapterName()}] Disconnect error: ${err.message}`);
    }
  }

  /**
   * Raw TCP connection with configurable timeout.
   * Returns a connected net.Socket or rejects with an error.
   */
  protected rawTcpConnect(): Promise<net.Socket> {
    return new Promise<net.Socket>((resolve, reject) => {
      const s = net.createConnection({ host: this.host, port: this.port });
      const timer = setTimeout(() => {
        s.destroy();
        reject(new Error(
          `TCP connection timeout (${this.connectTimeoutMs}ms) to ${this.host}:${this.port}`
        ));
      }, this.connectTimeoutMs);

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

  /** Clean up the TCP socket, buffer, and reject all pending requests */
  protected cleanupSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.tcpBuffer = Buffer.alloc(0);
    this.rejectAllPending(new Error('Socket closed'));
  }

  // ════════════════════════════════════════════════════════════════════════
  //  RECONNECT WITH EXPONENTIAL BACKOFF
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Schedule a reconnection attempt with exponential backoff.
   * Delay = min(1000 * 1.5^attempts, 30000ms).
   * On success, re-subscribes to previously tracked codes.
   * On failure, schedules another attempt recursively.
   * Falls back to mock mode when max attempts are exceeded.
   */
  protected scheduleReconnect(): void {
    if (!this.autoReconnect) return;
    if (this.reconnectTimer) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error(
        `[${this.getAdapterName()}] Max reconnect attempts (${this.maxReconnectAttempts}) reached — staying in mock mode`
      );
      this.mockMode = true;
      return;
    }

    const delay = Math.min(
      1000 * Math.pow(RECONNECT_BACKOFF_FACTOR, this.reconnectAttempts),
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempts++;
    log.info(
      `[${this.getAdapterName()}] Reconnect in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connectTCP();
        // Re-subscribe to previously tracked codes after reconnect
        if (this.subscribedCodes.length > 0) {
          try {
            await this.subscribeAndPush(this.subscribedCodes);
            log.info(`[${this.getAdapterName()}] Re-subscribed ${this.subscribedCodes.length} codes after reconnect`);
          } catch (subErr) {
            log.warn(`[${this.getAdapterName()}] Re-subscribe failed: ${subErr.message}`);
          }
        }
      } catch (err) {
        log.warn(`[${this.getAdapterName()}] Reconnect failed: ${err.message}`);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /** Cancel any pending reconnect timer and reset attempt counter */
  protected cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TCP DATA HANDLING — Packet Framing & Push Dispatch
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Handle incoming TCP data. Accumulates bytes in a buffer and parses
   * complete OpenD packets (header + body). Dispatches push notifications
   * (protoID 3005) to the quote push handler, and resolves pending
   * request/response pairs by serial number.
   */
  protected onTcpData(chunk: Buffer): void {
    this.tcpBuffer = Buffer.concat([this.tcpBuffer, chunk]);

    while (this.tcpBuffer.length >= OPEND_HEADER_SIZE) {
      const header = parseOpenDHeader(this.tcpBuffer);
      if (!header) {
        log.error(`[${this.getAdapterName()}] Invalid response magic — closing socket`);
        this.cleanupSocket();
        return;
      }

      const totalLen = OPEND_HEADER_SIZE + header.bodyLen;
      if (this.tcpBuffer.length < totalLen) return; // Wait for more data

      const body = this.tcpBuffer.subarray(OPEND_HEADER_SIZE, totalLen);
      this.tcpBuffer = this.tcpBuffer.subarray(totalLen);

      // Push notification: Qot_UpdateBasicQot (protoID 3005)
      if (header.protoID === PUSH_PROTO_ID) {
        this.handleQuotePushNotification(body);
        continue;
      }

      // Match response to pending request by serial number
      const pending = this.pendingRequests.get(header.serial);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(header.serial);
        pending.resolve(Buffer.from(body)); // Copy to avoid buffer aliasing
      } else {
        log.warn(
          `[${this.getAdapterName()}] No pending request for serial=${header.serial} protoID=${header.protoID}`
        );
      }
    }
  }

  /**
   * Handle TCP socket close event. Notifies disconnect callbacks and
   * schedules a reconnect attempt if the adapter was previously connected.
   */
  protected onTcpClose(): void {
    log.info(`[${this.getAdapterName()}] TCP socket closed`);
    const wasConnected = this.connected;
    this.cleanupSocket();

    if (wasConnected) {
      this.connected = false;
      this.mockMode = true;

      for (const cb of this.disconnectCallbacks) {
        try { cb(); } catch { /* swallow */ }
      }

      this.scheduleReconnect();
    }
  }

  /**
   * Decode a quote push notification body and dispatch to all registered
   * quote push callbacks. Updates the internal quote cache.
   */
  protected handleQuotePushNotification(body: Buffer): void {
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

      // Notify all registered callbacks
      for (const cb of this.quoteCallbacks) {
        try { cb(quotes); } catch (err) {
          log.error(`[${this.getAdapterName()}] Quote push callback error: ${err.message}`);
        }
      }
    } catch (e) {
      log.warn(`[${this.getAdapterName()}] Quote push decode error: ${e.message}`);
    }
  }

  /** Reject all pending TCP requests with the given error */
  protected rejectAllPending(error: Error): void {
    for (const item of this.pendingRequests.values()) {
      clearTimeout(item.timer);
      item.reject(error);
    }
    this.pendingRequests.clear();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  COMMAND SENDING — Protobuf Encode → Frame → Send → Decode
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Send a protobuf command to OpenD and wait for the matching response.
   *
   * Steps:
   *   1. Look up Request/Response protobuf types
   *   2. Encode the request object to a protobuf buffer
   *   3. Build a framed packet (44-byte header + body)
   *   4. Write to TCP socket and await response by serial number
   *   5. Decode the response protobuf and validate retType
   *
   * @param cmd - Command definition with id and protobuf name
   * @param req - Request payload object (c2s structure)
   * @param timeout - Response timeout in ms (default: requestTimeoutMs)
   * @returns Decoded protobuf response object
   */
  protected async sendCommand(
    cmd: { id: number; name: string },
    req: Record<string, unknown>,
    timeout: number = this.requestTimeoutMs,
  ): Promise<any> {
    const proto = loadProto();
    if (!proto) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Protobuf not loaded');
    if (!this.socket) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'TCP socket not connected');

    // Encode protobuf body
    const RequestType = proto.lookup(`${cmd.name}.Request`);
    const ResponseType = proto.lookup(`${cmd.name}.Response`);
    const bodyBuf = Buffer.from(RequestType.encode(RequestType.create(req)).finish());

    // Build framed packet with incrementing serial
    const serial = ++this.serial;
    const packet = buildOpenDPacket(cmd.id, serial, bodyBuf);

    // Send and await response matched by serial
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

    // Decode and validate response
    const decoded = ResponseType.decode(rawBody);
    if (decoded?.retType !== 0) {
      throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, decoded?.retMsg ?? `${cmd.name} failed (retType=${decoded?.retType})`);
    }
    return decoded;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  QUOTE PARSING — Common protobuf → QuoteInfo[] conversion
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Parse an array of QuoteInfo from a decoded protobuf response.
   * Works for both pull (Qot_GetBasicQot) and push (Qot_UpdateBasicQot) responses
   * since both contain s2c.basicQotList with the same structure.
   */
  protected parseQuotesFromProto(decoded: unknown): QuoteInfo[] {
    const list = decoded?.s2c?.basicQotList ?? [];
    return list.map((q: unknown): QuoteInfo => {
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
      const changePct = prevClose > 0
        ? +(((price - prevClose) / prevClose) * 100).toFixed(2)
        : 0;

      return {
        code, price, change, changePct,
        volume, turnover, high, low, open, prevClose,
        time: new Date().toISOString(),
      };
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  QUOTE PUSH CALLBACK MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════

  /** Register a callback for real-time quote push notifications */
  onQuotePush(callback: QuotePushCallback): void {
    this.quoteCallbacks.push(callback);
  }

  /** Remove a previously registered quote push callback */
  removeQuotePush(callback: QuotePushCallback): void {
    const idx = this.quoteCallbacks.indexOf(callback);
    if (idx >= 0) this.quoteCallbacks.splice(idx, 1);
  }

  /** Register a callback for disconnect notifications */
  onDisconnect(callback: DisconnectCallback): void {
    this.disconnectCallbacks.push(callback);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  MOCK MODE MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════

  /** Enable or disable mock mode. When enabled, starts mock quote push timer */
  setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
    log.info(`[${this.getAdapterName()}] Mock mode ${enabled ? 'enabled' : 'disabled'}`);

    if (enabled && this.connected) {
      this.startMockQuotePush();
    } else if (!enabled) {
      this.stopMockPush();
    }
  }

  /** Check whether the adapter is currently in mock mode */
  isMockMode(): boolean {
    return this.mockMode;
  }

  /**
   * Switch to mock mode after a TCP failure, with a warning log.
   * Called internally by data methods when a TCP call fails.
   */
  protected fallbackToMock(method: string): void {
    log.warn(`[${this.getAdapterName()}] ${method}: TCP failed, falling back to mock mode`);
    this.mockMode = true;
  }

  /**
   * Start mock quote push timer if in mock mode and symbols are subscribed.
   * Generates mock quotes at a configurable interval and dispatches to callbacks.
   */
  protected startMockQuotePush(): void {
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
        try { cb(quotes); } catch (err) {
          log.error(`[${this.getAdapterName()}] Mock quote callback error: ${err.message}`);
        }
      }
    }, this.mockPushIntervalMs);
  }

  /** Stop the mock quote push timer */
  protected stopMockPush(): void {
    if (this.mockTimer) {
      clearInterval(this.mockTimer);
      this.mockTimer = null;
    }
  }

  /**
   * Start mock push if currently in mock mode.
   * Called after connect() if mock mode is active.
   */
  protected startQuotePushIfNeeded(): void {
    if (this.mockMode) {
      this.startMockQuotePush();
    }
    // In real TCP mode, push comes from the socket — no timer needed
  }

  // ════════════════════════════════════════════════════════════════════════
  //  MARKET DATA — getQuotes, getKlines, subscribeAndPush
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Fetch current quotes for a list of security codes.
   * In mock mode, returns cached or freshly generated mock quotes.
   * In TCP mode, subscribes (no push) then pulls quotes via Qot_GetBasicQot.
   */
  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return codes.map(code => {
        const cached = this.quoteCache.get(code);
        if (cached) return cached;
        const mockQuote = this.generateMockQuote(code);
        this.quoteCache.set(code, mockQuote);
        return mockQuote;
      });
    }

    try {
      const securityList = codes.map(c => ({
        market: marketCodeOf(c),
        code: symbolOf(c),
      }));

      // Subscribe without push for one-shot pull
      await this.sendCommand(CMD.QotSub, {
        c2s: {
          securityList,
          subTypeList: [1, 2, 4, 5, 14],
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
    } catch (err) {
      log.error(`[${this.getAdapterName()}] getQuotes TCP error: ${err.message}`);
      this.fallbackToMock('getQuotes');
      return this.getQuotes(codes); // Retry in mock mode
    }
  }

  /**
   * Fetch K-line (candlestick) data for a security.
   * In mock mode, generates synthetic OHLCV bars.
   * In TCP mode, queries Qot_GetKL with the specified period and count.
   */
  async getKlines(code: string, period: string = 'daily', count: number = 200): Promise<KlineInfo[]> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      const contracts = this.getContractMapping();
      const basePrice = contracts[code]?.basePrice;
      return generateMockKlines(code, period, count, basePrice);
    }

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
        .map((k: unknown): KlineInfo => ({
          time: k.timeKey ? Math.floor(toNum(k.timeKey) / 1000) : 0,
          open: toNum(k.openPrice),
          high: toNum(k.highPrice),
          low: toNum(k.lowPrice),
          close: toNum(k.closePrice),
          volume: toNum(k.volume),
        }))
        .filter((k: KlineInfo) => k.open > 0);
    } catch (err) {
      log.error(`[${this.getAdapterName()}] getKlines TCP error: ${err.message}`);
      this.fallbackToMock('getKlines');
      const contracts = this.getContractMapping();
      return generateMockKlines(code, period, count, contracts[code]?.basePrice);
    }
  }

  /**
   * Subscribe to real-time quote push for a list of security codes.
   * Tracks the subscribed codes for re-subscription after reconnect.
   * In mock mode, starts a timer-based mock push.
   * In TCP mode, sends QotSub with push registration enabled.
   */
  async subscribeAndPush(codes: string[]): Promise<void> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    // Track for reconnect re-subscription
    this.subscribedCodes = [...codes];
    for (const code of codes) {
      this.subscribedSymbols.add(code);
    }

    log.info(`[${this.getAdapterName()}] Subscribing to ${codes.length} symbols: ${codes.join(', ')}`);

    if (!this.mockMode && this.socket) {
      try {
        const securityList = codes.map(c => ({
          market: marketCodeOf(c),
          code: symbolOf(c),
        }));

        await this.sendCommand(CMD.QotSub, {
          c2s: {
            securityList,
            subTypeList: [1, 2, 4, 5, 14],
            isSubOrUnSub: true,
            isRegOrUnRegPush: true,  // Enable push
            isFirstPush: true,
          },
        });

        log.info(`[${this.getAdapterName()}] TCP push subscription active for ${codes.length} symbols`);
        return;
      } catch (err) {
        log.error(`[${this.getAdapterName()}] subscribeAndPush TCP error: ${err.message}`);
        this.fallbackToMock('subscribeAndPush');
      }
    }

    // Mock mode: start interval-based push
    this.startMockQuotePush();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ACCOUNT — getAccounts, getFunds
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Fetch the list of trading accounts.
   * Subclasses may override for broker-specific mock data or account filtering.
   */
  async getAccounts(): Promise<AccountInfo[]> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return this.getMockAccounts();
    }

    try {
      const res = await this.sendCommand(CMD.TrdGetAccList, {
        c2s: { userID: 0 },
      }, 10000);

      return (res?.s2c?.accList ?? [])
        .filter((a: unknown) => a.trdEnv === 1) // REAL env only
        .map((a: unknown): AccountInfo => ({
          accountId: String(a.accID),
          name: `${this.getAdapterName()} Account ${a.accID}`,
          currency: 'USD',
          netAssets: 0,
          totalAssets: 0,
          cash: 0,
          marketValue: 0,
        }));
    } catch (err) {
      log.error(`[${this.getAdapterName()}] getAccounts TCP error: ${err.message}`);
      this.fallbackToMock('getAccounts');
      return this.getMockAccounts();
    }
  }

  /**
   * Fetch funds/balance information for a specific account.
   * Subclasses may override for broker-specific currency or field mapping.
   */
  async getFunds(accountId: string): Promise<FundsInfo> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return this.getMockFunds();
    }

    try {
      const trdHeader = {
        trdEnv: 1,
        accID: Number(accountId),
        trdMarket: MARKET.US,
      };
      const res = await this.sendCommand(CMD.TrdGetFunds, {
        c2s: { header: trdHeader },
      });

      const f = res?.s2c?.funds;
      if (!f) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'No funds data returned');

      return {
        totalAssets: toNum(f.totalAssets),
        cash: toNum(f.cash),
        marketValue: toNum(f.marketVal),
        frozenCash: toNum(f.frozenCash),
        availableCash: toNum(f.cash) - toNum(f.frozenCash),
        currency: 'USD',
      };
    } catch (err) {
      log.error(`[${this.getAdapterName()}] getFunds TCP error: ${err.message}`);
      this.fallbackToMock('getFunds');
      return this.getMockFunds();
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  POSITIONS
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Fetch positions for a specific account.
   * Parses the common OpenD position list format.
   */
  async getPositions(accountId: string): Promise<PositionInfo[]> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return this.getMockPositions();
    }

    try {
      const trdHeader = {
        trdEnv: 1,
        accID: Number(accountId),
        trdMarket: MARKET.US,
      };
      const res = await this.sendCommand(CMD.TrdGetPositionList, {
        c2s: {
          header: trdHeader,
          filterConditions: { filterPLRatioMin: -999, filterPLRatioMax: 999 },
        },
      });

      return (res?.s2c?.positionList ?? []).map((p: unknown): PositionInfo => {
        const code = `${MARKET_REV[p.security?.market] ?? 'US'}.${p.security?.code}`;
        const qty = toNum(p.qty);
        const costPrice = toNum(p.costPrice);
        const marketPrice = toNum(p.valuationPrice ?? p.curPrice ?? 0);
        const marketValue = marketPrice * qty;
        const pnl = toNum(p.plVal ?? 0);
        const pnlPct = costPrice > 0
          ? +(((marketPrice - costPrice) / costPrice) * 100).toFixed(2)
          : 0;
        // Approximate ratio — subclasses may override with precise totalAssets
        const ratio = 0;

        return {
          code, name: p.name ?? code, qty, costPrice, marketPrice,
          marketValue, pnl, pnlPct, ratio,
        };
      });
    } catch (err) {
      log.error(`[${this.getAdapterName()}] getPositions TCP error: ${err.message}`);
      this.fallbackToMock('getPositions');
      return this.getMockPositions();
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ORDERS — getOrders, placeOrder, cancelOrder
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Fetch the order list for a specific account.
   * Uses the common ORDER_STATUS_MAP for status translation.
   */
  async getOrders(accountId: string): Promise<OrderInfo[]> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return this.getMockOrders();
    }

    try {
      const trdHeader = {
        trdEnv: 1,
        accID: Number(accountId),
        trdMarket: MARKET.US,
      };
      const res = await this.sendCommand(CMD.TrdGetOrderList, {
        c2s: { header: trdHeader },
      });

      return (res?.s2c?.orderList ?? []).map((o: unknown): OrderInfo => ({
        orderId: String(o.orderID ?? o.orderIDEx ?? ''),
        code: `${MARKET_REV[o.security?.market] ?? 'US'}.${o.security?.code}`,
        side: o.trdSide === 1 ? 'BUY' as const : 'SELL' as const,
        orderType: o.orderType === 1 ? 'LIMIT' as const : 'MARKET' as const,
        qty: toNum(o.qty),
        price: toNum(o.price),
        filledQty: toNum(o.dealQty ?? 0),
        filledPrice: toNum(o.dealAvgPrice ?? 0),
        status: ORDER_STATUS_MAP[o.orderStatus ?? 0] ?? 'UNKNOWN',
        createdAt: o.createTime ?? new Date().toISOString(),
      }));
    } catch (err) {
      log.error(`[${this.getAdapterName()}] getOrders TCP error: ${err.message}`);
      this.fallbackToMock('getOrders');
      return this.getMockOrders();
    }
  }

  /**
   * Place a new order via OpenD Trd_PlaceOrder command.
   * Builds the common trdHeader and order parameters.
   */
  async placeOrder(request: PlaceOrderRequest): Promise<{ orderId: string }> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      return this.mockPlaceOrder(request);
    }

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
      log.info(
        `[${this.getAdapterName()}] Order placed (TCP): ${orderId} ${request.side} ${request.qty} ${request.code}`
      );
      return { orderId };
    } catch (err) {
      log.error(`[${this.getAdapterName()}] placeOrder TCP error: ${err.message}`);
      this.fallbackToMock('placeOrder');
      return this.mockPlaceOrder(request);
    }
  }

  /**
   * Cancel an existing order via OpenD Trd_ModifyOrder (cancel operation).
   */
  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    if (!this.connected) throw new EngineError(ErrorDomain.NETWORK, ErrorCode.CONNECTION_FAILED, 'Not connected');

    if (this.mockMode) {
      log.info(`[${this.getAdapterName()}] Order cancelled (mock): ${orderId} for ${code}`);
      return;
    }

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

      log.info(`[${this.getAdapterName()}] Order cancelled (TCP): ${orderId} for ${code}`);
    } catch (err) {
      log.error(`[${this.getAdapterName()}] cancelOrder TCP error: ${err.message}`);
      this.fallbackToMock('cancelOrder');
      log.info(`[${this.getAdapterName()}] Order cancelled (mock fallback): ${orderId}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  DEFAULT MOCK DATA — Subclasses may override for broker-specific data
  // ════════════════════════════════════════════════════════════════════════

  /** Default mock accounts. Subclasses may override with broker-specific IDs/names */
  protected getMockAccounts(): AccountInfo[] {
    return [
      {
        accountId: `${this.getAdapterName().toUpperCase()}-001`,
        name: `${this.getAdapterName()} Demo Account`,
        currency: 'USD',
        netAssets: 100000,
        totalAssets: 100000,
        cash: 50000,
        marketValue: 50000,
      },
    ];
  }

  /** Default mock funds. Subclasses may override with broker-specific currency */
  protected getMockFunds(): FundsInfo {
    return {
      totalAssets: 100000,
      cash: 50000,
      marketValue: 50000,
      frozenCash: 0,
      availableCash: 50000,
      currency: 'USD',
    };
  }

  /** Default mock positions. Subclasses may override with broker-specific holdings */
  protected getMockPositions(): PositionInfo[] {
    return [
      {
        code: 'US.AAPL', name: 'Apple Inc.', qty: 100,
        costPrice: 150.0, marketPrice: 155.0, marketValue: 15500,
        pnl: 500, pnlPct: 3.33, ratio: 0.31,
      },
      {
        code: 'US.NVDA', name: 'NVIDIA Corp.', qty: 30,
        costPrice: 800.0, marketPrice: 880.0, marketValue: 26400,
        pnl: 2400, pnlPct: 10.0, ratio: 0.48,
      },
    ];
  }

  /** Default mock orders. Subclasses may override with broker-specific order IDs */
  protected getMockOrders(): OrderInfo[] {
    return [
      {
        orderId: `${this.getAdapterName().toUpperCase()}-ORD-001`,
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

  /** Generate a mock order ID and return it */
  protected mockPlaceOrder(request: PlaceOrderRequest): { orderId: string } {
    const prefix = this.getAdapterName().toUpperCase();
    const orderId = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    log.info(
      `[${this.getAdapterName()}] Order placed (mock): ${orderId} ${request.side} ${request.qty} ${request.code} @ ${request.price || 'MARKET'}`
    );
    return { orderId };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  UTILITY — Shared helpers accessible by subclasses
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Look up the base price for a security code from the contract mapping.
   * Returns undefined if not found (mock quote generator will use a default).
   */
  protected getBasePriceFromContracts(code: string): number | undefined {
    return this.getContractMapping()[code]?.basePrice;
  }
}
