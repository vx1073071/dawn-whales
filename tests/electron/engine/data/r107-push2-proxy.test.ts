/**
 * R107 S-28 — Push2 Proxy Service tests (push2-proxy.ts)
 * Tests: sector heatmap, stock quotes, cache, proxy status
 */
import { describe, it, expect, vi } from 'vitest';

// Mock all heavy dependencies before importing
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../engine/core/engine-error', () => ({
  EngineError: class EngineError extends Error {
    code: string;
    constructor(code: string, msg: string) { super(msg); this.code = code; }
  },
}));

vi.mock('../utils/http', () => ({
  httpGet: vi.fn(async () => JSON.stringify({
    data: { diff: [], rc: 0 },
  })),
}));

vi.mock('../i18n/main-i18n', () => ({
  default: { t: (k: string) => k },
}));

import { Push2ProxyService } from '../electron/data/push2-proxy';

describe('Push2ProxyService', () => {
  let proxy: Push2ProxyService;

  // ── 1. Constructor initializes ────────────────────────────────────
  it('constructs without error', () => {
    proxy = new Push2ProxyService();
    expect(proxy).toBeInstanceOf(Push2ProxyService);
  });

  // ── 2. Proxy status object ────────────────────────────────────────
  it('returns proxy status object', () => {
    proxy = new Push2ProxyService();
    const status = proxy.getStatus();
    expect(status).toBeDefined();
    expect(typeof status).toBe('object');
  });

  // ── 3. getSectorHeatmap returns ProxyResult ───────────────────────
  it('getSectorHeatmap returns ProxyResult shape', async () => {
    proxy = new Push2ProxyService();
    const result = await proxy.getSectorHeatmap('industry', 10);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('latencyMs');
  }, 10000);

  // ── 4. getSectorHeatmap with concept type ─────────────────────────
  it('getSectorHeatmap handles concept type', async () => {
    proxy = new Push2ProxyService();
    const result = await proxy.getSectorHeatmap('concept', 10);
    expect(typeof result.success).toBe('boolean');
  }, 10000);

  // ── 5. getSectorHeatmap with region type ──────────────────────────
  it('getSectorHeatmap handles region type', async () => {
    proxy = new Push2ProxyService();
    const result = await proxy.getSectorHeatmap('region', 10);
    expect(typeof result.success).toBe('boolean');
  }, 10000);

  // ── 6. getStockQuote ──────────────────────────────────────────────
  it('getStockQuote returns result', async () => {
    proxy = new Push2ProxyService();
    const result = await proxy.getStockQuote('HK.00700');
    expect(result).toBeDefined();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
  }, 10000);

  // ── 7. getCapitalFlowRank ─────────────────────────────────────────
  it('getCapitalFlowRank returns result', async () => {
    proxy = new Push2ProxyService();
    const result = await proxy.getCapitalFlowRank({ sortField: 'f3', limit: 20 });
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
  }, 10000);
});
