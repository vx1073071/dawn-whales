// ── JVS-25: Earnings Calendar (业绩预告聚合) ──────────────────────────────
// Fetches upcoming earnings disclosure dates + expectations from East Money
// IPC: em:get-earnings-calendar

import log from 'electron-log';
import https from 'https';
import http from 'http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface EarningsEvent {
  code: string;
  name: string;
  reportDate: string;          // 报告期
  disclosureDate: string;      // 披露日期
  predictNetProfit: number;    // 预计净利润 (万元)
  predictProfitChange: number; // 预计净利润变动幅度 %
  predictType: string;         // 预告类型 (预增/预减/略增/略减/扭亏/续亏/首亏/不确定)
  actualNetProfit: number;     // 实际净利润 (万元, if available)
  eps: number;                 // 每股收益
  pe: number;                  // 市盈率
  currentPrice: number;
}

export interface EarningsCalendarResult {
  success: boolean;
  events: EarningsEvent[];
  total: number;
  dateRange: { from: string; to: string };
  summary: {
    predictIncrease: number;   // 预增家数
    predictDecrease: number;   // 预减家数
    predictTurnaround: number; // 扭亏家数
    predictFirstLoss: number;  // 首亏家数
    predictContinuedLoss: number; // 续亏家数
  };
  error?: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL = 2 * 60 * 60 * 1000;  // 2 hours
let cache: { data: EarningsCalendarResult; expires: number } | null = null;

// ── API Functions ──────────────────────────────────────────────────────────

export async function getEarningsCalendar(days = 30): Promise<EarningsCalendarResult> {
  if (cache && cache.expires > Date.now()) {
    return cache.data;
  }

  const now = new Date();
  const fromDate = now.toISOString().split('T')[0];
  const toDate = new Date(now.getTime() + days * 86400000).toISOString().split('T')[0];

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_PUBLIC_OP_NEWPREDICT&columns=ALL&filter=(PUBLISH_DATE>='${fromDate}')(PUBLISH_DATE<='${toDate}')&pageSize=100&sortColumns=PUBLISH_DATE&sortTypes=1&source=WEB&client=WEB`;

    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.result || !json.result.data) {
      return {
        success: false, events: [], total: 0,
        dateRange: { from: fromDate, to: toDate },
        summary: { predictIncrease: 0, predictDecrease: 0, predictTurnaround: 0, predictFirstLoss: 0, predictContinuedLoss: 0 },
        error: 'No data',
      };
    }

    const events: EarningsEvent[] = json.result.data.map((item: any) => ({
      code: item.SECURITY_CODE || '',
      name: item.SECURITY_NAME_ABBR || '',
      reportDate: (item.REPORT_DATE || '').split(' ')[0],
      disclosureDate: (item.PUBLISH_DATE || '').split(' ')[0],
      predictNetProfit: parseFloat(item.PREDICT_FINANCE) || 0,
      predictProfitChange: parseFloat(item.PREDICT_FINANCE_SAME) || 0,
      predictType: item.PREDICT_TYPE || '',
      actualNetProfit: parseFloat(item.ACTUAL_FINANCE) || 0,
      eps: parseFloat(item.BASIC_EPS) || 0,
      pe: parseFloat(item.PE_RATIO) || 0,
      currentPrice: parseFloat(item.CLOSE_PRICE) || 0,
    }));

    // Summary
    const summary = {
      predictIncrease: events.filter(e => ['预增', '略增', '续盈'].includes(e.predictType)).length,
      predictDecrease: events.filter(e => ['预减', '略减'].includes(e.predictType)).length,
      predictTurnaround: events.filter(e => e.predictType === '扭亏').length,
      predictFirstLoss: events.filter(e => e.predictType === '首亏').length,
      predictContinuedLoss: events.filter(e => e.predictType === '续亏').length,
    };

    const result: EarningsCalendarResult = {
      success: true, events, total: events.length,
      dateRange: { from: fromDate, to: toDate },
      summary,
    };

    cache = { data: result, expires: Date.now() + CACHE_TTL };
    log.info(`[EarningsCalendar] ${events.length} events: +${summary.predictIncrease} -${summary.predictDecrease}`);
    return result;
  } catch (err: any) {
    log.error('[EarningsCalendar] Error:', err.message);
    return {
      success: false, events: [], total: 0,
      dateRange: { from: fromDate, to: toDate },
      summary: { predictIncrease: 0, predictDecrease: 0, predictTurnaround: 0, predictFirstLoss: 0, predictContinuedLoss: 0 },
      error: err.message,
    };
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

export function clearEarningsCalendarCache(): void { cache = null; }
