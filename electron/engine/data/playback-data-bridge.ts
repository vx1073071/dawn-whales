/**
 * R262: PlaybackDataBridge — 回放引擎→UI数据通道
 * 
 * 行情回放数据桥接: 历史tick → 前端回放控制条/时间轴
 * 
 * 功能:
 *   1. 历史行情数据回放 (tick级/分钟级/日级)
 *   2. 回放控制 (播放/暂停/快进/慢放/步进)
 *   3. 时间轴数据 (价格走势/成交量柱/标记事件)
 *   4. 回放进度与统计数据
 *   5. 多周期回放 (1m/5m/15m/1h/1d)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4 | 8 | 16 | 32;
export type PlaybackState = 'stopped' | 'playing' | 'paused' | 'seeking';

export interface PlaybackTick {
  tickId: string;
  sequence: number;
  timestamp: number;
  price: number;
  volume: number;
  bid?: number;
  ask?: number;
}

export interface PlaybackCandle {
  candleId: string;
  interval: string;        // 1m/5m/15m/1h/1d
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tickCount: number;
}

export interface PlaybackMarker {
  markerId: string;
  timestamp: number;
  type: 'event' | 'alert' | 'news' | 'strategy' | 'crash' | 'signal';
  label: string;
  labelCn: string;
  severity: 'low' | 'medium' | 'high';
  metadata?: Record<string, string>;
}

export interface PlaybackSession {
  sessionId: string;
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  totalTicks: number;
  currentTick: number;
  currentTime: number;
  currentPrice: number;
  speed: PlaybackSpeed;
  state: PlaybackState;
  progress: number;        // 0-1
  markers: PlaybackMarker[];
  candles: PlaybackCandle[];
  sessionStats: PlaybackStats;
}

export interface PlaybackStats {
  totalTicks: number;
  totalVolume: number;
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  closePrice: number;
  changePercent: number;
  maxChange: number;       // maximum % change from open
  volatilePeriods: number; // >2σ moves
}

export interface PlaybackFrame {
  frameId: string;
  sessionId: string;
  sequence: number;
  timestamp: number;
  price: number;
  volume: number;
  candle?: PlaybackCandle;
  markers: PlaybackMarker[];
  speed: PlaybackSpeed;
  state: PlaybackState;
}

// ═══════════════════════════════════════════════════════════════════════════
// PlaybackDataBridge
// ═══════════════════════════════════════════════════════════════════════════

export class PlaybackDataBridge {
  private ticks: Map<string, PlaybackTick[]> = new Map();
  private sessions: Map<string, PlaybackSession> = new Map();
  private markers: Map<string, PlaybackMarker[]> = new Map();
  private currentFrame: PlaybackFrame | null = null;

  constructor() {}

  // ── Public API: Data Loading ────────────────────────────────────────────

  /**
   * Load historical tick data into the bridge.
   */
  loadTicks(symbol: string, ticks: Array<{
    timestamp: number; price: number; volume: number; bid?: number; ask?: number;
  }>): PlaybackTick[] {
    const result: PlaybackTick[] = ticks.map((t, i) => ({
      tickId: `ptick:${symbol}:${i}`,
      sequence: i,
      ...t,
    }));

    this.ticks.set(symbol, result);
    return result;
  }

  /**
   * Load candle data from historical ticks.
   */
  loadCandles(symbol: string, interval = '1m'): PlaybackCandle[] {
    const allTicks = this.ticks.get(symbol);
    if (!allTicks || allTicks.length === 0) return [];

    const intervalMs = this._parseIntervalMs(interval);
    const candles: PlaybackCandle[] = [];
    let currentCandle: Partial<PlaybackCandle> | null = null;

    for (const tick of allTicks) {
      const bucket = Math.floor(tick.timestamp / intervalMs) * intervalMs;

      if (!currentCandle || currentCandle.openTime !== bucket) {
        if (currentCandle && currentCandle.tickCount! > 0) {
          candles.push(currentCandle as PlaybackCandle);
        }

        currentCandle = {
          candleId: `c:${symbol}:${interval}:${bucket}`,
          interval,
          openTime: bucket,
          closeTime: bucket + intervalMs - 1,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.volume,
          tickCount: 1,
        };
      } else {
        currentCandle.high = Math.max(currentCandle.high!, tick.price);
        currentCandle.low = Math.min(currentCandle.low!, tick.price);
        currentCandle.close = tick.price;
        currentCandle.volume = (currentCandle.volume ?? 0) + tick.volume;
        currentCandle.tickCount = (currentCandle.tickCount ?? 0) + 1;
      }
    }

    if (currentCandle && currentCandle.tickCount! > 0) {
      candles.push(currentCandle as PlaybackCandle);
    }

    return candles;
  }

  // ── Public API: Markers ─────────────────────────────────────────────────

  /**
   * Add a marker at a specific timestamp.
   */
  addMarker(symbol: string, marker: Omit<PlaybackMarker, 'markerId'>): PlaybackMarker {
    const m: PlaybackMarker = {
      markerId: `pmkr:${symbol}:${marker.type}:${marker.timestamp}`,
      ...marker,
    };

    const symMarkers = this.markers.get(symbol) ?? [];
    symMarkers.push(m);
    symMarkers.sort((a, b) => a.timestamp - b.timestamp);
    this.markers.set(symbol, symMarkers);

    return m;
  }

  /**
   * Add batch markers for events/alerts.
   */
  addMarkers(symbol: string, markers: Array<Omit<PlaybackMarker, 'markerId'>>): PlaybackMarker[] {
    return markers.map(m => this.addMarker(symbol, m));
  }

  // ── Public API: Session Management ──────────────────────────────────────

  /**
   * Create a playback session.
   */
  createSession(symbol: string, interval = '1m'): PlaybackSession | null {
    const allTicks = this.ticks.get(symbol);
    if (!allTicks || allTicks.length === 0) return null;

    const candles = this.loadCandles(symbol, interval);
    const symMarkers = this.markers.get(symbol) ?? [];

    const openPrice = allTicks[0].price;
    const closePrice = allTicks[allTicks.length - 1].price;
    const changePercent = ((closePrice - openPrice) / openPrice) * 100;

    // Calculate field-based stats (use method for high/low)
    const stats = this._calculateStats(allTicks);

    const session: PlaybackSession = {
      sessionId: `pbsess:${symbol}:${interval}:${Date.now()}`,
      symbol,
      interval,
      startTime: allTicks[0].timestamp,
      endTime: allTicks[allTicks.length - 1].timestamp,
      totalTicks: allTicks.length,
      currentTick: 0,
      currentTime: allTicks[0].timestamp,
      currentPrice: openPrice,
      speed: 1,
      state: 'stopped',
      progress: 0,
      markers: symMarkers,
      candles,
      sessionStats: stats,
    };

    this.sessions.set(session.sessionId, session);
    return session;
  }

  // ── Public API: Playback Control ────────────────────────────────────────

  /**
   * Get the next frame of playback.
   */
  nextFrame(sessionId: string): PlaybackFrame | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'playing') return null;

    const allTicks = this.ticks.get(session.symbol);
    if (!allTicks) return null;

    // Advance by speed
    const step = Math.max(1, Math.round(session.speed));
    session.currentTick = Math.min(session.totalTicks - 1, session.currentTick + step);
    const tick = allTicks[session.currentTick];

    session.currentTime = tick.timestamp;
    session.currentPrice = tick.price;
    session.progress = session.totalTicks > 0 ? session.currentTick / (session.totalTicks - 1) : 0;

    if (session.currentTick >= session.totalTicks - 1) {
      session.state = 'stopped';
      session.progress = 1;
    }

    // Get matching candle and markers
    const candle = session.candles.find(c => tick.timestamp >= c.openTime && tick.timestamp <= c.closeTime);
    const frameMarkers = session.markers.filter(m =>
      Math.abs(m.timestamp - tick.timestamp) < this._parseIntervalMs(session.interval)
    );

    const frame: PlaybackFrame = {
      frameId: `pframe:${sessionId}:${session.currentTick}`,
      sessionId,
      sequence: session.currentTick,
      timestamp: tick.timestamp,
      price: tick.price,
      volume: tick.volume,
      candle,
      markers: frameMarkers,
      speed: session.speed,
      state: session.state,
    };

    this.currentFrame = frame;
    return frame;
  }

  /** Start playback */
  play(sessionId: string, speed: PlaybackSpeed = 1): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.state = 'playing';
    session.speed = speed;
    return true;
  }

  /** Pause playback */
  pause(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.state = 'paused';
    return true;
  }

  /** Stop playback */
  stop(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.state = 'stopped';
    session.currentTick = 0;
    session.progress = 0;
    return true;
  }

  /** Seek to a specific tick index */
  seek(sessionId: string, tickIndex: number): PlaybackFrame | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const allTicks = this.ticks.get(session.symbol);
    if (!allTicks) return null;

    session.currentTick = Math.max(0, Math.min(tickIndex, session.totalTicks - 1));
    const tick = allTicks[session.currentTick];
    session.currentTime = tick.timestamp;
    session.currentPrice = tick.price;
    session.progress = session.totalTicks > 0 ? session.currentTick / (session.totalTicks - 1) : 0;
    session.state = 'seeking';

    return {
      frameId: `pframe:${sessionId}:${session.currentTick}`,
      sessionId,
      sequence: session.currentTick,
      timestamp: tick.timestamp,
      price: tick.price,
      volume: tick.volume,
      markers: session.markers.filter(m => Math.abs(m.timestamp - tick.timestamp) < 60_000),
      speed: session.speed,
      state: session.state,
    };
  }

  /** Set playback speed */
  setSpeed(sessionId: string, speed: PlaybackSpeed): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.speed = speed;
    return true;
  }

  // ── Public API: Time Axis Data ──────────────────────────────────────────

  /**
   * Get time-axis data for rendering frontend chart.
   */
  getTimeAxis(sessionId: string): Array<{ time: number; price: number; volume: number }> | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const allTicks = this.ticks.get(session.symbol);
    if (!allTicks) return null;

    // Return candles or sampled ticks
    if (session.candles.length > 0 && session.candles.length < 500) {
      return session.candles.map(c => ({
        time: c.openTime,
        price: c.close,
        volume: c.volume,
      }));
    }

    // Sample ticks for large datasets
    const step = Math.max(1, Math.floor(allTicks.length / 500));
    return allTicks.filter((_, i) => i % step === 0).map(t => ({
      time: t.timestamp,
      price: t.price,
      volume: t.volume,
    }));
  }

  /**
   * Get markers for time axis visualization.
   */
  getMarkersForDisplay(sessionId: string): PlaybackMarker[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return session.markers;
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get session */
  getSession(sessionId: string): PlaybackSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /** Get current frame */
  getCurrentFrame(): PlaybackFrame | null { return this.currentFrame; }

  /** Get loaded symbols */
  getLoadedSymbols(): string[] { return Array.from(this.ticks.keys()); }

  /** Get tick count for a symbol */
  getTickCount(symbol: string): number {
    return this.ticks.get(symbol)?.length ?? 0;
  }

  /** Reset */
  reset(): void {
    this.ticks.clear();
    this.sessions.clear();
    this.markers.clear();
    this.currentFrame = null;
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _calculateStats(allTicks: PlaybackTick[]): PlaybackStats {
    let highPrice = -Infinity;
    let lowPrice = Infinity;
    let totalVolume = 0;
    let maxChange = 0;
    let volatilePeriods = 0;

    const openPrice = allTicks[0].price;
    const closePrice = allTicks[allTicks.length - 1].price;

    for (const tick of allTicks) {
      highPrice = Math.max(highPrice, tick.price);
      lowPrice = Math.min(lowPrice, tick.price);
      totalVolume += tick.volume;

      const changeFromOpen = Math.abs((tick.price - openPrice) / openPrice * 100);
      maxChange = Math.max(maxChange, changeFromOpen);
    }

    // Simple volatility: count ticks > 2σ from mean
    const prices = allTicks.map(t => t.price);
    const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
    const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const changePercent = ((closePrice - openPrice) / openPrice) * 100;

    volatilePeriods = prices.filter(p => Math.abs(p - mean) > 2 * stdDev).length;

    return {
      totalTicks: allTicks.length,
      totalVolume: Math.round(totalVolume),
      highPrice: Math.round(highPrice * 100) / 100,
      lowPrice: Math.round(lowPrice * 100) / 100,
      openPrice: Math.round(openPrice * 100) / 100,
      closePrice: Math.round(closePrice * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      maxChange: Math.round(maxChange * 100) / 100,
      volatilePeriods,
    };
  }

  private _parseIntervalMs(interval: string): number {
    const num = parseInt(interval);
    if (interval.endsWith('s')) return num * 1000;
    if (interval.endsWith('m')) return num * 60_000;
    if (interval.endsWith('h')) return num * 3_600_000;
    if (interval.endsWith('d')) return num * 86_400_000;
    return 60_000; // default 1m
  }
}

export const playbackDataBridge = new PlaybackDataBridge();
