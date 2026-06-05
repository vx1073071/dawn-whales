import { describe, it, expect } from 'vitest';
import { MultiTenancyService } from '../electron/workers/multi-tenancy';

describe('MultiTenancyService', () => {
  it('should create tenant with tier limits', () => {
    const mt = new MultiTenancyService();
    const tenant = mt.createTenant('TestCo', 'pro');
    expect(tenant.limits.maxStrategies).toBe(50);
    expect(tenant.tier).toBe('pro');
  });

  it('should check limits', () => {
    const mt = new MultiTenancyService();
    const tenant = mt.createTenant('FreeCo', 'free');
    mt.setCurrentTenant(tenant.id);
    const check = mt.checkLimit('maxStrategies', 3);
    expect(check.allowed).toBe(false);
    const ok = mt.checkLimit('maxStrategies', 1);
    expect(ok.allowed).toBe(true);
  });

  it('should upgrade tier', () => {
    const mt = new MultiTenancyService();
    const tenant = mt.createTenant('UpgradeCo', 'free');
    mt.upgradeTier(tenant.id, 'enterprise');
    const updated = mt.tenants.get(tenant.id)!;
    expect(updated.limits.maxStrategies).toBe(999);
  });

  it('should suspend and reactivate', () => {
    const mt = new MultiTenancyService();
    const tenant = mt.createTenant('SuspendMe');
    mt.suspend(tenant.id);
    expect(() => mt.setCurrentTenant(tenant.id)).toThrow('suspended');
    mt.reactivate(tenant.id);
    mt.setCurrentTenant(tenant.id); // should not throw
    expect(mt.getCurrentTenant()!.status).toBe('active');
  });
});
