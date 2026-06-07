/**
 * JVS-95: NLP Sentiment Analysis Engine - Tests
 * NLP-based sentiment analysis for financial news and social media
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  NLPSentimentEngine,
  SentimentConfig,
  NewsArticle,
} from '../electron/engine/nlp-sentiment-engine';

describe('NLPSentimentEngine', () => {
  let engine: NLPSentimentEngine;

  beforeEach(() => {
    engine = new NLPSentimentEngine({
      model: 'finbert',
      language: 'zh',
      batchSize: 32,
    });
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const defaultEngine = new NLPSentimentEngine();
      const config = defaultEngine.getConfig();
      expect(config.model).toBe('finbert');
      expect(config.language).toBe('zh');
      expect(config.batchSize).toBe(32);
    });

    it('should initialize with custom config', () => {
      const config = engine.getConfig();
      expect(config.model).toBe('finbert');
      expect(config.language).toBe('zh');
      expect(config.batchSize).toBe(32);
    });

    it('should have zero articles processed initially', () => {
      const metrics = engine.getMetrics();
      expect(metrics.totalArticles).toBe(0);
      expect(metrics.avgSentiment).toBe(0);
    });
  });

  describe('Sentiment Analysis', () => {
    it('should analyze positive sentiment', () => {
      const article: NewsArticle = {
        id: 'news-1',
        title: '苹果公司发布超预期财报，股价大涨',
        content: '苹果公司今日发布第三季度财报，营收和利润均超出市场预期，股价盘后上涨5%。分析师认为公司业绩强劲，未来增长前景乐观。',
        source: 'Reuters',
        publishedAt: new Date().toISOString(),
        symbols: ['AAPL'],
      };

      const sentiment = engine.analyzeSentiment(article);

      expect(sentiment.score).toBeGreaterThan(0);
      expect(['positive', 'neutral']).toContain(sentiment.label);
      expect(sentiment.confidence).toBeGreaterThan(0);
    });

    it('should analyze negative sentiment', () => {
      const article: NewsArticle = {
        id: 'news-2',
        title: '特斯拉召回大量汽车，股价下跌',
        content: '特斯拉宣布召回数十万辆汽车，原因是存在安全隐患。消息公布后，股价盘前下跌3%。分析师下调目标价。',
        source: 'Bloomberg',
        publishedAt: new Date().toISOString(),
        symbols: ['TSLA'],
      };

      const sentiment = engine.analyzeSentiment(article);

      expect(sentiment.score).toBeLessThan(0);
      expect(['negative', 'neutral']).toContain(sentiment.label);
      expect(sentiment.confidence).toBeGreaterThan(0);
    });

    it('should analyze neutral sentiment', () => {
      const article: NewsArticle = {
        id: 'news-3',
        title: '美联储维持利率不变',
        content: '美联储今日宣布维持联邦基金利率不变，符合市场预期。声明表示将继续关注通胀和就业数据。',
        source: 'Reuters',
        publishedAt: new Date().toISOString(),
        symbols: [],
      };

      const sentiment = engine.analyzeSentiment(article);

      expect(Math.abs(sentiment.score)).toBeLessThan(0.3);
      expect(sentiment.label).toBe('neutral');
    });

    it('should extract entities', () => {
      const article: NewsArticle = {
        id: 'news-4',
        title: '苹果和微软合作开发新技术',
        content: '苹果公司和微软公司宣布战略合作，共同开发人工智能技术。',
        source: 'Reuters',
        publishedAt: new Date().toISOString(),
        symbols: ['AAPL', 'MSFT'],
      };

      const sentiment = engine.analyzeSentiment(article);

      expect(sentiment.entities.length).toBeGreaterThan(0);
      expect(sentiment.entities).toContain('AAPL');
      expect(sentiment.entities).toContain('MSFT');
    });
  });

  describe('Batch Analysis', () => {
    it('should analyze multiple articles', () => {
      const articles: NewsArticle[] = [
        {
          id: 'news-1',
          title: '苹果公司发布超预期财报',
          content: '苹果公司业绩强劲，股价上涨。',
          source: 'Reuters',
          publishedAt: new Date().toISOString(),
          symbols: ['AAPL'],
        },
        {
          id: 'news-2',
          title: '特斯拉召回汽车',
          content: '特斯拉宣布召回，股价下跌。',
          source: 'Bloomberg',
          publishedAt: new Date().toISOString(),
          symbols: ['TSLA'],
        },
        {
          id: 'news-3',
          title: '美联储维持利率',
          content: '美联储维持利率不变。',
          source: 'Reuters',
          publishedAt: new Date().toISOString(),
          symbols: [],
        },
      ];

      const results = engine.analyzeBatch(articles);

      expect(results.length).toBe(3);
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('label');
    });

    it('should handle empty batch', () => {
      const results = engine.analyzeBatch([]);
      expect(results.length).toBe(0);
    });
  });

  describe('Sentiment Aggregation', () => {
    it('should aggregate sentiment for symbol', () => {
      const articles: NewsArticle[] = [
        {
          id: 'news-1',
          title: '苹果公司业绩强劲',
          content: '苹果公司发布超预期财报，股价上涨。',
          source: 'Reuters',
          publishedAt: new Date().toISOString(),
          symbols: ['AAPL'],
        },
        {
          id: 'news-2',
          title: '苹果推出新产品',
          content: '苹果公司推出新产品，市场反应积极。',
          source: 'Bloomberg',
          publishedAt: new Date().toISOString(),
          symbols: ['AAPL'],
        },
      ];

      articles.forEach(article => engine.analyzeSentiment(article));

      const aggregated = engine.aggregateSentiment('AAPL');

      expect(aggregated).toHaveProperty('avgSentiment');
      expect(aggregated).toHaveProperty('articleCount');
      expect(aggregated.articleCount).toBe(2);
    });

    it('should handle symbol with no articles', () => {
      const aggregated = engine.aggregateSentiment('NONEXISTENT');

      expect(aggregated.articleCount).toBe(0);
      expect(aggregated.avgSentiment).toBe(0);
    });
  });

  describe('Metrics', () => {
    it('should return metrics', () => {
      const metrics = engine.getMetrics();
      expect(metrics).toHaveProperty('totalArticles');
      expect(metrics).toHaveProperty('avgSentiment');
      expect(metrics).toHaveProperty('positiveCount');
      expect(metrics).toHaveProperty('negativeCount');
      expect(metrics).toHaveProperty('neutralCount');
    });

    it('should track processed articles', () => {
      const articles: NewsArticle[] = [
        {
          id: 'news-1',
          title: '苹果公司业绩强劲',
          content: '苹果公司发布超预期财报。',
          source: 'Reuters',
          publishedAt: new Date().toISOString(),
          symbols: ['AAPL'],
        },
        {
          id: 'news-2',
          title: '特斯拉召回汽车',
          content: '特斯拉宣布召回。',
          source: 'Bloomberg',
          publishedAt: new Date().toISOString(),
          symbols: ['TSLA'],
        },
      ];

      articles.forEach(article => engine.analyzeSentiment(article));

      const metrics = engine.getMetrics();
      expect(metrics.totalArticles).toBe(2);
    });

    it('should calculate average sentiment', () => {
      const articles: NewsArticle[] = [
        {
          id: 'news-1',
          title: '苹果公司业绩强劲',
          content: '苹果公司发布超预期财报，股价上涨。',
          source: 'Reuters',
          publishedAt: new Date().toISOString(),
          symbols: ['AAPL'],
        },
        {
          id: 'news-2',
          title: '特斯拉召回汽车',
          content: '特斯拉宣布召回，股价下跌。',
          source: 'Bloomberg',
          publishedAt: new Date().toISOString(),
          symbols: ['TSLA'],
        },
      ];

      articles.forEach(article => engine.analyzeSentiment(article));

      const metrics = engine.getMetrics();
      expect(metrics.avgSentiment).toBeDefined();
    });
  });

  describe('Reset', () => {
    it('should reset engine state', () => {
      const article: NewsArticle = {
        id: 'news-1',
        title: '苹果公司业绩强劲',
        content: '苹果公司发布超预期财报。',
        source: 'Reuters',
        publishedAt: new Date().toISOString(),
        symbols: ['AAPL'],
      };

      engine.analyzeSentiment(article);

      engine.reset();

      const metrics = engine.getMetrics();
      expect(metrics.totalArticles).toBe(0);
      expect(metrics.avgSentiment).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should get config', () => {
      const config = engine.getConfig();
      expect(config).toBeDefined();
      expect(config.model).toBe('finbert');
      expect(config.language).toBe('zh');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty article', () => {
      const article: NewsArticle = {
        id: 'news-1',
        title: '',
        content: '',
        source: 'Reuters',
        publishedAt: new Date().toISOString(),
        symbols: [],
      };

      const sentiment = engine.analyzeSentiment(article);

      expect(sentiment.score).toBe(0);
      expect(sentiment.label).toBe('neutral');
    });

    it('should handle very long article', () => {
      const longContent = '这是一篇非常长的文章。'.repeat(1000);

      const article: NewsArticle = {
        id: 'news-1',
        title: '长文章测试',
        content: longContent,
        source: 'Reuters',
        publishedAt: new Date().toISOString(),
        symbols: ['AAPL'],
      };

      const sentiment = engine.analyzeSentiment(article);

      expect(sentiment).toBeDefined();
      expect(sentiment.score).toBeDefined();
    });

    it('should handle special characters', () => {
      const article: NewsArticle = {
        id: 'news-1',
        title: '特殊字符测试！@#$%^&*()',
        content: '这是一篇包含特殊字符的文章！@#$%^&*()',
        source: 'Reuters',
        publishedAt: new Date().toISOString(),
        symbols: [],
      };

      const sentiment = engine.analyzeSentiment(article);

      expect(sentiment).toBeDefined();
      expect(sentiment.score).toBeDefined();
    });

    it('should handle mixed language', () => {
      const article: NewsArticle = {
        id: 'news-1',
        title: 'Apple苹果发布新产品',
        content: 'Apple苹果公司今日发布新产品，市场反应积极。',
        source: 'Reuters',
        publishedAt: new Date().toISOString(),
        symbols: ['AAPL'],
      };

      const sentiment = engine.analyzeSentiment(article);

      expect(sentiment).toBeDefined();
      expect(sentiment.score).toBeDefined();
    });
  });
});
