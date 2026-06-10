// J-38-02: Multi-Timeframe Replay Engine
// Synchronizes K-line replay across multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
// Provides unified playback control and cross-timeframe event coordination

import { EventEmitter } from 'events';
import log from 'electron-log';
import { KLineReplayEngine, KLineBar, ReplayState, ReplaySpeed } from '../backtest/kline-replay-engine';

// ── Types ──────────────────────────────────────────────────────────────────

export type TimeframeKey = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export const TIMEFRAME_MS: Record<TimeframeKey, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

export interface TimeframeData {
  timeframe: TimeframeKey;
  bars: KLineBar[];
  engine: KLineReplayEngine;
}

export interface MultiTimeframeConfig {
  baseTimeframe: TimeframeKey;
  timeframes: TimeframeKey[];
  symbol: string;
  speed: ReplaySpeed;
  syncMode: 'sequential' | 'parallel' | 'master-slave';
  masterTimeframe?: TimeframeKey;
}

export interface CrossTimeframeEvent {
  type: 'bar_sync' | 'timeframe_complete' | 'all_complete' | 'divergence';
  timestamp: number;
  data: {
    timeframe?: TimeframeKey;
    bar?: KLineBar;
    progress?: number;
    divergence?: { timeframe: TimeframeKey; expected: number; actual: number };
  };
}

export interface TimeframeSnapshot {
  timeframe: TimeframeKey;
  state: ReplayState;
  currentBarIndex: number;
  totalBars: number;
  progressPct: number;
  currentBar: KLineBar | null;
}

// ── Multi-Timeframe Replay Engine ──────────────────────────────────────────

export class MultiTimeframeReplayEngine extends EventEmitter {
  private config: MultiTimeframeConfig;
  private timeframes: Map<TimeframeKey, TimeframeData> = new Map();
  private masterEngine: KLineReplayEngine | null = null;
  private isPlaying = false;
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<MultiTimeframeConfig>) {
    super();
    this.config = {
      baseTimeframe: config?.baseTimeframe ?? '1m',
      timeframes: config?.timeframes ?? ['1m', '5m', '15m', '1h'],
      symbol: config?.symbol ?? 'DEFAULT',
      speed: config?.speed ?? 1,
      syncMode: config?.syncMode ?? 'master-slave',
      masterTimeframe: config?.masterTimeframe,
    };

    // Initialize engines for each timeframe
    for (const tf of this.config.timeframes) {
      const engine = new KLineReplayEngine({
        symbols: [this.config.symbol],
        speed: this.config.speed,
      });

      this.timeframes.set(tf, {
        timeframe: tf,
        bars: [],
        engine,
      });

      // Forward events
      engine.on('bar', (data) => this.onBarEvent(tf, data));
      engine.on('state:change', (data) => this.onStateChange(tf, data));
      engine.on('replay:complete', () => this.onTimeframeComplete(tf));
    }

    // Set master engine
    const masterTf = this.config.masterTimeframe ?? this.config.baseTimeframe;
    this.masterEngine = this.timeframes.get(masterTf)?.engine ?? null;

    log.info(`[MultiTFReplay] Initialized (${this.config.timeframes.length} timeframes, mode=${this.config.syncMode})`);
  }

  // ── Data Loading ───────────────────────────────────────────────────────

  /**
   * Load raw 1-minute data and auto-generate higher timeframes
   */
  loadFromRaw(rawBars: KLineBar[]): void {
    log.info(`[MultiTFReplay] Loading ${rawBars.length} raw bars for ${this.config.symbol}`);

    for (const tf of this.config.timeframes) {
      const aggregated = this.aggregateBars(rawBars, tf);
      this.loadDataForTimeframe(tf, aggregated);
    }
  }

  /**
   * Load pre-aggregated data for each timeframe
   */
  loadPreAggregated(data: Partial<Record<TimeframeKey, KLineBar[]>>): void {
    for (const [tf, bars] of Object.entries(data)) {
      if (bars && this.timeframes.has(tf as TimeframeKey)) {
        this.loadDataForTimeframe(tf as TimeframeKey, bars);
      }
    }
  }

  /**
   * Load data for a specific timeframe
   */
  loadDataForTimeframe(timeframe: TimeframeKey, bars: KLineBar[]): void {
    const tfData = this.timeframes.get(timeframe);
    if (!tfData) {
      log.warn(`[MultiTFReplay] Timeframe ${timeframe} not configured`);
      return;
    }

    tfData.bars = bars;
    tfData.engine.loadData(this.config.symbol, bars);
    log.info(`[MultiTFReplay] Loaded ${bars.length} bars for ${timeframe}`);
  }

  // ── Playback Control ──────────────────────────────────────────────────

  /**
   * Play all timeframes
   */
  play(): void {
    if (this.isPlaying) return;

    log.info('[MultiTFReplay] Starting playback');
    this.isPlaying = true;

    switch (this.config.syncMode) {
      case 'master-slave':
        this.playMasterSlave();
        break;
      case 'parallel':
        this.playParallel();
        break;
      case 'sequential':
        this.playSequential();
        break;
    }
  }

  /**
   * Pause all timeframes
   */
  pause(): void {
    log.info('[MultiTFReplay] Pausing playback');
    this.isPlaying = false;
    this.clearSyncTimer();

    for (const tf of this.timeframes.values()) {
      tf.engine.pause();
    }
  }

  /**
   * Stop all timeframes
   */
  stop(): void {
    log.info('[MultiTFReplay] Stopping playback');
    this.isPlaying = false;
    this.clearSyncTimer();

    for (const tf of this.timeframes.values()) {
      tf.engine.stop();
    }
  }

  /**
   * Step forward on all timeframes
   */
  stepForward(steps = 1): void {
    for (const tf of this.timeframes.values()) {
      tf.engine.stepForward(steps);
    }
  }

  /**
   * Seek all timeframes to timestamp
   */
  seekTo(timestamp: number): void {
    for (const tf of this.timeframes.values()) {
      tf.engine.seekTo(timestamp);
    }
    this.checkSync();
  }

  // ── Speed Control ─────────────────────────────────────────────────────

  /**
   * Set playback speed for all timeframes
   */
  setSpeed(speed: ReplaySpeed): void {
    this.config.speed = speed;
    for (const tf of this.timeframes.values()) {
      tf.engine.setSpeed(speed);
    }
    log.info(`[MultiTFReplay] Speed set to ${speed}x`);
  }

  // ── State & Metrics ──────────────────────────────────────────────────

  /**
   * Get snapshot of all timeframes
   */
  getSnapshot(): TimeframeSnapshot[] {
    const snapshots: TimeframeSnapshot[] = [];

    for (const [tf, data] of this.timeframes) {
      const snapshot = data.engine.getSnapshot();
      snapshots.push({
        timeframe: tf,
        state: snapshot.state,
        currentBarIndex: snapshot.currentBarIndex,
        totalBars: snapshot.totalBars,
        progressPct: snapshot.progressPct,
        currentBar: snapshot.currentBars.get(this.config.symbol) ?? null,
      });
    }

    return snapshots;
  }

  /**
   * Get overall progress
   */
  getOverallProgress(): number {
    const snapshots = this.getSnapshot();
    if (snapshots.length === 0) return 0;

    const totalProgress = snapshots.reduce((sum, s) => sum + s.progressPct, 0);
    return totalProgress / snapshots.length;
  }

  /**
   * Get current bars for all timeframes
   */
  getCurrentBars(): Map<TimeframeKey, KLineBar | null> {
    const bars = new Map<TimeframeKey, KLineBar | null>();

    for (const [tf, data] of this.timeframes) {
      bars.set(tf, data.engine.getCurrentBar(this.config.symbol));
    }

    return bars;
  }

  /**
   * Check if all timeframes are in sync
   */
  isSynced(): boolean {
    const bars = this.getCurrentBars();
    const timestamps = Array.from(bars.values())
      .filter(b => b !== null)
      .map(b => b!.timestamp);

    if (timestamps.length === 0) return true;

    const baseTime = timestamps[0];
    const tolerance = TIMEFRAME_MS[this.config.baseTimeframe];

    return timestamps.every(t => Math.abs(t - baseTime) <= tolerance);
  }

  // ── Private Methods ───────────────────────────────────────────────────

  private aggregateBars(rawBars: KLineBar[], timeframe: TimeframeKey): KLineBar[] {
    if (timeframe === '1m') return rawBars;

    const intervalMs = TIMEFRAME_MS[timeframe];
    const aggregated: KLineBar[] = [];
    let currentBar: KLineBar | null = null;

    for (const bar of rawBars) {
      const barStart = Math.floor(bar.timestamp / intervalMs) * intervalMs;

      if (!currentBar || currentBar.timestamp !== barStart) {
        if (currentBar) aggregated.push(currentBar);
        currentBar = {
          timestamp: barStart,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          amount: bar.amount,
          trades: bar.trades,
        };
      } else {
        currentBar.high = Math.max(currentBar.high, bar.high);
        currentBar.low = Math.min(currentBar.low, bar.low);
        currentBar.close = bar.close;
        currentBar.volume += bar.volume;
        if (bar.amount && currentBar.amount) currentBar.amount += bar.amount;
        if (bar.trades && currentBar.trades) currentBar.trades += bar.trades;
      }
    }

    if (currentBar) aggregated.push(currentBar);
    return aggregated;
  }

  private playMasterSlave(): void {
    if (!this.masterEngine) return;

    // Play master engine
    this.masterEngine.play();

    // Sync slaves to master periodically
    this.syncTimer = setInterval(() => {
      const masterSnapshot = this.masterEngine!.getSnapshot();
      const masterTime = masterSnapshot.currentTimestamp;

      for (const [tf, data] of this.timeframes) {
        if (data.engine !== this.masterEngine) {
          data.engine.seekTo(masterTime);
          if (data.engine.getState() !== 'PLAYING') {
            data.engine.play();
          }
        }
      }
    }, 100);
  }

  private playParallel(): void {
    for (const tf of this.timeframes.values()) {
      tf.engine.play();
    }
  }

  private playSequential(): void {
    // Play base timeframe first, then sync others
    const baseTf = this.timeframes.get(this.config.baseTimeframe);
    if (baseTf) {
      baseTf.engine.play();
    }
  }

  private onBarEvent(timeframe: TimeframeKey, data: unknown): void {
    this.emit('bar', { timeframe, ...data });

    // Emit cross-timeframe sync event
    const event: CrossTimeframeEvent = {
      type: 'bar_sync',
      timestamp: data.bar.timestamp,
      data: { timeframe, bar: data.bar },
    };
    this.emit('cross_tf_event', event);
  }

  private onStateChange(timeframe: TimeframeKey, data: unknown): void {
    this.emit('state:change', { timeframe, ...data });
  }

  private onTimeframeComplete(timeframe: TimeframeKey): void {
    log.info(`[MultiTFReplay] Timeframe ${timeframe} complete`);
    this.emit('timeframe:complete', { timeframe });

    const event: CrossTimeframeEvent = {
      type: 'timeframe_complete',
      timestamp: Date.now(),
      data: { timeframe },
    };
    this.emit('cross_tf_event', event);

    // Check if all timeframes are complete
    const allComplete = Array.from(this.timeframes.values()).every(
      tf => tf.engine.getState() === 'STOPPED'
    );

    if (allComplete) {
      log.info('[MultiTFReplay] All timeframes complete');
      this.isPlaying = false;
      this.emit('all:complete');

      const completeEvent: CrossTimeframeEvent = {
        type: 'all_complete',
        timestamp: Date.now(),
        data: {},
      };
      this.emit('cross_tf_event', completeEvent);
    }
  }

  private checkSync(): void {
    if (!this.isSynced()) {
      const bars = this.getCurrentBars();
      const baseTime = bars.get(this.config.baseTimeframe)?.timestamp ?? 0;

      for (const [tf, bar] of bars) {
        if (bar && Math.abs(bar.timestamp - baseTime) > TIMEFRAME_MS[this.config.baseTimeframe]) {
          const event: CrossTimeframeEvent = {
            type: 'divergence',
            timestamp: Date.now(),
            data: {
              divergence: {
                timeframe: tf,
                expected: baseTime,
                actual: bar.timestamp,
              },
            },
          };
          this.emit('cross_tf_event', event);
        }
      }
    }
  }

  private clearSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Destroy all engines and cleanup
   */
  destroy(): void {
    this.clearSyncTimer();
    for (const tf of this.timeframes.values()) {
      tf.engine.destroy();
    }
    this.timeframes.clear();
    this.removeAllListeners();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let multiTfInstance: MultiTimeframeReplayEngine | null = null;

export function getMultiTimeframeReplayEngine(
  config?: Partial<MultiTimeframeConfig>
): MultiTimeframeReplayEngine {
  if (!multiTfInstance) {
    multiTfInstance = new MultiTimeframeReplayEngine(config);
  }
  return multiTfInstance;
}
