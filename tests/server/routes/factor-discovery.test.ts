/**
 * R164 P1-E5: Factor Discovery Wizard API tests
 * Tests step1/step2/step3/export endpoints
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockCompatibleFactors = vi.fn();
const mockFilterCompatible = vi.fn();

vi.mock('../../../electron/engine/factors/factor-compatibility-engine', () => ({
  getFactorCompatibilityEngine: vi.fn(() => ({
    getCompatibleFactors: mockCompatibleFactors,
    filterCompatible: mockFilterCompatible,
  })),
}));

vi.mock('../../../electron/engine/factors/factor-research-engine', () => ({
  FactorResearchEngine: class {
    computeIC(factorName: string) {
      return {
        factorName,
        period: '2026-01-01–2026-06-01',
        rankIC: 0.05,
        pearsonIC: 0.048,
        IR: 0.72,
        tStat: 3.4,
        hitRate: 0.68,
        halfLife: 45,
        crowding: 0.22,
        observations: 120,
      };
    }
  },
}));

// Mock redis cache
const mockCacheStore: Record<string, string> = {};
vi.mock('../../../electron/engine/data/redis-cache-layer', () => ({
  createRedisCache: () => ({
    get: async (key: string) => mockCacheStore[key] ?? null,
    set: async (key: string, value: string) => { mockCacheStore[key] = value; },
  }),
}));

import factorDiscoveryRoutes from '../../../server/routes/factor-discovery';

// Helpers
function buildReq(query: Record<string, string>, params?: Record<string, string>): any {
  return { query, params: params || {} };
}

let lastStatus = 0;
let lastBody: any = null;

function buildRes(): any {
  return {
    status(code: number) {
      lastStatus = code;
      return { json(body: any) { lastBody = body; } };
    },
    json(body: any) {
      lastStatus = 200;
      lastBody = body;
    },
    setHeader() {},
  };
}

function getHandler(path: string, method: string = 'get'): any {
  const layer = factorDiscoveryRoutes.stack.find(
    (s: any) => s.route?.path === path && s.route?.methods?.[method]
  );
  expect(layer).toBeDefined();
  return layer.route.stack[0].handle;
}

describe('Factor Discovery Wizard API (R164)', () => {
  const sampleFactors = [
    { id: 'MOM_12M', name: 'Momentum 12M', nameCN: '12月动量', category: 'momentum', description: '12-month momentum', compatibleMarkets: ['HKEX'], compatibleInstruments: ['stock'], calculation: 'calc', typicalIC: 0.045, decayHalfLife: 60, usage: 'usage' },
    { id: 'VALUE_PE', name: 'Value PE', nameCN: '市盈率', category: 'value', description: 'PE ratio', compatibleMarkets: ['HKEX'], compatibleInstruments: ['stock'], calculation: 'calc', typicalIC: 0.035, decayHalfLife: 30, usage: 'usage' },
    { id: 'QUAL_ROE', name: 'Quality ROE', nameCN: 'ROE质量', category: 'quality', description: 'ROE', compatibleMarkets: ['HKEX'], compatibleInstruments: ['stock'], calculation: 'calc', typicalIC: 0.028, decayHalfLife: 45, usage: 'usage' },
  ];

  beforeEach(() => {
    mockCompatibleFactors.mockReset();
    mockFilterCompatible.mockReset();
    Object.keys(mockCacheStore).forEach((k) => delete mockCacheStore[k]);
    lastStatus = 0;
    lastBody = null;
  });

  // ── Step 1 ──────────────────────────────────────────────────────────

  describe('GET /step1', () => {
    it('returns available factors grouped by category', () => {
      mockCompatibleFactors.mockReturnValue(sampleFactors);

      getHandler('/step1')(buildReq({ market: 'HK' }), buildRes());

      expect(lastBody.success).toBe(true);
      expect(lastBody.totalFactors).toBe(3);
      expect(lastBody.categories).toHaveLength(3);
      expect(lastBody.categories[0].category).toBe('momentum');
      expect(lastBody.categories[0].count).toBe(1);
      expect(lastBody.categories[0].factors[0].factorId).toBe('MOM_12M');
    });

    it('returns market and instrument in response', () => {
      mockCompatibleFactors.mockReturnValue(sampleFactors);

      getHandler('/step1')(buildReq({ market: 'US', instrument: 'etf' }), buildRes());

      expect(lastBody.market).toBe('NYSE');
      expect(lastBody.instrument).toBe('etf');
    });

    it('accepts HKEX style market codes directly', () => {
      mockCompatibleFactors.mockReturnValue(sampleFactors);

      getHandler('/step1')(buildReq({ market: 'HKEX' }), buildRes());

      expect(lastBody.market).toBe('HKEX');
    });
  });

  // ── Step 2 ──────────────────────────────────────────────────────────

  describe('GET /step2', () => {
    it('validates against empty factors', () => {
      getHandler('/step2')(buildReq({}), buildRes());
      expect(lastStatus).toBe(400);
      expect(lastBody.success).toBe(false);
      expect(lastBody.error).toContain('因子');
    });

    it('limits to 20 factors max', () => {
      const tooMany = Array.from({ length: 21 }, (_, i) => 'F' + i).join(',');
      getHandler('/step2')(buildReq({ factors: tooMany }), buildRes());
      expect(lastStatus).toBe(400);
    });

    it('returns compatible and incompatible lists', () => {
      mockFilterCompatible.mockReturnValue({
        compatible: ['MOM_12M', 'VALUE_PE'],
        incompatible: [{ factorId: 'WARRANT_GAMMA', reason: '不支持stock类型' }],
      });
      mockCompatibleFactors.mockReturnValue(sampleFactors);

      getHandler('/step2')(
        buildReq({ factors: 'MOM_12M,VALUE_PE,WARRANT_GAMMA', market: 'HK' }),
        buildRes(),
      );

      expect(lastBody.success).toBe(true);
      expect(lastBody.factorsRequested).toBe(3);
      expect(lastBody.factorsCompatible).toBe(2);
      expect(lastBody.factorsIncompatible).toBe(1);
      expect(lastBody.compatible).toHaveLength(2);
      expect(lastBody.incompatible).toHaveLength(1);
    });

    it('generates a discoveryId and nextStep URL', () => {
      mockFilterCompatible.mockReturnValue({
        compatible: ['MOM_12M'],
        incompatible: [],
      });
      mockCompatibleFactors.mockReturnValue(sampleFactors);

      getHandler('/step2')(
        buildReq({ factors: 'MOM_12M', market: 'HK' }),
        buildRes(),
      );

      expect(lastBody.discoveryId).toBeTruthy();
      expect(lastBody.discoveryId).toMatch(/^disc-/);
      expect(lastBody.nextStep).toContain('/api/factor/discover/step3');
      expect(lastBody.nextStep).toContain(lastBody.discoveryId);
    });
  });

  // ── Step 3 ──────────────────────────────────────────────────────────

  describe('GET /step3', () => {
    it('requires discoveryId', async () => {
      await getHandler('/step3')(buildReq({}), buildRes());
      expect(lastStatus).toBe(400);
    });

    it('returns 404 for missing session', async () => {
      await getHandler('/step3')(buildReq({ discoveryId: 'nonexistent' }), buildRes());
      expect(lastStatus).toBe(404);
    });

    it('ranks factors by IC and returns decay + correlation', async () => {
      // Pre-populate cache with a step2 session
      const session = {
        discoveryId: 'disc-test-123',
        factors: ['MOM_12M', 'VALUE_PE', 'QUAL_ROE'],
        market: 'HKEX',
        instrument: 'stock',
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        createdAt: Date.now(),
        status: 'step2',
      };
      mockCacheStore['disc-test-123'] = JSON.stringify(session);

      await getHandler('/step3')(buildReq({ discoveryId: 'disc-test-123' }), buildRes());

      expect(lastBody.success).toBe(true);
      expect(lastBody.totalFactors).toBe(3);
      expect(lastBody.ranked).toHaveLength(3);
      // Verify IC fields exist
      const first = lastBody.ranked[0];
      expect(first.factorId).toBeTruthy();
      expect(typeof first.rankIC).toBe('number');
      expect(typeof first.IR).toBe('number');
      expect(typeof first.hitRate).toBe('number');
      expect(typeof first.crowding).toBe('number');
      expect(typeof first.observations).toBe('number');
    });

    it('includes correlation matrix (symmetric)', async () => {
      const session = {
        discoveryId: 'disc-test-corr',
        factors: ['MOM_12M', 'VALUE_PE'],
        market: 'HKEX',
        instrument: 'stock',
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        createdAt: Date.now(),
        status: 'step2',
      };
      mockCacheStore['disc-test-corr'] = JSON.stringify(session);

      await getHandler('/step3')(buildReq({ discoveryId: 'disc-test-corr' }), buildRes());

      const corr = lastBody.correlation;
      expect(corr).toBeDefined();
      expect(corr.MOM_12M).toBeDefined();
      expect(corr.VALUE_PE).toBeDefined();
      expect(corr.MOM_12M.VALUE_PE).toBe(corr.VALUE_PE.MOM_12M);
    });

    it('includes decay summary with stable flag', async () => {
      const session = {
        discoveryId: 'disc-test-decay',
        factors: ['MOM_12M'],
        market: 'HKEX',
        instrument: 'stock',
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        createdAt: Date.now(),
        status: 'step2',
      };
      mockCacheStore['disc-test-decay'] = JSON.stringify(session);

      await getHandler('/step3')(buildReq({ discoveryId: 'disc-test-decay' }), buildRes());

      const decay = lastBody.decay;
      expect(decay).toHaveLength(1);
      expect(decay[0].factorId).toBe('MOM_12M');
      expect(typeof decay[0].halfLife).toBe('number');
      expect(typeof decay[0].stable).toBe('boolean');
    });

    it('provides export URL in response', async () => {
      const session = {
        discoveryId: 'disc-test-export',
        factors: ['MOM_12M'],
        market: 'HKEX',
        instrument: 'stock',
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        createdAt: Date.now(),
        status: 'step2',
      };
      mockCacheStore['disc-test-export'] = JSON.stringify(session);

      await getHandler('/step3')(buildReq({ discoveryId: 'disc-test-export' }), buildRes());

      expect(lastBody.exportUrl).toContain('disc-test-export');
    });
  });

  // ── Export ──────────────────────────────────────────────────────────

  describe('GET /export/:discoveryId', () => {
    it('returns 404 for missing session', async () => {
      await getHandler('/export/:discoveryId')(buildReq({}, { discoveryId: 'nope' }), buildRes());
      expect(lastStatus).toBe(404);
    });

    it('returns 400 if step3 not completed', async () => {
      const session = {
        discoveryId: 'disc-no-step3',
        factors: ['MOM_12M'],
        status: 'step2',
      };
      mockCacheStore['disc-no-step3'] = JSON.stringify(session);

      await getHandler('/export/:discoveryId')(buildReq({}, { discoveryId: 'disc-no-step3' }), buildRes());

      expect(lastStatus).toBe(400);
      expect(lastBody.error).toContain('step3');
    });

    it('exports full data when step3 complete', async () => {
      const session = {
        discoveryId: 'disc-full',
        factors: ['MOM_12M', 'VALUE_PE'],
        market: 'HKEX',
        instrument: 'stock',
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        createdAt: Date.now(),
        status: 'completed',
        step3Results: {
          rankedFactors: [
            { factorId: 'MOM_12M', factorName: 'MOM_12M', rankIC: 0.05, pearsonIC: 0.048, IR: 0.72, tStat: 3.4, hitRate: 0.68, halfLife: 45, crowding: 0.22, observations: 120 },
          ],
          correlationMatrix: { MOM_12M: { MOM_12M: 1, VALUE_PE: 0.1 }, VALUE_PE: { MOM_12M: 0.1, VALUE_PE: 1 } },
          decaySummary: [{ factorId: 'MOM_12M', halfLife: 45, stable: true }],
          generatedAt: Date.now(),
        },
      };
      mockCacheStore['disc-full'] = JSON.stringify(session);

      await getHandler('/export/:discoveryId')(buildReq({}, { discoveryId: 'disc-full' }), buildRes());

      expect(lastBody.discoveryId).toBe('disc-full');
      expect(lastBody.rankedFactors).toHaveLength(1);
      expect(lastBody.market).toBe('HKEX');
      expect(lastBody.dateRange).toBeDefined();
      expect(lastBody.correlationMatrix).toBeDefined();
    });

    it('sets Content-Disposition header for file download', async () => {
      const session = {
        discoveryId: 'disc-file',
        factors: ['MOM_12M'],
        market: 'HKEX',
        instrument: 'stock',
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        createdAt: Date.now(),
        status: 'completed',
        step3Results: {
          rankedFactors: [],
          correlationMatrix: {},
          decaySummary: [],
          generatedAt: Date.now(),
        },
      };
      mockCacheStore['disc-file'] = JSON.stringify(session);

      // Use a custom res that tracks headers
      const headers: Record<string, string> = {};
      let responseBody: any = null;
      await getHandler('/export/:discoveryId')(buildReq({}, { discoveryId: 'disc-file' }), {
        status() { return this; },
        json(body: any) { responseBody = body; },
        setHeader(k: string, v: string) { headers[k] = v; },
      });

      expect(headers['Content-Disposition']).toContain('attachment');
      expect(headers['Content-Disposition']).toContain('disc-file');
    });
  });

  // ── Invariants ──────────────────────────────────────────────────────

  describe('invariants', () => {
    it('step1 categories have categoryLabel', () => {
      mockCompatibleFactors.mockReturnValue(sampleFactors);

      getHandler('/step1')(buildReq({ market: 'HK' }), buildRes());

      for (const cat of lastBody.categories) {
        expect(cat.categoryLabel).toBeTruthy();
      }
    });

    it('step1 factor items have required fields', () => {
      mockCompatibleFactors.mockReturnValue(sampleFactors);

      getHandler('/step1')(buildReq({ market: 'HK' }), buildRes());

      for (const cat of lastBody.categories) {
        for (const f of cat.factors) {
          expect(f.factorId).toBeTruthy();
          expect(f.name).toBeTruthy();
          expect(f.typicalIC).toBeTruthy();
          expect(f.category).toBeUndefined(); // category is at the group level
        }
      }
    });
  });
});
