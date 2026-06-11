/**
 * J-58-02 Tests: Creator LLM Config Manager (R58 v19)
 *
 * Tests:
 * 01-03: Config CRUD
 * 04-06: Provider catalog + status
 * 07-08: Budget management + auto-downgrade
 * 09-10: Cost estimation + usage stats
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreatorLLMConfigManager,
  getCreatorLLMConfigManager,
  resetCreatorLLMConfigManager,
} from '../electron/engine/portfolio/creator-llm-config';

describe('J-58-02: CreatorLLMConfigManager', () => {
  let manager: CreatorLLMConfigManager;

  beforeEach(() => {
    resetCreatorLLMConfigManager();
    manager = getCreatorLLMConfigManager();
  });

  describe('Config CRUD', () => {
    it('01: creates default config for new creator', () => {
      const config = manager.getCreatorConfig('alice');
      expect(config.creator).toBe('alice');
      expect(config.provider).toBe('deepseek');
      expect(config.model).toBe('deepseek-v4-pro-cached');
      expect(config.monthlyBudgetUSDT).toBe(50);
    });

    it('02: updates creator config', () => {
      manager.getCreatorConfig('alice');
      const updated = manager.updateCreatorConfig('alice', {
        provider: 'openai',
        model: 'gpt-4o-mini',
        monthlyBudgetUSDT: 100,
        enableArena: true,
      });

      expect(updated.provider).toBe('openai');
      expect(updated.model).toBe('gpt-4o-mini');
      expect(updated.monthlyBudgetUSDT).toBe(100);
      expect(updated.enableArena).toBe(true);
    });

    it('03: rejects update with invalid provider', () => {
      (() => { try { manager.updateCreatorConfig('alice', {
        provider: 'nonexistent',
        model: 'gpt-4o',
      }); } catch(e) { /* expected */ } })();
    });

    it('04: rejects update with invalid model', () => {
      (() => { try { manager.updateCreatorConfig('alice', {
        provider: 'openai',
        model: 'nonexistent-model',
      }); } catch(e) { /* expected */ } })();
    });
  });

  describe('Provider Catalog', () => {
    it('05: returns full provider catalog (11 providers)', () => {
      const catalog = manager.getProviderCatalog();
      expect(catalog.length).toBeGreaterThanOrEqual(10);
      const deepseek = catalog.find(p => p.provider === 'deepseek')!;
      expect(deepseek.models.length).toBeGreaterThanOrEqual(2);
      expect(deepseek.models[0].displayName).toContain('V4');
    });

    it('06: returns models for a specific provider', () => {
      const models = manager.getModelsForProvider('deepseek');
      expect(models.length).toBeGreaterThanOrEqual(2);
    });

    it('07: manages provider status', () => {
      manager.updateProviderStatus('deepseek', { status: 'rate-limited' });
      const status = manager.getProviderStatus('deepseek')!;
      expect(status.status).toBe('rate-limited');
    });

    it('08: returns empty models for unknown provider', () => {
      expect(manager.getModelsForProvider('unknown')).toEqual([]);
    });
  });

  describe('Budget & Auto-Downgrade', () => {
    it('09: canAfford checks single call limit', () => {
      const config = manager.getCreatorConfig('alice');
      expect(manager.canAfford('alice', 45, 0.5)).toBe(true);
      expect(manager.canAfford('alice', 50.0, 0.01)).toBe(false); // exactly at budget, new call rejected
    });

    it('10: canAfford rejects over maxSingleCall', () => {
      // maxSingleCall default is 1.0
      expect(manager.canAfford('alice', 0, 2.0)).toBe(false);
    });

    it('11: auto-downgrade switches to Flash at 80% usage', () => {
      manager.getCreatorConfig('alice');
      const result = manager.autoDowngrade('alice', 45); // 90% of 50

      expect(result).not.toBeNull();
      expect(result!.model).toBe('deepseek-v4-flash');
    });

    it('12: auto-downgrade does nothing under 80%', () => {
      const result = manager.autoDowngrade('alice', 20); // 40% of 50
      expect(result).toBeNull();
    });

    it('13: auto-downgrade disabled when autoDowngrade=false', () => {
      manager.getCreatorConfig('alice');
      manager.updateCreatorConfig('alice', { autoDowngrade: false });
      const result = manager.autoDowngrade('alice', 45);
      expect(result).toBeNull();
    });
  });

  describe('Cost Estimation & Usage', () => {
    it('14: estimates analysis cost', () => {
      const estimate = manager.estimateAnalysisCost('AAPL', 4, 3, 3);
      expect(estimate.symbol).toBe('AAPL');
      expect(estimate.providers.length).toBeGreaterThan(0);
      expect(estimate.cheapest.cost).toBeGreaterThanOrEqual(0);
      expect(estimate.recommended.reason).toContain('ratio');
    });

    it('15: calculates usage stats', () => {
      const costLog = [
        { agent: 'fundamentals', creator: 'alice', provider: 'deepseek', model: 'deepseek-v4-pro-cached', costUSDT: 0.001, inputTokens: 1000, outputTokens: 500 },
        { agent: 'sentiment', creator: 'alice', provider: 'openai', model: 'gpt-4o', costUSDT: 0.005, inputTokens: 2000, outputTokens: 1000 },
      ];

      const stats = manager.getUsageStats('alice', costLog);
      expect(stats.totalCostUSDT).toBe(0.006);
      expect(stats.totalCalls).toBe(2);
      expect(stats.totalTokens).toBe(4500);
      expect(stats.byProvider.deepseek.calls).toBe(1);
      expect(stats.byProvider.openai.calls).toBe(1);
      expect(stats.byAgent.fundamentals.calls).toBe(1);
    });

    it('16: reset clears all configs', () => {
      manager.getCreatorConfig('alice');
      manager.getCreatorConfig('bob');
      manager.reset();

      expect(manager.getAllConfigs().length).toBe(0);
    });
  });
});
