/**
 * J-65-01 Tests: 下载+注册API (R65 FIX)
 *
 * Tests:
 * 01-02: Version check + download
 * 03-04: Registration + login
 * 05-06: Profile + referral
 * 07-08: Update check
 * 09: Suspension
 * 10: Download stats
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DownloadRegistrationServer,
  getDLServer,
  resetDLServer,
} from '../electron/engine/download-registration-api';

describe('J-65-01: Download + Registration API', () => {
  let server: DownloadRegistrationServer;

  beforeEach(() => {
    resetDLServer();
    server = getDLServer();
  });

  describe('Versions & Downloads', () => {
    it('01: getLatestVersion returns highest build', () => {
      const latest = server.getLatestVersion('beta');
      expect(latest).toBeTruthy();
      expect(latest!.version).toBe('1.6.0-beta');
    });

    it('02: getDownloadInfo returns platform-specific URL', () => {
      const dl = server.getDownloadInfo('windows', 'beta');
      expect(dl.url).toContain('.exe');
      expect(dl.platform).toBe('windows');
      expect(dl.size).toBeGreaterThan(100_000_000);
    });
  });

  describe('Registration', () => {
    it('03: register creates account with 3 free credits', () => {
      const account = server.register({
        email: 'newuser@test.com',
        password: 'securePass123',
        nickname: 'TraderJoe',
      });
      expect(account.id.startsWith('USR-')).toBe(true);
      expect(account.email).toBe('newuser@test.com');
      expect(account.freeAICredits).toBe(3);
      expect(account.referralCode.startsWith('DW-')).toBe(true);
    });

    it('04: duplicate email throws', () => {
      server.register({ email: 'dup@test.com', password: 'pass12345678' });
      expect(() => server.register({ email: 'dup@test.com', password: 'anotherpass1' })).toThrow('already');
    });

    it('05: invalid email throws', () => {
      expect(() => server.register({ email: 'notanemail', password: 'pass12345678' })).toThrow('Invalid email');
    });

    it('06: short password throws', () => {
      expect(() => server.register({ email: 'user@test.com', password: '123' })).toThrow('short');
    });
  });

  describe('Login', () => {
    it('07: login with correct credentials returns account', () => {
      server.register({ email: 'login@test.com', password: 'mypassword123' });
      const account = server.login('login@test.com', 'mypassword123');
      expect(account).toBeTruthy();
      expect(account!.email).toBe('login@test.com');
    });

    it('08: login with wrong email returns null', () => {
      expect(server.login('nobody@test.com', 'whatever')).toBeNull();
    });
  });

  describe('Update Check', () => {
    it('09: checkUpdate with older version returns update available', () => {
      const result = server.checkUpdate('1.5.0', 'mac', 'beta');
      expect(result.updateAvailable).toBe(true);
      expect(result.latestVersion.version).toBe('1.6.0-beta');
    });

    it('10: checkUpdate with same version returns no update', () => {
      const result = server.checkUpdate('1.6.0-beta', 'windows', 'beta');
      expect(result.updateAvailable).toBe(false);
    });
  });

  describe('Account Management', () => {
    it('11: updateProfile changes nickname', () => {
      const account = server.register({ email: 'profile@test.com', password: 'pass12345678' });
      server.updateProfile(account.id, { nickname: 'MasterTrader' });
      const updated = server.getAccount(account.id);
      expect(updated!.nickname).toBe('MasterTrader');
    });

    it('12: suspend account blocks login', () => {
      const account = server.register({ email: 'bad@test.com', password: 'pass12345678' });
      server.suspendAccount(account.id);
      expect(server.login('bad@test.com', 'pass12345678')).toBeNull();
    });
  });

  describe('Referral', () => {
    it('13: referral code resolves to user', () => {
      const account = server.register({ email: 'referrer@test.com', password: 'pass12345678' });
      const resolved = server.resolveReferralCode(account.referralCode);
      expect(resolved).toBe(account.id);
    });
  });

  describe('Stats', () => {
    it('14: download counts track platform downloads', () => {
      server.getDownloadInfo('windows', 'beta');
      server.getDownloadInfo('windows', 'beta');
      server.getDownloadInfo('mac', 'beta');
      const stats = server.getDownloadStats();
      expect(stats['windows']).toBe(2);
      expect(stats['mac']).toBe(1);
    });
  });
});
