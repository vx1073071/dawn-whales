/**
 * DAWN WHALES R169 P3-06 — strategies/ unified barrel export
 *
 * All strategy modules in one place.
 * Legacy paths through electron/engine/analysis/ still work (copies preserved).
 */
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
