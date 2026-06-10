// ── JVS-10: Dragon Tiger List (龙虎榜) Data Service ────────────────────────
// Fetches daily Dragon Tiger List data from East Money
// Shows institutional and major trader buy/sell activities

import log from 'electron-log';
import https from 'https';
import http from 'http';
import { httpGet } from '../utils/http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DragonTigerEntry {
  code: string;           // 股票代码
  name: string;           // 股票名称
  close: number;          // 收盘价
  changePct: number;      // 涨跌幅 %
  netBuyAmount: number;   // 龙虎榜净买额 (万元)
  buyAmount: number;      // 买入额 (万元)
  sellAmount: number;     // 卖出额 (万元)
  turnover: number;       // 成交额 (万元)
  netBuyRatio: number;    // 净买额占总成交比 %
  turnoverRate: number;   // 换手率 %
  reason: string;         // 上榜原因
  date: string;           // 上榜日期
}

export interface DragonTigerDetail {
  code: string;
  name: string;
  date: string;
  reason: string;
  buySeats: TraderSeat[];   // 买入前五席位
  sellSeats: TraderSeat[];  // 卖出前五席位
}

export interface TraderSeat {
  rank: number;            // 排名
  name: string;            // 营业部名称
  buyAmount: number;       // 买入额 (万元)
  sellAmount: number;      // 卖出额 (万元)
  netAmount: number;       // 净额 (万元)
}

export interface DragonTigerResult {
  success: boolean;
  entries: DragonTigerEntry[];
  total: number;
  date: string;
  error?: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: DragonTigerResult;
  expires: number;
}

const CACHE_TTL = 30 * 60 * 1000;  // 30 minutes
const cache = new Map<string, CacheEntry>();

// ── API Functions ──────────────────────────────────────────────────────────

/**
 * 获取龙虎榜列表（当日或指定日期）
 */
export async function getDragonTigerList(date?: string): Promise<DragonTigerResult> {
  const targetDate = date || getTodayStr();
  const cacheKey = `dtl-list-${targetDate}`;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    log.info(`[DragonTiger] Cache hit: ${targetDate}`);
    return cached.data;
  }

  try {
    const url = buildListUrl(targetDate);
    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      const result: DragonTigerResult = {
        success: false,
        entries: [],
        total: 0,
        date: targetDate,
        error: 'No data available',
      };
      return result;
    }

    const entries: DragonTigerEntry[] = data.result.data.map((item: unknown) => ({
      code: item.SECURITY_CODE || '',
      name: item.SECURITY_NAME_ABBR || '',
      close: parseFloat(item.CLOSE_PRICE) || 0,
      changePct: parseFloat(item.CHANGE_RATE) || 0,
      netBuyAmount: parseFloat(item.BILL_NETD_AMT) || 0,
      buyAmount: parseFloat(item.BILL_BUY_AMT) || 0,
      sellAmount: parseFloat(item.BILL_SELL_AMT) || 0,
      turnover: parseFloat(item.AMT) || 0,
      netBuyRatio: parseFloat(item.NETD_AMT_RATIO) || 0,
      turnoverRate: parseFloat(item.TURNOVERRATE) || 0,
      reason: item.EXPLAIN || '',
      date: targetDate,
    }));

    const result: DragonTigerResult = {
      success: true,
      entries,
      total: entries.length,
      date: targetDate,
    };

    // Cache result
    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    log.info(`[DragonTiger] Fetched ${entries.length} entries for ${targetDate}`);
    
    return result;
  } catch (err: unknown) {
    log.error('[DragonTiger] Fetch error:', err.message);
    return {
      success: false,
      entries: [],
      total: 0,
      date: targetDate,
      error: err.message,
    };
  }
}

/**
 * 获取个股龙虎榜详情（买卖前五席位）
 */
export async function getDragonTigerDetail(code: string, date: string): Promise<DragonTigerDetail | null> {
  const cacheKey = `dtl-detail-${code}-${date}`;
  
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data as any;
  }

  try {
    const url = buildDetailUrl(code, date);
    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      return null;
    }

    const detail = data.result.data;
    const buySeats: TraderSeat[] = (detail.BUY_DETAILS || []).slice(0, 5).map((item: unknown, idx: number) => ({
      rank: idx + 1,
      name: item.OPERATEDEPT_NAME || '',
      buyAmount: parseFloat(item.BUY_AMT) || 0,
      sellAmount: parseFloat(item.SELL_AMT) || 0,
      netAmount: parseFloat(item.NET_AMT) || 0,
    }));

    const sellSeats: TraderSeat[] = (detail.SELL_DETAILS || []).slice(0, 5).map((item: unknown, idx: number) => ({
      rank: idx + 1,
      name: item.OPERATEDEPT_NAME || '',
      buyAmount: parseFloat(item.BUY_AMT) || 0,
      sellAmount: parseFloat(item.SELL_AMT) || 0,
      netAmount: parseFloat(item.NET_AMT) || 0,
    }));

    const result: DragonTigerDetail = {
      code,
      name: detail.SECURITY_NAME_ABBR || '',
      date,
      reason: detail.EXPLAIN || '',
      buySeats,
      sellSeats,
    };

    cache.set(cacheKey, { data: result as any, expires: Date.now() + CACHE_TTL });
    log.info(`[DragonTiger] Detail fetched: ${code} on ${date}`);

    return result;
  } catch (err: unknown) {
    log.error('[DragonTiger] Detail fetch error:', err.message);
    return null;
  }
}

/**
 * 获取机构专用席位数据
 */
export async function getInstitutionalTrades(date?: string): Promise<DragonTigerEntry[]> {
  const result = await getDragonTigerList(date);
  if (!result.success) return [];

  // Filter entries where institutional traders appear
  return result.entries.filter(e => 
    e.netBuyAmount > 0 || e.reason.includes('机构')
  );
}

// ── Helper Functions ───────────────────────────────────────────────────────

function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildListUrl(date: string): string {
  const params = new URLSearchParams({
    sortColumns: 'BILL_NETD_AMT',
    sortTypes: '-1',
    pageSize: '50',
    pageNumber: '1',
    reportName: 'RPT_DAILYBILLBOARD_DETAILSNEW',
    columns: 'ALL',
    filter: `(TRADE_DATE='${date}')`,
    source: 'WEB',
    client: 'WEB',
  });

  return `https://datacenter-web.eastmoney.com/api/data/v1/get?${params.toString()}`;
}

function buildDetailUrl(code: string, date: string): string {
  const params = new URLSearchParams({
    reportName: 'RPT_DAILYBILLBOARD_DETAILS',
    columns: 'ALL',
    filter: `(SECURITY_CODE="${code}")(TRADE_DATE='${date}')`,
    source: 'WEB',
    client: 'WEB',
  });

  return `https://datacenter-web.eastmoney.com/api/data/v1/get?${params.toString()}`;
}


/**
 * Clear cache
 */
export function clearDragonTigerCache(): void {
  cache.clear();
  log.info('[DragonTiger] Cache cleared');
}
