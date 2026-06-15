/**
 * StrategyRecommender.ts — R227 JVS-2.1a: 市场×风格→3推荐引擎
 *
 * Pure-logic recommendation engine. No AI/DeepSeek dependency.
 *
 * Input:  { market: MarketCode, style: StyleCode, sector?: string }
 * Output: Top-3 strategy template IDs ranked by composite score:
 *   - Market match (30%)  — template applicable markets include input market
 *   - Style match (30%)   — template riskLevel matches input style
 *   - Factor fit (25%)    — template factorCombo aligns with market
 *   - Popularity (15%)    — usage count proxy from tags complexity
 *
 * ≥300 lines.
 */

import type { FactorStrategyTemplate } from './factor-strategy-templates-types';

// ─── Types ────────────────────────────────────────────────────────────

export type MarketCode = 'US' | 'HK' | 'CRYPTO' | 'JP' | 'TW' | 'KR' | 'SG' | 'AU' | 'EU' | 'IN';

export type StyleCode = 'aggressive' | 'moderate' | 'conservative';

export interface RecommendationInput {
  market: MarketCode;
  style: StyleCode;
  sector?: string;
  maxRiskPercent?: number;
  preferredTimeHorizon?: 'intraday' | 'swing' | 'trend' | 'position';
}

export interface RecommendationResult {
  templateId: string;
  templateName: string;
  templateNameCn: string;
  score: number;
  marketScore: number;
  styleScore: number;
  factorScore: number;
  popularityScore: number;
  reasons: string[];
  riskLevel: string;
  expectedHoldingDays: string;
  category: string;
}

export interface StrategyRecommenderConfig {
  marketWeight: number;
  styleWeight: number;
  factorWeight: number;
  popularityWeight: number;
  maxResults: number;
}

// ─── Default Config ───────────────────────────────────────────────────

const DEFAULT_CONFIG: StrategyRecommenderConfig = {
  marketWeight: 0.30,
  styleWeight: 0.30,
  factorWeight: 0.25,
  popularityWeight: 0.15,
  maxResults: 3,
};

// ─── Market → Category Mapping ────────────────────────────────────────

const MARKET_CATEGORY_MAP: Record<MarketCode, string[]> = {
  US: ['us', 'equity', 'options', 'earnings', 'momentum', 'value'],
  HK: ['hk', 'equity', 'arbitrage', 'southbound', 'warrant', 'dividend'],
  CRYPTO: ['crypto', 'defi', 'onchain', 'staking', 'momentum', 'volatility'],
  JP: ['jp', 'equity', 'value', 'dividend', 'momentum', 'currency'],
  TW: ['tw', 'technology', 'supply-chain', 'dividend', 'value'],
  KR: ['kr', 'technology', 'manufacturing', 'export', 'value'],
  SG: ['sg', 'reit', 'dividend', 'infrastructure', 'value'],
  AU: ['au', 'commodity', 'resource', 'dividend', 'mining'],
  EU: ['eu', 'dividend', 'value', 'esg', 'cyclical'],
  IN: ['in', 'growth', 'technology', 'consumption', 'infrastructure'],
};

// ─── Style → Risk Mapping ─────────────────────────────────────────────

const STYLE_RISK_MAP: Record<StyleCode, string[]> = {
  aggressive: ['aggressive', 'high'],
  moderate: ['balanced', 'moderate', 'medium'],
  conservative: ['conservative', 'low'],
};

// ─── Style → Time Preference ──────────────────────────────────────────

const STYLE_TIME_MAP: Record<StyleCode, string[]> = {
  aggressive: ['intraday', 'swing'],
  moderate: ['swing', 'trend'],
  conservative: ['trend', 'position'],
};

// ─── Scoring Functions ────────────────────────────────────────────────

function scoreMarketMatch(
  template: FactorStrategyTemplate,
  market: MarketCode
): { score: number; reason: string } {
  const marketCategories = MARKET_CATEGORY_MAP[market] || [];
  const templateTags = (template.tags || []).map((t) => t.toLowerCase());
  const templateCategory = (template.category || '').toLowerCase();
  
  // Direct category match
  let matches = 0;
  for (const mc of marketCategories) {
    if (templateCategory.includes(mc) || templateTags.includes(mc)) {
      matches++;
    }
  }
  
  // Check marketScope in ironRules
  const marketScope = template.fourIronRules?.marketScope || [];
  for (const ms of marketScope) {
    const scopeMarket = ms.market?.toLowerCase() || '';
    if (scopeMarket.includes(market.toLowerCase())) {
      matches += 2; // Direct market scope match is strong signal
    }
  }
  
  // Normalize score to 0-1
  const normalized = Math.min(matches / Math.max(marketCategories.length, 1), 1);
  
  let reason = '';
  if (normalized >= 0.8) reason = `强匹配${market}市场`;
  else if (normalized >= 0.5) reason = `部分匹配${market}市场`;
  else if (normalized > 0) reason = `弱匹配${market}市场`;
  else reason = `不匹配${market}市场`;
  
  return { score: normalized, reason };
}

function scoreStyleMatch(
  template: FactorStrategyTemplate,
  style: StyleCode
): { score: number; reason: string } {
  const acceptableRisks = STYLE_RISK_MAP[style] || [];
  const acceptableTimes = STYLE_TIME_MAP[style] || [];
  
  // Check risk level alignment
  let riskScore = 0;
  const tRisk = (template as Record<string, unknown>).riskLevel as string || '';
  if (acceptableRisks.some((r) => (tRisk || '').toLowerCase() === r)) {
    riskScore = 1.0;
  } else if ((tRisk || '').toLowerCase() === 'balanced') {
    // Balanced templates work for any style with penalty
    riskScore = 0.6;
  }
  
  // Check time horizon
  let timeScore = 0;
  const tTime = (template.timeHorizon || '').toString().toLowerCase();
  if (acceptableTimes.some((t) => tTime.includes(t))) {
    timeScore = 0.8;
  } else if (tTime.includes('trend')) {
    timeScore = 0.4; // Trend works for most styles at lower score
  }
  
  const finalScore = (riskScore * 0.6 + timeScore * 0.4);
  
  let reason = '';
  if (finalScore >= 0.8) reason = `风险/周期完美匹配${style}风格`;
  else if (finalScore >= 0.5) reason = `风险/周期适合${style}风格`;
  else reason = `风险/周期与${style}风格有偏差`;
  
  return { score: finalScore, reason };
}

function scoreFactorFit(
  template: FactorStrategyTemplate
): { score: number; reason: string } {
  const combos = template.factorCombo || [];
  if (combos.length === 0) return { score: 0, reason: '无因子组合' };
  
  // Score based on factor combo quality
  let score = 0;
  
  // Complete combos (5+ factors) score higher
  if (combos.length >= 5) score += 0.4;
  else if (combos.length >= 3) score += 0.3;
  else score += 0.1;
  
  // Weight balancing: weights should sum near 100
  const totalWeight = combos.reduce((s, c) => s + (c.weight || 0), 0);
  if (Math.abs(totalWeight - 100) < 5) score += 0.3;
  else if (Math.abs(totalWeight - 100) < 20) score += 0.15;
  
  // Diversity: should have both long and short positions
  const hasLong = combos.some((c) => c.direction === 'long');
  const hasShort = combos.some((c) => c.direction === 'short' || c.direction === 'hedge');
  if (hasLong && hasShort) score += 0.2;
  else if (hasLong) score += 0.1;
  
  // Named factors (not generic IDs) score better
  const namedCount = combos.filter((c) => c.factorName && c.factorName.length > 5).length;
  if (namedCount >= 4) score += 0.1;
  
  const reason = combos.length >= 4 
    ? `多因子组合(${combos.length}因子, 权重${totalWeight}%)`
    : `基础因子组合(${combos.length}因子)`;
  
  return { score: Math.min(score, 1), reason };
}

function scorePopularity(template: FactorStrategyTemplate): { score: number; reason: string } {
  // Proxy for popularity: more detailed template = more popular
  let score = 0;
  
  const tags = template.tags || [];
  if (tags.length >= 5) score += 0.3;
  else if (tags.length >= 3) score += 0.2;
  
  const triggers = template.aiTriggerPoints || [];
  if (triggers.length >= 4) score += 0.3;
  else if (triggers.length >= 2) score += 0.2;
  
  // Difficulty bonus: medium difficulty = most popular
  const diff = template.difficulty || 3;
  if (diff === 3) score += 0.2;
  else if (diff === 2) score += 0.1;
  
  const holdingDays = template.holdingDays;
  if (holdingDays && holdingDays.min && holdingDays.max) {
    const range = holdingDays.max - holdingDays.min;
    if (range > 10) score += 0.2;
  }
  
  return { score: Math.min(score, 1), reason: `标签${tags.length}个+触发点${triggers.length}个` };
}

// ─── Main Engine ──────────────────────────────────────────────────────

export class StrategyRecommender {
  private templates: FactorStrategyTemplate[];
  private config: StrategyRecommenderConfig;

  constructor(
    templates: FactorStrategyTemplate[],
    config?: Partial<StrategyRecommenderConfig>
  ) {
    this.templates = templates;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Recommend top-N strategy templates for a given market × style combination.
   */
  recommend(input: RecommendationInput): RecommendationResult[] {
    const { market, style, sector } = input;
    const results: RecommendationResult[] = [];

    for (const template of this.templates) {
      const marketResult = scoreMarketMatch(template, market);
      const styleResult = scoreStyleMatch(template, style);
      const factorResult = scoreFactorFit(template);
      const popResult = scorePopularity(template);

      const compositeScore =
        marketResult.score * this.config.marketWeight +
        styleResult.score * this.config.styleWeight +
        factorResult.score * this.config.factorWeight +
        popResult.score * this.config.popularityWeight;

      // Apply sector filter if specified
      if (sector) {
        const tags = (template.tags || []).map((t) => t.toLowerCase());
        if (!tags.includes(sector.toLowerCase())) {
          continue; // Skip non-matching sector
        }
      }

      // Apply max risk filter
      if (input.maxRiskPercent !== undefined) {
        const diff = template.difficulty || 3;
        if (diff > 4 && input.maxRiskPercent < 10) continue;
      }

      // Apply time horizon preference
      if (input.preferredTimeHorizon) {
        const tTime = (template.timeHorizon || '').toString().toLowerCase();
        if (!tTime.includes(input.preferredTimeHorizon)) {
          // Allow with score penalty
          const penalty = 0.15;
          results.push({
            templateId: template.id,
            templateName: template.name || template.id,
            templateNameCn: template.nameCn || template.name || template.id,
            score: compositeScore - penalty,
            marketScore: marketResult.score,
            styleScore: styleResult.score,
            factorScore: factorResult.score,
            popularityScore: popResult.score,
            reasons: [
              marketResult.reason,
              styleResult.reason,
              factorResult.reason,
              `时间周期不完全匹配(偏${input.preferredTimeHorizon})`,
            ],
            riskLevel: ((template as Record<string, unknown>).riskLevel as string) || 'balanced',
            expectedHoldingDays: template.expectedHoldingDays || `${template.holdingDays?.min || 1}-${template.holdingDays?.max || 30}天`,
            category: template.category || 'general',
          });
          continue;
        }
      }

      results.push({
        templateId: template.id,
        templateName: template.name || template.id,
        templateNameCn: template.nameCn || template.name || template.id,
        score: compositeScore,
        marketScore: marketResult.score,
        styleScore: styleResult.score,
        factorScore: factorResult.score,
        popularityScore: popResult.score,
        reasons: [marketResult.reason, styleResult.reason, factorResult.reason],
        riskLevel: ((template as Record<string, unknown>).riskLevel as string) || 'balanced',
        expectedHoldingDays: template.expectedHoldingDays || `${template.holdingDays?.min || 1}-${template.holdingDays?.max || 30}天`,
        category: template.category || 'general',
      });
    }

    // Sort by composite score descending, take top N
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, this.config.maxResults);
  }

  /**
   * Recommend by factor profile (for integration with factor analysis).
   */
  recommendByFactors(
    input: RecommendationInput,
    dominantFactorIds: string[]
  ): RecommendationResult[] {
    const baseResults = this.recommend(input);
    
    // Boost templates that use the dominant factors
    for (const result of baseResults) {
      const template = this.templates.find((t) => t.id === result.templateId);
      if (!template) continue;
      
      const comboIds = (template.factorCombo || []).map(
        (c) => c.factorId
      );
      const overlap = dominantFactorIds.filter((fid) => {
        const fidLower = fid.toLowerCase().replace('factor_', '');
        return comboIds.some((c) => c.toLowerCase().replace('factor_', '') === fidLower);
      }).length;
      
      if (overlap > 0) {
        result.score += overlap * 0.05;
        result.reasons.push(`共享${overlap}个核心因子`);
      }
    }
    
    baseResults.sort((a, b) => b.score - a.score);
    return baseResults.slice(0, this.config.maxResults);
  }

  /**
   * Get detailed explanation for a recommendation.
   */
  explain(result: RecommendationResult): string {
    const parts = [
      `推荐策略: ${result.templateNameCn} (${result.templateName})`,
      `综合评分: ${(result.score * 100).toFixed(0)}/100`,
      `市场匹配: ${(result.marketScore * 100).toFixed(0)}/100`,
      `风格匹配: ${(result.styleScore * 100).toFixed(0)}/100`,
      `因子质量: ${(result.factorScore * 100).toFixed(0)}/100`,
      `人气得分: ${(result.popularityScore * 100).toFixed(0)}/100`,
      `风险等级: ${result.riskLevel}`,
      `建议持有: ${result.expectedHoldingDays}`,
    ];
    if (result.reasons.length > 0) {
      parts.push(`理由: ${result.reasons.join('；')}`);
    }
    return parts.join('\n');
  }
}
