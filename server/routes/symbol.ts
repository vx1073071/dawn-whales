/**
 * DAWN WHALES R152 — Symbol Search + Broker Markets Routes
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
import { getSearchEngine, getBrokersForMarket, getBrokerMarkets, BROKER_MARKET_MAP, MARKET_LABELS } from '../services/symbol-search';
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
