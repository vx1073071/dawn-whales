// R198 J5: LME Metal Adapter — LME铜/铝/镍/锌库存
// Tracks LME warehouse inventory: on-warrant (available) + cancelled warrants (booked for removal).
// PM rule: "注销仓单↑ → 金属被提走 → 供给收紧 → 看涨"
// Human: "铜库存又少了 → 有人在囤货" / "注销仓单飙了 → 铜要涨"

import log from 'electron-log';
import { LMEInventoryData } from './commodity-types';

// ── Supported LME Symbols ──────────────────────────────────────

const LME_SYMBOLS = ['LME_CU', 'LME_AL', 'LME_NI', 'LME_ZN'];

export class LMEAdapter {
  private cache = new Map<string, { data: LMEInventoryData; ts: number }>();
  private cacheTTL = 3 * 3600 * 1000; // 3 hours — LME reports daily

  async fetchInventory(symbol: string): Promise<LMEInventoryData> {
    if (!LME_SYMBOLS.includes(symbol)) {
      log.warn('[LMEAdapter] Symbol ' + symbol + ' not supported, LME supports: ' + LME_SYMBOLS.join(','));
      return this.mockLME(symbol);
    }

    const cached = this.cache.get(symbol);
    if (cached && cached.ts + this.cacheTTL > Date.now()) return cached.data;

    const data = this.mockLME(symbol);
    this.cache.set(symbol, { data, ts: Date.now() });
    return data;
  }

  private mockLME(symbol: string): LMEInventoryData {
    // Realistic base stock levels in tonnes:
    const baseStock: Record<string, number> = {
      'LME_CU': 150000,  // Copper ~150kt
      'LME_AL': 800000,  // Aluminium ~800kt
      'LME_NI': 70000,   // Nickel ~70kt
      'LME_ZN': 150000,  // Zinc ~150kt
    };
    const base = baseStock[symbol] ?? 50000;
    const variance = base * 0.15;

    const onWarrant = Math.round(base + (Math.random() - 0.5) * variance);
    const cancelledWarrants = Math.round(onWarrant * (0.05 + Math.random() * 0.25));
    const total = onWarrant + cancelledWarrants;

    // Daily change — if cancelled is high relative to total, trend = destocking
    const changeOnWarrant = Math.round((Math.random() - 0.5) * base * 0.02 - cancelledWarrants * 0.01);
    const changeCancelled = Math.round((Math.random() - 0.3) * cancelledWarrants * 0.1);

    // PM: "注销仓单↑ = destocking = signal green"
    const cancelRatio = cancelledWarrants / Math.max(1, total);
    let trend: 'destocking' | 'stable' | 'restocking';
    let sig: 'green' | 'yellow' | 'red';

    if (cancelRatio > 0.3 || changeOnWarrant < -2000) {
      trend = 'destocking';
      sig = 'green'; // tight supply = bullish
    } else if (cancelRatio < 0.1 || changeOnWarrant > 2000) {
      trend = 'restocking';
      sig = 'red';   // growing inventory = bearish
    } else {
      trend = 'stable';
      sig = 'yellow';
    }

    return {
      symbol, reportDate: new Date().toISOString().slice(0, 10),
      onWarrant, cancelledWarrants, total,
      changeOnWarrant, changeCancelled,
      trend,
      signal: sig,
    };
  }

  /** Get LME metal name in English */
  getMetalName(symbol: string): string {
    const names: Record<string, string> = {
      'LME_CU': 'Copper', 'LME_AL': 'Aluminium', 'LME_NI': 'Nickel', 'LME_ZN': 'Zinc',
    };
    return names[symbol] ?? symbol;
  }

  /** Get Chinese name */
  getMetalNameCN(symbol: string): string {
    const names: Record<string, string> = {
      'LME_CU': '铜', 'LME_AL': '铝', 'LME_NI': '镍', 'LME_ZN': '锌',
    };
    return names[symbol] ?? symbol;
  }

  getSupportedSymbols(): string[] { return LME_SYMBOLS; }
  isSupported(symbol: string): boolean { return LME_SYMBOLS.includes(symbol); }

  /** Trend description for human UX */
  describeTrend(data: LMEInventoryData): string {
    if (data.trend === 'destocking') return '库存下降 (囤货中)';
    if (data.trend === 'restocking') return '库存上升 (供给充裕)';
    return '库存稳定';
  }
}

export const lmeAdapter = new LMEAdapter();
