// ── JVS-23: Unlock Calendar (限售股解禁日历) ──────────────────────────────
// Fetches next 30 days of share unlock data from East Money
// IPC: em:get-unlock-calendar

import log from 'electron-log';
import https from 'https';
import http from 'http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UnlockEvent {
  code: string;
  name: string;
  unlockDate: string;
  unlockShares: number;       // 解禁股数 (万股)
  unlockMarketValue: number;   // 解禁市值 (万元)
  unlockRatio: number;         // 解禁比例 %
  currentPrice: number;
  unlockType: string;          // 解禁类型 (首发/增发/股权激励等)
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

    const events: UnlockEvent[] = json.result.data.map((item: any) => ({
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
  } catch (err: any) {
    log.error('[UnlockCalendar] Error:', err.message);
    return { success: false, events: [], total: 0, dateRange: { from: fromDate, to: toDate }, error: err.message };
  }
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://data.eastmoney.com/' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`HTTP ${res.statusCode}`));
      });
    });
    req.on('error', reject);
  });
}

export function clearUnlockCalendarCache(): void {
  cache = null;
}
