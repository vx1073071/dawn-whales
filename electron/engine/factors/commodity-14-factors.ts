// R198 J6: 14 Commodity Factor Calculators
// L1 Term Structure (7) + L2 Inventory/Demand (5) + L6 Seasonality (2) = 14 factors
// PM rule: "商品因子仅信号灯(免费)" — all output is signal_color + computed value
// Human translation: RollYield=换月成本 / Basis=现货贵还是期货贵 / COT=大佬底牌

import log from 'electron-log';
import {
  CommodityFactorInput, CommodityCategory,
  RollYieldResult, BasisResult, TermStructureResult,
  EIAInventoryData, CFTCData, LMEInventoryData, GoldETFData,
  CommoditySeasonalData,
} from './commodity-types';

// ── Factor Output ───────────────────────────────────────────────

export interface CommodityFactorOutput {
  factorId: string;
  symbol: string;
  category: CommodityCategory;
  signal: 'green' | 'yellow' | 'red';
  value: number;               // raw computed value
  normalized: number;          // 0-100 normalized score
  humanText: string;           // one-line human-readable explanation
}

// ── Factor Calculator Base ───────────────────────────────────────

abstract class CommodityFactorCalculator {
  abstract readonly factorId: string;
  abstract readonly label: string;
  abstract readonly labelCN: string;
  abstract readonly level1: string;
  abstract readonly level2: string;

  abstract compute(input: CommodityFactorInput): CommodityFactorOutput;

  protected normalize(v: number, min: number, max: number): number {
    if (min === max) return 50;
    const clamped = Math.max(min, Math.min(max, v));
    return ((clamped - min) / (max - min)) * 100;
  }

  protected signalFromValue(v: number, bullish: number, bearish: number): 'green' | 'yellow' | 'red' {
    if (v >= bullish) return 'green';
    if (v <= bearish) return 'red';
    return 'yellow';
  }
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

export const COMMODITY_FACTOR_CALCULATORS: Record<string, CommodityFactorCalculator> = {
  // L1 Term Structure (7)
  CMD_ROLL_YIELD: new CMD_ROLL_YIELD_Calc(),
  CMD_TERM_STRUCTURE: new CMD_TERM_STRUCTURE_Calc(),
  CMD_BASIS: new CMD_BASIS_Calc(),
  CMD_MOMENTUM_12M: new CMD_MOMENTUM_12M_Calc(),
  CMD_MOMENTUM_1M: new CMD_MOMENTUM_1M_Calc(),
  CMD_VOLATILITY: new CMD_VOLATILITY_Calc(),
  CMD_SKEWNESS: new CMD_SKEWNESS_Calc(),
  // L2 Inventory (5)
  CMD_EIA_CRUDE: new CMD_EIA_CRUDE_Calc(),
  CMD_NATGAS_STORAGE: new CMD_NATGAS_STORAGE_Calc(),
  CMD_LME_INVENTORY: new CMD_LME_INVENTORY_Calc(),
  CMD_GOLD_ETF: new CMD_GOLD_ETF_Calc(),
  CMD_BALANCE_SHEET: new CMD_BALANCE_SHEET_Calc(),
  // L6 Seasonality (2)
  CMD_SEASONALITY: new CMD_SEASONALITY_Calc(),
  CMD_GOLD_SUMMER: new CMD_GOLD_SUMMER_Calc(),
};

export function getCommodityFactorCalculator(factorId: string): CommodityFactorCalculator | undefined {
  return COMMODITY_FACTOR_CALCULATORS[factorId];
}

export function computeAllCommodityFactors(input: CommodityFactorInput): CommodityFactorOutput[] {
  const results: CommodityFactorOutput[] = [];
  for (const calc of Object.values(COMMODITY_FACTOR_CALCULATORS)) {
    try {
      results.push(calc.compute(input));
    } catch (e) {
      log.error('[CommodityFactors] Failed to compute ' + calc.factorId + ' for ' + input.symbol, e);
    }
  }
  return results;
}

export function getAllCommodityFactorIds(): string[] {
  return Object.keys(COMMODITY_FACTOR_CALCULATORS);
}
