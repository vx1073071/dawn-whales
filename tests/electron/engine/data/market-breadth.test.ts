/**
 * Tests for market-breadth — R96 J-01
 */
import { describe, it, expect } from 'vitest';
import {
  getMarketBreadth,
  clearBreadthCache,
} from '../../../../electron/engine/data/market-breadth';

describe('market-breadth', () => {
  it('getMarketBreadth is a function', () => {
    expect(typeof getMarketBreadth).toBe('function');
  });
  it('clearBreadthCache is a function', () => {
    expect(typeof clearBreadthCache).toBe('function');
  });
});
