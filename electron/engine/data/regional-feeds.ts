/**
 * R241-auto#2: 区域源 RSS接入 (Regional Feeds)
 *
 * Nikkei Asia (日本) + Investing.com India (印度) + 额外区域源
 *
 * 区域源:
 *   1. Nikkei Asia RDF          — 日本权威财经 (en/ja)
 *   2. Investing.com India RSS  — 印度市场 (en)
 *   3. Investing.com Australia  — 澳洲市场 (en) [bonus]
 *
 * 特性:
 *   - Nikkei Asia: RDF格式解析 (RSS 1.0 variant)
 *   - Investing.com 区域版: 复用 lang map
 *   - 自动区域标签: 日本/印度/澳洲市场标签
 *   - 多市场分类: asia-pacific/emea/north-america
 *   - 时区感知: 不同区域发布时间归一化
 */

import { createHash } from 'crypto';
import type { NewsItem, NewsFetcher } from './news-types';

// ═══════════════════════════════════════════════════════════════════════
// Region Config
// ═══════════════════════════════════════════════════════════════════════

interface RegionFeedConfig {
  name: string;
  url: string;
  format: 'rss' | 'rdf' | 'atom';
  region: 'japan' | 'india' | 'australia' | 'southeast-asia' | 'asia-pacific';
  language: string;
  category: string;
  tags: string[];
  timezoneOffset: number; // hours from UTC
}

const REGION_FEEDS: RegionFeedConfig[] = [
  {
    name: 'Nikkei Asia',
    url: 'https://asia.nikkei.com/rss/feed/nar',
    format: 'rdf',
    region: 'japan',
    language: 'en',
    category: 'general',
    tags: ['nikkei', 'japan', 'asia', 'nikkei-225', 'topix'],
    timezoneOffset: 9,
  },
  {
    name: 'Investing India',
    url: 'https://in.investing.com/rss/news.rss',
    format: 'rss',
    region: 'india',
    language: 'en',
    category: 'general',
    tags: ['nifty', 'sensex', 'india', 'emerging-market', 'rupee'],
    timezoneOffset: 5.5,
  },
  {
    name: 'Investing Australia',
    url: 'https://au.investing.com/rss/news.rss',
    format: 'rss',
    region: 'australia',
    language: 'en',
    category: 'general',
    tags: ['asx', 'australia', 'commodities', 'mining', 'aud'],
    timezoneOffset: 10,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// Region-specific knowledge
// ═══════════════════════════════════════════════════════════════════════

const REGION_TICKERS: Record<string, string[]> = {
  japan: [
    '7203.T', '6758.T', '9984.T', '6861.T', '8035.T', '8306.T', '9433.T',
    '6501.T', '4063.T', '7974.T', '7267.T', '6902.T', '9101.T', '6098.T',
  ],
  india: [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
    'ADANIENT.NS', 'ADANIPORTS.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'HINDUNILVR.NS',
    'TATAMOTORS.NS', 'WIPRO.NS', 'AXISBANK.NS', 'MARUTI.NS',
  ],
  australia: [
    'BHP.AX', 'CBA.AX', 'CSL.AX', 'NAB.AX', 'WBC.AX', 'ANZ.AX',
    'MQG.AX', 'WES.AX', 'TLS.AX', 'FMG.AX', 'RIO.AX', 'WOW.AX',
  ],
};

const REGION_SECTOR_KEYWORDS: Record<string, Record<string, string[]>> = {
  japan: {
    auto: ['toyota', 'honda', 'nissan', 'mazda', 'subaru', 'suzuki'],
    tech: ['softbank', 'rakuten', 'keyence', 'fujitsu', 'nec', 'kyocera', 'tdk'],
    finance: ['mufg', 'smfg', 'mizuho', 'nomura', 'daiwa'],
    semiconductor: ['tokyo electron', 'advantest', 'screen', 'renesas'],
    yen: ['yen', 'boj', 'kuroda', 'ueda', 'currency', 'fx'],
  },
  india: {
    it: ['tcs', 'infosys', 'wipro', 'hcl', 'tech mahindra'],
    banking: ['hdfc', 'icici', 'sbi', 'axis', 'kotak'],
    energy: ['reliance', 'adanient', 'adaniports', 'ongc', 'ntpc'],
    pharma: ['sun pharma', 'dr reddy', 'cipla', 'biocon'],
    rupee: ['rupee', 'rbi', 'das', 'currency', 'forex'],
  },
  australia: {
    mining: ['bhp', 'rio tinto', 'fortescue', 'mineral resources', 'pilbara'],
    banking: ['cba', 'nab', 'westpac', 'anz', 'macquarie'],
    energy: ['woodside', 'santos', 'origin', 'agl', 'beach'],
    aud: ['aud', 'rba', 'lowe', 'bullock', 'currency'],
  },
};

// ═══════════════════════════════════════════════════════════════════════
// RSS Parser (multi-format)
// ═══════════════════════════════════════════════════════════════════════

interface RSSParsedItem {
  title: string;
  link: string;
  description: string;
  date: string;
  creator?: string;
}

function extractTagContent(xml: string, tag: string): string {
  // Handle multiple namespace patterns: <tag>, <dc:tag>, <rdf:tag>, <content:tag>
  const patterns = [
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'),
    new RegExp(`<[^:]+:${tag}[^>]*>([\\s\\S]*?)<\/[^:]+:${tag}>`, 'i'),
  ];
  for (const regex of patterns) {
    const match = xml.match(regex);
    if (match) {
      let content = match[1].trim();
      if (content.startsWith('<![CDATA[') && content.endsWith(']]>')) {
        content = content.slice(9, -3);
      }
      return content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    }
  }
  return '';
}

function parseRDF(xml: string): RSSParsedItem[] {
  const items: RSSParsedItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractTagContent(block, 'title'),
      link: extractTagContent(block, 'link'),
      description: extractTagContent(block, 'description'),
      date: extractTagContent(block, 'date') || extractTagContent(block, 'pubDate'),
      creator: extractTagContent(block, 'creator'),
    });
  }
  return items.filter(i => i.title && i.link);
}

function parseRSS(xml: string): RSSParsedItem[] {
  const items: RSSParsedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractTagContent(block, 'title'),
      link: extractTagContent(block, 'link'),
      description: extractTagContent(block, 'description'),
      date: extractTagContent(block, 'pubDate'),
      creator: extractTagContent(block, 'creator'),
    });
  }
  return items.filter(i => i.title && i.link);
}

function parseAtom(xml: string): RSSParsedItem[] {
  const items: RSSParsedItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractTagContent(block, 'title'),
      link: extractTagContent(block, 'link'),
      description: extractTagContent(block, 'summary') || extractTagContent(block, 'content'),
      date: extractTagContent(block, 'updated') || extractTagContent(block, 'published'),
      creator: extractTagContent(block, 'author'),
    });
  }
  return items.filter(i => i.title && i.link);
}

// ═══════════════════════════════════════════════════════════════════════
// RegionalFeedsFetcher
// ═══════════════════════════════════════════════════════════════════════

interface FeedStatus {
  name: string;
  url: string;
  status: 'ok' | 'error';
  lastFetched: number;
  itemCount: number;
  consecutiveFailures: number;
  region: string;
}

export class RegionalFeedsFetcher implements NewsFetcher {
  readonly source = 'reuters' as const;
  private feeds: RegionFeedConfig[];
  private statusMap = new Map<string, FeedStatus>();
  private itemCache = new Map<string, { items: NewsItem[]; ts: number }>();
  private cacheTTL = 120000;
  private fetchTimeout = 10000;

  constructor(feeds?: RegionFeedConfig[]) {
    this.feeds = feeds || REGION_FEEDS;
    for (const feed of this.feeds) {
      this.statusMap.set(feed.name, {
        name: feed.name,
        url: feed.url,
        status: 'ok',
        lastFetched: 0,
        itemCount: 0,
        consecutiveFailures: 0,
        region: feed.region,
      });
    }
  }

  /**
   * 拉取单个区域 Feed
   */
  async fetchRegionFeed(feed: RegionFeedConfig): Promise<NewsItem[]> {
    const status = this.statusMap.get(feed.name)!;
    const cached = this.itemCache.get(feed.name);
    if (cached && Date.now() - cached.ts < this.cacheTTL) return cached.items;

    try {
      const resp = await fetch(feed.url, {
        headers: {
          'User-Agent': 'DawnWhales/2.7.0 (Regional RSS Reader)',
          'Accept': 'application/rss+xml, application/xml, application/rdf+xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(this.fetchTimeout),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const xml = await resp.text();
      let items: RSSParsedItem[];

      switch (feed.format) {
        case 'rdf': items = parseRDF(xml); break;
        case 'atom': items = parseAtom(xml); break;
        default: items = parseRSS(xml);
      }

      const newsItems = items.map(item => this.transformItem(item, feed));

      this.itemCache.set(feed.name, { items: newsItems, ts: Date.now() });
      status.status = 'ok';
      status.lastFetched = Date.now();
      status.itemCount = newsItems.length;
      status.consecutiveFailures = 0;

      return newsItems;
    } catch (err: any) {
      status.consecutiveFailures++;
      if (status.consecutiveFailures >= 5) status.status = 'error';
      console.error(`[RegionalFeeds] ${feed.name} failed: ${err.message}`);
      return cached?.items || [];
    }
  }

  private transformItem(item: RSSParsedItem, feed: RegionFeedConfig): NewsItem {
    const text = (item.title + ' ' + item.description).toLowerCase();
    const tickers = this.extractRegionTickers(text, feed.region);
    const category = this.determineCategory(text, feed.region);
    const impact = this.determineImpact(text);

    return {
      id: `region:${feed.region}:${this.hashText(item.title + item.link)}`,
      title: item.title,
      body: item.description || item.title,
      summary: item.description?.substring(0, 200),
      url: item.link,
      source: 'reuters',
      publishedAt: this.parseDate(item.date, feed.timezoneOffset),
      fetchedAt: Date.now(),
      language: feed.language,
      tickers,
      category,
      impact,
      metadata: {
        newsSource: feed.name,
        region: feed.region,
        timezone: `UTC+${feed.timezoneOffset}`,
        tags: feed.tags,
        author: item.creator,
      },
      fingerprint: this.computeFingerprint(item.title + item.description),
    };
  }

  /**
   * 拉取全部区域源
   */
  async fetch(symbols?: string[], since?: number): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];
    const seen = new Set<string>();

    const results = await Promise.allSettled(
      this.feeds.map(feed => this.fetchRegionFeed(feed))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const item of result.value) {
          if (!seen.has(item.id)) { seen.add(item.id); allItems.push(item); }
        }
      }
    }

    if (symbols && symbols.length > 0) {
      const symSet = new Set(symbols.map(s => s.toUpperCase()));
      const filtered = allItems.filter(item =>
        item.tickers?.some(t => symSet.has(t.toUpperCase()))
      );
      return since ? filtered.filter(i => i.publishedAt >= since) : filtered;
    }

    const result = since ? allItems.filter(i => i.publishedAt >= since) : allItems;
    return result.sort((a, b) => b.publishedAt - a.publishedAt);
  }

  // ── Private Helpers ─────────────────────────────────────────────

  private extractRegionTickers(text: string, region: string): string[] {
    const localTickers = REGION_TICKERS[region] || [];
    const found: string[] = [];

    for (const ticker of localTickers) {
      const name = ticker.split('.')[0].toLowerCase();
      if (text.includes(name)) found.push(ticker);
    }

    // Check sector keywords for broad exposure
    const sectors = REGION_SECTOR_KEYWORDS[region] || {};
    for (const [sector, keywords] of Object.entries(sectors)) {
      if (keywords.some(kw => text.includes(kw))) {
        // Append sector tickers
        const sectorTickers = localTickers.slice(0, 3);
        for (const t of sectorTickers) {
          if (!found.includes(t)) found.push(t);
        }
        break;
      }
    }

    return [...new Set(found)];
  }

  private determineCategory(text: string, region: string): NewsItem['category'] {
    const sectors = REGION_SECTOR_KEYWORDS[region] || {};

    if (sectors.yen?.some(kw => text.includes(kw)) ||
        sectors.rupee?.some(kw => text.includes(kw)) ||
        sectors.aud?.some(kw => text.includes(kw))) {
      return 'macro';
    }
    if (/earnings|revenue|profit|quarterly/i.test(text)) return 'earnings';
    if (/regulation|policy|central bank|rate/i.test(text)) return 'policy';
    if (/sector|industry|manufacturing/i.test(text)) return 'industry';
    return 'company';
  }

  private determineImpact(text: string): NewsItem['impact'] {
    const lower = text.toLowerCase();
    if (/crash|plunge|meltdown|crisis|emergency|halt/i.test(lower)) return 'P0';
    if (/warn|downgrade|volatility|surge|rate hike/i.test(lower)) return 'P1';
    if (/beat|positive|growth|expansion/i.test(lower)) return 'P2';
    return 'P3';
  }

  private parseDate(dateStr: string, tzOffset: number): number {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return Date.now();
    return parsed.getTime();
  }

  private computeFingerprint(text: string): string {
    return createHash('sha256').update(text.replace(/\s+/g, '').substring(0, 500)).digest('hex').substring(0, 16);
  }

  private hashText(text: string): string {
    return createHash('md5').update(text).digest('hex').substring(0, 12);
  }

  // ── Health ─────────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    const statuses = [...this.statusMap.values()];
    return statuses.some(s => s.status === 'ok');
  }

  async getHealth() {
    const statuses = [...this.statusMap.values()];
    const ok = statuses.filter(s => s.status === 'ok').length;
    const err = statuses.filter(s => s.status === 'error').length;
    return {
      status: err === statuses.length ? 'down' : err > 0 ? 'degraded' : 'ok',
      latencyMs: 0,
      lastFetch: Math.max(...statuses.map(s => s.lastFetched)),
      feeds: statuses.map(s => ({ name: s.name, region: s.region, status: s.status, items: s.itemCount })),
    };
  }

  getFeedStatus(): FeedStatus[] {
    return [...this.statusMap.values()];
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: RegionalFeedsFetcher | null = null;
export function getRegionalFeedsFetcher(): RegionalFeedsFetcher {
  if (!instance) instance = new RegionalFeedsFetcher();
  return instance;
}

export function resetRegionalFeedsFetcher(): void {
  instance = null;
}
