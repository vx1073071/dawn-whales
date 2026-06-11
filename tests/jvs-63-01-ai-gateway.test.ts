/**
 * J-63-01 Tests: AI Gateway /api (R63 v19 — v1.5.0-rc 服务器化)
 *
 * Tests:
 * 01-03: License check, JWT, AI requests
 * 04-06: Cache (hit/miss/eviction)
 * 07-08: Fallback chain
 * 09-10: Rate limiting, stats
 * 11-12: Provider management, edge cases
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AIGatewayServer,
  getAIGateway,
  resetAIGateway,
  generateLicenseId,
  generateActivationCode,
  PROVIDER_PRIORITY,
} from '../electron/engine/agents/ai-gateway-server';

function validLicense() {
  return {
    valid: true,
    licenseId: generateLicenseId(),
    email: 'test@dawnwhales.com',
    plan: 'pro' as const,
    expiresAt: null,
  };
}

describe('J-63-01: AI Gateway /api', () => {
  let gateway: AIGatewayServer;

  beforeEach(() => {
    resetAIGateway();
    gateway = getAIGateway();
  });

  describe('License & JWT', () => {
    it('01: valid license passes check', () => {
      const lic = validLicense();
      gateway.registerLicense(lic);
      expect(gateway.checkLicense(lic.licenseId).valid).toBe(true);
    });

    it('02: expired license returns invalid', () => {
      const lic = { ...validLicense(), expiresAt: '2020-01-01T00:00:00.000Z' };
      gateway.registerLicense(lic);
      expect(gateway.checkLicense(lic.licenseId).valid).toBe(false);
    });

    it('03: JWT round-trip works', () => {
      const payload = { sub: 'user1', licenseId: 'DW-TEST' };
      const secret = 'dawn-whales-secret';
      const token = AIGatewayServer.generateJWT(payload, secret);
      const decoded = AIGatewayServer.verifyJWT(token, secret);
      expect(decoded?.sub).toBe('user1');
    });

    it('04: JWT verification fails with wrong secret', () => {
      const token = AIGatewayServer.generateJWT({ sub: 'x' }, 'secret1');
      expect(AIGatewayServer.verifyJWT(token, 'wrong-secret')).toBeNull();
    });
  });

  describe('AI Requests', () => {
    it('05: AI request with valid license succeeds', async () => {
      const lic = validLicense();
      gateway.registerLicense(lic);
      const res = await gateway.handleAIRequest({
        agent: 'analyst', systemPrompt: 'You are an analyst', userPrompt: 'Analyze market',
      }, lic.licenseId);
      expect(res.id.startsWith('AI-')).toBe(true);
      expect(res.model).toBe('deepseek-v4-pro');
      expect(res.cached).toBe(false);
    });

    it('06: AI request with invalid license throws', async () => {
      await expect(gateway.handleAIRequest({
        agent: 'analyst', systemPrompt: 'x', userPrompt: 'y',
      }, 'INVALID-LIC')).rejects.toThrow();
    });

    it('07: cost is calculated per token', async () => {
      const lic = validLicense();
      gateway.registerLicense(lic);
      const res = await gateway.handleAIRequest({
        agent: 'strategist', systemPrompt: 'A'.repeat(1000), userPrompt: 'B'.repeat(500),
      }, lic.licenseId);
      expect(res.cost).toBeGreaterThan(0);
      expect(res.usage.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('Cache', () => {
    it('08: identical request returns cached response', async () => {
      const lic = validLicense();
      gateway.registerLicense(lic);
      const req = { agent: 'analyst' as const, systemPrompt: 'Analyze BTC', userPrompt: 'What is the trend?' };

      const res1 = await gateway.handleAIRequest(req, lic.licenseId);
      const res2 = await gateway.handleAIRequest(req, lic.licenseId);

      expect(res2.cached).toBe(true);
      expect(res2.content).toBe(res1.content);
      expect(gateway.getCacheHitRate()).toBeGreaterThanOrEqual(0.5);
    });

    it('09: different requests produce cache misses', async () => {
      const lic = validLicense();
      gateway.registerLicense(lic);

      await gateway.handleAIRequest({ agent: 'analyst', systemPrompt: 'A', userPrompt: 'X' }, lic.licenseId);
      await gateway.handleAIRequest({ agent: 'analyst', systemPrompt: 'A', userPrompt: 'Y' }, lic.licenseId);

      const stats = gateway.getStats();
      expect(stats.cacheMisses).toBe(2);
    });
  });

  describe('Fallback Chain', () => {
    it('10: fallback when preferred provider is down', async () => {
      const lic = validLicense();
      gateway.registerLicense(lic);
      gateway.setProviderDown(PROVIDER_PRIORITY[0]);

      const res = await gateway.handleAIRequest({ agent: 'analyst', systemPrompt: 'X', userPrompt: 'Y' }, lic.licenseId);
      expect(res.model).toBe(PROVIDER_PRIORITY[1]);
      expect(gateway.getStats().fallbacks).toBe(1);
    });

    it('11: all priority providers down → use any available', async () => {
      const lic = validLicense();
      gateway.registerLicense(lic);
      PROVIDER_PRIORITY.forEach(p => gateway.setProviderDown(p));

      const res = await gateway.handleAIRequest({ agent: 'analyst', systemPrompt: 'X', userPrompt: 'Y' }, lic.licenseId);
      expect(res.model).toBeTruthy();
    });

    it('12: all providers down throws', async () => {
      // Set ALL providers down
      const allIds = ['deepseek-v4-pro','deepseek-flash','minimax-abab','moonshot-v1','zhipu-glm4','qwen-max','ernie-4','hunyuan-pro','spark-v4','doubao-pro','yi-large'];
      allIds.forEach(p => gateway.setProviderDown(p as any));
      const lic = validLicense();
      gateway.registerLicense(lic);

      await expect(gateway.handleAIRequest({ agent: 'analyst', systemPrompt: 'X', userPrompt: 'Y' }, lic.licenseId)).rejects.toThrow();
    });
  });

  describe('Rate Limiting', () => {
    it('13: requests within limit succeed', () => {
      const rateOk = gateway.checkRateLimit('lic-ok', 5);
      expect(rateOk).toBe(true);
    });

    it('14: requests over limit are blocked', () => {
      for (let i = 0; i < 10; i++) gateway.checkRateLimit('lic-heavy', 10);
      expect(gateway.checkRateLimit('lic-heavy', 10)).toBe(false);
    });
  });

  describe('Stats', () => {
    it('15: stats reflect request count', async () => {
      const lic = validLicense();
      gateway.registerLicense(lic);
      await gateway.handleAIRequest({ agent: 'analyst', systemPrompt: 'A', userPrompt: 'B' }, lic.licenseId);
      await gateway.handleAIRequest({ agent: 'trader', systemPrompt: 'C', userPrompt: 'D' }, lic.licenseId);

      const stats = gateway.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalCost).toBeGreaterThan(0);
    });
  });
});
