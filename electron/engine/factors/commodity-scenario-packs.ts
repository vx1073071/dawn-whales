// R199 J3: 3 Commodity Scenario Packs — 贵金属进攻 / 能源趋势 / 工业金属复苏
// Each pack: symbol group → weighted factor aggregation → signal + human story
// PM requirement: "各配权重+信号灯, 人话+可执行"
// Human: "现在该买黄金还是原油？看场景信号灯"

import log from 'electron-log';
import { CommodityCategory, COMMODITY_SYMBOLS } from './commodity-types';

// ── Scenario Output ──────────────────────────────────────────

export interface ScenarioOutput {
  scenarioId: string;
  scenarioName: string;
  scenarioNameCN: string;
  symbols: string[];
  category: CommodityCategory;
  // Aggregate
  aggregateSignal: 'green' | 'yellow' | 'red';  // 🟢做多 / 🟡观望 / 🔴回避
  aggregateScore: number;                         // 0-100
  confidence: number;                             // 0-1
  // Detail
  factorSignals: { factorId: string; signal: 'green' | 'yellow' | 'red'; score: number }[];
  topBullishFactors: string[];
  topBearishFactors: string[];
  // Human
  recommendation: string;                         // 一句话建议
  reasoning: string;                              // 2-3句逻辑
  actionItems: string[];                          // 可执行清单
  // Timing
  generatedAt: Date;
  validUntil: Date;                               // 场景有效期
}

// ── Scenario Definition ──────────────────────────────────────

interface ScenarioDefinition {
  id: string;
  name: string;
  nameCN: string;
  symbols: string[];
  category: CommodityCategory;
  // Weight per factor (sum = 1.0)
  weights: Record<string, number>;
  // Thresholds for signal
  bullishThreshold: number;      // score >= this → green
  bearishThreshold: number;      // score <= this → red
}

// ── 3 Scenarios ──────────────────────────────────────────────

const SCENARIOS: ScenarioDefinition[] = [
  // 🥇 贵金属进攻
  {
    id: 'precious_metal_offense', name: 'Precious Metal Offense',
    nameCN: '贵金属进攻',
    symbols: ['GC', 'SI', 'PL', 'PA'],
    category: 'PreciousMetal',
    bullishThreshold: 60,
    bearishThreshold: 40,
    weights: {
      // Term structure x2
      CMD_ROLL_YIELD: 0.10, CMD_TERM_STRUCTURE: 0.05, CMD_BASIS: 0.05,
      // Momentum
      CMD_MOMENTUM_12M: 0.05,
      // Macro drivers (gold heavy)
      CMD_REAL_RATE: 0.15, CMD_INFLATION_BE: 0.10, CMD_DXY_LINKAGE: 0.10, CMD_GEOPOL_RISK: 0.10,
      // Flow
      CMD_GOLD_ETF: 0.10,
      // COT
      CMD_COT_SPECULATOR: 0.05, CMD_COT_COMMERCIAL: 0.05,
      // Seasonality
      CMD_SEASONALITY: 0.05, CMD_GOLD_SUMMER: 0.05,
    },
  },
  // 🛢️ 能源趋势
  {
    id: 'energy_trend', name: 'Energy Trend',
    nameCN: '能源趋势',
    symbols: ['CL', 'BZ', 'NG', 'HO', 'RB'],
    category: 'Energy',
    bullishThreshold: 60,
    bearishThreshold: 40,
    weights: {
      // Supply/demand
      CMD_EIA_CRUDE: 0.20, CMD_NATGAS_STORAGE: 0.10, CMD_BALANCE_SHEET: 0.10,
      // Crack spread
      CMD_CRACK_SPREAD: 0.10,
      // Macro
      CMD_DXY_LINKAGE: 0.10, CMD_GEOPOL_RISK: 0.10,
      // Momentum
      CMD_MOMENTUM_12M: 0.08, CMD_MOMENTUM_1M: 0.07,
      // COT
      CMD_COT_COMMERCIAL: 0.07, CMD_COT_SPECULATOR: 0.08,
    },
  },
  // 🏭 工业金属复苏
  {
    id: 'industrial_metal_recovery', name: 'Industrial Metal Recovery',
    nameCN: '工业金属复苏',
    symbols: ['HG', 'LME_CU', 'LME_AL', 'LME_NI', 'LME_ZN'],
    category: 'IndustrialMetal',
    bullishThreshold: 60,
    bearishThreshold: 40,
    weights: {
      // LME inventory (core)
      CMD_LME_INVENTORY: 0.20,
      // Term structure
      CMD_BASIS: 0.10, CMD_ROLL_YIELD: 0.06, CMD_TERM_STRUCTURE: 0.05,
      // Balance sheet
      CMD_BALANCE_SHEET: 0.15,
      // Macro (recovery play)
      CMD_DXY_LINKAGE: 0.10,
      // Momentum
      CMD_MOMENTUM_12M: 0.05, CMD_MOMENTUM_1M: 0.05,
      // COT
      CMD_COT_COMMERCIAL: 0.09, CMD_OPEN_INTEREST: 0.05,
      // Seasonality
      CMD_SEASONALITY: 0.05, CMD_VOLATILITY: 0.05,
    },
  },
];

// ── Scenario Pack Engine ─────────────────────────────────────

export class CommodityScenarioEngine {
  /**
   * Compute a single scenario from individual factor signals.
   * factorSignals: map of factorId -> { signal, normalizedScore }
   */
  computeScenario(
    scenarioId: string,
    factorSignals: Map<string, { signal: 'green' | 'yellow' | 'red'; score: number }>,
  ): ScenarioOutput {
    const def = SCENARIOS.find(s => s.id === scenarioId);
    if (!def) throw new Error('Unknown scenario: ' + scenarioId);

    let weightedScore = 0;
    let totalWeight = 0;
    const factorContributions: { factorId: string; signal: 'green' | 'yellow' | 'red'; score: number }[] = [];

    const topBulls: { id: string; score: number }[] = [];
    const topBears: { id: string; score: number }[] = [];

    for (const [factorId, weight] of Object.entries(def.weights)) {
      const fs = factorSignals.get(factorId);
      if (!fs) continue; // factor not computed for this symbol set

      weightedScore += fs.score * weight;
      totalWeight += weight;

      factorContributions.push({ factorId, signal: fs.signal, score: fs.score });

      if (fs.score >= 70) topBulls.push({ id: factorId, score: fs.score });
      if (fs.score <= 30) topBears.push({ id: factorId, score: fs.score });
    }

    const aggregateScore = totalWeight > 0 ? weightedScore / totalWeight : 50;

    let aggregateSignal: 'green' | 'yellow' | 'red';
    if (aggregateScore >= def.bullishThreshold) aggregateSignal = 'green';
    else if (aggregateScore <= def.bearishThreshold) aggregateSignal = 'red';
    else aggregateSignal = 'yellow';

    // Sort bulls/bears
    topBulls.sort((a, b) => b.score - a.score);
    topBears.sort((a, b) => a.score - b.score);

    // Confidence: how far from 50 the score is, capped
    const confidence = Math.min(1, Math.abs(aggregateScore - 50) / 40);

    // Generate recommendation
    const recs: Record<string, { green: string; yellow: string; red: string }> = {
      'precious_metal_offense': {
        green: '做多贵金属：实际利率下降+ETF持续流入+地缘风险支撑，配置黄金为主、白银卫星',
        yellow: '贵金属中性：等待更明确信号。关注下周CPI和FOMC，若实际利率回落可加仓',
        red: '减仓贵金属：实际利率上升+美元走强+ETF流出，暂时回避等待回调',
      },
      'energy_trend': {
        green: '做多能源：库存持续去化+裂解价差扩大+地缘供应风险，逢低加仓',
        yellow: '能源中性：库存变化方向不明，裂解价差收窄，观望为主',
        red: '回避能源：库存超预期累积+需求疲软+裂解价差转负，暂时等待',
      },
      'industrial_metal_recovery': {
        green: '做多工业金属：LME注销仓单上升+现货贴水转升水+产业客户减空，配置铜铝为主',
        yellow: '工业金属中性：库存方向不明，关注中国PMI和LME周度库存数据',
        red: '回避工业金属：库存持续累积+现货大幅贴水+产业客户加空，等待去库存信号',
      },
    };

    const r = recs[scenarioId] ?? { green: '', yellow: '', red: '' };

    // Action items
    const actions: Record<string, string[]> = {
      'precious_metal_offense': [
        '检查黄金ETF持仓 (GLD/IAU) 日度资金流',
        '关注10年期TIPS实际利率走势',
        '监测金银比是否回到正常区间(55-80)',
        '设置黄金回调5%自动加仓提醒',
      ],
      'energy_trend': [
        '周三检查EIA原油库存报告(22:30)',
        '跟踪裂解价差(3-2-1)是否持续扩大',
        '关注OPEC+下次会议减产决定',
        '设置WTI突破前高自动追多提醒',
      ],
      'industrial_metal_recovery': [
        '每日检查LME注销仓单比例',
        '关注中国官方制造业PMI',
        '跟踪铜现货升贴水变化',
        '设置沪铜突破$10,000自动买入提醒',
      ],
    };

    const now = new Date();

    return {
      scenarioId: def.id,
      scenarioName: def.name,
      scenarioNameCN: def.nameCN,
      symbols: def.symbols,
      category: def.category,
      aggregateSignal,
      aggregateScore: Math.round(aggregateScore),
      confidence: Math.round(confidence * 100) / 100,
      factorSignals: factorContributions.slice(0, 10), // top 10
      topBullishFactors: topBulls.slice(0, 3).map(b => b.id),
      topBearishFactors: topBears.slice(0, 3).map(b => b.id),
      recommendation: r[aggregateSignal],
      reasoning: '基于' + factorContributions.length + '个因子综合打分。' +
        (topBulls.length > 0 ? '最强做多信号: ' + topBulls.slice(0, 2).map(b => b.id).join(', ') + '。' : '') +
        (topBears.length > 0 ? '最强做空信号: ' + topBears.slice(0, 2).map(b => b.id).join(', ') + '。' : ''),
      actionItems: actions[scenarioId] ?? [],
      generatedAt: now,
      validUntil: new Date(now.getTime() + 24 * 3600 * 1000),
    };
  }

  /** Compute all 3 scenarios */
  computeAllScenarios(
    factorSignals: Map<string, { signal: 'green' | 'yellow' | 'red'; score: number }>,
  ): ScenarioOutput[] {
    return SCENARIOS.map(s => {
      try {
        return this.computeScenario(s.id, factorSignals);
      } catch (e) {
        log.error('[Scenario] Failed ' + s.id, e);
        return this.emptyScenario(s);
      }
    });
  }

  private emptyScenario(def: ScenarioDefinition): ScenarioOutput {
    const now = new Date();
    return {
      scenarioId: def.id, scenarioName: def.name, scenarioNameCN: def.nameCN,
      symbols: def.symbols, category: def.category,
      aggregateSignal: 'yellow', aggregateScore: 50, confidence: 0,
      factorSignals: [], topBullishFactors: [], topBearishFactors: [],
      recommendation: '暂无数据', reasoning: '数据不足',
      actionItems: [], generatedAt: now,
      validUntil: new Date(now.getTime() + 3600_000),
    };
  }

  getScenarioIds(): string[] { return SCENARIOS.map(s => s.id); }
  getScenarioDef(scenarioId: string): ScenarioDefinition | undefined {
    return SCENARIOS.find(s => s.id === scenarioId);
  }
}

export const commodityScenarioEngine = new CommodityScenarioEngine();
