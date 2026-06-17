/**
 * StrategyTemplateUnifier — R283 JVS-3 策略模板10→1统一 (4h)
 *
 * 功能: 将10个独立策略模板融合为1个核心模板
 * 背景: R278 FactorTemplateMarketplace 有10个离散模板 (value/growth/momentum/quality/volatility/income/GARP/blend/rotation/adaptive)
 * 目标: 统一模板引擎 → 一个模板生成所有策略变体, 消除维护成本
 *
 * 核心能力:
 * - TemplateSpec: 一个统一的模板规范描述所有策略
 * - StrategyGenerator: 从统一模板 + 参数 → 生成任意策略变体
 * - ParameterPresets: 预置参数 (值/成长/动量等经典组合)
 * - TemplateDiff: 两个预置间的差异分析
 * - TemplateComparator: 多预置对比矩阵
 * - VersionMigration: 用户旧策略 → 新统一模板自动升级
 */

export interface TemplateSpec {
  id: string;
  name: string;
  description: string;
  version: string; // "1.0.0"
  factors: Array<{
    category: 'value' | 'growth' | 'momentum' | 'quality' | 'volatility' | 'size' | 'income' | 'macro' | 'sentiment' | 'custom';
    factorIds: string[];
    weight: number;           // category weight %
    minWeight: number;
    maxWeight: number;
    selectionMethod: 'equal' | 'ranked' | 'optimized' | 'manual';
  }>;
  filters: {
    minMarketCap: number;     // USD
    maxMarketCap: number;
    minLiquidity: number;     // avg daily volume
    excludeSectors: string[];
    requireSectors: string[];
    maxStocks: number;
    rebalanceFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  };
  optimization: {
    objective: 'maxSharpe' | 'minVol' | 'maxReturn' | 'riskParity' | 'custom';
    constraints: string[];
    solver: 'quadratic' | 'genetic' | 'mip';
  };
}

export interface StrategyPreset {
  presetId: string;
  name: string;
  description: string;
  category: string;
  templateId: string;
  overrides: Partial<{
    categories: Partial<Record<string, { weight: number; factorIds: string[] }>>;
    filters: Partial<TemplateSpec['filters']>;
    optimization: Partial<TemplateSpec['optimization']>;
  }>;
  createdAt: string;
  usage: number;            // popularity metric
}

export interface StrategyInstance {
  instanceId: string;
  templateId: string;
  presetId?: string;
  name: string;
  factors: Array<{ factorId: string; category: string; weight: number }>;
  filters: TemplateSpec['filters'];
  optimization: TemplateSpec['optimization'];
  generatedAt: string;
  performance?: {
    backtestReturn: number;
    backtestSharpe: number;
    backtestMaxDD: number;
    since: string;
  };
}

export interface TemplateDiff {
  presetA: string;
  presetB: string;
  differences: Array<{
    field: string;
    a: string;
    b: string;
    significance: 'major' | 'minor' | 'cosmetic';
  }>;
  similarityScore: number;   // 0-100
}

export interface ComparisonMatrix {
  presets: string[];
  matrix: Record<string, Record<string, number>>; // similarity scores
  clusters: string[][];
}

// ============================================================
const UNIFIED_TEMPLATE: TemplateSpec = {
  id: 'unified-core-v1',
  name: 'Unified Factor Strategy Core',
  description: 'Single unified template that generates all legacy strategy variants (value/growth/momentum/quality/volatility/income/GARP/blend/rotation/adaptive)',
  version: '1.0.0',
  factors: [
    { category: 'value', factorIds: ['pe_ttm', 'pb_lf', 'ev_ebitda', 'dividend_yield'], weight: 20, minWeight: 0, maxWeight: 40, selectionMethod: 'ranked' },
    { category: 'growth', factorIds: ['revenue_yoy', 'earnings_yoy', 'momentum_6m', 'momentum_1m'], weight: 20, minWeight: 0, maxWeight: 40, selectionMethod: 'ranked' },
    { category: 'momentum', factorIds: ['momentum_6m', 'momentum_3m', 'momentum_1m'], weight: 15, minWeight: 0, maxWeight: 30, selectionMethod: 'optimized' },
    { category: 'quality', factorIds: ['roe_ttm', 'gross_margin', 'debt_equity'], weight: 20, minWeight: 0, maxWeight: 35, selectionMethod: 'ranked' },
    { category: 'volatility', factorIds: ['volatility_20d', 'beta_60d'], weight: 10, minWeight: 0, maxWeight: 20, selectionMethod: 'ranked' },
    { category: 'size', factorIds: ['market_cap'], weight: 5, minWeight: 0, maxWeight: 10, selectionMethod: 'equal' },
    { category: 'income', factorIds: ['dividend_yield'], weight: 5, minWeight: 0, maxWeight: 15, selectionMethod: 'ranked' },
    { category: 'macro', factorIds: ['fed_funds_rate', 'vix', 'yield_spread'], weight: 5, minWeight: 0, maxWeight: 10, selectionMethod: 'manual' },
  ],
  filters: {
    minMarketCap: 100_000_000,   // $100M
    maxMarketCap: 10_000_000_000_000, // $10T
    minLiquidity: 1_000_000,     // $1M/day
    excludeSectors: [],
    requireSectors: [],
    maxStocks: 200,
    rebalanceFrequency: 'monthly',
  },
  optimization: {
    objective: 'maxSharpe',
    constraints: ['maxWeight 10%', 'sectorLimit 25%', 'minStocks 30'],
    solver: 'quadratic',
  },
};

const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    presetId: 'classic-value', name: 'Classic Value', description: 'Deep value investing with low P/E, P/B, and high dividend yield', category: 'value', templateId: 'unified-core-v1',
    overrides: {
      categories: { value: { weight: 50, factorIds: ['pe_ttm', 'pb_lf', 'dividend_yield'] }, growth: { weight: 5, factorIds: [] }, momentum: { weight: 5, factorIds: [] }, quality: { weight: 15, factorIds: ['roe_ttm'] }, volatility: { weight: 10, factorIds: [] }, size: { weight: 5, factorIds: [] }, income: { weight: 10, factorIds: ['dividend_yield'] } },
    },
    createdAt: '2026-01-01', usage: 3450,
  },
  {
    presetId: 'aggressive-growth', name: 'Aggressive Growth', description: 'High-growth strategy focusing on revenue expansion and momentum', category: 'growth', templateId: 'unified-core-v1',
    overrides: {
      categories: { value: { weight: 5, factorIds: [] }, growth: { weight: 45, factorIds: ['revenue_yoy', 'earnings_yoy', 'momentum_6m'] }, momentum: { weight: 30, factorIds: ['momentum_6m', 'momentum_3m'] }, quality: { weight: 10, factorIds: [] }, volatility: { weight: 10, factorIds: ['beta_60d'] } },
    },
    createdAt: '2026-01-01', usage: 2890,
  },
  {
    presetId: 'quality-at-price', name: 'Quality at Reasonable Price', description: 'GARP: growth at reasonable valuation with quality screen', category: 'GARP', templateId: 'unified-core-v1',
    overrides: {
      categories: { value: { weight: 25, factorIds: ['pe_ttm', 'pb_lf'] }, growth: { weight: 25, factorIds: ['revenue_yoy', 'earnings_yoy'] }, quality: { weight: 30, factorIds: ['roe_ttm', 'gross_margin', 'debt_equity'] }, momentum: { weight: 10, factorIds: [] }, volatility: { weight: 5, factorIds: [] } },
    },
    createdAt: '2026-02-01', usage: 2230,
  },
  {
    presetId: 'momentum-master', name: 'Momentum Master', description: 'Pure momentum: ride the winners across timeframes', category: 'momentum', templateId: 'unified-core-v1',
    overrides: {
      categories: { momentum: { weight: 50, factorIds: ['momentum_6m', 'momentum_3m', 'momentum_1m'] }, value: { weight: 5, factorIds: [] }, growth: { weight: 15, factorIds: [] }, quality: { weight: 10, factorIds: [] }, volatility: { weight: 15, factorIds: ['volatility_20d'] } },
      filters: { rebalanceFrequency: 'weekly' },
    },
    createdAt: '2026-03-01', usage: 1980,
  },
  {
    presetId: 'low-vol-income', name: 'Low Volatility Income', description: 'Steady income with minimal price swings', category: 'income', templateId: 'unified-core-v1',
    overrides: {
      categories: { income: { weight: 35, factorIds: ['dividend_yield'] }, volatility: { weight: 30, factorIds: ['volatility_20d'] }, value: { weight: 15, factorIds: ['pe_ttm'] }, quality: { weight: 15, factorIds: ['roe_ttm', 'debt_equity'] }, momentum: { weight: 0, factorIds: [] }, growth: { weight: 0, factorIds: [] } },
      optimization: { objective: 'minVol' },
    },
    createdAt: '2026-04-01', usage: 1560,
  },
  {
    presetId: 'adaptive-rotation', name: 'Adaptive Rotation', description: 'Dynamically rotate factor weights based on market climate', category: 'rotation', templateId: 'unified-core-v1',
    overrides: {
      categories: { value: { weight: 20, factorIds: [] }, growth: { weight: 20, factorIds: [] }, momentum: { weight: 20, factorIds: [] }, quality: { weight: 20, factorIds: [] }, macro: { weight: 20, factorIds: ['fed_funds_rate', 'vix', 'yield_spread'] } },
      optimization: { objective: 'maxSharpe', solver: 'genetic' },
    },
    createdAt: '2026-05-01', usage: 1340,
  },
  {
    presetId: 'defensive-blend', name: 'Defensive Blend', description: 'All-weather strategy balancing all factor categories', category: 'blend', templateId: 'unified-core-v1',
    overrides: {
      categories: { value: { weight: 18, factorIds: [] }, growth: { weight: 15, factorIds: [] }, momentum: { weight: 10, factorIds: [] }, quality: { weight: 22, factorIds: [] }, volatility: { weight: 12, factorIds: [] }, size: { weight: 8, factorIds: [] }, income: { weight: 10, factorIds: [] }, macro: { weight: 5, factorIds: [] } },
    },
    createdAt: '2026-06-01', usage: 980,
  },
];

const LEGACY_TEMPLATE_NAMES = ['value-only', 'growth-only', 'momentum-only', 'quality-only', 'volatility-only', 'income-only', 'garp-classic', 'balanced-blend', 'sector-rotation', 'adaptive-macro'];

// ============================================================
export class StrategyTemplateUnifier {
  private template: TemplateSpec;
  private presets: StrategyPreset[];

  constructor() {
    this.template = { ...UNIFIED_TEMPLATE, factors: JSON.parse(JSON.stringify(UNIFIED_TEMPLATE.factors)) };
    this.presets = [...STRATEGY_PRESETS];
  }

  /** Get the unified template */
  getTemplate(): TemplateSpec { return this.template; }

  /** Generate a strategy instance from template + preset */
  generate(presetId: string, overrides?: Partial<StrategyInstance>): StrategyInstance | null {
    const preset = this.presets.find(p => p.presetId === presetId);
    if (!preset) return null;

    const factors: StrategyInstance['factors'] = [];
    const categoryOverrides = preset.overrides.categories || {};

    // For each category in template
    const entries = this.template.factors;
    for (let i = 0; i < entries.length; i++) {
      const cat = entries[i];
      const catOverride = categoryOverrides[cat.category];
      const weight = catOverride?.weight ?? cat.weight;
      const factorIds = catOverride?.factorIds && catOverride.factorIds.length > 0 ? catOverride.factorIds : cat.factorIds;

      if (weight > 0 && factorIds.length > 0) {
        const perWeight = +(weight / factorIds.length).toFixed(1);
        for (let j = 0; j < factorIds.length; j++) {
          factors.push({ factorId: factorIds[j], category: cat.category, weight: perWeight });
        }
      }
    }

    const filters: TemplateSpec['filters'] = {
      ...this.template.filters,
      ...(preset.overrides.filters || {}),
    };

    const optimization: TemplateSpec['optimization'] = preset.overrides.optimization
      ? { ...this.template.optimization, ...preset.overrides.optimization }
      : { ...this.template.optimization };

    return {
      instanceId: `strat_${presetId}_${Date.now()}`,
      templateId: this.template.id,
      presetId: preset.presetId,
      name: overrides?.name || preset.name,
      factors,
      filters,
      optimization,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Generate all presets */
  generateAll(): StrategyInstance[] {
    const presets = this.presets;
    const instances: StrategyInstance[] = [];
    for (let i = 0; i < presets.length; i++) {
      const instance = this.generate(presets[i].presetId);
      if (instance) instances.push(instance);
    }
    return instances;
  }

  /** Diff two presets */
  diffPresets(presetIdA: string, presetIdB: string): TemplateDiff | null {
    const presets = this.presets;
    const a = presets.find(p => p.presetId === presetIdA);
    const b = presets.find(p => p.presetId === presetIdB);
    if (!a || !b) return null;

    const differences: TemplateDiff['differences'] = [];
    const catA = a.overrides.categories || {};
    const catB = b.overrides.categories || {};

    const allCats = new Set([...Object.keys(catA), ...Object.keys(catB)]);
    const catEntries = allCats;
    // Use Array.from for Map/Set iteration
    const catKeys = Array.from(allCats);
    for (let i = 0; i < catKeys.length; i++) {
      const cat = catKeys[i];
      const wA = catA[cat]?.weight;
      const wB = catB[cat]?.weight;
      if (wA !== wB && wA !== undefined && wB !== undefined) {
        const diff = Math.abs(wA - wB);
        differences.push({
          field: `category.${cat}.weight`,
          a: String(wA),
          b: String(wB),
          significance: diff >= 15 ? 'major' : diff >= 5 ? 'minor' : 'cosmetic',
        });
      }
    }

    // Similarity: 100 - sum of weight diffs
    const totalDiff = catKeys.reduce((s, cat) => {
      const wA = catA[cat]?.weight || 0;
      const wB = catB[cat]?.weight || 0;
      return s + Math.abs(wA - wB);
    }, 0);
    const similarityScore = Math.max(0, 100 - totalDiff / 2);

    return {
      presetA: a.name,
      presetB: b.name,
      differences,
      similarityScore: +similarityScore.toFixed(1),
    };
  }

  /** Comparison matrix across all presets */
  compareAll(): ComparisonMatrix {
    const presets = this.presets;
    const names = presets.map(p => p.name);
    const matrix: Record<string, Record<string, number>> = {};

    for (let i = 0; i < presets.length; i++) {
      const row: Record<string, number> = {};
      for (let j = 0; j < presets.length; j++) {
        if (i === j) {
          row[presets[j].name] = 100;
        } else {
          const diff = this.diffPresets(presets[i].presetId, presets[j].presetId);
          row[presets[j].name] = diff ? diff.similarityScore : 0;
        }
      }
      matrix[presets[i].name] = row;
    }

    // Simple clustering: group by category
    const clusters: Record<string, string[]> = {};
    for (let i = 0; i < presets.length; i++) {
      const cat = presets[i].category;
      if (!clusters[cat]) clusters[cat] = [];
      clusters[cat].push(presets[i].name);
    }

    return {
      presets: names,
      matrix,
      clusters: Object.values(clusters),
    };
  }

  /** Migrate a legacy template name to the new unified preset */
  migrateLegacy(legacyName: string): { presetId: string | null; success: boolean; message: string } {
    const map: Record<string, string> = {
      'value-only': 'classic-value',
      'growth-only': 'aggressive-growth',
      'momentum-only': 'momentum-master',
      'quality-only': 'quality-at-price',
      'volatility-only': 'low-vol-income',
      'income-only': 'low-vol-income',
      'garp-classic': 'quality-at-price',
      'balanced-blend': 'defensive-blend',
      'sector-rotation': 'adaptive-rotation',
      'adaptive-macro': 'adaptive-rotation',
    };

    const presetId = map[legacyName];
    if (!presetId) return { presetId: null, success: false, message: `Unknown legacy template: ${legacyName}` };
    return { presetId, success: true, message: `Migrated ${legacyName} → ${presetId}` };
  }

  /** Get all legacy template names */
  getLegacyTemplates(): string[] { return LEGACY_TEMPLATE_NAMES; }

  /** Get preset by id */
  getPreset(presetId: string): StrategyPreset | null { return this.presets.find(p => p.presetId === presetId) || null; }

  /** Get all presets */
  getAllPresets(): StrategyPreset[] { return this.presets; }

  /** Get preset count */
  getPresetCount(): number { return this.presets.length; }

  reset(): void { this.presets = [...STRATEGY_PRESETS]; }
}

let _stu: StrategyTemplateUnifier | undefined;
export function getStrategyTemplateUnifier(): StrategyTemplateUnifier {
  if (!_stu) _stu = new StrategyTemplateUnifier();
  return _stu;
}
export function resetStrategyTemplateUnifier(): void { _stu?.reset(); _stu = undefined; }
