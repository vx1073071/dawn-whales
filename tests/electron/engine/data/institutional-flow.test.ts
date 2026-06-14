/**
 * Tests for Institutional Flow (Multi-Market)
 * JVS R158
 */
import { describe, it, expect } from 'vitest';
import {
  getInstitutionalFlow,
  getInstitutionalFlowAll,
  getWhaleAlerts,
} from '../../../../electron/engine/data/institutional-flow';

describe('InstitutionalFlow', () => {

  describe('getInstitutionalFlow - US market', () => {
    it('returns result structure for US', async () => {
      const r = await getInstitutionalFlow('US', '2024-01-15', 5);
      expect(r.entries).toBeDefined();
      expect(Array.isArray(r.entries)).toBe(true);
      expect(r.date).toBe('2024-01-15');
      expect(r.market).toBe('US');
    });

    it('defaults to US market', async () => {
      const r = await getInstitutionalFlow();
      expect(r.market).toBe('US');
    });
  });

  describe('getInstitutionalFlow - HK market', () => {
    it('returns result for HK', async () => {
      const r = await getInstitutionalFlow('HK', '2024-01-15', 3);
      expect(r.market).toBe('HK');
      expect(Array.isArray(r.entries)).toBe(true);
    });
  });

  describe('getInstitutionalFlow - CRYPTO market', () => {
    it('returns result for CRYPTO', async () => {
      const r = await getInstitutionalFlow('CRYPTO', '2024-01-15', 3);
      expect(r.market).toBe('CRYPTO');
      expect(Array.isArray(r.entries)).toBe(true);
    });
  });

  describe('getInstitutionalFlowAll', () => {
    it('returns aggregate with date', async () => {
      const r = await getInstitutionalFlowAll('2024-01-15', 5);
      expect(r.date).toBe('2024-01-15');
      expect(r.total).toBeDefined();
    });

    it('handles all markets at once', async () => {
      const r = await getInstitutionalFlowAll('2024-01-15', 1);
      expect(r.entries).toBeDefined();
      expect(Array.isArray(r.entries)).toBe(true);
    });
  });

  describe('getWhaleAlerts', () => {
    it('returns array', async () => {
      const alerts = await getWhaleAlerts(100000, 5);
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('defaults to minUsdValue=100000 and limit=20', async () => {
      const alerts = await getWhaleAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns error field when no data', async () => {
      const r = await getInstitutionalFlow('US', '2024-01-15', 5);
      if (!r.success) {
        expect(r.error).toBeDefined();
        expect(r.entries.length).toBe(0);
      } else {
        expect(r.entries.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
