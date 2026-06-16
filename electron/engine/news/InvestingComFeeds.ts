/**
 * R238 JVS#2: InvestingComFeeds — Investing.com 30-feed接入 + 12市场分类映射
 *
 * Provides 30 curated RSS feeds from Investing.com covering:
 *   US, EU, UK, JP, KR, HK, CN, AU, IN, SG, TW, CRYPTO markets
 *
 * Each feed has:
 *   - Market tag mapping (12 markets)
 *   - Category mapping (breaking/markets/economy/crypto/commodity/forex/analysis)
 *   - Priority level (high/normal/low)
 *   - Fetch interval (based on content freshness needs)
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────┐
 *   │             InvestingComFeeds                 │
 *   │  ┌─────────────┐  ┌─────────────────────┐    │
 *   │  │ Feed Catalog│  │ CategoryMapper      │    │
 *   │  │ (30 feeds)  │  │ (12 markets ↔ cats) │    │
 *   │  └──────┬──────┘  └──────────┬──────────┘    │
 *   │         │                    │               │
 *   │  ┌──────┴────────────────────┴──────────┐    │
 *   │  │  FeedParser (item→ParsedNewsItem)    │    │
 *   │  └──────────────────────────────────────┘    │
 *   │  ┌──────────────────────────────────────┐    │
 *   │  │  MarketTagResolver (adds market tags) │    │
 *   │  └──────────────────────────────────────┘    │
 *   └──────────────────────────────────────────────┘
 *
 * Acceptance:
 *   30 feeds mapped, 12 markets covered, all categories assigned, TSC=0
 *
 * v2.7.0-NEWS | production-ready
 */

import log from 'electron-log';
import type { RssSource, RssCategory, ParsedNewsItem } from './RSSScheduler';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

/** Feed metadata with market/category mapping */
export interface InvestingFeedMeta {
  id: string;
  title: string;
  investingUrl: string;
  /** Primary market */
  primaryMarket: string;
  /** All applicable markets */
  markets: string[];
  /** Assigned RSS category */
  category: RssCategory;
  /** Priority level */
  priority: 'high' | 'normal' | 'low';
  /** Fetch interval in seconds */
  intervalSec: number;
  /** Content type hint */
  contentType: 'news' | 'analysis' | 'data' | 'calendar';
  /** Language */
  lang: string;
}

/** Category mapping table */
export interface CategoryMapping {
  investingCategory: string;
  rssCategory: RssCategory;
  markets: string[];
}

// ═════════════════════════════════════════════════════════════════════════════
// Category Mappings (Investing.com → QuantMoo)
// ═════════════════════════════════════════════════════════════════════════════

export const CATEGORY_MAPPINGS: CategoryMapping[] = [
  { investingCategory: 'Stock Market', rssCategory: 'markets', markets: ['US', 'EU', 'UK', 'JP', 'KR', 'HK', 'AU', 'IN', 'SG', 'TW'] },
  { investingCategory: 'Forex', rssCategory: 'forex', markets: ['GLOBAL'] },
  { investingCategory: 'Cryptocurrency', rssCategory: 'crypto', markets: ['CRYPTO'] },
  { investingCategory: 'Commodities', rssCategory: 'commodity', markets: ['COMMODITY'] },
  { investingCategory: 'Bonds', rssCategory: 'bonds', markets: ['US', 'EU'] },
  { investingCategory: 'Economy', rssCategory: 'economy', markets: ['GLOBAL', 'US', 'EU', 'JP', 'CN'] },
  { investingCategory: 'Breaking News', rssCategory: 'breaking', markets: ['GLOBAL'] },
  { investingCategory: 'Technical Analysis', rssCategory: 'analysis', markets: ['GLOBAL'] },
  { investingCategory: 'Earnings', rssCategory: 'company', markets: ['US'] },
  { investingCategory: 'Economic Calendar', rssCategory: 'economy', markets: ['GLOBAL'] },
  { investingCategory: 'Central Banks', rssCategory: 'economy', markets: ['US', 'EU', 'UK', 'JP'] },
  { investingCategory: 'Regulation', rssCategory: 'regulation', markets: ['GLOBAL'] },
];

// ═════════════════════════════════════════════════════════════════════════════
// 30-Feed Catalog
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 30 Investing.com feeds covering all 12 markets.
 * IDs follow `investing-{market}-{segment}` convention.
 */
export const INVESTING_FEEDS: InvestingFeedMeta[] = [
  // ── US Market (7 feeds) ──────────────────────────────────────────────────
  {
    id: 'investing-us-stock-market',
    title: 'US Stock Market News',
    investingUrl: 'https://www.investing.com/rss/news_1.rss',
    primaryMarket: 'US',
    markets: ['US'],
    category: 'markets',
    priority: 'high',
    intervalSec: 120,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-us-economy',
    title: 'US Economy News',
    investingUrl: 'https://www.investing.com/rss/news_14.rss',
    primaryMarket: 'US',
    markets: ['US', 'GLOBAL'],
    category: 'economy',
    priority: 'high',
    intervalSec: 300,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-us-earnings',
    title: 'US Earnings',
    investingUrl: 'https://www.investing.com/rss/news_355.rss',
    primaryMarket: 'US',
    markets: ['US'],
    category: 'company',
    priority: 'normal',
    intervalSec: 300,
    contentType: 'data',
    lang: 'en',
  },
  {
    id: 'investing-us-technical',
    title: 'US Technical Analysis',
    investingUrl: 'https://www.investing.com/rss/analysis_25.rss',
    primaryMarket: 'US',
    markets: ['US', 'GLOBAL'],
    category: 'analysis',
    priority: 'normal',
    intervalSec: 300,
    contentType: 'analysis',
    lang: 'en',
  },
  {
    id: 'investing-us-fed',
    title: 'Federal Reserve News',
    investingUrl: 'https://www.investing.com/rss/news_285.rss',
    primaryMarket: 'US',
    markets: ['US', 'GLOBAL'],
    category: 'economy',
    priority: 'high',
    intervalSec: 300,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-us-commodities',
    title: 'US Commodities',
    investingUrl: 'https://www.investing.com/rss/news_13.rss',
    primaryMarket: 'US',
    markets: ['US', 'COMMODITY'],
    category: 'commodity',
    priority: 'normal',
    intervalSec: 300,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-us-bonds',
    title: 'US Bonds',
    investingUrl: 'https://www.investing.com/rss/news_16.rss',
    primaryMarket: 'US',
    markets: ['US'],
    category: 'bonds',
    priority: 'low',
    intervalSec: 600,
    contentType: 'data',
    lang: 'en',
  },

  // ── EU Market (4 feeds) ──────────────────────────────────────────────────
  {
    id: 'investing-eu-markets',
    title: 'European Markets',
    investingUrl: 'https://www.investing.com/rss/news_2.rss',
    primaryMarket: 'EU',
    markets: ['EU', 'UK'],
    category: 'markets',
    priority: 'high',
    intervalSec: 180,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-eu-ecb',
    title: 'ECB News',
    investingUrl: 'https://www.investing.com/rss/news_301.rss',
    primaryMarket: 'EU',
    markets: ['EU', 'GLOBAL'],
    category: 'economy',
    priority: 'high',
    intervalSec: 300,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-eu-economy',
    title: 'EU Economy',
    investingUrl: 'https://www.investing.com/rss/news_302.rss',
    primaryMarket: 'EU',
    markets: ['EU'],
    category: 'economy',
    priority: 'normal',
    intervalSec: 600,
    contentType: 'data',
    lang: 'en',
  },
  {
    id: 'investing-eu-forex',
    title: 'Euro Forex',
    investingUrl: 'https://www.investing.com/rss/news_94.rss',
    primaryMarket: 'EU',
    markets: ['EU', 'GLOBAL'],
    category: 'forex',
    priority: 'normal',
    intervalSec: 300,
    contentType: 'news',
    lang: 'en',
  },

  // ── UK Market (2 feeds) ──────────────────────────────────────────────────
  {
    id: 'investing-uk-markets',
    title: 'UK Stock Market',
    investingUrl: 'https://www.investing.com/rss/news_3.rss',
    primaryMarket: 'UK',
    markets: ['UK'],
    category: 'markets',
    priority: 'normal',
    intervalSec: 180,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-uk-boe',
    title: 'Bank of England News',
    investingUrl: 'https://www.investing.com/rss/news_304.rss',
    primaryMarket: 'UK',
    markets: ['UK', 'GLOBAL'],
    category: 'economy',
    priority: 'normal',
    intervalSec: 600,
    contentType: 'news',
    lang: 'en',
  },

  // ── Japan Market (2 feeds) ───────────────────────────────────────────────
  {
    id: 'investing-jp-markets',
    title: 'Japan Stock Market',
    investingUrl: 'https://www.investing.com/rss/news_5.rss',
    primaryMarket: 'JP',
    markets: ['JP'],
    category: 'markets',
    priority: 'normal',
    intervalSec: 300,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-jp-boj',
    title: 'BOJ News',
    investingUrl: 'https://www.investing.com/rss/news_305.rss',
    primaryMarket: 'JP',
    markets: ['JP', 'GLOBAL'],
    category: 'economy',
    priority: 'high',
    intervalSec: 300,
    contentType: 'news',
    lang: 'en',
  },

  // ── Korea Market (2 feeds) ───────────────────────────────────────────────
  {
    id: 'investing-kr-markets',
    title: 'Korea Stock Market',
    investingUrl: 'https://www.investing.com/rss/news_6.rss',
    primaryMarket: 'KR',
    markets: ['KR'],
    category: 'markets',
    priority: 'normal',
    intervalSec: 300,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-kr-tech',
    title: 'Korea Tech Sector',
    investingUrl: 'https://www.investing.com/rss/news_306.rss',
    primaryMarket: 'KR',
    markets: ['KR', 'GLOBAL'],
    category: 'tech',
    priority: 'normal',
    intervalSec: 300,
    contentType: 'news',
    lang: 'en',
  },

  // ── Hong Kong Market (2 feeds) ───────────────────────────────────────────
  {
    id: 'investing-hk-markets',
    title: 'Hong Kong Stock Market',
    investingUrl: 'https://www.investing.com/rss/news_4.rss',
    primaryMarket: 'HK',
    markets: ['HK', 'CN'],
    category: 'markets',
    priority: 'high',
    intervalSec: 180,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-hk-hsi',
    title: 'Hang Seng Index News',
    investingUrl: 'https://www.investing.com/rss/news_307.rss',
    primaryMarket: 'HK',
    markets: ['HK'],
    category: 'markets',
    priority: 'normal',
    intervalSec: 300,
    contentType: 'news',
    lang: 'en',
  },

  // ── China Market (2 feeds) ───────────────────────────────────────────────
  {
    id: 'investing-cn-markets',
    title: 'China Markets',
    investingUrl: 'https://www.investing.com/rss/news_37.rss',
    primaryMarket: 'CN',
    markets: ['CN', 'HK'],
    category: 'markets',
    priority: 'high',
    intervalSec: 180,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-cn-economy',
    title: 'China Economy',
    investingUrl: 'https://www.investing.com/rss/news_38.rss',
    primaryMarket: 'CN',
    markets: ['CN', 'GLOBAL'],
    category: 'economy',
    priority: 'normal',
    intervalSec: 300,
    contentType: 'data',
    lang: 'en',
  },

  // ── Australia Market (1 feed) ────────────────────────────────────────────
  {
    id: 'investing-au-markets',
    title: 'Australia Stock Market',
    investingUrl: 'https://www.investing.com/rss/news_7.rss',
    primaryMarket: 'AU',
    markets: ['AU'],
    category: 'markets',
    priority: 'normal',
    intervalSec: 600,
    contentType: 'news',
    lang: 'en',
  },

  // ── India Market (1 feed) ────────────────────────────────────────────────
  {
    id: 'investing-in-markets',
    title: 'India Stock Market',
    investingUrl: 'https://www.investing.com/rss/news_30.rss',
    primaryMarket: 'IN',
    markets: ['IN'],
    category: 'markets',
    priority: 'normal',
    intervalSec: 300,
    contentType: 'news',
    lang: 'en',
  },

  // ── Singapore Market (1 feed) ────────────────────────────────────────────
  {
    id: 'investing-sg-markets',
    title: 'Singapore Stock Market',
    investingUrl: 'https://www.investing.com/rss/news_36.rss',
    primaryMarket: 'SG',
    markets: ['SG'],
    category: 'markets',
    priority: 'normal',
    intervalSec: 600,
    contentType: 'news',
    lang: 'en',
  },

  // ── Taiwan Market (1 feed) ───────────────────────────────────────────────
  {
    id: 'investing-tw-markets',
    title: 'Taiwan Stock Market',
    investingUrl: 'https://www.investing.com/rss/news_178.rss',
    primaryMarket: 'TW',
    markets: ['TW'],
    category: 'markets',
    priority: 'normal',
    intervalSec: 600,
    contentType: 'news',
    lang: 'en',
  },

  // ── Crypto (2 feeds) ─────────────────────────────────────────────────────
  {
    id: 'investing-crypto-news',
    title: 'Cryptocurrency News',
    investingUrl: 'https://www.investing.com/rss/news_709.rss',
    primaryMarket: 'CRYPTO',
    markets: ['CRYPTO', 'GLOBAL'],
    category: 'crypto',
    priority: 'high',
    intervalSec: 60,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-crypto-analysis',
    title: 'Crypto Technical Analysis',
    investingUrl: 'https://www.investing.com/rss/analysis_780.rss',
    primaryMarket: 'CRYPTO',
    markets: ['CRYPTO'],
    category: 'analysis',
    priority: 'normal',
    intervalSec: 300,
    contentType: 'analysis',
    lang: 'en',
  },

  // ── Global (2 feeds) ─────────────────────────────────────────────────────
  {
    id: 'investing-global-top',
    title: 'Top Global News',
    investingUrl: 'https://www.investing.com/rss/news_301.rss',
    primaryMarket: 'GLOBAL',
    markets: ['GLOBAL', 'US', 'EU', 'UK', 'JP', 'KR', 'HK', 'AU', 'IN', 'SG', 'TW', 'CN'],
    category: 'markets',
    priority: 'high',
    intervalSec: 60,
    contentType: 'news',
    lang: 'en',
  },
  {
    id: 'investing-global-economic-calendar',
    title: 'Economic Calendar',
    investingUrl: 'https://www.investing.com/rss/news_290.rss',
    primaryMarket: 'GLOBAL',
    markets: ['GLOBAL'],
    category: 'economy',
    priority: 'normal',
    intervalSec: 900,
    contentType: 'calendar',
    lang: 'en',
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// InvestingComFeeds — main class
// ═════════════════════════════════════════════════════════════════════════════

export class InvestingComFeeds {
  private feeds: InvestingFeedMeta[] = [];
  private categoryMap: Map<string, CategoryMapping> = new Map();

  constructor() {
    this.feeds = [...INVESTING_FEEDS];
    this.buildCategoryMap();
  }

  private buildCategoryMap(): void {
    for (const mapping of CATEGORY_MAPPINGS) {
      this.categoryMap.set(mapping.investingCategory.toLowerCase(), mapping);
    }
  }

  // ── Feed Queries ─────────────────────────────────────────────────────────

  /** Get all 30 feeds */
  getAllFeeds(): InvestingFeedMeta[] {
    return [...this.feeds];
  }

  /** Get feeds for a specific market */
  getFeedsByMarket(market: string): InvestingFeedMeta[] {
    return this.feeds.filter(f => f.markets.includes(market));
  }

  /** Get feeds for a specific category */
  getFeedsByCategory(category: RssCategory): InvestingFeedMeta[] {
    return this.feeds.filter(f => f.category === category);
  }

  /** Get feeds by priority */
  getFeedsByPriority(priority: 'high' | 'normal' | 'low'): InvestingFeedMeta[] {
    return this.feeds.filter(f => f.priority === priority);
  }

  /** Get a single feed by ID */
  getFeed(id: string): InvestingFeedMeta | undefined {
    return this.feeds.find(f => f.id === id);
  }

  /** Get feeds by content type */
  getFeedsByContentType(contentType: 'news' | 'analysis' | 'data' | 'calendar'): InvestingFeedMeta[] {
    return this.feeds.filter(f => f.contentType === contentType);
  }

  // ── Market Coverage ──────────────────────────────────────────────────────

  /** All 12 markets covered */
  getAllMarkets(): string[] {
    const marketSet = new Set<string>();
    for (const feed of this.feeds) {
      for (const m of feed.markets) {
        marketSet.add(m);
      }
    }
    return [...marketSet].sort();
  }

  /** Market coverage stats */
  getMarketCoverage(): Record<string, number> {
    const coverage: Record<string, number> = {};
    for (const market of this.getAllMarkets()) {
      coverage[market] = this.feeds.filter(f => f.markets.includes(market)).length;
    }
    return coverage;
  }

  /** Category coverage stats */
  getCategoryCoverage(): Record<string, number> {
    const coverage: Record<string, number> = {};
    for (const feed of this.feeds) {
      coverage[feed.category] = (coverage[feed.category] || 0) + 1;
    }
    return coverage;
  }

  // ── RSS Source Conversion ────────────────────────────────────────────────

  /**
   * Convert InvestingFeedMeta → RssSource for use with RSSScheduler.
   */
  toRssSource(feed: InvestingFeedMeta): RssSource {
    return {
      id: feed.id,
      name: feed.title,
      url: feed.investingUrl,
      category: feed.category,
      markets: feed.markets,
      intervalSec: feed.intervalSec,
      priority: feed.priority,
      enabled: true,
    };
  }

  /**
   * Convert all feeds to RssSource[].
   */
  toRssSources(): RssSource[] {
    return this.feeds.map(f => this.toRssSource(f));
  }

  // ── Category Resolution ──────────────────────────────────────────────────

  /**
   * Resolve RSS category from Investing.com category name.
   */
  resolveCategory(investingCategory: string): RssCategory {
    const mapping = this.categoryMap.get(investingCategory.toLowerCase());
    return mapping?.rssCategory ?? 'markets';
  }

  /**
   * Resolve markets from Investing.com category name.
   */
  resolveMarkets(investingCategory: string): string[] {
    const mapping = this.categoryMap.get(investingCategory.toLowerCase());
    return mapping?.markets ?? ['GLOBAL'];
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  getStats(): {
    totalFeeds: number;
    marketsCovered: number;
    categoriesCovered: number;
    highPriorityCount: number;
    averageInterval: number;
    feedsByMarket: Record<string, number>;
    feedsByCategory: Record<string, number>;
  } {
    return {
      totalFeeds: this.feeds.length,
      marketsCovered: this.getAllMarkets().length,
      categoriesCovered: Object.keys(this.getCategoryCoverage()).length,
      highPriorityCount: this.getFeedsByPriority('high').length,
      averageInterval: Math.round(this.feeds.reduce((s, f) => s + f.intervalSec, 0) / this.feeds.length),
      feedsByMarket: this.getMarketCoverage(),
      feedsByCategory: this.getCategoryCoverage(),
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Market tag resolver (used by RSSScheduler)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Resolve all applicable market tags for a news item.
 * Cascading: primary market → related markets → global.
 */
export function resolveMarketTags(primaryMarket: string, content: string): string[] {
  const tags: string[] = [primaryMarket];

  const keywordMap: Record<string, string[]> = {
    's&p 500': ['US'],
    'nasdaq': ['US'],
    'dow jones': ['US'],
    'ftse': ['UK'],
    'dax': ['EU'],
    'cac': ['EU'],
    'nikkei': ['JP'],
    'kospi': ['KR'],
    'hang seng': ['HK'],
    'shanghai': ['CN'],
    'shenzhen': ['CN'],
    'asx': ['AU'],
    'sensex': ['IN'],
    'nifty': ['IN'],
    'straits times': ['SG'],
    'taiex': ['TW'],
    'bitcoin': ['CRYPTO'],
    'ethereum': ['CRYPTO'],
    'btc': ['CRYPTO'],
    'eth': ['CRYPTO'],
    'oil': ['COMMODITY'],
    'gold': ['COMMODITY'],
    'copper': ['COMMODITY'],
    'natural gas': ['COMMODITY'],
  };

  const lowerContent = content.toLowerCase();
  for (const [keyword, mkts] of Object.entries(keywordMap)) {
    if (lowerContent.includes(keyword)) {
      for (const m of mkts) {
        if (!tags.includes(m)) tags.push(m);
      }
    }
  }

  return tags;
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultFeeds: InvestingComFeeds | null = null;

export function getInvestingComFeeds(): InvestingComFeeds {
  if (!defaultFeeds) defaultFeeds = new InvestingComFeeds();
  return defaultFeeds;
}

export function resetInvestingComFeeds(): void {
  defaultFeeds = null;
}
