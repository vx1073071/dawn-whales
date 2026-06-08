/**
 * J-62-03 Tests: 黑名单+2FA安全系统 (R62 v19 — v1.5.0-alpha)
 *
 * Tests:
 * 01-03: Blacklist add/remove/check
 * 04-06: 2FA enable/verify/backup codes
 * 07-08: SecurityService combined checks
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BlacklistEngine,
  TwoFactorEngine,
  SecurityService,
} from '../electron/engine/security-engine';

describe('J-62-03a: BlacklistEngine', () => {
  let engine: BlacklistEngine;

  beforeEach(() => {
    engine = new BlacklistEngine();
  });

  it('01: add blacklist entry active by default', () => {
    const entry = engine.add('bad-actor', 'admin', '违规操作');
    expect(entry.active).toBe(true);
    expect(entry.freezeP2P).toBe(true);
    expect(entry.freezeWithdrawal).toBe(true);
  });

  it('02: check blacklist returns freeze flags', () => {
    engine.add('user-x', 'admin', '欺诈');
    const check = engine.check('user-x');
    expect(check.blacklisted).toBe(true);
    expect(check.freezeP2P).toBe(true);
    expect(check.freezeWithdrawal).toBe(true);
  });

  it('03: non-blacklisted user passes check', () => {
    expect(engine.check('clean-user').blacklisted).toBe(false);
  });

  it('04: remove deactivates blacklist', () => {
    engine.add('user-y', 'admin', 'spam');
    engine.remove('user-y', 'admin', '误判');
    expect(engine.check('user-y').blacklisted).toBe(false);
    expect(engine.getEntry('user-y')!.active).toBe(false);
  });

  it('05: double add throws', () => {
    engine.add('user-z', 'admin', 'test');
    expect(() => engine.add('user-z', 'admin', 'again')).toThrow('already blacklisted');
  });

  it('06: remove non-blacklisted throws', () => {
    expect(() => engine.remove('nonexist', 'admin', 'test')).toThrow('not blacklisted');
  });
});

describe('J-62-03b: TwoFactorEngine', () => {
  let engine: TwoFactorEngine;

  beforeEach(() => {
    engine = new TwoFactorEngine();
  });

  it('07: enable 2FA generates secret + backup codes', () => {
    const result = engine.enable2FA('user1');
    expect(result.secret.length).toBeGreaterThan(10);
    expect(result.backupCodes.length).toBe(8);
    expect(result.qrUri.startsWith('otpauth://')).toBe(true);
    expect(engine.isEnabled('user1')).toBe(true);
  });

  it('08: TOTP verification succeeds with valid code', () => {
    const { secret } = engine.enable2FA('user1');
    const code = engine.generateCode(secret);
    const result = engine.verify('user1', code);
    expect(result.valid).toBe(true);
    expect(result.usedBackup).toBeFalsy();
  });

  it('09: TOTP verification fails with wrong code', () => {
    engine.enable2FA('user1');
    const result = engine.verify('user1', '000000');
    expect(result.valid).toBe(false);
  });

  it('10: backup code works once and consumed', () => {
    const { backupCodes } = engine.enable2FA('user2');
    const firstResult = engine.verify('user2', backupCodes[0]);
    expect(firstResult.valid).toBe(true);
    expect(firstResult.usedBackup).toBe(true);
    expect(firstResult.remainingCodes).toBe(7);

    // Same code again should fail
    const secondResult = engine.verify('user2', backupCodes[0]);
    expect(secondResult.valid).toBe(false);
  });

  it('11: verification fails for non-2FA user', () => {
    const result = engine.verify('no-user', '123456');
    expect(result.valid).toBe(false);
  });

  it('12: disable 2FA marks as disabled', () => {
    engine.enable2FA('user1');
    engine.disable2FA('user1');
    expect(engine.isEnabled('user1')).toBe(false);
  });
});

describe('J-62-03c: SecurityService', () => {
  let service: SecurityService;

  beforeEach(() => {
    service = new SecurityService();
  });

  it('13: blacklisted user blocked from P2P', () => {
    service.blacklist.add('bad-guy', 'admin', '欺诈');
    const result = service.checkAction('bad-guy', 'p2p_send');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('P2P frozen');
  });

  it('14: blacklisted user blocked from withdrawal', () => {
    service.blacklist.add('evil', 'admin', '盗号');
    const result = service.checkAction('evil', 'withdraw');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('frozen');
  });

  it('15: clean user withdrawal requires 2FA', () => {
    const result = service.checkAction('good-user', 'withdraw');
    expect(result.allowed).toBe(true);
    expect(result.require2FA).toBe(true);
  });

  it('16: clean user P2P allowed without 2FA requirement', () => {
    const result = service.checkAction('good-user', 'p2p_send');
    expect(result.allowed).toBe(true);
    expect(result.require2FA).toBeFalsy();
  });
});
