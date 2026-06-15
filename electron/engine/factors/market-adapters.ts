/**
 * R229 JVS-3.5a: Unified Market Adapters (7→1)
 *
 * Merged from: asx-adapter, jpx-adapter, krx-adapter, nse-adapter,
 *   sgx-adapter, stoxx-adapter, twse-adapter
 *
 * Each adapter extends MarketAdapterBase with market-specific:
 *   - factor IDs
 *   - holiday calendar
 *   - mock data for development
 *
 * @version v2.5.0
 */
import { MarketAdapterBase, type MarketCode, type MarketAdapterConfig } from './market-adapter-base';
import log from 'electron-log';



// ═══════════════════════════════════════════════════════
// 1. ASX (Australian Securities Exchange)
// ═══════════════════════════════════════════════════════


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

// ═══════════════════════════════════════════════════════
// 2. JPX (Japan Exchange Group)
// ═══════════════════════════════════════════════════════


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

// ═══════════════════════════════════════════════════════
// 3. KRX (Korea Exchange)
// ═══════════════════════════════════════════════════════


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

// ═══════════════════════════════════════════════════════
// 4. NSE (National Stock Exchange of India)
// ═══════════════════════════════════════════════════════


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

// ═══════════════════════════════════════════════════════
// 5. SGX (Singapore Exchange)
// ═══════════════════════════════════════════════════════


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

// ═══════════════════════════════════════════════════════
// 6. STOXX (European Index)
// ═══════════════════════════════════════════════════════


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

// ═══════════════════════════════════════════════════════
// 7. TWSE (Taiwan Stock Exchange)
// ═══════════════════════════════════════════════════════


export interface MarginBalanceData {
  marginBalanceBln: number;
  marginLongPositionBln: number;
  marginCoverRatio: number;
  dailyChangeBln: number;
}

export interface ShortRatioData {
  shortVolume: number;
  shortBalance: number;
  shortRatio: number;
  daysToCover: number;
}

export interface TwForeignFlowData {
  netBuySellBln: number;
  cumulativeNetBln: number;
  foreignOwnershipPct: number;
}

export interface TsmcLinkageData {
  tsmcReturn1m: number;
  correlation: number;
  beta: number;
  supplyChainLevel: number;
}

export class TwseMarketAdapter extends MarketAdapterBase {
  private marginCache = new Map<string, MarginBalanceData>();
  private shortCache = new Map<string, ShortRatioData>();
  private tsMCache = new Map<string, TsmcLinkageData>();

  constructor(config: Partial<MarketAdapterConfig> = {}) {
    super({ ...config, marketCode: 'TW' as MarketCode, apiBaseUrl: 'https://api.twse.com.tw/v1' });
  }

  async fetchMarketData(symbols: string[], dataType: string): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const parsed = this.parseCurrencySymbol(sym);
      switch (dataType) {
        case 'margin_balance': result.set(sym, this.mockMarginFactor(parsed)); break;
        case 'short_ratio': result.set(sym, this.mockShortFactor(parsed)); break;
        case 'foreign_flow': result.set(sym, this.mockForeignFactor(parsed)); break;
        case 'tsmc_linkage': result.set(sym, this.mockTsmcFactor(parsed)); break;
        case 'dividend_chase': result.set(sym, this.mockDividendChaseFactor(parsed)); break;
        case 'financing_overheat': result.set(sym, this.mockFinancingOverheatFactor(parsed)); break;
        case 'ntdollar': result.set(sym, this.mockNtDollarFactor(parsed)); break;
        default: result.set(sym, {});
      }
    }
    return result;
  }

  async fetchFinancials(symbols: string[]): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    for (const sym of symbols) {
      const p = this.parseCurrencySymbol(sym);
      const isSemi = p.includes('23'); // 2330=TSMC, 23xx = semi
      result.set(sym, {
        marginBuyToday: (100 + p.charCodeAt(0) % 50) * 1e6,
        marginSellToday: (50 + p.charCodeAt(1) % 30) * 1e6,
        shortVolumeToday: (p.length * 1000) * (1 + p.charCodeAt(0) % 3),
        foreignBuySellNet: (10 + p.charCodeAt(1) % 20) * 1e6 * (p.length > 4 ? 1 : -1),
        tsmcCorrelation: isSemi ? 0.7 + p.charCodeAt(0) % 3 * 0.1 : 0.3,
        dividendAmount: p.length > 4 ? 3.5 : 1.5,
        exDividendDays: Math.floor((p.charCodeAt(0) % 12) * 30),
        usdTwd: 29.5 + p.charCodeAt(0) % 5 * 0.3,
      });
    }
    return result;
  }

  getSupportedFactorIds(): string[] {
    return ['TW_MARGIN_BALANCE','TW_SHORT_RATIO','TW_FOREIGN_FLOW',
      'TW_TSMC_LINKAGE','TW_DIVIDEND_CHASE','TW_FINANCING_OVERHEAT','TW_NT_DOLLAR'];
  }

  isHoliday(date: Date): boolean {
    const m = date.getMonth() + 1, d = date.getDate();
    if (m === 1 && d === 1) return true; // New Year
    if (m === 1 && d >= 20 && d <= 30) return true; // Lunar New Year (~late Jan)
    if (m === 2 && d <= 10) return true; // Lunar New Year continued
    if (m === 2 && d === 28) return true; // Peace Memorial
    if (m === 4 && d >= 3 && d <= 5) return true; // QingMing
    if (m === 5 && d === 1) return true; // Labor Day
    if (m === 6 && d >= 10 && d <= 20) return true; // Dragon Boat
    if (m === 9 && d >= 15 && d <= 25) return true; // Mid-Autumn
    if (m === 10 && d === 10) return true; // National Day
    return date.getDay() === 0 || date.getDay() === 6;
  }

  private mockMarginFactor(sym: string): Record<string, number> {
    return { marginBalanceBln: 15, marginChange: 0.02, marginUtilization: 0.65 };
  }
  private mockShortFactor(sym: string): Record<string, number> {
    return { shortRatio: 0.15, shortVolume: 2500000, daysToCover: 3 };
  }
  private mockForeignFactor(sym: string): Record<string, number> {
    return { foreignNetBuyBln: 2.5, foreignOwnershipPct: 0.28, cumulativeFlow: 1 };
  }
  private mockTsmcFactor(sym: string): Record<string, number> {
    const isSemi = sym.includes('23');
    return { tsmcCorrelation: isSemi ? 0.75 : 0.35, supplyChainLevel: isSemi ? 2 : 0 };
  }
  private mockDividendChaseFactor(sym: string): Record<string, number> {
    return { dividendYield: 0.04, daysToExDividend: 45, chaseSignal: 1 };
  }
  private mockFinancingOverheatFactor(sym: string): Record<string, number> {
    return { marginGrowth: 0.25, overheatScore: 0.7, warningLevel: 2 };
  }
  private mockNtDollarFactor(sym: string): Record<string, number> {
    return { usdTwd: 30.2, twdStrength: -1, exportExportRatio: 0.55 };
  }
}