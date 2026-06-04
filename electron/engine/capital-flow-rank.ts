// ── JVS-11: Capital Flow Ranking (资金流排行) ──────────────────────────────
// Tracks main force (主力) capital inflows/outflows for stocks and sectors
// Provides ranking data for sector rotation and stock selection

import log from 'electron-log';
import https from 'https';
import http from 'http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StockCapitalFlow {
  code: string;            // 股票代码
  name: string;            // 股票名称
  close: number;           // 收盘价
  changePct: number;       // 涨跌幅 %
  mainNetInflow: number;   // 主力净流入 (万元)
  superLargeIn: number;    // 超大单净流入
  largeIn: number;         // 大单净流入
  mediumIn: number;        // 中单净流入
  smallIn: number;         // 小单净流入
  mainNetRatio: number;    // 主力净流入占比 %
  turnover: number;        // 成交额 (万元)
}

export interface SectorCapitalFlow {
  code: string;            // 板块代码
  name: string;            // 板块名称
  changePct: number;       // 涨跌幅 %
  mainNetInflow: number;   // 主力净流入 (万元)
  superLargeIn: number;    // 超大单净流入
  largeIn: number;         // 大单净流入
  mediumIn: number;        // 中单净流入
  smallIn: number;         // 小单净流入
  leadingStock: string;    // 领涨股名称
  leadingChangePct: number; // 领涨股涨幅 %
}

export interface CapitalFlowRankResult {
  success: boolean;
  items: (StockCapitalFlow | SectorCapitalFlow)[];
  total: number;
  type: 'stock' | 'sector' | 'concept';
  sortBy: string;
  error?: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: any;
  expires: number;
}

const CACHE_TTL = 5 * 60 * 1000;  // 5 minutes (capital flow changes frequently)
const cache = new Map<string, CacheEntry>();

// ── API Functions ──────────────────────────────────────────────────────────

/**
 * 个股资金流排行（今日）
 */
export async function getStockCapitalFlowRank(
  sortBy: 'mainNetInflow' | 'changePct' | 'turnover' = 'mainNetInflow',
  order: 'desc' | 'asc' = 'desc',
  limit = 50
): Promise<CapitalFlowRankResult> {
  const cacheKey = `stock-flow-${sortBy}-${order}-${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const sortField = mapStockSortField(sortBy);
    const sortType = order === 'desc' ? '-1' : '1';

    const url = `https://push2.eastmoney.com/api/qt/clist/get?fid=${sortField}&po=${sortType}&pz=${limit}&pn=1&np=1&fltt=2&invt=2&fields=f2,f3,f12,f14,f62,f66,f69,f72,f75,f78,f164,f174,f225,f184,f62&fs=m:0+t:6,m:0+t:13,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.data || !data.data.diff) {
      return { success: false, items: [], total: 0, type: 'stock', sortBy, error: 'No data' };
    }

    const items: StockCapitalFlow[] = data.data.diff.map((item: any) => ({
      code: item.f12 || '',
      name: item.f14 || '',
      close: item.f2 ?? 0,
      changePct: item.f3 ?? 0,
      mainNetInflow: item.f62 ?? 0,
      superLargeIn: item.f66 ?? 0,
      largeIn: item.f72 ?? 0,
      mediumIn: item.f78 ?? 0,
      smallIn: item.f84 ?? 0,
      mainNetRatio: item.f184 ?? 0,
      turnover: item.f66 ?? 0,
    }));

    const result: CapitalFlowRankResult = {
      success: true,
      items,
      total: data.data.total || items.length,
      type: 'stock',
      sortBy,
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    log.info(`[CapitalFlow] Stock rank: ${items.length} items, sorted by ${sortBy}`);
    return result;
  } catch (err: any) {
    log.error('[CapitalFlow] Stock rank error:', err.message);
    return { success: false, items: [], total: 0, type: 'stock', sortBy, error: err.message };
  }
}

/**
 * 行业板块资金流排行
 */
export async function getSectorCapitalFlowRank(
  sortBy: 'mainNetInflow' | 'changePct' = 'mainNetInflow',
  order: 'desc' | 'asc' = 'desc',
  limit = 30
): Promise<CapitalFlowRankResult> {
  const cacheKey = `sector-flow-${sortBy}-${order}-${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const sortField = mapSectorSortField(sortBy);
    const sortType = order === 'desc' ? '-1' : '1';

    const url = `https://push2.eastmoney.com/api/qt/clist/get?fid=${sortField}&po=${sortType}&pz=${limit}&pn=1&np=1&fltt=2&invt=2&fields=f2,f3,f12,f14,f62,f66,f69,f72,f75,f78,f128,f136,f109,f20&fs=m:90+t:2`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.data || !data.data.diff) {
      return { success: false, items: [], total: 0, type: 'sector', sortBy, error: 'No data' };
    }

    const items: SectorCapitalFlow[] = data.data.diff.map((item: any) => ({
      code: item.f12 || '',
      name: item.f14 || '',
      changePct: item.f3 ?? 0,
      mainNetInflow: item.f62 ?? 0,
      superLargeIn: item.f66 ?? 0,
      largeIn: item.f72 ?? 0,
      mediumIn: item.f78 ?? 0,
      smallIn: item.f84 ?? 0,
      leadingStock: item.f128 || '',
      leadingChangePct: item.f136 ?? 0,
    }));

    const result: CapitalFlowRankResult = {
      success: true,
      items,
      total: data.data.total || items.length,
      type: 'sector',
      sortBy,
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    log.info(`[CapitalFlow] Sector rank: ${items.length} items, sorted by ${sortBy}`);
    return result;
  } catch (err: any) {
    log.error('[CapitalFlow] Sector rank error:', err.message);
    return { success: false, items: [], total: 0, type: 'sector', sortBy, error: err.message };
  }
}

/**
 * 概念板块资金流排行
 */
export async function getConceptCapitalFlowRank(
  sortBy: 'mainNetInflow' | 'changePct' = 'mainNetInflow',
  order: 'desc' | 'asc' = 'desc',
  limit = 30
): Promise<CapitalFlowRankResult> {
  const cacheKey = `concept-flow-${sortBy}-${order}-${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const sortField = mapSectorSortField(sortBy);
    const sortType = order === 'desc' ? '-1' : '1';

    const url = `https://push2.eastmoney.com/api/qt/clist/get?fid=${sortField}&po=${sortType}&pz=${limit}&pn=1&np=1&fltt=2&invt=2&fields=f2,f3,f12,f14,f62,f66,f69,f72,f75,f78,f128,f136,f109,f20&fs=m:90+t:3`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.data || !data.data.diff) {
      return { success: false, items: [], total: 0, type: 'concept', sortBy, error: 'No data' };
    }

    const items: SectorCapitalFlow[] = data.data.diff.map((item: any) => ({
      code: item.f12 || '',
      name: item.f14 || '',
      changePct: item.f3 ?? 0,
      mainNetInflow: item.f62 ?? 0,
      superLargeIn: item.f66 ?? 0,
      largeIn: item.f72 ?? 0,
      mediumIn: item.f78 ?? 0,
      smallIn: item.f84 ?? 0,
      leadingStock: item.f128 || '',
      leadingChangePct: item.f136 ?? 0,
    }));

    const result: CapitalFlowRankResult = {
      success: true,
      items,
      total: data.data.total || items.length,
      type: 'concept',
      sortBy,
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    log.info(`[CapitalFlow] Concept rank: ${items.length} items, sorted by ${sortBy}`);
    return result;
  } catch (err: any) {
    log.error('[CapitalFlow] Concept rank error:', err.message);
    return { success: false, items: [], total: 0, type: 'concept', sortBy, error: err.message };
  }
}

/**
 * 获取主力净流入 Top N
 */
export async function getMainForceTopN(n = 10): Promise<StockCapitalFlow[]> {
  const result = await getStockCapitalFlowRank('mainNetInflow', 'desc', n);
  return result.success ? result.items as StockCapitalFlow[] : [];
}

/**
 * 获取主力净流出 Top N
 */
export async function getMainForceBottomN(n = 10): Promise<StockCapitalFlow[]> {
  const result = await getStockCapitalFlowRank('mainNetInflow', 'asc', n);
  return result.success ? result.items as StockCapitalFlow[] : [];
}

/**
 * 获取行业资金流入 Top N（供 Sector Rotation 使用）
 */
export async function getSectorInflowTopN(n = 5): Promise<SectorCapitalFlow[]> {
  const result = await getSectorCapitalFlowRank('mainNetInflow', 'desc', n);
  return result.success ? result.items as SectorCapitalFlow[] : [];
}

// ── Helper Functions ───────────────────────────────────────────────────────

function mapStockSortField(sortBy: string): string {
  switch (sortBy) {
    case 'mainNetInflow': return 'f62';
    case 'changePct': return 'f3';
    case 'turnover': return 'f66';
    default: return 'f62';
  }
}

function mapSectorSortField(sortBy: string): string {
  switch (sortBy) {
    case 'mainNetInflow': return 'f62';
    case 'changePct': return 'f3';
    default: return 'f62';
  }
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://data.eastmoney.com/',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
  });
}

export function clearCapitalFlowCache(): void {
  cache.clear();
  log.info('[CapitalFlow] Cache cleared');
}
