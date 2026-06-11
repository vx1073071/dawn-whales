// ── JVS-13: Fund Holdings Data (fund holdings) ──────────────────────────────
// Fetches mutual fund holdings and position changes from East Money
// Provides institutional ownership data for stock selection

import log from 'electron-log';

import https from 'https';
import http from 'http';
import { httpGet } from '../utils/http';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface FundHolding {
  fundCode: string;
  fundName: string;
  fundType: string;        // (/hybrid/index)
  stockCode: string;       // position/holding
  stockName: string;       // position/holding
  shares: number;          // ()
  marketValue: number;     // market cap ()
  navRatio: number;        // %
  sharesChange: number;    // (, =, =)
  reportDate: string;
}

export interface StockFundOwnership {
  code: string;
  name: string;
  fundCount: number;
  totalShares: number;     // ()
  totalValue: number;      // market cap ()
  ratioOfFloat: number;    // float shares %
  changeDirection: 'increase' | 'decrease' | 'new' | 'exit' | 'unchanged';
  reportDate: string;
}

export interface FundHoldingResult {
  success: boolean;
  items: (FundHolding | StockFundOwnership)[];
  total: number;
  type: 'fund_holdings' | 'stock_ownership';
  reportDate: string;
  error?: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  expires: number;
}

const CACHE_TTL = 60 * 60 * 1000;  // 1 hour (fund data updates quarterly)
const cache = new Map<string, CacheEntry>();

// ── API Functions ──────────────────────────────────────────────────────────

/**
 * fund holdings 
 */
export async function getFundHoldings(
  fundCode: string,
  reportDate?: string
): Promise<FundHoldingResult> {
  const targetDate = reportDate || getLatestReportDate();
  const cacheKey = `fund-holdings-${fundCode}-${targetDate}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_FUNDDETAIL_HOLDING&columns=ALL&filter=(FUND_CODE="${fundCode}")(REPORT_DATE='${targetDate}')&pageSize=50&pageNumber=1&sortColumns=MARKET_VALUE&sortTypes=-1&source=WEB&client=WEB`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      return { success: false, items: [], total: 0, type: 'fund_holdings', reportDate: targetDate, error: 'No data' };
    }

    const items: FundHolding[] = data.result.data.map((item: unknown) => ({
      fundCode: item.FUND_CODE || fundCode,
      fundName: item.FUND_NAME || '',
      fundType: item.FUND_TYPE || '',
      stockCode: item.SECURITY_CODE || '',
      stockName: item.SECURITY_NAME_ABBR || '',
      shares: parseFloat(item.HOLD_NUM) || 0,
      marketValue: parseFloat(item.MARKET_VALUE) || 0,
      navRatio: parseFloat(item.MARKET_VALUE_RATIO) || 0,
      sharesChange: parseFloat(item.HOLD_NUM_CHANGE) || 0,
      reportDate: targetDate,
    }));

    const result: FundHoldingResult = {
      success: true,
      items,
      total: data.result.count || items.length,
      type: 'fund_holdings',
      reportDate: targetDate,
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    log.info(`[FundHoldings] Fund ${fundCode}: ${items.length} holdings`);
    return result;
  } catch (err: unknown) {
    log.error('[FundHoldings] Fetch error:', err.message);
    return { success: false, items: [], total: 0, type: 'fund_holdings', reportDate: targetDate, error: err.message };
  }
}

/**
 * fund holdings 
 */
export async function getStockFundOwnership(
  stockCode: string,
  reportDate?: string
): Promise<FundHoldingResult> {
  const targetDate = reportDate || getLatestReportDate();
  const cacheKey = `stock-ownership-${stockCode}-${targetDate}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_STOCK_FUNDHOLD&columns=ALL&filter=(SECURITY_CODE="${stockCode}")(REPORT_DATE='${targetDate}')&pageSize=50&pageNumber=1&sortColumns=HOLD_NUM&sortTypes=-1&source=WEB&client=WEB`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      return { success: false, items: [], total: 0, type: 'stock_ownership', reportDate: targetDate, error: 'No data' };
    }

    const items: FundHolding[] = data.result.data.map((item: unknown) => ({
      fundCode: item.FUND_CODE || '',
      fundName: item.FUND_NAME || '',
      fundType: item.FUND_TYPE || '',
      stockCode: stockCode,
      stockName: item.SECURITY_NAME_ABBR || '',
      shares: parseFloat(item.HOLD_NUM) || 0,
      marketValue: parseFloat(item.MARKET_VALUE) || 0,
      navRatio: parseFloat(item.MARKET_VALUE_RATIO) || 0,
      sharesChange: parseFloat(item.HOLD_NUM_CHANGE) || 0,
      reportDate: targetDate,
    }));

    const result: FundHoldingResult = {
      success: true,
      items,
      total: data.result.count || items.length,
      type: 'stock_ownership',
      reportDate: targetDate,
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    log.info(`[FundHoldings] Stock ${stockCode}: held by ${items.length} funds`);
    return result;
  } catch (err: unknown) {
    log.error('[FundHoldings] Stock ownership error:', err.message);
    return { success: false, items: [], total: 0, type: 'stock_ownership', reportDate: targetDate, error: err.message };
  }
}

/**
 *
 */
export async function getFundIncreaseRank(
  limit = 30,
  reportDate?: string
): Promise<FundHoldingResult> {
  const targetDate = reportDate || getLatestReportDate();
  const cacheKey = `fund-increase-${targetDate}-${limit}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_STOCK_FUNDHOLD_CHANGE&columns=ALL&filter=(REPORT_DATE='${targetDate}')&pageSize=${limit}&pageNumber=1&sortColumns=HOLD_NUM_CHANGE&sortTypes=-1&source=WEB&client=WEB`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      return { success: false, items: [], total: 0, type: 'stock_ownership', reportDate: targetDate, error: 'No data' };
    }

    const items: StockFundOwnership[] = data.result.data.map((item: unknown) => ({
      code: item.SECURITY_CODE || '',
      name: item.SECURITY_NAME_ABBR || '',
      fundCount: item.FUND_COUNT || 0,
      totalShares: parseFloat(item.HOLD_NUM) || 0,
      totalValue: parseFloat(item.MARKET_VALUE) || 0,
      ratioOfFloat: parseFloat(item.RATIO_OF_FLOAT) || 0,
      changeDirection: 'increase' as const,
      reportDate: targetDate,
    }));

    const result: FundHoldingResult = {
      success: true,
      items,
      total: data.result.count || items.length,
      type: 'stock_ownership',
      reportDate: targetDate,
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    log.info(`[FundHoldings] Increase rank: ${items.length} stocks`);
    return result;
  } catch (err: unknown) {
    log.error('[FundHoldings] Increase rank error:', err.message);
    return { success: false, items: [], total: 0, type: 'stock_ownership', reportDate: targetDate, error: err.message };
  }
}

/**
 *
 */
export async function getFundDecreaseRank(
  limit = 30,
  reportDate?: string
): Promise<FundHoldingResult> {
  const targetDate = reportDate || getLatestReportDate();
  const cacheKey = `fund-decrease-${targetDate}-${limit}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_STOCK_FUNDHOLD_CHANGE&columns=ALL&filter=(REPORT_DATE='${targetDate}')&pageSize=${limit}&pageNumber=1&sortColumns=HOLD_NUM_CHANGE&sortTypes=1&source=WEB&client=WEB`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      return { success: false, items: [], total: 0, type: 'stock_ownership', reportDate: targetDate, error: 'No data' };
    }

    const items: StockFundOwnership[] = data.result.data.map((item: unknown) => ({
      code: item.SECURITY_CODE || '',
      name: item.SECURITY_NAME_ABBR || '',
      fundCount: item.FUND_COUNT || 0,
      totalShares: parseFloat(item.HOLD_NUM) || 0,
      totalValue: parseFloat(item.MARKET_VALUE) || 0,
      ratioOfFloat: parseFloat(item.RATIO_OF_FLOAT) || 0,
      changeDirection: 'decrease' as const,
      reportDate: targetDate,
    }));

    const result: FundHoldingResult = {
      success: true,
      items,
      total: data.result.count || items.length,
      type: 'stock_ownership',
      reportDate: targetDate,
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    log.info(`[FundHoldings] Decrease rank: ${items.length} stocks`);
    return result;
  } catch (err: unknown) {
    log.error('[FundHoldings] Decrease rank error:', err.message);
    return { success: false, items: [], total: 0, type: 'stock_ownership', reportDate: targetDate, error: err.message };
  }
}

// ── Helper Functions ───────────────────────────────────────────────────────

function getLatestReportDate(): string {
  // Fund reports are quarterly: Q1=03-31, Q2=06-30, Q3=09-30, Q4=12-31
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let quarter: string;
  if (month >= 4 && month <= 7) {
    quarter = `${year}-03-31`;
  } else if (month >= 8 && month <= 10) {
    quarter = `${year}-06-30`;
  } else if (month >= 11) {
    quarter = `${year}-09-30`;
  } else {
    quarter = `${year - 1}-12-31`;
  }

  return quarter;
}

export function clearFundHoldingsCache(): void {
  cache.clear();
  log.info('[FundHoldings] Cache cleared');
}
