/**
 * Multi-Timeframe Signal Fusion Engine
 * Dawn Whales Project (J-39-02, R39)
 *
 * Aggregates and fuses signals from multiple timeframes (1m/5m/15m/30m/1h/4h/1d).
 * Supports majority, weighted, and any fusion modes.
 *
 * Uses inline EventEmitter polyfill for jsdom compatibility.
 */

import log from 'electron-log';
import { EngineError } from '../core/engine-error';


// ============================================================================
// EventEmitter Polyfill
// ============================================================================

type EventListener = (...args: unknown[]) => void;

class EventEmitterPolyfill {
  private _listeners: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const list = this._listeners.get(event) ?? [];
    list.push(listener);
    this._listeners.set(event, list);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const list = this._listeners.get(event);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
      if (list.length === 0) this._listeners.delete(event);
    }
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapper = (...args: unknown[]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) {
      try { fn(...args); } catch (err) {
        log.error('[MultiTimeframeEngine] Event listener error:', err);
      }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) { this._listeners.delete(event); }
    else { this._listeners.clear(); }
    return this;
  }

  listenerCount(event: string): number {
    return this._listeners.get(event)?.length ?? 0;
  }
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export type TimeframeKey = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
export type SignalDirection = 'BUY' | 'SELL' | 'HOLD';
export type FusionMode = 'majority' | 'weighted' | 'any';
export type EngineStatus = 'idle' | 'active' | 'error';

export interface TimeframeSignal {
  timeframe: TimeframeKey;
  symbol: string;
  direction: SignalDirection;
  strength: number; // 0-100
  timestamp: number;
  strategy?: string;
  metadata?: Record<string, any>;
}

export interface TimeframeConfig {
  timeframe: TimeframeKey;
  weight: number; // 0-1, importance in fusion
  enabled: boolean;
  minStrength: number; // minimum signal strength to consider
  stalenessMs: number; // max age of signal before considered stale
}

export interface FusionConfig {
  mode: FusionMode;
  minTimeframes: number; // minimum timeframes needed for valid fusion
  majorityThreshold: number; // 0.5-1.0, fraction needed for majority
  anyThreshold: number; // minimum strength for 'any' mode
  enableStalenessCheck: boolean;
  defaultStalenessMs: number;
}

export interface FusionResult {
  symbol: string;
  direction: SignalDirection;
  confidence: number; // 0-100
  strength: number; // 0-100
  contributingTimeframes: TimeframeKey[];
  fusedAt: number;
  mode: FusionMode;
  details: {
    timeframe: TimeframeKey;
    direction: SignalDirection;
    strength: number;
    weight: number;
    isStale: boolean;
  }[];
}

export interface TimeframeStats {
  timeframe: TimeframeKey;
  signalCount: number;
  avgStrength: number;
  lastSignalAt: number;
  staleCount: number;
  directionDistribution: Record<SignalDirection, number>;
}

export interface EngineConfig {
  fusion: FusionConfig;
  timeframes: Partial<Record<TimeframeKey, Partial<TimeframeConfig>>>;
}

// ============================================================================
// Constants
// ============================================================================

const TIMEFRAME_ORDER: TimeframeKey[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

const TIMEFRAME_MS: Record<TimeframeKey, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

const DEFAULT_TIMEFRAME_CONFIG: Record<TimeframeKey, TimeframeConfig> = {
  '1m':  { timeframe: '1m',  weight: 0.05, enabled: true, minStrength: 30, stalenessMs: 120_000 },
  '5m':  { timeframe: '5m',  weight: 0.10, enabled: true, minStrength: 30, stalenessMs: 300_000 },
  '15m': { timeframe: '15m', weight: 0.15, enabled: true, minStrength: 30, stalenessMs: 900_000 },
  '30m': { timeframe: '30m', weight: 0.15, enabled: true, minStrength: 25, stalenessMs: 1_800_000 },
  '1h':  { timeframe: '1h',  weight: 0.20, enabled: true, minStrength: 25, stalenessMs: 3_600_000 },
  '4h':  { timeframe: '4h',  weight: 0.20, enabled: true, minStrength: 20, stalenessMs: 14_400_000 },
  '1d':  { timeframe: '1d',  weight: 0.15, enabled: true, minStrength: 20, stalenessMs: 86_400_000 },
};

const DEFAULT_FUSION_CONFIG: FusionConfig = {
  mode: 'weighted',
  minTimeframes: 2,
  majorityThreshold: 0.6,
  anyThreshold: 60,
  enableStalenessCheck: true,
  defaultStalenessMs: 3_600_000,
};

// ============================================================================
// Multi-Timeframe Engine
// ============================================================================

export class MultiTimeframeEngine extends EventEmitterPolyfill {
  private fusionConfig: FusionConfig;
  private timeframeConfigs: Map<TimeframeKey, TimeframeConfig> = new Map();
  private signals: Map<string, Map<TimeframeKey, TimeframeSignal>> = new Map(); // symbol -> (tf -> signal)
  private fusionHistory: Map<string, FusionResult[]> = new Map(); // symbol -> fusion results
  private status: EngineStatus = 'idle';
  private maxHistoryPerSymbol = 100;

  constructor(config?: EngineConfig) {
    super();
    this.fusionConfig = {
      ...DEFAULT_FUSION_CONFIG,
      ...(config?.fusion ?? {}),
    };

    // Initialize timeframe configs
    for (const tf of TIMEFRAME_ORDER) {
      const defaults = DEFAULT_TIMEFRAME_CONFIG[tf];
      const overrides = config?.timeframes?.[tf] ?? {};
      this.timeframeConfigs.set(tf, { ...defaults, ...overrides });
    }

    this.status = 'active';
    log.info(`[MultiTimeframeEngine] Initialized (mode=${this.fusionConfig.mode})`);
  }

  // ── Signal Input ──────────────────────────────────────────────────

  /**
   * Submit a signal from a specific timeframe
   */
  submitSignal(signal: TimeframeSignal): void {
    if (!this.timeframeConfigs.has(signal.timeframe)) {
      log.warn(`[MultiTimeframeEngine] Unknown timeframe: ${signal.timeframe}`);
      return;
    }

    const tfConfig = this.timeframeConfigs.get(signal.timeframe)!;
    if (!tfConfig.enabled) {
      log.debug(`[MultiTimeframeEngine] Timeframe ${signal.timeframe} disabled, skipping`);
      return;
    }

    if (signal.strength < tfConfig.minStrength) {
      log.debug(`[MultiTimeframeEngine] Signal strength ${signal.strength} below threshold ${tfConfig.minStrength}`);
      return;
    }

    // Store signal
    if (!this.signals.has(signal.symbol)) {
      this.signals.set(signal.symbol, new Map());
    }
    this.signals.get(signal.symbol)!.set(signal.timeframe, signal);

    this.emit('signal:received', signal);

    // Auto-fuse if enough timeframes
    const result = this.fuse(signal.symbol);
    if (result) {
      this.emit('fusion:result', result);
    }
  }

  /**
   * Submit multiple signals at once
   */
  submitBatch(signals: TimeframeSignal[]): void {
    for (const signal of signals) {
      this.submitSignal(signal);
    }
  }

  // ── Fusion Logic ──────────────────────────────────────────────────

  /**
   * Fuse signals for a specific symbol
   */
  fuse(symbol: string): FusionResult | null {
    const symbolSignals = this.signals.get(symbol);
    if (!symbolSignals || symbolSignals.size === 0) return null;

    const now = Date.now();
    const details: FusionResult['details'] = [];
    let activeCount = 0;

    // Gather signals from all enabled timeframes
    for (const tf of TIMEFRAME_ORDER) {
      const config = this.timeframeConfigs.get(tf)!;
      if (!config.enabled) continue;

      const signal = symbolSignals.get(tf);
      if (!signal) continue;

      const stalenessMs = config.stalenessMs || this.fusionConfig.defaultStalenessMs;
      const isStale = this.fusionConfig.enableStalenessCheck &&
        (now - signal.timestamp > stalenessMs);

      details.push({
        timeframe: tf,
        direction: signal.direction,
        strength: signal.strength,
        weight: config.weight,
        isStale,
      });

      if (!isStale) activeCount++;
    }

    // Check minimum timeframes
    if (activeCount < this.fusionConfig.minTimeframes) {
      return null;
    }

    // Perform fusion based on mode
    let result: FusionResult;

    switch (this.fusionConfig.mode) {
      case 'majority':
        result = this.fuseMajority(symbol, details);
        break;
      case 'weighted':
        result = this.fuseWeighted(symbol, details);
        break;
      case 'any':
        result = this.fuseAny(symbol, details);
        break;
      default:
        result = this.fuseWeighted(symbol, details);
    }

    // Store in history
    if (!this.fusionHistory.has(symbol)) {
      this.fusionHistory.set(symbol, []);
    }
    const history = this.fusionHistory.get(symbol)!;
    history.push(result);
    if (history.length > this.maxHistoryPerSymbol) {
      history.shift();
    }

    return result;
  }

  private fuseMajority(symbol: string, details: FusionResult['details']): FusionResult {
    // Only consider non-stale signals
    const active = details.filter(d => !d.isStale);

    // Count directions
    const counts: Record<SignalDirection, number> = { BUY: 0, SELL: 0, HOLD: 0 };
    const strengthSums: Record<SignalDirection, number> = { BUY: 0, SELL: 0, HOLD: 0 };

    for (const d of active) {
      counts[d.direction]++;
      strengthSums[d.direction] += d.strength;
    }

    const total = active.length;
    const threshold = Math.ceil(total * this.fusionConfig.majorityThreshold);

    let direction: SignalDirection = 'HOLD';
    let confidence = 0;

    for (const dir of ['BUY', 'SELL', 'HOLD'] as SignalDirection[]) {
      if (counts[dir] >= threshold) {
        direction = dir;
        confidence = (counts[dir] / total) * 100;
        break;
      }
    }

    // If no majority, use the one with most votes
    if (direction === 'HOLD' && counts.HOLD < threshold) {
      const maxDir = (['BUY', 'SELL'] as SignalDirection[]).reduce((best, dir) =>
        counts[dir] > counts[best] ? dir : best, 'BUY' as SignalDirection);
      if (counts[maxDir] > 0) {
        direction = maxDir;
        confidence = (counts[maxDir] / total) * 100;
      }
    }

    const avgStrength = strengthSums[direction] / Math.max(1, counts[direction]);

    return {
      symbol,
      direction,
      confidence,
      strength: avgStrength,
      contributingTimeframes: active.map(d => d.timeframe),
      fusedAt: Date.now(),
      mode: 'majority',
      details,
    };
  }

  private fuseWeighted(symbol: string, details: FusionResult['details']): FusionResult {
    const active = details.filter(d => !d.isStale);
    if (active.length === 0) {
      return {
        symbol,
        direction: 'HOLD',
        confidence: 0,
        strength: 0,
        contributingTimeframes: [],
        fusedAt: Date.now(),
        mode: 'weighted',
        details,
      };
    }

    // Calculate weighted scores per direction
    const scores: Record<SignalDirection, number> = { BUY: 0, SELL: 0, HOLD: 0 };
    const totalWeight = active.reduce((sum, d) => sum + d.weight, 0);

    for (const d of active) {
      scores[d.direction] += d.strength * d.weight;
    }

    // Normalize by total weight
    for (const dir of ['BUY', 'SELL', 'HOLD'] as SignalDirection[]) {
      scores[dir] = totalWeight > 0 ? scores[dir] / totalWeight : 0;
    }

    // Pick direction with highest weighted score
    let bestDir: SignalDirection = 'HOLD';
    let bestScore = scores.HOLD;

    for (const dir of ['BUY', 'SELL'] as SignalDirection[]) {
      if (scores[dir] > bestScore) {
        bestScore = scores[dir];
        bestDir = dir;
      }
    }

    // Confidence based on score dominance
    const totalScore = scores.BUY + scores.SELL + scores.HOLD;
    const confidence = totalScore > 0 ? (bestScore / totalScore) * 100 : 0;

    return {
      symbol,
      direction: bestDir,
      confidence,
      strength: bestScore,
      contributingTimeframes: active.map(d => d.timeframe),
      fusedAt: Date.now(),
      mode: 'weighted',
      details,
    };
  }

  private fuseAny(symbol: string, details: FusionResult['details']): FusionResult {
    const active = details.filter(d => !d.isStale);

    // 'Any' mode: if any timeframe has a strong enough signal, use it
    const strongSignals = active.filter(d => d.strength >= this.fusionConfig.anyThreshold);

    if (strongSignals.length === 0) {
      return {
        symbol,
        direction: 'HOLD',
        confidence: 0,
        strength: 0,
        contributingTimeframes: [],
        fusedAt: Date.now(),
        mode: 'any',
        details,
      };
    }

    // Take the strongest signal
    const strongest = strongSignals.reduce((best, d) =>
      d.strength > best.strength ? d : best, strongSignals[0]);

    return {
      symbol,
      direction: strongest.direction,
      confidence: strongest.strength,
      strength: strongest.strength,
      contributingTimeframes: [strongest.timeframe],
      fusedAt: Date.now(),
      mode: 'any',
      details,
    };
  }

  // ── Configuration ──────────────────────────────────────────────────

  /**
   * Get fusion config
   */
  getFusionConfig(): FusionConfig {
    return { ...this.fusionConfig };
  }

  /**
   * Update fusion config
   */
  setFusionConfig(config: Partial<FusionConfig>): void {
    this.fusionConfig = { ...this.fusionConfig, ...config };
    log.info(`[MultiTimeframeEngine] Fusion config updated (mode=${this.fusionConfig.mode})`);
  }

  /**
   * Get timeframe config
   */
  getTimeframeConfig(tf: TimeframeKey): TimeframeConfig | null {
    return this.timeframeConfigs.get(tf) ?? null;
  }

  /**
   * Update timeframe config
   */
  setTimeframeConfig(tf: TimeframeKey, config: Partial<TimeframeConfig>): boolean {
    const existing = this.timeframeConfigs.get(tf);
    if (!existing) return false;
    this.timeframeConfigs.set(tf, { ...existing, ...config });
    return true;
  }

  /**
   * Enable/disable a timeframe
   */
  setTimeframeEnabled(tf: TimeframeKey, enabled: boolean): boolean {
    const config = this.timeframeConfigs.get(tf);
    if (!config) return false;
    config.enabled = enabled;
    return true;
  }

  /**
   * Set weight for a timeframe
   */
  setTimeframeWeight(tf: TimeframeKey, weight: number): boolean {
    const config = this.timeframeConfigs.get(tf);
    if (!config) return false;
    config.weight = Math.max(0, Math.min(1, weight));
    return true;
  }

  // ── Query & Analytics ──────────────────────────────────────────────

  /**
   * Get latest fusion result for symbol
   */
  getLatestFusion(symbol: string): FusionResult | null {
    const history = this.fusionHistory.get(symbol);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Get fusion history for symbol
   */
  getFusionHistory(symbol: string, limit?: number): FusionResult[] {
    const history = this.fusionHistory.get(symbol) ?? [];
    return limit ? history.slice(-limit) : [...history];
  }

  /**
   * Get current signals for symbol
   */
  getCurrentSignals(symbol: string): TimeframeSignal[] {
    const symbolSignals = this.signals.get(symbol);
    if (!symbolSignals) return [];
    return Array.from(symbolSignals.values());
  }

  /**
   * Get statistics per timeframe
   */
  getTimeframeStats(): TimeframeStats[] {
    const stats: TimeframeStats[] = [];
    const now = Date.now();

    for (const tf of TIMEFRAME_ORDER) {
      const config = this.timeframeConfigs.get(tf)!;
      let signalCount = 0;
      let totalStrength = 0;
      let lastSignalAt = 0;
      let staleCount = 0;
      const dirDist: Record<SignalDirection, number> = { BUY: 0, SELL: 0, HOLD: 0 };

      for (const [, symbolSignals] of this.signals) {
        const signal = symbolSignals.get(tf);
        if (signal) {
          signalCount++;
          totalStrength += signal.strength;
          lastSignalAt = Math.max(lastSignalAt, signal.timestamp);
          dirDist[signal.direction]++;

          const stalenessMs = config.stalenessMs || this.fusionConfig.defaultStalenessMs;
          if (now - signal.timestamp > stalenessMs) staleCount++;
        }
      }

      stats.push({
        timeframe: tf,
        signalCount,
        avgStrength: signalCount > 0 ? totalStrength / signalCount : 0,
        lastSignalAt,
        staleCount,
        directionDistribution: dirDist,
      });
    }

    return stats;
  }

  /**
   * Get all tracked symbols
   */
  getSymbols(): string[] {
    return Array.from(this.signals.keys());
  }

  /**
   * Get engine status
   */
  getStatus(): EngineStatus {
    return this.status;
  }

  /**
   * Get timeframe order
   */
  getTimeframeOrder(): TimeframeKey[] {
    return [...TIMEFRAME_ORDER];
  }

  /**
   * Check if a signal is stale
   */
  isSignalStale(signal: TimeframeSignal): boolean {
    const config = this.timeframeConfigs.get(signal.timeframe);
    if (!config) return true;
    const stalenessMs = config.stalenessMs || this.fusionConfig.defaultStalenessMs;
    return Date.now() - signal.timestamp > stalenessMs;
  }

  // ── Cleanup ──────────────────────────────────────────────────────

  /**
   * Clear signals for a symbol
   */
  clearSymbol(symbol: string): void {
    this.signals.delete(symbol);
    this.fusionHistory.delete(symbol);
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.signals.clear();
    this.fusionHistory.clear();
  }

  /**
   * Reset engine
   */
  reset(): void {
    this.clearAll();
    this.status = 'idle';
    this.removeAllListeners();
  }

  /**
   * Destroy engine
   */
  destroy(): void {
    this.reset();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let engineInstance: MultiTimeframeEngine | null = null;

export function getMultiTimeframeEngine(config?: EngineConfig): MultiTimeframeEngine {
  if (!engineInstance) {
    engineInstance = new MultiTimeframeEngine(config);
  }
  return engineInstance;
}
