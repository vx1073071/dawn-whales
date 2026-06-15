// R199 J1c: Geopolitical Risk Adapter — GPR Index (Caldara-Iacoviello)
// Tracks: GPR index (global), GPR threats vs acts, regional breakdown.
// PM rule: "地缘风险↑ = 黄金/原油避险溢价 = 阶段性信号"
// Human: "中东紧张→买黄金避险" / "地缘缓和→避险需求下降"

import log from 'electron-log';

// ── GPR Data Types ───────────────────────────────────────────

export interface GPRData {
  symbol: string;
  reportDate: string;
  gprIndex: number;            // Overall GPR index (avg=100)
  gprThreats: number;          // GPR threats sub-index
  gprActs: number;             // GPR acts sub-index
  gprChange1M: number;         // 1-month change
  gprChange3M: number;         // 3-month change
  percentile: number;          // where current GPR ranks vs history (0-100)
  // Regional
  middleEastGPR: number;
  europeGPR: number;
  asiaGPR: number;
  // Impact score
  goldImpact: number;          // estimated impact on gold demand (0-100)
  oilImpact: number;           // estimated impact on oil (0-100)
  // Signal
  signal: 'green' | 'yellow' | 'red';
  // PM: GPR high = risk-on for gold/oil = green for commodities
}

export class GeopoliticalRiskAdapter {
  private cache = new Map<string, { data: GPRData; ts: number }>();
  private cacheTTL = 3600 * 1000; // 1 hour

  async fetchGPR(symbol: string): Promise<GPRData> {
    const cached = this.cache.get(symbol);
    if (cached && cached.ts + this.cacheTTL > Date.now()) return cached.data;

    const data = this.mockGPR(symbol);
    this.cache.set(symbol, { data, ts: Date.now() });
    return data;
  }

  private mockGPR(symbol: string): GPRData {
    // GPR baseline ~100, elevated = 150+, calm = <70
    const gpr = 80 + Math.random() * 80;
    const threats = gpr * (0.6 + Math.random() * 0.3);
    const acts = gpr * (0.2 + Math.random() * 0.2);
    const change1M = (Math.random() - 0.4) * 30; // slight escalation bias
    const change3M = change1M * 2 + (Math.random() - 0.5) * 15;

    const pctile = Math.min(100, Math.max(0, (gpr - 60) / 120 * 100));

    // Signal: GPR rising = bullish for gold/oil → green (from commodity perspective)
    // GPR falling = less risk premium → red
    const signal: 'green' | 'yellow' | 'red' =
      change1M > 10 ? 'green'     // escalating = commodities benefit
      : change1M < -10 ? 'red'     // de-escalating
      : 'yellow';

    const goldImpact = Math.min(100, Math.round(pctile * (0.5 + Math.random() * 0.3)));
    const oilImpact = Math.min(100, Math.round(pctile * (0.6 + Math.random() * 0.3)));

    return {
      symbol, reportDate: new Date().toISOString().slice(0, 10),
      gprIndex: Math.round(gpr * 10) / 10,
      gprThreats: Math.round(threats * 10) / 10,
      gprActs: Math.round(acts * 10) / 10,
      gprChange1M: Math.round(change1M * 10) / 10,
      gprChange3M: Math.round(change3M * 10) / 10,
      percentile: Math.round(pctile),
      middleEastGPR: Math.round((60 + Math.random() * 100) * 10) / 10,
      europeGPR: Math.round((40 + Math.random() * 80) * 10) / 10,
      asiaGPR: Math.round((30 + Math.random() * 60) * 10) / 10,
      goldImpact,
      oilImpact,
      signal,
    };
  }

  getStory(data: GPRData): string {
    const pct = data.percentile;
    let level: string;
    if (pct > 80) level = '高';
    else if (pct > 50) level = '偏高';
    else level = '正常';

    const dir = data.gprChange1M > 0 ? '上升' : '下降';
    return '地缘风险指数' + data.gprIndex.toFixed(0) + '(' + level + '风险, 月度' + dir + ')' +
      (data.signal === 'green' ? '(风险升→支撑避险资产)' :
       data.signal === 'red' ? '(风险降→避险需求减弱)' : '');
  }
}

export const geopoliticalRiskAdapter = new GeopoliticalRiskAdapter();
