// R199 J1b: TIPS + Inflation Adapter — Real Rate / Breakeven / Inflation Expectations
// Tracks: 10yr TIPS yield (real rate), BEIR (breakeven inflation rate),
// 5y5y forward inflation swap, CPI prints.
// PM rule: "实际利率 = 黄金的天敌 — 实际利率↑→黄金↓"
// Human: "TIPS收益率上升 → 持有黄金的机会成本增加 → 偏空"

import log from 'electron-log';

// ── Inflation Data Types ─────────────────────────────────────

export interface InflationData {
  symbol: string;              // 'GC' typically
  reportDate: string;
  // Real rates
  realRate10Y: number;         // 10yr TIPS yield (real rate, %)
  realRate5Y: number;          // 5yr TIPS yield
  realRateChange: number;      // 1-month change in 10yr real rate
  // Breakeven Inflation
  beir10Y: number;             // 10yr Breakeven Inflation Rate (nominal - TIPS)
  beir5Y5Y: number;            // 5y5y forward breakeven
  // CPI
  cpiYoy: number;              // CPI year-over-year
  cpiCoreYoy: number;          // Core CPI Y/Y
  cpiMoM: number;              // CPI month-over-month
  // Expected vs actual
  cpiExpected: number;
  cpiSurprise: number;         // actual - expected
  // Dollar
  dxy: number;                 // DXY index
  dxy1MChange: number;         // DXY 1-month % change
  // Signal
  signal: 'green' | 'yellow' | 'red';
  // PM: real rate up = bearish for gold = red
}

export class TIPSInflationAdapter {
  private cache = new Map<string, { data: InflationData; ts: number }>();
  private cacheTTL = 3600 * 1000; // 1 hour

  async fetchInflation(symbol: string): Promise<InflationData> {
    const cached = this.cache.get(symbol);
    if (cached && cached.ts + this.cacheTTL > Date.now()) return cached.data;

    const data = this.mockInflation(symbol);
    this.cache.set(symbol, { data, ts: Date.now() });
    return data;
  }

  private mockInflation(symbol: string): InflationData {
    // Realistic 2026 scenario: real rate ~1.8-2.2%, CPI ~3.0-3.5%
    const realRate10Y = 1.8 + Math.random() * 0.4;
    const realRate5Y = realRate10Y - 0.1 + Math.random() * 0.3;
    const beir10Y = 2.3 + Math.random() * 0.3;
    const cpiYoy = 3.0 + Math.random() * 0.5;
    const cpiExpected = cpiYoy - (Math.random() - 0.5) * 0.4;
    const dxy = 100 + Math.random() * 5;

    // PM rule: real rate ↑ = gold 🟡→🔴; real rate flat/down = 🟢 for gold
    const realChange = (Math.random() - 0.5) * 0.3;
    const signal: 'green' | 'yellow' | 'red' =
      realChange < -0.05 ? 'green'    // real rate falling = gold bullish
      : realChange > 0.05 ? 'red'     // real rate rising = gold bearish
      : 'yellow';

    return {
      symbol, reportDate: new Date().toISOString().slice(0, 10),
      realRate10Y: Math.round(realRate10Y * 100) / 100,
      realRate5Y: Math.round(realRate5Y * 100) / 100,
      realRateChange: Math.round(realChange * 1000) / 1000,
      beir10Y: Math.round(beir10Y * 100) / 100,
      beir5Y5Y: Math.round((beir10Y + 0.1 + Math.random() * 0.2) * 100) / 100,
      cpiYoy: Math.round(cpiYoy * 10) / 10,
      cpiCoreYoy: Math.round((cpiYoy - 0.3) * 10) / 10,
      cpiMoM: Math.round((0.1 + Math.random() * 0.3) * 10) / 10,
      cpiExpected: Math.round(cpiExpected * 10) / 10,
      cpiSurprise: Math.round((cpiYoy - cpiExpected) * 10) / 10,
      dxy: Math.round(dxy * 100) / 100,
      dxy1MChange: Math.round((Math.random() - 0.5) * 3 * 10) / 10,
      signal,
    };
  }

  /** Real rate → gold signal перевод */
  getRealRateStory(data: InflationData): string {
    const rr = data.realRate10Y;
    const dir = data.realRateChange > 0 ? '上升' : '下降';
    return '实际利率 ' + rr.toFixed(2) + '% (' + dir + Math.abs(data.realRateChange).toFixed(2) + '%)' +
      (data.signal === 'red' ? '(利率↑压制黄金)' :
       data.signal === 'green' ? '(利率↓支撑黄金)' : '');
  }

  /** CPI surprise story */
  getCPIStory(data: InflationData): string {
    const surp = data.cpiSurprise;
    const dir = surp > 0 ? '超预期' : '低于预期';
    return 'CPI ' + data.cpiYoy.toFixed(1) + '%(' + dir + Math.abs(surp).toFixed(1) + '%)' +
      (surp > 0.3 ? '(通胀超预期→可能支撑黄金)' :
       surp < -0.3 ? '(通胀低→联储鸽派空间→黄金中性)' : '');
  }
}

export const tipsInflationAdapter = new TIPSInflationAdapter();
