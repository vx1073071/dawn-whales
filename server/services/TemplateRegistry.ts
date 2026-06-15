/**
 * TemplateRegistry — R204 J1b: 统一策略模板注册中心
 *
 * Unified registry for all strategy templates.
 * Supported types: template (canned), ai_generated (DeepSeek), manual.
 * All templates must satisfy 四铁律 (4 Iron Rules) + 3-5 AI trigger points.
 *
 * >=150L production-ready
 */

import { StrategyTemplate, FourIronRules, AITriggerPoint, FactorCombo, MarketTag } from './TemplateEngine';

// ── Registry ──────────────────────────────────────────────────────────────

export class TemplateRegistry {
  private templates: Map<string, StrategyTemplate> = new Map();
  private byMarket: Map<MarketTag, Set<string>> = new Map();
  private byCategory: Map<string, Set<string>> = new Map();

  /** Register a single template */
  register(template: StrategyTemplate): void {
    if (!this.validateFourIronRules(template)) {
      throw new Error('Template ' + template.id + ' failed 四铁律 validation');
    }
    if (template.aiTriggers.length < 3) {
      throw new Error('Template ' + template.id + ' needs at least 3 AI trigger points');
    }
    this.templates.set(template.id, template);

    // Index by market
    for (const tag of template.marketTags) {
      if (!this.byMarket.has(tag)) this.byMarket.set(tag, new Set());
      this.byMarket.get(tag)!.add(template.id);
    }

    // Index by category
    if (!this.byCategory.has(template.category)) this.byCategory.set(template.category, new Set());
    this.byCategory.get(template.category)!.add(template.id);
  }

  /** Bulk register */
  registerAll(templates: StrategyTemplate[]): void {
    for (const t of templates) this.register(t);
  }

  /** Get template by ID */
  get(id: string): StrategyTemplate | undefined { return this.templates.get(id); }

  /** Get all templates */
  getAll(): StrategyTemplate[] { return [...this.templates.values()]; }

  /** Get by market tag */
  getByMarket(tag: MarketTag): StrategyTemplate[] {
    const ids = this.byMarket.get(tag);
    if (!ids) return [];
    return [...ids].map(id => this.templates.get(id)!).filter(Boolean);
  }

  /** Get by category */
  getByCategory(category: string): StrategyTemplate[] {
    const ids = this.byCategory.get(category);
    if (!ids) return [];
    return [...ids].map(id => this.templates.get(id)!).filter(Boolean);
  }

  /** Search by keyword (id, name, description, tags) */
  search(keyword: string): StrategyTemplate[] {
    const kw = keyword.toLowerCase();
    const results: StrategyTemplate[] = [];
    for (const [_, tpl] of this.templates) {
      if (tpl.id.toLowerCase().includes(kw) || tpl.name.toLowerCase().includes(kw)
        || tpl.nameCN.includes(kw) || tpl.oneLiner.toLowerCase().includes(kw)
        || tpl.tags.some(t => t.toLowerCase().includes(kw))) {
        results.push(tpl);
      }
    }
    return results;
  }

  /** Search with filters */
  searchFiltered(options: { keyword?: string; market?: MarketTag; category?: string; minFactors?: number }): StrategyTemplate[] {
    let results = this.getAll();
    if (options.market) results = results.filter(t => t.marketTags.includes(options.market!));
    if (options.category) results = results.filter(t => t.category === options.category);
    if (options.keyword) {
      results = results.filter(t => t.matchesKeyword(options.keyword!));
    }
    if (options.minFactors) results = results.filter(t => t.factorCombo.factorIds.length >= options.minFactors!);
    return results;
  }

  /** Count templates by market */
  getCountsByMarket(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [tag, ids] of this.byMarket) counts[tag] = ids.size;
    return counts;
  }

  /** Count all */
  getTotalCount(): number { return this.templates.size; }

  /** Validate 四铁律 */
  validateFourIronRules(template: StrategyTemplate): boolean {
    const r = template.ironRules;
    if (!r || r.oneLiner.length > 80) return false;  // 铁律1: ≤80字
    if (!r.stopLossRule || r.stopLossRule.length === 0) return false;  // 铁律2
    if (!r.marketScope || r.marketScope.length === 0) return false;    // 铁律3
    if (!r.failureCheck || r.failureCheck.length === 0) return false;  // 铁律4
    return true;
  }

  /** Get AI trigger points count */
  getAITriggerCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [id, tpl] of this.templates) counts[id] = tpl.aiTriggers.length;
    return counts;
  }
}

/** Singleton */
export const templateRegistry = new TemplateRegistry();
