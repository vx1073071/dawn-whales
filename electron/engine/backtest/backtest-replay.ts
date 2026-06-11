/**
 * backtest-replay.ts
 * K-line Replay Engine — K
 *
 * 、settings、/
 * EventEmitter polyfill jsdom （ Node 'events' module
 *
 * @module electron/engine/backtest-replay
 */

import log from 'electron-log';
import { EngineError } from '../core/engine-error';

// ─── Inline EventEmitter Polyfill (jsdom-compatible) ──────────────────────────

type EventHandler = (...args: unknown[]) => void;

class EventEmitter {
  private _listeners: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): this {
    const list = this._listeners.get(event);
    if (list) {
      list.push(handler);
    } else {
      this._listeners.set(event, [handler]);
    }
    return this;
  }

  off(event: string, handler: EventHandler): this {
    const list = this._listeners.get(event);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
      if (list.length === 0) {
        this._listeners.delete(event);
      }
    }
    return this;
  }

  once(event: string, handler: EventHandler): this {
    const wrapper: EventHandler = (...args: unknown[]) => {
      this.off(event, wrapper);
      handler(...args);
    };
    this.on(event, wrapper);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) {
      return false;
    }
    // Copy to avoid mutation during iteration
    const snapshot = [...list];
    for (const handler of snapshot) {
      try {
        handler(...args);
      } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
        void EngineError; // structured error domain: SYSTEM
        log.error('[BacktestReplay] Event handler error:', err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event !== undefined) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReplaySpeed = 0.5 | 1 | 2 | 5 | 10 | 25 | 50 | 100 | 'MAX';
export type ReplayState = 'idle' | 'playing' | 'paused' | 'completed' | 'error';
export type BreakpointType = 'price_above' | 'price_below' | 'volume_spike' | 'custom';

export interface KlineBar {
  /** Unix timestamp in milliseconds */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Breakpoint {
  id: string;
  type: BreakpointType;
  condition: (bar: KlineBar, index: number) => boolean;
  label: string;
  enabled: boolean;
}

export interface ReplayConfig {
  speed: ReplaySpeed;
  autoPlay: boolean;
  loopEnabled: boolean;
  breakpoints: Breakpoint[];
}

export interface ReplayProgress {
  currentIndex: number;
  totalBars: number;
  progressPct: number;
  currentBar: KlineBar | null;
  state: ReplayState;
  speed: ReplaySpeed;
  /** Total elapsed wall-clock time since first play() in current session (ms) */
  elapsedMs: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default interval (ms) per bar at 1x speed */
const BASE_INTERVAL_MS = 500;

/** Minimum interval (ms) — cap for MAX speed */
const MIN_INTERVAL_MS = 5;

/** Valid speed values for validation */
const VALID_SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 5, 10, 25, 50, 100, 'MAX'];

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Compute the timer interval in ms for a given speed.
 * 'MAX' uses the minimum interval cap.
 */
function speedToInterval(speed: ReplaySpeed): number {
  if (speed === 'MAX') {
    return MIN_INTERVAL_MS;
  }
  // Higher speed → shorter interval
  return Math.max(MIN_INTERVAL_MS, Math.round(BASE_INTERVAL_MS / speed));
}

/**
 * Validate and clamp an index to valid range [0, length-1].
 */
function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class BacktestReplayEngine extends EventEmitter {
  // ── State ────────────────────────────────────────────────────────────────

  private _klines: KlineBar[] = [];
  // 0-based cursor: -1 = nothing emitted yet, N = bar[N] was last emitted.
  private _currentIndex = -1;
  private _state: ReplayState = 'idle';
  private _speed: ReplaySpeed = 1;
  private _loopEnabled = false;
  private _autoPlay = false;
  private _breakpoints: Breakpoint[] = [];
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _sessionStartMs: number | null = null;
  private _accumulatedMs = 0;

  // ── Constructor ──────────────────────────────────────────────────────────

  constructor(config?: Partial<ReplayConfig>) {
    super();
    if (config) {
      if (config.speed !== undefined) {
        this._speed = config.speed;
      }
      if (config.autoPlay !== undefined) {
        this._autoPlay = config.autoPlay;
      }
      if (config.loopEnabled !== undefined) {
        this._loopEnabled = config.loopEnabled;
      }
      if (config.breakpoints) {
        this._breakpoints = [...config.breakpoints];
      }
    }
    log.info('[BacktestReplay] Engine initialised', {
      speed: this._speed,
      autoPlay: this._autoPlay,
      loopEnabled: this._loopEnabled,
    });
  }

  // ── Data Loading ─────────────────────────────────────────────────────────

  /**
   * Load K-line data into the engine. Resets all playback state.
   * Bars are sorted ascending by time automatically.
   *
   * @param klines - Array of OHLCV bars
   */
  public load(klines: KlineBar[]): void {
    if (!klines || klines.length === 0) {
      log.warn('[BacktestReplay] load() called with empty data');
      this._klines = [];
      this._resetInternal();
      return;
    }

    // Sort ascending by time
    this._klines = [...klines].sort((a, b) => a.time - b.time);
    this._resetInternal();

    log.info('[BacktestReplay] Loaded %d bars, range: %d → %d',
      this._klines.length,
      this._klines[0].time,
      this._klines[this._klines.length - 1].time,
    );

    if (this._autoPlay) {
      this.play();
    }
  }

  // ── Playback Controls ────────────────────────────────────────────────────

  /**
   * Start or resume playback.
   * If the engine is idle, starts from index 0.
   * If paused, resumes from current position.
   * If completed, restarts from the beginning (or does nothing if loop is off and already at end).
   */
  public play(): void {
    if (this._klines.length === 0) {
      log.warn('[BacktestReplay] play() — no data loaded');
      this._state = 'error';
      return;
    }

    if (this._state === 'playing') {
      log.debug('[BacktestReplay] play() — already playing');
      return;
    }

    // If completed or idle, start from the beginning
    if (this._state === 'idle' || this._state === 'completed') {
      this._currentIndex = -1;
      this._accumulatedMs = 0;
    }

    if (this._sessionStartMs === null) {
      this._sessionStartMs = Date.now();
    }

    this._state = 'playing';
    this.emit('playback-started', this.getProgress());
    log.info('[BacktestReplay] Playback started at speed %s', this._speed);
    this._scheduleNextTick();
  }

  /**
   * Pause playback. No-op if not currently playing.
   */
  public pause(): void {
    if (this._state !== 'playing') {
      return;
    }

    this._clearTimer();
    this._state = 'paused';

    // Accumulate elapsed time
    if (this._sessionStartMs !== null) {
      this._accumulatedMs += Date.now() - this._sessionStartMs;
      this._sessionStartMs = null;
    }

    this.emit('playback-paused', this.getProgress());
    log.info('[BacktestReplay] Playback paused at index %d', this._currentIndex);
  }

  /**
   * Stop playback entirely and rewind to the beginning.
   */
  public stop(): void {
    this._clearTimer();
    this._currentIndex = -1;
    this._state = 'idle';
    this._sessionStartMs = null;
    this._accumulatedMs = 0;
    log.info('[BacktestReplay] Playback stopped');
  }

  // ── Stepping ─────────────────────────────────────────────────────────────

  /**
   * Advance forward by `count` bars (default 1).
   * Automatically pauses if currently playing.
   *
   * @returns Array of bars advanced through (may be fewer if reaching end)
   */
  public stepForward(count: number = 1): KlineBar[] {
    if (this._klines.length === 0) return [];

    // Pause if playing
    if (this._state === 'playing') {
      this.pause();
    }

    if (this._state === 'idle' || this._state === 'completed') {
      this._currentIndex = -1;
      this._state = 'paused';
    }

    const stepped: KlineBar[] = [];
    for (let i = 0; i < count; i++) {
      // 0-based: -1 = nothing emitted, N = bar[N] was last emitted.
      // nextIdx is the index of the next bar to emit.
      const nextIdx = this._currentIndex + 1;
      if (nextIdx >= this._klines.length) {
        break;
      }
      const bar = this._klines[nextIdx];
      this._currentIndex = nextIdx;
      stepped.push(bar);
      this._emitBar(bar);
      this._checkBreakpoints(bar, nextIdx);
    }

    // Check if we reached the end
    if (this._currentIndex >= this._klines.length - 1) {
      this._handleEnd();
    } else if (this._state !== 'paused') {
      this._state = 'paused';
    }

    return stepped;
  }

  /**
   * Step backward by `count` bars (default 1).
   * Automatically pauses if currently playing.
   *
   * @returns Array of bars traversed backward (in reverse order, newest first)
   */
  public stepBackward(count: number = 1): KlineBar[] {
    if (this._klines.length === 0) return [];

    // Pause if playing
    if (this._state === 'playing') {
      this.pause();
    }

    if (this._state === 'idle' || this._currentIndex === 0) {
      // Nothing to step back from
      return [];
    }

    const stepped: KlineBar[] = [];
    for (let i = 0; i < count; i++) {
      if (this._currentIndex <= 0) {
        break;
      }
      this._currentIndex--;
      const bar = this._klines[this._currentIndex];
      stepped.push(bar);
      this._emitBar(bar);
    }

    if (this._state !== 'paused') {
      this._state = 'paused';
    }

    return stepped;
  }

  // ── Seeking ──────────────────────────────────────────────────────────────

  /**
   * Jump to a specific bar index. Out-of-bounds indices are clamped to the
   * last bar (caller-expected behavior); only `index < 0` returns null.
   *
   * @param index - Target index. Negative returns `null`. Values beyond the
   *   last bar are clamped.
   * @returns The bar at the (clamped) target index, or `null` if `index < 0`
   */
  public seekTo(index: number): KlineBar | null {
    if (this._klines.length === 0) return null;
    if (index < 0) return null;
    const targetIdx = Math.min(index, this._klines.length - 1);

    const wasPlaying = this._state === 'playing';
    if (wasPlaying) {
      this._clearTimer();
    }

    this._currentIndex = targetIdx;
    const bar = this._klines[targetIdx];
    this._emitBar(bar);

    // If we landed on the last bar, handle completion
    if (targetIdx >= this._klines.length - 1) {
      this._handleEnd();
    } else if (wasPlaying) {
      this._scheduleNextTick();
    }

    return bar;
  }

  // ── Speed Control ────────────────────────────────────────────────────────

  /**
   * Change the playback speed.
   * Takes effect immediately if currently playing.
   */
  public setSpeed(speed: ReplaySpeed): void {
    if (!VALID_SPEEDS.includes(speed)) {
      log.warn('[BacktestReplay] setSpeed() — invalid speed: %s', speed);
      return;
    }

    const oldSpeed = this._speed;
    this._speed = speed;
    this.emit('speed-changed', { oldSpeed, newSpeed: speed });
    log.info('[BacktestReplay] Speed changed: %s → %s', oldSpeed, speed);

    // If currently playing, reschedule with new interval
    if (this._state === 'playing') {
      this._clearTimer();
      this._scheduleNextTick();
    }
  }

  // ── Breakpoints ──────────────────────────────────────────────────────────

  /**
   * Add a breakpoint. During playback, when a bar satisfies the breakpoint
   * condition, the engine pauses and emits 'breakpoint-hit'.
   */
  public addBreakpoint(bp: Breakpoint): void {
    if (!bp.id || !bp.condition) {
      log.warn('[BacktestReplay] addBreakpoint() — invalid breakpoint (missing id or condition)');
      return;
    }
    // Prevent duplicate IDs
    const existing = this._breakpoints.findIndex((b) => b.id === bp.id);
    if (existing !== -1) {
      this._breakpoints[existing] = bp;
      log.info('[BacktestReplay] Breakpoint updated: %s', bp.id);
    } else {
      this._breakpoints.push(bp);
      log.info('[BacktestReplay] Breakpoint added: %s (%s)', bp.id, bp.label);
    }
  }

  /**
   * Remove a breakpoint by ID.
   *
   * @returns `true` if the breakpoint was found and removed
   */
  public removeBreakpoint(id: string): boolean {
    const idx = this._breakpoints.findIndex((bp) => bp.id === id);
    if (idx === -1) {
      return false;
    }
    this._breakpoints.splice(idx, 1);
    log.info('[BacktestReplay] Breakpoint removed: %s', id);
    return true;
  }

  /**
   * Find the next breakpoint that would be hit from the current position.
   * Scans forward from `currentIndex + 1`.
   *
   * @returns Object with the bar index and matching breakpoint, or `null` if none found
   */
  public getNextBreakpoint(): { index: number; breakpoint: Breakpoint } | null {
    if (this._klines.length === 0 || this._breakpoints.length === 0) {
      return null;
    }

    const startIdx = Math.max(0, this._currentIndex + 1);
    const enabledBps = this._breakpoints.filter((bp) => bp.enabled);
    if (enabledBps.length === 0) return null;

    for (let i = startIdx; i < this._klines.length; i++) {
      const bar = this._klines[i];
      for (const bp of enabledBps) {
        try {
          if (bp.condition(bar, i)) {
            return { index: i, breakpoint: bp };
          }
        } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
          log.error('[BacktestReplay] Breakpoint condition error (%s):', bp.id, err);
        }
      }
    }

    return null;
  }

  /**
   * Jump forward to the next breakpoint.
   * Pauses playback and seeks to the matching bar.
   *
   * @returns The bar at the breakpoint, or `null` if no breakpoint is ahead
   */
  public seekToNextBreakpoint(): KlineBar | null {
    const next = this.getNextBreakpoint();
    if (!next) {
      log.info('[BacktestReplay] seekToNextBreakpoint() — no breakpoint ahead');
      return null;
    }

    const bar = this.seekTo(next.index);
    this.emit('breakpoint-hit', {
      bar,
      index: next.index,
      breakpoint: next.breakpoint,
    });
    return bar;
  }

  // ── Progress & State Queries ─────────────────────────────────────────────

  /**
   * Get the current replay progress snapshot.
   */
  public getProgress(): ReplayProgress {
    const totalBars = this._klines.length;
    // _currentIndex is 1-based cursor (0 = before first bar, totalBars = after last).
    // progressPct is "fraction of bars emitted" not "position of last bar".
    const emittedCount = Math.min(Math.max(this._currentIndex, 0), totalBars);
    const progressPct = totalBars > 0
      ? Math.round((emittedCount / totalBars) * 10000) / 100
      : 0;

    return {
      currentIndex: this._currentIndex,
      totalBars,
      progressPct,
      currentBar: this.getCurrentBar(),
      state: this._state,
      speed: this._speed,
      elapsedMs: this._getElapsedMs(),
    };
  }

  /**
   * Get the bar at the current playback position, or `null` if none.
   */
  public getCurrentBar(): KlineBar | null {
    if (this._currentIndex < 0 || this._currentIndex >= this._klines.length) {
      return null;
    }
    return this._klines[this._currentIndex];
  }

  /**
   * Get a range of bars. `end` is exclusive — `getBars(2, 5)` returns bars
   * at indices 2, 3, 4 (length 3).
   *
   * @param start - Start index (inclusive, clamped)
   * @param end   - End index (exclusive, clamped to `length`)
   * @returns Array of bars in the range [start, end)
   */
  public getBars(start: number, end: number): KlineBar[] {
    if (this._klines.length === 0) return [];

    const s = clampIndex(start, this._klines.length);
    const e = clampIndex(end, this._klines.length + 1);

    if (s >= e) return [];

    return this._klines.slice(s, e);
  }

  /**
   * Reset the engine to its initial idle state. Clears loaded data,
   * breakpoints and playback position. Configuration is preserved.
   */
  public reset(): void {
    this._clearTimer();
    this._currentIndex = -1;
    this._state = 'idle';
    this._sessionStartMs = null;
    this._accumulatedMs = 0;
    this._klines = [];
    this._breakpoints = [];
    log.info('[BacktestReplay] Engine reset');
  }

  /**
   * Update engine configuration. Accepts a partial `ReplayEngineConfig`.
   */
  public setConfig(partial: Partial<ReplayEngineConfig>): void {
    if (partial.speed !== undefined) this._speed = partial.speed;
    if (partial.breakpoints !== undefined) this._breakpoints = [...partial.breakpoints];
    if (partial.loopEnabled !== undefined) this._loopEnabled = partial.loopEnabled;
    if (partial.autoPlay !== undefined) this._autoPlay = partial.autoPlay;
    log.info('[BacktestReplay] Config updated', partial);
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Schedule the next tick based on current speed.
   */
  private _scheduleNextTick(): void {
    if (this._state !== 'playing') return;

    const interval = speedToInterval(this._speed);
    this._timer = setTimeout(() => {
      this._tick();
    }, interval);
  }

  /**
   * Core tick: advance one bar, check breakpoints, schedule next tick or finish.
   */
  private _tick(): void {
    this._timer = null;

    if (this._state !== 'playing') return;

    const nextIdx = this._currentIndex + 1;

    // End of data
    if (nextIdx >= this._klines.length) {
      this._handleEnd();
      return;
    }

    this._currentIndex = nextIdx;
    const bar = this._klines[this._currentIndex];

    // Emit bar event
    this._emitBar(bar);

    // Check breakpoints — if any enabled breakpoint fires, pause
    const hitBps = this._getMatchingBreakpoints(bar, this._currentIndex);
    if (hitBps.length > 0) {
      for (const bp of hitBps) {
        this.emit('breakpoint-hit', {
          bar,
          index: this._currentIndex,
          breakpoint: bp,
        });
      }
      this.pause();
      log.info(
        '[BacktestReplay] Breakpoint hit at index %d: %s',
        this._currentIndex,
        hitBps.map((b) => b.label).join(', '),
      );
      return;
    }

    // Schedule next tick
    this._scheduleNextTick();
  }

  /**
   * Handle reaching the end of the K-line data.
   */
  private _handleEnd(): void {
    this._clearTimer();

    if (this._loopEnabled) {
      log.info('[BacktestReplay] Loop restart');
      this._currentIndex = -1;
      this._scheduleNextTick();
      return;
    }

    this._state = 'completed';
    if (this._sessionStartMs !== null) {
      this._accumulatedMs += Date.now() - this._sessionStartMs;
      this._sessionStartMs = null;
    }

    this.emit('playback-completed', this.getProgress());
    log.info('[BacktestReplay] Playback completed');
  }

  /**
   * Emit a 'bar' event with the bar and its index.
   */
  private _emitBar(bar: KlineBar): void {
    this.emit('bar', {
      bar,
      index: this._currentIndex,
      progress: this.getProgress(),
    });
  }

  /**
   * Check all enabled breakpoints against a bar.
   * Emits 'breakpoint-hit' for each match (used by stepForward).
   */
  private _checkBreakpoints(bar: KlineBar, index: number): void {
    const hits = this._getMatchingBreakpoints(bar, index);
    for (const bp of hits) {
      this.emit('breakpoint-hit', { bar, index, breakpoint: bp });
    }
  }

  /**
   * Return all enabled breakpoints whose condition matches the given bar.
   */
  private _getMatchingBreakpoints(bar: KlineBar, index: number): Breakpoint[] {
    const matched: Breakpoint[] = [];
    for (const bp of this._breakpoints) {
      if (!bp.enabled) continue;
      try {
        if (bp.condition(bar, index)) {
          matched.push(bp);
        }
      } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
        log.error('[BacktestReplay] Breakpoint condition error (%s):', bp.id, err);
      }
    }
    return matched;
  }

  /**
   * Clear any pending timer.
   */
  private _clearTimer(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /**
   * Get total elapsed wall-clock time in ms for the current playback session.
   */
  private _getElapsedMs(): number {
    let total = this._accumulatedMs;
    if (this._sessionStartMs !== null) {
      total += Date.now() - this._sessionStartMs;
    }
    return total;
  }

  /**
   * Internal reset of playback state (used by load).
   */
  private _resetInternal(): void {
    this._clearTimer();
    this._currentIndex = -1;
    this._state = 'idle';
    this._sessionStartMs = null;
    this._accumulatedMs = 0;
  }
}

export default BacktestReplayEngine;
