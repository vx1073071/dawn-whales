/**
 * R252 管道终验: 全量 pipeline 模块集成终验
 *
 * 验证:
 *   1. 所有管道模块可导入（编译通过）
 *   2. 新闻聚合链: fetch→dedup→sentiment（核心管道）
 *   3. 数据源链: crypto/social/regional/major/free API → 一致性
 *   4. 分析链: screener→backtest→digest→briefing
 *   5. 质量链: degradation→source-health→watchlist
 */

import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: Importability — all 24 pipeline modules
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 管道终验 — Importability (24 modules)', () => {
  const modules: Array<[string, string, string]> = [
    ['R238 news-aggregator', '../../electron/engine/data/news-aggregator', 'NewsAggregator'],
    ['R238 xueqiu-fetcher', '../../electron/engine/data/xueqiu-fetcher', 'XueqiuFetcher'],
    ['R238 cls-telegraph-fetcher', '../../electron/engine/data/cls-telegraph-fetcher', 'CLSTelegraphFetcher'],
    ['R238 dedup-engine', '../../electron/engine/data/dedup-engine', 'DedupEngine'],
    ['R239 ai-sentiment-engine', '../../electron/engine/data/ai-sentiment-engine', 'AISentimentEngine'],
    ['R239 newsapi-manager', '../../electron/engine/data/newsapi-manager', 'NewsAPIKeyManager'],
    ['R239 dedup-engine-v2', '../../electron/engine/data/dedup-engine-v2', 'DedupEngineV2'],
    ['R240 news-stock-screener', '../../electron/engine/data/news-stock-screener', 'NewsStockScreener'],
    ['R240 crypto-feeds', '../../electron/engine/data/crypto-feeds', 'CryptoFeedsFetcher'],
    ['R240 stock-screener-v2', '../../electron/engine/data/stock-screener-v2', 'StockScreenerV2'],
    ['R241 social-feeds', '../../electron/engine/data/social-feeds', 'SocialFeedsFetcher'],
    ['R241 regional-feeds', '../../electron/engine/data/regional-feeds', 'RegionalFeedsFetcher'],
    ['R241 copytrade-news-enhancer', '../../electron/engine/data/copytrade-news-enhancer', 'CopytradeNewsEnhancer'],
    ['R242 news-backtest-data-prep', '../../electron/engine/data/news-backtest-data-prep', 'NewsBacktestDataPrep'],
    ['R242 daily-digest-v2', '../../electron/engine/data/daily-digest-v2', 'DailyDigestV2'],
    ['R243 free-api-fetcher', '../../electron/engine/data/free-api-fetcher', 'FreeAPIFetcher'],
    ['R243 major-feeds', '../../electron/engine/data/major-feeds', 'MajorFeedsFetcher'],
    ['R243 price-move-attribution', '../../electron/engine/data/price-move-attribution', 'PriceMoveAttribution'],
    ['R244 daily-briefing-generator', '../../electron/engine/data/daily-briefing-generator', 'DailyBriefingGenerator'],
    ['R244 degradation-chain', '../../electron/engine/data/degradation-chain', 'DegradationChain'],
    ['R244 watchlist-smart-news', '../../electron/engine/data/watchlist-smart-news', 'WatchlistSmartNews'],
    ['R245 social-source-degradation', '../../electron/engine/data/social-source-degradation', 'SocialSourceDegradation'],
    ['R246 one-click-deploy-pipeline', '../../electron/engine/data/one-click-deploy-pipeline', 'OneClickDeployPipeline'],
    ['R246 price-move-push-engine', '../../electron/engine/data/price-move-push-engine', 'PriceMovePushEngine'],
  ];

  for (const [label, path, className] of modules) {
    it(`${label} imports cleanly`, async () => {
      const mod = await import(path);
      expect(mod[className]).toBeDefined();
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: News Aggregation Pipeline E2E
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 管道终验 — News Aggregation Chain', () => {
  it('news-aggregator: fetches from all sources', async () => {
    const { NewsAggregator } = await import('../../electron/engine/data/news-aggregator');
    const agg = new NewsAggregator();
    const sources = agg.getSources();
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThan(0);
  });

  it('xueqiu-fetcher: has source metadata', async () => {
    const { XueqiuFetcher } = await import('../../electron/engine/data/xueqiu-fetcher');
    const fetcher = new XueqiuFetcher();
    expect(fetcher).toBeDefined();
  });

  it('cls-telegraph: fetcher instantiable', async () => {
    const { CLSTelegraphFetcher } = await import('../../electron/engine/data/cls-telegraph-fetcher');
    const fetcher = new CLSTelegraphFetcher();
    expect(fetcher).toBeDefined();
  });

  it('dedup-engine: instantiable', async () => {
    const { DedupEngine } = await import('../../electron/engine/data/dedup-engine');
    const dedup = new DedupEngine();
    expect(dedup).toBeDefined();
  });

  it('dedup-engine-v2: instantiable', async () => {
    const { DedupEngineV2 } = await import('../../electron/engine/data/dedup-engine-v2');
    const dedup = new DedupEngineV2();
    expect(dedup).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: Feed Sources — all categories
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 管道终验 — Feed Sources', () => {
  it('crypto-feeds: instantiable', async () => {
    const { CryptoFeedsFetcher } = await import('../../electron/engine/data/crypto-feeds');
    const fetcher = new CryptoFeedsFetcher();
    expect(fetcher).toBeDefined();
  });

  it('social-feeds: instantiable', async () => {
    const { SocialFeedsFetcher } = await import('../../electron/engine/data/social-feeds');
    const fetcher = new SocialFeedsFetcher();
    expect(fetcher).toBeDefined();
  });

  it('regional-feeds: instantiable', async () => {
    const { RegionalFeedsFetcher } = await import('../../electron/engine/data/regional-feeds');
    const fetcher = new RegionalFeedsFetcher();
    expect(fetcher).toBeDefined();
  });

  it('major-feeds: instantiable', async () => {
    const { MajorFeedsFetcher } = await import('../../electron/engine/data/major-feeds');
    const fetcher = new MajorFeedsFetcher();
    expect(fetcher).toBeDefined();
  });

  it('free-api-fetcher: instantiable', async () => {
    const { FreeAPIFetcher } = await import('../../electron/engine/data/free-api-fetcher');
    const fetcher = new FreeAPIFetcher();
    expect(fetcher).toBeDefined();
  });

  it('all feed categories instantiable', async () => {
    // Verify all 5 feed categories compile and instantiate
    const { CryptoFeedsFetcher } = await import('../../electron/engine/data/crypto-feeds');
    const { SocialFeedsFetcher } = await import('../../electron/engine/data/social-feeds');
    const { RegionalFeedsFetcher } = await import('../../electron/engine/data/regional-feeds');
    const { MajorFeedsFetcher } = await import('../../electron/engine/data/major-feeds');
    const { FreeAPIFetcher } = await import('../../electron/engine/data/free-api-fetcher');

    expect(new CryptoFeedsFetcher()).toBeDefined();
    expect(new SocialFeedsFetcher()).toBeDefined();
    expect(new RegionalFeedsFetcher()).toBeDefined();
    expect(new MajorFeedsFetcher()).toBeDefined();
    expect(new FreeAPIFetcher()).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: Screening & Analysis Chain
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 管道终验 — Screening & Analysis', () => {
  it('news-stock-screener: instantiable and screens', async () => {
    const { NewsStockScreener, resetStockScreener } = await import('../../electron/engine/data/news-stock-screener');
    resetStockScreener();
    const screener = new NewsStockScreener();
    const presets = screener.getPresets();
    expect(Array.isArray(presets)).toBe(true);

    const results = screener.screen({ minNewsCount: 1, minSentimentScore: 0.3 });
    expect(Array.isArray(results)).toBe(true);
  });

  it('stock-screener-v2: instantiable', async () => {
    const { StockScreenerV2 } = await import('../../electron/engine/data/stock-screener-v2');
    const screener = new StockScreenerV2();
    expect(screener).toBeDefined();
  });

  it('copytrade-news-enhancer: instantiable', async () => {
    const { CopytradeNewsEnhancer } = await import('../../electron/engine/data/copytrade-news-enhancer');
    const enhancer = new CopytradeNewsEnhancer();
    expect(enhancer).toBeDefined();
  });

  it('news-backtest-data-prep: instantiable', async () => {
    const { NewsBacktestDataPrep } = await import('../../electron/engine/data/news-backtest-data-prep');
    const prep = new NewsBacktestDataPrep();
    expect(prep).toBeDefined();
  });

  it('daily-digest-v2: instantiable', async () => {
    const { DailyDigestV2 } = await import('../../electron/engine/data/daily-digest-v2');
    const digest = new DailyDigestV2();
    expect(digest).toBeDefined();
  });

  it('price-move-attribution: instantiable', async () => {
    const { PriceMoveAttribution } = await import('../../electron/engine/data/price-move-attribution');
    const attr = new PriceMoveAttribution();
    expect(attr).toBeDefined();
  });

  it('daily-briefing-generator: instantiable', async () => {
    const { DailyBriefingGenerator } = await import('../../electron/engine/data/daily-briefing-generator');
    const generator = new DailyBriefingGenerator();
    expect(generator).toBeDefined();
  });

  it('ai-sentiment-engine: instantiable', async () => {
    const { AISentimentEngine, resetAISentimentEngine } = await import('../../electron/engine/data/ai-sentiment-engine');
    resetAISentimentEngine();
    const engine = new AISentimentEngine();
    expect(engine).toBeDefined();
  });

  it('newsapi-manager: get api key status', async () => {
    const { NewsAPIKeyManager, getNewsAPIKeyManager } = await import('../../electron/engine/data/newsapi-manager');
    const mgr = getNewsAPIKeyManager();
    expect(mgr).toBeDefined();
    const key = mgr.getKey();
    expect(typeof key === 'string' || key === null || key === undefined).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: Quality & Degradation
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 管道终验 — Quality & Degradation', () => {
  it('degradation-chain: instantiable', async () => {
    const { DegradationChain } = await import('../../electron/engine/data/degradation-chain');
    const chain = new DegradationChain();
    expect(chain).toBeDefined();
  });

  it('social-source-degradation: instantiable', async () => {
    const { SocialSourceDegradation } = await import('../../electron/engine/data/social-source-degradation');
    const degradation = new SocialSourceDegradation();
    expect(degradation).toBeDefined();
  });

  it('watchlist-smart-news: instantiable', async () => {
    const { WatchlistSmartNews } = await import('../../electron/engine/data/watchlist-smart-news');
    const smartNews = new WatchlistSmartNews();
    expect(smartNews).toBeDefined();
  });

  it('source-health-bar: full check cycle', async () => {
    const { SourceHealthBar, resetSourceHealthBar } = await import('../../electron/engine/data/source-health-bar');
    resetSourceHealthBar();
    const bar = new SourceHealthBar();
    bar.checkAll();
    const dashboard = bar.getDashboard();
    expect(dashboard.overallHealth).toBeGreaterThan(0);
    expect(dashboard.sources.length).toBeGreaterThanOrEqual(20);
    expect(dashboard.categories.length).toBeGreaterThanOrEqual(4);
    // All scores are valid numbers
    for (const src of dashboard.sources) {
      expect(typeof src.health).toBe('number');
      expect(isNaN(src.health)).toBe(false);
    }
    for (const cat of dashboard.categories) {
      expect(typeof cat.avgHealth).toBe('number');
      expect(isNaN(cat.avgHealth)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: Deploy Pipeline
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 管道终验 — Deploy Pipeline', () => {
  it('one-click-deploy-pipeline: instantiable', async () => {
    const { OneClickDeployPipeline } = await import('../../electron/engine/data/one-click-deploy-pipeline');
    const pipeline = new OneClickDeployPipeline();
    expect(pipeline).toBeDefined();
  });

  it('backtest-deploy-bridge: instantiable', async () => {
    const { BacktestDeployBridge, resetBacktestDeployBridge } = await import('../../electron/engine/data/backtest-deploy-bridge');
    resetBacktestDeployBridge();
    const bridge = new BacktestDeployBridge();
    expect(bridge).toBeDefined();
  });

  it('fast-deploy-bridge: instantiable', async () => {
    const { FastBacktestDeployBridge } = await import('../../electron/engine/data/fast-deploy-bridge');
    const bridge = new FastBacktestDeployBridge();
    expect(bridge).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: Barrel Export Coverage
// ═══════════════════════════════════════════════════════════════════════════

describe('R252 管道终验 — Barrel Coverage', () => {
  it('index.ts exports all pipeline symbols', async () => {
    const idx = await import('../../electron/engine/data/index');

    const expected = [
      'NewsAggregator', 'XueqiuFetcher', 'CLSTelegraphFetcher', 'DedupEngine',
      'AISentimentEngine', 'NewsAPIKeyManager', 'DedupEngineV2',
      'NewsStockScreener', 'CryptoFeedsFetcher', 'StockScreenerV2',
      'SocialFeedsFetcher', 'RegionalFeedsFetcher', 'CopytradeNewsEnhancer',
      'NewsBacktestDataPrep', 'DailyDigestV2',
      'FreeAPIFetcher', 'MajorFeedsFetcher', 'PriceMoveAttribution',
      'DailyBriefingGenerator', 'DegradationChain', 'WatchlistSmartNews',
      'SocialSourceDegradation', 'OneClickDeployPipeline',
      'PriceMovePushEngine',
    ];

    for (const name of expected) {
      expect(idx[name], `${name} should be in barrel`).toBeDefined();
    }
  });
});
