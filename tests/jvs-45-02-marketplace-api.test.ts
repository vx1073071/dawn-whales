/**
 * JVS-45-02: Marketplace API Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketplaceApi, getMarketplaceApi, resetMarketplaceApi } from '../electron/engine/marketplace-api';

describe('JVS-45-02: Marketplace API', () => {
  let api: MarketplaceApi;

  beforeEach(() => {
    resetMarketplaceApi();
    api = getMarketplaceApi();
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const a1 = getMarketplaceApi();
      const a2 = getMarketplaceApi();
      expect(a1).toBe(a2);
    });

    it('should reset instance', () => {
      const a1 = getMarketplaceApi();
      resetMarketplaceApi();
      const a2 = getMarketplaceApi();
      expect(a1).not.toBe(a2);
    });
  });

  describe('Publish Strategy', () => {
    it('should publish a strategy', () => {
      const id = api.publishStrategy({
        name: 'MA Cross Strategy',
        description: 'Moving average crossover strategy',
        author: 'test_user',
        sharpe: 1.5,
        maxDrawdown: 15,
        winRate: 65,
        tags: ['momentum', 'ma'],
        visibility: 'public',
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.startsWith('strat_')).toBe(true);
    });

    it('should store published strategy', () => {
      const id = api.publishStrategy({
        name: 'Test Strategy',
        description: 'Test',
        author: 'user',
        sharpe: 1.0,
        maxDrawdown: 10,
        winRate: 60,
        tags: ['test'],
        visibility: 'public',
      });

      const strategy = api.getStrategy(id);
      expect(strategy).not.toBeNull();
      expect(strategy!.name).toBe('Test Strategy');
      expect(strategy!.downloads).toBe(0);
      expect(strategy!.rating).toBe(0);
    });
  });

  describe('Get Strategies', () => {
    beforeEach(() => {
      api.publishStrategy({
        name: 'Strategy A',
        description: 'High sharpe',
        author: 'user1',
        sharpe: 2.0,
        maxDrawdown: 10,
        winRate: 70,
        tags: ['momentum'],
        visibility: 'public',
      });
      api.publishStrategy({
        name: 'Strategy B',
        description: 'Low risk',
        author: 'user2',
        sharpe: 1.5,
        maxDrawdown: 5,
        winRate: 60,
        tags: ['conservative'],
        visibility: 'public',
      });
      api.publishStrategy({
        name: 'Private Strategy',
        description: 'Private',
        author: 'user3',
        sharpe: 1.0,
        maxDrawdown: 15,
        winRate: 55,
        tags: ['test'],
        visibility: 'private',
      });
    });

    it('should return only public strategies', () => {
      const result = api.getStrategies({
        sortBy: 'newest',
        page: 1,
        pageSize: 20,
      });

      expect(result.strategies.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should filter by tag', () => {
      const result = api.getStrategies({
        tag: 'momentum',
        sortBy: 'newest',
        page: 1,
        pageSize: 20,
      });

      expect(result.strategies.length).toBe(1);
      expect(result.strategies[0].name).toBe('Strategy A');
    });

    it('should sort by sharpe', () => {
      const result = api.getStrategies({
        sortBy: 'sharpe',
        page: 1,
        pageSize: 20,
      });

      expect(result.strategies[0].sharpe).toBe(2.0);
      expect(result.strategies[1].sharpe).toBe(1.5);
    });

    it('should filter by minRating', () => {
      api.rateStrategy('strat_1', { userId: 'user1', rating: 5, createdAt: new Date().toISOString() });

      const result = api.getStrategies({
        minRating: 4,
        sortBy: 'rating',
        page: 1,
        pageSize: 20,
      });

      expect(result.strategies.length).toBe(1);
    });

    it('should paginate results', () => {
      const result = api.getStrategies({
        sortBy: 'newest',
        page: 1,
        pageSize: 1,
      });

      expect(result.strategies.length).toBe(1);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(1);
    });
  });

  describe('Rate Strategy', () => {
    let strategyId: string;

    beforeEach(() => {
      strategyId = api.publishStrategy({
        name: 'Rateable Strategy',
        description: 'Test',
        author: 'user',
        sharpe: 1.0,
        maxDrawdown: 10,
        winRate: 60,
        tags: ['test'],
        visibility: 'public',
      });
    });

    it('should rate a strategy', () => {
      const success = api.rateStrategy(strategyId, {
        userId: 'user1',
        rating: 5,
        comment: 'Great strategy!',
        createdAt: new Date().toISOString(),
      });

      expect(success).toBe(true);

      const strategy = api.getStrategy(strategyId);
      expect(strategy!.rating).toBe(5);
      expect(strategy!.ratingCount).toBe(1);
    });

    it('should calculate average rating', () => {
      api.rateStrategy(strategyId, { userId: 'user1', rating: 5, createdAt: new Date().toISOString() });
      api.rateStrategy(strategyId, { userId: 'user2', rating: 3, createdAt: new Date().toISOString() });

      const strategy = api.getStrategy(strategyId);
      expect(strategy!.rating).toBe(4);
      expect(strategy!.ratingCount).toBe(2);
    });

    it('should reject invalid rating', () => {
      const success = api.rateStrategy(strategyId, {
        userId: 'user1',
        rating: 6,
        createdAt: new Date().toISOString(),
      });

      expect(success).toBe(false);
    });

    it('should reject rating for non-existent strategy', () => {
      const success = api.rateStrategy('non_existent', {
        userId: 'user1',
        rating: 5,
        createdAt: new Date().toISOString(),
      });

      expect(success).toBe(false);
    });
  });

  describe('Download Strategy', () => {
    it('should download and increment count', () => {
      const id = api.publishStrategy({
        name: 'Downloadable',
        description: 'Test',
        author: 'user',
        sharpe: 1.0,
        maxDrawdown: 10,
        winRate: 60,
        tags: ['test'],
        visibility: 'public',
      });

      const strategy = api.downloadStrategy(id);
      expect(strategy).not.toBeNull();
      expect(strategy!.downloads).toBe(1);

      const strategy2 = api.downloadStrategy(id);
      expect(strategy2!.downloads).toBe(2);
    });

    it('should return null for non-existent strategy', () => {
      const result = api.downloadStrategy('non_existent');
      expect(result).toBeNull();
    });
  });

  describe('Delete Strategy', () => {
    it('should delete a strategy', () => {
      const id = api.publishStrategy({
        name: 'Deletable',
        description: 'Test',
        author: 'user',
        sharpe: 1.0,
        maxDrawdown: 10,
        winRate: 60,
        tags: ['test'],
        visibility: 'public',
      });

      const success = api.deleteStrategy(id);
      expect(success).toBe(true);
      expect(api.getStrategy(id)).toBeNull();
    });

    it('should return false for non-existent strategy', () => {
      const success = api.deleteStrategy('non_existent');
      expect(success).toBe(false);
    });
  });

  describe('Search', () => {
    beforeEach(() => {
      api.publishStrategy({
        name: 'MA Cross Strategy',
        description: 'Moving average crossover',
        author: 'user1',
        sharpe: 2.0,
        maxDrawdown: 10,
        winRate: 70,
        tags: ['momentum', 'ma'],
        visibility: 'public',
      });
      api.publishStrategy({
        name: 'RSI Strategy',
        description: 'RSI reversal',
        author: 'user2',
        sharpe: 1.5,
        maxDrawdown: 15,
        winRate: 60,
        tags: ['reversal'],
        visibility: 'public',
      });
    });

    it('should search by name', () => {
      const result = api.searchStrategies('MA Cross');
      expect(result.strategies.length).toBe(1);
      expect(result.strategies[0].name).toBe('MA Cross Strategy');
    });

    it('should search by description', () => {
      const result = api.searchStrategies('reversal');
      expect(result.strategies.length).toBe(1);
    });

    it('should search by tag', () => {
      const result = api.searchStrategies('momentum');
      expect(result.strategies.length).toBe(1);
    });

    it('should return empty for no matches', () => {
      const result = api.searchStrategies('nonexistent');
      expect(result.strategies.length).toBe(0);
    });
  });

  describe('Top Strategies', () => {
    it('should return top strategies by rating', () => {
      const id1 = api.publishStrategy({
        name: 'Top Rated',
        description: 'Test',
        author: 'user1',
        sharpe: 2.0,
        maxDrawdown: 10,
        winRate: 70,
        tags: ['test'],
        visibility: 'public',
      });
      api.rateStrategy(id1, { userId: 'user1', rating: 5, createdAt: new Date().toISOString() });

      api.publishStrategy({
        name: 'Lower Rated',
        description: 'Test',
        author: 'user2',
        sharpe: 1.5,
        maxDrawdown: 15,
        winRate: 60,
        tags: ['test'],
        visibility: 'public',
      });

      const top = api.getTopStrategies(10);
      expect(top.length).toBe(2);
      expect(top[0].name).toBe('Top Rated');
    });
  });

  describe('Statistics', () => {
    it('should calculate statistics', () => {
      api.publishStrategy({
        name: 'Strategy 1',
        description: 'Test',
        author: 'user1',
        sharpe: 2.0,
        maxDrawdown: 10,
        winRate: 70,
        tags: ['test'],
        visibility: 'public',
      });

      const stats = api.getStats();
      expect(stats.totalStrategies).toBe(1);
      expect(stats.avgSharpe).toBe(2.0);
    });
  });

  describe('Tags', () => {
    it('should get all tags', () => {
      api.publishStrategy({
        name: 'Strategy 1',
        description: 'Test',
        author: 'user1',
        sharpe: 2.0,
        maxDrawdown: 10,
        winRate: 70,
        tags: ['momentum', 'ma'],
        visibility: 'public',
      });
      api.publishStrategy({
        name: 'Strategy 2',
        description: 'Test',
        author: 'user2',
        sharpe: 1.5,
        maxDrawdown: 15,
        winRate: 60,
        tags: ['reversal', 'momentum'],
        visibility: 'public',
      });

      const tags = api.getAllTags();
      expect(tags).toContain('momentum');
      expect(tags).toContain('ma');
      expect(tags).toContain('reversal');
      expect(tags.length).toBe(3);
    });
  });

  describe('Clear All', () => {
    it('should clear all strategies', () => {
      api.publishStrategy({
        name: 'Test',
        description: 'Test',
        author: 'user',
        sharpe: 1.0,
        maxDrawdown: 10,
        winRate: 60,
        tags: ['test'],
        visibility: 'public',
      });

      api.clearAll();
      const result = api.getStrategies({ sortBy: 'newest', page: 1, pageSize: 20 });
      expect(result.strategies.length).toBe(0);
    });
  });
});
