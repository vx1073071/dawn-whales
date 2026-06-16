/**
 * R240-auto#2: 加密5源 RSS接入 (Crypto RSS Feeds)
 *
 * CoinDesk + CoinTelegraph + Decrypt + The Block + CryptoFeedr
 *
 * 特性:
 *   - RSS 2.0 解析 (XML→结构化数据)
 *   - 自动标签: coin/sector/event
 *   - 速率限制: per-feed 60s refresh
 *   - 健康检查: per-feed availability tracking
 *   - 去重: URL + title hash
 *   - 错误恢复: per-feed isolation, single feed failure doesn't block others
 */

import { createHash } from 'crypto';
import type { NewsItem, NewsFetcher } from './news-types';

// ═══════════════════════════════════════════════════════════════════════
// Feed Configuration
// ═══════════════════════════════════════════════════════════════════════

interface CryptoFeedConfig {
  name: string;
  url: string;
  category: string;     // 'general' | 'bitcoin' | 'ethereum' | 'defi' | 'regulation' | 'markets'
  language: string;
  refreshInterval: number; // ms
}

const CRYPTO_FEEDS: CryptoFeedConfig[] = [
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss',
    category: 'general',
    language: 'en',
    refreshInterval: 60000,
  },
  {
    name: 'CoinTelegraph',
    url: 'https://cointelegraph.com/rss',
    category: 'general',
    language: 'en',
    refreshInterval: 60000,
  },
  {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
    category: 'markets',
    language: 'en',
    refreshInterval: 60000,
  },
  {
    name: 'The Block',
    url: 'https://www.theblock.co/rss.xml',
    category: 'markets',
    language: 'en',
    refreshInterval: 60000,
  },
  {
    name: 'CryptoFeedr',
    url: 'https://cryptofeedr.com/feed.xml',
    category: 'general',
    language: 'en',
    refreshInterval: 60000,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// RSS Item Types
// ═══════════════════════════════════════════════════════════════════════

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid?: string;
  category?: string;
  'dc:creator'?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Crypto-specific knowledge
// ═══════════════════════════════════════════════════════════════════════

const COIN_KEYWORDS: Record<string, string[]> = {
  BTC: ['btc', 'bitcoin', 'bitcoin'],
  ETH: ['eth', 'ethereum', 'ether'],
  SOL: ['sol', 'solana'],
  XRP: ['xrp', 'ripple'],
  BNB: ['bnb', 'binance coin'],
  ADA: ['cardano', 'ada'],
  DOGE: ['doge', 'dogecoin'],
  AVAX: ['avax', 'avalanche'],
  DOT: ['dot', 'polkadot'],
  MATIC: ['matic', 'polygon'],
  LINK: ['link', 'chainlink'],
  UNI: ['uni', 'uniswap'],
  AAVE: ['aave'],
  MKR: ['mkr', 'maker'],
  SNX: ['snx', 'synthetix'],
  COMP: ['comp', 'compound'],
  LDO: ['ldo', 'lido'],
  OP: ['op', 'optimism'],
  ARB: ['arb', 'arbitrum'],
  APT: ['apt', 'aptos'],
  SUI: ['sui'],
  NEAR: ['near'],
  ATOM: ['atom', 'cosmos'],
  INJ: ['inj', 'injective'],
  RUNE: ['rune', 'thorchain'],
  TIA: ['tia', 'celestia'],
  SEI: ['sei'],
  STRK: ['strk', 'starknet'],
  ORDI: ['ordi'],
  PEPE: ['pepe'],
  WIF: ['wif'],
  BONK: ['bonk'],
  USDT: ['usdt', 'tether'],
  USDC: ['usdc'],
};

const SECTOR_KEYWORDS: Record<string, string[]> = {
  defi: ['defi', 'decentralized finance', 'lending', 'borrowing', 'yield', 'amm', 'dex', 'swap'],
  nft: ['nft', 'non-fungible', 'digital art', 'collectible', 'opensea', 'blur'],
  layer2: ['layer 2', 'layer-2', 'l2', 'rollup', 'optimistic', 'zk-rollup', 'sidechain'],
  gaming: ['gamefi', 'gaming', 'play-to-earn', 'p2e', 'web3 gaming', 'metaverse'],
  infrastructure: ['infrastructure', 'node', 'validator', 'consensus', 'protocol upgrade'],
  regulation: ['sec', 'cftc', 'regulation', 'compliance', 'lawsuit', 'enforcement', 'ban', 'legal'],
  stablecoins: ['stablecoin', 'usdt', 'usdc', 'dai', 'algorithmic stable'],
  mining: ['mining', 'hash rate', 'miner', 'asic', 'proof of work', 'pow'],
  staking: ['staking', 'validator', 'apr', 'apy', 'liquid staking', 'restaking'],
  interoperability: ['bridge', 'cross-chain', 'interoperability', 'ibc', 'wormhole', 'layerzero'],
};

const EVENT_KEYWORDS: Record<string, string[]> = {
  hack: ['hack', 'exploit', 'breach', 'stolen', 'drain', 'attack', 'vulnerability'],
  airdrop: ['airdrop', 'air drop', 'token distribution', 'claim'],
  listing: ['listing', 'listed', 'exchange listing', 'binance listing', 'coinbase listing'],
  upgrade: ['upgrade', 'hard fork', 'soft fork', 'merge', 'testnet', 'mainnet', 'eip', 'bip'],
  partnership: ['partnership', 'collaboration', 'integration', 'alliance'],
  fundraising: ['funding', 'raised', 'round', 'seed', 'series', 'valuation', 'investor'],
  whale: ['whale', 'large transaction', 'on-chain movement', 'wallet transfer'],
};

// ═══════════════════════════════════════════════════════════════════════
// Simple RSS Parser (zero-dependency)
// ═══════════════════════════════════════════════════════════════════════

function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Extract <item>...</item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const item: RSSItem = {
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      description: extractTag(block, 'description'),
      pubDate: extractTag(block, 'pubDate'),
      guid: extractTag(block, 'guid'),
      category: extractTag(block, 'category'),
      'dc:creator': extractTag(block, 'dc:creator'),
    };

    if (item.title && item.link) {
      items.push(item);
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  // Handle namespaced tags (e.g., dc:creator)
  const escapedTag = tag.replace(/:/g, ':');
  const regex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\/${escapedTag}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';

  // Strip CDATA
  let content = match[1].trim();
  if (content.startsWith('<![CDATA[') && content.endsWith(']]>')) {
    content = content.slice(9, -3);
  }

  // Decode HTML entities
  content = content
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");

  return content.trim();
}

// ═══════════════════════════════════════════════════════════════════════
// CryptoFetcher
// ═══════════════════════════════════════════════════════════════════════

interface FeedStatus {
  name: string;
  url: string;
  status: 'ok' | 'error' | 'disabled';
  lastFetched: number;
  lastError?: string;
  itemCount: number;
  consecutiveFailures: number;
}

export class CryptoFeedsFetcher implements NewsFetcher {
  readonly source = 'coindesk' as const;  // Primary source for NewsFetcher interface
  private feeds: CryptoFeedConfig[];
  private statusMap = new Map<string, FeedStatus>();
  private itemCache = new Map<string, NewsItem[]>();
  private lastRefresh = new Map<string, number>();
  private fetchTimeout = 10000; // 10s per feed

  constructor(feeds?: CryptoFeedConfig[]) {
    this.feeds = feeds || CRYPTO_FEEDS;

    // Initialize status
    for (const feed of this.feeds) {
      this.statusMap.set(feed.name, {
        name: feed.name,
        url: feed.url,
        status: 'ok',
        lastFetched: 0,
        itemCount: 0,
        consecutiveFailures: 0,
      });
    }
  }

  /**
   * 拉取单个 RSS Feed
   */
  async fetchFeed(feed: CryptoFeedConfig): Promise<NewsItem[]> {
    const status = this.statusMap.get(feed.name)!;
    const now = Date.now();

    // Rate limit: don't refresh too often
    if (now - (this.lastRefresh.get(feed.name) || 0) < feed.refreshInterval) {
      return this.itemCache.get(feed.name) || [];
    }

    try {
      const resp = await fetch(feed.url, {
        headers: {
          'User-Agent': 'DawnWhales/2.7.0 (RSS Reader)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(this.fetchTimeout),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const xml = await resp.text();
      const items = parseRSS(xml);

      // Transform to NewsItem
      const newsItems: NewsItem[] = items.map(item => this.transformItem(item, feed));

      // Update cache
      this.itemCache.set(feed.name, newsItems);
      this.lastRefresh.set(feed.name, now);
      status.status = 'ok';
      status.lastFetched = now;
      status.itemCount = newsItems.length;
      status.consecutiveFailures = 0;

      return newsItems;
    } catch (err: any) {
      status.consecutiveFailures++;
      if (status.consecutiveFailures >= 5) {
        status.status = 'error';
      }
      status.lastError = err.message;
      console.error(`[CryptoFeeds] ${feed.name} fetch failed: ${err.message}`);

      // Return cached items if available
      return this.itemCache.get(feed.name) || [];
    }
  }

  /**
   * 拉取全部加密源 (NewsFetcher接口)
   */
  async fetch(symbols?: string[], since?: number): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];
    const seen = new Set<string>();

    // Fetch all feeds in parallel (per-feed isolation)
    const results = await Promise.allSettled(
      this.feeds.map(feed => this.fetchFeed(feed))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const item of result.value) {
          // Deduplicate by ID
          if (!seen.has(item.id)) {
            seen.add(item.id);
            allItems.push(item);
          }
        }
      }
    }

    // Filter by symbol
    let filtered = allItems;
    if (symbols && symbols.length > 0) {
      const symbolSet = new Set(symbols.map(s => s.toUpperCase()));
      filtered = allItems.filter(item =>
        item.tickers?.some(t => symbolSet.has(t.toUpperCase()))
      );
    }

    // Filter by time
    if (since) {
      filtered = filtered.filter(item => item.publishedAt >= since);
    }

    // Sort by publishedAt descending
    filtered.sort((a, b) => b.publishedAt - a.publishedAt);

    return filtered;
  }

  // ── Private ─────────────────────────────────────────────────────

  private transformItem(item: RSSItem, feed: CryptoFeedConfig): NewsItem {
    const text = (item.title + ' ' + item.description).toLowerCase();
    const tickers = this.extractCryptoTickers(text);
    const category = this.determineCategory(text, feed.category);
    const impact = this.determineImpact(text);
    const tags = this.extractTags(item);

    return {
      id: `crypto:${feed.name}:${this.hashGuid(item.guid || item.link)}`,
      title: item.title,
      body: item.description || item.title,
      summary: stripHtml(item.description).substring(0, 200),
      url: item.link,
      source: this.getSourceForFeed(feed.name),
      publishedAt: new Date(item.pubDate).getTime() || Date.now(),
      fetchedAt: Date.now(),
      language: feed.language,
      tickers,
      category,
      impact,
      metadata: {
        newsSource: feed.name,
        author: item['dc:creator'],
        fetchSource: 'rss',
        tags,
      },
      fingerprint: this.computeFingerprint(item),
    };
  }

  private extractCryptoTickers(text: string): string[] {
    const found: string[] = [];

    // Check known cryptocurrency names
    for (const [ticker, keywords] of Object.entries(COIN_KEYWORDS)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          found.push(ticker);
          break;
        }
      }
    }

    // Also detect $TICKER patterns
    const dollarMatches = text.match(/\$[A-Z]{2,5}\b/g);
    if (dollarMatches) {
      for (const m of dollarMatches) {
        const ticker = m.substring(1);
        if (!found.includes(ticker)) found.push(ticker);
      }
    }

    return [...new Set(found)];
  }

  private determineCategory(text: string, feedCat: string): NewsItem['category'] {
    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          if (sector === 'regulation') return 'policy';
          return 'industry';
        }
      }
    }

    // Default mapping from feed category
    switch (feedCat) {
      case 'regulation': return 'policy';
      case 'markets': return 'industry';
      default: return 'industry';
    }
  }

  private determineImpact(text: string): NewsItem['impact'] {
    for (const [event, keywords] of Object.entries(EVENT_KEYWORDS)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          if (event === 'hack' || event === 'whale') return 'P0';
          if (event === 'upgrade' || event === 'listing') return 'P1';
          return 'P2';
        }
      }
    }
    return 'P3';
  }

  private extractTags(item: RSSItem): string[] {
    const tags: string[] = [];

    // Extract events
    const text = (item.title + ' ' + item.description).toLowerCase();
    for (const [event, keywords] of Object.entries(EVENT_KEYWORDS)) {
      if (keywords.some(kw => text.includes(kw))) tags.push(event);
    }

    // Extract sectors
    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      if (keywords.some(kw => text.includes(kw))) tags.push(sector);
    }

    return [...new Set(tags)].slice(0, 5);
  }

  private hashGuid(guid: string): string {
    return createHash('md5').update(guid).digest('hex').substring(0, 12);
  }

  private computeFingerprint(item: RSSItem): string {
    const content = (item.title + (item.description || '')).replace(/\s+/g, '').substring(0, 500);
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private getSourceForFeed(feedName: string): 'coindesk' | 'cointelegraph' | 'decrypt' | 'theblock' | 'cryptofeedr' {
    switch (feedName) {
      case 'CoinDesk': return 'coindesk';
      case 'CoinTelegraph': return 'cointelegraph';
      case 'Decrypt': return 'decrypt';
      case 'The Block': return 'theblock';
      case 'CryptoFeedr': return 'cryptofeedr';
      default: return 'coindesk';
    }
  }

  // ── Public: Health & Stats ──────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    const statuses = [...this.statusMap.values()];
    return statuses.some(s => s.status === 'ok');
  }

  async getHealth() {
    const statuses = [...this.statusMap.values()];
    const okCount = statuses.filter(s => s.status === 'ok').length;
    const errorCount = statuses.filter(s => s.status === 'error').length;

    return {
      status: errorCount === this.feeds.length ? 'down'
        : errorCount > 0 ? 'degraded'
        : 'ok',
      latencyMs: 0,
      lastFetch: Math.max(...statuses.map(s => s.lastFetched)) || undefined,
      feeds: statuses.map(s => ({
        name: s.name,
        status: s.status,
        lastFetched: s.lastFetched,
        itemCount: s.itemCount,
        lastError: s.lastError,
      })),
    };
  }

  getFeedStatus(): FeedStatus[] {
    return [...this.statusMap.values()];
  }

  getCache(): Map<string, NewsItem[]> {
    return this.itemCache;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: CryptoFeedsFetcher | null = null;
export function getCryptoFeedsFetcher(feeds?: CryptoFeedConfig[]): CryptoFeedsFetcher {
  if (!instance) instance = new CryptoFeedsFetcher(feeds);
  return instance;
}

export function resetCryptoFeedsFetcher(): void {
  instance = null;
}
