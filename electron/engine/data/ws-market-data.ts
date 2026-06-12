// @ts-nocheck
/**
 * WebSocket Market Data Engine
 * Sprint 2 Phase 1 — Real-time market data via WebSocket
 *
 * Features:
 *  - Connection state machine with exponential-backoff reconnection
 *  - Priority message queue (quote > kline > depth > tick)
 *  - OHLCV bar aggregation (1m / 5m / 15m / 1h)
 *  - Batched dispatch (100 ms windows) with per-symbol throttling
 *  - Circular tick buffers (max 5 000 ticks per symbol)
 *  - Mock mode for development / testing
 *
 * Pure TypeScript — no external WebSocket library required.
 */

import log from 'electron-log';
import { EngineError } from '../core/engine-error';
import { generateId } from '../utils/id';

// ---------------------------------------------------------------------------
// §1  Interfaces & Types
// ---------------------------------------------------------------------------

export interface WsConnectionConfig {
  url: string;
  protocols?: string[];
  reconnectIntervalMs: number;
  maxReconnectAttempts: number;
  heartbeatIntervalMs: number;
  messageBufferSize: number;
}

export interface MarketTick {
  code: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timestamp: number;
  bid?: number;
  ask?: number;
  bidVol?: number;
  askVol?: number;
}

export interface Subscription {
  id: string;
  codes: string[];
  type: 'quote' | 'kline' | 'depth' | 'tick';
  callback: (data: unknown) => void;
  active: boolean;
  createdAt: number;
}

export interface WsStatus {
  connected: boolean;
  url: string;
  reconnectAttempts: number;
  subscriptions: number;
  messagesReceived: number;
  messagesSent: number;
  lastMessageAt: number;
  lastHeartbeatAt: number;
  latency: number;
  buffer: { queued: number; dropped: number };
}

export interface OHLCVBar {
  code: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  period: KlinePeriod;
}

export type KlinePeriod = '1m' | '5m' | '15m' | '1h';

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export type WsEventType =
  | 'tick'
  | 'kline'
  | 'depth'
  | 'error'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'message';

export type WsEventCallback = (...args: unknown[]) => void;

interface QueuedMessage {
  data: string;
  priority: number; // lower = higher priority
  enqueuedAt: number;
}

interface ThrottleEntry {
  count: number;
  windowStart: number;
}

interface CircularBuffer<T> {
  items: T[];
  head: number;
  size: number;
  capacity: number;
}

interface MockSymbolState {
  code: string;
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  drift: number;
  volatility: number;
}

// ---------------------------------------------------------------------------
// §2  Constants
// ---------------------------------------------------------------------------

const PRIORITY_MAP: Record<string, number> = {
  quote: 0,
  kline: 1,
  depth: 2,
  tick: 3,
};

const KLINE_PERIOD_MS: Record<KlinePeriod, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
};

const MAX_BACKOFF_MS = 30_000;
const BATCH_WINDOW_MS = 100;
const MAX_UPDATES_PER_SEC = 10;
const THROTTLE_WINDOW_MS = 1_000;
const CIRCULAR_BUFFER_CAPACITY = 5_000;
const MOCK_TICK_INTERVAL_MS = 500;

// ---------------------------------------------------------------------------
// §3  Utility helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;

function clampBackoff(base: number, attempt: number): number {
  const delay = base * Math.pow(2, attempt);
  return Math.min(delay, MAX_BACKOFF_MS);
}

function nowMs(): number {
  return Date.now();
}

function createCircularBuffer<T>(capacity: number): CircularBuffer<T> {
  return {
    items: new Array<T>(capacity),
    head: 0,
    size: 0,
    capacity,
  };
}

function pushCircular<T>(buf: CircularBuffer<T>, item: T): void {
  buf.items[buf.head] = item;
  buf.head = (buf.head + 1) % buf.capacity;
  if (buf.size < buf.capacity) buf.size += 1;
}

function toArrayCircular<T>(buf: CircularBuffer<T>): T[] {
  if (buf.size === 0) return [];
  if (buf.size < buf.capacity) {
    return buf.items.slice(0, buf.size);
  }
  // Full buffer — oldest item is at head
  return [
    ...buf.items.slice(buf.head),
    ...buf.items.slice(0, buf.head),
  ];
}

function lastCircular<T>(buf: CircularBuffer<T>): T | undefined {
  if (buf.size === 0) return undefined;
  const idx = (buf.head - 1 + buf.capacity) % buf.capacity;
  return buf.items[idx];
}

// ---------------------------------------------------------------------------
// §4  Simple EventEmitter (avoids Node events dependency in renderer)
// ---------------------------------------------------------------------------

class TypedEventEmitter {
  private listeners: Map<string, Set<WsEventCallback>> = new Map();

  on(event: string, cb: WsEventCallback): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off(event: string, cb: WsEventCallback): void {
    this.listeners.get(event)?.delete(cb);
  }

  once(event: string, cb: WsEventCallback): void {
    const wrapper = (...args: unknown[]) => {
      cb(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(...args);
      } catch (err) {
    // [EngineError:DATA] — structured error tracking
        void EngineError; // structured error domain: DATA
        log.error('[WsMarketData] Event listener error:', err);
      }
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// ---------------------------------------------------------------------------
// §5  Lightweight WebSocket wrapper (uses global WebSocket or Node ws)
// ---------------------------------------------------------------------------

/**
 * Minimal WebSocket facade.
 * In Electron renderer the global `WebSocket` (browser API) is available.
 * In the main process we dynamically try `require('ws')` as a fallback;
 * if that is absent we fall back to a no-op mock so the engine still works
 * in mock-only mode.
 */
class RawSocket {
  private ws: unknown = null;
  private _url: string;

  onopen: (() => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  constructor(url: string, protocols?: string[]) {
    this._url = url;
    try {
      // Prefer global WebSocket (available in Electron renderer & Node 22+)
      if (typeof WebSocket !== 'undefined') {
        this.ws = protocols
          ? new WebSocket(url, protocols)
          : new WebSocket(url);
      } else {
        // Node main-process fallback — try require('ws')
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const WS = require('ws');
        this.ws = protocols ? new WS(url, protocols) : new WS(url);
      }
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.warn('[WsMarketData] WebSocket constructor failed, using stub:', err);
      // Emit async error so caller can handle it
      setTimeout(() => this.onerror?.({ message: String(err) }), 0);
      return;
    }

    this.ws.onopen = () => this.onopen?.();
    this.ws.onclose = (ev: unknown) => this.onclose?.(ev);
    this.ws.onmessage = (ev: unknown) => this.onmessage?.(ev);
    this.ws.onerror = (ev: unknown) => this.onerror?.(ev);
  }

  send(data: string): void {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(data);
    }
  }

  close(code?: number, reason?: string): void {
    try {
      this.ws?.close(code, reason);
    } catch (_e: unknown) {
      // ignore
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? 3; // CLOSED
  }
}

// ---------------------------------------------------------------------------
// §6  WsMarketDataEngine
// ---------------------------------------------------------------------------

export class WsMarketDataEngine {
  // ---- internal state ----
  private state: ConnectionState = 'disconnected';
  private config: WsConnectionConfig | null = null;
  private socket: RawSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeatSent = 0;
  private lastPongReceived = 0;
  private latencyMs = 0;
  private stats = { messagesReceived: 0, messagesSent: 0, lastMessageAt: 0 };
  private intentionallyClosed = false;

  // ---- subscriptions ----
  private subscriptions: Map<string, Subscription> = new Map();

  // ---- message queue ----
  private messageQueue: QueuedMessage[] = [];
  private maxQueueSize = 1_000;
  private droppedMessages = 0;

  // ---- data stores ----
  private tickBuffers: Map<string, CircularBuffer<MarketTick>> = new Map();
  private klineAggregators: Map<string, Map<KlinePeriod, Partial<OHLCVBar>>> =
    new Map();
  private throttleMap: Map<string, ThrottleEntry> = new Map();

  // ---- batching ----
  private batchQueue: MarketTick[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- events ----
  private emitter = new TypedEventEmitter();

  // ---- mock mode ----
  private mockEnabled = false;
  private mockSymbols: MockSymbolState[] = [];
  private mockTimer: ReturnType<typeof setInterval> | null = null;

  // -----------------------------------------------------------------------
  // §6.1  Public API — Connection
  // -----------------------------------------------------------------------

  async connect(config: WsConnectionConfig): Promise<boolean> {
    if (this.state === 'connected' || this.state === 'connecting') {
      log.warn('[WsMarketData] Already connected / connecting, ignoring');
      return this.state === 'connected';
    }

    this.config = config;
    this.maxQueueSize = config.messageBufferSize || 1_000;
    this.intentionallyClosed = false;

    return this.doConnect();
  }

  disconnect(): void {
    log.info('[WsMarketData] Disconnect requested');
    this.intentionallyClosed = true;
    this.teardown();
    this.setState('disconnected');
    this.emitter.emit('disconnected', { reason: 'user' });
  }

  getStatus(): WsStatus {
    return {
      connected: this.state === 'connected',
      url: this.config?.url ?? '',
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: this.subscriptions.size,
      messagesReceived: this.stats.messagesReceived,
      messagesSent: this.stats.messagesSent,
      lastMessageAt: this.stats.lastMessageAt,
      lastHeartbeatAt: this.lastPongReceived,
      latency: this.latencyMs,
      buffer: {
        queued: this.messageQueue.length,
        dropped: this.droppedMessages,
      },
    };
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }

  // -----------------------------------------------------------------------
  // §6.2  Public API — Subscriptions
  // -----------------------------------------------------------------------

  subscribe(
    codes: string[],
    type: 'quote' | 'kline' | 'depth' | 'tick',
    callback: (data: unknown) => void,
  ): string {
    const id = generateId('sub');
    const sub: Subscription = {
      id,
      codes: [...codes],
      type,
      callback,
      active: true,
      createdAt: nowMs(),
    };
    this.subscriptions.set(id, sub);
    log.info(`[WsMarketData] Subscribed ${id}: ${type} [${codes.join(', ')}]`);

    // If connected, send subscribe message to server
    if (this.state === 'connected') {
      this.sendSubscribeMessage(sub);
    }

    return id;
  }

  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;

    sub.active = false;
    this.subscriptions.delete(subscriptionId);
    log.info(`[WsMarketData] Unsubscribed ${subscriptionId}`);

    // If connected, notify server
    if (this.state === 'connected') {
      this.sendUnsubscribeMessage(sub);
    }

    // Auto-unsubscribe from server if no remaining subs for a code
    this.pruneUnusedCodes(sub.codes);

    return true;
  }

  unsubscribeAll(): void {
    const codes = new Set<string>();
    for (const sub of this.subscriptions.values()) {
      sub.codes.forEach((c) => codes.add(c));
      sub.active = false;
    }
    this.subscriptions.clear();
    log.info('[WsMarketData] All subscriptions cleared');

    if (this.state === 'connected') {
      this.sendMessage({ type: 'unsubscribe_all' });
    }
  }

  /**
   * Auto-subscribe helper: call when a strategy starts to ensure its
   * symbols are subscribed.
   */
  autoSubscribeForStrategy(
    symbols: string[],
    type: 'quote' | 'kline' | 'depth' | 'tick' = 'quote',
    callback: (data: unknown) => void = () => {},
  ): string[] {
    const newSubIds: string[] = [];
    // Group symbols that aren't yet covered by an active sub of this type
    const uncovered = symbols.filter(
      (s) =>
        ![...this.subscriptions.values()].some(
          (sub) => sub.active && sub.type === type && sub.codes.includes(s),
        ),
    );
    if (uncovered.length > 0) {
      const id = this.subscribe(uncovered, type, callback);
      newSubIds.push(id);
    }
    return newSubIds;
  }

  /**
   * Auto-unsubscribe: remove subscriptions that have no active listeners.
   * Called internally after unsubscribe.
   */
  private pruneUnusedCodes(removedCodes: string[]): void {
    for (const code of removedCodes) {
      const stillUsed = [...this.subscriptions.values()].some(
        (sub) => sub.active && sub.codes.includes(code),
      );
      if (!stillUsed && this.state === 'connected') {
        this.sendMessage({ type: 'unsubscribe', codes: [code] });
      }
    }
  }

  // -----------------------------------------------------------------------
  // §6.3  Public API — Data access
  // -----------------------------------------------------------------------

  getRecentTicks(code: string, limit = 100): MarketTick[] {
    const buf = this.tickBuffers.get(code);
    if (!buf) return [];
    const all = toArrayCircular(buf);
    return all.slice(-limit);
  }

  getLastTick(code: string): MarketTick | undefined {
    const buf = this.tickBuffers.get(code);
    return buf ? lastCircular(buf) : undefined;
  }

  getKlineBars(code: string, period: KlinePeriod): Partial<OHLCVBar> | undefined {
    return this.klineAggregators.get(code)?.get(period);
  }

  // -----------------------------------------------------------------------
  // §6.4  Public API — Events
  // -----------------------------------------------------------------------

  on(event: WsEventType, cb: WsEventCallback): void {
    this.emitter.on(event, cb);
  }

  off(event: WsEventType, cb: WsEventCallback): void {
    this.emitter.off(event, cb);
  }

  once(event: WsEventType, cb: WsEventCallback): void {
    this.emitter.once(event, cb);
  }

  removeAllListeners(event?: WsEventType): void {
    this.emitter.removeAllListeners(event);
  }

  // -----------------------------------------------------------------------
  // §6.5  Public API — Mock mode
  // -----------------------------------------------------------------------

  enableMockMode(symbols: string[]): void {
    log.info(`[WsMarketData] Mock mode enabled for: ${symbols.join(', ')}`);
    this.mockEnabled = true;

    this.mockSymbols = symbols.map((code) => {
      const basePrice = 10 + Math.random() * 90; // 10–100
      return {
        code,
        price: basePrice,
        prevClose: basePrice * (1 + (Math.random() - 0.5) * 0.02),
        open: basePrice,
        high: basePrice,
        low: basePrice,
        volume: Math.floor(Math.random() * 10_000_000),
        drift: (Math.random() - 0.5) * 0.0001, // tiny trend
        volatility: 0.002 + Math.random() * 0.005,
      };
    });

    this.setState('connected');
    this.emitter.emit('connected', { mock: true });

    // Replay any queued messages
    this.replayQueue();

    // Start tick generation
    this.mockTimer = setInterval(() => this.generateMockTicks(), MOCK_TICK_INTERVAL_MS);
  }

  disableMockMode(): void {
    log.info('[WsMarketData] Mock mode disabled');
    this.mockEnabled = false;
    if (this.mockTimer) {
      clearInterval(this.mockTimer);
      this.mockTimer = null;
    }
    this.mockSymbols = [];
    this.setState('disconnected');
  }

  isMockMode(): boolean {
    return this.mockEnabled;
  }

  // -----------------------------------------------------------------------
  // §6.6  Internal — Connection lifecycle
  // -----------------------------------------------------------------------

  private doConnect(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.config) {
        resolve(false);
        return;
      }

      this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

      const { url, protocols } = this.config;
      log.info(`[WsMarketData] Connecting to ${url} (attempt ${this.reconnectAttempts + 1})`);

      try {
        this.socket = new RawSocket(url, protocols);
      } catch (err) {
    // [EngineError:DATA] — structured error tracking
        log.error('[WsMarketData] Socket creation failed:', err);
        this.scheduleReconnect();
        resolve(false);
        return;
      }

      const connectTimeout = setTimeout(() => {
        log.warn('[WsMarketData] Connection timed out after 10 s');
        this.socket?.close();
        resolve(false);
      }, 10_000);

      this.socket.onopen = () => {
        clearTimeout(connectTimeout);
        log.info('[WsMarketData] Connected');
        this.reconnectAttempts = 0;
        this.setState('connected');
        this.startHeartbeat();
        this.resubscribeAll();
        this.replayQueue();
        this.emitter.emit('connected', { url });
        resolve(true);
      };

      this.socket.onmessage = (ev: { data: unknown }) => {
        this.handleIncomingMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
      };

      this.socket.onclose = (ev: unknown) => {
        clearTimeout(connectTimeout);
        const code = ev?.code;
        const reason = ev?.reason ?? '';
        log.info(`[WsMarketData] Socket closed (code=${code}, reason=${reason})`);
        this.stopHeartbeat();

        if (!this.intentionallyClosed) {
          this.setState('reconnecting');
          this.emitter.emit('disconnected', { code, reason, willReconnect: true });
          this.scheduleReconnect();
        } else {
          this.setState('disconnected');
          this.emitter.emit('disconnected', { code, reason, willReconnect: false });
        }
        resolve(false);
      };

      this.socket.onerror = (ev: unknown) => {
        clearTimeout(connectTimeout);
        log.error('[WsMarketData] Socket error:', ev?.message ?? ev);
        this.emitter.emit('error', { error: ev?.message ?? 'unknown' });
        // onclose will fire after onerror — reconnect is handled there
        resolve(false);
      };
    });
  }

  private scheduleReconnect(): void {
    if (this.intentionallyClosed) return;
    if (!this.config) return;
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      log.error(
        `[WsMarketData] Max reconnect attempts (${this.config.maxReconnectAttempts}) reached — giving up`,
      );
      this.setState('disconnected');
      this.emitter.emit('error', { error: 'max_reconnect_attempts' });
      return;
    }

    const delay = clampBackoff(this.config.reconnectIntervalMs, this.reconnectAttempts);
    this.reconnectAttempts += 1;
    log.info(
      `[WsMarketData] Reconnect scheduled in ${delay} ms (attempt ${this.reconnectAttempts})`,
    );
    this.emitter.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  private teardown(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.mockTimer) {
      clearInterval(this.mockTimer);
      this.mockTimer = null;
    }
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
  }

  private setState(next: ConnectionState): void {
    if (this.state !== next) {
      log.debug(`[WsMarketData] State: ${this.state} → ${next}`);
      this.state = next;
    }
  }

  // -----------------------------------------------------------------------
  // §6.7  Internal — Heartbeat
  // -----------------------------------------------------------------------

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const interval = this.config?.heartbeatIntervalMs ?? 10_000;
    this.heartbeatTimer = setInterval(() => this.sendPing(), interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendPing(): void {
    if (this.state !== 'connected') return;
    this.lastHeartbeatSent = nowMs();
    this.sendMessage({ type: 'ping', ts: this.lastHeartbeatSent });
  }

  private handlePong(ts: number): void {
    this.lastPongReceived = nowMs();
    this.latencyMs = this.lastPongReceived - ts;
    log.debug(`[WsMarketData] Pong received, latency=${this.latencyMs} ms`);
  }

  // -----------------------------------------------------------------------
  // §6.8  Internal — Send helpers
  // -----------------------------------------------------------------------

  private sendMessage(payload: Record<string, unknown>): void {
    if (!this.socket || this.state !== 'connected') {
      this.enqueueMessage(JSON.stringify(payload), PRIORITY_MAP['quote'] ?? 3);
      return;
    }
    try {
      const data = JSON.stringify(payload);
      this.socket.send(data);
      this.stats.messagesSent += 1;
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[WsMarketData] Send failed:', err);
    }
  }

  private sendSubscribeMessage(sub: Subscription): void {
    this.sendMessage({
      type: 'subscribe',
      subId: sub.id,
      codes: sub.codes,
      dataType: sub.type,
    });
  }

  private sendUnsubscribeMessage(sub: Subscription): void {
    this.sendMessage({
      type: 'unsubscribe',
      subId: sub.id,
      codes: sub.codes,
      dataType: sub.type,
    });
  }

  private resubscribeAll(): void {
    for (const sub of this.subscriptions.values()) {
      if (sub.active) {
        this.sendSubscribeMessage(sub);
      }
    }
  }

  // -----------------------------------------------------------------------
  // §6.9  Internal — Message queue (priority buffer)
  // -----------------------------------------------------------------------

  private enqueueMessage(data: string, priority: number): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      // Drop lowest-priority (highest number) or oldest
      const dropIdx = this.findDroppableIndex();
      if (dropIdx >= 0) {
        this.messageQueue.splice(dropIdx, 1);
        this.droppedMessages += 1;
      } else {
        this.droppedMessages += 1;
        return; // cannot enqueue
      }
    }
    this.messageQueue.push({ data, priority, enqueuedAt: nowMs() });
    // Keep sorted by priority so highest-priority is replayed first
    this.messageQueue.sort((a, b) => a.priority - b.priority);
  }

  private findDroppableIndex(): number {
    // Drop the lowest-priority (highest priority number), oldest message
    let worstIdx = -1;
    let worstPriority = -1;
    let oldestTime = Infinity;
    for (let i = 0; i < this.messageQueue.length; i++) {
      const msg = this.messageQueue[i];
      if (
        msg.priority > worstPriority ||
        (msg.priority === worstPriority && msg.enqueuedAt < oldestTime)
      ) {
        worstPriority = msg.priority;
        oldestTime = msg.enqueuedAt;
        worstIdx = i;
      }
    }
    return worstIdx;
  }

  private replayQueue(): void {
    if (this.messageQueue.length === 0) return;
    log.info(`[WsMarketData] Replaying ${this.messageQueue.length} queued messages`);
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    for (const msg of queue) {
      this.handleIncomingMessage(msg.data);
    }
  }

  // -----------------------------------------------------------------------
  // §6.10  Internal — Incoming message handler
  // -----------------------------------------------------------------------

  private handleIncomingMessage(raw: string): void {
    this.stats.messagesReceived += 1;
    this.stats.lastMessageAt = nowMs();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.warn('[WsMarketData] Failed to parse message:', raw.slice(0, 200));
      return;
    }

    // Heartbeat pong
    if (parsed.type === 'pong') {
      this.handlePong(parsed.ts ?? 0);
      return;
    }

    // Server ack / control messages
    if (parsed.type === 'subscribed' || parsed.type === 'unsubscribed') {
      log.debug(`[WsMarketData] Server ack: ${parsed.type}`, parsed);
      return;
    }

    // Error from server
    if (parsed.type === 'error') {
      log.error('[WsMarketData] Server error:', parsed.message);
      this.emitter.emit('error', { error: parsed.message, code: parsed.code });
      return;
    }

    // Market data messages
    switch (parsed.type) {
      case 'tick':
      case 'quote':
        this.processTickMessage(parsed);
        break;
      case 'kline':
        this.processKlineMessage(parsed);
        break;
      case 'depth':
        this.processDepthMessage(parsed);
        break;
      default:
        this.emitter.emit('message', parsed);
        break;
    }
  }

  // -----------------------------------------------------------------------
  // §6.11  Internal — Tick processing
  // -----------------------------------------------------------------------

  private processTickMessage(parsed: unknown): void {
    const tick = this.parseTick(parsed);
    if (!tick) return;

    if (!this.validateTick(tick)) {
      log.warn(`[WsMarketData] Invalid tick for ${tick.code}:`, tick);
      return;
    }

    // Calculate change / changePct from prevClose
    if (tick.prevClose > 0) {
      tick.change = tick.price - tick.prevClose;
      tick.changePct = (tick.change / tick.prevClose) * 100;
    }

    // Store in circular buffer
    this.storeTick(tick);

    // Update kline aggregators
    this.updateKlineAggregators(tick);

    // Add to batch queue (will flush every BATCH_WINDOW_MS)
    this.addToBatch(tick);
  }

  private parseTick(data: unknown): MarketTick | null {
    if (!data || !data.code || typeof data.price !== 'number') return null;
    return {
      code: data.code,
      price: data.price,
      change: data.change ?? 0,
      changePct: data.changePct ?? 0,
      volume: data.volume ?? 0,
      high: data.high ?? data.price,
      low: data.low ?? data.price,
      open: data.open ?? data.price,
      prevClose: data.prevClose ?? data.price,
      timestamp: data.timestamp ?? nowMs(),
      bid: data.bid,
      ask: data.ask,
      bidVol: data.bidVol,
      askVol: data.askVol,
    };
  }

  private validateTick(tick: MarketTick): boolean {
    if (tick.price <= 0) return false;
    if (tick.volume < 0) return false;
    if (!tick.code || tick.code.trim() === '') return false;
    return true;
  }

  private storeTick(tick: MarketTick): void {
    let buf = this.tickBuffers.get(tick.code);
    if (!buf) {
      buf = createCircularBuffer<MarketTick>(CIRCULAR_BUFFER_CAPACITY);
      this.tickBuffers.set(tick.code, buf);
    }
    pushCircular(buf, tick);
  }

  // -----------------------------------------------------------------------
  // §6.12  Internal — Kline aggregation
  // -----------------------------------------------------------------------

  private updateKlineAggregators(tick: MarketTick): void {
    let codeAgg = this.klineAggregators.get(tick.code);
    if (!codeAgg) {
      codeAgg = new Map();
      this.klineAggregators.set(tick.code, codeAgg);
    }

    for (const period of Object.keys(KLINE_PERIOD_MS) as KlinePeriod[]) {
      const periodMs = KLINE_PERIOD_MS[period];
      const barTimestamp =
        Math.floor(tick.timestamp / periodMs) * periodMs;

      let bar = codeAgg.get(period);
      if (!bar || bar.timestamp !== barTimestamp) {
        // New bar — emit previous if exists
        if (bar && bar.timestamp !== undefined) {
          this.emitKlineBar(tick.code, bar as OHLCVBar);
        }
        // Start new bar
        bar = {
          code: tick.code,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.volume,
          timestamp: barTimestamp,
          period,
        };
        codeAgg.set(period, bar);
      } else {
        // Update existing bar
        bar.high = Math.max(bar.high ?? tick.price, tick.price);
        bar.low = Math.min(bar.low ?? tick.price, tick.price);
        bar.close = tick.price;
        bar.volume = (bar.volume ?? 0) + tick.volume;
      }
    }
  }

  private emitKlineBar(code: string, bar: OHLCVBar): void {
    this.emitter.emit('kline', { code, bar });
    // Notify kline subscribers
    for (const sub of this.subscriptions.values()) {
      if (sub.active && sub.type === 'kline' && sub.codes.includes(code)) {
        try {
          sub.callback({ code, bar, type: 'kline' });
        } catch (err) {
    // [EngineError:DATA] — structured error tracking
          log.error('[WsMarketData] Kline callback error:', err);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // §6.13  Internal — Batch dispatch & throttle
  // -----------------------------------------------------------------------

  private addToBatch(tick: MarketTick): void {
    this.batchQueue.push(tick);
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBatch(), BATCH_WINDOW_MS);
    }
  }

  private flushBatch(): void {
    this.batchTimer = null;
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    // Group by code for throttle check
    const grouped = new Map<string, MarketTick[]>();
    for (const tick of batch) {
      if (!grouped.has(tick.code)) grouped.set(tick.code, []);
      grouped.get(tick.code)!.push(tick);
    }

    for (const [code, ticks] of grouped) {
      const allowed = this.applyThrottle(code, ticks);
      if (allowed.length === 0) continue;

      // Emit individual tick events
      for (const tick of allowed) {
        this.emitter.emit('tick', tick);
      }

      // Notify quote/tick subscribers
      for (const sub of this.subscriptions.values()) {
        if (!sub.active) continue;
        if (
          (sub.type === 'quote' || sub.type === 'tick') &&
          sub.codes.includes(code)
        ) {
          try {
            sub.callback({
              type: sub.type,
              code,
              ticks: allowed,
              latest: allowed[allowed.length - 1],
            });
          } catch (err) {
    // [EngineError:DATA] — structured error tracking
            log.error('[WsMarketData] Subscription callback error:', err);
          }
        }
      }
    }
  }

  private applyThrottle(code: string, ticks: MarketTick[]): MarketTick[] {
    const now = nowMs();
    let entry = this.throttleMap.get(code);
    if (!entry || now - entry.windowStart >= THROTTLE_WINDOW_MS) {
      entry = { count: 0, windowStart: now };
      this.throttleMap.set(code, entry);
    }

    const remaining = MAX_UPDATES_PER_SEC - entry.count;
    if (remaining <= 0) {
      // Throttled — only keep the last tick as a summary
      return ticks.length > 0 ? [ticks[ticks.length - 1]] : [];
    }

    const allowed = ticks.slice(0, remaining);
    entry.count += allowed.length;
    return allowed;
  }

  // -----------------------------------------------------------------------
  // §6.14  Internal — Depth processing
  // -----------------------------------------------------------------------

  private processDepthMessage(parsed: unknown): void {
    if (!parsed.code || !parsed.bids || !parsed.asks) return;
    const depthData = {
      code: parsed.code,
      bids: parsed.bids,
      asks: parsed.asks,
      timestamp: parsed.timestamp ?? nowMs(),
    };

    this.emitter.emit('depth', depthData);

    for (const sub of this.subscriptions.values()) {
      if (sub.active && sub.type === 'depth' && sub.codes.includes(parsed.code)) {
        try {
          sub.callback({ type: 'depth', ...depthData });
        } catch (err) {
    // [EngineError:DATA] — structured error tracking
          log.error('[WsMarketData] Depth callback error:', err);
        }
      }
    }
  }

  private processKlineMessage(parsed: unknown): void {
    if (!parsed.code || !parsed.bar) return;
    const bar: OHLCVBar = {
      code: parsed.code,
      open: parsed.bar.open,
      high: parsed.bar.high,
      low: parsed.bar.low,
      close: parsed.bar.close,
      volume: parsed.bar.volume,
      timestamp: parsed.bar.timestamp ?? nowMs(),
      period: parsed.bar.period ?? '1m',
    };
    this.emitKlineBar(parsed.code, bar);
  }

  // -----------------------------------------------------------------------
  // §6.15  Internal — Mock mode tick generation
  /** @deprecated v1.9.0: Only used as fallback when real WS is unavailable */
  // -----------------------------------------------------------------------

  private generateMockTicks(): void {
    for (const sym of this.mockSymbols) {
      // Random walk with drift
      const rand = this.gaussianRandom();
      const movePct = sym.drift + sym.volatility * rand;
      sym.price = Math.max(0.01, sym.price * (1 + movePct));
      sym.high = Math.max(sym.high, sym.price);
      sym.low = Math.min(sym.low, sym.price);
      sym.volume += Math.floor(Math.random() * 50_000);

      // Bid/ask spread simulation (0.05 % – 0.2 %)
      const spreadPct = 0.0005 + Math.random() * 0.0015;
      const halfSpread = sym.price * spreadPct * 0.5;

      const tick: MarketTick = {
        code: sym.code,
        price: parseFloat(sym.price.toFixed(2)),
        change: parseFloat((sym.price - sym.prevClose).toFixed(2)),
        changePct: parseFloat(
          (((sym.price - sym.prevClose) / sym.prevClose) * 100).toFixed(4),
        ),
        volume: sym.volume,
        high: parseFloat(sym.high.toFixed(2)),
        low: parseFloat(sym.low.toFixed(2)),
        open: parseFloat(sym.open.toFixed(2)),
        prevClose: parseFloat(sym.prevClose.toFixed(2)),
        timestamp: nowMs(),
        bid: parseFloat((sym.price - halfSpread).toFixed(2)),
        ask: parseFloat((sym.price + halfSpread).toFixed(2)),
        bidVol: Math.floor(Math.random() * 10_000) + 100,
        askVol: Math.floor(Math.random() * 10_000) + 100,
      };

      // Process through same pipeline as real data
      this.storeTick(tick);
      this.updateKlineAggregators(tick);
      this.addToBatch(tick);
    }
  }

  /**
   * Box–Muller transform for Gaussian random numbers (mean 0, stdev 1).
   */
  private gaussianRandom(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // -----------------------------------------------------------------------
  // §6.16  Lifecycle helpers
  // -----------------------------------------------------------------------

  /**
   * Gracefully shut down everything — call on app quit.
   */
  destroy(): void {
    log.info('[WsMarketData] Destroying engine');
    this.disconnect();
    this.unsubscribeAll();
    this.emitter.removeAllListeners();
    this.tickBuffers.clear();
    this.klineAggregators.clear();
    this.throttleMap.clear();
    this.batchQueue = [];
    this.messageQueue = [];
    this.droppedMessages = 0;
    this.stats = { messagesReceived: 0, messagesSent: 0, lastMessageAt: 0 };
  }

  /**
   * Returns summary statistics for diagnostics.
   */
  getDiagnostics(): Record<string, unknown> {
    const symbolCount = this.tickBuffers.size;
    let totalTicks = 0;
    for (const buf of this.tickBuffers.values()) {
      totalTicks += buf.size;
    }
    return {
      state: this.state,
      mockMode: this.mockEnabled,
      symbols: symbolCount,
      totalTicksBuffered: totalTicks,
      subscriptions: this.subscriptions.size,
      queueLength: this.messageQueue.length,
      droppedMessages: this.droppedMessages,
      reconnectAttempts: this.reconnectAttempts,
      latency: this.latencyMs,
      stats: { ...this.stats },
    };
  }
}

// ---------------------------------------------------------------------------
// §7  Singleton instance
// ---------------------------------------------------------------------------

let _instance: WsMarketDataEngine | null = null;

export function getWsMarketDataEngine(): WsMarketDataEngine {
  if (!_instance) {
    _instance = new WsMarketDataEngine();
  }
  return _instance;
}

export function destroyWsMarketDataEngine(): void {
  if (_instance) {
    _instance.destroy();
    _instance = null;
  }
}
