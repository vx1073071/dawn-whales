/**
 * R253 DQ-02: SourceHealthThresholds — 源健康逐源阈值
 * LOBEHUB | v3.0.0 QUANT MOO
 * 三级: real-time(5s)/standard(30s)/batch(5min)
 * 37源逐一定制, >=450L
 */

import type { SourceHealthConfig } from '../data/source-health-monitor';

export type SourcePriority = 'real-time' | 'standard' | 'batch';

export interface PerSourceThreshold {
  sourceId: string; priority: SourcePriority;
  checkIntervalMs: number; unhealthyTimeoutMs: number;
  degradationThreshold: number; recoveryThreshold: number;
  expectedLatencyMs: number; alertLatencyMs: number;
  maxConsecutiveFailures: number;
}

export class SourceHealthThresholds {
  readonly id = 'source_health_thresholds'; readonly version = '3.0.0';

  readonly globalDefaults: SourceHealthConfig = {
    checkIntervalMs: 300000, unhealthyProbeIntervalMs: 30000,
    degradationThreshold: 3, recoveryThreshold: 2,
    latencyWindowSize: 100, maxAlertsPerSource: 10, alertCooldownMs: 300000,
  };

  readonly perSourceThresholds: PerSourceThreshold[] = [
    // real-time (突发/价格)
    { sourceId:'wallstreetcn',priority:'real-time',checkIntervalMs:30000,unhealthyTimeoutMs:8000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:1200,alertLatencyMs:5000,maxConsecutiveFailures:10},
    { sourceId:'jin10',priority:'real-time',checkIntervalMs:30000,unhealthyTimeoutMs:8000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:1000,alertLatencyMs:4000,maxConsecutiveFailures:10},
    { sourceId:'reuters_top',priority:'real-time',checkIntervalMs:30000,unhealthyTimeoutMs:8000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:500,alertLatencyMs:3000,maxConsecutiveFailures:15},
    { sourceId:'reuters_business',priority:'real-time',checkIntervalMs:30000,unhealthyTimeoutMs:8000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:500,alertLatencyMs:3000,maxConsecutiveFailures:15},
    { sourceId:'reuters_markets',priority:'real-time',checkIntervalMs:30000,unhealthyTimeoutMs:8000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:500,alertLatencyMs:3000,maxConsecutiveFailures:15},
    { sourceId:'cnbc_top',priority:'real-time',checkIntervalMs:30000,unhealthyTimeoutMs:8000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:800,alertLatencyMs:4000,maxConsecutiveFailures:12},
    { sourceId:'cnbc_markets',priority:'real-time',checkIntervalMs:30000,unhealthyTimeoutMs:8000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:800,alertLatencyMs:4000,maxConsecutiveFailures:12},
    { sourceId:'yahoo_top',priority:'real-time',checkIntervalMs:30000,unhealthyTimeoutMs:8000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:600,alertLatencyMs:3500,maxConsecutiveFailures:15},
    { sourceId:'marketwatch_top',priority:'real-time',checkIntervalMs:30000,unhealthyTimeoutMs:8000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:700,alertLatencyMs:3500,maxConsecutiveFailures:12},
    { sourceId:'coindesk',priority:'real-time',checkIntervalMs:60000,unhealthyTimeoutMs:10000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:600,alertLatencyMs:5000,maxConsecutiveFailures:12},
    { sourceId:'cointelegraph',priority:'real-time',checkIntervalMs:60000,unhealthyTimeoutMs:10000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:800,alertLatencyMs:5000,maxConsecutiveFailures:12},
    // standard (常规新闻)
    { sourceId:'yahoo_markets',priority:'standard',checkIntervalMs:120000,unhealthyTimeoutMs:12000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:600,alertLatencyMs:6000,maxConsecutiveFailures:8},
    { sourceId:'marketwatch_mkts',priority:'standard',checkIntervalMs:120000,unhealthyTimeoutMs:12000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:700,alertLatencyMs:6000,maxConsecutiveFailures:8},
    { sourceId:'marketwatch_econ',priority:'standard',checkIntervalMs:300000,unhealthyTimeoutMs:15000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:700,alertLatencyMs:7000,maxConsecutiveFailures:6},
    { sourceId:'cnbc_tech',priority:'standard',checkIntervalMs:120000,unhealthyTimeoutMs:12000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:800,alertLatencyMs:6000,maxConsecutiveFailures:8},
    { sourceId:'sina_finance',priority:'standard',checkIntervalMs:300000,unhealthyTimeoutMs:15000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:800,alertLatencyMs:7000,maxConsecutiveFailures:8},
    { sourceId:'nikkei_asia',priority:'standard',checkIntervalMs:300000,unhealthyTimeoutMs:15000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:1000,alertLatencyMs:7000,maxConsecutiveFailures:6},
    { sourceId:'actuallyfreeapi',priority:'standard',checkIntervalMs:300000,unhealthyTimeoutMs:20000,degradationThreshold:3,recoveryThreshold:2,expectedLatencyMs:2000,alertLatencyMs:10000,maxConsecutiveFailures:10},
    { sourceId:'decrypt',priority:'standard',checkIntervalMs:120000,unhealthyTimeoutMs:12000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:700,alertLatencyMs:6000,maxConsecutiveFailures:8},
    { sourceId:'theblock',priority:'standard',checkIntervalMs:120000,unhealthyTimeoutMs:12000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:700,alertLatencyMs:6000,maxConsecutiveFailures:8},
    { sourceId:'cryptofeedr',priority:'standard',checkIntervalMs:120000,unhealthyTimeoutMs:12000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:800,alertLatencyMs:6000,maxConsecutiveFailures:8},
    // batch (日程/报告)
    { sourceId:'investing_us',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:800,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'investing_hk',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:1200,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'investing_cn',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:1200,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'investing_jp',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:1500,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'investing_kr',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:1500,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'investing_de',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:1200,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'investing_fr',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:1200,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'investing_es',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:1200,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'investing_it',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:1200,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'investing_ru',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:1500,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'investing_india',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:1000,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'investing_commodity',priority:'batch',checkIntervalMs:600000,unhealthyTimeoutMs:20000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:900,alertLatencyMs:10000,maxConsecutiveFailures:5},
    { sourceId:'oilprice',priority:'batch',checkIntervalMs:300000,unhealthyTimeoutMs:15000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:800,alertLatencyMs:7000,maxConsecutiveFailures:5},
    { sourceId:'commoditytv',priority:'batch',checkIntervalMs:300000,unhealthyTimeoutMs:15000,degradationThreshold:2,recoveryThreshold:2,expectedLatencyMs:700,alertLatencyMs:7000,maxConsecutiveFailures:5},
  ];

  getForSource(sourceId: string): SourceHealthConfig {
    const t = this.perSourceThresholds.find(x => x.sourceId === sourceId);
    if (!t) return { ...this.globalDefaults };
    return {
      ...this.globalDefaults,
      checkIntervalMs: t.checkIntervalMs,
      degradationThreshold: t.degradationThreshold,
      recoveryThreshold: t.recoveryThreshold,
      unhealthyProbeIntervalMs: t.checkIntervalMs > 120000 ? 60000 : 30000,
    };
  }

  exportTable() {
    return this.perSourceThresholds.map(t => ({
      sourceId: t.sourceId, priority: t.priority,
      checkInterval: t.checkIntervalMs, expectedLatency: t.expectedLatencyMs,
    }));
  }
}
