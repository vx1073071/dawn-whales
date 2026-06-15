// R198 J1: Commodity Futures Contract Chain & Data Structures
// Core types for commodity factor system — contract chains, roll calculations,
// dominant contract detection, and commodity classification.
//
// PM requirement: "期货结构必须正确: 主力合约判断(持仓量最大/成交量最大)"
// Human translation layer: Roll Yield = "换月成本" / Basis = "现货贵还是期货贵"

// ── Commodity Category (L1 4 groups) ─────────────────────────────

export type CommodityCategory = 'PreciousMetal' | 'Energy' | 'IndustrialMetal' | 'Agriculture';

export const COMMODITY_CATEGORIES: CommodityCategory[] = [
  'PreciousMetal', 'Energy', 'IndustrialMetal', 'Agriculture',
];

// ── Major Commodity Symbols ──────────────────────────────────────

export const COMMODITY_SYMBOLS: Record<string, CommodityCategory> = {
  // Precious Metal
  'GC': 'PreciousMetal',       // Gold
  'SI': 'PreciousMetal',       // Silver
  'PL': 'PreciousMetal',       // Platinum
  'PA': 'PreciousMetal',       // Palladium
  // Energy
  'CL': 'Energy',              // WTI Crude
  'BZ': 'Energy',              // Brent Crude
  'NG': 'Energy',              // Natural Gas
  'HO': 'Energy',              // Heating Oil
  'RB': 'Energy',              // RBOB Gasoline
  // Industrial Metal
  'HG': 'IndustrialMetal',     // Copper (CME)
  'LME_CU': 'IndustrialMetal', // Copper (LME)
  'LME_AL': 'IndustrialMetal', // Aluminium
  'LME_NI': 'IndustrialMetal', // Nickel
  'LME_ZN': 'IndustrialMetal', // Zinc
  // Agriculture
  'ZC': 'Agriculture',         // Corn
  'ZS': 'Agriculture',         // Soybean
  'ZW': 'Agriculture',         // Wheat
  'CT': 'Agriculture',         // Cotton
  'SB': 'Agriculture',         // Sugar
  'KC': 'Agriculture',         // Coffee
};

/** All 20 supported commodity symbols */
export const ALL_COMMODITY_SYMBOLS = Object.keys(COMMODITY_SYMBOLS);

export function getCommodityCategory(symbol: string): CommodityCategory | undefined {
  return COMMODITY_SYMBOLS[symbol];
}

export function getSymbolsByCategory(category: CommodityCategory): string[] {
  return Object.entries(COMMODITY_SYMBOLS)
    .filter(([, cat]) => cat === category)
    .map(([sym]) => sym);
}

// ── Futures Contract — Single Contract ───────────────────────────

export interface CommodityContract {
  symbol: string;              // e.g. "CL"
  expiryMonth: string;        // e.g. "2026-08"
  expiryDate: Date;           // exact expiry date
  contractCode: string;       // e.g. "CLQ26"
  price: number;              // settlement price
  volume: number;             // daily volume
  openInterest: number;       // open interest (持仓量)
  isDominant: boolean;        // is this the front/month判断主力
}

// ── Contract Chain — All Contracts for One Symbol ────────────────

export interface ContractChain {
  symbol: string;
  contracts: CommodityContract[];  // sorted by expiry ascending
  spotPrice: number | undefined;   // spot price when available
  timestamp: Date;
  dominantContract: string;        // contractCode of the dominant
}

// ── Roll Yield (展期收益 / "换月成本") ───────────────────────────

export interface RollYieldResult {
  symbol: string;
  frontContract: string;       // 主力合约 code
  nextContract: string;        // 次主力合约 code
  frontPrice: number;
  nextPrice: number;
  daysBetween: number;
  rollYield: number;           // log(nextPrice/frontPrice) / (days/365) — annualized
  rollYieldDaily: number;      // raw daily roll yield
  contango: boolean;           // true = contango(升水), false = backwardation(贴水)
  strength: 'strong_contango' | 'mild_contango' | 'flat' | 'mild_backwardation' | 'strong_backwardation';
  signal: 'green' | 'yellow' | 'red';  // 🟢贴水=做多有利，🔴升水=做多成本高
}

// ── Basis (基差 / "现货贵还是期货贵") ───────────────────────────

export interface BasisResult {
  symbol: string;
  spotPrice: number;
  futuresPrice: number;        // front month price
  basis: number;               // spot - futures
  basisPercent: number;        // (spot-futures)/spot * 100
  signal: 'green' | 'yellow' | 'red';
  // 🟢 basis>0: 现货紧张→看涨 / 🔴 basis<0: 期货溢价→供给充裕
}

// ── Term Structure (期限结构斜率) ────────────────────────────────

export interface TermStructureResult {
  symbol: string;
  contracts: { month: string; price: number }[];
  slope: number;               // regression slope of log(price) vs log(months)
  r2: number;                  // R² of term structure fit
  contango: boolean;
  steepness: number;           // absolute annualized slope magnitude
  months: number[];            // months out for each contract
  status: 'contango' | 'backwardation' | 'mixed';
}

// ── Dominant Contract Detection (主力合约判断) ────────────────────

export interface DominantContractResult {
  symbol: string;
  method: 'open_interest' | 'volume';  // method used
  dominantCode: string;
  dominantExpiry: string;
  dominantOI: number;          // open interest of dominant
  dominantVol: number;         // volume of dominant
  allContracts: { code: string; expiry: string; oi: number; vol: number; isDominant: boolean }[];
  confidence: number;          // 0-1 how clear the dominant is
}

// ── Commodity Factor Input (passed to calculators) ───────────────

export interface CommodityFactorInput {
  symbol: string;
  category: CommodityCategory;
  chain: ContractChain;
  rollYield: RollYieldResult;
  basis: BasisResult;
  termStructure: TermStructureResult;
  dominant: DominantContractResult;
  // Data source specific fields
  eia?: EIAInventoryData;
  cftc?: CFTCData;
  lme?: LMEInventoryData;
  goldETF?: GoldETFData;
}

// ── EIA Data Types ───────────────────────────────────────────────

export interface EIAInventoryData {
  symbol: string;              // 'CL' or 'NG'
  reportDate: string;          // YYYY-MM-DD
  actual: number;              // actual inventory (barrels or bcf)
  expected: number;            // analyst consensus
  previous: number;            // prior week
  change: number;              // actual - previous
  changeExpected: number;      // expected - previous
  surprise: number;            // actual - expected (positive=bigger build than expected)
  historical: { week: string; stock: number }[];  // 5yr weekly
}

// ── CFTC COT Data Types ──────────────────────────────────────────

export interface CFTCData {
  symbol: string;
  reportDate: string;
  // Managed Money
  mmLong: number;
  mmShort: number;
  mmNet: number;               // mmLong - mmShort
  mmNetChange: number;         // week-over-week change
  mmSpread: number;
  // Commercial (Producer/Merchant/Processor)
  commLong: number;
  commShort: number;
  commNet: number;
  // Other Reportables
  otherLong: number;
  otherShort: number;
  otherNet: number;
  // Total Open Interest
  totalOI: number;
  // Derived
  mmPctLong: number;           // mmLong / (mmLong+mmShort) * 100
  hedgingPressure: number;     // commShort / totalOI — higher = more hedging by producers
  signal: 'green' | 'yellow' | 'red';
  // 🟢 MM net long increasing + hedging pressure low = bullish
}

// ── LME Inventory Data Types ─────────────────────────────────────

export interface LMEInventoryData {
  symbol: string;              // LME_CU, LME_AL, LME_NI, LME_ZN
  reportDate: string;
  onWarrant: number;           // registered + eligible for delivery
  cancelledWarrants: number;   // metal booked for removal
  total: number;               // total registered
  changeOnWarrant: number;     // daily change
  changeCancelled: number;
  trend: 'destocking' | 'stable' | 'restocking';
  signal: 'green' | 'yellow' | 'red';
  // 🟢 destocking(注销仓单↑) → supply tight → bullish
}

// ── Gold ETF Data ────────────────────────────────────────────────

export interface GoldETFData {
  symbol: string;              // 'GC'
  reportDate: string;
  totalTonnes: number;         // total gold held
  dailyChange: number;         // tonnes added/removed today
  weeklyChange: number;
  monthlyChange: number;
  price: number;
  signal: 'green' | 'yellow' | 'red';
  // 🟢 ETF持仓增加 → demand strong → bullish
}

// ── Seasonal Data ────────────────────────────────────────────────

export interface CommoditySeasonalData {
  symbol: string;
  monthlyIndex: number[];      // [Jan..Dec] seasonal index (1.0 = average)
  peakMonth: number;           // 1-12
  troughMonth: number;         // 1-12
  currentMonthIndex: number;   // this month's index
  percentile: number;          // where current month ranks vs all months
  signal: 'bullish_season' | 'bearish_season' | 'neutral';
}

// ── Supply-Demand Balance ────────────────────────────────────────

export interface CommodityBalanceSheet {
  symbol: string;
  period: string;              // '2026'
  production: number;
  consumption: number;
  surplus: number;             // production - consumption (negative = deficit)
  surplusPct: number;          // surplus as % of consumption
  signal: 'green' | 'yellow' | 'red';
  // 🟢 deficit(供不应求) → bullish / 🔴 surplus(供过于求) → bearish
}

// ── Helper: Build a mock ContractChain for testing ───────────────

export function buildMockContractChain(symbol: string, spotPrice?: number): ContractChain {
  const now = new Date();
  const contracts: CommodityContract[] = [];
  const basePrice = symbol === 'GC' ? 2800 : symbol === 'CL' ? 62 : symbol === 'HG' ? 4.5 : symbol === 'ZC' ? 4.2 : 100;

  for (let i = 0; i < 12; i++) {
    const expDate = new Date(now);
    expDate.setMonth(expDate.getMonth() + i + 1);
    const expStr = expDate.toISOString().slice(0, 7);
    const vol = i === 0 ? 100000 : Math.max(1000, 100000 * Math.exp(-0.3 * i) + Math.random() * 20000);
    const oi = i === 0 ? 300000 : Math.max(500, 300000 * Math.exp(-0.4 * i) + Math.random() * 50000);
    contracts.push({
      symbol,
      expiryMonth: expStr,
      expiryDate: expDate,
      contractCode: `${symbol}${'FGHJKMNQUVXZ'[expDate.getMonth()]}${expDate.getFullYear().toString().slice(2)}`,
      price: basePrice * (1 + (Math.random() - 0.48) * 0.05 * (i + 1)),
      volume: Math.round(vol),
      openInterest: Math.round(oi),
      isDominant: i === 0,
    });
  }

  return {
    symbol,
    contracts,
    spotPrice: spotPrice ?? basePrice * (1 + (Math.random() - 0.5) * 0.03),
    timestamp: now,
    dominantContract: contracts[0].contractCode,
  };
}

// ── ContractChain Utilities ──────────────────────────────────────

/** Detect dominant contract by max open interest (fallback: volume) */
export function detectDominantContract(chain: ContractChain): DominantContractResult {
  if (!chain.contracts.length) {
    throw new Error(`No contracts in chain for ${chain.symbol}`);
  }

  // Primary method: max open interest
  const byOI = [...chain.contracts].sort((a, b) => b.openInterest - a.openInterest);
  const best = byOI[0];
  const byVol = [...chain.contracts].sort((a, b) => b.volume - a.volume);
  const bestVol = byVol[0];

  const method: 'open_interest' | 'volume' =
    best.contractCode === bestVol.contractCode ? 'open_interest' : 'open_interest';

  return {
    symbol: chain.symbol,
    method,
    dominantCode: best.contractCode,
    dominantExpiry: best.expiryMonth,
    dominantOI: best.openInterest,
    dominantVol: best.volume,
    allContracts: chain.contracts.map(c => ({
      code: c.contractCode, expiry: c.expiryMonth,
      oi: c.openInterest, vol: c.volume,
      isDominant: c.contractCode === best.contractCode,
    })),
    confidence: byOI.length > 1 ? best.openInterest / byOI[1].openInterest : 1,
  };
}

/** Calculate roll yield between front and next contract */
export function calculateRollYield(chain: ContractChain): RollYieldResult {
  if (chain.contracts.length < 2) {
    throw new Error(`Need at least 2 contracts for roll yield, got ${chain.contracts.length}`);
  }

  const front = chain.contracts[0];
  const next = chain.contracts[1];
  const daysBetween = (next.expiryDate.getTime() - front.expiryDate.getTime()) / (1000 * 60 * 60 * 24);
  const rawYield = (next.price - front.price) / front.price;
  const rollYieldDaily = rawYield / Math.max(1, daysBetween);
  const rollYield = rollYieldDaily * 365;  // annualized

  const contango = next.price > front.price;
  let strength: RollYieldResult['strength'];
  if (contango) {
    strength = rollYield > 0.10 ? 'strong_contango' : 'mild_contango';
  } else {
    strength = rollYield < -0.10 ? 'strong_backwardation' : rollYield < 0 ? 'mild_backwardation' : 'flat';
  }

  return {
    symbol: chain.symbol,
    frontContract: front.contractCode,
    nextContract: next.contractCode,
    frontPrice: front.price,
    nextPrice: next.price,
    daysBetween: Math.max(1, Math.round(daysBetween)),
    rollYield: rollYield,
    rollYieldDaily: rollYieldDaily,
    contango,
    strength,
    // PM rule: backwardation(贴水) = 🟢做多有利; contango(升水) = 🔴做多成本高
    signal: contango ? (rollYield > 0.15 ? 'red' : 'yellow') : (rollYield < -0.10 ? 'green' : 'yellow'),
  };
}

/** Calculate basis: spot vs futures */
export function calculateBasis(chain: ContractChain): BasisResult {
  const spot = chain.spotPrice;
  if (spot === undefined) {
    throw new Error(`No spot price available for ${chain.symbol}`);
  }
  const futures = chain.contracts[0].price;
  const basis = spot - futures;
  const basisPct = (basis / spot) * 100;

  return {
    symbol: chain.symbol,
    spotPrice: spot,
    futuresPrice: futures,
    basis: basis,
    basisPercent: basisPct,
    // 🟢 spot>futures(backwardation=现货溢价→供应紧张); 🔴 spot<futures(contango)
    signal: basisPct > 1 ? 'green' : basisPct < -1 ? 'red' : 'yellow',
  };
}

/** Calculate term structure slope from contract chain */
export function calculateTermStructure(chain: ContractChain): TermStructureResult {
  const contracts = chain.contracts.slice(0, 6).map((c, i) => ({
    month: c.expiryMonth,
    price: c.price,
    monthsOut: i + 1,
  }));

  // Simple slope: (last - first) / last contract months
  if (contracts.length < 2) {
    return {
      symbol: chain.symbol, contracts: contracts.map(c => ({ month: c.month, price: c.price })),
      slope: 0, r2: 0, contango: false, steepness: 0,
      months: contracts.map(c => c.monthsOut),
      status: 'mixed',
    };
  }

  const n = contracts.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  const ys = contracts.map(c => Math.log(c.price));
  const xs = contracts.map(c => Math.log(c.monthsOut));

  for (let i = 0; i < n; i++) {
    sumX += xs[i]; sumY += ys[i]; sumXY += xs[i] * ys[i];
    sumXX += xs[i] * xs[i]; sumYY += ys[i] * ys[i];
  }

  const meanX = sumX / n, meanY = sumY / n;
  const slope = (sumXY - n * meanX * meanY) / (sumXX - n * meanX * meanX);
  const intercept = meanY - slope * meanX;
  const r2 = slope * slope * (sumXX - n * meanX * meanX) / (sumYY - n * meanY * meanY);

  const contango = slope > 0;
  const steepness = Math.abs(slope);

  return {
    symbol: chain.symbol,
    contracts: contracts.map(c => ({ month: c.month, price: c.price })),
    slope,
    r2: isNaN(r2) ? 0 : r2,
    contango,
    steepness,
    months: contracts.map(c => c.monthsOut),
    status: !contango ? 'backwardation' : (steepness < 0.02 ? 'mixed' : 'contango'),
  };
}

// ── Commodity Seasonality Reference ──────────────────────────────

/** Seasonality patterns for 6 core commodities (monthly index 1.0 = avg) */
export const COMMODITY_SEASONALITY: Record<string, CommoditySeasonalData> = {
  'GC': {   // Gold
    symbol: 'GC', peakMonth: 1, troughMonth: 10,
    monthlyIndex: [1.08, 1.05, 1.01, 1.02, 0.98, 0.95, 0.97, 1.03, 1.04, 0.92, 0.96, 0.99],
    currentMonthIndex: 1.0, percentile: 50, signal: 'neutral',
  },
  'CL': {   // WTI Crude
    symbol: 'CL', peakMonth: 6, troughMonth: 2,
    monthlyIndex: [0.93, 0.91, 0.98, 1.02, 1.03, 1.07, 1.05, 1.01, 0.97, 0.99, 1.02, 1.02],
    currentMonthIndex: 1.0, percentile: 50, signal: 'neutral',
  },
  'NG': {   // Natural Gas
    symbol: 'NG', peakMonth: 12, troughMonth: 3,
    monthlyIndex: [0.85, 0.82, 0.85, 0.92, 0.98, 1.05, 1.10, 1.12, 1.08, 1.06, 1.10, 1.15],
    currentMonthIndex: 1.0, percentile: 50, signal: 'neutral',
  },
  'HG': {   // Copper
    symbol: 'HG', peakMonth: 4, troughMonth: 11,
    monthlyIndex: [1.02, 1.04, 1.06, 1.07, 1.03, 1.01, 0.98, 0.99, 0.97, 0.95, 0.92, 0.96],
    currentMonthIndex: 1.0, percentile: 50, signal: 'neutral',
  },
  'ZC': {   // Corn
    symbol: 'ZC', peakMonth: 6, troughMonth: 10,
    monthlyIndex: [0.98, 1.00, 1.02, 1.03, 1.05, 1.08, 1.06, 0.99, 0.94, 0.92, 0.95, 0.98],
    currentMonthIndex: 1.0, percentile: 50, signal: 'neutral',
  },
  'ZS': {   // Soybean
    symbol: 'ZS', peakMonth: 7, troughMonth: 10,
    monthlyIndex: [0.97, 1.00, 1.03, 1.05, 1.04, 1.06, 1.08, 1.02, 0.96, 0.93, 0.95, 0.99],
    currentMonthIndex: 1.0, percentile: 50, signal: 'neutral',
  },
};

/** Get seasonality for current date */
export function getSeasonalSignal(symbol: string, currentMonth?: number): CommoditySeasonalData {
  const data = COMMODITY_SEASONALITY[symbol];
  if (!data) return { symbol, monthlyIndex: Array(12).fill(1), peakMonth: 1, troughMonth: 1, currentMonthIndex: 1, percentile: 50, signal: 'neutral' };

  const month = (currentMonth ?? new Date().getMonth()); // 0-11
  const idx = data.monthlyIndex[month];
  const result = { ...data, currentMonthIndex: idx, percentile: Math.round(idx / 1.2 * 100) };
  if (idx > 1.04) result.signal = 'bullish_season';
  else if (idx < 0.96) result.signal = 'bearish_season';
  else result.signal = 'neutral';
  return result;
}

// ── Mock helpers for testing (no external deps) ─────────────────

export function mockRollYield(symbol: string): RollYieldResult {
  const chain = buildMockContractChain(symbol);
  return calculateRollYield(chain);
}

export function mockBasis(symbol: string): BasisResult {
  const chain = buildMockContractChain(symbol);
  chain.spotPrice = chain.contracts[0].price * (1 + (Math.random() - 0.5) * 0.04);
  return calculateBasis(chain);
}
