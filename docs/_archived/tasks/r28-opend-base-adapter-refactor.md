# R28 OpenDBaseAdapter Refactoring Guide (R29 前置)

**JIRA:** J-28-03  
**Status:** Draft  
**Author:** TradingEasy Architecture  
**Created:** 2026-06-06  
**Dependencies:** R29 broker adapter unification  

---

## 1. Problem Statement

### 1.1 Current State

The `electron/broker/` directory contains three broker adapters that implement the `IBrokerAdapter`
interface defined in `IBrokerAdapter.ts`:

| File | Lines | Protocol | Description |
|------|-------|----------|-------------|
| `futu-opend.ts` | ~428 | OpenD protobuf (FT header) | Futu Securities — direct TCP client |
| `moomoo-adapter.ts` | ~1185 | OpenD protobuf (FT header) | Moomoo — same protocol, different defaults |
| `ib-adapter.ts` | ~2032 | IB native (null-delimited text) | Interactive Brokers — completely different protocol |

### 1.2 Identified Duplication

Futu and Moomoo share **near-identical** OpenD protocol logic. The following patterns are duplicated:

**A. Constants & Utility Functions (100% duplicated between Futu & Moomoo)**

```typescript
// Both adapters define these independently:
const MARKET: Record<string, number> = { HK: 1, US: 11, SH: 21, SZ: 22, CC: 91 };
const MARKET_REV: Record<number, string> = { 1: 'HK', 11: 'US', 21: 'SH', 22: 'SZ', 91: 'CC' };
const KL_PERIOD: Record<string, number> = { '1m': 1, '5m': 5, /* ... */ };

function marketCode(code: string): number { /* identical logic */ }
function symOf(code: string): string { /* identical logic */ }
function toNum(v: any): number { /* identical protobuf Long handling */ }
```

**B. TCP Connection Lifecycle (~80% duplicated)**

```typescript
// Futu:  tcpConnect → setKeepAlive → onData → scheduleReconnect → cancelReconnect
// Moomoo: tcpConnect → setKeepAlive → onTcpData → scheduleReconnect → cancelReconnect
// Both: 44-byte FT header, SHA-1 body hash, serial-numbered request/response
// Both: exponential backoff reconnect (1.5^n, max 30s, cap at N attempts)
// Both: re-subscribe after reconnect
```

**C. Quote Parsing (~90% duplicated)**

```typescript
// Both parse basicQotList from protobuf Qot_GetBasicQot / Qot_UpdateBasicQot
// Identical field mapping: curPrice, prevClosePrice, openPrice, highPrice, lowPrice, volume, turnover
// Identical change/changePct calculation
```

**D. Order Handling (~85% duplicated)**

```typescript
// Both construct trdHeader: { trdEnv, accID, trdMarket }
// Both map side: BUY→1, SELL→2
// Both map orderType: LIMIT→1, MARKET→2
// Both use the same protobuf command IDs: TrdPlaceOrder (2202), TrdCancelOrder (2205)
```

**E. Callback Management (100% duplicated)**

```typescript
// Both maintain: quoteCallbacks[], disconnectCallbacks[]
// Both implement: onQuotePush(), removeQuotePush(), onDisconnect()
// Both have mock mode with setInterval-based quote push
```

### 1.3 IB Adapter — Different Protocol

The IB adapter uses a **fundamentally different protocol**:

- **Binary framing:** null-delimited text fields vs. 44-byte FT header + protobuf
- **Handshake:** `API\0` + version range negotiation vs. InitConnect protobuf
- **Message dispatch:** msgId-based switch vs. protoID-based routing
- **Quote model:** TickPrice/TickSize event stream vs. basicQotList snapshot
- **Order model:** 45-field PlaceOrder vs. protobuf TrdPlaceOrder

**Conclusion:** IB adapter should NOT share the OpenD base class. It needs its own `IBBaseAdapter`
or remain standalone.

### 1.4 Impact of Duplication

- **Bug propagation:** A fix to quote parsing must be applied in two places
- **Feature lag:** New fields (e.g., amplitude, pe_ratio) must be added twice
- **Testing burden:** Same logic tested independently in two adapters
- **Onboarding cost:** New contributors must understand the same code twice

---

## 2. Proposed Architecture

### 2.1 Class Hierarchy

```
IBrokerAdapter (interface)
├── OpenDBaseAdapter (abstract) ← NEW
│   ├── FutuOpenDAdapter (refactored from futu-opend.ts)
│   └── MoomooAdapter (refactored from moomoo-adapter.ts)
├── IBAdapter (unchanged — different protocol)
└── FutureBrokerAdapter (e.g., Longbridge)
```

### 2.2 OpenDBaseAdapter — Abstract Base Class

```typescript
// electron/broker/opend-base-adapter.ts

import net from 'net';
import { createHash } from 'crypto';
import log from 'electron-log';
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

// ── Shared Constants ──────────────────────────────────────────────────────

export const OPEND_MAGIC = 'FT';
export const OPEND_HEADER_SIZE = 44;

export const OPEND_CMD = {
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

export const OPEND_MARKET: Record<string, number> = {
  HK: 1, US: 11, SH: 21, SZ: 22, SG: 51, CC: 91,
};

export const OPEND_MARKET_REV: Record<number, string> = {
  1: 'HK', 11: 'US', 21: 'SH', 22: 'SZ', 51: 'SG', 91: 'CC',
};

export const OPEND_KL_PERIOD: Record<string, number> = {
  '1m': 1, '5m': 5, '15m': 15, '30m': 30, '60m': 60,
  'daily': 4, 'weekly': 5, 'monthly': 6,
};

// ── Shared Utility Functions ──────────────────────────────────────────────

/** Extract numeric market code from dot-separated symbol (e.g., "US.AAPL" → 11) */
export function opendMarketCode(code: string): number {
  const prefix = code.split('.')[0];
  return OPEND_MARKET[prefix] ?? 11;
}

/** Extract symbol part after market prefix (e.g., "US.AAPL" → "AAPL") */
export function opendSymbolOf(code: string): string {
  return code.split('.').slice(1).join('.');
}

/**
 * Convert protobuf-style numeric value to JS number.
 * Handles: number, string, and Long-like { low, high, unsigned } objects.
 */
export function opendToNum(v: unknown): number {
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

// ── Packet Builder / Parser ───────────────────────────────────────────────

export interface OpendPacketHeader {
  protoID: number;
  serial: number;
  bodyLen: number;
}

/**
 * Build a binary OpenD request packet (44-byte header + protobuf body).
 *
 * Header layout:
 *   [0..2)   magic "FT"
 *   [2..6)   protoID (uint32 LE)
 *   [6..7)   protoFmtType (uint8, 0 = protobuf)
 *   [7..8)   protoVer (uint8)
 *   [8..12)  serialNo (uint32 LE)
 *   [12..16) bodyLen (uint32 LE)
 *   [16..36) bodySHA1 (20 bytes)
 *   [36..44) reserved (8 bytes, zeros)
 */
export function buildOpendPacket(
  cmdId: number,
  serial: number,
  bodyBuf: Buffer,
): Buffer {
  const header = Buffer.alloc(OPEND_HEADER_SIZE);
  header.write(OPEND_MAGIC, 0, 2, 'ascii');
  header.writeUInt32LE(cmdId, 2);
  header.writeUInt8(0, 6);
  header.writeUInt8(0, 7);
  header.writeUInt32LE(serial, 8);
  header.writeUInt32LE(bodyBuf.length, 12);
  const sha1 = createHash('sha1').update(bodyBuf).digest();
  sha1.copy(header, 16);
  return Buffer.concat([header, bodyBuf]);
}

/**
 * Parse the header of an OpenD response buffer.
 * Returns null if the buffer is too small or magic is invalid.
 */
export function parseOpendHeader(buf: Buffer): OpendPacketHeader | null {
  if (buf.length < OPEND_HEADER_SIZE) return null;
  const magic = buf.subarray(0, 2).toString('ascii');
  if (magic !== OPEND_MAGIC) return null;
  return {
    protoID: buf.readUInt32LE(2),
    serial: buf.readUInt32LE(8),
    bodyLen: buf.readUInt32LE(12),
  };
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface OpendConfig extends BrokerConfig {
  language?: 'en' | 'zh-CN' | 'zh-HK';
  market?: 'US' | 'HK' | 'SG';
  currency?: 'USD' | 'HKD' | 'SGD';
  maxReconnectAttempts?: number;
  autoReconnect?: boolean;
}

export interface PendingRequest {
  resolve: (body: Buffer) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

type QuoteCallback = (quotes: QuoteInfo[]) => void;
type DisconnectCallback = () => void;

// ── Abstract Base Class ───────────────────────────────────────────────────

export abstract class OpenDBaseAdapter implements IBrokerAdapter {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  connected: boolean = false;

  // ── TCP State ───────────────────────────────────────────────────────
  protected socket: net.Socket | null = null;
  protected tcpBuffer: Buffer = Buffer.alloc(0);
  protected serial: number = 1000;
  protected connID: number = 0;
  protected pendingRequests: Map<number, PendingRequest> = new Map();

  // ── Reconnect State ─────────────────────────────────────────────────
  protected reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  protected reconnectAttempts: number = 0;

  // ── Subscription & Callback State ───────────────────────────────────
  protected subscribedSymbols: Set<string> = new Set();
  protected subscribedCodes: string[] = [];
  protected quoteCache: Map<string, QuoteInfo> = new Map();
  protected quoteCallbacks: QuoteCallback[] = [];
  protected disconnectCallbacks: DisconnectCallback[] = [];
  protected mockTimer: ReturnType<typeof setInterval> | null = null;

  // ── Mock Mode ───────────────────────────────────────────────────────
  protected mockMode: boolean = false;

  // ── Config ──────────────────────────────────────────────────────────
  protected config: OpendConfig;

  constructor(config: OpendConfig) {
    this.id = config.id;
    this.type = config.type;
    this.name = config.name;
    this.config = {
      ...config,
      host: config.host || '127.0.0.1',
      port: config.port,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 20,
      autoReconnect: config.autoReconnect ?? true,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ABSTRACT METHODS — Adapter-specific logic
  // ══════════════════════════════════════════════════════════════════════

  /** Return the protobuf root object (loaded from futu-api/proto.js) */
  protected abstract getProtoRoot(): any;

  /** Return the client ID string for InitConnect handshake */
  protected abstract getClientID(): string;

  /** Return the default port for this broker's OpenD instance */
  protected abstract getDefaultPort(): number;

  /** Generate a mock quote for the given symbol code */
  protected abstract generateMockQuote(code: string): QuoteInfo;

  /** Generate mock klines for the given symbol */
  protected abstract generateMockKlines(code: string, period: string, count: number): KlineInfo[];

  /** Get the base price for mock quote generation */
  protected abstract getBasePrice(code: string): number;

  // ══════════════════════════════════════════════════════════════════════
  //  CONNECTION — Shared TCP lifecycle
  // ══════════════════════════════════════════════════════════════════════

  async connect(): Promise<void> {
    log.info(`[${this.type}] Connecting to ${this.config.host}:${this.config.port}...`);

    const tcpOk = await this.connectReal();
    if (!tcpOk) {
      log.warn(`[${this.type}] TCP unavailable — falling back to mock mode`);
      this.mockMode = true;
    }

    this.connected = true;
    this.startQuotePushIfNeeded();
    log.info(`[${this.type}] Connected (mock=${this.mockMode})`);
  }

  async connectReal(): Promise<boolean> {
    const proto = this.getProtoRoot();
    if (!proto) return false;

    try {
      this.socket = await this.tcpConnect();
      this.socket.setKeepAlive(true, 30000);
      this.socket.on('data', (chunk: Buffer) => this.onTcpData(chunk));
      this.socket.on('close', () => this.onTcpClose());
      this.socket.on('error', (err: Error) => {
        log.error(`[${this.type}] Socket error:`, err.message);
      });

      // InitConnect handshake
      const initRes = await this.sendCommand(OPEND_CMD.InitConnect, {
        c2s: {
          clientVer: 106,
          clientID: this.getClientID(),
          recvNotify: true,
          packetEncAlgo: -1,
          pushProtoFmt: 0,
          programmingLanguage: 'TypeScript',
        },
      }, 10000);

      this.connID = Number(initRes?.s2c?.connID ?? 0);
      this.reconnectAttempts = 0;
      this.mockMode = false;
      log.info(`[${this.type}] TCP handshake OK, connID=${this.connID}`);
      return true;
    } catch (err: any) {
      log.warn(`[${this.type}] TCP connect failed: ${err.message}`);
      this.cleanupSocket();
      return false;
    }
  }

  disconnect(): void {
    this.connected = false;
    this.subscribedSymbols.clear();
    this.quoteCache.clear();
    this.cancelReconnect();

    if (this.mockTimer) {
      clearInterval(this.mockTimer);
      this.mockTimer = null;
    }

    this.cleanupSocket();
    for (const cb of this.disconnectCallbacks) {
      try { cb(); } catch { /* swallow */ }
    }
    log.info(`[${this.type}] Disconnected`);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  TCP DATA HANDLING — Shared packet framing
  // ══════════════════════════════════════════════════════════════════════

  protected onTcpData(chunk: Buffer): void {
    this.tcpBuffer = Buffer.concat([this.tcpBuffer, chunk]);

    while (this.tcpBuffer.length >= OPEND_HEADER_SIZE) {
      const header = parseOpendHeader(this.tcpBuffer);
      if (!header) {
        log.error(`[${this.type}] Invalid response magic — closing socket`);
        this.cleanupSocket();
        return;
      }

      const totalLen = OPEND_HEADER_SIZE + header.bodyLen;
      if (this.tcpBuffer.length < totalLen) return;

      const body = this.tcpBuffer.subarray(OPEND_HEADER_SIZE, totalLen);
      this.tcpBuffer = this.tcpBuffer.subarray(totalLen);

      // Push notification: protoID 3005
      if (header.protoID === OPEND_CMD.QotUpdateBasicQot.id) {
        this.handleQuotePush(body);
        continue;
      }

      const pending = this.pendingRequests.get(header.serial);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(header.serial);
        pending.resolve(Buffer.from(body));
      }
    }
  }

  protected onTcpClose(): void {
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

  // ══════════════════════════════════════════════════════════════════════
  //  SHARED QUOTE PARSING
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Parse QuoteInfo[] from a decoded protobuf response containing basicQotList.
   * This is the single source of truth for OpenD quote parsing.
   */
  protected parseQuotesFromProto(decoded: any): QuoteInfo[] {
    const list = decoded?.s2c?.basicQotList ?? [];
    return list.map((q: any): QuoteInfo => {
      const prefix = OPEND_MARKET_REV[q.security?.market] ?? 'US';
      const code = `${prefix}.${q.security?.code}`;
      const prevClose = opendToNum(q.prevClosePrice);
      const price = opendToNum(q.curPrice);
      const change = prevClose > 0 ? +(price - prevClose).toFixed(2) : 0;
      const changePct = prevClose > 0
        ? +(((price - prevClose) / prevClose) * 100).toFixed(2)
        : 0;

      return {
        code,
        price,
        change,
        changePct,
        volume: opendToNum(q.volume),
        turnover: opendToNum(q.turnover),
        high: opendToNum(q.highPrice),
        low: opendToNum(q.lowPrice),
        open: opendToNum(q.openPrice),
        prevClose,
        time: new Date().toISOString(),
      };
    });
  }

  protected handleQuotePush(body: Buffer): void {
    const proto = this.getProtoRoot();
    if (!proto) return;
    try {
      const PushResp = proto.lookup('Qot_UpdateBasicQot.Response');
      const decoded = PushResp.decode(body);
      if (decoded?.retType !== 0) return;

      const quotes = this.parseQuotesFromProto(decoded);
      for (const q of quotes) this.quoteCache.set(q.code, q);
      for (const cb of this.quoteCallbacks) {
        try { cb(quotes); } catch (err: any) {
          log.error(`[${this.type}] Quote callback error: ${err.message}`);
        }
      }
    } catch (e: any) {
      log.warn(`[${this.type}] Quote push decode error: ${e.message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SHARED ORDER BUILDING
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Build the trdHeader used by all OpenD trading commands.
   */
  protected buildTrdHeader(
    accountId: string,
    code: string,
    trdEnv: number = 1,
  ): { trdEnv: number; accID: number; trdMarket: number } {
    return {
      trdEnv,
      accID: Number(accountId),
      trdMarket: opendMarketCode(code),
    };
  }

  /**
   * Build the c2s payload for TrdPlaceOrder.
   */
  protected buildPlaceOrderPayload(order: PlaceOrderRequest): Record<string, any> {
    return {
      c2s: {
        header: this.buildTrdHeader(order.accountId || '0', order.code),
        trdSide: order.side === 'BUY' ? 1 : 2,
        orderType: order.orderType === 'LIMIT' ? 1 : 2,
        qty: order.qty,
        price: order.price ?? 0,
        code: opendSymbolOf(order.code),
        remark: '',
      },
    };
  }

  /**
   * Build the c2s payload for TrdCancelOrder.
   */
  protected buildCancelOrderPayload(
    orderId: string,
    accountId: string,
    code: string,
  ): Record<string, any> {
    return {
      c2s: {
        header: this.buildTrdHeader(accountId, code),
        orderID: Number(orderId),
        modifyOrderOp: 3, // Cancel
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SHARED COMMAND SENDING
  // ══════════════════════════════════════════════════════════════════════

  protected async sendCommand(
    cmd: { id: number; name: string },
    req: Record<string, unknown>,
    timeout: number = 15000,
  ): Promise<any> {
    const proto = this.getProtoRoot();
    if (!proto) throw new Error('Protobuf not loaded');
    if (!this.socket) throw new Error('TCP socket not connected');

    const RequestType = proto.lookup(`${cmd.name}.Request`);
    const ResponseType = proto.lookup(`${cmd.name}.Response`);
    const bodyBuf = Buffer.from(RequestType.encode(RequestType.create(req)).finish());

    const serial = ++this.serial;
    const packet = buildOpendPacket(cmd.id, serial, bodyBuf);

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

    const decoded = ResponseType.decode(rawBody);
    if (decoded?.retType !== 0) {
      throw new Error(decoded?.retMsg ?? `${cmd.name} failed`);
    }
    return decoded;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SHARED RECONNECT LOGIC
  // ══════════════════════════════════════════════════════════════════════

  protected scheduleReconnect(): void {
    if (!this.config.autoReconnect) return;
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts ?? 20)) {
      log.error(`[${this.type}] Max reconnect attempts — staying in mock mode`);
      this.mockMode = true;
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    log.info(`[${this.type}] Reconnect in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      const ok = await this.connectReal();
      if (ok && this.subscribedCodes.length > 0) {
        try {
          await this.subscribeAndPush(this.subscribedCodes);
        } catch (e: any) {
          log.warn(`[${this.type}] Re-subscribe failed: ${e.message}`);
        }
      } else if (!ok) {
        this.scheduleReconnect();
      }
    }, delay);
  }

  protected cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  protected cleanupSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.tcpBuffer = Buffer.alloc(0);
    this.rejectAllPending(new Error('Socket closed'));
  }

  protected rejectAllPending(error: Error): void {
    for (const item of this.pendingRequests.values()) {
      clearTimeout(item.timer);
      item.reject(error);
    }
    this.pendingRequests.clear();
  }

  private tcpConnect(): Promise<net.Socket> {
    return new Promise<net.Socket>((resolve, reject) => {
      const s = net.createConnection({
        host: this.config.host!,
        port: this.config.port!,
      });
      const timer = setTimeout(() => {
        s.destroy();
        reject(new Error(`TCP timeout to ${this.config.host}:${this.config.port}`));
      }, 5000);
      s.once('connect', () => { clearTimeout(timer); resolve(s); });
      s.once('error', (e: Error) => { clearTimeout(timer); reject(e); });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SHARED CALLBACK MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════

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

  // ══════════════════════════════════════════════════════════════════════
  //  SHARED MOCK INFRASTRUCTURE
  // ══════════════════════════════════════════════════════════════════════

  protected startQuotePushIfNeeded(): void {
    if (this.mockMode) this.startMockQuotePush();
  }

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
        try { cb(quotes); } catch (err: any) {
          log.error(`[${this.type}] Quote callback error: ${err.message}`);
        }
      }
    }, 2000);
  }

  protected fallbackToMock(method: string): void {
    log.warn(`[${this.type}] ${method}: TCP failed, falling back to mock mode`);
    this.mockMode = true;
  }

  protected periodToSeconds(period: string): number {
    const map: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800,
    };
    return map[period] || 86400;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SHARED IBrokerAdapter IMPLEMENTATIONS
  // ══════════════════════════════════════════════════════════════════════

  async subscribeAndPush(codes: string[]): Promise<void> {
    if (!this.connected) throw new Error('Not connected');
    this.subscribedCodes = [...codes];
    for (const code of codes) this.subscribedSymbols.add(code);

    if (!this.mockMode && this.socket) {
      try {
        const securityList = codes.map(c => ({
          market: opendMarketCode(c),
          code: opendSymbolOf(c),
        }));
        await this.sendCommand(OPEND_CMD.QotSub, {
          c2s: {
            securityList,
            subTypeList: [1],
            isSubOrUnSub: true,
            isRegOrUnRegPush: true,
            isFirstPush: true,
          },
        });
        return;
      } catch (err: any) {
        this.fallbackToMock('subscribeAndPush');
      }
    }
    this.startMockQuotePush();
  }

  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    if (!this.connected) throw new Error('Not connected');
    if (this.mockMode) {
      return codes.map(code => {
        const cached = this.quoteCache.get(code);
        if (cached) return cached;
        const mock = this.generateMockQuote(code);
        this.quoteCache.set(code, mock);
        return mock;
      });
    }

    try {
      const securityList = codes.map(c => ({
        market: opendMarketCode(c),
        code: opendSymbolOf(c),
      }));
      await this.sendCommand(OPEND_CMD.QotSub, {
        c2s: { securityList, subTypeList: [1], isSubOrUnSub: true, isRegOrUnRegPush: false, isFirstPush: true },
      });
      const res = await this.sendCommand(OPEND_CMD.QotGetBasicQot, { c2s: { securityList } });
      const quotes = this.parseQuotesFromProto(res);
      for (const q of quotes) this.quoteCache.set(q.code, q);
      return quotes;
    } catch (err: any) {
      this.fallbackToMock('getQuotes');
      return this.getQuotes(codes);
    }
  }

  async getKlines(code: string, period: string, count: number): Promise<KlineInfo[]> {
    if (!this.connected) throw new Error('Not connected');
    if (this.mockMode) return this.generateMockKlines(code, period, count);

    try {
      const klType = OPEND_KL_PERIOD[period] ?? 4;
      const security = { market: opendMarketCode(code), code: opendSymbolOf(code) };
      const res = await this.sendCommand(OPEND_CMD.QotGetKL, {
        c2s: { security, reqType: 1, subType: klType, kLineCount: count, needField: 0 },
      }, 20000);

      return (res?.s2c?.kLineList ?? []).map((k: any): KlineInfo => ({
        time: k.timeKey ? Math.floor(opendToNum(k.timeKey) / 1000) : 0,
        open: opendToNum(k.openPrice),
        high: opendToNum(k.highPrice),
        low: opendToNum(k.lowPrice),
        close: opendToNum(k.closePrice),
        volume: opendToNum(k.volume),
      })).filter((k: KlineInfo) => k.open > 0);
    } catch (err: any) {
      this.fallbackToMock('getKlines');
      return this.generateMockKlines(code, period, count);
    }
  }

  async getAccounts(): Promise<AccountInfo[]> {
    if (!this.connected) throw new Error('Not connected');
    if (this.mockMode) return this.getMockAccounts();

    try {
      const res = await this.sendCommand(OPEND_CMD.TrdGetAccList, {
        c2s: { userID: 0 },
      }, 10000);

      return (res?.s2c?.accList ?? [])
        .filter((a: any) => a.trdEnv === 1)
        .map((a: any): AccountInfo => ({
          accountId: String(a.accID),
          name: `${this.name} ${a.accID}`,
          currency: this.config.currency || 'USD',
          netAssets: 0,
          totalAssets: 0,
          cash: 0,
          marketValue: 0,
        }));
    } catch (err: any) {
      this.fallbackToMock('getAccounts');
      return this.getMockAccounts();
    }
  }

  async getFunds(accountId: string): Promise<FundsInfo> {
    if (!this.connected) throw new Error('Not connected');
    if (this.mockMode) return this.getMockFunds();

    try {
      const trdHeader = this.buildTrdHeader(accountId, 'US.');
      const res = await this.sendCommand(OPEND_CMD.TrdGetFunds, {
        c2s: { header: trdHeader },
      });
      const f = res?.s2c?.funds;
      if (!f) throw new Error('No funds data');
      return {
        totalAssets: opendToNum(f.totalAssets),
        cash: opendToNum(f.cash),
        marketValue: opendToNum(f.marketVal),
        frozenCash: opendToNum(f.frozenCash),
        availableCash: opendToNum(f.cash) - opendToNum(f.frozenCash),
        currency: this.config.currency || 'USD',
      };
    } catch (err: any) {
      this.fallbackToMock('getFunds');
      return this.getMockFunds();
    }
  }

  async getPositions(accountId: string): Promise<PositionInfo[]> {
    if (!this.connected) throw new Error('Not connected');
    if (this.mockMode) return this.getMockPositions();

    try {
      const trdHeader = this.buildTrdHeader(accountId, 'US.');
      const res = await this.sendCommand(OPEND_CMD.TrdGetPositionList, {
        c2s: {
          header: trdHeader,
          filterConditions: { filterPLRatioMin: -999, filterPLRatioMax: 999 },
        },
      });

      return (res?.s2c?.positionList ?? []).map((p: any): PositionInfo => {
        const code = `${OPEND_MARKET_REV[p.security?.market] ?? 'US'}.${p.security?.code}`;
        const qty = opendToNum(p.qty);
        const costPrice = opendToNum(p.costPrice);
        const marketPrice = opendToNum(p.valuationPrice ?? p.curPrice ?? 0);
        const marketValue = marketPrice * qty;
        const pnl = opendToNum(p.plVal ?? 0);
        const pnlPct = costPrice > 0
          ? +(((marketPrice - costPrice) / costPrice) * 100).toFixed(2)
          : 0;
        return { code, name: p.name ?? code, qty, costPrice, marketPrice, marketValue, pnl, pnlPct, ratio: 0 };
      });
    } catch (err: any) {
      this.fallbackToMock('getPositions');
      return this.getMockPositions();
    }
  }

  async getOrders(accountId: string): Promise<OrderInfo[]> {
    if (!this.connected) throw new Error('Not connected');
    if (this.mockMode) return this.getMockOrders();

    try {
      const trdHeader = this.buildTrdHeader(accountId, 'US.');
      const res = await this.sendCommand(OPEND_CMD.TrdGetOrderList, {
        c2s: { header: trdHeader },
      });

      const STATUS_MAP: Record<number, string> = {
        0: 'SUBMITTED', 1: 'WAITING', 2: 'FILLED',
        3: 'PARTIAL', 4: 'CANCELLED', 5: 'REJECTED',
      };

      return (res?.s2c?.orderList ?? []).map((o: any): OrderInfo => ({
        orderId: String(o.orderID ?? o.orderIDEx ?? ''),
        code: `${OPEND_MARKET_REV[o.security?.market] ?? 'US'}.${o.security?.code}`,
        side: o.trdSide === 1 ? 'BUY' as const : 'SELL' as const,
        orderType: o.orderType === 1 ? 'LIMIT' as const : 'MARKET' as const,
        qty: opendToNum(o.qty),
        price: opendToNum(o.price),
        filledQty: opendToNum(o.dealQty ?? 0),
        filledPrice: opendToNum(o.dealAvgPrice ?? 0),
        status: STATUS_MAP[o.orderStatus ?? 0] ?? 'UNKNOWN',
        createdAt: o.createTime ?? new Date().toISOString(),
      }));
    } catch (err: any) {
      this.fallbackToMock('getOrders');
      return this.getMockOrders();
    }
  }

  async placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }> {
    if (!this.connected) throw new Error('Not connected');
    if (this.mockMode) {
      const orderId = `${this.type.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      log.info(`[${this.type}] Order placed (mock): ${orderId}`);
      return { orderId };
    }

    try {
      const payload = this.buildPlaceOrderPayload(order);
      const res = await this.sendCommand(OPEND_CMD.TrdPlaceOrder, payload);
      const orderId = String(res?.s2c?.orderID ?? res?.s2c?.orderIDEx ?? '');
      log.info(`[${this.type}] Order placed (TCP): ${orderId}`);
      return { orderId };
    } catch (err: any) {
      this.fallbackToMock('placeOrder');
      return this.placeOrder(order);
    }
  }

  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    if (!this.connected) throw new Error('Not connected');
    if (this.mockMode) {
      log.info(`[${this.type}] Order cancelled (mock): ${orderId}`);
      return;
    }

    try {
      const payload = this.buildCancelOrderPayload(orderId, accountId, code);
      await this.sendCommand(OPEND_CMD.TrdCancelOrder, payload);
      log.info(`[${this.type}] Order cancelled (TCP): ${orderId}`);
    } catch (err: any) {
      this.fallbackToMock('cancelOrder');
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ABSTRACT MOCK PROVIDERS — each adapter defines its own mock data
  // ══════════════════════════════════════════════════════════════════════

  protected abstract getMockAccounts(): AccountInfo[];
  protected abstract getMockFunds(): FundsInfo;
  protected abstract getMockPositions(): PositionInfo[];
  protected abstract getMockOrders(): OrderInfo[];
}
```

### 2.3 FutuAdapter After Refactoring

```typescript
// electron/broker/futu-opend-adapter.ts

import { OpenDBaseAdapter, OpendConfig } from './opend-base-adapter';
import { QuoteInfo, KlineInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo } from './IBrokerAdapter';
import log from 'electron-log';

// Futu-specific protobuf loader (shared module-level singleton)
let futuProtoRoot: any = null;
try {
  futuProtoRoot = require('futu-api/proto.js');
  if (futuProtoRoot?.default) futuProtoRoot = futuProtoRoot.default;
} catch (e: any) {
  log.error('[FutuAdapter] Protobuf load failed:', e.message);
}

// Futu-specific mock base prices
const FUTU_MOCK_PRICES: Record<string, number> = {
  'US.AAPL': 155, 'US.TSLA': 210, 'US.NVDA': 880,
  'US.MSFT': 420, 'US.GOOGL': 155, 'HK.00700': 388,
};

export class FutuOpenDAdapter extends OpenDBaseAdapter {
  constructor(config: Partial<OpendConfig> = {}) {
    super({
      id: config.id || 'futu-default',
      name: config.name || 'Futu',
      type: 'futu',
      host: config.host || '127.0.0.1',
      port: config.port || 11111,
      enabled: config.enabled !== false,
      ...config,
    });
  }

  protected getProtoRoot(): any { return futuProtoRoot; }
  protected getClientID(): string { return 'TradingEasy-Desktop'; }
  protected getDefaultPort(): number { return 11111; }

  protected generateMockQuote(code: string): QuoteInfo {
    const basePrice = this.getBasePrice(code);
    const change = (Math.random() - 0.48) * basePrice * 0.03;
    const price = basePrice + change;
    const prevClose = basePrice - (Math.random() - 0.5) * basePrice * 0.02;
    return {
      code, price: +price.toFixed(2),
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

  protected getBasePrice(code: string): number {
    return FUTU_MOCK_PRICES[code] || 100;
  }

  protected generateMockKlines(code: string, period: string, count: number): KlineInfo[] {
    // ... kline generation (adapter-specific)
    const klines: KlineInfo[] = [];
    let price = this.getBasePrice(code) || 150;
    const now = Math.floor(Date.now() / 1000);
    const intervalSec = this.periodToSeconds(period);
    for (let i = count - 1; i >= 0; i--) {
      const change = (Math.random() - 0.48) * price * 0.03;
      const open = price;
      const close = price + change;
      klines.push({
        time: now - i * intervalSec,
        open: +open.toFixed(2),
        high: +(Math.max(open, close) + Math.random() * price * 0.01).toFixed(2),
        low: +(Math.min(open, close) - Math.random() * price * 0.01).toFixed(2),
        close: +close.toFixed(2),
        volume: Math.floor(Math.random() * 1000000) + 100000,
      });
      price = close;
    }
    return klines;
  }

  protected getMockAccounts(): AccountInfo[] {
    return [{ accountId: 'FUTU-001', name: 'Futu Live', currency: 'USD',
      netAssets: 100000, totalAssets: 100000, cash: 50000, marketValue: 50000 }];
  }

  protected getMockFunds(): FundsInfo {
    return { totalAssets: 100000, cash: 50000, marketValue: 50000,
      frozenCash: 0, availableCash: 50000, currency: 'USD' };
  }

  protected getMockPositions(): PositionInfo[] {
    return [{ code: 'US.AAPL', name: 'Apple', qty: 100, costPrice: 150,
      marketPrice: 155, marketValue: 15500, pnl: 500, pnlPct: 3.33, ratio: 0.31 }];
  }

  protected getMockOrders(): OrderInfo[] {
    return [{ orderId: 'FUTU-ORD-001', code: 'US.AAPL', side: 'BUY',
      orderType: 'LIMIT', qty: 100, price: 150, filledQty: 100,
      filledPrice: 150, status: 'FILLED', createdAt: new Date().toISOString() }];
  }
}
```

### 2.4 MoomooAdapter After Refactoring

```typescript
// electron/broker/moomoo-adapter-v2.ts

import { OpenDBaseAdapter, OpendConfig } from './opend-base-adapter';
import { QuoteInfo, KlineInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo } from './IBrokerAdapter';

const MOOMOO_MOCK_PRICES: Record<string, number> = {
  'US.AAPL': 155, 'US.TSLA': 210, 'US.NVDA': 880,
  'US.MSFT': 420, 'US.GOOGL': 155, 'US.AMZN': 185,
  'US.META': 490, 'US.SPY': 520, 'US.QQQ': 445,
};

export class MoomooAdapter extends OpenDBaseAdapter {
  constructor(config: Partial<OpendConfig> = {}) {
    super({
      id: config.id || 'moomoo-default',
      name: config.name || 'Moomoo',
      type: 'moomoo',
      host: config.host || '127.0.0.1',
      port: config.port || 11211,  // Moomoo default port
      enabled: config.enabled !== false,
      ...config,
    });
  }

  protected getProtoRoot(): any { /* same proto loader */ }
  protected getClientID(): string { return 'TradingEasy-Moomoo'; }
  protected getDefaultPort(): number { return 11211; }

  // ... mock providers (same structure, different base prices)
  protected generateMockQuote(code: string): QuoteInfo { /* ... */ }
  protected getBasePrice(code: string): number {
    return MOOMOO_MOCK_PRICES[code] || 100;
  }
  protected generateMockKlines(code: string, period: string, count: number): KlineInfo[] { /* ... */ }
  protected getMockAccounts(): AccountInfo[] { /* ... */ }
  protected getMockFunds(): FundsInfo { /* ... */ }
  protected getMockPositions(): PositionInfo[] { /* ... */ }
  protected getMockOrders(): OrderInfo[] { /* ... */ }
}
```

---

## 3. Migration Plan

### Phase 1: Create OpenDBaseAdapter (New File)

**File:** `electron/broker/opend-base-adapter.ts`

Actions:
1. Create the abstract base class with all shared methods (Section 2.2)
2. Export shared constants, utilities, and packet builder/parser
3. Export shared types (`OpendConfig`, `PendingRequest`)
4. No changes to existing adapters yet — additive only

**Acceptance criteria:**
- File compiles without errors
- All exports are typed correctly
- No circular dependencies

### Phase 2: Refactor FutuAdapter

**File:** `electron/broker/futu-opend.ts` → rename to `futu-opend-adapter.ts`

Actions:
1. Change `FutuOpenDClient` to extend `OpenDBaseAdapter`
2. Remove duplicated constants (`MARKET`, `MARKET_REV`, `KL_PERIOD`, `CMD`)
3. Remove duplicated utilities (`marketCode`, `symOf`, `toNum`)
4. Remove duplicated TCP logic (use base class `connect()`, `onTcpData()`, `scheduleReconnect()`)
5. Remove duplicated quote parsing (use base class `parseQuotesFromProto()`)
6. Remove duplicated order building (use base class `buildPlaceOrderPayload()`)
7. Keep only: mock data generators, protobuf loader, Futu-specific config

**Expected result:** ~150-180 lines (down from 428)

### Phase 3: Refactor MoomooAdapter

**File:** `electron/broker/moomoo-adapter.ts`

Actions:
1. Change `MoomooAdapter` to extend `OpenDBaseAdapter`
2. Remove all duplicated code (same as Phase 2 steps 2-6)
3. Keep: mock data generators, Moomoo-specific config (SG market, currency conversion)

**Expected result:** ~200-250 lines (down from 1185)

### Phase 4: Evaluate IB Adapter

**Decision:** Do NOT refactor IB adapter to use OpenDBaseAdapter.

Rationale:
- IB uses null-delimited text protocol, not protobuf
- IB handshake is `API\0` + version negotiation, not InitConnect
- IB message dispatch is msgId-based switch, not protoID routing
- IB quote model is TickPrice/TickSize event stream, not basicQotList snapshot
- IB order format has 45+ fields, not protobuf TrdPlaceOrder

**Alternative:** Extract a separate `TCPBaseAdapter` for IB that provides only:
- Raw TCP connect with timeout
- Reconnect scheduling (exponential backoff)
- Callback management (quote/disconnect)
- Mock mode infrastructure

This is optional and lower priority.

---

## 4. Testing Strategy

### 4.1 Unit Tests

```
tests/broker/
├── opend-base-adapter.test.ts    # Test shared utilities, packet building, quote parsing
├── futu-opend-adapter.test.ts    # Test Futu-specific mock data, config
├── moomoo-adapter.test.ts       # Test Moomoo-specific mock data, SG market
└── ib-adapter.test.ts           # Existing tests (unchanged)
```

**Key test cases for `opend-base-adapter.test.ts`:**

| Test | Description |
|------|-------------|
| `buildOpendPacket` | Verify 44-byte header + SHA-1 + body concatenation |
| `parseOpendHeader` | Valid header → correct protoID, serial, bodyLen |
| `parseOpendHeader` | Invalid magic → null |
| `parseOpendHeader` | Short buffer → null |
| `opendToNum` | Handles number, string, Long {low, high} |
| `opendMarketCode` | "US.AAPL" → 11, "HK.00700" → 1 |
| `opendSymbolOf` | "US.AAPL" → "AAPL", "HK.00700" → "00700" |
| `parseQuotesFromProto` | Correct field mapping, change/changePct calculation |
| `buildTrdHeader` | Correct trdEnv, accID, trdMarket |
| `buildPlaceOrderPayload` | BUY→1, SELL→2, LIMIT→1, MARKET→2 |

### 4.2 Integration Tests

Use mock TCP server to test full connect → subscribe → quote push flow:

```typescript
// tests/broker/mock-opend-server.ts
import net from 'net';

export function createMockOpenDServer(port: number): net.Server {
  const server = net.createServer((socket) => {
    socket.on('data', (chunk) => {
      // Parse header, respond with mock protobuf response
    });
  });
  server.listen(port);
  return server;
}
```

### 4.3 Regression Tests

Before and after refactoring, run:

```bash
# 1. Start mock OpenD server
npm run test:broker:mock-server

# 2. Run all broker adapter tests
npm run test:broker

# 3. Verify identical outputs for same inputs
npm run test:broker:regression
```

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| IB adapter accidentally broken | Low | High | Keep IB adapter completely separate; no shared base |
| Quote parsing behavior change | Low | Medium | Regression tests comparing before/after outputs |
| Protobuf loader conflict | Low | Low | Keep proto loader per-adapter (module-level singleton) |
| Reconnect timing differences | Low | Low | Base class uses same 1.5^n backoff; configurable via config |
| Mock data divergence lost | Low | Low | Each adapter keeps its own mock price tables |
| Import path breakage | Medium | Medium | Update all imports in broker-manager.ts; add barrel export |

### Rollback Plan

If issues are found post-merge:
1. Revert the PR (single commit per phase)
2. Old adapter files preserved in git history
3. No data migration needed — pure code refactoring

---

## 6. Estimated Effort

| Task | Lines Added | Lines Removed | Net Change |
|------|------------|---------------|------------|
| OpenDBaseAdapter creation | ~400 | 0 | +400 |
| FutuAdapter refactor | ~50 | -280 | -230 |
| MoomooAdapter refactor | ~80 | -950 | -870 |
| IBAdapter | 0 | 0 | 0 (unchanged) |
| Tests (new) | ~200 | 0 | +200 |
| **Total** | **~730** | **-1230** | **-500 net** |

### Effort Summary

- **Code reduction:** ~500 fewer lines
- **Maintenance improvement:** Single source of truth for OpenD protocol logic
- **Bug fix surface:** Reduced from 2 files to 1 for shared logic
- **New feature surface:** Add once in base class, available to both Futu & Moomoo
- **Testing improvement:** Shared test suite covers protocol logic once

---

## 7. File Structure After Refactoring

```
electron/broker/
├── IBrokerAdapter.ts              # Interface (unchanged)
├── opend-base-adapter.ts          # NEW: Abstract base for OpenD protocol
├── futu-opend-adapter.ts          # Refactored: extends OpenDBaseAdapter (~150 lines)
├── moomoo-adapter.ts              # Refactored: extends OpenDBaseAdapter (~200 lines)
├── ib-adapter.ts                  # Unchanged: standalone IB protocol (~2032 lines)
└── broker-manager.ts              # Updated: import paths
```

---

## 8. Implementation Checklist

- [ ] **Phase 1:** Create `opend-base-adapter.ts` with abstract base class
- [ ] **Phase 1:** Add unit tests for shared utilities and packet building
- [ ] **Phase 2:** Refactor `futu-opend.ts` → `futu-opend-adapter.ts`
- [ ] **Phase 2:** Verify Futu adapter tests pass
- [ ] **Phase 3:** Refactor `moomoo-adapter.ts` to extend base
- [ ] **Phase 3:** Verify Moomoo adapter tests pass
- [ ] **Phase 3:** Run regression tests (compare outputs before/after)
- [ ] **Phase 4:** Evaluate optional `TCPBaseAdapter` for IB (defer)
- [ ] **Integration:** Update `broker-manager.ts` imports
- [ ] **Integration:** Run full broker integration test suite
- [ ] **Review:** Code review with team
- [ ] **Deploy:** Merge to main, monitor for 48h

---

## 9. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-06 | IB adapter excluded from OpenDBaseAdapter | Different protocol (text vs protobuf), different handshake, different message dispatch |
| 2026-06-06 | Mock data generators kept per-adapter | Different base prices, different instrument coverage per broker |
| 2026-06-06 | Protobuf loader kept per-adapter | Module-level singleton pattern; sharing adds complexity without benefit |
| 2026-06-06 | SG market (51) added to shared MARKET map | Moomoo supports SG; forward-compatible for Futu |
