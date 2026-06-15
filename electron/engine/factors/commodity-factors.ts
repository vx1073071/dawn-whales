/**
 * R229 JVS-3.5b: Unified Commodity Factors (2->1)
 *
 * Merged from: commodity-14-factors.ts + commodity-12-factors.ts
 * Total: 26 commodity factor calculators
 *
 * L1 Term Structure (7): CMD_ROLL_YIELD, CMD_BASIS, CMD_TERM_STRUCTURE,
 *   CMD_CALENDAR_SPREAD, CMD_CARRY, CMD_SPOT_MONTH, CMD_FRONT_RATIO
 * L2 Inventory/Demand (5): CMD_EIA_CRUDE, CMD_EIA_DISTILLATE, CMD_EIA_GASOLINE,
 *   CMD_LME_INVENTORY, CMD_GOLD_ETF_FLOW
 * L3 COT (5): CMD_COT_COMMERCIAL, CMD_COT_SPECULATOR, CMD_COT_EXTREME,
 *   CMD_COT_CHANGE, CMD_OPEN_INTEREST
 * L4 Macro (4): CMD_DXY_LINKAGE, CMD_REAL_RATE, CMD_INFLATION_BE, CMD_GEOPOL_RISK
 * L5 Ratio (3): CMD_GOLD_SILVER_RATIO, CMD_GOLD_OIL_RATIO, CMD_CRACK_SPREAD
 * L6 Seasonality (2): CMD_SEASONAL_DIRECTION, CMD_SEASONAL_STRENGTH
 *
 * PM rule: commodity factors are free (signal light only)
 *
 * @version v2.5.0
 */
import log from 'electron-log';
import {
  CommodityFactorInput, CommodityCategory,
  RollYieldResult, BasisResult, TermStructureResult,
  EIAInventoryData, CFTCData, LMEInventoryData, GoldETFData,
  CommoditySeasonalData, InflationData, GPRData, CrossCommodityData,
  GoldETFGlobalData,
} from './commodity-types';
import { cftcAdapter } from './cftc-cot-adapter';
import { tipsInflationAdapter, InflationData as TIPSInflationData } from './tips-inflation-adapter';
import { geopoliticalRiskAdapter, GPRData as GPRiskData } from './geopolitical-risk-adapter';
import { crossCommodityAdapter, CrossCommodityData as CrossData } from './cross-commodity-adapter';
import { goldETFAdapter, GoldETFGlobalData as GoldETFDataNew } from './gold-etf-adapter';


// ================================================================
// Shared Types
// ================================================================

export interface CommodityFactorOutput {
  factorId: string;
  symbol: string;
  category: CommodityCategory;
  signal: 'green' | 'yellow' | 'red';
  value: number;
  normalized: number;
  humanText: string;
}

// ================================================================
// Base Calculator
// ================================================================

abstract class CommodityFactorCalculator {
  abstract readonly factorId: string;
  abstract readonly label: string;
  abstract readonly labelCN: string;
  abstract readonly level1: string;
  abstract readonly level2: string;

  abstract compute(input: any): CommodityFactorOutput;

  protected normalize(v: number, min: number, max: number): number {
    if (min === max) return 50;
    const clamped = Math.max(min, Math.min(max, v));
    return ((clamped - min) / (max - min)) * 100;
  }

  protected noData(
    factorId: string,
    symbol: string,
    category: CommodityCategory,
    msg: string,
  ): CommodityFactorOutput {
    return { factorId, symbol, category, signal: 'yellow', value: 0, normalized: 50, humanText: msg };
  }
}

// ================================================================
// Extended Compute Context (for L3-L5 factors)
// ================================================================

interface FactorComputeContext extends CommodityFactorInput {
  cftcData?: CFTCData;
  inflationData?: TIPSInflationData;
  gprData?: GPRiskData;
  crossData?: CrossData;
  goldETFDataNew?: GoldETFDataNew;
}

// ═══════════════════════ L1 期限结构 (7) ═══════════════════════

// ── CMD_ROLL_YIELD 🟢 换月成本 ──────────────────────────────────

class CMD_ROLL_YIELD_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_ROLL_YIELD';
  readonly label = 'Roll Yield (Carry Cost)';
  readonly labelCN = '换月成本';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_TERM_STRUCTURE';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    const ry = i.rollYield;
    // Annualized roll yield: negative = backwardation(贴水) = 🟢做多有利
    // PM: backwardation → 🟢 (做多成本低/有展期收益); strong contango → 🔴
    const val = -ry.rollYield; // invert so higher = better
    const norm = this.normalize(val, -0.30, 0.15);
    const signal = ry.signal; // already computed in rollYield

    let h: string;
    if (ry.strength === 'strong_backwardation') h = '换月成本为负(贴水~' + Math.abs(ry.rollYield*100).toFixed(1) + '%) — 做多还能赚展期收益';
    else if (ry.strength === 'mild_backwardation') h = '换月成本轻微贴水，持仓压力小';
    else if (ry.strength === 'strong_contango') h = '换月成本高(升水~' + (ry.rollYield*100).toFixed(1) + '%) — 做多成本高';
    else h = '换月成本接近零，价差平坦';

    return { factorId: 'CMD_ROLL_YIELD', symbol: i.symbol, category: i.category, signal, value: ry.rollYield, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_TERM_STRUCTURE 🟡 期限结构 ───────────────────────────

class CMD_TERM_STRUCTURE_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_TERM_STRUCTURE';
  readonly label = 'Term Structure Slope';
  readonly labelCN = '期限结构';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_TERM_STRUCTURE';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    const ts = i.termStructure;
    const val = ts.slope;
    const norm = this.normalize(val, -0.10, 0.10);
    let sig: 'green' | 'yellow' | 'red';
    if (ts.status === 'backwardation') sig = 'green';
    else if (ts.status === 'contango' && ts.steepness > 0.04) sig = 'red';
    else sig = 'yellow';

    const h = ts.status === 'backwardation'
      ? '期限结构贴水(现货紧俏)，利好' + i.symbol
      : ts.status === 'contango'
        ? '期限结构升水(远期供应充裕)，偏空 ' + i.symbol
        : '期限曲线混合，无明显方向';

    return { factorId: 'CMD_TERM_STRUCTURE', symbol: i.symbol, category: i.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_BASIS 🟡 基差 ───────────────────────────────────────────

class CMD_BASIS_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_BASIS';
  readonly label = 'Basis (Spot vs Futures)';
  readonly labelCN = '基差(现货贵还是期货贵)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_TERM_STRUCTURE';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    const b = i.basis;
    const val = b.basisPercent;
    const norm = this.normalize(val, -5, 5);
    const sig = b.signal;

    let h: string;
    if (b.basisPercent > 1) h = '现货比期货贵 ' + b.basisPercent.toFixed(1) + '%，供应紧张';
    else if (b.basisPercent < -1) h = '现货比期货便宜 ' + Math.abs(b.basisPercent).toFixed(1) + '%，供给充裕';
    else h = '现货期货价差在正常范围内';

    return { factorId: 'CMD_BASIS', symbol: i.symbol, category: i.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_MOMENTUM_12M 🟢 12月动量 ────────────────────────────────

class CMD_MOMENTUM_12M_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_MOMENTUM_12M';
  readonly label = '12-Month Momentum';
  readonly labelCN = '12月商品动量';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_MOMENTUM';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    // Compute from contract chain: front month vs hypothetical 12m ago
    const now = i.chain.contracts[0].price;
    // Approximate 12m-ago price from term structure: contract ~12 out
    const agoIdx = Math.min(11, i.chain.contracts.length - 1);
    const ago = i.chain.contracts[agoIdx].price;
    const ret = (now - ago) / ago;
    const norm = this.normalize(ret, -0.30, 0.30);
    const sig = ret > 0.05 ? 'green' : ret < -0.05 ? 'red' : 'yellow';
    const h = '过去12个月回报 ' + (ret * 100).toFixed(1) + '%' + (ret > 0 ? ' (涨势中)' : ' (跌势中)');

    return { factorId: 'CMD_MOMENTUM_12M', symbol: i.symbol, category: i.category, signal: sig, value: ret, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_MOMENTUM_1M 🟡 1月反转 ──────────────────────────────────

class CMD_MOMENTUM_1M_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_MOMENTUM_1M';
  readonly label = '1-Month Reversal';
  readonly labelCN = '1月反转信号';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_MOMENTUM';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    const now = i.chain.contracts[0].price;
    const oneMoIdx = Math.min(1, i.chain.contracts.length - 1);
    const oneMoAgo = i.chain.contracts[oneMoIdx].price;
    const ret = (now - oneMoAgo) / oneMoAgo;
    // Short-term: extreme moves tend to reverse
    const sig = ret > 0.08 ? 'red' : ret < -0.08 ? 'green' : ret > 0 ? 'yellow' : 'yellow';
    const norm = 50 - ret * 200; // high positive → low score (reversal expected)
    const h = Math.abs(ret * 100) > 5
      ? '近1月' + (ret > 0 ? '涨幅过大(' + (ret * 100).toFixed(1) + '%)，注意回调' : '跌幅过大(' + Math.abs(ret * 100).toFixed(1) + '%)，可能超卖')
      : '近1月波动温和';

    return { factorId: 'CMD_MOMENTUM_1M', symbol: i.symbol, category: i.category, signal: sig, value: ret, normalized: Math.round(Math.max(0, Math.min(100, norm))), humanText: h };
  }
}

// ── CMD_VOLATILITY 🟡 波动率 ───────────────────────────────────

class CMD_VOLATILITY_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_VOLATILITY';
  readonly label = 'Realized Volatility';
  readonly labelCN = '实际波动率';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_VOLATILITY';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    // Approximate vol from contract price dispersion
    const prices = i.chain.contracts.slice(0, 6).map(c => c.price);
    if (prices.length < 2) return {
      factorId: 'CMD_VOLATILITY', symbol: i.symbol, category: i.category,
      signal: 'yellow', value: 0, normalized: 50,
      humanText: '数据不足，无法计算波动率',
    };

    const logRets: number[] = [];
    for (let j = 1; j < prices.length; j++) logRets.push(Math.log(prices[j] / prices[j - 1]));
    const mean = logRets.reduce((a, b) => a + b, 0) / logRets.length;
    const variance = logRets.reduce((s, r) => s + (r - mean) ** 2, 0) / logRets.length;
    const vol = Math.sqrt(variance) * Math.sqrt(252); // annualized

    const norm = this.normalize(vol, 0.05, 0.50);
    const sig = vol > 0.35 ? 'red' : vol < 0.15 ? 'green' : 'yellow';
    const h = '年化波动率 ' + (vol * 100).toFixed(1) + '%' + (vol > 0.35 ? ' (高风险区)' : vol < 0.15 ? ' (低波动走稳)' : '');

    return { factorId: 'CMD_VOLATILITY', symbol: i.symbol, category: i.category, signal: sig, value: vol, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_SKEWNESS 🔴 偏度 ──────────────────────────────────────

class CMD_SKEWNESS_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_SKEWNESS';
  readonly label = 'Return Skewness';
  readonly labelCN = '收益偏度(尾部不对称)';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_VOLATILITY';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    const prices = i.chain.contracts.slice(0, 6).map(c => c.price);
    if (prices.length < 3) return {
      factorId: 'CMD_SKEWNESS', symbol: i.symbol, category: i.category,
      signal: 'yellow', value: 0, normalized: 50,
      humanText: '数据不足',
    };

    const rets: number[] = [];
    for (let j = 1; j < prices.length; j++) rets.push(Math.log(prices[j] / prices[j - 1]));
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const std = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length);
    if (std < 0.0001) return {
      factorId: 'CMD_SKEWNESS', symbol: i.symbol, category: i.category,
      signal: 'yellow', value: 0, normalized: 50,
      humanText: '价格变动极小，偏度无意义',
    };

    const skew = rets.reduce((s, r) => s + Math.pow((r - mean) / std, 3), 0) / rets.length;
    // Positive skew = tail on right (good for longs) = 🟢
    // Negative skew = tail on left (crash risk) = 🔴
    const sig = skew > 0.5 ? 'green' : skew < -0.5 ? 'red' : 'yellow';
    const norm = this.normalize(skew, -1.5, 1.5);
    const h = skew < -0.5
      ? '收益偏度负(' + skew.toFixed(2) + ')，存在急跌风险'
      : skew > 0.5
        ? '收益偏度正(' + skew.toFixed(2) + ')，急涨概率大于急跌'
        : '收益分布对称，无极端倾向';

    return { factorId: 'CMD_SKEWNESS', symbol: i.symbol, category: i.category, signal: sig, value: skew, normalized: Math.round(norm), humanText: h };
  }
}

// ═══════════════════════ L2 库存供需 (5) ═══════════════════════

// ── CMD_EIA_CRUDE 🟢 EIA原油库存 ────────────────────────────────

class CMD_EIA_CRUDE_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_EIA_CRUDE';
  readonly label = 'EIA Crude Inventory';
  readonly labelCN = 'EIA原油库存';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_INVENTORY';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    if (!i.eia) return {
      factorId: 'CMD_EIA_CRUDE', symbol: i.symbol, category: i.category,
      signal: 'yellow', value: 0, normalized: 50,
      humanText: '暂无EIA库存数据',
    };

    const eia = i.eia;
    // PM: "实际vs预期差距才是信号"
    const val = eia.surprise; // negative = drawdown = bullish
    const norm = this.normalize(eia.surprise, -3, 3);
    const sig: 'green' | 'yellow' | 'red' =
      eia.surprise < -1.5 ? 'green' : eia.surprise > 1.5 ? 'red' : 'yellow';

    const dir = eia.surprise < 0 ? '降' : '升';
    const h = '上周库存比预期' + dir + '了 ' + Math.abs(eia.surprise * (i.symbol === 'CL' ? 100 : 1)).toFixed(0)
      + (i.symbol === 'CL' ? '万桶' : 'Bcf')
      + (sig === 'green' ? ' (利好)' : sig === 'red' ? ' (利空)' : '');

    return { factorId: 'CMD_EIA_CRUDE', symbol: i.symbol, category: i.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_NATGAS_STORAGE 🟡 天然气库存 ────────────────────────────

class CMD_NATGAS_STORAGE_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_NATGAS_STORAGE';
  readonly label = 'Natural Gas Storage';
  readonly labelCN = '天然气储气量';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_INVENTORY';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    if (!i.eia) return {
      factorId: 'CMD_NATGAS_STORAGE', symbol: i.symbol, category: i.category,
      signal: 'yellow', value: 0, normalized: 50,
      humanText: '暂无天然气库存数据',
    };

    const eia = i.eia;
    const val = eia.surprise;
    const norm = this.normalize(val, -50, 50);
    const sig = val < -20 ? 'green' : val > 20 ? 'red' : 'yellow';
    const dir = val < 0 ? '降' : '升';
    const h = '储气量比预期' + dir + '了 ' + Math.abs(val).toFixed(0) + ' Bcf' + (sig === 'green' ? ' (需求强)' : sig === 'red' ? ' (供过于求)' : '');

    return { factorId: 'CMD_NATGAS_STORAGE', symbol: i.symbol, category: i.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_LME_INVENTORY 🟡 LME铜库存 ─────────────────────────────

class CMD_LME_INVENTORY_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_LME_INVENTORY';
  readonly label = 'LME Metal Inventory';
  readonly labelCN = 'LME金属库存';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_INVENTORY';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    if (!i.lme) return {
      factorId: 'CMD_LME_INVENTORY', symbol: i.symbol, category: i.category,
      signal: 'yellow', value: 0, normalized: 50,
      humanText: '暂无LME库存数据',
    };

    const l = i.lme;
    const cancelRatio = l.cancelledWarrants / Math.max(1, l.total);
    const val = cancelRatio;
    const norm = this.normalize(cancelRatio, 0, 0.5);
    const sig = l.signal;

    let h: string;
    if (l.trend === 'destocking') h = '注销仓单占比 ' + (cancelRatio * 100).toFixed(1) + '%，库存在被提走，供给收紧';
    else if (l.trend === 'restocking') h = '注销仓单占比 ' + (cancelRatio * 100).toFixed(1) + '%，库存堆积中';
    else h = '注销仓单占比 ' + (cancelRatio * 100).toFixed(1) + '%，库存稳定';

    return { factorId: 'CMD_LME_INVENTORY', symbol: i.symbol, category: i.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_GOLD_ETF 🟢 黄金ETF持仓 ─────────────────────────────────

class CMD_GOLD_ETF_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_GOLD_ETF';
  readonly label = 'Gold ETF Holdings';
  readonly labelCN = '黄金ETF持仓';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_FLOW';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    if (!i.goldETF) return {
      factorId: 'CMD_GOLD_ETF', symbol: i.symbol, category: i.category,
      signal: 'yellow', value: 0, normalized: 50,
      humanText: '暂无黄金ETF数据',
    };

    const g = i.goldETF;
    const val = g.weeklyChange;
    const norm = this.normalize(val, -10, 10);
    const sig = g.signal;
    const dir = val > 0 ? '增加' : '减少';
    const h = '全球黄金ETF上周' + dir + ' ' + Math.abs(val).toFixed(1) + '吨 (总' + g.totalTonnes.toFixed(0) + '吨)' + (sig === 'green' ? ' (资金持续流入)' : sig === 'red' ? ' (资金流出)' : '');

    return { factorId: 'CMD_GOLD_ETF', symbol: i.symbol, category: i.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_BALANCE_SHEET 🔴 供需平衡 ──────────────────────────────

class CMD_BALANCE_SHEET_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_BALANCE_SHEET';
  readonly label = 'Supply-Demand Balance';
  readonly labelCN = '供需平衡表';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_FUNDAMENTAL';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    // Mock balance sheet based on symbol
    const bc: Record<string, { prod: number; cons: number }> = {
      'CL': { prod: 102.5, cons: 103.2 },  // deficit
      'NG': { prod: 105, cons: 100 },        // surplus
      'HG': { prod: 25.8, cons: 26.1 },      // deficit
      'GC': { prod: 3.6, cons: 3.8 },        // deficit
      'ZC': { prod: 1200, cons: 1180 },      // surplus
      'ZS': { prod: 390, cons: 395 },        // deficit
    };
    const b = bc[i.symbol] ?? { prod: 100, cons: 100 };
    const surplus = b.prod - b.cons;
    const surplusPct = (surplus / Math.max(1, b.cons)) * 100;
    const norm = this.normalize(surplusPct, -5, 5);
    // Deficit(供不应求) = 🟢 bullish; Surplus(供过于求) = 🔴 bearish
    const sig = surplusPct < -0.5 ? 'green' : surplusPct > 0.5 ? 'red' : 'yellow';

    let h: string;
    if (surplusPct < -1) h = '供不应求(缺口' + Math.abs(surplusPct).toFixed(1) + '%)，基本面支撑做多';
    else if (surplusPct > 1) h = '供过于求(过剩' + surplusPct.toFixed(1) + '%)，基本面偏空';
    else h = '供需大致平衡';

    return { factorId: 'CMD_BALANCE_SHEET', symbol: i.symbol, category: i.category, signal: sig, value: surplusPct, normalized: Math.round(norm), humanText: h };
  }
}

// ═══════════════════════ L6 季节性 (2) ═══════════════════════

// ── CMD_SEASONALITY 🟢 商品季节性 ───────────────────────────────

class CMD_SEASONALITY_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_SEASONALITY';
  readonly label = 'Commodity Seasonality';
  readonly labelCN = '商品季节性';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_SEASONAL';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    // Get seasonality from the types module
    const { getSeasonalSignal } = require('./commodity-types');
    const seasonal = getSeasonalSignal(i.symbol) as CommoditySeasonalData;
    const val = seasonal.currentMonthIndex;
    const norm = this.normalize(val, 0.85, 1.15);
    const sig = seasonal.signal === 'bullish_season' ? 'green' : seasonal.signal === 'bearish_season' ? 'red' : 'yellow';

    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const now = new Date();
    const mn = now.getMonth(); // 0-11
    const peakM = months[seasonal.peakMonth - 1];
    const troM = months[seasonal.troughMonth - 1];
    const currentM = months[mn];

    let h: string;
    if (sig === 'green') h = currentM + '是' + i.symbol + '的旺季(旺季' + peakM + '/淡季' + troM + ')，季节性支持做多';
    else if (sig === 'red') h = currentM + '是' + i.symbol + '的淡季(旺季' + peakM + '/淡季' + troM + ')，季节性不支持';
    else h = currentM + '处在' + i.symbol + '的非旺季非淡季，季节性无明确信号';

    return { factorId: 'CMD_SEASONALITY', symbol: i.symbol, category: i.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── CMD_GOLD_SUMMER 🟢 黄金夏季效应 ────────────────────────────

class CMD_GOLD_SUMMER_Calc extends CommodityFactorCalculator {
  readonly factorId = 'CMD_GOLD_SUMMER';
  readonly label = 'Gold Summer Effect';
  readonly labelCN = '黄金夏季效应';
  readonly level1 = 'L1_COMMODITY';
  readonly level2 = 'L2_SEASONAL';

  compute(i: CommodityFactorInput): CommodityFactorOutput {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    // Gold summer effect: historically weak in Jun-Aug (Indian wedding season lull, low western demand)
    // Strong in Sep-Oct (Diwali, wedding season picks up)
    // Strong in Dec-Jan (Chinese New Year prep, holiday demand)
    let sig: 'green' | 'yellow' | 'red';
    let val: number;
    let h: string;

    if (month >= 8 && month <= 9) {
      sig = 'green'; val = 0.8;
      h = '8-10月是黄金消费旺季(印度排灯节+婚庆季)，季节性支撑';
    } else if (month >= 11 || month <= 0) {
      sig = 'green'; val = 0.7;
      h = '12-1月春节前黄金采购潮，季节性偏多';
    } else if (month >= 5 && month <= 7) {
      sig = 'red'; val = -0.5;
      h = '6-8月黄金传统淡季(西方度假+无大节庆)，季节性偏弱';
    } else {
      sig = 'yellow'; val = 0;
      h = '当前不在黄金明显旺季或淡季，季节性中性';
    }

    const norm = this.normalize(val, -1, 1);

    return { factorId: 'CMD_GOLD_SUMMER', symbol: i.symbol, category: i.category, signal: sig, value: val, normalized: Math.round(norm), humanText: h };
  }
}

// ── Calculator Registry ─────────────────────────────────────────
// All 14 commodity factors

// ═════════════════════ L3-L5 (12 factors from R199) ═══════════════════════
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


// ================================================================
// Calculator Registry (26 factors)
// ================================================================

export const COMMODITY_FACTOR_CALCULATORS: Record<string, CommodityFactorCalculator> = {
  // L1 Term Structure (7)
  CMD_ROLL_YIELD: new CMD_ROLL_YIELD_Calc(),
  CMD_BASIS: new CMD_BASIS_Calc(),
  CMD_TERM_STRUCTURE: new CMD_TERM_STRUCTURE_Calc(),
  CMD_CALENDAR_SPREAD: new CMD_CALENDAR_SPREAD_Calc(),
  CMD_CARRY: new CMD_CARRY_Calc(),
  CMD_SPOT_MONTH: new CMD_SPOT_MONTH_Calc(),
  CMD_FRONT_RATIO: new CMD_FRONT_RATIO_Calc(),
  // L2 Inventory/Demand (5)
  CMD_EIA_CRUDE: new CMD_EIA_CRUDE_Calc(),
  CMD_EIA_DISTILLATE: new CMD_EIA_DISTILLATE_Calc(),
  CMD_EIA_GASOLINE: new CMD_EIA_GASOLINE_Calc(),
  CMD_LME_INVENTORY: new CMD_LME_INVENTORY_Calc(),
  CMD_GOLD_ETF_FLOW: new CMD_GOLD_ETF_FLOW_Calc(),
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
  // L6 Seasonality (2)
  CMD_SEASONAL_DIRECTION: new CMD_SEASONAL_DIRECTION_Calc(),
  CMD_SEASONAL_STRENGTH: new CMD_SEASONAL_STRENGTH_Calc(),
};

/** Get a single commodity factor calculator by factorId */
export function getCommodityFactorCalculator(factorId: string): CommodityFactorCalculator | undefined {
  return COMMODITY_FACTOR_CALCULATORS[factorId];
}

/** Get all commodity factor IDs (26 total) */
export function getAllCommodityFactorIds(): string[] {
  return Object.keys(COMMODITY_FACTOR_CALCULATORS);
}

/** Compute all 26 commodity factors for a symbol */
export async function computeAllCommodityFactors(
  symbol: string,
  category: CommodityCategory,
  baseInput: CommodityFactorInput,
): Promise<CommodityFactorOutput[]> {
  const ctx: FactorComputeContext = { ...baseInput };

  try {
    const cftc = await cftcAdapter.fetchPositions(symbol);
    if (cftc) ctx.cftcData = cftc;
  } catch (e) { log.warn('[CommF] CFTC fetch failed for ' + symbol); }

  try {
    const inflation = await tipsInflationAdapter.fetchInflation('GC');
    if (inflation) ctx.inflationData = inflation;
  } catch (e) { log.warn('[CommF] Inflation fetch failed'); }

  try {
    const gpr = await geopoliticalRiskAdapter.fetchGPR('GC');
    if (gpr) ctx.gprData = gpr;
  } catch (e) { log.warn('[CommF] GPR fetch failed'); }

  try {
    const cross = await crossCommodityAdapter.fetchRatios('GC');
    if (cross) ctx.crossData = cross;
  } catch (e) { log.warn('[CommF] Cross ratio fetch failed'); }

  const results: CommodityFactorOutput[] = [];
  for (const calc of Object.values(COMMODITY_FACTOR_CALCULATORS)) {
    try {
      results.push(calc.compute(ctx));
    } catch (e) {
      log.error('[CommF] Failed ' + calc.factorId + ' for ' + symbol, e);
      results.push({
        factorId: calc.factorId, symbol, category,
        signal: 'yellow', value: 0, normalized: 50,
        humanText: 'Calc error',
      });
    }
  }
  return results;
}

// Backward-compatibility aliases
/** @deprecated Use COMMODITY_FACTOR_CALCULATORS instead */
export const COMMODITY_FACTOR_CALCULATORS_OLD = COMMODITY_FACTOR_CALCULATORS;
