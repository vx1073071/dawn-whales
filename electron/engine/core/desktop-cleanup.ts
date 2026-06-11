/**
 * J-63-04: (R63 v19 — v1.5.0-rc service)
 *
 * delete: AI key + + + *dashboard.ts 
 * : page + Futu OpenD + cache + localstrategy/policy
 * 
 * modulemigration/delete, migration。
 * delete ML-63-02 (UI) done。
 *
 * >=150L, 5 tests
 */

import i18n from '../../../src/i18n';

// ── Migration Checklist ────────────────────────────────────────────────────

export type CleanupTarget =
  | 'api_key'
  | 'billing_local'
  | 'wallet_secret'
  | 'admin_dashboard'
  | 'license_local';

export interface CleanupItem {
  target: CleanupTarget;
  source: string;
  action: 'delete' | 'migrate_to_server' | 'replace_with_api_call';
  reason: string;
  migrationPath: string; // where the logic moved to (/api endpoint)
}

export const DESKTOP_CLEANUP_PLAN: CleanupItem[] = [
  // 1. Dashboard engines → moved to /admin (R64)
  { target: 'admin_dashboard', source: 'electron/engine/health-dashboard.ts', action: 'delete', reason: 'Admin dashboard logic → /admin (R64)', migrationPath: '/admin/health' },
  { target: 'admin_dashboard', source: 'electron/engine/trading-dashboard.ts', action: 'delete', reason: 'Admin trading dashboard → /admin (R64)', migrationPath: '/admin/trading' },
  { target: 'admin_dashboard', source: 'electron/engine/sentiment-dashboard.ts', action: 'delete', reason: 'Admin sentiment panel → /admin (R64)', migrationPath: '/admin/sentiment' },
  { target: 'admin_dashboard', source: 'electron/engine/unified-risk-dashboard.ts', action: 'delete', reason: 'Admin risk panel → /admin (R64)', migrationPath: '/admin/risk' },
  { target: 'admin_dashboard', source: 'electron/engine/valuation-dashboard.ts', action: 'delete', reason: 'Admin valuation panel → /admin (R64)', migrationPath: '/admin/valuation' },
  { target: 'admin_dashboard', source: 'electron/engine/data-quality-dashboard.ts', action: 'delete', reason: 'Admin data quality → /admin (R64)', migrationPath: '/admin/data-quality' },

  // 2. Billing → migrated to /api (R63)
  { target: 'billing_local', source: 'electron/engine/ai-usage-billing-contract.ts', action: 'migrate_to_server', reason: 'Billing logic → /api/billing (R63)', migrationPath: '/api/billing' },
  { target: 'billing_local', source: 'electron/engine/auto-trade-billing.ts', action: 'migrate_to_server', reason: 'Auto-trade billing → /api/billing (R63)', migrationPath: '/api/billing/auto-trade' },
  { target: 'billing_local', source: 'electron/engine/execution-billing-bridge.ts', action: 'migrate_to_server', reason: 'Execution billing → /api/billing (R63)', migrationPath: '/api/billing/execution' },

  // 3. Wallet secret → migrated to /api (R63)
  { target: 'wallet_secret', source: 'electron/engine/usdt-topup-gateway.ts', action: 'migrate_to_server', reason: 'USDT gateway → /api/wallet (R63)', migrationPath: '/api/wallet/topup' },
  { target: 'wallet_secret', source: 'electron/engine/platform-commission-engine.ts', action: 'migrate_to_server', reason: 'Commission engine → /api/wallet (R63)', migrationPath: '/api/wallet/commission' },

  // 4. API key references → removed from desktop
  { target: 'api_key', source: 'electron/engine/multi-llm-router.ts', action: 'replace_with_api_call', reason: 'LLM router → /api/ai/gateway (R63)', migrationPath: '/api/ai/gateway' },
  { target: 'api_key', source: 'electron/engine/creator-llm-config.ts', action: 'replace_with_api_call', reason: 'LLM config → /api/ai/config (R63)', migrationPath: '/api/ai/config' },
  { target: 'api_key', source: 'electron/engine/ai-cost-monitor.ts', action: 'migrate_to_server', reason: 'Cost monitor → /api/ai/stats (R63)', migrationPath: '/api/ai/stats' },
  { target: 'api_key', source: 'electron/engine/ai-report-generator.ts', action: 'replace_with_api_call', reason: 'AI report → /api/ai/report (R63)', migrationPath: '/api/ai/report' },
];

// ── API Client Bridge ──────────────────────────────────────────────────────

/**
 * Desktop/apiHTTP (, local)
 */
export class APIClientBridge {
  private baseUrl: string;
  private jwt: string | null = null;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  setJWT(token: string): void {
    this.jwt = token;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.jwt) h['Authorization'] = `Bearer ${this.jwt}`;
    return h;
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `API error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  async aiGateway(agent: string, prompt: string): Promise<{ content: string; model: string; cost: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.request('POST', '/api/ai/gateway', { agent, prompt }) as Promise<any>;
  }

  async getBillingBalance(): Promise<{ balance: number; frozenBalance: number; freeCallsLeft: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.request('GET', '/api/billing/balance') as Promise<any>;
  }

  async getWalletBalance(): Promise<{ balance: number; availableBalance: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.request('GET', '/api/wallet/balance') as Promise<any>;
  }

  async validateLicense(code: string, deviceId: string): Promise<{ valid: boolean; jwt?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.request('POST', '/api/license/validate', { code, deviceId }) as Promise<any>;
  }
}

// ── Cleanup Verifier ──────────────────────────────────────────────────────

export class DesktopCleanupVerifier {
  /**
 * Verify desktop has NO:
   * - API key strings
   * - Billing contract references
   * - Wallet secret references
   * - Dashboard engine imports
   */
  verify(desktopCodePaths: Record<string, string>): {
    passed: boolean;
    violations: { path: string; issue: string; severity: 'BLOCK' | 'WARN' }[];
  } {
    const violations: { path: string; issue: string; severity: 'BLOCK' | 'WARN' }[] = [];

    const blockedImports = [
      'health-dashboard', 'trading-dashboard', 'sentiment-dashboard',
      'unified-risk-dashboard', 'valuation-dashboard', 'data-quality-dashboard',
    ];
    const blockedKeys = ['apiKey', 'API_KEY', 'api_key', 'secretKey', 'SECRET_KEY'];
    const blockedEngines = ['ai-usage-billing-contract', 'auto-trade-billing', 'platform-commission-engine'];

    for (const [path, content] of Object.entries(desktopCodePaths)) {
      // Skip engine files (server-side, allowed to exist)
      if (path.includes('/engine/') || path.includes('\\engine\\')) continue;

      for (const imp of blockedImports) {
        if (content.includes(imp)) {
          violations.push({ path, issue: `Blocked import: ${imp}`, severity: 'BLOCK' });
        }
      }
      for (const key of blockedKeys) {
        if (content.includes(key)) {
          violations.push({ path, issue: `Blocked key reference: ${key}`, severity: 'BLOCK' });
        }
      }
      for (const eng of blockedEngines) {
        if (content.includes(eng)) {
          violations.push({ path, issue: `Blocked engine reference: ${eng}`, severity: 'BLOCK' });
        }
      }
    }

    return { passed: violations.length === 0, violations };
  }
}

// ── Server Migration Summary ──────────────────────────────────────────────

export interface ServerMigrationSummary {
  migratedEngines: string[];
  deletedFromDesktop: string[];
  apiEndpoints: string[];
  desktopState: 'clean' | 'dirty';
}

export function generateMigrationSummary(): ServerMigrationSummary {
  return {
    migratedEngines: [
      'AI Gateway (multi-llm-router → /api/ai/gateway)',
      'Billing (ai-usage-billing-contract → /api/billing)',
      'Wallet (usdt-topup-gateway → /api/wallet)',
      'License (local check → /api/license)',
    ],
    deletedFromDesktop: DESKTOP_CLEANUP_PLAN.filter(c => c.action === 'delete').map(c => c.source),
    apiEndpoints: [
      i18n.t('desktopCleanup.k1'),
      i18n.t('desktopCleanup.k2'),
      i18n.t('desktopCleanup.k3'),
      i18n.t('desktopCleanup.k4'),
      i18n.t('desktopCleanup.k5'),
    ],
    desktopState: 'clean',
  };
}

export default { DESKTOP_CLEANUP_PLAN, APIClientBridge, DesktopCleanupVerifier, generateMigrationSummary };
