// ── JVS-24: Dividend Calendar () ──────────────────────────────
// Fetches upcoming dividend ex-dates and record dates from East Money
// IPC: em:get-dividend-calendar

import log from 'electron-log';

import https from 'https';
import http from 'http';
import { httpGet } from '../utils/http';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface DividendEvent {
  code: string;
  name: string;
  planYear: string;
  bonusPerShare: number;      // per share
  dividendPerShare: number;   // per share ()
  convertPerShare: number;    // per share
  exDate: string;
  recordDate: string;
  payDate: string;
  currentPrice: number;
  dividendYield: number;      // dividend yield %
}

export interface DividendCalendarResult {
  success: boolean;
  events: DividendEvent[];
  total: number;
  dateRange: { from: string; to: string };
  error?: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL = 2 * 60 * 60 * 1000;  // 2 hours
let cache: { data: DividendCalendarResult; expires: number } | null = null;

// ── API Functions ──────────────────────────────────────────────────────────

export async function getDividendCalendar(days = 30): Promise<DividendCalendarResult> {
  if (cache && cache.expires > Date.now()) {
    return cache.data;
  }

  const now = new Date();
  const fromDate = now.toISOString().split('T')[0];
  const toDate = new Date(now.getTime() + days * 86400000).toISOString().split('T')[0];

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_SHAREBONUS_DET&columns=ALL&filter=(EX_DATE>='${fromDate}')(EX_DATE<='${toDate}')&pageSize=100&sortColumns=EX_DATE&sortTypes=1&source=WEB&client=WEB`;

    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.result || !json.result.data) {
      return { success: false, events: [], total: 0, dateRange: { from: fromDate, to: toDate }, error: 'No data' };
    }

    const events: DividendEvent[] = json.result.data.map((item: unknown) => ({
      code: item.SECURITY_CODE || '',
      name: item.SECURITY_NAME_ABBR || '',
      planYear: item.ASSIGN_YEAR || '',
      bonusPerShare: parseFloat(item.BONUS_SHARES_RATIO) || 0,
      dividendPerShare: parseFloat(item.PRE_DIV_RATIO) || 0,
      convertPerShare: parseFloat(item.CONVERT_RATIO) || 0,
      exDate: (item.EX_DATE || '').split(' ')[0],
      recordDate: (item.RECORD_DATE || '').split(' ')[0],
      payDate: (item.PAY_DATE || '').split(' ')[0],
      currentPrice: parseFloat(item.CLOSE_PRICE) || 0,
      dividendYield: item.CLOSE_PRICE ? ((parseFloat(item.PRE_DIV_RATIO) || 0) / parseFloat(item.CLOSE_PRICE) * 100) : 0,
    }));

    const result: DividendCalendarResult =
      { success: true, events, total: events.length, dateRange: { from: fromDate, to: toDate } };

    cache = { data: result, expires: Date.now() + CACHE_TTL };
    log.info(`[DividendCalendar] ${events.length} events from ${fromDate} to ${toDate}`);
    return result;
  } catch (err: unknown) {
    log.error('[DividendCalendar] Error:', err.message);
    return { success: false, events: [], total: 0, dateRange: { from: fromDate, to: toDate }, error: err.message };
  }
}

export function clearDividendCalendarCache(): void { cache = null; }
