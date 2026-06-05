import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DatabaseManager, getDB } from '../electron/workers/database-manager';
import path from 'path';
import os from 'os';
import fs from 'fs';

vi.mock('electron', () => ({
  app: {
    isReady: vi.fn(() => true),
    getPath: vi.fn(() => os.tmpdir()),
    getName: vi.fn(() => 'test'),
    getVersion: vi.fn(() => '1.0.0'),
    on: vi.fn(),
    once: vi.fn(),
  },
}));

const TEST_DB = path.join(os.tmpdir(), 'dw-test-' + Date.now() + '.db');

describe('DatabaseManager', () => {
  let db: DatabaseManager;

  beforeAll(async () => {
    db = new DatabaseManager(TEST_DB);
    await db.init();
  });

  afterAll(() => {
    db.close();
    try { fs.unlinkSync(TEST_DB); } catch {}
    try { fs.unlinkSync(TEST_DB + '-wal'); } catch {}
    try { fs.unlinkSync(TEST_DB + '-shm'); } catch {}
  });

  it('should save and retrieve strategy', () => {
    db.saveStrategy({
      id: 'strat-1',
      name: 'MA Crossover',
      dsl: { fast: 10, slow: 30 },
      status: 'active',
      tags: ['trend', 'ma'],
    });

    const s = db.getStrategy('strat-1');
    expect(s).not.toBeNull();
    expect(s.name).toBe('MA Crossover');
    expect(s.dsl.fast).toBe(10);
  });

  it('should list strategies with pagination', () => {
    db.saveStrategy({ id: 's2', name: 'RSI', dsl: {} });
    db.saveStrategy({ id: 's3', name: 'MACD', dsl: {} });

    const list = db.listStrategies({ limit: 2, orderBy: 'created_at' });
    expect(list.length).toBe(2);
  });

  it('should delete strategy', () => {
    db.saveStrategy({ id: 'temp', name: 'Temp', dsl: {} });
    const deleted = db.deleteStrategy('temp');
    expect(deleted).toBe(true);
    expect(db.getStrategy('temp')).toBeNull();
  });

  it('should CRUD orders', () => {
    db.saveOrder({
      id: 'ord-1', symbol: 'AAPL', side: 'buy',
      orderType: 'limit', quantity: 100, price: 150,
    });
    const orders = db.getOrders({ symbol: 'AAPL' });
    expect(orders.length).toBe(1);
    expect(orders[0].quantity).toBe(100);
  });

  it('should upsert positions', () => {
    db.upsertPosition({ symbol: 'TSLA', quantity: 50, avgCost: 200, currentPrice: 220 });
    const positions = db.getPositions();
    expect(positions.length).toBe(1);
    expect(positions[0].symbol).toBe('TSLA');
  });

  it('should save and read config', () => {
    db.setConfig('theme', 'dark');
    db.setConfig('language', 'zh');
    expect(db.getConfig('theme')).toBe('dark');
    expect(db.getConfig('language')).toBe('zh');
  });

  it('should save and query backtests', () => {
    db.saveBacktest({
      id: 'bt-1',
      name: 'MA Test',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      metrics: { sharpeRatio: 1.5, totalReturn: 0.25 },
    });
    const results = db.getBacktests();
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].sharpe_ratio).toBe(1.5);
  });

  it('should report stats', () => {
    const s = db.stats();
    expect(s.strategies).toBeGreaterThan(0);
    expect(s.dbSize).toBeGreaterThan(0);
  });
});
