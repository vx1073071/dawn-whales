/**
 * R238: News Data Module — Barrel Export
 */

export { XueqiuFetcher, getXueqiuFetcher } from './xueqiu-fetcher';
export { DedupEngine, getDedupEngine, resetDedupEngine } from './dedup-engine';
export { CLSTelegraphFetcher, getCLSTelegraphFetcher } from './cls-telegraph-fetcher';
export type {
  NewsSource,
  NewsCategory,
  ImpactLevel,
  SentimentResult,
  NewsItem,
  DedupResult,
  NewsFetcher,
} from './news-types';
