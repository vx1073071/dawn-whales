/**
 * R241-auto#3: 新闻选股器 v2 (News Stock Screener V2)
 *
 * 跨市场+加密+商品条件筛选。继承 v1 基础, 新增:
 *
 * v2 新增维度:
 *   1. 跨市场联动: 同板块中美联动 (e.g. NVDA↑ ↔ 寒武纪↑)
 *   2. 加密关联: BTC波动 → 关联挖矿股/交易所 (e.g. BTC↓ → COIN/RIOT↓)
 *   3. 商品传导: 原油↑ → 能源股↑/航空↓ (e.g. WTI↑ → XOM↑/DAL↓)
 *   4. 时区轮动: 亚盘→欧盘→美盘情绪接力
 *   5. 社交共振: Reddit WSB + StockTwits 同时看多 → 信号放大
 *   6. 组合筛选: 不同市场板块的资产轮动
 *
 * 预设策略:
 *   - 跨市场联动: 在A/H股中找到美股爆发的映射标的
 *   - 加密传导: BTC暴涨 → 筛选矿股+交易所
 *   - 商品轮动: 油价突破 → 能源股+新能源
 *   - 社交共振: WSB热议+StockTwits看多 → 散户信号
 *   - 时区接力: 亚盘→欧盘→美盘情绪持续改善
 */

import type { NewsItem, SentimentResult } from './news-types';
import { NewsStockScreener, type ScreenerPreset, type ScreenerCondition, type ScreenerResult, type SentimentSnapshot } from './news-stock-screener';

// ═══════════════════════════════════════════════════════════════════════
// Cross-Market Mappings
// ═══════════════════════════════════════════════════════════════════════

// US → China/HK ticker mapping
const US_TO_CN: Record<string, string[]> = {
  'NVDA':  ['688256.SS'],             // 寒武纪 (AI芯片)
  'AMD':   ['688041.SS'],             // 海光信息
  'TSLA':  ['002594.SZ'],             // 比亚迪
  'AAPL':  ['002475.SZ'],             // 立讯精密 (果链)
  'MSFT':  ['300624.SZ'],             // 万兴科技
  'AMZN':  ['002352.SZ'],             // 顺丰控股 (物流)
  'GOOGL': ['300624.SZ'],             // 泛互联网
  'NFLX':  ['300413.SZ'],             // 芒果超媒
  'JPM':   ['600036.SS'],             // 招商银行
  'XOM':   ['601857.SS'],             // 中国石油
  'NKE':   ['603899.SS'],             // 晨光文具
  'SBUX':  ['603345.SS'],             // 安井食品 (消费)
  'INTC':  ['688981.SS'],             // 中芯国际
  'DIS':   ['300251.SZ'],             // 光线传媒
};

// Crypto → Stock ticker mapping
const CRYPTO_TO_STOCK: Record<string, string[]> = {
  'BTC':   ['COIN', 'MSTR', 'RIOT', 'MARA', 'CLSK', 'HUT', 'BITF', 'BTBT', 'IREN', 'WULF'],
  'ETH':   ['COIN', 'MSTR'],
  'SOL':   ['SOL-USD'],
  'DOGE':  ['HOOD'],
};

// Commodity → Stock ticker mapping
const COMMODITY_TO_STOCK: Record<string, string[]> = {
  'WTI':    ['XOM', 'CVX', 'COP', 'EOG', 'PXD', 'OXY', 'DVN'],
  'BRENT':  ['BP', 'SHEL', 'TTE'],
  'GOLD':   ['GLD', 'GDX', 'NEM', 'GOLD', 'AEM', 'FNV'],
  'SILVER': ['SLV', 'HL', 'PAAS', 'WPM'],
  'COPPER': ['FCX', 'SCCO', 'TECK'],
  'NG':     ['UNG', 'RRC', 'EQT', 'CTRA'],
  'CORN':   ['CORN', 'ADM', 'BG'],
  'SOY':    ['SOYB'],
};

// Market indices for cross-market comparison
interface MarketIndex {
  ticker: string;
  name: string;
  timezone: 'asia' | 'europe' | 'americas';
  offsetHours: number;
}

const MARKET_INDICES: MarketIndex[] = [
  { ticker: '000001.SS', name: 'Shanghai Composite', timezone: 'asia', offsetHours: 8 },
  { ticker: 'HSI', name: 'Hang Seng', timezone: 'asia', offsetHours: 8 },
  { ticker: 'N225', name: 'Nikkei 225', timezone: 'asia', offsetHours: 9 },
  { ticker: 'FTSE', name: 'FTSE 100', timezone: 'europe', offsetHours: 0 },
  { ticker: 'DAX', name: 'DAX 40', timezone: 'europe', offsetHours: 1 },
  { ticker: 'CAC', name: 'CAC 40', timezone: 'europe', offsetHours: 1 },
  { ticker: 'SPX', name: 'S&P 500', timezone: 'americas', offsetHours: -5 },
  { ticker: 'DJI', name: 'Dow Jones', timezone: 'americas', offsetHours: -5 },
  { ticker: 'IXIC', name: 'NASDAQ', timezone: 'americas', offsetHours: -5 },
];

// ═══════════════════════════════════════════════════════════════════════
// V2 Presets
// ═══════════════════════════════════════════════════════════════════════

const V2_PRESETS: ScreenerPreset[] = [
  {
    name: '跨市场联动',
    description: '美股热点股票找到A/H股映射标的，情绪改善',
    conditions: [
      { type: 'sentiment_improving', params: { days: 3, min_change: 0.25 } },
    ],
    logic: 'AND',
  },
  {
    name: '加密传导',
    description: 'BTC/ETH大幅波动 → 筛选受影响矿股/交易所，高关注度',
    conditions: [
      { type: 'news_surge', params: { days: 3, multiplier: 2.0 } },
      { type: 'sentiment_strength', params: { days: 3, min_score: 0.25 } },
    ],
    logic: 'AND',
  },
  {
    name: '商品轮动',
    description: '大宗商品价格异动 → 能源股/矿业股/农业股联动机会',
    conditions: [
      { type: 'sentiment_reversal', params: { days: 2, from_threshold: -0.05, to_threshold: 0.15 } },
      { type: 'news_surge', params: { days: 3, multiplier: 1.5 } },
    ],
    logic: 'AND',
  },
  {
    name: '社交共振',
    description: 'Reddit WSB + StockTwits 同时看多 → 散户情绪放大器',
    conditions: [
      { type: 'sentiment_strength', params: { days: 3, min_score: 0.3 } },
      { type: 'news_surge', params: { days: 3, multiplier: 2.5 } },
    ],
    logic: 'AND',
  },
  {
    name: '时区接力',
    description: '亚盘→欧盘→美盘情绪持续改善，全球风险偏好上升',
    conditions: [
      { type: 'sentiment_improving', params: { days: 3, min_change: 0.15 } },
      { type: 'multi_factor', params: { days: 3, threshold: 0.5 } },
    ],
    logic: 'AND',
  },
];

// ═══════════════════════════════════════════════════════════════════════
// StockScreenerV2
// ═══════════════════════════════════════════════════════════════════════

export interface V2ScreenerResult extends ScreenerResult {
  crossMarket: {
    usLeaders: string[];        // 映射的美股龙头
    cnEquivalents: string[];    // 映射的A/H股
    correlation: number;        // 联动强度 0-1
  } | null;
  cryptoExposure: {
    cryptoAsset: string;        // 关联的加密资产
    direction: 'positive' | 'negative';
    sensitivity: number;        // 敏感度 0-1
  } | null;
  commodityExposure: {
    commodity: string;          // 关联的商品
    direction: 'positive' | 'negative';
    sensitivity: number;
  } | null;
  socialResonance: {
    wsbMentions: number;
    stocktwitsSentiment: number;
    combinedSignal: number;     // -1 to +1
  } | null;
  timezoneMomentum: {
    asia: number;
    europe: number;
    americas: number;
    gradient: 'accelerating' | 'steady' | 'decelerating';
  } | null;
}

export class StockScreenerV2 extends NewsStockScreener {
  private crossMarketCache = new Map<string, V2ScreenerResult['crossMarket']>();
  private cryptoExposureCache = new Map<string, V2ScreenerResult['cryptoExposure']>();
  private commodityExposureCache = new Map<string, V2ScreenerResult['commodityExposure']>();
  private socialResonanceCache = new Map<string, V2ScreenerResult['socialResonance']>();

  // Social signal data (fed from SocialFeedsFetcher)
  private wsbData = new Map<string, { mentions: number; avgSentiment: number }>();
  private stocktwitsData = new Map<string, { mentions: number; avgSentiment: number }>();

  constructor() {
    super({ maxResults: 30, minNewsToEvaluate: 2, lookbackDays: 30 });

    // Add V2 presets
    for (const preset of V2_PRESETS) {
      this.addPreset(preset);
    }
  }

  // ── Input social data ──────────────────────────────────────────

  ingestSocial(redditItems: NewsItem[], stocktwitsItems: NewsItem[]): void {
    // WSB data
    const wsbMap = new Map<string, { scores: number[]; count: number }>();
    for (const item of redditItems) {
      if (!item.metadata) continue;
      const subreddit = (item.metadata as any).subreddit;
      if (subreddit !== 'wallstreetbets') continue;
      for (const ticker of item.tickers || []) {
        if (!wsbMap.has(ticker)) wsbMap.set(ticker, { scores: [], count: 0 });
        const entry = wsbMap.get(ticker)!;
        entry.scores.push(item.sentiment?.score || 0);
        entry.count++;
      }
    }
    for (const [ticker, entry] of wsbMap) {
      this.wsbData.set(ticker, {
        mentions: entry.count,
        avgSentiment: entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length,
      });
    }

    // StockTwits data
    const stMap = new Map<string, { scores: number[]; count: number }>();
    for (const item of stocktwitsItems) {
      for (const ticker of item.tickers || []) {
        if (!stMap.has(ticker)) stMap.set(ticker, { scores: [], count: 0 });
        const entry = stMap.get(ticker)!;
        entry.scores.push(item.sentiment?.score || 0);
        entry.count++;
      }
    }
    for (const [ticker, entry] of stMap) {
      this.stocktwitsData.set(ticker, {
        mentions: entry.count,
        avgSentiment: entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length,
      });
    }
  }

  // ── V2 Screening ───────────────────────────────────────────────

  /**
   * 跨市场联动: 找到在美股火爆且在A/H股有映射的标的
   */
  screenCrossMarket(usLeaders: string[]): V2ScreenerResult[] {
    const results: V2ScreenerResult[] = [];

    for (const usTicker of usLeaders) {
      const cnEquivalents = US_TO_CN[usTicker];
      if (!cnEquivalents) continue;

      const usSignals = this.getSignals(usTicker);
      if (!usSignals || usSignals.sentimentTrend !== 'improving') continue;

      for (const cnTicker of cnEquivalents) {
        const cnSignals = this.getSignals(cnTicker);
        if (!cnSignals) continue;

        // Check if CN ticker's sentiment is also improving
        const correlation = cnSignals.sentimentTrend === 'improving' ? 0.8 : 0.3;

        const baseResult = this.screen('跨市场联动').find(r => r.ticker === cnTicker);
        const score = baseResult?.score || cnSignals.sentimentAvg * 40 + 30;

        results.push({
          ticker: cnTicker,
          score: Math.round(score),
          confidence: correlation,
          matchedConditions: baseResult?.matchedConditions || ['sentiment_improving'],
          signals: cnSignals,
          suggestion: correlation >= 0.8 ? 'BUY' : 'WATCH',
          recentNews: baseResult?.recentNews || [],
          crossMarket: {
            usLeaders: [usTicker],
            cnEquivalents,
            correlation,
          },
          cryptoExposure: null,
          commodityExposure: null,
          socialResonance: null,
          timezoneMomentum: null,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 加密传导: 找到受加密波动影响的股票
   */
  screenCryptoImpact(cryptoAsset: string = 'BTC'): V2ScreenerResult[] {
    const stocks = CRYPTO_TO_STOCK[cryptoAsset];
    if (!stocks) return [];

    const cryptoSignals = this.getSignals(cryptoAsset);
    const isBullish = cryptoSignals ? cryptoSignals.sentimentAvg > 0 : false;
    const cryptoVolatility = Math.abs(cryptoSignals?.sentimentAvg || 0);

    const results: V2ScreenerResult[] = [];

    for (const stock of stocks) {
      const signals = this.getSignals(stock);
      if (!signals) continue;

      const sensitivity = cryptoVolatility > 0.3 ? 0.9
        : cryptoVolatility > 0.1 ? 0.6
        : 0.3;

      const baseResult = this.screen('加密传导').find(r => r.ticker === stock);
      const score = (baseResult?.score || 40) + cryptoVolatility * 20;

      results.push({
        ticker: stock,
        score: Math.round(Math.min(100, score)),
        confidence: sensitivity * 0.8,
        matchedConditions: baseResult?.matchedConditions || ['news_surge'],
        signals,
        suggestion: isBullish && signals.sentimentTrend === 'improving' ? 'BUY'
          : isBullish ? 'WATCH'
          : signals.sentimentTrend === 'declining' ? 'CAUTION'
          : 'HOLD',
        recentNews: baseResult?.recentNews || [],
        crossMarket: null,
        cryptoExposure: {
          cryptoAsset,
          direction: isBullish ? 'positive' : 'negative',
          sensitivity,
        },
        commodityExposure: null,
        socialResonance: null,
        timezoneMomentum: null,
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 商品轮动: 找到受大宗商品价格影响的股票
   */
  screenCommodityRotation(commodity: string = 'WTI'): V2ScreenerResult[] {
    const stocks = COMMODITY_TO_STOCK[commodity];
    if (!stocks) return [];

    const commoSignals = this.getSignals(commodity);
    const isRising = commoSignals ? commoSignals.sentimentAvg > 0 : false;
    const commoStrength = Math.abs(commoSignals?.sentimentAvg || 0);

    const results: V2ScreenerResult[] = [];

    for (const stock of stocks) {
      const signals = this.getSignals(stock);
      if (!signals) continue;

      const sameDirection = isRising === signals.sentimentAvg > 0;
      const sensitivity = sameDirection ? 0.8 : 0.2;

      const baseResult = this.screen('商品轮动').find(r => r.ticker === stock);
      const score = (baseResult?.score || 35) + (sameDirection ? 20 : -10);

      results.push({
        ticker: stock,
        score: Math.round(Math.max(10, Math.min(100, score))),
        confidence: sensitivity * commoStrength,
        matchedConditions: baseResult?.matchedConditions || ['sentiment_reversal'],
        signals,
        suggestion: sameDirection && signals.sentimentTrend === 'improving' ? 'STRONG_BUY'
          : sameDirection ? 'BUY'
          : 'CAUTION',
        recentNews: baseResult?.recentNews || [],
        crossMarket: null,
        cryptoExposure: null,
        commodityExposure: {
          commodity,
          direction: sameDirection ? 'positive' : 'negative',
          sensitivity,
        },
        socialResonance: null,
        timezoneMomentum: null,
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 社交共振: WSB+StockTwits双重信号
   */
  screenSocialResonance(): V2ScreenerResult[] {
    const results: V2ScreenerResult[] = [];
    const allTickers = new Set([...this.wsbData.keys(), ...this.stocktwitsData.keys()]);

    for (const ticker of allTickers) {
      const wsb = this.wsbData.get(ticker);
      const st = this.stocktwitsData.get(ticker);
      if (!wsb || !st) continue;

      const combinedSignal = (wsb.avgSentiment * 0.6 + st.avgSentiment * 0.4);
      const bothBullish = wsb.avgSentiment > 0.1 && st.avgSentiment > 0.1;

      if (!bothBullish) continue;

      const signals = this.getSignals(ticker);
      if (!signals) continue;

      const baseResult = this.screen('社交共振').find(r => r.ticker === ticker);
      const score = (baseResult?.score || 30) + combinedSignal * 30 + Math.min(20, Math.log(wsb.mentions + 1) * 5);

      results.push({
        ticker,
        score: Math.round(Math.min(100, score)),
        confidence: Math.min(0.9, (wsb.mentions + st.mentions) / 20),
        matchedConditions: ['sentiment_strength', 'news_surge'],
        signals,
        suggestion: combinedSignal > 0.3 ? 'STRONG_BUY' : 'BUY',
        recentNews: [],
        crossMarket: null,
        cryptoExposure: null,
        commodityExposure: null,
        socialResonance: {
          wsbMentions: wsb.mentions,
          stocktwitsSentiment: st.avgSentiment,
          combinedSignal: Math.round(combinedSignal * 1000) / 1000,
        },
        timezoneMomentum: null,
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 时区接力: 亚盘→欧盘→美盘情绪持续改善
   */
  screenTimezoneMomentum(): V2ScreenerResult[] {
    const results: V2ScreenerResult[] = [];

    // Calculate sentiment per timezone
    const byTz: Record<string, { scores: number[] }> = { asia: { scores: [] }, europe: { scores: [] }, americas: { scores: [] } };

    for (const index of MARKET_INDICES) {
      const sig = this.getSignals(index.ticker);
      if (sig) {
        byTz[index.timezone].scores.push(sig.sentimentAvg);
      }
    }

    const asiaAvg = this.avg(byTz.asia.scores);
    const europeAvg = this.avg(byTz.europe.scores);
    const americasAvg = this.avg(byTz.americas.scores);

    const gradient = asiaAvg < europeAvg && europeAvg < americasAvg ? 'accelerating'
      : asiaAvg > europeAvg && europeAvg > americasAvg ? 'decelerating'
      : 'steady';

    if (gradient === 'accelerating') {
      // Find tickers with improving sentiment across the chain
      for (const index of MARKET_INDICES) {
        const sig = this.getSignals(index.ticker);
        if (!sig || sig.sentimentTrend !== 'improving') continue;

        results.push({
          ticker: index.ticker,
          score: Math.round(sig.sentimentAvg * 50 + 50),
          confidence: 0.6,
          matchedConditions: ['sentiment_improving'],
          signals: sig,
          suggestion: 'BUY',
          recentNews: [],
          crossMarket: null,
          cryptoExposure: null,
          commodityExposure: null,
          socialResonance: null,
          timezoneMomentum: {
            asia: asiaAvg,
            europe: europeAvg,
            americas: americasAvg,
            gradient,
          },
        });
      }
    }

    return results;
  }

  /**
   * 全维度综合筛选
   */
  screenAllDimensions(): {
    crossMarket: V2ScreenerResult[];
    crypto: V2ScreenerResult[];
    commodity: V2ScreenerResult[];
    social: V2ScreenerResult[];
    timezone: V2ScreenerResult[];
  } {
    const usLeaders = Object.keys(US_TO_CN);
    return {
      crossMarket: this.screenCrossMarket(usLeaders),
      crypto: this.screenCryptoImpact('BTC'),
      commodity: this.screenCommodityRotation('WTI'),
      social: this.screenSocialResonance(),
      timezone: this.screenTimezoneMomentum(),
    };
  }

  /**
   * 综合排名 (所有维度)
   */
  screenComposite(): V2ScreenerResult[] {
    const all = this.screenAllDimensions();
    const merged = new Map<string, V2ScreenerResult>();

    const push = (results: V2ScreenerResult[]) => {
      for (const r of results) {
        const existing = merged.get(r.ticker);
        if (!existing || r.score > existing.score) {
          merged.set(r.ticker, r);
        }
      }
    };

    push(all.crossMarket);
    push(all.crypto);
    push(all.commodity);
    push(all.social);
    push(all.timezone);

    return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 30);
  }

  // ── Helpers ────────────────────────────────────────────────────

  private avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: StockScreenerV2 | null = null;
export function getStockScreenerV2(): StockScreenerV2 {
  if (!instance) instance = new StockScreenerV2();
  return instance;
}

export function resetStockScreenerV2(): void {
  instance = null;
}
