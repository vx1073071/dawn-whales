/**
 * Tests for data-source-adapters — R96 J-01
 * Tests adapters: YahooFinanceAdapter, AlphaVantageAdapter, NewsAPIAdapter, SocialSentimentAdapter
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  YahooFinanceAdapter,
  AlphaVantageAdapter,
  NewsAPIAdapter,
  SocialSentimentAdapter,
  createAdapters,
  type AdapterConfig,
  type AllAdapters,
} from '../../../../electron/engine/data/data-source-adapters';

// ── Helpers ──

function makeConfig(overrides: Partial<AdapterConfig> = {}): AdapterConfig {
  return {
    baseUrl: 'http://localhost:9999',
    apiKey: 'test-key',
    timeoutMs: 1000,
    retries: 1,
    ...overrides,
  };
}

function makeJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as Response;
}

// ── YahooFinanceAdapter ──

describe('YahooFinanceAdapter', () => {
  let adapter: YahooFinanceAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new YahooFinanceAdapter(makeConfig());
  });

  it('creates with config', () => {
    expect(adapter).toBeInstanceOf(YahooFinanceAdapter);
  });

  it('has a name', async () => {
    expect(adapter.name).toBeDefined();
    expect(typeof adapter.name).toBe('string');
  });
});

// ── AlphaVantageAdapter ──

describe('AlphaVantageAdapter', () => {
  let adapter: AlphaVantageAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new AlphaVantageAdapter(makeConfig());
  });

  it('creates with config', () => {
    expect(adapter).toBeInstanceOf(AlphaVantageAdapter);
  });

  it('has a name', async () => {
    expect(adapter.name).toBeDefined();
    expect(typeof adapter.name).toBe('string');
  });
});

// ── NewsAPIAdapter ──

describe('NewsAPIAdapter', () => {
  let adapter: NewsAPIAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new NewsAPIAdapter(makeConfig());
  });

  it('creates with config', () => {
    expect(adapter).toBeInstanceOf(NewsAPIAdapter);
  });

  it('has a name', async () => {
    expect(adapter.name).toBeDefined();
    expect(typeof adapter.name).toBe('string');
  });

  it('guessSentiment returns string', () => {
    const s = adapter.guessSentiment('up 5% rally breakout', '');
    expect(typeof s).toBe('string');
  });

  it('guessSentiment neutral for empty', () => {
    const s = adapter.guessSentiment('', '');
    expect(s).toBe('neutral');
  });
});

// ── SocialSentimentAdapter ──

describe('SocialSentimentAdapter', () => {
  let adapter: SocialSentimentAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new SocialSentimentAdapter(makeConfig());
  });

  it('creates with config', () => {
    expect(adapter).toBeInstanceOf(SocialSentimentAdapter);
  });

  it('has a name', async () => {
    expect(adapter.name).toBeDefined();
    expect(typeof adapter.name).toBe('string');
  });
});

// ── createAdapters factory ──

describe('createAdapters', () => {
  const cfg: AdapterConfig = { baseUrl: 'http://localhost', apiKey: 'k', timeoutMs: 500 };

  it('returns object with yahoo key', () => {
    const a = createAdapters(cfg);
    expect(a).toHaveProperty('yahoo');
    expect(a.yahoo).toBeInstanceOf(YahooFinanceAdapter);
  });

  it('returns object with alphaVantage key', () => {
    const a = createAdapters(cfg);
    expect(a).toHaveProperty('alphaVantage');
    expect(a.alphaVantage).toBeInstanceOf(AlphaVantageAdapter);
  });

  it('returns non-empty object', () => {
    const a = createAdapters(cfg);
    expect(Object.keys(a).length).toBeGreaterThan(0);
  });

  it('all adapters have name', () => {
    const a = createAdapters(cfg);
    Object.values(a).forEach(v => {
      if (v && typeof v === 'object' && 'name' in v) {
        expect(typeof (v as { name: unknown }).name).toBe('string');
      }
    });
  });
});
