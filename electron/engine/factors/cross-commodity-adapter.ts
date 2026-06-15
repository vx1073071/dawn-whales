// R199 J1d: Cross-Commodity Ratio Adapter — 金银比/金油比/裂解价差
// PM: "金银比 = 贵金属内部情绪 — 高比率=避险极端, 低比率=风险偏好"
// Human: "金银比80+ = 市场太恐慌了" / "裂解价差→炼油利润"
// L5 比价因子: 3 cross-commodity ratios

import log from 'electron-log';

// ── Ratio Data Types ─────────────────────────────────────────

export interface CrossCommodityData {
  symbol: string;
  reportDate: string;
  // Gold/Silver Ratio (金银比)
  goldSilverRatio: number;
  goldSilverRatioZScore: number;  // z-score vs 5yr avg
  goldSilverRatioHigh: number;    // 5yr high
  goldSilverRatioLow: number;     // 5yr low
  // Gold/Oil Ratio (金油比)
  goldOilRatio: number;           // oz gold per bbl oil
  goldOilRatioZScore: number;
  goldOilRatioHigh: number;
  goldOilRatioLow: number;
  // Crack Spread (裂解价差: 3*RBOB + 2*HO - 5*CL)
  crackSpread: number;            // $/bbl
  crackSpreadZScore: number;
  // Signal per ratio
  goldSilverSignal: 'green' | 'yellow' | 'red';
  goldOilSignal: 'green' | 'yellow' | 'red';
  crackSpreadSignal: 'green' | 'yellow' | 'red';
}

export class CrossCommodityAdapter {
  private cache = new Map<string, { data: CrossCommodityData; ts: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 min

  async fetchRatios(symbol: string): Promise<CrossCommodityData> {
    const cached = this.cache.get(symbol);
    if (cached && cached.ts + this.cacheTTL > Date.now()) return cached.data;

    const data = this.mockRatios(symbol);
    this.cache.set(symbol, { data, ts: Date.now() });
    return data;
  }

  private mockRatios(symbol: string): CrossCommodityData {
    // Gold/Silver ratio: historical avg ~65, range 30-120
    // High (>85) = extreme risk aversion, gold outperforming → mean-revert (bearish gold, bullish silver)
    // Low (<50) = risk appetite, silver outperforming
    const gsr = 75 + (Math.random() - 0.5) * 20;  // 65-85 typical
    const gsrZ = (gsr - 70) / 10; // ~0 +/- 1.5

    // Gold/Oil ratio: oz gold per bbl oil
    // Historical avg ~45 (2800/62), range 20-90
    // High = oil cheap vs gold = economic weakness → bullish gold, bearish oil
    const gor = 40 + Math.random() * 15;
    const gorZ = (gor - 45) / 10;

    // Crack spread (3-2-1): 3RBOB + 2HO - 5CL
    // Avg ~15, range -5 to 40
    const crack = 12 + (Math.random() - 0.5) * 20;
    const crackZ = (crack - 15) / 10;

    return {
      symbol, reportDate: new Date().toISOString().slice(0, 10),
      goldSilverRatio: Math.round(gsr * 10) / 10,
      goldSilverRatioZScore: Math.round(gsrZ * 100) / 100,
      goldSilverRatioHigh: 90,
      goldSilverRatioLow: 50,
      goldOilRatio: Math.round(gor * 10) / 10,
      goldOilRatioZScore: Math.round(gorZ * 100) / 100,
      goldOilRatioHigh: 70,
      goldOilRatioLow: 25,
      crackSpread: Math.round(crack * 10) / 10,
      crackSpreadZScore: Math.round(crackZ * 100) / 100,
      // Signals
      goldSilverSignal: gsr > 85 ? 'red' : gsr < 60 ? 'green' : 'yellow',
      goldOilSignal: gor > 60 ? 'red' : gor < 35 ? 'green' : 'yellow',
      crackSpreadSignal: crack > 25 ? 'green' : crack < 5 ? 'red' : 'yellow',
    };
  }

  /** 金银比故事 */
  getGoldSilverStory(data: CrossCommodityData): string {
    const r = data.goldSilverRatio;
    if (r > 85) return '金银比 ' + r.toFixed(1) + ' — 极度避险(历史高分位), 可能向均值回归';
    if (r > 75) return '金银比 ' + r.toFixed(1) + ' — 偏避险, 黄金相对白银偏贵';
    if (r < 55) return '金银比 ' + r.toFixed(1) + ' — 风险偏好(白银跑赢黄金), 市场信心足';
    return '金银比 ' + r.toFixed(1) + ' — 正常区间';
  }

  /** 金油比故事 */
  getGoldOilStory(data: CrossCommodityData): string {
    const r = data.goldOilRatio;
    if (r > 55) return '金油比 ' + r.toFixed(1) + ' — 油便宜/金贵, 经济衰退预期(支撑黄金)';
    if (r < 30) return '金油比 ' + r.toFixed(1) + ' — 油贵/金便宜, 通胀预期(支撑油价)';
    return '金油比 ' + r.toFixed(1) + ' — 经济平稳期';
  }

  /** 裂解价差故事 */
  getCrackSpreadStory(data: CrossCommodityData): string {
    const c = data.crackSpread;
    if (c > 30) return '裂解价差 $' + c.toFixed(1) + ' — 炼油利润丰厚, 需求强劲(利好原油)';
    if (c < 5) return '裂解价差 $' + c.toFixed(1) + ' — 炼油利润薄, 需求疲软';
    return '裂解价差 $' + c.toFixed(1) + ' — 炼厂利润正常';
  }
}

export const crossCommodityAdapter = new CrossCommodityAdapter();
