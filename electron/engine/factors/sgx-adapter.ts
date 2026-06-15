// R195 J1b: SGX (Singapore Exchange) Market Data Adapter
// Data: REIT spread, STI weight, SGD linkage, US-ADR check
import { MarketAdapterBase, type MarketCode, type MarketAdapterConfig } from './market-adapter-base';

export class SgxMarketAdapter extends MarketAdapterBase {
  constructor(config: Partial<MarketAdapterConfig> = {}) {
    super({ ...config, marketCode: 'SG' as MarketCode, apiBaseUrl: 'https://api.sgx.com/v1' });
  }

  async fetchMarketData(symbols: string[], dataType: string): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      switch (dataType) {
        case 'reit_spread': result.set(sym, this.mockReitFactor(p)); break;
        case 'sti_weight': result.set(sym, this.mockStiFactor(p)); break;
        case 'sgd_linkage': result.set(sym, this.mockSgdFactor(p)); break;
        case 'dividend_culture': result.set(sym, this.mockDividendFactor(p)); break;
        case 'us_listed': result.set(sym, this.mockUsListedFactor(p)); break;
        default: result.set(sym, {});
      }
    }
    return result;
  }

  async fetchFinancials(symbols: string[]): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      const isReit = p.length > 4 && p.charCodeAt(1) % 3 === 0;
      result.set(sym, {
        isReit: isReit ? 1 : 0,
        dividendYield: isReit ? 0.055 : 0.035,
        propertyYield: isReit ? 0.05 : 0,
        riskFreeRate: 0.025,
        stiWeight: 0.01 + p.charCodeAt(0) % 10 * 0.005,
        usdSgd: 1.32 + p.charCodeAt(0) % 10 * 0.01,
        hasUsListing: p.length > 5 && p.charCodeAt(0) % 5 === 0 ? 1 : 0,
        adrPremium: p.charCodeAt(1) % 10 * 0.02 - 0.05,
      });
    }
    return result;
  }

  getSupportedFactorIds(): string[] {
    return ['SG_REIT_SPREAD','SG_STI_WEIGHT','SG_SGD_LINKAGE','SG_DIVIDEND_CULTURE','SG_US_LISTED'];
  }

  isHoliday(date: Date): boolean {
    const m = date.getMonth() + 1, d = date.getDate();
    if (m === 1 && d === 1) return true;
    if (m === 1 && d >= 20 && d <= 25) return true; // CNY
    if (m === 3 && d >= 20 && d <= 25) return true; // Good Friday
    if (m === 5 && d === 1) return true; // Labour
    if (m === 5 && d >= 15 && d <= 20) return true; // Vesak
    if (m === 7 && d >= 15 && d <= 20) return true; // Hari Raya Haji
    if (m === 8 && d === 9) return true; // National Day
    if (m === 11 && d >= 3 && d <= 5) return true; // Deepavali
    if (m === 12 && d === 25) return true; // Christmas
    return date.getDay() === 0 || date.getDay() === 6;
  }

  private mockReitFactor(sym: string): Record<string, number> {
    const isReit = sym.length > 4 && sym.charCodeAt(1) % 3 === 0;
    return { isReit: isReit ? 1 : 0, spread: isReit ? 0.03 : 0.01, propertyYield: isReit ? 0.05 : 0 };
  }
  private mockStiFactor(sym: string): Record<string, number> {
    return { stiWeight: 0.01 + sym.charCodeAt(0) % 10 * 0.005, inTop10: sym.charCodeAt(0) % 10 === 0 ? 1 : 0 };
  }
  private mockSgdFactor(sym: string): Record<string, number> {
    return { usdSgd: 1.32 + sym.charCodeAt(0) % 10 * 0.01, sgdStrength: sym.charCodeAt(1) % 3 - 1 };
  }
  private mockDividendFactor(sym: string): Record<string, number> {
    return { dividendYield: 0.035, payoutRatio: 0.5, dividendGrowth3y: 0.05 };
  }
  private mockUsListedFactor(sym: string): Record<string, number> {
    const has = sym.length > 5 && sym.charCodeAt(0) % 5 === 0;
    return { hasUsListing: has ? 1 : 0, adrPremium: has ? (sym.charCodeAt(1) % 10 * 0.02 - 0.05) : 0 };
  }
}