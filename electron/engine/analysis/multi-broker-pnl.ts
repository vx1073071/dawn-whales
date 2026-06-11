// ── Q66: Multi-Broker P&L Consolidation Engine ────────────────────────────────
// Real-time P&L across multiple broker accounts
// Main account (HKD 17.26M) + Sub account + Currency conversion + Attribution

import log from 'electron-log';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export interface AccountPnL {
  accountId: string;
  accountName: string;
  currency: string;
  totalValue: number;          // in HKD
  cash: number;                // in account currency
  marketValue: number;         // in HKD
  dailyPnL: number;            // HKD
  dailyPnLPct: number;
  weeklyPnL: number;
  monthlyPnL: number;
  ytdPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  leverage: number;
  marginUsed: number;          // HKD
  buyingPower: number;          // HKD
}

export interface PositionPnL {
  symbol: string;
  name: string;
  exchange: string;
  quantity: number;
  avgCost: number;             // account currency
  currentPrice: number;
  marketValue: number;         // HKD
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  dayChange: number;           // HKD
  dayChangePct: number;
  weight: number;              // % of total portfolio
  accountId: string;
  sector: string;
}

export interface SectorAllocation {
  sector: string;
  marketValue: number;         // HKD
  weight: number;              // % of total
  dayChange: number;           // HKD
  ytdChange: number;           // HKD
  positions: number;
  topPosition: string;
}

export interface ConsolidatedPnL {
  date: string;
  timestamp: number;

  // Overall
  totalValue: number;          // HKD consolidated
  totalCash: number;
  totalMarketValue: number;
  totalDailyPnL: number;
  totalDailyPnLPct: number;
  totalWeeklyPnL: number;
  totalMonthlyPnL: number;
  totalYtdPnL: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;

  // Leverage
  grossLeverage: number;
  netLeverage: number;
  marginUsed: number;
  availableMargin: number;

  // Per-account breakdown
  accounts: AccountPnL[];

  // Positions
  positions: PositionPnL[];

  // Sector allocation
  bySector: SectorAllocation[];

  // Currency breakdown
  byCurrency: Array<{
    currency: string;
    value: number;              // HKD equivalent
    weight: number;
    dailyPnL: number;
  }>;

  // Top movers
  topGainers: PositionPnL[];
  topLosers: PositionPnL[];

  // Attribution
  attribution: {
    fromLong: number;
    fromShort: number;
    fromFx: number;
    fromDividends: number;
    fromFees: number;
  };
}

// ── FX Rates ─────────────────────────────────────────────────────────────

const FX_TO_HKD: Record<string, number> = {
  HKD: 1.0, USD: 7.78, CNY: 1.07, EUR: 8.45, JPY: 0.051, GBP: 9.85, SGD: 5.72,
};

// ── P&L Engine ───────────────────────────────────────────────────────────

export class MultiBrokerPnLEngine {
  constructor() {
    log.info('[MultiBrokerPnLEngine] Initialized');
  }

  // ── Calculate Account P&L ───────────────────────────────────────────

  calculateAccountPnL(
    accountId: string,
    accountName: string,
    currency: string,
    positions: Array<{
      symbol: string; quantity: number; avgCost: number;
      currentPrice: number; previousClose: number;
    }>,
    cashBalance: number,
    startingEquity: number,
    startingDayEquity: number,
    marginUsed: number
  ): AccountPnL {
    const fx = FX_TO_HKD[currency] ?? 1;
    const marketValue = positions.reduce((s, p) =>
      s + p.quantity * p.currentPrice * fx, 0
    );
    const totalValue = marketValue + cashBalance * fx;
    const prevMarketValue = positions.reduce((s, p) =>
      s + p.quantity * p.previousClose * fx, 0
    );

    const unrealizedPnL = positions.reduce((s, p) =>
      s + (p.currentPrice - p.avgCost) * p.quantity * fx, 0
    );
    const dayChange = positions.reduce((s, p) =>
      s + (p.currentPrice - p.previousClose) * p.quantity * fx, 0
    );

    const dailyPnLPct = startingDayEquity > 0 ? dayChange / startingDayEquity : 0;
    const leverage = marginUsed > 0 ? totalValue / (totalValue - marginUsed) : 1.0;

    return {
      accountId, accountName, currency,
      totalValue, cash: cashBalance * fx,
      marketValue, dailyPnL: dayChange, dailyPnLPct,
      weeklyPnL: 0, monthlyPnL: 0, ytdPnL: 0,
      unrealizedPnL, realizedPnL: 0,
      leverage, marginUsed,
      buyingPower: Math.max(0, totalValue - marginUsed),
    };
  }

  // ── Consolidate All Accounts ─────────────────────────────────────────

  consolidate(
    accounts: AccountPnL[],
    positions: PositionPnL[],
    fxRates?: Record<string, number>
  ): ConsolidatedPnL {
    const rates = { ...FX_TO_HKD, ...fxRates };

    // Per-account totals
    const totalValue = accounts.reduce((s, a) => s + a.totalValue, 0);
    const totalCash = accounts.reduce((s, a) => s + a.cash, 0);
    const totalMarketValue = accounts.reduce((s, a) => s + a.marketValue, 0);
    const totalDailyPnL = accounts.reduce((s, a) => s + a.dailyPnL, 0);
    const totalUnrealized = accounts.reduce((s, a) => s + a.unrealizedPnL, 0);
    const totalRealized = accounts.reduce((s, a) => s + a.realizedPnL, 0);
    const totalMargin = accounts.reduce((s, a) => s + a.marginUsed, 0);

    const totalDailyPct = totalValue > 0 ? totalDailyPnL / (totalValue - totalDailyPnL) : 0;
    const grossLev = totalMargin > 0 ? totalValue / (totalValue - totalMargin) : 1.0;
    const netLev = totalValue > 0 ? (totalValue - totalCash) / totalValue : 0;

    // Sector allocation
    const sectorMap: Record<string, SectorAllocation> = {};
    for (const p of positions) {
      if (!sectorMap[p.sector]) {
        sectorMap[p.sector] = { sector: p.sector, marketValue: 0, weight: 0, dayChange: 0, ytdChange: 0, positions: 0, topPosition: p.symbol };
        if (!sectorMap[p.sector].topPosition) sectorMap[p.sector].topPosition = p.symbol;
      }
      sectorMap[p.sector].marketValue += p.marketValue;
      sectorMap[p.sector].dayChange += p.dayChange;
      sectorMap[p.sector].positions++;
      if (p.marketValue > (sectorMap[p.sector].marketValue - p.marketValue)) {
        sectorMap[p.sector].topPosition = p.symbol;
      }
    }
    for (const s of Object.values(sectorMap)) {
      s.weight = Math.round(s.marketValue / totalMarketValue * 10000) / 100;
    }
    const bySector = Object.values(sectorMap).sort((a, b) => b.marketValue - a.marketValue);

    // Currency breakdown
    const currencyMap: Record<string, { value: number; dailyPnL: number }> = {};
    for (const a of accounts) {
      const c = a.currency;
      if (!currencyMap[c]) currencyMap[c] = { value: 0, dailyPnL: 0 };
      currencyMap[c].value += a.totalValue;
      currencyMap[c].dailyPnL += a.dailyPnL;
    }
    const byCurrency = Object.entries(currencyMap).map(([currency, v]) => ({
      currency,
      value: v.value,
      weight: Math.round(v.value / totalValue * 10000) / 100,
      dailyPnL: v.dailyPnL,
    })).sort((a, b) => b.value - a.value);

    // Top movers
    const sorted = [...positions].sort((a, b) => b.dayChangePct - a.dayChangePct);
    const topGainers = sorted.filter(p => p.dayChangePct > 0).slice(0, 5);
    const topLosers = sorted.filter(p => p.dayChangePct < 0).slice(-5).reverse();

    return {
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      totalValue, totalCash, totalMarketValue,
      totalDailyPnL, totalDailyPnLPct: Math.round(totalDailyPct * 10000) / 100,
      totalWeeklyPnL: accounts.reduce((s, a) => s + a.weeklyPnL, 0),
      totalMonthlyPnL: accounts.reduce((s, a) => s + a.monthlyPnL, 0),
      totalYtdPnL: accounts.reduce((s, a) => s + a.ytdPnL, 0),
      totalUnrealizedPnL: totalUnrealized,
      totalRealizedPnL: totalRealized,
      grossLeverage: Math.round(grossLev * 100) / 100,
      netLeverage: Math.round(netLev * 100) / 100,
      marginUsed: totalMargin,
      availableMargin: Math.max(0, totalValue * 2 - totalMargin),
      accounts,
      bySector,
      byCurrency,
      topGainers,
      topLosers,
      positions: positions.sort((a, b) => b.marketValue - a.marketValue),
      attribution: {
        fromLong: positions.filter(p => p.unrealizedPnL > 0).reduce((s, p) => s + p.unrealizedPnL, 0),
        fromShort: positions.filter(p => p.unrealizedPnL < 0).reduce((s, p) => s + p.unrealizedPnL, 0),
        fromFx: 0, fromDividends: 0, fromFees: 0,
      },
    };
  }

  // ── Quick Summary ─────────────────────────────────────────────────────

  quickSummary(consolidated: ConsolidatedPnL): string {
    const { totalValue, totalDailyPnL, totalDailyPnLPct, totalUnrealizedPnL, grossLeverage } = consolidated;
    const arrow = totalDailyPnL >= 0 ? '▲' : '▼';
    return `${arrow} ${totalValue >= 0 ? '' : '-'}$${(Math.abs(totalValue) / 1e6).toFixed(1)}M | ` +
      `Day: ${totalDailyPnL >= 0 ? '+' : ''}${(totalDailyPnL / 1e3).toFixed(0)}K (${totalDailyPnLPct >= 0 ? '+' : ''}${totalDailyPnLPct.toFixed(2)}%) | ` +
      `Unrealized: ${totalUnrealizedPnL >= 0 ? '+' : ''}${(totalUnrealizedPnL / 1e3).toFixed(0)}K | ` +
      `Lev: ${grossLeverage.toFixed(2)}x`;
  }
}

export default MultiBrokerPnLEngine;