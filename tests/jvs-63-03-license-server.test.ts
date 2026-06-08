/**
 * J-63-03 Tests: 许可证系统 /api (R63 v19 — v1.5.0-rc 服务器化)
 *
 * Tests:
 * 01-02: Issuance, code generation
 * 03-04: Validation (valid/invalid/expired/revoked)
 * 05-06: Device binding, blacklist
 * 07-08: JWT, revalidation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  LicenseServer,
  getLicenseServer,
  resetLicenseServer,
} from '../electron/engine/license-server';

describe('J-63-03: License Server', () => {
  let server: LicenseServer;

  beforeEach(() => {
    resetLicenseServer();
    server = getLicenseServer();
  });

  describe('Issuance', () => {
    it('01: issue license creates record', () => {
      const lic = server.issueLicense('test@dawnwhales.com', 'pro');
      expect(lic.id.startsWith('LIC-')).toBe(true);
      expect(lic.email).toBe('test@dawnwhales.com');
      expect(lic.status).toBe('active');
      expect(lic.plan).toBe('pro');
      expect(lic.activationCode).toBeTruthy();
    });

    it('02: generate codes returns valid format', () => {
      const codes = server.generateCodes(3, 'elite');
      expect(codes.length).toBe(3);
      codes.forEach(code => {
        const segments = code.split('-');
        expect(segments.length).toBe(4);
        segments.forEach(s => expect(s.length).toBe(4));
      });
    });

    it('03: duplicate email throws', () => {
      server.issueLicense('dup@test.com', 'pro');
      expect(() => server.issueLicense('dup@test.com', 'elite')).toThrow('already');
    });
  });

  describe('Validation', () => {
    it('04: valid activation code returns JWT', () => {
      const lic = server.issueLicense('valid@test.com', 'pro');
      const result = server.validateLicense(lic.activationCode, 'device-mac-1');
      expect(result.valid).toBe(true);
      expect(result.jwt).toBeTruthy();
      expect(result.plan).toBe('pro');
    });

    it('05: invalid code returns error', () => {
      const result = server.validateLicense('XXXX-XXXX-XXXX-XXXX', 'dev1');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid');
    });

    it('06: JWT can be verified', () => {
      const lic = server.issueLicense('jwt-test@test.com', 'pro');
      const result = server.validateLicense(lic.activationCode, 'dev1');
      const decoded = LicenseServer.verifyJWT(result.jwt!);
      expect(decoded?.sub).toBe(lic.id);
      expect(decoded?.email).toBe('jwt-test@test.com');
    });
  });

  describe('Revocation & Blacklist', () => {
    it('07: revoked license fails validation', () => {
      const lic = server.issueLicense('bad@test.com', 'pro');
      server.revokeLicense(lic.id, 'abuse');
      const result = server.validateLicense(lic.activationCode, 'dev1');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('revoked');
    });

    it('08: blacklisted code fails', () => {
      const lic = server.issueLicense('evil@test.com', 'pro');
      server.blacklistCode(lic.activationCode);
      // Blacklist is checked per license ID
      const result = server.validateLicense(lic.activationCode, 'dev1');
      // The blacklist is indexed by license id, which we already have from issueLicense
      expect(result.valid).toBe(false);
    });
  });

  describe('Device Binding', () => {
    it('09: max 2 devices', () => {
      const lic = server.issueLicense('multi@test.com', 'pro');
      server.validateLicense(lic.activationCode, 'dev-1');
      server.validateLicense(lic.activationCode, 'dev-2');
      const result = server.validateLicense(lic.activationCode, 'dev-3');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Max devices');
    });

    it('10: same device re-validates', () => {
      const lic = server.issueLicense('same@test.com', 'pro');
      server.validateLicense(lic.activationCode, 'dev-1');
      const result = server.validateLicense(lic.activationCode, 'dev-1');
      expect(result.valid).toBe(true);
      expect(server.getLicenseById(lic.id)!.deviceIds).toHaveLength(1);
    });
  });

  describe('Revalidation', () => {
    it('11: revalidate active license works', () => {
      const lic = server.issueLicense('recheck@test.com', 'pro');
      const result = server.revalidate(lic.id);
      expect(result.valid).toBe(true);
      expect(result.status).toBeTruthy();
    });

    it('12: revalidate unknown id fails', () => {
      expect(server.revalidate('NONEXIST').valid).toBe(false);
    });
  });
});
