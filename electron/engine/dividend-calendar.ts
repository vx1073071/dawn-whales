// ── JVS-24: Dividend Calendar (分红除权日历) ──────────────────────────────
// Fetches upcoming dividend ex-dates and record dates from East Money
// IPC: em:get-dividend-calendar

import log from 'electron-log';
import https from 'https';
import http from 'http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DividendEvent {
  code: string;
  name: string;
  planYear: string;           // 分配年度
  bonusPerShare: number;      // 每股送股
  dividendPerShare: number;   // 每股分红 (元)
  convertPerShare: number;    // 每股转增
  exDate: string;             // 除权除息日
  recordDate: string;         // 股权登记日
  payDate: string;            // 红利发放日
  currentPrice: number;
  dividendYield: number;      // 股息率 %
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

    const events: DividendEvent[] = json.result.data.map((item: any) => ({
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
  } catch (err: any) {
    log.error('[DividendCalendar] Error:', err.message);
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

export function clearDividendCalendarCache(): void { cache = null; }
