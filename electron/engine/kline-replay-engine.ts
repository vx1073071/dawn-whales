// J-38-01: K-Line Replay Engine (>=400L)
// Real-time K-line data replay with speed control, breakpoints, and multi-timeframe support
// Phase 4.4: Autonomous Decision Engine Foundation

import { EventEmitter } from 'events';
import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type ReplayState = 'IDLE' | 'LOADING' | 'READY' | 'PLAYING' | 'PAUSED' | 'STOPPED' | 'ERROR';
export type ReplaySpeed = 0.5 | 1 | 2 | 5 | 10 | 50 | 100;
export type BreakpointType = 'price_above' | 'price_below' | 'volume_spike' | 'drawdown' | 'signal' | 'custom';

export interface KLineBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
  trades?: number;
}

export interface ReplayBreakpoint {
  id: string;
  type: BreakpointType;
  condition: {
    symbol?: string;
    price?: number;
    volume?: number;
    drawdownPct?: number;
    signalType?: string;
    customFn?: (state: ReplayStateSnapshot) => boolean;
  };
  enabled: boolean;
  label?: string;
  hitCount: number;
  lastHitAt?: number;
}

export interface ReplayConfig {
  speed: ReplaySpeed;
  symbols: string[];
  startTime?: number;
  endTime?: number;
  loopEnabled: boolean;
  maxHistoryBars: number;
  autoPlayOnLoad: boolean;
}

export interface ReplayStateSnapshot {
  state: ReplayState;
  speed: ReplaySpeed;
  currentTimestamp: number;
  currentBarIndex: number;
  totalBars: number;
  progressPct: number;
  elapsedMs: number;
  breakpointsHit: number;
  symbols: string[];
  currentBars: Map<string, KLineBar>;
  history: Map<string, KLineBar[]>;
}

export interface MarketEvent {
  type: 'bar' | 'breakpoint' | 'state_change' | 'speed_change' | 'error';
  timestamp: number;
  data: any;
}

// ── KLine Replay Engine ────────────────────────────────────────────────────

export class KLineReplayEngine extends EventEmitter {
  private config: ReplayConfig;
  private state: ReplayState = 'IDLE';
  private speed: ReplaySpeed = 1;
  private playTimer: ReturnType<typeof setTimeout> | null = null;

  // Data storage: symbol -> KLineBar[]
  private dataStore: Map<string, KLineBar[]> = new Map();
  // Current play position per symbol
  private playIndex: Map<string, number> = new Map();
  // History buffer for each symbol (sliding window)
  private historyBuffer: Map<string, KLineBar[]> = new Map();

  // Breakpoints
  private breakpoints: Map<string, ReplayBreakpoint> = new Map();
  private totalBreakpointsHit = 0;

  // Metrics
  private startTime = 0;
  private lastBarTime = 0;
  private barsProcessed = 0;

  constructor(config?: Partial<ReplayConfig>) {
    super();
    this.config = {
      speed: config?.speed ?? 1,
      symbols: config?.symbols ?? [],
      startTime: config?.startTime,
      endTime: config?.endTime,
      loopEnabled: config?.loopEnabled ?? false,
      maxHistoryBars: config?.maxHistoryBars ?? 500,
      autoPlayOnLoad: config?.autoPlayOnLoad ?? false,
    };
    this.speed = this.config.speed;
    log.info(`[KLineReplay] Initialized (speed=${this.speed}x, loop=${this.config.loopEnabled})`);
  }

  // ── Data Loading ───────────────────────────────────────────────────────

  /**
   * Load K-line data for a symbol
   */
  loadData(symbol: string, bars: KLineBar[]): void {
    if (!bars || bars.length === 0) {
      log.warn(`[KLineReplay] No data to load for ${symbol}`);
      return;
    }

    // Sort by timestamp ascending
    const sorted = [...bars].sort((a, b) => a.timestamp - b.timestamp);

    // Apply time range filter if configured
    let filtered = sorted;
    if (this.config.startTime) {
      filtered = filtered.filter(b => b.timestamp >= this.config.startTime!);
    }
    if (this.config.endTime) {
      filtered = filtered.filter(b => b.timestamp <= this.config.endTime!);
    }

    this.dataStore.set(symbol, filtered);
    this.playIndex.set(symbol, 0);
    this.historyBuffer.set(symbol, []);

    log.info(`[KLineReplay] Loaded ${filtered.length} bars for ${symbol}`);
    this.emit('data:loaded', { symbol, bars: filtered.length });

    // Check if all symbols are loaded
    if (this.isAllSymbolsLoaded()) {
      this.transitionState('READY');
      if (this.config.autoPlayOnLoad) {
        this.play();
      }
    }
  }

  /**
   * Load multiple symbols at once
   */
  loadBatch(data: Record<string, KLineBar[]>): void {
    this.transitionState('LOADING');
    for (const [symbol, bars] of Object.entries(data)) {
      this.loadData(symbol, bars);
    }
  }

  /**
   * Clear all loaded data
   */
  clearData(): void {
    this.stop();
    this.dataStore.clear();
    this.playIndex.clear();
    this.historyBuffer.clear();
    this.barsProcessed = 0;
    this.totalBreakpointsHit = 0;
    this.transitionState('IDLE');
  }

  // ── Playback Control ──────────────────────────────────────────────────

  /**
   * Start or resume playback
   */
  play(): void {
    if (this.state !== 'READY' && this.state !== 'PAUSED') {
      log.warn(`[KLineReplay] Cannot play from state: ${this.state}`);
      return;
    }

    this.transitionState('PLAYING');
    this.startTime = this.startTime || Date.now();
    this.scheduleNextBar();
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.state !== 'PLAYING') return;
    this.clearPlayTimer();
    this.transitionState('PAUSED');
  }

  /**
   * Stop playback and reset position
   */
  stop(): void {
    this.clearPlayTimer();
    for (const symbol of this.dataStore.keys()) {
      this.playIndex.set(symbol, 0);
      this.historyBuffer.set(symbol, []);
    }
    this.barsProcessed = 0;
    this.totalBreakpointsHit = 0;
    this.transitionState('STOPPED');
  }

  /**
   * Step forward by N bars (for debugging/analysis)
   */
  stepForward(steps = 1): KLineBar[] {
    const emitted: KLineBar[] = [];
    for (let i = 0; i < steps; i++) {
      const bar = this.advanceOneBar();
      if (bar) emitted.push(bar);
      else break;
    }
    return emitted;
  }

  /**
   * Step backward by N bars
   */
  stepBackward(steps = 1): void {
    for (const symbol of this.dataStore.keys()) {
      const idx = this.playIndex.get(symbol) ?? 0;
      this.playIndex.set(symbol, Math.max(0, idx - steps));

      // Rebuild history buffer
      const bars = this.dataStore.get(symbol)!;
      const newIdx = this.playIndex.get(symbol)!;
      const start = Math.max(0, newIdx - this.config.maxHistoryBars);
      this.historyBuffer.set(symbol, bars.slice(start, newIdx));
    }

    this.emit('step:backward', { steps, state: this.getSnapshot() });
  }

  /**
   * Seek to specific timestamp
   */
  seekTo(timestamp: number): void {
    for (const [symbol, bars] of this.dataStore) {
      const idx = bars.findIndex(b => b.timestamp >= timestamp);
      this.playIndex.set(symbol, idx >= 0 ? idx : bars.length - 1);

      // Rebuild history
      const newIdx = this.playIndex.get(symbol)!;
      const start = Math.max(0, newIdx - this.config.maxHistoryBars);
      this.historyBuffer.set(symbol, bars.slice(start, newIdx));
    }

    this.emit('seek', { timestamp, state: this.getSnapshot() });
  }

  /**
   * Seek to specific bar index (0-based)
   */
  seekToBar(index: number): void {
    for (const [symbol, bars] of this.dataStore) {
      const idx = Math.min(index, bars.length - 1);
      this.playIndex.set(symbol, Math.max(0, idx));

      const start = Math.max(0, idx - this.config.maxHistoryBars);
      this.historyBuffer.set(symbol, bars.slice(start, idx));
    }

    this.emit('seek:bar', { index, state: this.getSnapshot() });
  }

  // ── Speed Control ─────────────────────────────────────────────────────

  /**
   * Set playback speed
   */
  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed;
    this.config.speed = speed;
    log.info(`[KLineReplay] Speed set to ${speed}x`);
    this.emit('speed:change', { speed });
  }

  /**
   * Get current speed
   */
  getSpeed(): ReplaySpeed {
    return this.speed;
  }

  // ── Breakpoint Management ─────────────────────────────────────────────

  /**
   * Add a breakpoint
   */
  addBreakpoint(bp: Omit<ReplayBreakpoint, 'hitCount'>): string {
    const id = bp.id || `bp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const breakpoint: ReplayBreakpoint = { ...bp, id, hitCount: 0 };
    this.breakpoints.set(id, breakpoint);
    log.info(`[KLineReplay] Breakpoint added: ${id} (${bp.type})`);
    this.emit('breakpoint:added', breakpoint);
    return id;
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(id: string): boolean {
    const removed = this.breakpoints.delete(id);
    if (removed) log.info(`[KLineReplay] Breakpoint removed: ${id}`);
    return removed;
  }

  /**
   * Enable/disable a breakpoint
   */
  toggleBreakpoint(id: string, enabled: boolean): boolean {
    const bp = this.breakpoints.get(id);
    if (!bp) return false;
    bp.enabled = enabled;
    return true;
  }

  /**
   * Get all breakpoints
   */
  getBreakpoints(): ReplayBreakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  // ── State & Metrics ──────────────────────────────────────────────────

  /**
   * Get current state
   */
  getState(): ReplayState {
    return this.state;
  }

  /**
   * Get full state snapshot
   */
  getSnapshot(): ReplayStateSnapshot {
    const currentBars = new Map<string, KLineBar>();
    const history = new Map<string, KLineBar[]>();

    let totalBars = 0;
    let currentIdx = 0;

    for (const [symbol, bars] of this.dataStore) {
      const idx = this.playIndex.get(symbol) ?? 0;
      totalBars += bars.length;
      currentIdx += idx;

      if (idx > 0 && idx <= bars.length) {
        currentBars.set(symbol, bars[idx - 1]);
      }
      history.set(symbol, [...(this.historyBuffer.get(symbol) ?? [])]);
    }

    const progressPct = totalBars > 0 ? (currentIdx / totalBars) * 100 : 0;

    return {
      state: this.state,
      speed: this.speed,
      currentTimestamp: this.lastBarTime,
      currentBarIndex: currentIdx,
      totalBars,
      progressPct: Math.round(progressPct * 100) / 100,
      elapsedMs: this.startTime > 0 ? Date.now() - this.startTime : 0,
      breakpointsHit: this.totalBreakpointsHit,
      symbols: Array.from(this.dataStore.keys()),
      currentBars,
      history,
    };
  }

  /**
   * Get stats
   */
  getStats(): {
    symbols: number;
    totalBars: number;
    barsProcessed: number;
    breakpointsTotal: number;
    breakpointsHit: number;
    progressPct: number;
  } {
    let totalBars = 0;
    for (const bars of this.dataStore.values()) {
      totalBars += bars.length;
    }

    return {
      symbols: this.dataStore.size,
      totalBars,
      barsProcessed: this.barsProcessed,
      breakpointsTotal: this.breakpoints.size,
      breakpointsHit: this.totalBreakpointsHit,
      progressPct: totalBars > 0 ? Math.round((this.barsProcessed / totalBars) * 10000) / 100 : 0,
    };
  }

  /**
   * Get history for a symbol
   */
  getHistory(symbol: string, limit?: number): KLineBar[] {
    const hist = this.historyBuffer.get(symbol) ?? [];
    return limit ? hist.slice(-limit) : hist;
  }

  /**
   * Get current bar for a symbol
   */
  getCurrentBar(symbol: string): KLineBar | null {
    const bars = this.dataStore.get(symbol);
    const idx = this.playIndex.get(symbol);
    if (!bars || idx === undefined || idx <= 0) return null;
    return bars[idx - 1] ?? null;
  }

  // ── Private Methods ───────────────────────────────────────────────────

  private isAllSymbolsLoaded(): boolean {
    if (this.config.symbols.length === 0) return this.dataStore.size > 0;
    return this.config.symbols.every(s => this.dataStore.has(s));
  }

  private transitionState(newState: ReplayState): void {
    const oldState = this.state;
    this.state = newState;
    log.info(`[KLineReplay] State: ${oldState} → ${newState}`);
    this.emit('state:change', { from: oldState, to: newState });
  }

  private scheduleNextBar(): void {
    if (this.state !== 'PLAYING') return;

    // Calculate interval based on speed
    // Base interval: 100ms per bar at 1x speed
    const baseIntervalMs = 100;
    const intervalMs = this.speed >= 100 ? 0 : Math.max(1, baseIntervalMs / this.speed);

    if (intervalMs === 0) {
      // MAX speed: process all remaining bars synchronously
      while (this.state === 'PLAYING') {
        const bar = this.advanceOneBar();
        if (!bar) break;
      }
    } else {
      this.playTimer = setTimeout(() => {
        const bar = this.advanceOneBar();
        if (bar) {
          this.scheduleNextBar();
        }
      }, intervalMs);
    }
  }

  private advanceOneBar(): KLineBar | null {
    // Find the symbol with the earliest next bar
    let earliestSymbol: string | null = null;
    let earliestTimestamp = Infinity;

    for (const [symbol, bars] of this.dataStore) {
      const idx = this.playIndex.get(symbol) ?? 0;
      if (idx < bars.length && bars[idx].timestamp < earliestTimestamp) {
        earliestTimestamp = bars[idx].timestamp;
        earliestSymbol = symbol;
      }
    }

    if (!earliestSymbol) {
      // All symbols exhausted
      if (this.config.loopEnabled) {
        this.resetPositions();
        log.info('[KLineReplay] Loop: restarting from beginning');
        return null;
      }
      this.transitionState('STOPPED');
      this.emit('replay:complete', { barsProcessed: this.barsProcessed });
      return null;
    }

    const bars = this.dataStore.get(earliestSymbol)!;
    const idx = this.playIndex.get(earliestSymbol)!;
    const bar = bars[idx];

    // Advance position
    this.playIndex.set(earliestSymbol, idx + 1);
    this.barsProcessed++;
    this.lastBarTime = bar.timestamp;

    // Update history buffer
    const hist = this.historyBuffer.get(earliestSymbol) ?? [];
    hist.push(bar);
    if (hist.length > this.config.maxHistoryBars) {
      hist.shift();
    }
    this.historyBuffer.set(earliestSymbol, hist);

    // Emit bar event
    this.emit('bar', { symbol: earliestSymbol, bar, index: idx });

    // Check breakpoints
    this.checkBreakpoints(earliestSymbol, bar);

    return bar;
  }

  private checkBreakpoints(symbol: string, bar: KLineBar): void {
    for (const bp of this.breakpoints.values()) {
      if (!bp.enabled) continue;

      let hit = false;

      switch (bp.type) {
        case 'price_above':
          hit = bp.condition.price !== undefined && bar.close >= bp.condition.price;
          break;
        case 'price_below':
          hit = bp.condition.price !== undefined && bar.close <= bp.condition.price;
          break;
        case 'volume_spike':
          hit = bp.condition.volume !== undefined && bar.volume >= bp.condition.volume;
          break;
        case 'drawdown': {
          const hist = this.historyBuffer.get(symbol) ?? [];
          if (hist.length > 1) {
            const peak = Math.max(...hist.map(h => h.high));
            const dd = (peak - bar.close) / peak * 100;
            hit = bp.condition.drawdownPct !== undefined && dd >= bp.condition.drawdownPct;
          }
          break;
        }
        case 'custom':
          if (bp.condition.customFn) {
            hit = bp.condition.customFn(this.getSnapshot());
          }
          break;
      }

      if (hit) {
        bp.hitCount++;
        bp.lastHitAt = Date.now();
        this.totalBreakpointsHit++;

        log.info(`[KLineReplay] Breakpoint hit: ${bp.id} (${bp.type}) at ${bar.timestamp}`);
        this.emit('breakpoint:hit', { breakpoint: bp, symbol, bar });

        // Auto-pause on breakpoint if configured
        if (this.state === 'PLAYING') {
          this.pause();
        }
      }
    }
  }

  private resetPositions(): void {
    for (const symbol of this.dataStore.keys()) {
      this.playIndex.set(symbol, 0);
      this.historyBuffer.set(symbol, []);
    }
    this.barsProcessed = 0;
  }

  private clearPlayTimer(): void {
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
  }

  /**
   * Destroy engine and cleanup
   */
  destroy(): void {
    this.clearPlayTimer();
    this.clearData();
    this.breakpoints.clear();
    this.removeAllListeners();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let replayInstance: KLineReplayEngine | null = null;

export function getKLineReplayEngine(config?: Partial<ReplayConfig>): KLineReplayEngine {
  if (!replayInstance) {
    replayInstance = new KLineReplayEngine(config);
  }
  return replayInstance;
}
