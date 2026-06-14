/**
 * R179 JVS Tests: G20 + G22 + G13 + Rename
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// G20: Sensitive Field Masker
// ============================================================================
describe('R179 G20: Sensitive Field Masker', () => {
  let maskWallet: any, maskEmail: any, maskAccountId: any;
  let maskSensitiveFields: any, maskField: any, isSensitiveField: any;
  let getMaskConfig: any, updateMaskConfig: any, resetMaskConfig: any;
  let getMaskStats: any;

  beforeEach(async () => {
    const mod = await import('../../../electron/engine/agents/sensitive-field-masker');
    maskWallet = mod.maskWallet;
    maskEmail = mod.maskEmail;
    maskAccountId = mod.maskAccountId;
    maskSensitiveFields = mod.maskSensitiveFields;
    maskField = mod.maskField;
    isSensitiveField = mod.isSensitiveField;
    getMaskConfig = mod.getMaskConfig;
    updateMaskConfig = mod.updateMaskConfig;
    resetMaskConfig = mod.resetMaskConfig;
    getMaskStats = mod.getMaskStats;
    resetMaskConfig();
  });

  // ── maskWallet ──
  it('maskWallet hides numeric values', () => {
    expect(maskWallet(1234.56)).toBe('****');
    expect(maskWallet(0)).toBe('****');
  });

  it('maskWallet hides string values', () => {
    expect(maskWallet('1234.56 USDT')).toBe('****');
    expect(maskWallet('')).toBe('****');
  });

  it('maskWallet hides null/undefined', () => {
    expect(maskWallet(null)).toBe('****');
    expect(maskWallet(undefined)).toBe('****');
  });

  // ── maskEmail ──
  it('maskEmail hides local part beyond 2 chars', () => {
    expect(maskEmail('user@example.com')).toBe('us***@example.com');
    expect(maskEmail('john.doe@company.com')).toBe('jo***@company.com');
  });

  it('maskEmail handles short local parts', () => {
    expect(maskEmail('a@b.com')).toBe('***@b.com');
    expect(maskEmail('ab@c.com')).toBe('***@c.com');
  });

  it('maskEmail handles non-string values', () => {
    expect(maskEmail(null)).toBe('***@***');
    expect(maskEmail(123)).toBe('***@***');
    expect(maskEmail('')).toBe('***@***');
  });

  // ── maskAccountId ──
  it('maskAccountId shows only last 4 chars', () => {
    expect(maskAccountId('DW-A1B2C3D4E5F6')).toContain('***-');
    expect(maskAccountId('DW-A1B2C3D4E5F6').endsWith('E5F6')).toBe(true);
  });

  it('maskAccountId handles short IDs', () => {
    expect(maskAccountId('abc')).toBe('***');
    expect(maskAccountId('')).toBe('***');
  });

  // ── maskSensitiveFields (object) ──
  it('maskSensitiveFields masks wallet/balance fields in objects', () => {
    const obj = { userId: 'u1', walletBalance: '1000 USDT', name: 'Alice' };
    const masked = maskSensitiveFields(obj) as any;
    expect(masked.walletBalance).toBe('****');
    expect(masked.name).toBe('Alice');
    expect(masked.userId).toBe('u1');
  });

  it('maskSensitiveFields masks email in objects', () => {
    const obj = { email: 'test@example.com', name: 'Test' };
    const masked = maskSensitiveFields(obj) as any;
    expect(masked.email).toBe('te***@example.com');
    expect(masked.name).toBe('Test');
  });

  it('maskSensitiveFields handles nested objects', () => {
    const obj = { user: { email: 'deep@test.com', walletBalance: '500' } };
    const masked = maskSensitiveFields(obj) as any;
    expect(masked.user.email).toBe('de***@test.com');
    expect(masked.user.walletBalance).toBe('****');
  });

  it('maskSensitiveFields handles arrays', () => {
    const arr = [{ email: 'a@b.com' }, { email: 'c@d.com' }];
    const masked = maskSensitiveFields(arr) as any;
    expect(masked[0].email).toBe('***@b.com');
    expect(masked[1].email).toBe('***@d.com');
  });

  // ── isSensitiveField ──
  it('isSensitiveField detects known sensitive fields', () => {
    expect(isSensitiveField('walletBalance')).toBe(true);
    expect(isSensitiveField('wallet_balance')).toBe(true);
    expect(isSensitiveField('email')).toBe(true);
    expect(isSensitiveField('apiKey')).toBe(true);
    expect(isSensitiveField('userName')).toBe(false);
    expect(isSensitiveField('strategyName')).toBe(false);
  });

  // ── maskField ──
  it('maskField masks sensitive scalar', () => {
    expect(maskField('walletBalance', '999')).toBe('****');
    // "me@host.com" has 2-char local → fully hidden
    expect(maskField('email', 'me@host.com')).toBe('***@host.com');
    expect(maskField('userName', 'Alice')).toBe('Alice');
  });

  // ── Configuration ──
  it('updateMaskConfig can disable masking', () => {
    updateMaskConfig({ enabled: false });
    const cfg = getMaskConfig();
    expect(cfg.enabled).toBe(false);
    const result = maskSensitiveFields({ walletBalance: '100' }) as any;
    expect(result.walletBalance).toBe('100');
  });
});

// ============================================================================
// G22: Audit Anomaly Detection
// ============================================================================
describe('R179 G22: Audit Anomaly Detection', () => {
  let detectRateAnomaly: any, detectIPCrossUser: any;
  let detectSKPattern: any, detectUserProbing: any, detectTimeAnomaly: any;
  let detectAnomalies: any, getAnomalyQueue: any, clearAnomalyQueue: any;
  let getAnomalyStats: any, updateAnomalyConfig: any, resetAnomalyConfig: any;

  beforeEach(async () => {
    const mod = await import('../../../electron/engine/agents/audit-anomaly-detector');
    detectRateAnomaly = mod.detectRateAnomaly;
    detectIPCrossUser = mod.detectIPCrossUser;
    detectSKPattern = mod.detectSKPattern;
    detectUserProbing = mod.detectUserProbing;
    detectTimeAnomaly = mod.detectTimeAnomaly;
    detectAnomalies = mod.detectAnomalies;
    getAnomalyQueue = mod.getAnomalyQueue;
    clearAnomalyQueue = mod.clearAnomalyQueue;
    getAnomalyStats = mod.getAnomalyStats;
    updateAnomalyConfig = mod.updateAnomalyConfig;
    resetAnomalyConfig = mod.resetAnomalyConfig;
    resetAnomalyConfig();
  });

  function makeEntry(userId: string, overrides: Record<string, string> = {}) {
    return {
      timestamp: overrides.timestamp || new Date().toISOString(),
      userId,
      action: overrides.action || 'ai.recommend',
      ip: overrides.ip,
      details: overrides.details || '',
      userAgent: overrides.userAgent || 'test',
    };
  }

  // ── Rate anomaly ──
  it('detectRateAnomaly finds 200+ entries per user', () => {
    updateAnomalyConfig({ rateThreshold: 10 });
    const entries: any[] = [];
    for (let i = 0; i < 15; i++) entries.push(makeEntry('u1'));
    const alerts = detectRateAnomaly(entries);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].rule).toBe('RATE_ANOMALY');
  });

  it('detectRateAnomaly ignores normal volume', () => {
    const entries: any[] = [];
    for (let i = 0; i < 5; i++) entries.push(makeEntry('u1'));
    const alerts = detectRateAnomaly(entries);
    expect(alerts.length).toBe(0);
  });

  // ── IP cross-user ──
  it('detectIPCrossUser finds IP with 5+ users', () => {
    updateAnomalyConfig({ ipUserThreshold: 3 });
    const entries = [
      makeEntry('a', { ip: '1.2.3.4' }),
      makeEntry('b', { ip: '1.2.3.4' }),
      makeEntry('c', { ip: '1.2.3.4' }),
      makeEntry('d', { ip: '1.2.3.4' }),
    ];
    const alerts = detectIPCrossUser(entries);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].rule).toBe('IP_CROSS_USER');
  });

  it('detectIPCrossUser ignores normal IP usage', () => {
    const entries = [
      makeEntry('a', { ip: '1.2.3.4' }),
      makeEntry('b', { ip: '5.6.7.8' }),
    ];
    const alerts = detectIPCrossUser(entries);
    expect(alerts.length).toBe(0);
  });

  // ── sk- pattern ──
  it('detectSKPattern finds sk- API key pattern', () => {
    const entries = [
      makeEntry('bad', {
        action: 'ai.recommend',
        details: 'sk-abcdefghijklmnopqrstuvwxyzz',
      }),
    ];
    const alerts = detectSKPattern(entries);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].rule).toBe('SK_PATTERN');
    expect(alerts[0].severity).toBe('critical');
  });

  it('detectSKPattern finds api_key= pattern', () => {
    const entries = [
      makeEntry('bad', { details: 'api_key=12345678901234567890' }),
    ];
    const alerts = detectSKPattern(entries);
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('detectSKPattern ignores safe entries', () => {
    const entries = [makeEntry('good', { details: 'normal strategy' })];
    const alerts = detectSKPattern(entries);
    expect(alerts.length).toBe(0);
  });

  // ── User probing ──
  it('detectUserProbing finds sequential enumeration', () => {
    updateAnomalyConfig({ windowMinutes: 1440 });
    const entries = ['u1', 'u2', 'u3', 'u4', 'u5'].map(uid =>
      makeEntry(uid, { ip: '192.168.1.1', userAgent: 'evil-bot' }),
    );
    const alerts = detectUserProbing(entries);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].rule).toBe('USER_PROBING');
  });

  // ── Time anomaly ──
  it('detectTimeAnomaly detects off-hours activity', () => {
    const base = new Date();
    const entries: any[] = [];
    for (let i = 0; i < 55; i++) {
      const ts = new Date(base);
      ts.setHours(3, i % 60, 0, 0); // 03:XX
      entries.push(makeEntry('u1', { timestamp: ts.toISOString() }));
    }
    const alerts = detectTimeAnomaly(entries);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].rule).toBe('TIME_ANOMALY');
  });

  // ── Full detectAnomalies ──
  it('detectAnomalies runs all rules', () => {
    const entries: any[] = [];
    for (let i = 0; i < 250; i++) entries.push(makeEntry('hacker'));
    const alerts = detectAnomalies(entries);
    expect(alerts.length).toBeGreaterThan(0);
  });

  // ── Queue and stats ──
  it('getAnomalyQueue returns alerts', () => {
    updateAnomalyConfig({ rateThreshold: 5 });
    const entries: any[] = [];
    for (let i = 0; i < 10; i++) entries.push(makeEntry('u1'));
    detectAnomalies(entries);
    const queue = getAnomalyQueue();
    expect(queue.length).toBeGreaterThan(0);
  });

  it('getAnomalyStats returns breakdown', () => {
    updateAnomalyConfig({ rateThreshold: 5 });
    const entries: any[] = [];
    for (let i = 0; i < 10; i++) entries.push(makeEntry('u1'));
    detectAnomalies(entries);
    const stats = getAnomalyStats();
    expect(stats.totalAlerts).toBeGreaterThan(0);
    expect(stats.byRule).toHaveProperty('RATE_ANOMALY');
  });

  it('clearAnomalyQueue empties alerts', () => {
    updateAnomalyConfig({ rateThreshold: 5 });
    const entries: any[] = [];
    for (let i = 0; i < 10; i++) entries.push(makeEntry('u1'));
    detectAnomalies(entries);
    clearAnomalyQueue();
    expect(getAnomalyQueue().length).toBe(0);
  });
});

// ============================================================================
// G13: Rate Limiter
// ============================================================================
describe('R179 G13: Rate Limiter', () => {
  let checkRateLimit: any, getRemainingCalls: any;
  let resetUserRateLimit: any, resetAllRateLimits: any;
  let getRateLimitStats: any, getRateLimitConfig: any;
  let updateRateLimitConfig: any, resetRateLimitConfig: any;

  beforeEach(async () => {
    const mod = await import('../../../electron/engine/agents/rate-limiter');
    checkRateLimit = mod.checkRateLimit;
    getRemainingCalls = mod.getRemainingCalls;
    resetUserRateLimit = mod.resetUserRateLimit;
    resetAllRateLimits = mod.resetAllRateLimits;
    getRateLimitStats = mod.getRateLimitStats;
    getRateLimitConfig = mod.getRateLimitConfig;
    updateRateLimitConfig = mod.updateRateLimitConfig;
    resetRateLimitConfig = mod.resetRateLimitConfig;
    resetAllRateLimits();
  });

  it('checkRateLimit allows first 5 calls', () => {
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit('test-user');
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(4 - i);
    }
  });

  it('checkRateLimit blocks 6th call', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('test-user-6');
    const r6 = checkRateLimit('test-user-6');
    expect(r6.allowed).toBe(false);
    expect(r6.remaining).toBe(0);
    expect(r6.reason).toContain('Rate limit exceeded');
  });

  it('getRemainingCalls returns counts', () => {
    checkRateLimit('u1');
    checkRateLimit('u1');
    const remaining = getRemainingCalls('u1');
    expect(remaining.minuteRemaining).toBe(3);
  });

  it('resetUserRateLimit clears specific user', () => {
    for (let i = 0; i < 4; i++) checkRateLimit('userX');
    resetUserRateLimit('userX');
    expect(checkRateLimit('userX').remaining).toBe(4);
  });

  it('resetAllRateLimits clears all users', () => {
    checkRateLimit('a');
    checkRateLimit('b');
    resetAllRateLimits();
    expect(checkRateLimit('a').remaining).toBe(4);
    expect(checkRateLimit('b').remaining).toBe(4);
  });

  it('getRateLimitStats tracks blocked', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('spammer');
    checkRateLimit('spammer'); // this should be blocked
    const stats = getRateLimitStats();
    expect(stats.totalBlocked).toBeGreaterThanOrEqual(1);
  });

  it('updateRateLimitConfig changes limits', () => {
    updateRateLimitConfig({ maxPerMinute: 2 });
    expect(checkRateLimit('low-limit').allowed).toBe(true);
    expect(checkRateLimit('low-limit').allowed).toBe(true);
    expect(checkRateLimit('low-limit').allowed).toBe(false);
    updateRateLimitConfig({ maxPerMinute: 5 });
  });

  it('disabled config allows unlimited', () => {
    updateRateLimitConfig({ enabled: false });
    const r = checkRateLimit('unlimited');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(Infinity);
    resetRateLimitConfig(); // restore for subsequent tests
  });

  it('different users have independent limits', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('userA');
    expect(checkRateLimit('userA').allowed).toBe(false);
    expect(checkRateLimit('userB').allowed).toBe(true);
  });
});

// ============================================================================
// Rename: dawn-whales → tradingeasy
// ============================================================================
describe('R179 Rename: engine/factors + engine/agents', () => {
  it('etf-price-source.ts uses tradingeasy not dawn-whales', () => {
    const c = require('fs').readFileSync(
      require('path').join(__dirname, '../../../electron/engine/factors/etf-price-source.ts'),
      'utf-8',
    );
    expect(c).not.toContain('dawn-whales');
    expect(c).toContain('tradingeasy');
  });

  it('factor-snapshot-store.ts uses tradingeasy not dawn-whales', () => {
    const c = require('fs').readFileSync(
      require('path').join(__dirname, '../../../electron/engine/factors/factor-snapshot-store.ts'),
      'utf-8',
    );
    expect(c).not.toContain('dawn-whales');
    expect(c).toContain('tradingeasy');
  });

  it('ai-gateway-server.ts has no Dawn Whales/dawn-whales', () => {
    const c = require('fs').readFileSync(
      require('path').join(__dirname, '../../../electron/engine/agents/ai-gateway-server.ts'),
      'utf-8',
    );
    expect(c).not.toContain('Dawn Whales');
    expect(c).not.toContain('dawn-whales');
  });

  it('no dawn-whales references in engine/factors dir', () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '../../../electron/engine/factors');
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.ts'));
    let found = false;
    for (const f of files) {
      const c = fs.readFileSync(path.join(dir, f), 'utf-8');
      if (c.includes('dawn-whales')) {
        found = true;
        console.log(`  Still has dawn-whales: ${f}`);
      }
    }
    expect(found).toBe(false);
  });

  it('no dawn-whales references in engine/agents dir', () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '../../../electron/engine/agents');
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.ts'));
    let found = false;
    for (const f of files) {
      const c = fs.readFileSync(path.join(dir, f), 'utf-8');
      if (c.includes('dawn-whales') || c.includes('Dawn Whales')) {
        found = true;
        console.log(`  Still has branding: ${f}`);
      }
    }
    expect(found).toBe(false);
  });
});

// Helper
function useConfig(cfg: Record<string, unknown>) {
  // Dynamic import not great for config but works for test isolation
}
