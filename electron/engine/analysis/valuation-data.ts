// ── Valuation Data (JVS-42) ────────────────────────────────────────────────
// PE/PB/PS/ROE/Dividend Yield historical data
// IPC: em:get-valuation

import log from 'electron-log';
import https from 'https';
import http from 'http';
import { httpGet } from '../utils/http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ValuationSnapshot {
  date: string;
  pe: number;              // 市盈率
  peTTM: number;           // 市盈率(TTM)
  pb: number;              // 市净率
  ps: number;              // 市销率
  psTTM: number;           // 市销率(TTM)
  pcf: number;             // 市现率
  pcfTTM: number;          // 市现率(TTM)
  dividendYield: number;   // 股息率 %
  dividendYieldTTM: number;
  ev: number;              // 企业价值 (EV)
  evEBITDA: number;        // EV/EBITDA
  roe: number;             // ROE %
  roa: number;             // ROA %
  marketCap: number;       // 总市值
  totalShares: number;     // 总股本
  floatShares: number;     // 流通股本
}

export interface ValuationResult {
  success: boolean;
  code: string;
  name: string;
  current: ValuationSnapshot | null;
  history: ValuationSnapshot[];
  percentiles: {
    pe: number;       // PE percentile (0-100)
    pb: number;       // PB percentile
    ps: number;       // PS percentile
    dividendYield: number;
  };
  timestamp: number;
  error?: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
const cache = new Map<string, { data: ValuationResult; expires: number }>();

// ── HTTP Helper ────────────────────────────────────────────────────────────


function safeNum(v: unknown): number {
  if (v === null || v === undefined || v === '' || v === '--') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ── Percentile Calculation ─────────────────────────────────────────────────

function calculatePercentile(values: number[], current: number): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = sorted.findIndex(v => v >= current);
  if (idx === -1) return 100;
  return Math.round((idx / sorted.length) * 100);
}

// ── Valuation Fetch ────────────────────────────────────────────────────────

async function fetchValuationHistory(code: string, days: number): Promise<ValuationSnapshot[]> {
  // Use East Money datacenter API for historical valuation
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_VALUEANALYSIS_DET&columns=ALL&filter=(SECUCODE="${code}")&pageSize=${days}&sortColumns=TRADE_DATE&sortTypes=-1&source=WEB&client=WEB`;

  try {
    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.result || !json.result.data) {
      // Fallback: try push2 API for current valuation
      return await fetchValuationFallback(code);
    }

    return json.result.data.map((item: unknown) => ({
      date: (item.TRADE_DATE || '').split(' ')[0],
      pe: safeNum(item.PE9),
      peTTM: safeNum(item.PE_TTM),
      pb: safeNum(item.PB_MRQ),
      ps: safeNum(item.PS),
      psTTM: safeNum(item.PS_TTM),
      pcf: safeNum(item.PCF),
      pcfTTM: safeNum(item.PCF_TTM),
      dividendYield: safeNum(item.DIVIDEND_YIELD),
      dividendYieldTTM: safeNum(item.DIVIDEND_YIELD_TTM),
      ev: safeNum(item.ENTERPRISE_VALUE),
      evEBITDA: safeNum(item.EV_EBITDA),
      roe: safeNum(item.ROEJQ),
      roa: safeNum(item.ROA),
      marketCap: safeNum(item.TOTAL_MARKET_CAP),
      totalShares: safeNum(item.TOTAL_SHARES),
      floatShares: safeNum(item.FREE_SHARES),
    }));
  } catch (err: unknown) {
    log.warn(`[ValuationData] Fetch failed for ${code}: ${err.message}`);
    return fetchValuationFallback(code);
  }
}

async function fetchValuationFallback(code: string): Promise<ValuationSnapshot[]> {
  // Fallback: use push2 API for real-time valuation snapshot
  const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`;
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f2,f9,f23,f115,f116,f117,f162,f163,f167,f183,f184,f185,f186,f187,f188`;

  try {
    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.data) return [];

    const today = new Date().toISOString().split('T')[0];
    return [{
      date: today,
      pe: safeNum(json.data.f9),
      peTTM: safeNum(json.data.f9),
      pb: safeNum(json.data.f23),
      ps: safeNum(json.data.f115),
      psTTM: safeNum(json.data.f115),
      pcf: safeNum(json.data.f116),
      pcfTTM: safeNum(json.data.f116),
      dividendYield: safeNum(json.data.f162),
      dividendYieldTTM: safeNum(json.data.f162),
      ev: 0,
      evEBITDA: 0,
      roe: safeNum(json.data.f183),
      roa: safeNum(json.data.f184),
      marketCap: safeNum(json.data.f20),
      totalShares: safeNum(json.data.f117),
      floatShares: safeNum(json.data.f167),
    }];
  } catch (err: unknown) {
    log.warn(`[ValuationData] Fallback fetch failed for ${code}: ${err.message}`);
    return [];
  }
}

// ── Main Export Function ──────────────────────────────────────────────────

export async function getValuationData(
  code: string,
  historyDays: number = 252
): Promise<ValuationResult> {
  const cacheKey = `valuation-${code}-${historyDays}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  log.info(`[ValuationData] Fetching valuation for ${code}, ${historyDays} days`);

  const history = await fetchValuationHistory(code, historyDays);
  const current = history.length > 0 ? history[0] : null;

  // Calculate percentiles
  const peValues = history.map(h => h.peTTM).filter(v => v > 0);
  const pbValues = history.map(h => h.pb).filter(v => v > 0);
  const psValues = history.map(h => h.psTTM).filter(v => v > 0);
  const dyValues = history.map(h => h.dividendYield).filter(v => v > 0);

  const percentiles = {
    pe: current ? calculatePercentile(peValues, current.peTTM) : 50,
    pb: current ? calculatePercentile(pbValues, current.pb) : 50,
    ps: current ? calculatePercentile(psValues, current.psTTM) : 50,
    dividendYield: current ? calculatePercentile(dyValues, current.dividendYield) : 50,
  };

  const result: ValuationResult = {
    success: history.length > 0,
    code,
    name: '',
    current,
    history,
    percentiles,
    timestamp: Date.now(),
  };

  cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
  log.info(`[ValuationData] Done: ${history.length} snapshots, PE pct=${percentiles.pe}, PB pct=${percentiles.pb}`);

  return result;
}

export function clearValuationDataCache(): void {
  cache.clear();
}
