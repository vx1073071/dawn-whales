// R194 J2b: TWSE (Taiwan Stock Exchange) Market Data Adapter
// Data sources: margin balance, short ratio, foreign flow, TSMC linkage
import { MarketAdapterBase, type MarketCode, type MarketAdapterConfig } from './market-adapter-base';
import log from 'electron-log';

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