// R196 J1b: STOXX (European Index) Market Data Adapter
// Covers DAX (Germany), CAC (France), FTSE (UK) via STOXX 600 sectors
import { MarketAdapterBase, type MarketCode, type MarketAdapterConfig } from './market-adapter-base';

export class StoxxMarketAdapter extends MarketAdapterBase {
  constructor(config: Partial<MarketAdapterConfig> = {}) {
    super({ ...config, marketCode: 'EU' as MarketCode, apiBaseUrl: 'https://api.stoxx.com/v1' });
  }

  async fetchMarketData(symbols: string[], dataType: string): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      switch (dataType) {
        case 'stoxx_sector': result.set(sym, this.mockSectorFactor(p)); break;
        case 'eur_sensitivity': result.set(sym, this.mockEurFactor(p)); break;
        case 'esg_premium': result.set(sym, this.mockEsgFactor(p)); break;
        case 'brexit_shadow': result.set(sym, this.mockBrexitFactor(p)); break;
        default: result.set(sym, {});
      }
    }
    return result;
  }

  async fetchFinancials(symbols: string[]): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      const isUK = p.length > 5 && p.charCodeAt(0) % 4 === 0;
      result.set(sym, {
        stoxxSectorCode: p.charCodeAt(0) % 18,
        sectorMomentum1m: (p.charCodeAt(1) % 10 - 3) * 0.01,
        sectorReturn3m: (p.charCodeAt(0) % 10 - 2) * 0.02,
        esgScore: 50 + p.charCodeAt(0) % 40,
        esgEnvironment: 40 + p.charCodeAt(1) % 45,
        esgGovernance: 45 + p.charCodeAt(0) % 50,
        eurUsd: 1.08 + p.charCodeAt(0) % 10 * 0.01,
        gbpUsd: 1.26 + p.charCodeAt(1) % 10 * 0.005,
        isUKChip: isUK ? 1 : 0,
        ukRevenuePct: isUK ? 0.6 + p.charCodeAt(1) % 4 * 0.1 : 0.1,
      });
    }
    return result;
  }

  getSupportedFactorIds(): string[] {
    return ['EU_STOXX_SECTOR','EU_EUR_SENSITIVITY','EU_ESG_PREMIUM','EU_BREXIT_SHADOW'];
  }

  isHoliday(date: Date): boolean {
    const m = date.getMonth() + 1, d = date.getDate();
    if (m === 1 && d === 1) return true; // New Year
    if (m === 3 && d >= 20 && d <= 24) return true; // Easter
    if (m === 5 && d === 1) return true; // Labour
    if (m === 5 && d >= 5 && d <= 15) return true; // VE Day / Ascension
    if (m === 7 && d === 14) return true; // Bastille (FR)
    if (m === 8 && d >= 15 && d <= 25) return true; // Assumption + Summer
    if (m === 10 && d === 3) return true; // German Unity (DE)
    if (m === 11 && d >= 1 && d <= 11) return true; // All Saints / Armistice
    if (m === 12 && d >= 24 && d <= 31) return true; // Christmas/New Year
    return date.getDay() === 0 || date.getDay() === 6;
  }

  private mockSectorFactor(sym: string): Record<string, number> {
    const code = sym.charCodeAt(0) % 18;
    return { stoxxSectorCode: code, sectorMomentum: (sym.charCodeAt(1) % 10 - 3) * 0.01, rotationSignal: 0 };
  }
  private mockEurFactor(sym: string): Record<string, number> {
    return { eurUsd: 1.08 + sym.charCodeAt(0) % 10 * 0.01, exportRatio: 0.35 + sym.charCodeAt(1) % 5 * 0.05 };
  }
  private mockEsgFactor(sym: string): Record<string, number> {
    const e = 40 + sym.charCodeAt(1) % 45;
    const s = 45 + sym.charCodeAt(0) % 40;
    const g = 45 + sym.charCodeAt(0) % 50;
    return { esgE: e, esgS: s, esgG: g, esgScore: Math.round((e + s + g) / 3), controversy: sym.charCodeAt(1) % 5 };
  }
  private mockBrexitFactor(sym: string): Record<string, number> {
    const isUK = sym.length > 5 && sym.charCodeAt(0) % 4 === 0;
    return { isUKChip: isUK ? 1 : 0, ukRevenuePct: isUK ? 0.6 + sym.charCodeAt(1) % 4 * 0.1 : 0.1, fcaRegImpact: isUK ? -0.02 : 0 };
  }
}