/**
 * TemplateUnifiedService.ts — R227 JVS-2.1d: 统一3套模板系统为1个展示层
 *
 * Unifies:
 *   1. strategy-templates.ts (22 templates, StrategyTemplate interface)
 *   2. factor-strategy-templates*.ts (36+ templates, FactorStrategyTemplate interface)
 *   3. template-definitions-*.ts (46 region templates, FactorStrategyTemplate interface)
 *
 * Into a single UnifiedTemplate interface and a single TemplateUnifiedService API:
 *   - getTemplate(id)           → UnifiedTemplate | null
 *   - listTemplates(filters?)   → UnifiedTemplate[]
 *   - searchTemplates(query)    → UnifiedTemplate[]
 *   - recommendByProfile(input) → UnifiedTemplate[]
 *   - getStats()                → { total, byMarket, byCategory, byRiskLevel }
 *
 * ≥350 lines.
 */

import type { StrategyTemplate } from './strategy-templates';
import type { FactorStrategyTemplate } from './factor-strategy-templates-types';
import type { StrategyCategory } from '../../analysis/strategy-templates';

// ─── Unified Format ───────────────────────────────────────────────────

export interface UnifiedTemplate {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  source: 'strategy-22' | 'factor-36' | 'region-46';

  // Market
  market: string;
  marketTags: string[];
  category: string;

  // Risk & style
  riskLevel: 'conservative' | 'balanced' | 'aggressive' | 'unknown';
  difficulty: 1 | 2 | 3 | 4 | 5;
  timeHorizon: 'intraday' | 'swing' | 'position' | 'long-term' | 'trend';
  expectedHoldingDays: string;

  // Factors
  factors: Array<{
    factorId: string;
    factorName: string;
    weight: number;
    direction: 'long' | 'short';
  }>;

  // Rules
  ironRules?: {
    humanLine: string;
    stopLossRule: string;
    marketScope: Array<{ market: string; assetClass: string }>;
    failureCheck: string;
  };
  entryRule?: string;
  exitRule?: string;

  // Meta
  tags: string[];
  version: string;
  aiTriggerCount: number;
}

// ─── Filters ──────────────────────────────────────────────────────────

export interface TemplateFilters {
  market?: string;
  category?: string;
  riskLevel?: string;
  timeHorizon?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

// ─── Stats ────────────────────────────────────────────────────────────

export interface TemplateStats {
  total: number;
  byMarket: Record<string, number>;
  byCategory: Record<string, number>;
  byRiskLevel: Record<string, number>;
  bySource: Record<string, number>;
}

// ─── Converters ───────────────────────────────────────────────────────

function inferDifficulty(tags: string[], difficulty?: number): 1 | 2 | 3 | 4 | 5 {
  if (difficulty !== undefined && difficulty >= 1 && difficulty <= 5) {
    return difficulty as 1 | 2 | 3 | 4 | 5;
  }
  // Infer from tags
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  if (tagSet.has('beginner') || tagSet.has('simple')) return 1;
  if (tagSet.has('basic')) return 2;
  if (tagSet.has('expert') || tagSet.has('complex')) return 5;
  if (tagSet.has('advanced')) return 4;
  return 3; // default moderate
}

function inferMarket(category: string, tags: string[]): string {
  const marketMap: Record<string, string> = {
    hk: 'HK',
    us: 'US',
    crypto: 'CRYPTO',
    jp: 'JP',
    kr: 'KR',
    tw: 'TW',
    sg: 'SG',
    au: 'AU',
    eu: 'EU',
    in: 'IN',
    cross: 'CROSS',
    commodity: 'COMMODITY',
    ai: 'AI',
  };
  return marketMap[category.toLowerCase()] || 'UNKNOWN';
}

function inferRiskLevel(
  ironRules?: { humanLine?: string; stopLossRule?: string; marketScope?: unknown[] },
  riskStr?: string
): 'conservative' | 'balanced' | 'aggressive' | 'unknown' {
  if (riskStr) {
    const r = riskStr.toLowerCase();
    if (r.includes('conservative') || r.includes('low')) return 'conservative';
    if (r.includes('aggressive') || r.includes('high')) return 'aggressive';
    if (r.includes('balanced') || r.includes('moderate') || r.includes('medium')) return 'balanced';
  }
  // Infer from stop loss strictness
  if (ironRules?.stopLossRule) {
    const sl = ironRules.stopLossRule;
    if (/\b(1|2|3|5)%/.test(sl) || /跌破/.test(sl)) return 'aggressive';
    if (/\b(15|20|25|30)%/.test(sl) || /跌破60日/.test(sl)) return 'conservative';
  }
  return 'unknown';
}

function convertStrategyTemplate(t: StrategyTemplate): UnifiedTemplate {
  return {
    id: t.id,
    name: t.name,
    nameCn: t.nameCn,
    description: t.description || t.oneLiner || '',
    source: 'strategy-22',
    market: inferMarket(t.category.toString(), t.tags),
    marketTags: t.tags,
    category: t.category.toString(),
    riskLevel: (t.riskLevel as 'conservative' | 'balanced' | 'aggressive') || 'unknown',
    difficulty: inferDifficulty(t.tags),
    timeHorizon: 'swing',
    expectedHoldingDays: `${t.risk?.defaultStopLoss || 5}-${t.risk?.defaultTakeProfit || 15}天`,
    factors: (t.factorWeight)
      ? Object.entries(t.factorWeight).map(([factorId, weight]) => ({
          factorId,
          factorName: factorId,
          weight: weight * 100,
          direction: 'long' as const,
        }))
      : [],
    ironRules: t.ironRules
      ? {
          humanLine: t.ironRules.humanReadable || '',
          stopLossRule: t.ironRules.stopLossExplicit || '',
          marketScope: [{ market: t.ironRules.marketApplicable || '', assetClass: '股票' }],
          failureCheck: t.ironRules.failureSelfCheck || '',
        }
      : undefined,
    entryRule: t.rules?.entry,
    exitRule: t.rules?.exit,
    tags: t.tags,
    version: t.version || '1.0.0',
    aiTriggerCount: t.aiTriggers?.length || 0,
  };
}

function convertFactorTemplate(t: FactorStrategyTemplate): UnifiedTemplate {
  return {
    id: t.id,
    name: t.name,
    nameCn: t.nameCn,
    description: t.fourIronRules?.humanLine || '',
    source: 'factor-36',
    market: inferMarket(t.category, t.tags),
    marketTags: t.tags,
    category: t.category,
    riskLevel: inferRiskLevel(
      { stopLossRule: t.fourIronRules?.stopLossRule },
      (t as Record<string, unknown>).riskLevel as string
    ),
    difficulty: (t.difficulty || 3) as 1 | 2 | 3 | 4 | 5,
    timeHorizon: t.timeHorizon || 'swing',
    expectedHoldingDays: t.expectedHoldingDays || `${t.holdingDays?.min || 1}-${t.holdingDays?.max || 30}天`,
    factors: (t.factorCombo || []).map((f) => ({
      factorId: f.factorId,
      factorName: f.factorName,
      weight: f.weight,
      direction: f.direction,
    })),
    ironRules: {
      humanLine: t.fourIronRules?.humanLine || '',
      stopLossRule: t.fourIronRules?.stopLossRule || '',
      marketScope: (t.fourIronRules?.marketScope || []).map((ms) => ({
        market: ms.market,
        assetClass: ms.assetClass,
      })),
      failureCheck: t.fourIronRules?.failureCheck || '',
    },
    tags: t.tags,
    version: t.version || '1.0.0',
    aiTriggerCount: t.aiTriggerPoints?.length || 0,
  };
}

// ─── Service ──────────────────────────────────────────────────────────

export class TemplateUnifiedService {
  private templates: UnifiedTemplate[];

  constructor(
    strategyTemplates: StrategyTemplate[] = [],
    factorTemplates: FactorStrategyTemplate[] = [],
    regionTemplates: FactorStrategyTemplate[] = []
  ) {
    this.templates = [
      ...strategyTemplates.map(convertStrategyTemplate),
      ...factorTemplates.map(convertFactorTemplate),
      ...regionTemplates.map((t) => ({ ...convertFactorTemplate(t), source: 'region-46' as const })),
    ];
  }

  /**
   * Get a single template by ID.
   */
  getTemplate(id: string): UnifiedTemplate | null {
    return this.templates.find((t) => t.id === id) || null;
  }

  /**
   * List templates with optional filters.
   */
  listTemplates(filters?: TemplateFilters): UnifiedTemplate[] {
    let results = [...this.templates];

    if (filters) {
      if (filters.market) {
        results = results.filter(
          (t) =>
            t.market.toLowerCase() === filters.market!.toLowerCase() ||
            t.marketTags.some((tag) => tag.toLowerCase().includes(filters.market!.toLowerCase()))
        );
      }

      if (filters.category) {
        results = results.filter(
          (t) => t.category.toLowerCase() === filters.category!.toLowerCase()
        );
      }

      if (filters.riskLevel) {
        results = results.filter(
          (t) => t.riskLevel.toLowerCase() === filters.riskLevel!.toLowerCase()
        );
      }

      if (filters.timeHorizon) {
        results = results.filter(
          (t) => t.timeHorizon === filters.timeHorizon
        );
      }

      if (filters.tags && filters.tags.length > 0) {
        results = results.filter((t) =>
          filters.tags!.some((tag) =>
            t.tags.some((tt) => tt.toLowerCase().includes(tag.toLowerCase()))
          )
        );
      }

      if (filters.search) {
        const query = filters.search.toLowerCase();
        results = results.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            t.nameCn.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query) ||
            t.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      }

      if (filters.offset !== undefined) {
        results = results.slice(filters.offset);
      }

      if (filters.limit !== undefined) {
        results = results.slice(0, filters.limit);
      }
    }

    return results;
  }

  /**
   * Search templates by query string (name, description, tags, category).
   */
  searchTemplates(query: string): UnifiedTemplate[] {
    return this.listTemplates({ search: query, limit: 20 });
  }

  /**
   * Recommend templates by profile.
   */
  recommendByProfile(input: {
    market: string;
    riskLevel: string;
    preferLong?: boolean;
  }): UnifiedTemplate[] {
    return this.listTemplates({
      market: input.market,
      riskLevel: input.riskLevel,
      limit: 10,
    });
  }

  /**
   * Get aggregate statistics.
   */
  getStats(): TemplateStats {
    const stats: TemplateStats = {
      total: this.templates.length,
      byMarket: {},
      byCategory: {},
      byRiskLevel: {},
      bySource: {},
    };

    for (const t of this.templates) {
      stats.byMarket[t.market] = (stats.byMarket[t.market] || 0) + 1;
      stats.byCategory[t.category] = (stats.byCategory[t.category] || 0) + 1;
      stats.byRiskLevel[t.riskLevel] = (stats.byRiskLevel[t.riskLevel] || 0) + 1;
      stats.bySource[t.source] = (stats.bySource[t.source] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get all template IDs (useful for indexing).
   */
  getAllIds(): string[] {
    return this.templates.map((t) => t.id);
  }

  /**
   * Count templates.
   */
  count(): number {
    return this.templates.length;
  }
}
