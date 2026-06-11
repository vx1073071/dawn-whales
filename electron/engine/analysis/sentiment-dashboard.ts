// ── Sentiment Dashboard API (JVS-36) ────────────────────────────────────────
// Aggregates JVS-33 stream data + alerts + trend analysis for WB W53

import { getRealtimeSentimentStream } from './sentiment-stream';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export interface SentimentDashboard {
  // Current state
  current: {
    score: number;            // -100 to +100
    signal: 'bullish' | 'bearish' | 'neutral';
    confidence: number;       // 0-100%
    trend: 'improving' | 'deteriorating' | 'stable';
    change: number;           // points from last tick
  };

  // Component breakdown
  components: {
    market: number;
    volume: number;
    breadth: number;
    volatility: number;
    momentum: number;
  };

  // Historical analysis
  history: {
    ticks: Array<{
      timestamp: number;
      score: number;
      signal: string;
    }>;
    high: number;             // highest score in history
    low: number;              // lowest score in history
    average: number;          // average score
    volatility: number;       // standard deviation of scores
  };

  // Alerts
  alerts: {
    total: number;
    recent: Array<{
      type: string;
      severity: string;
      message: string;
      timestamp: number;
      sentimentScore: number;
    }>;
    extremeBullishCount: number;
    extremeBearishCount: number;
    rapidChangeCount: number;
  };

  // Stream status
  stream: {
    active: boolean;
    uptime: number;           // ms
    tickCount: number;
    lastTickTime: number;
    updateInterval: number;   // ms
  };

  timestamp: number;
}

// ── Dashboard Builder ──────────────────────────────────────────────────────

export function getSentimentDashboard(): SentimentDashboard {
  const stream = getRealtimeSentimentStream();
  const current = stream.getCurrentSentiment();
  const history = stream.getHistory();
  const alerts = stream.getAlerts();

  // Current state
  const currentState = current
    ? {
        score: Math.round(current.overallScore),
        signal: current.signal,
        confidence: Math.round(current.confidence),
        trend: current.trend,
        change: Math.round(current.change * 100) / 100,
      }
    : {
        score: 0,
        signal: 'neutral' as const,
        confidence: 0,
        trend: 'stable' as const,
        change: 0,
      };

  // Components
  const components = current
    ? {
        market: Math.round(current.components.market),
        volume: Math.round(current.components.volume),
        breadth: Math.round(current.components.breadth),
        volatility: Math.round(current.components.volatility),
        momentum: Math.round(current.components.momentum),
      }
    : {
        market: 0,
        volume: 0,
        breadth: 0,
        volatility: 0,
        momentum: 0,
      };

  // Historical analysis
  const scores = history.map(t => t.overallScore);
  const high = scores.length > 0 ? Math.max(...scores) : 0;
  const low = scores.length > 0 ? Math.min(...scores) : 0;
  const average = scores.length > 0
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length
    : 0;

  // Calculate volatility (standard deviation)
  let volatility = 0;
  if (scores.length > 1) {
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / scores.length;
    volatility = Math.sqrt(variance);
  }

  // Recent ticks (last 50)
  const recentTicks = history.slice(-50).map(t => ({
    timestamp: t.timestamp,
    score: Math.round(t.overallScore),
    signal: t.signal,
  }));

  // Alert counts
  const extremeBullishCount = alerts.filter(a => a.type === 'extreme_bullish').length;
  const extremeBearishCount = alerts.filter(a => a.type === 'extreme_bearish').length;
  const rapidChangeCount = alerts.filter(a => a.type === 'rapid_change').length;

  // Recent alerts (last 20)
  const recentAlerts = alerts.slice(-20).map(a => ({
    type: a.type,
    severity: a.severity,
    message: a.message,
    timestamp: a.timestamp,
    sentimentScore: Math.round(a.sentimentScore),
  }));

  // Stream status
  const status = stream.getStatus();

  return {
    current: currentState,
    components,
    history: {
      ticks: recentTicks,
      high: Math.round(high),
      low: Math.round(low),
      average: Math.round(average),
      volatility: Math.round(volatility * 100) / 100,
    },
    alerts: {
      total: alerts.length,
      recent: recentAlerts,
      extremeBullishCount,
      extremeBearishCount,
      rapidChangeCount,
    },
    stream: {
      active: status.monitoring,
      uptime: status.metrics.uptime,
      tickCount: status.metrics.totalTicks,
      lastTickTime: status.metrics.lastUpdate,
      updateInterval: 5000, // default
    },
    timestamp: Date.now(),
  };
}
