---
title: 消息智能 API 参考
description: DAWN WHALES 消息智能模块完整 API 参考 — 所有导出类、方法、类型定义
---

# 📚 API 参考

> 版本: v2.7.0 | 最后更新: 2026-06-16

## 模块导入

所有消息智能模块统一通过 barrel 导出：

```typescript
import {
  // 数据源
  XueqiuFetcher, CLSTelegraphFetcher, CryptoFeedsFetcher,
  SocialFeedsFetcher, RegionalFeedsFetcher, NewsAPIFetcher,

  // AI 引擎
  AISentimentEngine, DedupEngine,

  // 分析引擎
  NewsStockScreener, StockScreenerV2,
  NewsBacktestDataPrep, DailyDigestV2Engine,

  // 社区引擎
  CopytradeNewsEnhancer,

  // 管理
  NewsAPIKeyManager,

  // 类型
  NewsItem, NewsSource, SentimentResult, ImpactLevel,
} from './electron/engine/data';
```

---

## 数据源

### XueqiuFetcher

雪球热门帖子和个股搜索。

```typescript
class XueqiuFetcher {
  fetchHotPosts(limit?: number): Promise<NewsItem[]>;
  searchByTicker(ticker: string): Promise<NewsItem[]>;
  getStats(): XueqiuStats;
}
// 单例
getXueqiuFetcher(): XueqiuFetcher;
```

### CLSTelegraphFetcher

财联社实时电报。

```typescript
class CLSTelegraphFetcher implements NewsFetcher {
  id: 'cls_telegraph';
  name: 'CLS Telegraph';
  fetch(): Promise<NewsItem[]>;
  fetchLatest(count?: number): Promise<NewsItem[]>;
  health(): Promise<boolean>;
}
getCLSTelegraphFetcher(): CLSTelegraphFetcher;
```

### NewsAPIFetcher

NewsAPI.org 聚合器 (需 API 密钥)。

```typescript
class NewsAPIFetcher {
  search(params: NewsAPISearchParams): Promise<NewsItem[]>;
  topHeadlines(params: NewsAPITopParams): Promise<NewsItem[]>;
}

interface NewsAPISearchParams {
  q: string;
  language?: string;
  from?: string;
  to?: string;
  pageSize?: number;
  sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
}
```

### CryptoFeedsFetcher

加密新闻聚合 (5 源)。

```typescript
class CryptoFeedsFetcher implements NewsFetcher {
  setSymbols(symbols: string[]): void;
  fetch(): Promise<NewsItem[]>;
  health(): Promise<boolean>;
  getPerFeedHealth(): Map<string, FeedHealth>;
}
getCryptoFeedsFetcher(): CryptoFeedsFetcher;
```

### SocialFeedsFetcher

社交媒体新闻 (Reddit + StockTwits)。

```typescript
class SocialFeedsFetcher implements NewsFetcher {
  fetch(): Promise<NewsItem[]>;
  fetchReddit(subreddit?: string): Promise<NewsItem[]>;
  fetchStockTwits(ticker: string): Promise<NewsItem[]>;
  health(): Promise<boolean>;
}
getSocialFeedsFetcher(): SocialFeedsFetcher;
```

### RegionalFeedsFetcher

区域新闻 (Nikkei Asia + Investing India + Australia)。

```typescript
class RegionalFeedsFetcher implements NewsFetcher {
  fetch(): Promise<NewsItem[]>;
  fetchByRegion(region: 'jp' | 'in' | 'au'): Promise<NewsItem[]>;
  health(): Promise<boolean>;
}
getRegionalFeedsFetcher(): RegionalFeedsFetcher;
```

---

## AI 引擎

### AISentimentEngine

DeepSeek 情绪分析引擎。

```typescript
class AISentimentEngine {
  analyze(item: NewsItem): Promise<SentimentResult>;
  analyzeBatch(items: NewsItem[]): Promise<SentimentResult[]>;
  getStats(): { totalCalls: number; cost: number; degradationRate: number };
  getCacheSize(): number;
  resetCircuitBreaker(): void;
}
getAISentimentEngine(): AISentimentEngine;
resetAISentimentEngine(): void;
```

### DedupEngine

跨源去重引擎。

```typescript
class DedupEngine {
  dedup(items: NewsItem[]): { unique: NewsItem[]; duplicates: DedupResult[] };
  isDuplicate(item: NewsItem, existing: NewsItem[]): boolean;
  getStats(): DedupStats;
}
getDedupEngine(): DedupEngine;
resetDedupEngine(): void;
```

### NewsAPIKeyManager

API 密钥管理器 (AES-256-GCM 加密)。

```typescript
class NewsAPIKeyManager {
  addKey(key: string, tier?: 'free' | 'paid'): void;
  getActiveKey(): string | null;
  rotateKey(): string | null;
  getStats(): KeyManagerStats;
}
getNewsAPIKeyManager(): NewsAPIKeyManager;
```

---

## 分析引擎

### NewsStockScreener

新闻选股器。

```typescript
class NewsStockScreener {
  ingestNews(items: NewsItem[]): void;
  ingestVolume(ticker: string, volume: number): void;
  getSignals(ticker: string): ScreenerSignal[];
  getPresets(): ScreenerPreset[];
  createPreset(preset: ScreenerPreset): void;
}

interface ScreenerSignal {
  ticker: string;
  score: number;          // 0-100
  suggestion: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'CAUTION';
  reasons: string[];
}
getStockScreener(): NewsStockScreener;
```

### StockScreenerV2

选股器 V2 (跨市场/加密传导/商品轮动/社交共振/时区接力)。

```typescript
class StockScreenerV2 extends NewsStockScreener {
  screenCrossMarket(ticker: string): V2ScreenerResult;
  screenCryptoImpact(ticker: string): V2ScreenerResult;
  screenCommodityRotation(ticker: string): V2ScreenerResult;
  screenSocialResonance(ticker: string): V2ScreenerResult;
  screenTimezoneMomentum(ticker: string): V2ScreenerResult;
  screenComposite(ticker: string): V2ScreenerResult;
}
getStockScreenerV2(): StockScreenerV2;
```

### NewsBacktestDataPrep

新闻回测数据准备引擎。

```typescript
class NewsBacktestDataPrep {
  ingestNews(items: NewsItem[]): void;
  ingestPrices(ticker: string, prices: PriceSnapshot[]): void;
  ingestBenchmark(prices: PriceSnapshot[]): void;
  align(ticker: string): AlignedEvent[];
  generateSummary(tickers?: string[]): BacktestSummary;
  queryEvents(ticker: string, keyword: string, days: number): AlignedEvent[];
  queryStats(ticker: string, keyword: string): QueryStats;
  exportCSV(ticker: string): string;
  exportJSON(): string;
  getStats(): PrepStats;
}

interface AlignedEvent {
  ticker: string;
  newsId: string;
  eventDate: number;
  returns: BacktestReturns;
}

interface BacktestReturns {
  window1d: number; window3d: number; window5d: number;
  window7d: number; window14d: number; window30d: number;
  maxDrawdown: number; volatility: number;
}
getBacktestDataPrep(): NewsBacktestDataPrep;
```

### DailyDigestV2Engine

每日摘要 V2 引擎。

```typescript
class DailyDigestV2Engine {
  generate(
    portfolio: NewsItem[],
    watchlist: NewsItem[],
    market: NewsItem[],
    priceChanges?: Map<string, number>,
  ): DailyDigestV2;

  assessRisk(ticker: string, news: NewsItem[]): RiskAssessment;
  generateStrategy(ticker: string, news: NewsItem[]): StrategySuggestion | null;
}

interface DailyDigestV2 {
  date: string;
  marketOverview: MarketOverview;
  portfolio: { attribution: AttributionItem[]; riskAssessments: RiskAssessment[] };
  watchlist: { bullishSignals: Signal[]; bearishSignals: Signal[] };
  topNews: NewsItem[];
  disclaimer: string;
}
getDailyDigestV2Engine(): DailyDigestV2Engine;
```

---

## 社区引擎

### CopytradeNewsEnhancer

跟单新闻增强引擎。

```typescript
class CopytradeNewsEnhancer {
  ingestNews(items: NewsItem[], lookbackDays?: number): void;
  matchTrade(signal: CreatorTradeSignal): TradeNewsMatch;
  enrichOrder(signal: CreatorTradeSignal): EnrichedCopytradeOrder;
  generateNotification(
    signal: CreatorTradeSignal,
    followerId: string,
    options?: { requireConfirmation?: boolean; mentionNews?: boolean },
  ): EnhancedNotification;
  processBatch(signals: CreatorTradeSignal[]): EnrichedCopytradeOrder[];
  batchNotifications(
    signals: CreatorTradeSignal[],
    followerId: string,
    options?: { requireConfirmation?: boolean },
  ): EnhancedNotification[];
  getNewsForSymbol(symbol: string, limit?: number): NewsItem[];
  getStats(): CopytradeNewsStats;
  prune(olderThanHours?: number): number;
  reset(): void;
}
getCopytradeNewsEnhancer(): CopytradeNewsEnhancer;
resetCopytradeNewsEnhancer(): void;
```

---

## 通用类型

### NewsItem

```typescript
interface NewsItem {
  id: string;
  title: string;
  body: string;
  summary?: string;
  url?: string;
  source: NewsSource;
  publishedAt: number;      // unix ms
  fetchedAt: number;        // unix ms
  language: 'zh' | 'en';
  tickers: string[];
  sentiment?: SentimentResult;
  category?: NewsCategory;
  impact?: ImpactLevel;
  metadata?: Record<string, unknown>;
  fingerprint?: string;
}
```

### SentimentResult

```typescript
interface SentimentResult {
  score: number;           // -1.0 ~ +1.0
  confidence: number;      // 0.0 ~ 1.0
  tickers: string[];
  keywords: string[];      // ≤5
  category: NewsCategory;
  impact: number;          // 1-10
  reasoning: string;
  provider: 'deepseek' | 'keyword' | 'none';
}
```

### NewsFetcher 接口

```typescript
interface NewsFetcher {
  id: string;
  name: string;
  fetch(): Promise<NewsItem[]>;
  health?(): Promise<boolean>;
  getStats?(): { lastFetch: number; errorRate: number };
}
```

---

## 测试示例

```typescript
import { describe, it, expect } from 'vitest';
import { getCopytradeNewsEnhancer, resetCopytradeNewsEnhancer } from './electron/engine/data';

describe('CopytradeNewsEnhancer', () => {
  beforeEach(() => resetCopytradeNewsEnhancer());

  it('matches trade with news', () => {
    const enhancer = getCopytradeNewsEnhancer();
    enhancer.ingestNews([{ /* ... */ }]);
    const match = enhancer.matchTrade({
      tradeId: 't1', creatorId: 'c1', creatorName: 'Trader',
      symbol: 'AAPL', direction: 'BUY', quantity: 100, timestamp: Date.now(),
    });
    expect(match.confidence).toBeGreaterThan(0);
  });
});
```
