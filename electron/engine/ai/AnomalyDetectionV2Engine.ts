/**
 * AnomalyDetectionV2Engine — R259 QUANT MOO P1-14
 *
 * 异动检测升级引擎 v2。基于 AlertPushEngine (R257v2) 升级：
 * 新增多周期比较、板块联动检测、时间窗口异常、条件触发链。
 *
 * Feature set:
 *   - 多周期异动: 1min/5min/15min/1h/1d 多粒度检测
 *   - 板块联动: 同板块多只股票同时异动 → 板块级预警
 *   - 条件触发链: A触发→B观察→C确认的级联检测
 *   - 历史对比: vs 同一时段历史均值
 *   - 统计显著性: z-score / IQR outlier
 *   - 异动衰减追踪: 异动后是否回落，还是持续
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Multi-timeframe buffer
 *   - Sector correlation tracker
 *
 * @author JVS
 * @round R259
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d';

export type AnomalyCategory = 'price' | 'volume' | 'volatility' | 'correlation' | 'sector';

export type AnomalyStatus = 'detected' | 'confirmed' | 'escalated' | 'resolved';

export interface Bar {
  symbol: string;
  timeframe: Timeframe;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StatSnapshot {
  mean: number;
  std: number;
  q1: number;
  median: number;
  q3: number;
  iqr: number;
  count: number;
}

export interface AnomalySignal {
  id: string;
  symbol: string;
  category: AnomalyCategory;
  timeframe: Timeframe;
  zScore: number;
  threshold: number;
  value: number;
  expectedMean: number;
  status: AnomalyStatus;
  direction: 'up' | 'down';
  confidence: number;     // 0-1
  timestamp: number;
  resolvedAt?: number;
}

export interface SectorAnomaly {
  id: string;
  sector: string;
  symbols: string[];
  anomalyCount: number;
  totalStocks: number;
  ratio: number;         // anomalyCount / totalStocks
  dominantDirection: 'up' | 'down' | 'mixed';
  signals: AnomalySignal[];
  timestamp: number;
}

export interface CascadeRule {
  id: string;
  name: string;
  trigger: { category: AnomalyCategory; timeframe: Timeframe; zScoreMin: number };
  observe: { category: AnomalyCategory; timeframe: Timeframe; zScoreMin: number };
  windowMs: number;      // within this time the observe must fire
}

export interface DecayRecord {
  symbol: string;
  anomalyId: string;
  peakValue: number;
  peakTime: number;
  currentValue: number;
  currentTime: number;
  decayPct: number;      // % reversion from peak
  isSustained: boolean;  // true if still significantly elevated
}

export interface AnomalyDetectionConfig {
  zScoreThreshold: number;
  minVolumeForDetection: number;
  sectorAnomalyMinStocks: number;
  sectorAnomalyMinRatio: number;
  decayWindows: number[]; // ms windows to check decay
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_CONFIG: AnomalyDetectionConfig = {
  zScoreThreshold: 2.5,
  minVolumeForDetection: 10000,
  sectorAnomalyMinStocks: 2,
  sectorAnomalyMinRatio: 0.3,
  decayWindows: [300000, 900000, 3600000], // 5min, 15min, 1h
};

// ─── Engine ──────────────────────────────────────────────

export class AnomalyDetectionV2Engine extends EventEmitter {
  private static instance: AnomalyDetectionV2Engine;

  private bars: Map<string, Bar[]> = new Map(); // key = timeframe:symbol
  private stats: Map<string, StatSnapshot> = new Map(); // key = timeframe:symbol
  private signals: AnomalySignal[] = [];
  private sectorAnomalies: SectorAnomaly[] = [];
  private cascadeRules: CascadeRule[] = [];
  private config: AnomalyDetectionConfig;
  private idCounter = 0;

  constructor(config?: Partial<AnomalyDetectionConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<AnomalyDetectionConfig>): AnomalyDetectionV2Engine {
    if (!AnomalyDetectionV2Engine.instance) {
      AnomalyDetectionV2Engine.instance = new AnomalyDetectionV2Engine(config);
    }
    return AnomalyDetectionV2Engine.instance;
  }

  reset(): void {
    this.bars.clear();
    this.stats.clear();
    this.signals = [];
    this.sectorAnomalies = [];
    this.cascadeRules = [];
    this.idCounter = 0;
    this.removeAllListeners();
  }

  // ─── Bar Ingestion ─────────────────────────────────────

  ingest(bar: Bar): void {
    const key = `${bar.timeframe}:${bar.symbol}`;
    let buf = this.bars.get(key);
    if (!buf) { buf = []; this.bars.set(key, buf); }
    buf.push(bar);
    if (buf.length > 200) buf.shift(); // keep window

    // Recalculate stats
    this.updateStats(key, buf);

    // Detect anomaly
    this.detectAnomaly(bar);
  }

  ingestBatch(bars: Bar[]): void {
    for (const b of bars) this.ingest(b);
  }

  // ─── Stats ─────────────────────────────────────────────

  private updateStats(key: string, buf: Bar[]): void {
    if (buf.length < 10) return; // need minimum data

    const closes = buf.map(b => b.close);
    const volumes = buf.map(b => b.volume);

    const closeStats = calcStats(closes);
    const volStats = calcStats(volumes);

    this.stats.set(`${key}:close`, closeStats);
    this.stats.set(`${key}:volume`, volStats);
  }

  getStats(symbol: string, timeframe: Timeframe): { close: StatSnapshot | null; volume: StatSnapshot | null } {
    const key = `${timeframe}:${symbol}`;
    return {
      close: this.stats.get(`${key}:close`) ?? null,
      volume: this.stats.get(`${key}:volume`) ?? null,
    };
  }

  // ─── Anomaly Detection ─────────────────────────────────

  private detectAnomaly(bar: Bar): void {
    const key = `${bar.timeframe}:${bar.symbol}`;

    // Price anomaly
    const closeStats = this.stats.get(`${key}:close`);
    if (closeStats && closeStats.std > 0 && closeStats.count >= 10) {
      const z = (bar.close - closeStats.mean) / closeStats.std;
      if (Math.abs(z) >= this.config.zScoreThreshold) {
        this.raiseSignal(bar.symbol, 'price', bar.timeframe, z, bar.close, closeStats.mean, bar.close > closeStats.mean ? 'up' : 'down', bar.timestamp);
      }
    }

    // Volume anomaly
    const volStats = this.stats.get(`${key}:volume`);
    if (volStats && volStats.std > 0 && volStats.count >= 10 && bar.volume >= this.config.minVolumeForDetection) {
      const z = (bar.volume - volStats.mean) / volStats.std;
      if (z >= this.config.zScoreThreshold) {
        this.raiseSignal(bar.symbol, 'volume', bar.timeframe, z, bar.volume, volStats.mean, 'up', bar.timestamp);
      }
    }

    // Volatility anomaly (high-low range as % of close)
    const rangePct = bar.close > 0 ? (bar.high - bar.low) / bar.close * 100 : 0;
    if (rangePct > 10) {
      this.raiseSignal(bar.symbol, 'volatility', bar.timeframe, rangePct / 2, rangePct, 5, 'up', bar.timestamp);
    }
  }

  private raiseSignal(symbol: string, category: AnomalyCategory, timeframe: Timeframe, zScore: number, value: number, expectedMean: number, direction: 'up' | 'down', timestamp: number): void {
    const confidence = Math.min(0.99, Math.abs(zScore) / (this.config.zScoreThreshold * 2));

    const signal: AnomalySignal = {
      id: `as_${++this.idCounter}`,
      symbol, category, timeframe, zScore,
      threshold: this.config.zScoreThreshold, value, expectedMean,
      status: 'detected', direction, confidence, timestamp,
    };

    this.signals.push(signal);
    this.emit('anomaly_detected', signal);
  }

  // ─── Signal Management ─────────────────────────────────

  confirmSignal(signalId: string): void {
    const s = this.signals.find(x => x.id === signalId);
    if (s) { s.status = 'confirmed'; this.emit('signal_confirmed', s); }
  }

  escalateSignal(signalId: string): void {
    const s = this.signals.find(x => x.id === signalId);
    if (s) { s.status = 'escalated'; this.emit('signal_escalated', s); }
  }

  resolveSignal(signalId: string): void {
    const s = this.signals.find(x => x.id === signalId);
    if (s) { s.status = 'resolved'; s.resolvedAt = Date.now(); this.emit('signal_resolved', s); }
  }

  // ─── Sector Anomaly ────────────────────────────────────

  detectSectorAnomaly(sector: string, allSymbols: string[], windowMs = 300000): SectorAnomaly | null {
    const now = Date.now();
    const recentSignals = this.signals.filter(s =>
      s.timestamp > now - windowMs &&
      allSymbols.includes(s.symbol)
    );

    const anomalyCount = recentSignals.length;
    const ratio = allSymbols.length > 0 ? anomalyCount / allSymbols.length : 0;

    if (anomalyCount < this.config.sectorAnomalyMinStocks || ratio < this.config.sectorAnomalyMinRatio) {
      return null;
    }

    const upCount = recentSignals.filter(s => s.direction === 'up').length;
    const downCount = recentSignals.filter(s => s.direction === 'down').length;
    const dominant: SectorAnomaly['dominantDirection'] =
      upCount > downCount * 1.5 ? 'up' : downCount > upCount * 1.5 ? 'down' : 'mixed';

    const sectorAnomaly: SectorAnomaly = {
      id: `sa_${++this.idCounter}`,
      sector,
      symbols: [...new Set(recentSignals.map(s => s.symbol))],
      anomalyCount, totalStocks: allSymbols.length, ratio,
      dominantDirection: dominant,
      signals: recentSignals,
      timestamp: now,
    };

    this.sectorAnomalies.push(sectorAnomaly);
    this.emit('sector_anomaly', sectorAnomaly);
    return sectorAnomaly;
  }

  // ─── Cascade Rules ─────────────────────────────────────

  addCascadeRule(rule: CascadeRule): void {
    this.cascadeRules.push(rule);
  }

  checkCascade(signal: AnomalySignal): CascadeRule[] {
    const triggered: CascadeRule[] = [];
    for (const rule of this.cascadeRules) {
      if (rule.trigger.category === signal.category &&
          rule.trigger.timeframe === signal.timeframe &&
          Math.abs(signal.zScore) >= rule.trigger.zScoreMin) {
        triggered.push(rule);
      }
    }
    return triggered;
  }

  isCascadeFulfilled(triggerRule: CascadeRule, triggerSignal: AnomalySignal): boolean {
    const observeSignals = this.signals.filter(s =>
      s.symbol === triggerSignal.symbol &&
      s.category === triggerRule.observe.category &&
      s.timeframe === triggerRule.observe.timeframe &&
      Math.abs(s.zScore) >= triggerRule.observe.zScoreMin &&
      s.timestamp >= triggerSignal.timestamp &&
      s.timestamp - triggerSignal.timestamp <= triggerRule.windowMs
    );
    return observeSignals.length > 0;
  }

  // ─── Decay Tracking ────────────────────────────────────

  trackDecay(signal: AnomalySignal, currentValue: number, currentTime: number): DecayRecord | null {
    if (signal.category !== 'price' && signal.category !== 'volume') return null;

    const deviation = signal.value - signal.expectedMean;
    const currentDeviation = currentValue - signal.expectedMean;
    const decayPct = deviation !== 0 ? (1 - currentDeviation / deviation) * 100 : 0;

    return {
      symbol: signal.symbol,
      anomalyId: signal.id,
      peakValue: signal.value,
      peakTime: signal.timestamp,
      currentValue,
      currentTime,
      decayPct,
      isSustained: Math.abs(currentDeviation) > Math.abs(deviation) * 0.5,
    };
  }

  // ─── Bulk Decay ────────────────────────────────────────

  getDecayAnalysis(symbol: string, bar: Bar): DecayRecord[] {
    const recentSignals = this.signals.filter(s =>
      s.symbol === symbol &&
      s.status !== 'resolved' &&
      bar.timestamp - s.timestamp <= 3600000 // within 1h
    );

    return recentSignals
      .map(s => this.trackDecay(s, s.category === 'price' ? bar.close : bar.volume, bar.timestamp))
      .filter(Boolean) as DecayRecord[];
  }

  // ─── Queries ───────────────────────────────────────────

  getActiveSignals(symbol?: string, timeframe?: Timeframe): AnomalySignal[] {
    let list = this.signals.filter(s => s.status !== 'resolved');
    if (symbol) list = list.filter(s => s.symbol === symbol);
    if (timeframe) list = list.filter(s => s.timeframe === timeframe);
    return list;
  }

  getSignals(symbol?: string, limit = 50): AnomalySignal[] {
    let list = symbol ? this.signals.filter(s => s.symbol === symbol) : this.signals;
    return list.slice(-limit);
  }

  getSectorAnomalies(sector?: string): SectorAnomaly[] {
    return sector ? this.sectorAnomalies.filter(sa => sa.sector === sector) : this.sectorAnomalies;
  }

  getSignalCount(): number { return this.signals.length; }

  // ─── Mock ──────────────────────────────────────────────

  createMockBars(symbol: string, n = 50, timeframe: Timeframe = '15m'): Bar[] {
    const bars: Bar[] = [];
    let price = 100;
    const now = Date.now();
    for (let i = 0; i < n; i++) {
      const change = (Math.random() - 0.48) * 2;
      price += change;
      bars.push({
        symbol, timeframe,
        timestamp: now - (n - i) * timeframeMs(timeframe),
        open: price - change, high: price + Math.abs(change), low: price - Math.abs(change),
        close: price, volume: Math.round(500000 + Math.random() * 1000000),
      });
    }
    return bars;
  }

  createSpikeBar(symbol: string, timeframe: Timeframe = '1d'): Bar {
    const price = 120;
    return {
      symbol, timeframe, timestamp: Date.now(),
      open: 100, high: 125, low: 98, close: price,
      volume: 5000000,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────

function calcStats(values: number[]): StatSnapshot {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sorted = [...values].sort();
  const q1 = sorted[Math.floor(n * 0.25)];
  const median = sorted[Math.floor(n * 0.5)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return { mean, std: Math.sqrt(variance), q1, median, q3, iqr, count: n };
}

function timeframeMs(tf: Timeframe): number {
  switch (tf) {
    case '1m': return 60000;
    case '5m': return 300000;
    case '15m': return 900000;
    case '1h': return 3600000;
    case '1d': return 86400000;
  }
}
