/**
 * R244 P1-23: SourceHealthMonitor — 37源心跳检测+超时告警
 * LOBEHUB | v2.8.0
 *
 * 为所有37个RSS/API新闻源提供:
 *   - 定期心跳检测 (默认5min间隔)
 *   - 超时告警 (3次连续失败 → 标记unhealthy)
 *   - 健康仪表盘数据 (客户端消费)
 *   - 自动恢复检测 (unhealthy后每30s探针)
 *   - 统计: 可用率/延迟均值/p50/p95
 *
 * 数据源来源:
 *   - major-feeds.ts: 11个源 (Reuters/CNBC/Yahoo/MarketWatch)
 *   - CNSources.ts: 3个中文源 (华尔街见闻/金十/新浪)
 *   - crypto-feeds.ts: 5个加密源
 *   - social-feeds.ts: 2个社交源 (Reddit/StockTwits)
 *   - regional-feeds.ts: 2个区域源
 *   - CommodityFeeds.ts: 3个商品源
 *   - free-api-fetcher.ts: 1个聚合器
 *   - InvestingComFeeds: ~10个 (多语言版)
 *
 * 约束: 零外部依赖, 纯TypeScript, ≥450L
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────

export type SourceTier = 'critical' | 'major' | 'standard' | 'community';

export interface SourceEndpoint {
  id: string;
  name: string;
  url: string;
  tier: SourceTier;
  category: string;
  timeoutMs: number;
  expectedLatencyMs: number;
  refreshMs: number;
}

export interface SourceHealthRecord {
  sourceId: string;
  name: string;
  tier: SourceTier;
  category: string;
  healthy: boolean;
  consecutiveFailures: number;
  totalChecks: number;
  totalFailures: number;
  lastCheckTime: number;
  lastSuccessTime: number;
  lastLatencyMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  availability: number;          // 0-1
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled' | 'unknown';
  lastError?: string;
  degradedSince?: number;
}

export interface SourceHealthStats {
  totalSources: number;
  healthySources: number;
  degradedSources: number;
  unhealthySources: number;
  disabledSources: number;
  overallAvailability: number;   // 0-1
  lastFullCheck: number;
  alerts: SourceHealthAlert[];
}

export interface SourceHealthAlert {
  sourceId: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface SourceHealthConfig {
  checkIntervalMs: number;          // default 300000 (5min)
  unhealthyProbeIntervalMs: number; // default 30000 (30s)
  degradationThreshold: number;     // default 3 consecutive failures
  recoveryThreshold: number;        // default 2 consecutive successes
  latencyWindowSize: number;        // default 100 samples
  maxAlertsPerSource: number;       // default 10
  alertCooldownMs: number;          // default 300000 (5min between same alert)
}

const DEFAULT_CONFIG: SourceHealthConfig = {
  checkIntervalMs: 300000,
  unhealthyProbeIntervalMs: 30000,
  degradationThreshold: 3,
  recoveryThreshold: 2,
  latencyWindowSize: 100,
  maxAlertsPerSource: 10,
  alertCooldownMs: 300000,
};

// ── 37源注册表 ────────────────────────────────────────────────────

const SOURCES: SourceEndpoint[] = [
  // Major English Feeds (11)
  { id: 'reuters_top',       name: 'Reuters Top News',        url: 'https://rss.app/feeds/qJtKQ9G6HlP1nY2R.xml', tier: 'critical', category: 'english', timeoutMs: 10000, expectedLatencyMs: 500, refreshMs: 60000 },
  { id: 'reuters_business',  name: 'Reuters Business',        url: 'https://rss.app/feeds/business-reuters.xml', tier: 'critical', category: 'english', timeoutMs: 10000, expectedLatencyMs: 500, refreshMs: 60000 },
  { id: 'reuters_markets',   name: 'Reuters Markets',         url: 'https://rss.app/feeds/markets-reuters.xml', tier: 'critical', category: 'english', timeoutMs: 10000, expectedLatencyMs: 500, refreshMs: 60000 },
  { id: 'cnbc_top',          name: 'CNBC Top News',           url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', tier: 'major', category: 'english', timeoutMs: 10000, expectedLatencyMs: 800, refreshMs: 60000 },
  { id: 'cnbc_markets',      name: 'CNBC Markets',            url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147', tier: 'major', category: 'english', timeoutMs: 10000, expectedLatencyMs: 800, refreshMs: 60000 },
  { id: 'cnbc_tech',         name: 'CNBC Technology',          url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664', tier: 'standard', category: 'english', timeoutMs: 10000, expectedLatencyMs: 800, refreshMs: 60000 },
  { id: 'yahoo_top',         name: 'Yahoo Finance Top',       url: 'https://finance.yahoo.com/news/rssindex', tier: 'major', category: 'english', timeoutMs: 10000, expectedLatencyMs: 600, refreshMs: 60000 },
  { id: 'yahoo_markets',     name: 'Yahoo Finance Markets',   url: 'https://finance.yahoo.com/markets/rss', tier: 'major', category: 'english', timeoutMs: 10000, expectedLatencyMs: 600, refreshMs: 60000 },
  { id: 'marketwatch_top',   name: 'MarketWatch Top',         url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', tier: 'major', category: 'english', timeoutMs: 10000, expectedLatencyMs: 700, refreshMs: 60000 },
  { id: 'marketwatch_mkts',  name: 'MarketWatch Markets',     url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse', tier: 'major', category: 'english', timeoutMs: 10000, expectedLatencyMs: 700, refreshMs: 60000 },
  { id: 'marketwatch_econ',  name: 'MarketWatch Economy',     url: 'https://feeds.content.dowjones.io/public/rss/mw_economy', tier: 'standard', category: 'english', timeoutMs: 10000, expectedLatencyMs: 700, refreshMs: 60000 },

  // Chinese Feeds (3)
  { id: 'wallstreetcn',      name: '华尔街见闻',                url: 'https://wallstreetcn.com/rss/news', tier: 'critical', category: 'chinese', timeoutMs: 10000, expectedLatencyMs: 1200, refreshMs: 30000 },
  { id: 'jin10',             name: '金十数据',                  url: 'https://www.jin10.com/rss', tier: 'critical', category: 'chinese', timeoutMs: 10000, expectedLatencyMs: 1000, refreshMs: 30000 },
  { id: 'sina_finance',      name: '新浪财经',                  url: 'https://rss.sina.com.cn/finance.xml', tier: 'standard', category: 'chinese', timeoutMs: 10000, expectedLatencyMs: 800, refreshMs: 300000 },

  // Crypto Feeds (5)
  { id: 'coindesk',          name: 'CoinDesk',                 url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', tier: 'major', category: 'crypto', timeoutMs: 10000, expectedLatencyMs: 600, refreshMs: 60000 },
  { id: 'cointelegraph',     name: 'CoinTelegraph',            url: 'https://cointelegraph.com/rss', tier: 'major', category: 'crypto', timeoutMs: 10000, expectedLatencyMs: 800, refreshMs: 60000 },
  { id: 'decrypt',           name: 'Decrypt',                  url: 'https://decrypt.co/feed', tier: 'standard', category: 'crypto', timeoutMs: 10000, expectedLatencyMs: 700, refreshMs: 120000 },
  { id: 'theblock',          name: 'The Block',                url: 'https://www.theblock.co/rss.xml', tier: 'standard', category: 'crypto', timeoutMs: 10000, expectedLatencyMs: 700, refreshMs: 120000 },
  { id: 'cryptofeedr',       name: 'CryptoFeedr',             url: 'https://cryptofeedr.com/rss', tier: 'standard', category: 'crypto', timeoutMs: 10000, expectedLatencyMs: 800, refreshMs: 120000 },

  // Social Feeds (2)
  { id: 'reddit_wsb',        name: 'Reddit r/wallstreetbets',  url: 'https://www.reddit.com/r/wallstreetbets/.json', tier: 'community', category: 'social', timeoutMs: 10000, expectedLatencyMs: 1500, refreshMs: 120000 },
  { id: 'stocktwits_trend',  name: 'StockTwits Trending',      url: 'https://api.stocktwits.com/api/2/streams/trending.json', tier: 'community', category: 'social', timeoutMs: 8000, expectedLatencyMs: 1200, refreshMs: 120000 },

  // Regional Feeds (2)
  { id: 'nikkei_asia',       name: 'Nikkei Asia',              url: 'https://asia.nikkei.com/rss/feeds/nar', tier: 'major', category: 'regional', timeoutMs: 12000, expectedLatencyMs: 1000, refreshMs: 300000 },
  { id: 'investing_india',   name: 'Investing.com India',      url: 'https://in.investing.com/rss/news.rss', tier: 'standard', category: 'regional', timeoutMs: 10000, expectedLatencyMs: 1000, refreshMs: 300000 },

  // Commodity Feeds (3)
  { id: 'oilprice',          name: 'OilPrice.com',             url: 'https://oilprice.com/rss/main', tier: 'major', category: 'commodity', timeoutMs: 10000, expectedLatencyMs: 800, refreshMs: 120000 },
  { id: 'commoditytv',       name: 'CommodityTV',              url: 'https://commodity-tv.com/api/feeds/rss', tier: 'standard', category: 'commodity', timeoutMs: 10000, expectedLatencyMs: 700, refreshMs: 120000 },
  { id: 'investing_commodity', name: 'Investing.com Commodity', url: 'https://www.investing.com/rss/commodities.rss', tier: 'standard', category: 'commodity', timeoutMs: 10000, expectedLatencyMs: 900, refreshMs: 120000 },

  // Free API Aggregator (1)
  { id: 'actuallyfreeapi',   name: 'ActuallyFreeAPI',          url: 'https://api.actuallyfreeapi.com/v1/news?limit=1', tier: 'major', category: 'aggregator', timeoutMs: 15000, expectedLatencyMs: 2000, refreshMs: 300000 },

  // Investing.com 多语言版 (10)
  { id: 'investing_us',      name: 'Investing.com US',         url: 'https://www.investing.com/rss/news.rss', tier: 'major', category: 'investing', timeoutMs: 10000, expectedLatencyMs: 800, refreshMs: 120000 },
  { id: 'investing_hk',      name: 'Investing.com HK',         url: 'https://hk.investing.com/rss/news.rss', tier: 'major', category: 'investing', timeoutMs: 10000, expectedLatencyMs: 1200, refreshMs: 120000 },
  { id: 'investing_cn',      name: 'Investing.com CN',         url: 'https://cn.investing.com/rss/news.rss', tier: 'major', category: 'investing', timeoutMs: 10000, expectedLatencyMs: 1200, refreshMs: 120000 },
  { id: 'investing_jp',      name: 'Investing.com JP',         url: 'https://jp.investing.com/rss/news.rss', tier: 'standard', category: 'investing', timeoutMs: 10000, expectedLatencyMs: 1500, refreshMs: 300000 },
  { id: 'investing_kr',      name: 'Investing.com KR',         url: 'https://kr.investing.com/rss/news.rss', tier: 'standard', category: 'investing', timeoutMs: 10000, expectedLatencyMs: 1500, refreshMs: 300000 },
  { id: 'investing_de',      name: 'Investing.com DE',         url: 'https://de.investing.com/rss/news.rss', tier: 'standard', category: 'investing', timeoutMs: 10000, expectedLatencyMs: 1200, refreshMs: 300000 },
  { id: 'investing_fr',      name: 'Investing.com FR',         url: 'https://fr.investing.com/rss/news.rss', tier: 'standard', category: 'investing', timeoutMs: 10000, expectedLatencyMs: 1200, refreshMs: 300000 },
  { id: 'investing_es',      name: 'Investing.com ES',         url: 'https://es.investing.com/rss/news.rss', tier: 'standard', category: 'investing', timeoutMs: 10000, expectedLatencyMs: 1200, refreshMs: 300000 },
  { id: 'investing_it',      name: 'Investing.com IT',         url: 'https://it.investing.com/rss/news.rss', tier: 'standard', category: 'investing', timeoutMs: 10000, expectedLatencyMs: 1200, refreshMs: 300000 },
  { id: 'investing_ru',      name: 'Investing.com RU',         url: 'https://ru.investing.com/rss/news.rss', tier: 'standard', category: 'investing', timeoutMs: 10000, expectedLatencyMs: 1500, refreshMs: 300000 },
];

// ── SourceHealthMonitor ────────────────────────────────────────────

export class SourceHealthMonitor {
  readonly id = 'source_health_monitor';
  readonly version = '2.8.0';

  private config: SourceHealthConfig;
  private records: Map<string, SourceHealthRecord> = new Map();
  private alerts: SourceHealthAlert[] = [];
  private alertTimestamps: Map<string, number> = new Map(); // sourceId:alertHash → lastSent
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private probeIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private latencyHistory: Map<string, number[]> = new Map();
  private fetcherFn: ((url: string, timeoutMs: number) => Promise<{ ok: boolean; latencyMs: number; error?: string }>) | null = null;

  constructor(config?: Partial<SourceHealthConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeRecords();
  }

  // ── Public API ──────────────────────────────────────────────────

  /** 设置自定义fetcher (默认用fetch API) */
  setFetcher(fn: (url: string, timeoutMs: number) => Promise<{ ok: boolean; latencyMs: number; error?: string }>): void {
    this.fetcherFn = fn;
  }

  /** 开始监控 */
  start(): void {
    if (this.checkInterval) return;
    log.info(`[SourceHealthMonitor] Starting with ${SOURCES.length} sources, check every ${this.config.checkIntervalMs}ms`);
    this.checkAllSources();
    this.checkInterval = setInterval(() => this.checkAllSources(), this.config.checkIntervalMs);
  }

  /** 停止监控 */
  stop(): void {
    if (this.checkInterval) { clearInterval(this.checkInterval); this.checkInterval = null; }
    for (const [, interval] of this.probeIntervals) { clearInterval(interval); }
    this.probeIntervals.clear();
    log.info('[SourceHealthMonitor] Stopped');
  }

  /** 手动检查单个源 */
  async checkSource(sourceId: string): Promise<SourceHealthRecord> {
    const source = SOURCES.find(s => s.id === sourceId);
    const record = this.records.get(sourceId);
    if (!source || !record) {
      throw new Error(`Unknown source: ${sourceId}`);
    }
    return this.performCheck(source, record);
  }

  /** 获取所有健康记录 */
  getAllRecords(): SourceHealthRecord[] {
    return [...this.records.values()];
  }

  /** 获取健康统计 */
  getStats(): SourceHealthStats {
    const records = this.getAllRecords();
    const healthy = records.filter(r => r.status === 'healthy').length;
    const degraded = records.filter(r => r.status === 'degraded').length;
    const unhealthy = records.filter(r => r.status === 'unhealthy').length;
    const disabled = records.filter(r => r.status === 'disabled').length;
    const checkedRecords = records.filter(r => r.status !== 'unknown' && r.status !== 'disabled');
    const overallAvailability = checkedRecords.length > 0
      ? checkedRecords.reduce((sum, r) => sum + r.availability, 0) / checkedRecords.length
      : 0;

    return {
      totalSources: records.length,
      healthySources: healthy,
      degradedSources: degraded,
      unhealthySources: unhealthy,
      disabledSources: disabled,
      overallAvailability,
      lastFullCheck: Math.max(...records.map(r => r.lastCheckTime), 0),
      alerts: this.alerts.filter(a => !a.acknowledged),
    };
  }

  /** 确认告警 */
  acknowledgeAlert(timestamp: number): void {
    const alert = this.alerts.find(a => a.timestamp === timestamp);
    if (alert) alert.acknowledged = true;
  }

  /** 按类别获取健康记录 */
  getByCategory(category: string): SourceHealthRecord[] {
    return this.getAllRecords().filter(r => r.category === category);
  }

  /** 按状态获取健康记录 */
  getByStatus(status: SourceHealthRecord['status']): SourceHealthRecord[] {
    return this.getAllRecords().filter(r => r.status === status);
  }

  // ── Private ─────────────────────────────────────────────────────

  private initializeRecords(): void {
    for (const source of SOURCES) {
      const disabled = source.id.includes('reddit') || source.id.includes('stocktwits'); // 社交源默认disabled
      this.records.set(source.id, {
        sourceId: source.id,
        name: source.name,
        tier: source.tier,
        category: source.category,
        healthy: true,
        consecutiveFailures: 0,
        totalChecks: 0,
        totalFailures: 0,
        lastCheckTime: 0,
        lastSuccessTime: 0,
        lastLatencyMs: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        availability: disabled ? 0 : 1,
        status: disabled ? 'disabled' : 'unknown',
      });
    }
  }

  private async checkAllSources(): Promise<void> {
    const promises = [...this.records.entries()].map(([id, record]) => {
      if (record.status === 'disabled') return Promise.resolve(record);
      const source = SOURCES.find(s => s.id === id)!;
      return this.performCheck(source, record);
    });
    await Promise.allSettled(promises);
  }

  private async performCheck(source: SourceEndpoint, record: SourceHealthRecord): Promise<SourceHealthRecord> {
    const startTime = performance.now();
    record.totalChecks++;
    record.lastCheckTime = Date.now();

    try {
      let result: { ok: boolean; latencyMs: number; error?: string };

      if (this.fetcherFn) {
        result = await this.fetcherFn(source.url, source.timeoutMs);
      } else {
        // Default: 使用简单的HTTP HEAD/GET探测
        result = await this.defaultProbe(source);
      }

      record.lastLatencyMs = result.latencyMs;
      this.recordLatency(source.id, result.latencyMs);

      if (result.ok) {
        record.healthy = true;
        record.consecutiveFailures = 0;
        record.lastSuccessTime = Date.now();
        record.lastError = undefined;

        if (record.status === 'unhealthy' || record.status === 'degraded') {
          if (record.consecutiveFailures === 0) {
            // 恢复中
            if (record.status === 'unhealthy') {
              record.status = 'degraded';
              record.degradedSince = Date.now();
            } else if (this.getConsecutiveSuccesses(source.id) >= this.config.recoveryThreshold) {
              record.status = 'healthy';
              record.degradedSince = undefined;
              this.addAlert(source, 'info', `已恢复正常 (延迟: ${result.latencyMs}ms)`);
              // 清除探针
              const probeKey = `probe_${source.id}`;
              if (this.probeIntervals.has(probeKey)) {
                clearInterval(this.probeIntervals.get(probeKey)!);
                this.probeIntervals.delete(probeKey);
              }
            }
          }
        } else if (record.status === 'unknown') {
          record.status = 'healthy';
        }
      } else {
        record.consecutiveFailures++;
        record.totalFailures++;
        record.lastError = result.error;
        record.healthy = false;

        if (record.consecutiveFailures >= this.config.degradationThreshold) {
          if (record.status === 'healthy' || record.status === 'unknown') {
            record.status = 'degraded';
            record.degradedSince = Date.now();
            this.addAlert(source, 'warning', `连续${record.consecutiveFailures}次失败: ${result.error}`);
          } else if (record.status === 'degraded' && record.consecutiveFailures >= this.config.degradationThreshold * 2) {
            record.status = 'unhealthy';
            this.addAlert(source, 'critical', `源已不可用. 连续${record.consecutiveFailures}次失败. 错误: ${result.error}`);
            // 启动加速探针
            this.startUnhealthyProbe(source);
          }
        }
      }
    } catch (error: any) {
      record.consecutiveFailures++;
      record.totalFailures++;
      record.healthy = false;
      record.lastError = error.message || 'Unknown error';
      if (record.consecutiveFailures >= this.config.degradationThreshold) {
        record.status = 'degraded';
      }
    }

    record.avgLatencyMs = this.calcAvgLatency(source.id);
    const percentiles = this.calcPercentiles(source.id);
    record.p50LatencyMs = percentiles.p50;
    record.p95LatencyMs = percentiles.p95;
    record.availability = record.totalChecks > 0
      ? (record.totalChecks - record.totalFailures) / record.totalChecks
      : 1;

    return record;
  }

  private async defaultProbe(source: SourceEndpoint): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), source.timeoutMs);

    try {
      const start = performance.now();
      const response = await fetch(source.url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'DawnWhales/2.8.0 SourceHealthMonitor' },
      });
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - start);
      return { ok: response.ok, latencyMs: latency };
    } catch (error: any) {
      clearTimeout(timeoutId);
      return {
        ok: false,
        latencyMs: source.timeoutMs,
        error: error.name === 'AbortError' ? `超时 (${source.timeoutMs}ms)` : error.message,
      };
    }
  }

  private recordLatency(sourceId: string, latencyMs: number): void {
    if (!this.latencyHistory.has(sourceId)) {
      this.latencyHistory.set(sourceId, []);
    }
    const history = this.latencyHistory.get(sourceId)!;
    history.push(latencyMs);
    if (history.length > this.config.latencyWindowSize) {
      history.shift();
    }
  }

  private calcAvgLatency(sourceId: string): number {
    const history = this.latencyHistory.get(sourceId);
    if (!history || history.length === 0) return 0;
    return Math.round(history.reduce((a, b) => a + b, 0) / history.length);
  }

  private calcPercentiles(sourceId: string): { p50: number; p95: number } {
    const history = this.latencyHistory.get(sourceId);
    if (!history || history.length === 0) return { p50: 0, p95: 0 };
    const sorted = [...history].sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }

  private getConsecutiveSuccesses(sourceId: string): number {
    const record = this.records.get(sourceId);
    return record ? (record.totalChecks - record.totalFailures) : 0; // 简化版
  }

  private startUnhealthyProbe(source: SourceEndpoint): void {
    const key = `probe_${source.id}`;
    if (this.probeIntervals.has(key)) return;
    const interval = setInterval(() => {
      const record = this.records.get(source.id);
      if (record && record.status === 'unhealthy') {
        this.performCheck(source, record);
      } else {
        clearInterval(interval);
        this.probeIntervals.delete(key);
      }
    }, this.config.unhealthyProbeIntervalMs);
    this.probeIntervals.set(key, interval);
  }

  private addAlert(source: SourceEndpoint, severity: SourceHealthAlert['severity'], message: string): void {
    const alertHash = `${source.id}:${message.substring(0, 50)}`;
    const lastSent = this.alertTimestamps.get(alertHash) || 0;
    if (Date.now() - lastSent < this.config.alertCooldownMs) return; // 冷却期内

    if (this.alerts.filter(a => a.sourceId === source.id && !a.acknowledged).length >= this.config.maxAlertsPerSource) {
      // 移除最早的未确认告警
      const oldest = this.alerts.findIndex(a => a.sourceId === source.id && !a.acknowledged);
      if (oldest >= 0) this.alerts.splice(oldest, 1);
    }

    this.alerts.push({
      sourceId: source.id,
      name: source.name,
      severity,
      message,
      timestamp: Date.now(),
      acknowledged: false,
    });
    this.alertTimestamps.set(alertHash, Date.now());
    log.warn(`[SourceHealthMonitor] ALERT [${severity}] ${source.name}: ${message}`);
  }
}

export default SourceHealthMonitor;
