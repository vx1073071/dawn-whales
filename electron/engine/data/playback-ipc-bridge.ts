/**
 * R264: PlaybackIpcBridge — 回放引擎→UI IPC桥接
 * 
 * 将 playback-data-bridge 输出接入前端回放UI
 * 
 * 功能:
 *   1. 回放帧→IPC实时推送到UI
 *   2. 控制条IPC同步 (播放/暂停/快进/步进)
 *   3. 时间轴高亮标记事件注入
 *   4. 回放进度/统计实时更新
 *   5. 多会话管理IPC
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlaybackFrameIpc {
  frameId: string;
  sessionId: string;
  symbol: string;
  sequence: number;
  timestamp: number;
  price: number;
  volume: number;
  candle?: {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  markers: PlaybackMarkerIpc[];
  speed: number;
  state: string;
  progress: number;
}

export interface PlaybackMarkerIpc {
  markerId: string;
  time: number;
  type: string;
  label: string;
  labelCn: string;
  severity: string;
  color: string;
}

export interface PlaybackControlIpc {
  sessionId: string;
  action: 'play' | 'pause' | 'stop' | 'seek' | 'speed';
  params: {
    speed?: number;
    tickIndex?: number;
  };
  requestId: string;
  timestamp: number;
}

export interface PlaybackTimelineIpc {
  sessionId: string;
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  data: Array<{ time: number; price: number; volume: number }>;
  markers: PlaybackMarkerIpc[];
  stats: {
    totalTicks: number;
    highPrice: number;
    lowPrice: number;
    openPrice: number;
    closePrice: number;
    changePercent: number;
    maxChange: number;
  };
}

export interface PlaybackSessionIpc {
  sessionId: string;
  symbol: string;
  interval: string;
  state: string;
  progress: number;
  currentTime: number;
  currentPrice: number;
  speed: number;
  totalTicks: number;
  totalDuration: number;
}

// ── Marker color mapping ───────────────────────────────────────────────────

const MARKER_COLORS: Record<string, string> = {
  event: '#3b82f6',
  alert: '#ef4444',
  news: '#f59e0b',
  strategy: '#22c55e',
  crash: '#dc2626',
  signal: '#8b5cf6',
};

// ═══════════════════════════════════════════════════════════════════════════
// PlaybackIpcBridge
// ═══════════════════════════════════════════════════════════════════════════

export class PlaybackIpcBridge {
  private sessions: Map<string, PlaybackSessionIpc> = new Map();
  private timelines: Map<string, PlaybackTimelineIpc> = new Map();
  private frameQueue: Map<string, PlaybackFrameIpc[]> = new Map();
  private controlQueue: PlaybackControlIpc[] = [];
  private stats_ = {
    totalFrames: 0,
    totalSessions: 0,
    avgFrameIntervalMs: 0,
  };

  constructor() {}

  // ── Public API: Session Registration ────────────────────────────────────

  /**
   * Register a playback session for IPC.
   */
  registerSession(params: {
    sessionId: string;
    symbol: string;
    interval: string;
    totalTicks: number;
    startTime: number;
    endTime: number;
  }): PlaybackSessionIpc {
    const session: PlaybackSessionIpc = {
      sessionId: params.sessionId,
      symbol: params.symbol,
      interval: params.interval,
      state: 'stopped',
      progress: 0,
      currentTime: params.startTime,
      currentPrice: 0,
      speed: 1,
      totalTicks: params.totalTicks,
      totalDuration: params.endTime - params.startTime,
    };

    this.sessions.set(session.sessionId, session);
    this.stats_.totalSessions++;
    return session;
  }

  // ── Public API: Frame Push ──────────────────────────────────────────────

  /**
   * Push a playback frame to IPC → frontend.
   */
  pushFrame(params: {
    sessionId: string;
    symbol: string;
    sequence: number;
    timestamp: number;
    price: number;
    volume: number;
    state: string;
    speed: number;
    progress: number;
    markers?: PlaybackMarkerIpc[];
    candle?: PlaybackFrameIpc['candle'];
  }): PlaybackFrameIpc {
    const frame: PlaybackFrameIpc = {
      frameId: `ipcframe:${params.sessionId}:${params.sequence}`,
      sessionId: params.sessionId,
      symbol: params.symbol,
      sequence: params.sequence,
      timestamp: params.timestamp,
      price: params.price,
      volume: params.volume,
      candle: params.candle,
      markers: params.markers ?? [],
      speed: params.speed,
      state: params.state,
      progress: params.progress,
    };

    // Queue frame for this session
    const queue = this.frameQueue.get(params.sessionId) ?? [];
    queue.push(frame);
    if (queue.length > 100) queue.shift();
    this.frameQueue.set(params.sessionId, queue);

    this.stats_.totalFrames++;

    // Update session state
    const session = this.sessions.get(params.sessionId);
    if (session) {
      session.state = params.state;
      session.progress = params.progress;
      session.currentTime = params.timestamp;
      session.currentPrice = params.price;
      session.speed = params.speed;
    }

    return frame;
  }

  // ── Public API: Timeline ────────────────────────────────────────────────

  /**
   * Register timeline data for a session.
   */
  registerTimeline(params: {
    sessionId: string;
    symbol: string;
    interval: string;
    startTime: number;
    endTime: number;
    data: Array<{ time: number; price: number; volume: number }>;
    markers: PlaybackMarkerIpc[];
    stats: PlaybackTimelineIpc['stats'];
  }): PlaybackTimelineIpc {
    const timeline: PlaybackTimelineIpc = {
      ...params,
    };
    this.timelines.set(params.sessionId, timeline);
    return timeline;
  }

  /**
   * Get timeline for a session.
   */
  getTimeline(sessionId: string): PlaybackTimelineIpc | null {
    return this.timelines.get(sessionId) ?? null;
  }

  // ── Public API: Control ─────────────────────────────────────────────────

  /**
   * Handle a control action from UI → bridge.
   */
  handleControl(action: PlaybackControlIpc): {
    accepted: boolean;
    session: PlaybackSessionIpc | null;
    error?: string;
  } {
    this.controlQueue.push(action);

    const session = this.sessions.get(action.sessionId);
    if (!session) {
      return { accepted: false, session: null, error: 'Session not found' };
    }

    switch (action.action) {
      case 'play':
        session.state = 'playing';
        session.speed = action.params.speed ?? 1;
        break;
      case 'pause':
        session.state = 'paused';
        break;
      case 'stop':
        session.state = 'stopped';
        session.progress = 0;
        break;
      case 'seek':
        session.progress = action.params.tickIndex !== undefined
          ? action.params.tickIndex / session.totalTicks : session.progress;
        break;
      case 'speed':
        session.speed = action.params.speed ?? 1;
        break;
    }

    return { accepted: true, session };
  }

  // ── Public API: Marker Formatting ────────────────────────────────────────

  /**
   * Format raw markers to IPC-safe format with colors.
   */
  formatMarkers(markers: Array<{
    markerId: string;
    time: number;
    type: string;
    label: string;
    labelCn: string;
    severity: string;
  }>): PlaybackMarkerIpc[] {
    return markers.map(m => ({
      ...m,
      color: MARKER_COLORS[m.type] ?? '#6b7280',
    }));
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get session */
  getSession(sessionId: string): PlaybackSessionIpc | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /** Get all sessions */
  getSessions(): PlaybackSessionIpc[] {
    return Array.from(this.sessions.values());
  }

  /** Get recent frames for a session */
  getFrames(sessionId: string, limit = 50): PlaybackFrameIpc[] {
    const queue = this.frameQueue.get(sessionId);
    if (!queue) return [];
    return queue.slice(-limit).reverse();
  }

  /** Get pending control actions */
  getControlQueue(limit = 20): PlaybackControlIpc[] {
    return this.controlQueue.slice(-limit).reverse();
  }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset */
  reset(): void {
    this.sessions.clear();
    this.timelines.clear();
    this.frameQueue.clear();
    this.controlQueue = [];
    this.stats_ = { totalFrames: 0, totalSessions: 0, avgFrameIntervalMs: 0 };
  }
}

export const playbackIpcBridge = new PlaybackIpcBridge();
