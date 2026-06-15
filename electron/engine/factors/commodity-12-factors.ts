// R199 J2: 12 New Commodity Factor Calculators — Final Round
// L3 COT (5): CMD_COT_COMMERCIAL, CMD_COT_SPECULATOR, CMD_COT_EXTREME,
//              CMD_COT_CHANGE, CMD_OPEN_INTEREST
// L4 Macro (4): CMD_DXY_LINKAGE, CMD_REAL_RATE, CMD_INFLATION_BE, CMD_GEOPOL_RISK
// L5 Ratio (3): CMD_GOLD_SILVER_RATIO, CMD_GOLD_OIL_RATIO, CMD_CRACK_SPREAD
// PM: "最后一轮12因子，打出完美收官"

import log from 'electron-log';
import {
  CommodityFactorInput, CommodityCategory,
  CFTCData, InflationData, GPRData, CrossCommodityData,
  GoldETFGlobalData,
} from './commodity-types';
import { cftcAdapter } from './cftc-cot-adapter';
import { tipsInflationAdapter, InflationData as TIPSInflationData } from './tips-inflation-adapter';
import { geopoliticalRiskAdapter, GPRData as GPRiskData } from './geopolitical-risk-adapter';
import { crossCommodityAdapter, CrossCommodityData as CrossData } from './cross-commodity-adapter';
import { goldETFAdapter, GoldETFGlobalData as GoldETFDataNew } from './gold-etf-adapter';

// ── Factor Output (consistent with R198) ─────────────────────

interface CommodityFactorOutput {
  factorId: string;
  symbol: string;
  category: CommodityCategory;
  signal: 'green' | 'yellow' | 'red';
  value: number;
  normalized: number;          // 0-100
  humanText: string;
}

// ── Base Calculator ──────────────────────────────────────────

abstract class CommodityFactorCalculator {
  abstract readonly factorId: string;
  abstract readonly label: string;
  abstract readonly labelCN: string;
  abstract readonly level1: string;
  abstract readonly level2: string;

  abstract compute(ctx: FactorComputeContext): CommodityFactorOutput;

  protected normalize(v: number, min: number, max: number): number {
    if (min === max) return 50;
    const clamped = Math.max(min, Math.min(max, v));
    return ((clamped - min) / (max - min)) * 100;
  }

  protected noData(factorId: string, symbol: string, category: CommodityCategory, msg: string): CommodityFactorOutput {
    return { factorId, symbol, category, signal: 'yellow', value: 0, normalized: 50, humanText: msg };
  }
}

// ── Extended compute context (beyond CommodityFactorInput) ───

interface FactorComputeContext extends CommodityFactorInput {
  cftcData?: CFTCData;
  inflationData?: TIPSInflationData;
  gprData?: GPRiskData;
  crossData?: CrossData;
  goldETFDataNew?: GoldETFDataNew;
}

// ═════════════════════════════════════════════════════════════
// L3 COT 因子 (5) — "大佬底牌"系列
// ═════════════════════════════════════════════════════════════

// ── CMD_COT_COMMERCIAL 🟢 商业持仓 ──────────────────────────

class CMD_COT_COMMERCIAL_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_COT_COMMERCIAL';
  readonly label = 'COT Commercial Net Position';
  readonly labelCN = '商业持仓(产业套保)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_COT';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.cftcData) return this.noData('CMD_COT_COMMERCIAL', ctx.symbol, ctx.category, '暂无COT数据');

    const c = ctx.cftcData;
    // Commercial net = commLong - commShort
    // Commercials are usually net short (hedgers). When they reduce shorts, bullish.
    // Human: "产业链玩家在减空单→看涨" / "产业在加空→供给充裕偏空"
    const val = c.commNet / Math.max(1, c.totalOI);
    const norm = this.normalize(val, -0.5, 0.1);

    // Commercial net less negative (closer to zero or positive) = 🟢
    const sig: 'green' | 'yellow' | 'red' =
      val > -0.1 ? 'green' : val < -0.3 ? 'red' : 'yellow';

    const h = '产业客户净空单占比 ' + Math.abs(val * 100).toFixed(1) + '%' +
      (sig === 'green' ? ' (产业减空→看涨信号)' :
       sig === 'red' ? ' (产业加空→供给充裕→偏空)' : ' (中性偏多)');

    return { factorId: 'CMD_COT_COMMERCIAL', symbol: ctx.symbol, category: ctx.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_COT_SPECULATOR 🟡 投机持仓 ──────────────────────────

class CMD_COT_SPECULATOR_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_COT_SPECULATOR';
  readonly label = 'COT Speculator (MM) Net Position';
  readonly labelCN = '投机持仓(聪明钱)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_COT';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.cftcData) return this.noData('CMD_COT_SPECULATOR', ctx.symbol, ctx.category, '暂无COT数据');

    const c = ctx.cftcData;
    // Money Manager net position as % of total OI
    const val = c.mmNet / Math.max(1, c.totalOI);
    const norm = this.normalize(val, -0.3, 0.3);

    const sig = c.signal; // from CFTC adapter: mmNet > prevNet → green

    const h = '投机净' + (c.mmNet > 0 ? '多' : '空') + '单占比 ' + (Math.abs(val) * 100).toFixed(1) + '%' +
      (val > 0.15 ? ' (投机强烈看多)' :
       val < -0.15 ? ' (投机强烈看空)' :
       val > 0 ? ' (轻微看多)' : ' (轻微看空)');

    return { factorId: 'CMD_COT_SPECULATOR', symbol: ctx.symbol, category: ctx.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_COT_EXTREME 🔴 极端持仓 ─────────────────────────────

class CMD_COT_EXTREME_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_COT_EXTREME';
  readonly label = 'COT Extreme Positioning';
  readonly labelCN = '极端持仓(拥挤信号)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_COT';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.cftcData) return this.noData('CMD_COT_EXTREME', ctx.symbol, ctx.category, '暂无COT数据');

    const c = ctx.cftcData;
    // When MM is overwhelmingly long or short → crowded trade → potential reversal
    const mmPctLong = c.mmPctLong; // % of MM longs within MM total
    const hedgingPressure = c.hedgingPressure; // comm short / total OI

    // Extreme = MM >70% long AND hedging pressure >50% → crowded long = 🔴 reversal risk
    // OR MM <30% long AND hedging pressure <20% → crowded short = 🟢 reversal potential
    let sig: 'green' | 'yellow' | 'red';
    let val: number;
    let h: string;

    if (mmPctLong > 75) {
      sig = 'red'; val = mmPctLong / 100 - 0.75;
      h = '投机多单极度拥挤(多头占比' + mmPctLong.toFixed(0) + '%)，反向风险高';
    } else if (mmPctLong < 35) {
      sig = 'green'; val = 0.35 - mmPctLong / 100;
      h = '投机空单拥挤(多头仅' + mmPctLong.toFixed(0) + '%)，轧空可能';
    } else {
      sig = 'yellow'; val = Math.abs(mmPctLong - 55) / 100;
      h = '投机持仓分布正常(多头' + mmPctLong.toFixed(0) + '%)';
    }

    const norm = this.normalize(val, 0, 0.5);

    return { factorId: 'CMD_COT_EXTREME', symbol: ctx.symbol, category: ctx.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_COT_CHANGE 🟢 仓位变化方向 ──────────────────────────

class CMD_COT_CHANGE_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_COT_CHANGE';
  readonly label = 'COT Position Change (Momentum)';
  readonly labelCN = '仓位变化方向(大佬在加仓还是减仓)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_COT';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.cftcData) return this.noData('CMD_COT_CHANGE', ctx.symbol, ctx.category, '暂无COT数据');

    const c = ctx.cftcData;
    // MM net position change as % of total OI
    const val = c.mmNetChange / Math.max(1, c.totalOI);
    const norm = this.normalize(val, -0.10, 0.10);

    const sig: 'green' | 'yellow' | 'red' =
      val > 0.02 ? 'green' : val < -0.02 ? 'red' : 'yellow';

    const dir = c.mmNetChange > 0 ? '加仓做多' : '减仓';
    const h = '投机本周' + dir + ' ' + Math.abs(c.mmNetChange).toFixed(0) + '手' +
      (sig === 'green' ? ' (大佬在跟风加多)' :
       sig === 'red' ? ' (大佬在撤)' : '');

    return { factorId: 'CMD_COT_CHANGE', symbol: ctx.symbol, category: ctx.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_OPEN_INTEREST 🟡 总持仓量 ────────────────────────────

class CMD_OPEN_INTEREST_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_OPEN_INTEREST';
  readonly label = 'Open Interest Trend';
  readonly labelCN = '总持仓量趋势(市场参与度)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_COT';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.cftcData) return this.noData('CMD_OPEN_INTEREST', ctx.symbol, ctx.category, '暂无COT数据');

    const c = ctx.cftcData;
    // Normalize OI relative to symbol-typical levels
    const typical: Record<string, number> = {
      'GC': 500000, 'SI': 150000, 'CL': 1800000, 'NG': 1200000,
      'HG': 250000, 'ZC': 1200000, 'ZS': 800000, 'ZW': 400000,
    };
    const base = typical[ctx.symbol] ?? 500000;
    const ratio = c.totalOI / base;
    const norm = this.normalize(ratio, 0.5, 1.5);

    // Rising OI = market participation increasing = trend likely to continue
    const sig: 'green' | 'yellow' | 'red' =
      ratio > 1.2 ? 'green' : ratio < 0.8 ? 'red' : 'yellow';

    const h = '总持仓 ' + (c.totalOI / 1000).toFixed(0) + 'K手 (' +
      (ratio > 1.1 ? '高于均值' : ratio < 0.9 ? '低于均值' : '接近均值') + ')' +
      (sig === 'green' ? '(市场参与活跃→趋势延续)' :
       sig === 'red' ? '(参与度低→方向不明确)' : '');

    return { factorId: 'CMD_OPEN_INTEREST', symbol: ctx.symbol, category: ctx.category, signal: sig, value: ratio, normalized: Math.round(norm), humanText: h };
  }
}

// ═════════════════════════════════════════════════════════════
// L4 宏观因子 (4) — "大环境"系列
// ═════════════════════════════════════════════════════════════

// ── CMD_DXY_LINKAGE 🟢 美元联动 ─────────────────────────────

class CMD_DXY_LINKAGE_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_DXY_LINKAGE';
  readonly label = 'DXY Linkage';
  readonly labelCN = '美元联动(强美元=商品压力)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_MACRO';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.inflationData) return this.noData('CMD_DXY_LINKAGE', ctx.symbol, ctx.category, '暂无美元数据');

    const d = ctx.inflationData;
    // PM: "强美元=商品压力" — DXY rising = commodity bearish
    // Invert: falling DXY = 🟢 for commodities
    const val = -d.dxy1MChange; // invert so positive = commodity-friendly
    const norm = this.normalize(val, -3, 3);

    const sig: 'green' | 'yellow' | 'red' =
      d.dxy1MChange < -1 ? 'green'      // dollar falling = commodities up
      : d.dxy1MChange > 1 ? 'red'       // dollar rising = commodities down
      : 'yellow';

    const dir = d.dxy1MChange > 0 ? '走强' : '走弱';
    const h = '美元指数(DXY) ' + d.dxy.toFixed(0) + ' 近1月' + dir + Math.abs(d.dxy1MChange).toFixed(1) + '%' +
      (sig === 'green' ? '(美元弱→商品涨)' :
       sig === 'red' ? '(美元强→压制商品)' : '');

    return { factorId: 'CMD_DXY_LINKAGE', symbol: ctx.symbol, category: ctx.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_REAL_RATE 🔴 实际利率 ────────────────────────────────

class CMD_REAL_RATE_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_REAL_RATE';
  readonly label = 'Real Rate Impact';
  readonly labelCN = '实际利率(黄金的天敌)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_MACRO';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.inflationData) return this.noData('CMD_REAL_RATE', ctx.symbol, ctx.category, '暂无实际利率数据');

    const d = ctx.inflationData;
    // PM: "实际利率↑ = 黄金的天敌" — real rate rising = bearish for gold (& other commodities)
    // Invert: falling real rate = 🟢
    const val = -d.realRateChange; // invert
    const norm = this.normalize(val, -0.15, 0.15);

    const sig = d.signal; // from TIPS adapter

    const h = '10年TIPS实际利率 ' + d.realRate10Y.toFixed(2) + '%' +
      (d.realRateChange > 0 ? '(↑' + d.realRateChange.toFixed(2) + '%)' : '(↓' + Math.abs(d.realRateChange).toFixed(2) + '%)') +
      (sig === 'red' ? '(实际利率上升→持有黄金机会成本增加)' :
       sig === 'green' ? '(实际利率下降→利好无息资产黄金)' : '');

    return { factorId: 'CMD_REAL_RATE', symbol: ctx.symbol, category: ctx.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_INFLATION_BE 🟢 通胀预期 ────────────────────────────

class CMD_INFLATION_BE_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_INFLATION_BE';
  readonly label = 'Inflation Breakeven';
  readonly labelCN = '通胀预期(通胀升=黄金升)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_MACRO';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.inflationData) return this.noData('CMD_INFLATION_BE', ctx.symbol, ctx.category, '暂无通胀数据');

    const d = ctx.inflationData;
    // Higher BEIR = market expects more inflation = bullish commodities (hedge demand)
    const val = d.beir10Y;
    const norm = this.normalize(val, 1.5, 3.0);

    const sig: 'green' | 'yellow' | 'red' =
      val > 2.5 ? 'green' : val < 2.0 ? 'red' : 'yellow';

    const h = '10年盈亏平衡通胀率 ' + val.toFixed(2) + '%' +
      (sig === 'green' ? ' (通胀预期升温→商品对冲需求↑)' :
       sig === 'red' ? ' (通胀预期低→商品缺乏通胀支撑)' :
       ' (通胀预期温和)');

    return { factorId: 'CMD_INFLATION_BE', symbol: ctx.symbol, category: ctx.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_GEOPOL_RISK 🟢 地缘风险 ─────────────────────────────

class CMD_GEOPOL_RISK_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_GEOPOL_RISK';
  readonly label = 'Geopolitical Risk Premium';
  readonly labelCN = '地缘风险溢价';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_MACRO';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.gprData) return this.noData('CMD_GEOPOL_RISK', ctx.symbol, ctx.category, '暂无地缘风险数据');

    const g = ctx.gprData;
    // GPR percentile: high = risk-on for commodities
    const val = g.percentile;
    const norm = val; // already 0-100
    const sig = g.signal;

    const h = geopoliticalRiskAdapter.getStory(g);

    return { factorId: 'CMD_GEOPOL_RISK', symbol: ctx.symbol, category: ctx.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ═════════════════════════════════════════════════════════════
// L5 比价因子 (3) — "跨品种比价"系列
// ═════════════════════════════════════════════════════════════

// ── CMD_GOLD_SILVER_RATIO 🟡 金银比 ─────────────────────────

class CMD_GOLD_SILVER_RATIO_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_GOLD_SILVER_RATIO';
  readonly label = 'Gold/Silver Ratio';
  readonly labelCN = '金银比(避险vs风险偏好)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_RATIO';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.crossData) return this.noData('CMD_GOLD_SILVER_RATIO', ctx.symbol, ctx.category, '暂无比价数据');

    const c = ctx.crossData;
    const val = c.goldSilverRatio;
    const norm = this.normalize(val, 50, 95);

    // High GSR = extreme risk aversion = likely mean-revert downward → 🟡 trade opportunity
    // Low GSR = risk appetite, silver outperforming
    const sig = c.goldSilverSignal;
    const h = crossCommodityAdapter.getGoldSilverStory(c);

    return { factorId: 'CMD_GOLD_SILVER_RATIO', symbol: ctx.symbol, category: ctx.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_GOLD_OIL_RATIO 🟡 金油比 ────────────────────────────

class CMD_GOLD_OIL_RATIO_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_GOLD_OIL_RATIO';
  readonly label = 'Gold/Oil Ratio';
  readonly labelCN = '金油比(衰退指针)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_RATIO';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.crossData) return this.noData('CMD_GOLD_OIL_RATIO', ctx.symbol, ctx.category, '暂无比价数据');

    const c = ctx.crossData;
    const val = c.goldOilRatio;
    const norm = this.normalize(val, 25, 70);

    const sig = c.goldOilSignal;
    const h = crossCommodityAdapter.getGoldOilStory(c);

    return { factorId: 'CMD_GOLD_OIL_RATIO', symbol: ctx.symbol, category: ctx.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_CRACK_SPREAD 🟢 裂解价差 ────────────────────────────

class CMD_CRACK_SPREAD_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_CRACK_SPREAD';
  readonly label = 'Crack Spread (3-2-1)';
  readonly labelCN = '裂解价差(炼油利润)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_RATIO';

  compute(ctx: FactorComputeContext): CommodityFactorOutput {
    if (!ctx.crossData) return this.noData('CMD_CRACK_SPREAD', ctx.symbol, ctx.category, '暂无比价数据');

    const c = ctx.crossData;
    const val = c.crackSpread;
    const norm = this.normalize(val, -5, 40);

    const sig = c.crackSpreadSignal;
    const h = crossCommodityAdapter.getCrackSpreadStory(c);

    return { factorId: 'CMD_CRACK_SPREAD', symbol: ctx.symbol, category: ctx.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── Calculator Registry (12 factors) ─────────────────────────

export const COMMODITY_12_FACTORS: Record<string, CommodityFactorCalculator> = {
  // L3 COT (5)
  CMD_COT_COMMERCIAL: new CMD_COT_COMMERCIAL_Calc(),
  CMD_COT_SPECULATOR: new CMD_COT_SPECULATOR_Calc(),
  CMD_COT_EXTREME: new CMD_COT_EXTREME_Calc(),
  CMD_COT_CHANGE: new CMD_COT_CHANGE_Calc(),
  CMD_OPEN_INTEREST: new CMD_OPEN_INTEREST_Calc(),
  // L4 Macro (4)
  CMD_DXY_LINKAGE: new CMD_DXY_LINKAGE_Calc(),
  CMD_REAL_RATE: new CMD_REAL_RATE_Calc(),
  CMD_INFLATION_BE: new CMD_INFLATION_BE_Calc(),
  CMD_GEOPOL_RISK: new CMD_GEOPOL_RISK_Calc(),
  // L5 Ratio (3)
  CMD_GOLD_SILVER_RATIO: new CMD_GOLD_SILVER_RATIO_Calc(),
  CMD_GOLD_OIL_RATIO: new CMD_GOLD_OIL_RATIO_Calc(),
  CMD_CRACK_SPREAD: new CMD_CRACK_SPREAD_Calc(),
};

export function getCommodity12FactorCalculator(factorId: string): CommodityFactorCalculator | undefined {
  return COMMODITY_12_FACTORS[factorId];
}

/** Compute all 12 R199 factors with full context */
export async function compute12Factors(
  symbol: string,
  category: CommodityCategory,
  baseInput: CommodityFactorInput
): Promise<CommodityFactorOutput[]> {
  // Enrich context
  const ctx: FactorComputeContext = { ...baseInput };

  try {
    const cftc = await cftcAdapter.fetchPositions(symbol);
    if (cftc) ctx.cftcData = cftc;
  } catch (e) { log.warn('[12F] CFTC fetch failed for ' + symbol); }

  try {
    const inflation = await tipsInflationAdapter.fetchInflation('GC');
    if (inflation) ctx.inflationData = inflation;
  } catch (e) { log.warn('[12F] Inflation fetch failed'); }

  try {
    const gpr = await geopoliticalRiskAdapter.fetchGPR('GC');
    if (gpr) ctx.gprData = gpr;
  } catch (e) { log.warn('[12F] GPR fetch failed'); }

  try {
    const cross = await crossCommodityAdapter.fetchRatios('GC');
    if (cross) ctx.crossData = cross;
  } catch (e) { log.warn('[12F] Cross ratio fetch failed'); }

  const results: CommodityFactorOutput[] = [];
  for (const calc of Object.values(COMMODITY_12_FACTORS)) {
    try {
      results.push(calc.compute(ctx));
    } catch (e) {
      log.error('[12F] Failed ' + calc.factorId + ' for ' + symbol, e);
      results.push({
        factorId: calc.factorId, symbol, category,
        signal: 'yellow', value: 0, normalized: 50,
        humanText: '计算错误',
      });
    }
  }
  return results;
}

export function getAll12FactorIds(): string[] {
  return Object.keys(COMMODITY_12_FACTORS);
}
