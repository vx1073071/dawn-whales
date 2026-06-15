// R196 J1a: NSE (National Stock Exchange of India) Market Data Adapter
import { MarketAdapterBase, type MarketCode, type MarketAdapterConfig } from './market-adapter-base';

export class NseMarketAdapter extends MarketAdapterBase {
  constructor(config: Partial<MarketAdapterConfig> = {}) {
    super({ ...config, marketCode: 'IN' as MarketCode, apiBaseUrl: 'https://api.nseindia.com/v1' });
  }

  async fetchMarketData(symbols: string[], dataType: string): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      switch (dataType) {
        case 'fii_dii_flow': result.set(sym, this.mockFiiDiiFactor(p)); break;
        case 'monsoon': result.set(sym, this.mockMonsoonFactor(p)); break;
        case 'modi_policy': result.set(sym, this.mockPolicyFactor(p)); break;
        case 'rupee_hedge': result.set(sym, this.mockRupeeFactor(p)); break;
        case 'pledged_shares': result.set(sym, this.mockPledgedFactor(p)); break;
        default: result.set(sym, {});
      }
    }
    return result;
  }

  async fetchFinancials(symbols: string[]): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      const isSector = p.length > 5;
      result.set(sym, {
        fiiNetBuyCr: (5 + p.charCodeAt(0) % 20) * (p.charCodeAt(1) % 2 === 0 ? 1 : -1),
        diiNetBuyCr: (3 + p.charCodeAt(0) % 10) * (p.charCodeAt(1) % 3 === 0 ? -1 : 1),
        monsoonImpact: p.charCodeAt(0) % 12 < 4 ? 1 : p.charCodeAt(0) % 12 < 8 ? 0.5 : 0,
        pledgedPct: 0.05 + p.charCodeAt(0) % 15 * 0.01,
        usdInr: 82 + p.charCodeAt(0) % 10 * 0.5,
        policyThemeScore: 0.5 + p.charCodeAt(1) % 5 * 0.1,
        niftyWeight: 0.005 + p.charCodeAt(0) % 10 * 0.002,
      });
    }
    return result;
  }

  getSupportedFactorIds(): string[] {
    return ['IN_FII_DII_FLOW','IN_MONSOON_EFFECT','IN_MODI_POLICY','IN_RUPEE_HEDGE','IN_PLEDGED_SHARES'];
  }

  isHoliday(date: Date): boolean {
    const m = date.getMonth() + 1, d = date.getDate();
    if (m === 1 && d === 26) return true; // Republic
    if (m === 3 && d >= 1 && d <= 10) return true; // Holi
    if (m === 4 && d >= 1 && d <= 15) return true; // Good Friday/Eid
    if (m === 5 && d === 1) return true; // Maharashtra
    if (m === 8 && d === 15) return true; // Independence
    if (m === 9 && d >= 1 && d <= 10) return true; // Ganesh
    if (m === 10 && d === 2) return true; // Gandhi
    if (m === 11 && d >= 1 && d <= 15) return true; // Diwali
    return date.getDay() === 0 || date.getDay() === 6;
  }

  private mockFiiDiiFactor(sym: string): Record<string, number> {
    const netFii = (5 + sym.charCodeAt(0) % 20) * (sym.charCodeAt(1) % 2 === 0 ? 1 : -1);
    const netDii = (3 + sym.charCodeAt(0) % 10) * (sym.charCodeAt(1) % 3 === 0 ? -1 : 1);
    return { fiiNetBuyCr: netFii, diiNetBuyCr: netDii, fiiOwnership: 0.18 + sym.charCodeAt(0) % 10 * 0.01 };
  }
  private mockMonsoonFactor(sym: string): Record<string, number> {
    const month = new Date().getMonth() + 1;
    return { monsoonPeriod: month >= 6 && month <= 9 ? 1 : 0, agriExposure: 0.1 + sym.charCodeAt(1) % 5 * 0.05 };
  }
  private mockPolicyFactor(sym: string): Record<string, number> {
    return { policyThemeScore: 0.5 + sym.charCodeAt(1) % 5 * 0.1, infraExposure: sym.length > 5 ? 0.4 : 0.1 };
  }
  private mockRupeeFactor(sym: string): Record<string, number> {
    return { usdInr: 82 + sym.charCodeAt(0) % 10 * 0.5, importExposure: 0.2 + sym.charCodeAt(1) % 5 * 0.05 };
  }
  private mockPledgedFactor(sym: string): Record<string, number> {
    return { pledgedPct: 0.05 + sym.charCodeAt(0) % 15 * 0.01, promoterHolding: 0.4 + sym.charCodeAt(1) % 5 * 0.05 };
  }
}