/**
 * DAWN WHALES R168 P2-11 — Screener Presets
 *
 * 4 built-in screening presets:
 *   1. 放量突破 (Volume Breakout)
 *   2. 低估值高分红 (Low Valuation + High Dividend)
 *   3. 强势回调 (Strong Pullback)
 *   4. 超跌反弹 (Oversold Bounce)
 *
 * Each preset is a composable FilterGroup — standalone, testable, serializable.
 *
 * ≥250L
 */

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type Market = 'US' | 'HK' | 'CN' | 'SG' | 'JP' | 'UK' | 'EU' | 'CRYPTO';
export type InstrumentType = 'stock' | 'etf' | 'crypto';

export interface NumericRange {
  min?: number;
  max?: number;
}

export interface FilterRule {
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'between' | 'cross_above' | 'cross_below';
  value: number | NumericRange;
}

export interface ScreenerPreset {
  id: string;
  name: string;
  nameCN: string;
  description: string;
  category: 'breakout' | 'value' | 'technical' | 'reversal';
  filters: FilterRule[];
  compatibleMarkets: Market[];
  compatibleInstruments: InstrumentType[];
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  maxResults?: number;
}

// ═══════════════════════════════════════════════════════════
// Filter factories
// ═══════════════════════════════════════════════════════════

function gt(field: string, value: number): FilterRule {
  return { field, operator: 'gt', value };
}

function lt(field: string, value: number): FilterRule {
  return { field, operator: 'lt', value };
}

function between(field: string, min: number, max: number): FilterRule {
  return { field, operator: 'between', value: { min, max } };
}

function crossAbove(field: string, value: number): FilterRule {
  return { field, operator: 'cross_above', value };
}

// ═══════════════════════════════════════════════════════════
// Presets
// ═══════════════════════════════════════════════════════════

const ALL_MARKETS: Market[] = ['US', 'HK', 'CN', 'SG', 'JP', 'UK', 'EU', 'CRYPTO'];
const STOCK_ONLY: InstrumentType[] = ['stock'];
const STOCK_ETF: InstrumentType[] = ['stock', 'etf'];
const ALL_CRYPTO: Market[] = ['CRYPTO'];
const NON_CRYPTO: Market[] = ['US', 'HK', 'CN', 'SG', 'JP', 'UK', 'EU'];

/**
 * 放量突破 (Volume Breakout)
 * Price breaks above MA20 with volume >1.5x MA5 volume
 */
export const PRESET_VOLUME_BREAKOUT: ScreenerPreset = {
  id: 'volume_breakout',
  name: 'Volume Breakout',
  nameCN: '放量突破',
  description: '价格突破20日均线且成交量超过5日均量的1.5倍',
  category: 'breakout',
  filters: [
    crossAbove('close', 0),        // Placeholder: close crosses above MA20 (computed at runtime)
    gt('volume_ratio', 1.5),       // Volume / MA5_volume > 1.5x
    gt('price_change_pct_5d', 3),  // 5-day change > +3%
    lt('rsi_14', 75),              // RSI not yet overbought territory
    gt('ma20_slope', 0),           // MA20 trending up
  ],
  compatibleMarkets: NON_CRYPTO,
  compatibleInstruments: STOCK_ETF,
  sortField: 'volume_ratio',
  sortOrder: 'desc',
  maxResults: 50,
};

/**
 * 低估值高分红 (Low Valuation + High Dividend)
 * PE < 15, PB < 2, dividend_yield > 3%, ROE > 10%
 */
export const PRESET_LOW_VAL_HIGH_DIV: ScreenerPreset = {
  id: 'low_val_high_div',
  name: 'Low Valuation + High Dividend',
  nameCN: '低估值高分红',
  description: '市盈率<15, 市净率<2, 股息率>3%, 净资产收益率>10%',
  category: 'value',
  filters: [
    between('pe_ttm', 0, 15),      // PE 0~15 (positive earnings)
    between('pb', 0.3, 2.0),       // PB 0.3~2.0 (no negative book)
    gt('dividend_yield', 3),       // Dividend yield >3%
    gt('roe', 10),                 // ROE >10%
    gt('revenue_growth_yoy', 0),   // Revenue still growing
    lt('debt_to_equity', 2),       // D/E <2 (not over-levered)
  ],
  compatibleMarkets: NON_CRYPTO,
  compatibleInstruments: STOCK_ONLY,
  sortField: 'dividend_yield',
  sortOrder: 'desc',
  maxResults: 30,
};

/**
 * 强势回调 (Strong Pullback)
 * Stock that was strong (20d return >15%) but pulled back 5-10% in last 3 days
 */
export const PRESET_STRONG_PULLBACK: ScreenerPreset = {
  id: 'strong_pullback',
  name: 'Strong Pullback',
  nameCN: '强势回调',
  description: '过去20日涨幅>15%, 近3日回调5-10%, 仍站上60日均线',
  category: 'technical',
  filters: [
    gt('return_20d', 15),           // 20-day return >15% (was strong)
    between('return_3d', -10, -5),   // 3-day pullback 5-10%
    gt('close_over_ma60_pct', 0),    // Still above MA60
    between('rsi_14', 35, 55),       // RSI cooled down from overbought
    gt('turnover_rate', 1.5),        // Active trading
  ],
  compatibleMarkets: NON_CRYPTO,
  compatibleInstruments: STOCK_ONLY,
  sortField: 'return_20d',
  sortOrder: 'desc',
  maxResults: 30,
};

/**
 * 超跌反弹 (Oversold Bounce)
 * RSI < 30, price near lower bollinger band, positive divergence possible
 */
export const PRESET_OVERSOLD_BOUNCE: ScreenerPreset = {
  id: 'oversold_bounce',
  name: 'Oversold Bounce',
  nameCN: '超跌反弹',
  description: 'RSI<30超卖, 价格接近布林下轨, 开始出现资金流入迹象',
  category: 'reversal',
  filters: [
    lt('rsi_14', 30),               // Deeply oversold
    lt('bb_position', 0.15),        // Near lower Bollinger band (<15% of bandwidth)
    gt('capital_inflow_3d', 0),     // Capital starting to flow in
    gt('volume_ratio', 1.2),        // Volume picking up
    lt('decline_from_52w_high', -30), // Has dropped significantly from high
    gt('price_over_ma200_pct', -40),  // Not in total collapse (within 40% of MA200)
  ],
  compatibleMarkets: NON_CRYPTO,
  compatibleInstruments: STOCK_ETF,
  sortField: 'rsi_14',
  sortOrder: 'asc',
  maxResults: 30,
};

// ═══════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════

export const ALL_PRESETS: ScreenerPreset[] = [
  PRESET_VOLUME_BREAKOUT,
  PRESET_LOW_VAL_HIGH_DIV,
  PRESET_STRONG_PULLBACK,
  PRESET_OVERSOLD_BOUNCE,
];

export function getPreset(id: string): ScreenerPreset | undefined {
  return ALL_PRESETS.find(p => p.id === id);
}

export function getPresetsByCategory(category: ScreenerPreset['category']): ScreenerPreset[] {
  return ALL_PRESETS.filter(p => p.category === category);
}

/**
 * Apply preset filters to a candidate symbol's data.
 * Returns true if the symbol passes all filters.
 */
export function evaluatePreset(preset: ScreenerPreset, symbolData: Record<string, number>): boolean {
  for (const filter of preset.filters) {
    const val = symbolData[filter.field];
    if (val === undefined || val === null) return false;

    switch (filter.operator) {
      case 'gt':
        if (val <= (filter.value as number)) return false;
        break;
      case 'gte':
        if (val < (filter.value as number)) return false;
        break;
      case 'lt':
        if (val >= (filter.value as number)) return false;
        break;
      case 'lte':
        if (val > (filter.value as number)) return false;
        break;
      case 'eq':
        if (val !== (filter.value as number)) return false;
        break;
      case 'between': {
        const range = filter.value as NumericRange;
        if (range.min !== undefined && val < range.min) return false;
        if (range.max !== undefined && val > range.max) return false;
        break;
      }
      case 'cross_above':
      case 'cross_below':
        // Runtime computed — skip static evaluation
        break;
    }
  }
  return true;
}

/**
 * Create a human-readable explanation of what the preset looks for.
 */
export function describePreset(preset: ScreenerPreset): string {
  const lines: string[] = [`${preset.nameCN} (${preset.name}):`, preset.description, '', '筛选条件:'];
  for (const f of preset.filters) {
    let cond = '';
    switch (f.operator) {
      case 'gt': cond = `> ${f.value}`; break;
      case 'lt': cond = `< ${f.value}`; break;
      case 'between': {
        const r = f.value as NumericRange;
        cond = `${r.min ?? '-∞'} ~ ${r.max ?? '+∞'}`;
        break;
      }
      case 'cross_above': cond = `上穿 ${f.value}`; break;
      default: cond = `${f.operator} ${f.value}`;
    }
    lines.push(`  - ${f.field} ${cond}`);
  }
  return lines.join('\n');
}
