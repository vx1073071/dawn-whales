/**
 * DAWN WHALES R169 P3-06 — strategies/ unified barrel export
 *
 * All strategy modules in one place.
 * Legacy paths through electron/engine/analysis/ still work (copies preserved).
 */

// R204-R207 Phase 2: Factor strategy templates — 44 total
// R204(13) + R205(11) + R206(10) + R207(10) = 44
// Covered: 🇭🇰8 🪙8 🇯🇵4 🇰🇷2 🇹🇼🇸🇬🇦🇺🇮🇳4 🇪🇺🇮🇳3 🤖13 🌐4
// Phase 2 autoclaw chapter complete.
export {
  HK_TEMPLATES, CRYPTO_TEMPLATES,
  JP_KR_TEMPLATES, TW_SG_AU_TEMPLATES, EU_IN_TEMPLATES,
  AI_TEMPLATES,
  HK_SUPPLEMENT_TEMPLATES, CROSS_SUPPLEMENT_TEMPLATES, AI_SUPPLEMENT_TEMPLATES,
  AUTOCLAW_TEMPLATES,
  ALL_AUTOCLAW_TEMPLATES, ALL_AUTOCLAW_TEMPLATES_R206, ALL_AUTOCLAW_TEMPLATES_R207,
  TEMPLATE_COUNT, ALL_TEMPLATE_COUNT, ALL_TEMPLATE_COUNT_R206, ALL_TEMPLATE_COUNT_R207,
  getTemplateById, getTemplateByIdR205, getTemplateByIdR206, getTemplateByIdR207,
  getTemplatesByMarket, getTemplatesByMarketR205, getTemplatesByMarketR206, getTemplatesByMarketR207,
  getAITemplates, getAITemplatesR207,
  validateFourIronRules, validateAllTemplates, validateAllTemplatesR205, validateAllTemplatesR206, validateAllTemplatesR207,
  type MarketTag, type AITriggerPoint, type DeepSeekChatConfig, type HoldingDays,
  type TemplateFourIronRules, type FactorComboEntry, type FactorStrategyTemplate,
} from './factor-strategy-templates';

export {
  StrategyComparisonEngine,
  createStrategyComparisonEngine,
  PortfolioOptimizer,
  createPortfolioOptimizer,
  type StrategyMetrics as CompOptimizerMetrics,
  type RadarPoint,
  type EfficientFrontierPoint,
  type RiskBudget,
  type RebalanceAction,
  type CovMatrixEntry,
} from './strategy-comparison-optimizer';

export {
  StrategyEngine,
} from './strategy-engine';

export {
  StrategyEnsemble,
  getStrategyEnsemble,
  resetStrategyEnsemble,
  type Strategy as EnsembleStrategy,
  type StrategySignal as EnsembleStrategySignal,
  type EnsembleSignal,
  type EnsembleConfig,
  type EnsembleMetrics,
  type RebalanceSignal,
} from './strategy-ensemble';

export {
  StrategyExplainer,
  type StrategySignal as ExplainerStrategySignal,
  type StrategyExplanation,
  type PortfolioSummary,
} from './strategy-explainer';

export {
  StrategyExportImport,
  getStrategyExportImport,
  type ExportFormat,
  type ConflictPolicy,
  type ExportStatus,
  type ImportStatus,
  type StrategyConfig,
  type RiskRule,
  type IndicatorConfig,
  type ExportManifest,
  type ExportResult,
  type ImportValidation,
  type ImportConflict,
  type ImportResult,
  type ExportHistoryEntry,
} from './strategy-export-import';

export {
  StrategyMarketplaceEngine,
  getMarketplace,
  resetMarketplace,
  type StrategyCategory,
  type StrategyMarket,
  type SortBy,
  type StrategyListing,
  type SearchFilters,
  type SearchResult,
  type AssetType,
  type UnifiedMarketItem,
  type UnifiedSearchQuery,
  type UnifiedSearchResult,
  type FactorListing,
  type SignalListing,
  type CreatorTier,
  type CommissionTierConfig,
  type CommissionResult,
} from './strategy-marketplace-api';

export {
  StrategyMarketplaceSearch,
  getStrategyMarketplaceSearch,
  type StrategyMetric,
  type SearchQuery as MarketplaceSearchQuery,
  type SearchResult as MarketplaceSearchResult,
} from './strategy-marketplace-search';

export {
  StrategyMonitor,
  type StrategyStatus,
  type AnomalyType,
  type StrategySnapshot,
  type PerformanceAnomaly,
  type StrategyMonitorReport,
} from './strategy-monitor';

export {
  StrategyOptimizer,
  getStrategyOptimizer,
  resetStrategyOptimizer,
  type OptimizationMode,
  type OptimizationObjective,
  type OptimizationStatus,
  type ParamSpec,
  type ObjectiveWeights,
  type OptimizationConfig,
  type EvalResult,
  type OptimizationProgress,
  type OptimizationResult,
  type HeatmapData,
  type FWScanEntry,
  type ICWeightOptimization,
  type ParetoPoint,
  type ParetoSummary,
  type ParetoComparison,
} from './strategy-optimizer';

export {
  StrategyRankingEngine,
  type StrategyMetrics as RankingMetrics,
  type RankingDimension,
  type RankingConfig,
  type StrategyRank,
  type EloConfig,
  type EloResult,
  type CorrelationEntry,
  type AttributionResult,
  type DrawdownRecoveryResult,
  type ConsistencyResult,
  type BenchmarkData,
  type BenchmarkComparisonResult,
  type LifecycleStage,
  type LifecycleResult,
} from './strategy-ranking-engine';

export {
  StrategyRunner,
  type StrategyRunMode,
  type StrategyRunStatus,
  type ExecutionRecord,
  type EvaluationResult,
  type QuoteProviderFn,
} from './strategy-runner';

export {
  StrategyScreener,
  type StockMetrics,
  type ScreenerResult,
  type ScreenerConfig,
} from './strategy-screener';

export {
  StrategySignalAggregator,
  getStrategySignalAggregator,
  type StrategySignal as AggStrategySignal,
  type CompositeSignal,
  type AggregatorConfig,
} from './strategy-signal-aggregator';

export {
  StrategySignalConverter,
  getStrategySignalConverter,
  resetStrategySignalConverter,
  type AgentRecommendation,
  type SignalSide,
  type ConsensusMethod,
  type AgentVote,
  type ConvertedSignal,
  type ConversionOptions,
} from './strategy-signal-converter';

export {
  StrategySignalGenerator,
  getStrategySignalGenerator,
  type SignalFactor,
  type StrategySignal,
  type SignalGeneratorConfig,
  type BacktestValidation,
} from './strategy-signal-generator';

export {
  getAllTemplates,
  getTemplate,
  getTemplatesByCategory,
  getTemplatesByTag,
  searchTemplates,
  getCategoryCounts,
  instantiateTemplate,
  type StrategyCategory as TemplateCategory,
  type TimeFrame,
  type ParameterDef,
  type StrategyTemplate,
} from './strategy-templates';
