// R195 J1a: KRX (Korea Exchange) Market Data Adapter
// Data: chaebol discount, foreign ownership, option expiry, Samsung linkage
import { MarketAdapterBase, type MarketCode, type MarketAdapterConfig } from './market-adapter-base';

export interface ChaebolData {
  groupName: string;
  discount: number;
  crossHoldings: number;
  governanceScore: number;
}

export class KrxMarketAdapter extends MarketAdapterBase {
  constructor(config: Partial<MarketAdapterConfig> = {}) {
    super({ ...config, marketCode: 'KR' as MarketCode, apiBaseUrl: 'https://api.krx.co.kr/v1' });
  }

  async fetchMarketData(symbols: string[], dataType: string): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      switch (dataType) {
        case 'chaebol_discount': result.set(sym, this.mockChaebolFactor(p)); break;
        case 'foreign_ownership': result.set(sym, this.mockForeignFactor(p)); break;
        case 'option_expiry': result.set(sym, this.mockOptionExpiryFactor(p)); break;
        case 'samsung_linkage': result.set(sym, this.mockSamsungFactor(p)); break;
        case 'krw_sensitivity': result.set(sym, this.mockKrwFactor(p)); break;
        case 'dividend_yield': result.set(sym, this.mockDividendFactor(p)); break;
        default: result.set(sym, {});
      }
    }
    return result;
  }

  async fetchFinancials(symbols: string[]): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      const isSamsung = p.includes('005930') || p.includes('005935');
      result.set(sym, {
        chaebolGroup: isSamsung ? 1 : (p.length > 5 && p.charCodeAt(0) % 3 === 0 ? 1 : 0),
        foreignOwnership: 0.25 + p.charCodeAt(0) % 15 * 0.01,
        samsungCorrelation: isSamsung ? 1 : 0.3 + p.charCodeAt(1) % 5 * 0.1,
        optionExpiryDays: Math.floor(p.charCodeAt(0) % 14),
        usdKrw: 1250 + p.charCodeAt(0) % 100,
        dividendYield: 0.02 + p.charCodeAt(1) % 5 * 0.005,
      });
    }
    return result;
  }

  getSupportedFactorIds(): string[] {
    return ['KR_CHAEBOL_DISCOUNT','KR_FOREIGN_OWNERSHIP','KR_SAMSUNG_LINKAGE','KR_OPTION_EXPIRY','KR_KRW_SENSITIVITY','KR_DIVIDEND_YIELD'];
  }

  isHoliday(date: Date): boolean {
    const m = date.getMonth() + 1, d = date.getDate();
    if (m === 1 && d === 1) return true;
    if (m === 1 && d >= 20 && d <= 24) return true; // Seollal
    if (m === 3 && d === 1) return true; // Independence
    if (m === 5 && d === 5) return true; // Children
    if (m === 5 && d === 15) return true; // Buddha
    if (m === 6 && d === 6) return true; // Memorial
    if (m === 8 && d === 15) return true; // Liberation
    if (m === 9 && d >= 15 && d <= 18) return true; // Chuseok
    if (m === 10 && d === 3) return true; // Foundation
    if (m === 10 && d === 9) return true; // Hangeul
    return date.getDay() === 0 || date.getDay() === 6;
  }

  private mockChaebolFactor(sym: string): Record<string, number> {
    const isChaebol = sym.length > 5 && sym.charCodeAt(0) % 3 === 0;
    return { chaebolGroup: isChaebol ? 1 : 0, discount: isChaebol ? 0.35 : 0, governanceScore: isChaebol ? 55 : 75 };
  }
  private mockForeignFactor(sym: string): Record<string, number> {
    return { foreignOwnership: 0.25 + sym.charCodeAt(0) % 15 * 0.01, foreignNetBuy: sym.charCodeAt(1) % 20 * 1e6 };
  }
  private mockOptionExpiryFactor(sym: string): Record<string, number> {
    return { daysToExpiry: sym.charCodeAt(0) % 14, gammaExposure: (sym.charCodeAt(1) % 10 - 5) * 0.1 };
  }
  private mockSamsungFactor(sym: string): Record<string, number> {
    const isSamsung = sym.includes('005930');
    return { samsungCorrelation: isSamsung ? 1 : 0.3 + sym.charCodeAt(1) % 5 * 0.1, supplyChainTier: isSamsung ? 0 : sym.charCodeAt(0) % 3 + 1 };
  }
  private mockKrwFactor(sym: string): Record<string, number> {
    return { usdKrw: 1250 + sym.charCodeAt(0) % 100, exportRatio: 0.3 + sym.charCodeAt(1) % 4 * 0.1 };
  }
  private mockDividendFactor(sym: string): Record<string, number> {
    return { dividendYield: 0.02 + sym.charCodeAt(1) % 5 * 0.005, payoutRatio: 0.15 + sym.charCodeAt(0) % 5 * 0.05 };
  }
}