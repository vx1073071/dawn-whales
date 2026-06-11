// ── JVS-11: Capital Flow Ranking (capital flow) ──────────────────────────────
// Tracks main force (major player) capital inflows/outflows for stocks and sectors
// Provides ranking data for sector rotation and stock selection

import log from 'electron-log';

import https from 'https';
import http from 'http';
import { httpGet } from '../utils/http';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface StockCapitalFlow {
  code: string;
  name: string;
  close: number;
  changePct: number;       // price change % %
  mainNetInflow: number;   // major player ()
  superLargeIn: number;
  largeIn: number;
  mediumIn: number;
  smallIn: number;
  mainNetRatio: number;    // major player %
  turnover: number;        // turnover ()
}

export interface SectorCapitalFlow {
  code: string;            // sector
  name: string;            // sector
  changePct: number;       // price change % %
  mainNetInflow: number;   // major player ()
  superLargeIn: number;
  largeIn: number;
  mediumIn: number;
  smallIn: number;
  leadingStock: string;
  leadingChangePct: number; // %
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
  data: unknown;
  expires: number;
}

const CACHE_TTL = 5 * 60 * 1000;  // 5 minutes (capital flow changes frequently)
const cache = new Map<string, CacheEntry>();

// ── API Functions ──────────────────────────────────────────────────────────

/**
 * capital flow 
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

    const items: StockCapitalFlow[] = data.data.diff.map((item: unknown) => ({
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
  } catch (err: unknown) {
    log.error('[CapitalFlow] Stock rank error:', err.message);
    return { success: false, items: [], total: 0, type: 'stock', sortBy, error: err.message };
  }
}

/**
 * industrysectorcapital flow
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

    const items: SectorCapitalFlow[] = data.data.diff.map((item: unknown) => ({
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
  } catch (err: unknown) {
    log.error('[CapitalFlow] Sector rank error:', err.message);
    return { success: false, items: [], total: 0, type: 'sector', sortBy, error: err.message };
  }
}

/**
 * conceptsectorcapital flow
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

    const items: SectorCapitalFlow[] = data.data.diff.map((item: unknown) => ({
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
  } catch (err: unknown) {
    log.error('[CapitalFlow] Concept rank error:', err.message);
    return { success: false, items: [], total: 0, type: 'concept', sortBy, error: err.message };
  }
}

/**
 * major player Top N
 */
export async function getMainForceTopN(n = 10): Promise<StockCapitalFlow[]> {
  const result = await getStockCapitalFlowRank('mainNetInflow', 'desc', n);
  return result.success ? result.items as StockCapitalFlow[] : [];
}

/**
 * major player Top N
 */
export async function getMainForceBottomN(n = 10): Promise<StockCapitalFlow[]> {
  const result = await getStockCapitalFlowRank('mainNetInflow', 'asc', n);
  return result.success ? result.items as StockCapitalFlow[] : [];
}

/**
 * industrycapital flow Top N（ Sector Rotation ）
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

export function clearCapitalFlowCache(): void {
  cache.clear();
  log.info('[CapitalFlow] Cache cleared');
}
