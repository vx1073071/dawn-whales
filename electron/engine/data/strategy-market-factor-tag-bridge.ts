/**
 * R279 auto#2: 策略市场因子标签 (StrategyMarketFactorTagBridge) v1.0
 * 
 * QUANT MOO — 策略市场 × 因子体系标签桥接，打通策略→因子双向链接
 * 
 * 核心能力:
 *   1. 策略因子标签: 为市场中每支策略自动/手动关联因子
 *   2. 因子→策略反向: 从因子反向查找含此因子的策略
 *   3. 标签体系: 主因子 / 辅助因子 / 市场条件 / 风险因子 / alpha来源
 *   4. 策略推荐: 基于因子暴露推荐策略 / 基于因子信号推荐策略
 *   5. 标签分析: 因子覆盖热力图 / 策略因子使用统计 / 因子流行度排名
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type FactorTagType =
  | 'primary'       // 核心alpha来源
  | 'secondary'     // 辅助因子
  | 'risk'          // 风险控制因子
  | 'condition'     // 市场条件因子
  | 'exclusion';    // 排除因子

export type StrategyCategory =
  | 'value' | 'growth' | 'momentum' | 'quality' | 'low_vol'
  | 'dividend' | 'small_cap' | 'multi_factor' | 'sector_rotation'
  | 'market_timing' | 'macro' | 'event_driven' | 'arbitrage'
  | 'technical' | 'quantitative' | 'custom';

export type StrategyRiskLevel = 'low' | 'medium' | 'high' | 'very_high';

export interface StrategyFactorTag {
  strategyId: string;
  factorId: string;
  factorName: string;
  factorNameCn: string;
  tagType: FactorTagType;
  weight: number;              // 0-1 within strategy
  direction: 'long' | 'short' | 'neutral';
  addedBy: 'auto' | 'manual';
  confidence: number;          // 0-1 (auto-tag only)
  timestamp: number;
}

export interface StrategyMeta {
  strategyId: string;
  name: string;
  nameCn: string;
  author: string;
  category: StrategyCategory;
  riskLevel: StrategyRiskLevel;
  description: string;
  descriptionCn: string;
  tags: StrategyFactorTag[];
  performance: {
    annualReturn: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
  factorExposures: Record<string, number>;
  createdAt: number;
  updatedAt: number;
  version: string;
  price: number;               // USDT
  rating: number;              // 1-5
  downloads: number;
}

export interface StrategyRecommendation {
  strategyId: string;
  strategyName: string;
  strategyNameCn: string;
  reason: string;
  reasonCn: string;
  relevance: number;           // 0-1
  matchedFactors: string[];
  signals: Array<{ factorId: string; signal: string; direction: 'bullish' | 'bearish' }>;
}

export interface FactorUsageStats {
  factorId: string;
  factorName: string;
  factorNameCn: string;
  usageCount: number;          // how many strategies use it
  primaryCount: number;
  secondaryCount: number;
  riskCount: number;
  conditionCount: number;
  popularityScore: number;
  avgWeight: number;
  avgConfidence: number;
}

export interface TagAnalysis {
  totalStrategies: number;
  totalFactors: number;
  totalTags: number;
  categoriesCovered: StrategyCategory[];
  topFactors: FactorUsageStats[];
  tagTypeDistribution: Record<FactorTagType, number>;
  categoryFactorMap: Record<string, string[]>;  // category -> factorIds
}

// ── StrategyMarketFactorTagBridge ──────────────────────────────────────────

export class StrategyMarketFactorTagBridge {
  private strategies: Map<string, StrategyMeta> = new Map();
  private factorIndex: Map<string, Set<string>> = new Map();  // factorId -> Set<strategyId>
  private autoTagRules: Array<{
    condition: (strategy: StrategyMeta) => boolean;
    factorId: string;
    factorName: string;
    factorNameCn: string;
    tagType: FactorTagType;
    weight: number;
    direction: 'long' | 'short' | 'neutral';
  }> = [];

  constructor() {
    this._initAutoTagRules();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Strategy Management
  // ═══════════════════════════════════════════════════════════════════════

  registerStrategy(strategy: StrategyMeta): void {
    this.strategies.set(strategy.strategyId, strategy);
    // Index existing tags
    for (const tag of strategy.tags) {
      this._indexTag(tag.factorId, strategy.strategyId);
    }
    // Auto-tag
    this._autoTag(strategy);
  }

  registerStrategies(strategies: StrategyMeta[]): void {
    for (const s of strategies) this.registerStrategy(s);
  }

  getStrategy(id: string): StrategyMeta | null {
    return this.strategies.get(id) ?? null;
  }

  getAllStrategies(): StrategyMeta[] {
    return Array.from(this.strategies.values());
  }

  getStrategiesByCategory(category: StrategyCategory): StrategyMeta[] {
    return Array.from(this.strategies.values()).filter(s => s.category === category);
  }

  removeStrategy(id: string): void {
    const s = this.strategies.get(id);
    if (s) {
      for (const tag of s.tags) {
        this._unindexTag(tag.factorId, s.strategyId);
      }
      this.strategies.delete(id);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Factor Tagging
  // ═══════════════════════════════════════════════════════════════════════

  addTag(
    strategyId: string,
    factorId: string, factorName: string, factorNameCn: string,
    tagType: FactorTagType = 'secondary',
    weight = 0.5, direction: 'long' | 'short' | 'neutral' = 'long',
    confidence = 1.0,
  ): StrategyFactorTag | null {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return null;

    // Prevent duplicate
    const existing = strategy.tags.find(t => t.factorId === factorId);
    if (existing) {
      existing.weight = weight;
      existing.direction = direction;
      existing.confidence = confidence;
      existing.timestamp = Date.now();
      return existing;
    }

    const tag: StrategyFactorTag = {
      strategyId, factorId, factorName, factorNameCn,
      tagType, weight, direction,
      addedBy: 'manual', confidence, timestamp: Date.now(),
    };

    strategy.tags.push(tag);
    strategy.updatedAt = Date.now();
    this._indexTag(factorId, strategyId);

    return tag;
  }

  removeTag(strategyId: string, factorId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;

    const idx = strategy.tags.findIndex(t => t.factorId === factorId);
    if (idx < 0) return false;

    strategy.tags.splice(idx, 1);
    strategy.updatedAt = Date.now();
    this._unindexTag(factorId, strategyId);
    return true;
  }

  getTags(strategyId: string): StrategyFactorTag[] {
    const strategy = this.strategies.get(strategyId);
    return strategy ? [...strategy.tags] : [];
  }

  getTagsByType(strategyId: string, tagType: FactorTagType): StrategyFactorTag[] {
    return this.getTags(strategyId).filter(t => t.tagType === tagType);
  }

  getPrimaryFactors(strategyId: string): StrategyFactorTag[] {
    return this.getTagsByType(strategyId, 'primary');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Factor → Strategy (Reverse Lookup)
  // ═══════════════════════════════════════════════════════════════════════

  getStrategiesByFactor(factorId: string): string[] {
    const set = this.factorIndex.get(factorId);
    return set ? Array.from(set) : [];
  }

  /** Get strategies sorted by factor relevance */
  getStrategiesByFactorRanked(factorId: string): Array<{ strategyId: string; weight: number; tagType: FactorTagType }> {
    const ids = this.getStrategiesByFactor(factorId);
    const ranked: Array<{ strategyId: string; weight: number; tagType: FactorTagType }> = [];

    for (const sid of ids) {
      const s = this.strategies.get(sid);
      if (!s) continue;
      const tag = s.tags.find(t => t.factorId === factorId);
      if (tag) ranked.push({ strategyId: sid, weight: tag.weight, tagType: tag.tagType });
    }

    return ranked.sort((a, b) => b.weight - a.weight);
  }

  /** Multi-factor intersection: strategies containing ALL specified factors */
  getStrategiesByFactors(factorIds: string[]): string[] {
    if (factorIds.length === 0) return [];
    const sets = factorIds.map(fid => this.factorIndex.get(fid));
    if (sets.some(s => !s || s.size === 0)) return [];

    let intersection = new Set(sets[0]!);
    for (let i = 1; i < sets.length; i++) {
      intersection = new Set([...intersection].filter(x => sets[i]!.has(x)));
    }
    return Array.from(intersection);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Strategy Recommendations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Recommend strategies based on factor exposures
   */
  recommendByExposure(
    desiredFactors: Record<string, { direction: 'long' | 'short'; weight: number }>,
    limit = 10,
  ): StrategyRecommendation[] {
    const results: StrategyRecommendation[] = [];

    for (const strategy of this.strategies.values()) {
      const matched: string[] = [];
      const signals: StrategyRecommendation['signals'] = [];
      let relevance = 0;
      let totalWeight = 0;

      for (const [fid, desired] of Object.entries(desiredFactors)) {
        const tag = strategy.tags.find(t => t.factorId === fid);
        const exp = strategy.factorExposures[fid];
        const hasFactor = !!tag || !!exp;
        
        if (!hasFactor) {
          relevance -= desired.weight * 0.2; // penalty
          continue;
        }

        const dirMatch = tag 
          ? (tag.direction === desired.direction ? 1 : 0.3)
          : (exp! > 0 && desired.direction === 'long' ? 1 : exp! < 0 && desired.direction === 'short' ? 1 : 0.3);

        relevance += desired.weight * dirMatch * (tag?.confidence ?? 0.5);
        totalWeight += desired.weight;
        matched.push(fid);

        signals.push({
          factorId: fid,
          signal: tag ? `${tag.direction}_${tag.tagType}` : 'exposure',
          direction: desired.direction,
        });
      }

      if (matched.length > 0) {
        relevance = totalWeight > 0 ? relevance / totalWeight : relevance;
        results.push({
          strategyId: strategy.strategyId,
          strategyName: strategy.name,
          strategyNameCn: strategy.nameCn,
          reason: `Matched ${matched.length}/${Object.keys(desiredFactors).length} factors with relevance ${relevance.toFixed(2)}`,
          reasonCn: `匹配 ${matched.length}/${Object.keys(desiredFactors).length} 个因子，相关度 ${relevance.toFixed(2)}`,
          relevance: Math.round(relevance * 100) / 100,
          matchedFactors: matched,
          signals,
        });
      }
    }

    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Recommend strategies based on current factor signals
   */
  recommendBySignals(
    activeSignals: Array<{ factorId: string; direction: 'bullish' | 'bearish'; strength: number }>,
    limit = 10,
  ): StrategyRecommendation[] {
    const results: StrategyRecommendation[] = [];

    for (const strategy of this.strategies.values()) {
      const matched: string[] = [];
      let relevance = 0;

      for (const signal of activeSignals) {
        const tag = strategy.tags.find(t => t.factorId === signal.factorId);
        if (!tag) continue;

        // Bullish signal → long factor = positive, short factor = negative
        // Bearish signal → long factor = negative, short factor = positive
        const signalScore =
          signal.direction === 'bullish'
            ? (tag.direction === 'long' ? 1 : tag.direction === 'short' ? -0.5 : 0.3)
            : (tag.direction === 'short' ? 1 : tag.direction === 'long' ? -0.5 : -0.3);

        relevance += signalScore * signal.strength * tag.weight;
        matched.push(signal.factorId);
      }

      if (matched.length > 0 && relevance > 0) {
        relevance = Math.min(relevance, 1);
        results.push({
          strategyId: strategy.strategyId,
          strategyName: strategy.name,
          strategyNameCn: strategy.nameCn,
          reason: `${matched.length} factors signaled favorably, composite score=${relevance.toFixed(2)}`,
          reasonCn: `${matched.length}个因子发出有利信号，综合评分=${relevance.toFixed(2)}`,
          relevance: Math.round(relevance * 100) / 100,
          matchedFactors: matched,
          signals: matched.map(fid => {
            const sig = activeSignals.find(s => s.factorId === fid)!;
            return { factorId: fid, signal: sig.direction, direction: sig.direction };
          }),
        });
      }
    }

    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Analytics
  // ═══════════════════════════════════════════════════════════════════════

  computeFactorUsage(): FactorUsageStats[] {
    const usageMap: Map<string, {
      total: number; primary: number; secondary: number; risk: number; condition: number;
      sumWeight: number; sumConfidence: number;
    }> = new Map();

    for (const strategy of this.strategies.values()) {
      for (const tag of strategy.tags) {
        const entry = usageMap.get(tag.factorId) ?? { total: 0, primary: 0, secondary: 0, risk: 0, condition: 0, sumWeight: 0, sumConfidence: 0 };
        entry.total++;
        if (tag.tagType === 'primary') entry.primary++;
        else if (tag.tagType === 'secondary') entry.secondary++;
        else if (tag.tagType === 'risk') entry.risk++;
        else if (tag.tagType === 'condition') entry.condition++;
        entry.sumWeight += tag.weight;
        entry.sumConfidence += tag.confidence;
        usageMap.set(tag.factorId, entry);
      }
    }

    const stats: FactorUsageStats[] = [];
    for (const [fid, entry] of usageMap) {
      // Find factor name from any tag
      let fname = fid, fnameCn = fid;
      for (const s of this.strategies.values()) {
        const t = s.tags.find(x => x.factorId === fid);
        if (t) { fname = t.factorName; fnameCn = t.factorNameCn; break; }
      }

      stats.push({
        factorId: fid, factorName: fname, factorNameCn: fnameCn,
        usageCount: entry.total, primaryCount: entry.primary,
        secondaryCount: entry.secondary, riskCount: entry.risk,
        conditionCount: entry.condition,
        popularityScore: entry.primary * 3 + entry.secondary * 1 + entry.risk * 2 + entry.condition * 1,
        avgWeight: Math.round(entry.sumWeight / entry.total * 100) / 100,
        avgConfidence: Math.round(entry.sumConfidence / entry.total * 100) / 100,
      });
    }

    return stats.sort((a, b) => b.popularityScore - a.popularityScore);
  }

  computeAnalysis(): TagAnalysis {
    const categories = new Set<StrategyCategory>();
    const categoryFactorMap: Record<string, string[]> = {};
    const tagTypeDist: Record<string, number> = { primary: 0, secondary: 0, risk: 0, condition: 0, exclusion: 0 };
    let totalTags = 0;
    const factorSet = new Set<string>();

    for (const strategy of this.strategies.values()) {
      categories.add(strategy.category);
      if (!categoryFactorMap[strategy.category]) categoryFactorMap[strategy.category] = [];

      for (const tag of strategy.tags) {
        totalTags++;
        tagTypeDist[tag.tagType] = (tagTypeDist[tag.tagType] ?? 0) + 1;
        factorSet.add(tag.factorId);
        if (!categoryFactorMap[strategy.category].includes(tag.factorId)) {
          categoryFactorMap[strategy.category].push(tag.factorId);
        }
      }
    }

    const factorUsage = this.computeFactorUsage();

    return {
      totalStrategies: this.strategies.size,
      totalFactors: factorSet.size,
      totalTags,
      categoriesCovered: Array.from(categories),
      topFactors: factorUsage.slice(0, 20),
      tagTypeDistribution: tagTypeDist as Record<FactorTagType, number>,
      categoryFactorMap,
    };
  }

  /** Get factor coverage heatmap data */
  getCoverageHeatmap(): Array<{ category: string; factorId: string; strategyCount: number; avgWeight: number }> {
    const rows: Array<{ category: string; factorId: string; strategyCount: number; avgWeight: number }> = [];
    const analysis = this.computeAnalysis();

    for (const [category, factorIds] of Object.entries(analysis.categoryFactorMap)) {
      for (const fid of factorIds) {
        const strategies = this.getStrategiesByFactor(fid);
        const stratMetas = strategies.map(sid => this.strategies.get(sid)).filter(Boolean) as StrategyMeta[];
        const avgW = stratMetas.reduce((s, sm) => {
          const t = sm.tags.find(x => x.factorId === fid);
          return s + (t?.weight ?? 0);
        }, 0) / stratMetas.length;

        rows.push({
          category,
          factorId: fid,
          strategyCount: strategies.length,
          avgWeight: Math.round(avgW * 100) / 100,
        });
      }
    }

    return rows.sort((a, b) => b.strategyCount - a.strategyCount);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Search & Filter
  // ═══════════════════════════════════════════════════════════════════════

  searchStrategies(query: string): StrategyMeta[] {
    const q = query.toLowerCase();
    return Array.from(this.strategies.values()).filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.nameCn.includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.factorName.toLowerCase().includes(q) || t.factorNameCn.includes(q))
    );
  }

  filterByRisk(risk: StrategyRiskLevel): StrategyMeta[] {
    return Array.from(this.strategies.values()).filter(s => s.riskLevel === risk);
  }

  filterByPrice(minPrice = 0, maxPrice = Infinity): StrategyMeta[] {
    return Array.from(this.strategies.values()).filter(s => s.price >= minPrice && s.price <= maxPrice);
  }

  getTopRated(limit = 10): StrategyMeta[] {
    return Array.from(this.strategies.values())
      .sort((a, b) => b.rating - a.rating || b.downloads - a.downloads)
      .slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Stats / Reset
  // ═══════════════════════════════════════════════════════════════════════

  getStats(): { strategyCount: number; tagCount: number; factorIndexSize: number; categoryCount: number } {
    let tagCount = 0;
    const cats = new Set<StrategyCategory>();
    for (const s of this.strategies.values()) {
      tagCount += s.tags.length;
      cats.add(s.category);
    }
    return {
      strategyCount: this.strategies.size,
      tagCount,
      factorIndexSize: this.factorIndex.size,
      categoryCount: cats.size,
    };
  }

  reset(): void {
    this.strategies.clear();
    this.factorIndex.clear();
    this._initAutoTagRules();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private
  // ═══════════════════════════════════════════════════════════════════════

  private _initAutoTagRules(): void {
    this.autoTagRules = [
      {
        condition: (s) => s.category === 'value',
        factorId: 'BEME', factorName: 'Book-to-Market', factorNameCn: '账面市值比',
        tagType: 'primary', weight: 0.9, direction: 'long',
      },
      {
        condition: (s) => s.category === 'momentum',
        factorId: 'MOM12M', factorName: '12-Month Momentum', factorNameCn: '12月动量',
        tagType: 'primary', weight: 0.9, direction: 'long',
      },
      {
        condition: (s) => s.category === 'quality',
        factorId: 'ROE', factorName: 'Return on Equity', factorNameCn: '净资产收益率',
        tagType: 'primary', weight: 0.85, direction: 'long',
      },
      {
        condition: (s) => s.category === 'low_vol',
        factorId: 'LOWVOL', factorName: 'Low Volatility', factorNameCn: '低波动',
        tagType: 'primary', weight: 0.9, direction: 'long',
      },
      {
        condition: (s) => s.category === 'dividend',
        factorId: 'DIVIDEND', factorName: 'Dividend Yield', factorNameCn: '股息率',
        tagType: 'primary', weight: 0.9, direction: 'long',
      },
      {
        condition: (s) => s.category === 'small_cap',
        factorId: 'SIZE', factorName: 'Size (Small Cap)', factorNameCn: '规模(小盘)',
        tagType: 'primary', weight: 0.9, direction: 'long',
      },
      {
        condition: (s) => s.category === 'sector_rotation',
        factorId: 'SECTOR_FLOW', factorName: 'Sector Flow', factorNameCn: '板块资金流',
        tagType: 'primary', weight: 0.8, direction: 'neutral',
      },
      {
        condition: (s) => s.category === 'macro',
        factorId: 'PMI', factorName: 'PMI Sensitivity', factorNameCn: 'PMI敏感性',
        tagType: 'primary', weight: 0.85, direction: 'neutral',
      },
      {
        condition: (s) => s.riskLevel === 'high' || s.riskLevel === 'very_high',
        factorId: 'VOL_20D', factorName: '20D Volatility', factorNameCn: '20日波动率',
        tagType: 'risk', weight: 0.6, direction: 'neutral',
      },
      {
        condition: (s) => s.category === 'multi_factor',
        factorId: 'QFACTOR', factorName: 'Quality Composite', factorNameCn: '质量综合',
        tagType: 'secondary', weight: 0.6, direction: 'long',
      },
    ];
  }

  private _autoTag(strategy: StrategyMeta): void {
    for (const rule of this.autoTagRules) {
      if (rule.condition(strategy)) {
        // Check not already tagged
        if (strategy.tags.some(t => t.factorId === rule.factorId)) continue;

        const tag: StrategyFactorTag = {
          strategyId: strategy.strategyId,
          factorId: rule.factorId,
          factorName: rule.factorName,
          factorNameCn: rule.factorNameCn,
          tagType: rule.tagType,
          weight: rule.weight,
          direction: rule.direction,
          addedBy: 'auto',
          confidence: rule.tagType === 'primary' ? 0.9 : 0.6,
          timestamp: Date.now(),
        };

        strategy.tags.push(tag);
        strategy.updatedAt = Date.now();
        this._indexTag(rule.factorId, strategy.strategyId);
      }
    }
  }

  private _indexTag(factorId: string, strategyId: string): void {
    if (!this.factorIndex.has(factorId)) {
      this.factorIndex.set(factorId, new Set());
    }
    this.factorIndex.get(factorId)!.add(strategyId);
  }

  private _unindexTag(factorId: string, strategyId: string): void {
    const set = this.factorIndex.get(factorId);
    if (set) {
      set.delete(strategyId);
      if (set.size === 0) this.factorIndex.delete(factorId);
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _tagBridge: StrategyMarketFactorTagBridge | null = null;

export function getTagBridge(): StrategyMarketFactorTagBridge {
  if (!_tagBridge) _tagBridge = new StrategyMarketFactorTagBridge();
  return _tagBridge;
}

export function resetTagBridge(): void {
  if (_tagBridge) _tagBridge.reset();
  _tagBridge = null;
}
