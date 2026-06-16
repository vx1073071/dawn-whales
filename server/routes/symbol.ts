/**
 * QUANT MOO R152 — Symbol Search + Broker Markets Routes
 *
 * Endpoints:
 *   GET  /api/symbol/search?q=腾讯&market=HK&type=STOCK  — Search symbols
 *   GET  /api/symbol/:standardCode                      — Symbol detail
 *   GET  /api/broker/markets                            — All broker market capabilities
 *   GET  /api/broker/markets/:brokerType                — Single broker markets
 *   GET  /api/broker/markets/by/:market                 — Brokers for a specific market
 *
 * ≥200L
 */

import { Router, Request, Response } from 'express';
import { getSearchEngine, getBrokersForMarket, getBrokerMarkets, detectMarket, BROKER_MARKET_MAP, MARKET_LABELS } from '../services/symbol-search';
import type { MarketType, BrokerType } from '../../electron/broker/IBrokerAdapterV2';
import type { SearchRequest } from '../services/symbol-search';

const router = Router();

// ═══════════════════════════════════════════════════════════
// GET /api/symbol/search — Main search endpoint
// ═══════════════════════════════════════════════════════════

router.get('/search', (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.status(400).json({ success: false, error: 'Missing query parameter "q"' });
      return;
    }

    const searchReq: SearchRequest = {
      query,
      market: req.query.market as MarketType | undefined,
      type: req.query.type as SearchRequest['type'] | undefined,
      limit: req.query.limit ? Math.min(parseInt(String(req.query.limit)) || 20, 100) : 20,
      offset: req.query.offset ? parseInt(String(req.query.offset)) || 0 : 0,
      includeBrokers: req.query.nobrokers !== '1',
    };

    const engine = getSearchEngine();
    const result = engine.search(searchReq);

    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/symbol/:standardCode — Symbol detail
// ═══════════════════════════════════════════════════════════

router.get('/:standardCode', (req: Request, res: Response) => {
  try {
    const standardCode = req.params.standardCode;
    const engine = getSearchEngine();

    // Support both "HK:00700" and "HK-00700" formats
    const normalizedCode = standardCode.replace('-', ':');
    const entry = engine.getByStandardCode(normalizedCode);

    if (!entry) {
      res.status(404).json({ success: false, error: `Symbol not found: ${standardCode}` });
      return;
    }

    res.status(200).json({
      success: true,
      symbol: {
        standardCode: entry.standardCode,
        symbol: entry.symbol,
        market: entry.market,
        marketLabel: MARKET_LABELS[entry.market] || entry.market,
        exchange: entry.exchange,
        name: entry.name,
        nameEn: entry.nameEn,
        type: entry.type,
        currency: entry.currency,
        lotSize: entry.lotSize,
        availableBrokers: entry.brokerCapable.map(b => ({
          brokerType: b,
          label: brokerLabel(b),
        })),
        unavailableBrokers: (Object.keys(BROKER_MARKET_MAP) as BrokerType[])
          .filter(b => !entry.brokerCapable.includes(b))
          .slice(0, 5)
          .map(b => ({ brokerType: b, label: brokerLabel(b) })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/broker/markets — All broker market coverage
// ═══════════════════════════════════════════════════════════

router.get('/broker/markets', (_req: Request, res: Response) => {
  try {
    const all = (Object.keys(BROKER_MARKET_MAP) as BrokerType[]).map(bt => ({
      brokerType: bt,
      label: brokerLabel(bt),
      markets: getBrokerMarkets(bt).map(m => ({
        market: m,
        label: MARKET_LABELS[m] || m,
      })),
      marketCount: getBrokerMarkets(bt).length,
    }));

    res.status(200).json({ success: true, brokers: all, total: all.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/broker/markets/:brokerType — Single broker
// ═══════════════════════════════════════════════════════════

router.get('/broker/markets/:brokerType', (req: Request, res: Response) => {
  try {
    const brokerType = req.params.brokerType as BrokerType;
    const markets = getBrokerMarkets(brokerType);

    if (markets.length === 0) {
      res.status(404).json({ success: false, error: `Unknown broker: ${brokerType}` });
      return;
    }

    res.status(200).json({
      success: true,
      brokerType,
      label: brokerLabel(brokerType),
      markets: markets.map(m => ({ market: m, label: MARKET_LABELS[m] || m })),
      marketCount: markets.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/broker/markets/by/:market — Brokers for a market
// ═══════════════════════════════════════════════════════════

router.get('/broker/markets/by/:market', (req: Request, res: Response) => {
  try {
    const market = req.params.market as MarketType;
    if (!['HK', 'US', 'CN', 'CRYPTO', 'SG', 'JP', 'UK', 'EU'].includes(market)) {
      res.status(400).json({ success: false, error: `Invalid market: ${market}. Valid: HK, US, CN, CRYPTO, SG, JP, UK, EU` });
      return;
    }

    const brokers = getBrokersForMarket(market);
    res.status(200).json({
      success: true,
      market,
      label: MARKET_LABELS[market] || market,
      brokers: brokers.map(b => ({ brokerType: b, label: brokerLabel(b) })),
      count: brokers.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/broker/market-stats — Market statistics
// ═══════════════════════════════════════════════════════════

router.get('/broker/market-stats', (_req: Request, res: Response) => {
  try {
    const engine = getSearchEngine();
    const stats = engine.getMarketStats();
    res.status(200).json({ success: true, markets: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// R156 JVS #14: POST /api/symbol/check — Broker availability check
// ═══════════════════════════════════════════════════════════
// Input: { symbols: string[] }   Output: per-symbol broker connectivity

router.post('/check', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body;
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ success: false, error: 'symbols array required' });
    }

    const engine = getSearchEngine();
    const results: Array<{
      standardCode: string;
      name: string;
      market: string;
      brokerAvailable: boolean;
      connectedBrokers: Array<{ brokerId: string; label: string; connected: boolean; latencyMs: number }>;
      totalBrokers: number;
      connectedCount: number;
    }> = [];

    // Get live broker health from adapter registry
    let healthMap = new Map<string, { ok: boolean; latencyMs: number }>();
    try {
      const { getAdapterRegistry } = require('../adapters/adapter-factory');
      const registry = getAdapterRegistry();
      registry.registerAll();
      const healthResults = await registry.healthCheckAll().catch(() => []);
      for (const h of healthResults) {
        healthMap.set(h.brokerId, { ok: h.ok, latencyMs: h.latencyMs });
      }
    } catch {
      // No adapter registry available — all brokers marked disconnected
    }

    for (const query of symbols.slice(0, 50)) { // max 50 per request
      const normalized = query.includes(':') ? query : query.replace('-', ':');
      const entry = engine.getByStandardCode(normalized);
      const detected = detectMarket(query);

      if (!entry) {
        results.push({
          standardCode: normalized,
          name: query,
          market: detected.market,
          brokerAvailable: false,
          connectedBrokers: [],
          totalBrokers: 0,
          connectedCount: 0,
        });
        continue;
      }

      const capableBrokers = entry.brokerCapable;
      const connectedBrokers = capableBrokers.map(bt => {
        const health = healthMap.get(bt);
        return {
          brokerId: bt,
          label: brokerLabel(bt),
          connected: health?.ok || false,
          latencyMs: health?.latencyMs ?? -1,
        };
      });

      results.push({
        standardCode: entry.standardCode,
        name: entry.name,
        market: entry.market,
        brokerAvailable: capableBrokers.length > 0,
        connectedBrokers,
        totalBrokers: capableBrokers.length,
        connectedCount: connectedBrokers.filter(b => b.connected).length,
      });
    }

    return res.json({
      success: true,
      checkedAt: new Date().toISOString(),
      results,
      total: results.length,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// R156 JVS: GET /api/symbol/quote-preview — Real-time price preview
// ═══════════════════════════════════════════════════════════
// Query: ?q=BTC&market=CRYPTO&limit=10
// Returns search results with live quote data overlaid

router.get('/quote-preview', async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({ success: false, error: 'Missing query parameter "q"' });
    }

    const engine = getSearchEngine();
    const searchResult = engine.search({
      query,
      market: req.query.market as MarketType | undefined,
      limit: Math.min(parseInt(String(req.query.limit)) || 10, 20),
      includeBrokers: true,
    });

    // Try to enrich with live quote data from quote-cache
    let quoteMap = new Map<string, { price: number; change: number; changePct: number; volume: number; source: string; ageMs: number }>();
    try {
      const { getQuoteCache } = require('../services/quote-cache');
      const cache = getQuoteCache();
      for (const r of searchResult.results) {
        const cached = cache.get(r.standardCode);
        if (cached) {
          quoteMap.set(r.standardCode, {
            price: cached.data.last || cached.data.price || 0,
            change: cached.data.change || 0,
            changePct: cached.data.changePercent || cached.data.changePct || 0,
            volume: cached.data.volume || 0,
            source: cached.source || 'cache',
            ageMs: cached.ageMs,
          });
        }
      }
    } catch {
      // Cache not available — skip live quote enrichment
    }

    const results = searchResult.results.map(r => {
      const quote = quoteMap.get(r.standardCode);
      return {
        ...r,
        liveQuote: quote ? {
          price: quote.price,
          change: quote.change,
          changePct: quote.changePct,
          volume: quote.volume,
          source: quote.source,
          lastUpdateMs: quote.ageMs,
          isStale: quote.ageMs > 5000,
        } : null,
      };
    });

    return res.json({
      success: true,
      query: searchResult.query,
      detectedMarket: searchResult.detectedMarket,
      totalResults: searchResult.totalResults,
      results,
      hasLiveQuotes: quoteMap.size > 0,
      searchTimeMs: searchResult.searchTimeMs,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

const BROKER_LABELS: Record<string, string> = {
  futu: '富途', moomoo: 'moomoo', ib: '盈透', longbridge: '长桥',
  tiger: '老虎', vbkr: '华盛', usmart: '盈立',
  binance: '币安', okx: 'OKX', bybit: 'Bybit', bitget: 'Bitget',
  schwab: '嘉信', etrade: 'E*TRADE', etoro: 'eToro', webull: '微牛',
  robinhood: 'Robinhood', mt5: 'MT5',
};

function brokerLabel(bt: BrokerType): string {
  return BROKER_LABELS[bt] || bt;
}

export default router;
