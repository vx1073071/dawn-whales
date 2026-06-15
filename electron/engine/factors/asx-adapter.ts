// R195 J1c: ASX (Australian Securities Exchange) Market Data Adapter
// Data: commodity linkage, franking credits, dividend season, bank dividends, AUD sensitivity
import { MarketAdapterBase, type MarketCode, type MarketAdapterConfig } from './market-adapter-base';

export interface FrankingData {
  frankingPct: number;
  grossedUpYield: number;
  cashDividend: number;
}

export class AsxMarketAdapter extends MarketAdapterBase {
  constructor(config: Partial<MarketAdapterConfig> = {}) {
    super({ ...config, marketCode: 'AU' as MarketCode, apiBaseUrl: 'https://api.asx.com.au/v1' });
  }

  async fetchMarketData(symbols: string[], dataType: string): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      switch (dataType) {
        case 'commodity_link': result.set(sym, this.mockCommodityFactor(p)); break;
        case 'franking_credit': result.set(sym, this.mockFrankingFactor(p)); break;
        case 'dividend_season': result.set(sym, this.mockDividendSeasonFactor(p)); break;
        case 'bank_dividend': result.set(sym, this.mockBankDividendFactor(p)); break;
        case 'aud_sensitivity': result.set(sym, this.mockAudFactor(p)); break;
        default: result.set(sym, {});
      }
    }
    return result;
  }

  async fetchFinancials(symbols: string[]): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      const isMiner = p.length > 3 && p.charCodeAt(0) % 5 <= 1;
      const isBank = p.length > 4 && p.charCodeAt(0) % 7 === 0;
      result.set(sym, {
        isMiner: isMiner ? 1 : 0,
        isBank: isBank ? 1 : 0,
        ironOreBeta: isMiner ? 1.5 + p.charCodeAt(1) % 5 * 0.1 : 0.2,
        coalBeta: isMiner ? 1.2 : 0.1,
        lngBeta: isMiner ? 0.8 : 0.1,
        goldBeta: isMiner && p.charCodeAt(1) % 2 === 0 ? 1.8 : 0.3,
        frankingPct: 0.7 + p.charCodeAt(0) % 4 * 0.1,
        dividendYield: isBank ? 0.06 : 0.045,
        audUsd: 0.68 + p.charCodeAt(0) % 10 * 0.005,
        rbaRate: 3.6 + p.charCodeAt(1) % 5 * 0.25,
      });
    }
    return result;
  }

  getSupportedFactorIds(): string[] {
    return ['AU_COMMODITY_LINK','AU_FRANKING_CREDIT','AU_DIVIDEND_SEASON','AU_BANK_DIVIDEND','AU_AUD_SENSITIVITY'];
  }

  isHoliday(date: Date): boolean {
    const m = date.getMonth() + 1, d = date.getDate();
    if (m === 1 && d === 1) return true;
    if (m === 1 && d === 26) return true; // Australia Day
    if (m === 3 && d >= 10 && d <= 14 && date.getDay() === 1) return true; // Labour Day (varies by state)
    if (m === 3 && d >= 20 && d <= 25) return true; // Good Friday/Easter
    if (m === 4 && d === 25) return true; // ANZAC Day
    if (m === 6 && d >= 8 && d <= 14 && date.getDay() === 1) return true; // King's Bday
    if (m === 10 && d >= 1 && d <= 7 && date.getDay() === 1) return true; // Labour Day
    if (m === 11 && d >= 1 && d <= 7) return true; // Melbourne Cup (1st Tue)
    if (m === 12 && d === 25) return true; // Christmas
    if (m === 12 && d === 26) return true; // Boxing Day
    return date.getDay() === 0 || date.getDay() === 6;
  }

  private mockCommodityFactor(sym: string): Record<string, number> {
    const isMiner = sym.length > 3 && sym.charCodeAt(0) % 5 <= 1;
    return { isCommodity: isMiner ? 1 : 0, ironOreBeta: isMiner ? 1.5 : 0.2, commodityWeight: isMiner ? 0.6 : 0.1 };
  }
  private mockFrankingFactor(sym: string): Record<string, number> {
    return { frankingPct: 0.7 + sym.charCodeAt(0) % 4 * 0.1, grossedUpYield: 0.065 };
  }
  private mockDividendSeasonFactor(sym: string): Record<string, number> {
    const now = new Date();
    const m = now.getMonth();
    const nearSeason = (m === 1 || m === 7) ? 1 : (m === 0 || m === 6) ? 0.5 : 0;
    return { dividendYield: 0.045, seasonNearness: nearSeason };
  }
  private mockBankDividendFactor(sym: string): Record<string, number> {
    const isBank = sym.length > 4 && sym.charCodeAt(0) % 7 === 0;
    return { isBank: isBank ? 1 : 0, dividendYield: isBank ? 0.065 : 0.04, capitalAdequacy: isBank ? 0.12 : 0 };
  }
  private mockAudFactor(sym: string): Record<string, number> {
    return { audUsd: 0.68 + sym.charCodeAt(0) % 10 * 0.005, exportRatio: 0.3 + sym.charCodeAt(1) % 5 * 0.05 };
  }
}