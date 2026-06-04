// ── JVS-17: Consumer Data Service (消费者数据服务) ──────────────────────
// Fetches detailed consumer economic indicators from East Money datacenter
// - CPI sub-indexes (food/non-food/service breakdown)
// - Retail sales by category
// - Consumer confidence index

import log from 'electron-log';
import https from 'https';
import http from 'http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CPISubIndex {
  date: string;
  total: number;
  food: number;
  nonFood: number;
  service: number;
  goods: number;
  clothing: number;
  housing: number;
  transport: number;
  education: number;
  medical: number;
}

export interface RetailSales {
  date: string;
  total: number;          // 社会消费品零售总额 (亿元)
  yoyGrowth: number;      // 同比增速 %
  momGrowth: number;      // 环比增速 %
  urbanRetail: number;    // 城镇零售
  ruralRetail: number;    // 乡村零售
  onlineRetail: number;   // 网上零售
  catering: number;       // 餐饮收入
  goodsRetail: number;    // 商品零售
}

export interface ConsumerConfidence {
  date: string;
  index: number;          // 消费者信心指数
  expectation: number;    // 预期指数
  satisfaction: number;   // 满意指数
  income: number;         // 收入信心
  employment: number;     // 就业信心
}

export interface ConsumerDataReport {
  success: boolean;
  cpiSubIndexes: CPISubIndex[];
  retailSales: RetailSales[];
  consumerConfidence: ConsumerConfidence[];
  timestamp: number;
  error?: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: any;
  expires: number;
}

const CACHE_TTL = 60 * 60 * 1000;  // 1 hour
const cache = new Map<string, CacheEntry>();

// ── API Functions ──────────────────────────────────────────────────────────

/**
 * 获取 CPI 细项数据
 */
export async function getCPISubIndexes(months = 12): Promise<CPISubIndex[]> {
  const cacheKey = `cpi-sub-${months}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_ECONOMY_CPI&columns=REPORT_DATE,BASE,FOOD,NO_FOOD,SERVICE,GOODS,CLOTHING,HOUSING,TRANSPORT,EDUCATION,MEDICAL&pageSize=${months}&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      log.warn('[ConsumerData] No CPI sub-index data');
      return [];
    }

    const indexes: CPISubIndex[] = data.result.data.map((item: any) => ({
      date: item.REPORT_DATE?.split(' ')[0] || '',
      total: parseFloat(item.BASE) || 0,
      food: parseFloat(item.FOOD) || 0,
      nonFood: parseFloat(item.NO_FOOD) || 0,
      service: parseFloat(item.SERVICE) || 0,
      goods: parseFloat(item.GOODS) || 0,
      clothing: parseFloat(item.CLOTHING) || 0,
      housing: parseFloat(item.HOUSING) || 0,
      transport: parseFloat(item.TRANSPORT) || 0,
      education: parseFloat(item.EDUCATION) || 0,
      medical: parseFloat(item.MEDICAL) || 0,
    })).reverse();

    cache.set(cacheKey, { data: indexes, expires: Date.now() + CACHE_TTL });
    log.info(`[ConsumerData] CPI sub-indexes: ${indexes.length} months`);
    return indexes;
  } catch (err: any) {
    log.error('[ConsumerData] CPI sub-index error:', err.message);
    return [];
  }
}

/**
 * 获取社会消费品零售数据
 */
export async function getRetailSales(months = 12): Promise<RetailSales[]> {
  const cacheKey = `retail-${months}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_ECONOMY_RETAIL&columns=REPORT_DATE,RETAIL_TOTAL,RETAIL_TOTAL_SAME,RETAIL_TOTAL_SEQUENTIAL,URBAN_RETAIL,RURAL_RETAIL,ONLINE_RETAIL,CATERING_INCOME,GOODS_RETAIL&pageSize=${months}&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      log.warn('[ConsumerData] No retail sales data');
      return [];
    }

    const sales: RetailSales[] = data.result.data.map((item: any) => ({
      date: item.REPORT_DATE?.split(' ')[0] || '',
      total: parseFloat(item.RETAIL_TOTAL) || 0,
      yoyGrowth: parseFloat(item.RETAIL_TOTAL_SAME) || 0,
      momGrowth: parseFloat(item.RETAIL_TOTAL_SEQUENTIAL) || 0,
      urbanRetail: parseFloat(item.URBAN_RETAIL) || 0,
      ruralRetail: parseFloat(item.RURAL_RETAIL) || 0,
      onlineRetail: parseFloat(item.ONLINE_RETAIL) || 0,
      catering: parseFloat(item.CATERING_INCOME) || 0,
      goodsRetail: parseFloat(item.GOODS_RETAIL) || 0,
    })).reverse();

    cache.set(cacheKey, { data: sales, expires: Date.now() + CACHE_TTL });
    log.info(`[ConsumerData] Retail sales: ${sales.length} months`);
    return sales;
  } catch (err: any) {
    log.error('[ConsumerData] Retail sales error:', err.message);
    return [];
  }
}

/**
 * 获取消费者信心指数
 */
export async function getConsumerConfidence(months = 12): Promise<ConsumerConfidence[]> {
  const cacheKey = `confidence-${months}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_ECONOMY_CONSUMER_CONFIDENCE&columns=REPORT_DATE,CONSUMER_CONFIDENCE,CONSUMER_EXPECTATION,CONSUMER_SATISFACTION,INCOME_CONFIDENCE,EMPLOYMENT_CONFIDENCE&pageSize=${months}&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB&client=WEB`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.result || !data.result.data) {
      log.warn('[ConsumerData] No consumer confidence data');
      return [];
    }

    const confidence: ConsumerConfidence[] = data.result.data.map((item: any) => ({
      date: item.REPORT_DATE?.split(' ')[0] || '',
      index: parseFloat(item.CONSUMER_CONFIDENCE) || 0,
      expectation: parseFloat(item.CONSUMER_EXPECTATION) || 0,
      satisfaction: parseFloat(item.CONSUMER_SATISFACTION) || 0,
      income: parseFloat(item.INCOME_CONFIDENCE) || 0,
      employment: parseFloat(item.EMPLOYMENT_CONFIDENCE) || 0,
    })).reverse();

    cache.set(cacheKey, { data: confidence, expires: Date.now() + CACHE_TTL });
    log.info(`[ConsumerData] Consumer confidence: ${confidence.length} months`);
    return confidence;
  } catch (err: any) {
    log.error('[ConsumerData] Consumer confidence error:', err.message);
    return [];
  }
}

/**
 * 获取完整消费者数据报告
 */
export async function getConsumerDataReport(months = 12): Promise<ConsumerDataReport> {
  const cacheKey = `consumer-report-${months}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const [cpiSubIndexes, retailSales, consumerConfidence] = await Promise.all([
      getCPISubIndexes(months),
      getRetailSales(months),
      getConsumerConfidence(months),
    ]);

    const report: ConsumerDataReport = {
      success: cpiSubIndexes.length > 0 || retailSales.length > 0 || consumerConfidence.length > 0,
      cpiSubIndexes,
      retailSales,
      consumerConfidence,
      timestamp: Date.now(),
    };

    cache.set(cacheKey, { data: report, expires: Date.now() + CACHE_TTL });
    log.info('[ConsumerData] Full report generated');
    return report;
  } catch (err: any) {
    log.error('[ConsumerData] Report error:', err.message);
    return {
      success: false,
      cpiSubIndexes: [],
      retailSales: [],
      consumerConfidence: [],
      timestamp: Date.now(),
      error: err.message,
    };
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

export function clearConsumerDataCache(): void {
  cache.clear();
}
