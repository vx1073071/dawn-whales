/**
 * Tests for kline-processor — R96 J-01
 */
import { describe, it, expect } from 'vitest';
import {
  getKLineProcessor,
  processKline,
  aggregateKlines,
} from '../../../../electron/engine/data/kline-processor';

describe('kline-processor', () => {
  it('getKLineProcessor is a function', () => {
    expect(typeof getKLineProcessor).toBe('function');
  });
  it('processKline is a function', () => {
    expect(typeof processKline).toBe('function');
  });
  it('aggregateKlines is a function', () => {
    expect(typeof aggregateKlines).toBe('function');
  });
});
