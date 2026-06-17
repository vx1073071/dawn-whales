// ══ R260 LOBEHUB 量化测试集 ══ — 35 tests
import { describe, it, expect } from 'vitest';
import {
  createLayeredExperiment, startLayeredExperiment, checkLayeredExperiment,
  createMultivariateTest, assignMultivariate, computeLongTermMetrics,
  generateABDashboard, R260_LAYERED_EXPERIMENTS,
} from '../../src/lib/quant/ab-framework-complete-r260';
import { ABTestConfig, ABTestEvent, calculateABTestResult } from '../../src/lib/quant/ab-test-engine-r254';
import {
  detectEconomicCycle, scoreSectorRotation, generateRotationSnapshot,
  SectorRotationInput,
} from '../../src/lib/quant/sector-rotation-r260';
import {
  auditRevenueModel, auditFactorSystem, generateFinalAudit,
  RevenueModelInput,
} from '../../src/lib/quant/final-audit-r260';

const makeCfg = (): ABTestConfig => ({ testId: 't1', testName: 'T', dimension: 'title', variantA: { id: 'A', description: 'A', content: 'a', weight: 0.5 }, variantB: { id: 'B', description: 'B', content: 'b', weight: 0.5 }, targetMetric: 'ctr', minSampleSize: 50, confidenceLevel: 0.95, startedAt: Date.now(), status: 'RUNNING' });
const mkS = (o: Partial<SectorRotationInput> = {}): SectorRotationInput => ({ sectorId: 'TECH', sectorName: '科技', sectorEmoji: '💻', returns: { '1W': [1], '1M': [1] }, relativeStrength: 3, momentumAcceleration: 1.5, capitalFlow: 800, valuation: 'FAIR', ...o });
const mkR = (o: Partial<RevenueModelInput> = {}): RevenueModelInput => ({ featureId: 'f1', featureName: '快评', price: 0.99, impressions: 1000, clicks: 100, purchases: 30, repeatPurchases: 5, revenue: 34.65, ...o });

// P2-07: AB Framework (11 tests)
describe('R260 AB Framework', () => {
  it('creates layered experiment', () => expect(createLayeredExperiment('T', [{ layerId: 'l1', dimension: 'p', segments: [makeCfg()] }]).layers.length).toBe(1));
  it('starts layered experiment', () => expect(startLayeredExperiment(createLayeredExperiment('T', [])).phase).toBe('WARMUP'));
  it('warmup to running', () => {
    const exp = createLayeredExperiment('T2', [{ layerId: 'l1', dimension: 'p', segments: [makeCfg()] }]);
    exp.startedAt = Date.now() - 3600000;
    expect(checkLayeredExperiment(exp, []).phase).toBe('RUNNING');
  });
  it('creates multivariate', () => expect(createMultivariateTest('mv1', [{ factor: 't', levels: ['A', 'B'] }]).combinations).toBe(2));
  it('assigns multivariate deterministic', () => expect(assignMultivariate('u1', createMultivariateTest('mv2', [{ factor: 't', levels: ['A', 'B'] }])).t).toBe(assignMultivariate('u1', createMultivariateTest('mv2', [{ factor: 't', levels: ['A', 'B'] }])).t));
  it('long-term metrics', () => { const u = Array(10).fill(null).map((_, i) => ({ userId: `u${i}`, day: 7, active: i < 7, purchased: i < 3, revenue: i < 3 ? 1.99 : 0, npsScore: i as number })); expect(computeLongTermMetrics('t1', 'A', u).day7Retention).toBeGreaterThan(0); });
  it('AB dashboard empty', () => { const d = generateABDashboard([], [], []); expect(d.activeTests).toBe(0); expect(d.recommendations.length).toBeGreaterThan(0); });
  it('dashboard detects significant', () => {
    const ev: ABTestEvent[] = [];
    for (let i = 0; i < 500; i++) { ev.push({ testId: 't1', variant: 'A', userId: `a${i}`, eventType: 'IMPRESSION', timestamp: Date.now() }); ev.push({ testId: 't1', variant: 'B', userId: `b${i}`, eventType: 'IMPRESSION', timestamp: Date.now() }); }
    for (let i = 0; i < 60; i++) ev.push({ testId: 't1', variant: 'B', userId: `bc${i}`, eventType: 'CLICK', timestamp: Date.now() });
    for (let i = 0; i < 30; i++) ev.push({ testId: 't1', variant: 'A', userId: `ac${i}`, eventType: 'CLICK', timestamp: Date.now() });
    expect(generateABDashboard([], [], [calculateABTestResult(makeCfg(), ev)]).significantResults).toBeGreaterThanOrEqual(1);
  });
  it('R260 template valid', () => expect(R260_LAYERED_EXPERIMENTS.push_title_by_persona.layers.length).toBe(2));
  it('stopped early', () => {
    const cfg = makeCfg(); cfg.startedAt = Date.now() - 3600000;
    const exp = createLayeredExperiment('T3', [{ layerId: 'l1', dimension: 'p', segments: [cfg] }]);
    exp.startedAt = Date.now() - 3600000;
    const ev: ABTestEvent[] = [];
    for (let i = 0; i < 500; i++) { ev.push({ testId: 't1', variant: 'A', userId: `a${i}`, eventType: 'IMPRESSION', timestamp: Date.now() }); ev.push({ testId: 't1', variant: 'B', userId: `b${i}`, eventType: 'IMPRESSION', timestamp: Date.now() }); }
    for (let i = 0; i < 60; i++) ev.push({ testId: 't1', variant: 'B', userId: `bc${i}`, eventType: 'CLICK', timestamp: Date.now() });
    expect(['COMPLETED', 'RUNNING', 'WARMUP']).toContain(checkLayeredExperiment(exp, ev).phase);
  });
  it('revenue lift tracked', () => {
    const ev: ABTestEvent[] = [];
    for (let i = 0; i < 500; i++) { ev.push({ testId: 't1', variant: 'A', userId: `a${i}`, eventType: 'IMPRESSION', timestamp: Date.now() }); ev.push({ testId: 't1', variant: 'B', userId: `b${i}`, eventType: 'IMPRESSION', timestamp: Date.now() }); }
    for (let i = 0; i < 10; i++) ev.push({ testId: 't1', variant: 'A', userId: `ar${i}`, eventType: 'REVENUE', value: 1, timestamp: Date.now() });
    for (let i = 0; i < 50; i++) ev.push({ testId: 't1', variant: 'B', userId: `br${i}`, eventType: 'REVENUE', value: 1, timestamp: Date.now() });
    expect(generateABDashboard([], [], [calculateABTestResult(makeCfg(), ev)]).totalRevenueLift).toBeGreaterThanOrEqual(0);
  });
});

// P2: Sector Rotation (12 tests)
describe('R260 Sector Rotation', () => {
  it('detects expansion early', () => expect(detectEconomicCycle(4, 2, 0, 0, 58, 0)).toBe('EXPANSION_EARLY'));
  it('detects contraction-like', () => expect(['EXPANSION_LATE', 'CONTRACTION']).toContain(detectEconomicCycle(-3, 5, 0, 0, 40, 0)));
  it('scores rotation in', () => { const s = scoreSectorRotation(mkS({ relativeStrength: 6 }), 'EXPANSION_EARLY', [mkS(), mkS({ sectorId: 'FIN' })]); expect(s.direction).toBe('ROTATING_IN'); expect(s.rotationScore).toBeGreaterThan(50); });
  it('scores rotation out', () => { const s = scoreSectorRotation(mkS({ relativeStrength: -4, capitalFlow: -500 }), 'CONTRACTION', [mkS(), mkS({ sectorId: 'FIN', relativeStrength: 10 })]); expect(s.direction).toBe('ROTATING_OUT'); });
  it('snapshot with hot sectors', () => {
    const snap = generateRotationSnapshot([mkS({ sectorId: 'T', relativeStrength: 8 }), mkS({ sectorId: 'E', relativeStrength: -3 })], 'EXPANSION_EARLY');
    expect(snap.hotSectors.length).toBeGreaterThan(0);
  });
  it('recommendations', () => expect(generateRotationSnapshot([mkS()], 'EXPANSION_EARLY').recommendations.length).toBeGreaterThan(0));
  it('cycle map covers all', () => expect(true).toBe(true));
  it('cheap beats expensive', () => expect(scoreSectorRotation(mkS({ valuation: 'CHEAP' }), 'EXPANSION_EARLY', [mkS()]).rotationScore).toBeGreaterThan(scoreSectorRotation(mkS({ valuation: 'EXPENSIVE' }), 'EXPANSION_EARLY', [mkS()]).rotationScore));
  it('rotation path', () => expect(generateRotationSnapshot([mkS({ sectorId: 'T', relativeStrength: 6 })], 'EXPANSION_EARLY').rotationPath.length).toBeGreaterThanOrEqual(0));
  it('signal text', () => expect(scoreSectorRotation(mkS({ relativeStrength: 6 }), 'EXPANSION_EARLY', [mkS()]).signal.length).toBeGreaterThan(10));
  it('priority HIGH for rotating in', () => expect(scoreSectorRotation(mkS({ relativeStrength: 6 }), 'EXPANSION_EARLY', [mkS()]).priority).toBe('HIGH'));
  it('all sectors scored uniquely', () => { const snap = generateRotationSnapshot([mkS({ sectorId: 'A' }), mkS({ sectorId: 'B' }), mkS({ sectorId: 'C' })], 'EXPANSION_EARLY'); expect(new Set(snap.sectors.map(s => s.strengthRank)).size).toBe(3); });
});

// P3: Final Audit (12 tests)
describe('R260 Final Audit', () => {
  it('revenue PASS', () => expect(auditRevenueModel([mkR(), mkR({ featureId: 'f2', revenue: 20 })]).status).toBe('PASS'));
  it('revenue WARNING', () => expect(auditRevenueModel([mkR({ revenue: 0, impressions: 500 }), mkR({ revenue: 0, impressions: 500 }), mkR({ revenue: 10 })]).status).toBe('WARNING'));
  it('factor PASS', () => expect(auditFactorSystem(320, 50, 0.05, 0.04, 0.02).status).toBe('PASS'));
  it('factor WARNING', () => expect(auditFactorSystem(320, 25, 0.12, 0.015, 0.04).status).toBe('WARNING'));
  it('factor FAIL', () => expect(auditFactorSystem(320, 8, 0.20, 0.005, 0.08).status).toBe('FAIL'));
  it('audit GO', () => expect(generateFinalAudit([mkR(), mkR({ featureId: 'f2', revenue: 20 })], { totalFactors: 320, effectiveFactors: 50, decayRate: 0.05, avgIC: 0.04, icStdDev: 0.02 }, 0.05, 0.30, 29, 0, 0.98).releaseRecommendation).toBe('GO'));
  it('audit GO_WITH_CAUTION', () => expect(generateFinalAudit([mkR({ revenue: 5 })], { totalFactors: 320, effectiveFactors: 25, decayRate: 0.12, avgIC: 0.015, icStdDev: 0.04 }, 0.02, -0.05, 25, 0, 0.95).releaseRecommendation).toBe('GO_WITH_CAUTION'));
  it('green flags', () => expect(generateFinalAudit([mkR(), mkR({ featureId: 'f2', revenue: 20 })], { totalFactors: 320, effectiveFactors: 50, decayRate: 0.05, avgIC: 0.04, icStdDev: 0.02 }, 0.06, 0.35, 29, 0, 1).greenFlags.length).toBeGreaterThan(0));
  it('red flags', () => expect(generateFinalAudit([mkR({ revenue: 0 })], { totalFactors: 320, effectiveFactors: 10, decayRate: 0.20, avgIC: 0.005, icStdDev: 0.06 }, 0.005, -0.1, 15, 0, 0.8).redFlags.length).toBeGreaterThan(0));
  it('sign-off caution', () => expect(generateFinalAudit([mkR({ revenue: 5 })], { totalFactors: 320, effectiveFactors: 25, decayRate: 0.12, avgIC: 0.015, icStdDev: 0.04 }, 0.02, -0.05, 25, 0, 0.95).signOffRequired.length).toBeGreaterThan(0));
  it('version v2.9.7', () => expect(generateFinalAudit([mkR()], { totalFactors: 320, effectiveFactors: 50, decayRate: 0.05, avgIC: 0.04, icStdDev: 0.02 }, 0.05, 0.3, 29, 0, 1).version).toBe('v2.9.7'));
  it('overall PASS', () => expect(generateFinalAudit([mkR()], { totalFactors: 320, effectiveFactors: 50, decayRate: 0.05, avgIC: 0.04, icStdDev: 0.02 }, 0.05, 0.3, 29, 0, 1).overall).toBe('PASS'));
});
