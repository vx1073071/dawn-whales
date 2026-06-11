// ── JVS-18: Margin Trading Data Service (融资融券数据服务) ────────────────
// Fetches margin balance and short interest data from East Money datacenter
// - Margin balance history (融资余额)
// - Short interest (融券余量)
// - Margin trading by stock (个股融资融券)
// - Market-wide margin trends

import log from 'electron-log';

import https from 'https';
import http from 'http';
import { httpGet } from '../utils/http';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface MarginBalance {
  date: string;
  totalMarginBalance: number;      // 融资余额 (亿元)
  totalShortBalance: number;       // 融券余额 (亿元)
  totalBalance: number;            // 融资融券余额 (亿元)
  marginChange: number;            // 融资余额变化 (亿元)
  shortChange: number;             // 融券余额变化 (亿元)
  marginBuyAmount: number;         // 融资买入额 (亿元)
  shortSellVolume: number;         // 融券卖出量 (亿股)
}

export interface StockMargin {
  code: string;
  name: string;
  date: string;
  marginBalance: number;           // 融资余额 (万元)
  marginBuyAmount: number;         // 融资买入额 (万元)
  marginRepayAmount: number;       // 融资偿还额 (万元)
  marginNetBuy: number;            // 融资净买入 (万元)
  shortBalance: number;            // 融券余量 (股)
  shortSellVolume: number;         // 融券卖出量 (股)
  shortRepayVolume: number;        // 融券偿还量 (股)
  shortNetSell: number;            // 融券净卖出 (股)
  totalBalance: number;            // 融资融券余额 (万元)
}

export interface MarginRanking {
  code: string;
  name: string;
  marginBalance: number;           // 融资余额 (万元)
  marginChange: number;            // 融资余额变化率 %
  marginNetBuy: number;            // 融资净买入 (万元)
  shortBalance: number;            // 融券余量 (万股)
  shortChange: number;             // 融券余量变化率 %
  totalBalance: number;            // 融资融券余额 (万元)
}

export interface MarginDataReport {
  success: boolean;
  marketBalance: MarginBalance[];
  topMarginStocks: MarginRanking[];
  topShortStocks: MarginRanking[];
  timestamp: number;
  error?: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  expires: number;
}

const CACHE_TTL = 30 * 60 * 1000;  // 30 minutes
const cache = new Map<string, CacheEntry>();

// ── API Functions ──────────────────────────────────────────────────────────

/**
 * 获取市场融资融券余额历史
 */
export async function getMarketMarginBalance(days = 30): Promise<MarginBalance[]> {
  const cacheKey = `market-margin-${days}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_WEB_RZRQ_ZCZJMX&columns=REPORT_DATE,RZYE,RQYE,RZRQYE,RZJMRE,RQJMRE,RZJME,RQJME&pageSize=${days}&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      log.warn('[MarginData] No market margin balance data');
      return [];
    }

    const balances: MarginBalance[] = data.result.data.map((item: unknown, idx: number) => {
      const prev = data.result.data[idx + 1];
      return {
        date: item.REPORT_DATE?.split(' ')[0] || '',
        totalMarginBalance: parseFloat(item.RZYE) || 0,
        totalShortBalance: parseFloat(item.RQYE) || 0,
        totalBalance: parseFloat(item.RZRQYE) || 0,
        marginChange: prev ? (parseFloat(item.RZYE) - parseFloat(prev.RZYE)) : 0,
        shortChange: prev ? (parseFloat(item.RQYE) - parseFloat(prev.RQYE)) : 0,
        marginBuyAmount: parseFloat(item.RZJMRE) || 0,
        shortSellVolume: parseFloat(item.RQJMRE) || 0,
      };
    }).reverse();

    cache.set(cacheKey, { data: balances, expires: Date.now() + CACHE_TTL });
    log.info(`[MarginData] Market margin balance: ${balances.length} days`);
    return balances;
  } catch (err: unknown) {
    log.error('[MarginData] Market margin balance error:', err.message);
    return [];
  }
}

/**
 * 获取个股融资融券数据
 */
export async function getStockMargin(code: string, days = 30): Promise<StockMargin[]> {
  const cacheKey = `stock-margin-${code}-${days}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const secid = getSecId(code);
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_WEB_RZRQ_GGMX&columns=SECUCODE,SECNAME,REPORT_DATE,RZYE,RZMRE,RZCHE,RZJME,RQYL,RQMCL,RQCHL,RQJML,RZRQYE&filter=(SECUCODE="${secid}")&pageSize=${days}&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      log.warn(`[MarginData] No margin data for ${code}`);
      return [];
    }

    const margins: StockMargin[] = data.result.data.map((item: unknown) => ({
      code: item.SECUCODE?.split('.')[0] || code,
      name: item.SECNAME || '',
      date: item.REPORT_DATE?.split(' ')[0] || '',
      marginBalance: parseFloat(item.RZYE) || 0,
      marginBuyAmount: parseFloat(item.RZMRE) || 0,
      marginRepayAmount: parseFloat(item.RZCHE) || 0,
      marginNetBuy: parseFloat(item.RZJME) || 0,
      shortBalance: parseFloat(item.RQYL) || 0,
      shortSellVolume: parseFloat(item.RQMCL) || 0,
      shortRepayVolume: parseFloat(item.RQCHL) || 0,
      shortNetSell: parseFloat(item.RQJML) || 0,
      totalBalance: parseFloat(item.RZRQYE) || 0,
    })).reverse();

    cache.set(cacheKey, { data: margins, expires: Date.now() + CACHE_TTL });
    log.info(`[MarginData] Stock ${code} margin: ${margins.length} days`);
    return margins;
  } catch (err: unknown) {
    log.error(`[MarginData] Stock ${code} margin error:`, err.message);
    return [];
  }
}

/**
 * 获取融资余额排行（Top N）
 */
export async function getMarginBalanceRanking(limit = 30): Promise<MarginRanking[]> {
  const cacheKey = `margin-rank-${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_WEB_RZRQ_GGMX&columns=SECUCODE,SECNAME,RZYE,RZYE_TONGBI,RZJME,RQYL,RQYL_TONGBI,RZRQYE&pageSize=${limit}&sortColumns=RZYE&sortTypes=-1&source=WEB&client=WEB`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      log.warn('[MarginData] No margin ranking data');
      return [];
    }

    const rankings: MarginRanking[] = data.result.data.map((item: unknown) => ({
      code: item.SECUCODE?.split('.')[0] || '',
      name: item.SECNAME || '',
      marginBalance: parseFloat(item.RZYE) || 0,
      marginChange: parseFloat(item.RZYE_TONGBI) || 0,
      marginNetBuy: parseFloat(item.RZJME) || 0,
      shortBalance: parseFloat(item.RQYL) || 0,
      shortChange: parseFloat(item.RQYL_TONGBI) || 0,
      totalBalance: parseFloat(item.RZRQYE) || 0,
    }));

    cache.set(cacheKey, { data: rankings, expires: Date.now() + CACHE_TTL });
    log.info(`[MarginData] Margin ranking: ${rankings.length} stocks`);
    return rankings;
  } catch (err: unknown) {
    log.error('[MarginData] Margin ranking error:', err.message);
    return [];
  }
}

/**
 * 获取融券余量排行（Top N）
 */
export async function getShortInterestRanking(limit = 30): Promise<MarginRanking[]> {
  const cacheKey = `short-rank-${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_WEB_RZRQ_GGMX&columns=SECUCODE,SECNAME,RZYE,RZYE_TONGBI,RZJME,RQYL,RQYL_TONGBI,RZRQYE&pageSize=${limit}&sortColumns=RQYL&sortTypes=-1&source=WEB&client=WEB`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      log.warn('[MarginData] No short ranking data');
      return [];
    }

    const rankings: MarginRanking[] = data.result.data.map((item: unknown) => ({
      code: item.SECUCODE?.split('.')[0] || '',
      name: item.SECNAME || '',
      marginBalance: parseFloat(item.RZYE) || 0,
      marginChange: parseFloat(item.RZYE_TONGBI) || 0,
      marginNetBuy: parseFloat(item.RZJME) || 0,
      shortBalance: parseFloat(item.RQYL) || 0,
      shortChange: parseFloat(item.RQYL_TONGBI) || 0,
      totalBalance: parseFloat(item.RZRQYE) || 0,
    }));

    cache.set(cacheKey, { data: rankings, expires: Date.now() + CACHE_TTL });
    log.info(`[MarginData] Short ranking: ${rankings.length} stocks`);
    return rankings;
  } catch (err: unknown) {
    log.error('[MarginData] Short ranking error:', err.message);
    return [];
  }
}

/**
 * 获取完整融资融券报告
 */
export async function getMarginDataReport(): Promise<MarginDataReport> {
  const cacheKey = 'margin-report';
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const [marketBalance, topMarginStocks, topShortStocks] = await Promise.all([
      getMarketMarginBalance(30),
      getMarginBalanceRanking(20),
      getShortInterestRanking(20),
    ]);

    const report: MarginDataReport = {
      success: marketBalance.length > 0 || topMarginStocks.length > 0,
      marketBalance,
      topMarginStocks,
      topShortStocks,
      timestamp: Date.now(),
    };

    cache.set(cacheKey, { data: report, expires: Date.now() + CACHE_TTL });
    log.info('[MarginData] Full report generated');
    return report;
  } catch (err: unknown) {
    log.error('[MarginData] Report error:', err.message);
    return {
      success: false,
      marketBalance: [],
      topMarginStocks: [],
      topShortStocks: [],
      timestamp: Date.now(),
      error: err.message,
    };
  }
}

// ── Helper Functions ───────────────────────────────────────────────────────

function getSecId(code: string): string {
  if (code.startsWith('6')) return `${code}.SH`;
  if (code.startsWith('0') || code.startsWith('3')) return `${code}.SZ`;
  if (code.startsWith('4') || code.startsWith('8')) return `${code}.BJ`;
  return `${code}.SH`;
}

export function clearMarginDataCache(): void {
  cache.clear();
}
