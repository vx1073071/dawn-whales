// ── Financial Reports (JVS-41) ──────────────────────────────────────────────
// Revenue, profit, cash flow, balance sheet quarterly data
// IPC: em:get-financials

import log from 'electron-log';

import https from 'https';
import http from 'http';
import { httpGet } from '../utils/http';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface IncomeStatement {
  reportDate: string;
  revenue: number;
  revenueGrowth: number;    // revenue %
  grossProfit: number;
  grossMargin: number;      // gross margin %
  operatingProfit: number;
  operatingMargin: number;  // %
  netProfit: number;        // net profit
  netMargin: number;        // net profit %
  netProfitGrowth: number;  // net profit %
  eps: number;              // EPS
  dilutedEps: number;       // EPS
}

export interface BalanceSheet {
  reportDate: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;      // shareholder
  debtToEquity: number;     // %
  currentRatio: number;
  quickRatio: number;
  cash: number;
  accountsReceivable: number;
  inventory: number;
  goodwill: number;
}

export interface CashFlowStatement {
  reportDate: string;
  operatingCashFlow: number;   // activity
  investingCashFlow: number;   // activity
  financingCashFlow: number;   // activity
  netCashFlow: number;
  freeCashFlow: number;
  capex: number;
  dividendsPaid: number;
}

export interface FinancialReportsResult {
  success: boolean;
  code: string;
  name: string;
  income: IncomeStatement[];
  balance: BalanceSheet[];
  cashFlow: CashFlowStatement[];
  timestamp: number;
  error?: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const cache = new Map<string, { data: FinancialReportsResult; expires: number }>();

// ── HTTP Helper ────────────────────────────────────────────────────────────

function safeNum(v: unknown): number {
  if (v === null || v === undefined || v === '' || v === '--') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ── Income Statement ───────────────────────────────────────────────────────

async function fetchIncomeStatement(code: string, quarters: number): Promise<IncomeStatement[]> {
  // East Money income statement API
  const secid = code.startsWith('6') ? `1.${code}` : `0.${code}`;
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_INCOME&columns=ALL&filter=(SECUCODE="${code}")&pageSize=${quarters}&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB`;

  try {
    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.result || !json.result.data) {
      // Fallback: use datacenter financial report API
      const fallbackUrl = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_LICO_FN_CPD&columns=ALL&filter=(SECUCODE="${code}")&pageSize=${quarters}&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB`;
      const fallbackRaw = await httpGet(fallbackUrl);
      const fallbackJson = JSON.parse(fallbackRaw);

      if (!fallbackJson.result || !fallbackJson.result.data) return [];

      return fallbackJson.result.data.map((item: unknown) => ({
        reportDate: (item.REPORT_DATE || '').split(' ')[0],
        revenue: safeNum(item.TOTAL_OPERATE_INCOME),
        revenueGrowth: safeNum(item.TOTAL_OPERATE_INCOME_SAME),
        grossProfit: safeNum(item.TOTAL_PROFIT),
        grossMargin: 0,
        operatingProfit: safeNum(item.OPERATE_PROFIT),
        operatingMargin: safeNum(item.TOTAL_OPERATE_INCOME) > 0
          ? safeNum(item.OPERATE_PROFIT) / safeNum(item.TOTAL_OPERATE_INCOME) * 100 : 0,
        netProfit: safeNum(item.NET_PROFIT),
        netMargin: safeNum(item.TOTAL_OPERATE_INCOME) > 0
          ? safeNum(item.NET_PROFIT) / safeNum(item.TOTAL_OPERATE_INCOME) * 100 : 0,
        netProfitGrowth: safeNum(item.NET_PROFIT_SAME),
        eps: safeNum(item.BASIC_EPS),
        dilutedEps: safeNum(item.DILUTED_EPS),
      }));
    }

    return json.result.data.map((item: unknown) => ({
      reportDate: (item.REPORT_DATE || '').split(' ')[0],
      revenue: safeNum(item.TOTAL_OPERATE_INCOME),
      revenueGrowth: safeNum(item.TOTAL_OPERATE_INCOME_SAME),
      grossProfit: safeNum(item.TOTAL_PROFIT),
      grossMargin: 0,
      operatingProfit: safeNum(item.OPERATE_PROFIT),
      operatingMargin: 0,
      netProfit: safeNum(item.NET_PROFIT),
      netMargin: 0,
      netProfitGrowth: safeNum(item.NET_PROFIT_SAME),
      eps: safeNum(item.BASIC_EPS),
      dilutedEps: safeNum(item.DILUTED_EPS),
    }));
  } catch (err: unknown) {
    log.warn(`[FinancialReports] Income fetch failed for ${code}: ${err.message}`);
    return [];
  }
}

// ── Balance Sheet ──────────────────────────────────────────────────────────

async function fetchBalanceSheet(code: string, quarters: number): Promise<BalanceSheet[]> {
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_BALANCE&columns=ALL&filter=(SECUCODE="${code}")&pageSize=${quarters}&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB`;

  try {
    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.result || !json.result.data) return [];

    return json.result.data.map((item: unknown) => ({
      reportDate: (item.REPORT_DATE || '').split(' ')[0],
      totalAssets: safeNum(item.TOTAL_ASSETS),
      totalLiabilities: safeNum(item.TOTAL_LIABILITIES),
      totalEquity: safeNum(item.TOTAL_EQUITY),
      debtToEquity: safeNum(item.TOTAL_ASSETS) > 0
        ? safeNum(item.TOTAL_LIABILITIES) / safeNum(item.TOTAL_ASSETS) * 100 : 0,
      currentRatio: safeNum(item.CURRENT_RATIO),
      quickRatio: safeNum(item.QUICK_RATIO),
      cash: safeNum(item.CASH),
      accountsReceivable: safeNum(item.ACCOUNTS_RECEIVABLE),
      inventory: safeNum(item.INVENTORY),
      goodwill: safeNum(item.GOODWILL),
    }));
  } catch (err: unknown) {
    log.warn(`[FinancialReports] Balance sheet fetch failed for ${code}: ${err.message}`);
    return [];
  }
}

// ── Cash Flow Statement ────────────────────────────────────────────────────

async function fetchCashFlowStatement(code: string, quarters: number): Promise<CashFlowStatement[]> {
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_FN_CASHFLOW&columns=ALL&filter=(SECUCODE="${code}")&pageSize=${quarters}&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB`;

  try {
    const raw = await httpGet(url);
    const json = JSON.parse(raw);

    if (!json.result || !json.result.data) return [];

    return json.result.data.map((item: unknown) => ({
      reportDate: (item.REPORT_DATE || '').split(' ')[0],
      operatingCashFlow: safeNum(item.OPERATE_CASH_FLOW),
      investingCashFlow: safeNum(item.INVEST_CASH_FLOW),
      financingCashFlow: safeNum(item.FINANCE_CASH_FLOW),
      netCashFlow: safeNum(item.NET_CASH_FLOW),
      freeCashFlow: safeNum(item.OPERATE_CASH_FLOW) - Math.abs(safeNum(item.FIXED_ASSET_INVEST)),
      capex: safeNum(item.FIXED_ASSET_INVEST),
      dividendsPaid: safeNum(item.DIVIDEND_PAY),
    }));
  } catch (err: unknown) {
    log.warn(`[FinancialReports] Cash flow fetch failed for ${code}: ${err.message}`);
    return [];
  }
}

// ── Main Export Function ──────────────────────────────────────────────────

export async function getFinancialReports(
  code: string,
  quarters: number = 8
): Promise<FinancialReportsResult> {
  const cacheKey = `financials-${code}-${quarters}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  log.info(`[FinancialReports] Fetching financials for ${code}, ${quarters} quarters`);

  const [income, balance, cashFlow] = await Promise.all([
    fetchIncomeStatement(code, quarters),
    fetchBalanceSheet(code, quarters),
    fetchCashFlowStatement(code, quarters),
  ]);

  const result: FinancialReportsResult = {
    success: income.length > 0 || balance.length > 0 || cashFlow.length > 0,
    code,
    name: '',
    income,
    balance,
    cashFlow,
    timestamp: Date.now(),
  };

  cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
  log.info(`[FinancialReports] Done: income=${income.length}, balance=${balance.length}, cashflow=${cashFlow.length}`);

  return result;
}

export function clearFinancialReportsCache(): void {
  cache.clear();
}
