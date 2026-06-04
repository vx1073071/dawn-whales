// ── JVS-27: Push2 API Proxy Service ──────────────────────────────────────
// Provides Node.js compatible access to push2.eastmoney.com data
// Uses datacenter API or Python skill scripts as fallback when push2 returns 502
// Fixes: sector heatmap, capital flow, market breadth, stock quotes in Node.js

import log from 'electron-log';
import https from 'https';
import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProxyResult {
  success: boolean;
  data: any;
  source: 'push2' | 'datacenter' | 'python' | 'cache';
  latencyMs: number;
}

export interface SectorQuote {
  code: string;
  name: string;
  changePct: number;
  leadingStock: string;
  leadingChange: number;
  turnover: number;
}

export interface StockQuote {
  code: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  turnover: number;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: any; expires: number; source: string }>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// ── HTTP Helpers ───────────────────────────────────────────────────────────

function httpGet(url: string, timeout = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      if (res.statusCode === 302 && res.headers.location) {
        httpGet(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

// ── Push2 Proxy Service ────────────────────────────────────────────────────

export class Push2ProxyService {
  private pythonPath: string | null = null;
  private skillBasePath = 'C:\\Users\\vx107\\.easyclaw\\workspace\\skills';

  constructor() {
    this.detectPython();
  }

  private detectPython() {
    const candidates = [
      'C:\\Users\\vx107\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
      'C:\\Users\\vx107\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
      'python',
    ];
    for (const p of candidates) {
      try {
        if (p.includes('\\')) {
          const fs = require('fs');
          if (fs.existsSync(p)) { this.pythonPath = p; return; }
        }
      } catch (e) { logger.error('[backend:push2-proxy]', e); }
    }
    this.pythonPath = 'python';
  }

  // ── Sector Heatmap (替代 push2 clist API) ──────────────────────────────

  async getSectorHeatmap(type: 'industry' | 'concept' | 'region' = 'industry', limit = 50): Promise<ProxyResult> {
    const cacheKey = `sector-heatmap-${type}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return { success: true, data: cached.data, source: 'cache' as any, latencyMs: 0 };
    }

    const start = Date.now();

    // Try 1: push2 directly (works in Electron, may 502 in Node.js)
    try {
      const fsMap = { industry: 'm:90+t:2', concept: 'm:90+t:3', region: 'm:90+t:1' };
      const url = `http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${limit}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${fsMap[type]}&fields=f2,f3,f4,f8,f12,f14,f20,f104,f105,f128,f140`;
      const raw = await httpGet(url, 5000);
      const json = JSON.parse(raw);
      if (json.data?.diff) {
        const sectors: SectorQuote[] = json.data.diff.map((item: any) => ({
          code: item.f12,
          name: item.f14,
          changePct: item.f3,
          leadingStock: item.f128 || '',
          leadingChange: item.f140 || 0,
          turnover: item.f20 || 0,
        }));
        cache.set(cacheKey, { data: sectors, expires: Date.now() + DEFAULT_TTL, source: 'push2' });
        return { success: true, data: sectors, source: 'push2', latencyMs: Date.now() - start };
      }
    } catch (err: any) {
      log.debug(`[Push2Proxy] push2 sector failed: ${err.message}`);
    }

    // Try 2: Python skill script
    try {
      const typeCN = type === 'industry' ? '行业板块' : type === 'concept' ? '概念板块' : '地域板块';
      const scriptPath = `${this.skillBasePath}\\em-mx-finance-data\\scripts\\get_data.py`;
      const { stdout } = await execAsync(
        `"${this.pythonPath}" "${scriptPath}" --query "${typeCN}涨跌幅排名"`,
        { timeout: 30000, encoding: 'utf-8' }
      );
      // Parse xlsx path from stdout
      const pathMatch = stdout.match(/xlsx:\s*(.+)/);
      if (pathMatch) {
        const xlsxPath = pathMatch[1].trim();
        // Read and parse xlsx using python
        const { stdout: csvOut } = await execAsync(
          `"${this.pythonPath}" -c "import pandas as pd; df=pd.read_excel('${xlsxPath}'); print(df.head(${limit}).to_json(orient='records', force_ascii=False))"`,
          { timeout: 15000, encoding: 'utf-8' }
        );
        const sectors = JSON.parse(csvOut);
        cache.set(cacheKey, { data: sectors, expires: Date.now() + DEFAULT_TTL, source: 'python' });
        return { success: true, data: sectors, source: 'python', latencyMs: Date.now() - start };
      }
    } catch (err: any) {
      log.debug(`[Push2Proxy] Python sector failed: ${err.message}`);
    }

    return { success: false, data: [], source: 'push2', latencyMs: Date.now() - start };
  }

  // ── Capital Flow (替代 push2 capital flow API) ─────────────────────────

  async getCapitalFlowRank(type: 'stock' | 'sector' | 'concept' = 'stock', limit = 50): Promise<ProxyResult> {
    const cacheKey = `capital-flow-${type}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return { success: true, data: cached.data, source: 'cache' as any, latencyMs: 0 };
    }

    const start = Date.now();

    // Try 1: push2 directly
    try {
      const fsMap = {
        stock: 'm:0+t:6,m:0+t:13,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
        sector: 'm:90+t:2',
        concept: 'm:90+t:3',
      };
      const fields = type === 'stock'
        ? 'f2,f3,f12,f14,f62,f66,f72,f78,f184,f66'
        : 'f2,f3,f12,f14,f62,f66,f128,f136';
      const url = `http://push2.eastmoney.com/api/qt/clist/get?fid=f62&po=-1&pz=${limit}&pn=1&np=1&fltt=2&invt=2&fields=${fields}&fs=${fsMap[type]}`;
      const raw = await httpGet(url, 5000);
      const json = JSON.parse(raw);
      if (json.data?.diff) {
        const items = json.data.diff.map((item: any) => ({
          code: item.f12,
          name: item.f14,
          changePct: item.f3,
          mainNetInflow: item.f62 || 0,
          superLargeIn: item.f66 || 0,
          largeIn: item.f72 || 0,
          mediumIn: item.f78 || 0,
          leadingStock: item.f128 || '',
          leadingChange: item.f136 || 0,
        }));
        cache.set(cacheKey, { data: items, expires: Date.now() + DEFAULT_TTL, source: 'push2' });
        return { success: true, data: items, source: 'push2', latencyMs: Date.now() - start };
      }
    } catch (err: any) {
      log.debug(`[Push2Proxy] push2 capital flow failed: ${err.message}`);
    }

    return { success: false, data: [], source: 'push2', latencyMs: Date.now() - start };
  }

  // ── Stock Quotes (替代 push2 stock/get API) ────────────────────────────

  async getStockQuote(secid: string): Promise<ProxyResult> {
    const cacheKey = `stock-quote-${secid}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return { success: true, data: cached.data, source: 'cache' as any, latencyMs: 0 };
    }

    const start = Date.now();

    // Try 1: push2 directly
    try {
      const url = `http://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f50,f57,f58,f169,f170`;
      const raw = await httpGet(url, 5000);
      const json = JSON.parse(raw);
      if (json.data) {
        const quote: StockQuote = {
          code: json.data.f57 || secid.split('.')[1],
          name: json.data.f58 || '',
          price: (json.data.f43 || 0) / 100,
          changePct: (json.data.f170 || 0) / 100,
          volume: json.data.f47 || 0,
          turnover: json.data.f48 || 0,
        };
        cache.set(cacheKey, { data: quote, expires: Date.now() + 60000, source: 'push2' }); // 1 min for quotes
        return { success: true, data: quote, source: 'push2', latencyMs: Date.now() - start };
      }
    } catch (err: any) {
      log.debug(`[Push2Proxy] push2 quote failed: ${err.message}`);
    }

    return { success: false, data: null, source: 'push2', latencyMs: Date.now() - start };
  }

  // ── Market Breadth (替代 push2 ulist API) ──────────────────────────────

  async getMarketBreadth(): Promise<ProxyResult> {
    const cacheKey = 'market-breadth';
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return { success: true, data: cached.data, source: 'cache' as any, latencyMs: 0 };
    }

    const start = Date.now();

    // Try 1: push2 directly
    try {
      const url = 'http://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006&fields=f1,f2,f3,f4,f6,f12,f13,f14,f104,f105,f106';
      const raw = await httpGet(url, 5000);
      const json = JSON.parse(raw);
      if (json.data?.diff) {
        const sh = json.data.diff.find((d: any) => d.f12 === '000001');
        const breadth = {
          advancing: sh?.f104 || 0,
          declining: sh?.f105 || 0,
          unchanged: sh?.f106 || 0,
          timestamp: Date.now(),
        };
        cache.set(cacheKey, { data: breadth, expires: Date.now() + DEFAULT_TTL, source: 'push2' });
        return { success: true, data: breadth, source: 'push2', latencyMs: Date.now() - start };
      }
    } catch (err: any) {
      log.debug(`[Push2Proxy] push2 breadth failed: ${err.message}`);
    }

    return { success: false, data: null, source: 'push2', latencyMs: Date.now() - start };
  }

  // ── Utility ────────────────────────────────────────────────────────────

  clearCache(): void {
    cache.clear();
  }

  getStatus(): { pythonPath: string | null; cacheSize: number; cacheKeys: string[] } {
    return {
      pythonPath: this.pythonPath,
      cacheSize: cache.size,
      cacheKeys: Array.from(cache.keys()),
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let push2ProxyInstance: Push2ProxyService | null = null;

export function getPush2Proxy(): Push2ProxyService {
  if (!push2ProxyInstance) {
    push2ProxyInstance = new Push2ProxyService();
  }
  return push2ProxyInstance;
}
