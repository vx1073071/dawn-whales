// ── JVS-25: Earnings Calendar () ──────────────────────────────
// Fetches upcoming earnings disclosure dates + expectations from East Money
// IPC: em:get-earnings-calendar

import log from 'electron-log';

import https from 'https';
import http from 'http';
import { httpGet } from '../utils/http';
import i18n from '../../../src/i18n';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface EarningsEvent {
  code: string;
  name: string;
  reportDate: string;
  disclosureDate: string;
  predictNetProfit: number;    // net profit ()
  predictProfitChange: number; // net profit %
  predictType: string;         // (///////)
  actualNetProfit: number;     // net profit (, if available)
  eps: number;                 // EPS
  pe: number;                  // P/E ratio
  currentPrice: number;
}

export interface EarningsCalendarResult {
  success: boolean;
  events: EarningsEvent[];
  total: number;
  dateRange: { from: string; to: string };
  summary: {
    predictIncrease: number;
    predictDecrease: number;
    predictTurnaround: number;
    predictFirstLoss: number;
    predictContinuedLoss: number;
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

    const events: EarningsEvent[] = json.result.data.map((item: unknown) => ({
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
      predictIncrease: events.filter(e => [i18n.t('earningsCalendar.k1'), i18n.t('earningsCalendar.k2'), i18n.t('earningsCalendar.k3')].includes(e.predictType)).length,
      predictDecrease: events.filter(e => [i18n.t('earningsCalendar.k4'), i18n.t('earningsCalendar.k5')].includes(e.predictType)).length,
      predictTurnaround: events.filter(e => e.predictType === i18n.t('earningsCalendar.k6')).length,
      predictFirstLoss: events.filter(e => e.predictType === i18n.t('earningsCalendar.k7')).length,
      predictContinuedLoss: events.filter(e => e.predictType === i18n.t('earningsCalendar.k8')).length,
    };

    const result: EarningsCalendarResult = {
      success: true, events, total: events.length,
      dateRange: { from: fromDate, to: toDate },
      summary,
    };

    cache = { data: result, expires: Date.now() + CACHE_TTL };
    log.info(`[EarningsCalendar] ${events.length} events: +${summary.predictIncrease} -${summary.predictDecrease}`);
    return result;
  } catch (err: unknown) {
    log.error('[EarningsCalendar] Error:', err.message);
    return {
      success: false, events: [], total: 0,
      dateRange: { from: fromDate, to: toDate },
      summary: { predictIncrease: 0, predictDecrease: 0, predictTurnaround: 0, predictFirstLoss: 0, predictContinuedLoss: 0 },
      error: err.message,
    };
  }
}

export function clearEarningsCalendarCache(): void { cache = null; }
