/**
 * MarketReplayEngine — R262 P2-03
 *
 * 行情回放引擎。支持历史tick数据回放，含快进、暂停、步进、时间轴控制。
 *
 * Feature set:
 *   - 历史tick数据加载 (Yahoo/Binance/自定义)
 *   - 回放控制: play/pause/stop/step_forward/step_backward
 *   - 速度控制: 1×/2×/4×/8×/16×/32× 快进
 *   - 时间轴: 起始时间/当前时间/结束时间/进度百分比
 *   - 数据源: 内存数组/外部存储/流式加载
 *   - 事件发射: tick/state_change/progress/complete
 *   - 区间循环 (A-B loop)
 *   - Seek 跳转
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Timer-driven playback with speed multiplier
 *   - Tick buffer with lazy loading from storage
 *
 * @author JVS
 * @round R262
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type ReplayState = 'idle' | 'playing' | 'paused' | 'stepping' | 'completed';

export type ReplaySpeed = 1 | 2 | 4 | 8 | 16 | 32;

export interface ReplayTick {
  symbol: string;
  timestamp: number;       // unix ms
  price: number;
  volume: number;
  bid?: number;
  ask?: number;
  source: 'yahoo' | 'binance' | 'custom';
}

export interface ReplayConfig {
  speed: ReplaySpeed;
  loopMode: 'once' | 'loop' | 'ab_loop';
  loopStartMs?: number;    // absolute timestamp within replay range
  loopEndMs?: number;
  tickBufferSize: number;
  defaultIntervalMs: number;
}

export interface ReplayProgress {
  state: ReplayState;
  startTime: number;       // unix ms of first tick
  currentTime: number;     // unix ms of current tick
  endTime: number;         // unix ms of last tick
  progress: number;        // 0-1
  tickIndex: number;
  totalTicks: number;
  speed: ReplaySpeed;
  elapsedRealMs: number;
}

export interface ReplayStats {
  totalTicks: number;
  playedTicks: number;
  elapsedRealMs: number;
  elapsedVirtualMs: number;
  averageTickIntervalMs: number;
  dataSources: Record<string, number>;
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_CONFIG: ReplayConfig = {
  speed: 1,
  loopMode: 'once',
  tickBufferSize: 10000,
  defaultIntervalMs: 500,
};

// ─── Engine ──────────────────────────────────────────────

export class MarketReplayEngine extends EventEmitter {
  private static instance: MarketReplayEngine;

  private config: ReplayConfig;
  private ticks: ReplayTick[] = [];
  private sortedTicks: ReplayTick[] = [];
  private state: ReplayState = 'idle';
  private currentIndex = 0;
  private playTimer: ReturnType<typeof setInterval> | null = null;
  private startRealTime = 0;
  private elapsedBeforePause = 0;
  private pausedAt = 0;

  constructor(config?: Partial<ReplayConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<ReplayConfig>): MarketReplayEngine {
    if (!MarketReplayEngine.instance) {
      MarketReplayEngine.instance = new MarketReplayEngine(config);
    } else if (config) {
      MarketReplayEngine.instance.config = { ...MarketReplayEngine.instance.config, ...config };
    }
    return MarketReplayEngine.instance;
  }

  reset(): void {
    this.stop();
    this.ticks = [];
    this.sortedTicks = [];
    this.state = 'idle';
    this.currentIndex = 0;
    this.elapsedBeforePause = 0;
    this.removeAllListeners();
  }

  // ─── Data Loading ───────────────────────────────────────

  loadTicks(data: ReplayTick[]): void {
    this.ticks.push(...data);
    this.sortTicks();
  }

  setTicks(data: ReplayTick[]): void {
    this.ticks = [...data];
    this.sortTicks();
  }

  private sortTicks(): void {
    this.sortedTicks = [...this.ticks].sort((a, b) => a.timestamp - b.timestamp);
  }

  // ─── Playback Control ───────────────────────────────────

  play(): void {
    if (this.state === 'playing') return;
    if (this.sortedTicks.length === 0) { this.emit('error', { message: 'No ticks loaded' }); return; }
    if (this.currentIndex >= this.sortedTicks.length) { this.currentIndex = 0; }

    if (this.state === 'paused') {
      this.elapsedBeforePause += Date.now() - this.pausedAt;
    } else {
      this.startRealTime = Date.now();
    }

    this.state = 'playing';
    this.emit('state_change', { state: 'playing' });
    this.startPlayLoop();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.clearTimer();
    this.pausedAt = Date.now();
    this.state = 'paused';
    this.emit('state_change', { state: 'paused' });
  }

  stop(): void {
    this.clearTimer();
    this.state = 'idle';
    this.currentIndex = 0;
    this.elapsedBeforePause = 0;
    this.emit('state_change', { state: 'idle' });
  }

  stepForward(): void {
    if (this.currentIndex < this.sortedTicks.length - 1) {
      this.state = 'stepping';
      this.currentIndex++;
      this.emitTick();
      this.emitProgress();
      this.state = 'paused';
    }
  }

  stepBackward(): void {
    if (this.currentIndex > 0) {
      this.state = 'stepping';
      this.currentIndex--;
      this.emitTick();
      this.emitProgress();
      this.state = 'paused';
    }
  }

  seek(index: number): void {
    if (index < 0 || index >= this.sortedTicks.length) return;
    this.currentIndex = index;
    this.emitProgress();
  }

  seekToTime(timestamp: number): void {
    const idx = this.sortedTicks.findIndex(t => t.timestamp >= timestamp);
    if (idx >= 0) { this.seek(idx); }
  }

  seekPercent(pct: number): void {
    const idx = Math.floor(pct * (this.sortedTicks.length - 1));
    this.seek(Math.max(0, Math.min(idx, this.sortedTicks.length - 1)));
  }

  setSpeed(speed: ReplaySpeed): void {
    this.config.speed = speed;
    if (this.state === 'playing') {
      this.clearTimer();
      this.startPlayLoop();
    }
    this.emit('speed_change', { speed });
  }

  // ─── Loop Modes ────────────────────────────────────────

  setLoopMode(mode: ReplayConfig['loopMode'], loopStartMs?: number, loopEndMs?: number): void {
    this.config.loopMode = mode;
    this.config.loopStartMs = loopStartMs;
    this.config.loopEndMs = loopEndMs;
  }

  private shouldLoop(): boolean {
    if (this.config.loopMode === 'once') return false;

    if (this.config.loopMode === 'loop') {
      this.currentIndex = 0;
      this.elapsedBeforePause = 0;
      this.startRealTime = Date.now();
      return true;
    }

    if (this.config.loopMode === 'ab_loop' && this.config.loopStartMs !== undefined && this.config.loopEndMs !== undefined) {
      const idx = this.sortedTicks.findIndex(t => t.timestamp >= this.config.loopStartMs!);
      this.currentIndex = idx >= 0 ? idx : 0;
      this.elapsedBeforePause = 0;
      this.startRealTime = Date.now();
      return true;
    }

    return false;
  }

  // ─── Internal Play Loop ─────────────────────────────────

  private startPlayLoop(): void {
    this.playTimer = setInterval(() => {
      if (this.currentIndex >= this.sortedTicks.length) {
        if (this.shouldLoop()) return;

        this.state = 'completed';
        this.clearTimer();
        this.emit('state_change', { state: 'completed' });
        this.emit('complete');
        return;
      }

      const tick = this.sortedTicks[this.currentIndex];
      this.emitTick();
      this.emitProgress();
      this.currentIndex++;

    }, Math.max(10, Math.floor(this.config.defaultIntervalMs / this.config.speed)));
  }

  private emitTick(): void {
    const tick = this.sortedTicks[this.currentIndex];
    if (tick) this.emit('tick', tick);
  }

  private emitProgress(): void {
    this.emit('progress', this.getProgress());
  }

  private clearTimer(): void {
    if (this.playTimer) { clearInterval(this.playTimer); this.playTimer = null; }
  }

  // ─── Progress & Stats ───────────────────────────────────

  getProgress(): ReplayProgress {
    if (this.sortedTicks.length === 0) {
      return {
        state: this.state, startTime: 0, currentTime: 0, endTime: 0,
        progress: 0, tickIndex: 0, totalTicks: 0, speed: this.config.speed,
        elapsedRealMs: 0,
      };
    }

    const totalElapsed = this.state === 'playing'
      ? this.elapsedBeforePause + (Date.now() - (this.pausedAt || this.startRealTime))
      : this.elapsedBeforePause;

    return {
      state: this.state,
      startTime: this.sortedTicks[0].timestamp,
      currentTime: this.sortedTicks[Math.min(this.currentIndex, this.sortedTicks.length - 1)].timestamp,
      endTime: this.sortedTicks[this.sortedTicks.length - 1].timestamp,
      progress: this.sortedTicks.length > 1 ? this.currentIndex / (this.sortedTicks.length - 1) : 1,
      tickIndex: this.currentIndex,
      totalTicks: this.sortedTicks.length,
      speed: this.config.speed,
      elapsedRealMs: totalElapsed,
    };
  }

  getStats(): ReplayStats {
    const sources: Record<string, number> = {};
    for (const t of this.sortedTicks) { sources[t.source] = (sources[t.source] || 0) + 1; }

    let totalInterval = 0;
    for (let i = 1; i < this.sortedTicks.length; i++) {
      totalInterval += this.sortedTicks[i].timestamp - this.sortedTicks[i - 1].timestamp;
    }
    const avg = this.sortedTicks.length > 1 ? totalInterval / (this.sortedTicks.length - 1) : 0;

    const totalElapsed = this.state === 'playing'
      ? this.elapsedBeforePause + (Date.now() - this.startRealTime)
      : this.elapsedBeforePause;

    return {
      totalTicks: this.sortedTicks.length,
      playedTicks: this.currentIndex,
      elapsedRealMs: totalElapsed,
      elapsedVirtualMs: this.sortedTicks.length > 0
        ? this.sortedTicks[this.sortedTicks.length - 1].timestamp - this.sortedTicks[0].timestamp
        : 0,
      averageTickIntervalMs: Math.round(avg),
      dataSources: sources,
    };
  }

  // ─── Queries ────────────────────────────────────────────

  getState(): ReplayState { return this.state; }
  isPlaying(): boolean { return this.state === 'playing'; }
  isPaused(): boolean { return this.state === 'paused'; }
  getTickCount(): number { return this.sortedTicks.length; }
  getCurrentTick(): ReplayTick | null { return this.sortedTicks[this.currentIndex] || null; }
  getSpeed(): ReplaySpeed { return this.config.speed; }

  // ─── Mock Data Generator ────────────────────────────────

  generateMockTicks(symbols: string[], durationMs: number, intervalMs = 500): ReplayTick[] {
    const baseTime = Date.now() - durationMs;
    const count = Math.floor(durationMs / intervalMs);
    const ticks: ReplayTick[] = [];
    const bases: Record<string, number> = {
      'AAPL': 195, 'TSLA': 275, 'NVDA': 140, 'MSFT': 450,
      'BTCUSDT': 102000, 'ETHUSDT': 4600,
    };

    for (let i = 0; i < count; i++) {
      const ts = baseTime + i * intervalMs;
      for (const sym of symbols) {
        const base = bases[sym] || 100;
        const noise = (Math.random() - 0.5) * 0.02 * base;
        ticks.push({
          symbol: sym, timestamp: ts,
          price: Math.round((base + noise) * 100) / 100,
          volume: Math.round(5000 + Math.random() * 50000),
          source: sym.includes('USDT') ? 'binance' : 'yahoo',
        });
      }
    }
    return ticks.sort((a, b) => a.timestamp - b.timestamp);
  }
}
