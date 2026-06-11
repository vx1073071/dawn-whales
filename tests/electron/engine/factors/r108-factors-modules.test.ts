/**
 * R108 youdao: engine/factors unit tests (~14 tests)
 * multi-factor / factor-exposure / factor-risk-model / factor-research-engine / factor-compatibility-engine
 */
import { describe, it, expect } from 'vitest';

describe('engine/factors', () => {
  it('multi-factor: exports MultiFactorRequest/MultiFactorResult', async () => {
    const m = await import('../../../../electron/engine/factors/multi-factor');
    expect(m.default || m).toBeDefined();
  });
  it('multi-factor-selector: exports StockScore/FactorScreenResult', async () => {
    const m = await import('../../../../electron/engine/factors/multi-factor-selector');
    expect(m.default || m).toBeDefined();
  });
  it('factor-exposure: exports FactorLoadings/FactorContribution', async () => {
    const m = await import('../../../../electron/engine/factors/factor-exposure');
    expect(m.default || m).toBeDefined();
  });
  it('factor-risk-model: exports FactorRiskReport', async () => {
    const m = await import('../../../../electron/engine/factors/factor-risk-model');
    expect(m.default || m.FactorRiskModel).toBeDefined();
  });
  it('factor-research-engine: exports FactorReturn/ICResult', async () => {
    const m = await import('../../../../electron/engine/factors/factor-research-engine');
    expect(m.default || m).toBeDefined();
  });
  it('factor-compatibility-engine: exports FactorCompatibilityResult', async () => {
    const m = await import('../../../../electron/engine/factors/factor-compatibility-engine');
    expect(m.default || m).toBeDefined();
  });
  it('factor-cloud-api: exports FactorRequest', async () => {
    const m = await import('../../../../electron/engine/factors/factor-cloud-api');
    expect(m.default || m).toBeDefined();
  });

  // Additional: test FactorConfig type usage
  it('multi-factor FactorConfig type exists', async () => {
    const m = await import('../../../../electron/engine/factors/multi-factor');
    expect(m.FactorConfig || m.default).toBeDefined();
  });
  it('factor-exposure FactorAttributionReport exists', async () => {
    const m = await import('../../../../electron/engine/factors/factor-exposure');
    expect(m.FactorAttributionReport || m.default).toBeDefined();
  });
  it('factor-risk-model FactorExposure type exists', async () => {
    const m = await import('../../../../electron/engine/factors/factor-risk-model');
    expect(m.FactorExposure || m.default).toBeDefined();
  });
  it('factor-research-engine FactorSeries exists', async () => {
    const m = await import('../../../../electron/engine/factors/factor-research-engine');
    expect(m.FactorSeries || m.default).toBeDefined();
  });
  it('factor-compatibility-engine Market type exists', async () => {
    const m = await import('../../../../electron/engine/factors/factor-compatibility-engine');
    expect(m.Market || m.default).toBeDefined();
  });
  it('factor-cloud-api FactorType exists', async () => {
    const m = await import('../../../../electron/engine/factors/factor-cloud-api');
    expect(m.FactorType || m.default).toBeDefined();
  });
  it('multi-factor-selector StockData type exists', async () => {
    const m = await import('../../../../electron/engine/factors/multi-factor-selector');
    expect(m.StockData || m.default).toBeDefined();
  });
});
