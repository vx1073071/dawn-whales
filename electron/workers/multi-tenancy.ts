import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';
﻿// T88: Multi-tenancy Service
export interface Tenant {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: number;
  settings: TenantSettings;
  limits: TenantLimits;
}

export interface TenantSettings {
  theme?: string;
  language?: string;
  timezone?: string;
  notifications?: boolean;
}

export interface TenantLimits {
  maxStrategies: number;
  maxBacktests: number;
  maxSymbolsPerWatchlist: number;
  maxConcurrentExecutions: number;
  dataRetentionDays: number;
  allowedBrokers: string[];
}

const TIER_LIMITS: Record<Tenant['tier'], TenantLimits> = {
  free: {
    maxStrategies: 3,
    maxBacktests: 10,
    maxSymbolsPerWatchlist: 10,
    maxConcurrentExecutions: 1,
    dataRetentionDays: 30,
    allowedBrokers: ['futu', 'moomoo'],
  },
  pro: {
    maxStrategies: 50,
    maxBacktests: 500,
    maxSymbolsPerWatchlist: 100,
    maxConcurrentExecutions: 5,
    dataRetentionDays: 365,
    allowedBrokers: ['futu', 'moomoo', 'ib', 'tiger'],
  },
  enterprise: {
    maxStrategies: 999,
    maxBacktests: 9999,
    maxSymbolsPerWatchlist: 1000,
    maxConcurrentExecutions: 50,
    dataRetentionDays: 3650,
    allowedBrokers: ['all'],
  },
};

export class MultiTenancyService {
  private tenants = new Map<string, Tenant>();
  private currentTenantId: string | null = null;

  createTenant(name: string, tier: Tenant['tier'] = 'free'): Tenant {
    const id = `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const tenant: Tenant = {
      id, name, tier, status: 'active', createdAt: Date.now(),
      settings: { notifications: true },
      limits: { ...TIER_LIMITS[tier] },
    };
    this.tenants.set(id, tenant);
    return tenant;
  }

  setCurrentTenant(tenantId: string): void {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new EngineError(ErrorDomain.AUTH, ErrorCode.UNAUTHORIZED, `Tenant ${tenantId} not found`);
    if (tenant.status !== 'active') throw new EngineError(ErrorDomain.AUTH, ErrorCode.UNAUTHORIZED, `Tenant ${tenantId} is ${tenant.status}`);
    this.currentTenantId = tenantId;
  }

  getCurrentTenant(): Tenant | null {
    if (!this.currentTenantId) return null;
    return this.tenants.get(this.currentTenantId) || null;
  }

  getLimits(): TenantLimits {
    const tenant = this.getCurrentTenant();
    return tenant?.limits || TIER_LIMITS.free;
  }

  checkLimit(resource: keyof TenantLimits, current: number): { allowed: boolean; limit: number } {
    const limits = this.getLimits();
    const limit = limits[resource] as number;
    return { allowed: current < limit, limit };
  }

  upgradeTier(tenantId: string, newTier: Tenant['tier']): Tenant {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new EngineError(ErrorDomain.AUTH, ErrorCode.UNAUTHORIZED, 'Tenant not found');
    tenant.tier = newTier;
    tenant.limits = { ...TIER_LIMITS[newTier] };
    return tenant;
  }

  suspend(tenantId: string): void {
    const tenant = this.tenants.get(tenantId);
    if (tenant) tenant.status = 'suspended';
  }

  reactivate(tenantId: string): void {
    const tenant = this.tenants.get(tenantId);
    if (tenant) tenant.status = 'active';
  }

  listTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }
}

export const multiTenancy = new MultiTenancyService();
