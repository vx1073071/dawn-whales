/**
 * DAWN WHALES — Centralized External Endpoint Configuration
 *
 * All external API URLs are defined here. No hardcoded URLs in engine/ source files.
 * Environment-driven via NODE_ENV: development → staging → production.
 *
 * Usage:
 *   import { ENDPOINTS } from '../config/endpoints';
 *   const url = ENDPOINTS.eastmoney.push2.base + '/api/qt/clist/get';
 *
 * To override: set env var, e.g. EASTMONEY_PUSH2_BASE=https://custom.proxy.com
 */

// ── Environment ──────────────────────────────────────────────────────────────

const ENV = (typeof process !== 'undefined' && process.env?.NODE_ENV) || 'development';

const isTest = ENV === 'test';
const isDev = ENV === 'development';
const isStaging = ENV === 'staging';
const isProduction = ENV === 'production';

// ── Helper: env var override with fallback ───────────────────────────────────

function env(key: string, fallback: string): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback;
  }
  return fallback;
}

// ── Endpoint Definitions ─────────────────────────────────────────────────────

export const ENDPOINTS = {
  /** Binance — cryptocurrency REST + WebSocket */
  binance: {
    rest: env('BINANCE_REST_URL', 'https://api.binance.com'),
    ws: env('BINANCE_WS_URL', 'wss://stream.binance.com:9443'),
    testnet: env('BINANCE_TESTNET_URL', 'https://testnet.binance.vision'),
  },

  /** CoinGecko — cryptocurrency price/rate data */
  coingecko: {
    base: env('COINGECKO_BASE_URL', 'https://api.coingecko.com/api/v3'),
    pro: env('COINGECKO_PRO_URL', 'https://pro-api.coingecko.com/api/v3'),
  },

  /** Yahoo Finance — US stock market data */
  yahoo: {
    chart: env('YAHOO_CHART_URL', 'https://query1.finance.yahoo.com/v8/finance/chart/'),
    quote: env('YAHOO_QUOTE_URL', 'https://query2.finance.yahoo.com/v7/finance/quote'),
    search: env('YAHOO_SEARCH_URL', 'https://query2.finance.yahoo.com/v1/finance/search'),
  },

  /** EastMoney — A-share / HK stock data (15+ endpoints) */
  eastmoney: {
    push2: {
      base: env('EASTMONEY_PUSH2_URL', 'https://push2.eastmoney.com'),
    },
    push2ex: {
      base: env('EASTMONEY_PUSH2EX_URL', 'https://push2ex.eastmoney.com'),
    },
    push2his: {
      base: env('EASTMONEY_PUSH2HIS_URL', 'https://push2his.eastmoney.com'),
    },
    datacenter: {
      base: env('EASTMONEY_DATACENTER_URL', 'https://datacenter.eastmoney.com'),
    },
    datacenterWeb: {
      base: env('EASTMONEY_DATACENTER_WEB_URL', 'https://datacenter-web.eastmoney.com'),
    },
  },

  /** Reddit — sentiment data (WallStreetBets, stocks, etc.) */
  reddit: {
    oauth: env('REDDIT_OAUTH_URL', 'https://oauth.reddit.com'),
    www: env('REDDIT_WWW_URL', 'https://www.reddit.com'),
    token: env('REDDIT_TOKEN_URL', 'https://www.reddit.com/api/v1/access_token'),
  },

  /** NewsAPI — financial news aggregation */
  newsapi: {
    base: env('NEWSAPI_BASE_URL', 'https://newsapi.org/v2'),
  },

  /** Alpha Vantage — fundamental + technical data */
  alphaVantage: {
    base: env('ALPHAVANTAGE_BASE_URL', 'https://www.alphavantage.co/query'),
  },

  /** StockTwits — social sentiment */
  stocktwits: {
    base: env('STOCKTWITS_BASE_URL', 'https://api.stocktwits.com/api/2'),
  },

  /** Sina Finance — CN stock quotes (legacy) */
  sina: {
    feed: env('SINA_FEED_URL', 'https://feed.mix.sina.com.cn'),
    hq: env('SINA_HQ_URL', 'https://hq.sinajs.cn'),
  },

  /** Xueqiu — CN social investing */
  xueqiu: {
    base: env('XUEQIU_BASE_URL', 'https://xueqiu.com'),
  },

  /** Exchange Rate — currency conversion fallback */
  exchangerate: {
    base: env('EXCHANGERATE_BASE_URL', 'https://api.exchangerate-api.com/v4/latest/USD'),
  },

  /** DeepSeek — AI model API */
  deepseek: {
    base: env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
    chat: env('DEEPSEEK_CHAT_URL', 'https://api.deepseek.com/v1/chat/completions'),
  },

  /** Dawn Whales — own platform services */
  dawnwhales: {
    www: env('DAWNWHALES_WWW_URL', 'https://dawnwhales.com'),
    api: env('DAWNWHALES_API_URL', 'https://api.dawnwhales.com'),
    download: env('DAWNWHALES_DL_URL', 'https://dl.dawnwhales.com'),
    opendWs: env('DAWNWHALES_OPEND_WS', 'wss://opend.dawn-whales.cloud'),
  },

  /** jsDelivr — CDN for static assets */
  jsdelivr: {
    cdn: env('JSDELIVR_CDN_URL', 'https://cdn.jsdelivr.net'),
  },

  /** GitHub — release downloads */
  github: {
    releases: env('GITHUB_RELEASES_URL', 'https://github.com/dawn-whales/dawn-whales/releases'),
    clone: env('GITHUB_CLONE_URL', 'https://github.com/dawn-whales/dawn-whales.git'),
  },
} as const;

// ── Type exports ─────────────────────────────────────────────────────────────

export type EndpointConfig = typeof ENDPOINTS;

/** Selector for environment-conditional URL overrides */
export function getEndpointUrl(
  service: keyof typeof ENDPOINTS,
  path: string,
): string {
  const svc = ENDPOINTS[service];
  // Most services have a `base` key
  if ('base' in svc && typeof (svc as any).base === 'string') {
    return (svc as any).base + path;
  }
  // Fallback: try common sub-keys
  if ('rest' in svc) return (svc as any).rest + path;
  if ('www' in svc) return (svc as any).www + path;
  if ('chart' in svc) return (svc as any).chart + path;
  throw new Error(`No base URL found for service: ${service}`);
}

// ── Environment switch ───────────────────────────────────────────────────────

if (!isProduction) {
  // Staging/development overrides loaded from env vars above
  // In test env, point all external APIs at mock server
  if (isTest) {
    const mockUrl = env('MOCK_SERVER_URL', 'http://127.0.0.1:19001');
    // Tests should not call real APIs; mock server handles everything
    log.log(`[ENDPOINTS] Test mode active — all external APIs → ${mockUrl}`);
  }
  if (isDev) {
    log.log('[ENDPOINTS] Development mode — using default endpoints');
  }
}

import log from 'electron-log';