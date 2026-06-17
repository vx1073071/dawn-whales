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

// R247 P1-06: Factor signal translator bridge (factor ID → human language + frontend data flow)
export { FactorSignalTranslator, factorSignalTranslator, resetFactorSignalTranslator } from './factor-signal-translator';
export type {
  FactorCard,
  FactorTranslationRequest,
  FactorTranslation,
  TranslatorStats,
} from './factor-signal-translator';

// R247 P1-07: Factor scene bridge (5 scenes → factor matching → backtest trigger)
export { FactorSceneBridge, factorSceneBridge, resetFactorSceneBridge } from './factor-scene-bridge';
export type {
  FactorScene,
  SceneFactorWithWeight,
  SceneMatchResult,
  UserPreferences,
  SceneBundle,
} from './factor-scene-bridge';

// R251 P2-26: Factor visualization completion (multi-compare + drill-down + insights + watchlist)
export { FactorVisualizationCompletion, factorVisualizationCompletion, resetFactorVisualizationCompletion } from './factor-viz-completion';
export type {
  MultiFactorComparison,
  DrillDownNode,
  FactorInsight,
  FactorWatchlistItem,
  FactorAlert,
  FactorSnapshot,
} from './factor-viz-completion';

// R251 P2-27: Template PK completion (matchups + batch + league + trends + purchase PK)
export { TemplatePKCompletion, templatePKCompletion, resetTemplatePKCompletion } from './template-pk-completion';
export type {
  PredefinedMatchup,
  BatchPKResult,
  PKLeagueEntry,
  PKTrendData,
  PurchaseDecisionPK,
} from './template-pk-completion';

// R251 P2-28: AI verifiable evidence (external verification + scoring + contradictions + audit)
export { AIVerifiableEvidence, aiVerifiableEvidence, resetAIVerifiableEvidence } from './ai-verifiable-evidence';
export type {
  VerificationLevel,
  EvidenceDomain,
  VerifiableClaim,
  VerifiedEvidence,
  Contradiction,
  AuditTrail,
  EvidenceScore,
  EvidenceReport,
} from './ai-verifiable-evidence';

// R252 P2-32: Price move push completion (delivery pipeline + preferences + recap + analytics)
export { PriceMovePushCompletion, priceMovePushCompletion, resetPriceMovePushCompletion } from './price-move-push-completion';
export type {
  DeliveryChannel,
  DeliveryStatus,
  RecurrenceRule,
  PushDeliveryRecord,
  UserPushPreferences,
  PostMarketRecap,
  PushAnalytics,
  PushFormatTemplate,
} from './price-move-push-completion';

// R253 DS-03: East Money fetcher (A-share quotes + sector flows + dragon tiger + north-bound)
export { EastMoneyClient, EastMoneyPipeline, eastMoneyPipeline, resetEastMoneyPipeline } from './eastmoney-fetcher';
export type {
  StockExchange,
  MarketBoard,
  EastMoneySector,
  EastMoneyQuote,
  SectorFlow,
  DragonTigerRecord,
  NorthBoundFlow,
  EastMoneyAnnouncement,
  EastMoneyMarketSnapshot,
  EastMoneyPipelineConfig,
  PipelineQuoteOutput,
  PipelineFlowOutput,
} from './eastmoney-fetcher';

// R253 DS-01: Yahoo Finance → Engine bridge (WS normalization + caching + indicators + market clock)
export { YahooEngineBridge, yahooEngineBridge, resetYahooEngineBridge } from './yahoo-engine-bridge';
export type {
  YahooMarket,
  MarketSession,
  QuoteUpdateEvent,
  YahooRawQuote,
  EngineQuote,
  BridgeTechnicalIndicators,
  BridgeHealthProbe,
  BridgeStats,
  MarketClock,
} from './yahoo-engine-bridge';

// R253 DQ-02: Source health pipeline (real-time monitoring + alerts + degradation + trends)
export { SourceHealthPipeline, sourceHealthPipeline, resetSourceHealthPipeline } from './source-health-pipeline';
export type {
  AlertSeverity,
  AlertRule,
  DegradationAction,
  HealthScanResult,
  HealthAlert,
  DegradationPolicy,
  HealthTrendPoint,
  HealthDashboardStream,
} from './source-health-pipeline';

// R254 BR-04: Binance API bridge (spot + contracts + order book + klines → engine crypto quotes)
export { BinanceAPIBridge, binanceAPIBridge, resetBinanceAPIBridge } from './binance-api-bridge';
export type {
  BinanceSymbol,
  BinanceInterval,
  ContractType,
  BinanceSpotQuote,
  BinanceContractData,
  BinanceOrderBook,
  BinanceKline,
  BinanceLargeTrade,
  EngineCryptoQuote,
  BinanceStats,
} from './binance-api-bridge';

// R254 AI-03: Move attribution engine (6-dim AI-driven price move attribution + K-line patterns)
export { MoveAttributionEngine, moveAttributionEngine, resetMoveAttributionEngine } from './move-attribution-engine';
export type {
  AttributionDimension,
  MoveAttribution,
  AttributionReason,
  AttributionScore,
  KlinePattern,
  PeerMove,
  AttributionReport,
  AttributionStats,
} from './move-attribution-engine';

// R254 AI-02: Briefing data bridge (7 briefing templates + multi-source aggregation + personalized)
export { BriefingDataBridge, briefingDataBridge, resetBriefingDataBridge } from './briefing-data-bridge';
export type {
  BriefingType,
  DataSection,
  BriefingConfig,
  BriefingSection,
  BriefingDataItem,
  MarketOverview,
  TopMover,
  MacroEvent,
  BriefingOutput,
} from './briefing-data-bridge';

// R255 AI-06: Market-to-strategy bridge (market data → strategy signals)
export { MarketToStrategyBridge, marketToStrategyBridge, resetMarketToStrategyBridge } from './market-to-strategy-bridge';
export type {
  MarketSignalType,
  MarketObservation,
  StrategySignal,
  StrategyType,
  StrategyMatch,
  MarketSnapshot,
} from './market-to-strategy-bridge';

// R255 DS-05: Investing.com RSS fetcher (articles + economic calendar + technical summaries)
export { InvestingRSSFetcher, investingRSSFetcher, resetInvestingRSSFetcher } from './investing-rss-fetcher';
export type {
  InvestingFeedCategory,
  InvestingArticle,
  EconomicEvent,
  TechnicalSummary,
  InvestingEngineArticle,
  InvestingStats,
} from './investing-rss-fetcher';

// R255 BR-05: Source switch UI bridge (dynamic source switching → frontend dashboard)
export { SourceSwitchUIBridge, sourceSwitchUIBridge, resetSourceSwitchUIBridge } from './source-switch-ui-bridge';
export type {
  DataSourceId,
  SourceStatus,
  SourceDomain,
  DataSourceMeta,
  SourceHealth,
  SourceSwitchEvent,
  UISourceDashboard,
  SourceSwitchResult,
} from './source-switch-ui-bridge';

// R276 auto#1: AShare factor bridge (A股数据源 → 因子系统桥接)
export { AShareFactorBridge, getAShareBridge, resetAShareBridge } from './ashare-factor-bridge';
export type {
  AShareSnapshot,
  AShareSmartMoney,
  AShareNorthbound,
  AShareDragonGate,
  AShareMargin,
  AShareSectorFlow,
  AShareLimitAnalysis,
  AShareFactorSignal,
  AShareSignalCategory,
  AShareBridgeStats,
  AShareBridgeConfig,
} from './ashare-factor-bridge';

// R276 auto#2: Factor subscription push bridge (因子订阅 → 推送IPC)
export { FactorSubscriptionPushBridge, getFactorSubPushBridge, resetFactorSubPushBridge } from './factor-subscription-push-bridge';
export type {
  PushDeliveryChannel,
  SubscriptionTier,
  FactorSubscription,
  FactorPushDelivery,
  FactorSubscriptionStats,
  FactorSubscriptionConfig,
} from './factor-subscription-push-bridge';
