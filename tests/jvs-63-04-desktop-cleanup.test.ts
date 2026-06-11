/**
 * J-63-04 Tests: 桌面端清洁 (R63 v19 — v1.5.0-rc 服务器化)
 *
 * Tests:
 * 01: Cleanup plan completeness
 * 02: Verifier detects blocked imports
 * 03: Verifier detects API keys
 * 04: Clean desktop passes verification
 * 05: Migration summary
 */
import { describe, it, expect } from 'vitest';
import {
  DESKTOP_CLEANUP_PLAN,
  DesktopCleanupVerifier,
  generateMigrationSummary,
} from '../electron/engine/core/desktop-cleanup';

describe('J-63-04: Desktop Cleanup', () => {
  describe('Cleanup Plan', () => {
    it('01: plan covers all 4 target types', () => {
      const targets = new Set(DESKTOP_CLEANUP_PLAN.map(c => c.target));
      expect(targets.has('api_key')).toBe(true);
      expect(targets.has('billing_local')).toBe(true);
      expect(targets.has('wallet_secret')).toBe(true);
      expect(targets.has('admin_dashboard')).toBe(true);
    });

    it('02: all dashboard engines marked for deletion', () => {
      const dashboards = DESKTOP_CLEANUP_PLAN.filter(c => c.target === 'admin_dashboard');
      expect(dashboards.length).toBe(6);
      dashboards.forEach(d => {
        expect(d.action).toBe('delete');
        expect(d.migrationPath.startsWith('/admin/')).toBe(true);
      });
    });

    it('03: all billing engines marked for migration', () => {
      const billing = DESKTOP_CLEANUP_PLAN.filter(c => c.target === 'billing_local');
      expect(billing.length).toBe(3);
      billing.forEach(b => expect(b.action).toBe('migrate_to_server'));
    });
  });

  describe('Verifier', () => {
    const verifier = new DesktopCleanupVerifier();

    it('04: clean desktop passes verification', () => {
      const result = verifier.verify({
        'src/renderer/App.tsx': 'import React; function App() { return <div>Dawn Whales</div>; }',
        'src/renderer/MarketView.tsx': 'import { getAIGateway } from \'./api-client\';',
      });
      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('05: verifier detects blocked dashboard import', () => {
      const result = verifier.verify({
        'src/renderer/AdminPage.tsx': 'import { HealthDashboard } from \'../engine/health-dashboard\';',
      });
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.severity === 'BLOCK')).toBe(true);
    });

    it('06: verifier detects API key in renderer code', () => {
      const result = verifier.verify({
        'src/renderer/AISettings.tsx': 'const apiKey = "sk-deepseek-xxx";',
      });
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.issue.includes('apiKey'))).toBe(true);
    });

    it('07: verifier ignores engine files (server-side)', () => {
      const result = verifier.verify({
        'electron/engine/ai-gateway-server.ts': 'export const DEEPSEEK_API_KEY = "sk-xxx";',
      });
      // Engine files are skipped in verifier (server-side, expected to contain keys)
      expect(result.passed).toBe(true);
    });
  });

  describe('Migration Summary', () => {
    it('08: summary lists all endpoints', () => {
      const summary = generateMigrationSummary();
      expect(summary.desktopState).toBe('clean');
      expect(summary.apiEndpoints.length).toBeGreaterThanOrEqual(4);
      expect(summary.migratedEngines.length).toBeGreaterThanOrEqual(3);
      expect(summary.deletedFromDesktop.length).toBeGreaterThanOrEqual(5);
    });
  });
});
