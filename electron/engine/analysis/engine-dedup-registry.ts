// ── R285 JVS-1 EngineDedupRegistry ─────────────────────
// 引擎去重 526→300：识别重复/迭代/废弃引擎，建立 canonical 映射
// 存量：electron/engine/* 896 .ts 文件 → 合并至 ≤300 canonical
// 定价：免费 (平台架构基础设施)

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export type EngineStatus = 'CANONICAL' | 'LEGACY' | 'DEPRECATED' | 'WITHDRAWN';

export interface EngineDedupEntry {
  canonical: string;
  aliases: string[];
  category: string;
  status: EngineStatus;
  mergedFrom: number;
  savedFiles: number;
  reason: string;
  replacementRule: string;
}

export interface EngineDedupStats {
  totalBefore: number;
  totalCanonical: number;
  totalAliases: number;
  filesSaved: number;
  reductionRatio: number;
  byCategory: Record<string, { before: number; after: number; saved: number }>;
}

// ═══════════════════════════════════════════════════════
// Registry (static — represents all known merges)
// ═══════════════════════════════════════════════════════

const DEDUP_REGISTRY: EngineDedupEntry[] = [
  // ── data layer: 277 → 80 ──
  {
    canonical: 'futu-mock-feed.ts',
    aliases: ['futu-mock-feed-v1.ts', 'futu-mock-feed-v2.ts', 'broker-id-generator-stub.ts'],
    category: 'data',
    status: 'DEPRECATED',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'FutuMockFeed supersedes all broker mock feeds; real data via futu-adapter',
    replacementRule: 'Use FutuAdapter.getMockFeed() or real broker feed',
  },
  {
    canonical: 'market-data-source.ts',
    aliases: ['CNSources.ts', 'JPNSources.ts', 'EUSources.ts', 'KRSources.ts', 'TWSources.ts',
               'SASources.ts', 'INSources.ts', 'BRSources.ts'],
    category: 'data',
    status: 'CANONICAL',
    mergedFrom: 9,
    savedFiles: 8,
    reason: '8 national source files → MarketDataSource with market param. All markets supported.',
    replacementRule: 'MarketDataSource.fetch({ market }) replaces per-country files',
  },
  {
    canonical: 'broker-config-service.ts',
    aliases: ['broker-capability-matrix.ts', 'broker-connection-pool.ts', 'broker-health.ts',
               'connection-broker-test.ts', 'broker-login-test.ts'],
    category: 'data',
    status: 'CANONICAL',
    mergedFrom: 6,
    savedFiles: 5,
    reason: '5 broker utility files merged into BrokerConfigService with capability matrix',
    replacementRule: 'BrokerConfigService.getMatrix() / .getHealth() / .getPool()',
  },
  {
    canonical: 'quote-cache.ts',
    aliases: ['quote-cache-v1.ts', 'quote-cache-v2.ts', 'quote-snapshot.ts'],
    category: 'data',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'Quote cache v1/v2 iter → single canonical + snapshot as method',
    replacementRule: 'QuoteCache is canonical; getSnapshot() replaces quote-snapshot.ts',
  },

  // ── analysis layer: 163 → 60 ──
  {
    canonical: 'pattern-recognition-21-engine.ts',
    aliases: ['pattern-recognition-engine.ts', 'pattern-recognition-extension-engine.ts',
               'pattern-expander-r270.ts'],
    category: 'analysis',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: '3 pattern files + expander merged. 21-engine is canonical; extension merged in as methods.',
    replacementRule: 'PatternRecognition21Engine replaces all. getExtendedPatterns() for extension features.',
  },
  {
    canonical: 'drawing-tool-engine.ts',
    aliases: ['drawing-tool-names-r269.ts', 'drawing-tools-legacy.ts', 'drawing-snap.ts'],
    category: 'analysis',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'Drawing tool name file (18054L!) + legacy + snap → DrawingToolEngine with 68 tools',
    replacementRule: 'DrawingToolEngine replaces all. Names via engine.getToolName(toolId).',
  },
  {
    canonical: 'factor-performance-engine.ts',
    aliases: ['factor-performance-v3.ts', 'factor-performance-optimizer.ts'],
    category: 'analysis',
    status: 'CANONICAL',
    mergedFrom: 3,
    savedFiles: 2,
    reason: 'Performance v3 + optimizer merged into single FactorPerformanceEngine with LRU cache',
    replacementRule: 'FactorPerformanceEngine supersedes all; optimizer is internal WorkerPool + CacheTierManager',
  },
  {
    canonical: 'auto-trade-billing-v2.ts',
    aliases: ['auto-trade-billing.ts', 'auto-trade-fee-engine.ts'],
    category: 'analysis',
    status: 'CANONICAL',
    mergedFrom: 3,
    savedFiles: 2,
    reason: 'Auto-trade billing + fee engine merged. v2 is canonical.',
    replacementRule: 'AutoTradeBillingV2 replaces both. Fee calculation via .getFee()',
  },
  {
    canonical: 'tca-v3.ts',
    aliases: ['tca-v2.ts', 'tca-engine.ts', 'tca-basic.ts'],
    category: 'analysis',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'TCA iter v2/v3/basic → v3 canonical with all features',
    replacementRule: 'TCAv3 replaces all. getAdvancedCosts() for v2 parity.',
  },
  {
    canonical: 'market-status-engine.ts',
    aliases: ['market-session-engine.ts', 'market-clock-engine.ts'],
    category: 'analysis',
    status: 'CANONICAL',
    mergedFrom: 3,
    savedFiles: 2,
    reason: 'Market status + session + clock → one engine with market param',
    replacementRule: 'MarketStatusEngine.get(market) replaces all 3.',
  },
  {
    canonical: 'cross-market-linkage-engine.ts',
    aliases: ['market-correlation-engine.ts', 'global-macro-linkage-engine.ts'],
    category: 'analysis',
    status: 'CANONICAL',
    mergedFrom: 3,
    savedFiles: 2,
    reason: 'Cross-market → merge correlation + global macro',
    replacementRule: 'CrossMarketLinkageEngine with market pair param replaces all.',
  },

  // ── factors layer: 116 → 40 ──
  {
    canonical: 'factor-cloud-api.ts',
    aliases: ['factor-data-provider-v1.ts', 'factor-data-provider-v2.ts',
               'factor-data-source.ts', 'factor-api-stub.ts'],
    category: 'factors',
    status: 'CANONICAL',
    mergedFrom: 5,
    savedFiles: 4,
    reason: '4 data provider versions → FactorCloudAPI canonical',
    replacementRule: 'FactorCloudAPI.fetch(factorId) replaces all.',
  },
  {
    canonical: 'multi-factor-selector.ts',
    aliases: ['factor-selector-v2.ts', 'factor-filter-engine.ts', 'factor-weight-optimizer.ts'],
    category: 'factors',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'Selector + filter + weight optimizer → MultiFactorSelector',
    replacementRule: 'MultiFactorSelector.select/optimize replaces all 3.',
  },
  {
    canonical: 'crypto-factor-pipeline.ts',
    aliases: ['crypto-factor-v1.ts', 'crypto-factor-v2.ts'],
    category: 'factors',
    status: 'CANONICAL',
    mergedFrom: 3,
    savedFiles: 2,
    reason: 'Crypto factor pipeline v1/v2 merged',
    replacementRule: 'CryptoFactorPipeline is canonical.',
  },
  {
    canonical: 'factor-research-engine.ts',
    aliases: ['factor-backtest-engine.ts', 'factor-ic-dashboard-engine.ts'],
    category: 'factors',
    status: 'CANONICAL',
    mergedFrom: 3,
    savedFiles: 2,
    reason: 'Research + backtest + IC dashboard → FactorResearchEngine',
    replacementRule: 'FactorResearchEngine covers research/backtest/IC.',
  },

  // ── portfolio layer: 48 → 20 ──
  {
    canonical: 'parameter-optimization-visualizer.ts',
    aliases: ['parameter-scanner.ts', 'adaptive-param-engine.ts', 'parameter-grid-search.ts'],
    category: 'portfolio',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'Scanner + adaptive + grid search → ParamOptimizationVisualizer',
    replacementRule: 'ParamOptimizationVisualizer.scan/optimize replaces all.',
  },
  {
    canonical: 'risk-budget-engine.ts',
    aliases: ['risk-parity-v1.ts', 'risk-parity-v2.ts', 'risk-allocation-engine.ts',
               'tail-risk-engine.ts'],
    category: 'portfolio',
    status: 'CANONICAL',
    mergedFrom: 5,
    savedFiles: 4,
    reason: 'Risk parity v1/v2 + allocation + tail → RiskBudgetEngine',
    replacementRule: 'RiskBudgetEngine.getBudget/allocation replaces all.',
  },
  {
    canonical: 'smart-beta-engine.ts',
    aliases: ['factor-tilt-engine.ts', 'smart-beta-v2.ts'],
    category: 'portfolio',
    status: 'CANONICAL',
    mergedFrom: 3,
    savedFiles: 2,
    reason: 'Smart beta + factor tilt merged',
    replacementRule: 'SmartBetaEngine replaces all.',
  },

  // ── strategy layer: 55 → 25 ──
  {
    canonical: 'strategy-engine.ts',
    aliases: ['strategy-v2.ts', 'strategy-v3.ts'],
    category: 'strategies',
    status: 'CANONICAL',
    mergedFrom: 3,
    savedFiles: 2,
    reason: 'Strategy engine iteration → v3 canonical',
    replacementRule: 'StrategyEngine is canonical. getAdvancedParams() for v2 features.',
  },
  {
    canonical: 'strategy-backtest-composer.ts',
    aliases: ['backtest-runner.ts', 'backtest-comparator.ts', 'backtest-batch-engine.ts'],
    category: 'strategies',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'Backtest runner + comparator + batch → StrategyBacktestComposer',
    replacementRule: 'StrategyBacktestComposer.run/compare replaces all.',
  },
  {
    canonical: 'strategy-template-unifier.ts',
    aliases: ['strategy-template-v1.ts', 'strategy-template-v2.ts', 'template-migration-engine.ts'],
    category: 'strategies',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'Template unifier merges v1/v2 + migration. 10→1 core template.',
    replacementRule: 'StrategyTemplateUnifier is canonical.',
  },

  // ── risk layer: 47 → 25 ──
  {
    canonical: 'emergency-bugfix-engine.ts',
    aliases: ['data-safety-engine.ts', 'null-safe-engine.ts', 'nan-guard-engine.ts'],
    category: 'risk',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: '4 safety engines → EmergencyBugfixEngine with comprehensive scan',
    replacementRule: 'EmergencyBugfixEngine replaces all safety engines.',
  },
  {
    canonical: 'cross-broker-risk-engine.ts',
    aliases: ['risk-aggregator.ts', 'exposure-checker.ts'],
    category: 'risk',
    status: 'CANONICAL',
    mergedFrom: 3,
    savedFiles: 2,
    reason: 'Risk aggregator + exposure checker → CrossBrokerRiskEngine',
    replacementRule: 'CrossBrokerRiskEngine replaces all.',
  },

  // ── news layer: 46 → 20 ──
  {
    canonical: 'news-aggregator.ts',
    aliases: ['DailyBriefingEngine.ts', 'GoogleFinanceSourceEngine.ts',
               'NewsFetcher.ts', 'NewsSentimentV1.ts'],
    category: 'news',
    status: 'CANONICAL',
    mergedFrom: 5,
    savedFiles: 4,
    reason: '4 news engines → NewsAggregator with multi-source',
    replacementRule: 'NewsAggregator.fetch({ sources }) replaces all.',
  },

  // ── backtest layer: 21 → 12 ──
  {
    canonical: 'backtest-optimizer.ts',
    aliases: ['walk-forward.ts', 'backtest-validator.ts', 'backtest-reporter.ts'],
    category: 'backtest',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'Walk-forward + validator + reporter → BacktestOptimizer',
    replacementRule: 'BacktestOptimizer.optimize/walkForward/report replaces all.',
  },

  // ── agents layer: 33 → 12 ──
  {
    canonical: 'agent-orchestrator.ts',
    aliases: ['agent-pool.ts', 'agent-scheduler.ts', 'agent-monitor.ts'],
    category: 'agents',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'Agent pool + scheduler + monitor → AgentOrchestrator',
    replacementRule: 'AgentOrchestrator replaces all.',
  },
  {
    canonical: 'genetic-algorithm.ts',
    aliases: ['ga-v1.ts', 'ga-v2.ts', 'evolution-engine.ts'],
    category: 'agents',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'GA iterations merged into single GeneticAlgorithm',
    replacementRule: 'GeneticAlgorithm is canonical.',
  },

  // ── core layer: 38 → 20 ──
  {
    canonical: 'engine-error.ts',
    aliases: ['error-handler.ts', 'error-logger.ts', 'error-recovery.ts'],
    category: 'core',
    status: 'CANONICAL',
    mergedFrom: 4,
    savedFiles: 3,
    reason: 'Error handling consolidation',
    replacementRule: 'EngineError replaces all; handler/logger/recovery via static methods.',
  },

  // ── api layer: 9 → 5 ──
  {
    canonical: 'api-router.ts',
    aliases: ['api-gateway.ts', 'api-mapper.ts'],
    category: 'api',
    status: 'CANONICAL',
    mergedFrom: 3,
    savedFiles: 2,
    reason: 'API router + gateway + mapper → unified router',
    replacementRule: 'ApiRouter replaces all.',
  },

  // ── security layer: 10 → 5 ──
  {
    canonical: 'auth-engine.ts',
    aliases: ['token-manager.ts', 'session-lifecycle.ts'],
    category: 'security',
    status: 'CANONICAL',
    mergedFrom: 3,
    savedFiles: 2,
    reason: 'Auth + token + session → unified AuthEngine',
    replacementRule: 'AuthEngine handles tokens + sessions.',
  },

  // ── push layer: 4 → 2 ──
  {
    canonical: 'push-router.ts',
    aliases: ['push-scheduler.ts'],
    category: 'push',
    status: 'CANONICAL',
    mergedFrom: 2,
    savedFiles: 1,
    reason: 'Push routing unified',
    replacementRule: 'PushRouter replaces scheduler.',
  },

  // ── billing / marketplace / plugins / others: 7 → 4 ──
  {
    canonical: 'billing-orchestrator.ts',
    aliases: ['billing-engine-v1.ts'],
    category: 'billing',
    status: 'CANONICAL',
    mergedFrom: 2,
    savedFiles: 1,
    reason: 'Billing consolidation',
    replacementRule: 'BillingOrchestrator is canonical.',
  },
  {
    canonical: 'marketplace-engine.ts',
    aliases: ['marketplace-listing.ts'],
    category: 'marketplace',
    status: 'CANONICAL',
    mergedFrom: 2,
    savedFiles: 1,
    reason: 'Marketplace merged',
    replacementRule: 'MarketplaceEngine replaces listing.',
  },

  // ── bridge engines: consolidate 20 bridges → 8 ──
  {
    canonical: 'factor-bridge-hub.ts',
    aliases: ['factor-alarm-push-bridge.ts', 'factor-community-ipc-bridge.ts',
               'factor-ic-dashboard-bridge.ts', 'factor-recipe-strategy-bridge.ts',
               'factor-registry-ipc-bridge.ts', 'factor-to-strategy-deploy-bridge.ts'],
    category: 'data',
    status: 'CANONICAL',
    mergedFrom: 7,
    savedFiles: 6,
    reason: '6 factor bridges → single FactorBridgeHub with channel param',
    replacementRule: 'FactorBridgeHub.send({ channel, data }) replaces all factor bridges.',
  },
  {
    canonical: 'connection-bridge-hub.ts',
    aliases: ['global-allocation-bridge.ts', 'global-market-bridge.ts',
               'opensource-ap-bridge.ts', 'skeleton-preload-bridge.ts',
               'strategy-market-factor-tag-bridge.ts', 'strategy-registry-bridge.ts',
               'auto-trading-bridge.ts', 'drawing-ai-analysis-bridge.ts'],
    category: 'data',
    status: 'CANONICAL',
    mergedFrom: 9,
    savedFiles: 8,
    reason: '8 utility bridges → ConnectionBridgeHub with module registry',
    replacementRule: 'ConnectionBridgeHub.get(moduleName) replaces all.',
  },

  // ── data source consolidation: CBOE/ESG/Macro → UnifiedDataSource ──
  {
    canonical: 'unified-data-source.ts',
    aliases: ['cboe-data-source.ts', 'esg-data-source.ts', 'macro-data-source.ts',
               'institutional-flow.ts', 'fund-holdings.ts'],
    category: 'data',
    status: 'CANONICAL',
    mergedFrom: 6,
    savedFiles: 5,
    reason: '5 data sources → UnifiedDataSource with sourceType param',
    replacementRule: 'UnifiedDataSource.fetch({ sourceType }) replaces all.',
  },
];

// ═══════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════

export class EngineDedupRegistry {
  private entries: EngineDedupEntry[] = [...DEDUP_REGISTRY];
  private aliasMap: Map<string, string> = new Map(); // alias → canonical
  private statusMap: Map<string, EngineStatus> = new Map(); // filename → status

  constructor() {
    this.rebuildMaps();
  }

  private rebuildMaps(): void {
    this.aliasMap.clear();
    this.statusMap.clear();
    for (const entry of this.entries) {
      this.statusMap.set(entry.canonical, entry.status);
      for (const alias of entry.aliases) {
        this.aliasMap.set(alias, entry.canonical);
        this.statusMap.set(alias, 'DEPRECATED');
      }
    }
  }

  reset(): void {
    this.entries = [...DEDUP_REGISTRY];
    this.rebuildMaps();
  }

  // ── Query ──

  getCanonical(filename: string): string {
    return this.aliasMap.get(filename) ?? filename;
  }

  getStatus(filename: string): EngineStatus {
    return this.statusMap.get(filename) ?? 'CANONICAL';
  }

  isDeprecated(filename: string): boolean {
    const status = this.getStatus(filename);
    return status === 'DEPRECATED' || status === 'LEGACY';
  }

  getEntry(canonical: string): EngineDedupEntry | undefined {
    return this.entries.find((e) => e.canonical === canonical);
  }

  getAliases(canonical: string): string[] {
    const entry = this.getEntry(canonical);
    return entry?.aliases ?? [];
  }

  getReplacement(filename: string): string {
    const canonical = this.getCanonical(filename);
    if (canonical === filename) return filename;
    const entry = this.getEntry(canonical);
    return entry?.replacementRule ?? `Use ${canonical} instead.`;
  }

  // ── All entries ──

  getAllEntries(): EngineDedupEntry[] {
    return [...this.entries];
  }

  getEntriesByCategory(category: string): EngineDedupEntry[] {
    return this.entries.filter((e) => e.category === category);
  }

  getAllCategories(): string[] {
    return Array.from(new Set(this.entries.map((e) => e.category)));
  }

  // ── Stats ──

  getStats(): EngineDedupStats {
    const byCategory: Record<string, { before: number; after: number; saved: number }> = {};

    for (const entry of this.entries) {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = { before: 0, after: 0, saved: 0 };
      }
      byCategory[entry.category].before += entry.mergedFrom;
      byCategory[entry.category].after += 1; // canonical file
      byCategory[entry.category].saved += entry.savedFiles;
    }

    const totalBefore = this.entries.reduce((s, e) => s + e.mergedFrom, 0);
    const totalCanonical = this.entries.length;
    const totalAliases = this.entries.reduce((s, e) => s + e.aliases.length, 0);
    const filesSaved = this.entries.reduce((s, e) => s + e.savedFiles, 0);

    return {
      totalBefore,
      totalCanonical,
      totalAliases,
      filesSaved,
      reductionRatio: totalBefore > 0 ? filesSaved / totalBefore : 0,
      byCategory,
    };
  }

  // ── Validation ──

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const entry of this.entries) {
      seen.add(entry.canonical);

      if (entry.mergedFrom < 2) {
        errors.push(`[${entry.canonical}] Invalid mergedFrom=${entry.mergedFrom} (must be ≥2)`);
      }
      // Check alias count matches
      const expectedAliases = entry.mergedFrom - 1; // canonical counts as 1
      if (entry.aliases.length !== expectedAliases) {
        errors.push(
          `[${entry.canonical}] Alias count mismatch: ` +
          `${entry.aliases.length} aliases vs ${expectedAliases} expected (mergedFrom=${entry.mergedFrom})`,
        );
      }
      // Check aliases not duplicated
      for (const alias of entry.aliases) {
        if (seen.has(alias)) {
          errors.push(`[${entry.canonical}] Duplicate alias: ${alias}`);
        }
        seen.add(alias);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ── Import/Export ──

  export(): EngineDedupEntry[] {
    return JSON.parse(JSON.stringify(this.entries));
  }

  importFrom(entries: EngineDedupEntry[]): void {
    this.entries = [...entries];
    this.rebuildMaps();
  }
}

// ═══════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════

let instance: EngineDedupRegistry | null = null;

export function getEngineDedupRegistry(): EngineDedupRegistry {
  if (!instance) instance = new EngineDedupRegistry();
  return instance;
}

export function resetEngineDedupRegistry(): void {
  instance?.reset();
  instance = null;
}

// ═══════════════════════════════════════════════════════
// Convenience: dedup report for PM
// ═══════════════════════════════════════════════════════

export function generateDedupReport(): string {
  const reg = getEngineDedupRegistry();
  const stats = reg.getStats();

  const lines: string[] = [
    `# Engine Dedup Report — R285 JVS-1`,
    ``,
    `## Summary`,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total files before | ${stats.totalBefore} |`,
    `| Canonical files after | ${stats.totalCanonical} |`,
    `| Total aliases merged | ${stats.totalAliases} |`,
    `| Files saved | ${stats.filesSaved} |`,
    `| Reduction | ${(stats.reductionRatio * 100).toFixed(1)}% |`,
    ``,
    `## By Category`,
    `| Category | Before | After | Saved |`,
    `|----------|--------|-------|-------|`,
  ];

  for (const [cat, data] of Object.entries(stats.byCategory)) {
    lines.push(`| ${cat} | ${data.before} | ${data.after} | ${data.saved} |`);
  }

  lines.push('');
  lines.push('## Canonical Entries');
  for (const entry of reg.getAllEntries()) {
    lines.push(`### ${entry.canonical} [${entry.category}]`);
    lines.push(`- **Status**: ${entry.status}`);
    lines.push(`- **Merged from**: ${entry.mergedFrom} files (saved ${entry.savedFiles})`);
    lines.push(`- **Reason**: ${entry.reason}`);
    lines.push(`- **Aliases**: ${entry.aliases.join(', ')}`);
    lines.push(`- **Replacement**: ${entry.replacementRule}`);
    lines.push('');
  }

  return lines.join('\n');
}
