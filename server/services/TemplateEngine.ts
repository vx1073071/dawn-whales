/**
 * TemplateEngine — R204 J1a: 统一策略模板引擎
 *
 * Core engine for strategy template management:
 *  - Factor combo + weights validation
 *  - 四铁律 (4 Iron Rules) enforcement
 *  - AI trigger point registration
 *  - Market tag system (11 asset classes)
 *  - Template scoring + ranking
 *
 * All 28 core templates (R204) + 88 final templates (R204-R207) must use this engine.
 *
 * >=300L production-ready
 */

import log from 'electron-log';

// ── Types ─────────────────────────────────────────────────────────────────

/** 11 market/asset class tags */
export type MarketTag = 'US' | 'HK' | 'CRYPTO' | 'JP' | 'TW' | 'KR' | 'SG' | 'AU' | 'IN' | 'EU' | 'COMMODITY';

/** AI trigger point type */
export type AITriggerType = 'BACKTEST_READ' | 'PARAM_FILL' | 'OPTIMIZE' | 'FACTOR_DIAGNOSE' | 'ALT_DATA';

/** AI trigger point descriptor */
export interface AITriggerPoint {
  type: AITriggerType;
  /** Human-readable trigger name (CN) */
  nameCN: string;
  /** Human-readable trigger name (EN) */
  nameEN: string;
  /** Price in USDT */
  priceUSDT: number;
  /** What it does (one-liner, CN) */
  descriptionCN: string;
  /** What it does (one-liner, EN) */
  descriptionEN: string;
  /** Which parameter/field it operates on */
  targetParams?: string[];
}

/** 四铁律 — every template must satisfy */
export interface FourIronRules {
  /** 铁律1: One-liner ≤80 chars explaining what it does */
  oneLiner: string;
  /** 铁律2: Stop-loss rule (specific condition + %) */
  stopLossRule: string;
  /** 铁律3: Applicable market scope — what markets + instruments */
  marketScope: string;
  /** 铁律4: Failure check — when to abandon this strategy */
  failureCheck: string;
}

/** Factor combination */
export interface FactorCombo {
  /** Factor IDs (must be in 258-factor registry) */
  factorIds: string[];
  /** Weights per factor (sum=1.0) */
  weights: number[];
  /** Composite formula description */
  formula: string;
}

/** Unified strategy template (extends legacy StrategyTemplate) */
export interface StrategyTemplate {
  id: string;
  name: string;
  nameCN: string;
  category: string;
  description: string;
  oneLiner: string;             // short pitch
  version: number;

  /** Market coverage */
  marketTags: MarketTag[];

  /** Factor engine */
  factorCombo: FactorCombo;

  /** 四铁律 (R204 new) */
  ironRules: FourIronRules;

  /** 3-5 AI trigger points (R204 new) */
  aiTriggers: AITriggerPoint[];

  /** Legacy compatibility */
  applicable: string[];
  tags: string[];
  risk: { defaultStopLoss: number; defaultTakeProfit: number; maxPosition: number };
  timeframe: string[];

  // Scoring
  popularityScore: number;
  winRate?: number;
  sharpe?: number;

  matchesKeyword(kw: string): boolean;
}

// ── Prebuilt AI Trigger Points ────────────────────────────────────────────

export const AI_TRIGGERS: Record<AITriggerType, Omit<AITriggerPoint, 'targetParams'>> = {
  BACKTEST_READ: {
    type: 'BACKTEST_READ', nameCN: '回测解读', nameEN: 'Backtest Read', priceUSDT: 1,
    descriptionCN: 'AI解读模板历史回测结果，分析胜负场景', descriptionEN: 'AI analyzes template backtest results and win/loss patterns',
  },
  PARAM_FILL: {
    type: 'PARAM_FILL', nameCN: '参数智能填充', nameEN: 'Auto Param Fill', priceUSDT: 1,
    descriptionCN: '根据当前市场环境智能推荐参数', descriptionEN: 'AI recommends optimal parameters for current market',
  },
  OPTIMIZE: {
    type: 'OPTIMIZE', nameCN: '优化建议', nameEN: 'Optimization Advice', priceUSDT: 1.5,
    descriptionCN: 'AI分析因子权重优化空间', descriptionEN: 'AI analyzes factor weight optimization potential',
  },
  FACTOR_DIAGNOSE: {
    type: 'FACTOR_DIAGNOSE', nameCN: '因子诊断', nameEN: 'Factor Diagnose', priceUSDT: 1,
    descriptionCN: 'AI诊断因子当前IC及拥挤度', descriptionEN: 'AI diagnoses factor IC and crowding levels',
  },
  ALT_DATA: {
    type: 'ALT_DATA', nameCN: '替代数据解锁', nameEN: 'Alt Data Unlock', priceUSDT: 2,
    descriptionCN: '解锁CFTC/EIA/LME/GLD等替代数据视图', descriptionEN: 'Unlock alternative data views (CFTC/EIA/LME/GLD)',
  },
};

// ── Factor Weight Validator ───────────────────────────────────────────────

export interface WeightValidationResult {
  valid: boolean;
  sum: number;
  positivesOk: boolean;
  countMatch: boolean;
  errors: string[];
}

// ── TemplateEngine ────────────────────────────────────────────────────────

export class TemplateEngine {
  /** Validate factor weights: must sum to ~1.0, all positive, count matches */
  validateWeights(factorCombo: FactorCombo): WeightValidationResult {
    const errors: string[] = [];
    const sum = factorCombo.weights.reduce((s, w) => s + w, 0);
    const positivesOk = factorCombo.weights.every(w => w >= 0);
    const countMatch = factorCombo.factorIds.length === factorCombo.weights.length;

    if (Math.abs(sum - 1.0) > 0.001) {
      errors.push('Weight sum must be 1.0, got ' + sum.toFixed(3));
    }
    if (!positivesOk) errors.push('All weights must be non-negative');
    if (!countMatch) errors.push('Factor count (' + factorCombo.factorIds.length + ') != weight count (' + factorCombo.weights.length + ')');

    return { valid: errors.length === 0, sum, positivesOk, countMatch, errors };
  }

  /** Validate 四铁律 completeness */
  validateFourIronRules(rules: FourIronRules): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!rules.oneLiner || rules.oneLiner.length > 80) errors.push('铁律1: oneLiner must be <=80 chars, got ' + (rules.oneLiner?.length || 0));
    if (!rules.stopLossRule) errors.push('铁律2: stopLossRule is required');
    if (!rules.marketScope) errors.push('铁律3: marketScope is required');
    if (!rules.failureCheck) errors.push('铁律4: failureCheck is required');
    return { valid: errors.length === 0, errors };
  }

  /** Validate AI trigger points (3-5 required) */
  validateAITriggers(triggers: AITriggerPoint[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (triggers.length < 3) errors.push('Need >=3 AI trigger points, got ' + triggers.length);
    if (triggers.length > 5) errors.push('Max 5 AI trigger points, got ' + triggers.length);

    // Check for duplicates
    const types = new Set<string>();
    for (const t of triggers) {
      if (types.has(t.type)) errors.push('Duplicate AI trigger type: ' + t.type);
      types.add(t.type);
    }
    return { valid: errors.length === 0, errors };
  }

  /** Full template validation: weights + 四铁律 + AI triggers */
  validateTemplate(template: StrategyTemplate): { valid: boolean; errors: string[] } {
    const allErrors: string[] = [];
    const weightResult = this.validateWeights(template.factorCombo);
    const ironResult = this.validateFourIronRules(template.ironRules);
    const triggerResult = this.validateAITriggers(template.aiTriggers);
    allErrors.push(...weightResult.errors, ...ironResult.errors, ...triggerResult.errors);
    return { valid: allErrors.length === 0, errors: allErrors };
  }

  /** Build factor combo with automatic normalization */
  buildFactorCombo(factorIds: string[], rawWeights: number[], formula: string): FactorCombo {
    const total = rawWeights.reduce((s, w) => s + w, 0);
    const weights = total > 0 ? rawWeights.map(w => w / total) : rawWeights.map(() => 1 / rawWeights.length);
    return { factorIds, weights, formula };
  }

  /** Build standard AI trigger points for a template */
  buildStandardTriggers(targetParams?: string[]): AITriggerPoint[] {
    const types: AITriggerType[] = ['BACKTEST_READ', 'PARAM_FILL', 'OPTIMIZE', 'FACTOR_DIAGNOSE'];
    return types.map(t => ({ ...AI_TRIGGERS[t], targetParams }));
  }

  /** Rank templates by composite score (popularity * 0.3 + winRate * 0.4 + sharpe * 0.3) */
  rankTemplates(templates: StrategyTemplate[], limit?: number): StrategyTemplate[] {
    const scored = [...templates].sort((a, b) => {
      const scoreA = (a.popularityScore || 0) * 0.3 + (a.winRate || 0) * 40 + (a.sharpe || 0) * 30;
      const scoreB = (b.popularityScore || 0) * 0.3 + (b.winRate || 0) * 40 + (b.sharpe || 0) * 30;
      return scoreB - scoreA;
    });
    return limit ? scored.slice(0, limit) : scored;
  }

  /** Get all distinct market tags used by a template set */
  getMarketTags(templates: StrategyTemplate[]): MarketTag[] {
    const tags = new Set<MarketTag>();
    for (const t of templates) for (const m of t.marketTags) tags.add(m);
    return [...tags];
  }

  /** Get all distinct AI trigger types used (for billing integration) */
  getAITriggerTypes(templates: StrategyTemplate[]): AITriggerType[] {
    const types = new Set<AITriggerType>();
    for (const t of templates) for (const tr of t.aiTriggers) types.add(tr.type);
    return [...types];
  }

  /** Calculate total AI cost for a template (sum of all trigger prices) */
  calculateTotalAICost(template: StrategyTemplate): number {
    return Math.round(template.aiTriggers.reduce((s, t) => s + t.priceUSDT, 0) * 100) / 100;
  }

  /** Check if template has signal push trigger */
  hasSignalPush(template: StrategyTemplate): boolean {
    return template.aiTriggers.some(t =>
      t.nameCN.includes('信号推送') || t.nameEN.toLowerCase().includes('signal push'));
  }

  /** Check if template has alt data trigger */
  hasAltDataUnlock(template: StrategyTemplate): boolean {
    return template.aiTriggers.some(t =>
      t.type === 'ALT_DATA' && t.nameCN.includes('替代数据'));
  }

  /** Summary stats */
  getSummary(templates: StrategyTemplate[]): {
    totalTemplates: number; totalFactors: number; totalMarkets: number;
    avgAITriggers: number; allIronRulesValid: number;
    totalAICost: number; signalPushCoverage: number; altDataCoverage: number;
  } {
    const factorIds = new Set<string>();
    const markets = this.getMarketTags(templates);
    let totalTriggers = 0;
    let validRules = 0;
    let totalCost = 0;
    let signalCount = 0;
    let altCount = 0;
    for (const t of templates) {
      for (const f of t.factorCombo.factorIds) factorIds.add(f);
      totalTriggers += t.aiTriggers.length;
      totalCost += this.calculateTotalAICost(t);
      if (this.validateFourIronRules(t.ironRules).valid) validRules++;
      if (this.hasSignalPush(t)) signalCount++;
      if (this.hasAltDataUnlock(t)) altCount++;
    }
    return {
      totalTemplates: templates.length, totalFactors: factorIds.size, totalMarkets: markets.length,
      avgAITriggers: templates.length > 0 ? Math.round((totalTriggers / templates.length) * 10) / 10 : 0,
      allIronRulesValid: validRules,
      totalAICost: Math.round(totalCost * 100) / 100,
      signalPushCoverage: templates.length > 0 ? Math.round((signalCount / templates.length) * 100) : 0,
      altDataCoverage: templates.length > 0 ? Math.round((altCount / templates.length) * 100) : 0,
    };
  }
}

/** Singleton */
export const templateEngine = new TemplateEngine();
