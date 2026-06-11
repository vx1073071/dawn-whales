// JVS-46-01: 策略市场搜索/评分引擎测试

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  StrategyMarketplaceSearch,
  StrategyMetric,
  SearchQuery
} from '../electron/engine/analysis/strategy-marketplace-search';

describe('StrategyMarketplaceSearch', () => {
  let search: StrategyMarketplaceSearch;

  beforeEach(() => {
    search = new StrategyMarketplaceSearch();
  });

  describe('addStrategy', () => {
    it('should add a new strategy', () => {
      const metric: StrategyMetric = {
        strategyId: 's1',
        name: 'Test Strategy',
        author: 'author1',
        tags: ['momentum', 'trend'],
        returns: 25.5,
        risk: 15.2,
        sharpe: 1.8,
        winRate: 65,
        trades: 120,
        subscribers: 150,
        rating: 4.5,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      search.addStrategy(metric);
      expect(search.getStrategy('s1')).toEqual(metric);
    });

    it('should update existing strategy', () => {
      const metric1: StrategyMetric = {
        strategyId: 's1',
        name: 'Test',
        author: 'a',
        tags: [],
        returns: 10,
        risk: 10,
        sharpe: 1.0,
        winRate: 50,
        trades: 100,
        subscribers: 100,
        rating: 4.0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      search.addStrategy(metric1);
      
      const updated = { ...metric1, returns: 20, rating: 4.5 };
      search.addStrategy(updated);
      
      expect(search.getStrategy('s1')?.returns).toBe(20);
      expect(search.getStrategy('s1')?.rating).toBe(4.5);
    });

    it('should emit strategy:added event', () => {
      const metric: StrategyMetric = {
        strategyId: 's1',
        name: 'Test',
        author: 'a',
        tags: [],
        returns: 10,
        risk: 10,
        sharpe: 1.0,
        winRate: 50,
        trades: 100,
        subscribers: 100,
        rating: 4.0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      let emitted = false;
      search.on('strategy:added', () => { emitted = true; });
      
      search.addStrategy(metric);
      expect(emitted).toBe(true);
    });
  });

  describe('addStrategies', () => {
    it('should add multiple strategies', () => {
      const metrics = [
        {
          strategyId: 's1',
          name: 'S1',
          author: 'a',
          tags: [],
          returns: 10,
          risk: 10,
          sharpe: 1.0,
          winRate: 50,
          trades: 100,
          subscribers: 100,
          rating: 4.0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          strategyId: 's2',
          name: 'S2',
          author: 'b',
          tags: [],
          returns: 20,
          risk: 15,
          sharpe: 1.5,
          winRate: 60,
          trades: 150,
          subscribers: 200,
          rating: 4.5,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      search.addStrategies(metrics);
      expect(search.size).toBe(2);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      // 添加测试数据
      const strategies = [
        {
          strategyId: 's1',
          name: 'Momentum Alpha',
          author: 'trader1',
          tags: ['momentum', 'high-return'],
          returns: 35,
          risk: 20,
          sharpe: 2.0,
          winRate: 65,
          trades: 200,
          subscribers: 500,
          rating: 4.8,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          strategyId: 's2',
          name: 'Conservative Growth',
          author: 'trader2',
          tags: ['conservative', 'low-risk'],
          returns: 15,
          risk: 8,
          sharpe: 1.5,
          winRate: 70,
          trades: 150,
          subscribers: 300,
          rating: 4.5,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          strategyId: 's3',
          name: 'Value Strategy',
          author: 'trader3',
          tags: ['value', 'long-term'],
          returns: 25,
          risk: 12,
          sharpe: 1.8,
          winRate: 60,
          trades: 100,
          subscribers: 250,
          rating: 4.2,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      search.addStrategies(strategies);
    });

    it('should search by keyword', () => {
      const result = search.search({ keyword: 'momentum' });
      expect(result.strategies.length).toBe(1);
      expect(result.strategies[0].name).toBe('Momentum Alpha');
    });

    it('should search by author', () => {
      const result = search.search({ keyword: 'trader1' });
      expect(result.strategies.length).toBe(1);
      expect(result.strategies[0].author).toBe('trader1');
    });

    it('should filter by minReturn', () => {
      const result = search.search({ minReturn: 20 });
      expect(result.strategies.length).toBe(2);
      expect(result.strategies.every(s => s.returns >= 20)).toBe(true);
    });

    it('should filter by maxRisk', () => {
      const result = search.search({ maxRisk: 15 });
      expect(result.strategies.length).toBe(2);
      expect(result.strategies.every(s => s.risk <= 15)).toBe(true);
    });

    it('should filter by minSharpe', () => {
      const result = search.search({ minSharpe: 1.6 });
      expect(result.strategies.length).toBe(2);
      expect(result.strategies.every(s => s.sharpe >= 1.6)).toBe(true);
    });

    it('should filter by minWinRate', () => {
      const result = search.search({ minWinRate: 65 });
      expect(result.strategies.length).toBe(2);
      expect(result.strategies.every(s => s.winRate >= 65)).toBe(true);
    });

    it('should filter by minRating', () => {
      const result = search.search({ minRating: 4.5 });
      expect(result.strategies.length).toBe(2);
      expect(result.strategies.every(s => s.rating >= 4.5)).toBe(true);
    });

    it('should filter by tags', () => {
      const result = search.search({ tags: ['conservative'] });
      expect(result.strategies.length).toBe(1);
      expect(result.strategies[0].name).toBe('Conservative Growth');
    });

    it('should sort by sharpe desc by default', () => {
      const result = search.search({});
      expect(result.strategies[0].sharpe).toBeGreaterThanOrEqual(result.strategies[1].sharpe);
    });

    it('should sort by returns desc', () => {
      const result = search.search({ sortBy: 'returns', sortOrder: 'desc' });
      expect(result.strategies[0].returns).toBeGreaterThanOrEqual(result.strategies[1].returns);
    });

    it('should sort by risk asc', () => {
      const result = search.search({ sortBy: 'risk', sortOrder: 'asc' });
      expect(result.strategies[0].risk).toBeLessThanOrEqual(result.strategies[1].risk);
    });

    it('should support pagination', () => {
      const result = search.search({ page: 1, pageSize: 2 });
      expect(result.strategies.length).toBe(2);
      expect(result.total).toBe(3);
      expect(result.totalPages).toBe(2);
    });

    it('should return empty array for out of range page', () => {
      const result = search.search({ page: 10, pageSize: 10 });
      expect(result.strategies.length).toBe(0);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('calculateScore', () => {
    it('should calculate comprehensive score', () => {
      const metric: StrategyMetric = {
        strategyId: 's1',
        name: 'Test',
        author: 'a',
        tags: [],
        returns: 25,
        risk: 15,
        sharpe: 1.8,
        winRate: 65,
        trades: 100,
        subscribers: 200,
        rating: 4.5,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const score = search.calculateScore(metric);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should rank high-performing strategies higher', () => {
      const highPerf: StrategyMetric = {
        strategyId: 'high',
        name: 'High',
        author: 'a',
        tags: [],
        returns: 30,
        risk: 10,
        sharpe: 2.0,
        winRate: 70,
        trades: 200,
        subscribers: 500,
        rating: 4.8,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const lowPerf: StrategyMetric = {
        strategyId: 'low',
        name: 'Low',
        author: 'b',
        tags: [],
        returns: 5,
        risk: 25,
        sharpe: 0.5,
        winRate: 45,
        trades: 50,
        subscribers: 50,
        rating: 3.5,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const scoreHigh = search.calculateScore(highPerf);
      const scoreLow = search.calculateScore(lowPerf);
      expect(scoreHigh).toBeGreaterThan(scoreLow);
    });
  });

  describe('getTopStrategies', () => {
    beforeEach(() => {
      const strategies = [
        {
          strategyId: 's1',
          name: 'High',
          author: 'a',
          tags: [],
          returns: 30,
          risk: 10,
          sharpe: 2.0,
          winRate: 70,
          trades: 200,
          subscribers: 500,
          rating: 4.8,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          strategyId: 's2',
          name: 'Medium',
          author: 'b',
          tags: [],
          returns: 20,
          risk: 15,
          sharpe: 1.5,
          winRate: 60,
          trades: 150,
          subscribers: 300,
          rating: 4.5,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          strategyId: 's3',
          name: 'Low',
          author: 'c',
          tags: [],
          returns: 5,
          risk: 25,
          sharpe: 0.5,
          winRate: 45,
          trades: 50,
          subscribers: 50,
          rating: 3.5,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      search.addStrategies(strategies);
    });

    it('should return top N strategies', () => {
      const top = search.getTopStrategies(2);
      expect(top.length).toBe(2);
    });

    it('should rank strategies by score', () => {
      const top = search.getTopStrategies(3);
      const score1 = search.calculateScore(top[0]);
      const score2 = search.calculateScore(top[1]);
      expect(score1).toBeGreaterThanOrEqual(score2);
    });
  });

  describe('getAllTags', () => {
    it('should return all unique tags', () => {
      search.addStrategies([
        {
          strategyId: 's1',
          name: 'S1',
          author: 'a',
          tags: ['momentum', 'trend'],
          returns: 10,
          risk: 10,
          sharpe: 1.0,
          winRate: 50,
          trades: 100,
          subscribers: 100,
          rating: 4.0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          strategyId: 's2',
          name: 'S2',
          author: 'b',
          tags: ['momentum', 'value'],
          returns: 20,
          risk: 15,
          sharpe: 1.5,
          winRate: 60,
          trades: 150,
          subscribers: 200,
          rating: 4.5,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]);

      const tags = search.getAllTags();
      expect(tags).toContain('momentum');
      expect(tags).toContain('trend');
      expect(tags).toContain('value');
      expect(tags.length).toBe(3);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      search.addStrategies([
        {
          strategyId: 's1',
          name: 'S1',
          author: 'a',
          tags: ['tag1', 'tag2'],
          returns: 20,
          risk: 15,
          sharpe: 1.5,
          winRate: 60,
          trades: 100,
          subscribers: 100,
          rating: 4.0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          strategyId: 's2',
          name: 'S2',
          author: 'b',
          tags: ['tag1'],
          returns: 30,
          risk: 20,
          sharpe: 2.0,
          winRate: 70,
          trades: 200,
          subscribers: 200,
          rating: 4.5,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]);

      const stats = search.getStats();
      expect(stats.totalStrategies).toBe(2);
      expect(stats.avgReturn).toBe(25);
      expect(stats.avgRisk).toBe(17.5); // (15 + 20) / 2
      expect(stats.avgSharpe).toBe(1.75);
      expect(stats.topTags).toContain('tag1');
    });

    it('should return zero stats for empty search', () => {
      const stats = search.getStats();
      expect(stats.totalStrategies).toBe(0);
      expect(stats.avgReturn).toBe(0);
    });
  });

  describe('removeStrategy', () => {
    it('should remove strategy', () => {
      search.addStrategy({
        strategyId: 's1',
        name: 'Test',
        author: 'a',
        tags: [],
        returns: 10,
        risk: 10,
        sharpe: 1.0,
        winRate: 50,
        trades: 100,
        subscribers: 100,
        rating: 4.0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const removed = search.removeStrategy('s1');
      expect(removed).toBe(true);
      expect(search.getStrategy('s1')).toBeNull();
    });

    it('should return false for non-existent strategy', () => {
      const removed = search.removeStrategy('nonexistent');
      expect(removed).toBe(false);
    });

    it('should emit strategy:removed event', () => {
      search.addStrategy({
        strategyId: 's1',
        name: 'Test',
        author: 'a',
        tags: [],
        returns: 10,
        risk: 10,
        sharpe: 1.0,
        winRate: 50,
        trades: 100,
        subscribers: 100,
        rating: 4.0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      let emitted = false;
      search.on('strategy:removed', () => { emitted = true; });
      
      search.removeStrategy('s1');
      expect(emitted).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all strategies', () => {
      search.addStrategies([
        {
          strategyId: 's1',
          name: 'S1',
          author: 'a',
          tags: [],
          returns: 10,
          risk: 10,
          sharpe: 1.0,
          winRate: 50,
          trades: 100,
          subscribers: 100,
          rating: 4.0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          strategyId: 's2',
          name: 'S2',
          author: 'b',
          tags: [],
          returns: 20,
          risk: 15,
          sharpe: 1.5,
          winRate: 60,
          trades: 150,
          subscribers: 200,
          rating: 4.5,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]);

      search.clear();
      expect(search.size).toBe(0);
    });

    it('should emit cleared event', () => {
      let emitted = false;
      search.on('cleared', () => { emitted = true; });
      
      search.clear();
      expect(emitted).toBe(true);
    });
  });
});
