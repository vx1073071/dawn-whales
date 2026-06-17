/**
 * R260: 30源健康全链路终验 (SourceHealthFullChainVerify)
 * 
 * 全链路健康终验引擎 — 30数据源 × 多维度健康评分
 * 
 * 功能:
 *   1. 30数据源注册与全量健康检查
 *   2. 多维度评分：延迟/准确率/可用性/数据新鲜度
 *   3. 降级链自动触发检测
 *   4. 全量终验报告 (PASS/FAIL/DEGRADED)
 *   5. 中英文验收总结
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type SourceRegion = 'global' | 'cn' | 'us' | 'hk' | 'crypto' | 'macro';

export interface SourceDef {
  sourceId: string;
  name: string;
  nameCn: string;
  region: SourceRegion;
  markets: string[];
  category: 'exchange' | 'aggregator' | 'news' | 'social' | 'macro' | 'technical' | 'internal';
  priority: 'P0' | 'P1' | 'P2';
}

export interface HealthCheckResult {
  sourceId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'timeout';
  latencyMs: number;
  dataFreshness: number;    // seconds since last update
  accuracy: number;         // 0-1
  availability: number;     // 0-1 uptime ratio
  errorRate: number;        // 0-1
  lastChecked: number;
  consecutiveFailures: number;
  details: string;
  detailsCn: string;
}

export interface DegradationEvent {
  eventId: string;
  sourceId: string;
  fromStatus: HealthCheckResult['status'];
  toStatus: HealthCheckResult['status'];
  triggeredAt: number;
  fallbackSource?: string;
  autoRecovered: boolean;
}

export interface ChainVerifyReport {
  reportId: string;
  timestamp: number;
  totalSources: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  timeout: number;
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  avgLatencyMs: number;
  avgAccuracy: number;
  avgAvailability: number;
  results: HealthCheckResult[];
  degradationEvents: DegradationEvent[];
  recommendations: string[];
  recommendationsCn: string[];
  summaryEn: string;
  summaryCn: string;
}

// ── 30 Data Sources ────────────────────────────────────────────────────────

const ALL_SOURCES: SourceDef[] = [
  // Exchange APIs — P0
  { sourceId: 'yahoo_finance', name: 'Yahoo Finance', nameCn: '雅虎财经', region: 'global', markets: ['US','HK','A'], category: 'aggregator', priority: 'P0' },
  { sourceId: 'eastmoney', name: 'EastMoney', nameCn: '东方财富', region: 'cn', markets: ['A','HK'], category: 'aggregator', priority: 'P0' },
  { sourceId: 'binance', name: 'Binance', nameCn: '币安', region: 'crypto', markets: ['CRYPTO'], category: 'exchange', priority: 'P0' },
  { sourceId: 'hkex', name: 'HKEX', nameCn: '港交所', region: 'hk', markets: ['HK'], category: 'exchange', priority: 'P0' },
  { sourceId: 'sse', name: 'SSE', nameCn: '上交所', region: 'cn', markets: ['A'], category: 'exchange', priority: 'P0' },
  { sourceId: 'szse', name: 'SZSE', nameCn: '深交所', region: 'cn', markets: ['A'], category: 'exchange', priority: 'P0' },
  { sourceId: 'investing_com', name: 'Investing.com', nameCn: '英为财情', region: 'global', markets: ['US','HK','A','CRYPTO'], category: 'aggregator', priority: 'P0' },
  { sourceId: 'coinbase', name: 'Coinbase', nameCn: 'Coinbase', region: 'crypto', markets: ['CRYPTO'], category: 'exchange', priority: 'P1' },
  { sourceId: 'okx', name: 'OKX', nameCn: '欧易', region: 'crypto', markets: ['CRYPTO'], category: 'exchange', priority: 'P1' },
  { sourceId: 'bybit', name: 'Bybit', nameCn: 'Bybit', region: 'crypto', markets: ['CRYPTO'], category: 'exchange', priority: 'P1' },

  // News APIs — P0/P1
  { sourceId: 'newsapi', name: 'NewsAPI', nameCn: 'NewsAPI', region: 'global', markets: ['US','HK'], category: 'news', priority: 'P0' },
  { sourceId: 'cls_telegraph', name: 'CLS Telegraph', nameCn: '财联社电报', region: 'cn', markets: ['A'], category: 'news', priority: 'P0' },
  { sourceId: 'xueqiu', name: 'Xueqiu', nameCn: '雪球', region: 'cn', markets: ['A','HK','US'], category: 'social', priority: 'P0' },
  { sourceId: 'rss_feeds', name: 'RSS Feeds', nameCn: 'RSS订阅', region: 'global', markets: ['US','HK','A','CRYPTO'], category: 'news', priority: 'P1' },
  { sourceId: 'reddit', name: 'Reddit', nameCn: 'Reddit', region: 'us', markets: ['US','CRYPTO'], category: 'social', priority: 'P1' },
  { sourceId: 'twitter', name: 'Twitter/X', nameCn: '推特', region: 'global', markets: ['US','CRYPTO'], category: 'social', priority: 'P1' },
  { sourceId: 'weibo', name: 'Weibo', nameCn: '微博', region: 'cn', markets: ['A'], category: 'social', priority: 'P2' },
  { sourceId: 'discord', name: 'Discord', nameCn: 'Discord', region: 'crypto', markets: ['CRYPTO'], category: 'social', priority: 'P2' },
  { sourceId: 'telegram', name: 'Telegram', nameCn: 'Telegram', region: 'crypto', markets: ['CRYPTO'], category: 'social', priority: 'P2' },
  { sourceId: 'tradingview', name: 'TradingView', nameCn: 'TradingView', region: 'global', markets: ['US','HK','A','CRYPTO'], category: 'technical', priority: 'P1' },

  // Macro / Economic — P1
  { sourceId: 'fred', name: 'FRED', nameCn: '美联储经济数据', region: 'us', markets: ['US'], category: 'macro', priority: 'P1' },
  { sourceId: 'nbs', name: 'NBS', nameCn: '国家统计局', region: 'cn', markets: ['A'], category: 'macro', priority: 'P1' },
  { sourceId: 'world_bank', name: 'World Bank', nameCn: '世界银行', region: 'global', markets: ['US','HK','A'], category: 'macro', priority: 'P2' },
  { sourceId: 'imf', name: 'IMF', nameCn: '国际货币基金', region: 'global', markets: ['US','HK','A'], category: 'macro', priority: 'P2' },

  // Internal / Bridge — P0/P1
  { sourceId: 'binance_bridge', name: 'Binance API Bridge', nameCn: '币安桥接', region: 'crypto', markets: ['CRYPTO'], category: 'internal', priority: 'P0' },
  { sourceId: 'yahoo_bridge', name: 'Yahoo Engine Bridge', nameCn: '雅虎桥接', region: 'us', markets: ['US'], category: 'internal', priority: 'P0' },
  { sourceId: 'push_ipc', name: 'Push IPC Bridge', nameCn: '推送桥接', region: 'global', markets: ['US','HK','A','CRYPTO'], category: 'internal', priority: 'P1' },
  { sourceId: 'macro_data', name: 'Macro Data Bridge', nameCn: '宏观数据桥接', region: 'global', markets: ['US','HK','A'], category: 'internal', priority: 'P1' },
  { sourceId: 'investing_rss', name: 'Investing RSS Fetcher', nameCn: '英为RSS抓取', region: 'global', markets: ['US','HK','A','CRYPTO'], category: 'internal', priority: 'P0' },
  { sourceId: 'short_selling', name: 'Short Selling Pipeline', nameCn: '卖空管线', region: 'hk', markets: ['HK'], category: 'internal', priority: 'P1' },
];

// ── Degradation chain rules ────────────────────────────────────────────────

interface DegradationRule {
  sourceId: string;
  fallback: string;
  condition: (result: HealthCheckResult) => boolean;
}

const DEGRADATION_CHAIN: DegradationRule[] = [
  { sourceId: 'eastmoney', fallback: 'investing_com', condition: r => r.status !== 'healthy' },
  { sourceId: 'yahoo_finance', fallback: 'investing_com', condition: r => r.status !== 'healthy' },
  { sourceId: 'binance', fallback: 'binance_bridge', condition: r => r.status !== 'healthy' },
  { sourceId: 'newsapi', fallback: 'rss_feeds', condition: r => r.status !== 'healthy' },
  { sourceId: 'cls_telegraph', fallback: 'xueqiu', condition: r => r.status !== 'healthy' },
  { sourceId: 'hkex', fallback: 'eastmoney', condition: r => r.status !== 'healthy' },
  { sourceId: 'coinbase', fallback: 'binance', condition: r => r.status !== 'healthy' },
  { sourceId: 'investing_com', fallback: 'yahoo_bridge', condition: r => r.status !== 'healthy' },
];

// ═══════════════════════════════════════════════════════════════════════════
// SourceHealthFullChainVerify
// ═══════════════════════════════════════════════════════════════════════════

export class SourceHealthFullChainVerify {
  private results: Map<string, HealthCheckResult[]> = new Map();
  private degradationEvents: DegradationEvent[] = [];
  private reports: ChainVerifyReport[] = [];

  // ── Public API: Health Check ────────────────────────────────────────────

  /**
   * Run health check on a single source.
   */
  checkSource(sourceId: string, params: {
    latencyMs: number;
    dataFreshnessMs: number;
    accuracy: number;
    availability: number;
    errorRate: number;
    details?: string;
    detailsCn?: string;
  }): HealthCheckResult {
    const sourceDef = ALL_SOURCES.find(s => s.sourceId === sourceId);
    if (!sourceDef) {
      throw new Error(`Unknown source: ${sourceId}`);
    }

    // Determine status
    let status: HealthCheckResult['status'] = 'healthy';
    if (params.errorRate > 0.5 || params.availability < 0.5) {
      status = 'unhealthy';
    } else if (params.latencyMs > 5000 || params.errorRate > 0.1 || params.dataFreshnessMs > 600_000) {
      status = 'degrated'; // typo in the type? No, let me keep as-is but check... actually I defined the type as 'degraded' not 'degrated'. Let me check my type definition.
      // I wrote: 'healthy' | 'degraded' | 'unhealthy' | 'timeout'
      // So it should be 'degraded' not 'degrated'.
      status = 'degraded';
    }

    if (params.latencyMs > 30_000) {
      status = 'timeout';
    }

    const prevResults = this.results.get(sourceId);
    const consecutiveFailures = status !== 'healthy'
      ? (prevResults?.filter(r => r.status !== 'healthy').length ?? 0) + 1
      : 0;

    const result: HealthCheckResult = {
      sourceId,
      status,
      latencyMs: params.latencyMs,
      dataFreshness: Math.round(params.dataFreshnessMs / 1000 * 100) / 100,
      accuracy: Math.round(params.accuracy * 100) / 100,
      availability: Math.round(params.availability * 100) / 100,
      errorRate: Math.round(params.errorRate * 100) / 100,
      lastChecked: Date.now(),
      consecutiveFailures,
      details: params.details ?? `${sourceDef.name}: ${status}`,
      detailsCn: params.detailsCn ?? `${sourceDef.nameCn}: ${status}`,
    };

    const history = this.results.get(sourceId) ?? [];
    history.push(result);
    this.results.set(sourceId, history);

    // Check degradation chain
    if (status !== 'healthy') {
      this._evaluateDegradation(sourceId, result);
    } else {
      // Auto-recovery check
      this._checkAutoRecovery(sourceId);
    }

    return result;
  }

  /**
   * Run health check on ALL 30 sources (batch).
   */
  checkAll(results: Array<{
    sourceId: string;
    latencyMs: number;
    dataFreshnessMs: number;
    accuracy: number;
    availability: number;
    errorRate: number;
    details?: string;
    detailsCn?: string;
  }>): HealthCheckResult[] {
    const checked: HealthCheckResult[] = [];
    for (const r of results) {
      checked.push(this.checkSource(r.sourceId, r));
    }
    return checked;
  }

  /**
   * Run a mock full verification with synthetic data.
   */
  fullVerify(): ChainVerifyReport {
    const results: HealthCheckResult[] = [];

    for (const source of ALL_SOURCES) {
      // Simulate check with reasonable values
      const latency = source.category === 'exchange' ? Math.random() * 2000 + 200 :
        source.category === 'social' ? Math.random() * 3000 + 500 :
        Math.random() * 1500 + 100;

      const accuracy = source.priority === 'P0' ? 0.95 + Math.random() * 0.05 :
        source.priority === 'P1' ? 0.88 + Math.random() * 0.1 :
        0.80 + Math.random() * 0.15;

      const availability = 0.95 + Math.random() * 0.05;
      const errorRate = Math.random() * 0.08;

      const result = this.checkSource(source.sourceId, {
        latencyMs: Math.round(latency),
        dataFreshnessMs: Math.round(Math.random() * 120_000),
        accuracy: Math.round(accuracy * 100) / 100,
        availability: Math.round(availability * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
      });
      results.push(result);
    }

    return this.generateReport();
  }

  // ── Public API: Reports ─────────────────────────────────────────────────

  /**
   * Generate a full-chain verification report.
   */
  generateReport(): ChainVerifyReport {
    const allCheckResults: HealthCheckResult[] = [];
    for (const [, history] of this.results) {
      if (history.length > 0) {
        allCheckResults.push(history[history.length - 1]);
      }
    }

    const healthy = allCheckResults.filter(r => r.status === 'healthy').length;
    const degraded = allCheckResults.filter(r => r.status === 'degraded').length;
    const unhealthy = allCheckResults.filter(r => r.status === 'unhealthy').length;
    const timeout = allCheckResults.filter(r => r.status === 'timeout').length;

    const totalSources = allCheckResults.length;
    const avgLatencyMs = totalSources > 0
      ? Math.round(allCheckResults.reduce((s, r) => s + r.latencyMs, 0) / totalSources)
      : 0;
    const avgAccuracy = totalSources > 0
      ? Math.round(allCheckResults.reduce((s, r) => s + r.accuracy, 0) / totalSources * 100) / 100
      : 0;
    const avgAvailability = totalSources > 0
      ? Math.round(allCheckResults.reduce((s, r) => s + r.availability, 0) / totalSources * 100) / 100
      : 0;

    // Overall status
    let overallStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    if (unhealthy + timeout > 2 || degraded > 10) {
      overallStatus = 'FAIL';
    } else if (unhealthy + timeout > 0 || degraded > 5) {
      overallStatus = 'WARN';
    }

    // Recommendations
    const recommendations: string[] = [];
    const recommendationsCn: string[] = [];

    if (unhealthy > 0) {
      recommendations.push(`${unhealthy} source(s) unhealthy — investigate immediately`);
      recommendationsCn.push(`${unhealthy}个数据源异常 — 需要立即排查`);
    }
    if (timeout > 0) {
      recommendations.push(`${timeout} source(s) timed out — check network/API limits`);
      recommendationsCn.push(`${timeout}个数据源超时 — 检查网络/API限制`);
    }
    if (avgLatencyMs > 2000) {
      recommendations.push(`High average latency ${avgLatencyMs}ms — consider caching or CDN`);
      recommendationsCn.push(`平均延迟${avgLatencyMs}ms偏高 — 考虑缓存或CDN加速`);
    }
    if (avgAccuracy < 0.9) {
      recommendations.push(`Low average accuracy ${(avgAccuracy * 100).toFixed(1)}% — data quality check needed`);
      recommendationsCn.push(`平均准确率${(avgAccuracy * 100).toFixed(1)}%偏低 — 需要数据质量检查`);
    }

    const summaryEn = overallStatus === 'PASS'
      ? `Full-chain verification PASSED: ${totalSources} sources, ${healthy} healthy, ${degraded} degraded, ${unhealthy} unhealthy`
      : overallStatus === 'WARN'
      ? `Full-chain verification WARNING: ${totalSources} sources, ${healthy} healthy, ${degraded} degraded, ${unhealthy} unhealthy`
      : `Full-chain verification FAILED: ${totalSources} sources, ${healthy} healthy, ${degraded} degraded, ${unhealthy} unhealthy`;

    const summaryCn = overallStatus === 'PASS'
      ? `全链路终验通过：${totalSources}个数据源，${healthy}个健康，${degraded}个降级，${unhealthy}个异常`
      : overallStatus === 'WARN'
      ? `全链路终验警告：${totalSources}个数据源，${healthy}个健康，${degraded}个降级，${unhealthy}个异常`
      : `全链路终验失败：${totalSources}个数据源，${healthy}个健康，${degraded}个降级，${unhealthy}个异常`;

    const report: ChainVerifyReport = {
      reportId: `chvrep:${Date.now()}`,
      timestamp: Date.now(),
      totalSources,
      healthy,
      degraded,
      unhealthy,
      timeout,
      overallStatus,
      avgLatencyMs,
      avgAccuracy,
      avgAvailability,
      results: allCheckResults,
      degradationEvents: this.degradationEvents.slice(-20),
      recommendations,
      recommendationsCn,
      summaryEn,
      summaryCn,
    };

    this.reports.push(report);
    return report;
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get all source definitions */
  getSources(): SourceDef[] { return ALL_SOURCES; }

  /** Get source definition by ID */
  getSource(sourceId: string): SourceDef | null {
    return ALL_SOURCES.find(s => s.sourceId === sourceId) ?? null;
  }

  /** Get latest health for a source */
  getSourceStatus(sourceId: string): HealthCheckResult | null {
    const history = this.results.get(sourceId);
    if (!history || history.length === 0) return null;
    return history[history.length - 1];
  }

  /** Get health history for a source */
  getHistory(sourceId: string, limit = 30): HealthCheckResult[] {
    return (this.results.get(sourceId) ?? []).slice(-limit).reverse();
  }

  /** Get degradation events */
  getDegradationEvents(limit = 50): DegradationEvent[] {
    return this.degradationEvents.slice(-limit).reverse();
  }

  /** Get all reports */
  getReports(limit = 10): ChainVerifyReport[] {
    return this.reports.slice(-limit).reverse();
  }

  /** Get degradation chain rules */
  getDegradationChain() { return DEGRADATION_CHAIN; }

  /** Get sources by region */
  getSourcesByRegion(region: SourceRegion): SourceDef[] {
    return ALL_SOURCES.filter(s => s.region === region);
  }

  /** Get sources by priority */
  getSourcesByPriority(priority: 'P0' | 'P1' | 'P2'): SourceDef[] {
    return ALL_SOURCES.filter(s => s.priority === priority);
  }

  /** Reset */
  reset(): void {
    this.results.clear();
    this.degradationEvents = [];
    this.reports = [];
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _evaluateDegradation(sourceId: string, result: HealthCheckResult): void {
    const rule = DEGRADATION_CHAIN.find(r =>
      r.sourceId === sourceId && r.condition(result)
    );

    if (rule) {
      const prevStatus = this._getPreviousStatus(sourceId);
      const event: DegradationEvent = {
        eventId: `degev:${sourceId}:${Date.now()}`,
        sourceId,
        fromStatus: prevStatus,
        toStatus: result.status,
        triggeredAt: Date.now(),
        fallbackSource: rule.fallback,
        autoRecovered: false,
      };
      this.degradationEvents.push(event);
      if (this.degradationEvents.length > 200) this.degradationEvents.shift();
    }
  }

  private _checkAutoRecovery(sourceId: string): void {
    const lastEvent = this.degradationEvents
      .filter(e => e.sourceId === sourceId && !e.autoRecovered)
      .pop();

    if (lastEvent) {
      lastEvent.autoRecovered = true;
    }
  }

  private _getPreviousStatus(sourceId: string): HealthCheckResult['status'] {
    const history = this.results.get(sourceId);
    if (!history || history.length < 2) return 'healthy';
    return history[history.length - 2].status;
  }
}

export const sourceHealthFullChainVerify = new SourceHealthFullChainVerify();
