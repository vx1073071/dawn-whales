import { describe, it, expect } from 'vitest';
import { SecurityService } from '../electron/workers/security-service';

describe('SecurityService', () => {
  const sec = new SecurityService();

  it('should sanitize SQL injection', () => {
    expect(sec.sanitizeSql("DROP TABLE users;")).not.toContain(';');
  });

  it('should sanitize XSS', () => {
    expect(sec.sanitizeHtml('<script>alert(1)</script>')).not.toContain('<');
  });

  it('should validate symbols', () => {
    expect(sec.validateSymbol('AAPL')).toBe(true);
    expect(sec.validateSymbol('DROP TABLE')).toBe(false);
  });

  it('should detect attack payloads', () => {
    expect(sec.detectAttackPayload('<script>alert(1)</script>').safe).toBe(false);
    expect(sec.detectAttackPayload('normal input').safe).toBe(true);
  });

  it('should check password strength', () => {
    const weak = sec.checkPasswordStrength('abc');
    expect(weak.score).toBeLessThan(5);

    const strong = sec.checkPasswordStrength('DawnWhales@2026!');
    expect(strong.score).toBeGreaterThanOrEqual(8);
  });

  it('should mask API keys', () => {
    expect(sec.maskApiKey('sk-abc123def456ghi')).toBe('sk-a****ghi');
  });
});
