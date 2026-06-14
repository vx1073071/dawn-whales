/**
 * R182 JVS Tests: Rate Limiter Completion + Anti-Leak Guard
 * P0-12a/b: rate-limiter on AI path + admin API  |  P1-09: anti-leak guard
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// P0-12a: Rate Limiter on AI entry points (file-scan tests)
// ═══════════════════════════════════════════════════════════════════════════
describe('R182 P0-12a: Rate Limiter on AI entry points', () => {
  const fs = require('fs');
  const path = require('path');

  it('nl-parser.ts imports checkRateLimit with rate limit response', () => {
    const c = fs.readFileSync(
      path.join(__dirname, '../../../electron/engine/agents/nl-parser.ts'), 'utf-8');
    expect(c).toContain("from './rate-limiter'");
    expect(c).toContain('checkRateLimit');
    expect(c).toContain('retryAfterMs');
    expect(c).toContain('Too many requests');
  });

  it('ai-factor-advisor.ts imports checkRateLimit with RATE_LIMITED error', () => {
    const c = fs.readFileSync(
      path.join(__dirname, '../../../electron/engine/agents/ai-factor-advisor.ts'), 'utf-8');
    expect(c).toContain("from './rate-limiter'");
    expect(c).toContain('checkRateLimit');
    expect(c).toContain('RATE_LIMITED');
  });

  it('four-agent-orchestrator.ts already has checkRateLimit from R181', () => {
    const c = fs.readFileSync(
      path.join(__dirname, '../../../electron/engine/agents/four-agent-orchestrator.ts'), 'utf-8');
    expect(c).toContain("from './rate-limiter'");
    expect(c).toContain('checkRateLimit');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P0-12b: Rate limit admin API via IPC (file-scan + functional)
// ═══════════════════════════════════════════════════════════════════════════
describe('R182 P0-12b: Rate limit admin IPC handlers', () => {
  const fs = require('fs');
  const path = require('path');

  it('strategy-ipc.ts has 4 admin:rate-limit handlers', () => {
    const c = fs.readFileSync(
      path.join(__dirname, '../../../electron/ipc/strategy-ipc.ts'), 'utf-8');
    expect(c).toContain('admin:rate-limit-stats');
    expect(c).toContain('admin:rate-limit-reset-user');
    expect(c).toContain('admin:rate-limit-reset-all');
    expect(c).toContain('admin:rate-limit-config');
    expect(c).toContain('getRateLimitStats');
    expect(c).toContain('getAllRateStates');
    expect(c).toContain('resetUserRateLimit');
    expect(c).toContain('resetAllRateLimits');
    expect(c).toContain('updateRateLimitConfig');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Rate Limiter: functional tests (import rate-limiter only)
// ═══════════════════════════════════════════════════════════════════════════
describe('R182 Rate limiter functional', () => {
  let checkRateLimit: any,
    getUserRateStats: any,
    getAllRateStates: any,
    resetUserRateLimit: any,
    resetAllRateLimits: any,
    getRateLimitStats: any,
    getRateLimitConfig: any,
    updateRateLimitConfig: any;

  beforeEach(async () => {
    const mod = await import('../../../electron/engine/agents/rate-limiter');
    checkRateLimit = mod.checkRateLimit;
    getUserRateStats = mod.getUserRateStats;
    getAllRateStates = mod.getAllRateStates;
    resetUserRateLimit = mod.resetUserRateLimit;
    resetAllRateLimits = mod.resetAllRateLimits;
    getRateLimitStats = mod.getRateLimitStats;
    getRateLimitConfig = mod.getRateLimitConfig;
    updateRateLimitConfig = mod.updateRateLimitConfig;
    mod.resetAllRateLimits();
    mod.resetRateLimitConfig();
  });

  it('allows 5 requests then blocks 6th', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('u1', 'ai').allowed).toBe(true);
    }
    expect(checkRateLimit('u1', 'ai').allowed).toBe(false);
  });

  it('separate users have independent limits', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('u2', 'ai');
    // u3 should have full remaining (the 5 calls above were on u2)
    expect(checkRateLimit('u3', 'ai').allowed).toBe(true);
    // The call above consumed 1, so 4 remaining
    expect(checkRateLimit('u3', 'ai').remaining).toBe(3);
  });

  it('disable bypasses all checks', () => {
    updateRateLimitConfig({ enabled: false });
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit('u4', 'ai').allowed).toBe(true);
    }
  });

  it('getUserRateStats null for unknown user', () => {
    expect(getUserRateStats('nobody')).toBeNull();
  });

  it('getUserRateStats tracks blocked', () => {
    for (let i = 0; i < 6; i++) checkRateLimit('u5', 'ai');
    expect(getUserRateStats('u5').blockedCount).toBe(1);
  });

  it('getAllRateStates returns all users', () => {
    checkRateLimit('u6', 'ai');
    checkRateLimit('u7', 'ai');
    expect(getAllRateStates().length).toBe(2);
  });

  it('getRateLimitStats aggregates', () => {
    resetAllRateLimits();
    for (let i = 0; i < 7; i++) checkRateLimit('u8-only', 'ai');
    const s = getRateLimitStats();
    expect(s.totalUsers).toBeGreaterThanOrEqual(1);
    expect(s.totalBlocked).toBeGreaterThanOrEqual(1);
  });

  it('resetUserRateLimit clears one user', () => {
    for (let i = 0; i < 6; i++) checkRateLimit('u9', 'ai');
    resetUserRateLimit('u9');
    expect(checkRateLimit('u9', 'ai').allowed).toBe(true);
  });

  it('resetAllRateLimits clears all', () => {
    checkRateLimit('u10', 'ai');
    checkRateLimit('u11', 'ai');
    resetAllRateLimits();
    expect(getAllRateStates().length).toBe(0);
  });

  it('updateRateLimitConfig changes maxPerMinute', () => {
    updateRateLimitConfig({ maxPerMinute: 2 });
    expect(checkRateLimit('u12', 'ai').allowed).toBe(true);
    expect(checkRateLimit('u12', 'ai').allowed).toBe(true);
    expect(checkRateLimit('u12', 'ai').allowed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-09: Anti-Leak Guard — Balance Binary Inference Prevention
// ═══════════════════════════════════════════════════════════════════════════
describe('R182 P1-09: Anti-Leak Guard', () => {
  let isLeakyText: any,
    maskLeakyText: any,
    applyAntiLeakPolicy: any,
    updateAntiLeakConfig: any,
    resetAntiLeakConfig: any;

  beforeEach(async () => {
    const mod = await import('../../../electron/engine/agents/anti-leak-guard');
    isLeakyText = mod.isLeakyText;
    maskLeakyText = mod.maskLeakyText;
    applyAntiLeakPolicy = mod.applyAntiLeakPolicy;
    updateAntiLeakConfig = mod.updateAntiLeakConfig;
    resetAntiLeakConfig = mod.resetAntiLeakConfig;
    resetAntiLeakConfig();
  });

  // ── Chinese leaks ──
  it('detects balance-direct-cn: 余额不足', () => {
    const r = isLeakyText('您的余额不足');
    expect(r.leaked).toBe(true);
    expect(r.leakCategories).toContain('balance-direct-cn');
  });

  it('detects balance-direct-cn: 余额充足', () => {
    expect(isLeakyText('您的余额充足').leaked).toBe(true);
  });

  it('detects balance-numeric-cn: 钱包余额为 1234 USDT', () => {
    const r = isLeakyText('您的钱包余额为 1234 USDT');
    expect(r.leaked).toBe(true);
    expect(r.leakCategories).toContain('balance-numeric-cn');
  });

  it('detects amount-gap-cn: 还需要 50 USDT', () => {
    const r = isLeakyText('您还需要 50 USDT');
    expect(r.leaked).toBe(true);
    expect(r.leakCategories).toContain('amount-gap-cn');
  });

  it('detects billing-leak: 扣费 1 USDT', () => {
    const r = isLeakyText('该次AI推荐将扣费 1 USDT');
    expect(r.leaked).toBe(true);
    expect(r.leakCategories).toContain('billing-leak');
  });

  // ── English leaks ──
  it('detects balance-direct-en: insufficient balance', () => {
    const r = isLeakyText('Your balance is insufficient for this strategy');
    expect(r.leaked).toBe(true);
    expect(r.leakCategories).toContain('balance-direct-en');
  });

  it('detects sufficiency-en: affordable', () => {
    expect(isLeakyText('This is affordable with your balance').leaked).toBe(true);
  });

  it('detects balance-numeric-en: wallet has 5000 USDT', () => {
    const r = isLeakyText('Your wallet has 5000 USDT');
    expect(r.leaked).toBe(true);
  });

  // ── Masking ──
  it('maskLeakyText removes balance inference', () => {
    const r = maskLeakyText('您的余额不足，需要再补 100 USDT');
    expect(r).not.toContain('余额不足');
    expect(r).not.toContain('100 USDT');
  });

  it('maskLeakyText replaces insufficient', () => {
    const r = maskLeakyText('Insufficient funds for the trade');
    expect(r).not.toMatch(/insufficient/i);
  });

  // ── Blocking ──
  it('blockOnLeak blocks multi-token leak', () => {
    const r = applyAntiLeakPolicy(
      '您的余额不足 500 USDT，您钱包里只有 300 USDT，还需要再补 200 USDT');
    expect(r.safe).toBe(false);
    expect(r.action).toBe('block');
  });

  it('blockOnLeak disabled allows masked output', () => {
    updateAntiLeakConfig({ blockOnLeak: false });
    const r = applyAntiLeakPolicy('您的余额不足');
    expect(r.safe).toBe(true);
    expect(r.action).toBe('mask');
    expect(r.text).not.toContain('余额不足');
  });

  // ── Safe text passes ──
  it('passes normal analysis', () => {
    expect(isLeakyText('MACD金叉信号已确认').leaked).toBe(false);
    expect(isLeakyText('RSI指标显示超卖').leaked).toBe(false);
    expect(isLeakyText('Sharpe ratio of 1.8').leaked).toBe(false);
  });

  it('passes trading pair context (not balance)', () => {
    expect(isLeakyText('BTCUSDT price is 52000').leaked).toBe(false);
  });

  it('passes percentage advice', () => {
    expect(isLeakyText('建议仓位控制在 20%').leaked).toBe(false);
  });

  // ── Config ──
  it('disabled passes everything', () => {
    updateAntiLeakConfig({ enabled: false });
    expect(applyAntiLeakPolicy('您的余额不足 500 USDT').safe).toBe(true);
    expect(applyAntiLeakPolicy('您的余额不足 500 USDT').action).toBe('pass');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration: anti-leak wired into ai-output-guard (file-scan)
// ═══════════════════════════════════════════════════════════════════════════
describe('R182 Integration: P1-09 wired into output pipeline', () => {
  const fs = require('fs');
  const path = require('path');

  it('ai-output-guard.ts imports anti-leak-guard', () => {
    const c = fs.readFileSync(
      path.join(__dirname, '../../../electron/engine/security/ai-output-guard.ts'), 'utf-8');
    expect(c).toContain("../agents/anti-leak-guard'");
    expect(c).toContain('applyAntiLeakPolicy');
    expect(c).toContain('BALANCE_INFERENCE_LEAK');
  });

  it('anti-leak-guard.ts module is loadable', async () => {
    const mod = await import('../../../electron/engine/agents/anti-leak-guard');
    expect(typeof mod.isLeakyText).toBe('function');
    expect(typeof mod.maskLeakyText).toBe('function');
    expect(typeof mod.applyAntiLeakPolicy).toBe('function');
    expect(typeof mod.getAntiLeakConfig).toBe('function');
    expect(typeof mod.updateAntiLeakConfig).toBe('function');
  });
});
