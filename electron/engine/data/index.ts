/**
 * R238: News Data Module — Barrel Export
 */

export { XueqiuFetcher, getXueqiuFetcher } from './xueqiu-fetcher';
export { DedupEngine, getDedupEngine, resetDedupEngine } from './dedup-engine';
export { CLSTelegraphFetcher, getCLSTelegraphFetcher } from './cls-telegraph-fetcher';
export { NewsAPIKeyManager, NewsAPIFetcher, getNewsAPIKeyManager } from './newsapi-manager';
export { AISentimentEngine, getAISentimentEngine, resetAISentimentEngine } from './ai-sentiment-engine';
export { NewsStockScreener, getStockScreener, resetStockScreener } from './news-stock-screener';
export type { ScreenerPreset, ScreenerCondition, ScreenerResult, SentimentSnapshot } from './news-stock-screener';
export { CryptoFeedsFetcher, getCryptoFeedsFetcher, resetCryptoFeedsFetcher } from './crypto-feeds';
export { SocialFeedsFetcher, getSocialFeedsFetcher, resetSocialFeedsFetcher } from './social-feeds';
export { RegionalFeedsFetcher, getRegionalFeedsFetcher, resetRegionalFeedsFetcher } from './regional-feeds';
export { StockScreenerV2, getStockScreenerV2, resetStockScreenerV2 } from './stock-screener-v2';
export type { V2ScreenerResult } from './stock-screener-v2';
export { NewsBacktestDataPrep, getBacktestDataPrep, resetBacktestDataPrep } from './news-backtest-data-prep';
export type { AlignedEvent, BacktestReturns, BacktestSummary, PriceSnapshot } from './news-backtest-data-prep';
export { DailyDigestV2Engine, getDailyDigestV2Engine, resetDailyDigestV2Engine } from './daily-digest-v2';
export type { DailyDigestV2, AttributionItem, RiskAssessment, StrategySuggestion, MarketOverview } from './daily-digest-v2';
export { CopytradeNewsEnhancer, getCopytradeNewsEnhancer, resetCopytradeNewsEnhancer } from './copytrade-news-enhancer';
export type {
  CreatorTradeSignal,
  TradeNewsMatch,
  MatchedNewsItem,
  SentimentSummary,
  EnrichedCopytradeOrder,
  EnhancedNotification,
  CopytradeNewsStats,
  TradeDirection,
} from './copytrade-news-enhancer';
export type {
  NewsSource,
  NewsCategory,
  ImpactLevel,
  SentimentResult,
  NewsItem,
  DedupResult,
  NewsFetcher,
} from './news-types';
