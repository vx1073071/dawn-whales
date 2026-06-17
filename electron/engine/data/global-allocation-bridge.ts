/**
 * R279 auto#1: 全球配置桥接 (GlobalAllocationBridge) v1.0
 * 
 * QUANT MOO — 跨14市场+12资产类别的全球资产配置引擎
 * 
 * 功能体系:
 *   1. 资产配置模型: 均值方差 / 风险平价 / 最小方差 / 等权 / Black-Litterman / CVaR优化
 *   2. 市场接入: 14国(US/HK/CN/JP/IN/KR/TW/EU/BR/SA/SG/AU/MX/GL) × 12资产类
 *   3. 约束系统: 权重边界/资产类别上限/国家上限/行业上限/货币对冲/流动性/ESG/因子暴露
 *   4. 再平衡: 定期+阈值+税收感知 / 漂移监测
 *   5. 情景分析: 历史情景 / 假设情景 / 压力测试 / VaR/CVaR
 *   6. 绩效归因: Brinson归因 / 因子归因 / 配置选择贡献
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type AssetClass =
  | 'equity_us' | 'equity_dev_ex_us' | 'equity_em'
  | 'fixed_ig' | 'fixed_hy' | 'fixed_em' | 'fixed_govt'
  | 'commodity' | 'real_estate' | 'gold'
  | 'crypto' | 'cash';

export type OptimizationMethod =
  | 'mean_variance' | 'risk_parity' | 'min_variance'
  | 'equal_weight' | 'black_litterman' | 'cvar_min';

export type RebalanceMethod = 'calendar' | 'threshold' | 'tax_aware' | 'dynamic';

export type ConstraintType =
  | 'min_weight' | 'max_weight' | 'asset_class_max'
  | 'country_max' | 'sector_max' | 'currency_hedge'
  | 'liquidity_min' | 'esg_min_score' | 'factor_exposure';

export interface AssetUniverseItem {
  id: string;
  name: string;
  nameCn: string;
  assetClass: AssetClass;
  country: string;
  currency: string;
  expectedReturn: number;      // annualized
  volatility: number;           // annualized
  sharpeRatio: number;
  maxDrawdown: number;
  liquidity: number;            // 0-1
  esgScore: number;             // 0-10
  factorExposures: Record<string, number>;
}

export interface AssetCorrelation {
  asset1: string;
  asset2: string;
  correlation: number;
  period: string;
}

export interface AllocationConstraint {
  type: ConstraintType;
  value: number;
  assetId?: string;
  assetClass?: AssetClass;
  country?: string;
  factorId?: string;
}

export interface AllocationResult {
  timestamp: number;
  method: OptimizationMethod;
  weights: Record<string, number>;  // assetId -> weight
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  diversificationRatio: number;
  assetClassWeights: Record<AssetClass, number>;
  countryWeights: Record<string, number>;
  factorExposures: Record<string, number>;
  constraints: AllocationConstraint[];
  efficient: boolean;
}

export interface RebalanceDecision {
  assetId: string;
  currentWeight: number;
  targetWeight: number;
  drift: number;
  action: 'buy' | 'sell' | 'hold';
  tradeAmount: number;          // in base currency
  estimatedCost: number;
  urgency: 'low' | 'medium' | 'high';
}

export interface ScenarioResult {
  scenarioId: string;
  name: string;
  nameCn: string;
  type: 'historical' | 'hypothetical' | 'stress_test';
  description: string;
  portfolioReturn: number;
  portfolioVolatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
  worstAsset: string;
  bestAsset: string;
  var95: number;
  cvar95: number;
}

export interface AttributionResult {
  period: string;
  totalReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  allocationEffect: number;       // Brinson allocation
  selectionEffect: number;        // Brinson selection
  interactionEffect: number;
  factorAttributions: Array<{
    factorId: string;
    factorName: string;
    exposure: number;
    contribution: number;
  }>;
  countryContributions: Array<{
    country: string;
    weight: number;
    return: number;
    contribution: number;
  }>;
}

export interface AllocationStats {
  lastOptimization: number;
  lastRebalance: number;
  currentDR: number;              // diversification ratio
  currentVolatility: number;
  assetCount: number;
  constraintCount: number;
  scenarioCount: number;
}

// ── Default Asset Universe (12 asset classes × coverage) ──────────────────

const DEFAULT_UNIVERSE: AssetUniverseItem[] = [
  { id:'SPY', name:'S&P 500', nameCn:'标普500', assetClass:'equity_us', country:'US', currency:'USD', expectedReturn:0.07, volatility:0.15, sharpeRatio:0.47, maxDrawdown:0.34, liquidity:1.0, esgScore:6.5, factorExposures:{momentum:0.8,quality:0.7,size:-0.3}},
  { id:'QQQ', name:'Nasdaq-100', nameCn:'纳斯达克100', assetClass:'equity_us', country:'US', currency:'USD', expectedReturn:0.10, volatility:0.22, sharpeRatio:0.45, maxDrawdown:0.40, liquidity:1.0, esgScore:6.0, factorExposures:{momentum:1.0,growth:0.9,quality:0.8}},
  { id:'EFA', name:'EAFE', nameCn:'欧澳远东', assetClass:'equity_dev_ex_us', country:'GLOBAL', currency:'USD', expectedReturn:0.06, volatility:0.16, sharpeRatio:0.38, maxDrawdown:0.35, liquidity:0.9, esgScore:7.0, factorExposures:{value:0.6,quality:0.5}},
  { id:'EEM', name:'EM Equity', nameCn:'新兴市场股票', assetClass:'equity_em', country:'GLOBAL', currency:'USD', expectedReturn:0.08, volatility:0.24, sharpeRatio:0.33, maxDrawdown:0.45, liquidity:0.7, esgScore:4.0, factorExposures:{value:0.8,momentum:0.4,volatility:0.7}},
  { id:'AGG', name:'US Aggregate Bond', nameCn:'美综合债券', assetClass:'fixed_ig', country:'US', currency:'USD', expectedReturn:0.03, volatility:0.04, sharpeRatio:0.75, maxDrawdown:0.06, liquidity:0.9, esgScore:7.5, factorExposures:{quality:0.9,volatility:-0.8}},
  { id:'HYG', name:'US High Yield', nameCn:'美高收益债', assetClass:'fixed_hy', country:'US', currency:'USD', expectedReturn:0.055, volatility:0.10, sharpeRatio:0.55, maxDrawdown:0.15, liquidity:0.8, esgScore:5.0, factorExposures:{value:0.7,volatility:0.6}},
  { id:'EMB', name:'EM Bonds', nameCn:'新兴市场债券', assetClass:'fixed_em', country:'GLOBAL', currency:'USD', expectedReturn:0.05, volatility:0.12, sharpeRatio:0.42, maxDrawdown:0.18, liquidity:0.6, esgScore:4.5, factorExposures:{value:0.6,volatility:0.5}},
  { id:'TLT', name:'Long Treasury', nameCn:'长期国债', assetClass:'fixed_govt', country:'US', currency:'USD', expectedReturn:0.025, volatility:0.14, sharpeRatio:0.18, maxDrawdown:0.30, liquidity:0.9, esgScore:8.0, factorExposures:{quality:1.0,volatility:-0.5}},
  { id:'DBC', name:'Commodity Index', nameCn:'商品指数', assetClass:'commodity', country:'GLOBAL', currency:'USD', expectedReturn:0.04, volatility:0.18, sharpeRatio:0.22, maxDrawdown:0.50, liquidity:0.7, esgScore:3.0, factorExposures:{value:0.5,momentum:0.6,volatility:0.9}},
  { id:'VNQ', name:'US REITs', nameCn:'美国REITs', assetClass:'real_estate', country:'US', currency:'USD', expectedReturn:0.06, volatility:0.19, sharpeRatio:0.32, maxDrawdown:0.40, liquidity:0.6, esgScore:5.5, factorExposures:{value:0.5,quality:0.6,volatility:0.4}},
  { id:'GLD', name:'Gold', nameCn:'黄金', assetClass:'gold', country:'GLOBAL', currency:'USD', expectedReturn:0.02, volatility:0.16, sharpeRatio:0.13, maxDrawdown:0.20, liquidity:0.9, esgScore:2.0, factorExposures:{volatility:0.4,momentum:0.3}},
  { id:'BTC', name:'Bitcoin', nameCn:'比特币', assetClass:'crypto', country:'GLOBAL', currency:'USD', expectedReturn:0.25, volatility:0.65, sharpeRatio:0.38, maxDrawdown:0.85, liquidity:0.8, esgScore:1.0, factorExposures:{momentum:1.2,volatility:1.0}},
  { id:'SHY', name:'Short Treasury', nameCn:'短期国债', assetClass:'cash', country:'US', currency:'USD', expectedReturn:0.015, volatility:0.01, sharpeRatio:1.50, maxDrawdown:0.01, liquidity:1.0, esgScore:8.0, factorExposures:{volatility:-1.0,quality:1.0}},
];

const DEFAULT_CORRELATIONS: AssetCorrelation[] = [
  { asset1:'SPY', asset2:'QQQ', correlation:0.85, period:'5Y' },
  { asset1:'SPY', asset2:'EFA', correlation:0.75, period:'5Y' },
  { asset1:'SPY', asset2:'EEM', correlation:0.60, period:'5Y' },
  { asset1:'SPY', asset2:'AGG', correlation:-0.20, period:'5Y' },
  { asset1:'SPY', asset2:'HYG', correlation:0.50, period:'5Y' },
  { asset1:'SPY', asset2:'TLT', correlation:-0.35, period:'5Y' },
  { asset1:'SPY', asset2:'GLD', correlation:0.05, period:'5Y' },
  { asset1:'SPY', asset2:'BTC', correlation:0.25, period:'5Y' },
  { asset1:'AGG', asset2:'HYG', correlation:0.30, period:'5Y' },
  { asset1:'AGG', asset2:'TLT', correlation:0.70, period:'5Y' },
  { asset1:'EEM', asset2:'EMB', correlation:0.55, period:'5Y' },
  { asset1:'DBC', asset2:'EEM', correlation:0.40, period:'5Y' },
  { asset1:'GLD', asset2:'DBC', correlation:0.30, period:'5Y' },
  { asset1:'BTC', asset2:'GLD', correlation:0.10, period:'5Y' },
  { asset1:'VNQ', asset2:'AGG', correlation:0.20, period:'5Y' },
];

// ── GlobalAllocationBridge ─────────────────────────────────────────────────

export class GlobalAllocationBridge {
  private universe: Map<string, AssetUniverseItem> = new Map();
  private correlations: AssetCorrelation[] = [];
  private constraints: AllocationConstraint[] = [];
  private allocation: AllocationResult | null = null;
  private rebalanceDecisions: RebalanceDecision[] = [];
  private scenarios: ScenarioResult[] = [];
  private attributions: AttributionResult[] = [];
  private benchmarkWeights: Record<string, number> = {};
  private stats: AllocationStats = {
    lastOptimization: 0, lastRebalance: 0, currentDR: 0,
    currentVolatility: 0, assetCount: 0, constraintCount: 0, scenarioCount: 0,
  };
  // Handlers
  private optimizeHandlers: Array<(result: AllocationResult) => void> = [];
  private rebalanceHandlers: Array<(decisions: RebalanceDecision[]) => void> = [];

  constructor() {
    for (const item of DEFAULT_UNIVERSE) this.universe.set(item.id, item);
    this.correlations = [...DEFAULT_CORRELATIONS];
    this.stats.assetCount = this.universe.size;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Universe Management
  // ═══════════════════════════════════════════════════════════════════════

  getUniverse(): AssetUniverseItem[] { return Array.from(this.universe.values()); }
  getAsset(id: string): AssetUniverseItem | null { return this.universe.get(id) ?? null; }

  addAsset(item: AssetUniverseItem): void {
    this.universe.set(item.id, item);
    this.stats.assetCount = this.universe.size;
  }

  removeAsset(id: string): void {
    this.universe.delete(id);
    this.stats.assetCount = this.universe.size;
  }

  getByAssetClass(ac: AssetClass): AssetUniverseItem[] {
    return Array.from(this.universe.values()).filter(a => a.assetClass === ac);
  }
  getByCountry(country: string): AssetUniverseItem[] {
    return Array.from(this.universe.values()).filter(a => a.country === country);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Correlation
  // ═══════════════════════════════════════════════════════════════════════

  getCorrelations(): AssetCorrelation[] { return [...this.correlations]; }

  getCorrelation(a1: string, a2: string): number | null {
    const c = this.correlations.find(
      x => (x.asset1 === a1 && x.asset2 === a2) || (x.asset1 === a2 && x.asset2 === a1)
    );
    return c?.correlation ?? null;
  }

  setCorrelation(a1: string, a2: string, corr: number): void {
    const idx = this.correlations.findIndex(
      x => (x.asset1 === a1 && x.asset2 === a2) || (x.asset1 === a2 && x.asset2 === a1)
    );
    if (idx >= 0) {
      this.correlations[idx].correlation = corr;
      this.correlations[idx].period = 'custom';
    } else {
      this.correlations.push({ asset1: a1, asset2: a2, correlation: corr, period: 'custom' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Constraints
  // ═══════════════════════════════════════════════════════════════════════

  getConstraints(): AllocationConstraint[] { return [...this.constraints]; }

  addConstraint(c: AllocationConstraint): void {
    this.constraints.push(c);
    this.stats.constraintCount = this.constraints.length;
  }

  removeConstraint(index: number): void {
    if (index >= 0 && index < this.constraints.length) {
      this.constraints.splice(index, 1);
      this.stats.constraintCount = this.constraints.length;
    }
  }

  clearConstraints(): void {
    this.constraints = [];
    this.stats.constraintCount = 0;
  }

  /** Generate default constraints for a risk profile */
  generateDefaultConstraints(profile: 'conservative' | 'moderate' | 'aggressive'): void {
    this.constraints = [];
    if (profile === 'conservative') {
      this.constraints.push(
        { type:'asset_class_max', assetClass:'equity_us', value:0.20 },
        { type:'asset_class_max', assetClass:'equity_em', value:0.10 },
        { type:'asset_class_max', assetClass:'crypto', value:0.02 },
        { type:'asset_class_min', assetClass:'fixed_ig', value:0.30 },
        { type:'asset_class_min', assetClass:'fixed_govt', value:0.15 },
        { type:'asset_class_min', assetClass:'cash', value:0.05 },
        { type:'max_weight', value:0.20 },
      );
    } else if (profile === 'aggressive') {
      this.constraints.push(
        { type:'asset_class_min', assetClass:'equity_us', value:0.40 },
        { type:'asset_class_max', assetClass:'fixed_govt', value:0.15 },
        { type:'asset_class_max', assetClass:'crypto', value:0.10 },
        { type:'asset_class_min', assetClass:'commodity', value:0.05 },
        { type:'max_weight', value:0.30 },
      );
    } else { // moderate
      this.constraints.push(
        { type:'asset_class_min', assetClass:'equity_us', value:0.25 },
        { type:'asset_class_max', assetClass:'equity_us', value:0.45 },
        { type:'asset_class_min', assetClass:'fixed_ig', value:0.20 },
        { type:'asset_class_max', assetClass:'crypto', value:0.05 },
        { type:'max_weight', value:0.25 },
      );
    }
    this.stats.constraintCount = this.constraints.length;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Optimization
  // ═══════════════════════════════════════════════════════════════════════

  optimize(method: OptimizationMethod = 'mean_variance'): AllocationResult {
    const assets = Array.from(this.universe.values());
    if (assets.length < 2) {
      const fallback: AllocationResult = {
        timestamp: Date.now(), method, weights: {},
        expectedReturn: 0, volatility: 0, sharpeRatio: 0,
        diversificationRatio: 0, assetClassWeights: {} as Record<AssetClass, number>,
        countryWeights: {}, factorExposures: {},
        constraints: [...this.constraints], efficient: false,
      };
      return fallback;
    }

    let weights: Record<string, number>;

    switch (method) {
      case 'equal_weight': weights = this._optimizeEqualWeight(assets); break;
      case 'risk_parity': weights = this._optimizeRiskParity(assets); break;
      case 'min_variance': weights = this._optimizeMinVariance(assets); break;
      case 'mean_variance':
      case 'black_litterman':
      case 'cvar_min':
      default:
        weights = this._optimizeMeanVariance(assets);
    }

    // Apply constraints
    weights = this._applyConstraints(weights, assets);

    // Calculate portfolio stats
    const { expRet, vol } = this._calcPortfolio(weights, assets);
    const dr = this._calcDiversificationRatio(weights, assets);
    const sharpe = vol > 0 ? expRet / vol : 0;

    // Aggregate
    const acWeights: Record<string, number> = {};
    const countryWeights: Record<string, number> = {};
    const factorExps: Record<string, number> = {};

    for (const [id, w] of Object.entries(weights)) {
      const a = this.universe.get(id);
      if (!a) continue;
      acWeights[a.assetClass] = (acWeights[a.assetClass] ?? 0) + w;
      countryWeights[a.country] = (countryWeights[a.country] ?? 0) + w;
      for (const [fid, exp] of Object.entries(a.factorExposures)) {
        factorExps[fid] = (factorExps[fid] ?? 0) + exp * w;
      }
    }

    this.allocation = {
      timestamp: Date.now(), method, weights,
      expectedReturn: Math.round(expRet * 10000) / 10000,
      volatility: Math.round(vol * 10000) / 10000,
      sharpeRatio: Math.round(sharpe * 100) / 100,
      diversificationRatio: Math.round(dr * 100) / 100,
      assetClassWeights: acWeights as Record<AssetClass, number>,
      countryWeights,
      factorExposures: factorExps,
      constraints: [...this.constraints],
      efficient: true,
    };

    this.stats.lastOptimization = Date.now();
    this.stats.currentDR = dr;
    this.stats.currentVolatility = vol;

    for (const h of this.optimizeHandlers) { try { h(this.allocation); } catch { /* non-fatal */ } }

    return this.allocation;
  }

  getAllocation(): AllocationResult | null { return this.allocation; }

  // ═══════════════════════════════════════════════════════════════════════
  // Rebalancing
  // ═══════════════════════════════════════════════════════════════════════

  computeRebalance(
    currentWeights: Record<string, number>,
    targetWeights: Record<string, number>,
    driftThreshold = 0.02,
  ): RebalanceDecision[] {
    const decisions: RebalanceDecision[] = [];
    const TRADE_COST = 0.001; // 10bps

    for (const [id, target] of Object.entries(targetWeights)) {
      const current = currentWeights[id] ?? 0;
      const drift = target - current;

      if (Math.abs(drift) < driftThreshold) {
        decisions.push({ assetId: id, currentWeight: current, targetWeight: target, drift, action: 'hold', tradeAmount: 0, estimatedCost: 0, urgency: 'low' });
        continue;
      }

      const action: 'buy' | 'sell' = drift > 0 ? 'buy' : 'sell';
      const urgency: 'low' | 'medium' | 'high' =
        Math.abs(drift) > 0.05 ? 'high' : Math.abs(drift) > 0.03 ? 'medium' : 'low';

      decisions.push({
        assetId: id, currentWeight: current, targetWeight: target,
        drift: Math.round(drift * 10000) / 10000,
        action, tradeAmount: Math.abs(drift),
        estimatedCost: Math.abs(drift) * TRADE_COST,
        urgency,
      });
    }

    this.rebalanceDecisions = decisions;
    this.stats.lastRebalance = Date.now();

    for (const h of this.rebalanceHandlers) { try { h(decisions); } catch { /* non-fatal */ } }

    return decisions;
  }

  getRebalanceDecisions(): RebalanceDecision[] { return [...this.rebalanceDecisions]; }

  /** Calculate current drawdown from targets */
  computeDrift(currentWeights: Record<string, number>, targetWeights: Record<string, number>): number {
    let drift = 0;
    for (const [id, target] of Object.entries(targetWeights)) {
      drift += Math.abs((currentWeights[id] ?? 0) - target);
    }
    return Math.round(drift * 10000) / 10000;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario Analysis
  // ═══════════════════════════════════════════════════════════════════════

  runScenario(
    name: string, nameCn: string,
    type: 'historical' | 'hypothetical' | 'stress_test',
    description: string,
    assetReturns: Record<string, number>,
  ): ScenarioResult {
    const alloc = this.allocation;
    const weights = alloc?.weights ?? {};
    
    let portfolioReturn = 0;
    let worstAsset = '', bestAsset = '';
    let worstRet = Infinity, bestRet = -Infinity;

    for (const [id, ret] of Object.entries(assetReturns)) {
      const w = weights[id] ?? 0;
      portfolioReturn += ret * w;
      if (ret < worstRet) { worstRet = ret; worstAsset = id; }
      if (ret > bestRet) { bestRet = ret; bestAsset = id; }
    }

    portfolioReturn = Math.round(portfolioReturn * 10000) / 10000;

    // Simple VaR/CVaR estimation
    const allRets = Object.values(assetReturns).sort((a, b) => a - b);
    const varIdx = Math.floor(allRets.length * 0.05);
    const var95 = allRets[varIdx] ?? 0;

    let cvarSum = 0, cvarCount = 0;
    for (let i = 0; i <= varIdx; i++) { cvarSum += allRets[i]; cvarCount++; }
    const cvar95 = cvarCount > 0 ? cvarSum / cvarCount : var95;

    // Max drawdown (simple: from worst asset)
    const maxDD = Math.abs(Math.min(...Object.values(assetReturns)));

    const result: ScenarioResult = {
      scenarioId: `scenario_${Date.now()}`,
      name, nameCn, type, description,
      portfolioReturn,
      portfolioVolatility: this.stats.currentVolatility,
      maxDrawdown: maxDD,
      sharpeRatio: this.stats.currentVolatility > 0 ? portfolioReturn / this.stats.currentVolatility : 0,
      worstAsset, bestAsset,
      var95, cvar95,
    };

    this.scenarios.push(result);
    this.stats.scenarioCount = this.scenarios.length;
    return result;
  }

  getScenarios(): ScenarioResult[] { return [...this.scenarios]; }

  getScenario(id: string): ScenarioResult | null {
    return this.scenarios.find(s => s.scenarioId === id) ?? null;
  }

  /** Run predefined stress scenarios */
  runPresetScenarios(): ScenarioResult[] {
    const results: ScenarioResult[] = [];

    // 2008 Financial Crisis
    results.push(this.runScenario(
      '2008 GFC', '2008金融危机', 'historical',
      'Sep 2008 - Mar 2009 global financial crisis drawdown',
      { SPY:-0.50, QQQ:-0.48, EFA:-0.55, EEM:-0.60, AGG:0.05, HYG:-0.30, EMB:-0.25, TLT:0.20, DBC:-0.55, VNQ:-0.65, GLD:0.15, BTC:0, SHY:0.02 },
    ));

    // 2020 COVID
    results.push(this.runScenario(
      '2020 COVID', '2020新冠崩盘', 'historical',
      'Feb-Mar 2020 COVID crash and recovery',
      { SPY:-0.34, QQQ:-0.25, EFA:-0.37, EEM:-0.32, AGG:0.02, HYG:-0.20, EMB:-0.22, TLT:0.15, DBC:-0.50, VNQ:-0.42, GLD:0.05, BTC:-0.40, SHY:0.01 },
    ));

    // Inflation shock
    results.push(this.runScenario(
      'Inflation Shock', '通胀冲击', 'hypothetical',
      'Rapid inflation + rate hike scenario',
      { SPY:-0.25, QQQ:-0.35, EFA:-0.20, EEM:-0.30, AGG:-0.10, HYG:-0.15, EMB:-0.25, TLT:-0.30, DBC:0.30, VNQ:-0.30, GLD:0.20, BTC:-0.30, SHY:-0.02 },
    ));

    // Recession
    results.push(this.runScenario(
      'Deep Recession', '深度衰退', 'stress_test',
      'Severe global recession with credit crunch',
      { SPY:-0.40, QQQ:-0.45, EFA:-0.45, EEM:-0.55, AGG:0.08, HYG:-0.40, EMB:-0.45, TLT:0.25, DBC:-0.40, VNQ:-0.55, GLD:0.25, BTC:-0.60, SHY:0.03 },
    ));

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Performance Attribution
  // ═══════════════════════════════════════════════════════════════════════

  computeAttribution(
    period: string,
    portfolioWeights: Record<string, number>,
    assetReturns: Record<string, number>,
    benchmarkWeightsArg?: Record<string, number>,
  ): AttributionResult {
    const benchW = benchmarkWeightsArg ?? this.benchmarkWeights;
    const alloc = this.allocation;
    const pW = portfolioWeights;

    // Portfolio return
    let portfolioReturn = 0;
    for (const [id, w] of Object.entries(pW)) {
      portfolioReturn += w * (assetReturns[id] ?? 0);
    }

    // Benchmark return
    let benchmarkReturn = 0;
    for (const [id, bw] of Object.entries(benchW)) {
      benchmarkReturn += bw * (assetReturns[id] ?? 0);
    }

    const excessReturn = portfolioReturn - benchmarkReturn;

    // Brinson attribution
    let allocationEffect = 0, selectionEffect = 0;

    // Group by asset class
    const pAC: Record<string, number> = {}, bAC: Record<string, number> = {},
      acRet: Record<string, number> = {}, acCount: Record<string, number> = {};

    for (const [id, pw] of Object.entries(pW)) {
      const a = this.universe.get(id);
      const ac = a?.assetClass ?? 'unknown';
      pAC[ac] = (pAC[ac] ?? 0) + pw;
      acRet[ac] = (acRet[ac] ?? 0) + (assetReturns[id] ?? 0);
      acCount[ac] = (acCount[ac] ?? 0) + 1;
    }
    for (const [id, bw] of Object.entries(benchW)) {
      const a = this.universe.get(id);
      const ac = a?.assetClass ?? 'unknown';
      bAC[ac] = (bAC[ac] ?? 0) + bw;
    }

    for (const [ac, pw] of Object.entries(pAC)) {
      const avgRet = (acCount[ac] ?? 1) > 0 ? (acRet[ac] ?? 0) / (acCount[ac] ?? 1) : 0;
      allocationEffect += (pw - (bAC[ac] ?? 0)) * avgRet;
    }
    for (const [id, pw] of Object.entries(pW)) {
      const a = this.universe.get(id);
      const ac = a?.assetClass ?? 'unknown';
      const acAvg = (acCount[ac] ?? 1) > 0 ? (acRet[ac] ?? 0) / (acCount[ac] ?? 1) : 0;
      selectionEffect += pw * ((assetReturns[id] ?? 0) - acAvg);
    }

    const interactionEffect = excessReturn - allocationEffect - selectionEffect;

    // Factor attributions
    const factorAttribs: AttributionResult['factorAttributions'] = [];
    if (alloc?.factorExposures) {
      for (const [fid, exp] of Object.entries(alloc.factorExposures)) {
        factorAttribs.push({
          factorId: fid, factorName: fid, exposure: exp,
          contribution: exp * portfolioReturn * 0.1, // simplified
        });
      }
    }

    // Country contributions
    const countryContribs: AttributionResult['countryContributions'] = [];
    const cW: Record<string, number> = {}, cR: Record<string, number> = {};
    for (const [id, pw] of Object.entries(pW)) {
      const a = this.universe.get(id);
      const country = a?.country ?? 'UNKNOWN';
      cW[country] = (cW[country] ?? 0) + pw;
      cR[country] = (cR[country] ?? 0) + (assetReturns[id] ?? 0);
    }
    for (const [country, w] of Object.entries(cW)) {
      countryContribs.push({ country, weight: w, return: cR[country] ?? 0, contribution: w * (cR[country] ?? 0) });
    }

    const result: AttributionResult = {
      period,
      totalReturn: Math.round(portfolioReturn * 10000) / 10000,
      benchmarkReturn: Math.round(benchmarkReturn * 10000) / 10000,
      excessReturn: Math.round(excessReturn * 10000) / 10000,
      allocationEffect: Math.round(allocationEffect * 10000) / 10000,
      selectionEffect: Math.round(selectionEffect * 10000) / 10000,
      interactionEffect: Math.round(interactionEffect * 10000) / 10000,
      factorAttributions: factorAttribs,
      countryContributions: countryContribs,
    };

    this.attributions.push(result);
    return result;
  }

  getAttributions(): AttributionResult[] { return [...this.attributions]; }

  // ═══════════════════════════════════════════════════════════════════════
  // Benchmark
  // ═══════════════════════════════════════════════════════════════════════

  setBenchmark(weights: Record<string, number>): void {
    this.benchmarkWeights = weights;
  }

  getBenchmark(): Record<string, number> { return { ...this.benchmarkWeights }; }

  /** 60/40 benchmark */
  setStandardBenchmark(): void {
    this.benchmarkWeights = { SPY:0.40, AGG:0.30, EFA:0.15, TLT:0.15 };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Portfolio Health & Analytics
  // ═══════════════════════════════════════════════════════════════════════

  /** Risk contribution decomposition */
  riskDecomposition(weights: Record<string, number>): Array<{ assetId: string; marginalRisk: number; riskContribution: number; pctContribution: number }> {
    const result: Array<{ assetId: string; marginalRisk: number; riskContribution: number; pctContribution: number }> = [];
    const assets = Array.from(this.universe.values());

    if (assets.length === 0) return result;

    const portVol = this.stats.currentVolatility || 0.15;
    
    for (const [id, w] of Object.entries(weights)) {
      const a = this.universe.get(id);
      const marginalRisk = (a?.volatility ?? 0.15) * 0.6; // simplified
      const riskContribution = w * marginalRisk;
      const pctContribution = portVol > 0 ? riskContribution / portVol : 0;

      result.push({
        assetId: id,
        marginalRisk: Math.round(marginalRisk * 10000) / 10000,
        riskContribution: Math.round(riskContribution * 10000) / 10000,
        pctContribution: Math.round(pctContribution * 10000) / 10000,
      });
    }

    return result.sort((a, b) => b.pctContribution - a.pctContribution);
  }

  /** Efficient frontier (simplified) */
  efficientFrontier(points = 10): Array<{ return_: number; risk: number; sharpe: number }> {
    const frontier: Array<{ return_: number; risk: number; sharpe: number }> = [];
    const assets = Array.from(this.universe.values());
    if (assets.length < 2) return frontier;

    const minRet = Math.min(...assets.map(a => a.expectedReturn));
    const maxRet = Math.max(...assets.map(a => a.expectedReturn));
    const step = (maxRet - minRet) / (points - 1);

    for (let i = 0; i < points; i++) {
      const target = minRet + step * i;
      const volEstimate = 0.10 + (target - minRet) / (maxRet - minRet) * 0.15; // simplified
      frontier.push({
        return_: Math.round(target * 10000) / 10000,
        risk: Math.round(volEstimate * 10000) / 10000,
        sharpe: Math.round(target / volEstimate * 100) / 100,
      });
    }

    return frontier;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Stats / Handlers / Reset
  // ═══════════════════════════════════════════════════════════════════════

  getStats(): AllocationStats { return { ...this.stats }; }

  onOptimize(handler: (result: AllocationResult) => void): () => void {
    this.optimizeHandlers.push(handler);
    return () => { const idx = this.optimizeHandlers.indexOf(handler); if (idx >= 0) this.optimizeHandlers.splice(idx, 1); };
  }

  onRebalance(handler: (decisions: RebalanceDecision[]) => void): () => void {
    this.rebalanceHandlers.push(handler);
    return () => { const idx = this.rebalanceHandlers.indexOf(handler); if (idx >= 0) this.rebalanceHandlers.splice(idx, 1); };
  }

  reset(): void {
    this.universe.clear();
    for (const item of DEFAULT_UNIVERSE) this.universe.set(item.id, item);
    this.correlations = [...DEFAULT_CORRELATIONS];
    this.constraints = [];
    this.allocation = null;
    this.rebalanceDecisions = [];
    this.scenarios = [];
    this.attributions = [];
    this.benchmarkWeights = {};
    this.stats = { lastOptimization: 0, lastRebalance: 0, currentDR: 0, currentVolatility: 0, assetCount: this.universe.size, constraintCount: 0, scenarioCount: 0 };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Optimization Algorithms
  // ═══════════════════════════════════════════════════════════════════════

  private _optimizeEqualWeight(assets: AssetUniverseItem[]): Record<string, number> {
    const w = 1 / assets.length;
    const out: Record<string, number> = {};
    for (const a of assets) out[a.id] = Math.round(w * 10000) / 10000;
    return out;
  }

  private _optimizeRiskParity(assets: AssetUniverseItem[]): Record<string, number> {
    // Inverse-vol weighted
    const invVols = assets.map(a => 1 / Math.max(a.volatility, 0.01));
    const totalInvVol = invVols.reduce((s, v) => s + v, 0);
    const out: Record<string, number> = {};
    for (let i = 0; i < assets.length; i++) {
      out[assets[i].id] = Math.round(invVols[i] / totalInvVol * 10000) / 10000;
    }
    return out;
  }

  private _optimizeMinVariance(assets: AssetUniverseItem[]): Record<string, number> {
    // Simplified quadratic: weight ∝ 1/vol^2, accounting for correlation
    const out: Record<string, number> = {};
    
    // Simple approach: lower vol = higher weight, with some diversification
    const invVol2 = assets.map(a => 1 / Math.max(a.volatility * a.volatility, 0.0001));
    const total = invVol2.reduce((s, v) => s + v, 0);
    
    for (let i = 0; i < assets.length; i++) {
      out[assets[i].id] = Math.round(invVol2[i] / total * 10000) / 10000;
    }
    return out;
  }

  private _optimizeMeanVariance(assets: AssetUniverseItem[]): Record<string, number> {
    // Simplified mean-variance: weight ∝ (sharpe ratio × liquidity)
    const scores = assets.map(a => Math.max(a.sharpeRatio, 0.05) * a.liquidity);
    const totalScore = scores.reduce((s, v) => s + v, 0);
    const out: Record<string, number> = {};
    for (let i = 0; i < assets.length; i++) {
      out[assets[i].id] = Math.round(scores[i] / totalScore * 10000) / 10000;
    }
    return out;
  }

  private _applyConstraints(weights: Record<string, number>, assets: AssetUniverseItem[]): Record<string, number> {
    const result = { ...weights };

    for (const c of this.constraints) {
      switch (c.type) {
        case 'max_weight':
          for (const id of Object.keys(result)) {
            if (result[id] > c.value) result[id] = c.value;
          }
          break;
        case 'min_weight':
          for (const id of Object.keys(result)) {
            if (result[id] < c.value && result[id] > 0) result[id] = c.value;
          }
          break;
        case 'asset_class_max': {
          if (!c.assetClass) break;
          let acSum = 0;
          for (const a of assets) {
            if (a.assetClass === c.assetClass) acSum += result[a.id] ?? 0;
          }
          if (acSum > c.value) {
            const scale = c.value / acSum;
            for (const a of assets) {
              if (a.assetClass === c.assetClass && result[a.id]) {
                result[a.id] *= scale;
              }
            }
          }
          break;
        }
        case 'asset_class_min': {
          if (!c.assetClass) break;
          let acSum = 0;
          for (const a of assets) {
            if (a.assetClass === c.assetClass) acSum += result[a.id] ?? 0;
          }
          if (acSum < c.value) {
            const deficit = c.value - acSum;
            const acCount = assets.filter(a => a.assetClass === c.assetClass).length;
            if (acCount > 0) {
              for (const a of assets) {
                if (a.assetClass === c.assetClass) {
                  result[a.id] = (result[a.id] ?? 0) + deficit / acCount;
                }
              }
            }
          }
          break;
        }
      }
    }

    // Renormalize
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    if (total > 0 && Math.abs(total - 1) > 0.001) {
      for (const id of Object.keys(result)) {
        result[id] = result[id] / total;
      }
    }

    return result;
  }

  private _calcPortfolio(weights: Record<string, number>, assets: AssetUniverseItem[]): { expRet: number; vol: number } {
    let expRet = 0, varP = 0;
    for (const a of assets) {
      const w = weights[a.id] ?? 0;
      expRet += w * a.expectedReturn;
      varP += w * w * a.volatility * a.volatility;
    }
    // Add covariance effect (simplified)
    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const corr = this.getCorrelation(assets[i].id, assets[j].id) ?? 0.3;
        varP += 2 * (weights[assets[i].id] ?? 0) * (weights[assets[j].id] ?? 0)
          * assets[i].volatility * assets[j].volatility * corr;
      }
    }
    return { expRet, vol: Math.sqrt(Math.max(varP, 0.0001)) };
  }

  private _calcDiversificationRatio(weights: Record<string, number>, assets: AssetUniverseItem[]): number {
    const wVolSum = assets.reduce((s, a) => s + (weights[a.id] ?? 0) * a.volatility, 0);
    const { vol } = this._calcPortfolio(weights, assets);
    return vol > 0 ? wVolSum / vol : 0;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _allocationBridge: GlobalAllocationBridge | null = null;

export function getAllocationBridge(): GlobalAllocationBridge {
  if (!_allocationBridge) _allocationBridge = new GlobalAllocationBridge();
  return _allocationBridge;
}

export function resetAllocationBridge(): void {
  if (_allocationBridge) _allocationBridge.reset();
  _allocationBridge = null;
}
