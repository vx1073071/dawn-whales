// ── JVS-23: Unlock Calendar () ──────────────────────────────
// Fetches next 30 days of share unlock data from East Money
// IPC: em:get-unlock-calendar

import log from 'electron-log';

import https from 'https';
import http from 'http';
import { httpGet } from '../utils/http';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface UnlockEvent {
  code: string;
  name: string;
  unlockDate: string;
  unlockShares: number;       // ()
  unlockMarketValue: number;   // market cap ()
  unlockRatio: number;         // %
  currentPrice: number;
  unlockType: string;          // (//)
}

export interface UnlockCalendarResult {
  success: boolean;
  events: UnlockEvent[];
  total: number;
  dateRange: { from: string; to: string };
  error?: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL = 2 * 60 * 60 * 1000;  // 2 hours
let cache: { data: UnlockCalendarResult; expires: number } | null = null;

// ── API Functions ──────────────────────────────────────────────────────────

export async function getUnlockCalendar(days = 30): Promise<UnlockCalendarResult> {
  if (cache && cache.expires > Date.now()) {
    return cache.data;
  }

  const now = new Date();
  const fromDate = now.toISOString().split('T')[0];
  const toDate = new Date(now.getTime() + days * 86400000).toISOString().split('T')[0];

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_LIFT_STAGE&columns=ALL&filter=(LIFT_DATE>='${fromDate}')(LIFT_DATE<='${toDate}')&pageSize=100&sortColumns=LIFT_DATE&sortTypes=1&source=WEB&client=WEB`;

    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.result || !json.result.data) {
      return { success: false, events: [], total: 0, dateRange: { from: fromDate, to: toDate }, error: 'No data' };
    }

    const events: UnlockEvent[] = json.result.data.map((item: unknown) => ({
      code: item.SECURITY_CODE || '',
      name: item.SECURITY_NAME_ABBR || '',
      unlockDate: (item.LIFT_DATE || '').split(' ')[0],
      unlockShares: parseFloat(item.LIFT_NUM) || 0,
      unlockMarketValue: parseFloat(item.LIFT_MARKET_VALUE) || 0,
      unlockRatio: parseFloat(item.LIFT_RATIO) || 0,
      currentPrice: parseFloat(item.CLOSE_PRICE) || 0,
      unlockType: item.LIFT_TYPE || '',
    }));

    const result: UnlockCalendarResult = {
      success: true,
      events,
      total: events.length,
      dateRange: { from: fromDate, to: toDate },
    };

    cache = { data: result, expires: Date.now() + CACHE_TTL };
    log.info(`[UnlockCalendar] ${events.length} events from ${fromDate} to ${toDate}`);
    return result;
  } catch (err: unknown) {
    log.error('[UnlockCalendar] Error:', err.message);
    return { success: false, events: [], total: 0, dateRange: { from: fromDate, to: toDate }, error: err.message };
  }
}

export function clearUnlockCalendarCache(): void {
  cache = null;
}
