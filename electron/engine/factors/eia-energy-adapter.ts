// R198 J4: EIA Energy Adapter — Crude + Natural Gas Inventory
// Fetches weekly EIA inventory data. PM rule: "实际vs预期差距才是信号，不是绝对数字"
// Human: "原油库存少了 → 买" / "库存比预期多 → 卖"

import log from 'electron-log';
import { EIAInventoryData } from './commodity-types';

export class EIAAdapter {
  private cache = new Map<string, { data: EIAInventoryData; ts: number }>();
  private cacheTTL = 3 * 3600 * 1000; // 3 hours — weekly release Wednesday

  async fetchInventory(symbol: string): Promise<EIAInventoryData> {
    const cached = this.cache.get(symbol);
    if (cached && cached.ts + this.cacheTTL > Date.now()) return cached.data;

    const data = this.mockEIA(symbol);
    this.cache.set(symbol, { data, ts: Date.now() });
    return data;
  }

  // ── EIA API v2 placeholder ───────────────────────────────────
  // Real implementation would call:
  //   GET https://api.eia.gov/v2/petroleum/stoc/wstk/data/?api_key=KEY&facets[series]=WCRSTUS1
  //   GET https://api.eia.gov/v2/natural-gas/stor/wkly/data/?api_key=KEY&facets[series]=N5020US2

  private mockEIA(symbol: string): EIAInventoryData {
    const isCrude = symbol === 'CL';
    // Realistic baseline: ~420M bbl crude / ~3200 Bcf natural gas
    const baseStock = isCrude ? 420.0 : 3200.0;
    const noise = isCrude ? 3.0 : 40.0;

    // PM: "预期vs实际差距才是信号"
    const expected = baseStock + (Math.random() - 0.55) * noise;
    const actual = expected + (Math.random() - 0.5) * noise * 1.5;
    const previous = baseStock + (Math.random() - 0.5) * noise;

    const surprise = actual - expected;

    // Compute signal: surprise negative = tighter than expected = 🟢 bullish
    const signalSignal: 'green' | 'yellow' | 'red' =
      surprise < -noise * 0.5 ? 'green'
      : surprise > noise * 0.5 ? 'red'
      : 'yellow';

    // Generate 52-week history
    const historical = Array(52).fill(0).map((_, i) => {
      const weekDate = new Date(Date.now() - (52 - i) * 7 * 86400000);
      const seasonalFactor = 1 + 0.05 * Math.sin(i / 52 * 2 * Math.PI);
      return {
        week: weekDate.toISOString().slice(0, 10),
        stock: baseStock * seasonalFactor + (Math.random() - 0.5) * noise * 2,
      };
    });

    return {
      symbol, reportDate: new Date().toISOString().slice(0, 10),
      actual, expected, previous,
      change: actual - previous,
      changeExpected: expected - previous,
      surprise,
      historical,
    };
  }

  /** Get EIA inventory status in human language */
  getHumanSignal(symbol: string, data: EIAInventoryData): string {
    const isCrude = symbol === 'CL';
    const unit = isCrude ? '万桶' : 'Bcf';
    const dir = data.surprise < 0 ? '降' : '增';
    const diff = isCrude
      ? Math.abs(data.surprise * 100).toFixed(0)
      : Math.abs(data.surprise).toFixed(0);
    return '库存比预期' + dir + '了 ' + diff + ' ' + unit;
  }

  isOilSymbol(symbol: string): boolean { return symbol === 'CL' || symbol === 'BZ'; }
  isGasSymbol(symbol: string): boolean { return symbol === 'NG'; }
}

export const eiaAdapter = new EIAAdapter();
