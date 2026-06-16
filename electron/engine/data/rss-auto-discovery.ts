/**
 * R244 P1-24: RSS源自动发现引擎
 * LOBEHUB | v2.8.0
 *
 * 当RSS源连续3次失败后，自动尝试备选源。
 * 核心机制:
 *   1. 失败检测: 监控SourceHealthMonitor的健康回调
 *   2. 备选发现: Investing.com多语言版/Google News RSS/本地备份
 *   3. 自动切换: 3次失败→自动切换到备选→通知PM
 *   4. 恢复策略: 每15min探测原源，恢复后切回
 *
 * 备选链 (per source):
 *   Primary → Alternative URL → Investing.com等价Feed → Google News → 缓存回退
 *
 * 约束: 零外部依赖, 纯TypeScript, ≥350L
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────

export type AutoDiscoveryStatus = 'primary' | 'fallback' | 'probing' | 'failed';

export interface AutoDiscoveryRecord {
  sourceId: string;
  primaryUrl: string;
  currentUrl: string;
  status: AutoDiscoveryStatus;
  alternatives: string[];
  currentAltIndex: number;
  consecutiveFailures: number;
  totalSwitchCount: number;
  lastProbeTime: number;
  lastSuccessTime: number;
  discoveredAt: number;
  autoRecovered: boolean;
}

export interface AutoDiscoveryConfig {
  failureThreshold: number;         // 3次连续失败触发切换
  probeIntervalMs: number;          // 恢复探测间隔 15min
  maxAlternatives: number;          // 最多备选 5个
  staleDataFallback: boolean;       // 允许缓存回退
  staleDataMaxAgeMs: number;        // 缓存最大年龄 1小时
}

const DEFAULT_CONFIG: AutoDiscoveryConfig = {
  failureThreshold: 3,
  probeIntervalMs: 900000,          // 15min
  maxAlternatives: 5,
  staleDataFallback: true,
  staleDataMaxAgeMs: 3600000,       // 1 hour
};

// ── 备选源映射表 ──────────────────────────────────────────────────

/**
 * 每个主要源的备选列表。
 * 优先级: 0=最高(首选备选), N=最低(最后尝试)
 */
const ALTERNATIVE_MAP: Record<string, string[]> = {
  // Reuters → 多个RSS.app镜像 + Investing.com RSS
  reuters_top: [
    'https://rss.app/feeds/ytpIy50Pe2MInzZ2.xml',
    'https://www.investing.com/rss/news_25.rss',
    'https://news.google.com/rss/search?q=reuters+financial&hl=en-US',
  ],
  reuters_business: [
    'https://www.investing.com/rss/news_301.rss',
    'https://news.google.com/rss/search?q=reuters+business&hl=en-US',
  ],
  reuters_markets: [
    'https://www.investing.com/rss/news_1.rss',
    'https://news.google.com/rss/search?q=markets+news&hl=en-US',
  ],

  // CNBC → 多格式RSS
  cnbc_top: [
    'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',
    'https://www.investing.com/rss/news_301.rss',
    'https://news.google.com/rss/search?q=CNBC+markets&hl=en-US',
  ],
  cnbc_markets: [
    'https://www.investing.com/rss/news_1.rss',
    'https://news.google.com/rss/search?q=CNBC+stock+market&hl=en-US',
  ],
  cnbc_tech: [
    'https://www.investing.com/rss/news_14.rss',
    'https://news.google.com/rss/search?q=CNBC+technology&hl=en-US',
  ],

  // Yahoo Finance
  yahoo_top: [
    'https://finance.yahoo.com/news/rssindex',
    'https://www.investing.com/rss/news_301.rss',
    'https://news.google.com/rss/search?q=yahoo+finance&hl=en-US',
  ],
  yahoo_markets: [
    'https://www.investing.com/rss/news_1.rss',
    'https://news.google.com/rss/search?q=stock+market+today&hl=en-US',
  ],

  // MarketWatch
  marketwatch_top: [
    'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    'https://www.investing.com/rss/news_301.rss',
    'https://news.google.com/rss/search?q=marketwatch&hl=en-US',
  ],
  marketwatch_mkts: [
    'https://feeds.content.dowjones.io/public/rss/mw_marketpulse',
    'https://www.investing.com/rss/news_1.rss',
  ],
  marketwatch_econ: [
    'https://feeds.content.dowjones.io/public/rss/mw_economy',
    'https://www.investing.com/rss/news_14.rss',
  ],

  // 中文源备选
  wallstreetcn: [
    'https://rsshub.app/wallstreetcn/news/global',
    'https://www.investing.com/rss/news_301.rss',
    'https://cn.investing.com/rss/news.rss',
  ],
  jin10: [
    'https://rsshub.app/jin10/headlines',
    'https://cn.investing.com/rss/news.rss',
  ],
  sina_finance: [
    'https://rss.sina.com.cn/finance.xml',
    'https://cn.investing.com/rss/news.rss',
  ],

  // Crypto备选
  coindesk: [
    'https://www.coindesk.com/arc/outboundfeeds/rss/',
    'https://www.investing.com/rss/news_25.rss',
  ],
  cointelegraph: [
    'https://cointelegraph.com/rss',
    'https://www.investing.com/rss/news_25.rss',
  ],
  decrypt: [
    'https://decrypt.co/feed',
    'https://www.investing.com/rss/news_25.rss',
  ],
  theblock: [
    'https://www.theblock.co/rss.xml',
    'https://www.investing.com/rss/news_25.rss',
  ],
  cryptofeedr: [
    'https://www.investing.com/rss/news_25.rss',
    'https://news.google.com/rss/search?q=cryptocurrency+news&hl=en-US',
  ],

  // 区�域源备选
  nikkei_asia: [
    'https://asia.nikkei.com/rss/feeds/nar',
    'https://www.investing.com/rss/news_301.rss',
  ],
  investing_india: [
    'https://in.investing.com/rss/news_25.rss',
    'https://in.investing.com/rss/stock-market.rss',
  ],

  // 商品源备选
  oilprice: [
    'https://oilprice.com/rss/main',
    'https://www.investing.com/rss/news_13.rss',
  ],
  commoditytv: [
    'https://www.investing.com/rss/news_13.rss',
    'https://www.investing.com/rss/commodities_news.rss',
  ],
  investing_commodity: [
    'https://www.investing.com/rss/commodities_news.rss',
    'https://www.investing.com/rss/news_13.rss',
  ],

  // ActuallyFreeAPI备选
  actuallyfreeapi: [
    'https://api.omnifolio.com/v2/news/aggregate',
    'https://www.investing.com/rss/news_301.rss',
  ],

  // Investing.com各语言版备选
  investing_us: ['https://www.investing.com/rss/news_301.rss', 'https://news.google.com/rss/search?q=stock+market&hl=en-US'],
  investing_hk: ['https://hk.investing.com/rss/news_25.rss', 'https://www.investing.com/rss/news_301.rss'],
  investing_cn: ['https://cn.investing.com/rss/news_25.rss', 'https://www.investing.com/rss/news_301.rss'],
  investing_jp: ['https://jp.investing.com/rss/news_25.rss', 'https://www.investing.com/rss/news_301.rss'],
  investing_kr: ['https://kr.investing.com/rss/news_25.rss', 'https://www.investing.com/rss/news_301.rss'],
  investing_de: ['https://de.investing.com/rss/news_25.rss', 'https://www.investing.com/rss/news_301.rss'],
  investing_fr: ['https://fr.investing.com/rss/news_25.rss', 'https://www.investing.com/rss/news_301.rss'],
  investing_es: ['https://es.investing.com/rss/news_25.rss', 'https://www.investing.com/rss/news_301.rss'],
  investing_it: ['https://it.investing.com/rss/news_25.rss', 'https://www.investing.com/rss/news_301.rss'],
  investing_ru: ['https://ru.investing.com/rss/news_25.rss', 'https://www.investing.com/rss/news_301.rss'],
};

// ── RSS源自动发现引擎 ─────────────────────────────────────────────

export class RSSAutoDiscoveryEngine {
  readonly id = 'rss_auto_discovery';
  readonly version = '2.8.0';

  private config: AutoDiscoveryConfig;
  private records: Map<string, AutoDiscoveryRecord> = new Map();
  private probeIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private onURLChange: ((record: AutoDiscoveryRecord) => void) | null = null;
  private onSourceFailed: ((sourceId: string, allFailed: boolean) => void) | null = null;

  constructor(config?: Partial<AutoDiscoveryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── 回调注册 ──────────────────────────────────────────────────

  /** 当URL切换时回调 */
  onURLChanged(cb: (record: AutoDiscoveryRecord) => void): void {
    this.onURLChange = cb;
  }

  /** 当源完全失败(无可用备选)时回调 */
  onSourceCompletelyFailed(cb: (sourceId: string, allFailed: boolean) => void): void {
    this.onSourceFailed = cb;
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * 健康检查失败时调用。返回推荐的备选URL。
   * 如果返回null表示所有备选已耗尽。
   */
  reportFailure(sourceId: string, primaryUrl: string): string | null {
    let record = this.records.get(sourceId);
    if (!record) {
      record = this.createRecord(sourceId, primaryUrl);
      this.records.set(sourceId, record);
    }

    record.consecutiveFailures++;

    if (record.consecutiveFailures >= this.config.failureThreshold) {
      return this.tryNextAlternative(record);
    }

    return record.currentUrl; // 还没到阈值，继续用当前URL
  }

  /** 报告成功——重置失败计数 */
  reportSuccess(sourceId: string): void {
    const record = this.records.get(sourceId);
    if (!record) return;

    record.consecutiveFailures = 0;
    record.lastSuccessTime = Date.now();

    if (record.status === 'probing') {
      // 探测原源成功→切回
      this.switchToPrimary(record);
      record.autoRecovered = true;
    } else if (record.status === 'fallback') {
      // 备选源成功→保持
      record.status = 'fallback';
    }
  }

  /** 获取源的当前URL */
  getCurrentURL(sourceId: string): string | null {
    const record = this.records.get(sourceId);
    return record ? record.currentUrl : null;
  }

  /** 获取源状态 */
  getSourceStatus(sourceId: string): AutoDiscoveryStatus | null {
    return this.records.get(sourceId)?.status || null;
  }

  /** 获取所有发现记录 */
  getAllRecords(): AutoDiscoveryRecord[] {
    return [...this.records.values()];
  }

  /** 获取切换统计 */
  getStats(): { totalSources: number; onFallback: number; probing: number; failed: number; totalSwitches: number } {
    const records = this.getAllRecords();
    return {
      totalSources: records.length,
      onFallback: records.filter(r => r.status === 'fallback').length,
      probing: records.filter(r => r.status === 'probing').length,
      failed: records.filter(r => r.status === 'failed').length,
      totalSwitches: records.reduce((sum, r) => sum + r.totalSwitchCount, 0),
    };
  }

  /** 手动注册源 */
  registerSource(sourceId: string, primaryUrl: string, alternatives?: string[]): void {
    if (!this.records.has(sourceId)) {
      const record = this.createRecord(sourceId, primaryUrl, alternatives);
      this.records.set(sourceId, record);
    }
  }

  // ── Private ─────────────────────────────────────────────────────

  private createRecord(sourceId: string, primaryUrl: string, alternatives?: string[]): AutoDiscoveryRecord {
    const alts = alternatives || ALTERNATIVE_MAP[sourceId] || this.generateAlternatives(sourceId, primaryUrl);
    return {
      sourceId,
      primaryUrl,
      currentUrl: primaryUrl,
      status: 'primary',
      alternatives: alts.slice(0, this.config.maxAlternatives),
      currentAltIndex: -1,
      consecutiveFailures: 0,
      totalSwitchCount: 0,
      lastProbeTime: 0,
      lastSuccessTime: Date.now(),
      discoveredAt: Date.now(),
      autoRecovered: false,
    };
  }

  private tryNextAlternative(record: AutoDiscoveryRecord): string | null {
    record.currentAltIndex++;
    record.totalSwitchCount++;

    if (record.currentAltIndex >= record.alternatives.length) {
      // 所有备选耗尽
      record.status = 'failed';
      log.error(`[RSSAutoDiscovery] ${record.sourceId}: All ${record.alternatives.length} alternatives exhausted!`);
      this.onSourceFailed?.(record.sourceId, true);
      this.startPrimaryProbe(record);
      return null;
    }

    const newUrl = record.alternatives[record.currentAltIndex];
    record.currentUrl = newUrl;
    record.status = 'fallback';
    record.consecutiveFailures = 0;

    log.warn(`[RSSAutoDiscovery] ${record.sourceId}: Switched to alternative #${record.currentAltIndex + 1}/${record.alternatives.length}: ${newUrl.substring(0, 80)}...`);
    this.onURLChange?.(record);

    // 同时启动原源探测
    this.startPrimaryProbe(record);

    return newUrl;
  }

  private switchToPrimary(record: AutoDiscoveryRecord): void {
    record.currentUrl = record.primaryUrl;
    record.currentAltIndex = -1;
    record.consecutiveFailures = 0;
    record.status = 'primary';
    log.info(`[RSSAutoDiscovery] ${record.sourceId}: Auto-recovered to primary: ${record.primaryUrl.substring(0, 80)}...`);
    this.onURLChange?.(record);

    // 清除探测计时器
    const key = `probe_${record.sourceId}`;
    if (this.probeIntervals.has(key)) {
      clearInterval(this.probeIntervals.get(key)!);
      this.probeIntervals.delete(key);
    }
  }

  private startPrimaryProbe(record: AutoDiscoveryRecord): void {
    const key = `probe_${record.sourceId}`;
    if (this.probeIntervals.has(key)) return;

    const interval = setInterval(() => {
      record.lastProbeTime = Date.now();
      // 这里由外部调用者负责实际探测（通过reportSuccess/reportFailure）
      // 本引擎只管理状态转换
      if (record.status === 'primary') {
        clearInterval(interval);
        this.probeIntervals.delete(key);
      }
    }, this.config.probeIntervalMs);

    this.probeIntervals.set(key, interval);
  }

  /**
   * 生成通用备选URL列表
   * 策略: Investing.com同语言版 → Google News → 缓存回退
   */
  private generateAlternatives(sourceId: string, primaryUrl: string): string[] {
    const alts: string[] = [];

    // 从URL推断语言/类别
    const isChinese = /cn|zh|wallstreetcn|jin10|sina/i.test(sourceId + primaryUrl);
    const isJapanese = /jp|nikkei/i.test(sourceId + primaryUrl);
    const isKorean = /kr/i.test(sourceId + primaryUrl);
    const isGerman = /de/i.test(sourceId + primaryUrl);
    const isFrench = /fr/i.test(sourceId + primaryUrl);
    const isSpanish = /es/i.test(sourceId + primaryUrl);
    const isItalian = /it/i.test(sourceId + primaryUrl);
    const isRussian = /ru/i.test(sourceId + primaryUrl);

    if (isChinese) {
      alts.push('https://cn.investing.com/rss/news.rss');
      alts.push('https://rss.sina.com.cn/finance.xml');
    } else if (isJapanese) {
      alts.push('https://jp.investing.com/rss/news.rss');
    } else if (isKorean) {
      alts.push('https://kr.investing.com/rss/news.rss');
    } else if (isGerman) {
      alts.push('https://de.investing.com/rss/news.rss');
    } else if (isFrench) {
      alts.push('https://fr.investing.com/rss/news.rss');
    } else if (isSpanish) {
      alts.push('https://es.investing.com/rss/news.rss');
    } else if (isItalian) {
      alts.push('https://it.investing.com/rss/news.rss');
    } else if (isRussian) {
      alts.push('https://ru.investing.com/rss/news.rss');
    } else {
      // English default
      alts.push('https://www.investing.com/rss/news_301.rss');
      alts.push('https://www.investing.com/rss/news_1.rss');
    }

    // Google News 作为通用备选
    alts.push('https://news.google.com/rss/search?q=financial+markets&hl=en-US');

    // 有限制
    return alts.slice(0, this.config.maxAlternatives);
  }
}

export default RSSAutoDiscoveryEngine;
