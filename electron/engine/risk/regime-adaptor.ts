// ── Q24: Regime Adaptor ──────────────────────────────────────────────────────
// Automatically adapts strategy style based on detected market regime
// Bull / Bear / Range / Volatile — each with different parameter sets
// Consumes Q8 RegimeDetector output

import log from 'electron-log';
import { RegimeDetector, RegimeType, RegimeResult } from './regime-detector';

// ── Types ───────────────────────────────────────────────────────────────────

export interface RegimeStyleConfig {
  // Parameter overrides per regime
  stopLossPct: number;      // Stop loss distance
  takeProfitPct: number;    // Take profit distance
  maxPositionPct: number;   // Max position size
  useKelly: boolean;        // Apply Kelly or fixed size
  leverage: number;         // 1.0 = no leverage
  stopTrading: boolean;     // True = suspend all new positions

  // Strategy preferences
  preferMomentum: boolean;  // Momentum strategies preferred
  preferMeanReversion: boolean; // Mean reversion preferred
  trendFollowingStrength: number; // 0-1
  signalThreshold: number;   // Signal confidence threshold
}

export interface RegimeStyle {
  regime: RegimeType;
  label: string;
  emoji: string;
  config: RegimeStyleConfig;
  description: string;
}

export interface AdaptorStatus {
  currentRegime: RegimeType;
  currentStyle: RegimeStyle;
  recentRegimeChanges: Array<{ regime: RegimeType; timestamp: number }>;
  activeStrategies: string[];
  suppressedStrategies: string[];
}

// ── Regime Style Presets ────────────────────────────────────────────────────

const REGIME_STYLES: Record<RegimeType, RegimeStyle> = {
  BULL: {
    regime: 'BULL',
    label: i18n.t('regimeAdaptor.k1'),
    emoji: '📈',
    description: i18n.t('regimeAdaptor.k2'),
    config: {
      stopLossPct: 0.05,      // Tight stop - protect gains
      takeProfitPct: 0.20,     // Let winners run
      maxPositionPct: 0.15,   // Larger positions
      useKelly: true,
      leverage: 1.0,
      stopTrading: false,
      preferMomentum: true,
      preferMeanReversion: false,
      trendFollowingStrength: 0.9,
      signalThreshold: 0.55,
    },
  },
  BEAR: {
    regime: 'BEAR',
    label: i18n.t('regimeAdaptor.k3'),
    emoji: '📉',
    description: i18n.t('regimeAdaptor.k4'),
    config: {
      stopLossPct: 0.03,      // Very tight
      takeProfitPct: 0.10,     // Take profit quickly
      maxPositionPct: 0.05,   // Small positions only
      useKelly: false,
      leverage: 0.5,
      stopTrading: false,
      preferMomentum: false,
      preferMeanReversion: true,
      trendFollowingStrength: 0.3,
      signalThreshold: 0.75,
    },
  },
  RANGE: {
    regime: 'RANGE',
    label: i18n.t('regimeAdaptor.k5'),
    emoji: '↔️',
    description: i18n.t('regimeAdaptor.k6'),
    config: {
      stopLossPct: 0.04,
      takeProfitPct: 0.08,
      maxPositionPct: 0.10,
      useKelly: false,
      leverage: 1.0,
      stopTrading: false,
      preferMomentum: false,
      preferMeanReversion: true,
      trendFollowingStrength: 0.2,
      signalThreshold: 0.60,
    },
  },
  VOLATILE: {
    regime: 'VOLATILE',
    label: i18n.t('regimeAdaptor.k7'),
    emoji: '⚡',
    description: i18n.t('regimeAdaptor.k8'),
    config: {
      stopLossPct: 0.08,      // Wider stop
      takeProfitPct: 0.15,
      maxPositionPct: 0.03,   // Minimal size
      useKelly: false,
      leverage: 0.3,
      stopTrading: false,
      preferMomentum: false,
      preferMeanReversion: false,
      trendFollowingStrength: 0.5,
      signalThreshold: 0.80,
    },
  },
  UNKNOWN: {
    regime: 'UNKNOWN',
    label: i18n.t('regimeAdaptor.k9'),
    emoji: '❓',
    description: i18n.t('regimeAdaptor.k10'),
    config: {
      stopLossPct: 0.05,
      takeProfitPct: 0.10,
      maxPositionPct: 0.05,
      useKelly: false,
      leverage: 0.5,
      stopTrading: true,
      preferMomentum: false,
      preferMeanReversion: false,
      trendFollowingStrength: 0.3,
      signalThreshold: 0.80,
    },
  },
};

// ── Regime Adaptor ──────────────────────────────────────────────────────────

export class RegimeAdaptor {
  private regimeDetector: RegimeDetector;
  private currentRegime: RegimeType = 'UNKNOWN';
  private currentStyle: RegimeStyle = REGIME_STYLES.UNKNOWN;
  private regimeHistory: Array<{ regime: RegimeType; timestamp: number }> = [];
  private activeStrategies: Set<string> = new Set();
  private suppressedStrategies: Set<string> = new Set();
  private overrideRegime?: RegimeType; // Manual override

  constructor() {
    this.regimeDetector = new RegimeDetector();
    log.info('[RegimeAdaptor] Initialized in UNKNOWN regime');
  }

  // ── Detect and Adapt ───────────────────────────────────────────────────

  detectAndAdapt(vixPercentile?: number): RegimeStyle {
    const regimeResult = this.regimeDetector.detect(vixPercentile);
    return this.adaptToRegime(regimeResult);
  }

  adaptToRegime(result: RegimeResult): RegimeStyle {
    const newRegime = result.regime;
    const newStyle = REGIME_STYLES[newRegime] ?? REGIME_STYLES.UNKNOWN;

    // Regime change?
    if (newRegime !== this.currentRegime) {
      this.onRegimeChange(newRegime, newStyle, result);
    }

    this.currentRegime = newRegime;
    this.currentStyle = newStyle;

    return newStyle;
  }

  // ── Regime Change Handler ─────────────────────────────────────────────

  private onRegimeChange(newRegime: RegimeType, newStyle: RegimeStyle, result: RegimeResult): void {
    const prev = this.currentRegime;
    const now = Date.now();

    this.regimeHistory.push({ regime: newRegime, timestamp: now });
    if (this.regimeHistory.length > 20) this.regimeHistory.shift();

    log.warn(`[RegimeAdaptor] ⚠️ REGIME CHANGE: ${prev} → ${newRegime} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
    log.info(`[RegimeAdaptor] Style: ${newStyle.label} ${newStyle.description}`);
    log.info(`[RegimeAdaptor] StopLoss: ${(newStyle.config.stopLossPct * 100).toFixed(0)}% | MaxPos: ${(newStyle.config.maxPositionPct * 100).toFixed(0)}% | Leverage: ${newStyle.config.leverage}x`);

    if (newStyle.config.stopTrading) {
      log.warn('[RegimeAdaptor] ⛔ STOP TRADING: Regime requires full pause');
      this.suppressAllStrategies();
    } else {
      this.adjustStrategiesForRegime(newStyle);
    }

    this.emit('regime:changed', {
      previous: prev,
      current: newRegime,
      style: newStyle,
      result,
      timestamp: now,
    });
  }

  // ── Strategy Adjustment ────────────────────────────────────────────────

  adjustStrategiesForRegime(style: RegimeStyle): void {
    const { preferMomentum, preferMeanReversion } = style.config;

    log.info(`[RegimeAdaptor] Strategy preference: momentum=${preferMomentum}, meanReversion=${preferMeanReversion}`);

    // For each active strategy, log the applicable parameter adjustments
    for (const strategyId of this.activeStrategies) {
      const adjusted = this.getAdjustedParams(strategyId, style);
      log.info(`[RegimeAdaptor] ${strategyId}: stopLoss=${(adjusted.stopLossPct*100).toFixed(0)}%, size=${(adjusted.maxPositionPct*100).toFixed(0)}%`);
    }
  }

  getAdjustedParams(strategyId: string, style?: RegimeStyle): RegimeStyleConfig {
    const activeStyle = style ?? this.currentStyle;
    return { ...activeStyle.config };
  }

  // ── Signal Filtering ───────────────────────────────────────────────────

  shouldEnterPosition(signalScore: number, strategyId: string): boolean {
    const { signalThreshold, stopTrading } = this.currentStyle.config;

    if (stopTrading) {
      log.info(`[RegimeAdaptor] Blocked ${strategyId}: stopTrading=true`);
      return false;
    }

    if (signalScore < signalThreshold) {
      log.info(`[RegimeAdaptor] Blocked ${strategyId}: signal ${signalScore.toFixed(2)} < threshold ${signalThreshold.toFixed(2)}`);
      return false;
    }

    return true;
  }

  getPositionSize(baseSize: number, strategyId: string): number {
    const { maxPositionPct, useKelly, leverage } = this.currentStyle.config;
    const adjusted = baseSize * maxPositionPct * leverage;
    return Math.round(adjusted * 100) / 100;
  }

  // ── Strategy Management ────────────────────────────────────────────────

  registerStrategy(strategyId: string): void {
    this.activeStrategies.add(strategyId);
    log.info(`[RegimeAdaptor] Strategy registered: ${strategyId}`);
  }

  unregisterStrategy(strategyId: string): void {
    this.activeStrategies.delete(strategyId);
    this.suppressedStrategies.delete(strategyId);
  }

  suppressAllStrategies(): void {
    for (const id of this.activeStrategies) {
      this.suppressedStrategies.add(id);
    }
    log.warn(`[RegimeAdaptor] All ${this.activeStrategies.size} strategies suppressed`);
  }

  // ── Manual Override ────────────────────────────────────────────────────

  overrideRegime(regime: RegimeType): void {
    this.overrideRegime = regime;
    const style = REGIME_STYLES[regime] ?? REGIME_STYLES.UNKNOWN;
    log.warn(`[RegimeAdaptor] Manual override: ${regime}`);
    this.adaptToRegime({ regime, confidence: 1.0, label: 'MANUAL', description: 'Manual override' });
  }

  clearOverride(): void {
    if (this.overrideRegime) {
      this.overrideRegime = undefined;
      log.info('[RegimeAdaptor] Manual override cleared');
    }
  }

  // ── Status ─────────────────────────────────────────────────────────────

  getStatus(): AdaptorStatus {
    return {
      currentRegime: this.currentRegime,
      currentStyle: this.currentStyle,
      recentRegimeChanges: [...this.regimeHistory],
      activeStrategies: [...this.activeStrategies],
      suppressedStrategies: [...this.suppressedStrategies],
    };
  }

  // ── All Available Styles ──────────────────────────────────────────────

  getAllStyles(): RegimeStyle[] {
    return Object.values(REGIME_STYLES);
  }

  getStyleForRegime(regime: RegimeType): RegimeStyle {
    return REGIME_STYLES[regime] ?? REGIME_STYLES.UNKNOWN;
  }
}

// ── Extend EventEmitter ────────────────────────────────────────────────────

import { EventEmitter } from 'events';
import i18n from '../../../src/i18n';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(RegimeAdaptor as any).prototype.__proto__ = EventEmitter.prototype;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(RegimeAdaptor as any).prototype.emit = EventEmitter.prototype.emit;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(RegimeAdaptor as any).prototype.on = EventEmitter.prototype.on;

// ── Singleton ────────────────────────────────────────────────────────────────

let instance: RegimeAdaptor | null = null;

export function getRegimeAdaptor(): RegimeAdaptor {
  if (!instance) instance = new RegimeAdaptor();
  return instance;
}

export default RegimeAdaptor;
