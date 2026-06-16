/**
 * R238 News Data Types — 消息智能平台共享类型
 * v2.7.0 NEWS INTELLIGENCE
 */

/** 消息来源枚举 */
export type NewsSource =
  | 'eastmoney'
  | 'sina'
  | 'xueqiu'
  | 'cls_telegraph'
  | 'alphavantage_ns'
  | 'newsapi'
  | 'polygon'
  | 'reddit'
  | 'twitter'
  | 'stocktwits'
  | 'wechat_public'
  | 'reuters'
  | 'cnbc'
  | 'yahoo_finance'
  | 'marketwatch'
  | 'coindesk'
  | 'cointelegraph'
  | 'decrypt'
  | 'theblock'
  | 'cryptofeedr';

/** 消息分类 */
export type NewsCategory =
  | 'earnings'       // 财报
  | 'policy'         // 政策
  | 'industry'       // 行业
  | 'company'        // 公司
  | 'macro'          // 宏观
  | 'technical'      // 技术面
  | 'social'         // 社交情绪
  | 'breaking';      // 突发

/** 消息影响等级 */
export type ImpactLevel = 'P0' | 'P1' | 'P2' | 'P3';

/** 情绪极性 */
export interface SentimentResult {
  score: number;           // -1.0 ~ +1.0
  confidence: number;      // 0.0 ~ 1.0
  tickers: string[];       // 关联股票代码
  keywords: string[];      // 关键词 (最多5个)
  category: NewsCategory;
  impact: number;          // 1-10
  reasoning: string;       // 分析理由
  provider: 'deepseek' | 'keyword' | 'none';
}

/** 标准化新闻条目 */
export interface NewsItem {
  id: string;
  title: string;
  body: string;
  summary?: string;
  url?: string;
  source: NewsSource;
  publishedAt: number;      // unix ms
  fetchedAt: number;        // unix ms
  language: 'zh' | 'en';
  tickers: string[];
  sentiment?: SentimentResult;
  category?: NewsCategory;
  impact?: ImpactLevel;
  metadata?: Record<string, unknown>;
  /** 指纹: 用于去重 */
  fingerprint?: string;
}

/** 去重结果 */
export interface DedupResult {
  item: NewsItem;
  isDuplicate: boolean;
  duplicateOf?: string;     // 匹配到的已存在条目ID
  similarity?: number;      // 相似度 (0-1)
  matchType?: 'title' | 'url' | 'content' | 'fingerprint';
}

/** Fetcher 基类接口 */
export interface NewsFetcher {
  readonly source: NewsSource;
  fetch(symbols?: string[], since?: number): Promise<NewsItem[]>;
  isAvailable(): Promise<boolean>;
  getHealth(): Promise<{ status: 'ok' | 'degraded' | 'down'; latencyMs: number; lastFetch?: number }>;
}
