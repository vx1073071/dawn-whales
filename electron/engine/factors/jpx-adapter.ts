// R194 J2: JPX (Japan Exchange Group) Market Data Adapter
// Data sources: BoJ ETF purchases, foreign investor flows, JPX400, TOPIX sectors
import { MarketAdapterBase, type MarketCode, type MarketAdapterConfig } from './market-adapter-base';
import log from 'electron-log';

export interface BojEtfData {
  dailyPurchaseBln: number;
  cumulativeTrillion: number;
  topixLevel: number;
  targetReached: boolean;
}

export interface Jpx400Data {
  symbol: string;
  roe: number;
  operatingProfitMargin: number;
  marketCapBln: number;
  compositeScore: number;
  alphanumericName: string;
}

export interface ForeignFlowData {
  netBuySellBln: number;
  buyVolume: number;
  sellVolume: number;
  weeklyTrend: number;
}

export interface TopixSectorData {
  sectorCode: string;
  sectorName: string;
  weight: number;
  return1m: number;
  return3m: number;
  momentumSignal: number;
}

export class JpxMarketAdapter extends MarketAdapterBase {
  private jpx400Cache: Map<string, Jpx400Data> = new Map();
  private topixSectors: TopixSectorData[] = [];
  private lastBojData: BojEtfData | null = null;
  private lastForeignFlow: ForeignFlowData | null = null;

  constructor(config: Partial<MarketAdapterConfig> = {}) {
    super({ ...config, marketCode: 'JP' as MarketCode, apiBaseUrl: 'https://api.jpx.co.jp/v1' });
    // Default TOPIX 17 sectors
    this.initTopixSectors();
  }

  private initTopixSectors(): void {
  const names = ['Foods','Energy','ConstMaterials','RawMaterials','Pharma','Auto','TransportEq','Steel','NonFerrous','Machinery','ElecPrecision','IT','Retail','Banking','Securities','RealEstate','Services'];
    this.topixSectors = names.map((name, i) => ({
      sectorCode: `TOPIX${String(i+1).padStart(2,'0')}`, sectorName: name,
      weight: 1 / names.length, return1m: 0, return3m: 0, momentumSignal: 0
    }));
  }

  async fetchMarketData(symbols: string[], dataType: string): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const parsed = this.parseCurrencySymbol(sym);
      if (dataType === 'boj_etf') {
        result.set(sym, this.mockBojEtfFactor(parsed));
      } else if (dataType === 'foreign_flow') {
        result.set(sym, this.mockForeignFlowFactor(parsed));
      } else if (dataType === 'jpx400') {
        result.set(sym, this.mockJpx400Factor(parsed));
      } else if (dataType === 'topix_sector') {
        result.set(sym, this.mockTopixSectorFactor(parsed));
      } else if (dataType === 'cross_holding') {
        result.set(sym, this.mockCrossHoldingFactor(parsed));
      } else if (dataType === 'yen_sensitivity') {
        result.set(sym, this.mockYenSensitivityFactor(parsed));
      } else if (dataType === 'shareholder_benefit') {
        result.set(sym, this.mockShareholderBenefitFactor(parsed));
      } else {
        result.set(sym, {});
      }
    }
    return result;
  }

  async fetchFinancials(symbols: string[]): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      result.set(sym, {
        roe: 0.08 + (p.charCodeAt(0) % 7) * 0.02,
        roa: 0.03 + (p.charCodeAt(1) || 65) * 0.005 / 65,
        crossHoldRatio: 0.1 + (p.length % 5) * 0.05,
        dividendYield: 0.02 + (p.charCodeAt(0) % 5) * 0.005,
        bankLendingExposure: p.length > 5 ? 0.3 : 0.1,
      });
    }
    return result;
  }

  getSupportedFactorIds(): string[] {
    return ['JP_BOJ_ETF','JP_CROSS_HOLDING','JP_MARCH_EFFECT','JPY_CARRY_TRADE','JPX_400_SELECTION',
      'JP_TOPIX_SECTOR','JP_FOREIGN_FLOW','JP_DIVIDEND_SEASON','JP_SHAREHOLDER_BENEFIT',
      'JP_BANK_LENDING','JP_VALUE_TRAP','JPY_SENSITIVITY'];
  }

  isHoliday(date: Date): boolean {
    const m = date.getMonth() + 1, d = date.getDate();
    // Major JP holidays (simplified)
    if (m === 1 && d <= 3) return true; // New Year
    if (m === 1 && d >= 8 && d <= 15 && date.getDay() === 1) return true; // Coming of Age (2nd Mon)
    if (m === 2 && d === 11) return true; // Nat Foundation
    if (m === 2 && d === 23) return true; // Emperor Birthday
    if (m === 3 && d >= 20) return true; // Vernal Equinox (~Mar21)
    if (m === 4 && d === 29) return true; // Showa Day
    if (m === 5 && d >= 3 && d <= 5) return true; // Golden Week
    if (m === 7 && d >= 15 && d <= 20 && date.getDay() === 1) return true; // Marine Day (3rd Mon)
    if (m === 8 && d >= 11 && d <= 15) return true; // Obon
    if (m === 9 && d >= 15 && d <= 23) return true; // Respect for Aged / Autumnal Equinox
    if (m === 10 && d >= 8 && d <= 14 && date.getDay() === 1) return true; // Sports Day
    if (m === 11 && d === 3) return true; // Culture Day
    if (m === 11 && d === 23) return true; // Labor Thanks
    if (m === 12 && d >= 29) return true; // Year End
    return date.getDay() === 0 || date.getDay() === 6; // Weekends
  }

  // Mock data generators for factor calculators
  private mockBojEtfFactor(symbol: string): Record<string, number> {
    return { bojEtfPurchasing: 0.7, topixDeviation: 0.05, etfFlowDirection: 1 };
  }
  private mockForeignFlowFactor(symbol: string): Record<string, number> {
    return { netBuySellBln: 15, weeklyTrend: 0.02, foreignOwnershipRatio: 0.31 };
  }
  private mockJpx400Factor(symbol: string): Record<string, number> {
    return { jpx400Included: 1, roeRank: 0.6, compositeScore: 72 };
  }
  private mockTopixSectorFactor(symbol: string): Record<string, number> {
    return { sectorMomentum: 0.03, sectorWeight: 0.06, rotationSignal: 0 }
  }
  private mockCrossHoldingFactor(symbol: string): Record<string, number> {
    return { crossHoldingRatio: 0.15, unwindingTrend: -0.01, holdingDiscount: 0.2 };
  }
  private mockYenSensitivityFactor(symbol: string): Record<string, number> {
    return { yenBeta: 1.2, exportRatio: 0.45, yenStrength: 125 };
  }
  private mockShareholderBenefitFactor(symbol: string): Record<string, number> {
    return { hasBenefit: 1, benefitValue: 5000, shareholderCount: 500000 };
  }

  getBojEtfStatus(): BojEtfData | null { return this.lastBojData; }
  getForeignFlow(): ForeignFlowData | null { return this.lastForeignFlow; }
  getJpx400List(): Jpx400Data[] { return Array.from(this.jpx400Cache.values()); }
  getTopixSectors(): TopixSectorData[] { return this.topixSectors; }
}