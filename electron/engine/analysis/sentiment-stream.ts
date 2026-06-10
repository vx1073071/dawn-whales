// ── JVS-33: Real-time Sentiment Stream ─────────────────────────────────────
// Combines sentiment analysis with real-time market data from WebSocket

import { EventEmitter } from 'events';
import log from 'electron-log';
import { getSentimentEngine } from './sentiment-index';
import { getWsDataStream } from '../data/ws-data-stream';

// ── Types ──────────────────────────────────────────────────────────────────

interface SentimentTick {
  timestamp: number;
  overallScore: number;
  components: {
    market: number;
    volume: number;
    breadth: number;
    volatility: number;
    momentum: number;
  };
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  change: number;
  trend: 'improving' | 'deteriorating' | 'stable';
}

interface SentimentAlert {
  timestamp: number;
  type: 'extreme_bullish' | 'extreme_bearish' | 'rapid_change' | 'divergence';
  severity: 'low' | 'medium' | 'high';
  message: string;
  sentimentScore: number;
  details: unknown;
}

interface SentimentStreamConfig {
  updateInterval: number; // milliseconds
  alertThresholds: {
    extreme: number; // 0-100
    rapidChange: number; // points per minute
    divergence: number; // correlation threshold
  };
  historySize: number; // number of ticks to keep
}

// ── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_CONFIG: SentimentStreamConfig = {
  updateInterval: 5000, // 5 seconds
  alertThresholds: {
    extreme: 80, // alert if sentiment > 80 or < -80
    rapidChange: 20, // alert if sentiment changes > 20 points per minute
    divergence: 0.7, // alert if price/sentiment correlation < 0.7
  },
  historySize: 1000, // keep last 1000 ticks
};

// ── Sentiment Stream ───────────────────────────────────────────────────────

class RealtimeSentimentStream extends EventEmitter {
  private config: SentimentStreamConfig;
  private sentimentIndex: unknown;
  private wsStream: unknown;
  private history: SentimentTick[] = [];
  private alerts: SentimentAlert[] = [];
  private isRunning = false;
  private updateTimer: NodeJS.Timeout | null = null;
  private lastTick: SentimentTick | null = null;
  private marketData = {
    advancing: 0,
    declining: 0,
    unchanged: 0,
    totalVolume: 0,
    volatility: 0,
  };

  constructor(config: Partial<SentimentStreamConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sentimentIndex = getSentimentEngine();
    this.wsStream = getWSDataStream();
    log.info('[RealtimeSentimentStream] Initialized');
  }

  start(): void {
    if (this.isRunning) {
      log.warn('[RealtimeSentimentStream] Already running');
      return;
    }

    this.isRunning = true;
    this.setupWebSocketListener();
    this.startUpdateLoop();
    log.info('[RealtimeSentimentStream] Started');
  }

  stop(): void {
    if (!this.isRunning) {
      log.warn('[RealtimeSentimentStream] Not running');
      return;
    }

    this.isRunning = false;
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    log.info('[RealtimeSentimentStream] Stopped');
  }

  getHistory(): SentimentTick[] {
    return [...this.history];
  }

  getAlerts(): SentimentAlert[] {
    return [...this.alerts];
  }

  clearAlerts(): void {
    this.alerts = [];
    log.info('[RealtimeSentimentStream] Alerts cleared');
  }

  getCurrentSentiment(): SentimentTick | null {
    return this.lastTick;
  }

  // ── Private Methods ────────────────────────────────────────────────────

  private setupWebSocketListener(): void {
    this.wsStream.on('tick', (tick: unknown) => {
      this.processMarketTick(tick);
    });
  }

  private processMarketTick(tick: unknown): void {
    // Update market data from tick
    if (tick.code === 'MARKET_BREADTH') {
      this.marketData.advancing = tick.advancing || 0;
      this.marketData.declining = tick.declining || 0;
      this.marketData.unchanged = tick.unchanged || 0;
    }

    if (tick.volume) {
      this.marketData.totalVolume += tick.volume;
    }

    if (tick.volatility) {
      this.marketData.volatility = tick.volatility;
    }
  }

  private startUpdateLoop(): void {
    this.updateTimer = setInterval(() => {
      this.calculateAndEmitSentiment();
    }, this.config.updateInterval);
  }

  private calculateAndEmitSentiment(): void {
    const now = Date.now();

    // Calculate sentiment components
    const components = this.calculateComponents();
    const overallScore = this.calculateOverallScore(components);

    // Determine signal
    const signal = this.determineSignal(overallScore);
    const confidence = this.calculateConfidence(components);

    // Calculate change from last tick
    const change = this.lastTick ? overallScore - this.lastTick.overallScore : 0;

    // Determine trend
    const trend = this.determineTrend();

    const tick: SentimentTick = {
      timestamp: now,
      overallScore,
      components,
      signal,
      confidence,
      change,
      trend,
    };

    // Add to history
    this.history.push(tick);
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }

    // Check for alerts
    this.checkAlerts(tick);

    // Emit tick
    this.emit('tick', tick);
    this.lastTick = tick;

    log.debug(`[RealtimeSentimentStream] Tick: score=${overallScore.toFixed(2)}, signal=${signal}, change=${change.toFixed(2)}`);
  }

  private calculateComponents(): SentimentTick['components'] {
    // Market breadth component
    const total = this.marketData.advancing + this.marketData.declining + this.marketData.unchanged;
    const market = total > 0 ? ((this.marketData.advancing - this.marketData.declining) / total) * 100 : 0;

    // Volume component (normalized to -100 to 100)
    const avgVolume = this.history.length > 0
      ? this.history.reduce((sum, t) => sum + t.components.volume, 0) / this.history.length
      : 0;
    const volume = avgVolume !== 0 ? ((this.marketData.totalVolume - avgVolume) / avgVolume) * 100 : 0;

    // Breadth component (advancing / total)
    const breadth = total > 0 ? (this.marketData.advancing / total) * 200 - 100 : 0;

    // Volatility component (inverse - high volatility = negative sentiment)
    const volatility = -this.marketData.volatility;

    // Momentum component (based on recent sentiment trend)
    const recentTicks = this.history.slice(-10);
    const momentum = recentTicks.length > 1
      ? (recentTicks[recentTicks.length - 1].overallScore - recentTicks[0].overallScore) / recentTicks.length
      : 0;

    return {
      market: this.clamp(market),
      volume: this.clamp(volume),
      breadth: this.clamp(breadth),
      volatility: this.clamp(volatility),
      momentum: this.clamp(momentum),
    };
  }

  private calculateOverallScore(components: SentimentTick['components']): number {
    // Weighted average of components
    const weights = {
      market: 0.25,
      volume: 0.20,
      breadth: 0.25,
      volatility: 0.15,
      momentum: 0.15,
    };

    const score =
      components.market * weights.market +
      components.volume * weights.volume +
      components.breadth * weights.breadth +
      components.volatility * weights.volatility +
      components.momentum * weights.momentum;

    return this.clamp(score);
  }

  private determineSignal(score: number): SentimentTick['signal'] {
    if (score > 20) return 'bullish';
    if (score < -20) return 'bearish';
    return 'neutral';
  }

  private calculateConfidence(components: SentimentTick['components']): number {
    // Confidence based on component agreement
    const values = Object.values(components);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher confidence
    return Math.max(0, Math.min(100, 100 - stdDev));
  }

  private determineTrend(): SentimentTick['trend'] {
    if (this.history.length < 5) return 'stable';

    const recent = this.history.slice(-5);
    const changes = recent.map(t => t.change);
    const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;

    if (avgChange > 2) return 'improving';
    if (avgChange < -2) return 'deteriorating';
    return 'stable';
  }

  private checkAlerts(tick: SentimentTick): void {
    const now = Date.now();

    // Extreme sentiment alert
    if (Math.abs(tick.overallScore) > this.config.alertThresholds.extreme) {
      const alert: SentimentAlert = {
        timestamp: now,
        type: tick.overallScore > 0 ? 'extreme_bullish' : 'extreme_bearish',
        severity: 'high',
        message: `Extreme ${tick.overallScore > 0 ? 'bullish' : 'bearish'} sentiment: ${tick.overallScore.toFixed(2)}`,
        sentimentScore: tick.overallScore,
        details: { components: tick.components },
      };
      this.addAlert(alert);
    }

    // Rapid change alert
    const changePerMinute = tick.change * (60000 / this.config.updateInterval);
    if (Math.abs(changePerMinute) > this.config.alertThresholds.rapidChange) {
      const alert: SentimentAlert = {
        timestamp: now,
        type: 'rapid_change',
        severity: 'medium',
        message: `Rapid sentiment change: ${changePerMinute.toFixed(2)} points/min`,
        sentimentScore: tick.overallScore,
        details: { change: tick.change, changePerMinute },
      };
      this.addAlert(alert);
    }
  }

  private addAlert(alert: SentimentAlert): void {
    this.alerts.push(alert);
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    this.emit('alert', alert);
    log.warn(`[RealtimeSentimentStream] Alert: ${alert.type} - ${alert.message}`);
  }

  private clamp(value: number, min = -100, max = 100): number {
    return Math.max(min, Math.min(max, value));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let realtimeSentimentStreamInstance: RealtimeSentimentStream | null = null;

export function getRealtimeSentimentStream(): RealtimeSentimentStream {
  if (!realtimeSentimentStreamInstance) {
    realtimeSentimentStreamInstance = new RealtimeSentimentStream();
  }
  return realtimeSentimentStreamInstance;
}

export { RealtimeSentimentStream };
export type { SentimentTick, SentimentAlert, SentimentStreamConfig };
