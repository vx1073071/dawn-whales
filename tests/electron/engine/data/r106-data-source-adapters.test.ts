/**
 * tests/electron/engine/data/r106-data-source-adapters.test.ts
 * R106 S-17p2: Data source adapter mock + interface tests (~5 tests)
 *
 * Covers:
 * - Mock adapter for test isolation
 * - AdapterConfig defaults
 * - FetchResult structure
 * - Health check interface
 * - Category enum values
 */

import { describe, it, expect } from 'vitest';
import type {
  AdapterConfig,
  FetchResult,
  IDataSourceAdapter,
} from '../../../../electron/engine/data/data-source-adapters';

// Mock adapter for test isolation
class MockAdapter implements IDataSourceAdapter {
  readonly name = 'MockAdapter';
  readonly category: IDataSourceAdapter['category'] = 'quote';
  private config: AdapterConfig = {
    enabled: true,
    baseUrl: 'http://mock.local',
    rateLimit_perMin: 60,
    timeoutMs: 5000,
    retries: 2,
    cache_ms: 30000,
  };

  configure(config: Partial<AdapterConfig>): void {
    Object.assign(this.config, config);
  }

  async fetchQuote(symbol: string, market: string): Promise<FetchResult> {
    return {
      success: true,
      source: this.name,
      data: { symbol, market, price: 100 },
      error: null,
      latencyMs: 10,
      cached: false,
      timestamp: Date.now(),
    };
  }

  async fetchHistory(symbol: string, market: string, startDate: string, endDate: string): Promise<FetchResult> {
    return {
      success: true,
      source: this.name,
      data: { symbol, market, startDate, endDate, bars: [] },
      error: null,
      latencyMs: 15,
      cached: false,
      timestamp: Date.now(),
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; rateRemaining: number }> {
    return { healthy: true, latencyMs: 5, rateRemaining: 60 };
  }

  getConfig(): AdapterConfig {
    return { ...this.config };
  }
}

describe('DataSource Adapters', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  it('should fetch quote with mock data', async () => {
    const result = await adapter.fetchQuote('00700', 'HK');
    expect(result.success).toBe(true);
    expect(result.source).toBe('MockAdapter');
    expect(result.data).toEqual({ symbol: '00700', market: 'HK', price: 100 });
    expect(result.error).toBeNull();
  });

  it('should fetch history with mock data', async () => {
    const result = await adapter.fetchHistory('AAPL', 'US', '2026-01-01', '2026-06-01');
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('bars');
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('should pass health check', async () => {
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.rateRemaining).toBe(60);
  });

  it('should update config via configure()', () => {
    adapter.configure({ enabled: false, rateLimit_perMin: 30 });
    const config = adapter.getConfig();
    expect(config.enabled).toBe(false);
    expect(config.rateLimit_perMin).toBe(30);
    expect(config.baseUrl).toBe('http://mock.local'); // unchanged
  });

  it('should have correct category and name', () => {
    expect(adapter.name).toBe('MockAdapter');
    expect(adapter.category).toBe('quote');
  });
});
