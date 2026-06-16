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
// R238 missing (auto#1-3)
export { FreeAPIFetcher, getFreeAPIFetcher, resetFreeAPIFetcher } from './free-api-fetcher';
export type { FreeAPIConfig, FreeAPIStats } from './free-api-fetcher';
export { MajorFeedsFetcher, getMajorFeedsFetcher, resetMajorFeedsFetcher } from './major-feeds';
export type { MajorFeedConfig, FeedHealth, MajorFeedsStats } from './major-feeds';
export { DedupEngineV2, getDedupEngineV2, resetDedupEngineV2 } from './dedup-engine-v2';
export type { DedupV2Config, DedupV2Result, DedupV2Stats } from './dedup-engine-v2';
// R239 missing (auto#1-3)
export { PriceMoveAttribution, getPriceMoveAttribution, resetPriceMoveAttribution } from './price-move-attribution';
export type {
  PriceMove,
  AttributionResult,
  AttributionConfig,
  AttributionStats,
  MoveDirection,
} from './price-move-attribution';
export { DailyBriefingGenerator, getDailyBriefingGenerator, resetDailyBriefingGenerator } from './daily-briefing-generator';
export type {
  DailyBriefing,
  BriefingConfig,
  PortfolioNewsItem,
  WatchlistSignal,
  MarketOverview as BriefingMarketOverview,
  BriefingStats,
} from './daily-briefing-generator';
export {
  DegradationChain,
  AIUsageTracker,
  degradationChain,
  usageTracker,
  resetDegradationChain,
  resetUsageTracker,
} from './degradation-chain';
export type {
  AITier,
  UsageTier,
  DegradationConfig,
  DegradationState,
  UsageRecord,
  UsageAlert,
  CombinedStats,
} from './degradation-chain';

export type {
  NewsSource,
  NewsCategory,
  ImpactLevel,
  SentimentResult,
  NewsItem,
  DedupResult,
  NewsFetcher,
} from './news-types';

// R244 P0-05: WatchlistSmartNews data pipeline
export { WatchlistSmartNews, watchlistSmartNews, resetWatchlistSmartNews } from './watchlist-smart-news';
export type {
  WatchlistSymbol,
  WatchlistNewsItem,
  WatchlistNewsConfig,
  WatchlistSource,
  WatchlistStats,
  MatchType,
} from './watchlist-smart-news';

// R244 P1-22: Social source degradation engine
export { SocialSourceDegradation, socialSourceDegradation, resetSocialSourceDegradation } from './social-source-degradation';
export type {
  SocialSourceConfig,
  SocialEndpoint,
  SourceTier,
  DegradedFetchResult,
  SourceHealth,
  DegradedPost,
} from './social-source-degradation';

// R244 P0-10: One-click backtest→deploy bridge
export { BacktestDeployBridge, backtestDeployBridge, resetBacktestDeployBridge } from './backtest-deploy-bridge';
export type {
  DeployableTemplate,
  TemplateParameterInput,
  ResolvedParams,
  BacktestResult,
  DeployRequest,
  DeployResult,
  RiskSummary,
  DeploymentStats,
} from './backtest-deploy-bridge';

// R245 P0-06: NewsFactorBridge data layer
export { NewsFactorBridge, newsFactorBridge, resetNewsFactorBridge } from './news-factor-bridge';
export type {
  NewsEventCategory,
  FactorDomain,
  ImpactDirection,
  NewsFactorMapping,
  FactorImpact,
  BridgeSignal,
  BridgeConfig,
} from './news-factor-bridge';

// R245 P0-10: Fast backtest→deploy bridge (streaming + ≤30s guarantee)
export { FastBacktestDeployBridge, fastBacktestDeployBridge, resetFastBacktestDeployBridge } from './fast-deploy-bridge';
export type {
  PipelineStage,
  PipelineProgress,
  EnhancedDeployResult,
  FastDeployConfig,
} from './fast-deploy-bridge';

// R246 P1-03: Factor marketplace bridge (factor data → marketplace → buyout unlock)
export { FactorMarketplaceBridge, factorMarketplaceBridge, resetFactorMarketplaceBridge } from './factor-marketplace-bridge';
export type {
  FactorListing,
  PurchaseRecord,
  FactorSearchQuery,
  MarketplaceStats,
  FactorReview,
} from './factor-marketplace-bridge';

// R246 P0-10 COMPLETE: One-click deploy pipeline (3-step ≤30s E2E)
export { OneClickDeployPipeline, oneClickDeployPipeline, resetOneClickDeployPipeline } from './one-click-deploy-pipeline';
export type {
  DeployStep,
  StepTiming,
  OneClickResult,
  PipelineConfig as DeployPipelineConfig,
  PipelineStats,
} from './one-click-deploy-pipeline';

// R246 P2-32: Price move push engine (pre-market detection + AI explanation)
export { PriceMovePushEngine, priceMovePushEngine, resetPriceMovePushEngine } from './price-move-push-engine';
export type {
  PriceMove,
  MoveExplanation,
  ExplanationReason,
  PushNotification,
  PushMove,
  WatchlistItem,
  PushSchedule,
} from './price-move-push-engine';
