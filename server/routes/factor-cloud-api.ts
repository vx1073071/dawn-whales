/**
 * QUANT MOO R166 P1-A2 — Factor Cloud API
 *
 * Cloud factor marketplace backend:
 *   GET  /api/factor-cloud/search?text=momentum&market=HK&page=1
 *   GET  /api/factor-cloud/factor/:id — single factor detail + stats
 *   GET  /api/factor-cloud/browse?category=ic — browse by category (ic / strategy / signal / all)
 *   GET  /api/factor-cloud/commission/preview?assetType=signal&price=100&tier=L2
 *   POST /api/factor-cloud/purchase — initiate purchase with commission calculation
 *
 * >=250L
 */
import { Router, Request, Response } from 'express';
import { getMarketplace } from '../../electron/engine/analysis/strategy-marketplace-api';
import type {
  FactorListing,
  SignalListing,
  CommissionResult,
  CreatorTier,
  AssetType,
} from '../../electron/engine/analysis/strategy-marketplace-api';
import { createRedisCache } from '../../electron/engine/data/redis-cache-layer';

const router = Router();

// Purchase record cache (24h TTL)
const purchaseCache = createRedisCache({ namespace: 'factor-cloud-purchase', defaultTTL: 86400 });

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface SearchResponse {
  success: boolean;
  data?: {
    items: Record<string, unknown>[];
    total: number;
    page: number;
    pageSize: number;
    breakdownByType: Record<string, number>;
  };
  error?: string;
}

interface FactorDetailResponse {
  success: boolean;
  data?: {
    factor: FactorListing;
  };
  error?: string;
}

interface CommissionPreviewResponse {
  success: boolean;
  data?: CommissionResult;
  error?: string;
}

interface PurchaseResponse {
  success: boolean;
  data?: {
    purchaseId: string;
    assetType: string;
    itemId: string;
    price: number;
    commission: CommissionResult;
    status: 'completed' | 'pending';
    purchasedAt: string;
  };
  error?: string;
}

// ═══════════════════════════════════════════════════════════
// GET /api/factor-cloud/search
// Unified search across factor + strategy + signal marketplace
// ═══════════════════════════════════════════════════════════

router.get('/search', (req: Request, res: Response) => {
  try {
    const marketplace = getMarketplace();
    const {
      text,
      category,
      market,
      minPrice,
      maxPrice,
      sort,
      page,
      pageSize,
      types,
    } = req.query;

    const parsedMin = minPrice ? Number(minPrice) : undefined;
    const parsedMax = maxPrice ? Number(maxPrice) : undefined;
    const parsedPage = page ? Number(page) : 1;
    const parsedLimit = pageSize ? Number(pageSize) : 20;

    if (parsedMin !== undefined && (isNaN(parsedMin) || parsedMin < 0)) {
      return res.status(400).json({ success: false, error: 'Invalid minPrice' });
    }

    const result = marketplace.unifiedSearch({
      text: text?.toString(),
      category: category?.toString(),
      market: market?.toString(),
      minPrice: parsedMin,
      maxPrice: parsedMax,
      sort: (sort?.toString() ?? 'rating') as 'rating' | 'revenue' | 'price' | 'newest',
      page: parsedPage,
      pageSize: Math.min(parsedLimit, 100),
      assetTypes: types
        ? (types.toString().split(',') as AssetType[]).filter(t =>
            ['strategy', 'factor', 'signal'].includes(t),
          )
        : undefined,
    });

    res.json({
      success: true,
      data: {
        items: result.items.map(i => ({
          ...i,
          metadata: i.metadata || {},
        })),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        breakdownByType: result.breakdownByType,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/factor-cloud/factor/:id
// Factor detail endpoint
// ═══════════════════════════════════════════════════════════

router.get('/factor/:id', (req: Request, res: Response) => {
  try {
    const marketplace = getMarketplace();
    const id = req.params.id;

    // Try factor store first, then signal store
    let item: FactorListing | SignalListing | undefined;

    if (id.startsWith('FCT-')) {
      item = marketplace.getFactor(id);
    } else if (id.startsWith('SIG-')) {
      item = marketplace.getSignal(id);
    }

    if (!item) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    res.json({ success: true, data: { factor: item } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/factor-cloud/browse
// Browse by category across all asset types
// ═══════════════════════════════════════════════════════════

router.get('/browse', (req: Request, res: Response) => {
  try {
    const marketplace = getMarketplace();
    const category = req.query.category?.toString() ?? 'all';

    const result = marketplace.unifiedSearch({
      page: Number(req.query.page) || 1,
      pageSize: Math.min(Number(req.query.pageSize) || 20, 100),
      sort: (req.query.sort?.toString() ?? 'rating') as 'rating' | 'revenue' | 'price' | 'newest',
      assetTypes: category === 'all'
        ? undefined
        : category === 'ic'
          ? ['factor' as AssetType]
          : category === 'strategy'
            ? ['strategy' as AssetType]
            : category === 'signal'
              ? ['signal' as AssetType]
              : undefined,
    });

    res.json({
      success: true,
      data: {
        category,
        items: result.items,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        breakdownByType: result.breakdownByType,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/factor-cloud/commission/preview
// Preview commission before purchase
// ═══════════════════════════════════════════════════════════

router.get('/commission/preview', (req: Request, res: Response) => {
  try {
    const marketplace = getMarketplace();
    const {
      assetType,
      price,
      tier,
    } = req.query;

    const parsedPrice = Number(price);
    if (!assetType || isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid assetType or price' });
    }

    const validTypes: AssetType[] = ['strategy', 'factor', 'signal'];
    if (!validTypes.includes(assetType as AssetType)) {
      return res.status(400).json({ success: false, error: `Invalid assetType. Use one of: ${validTypes.join(', ')}` });
    }

    const result = marketplace.calculateCommission({
      assetType: assetType as AssetType,
      price: parsedPrice,
      creatorTier: (tier?.toString() ?? 'L1') as CreatorTier,
    });

    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/factor-cloud/purchase
// Execute purchase with commission deduction
// ═══════════════════════════════════════════════════════════

router.post('/purchase', (req: Request, res: Response) => {
  try {
    const marketplace = getMarketplace();
    const {
      assetType,
      itemId,
      price,
      creatorTier,
      buyerId,
    } = req.body;

    if (!assetType || !itemId || price === undefined || !buyerId) {
      return res.status(400).json({ success: false, error: 'Missing fields: assetType, itemId, price, buyerId' });
    }

    const parsedPrice = Number(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid price' });
    }

    const validTypes: AssetType[] = ['strategy', 'factor', 'signal'];
    if (!validTypes.includes(assetType)) {
      return res.status(400).json({ success: false, error: `Invalid assetType: ${assetType}` });
    }

    const commission = marketplace.calculateCommission({
      assetType,
      price: parsedPrice,
      creatorTier: creatorTier ?? 'L1',
    });

    const purchaseId = `PUR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const record = {
      purchaseId,
      assetType,
      itemId,
      price: parsedPrice,
      commission,
      buyerId,
      status: 'completed' as const,
      purchasedAt: new Date().toISOString(),
    };

    // Cache purchase record
    (marketplace as any).purchaseRecords = (marketplace as any).purchaseRecords || [];
    (marketplace as any).purchaseRecords.push(record);

    res.json({ success: true, data: record });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
export { router };
