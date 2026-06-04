import { describe, it, expect } from 'vitest';
import { FeatureFlags } from '../electron/workers/feature-flags';

describe('FeatureFlags', () => {
  it('should check basic flag', () => {
    const ff = new FeatureFlags();
    ff.register({ key: 'darkMode', enabled: true, description: '' });
    expect(ff.isEnabled('darkMode')).toBe(true);
    expect(ff.isEnabled('nonexistent')).toBe(false);
  });

  it('should support overrides', () => {
    const ff = new FeatureFlags();
    ff.register({ key: 'beta', enabled: false, description: '' });
    ff.override('beta', true);
    expect(ff.isEnabled('beta')).toBe(true);
    ff.clearOverride('beta');
    expect(ff.isEnabled('beta')).toBe(false);
  });

  it('should rollout by percentage', () => {
    const ff = new FeatureFlags();
    ff.register({ key: 'newUI', enabled: true, description: '', rolloutPercent: 50 });
    let enabled = 0;
    for (let i = 0; i < 100; i++) {
      if (ff.isEnabled('newUI', { userId: `user${i}` })) enabled++;
    }
    // ~50% with some variance
    expect(enabled).toBeGreaterThan(30);
    expect(enabled).toBeLessThan(70);
  });

  it('should gate by version', () => {
    const ff = new FeatureFlags();
    ff.register({ key: 'v2api', enabled: true, description: '', targetVersions: ['1.5.0'] });
    expect(ff.isEnabled('v2api', { appVersion: '1.0.0' })).toBe(false);
    expect(ff.isEnabled('v2api', { appVersion: '1.5.0' })).toBe(true);
    expect(ff.isEnabled('v2api', { appVersion: '2.0.0' })).toBe(true);
  });
});
