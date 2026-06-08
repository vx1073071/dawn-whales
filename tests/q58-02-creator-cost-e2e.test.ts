/**
 * @vitest-environment node
 * Q-58-02: 创作者配置 + 成本 E2E 测试 (R58 v19 P0)
 * LLM切换/预算告警/超额停用/成本报表
 *
 * Coverage: >=200L, 16 tests
 * Real API: CreatorLLMConfigManager + AICostMonitor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreatorLLMConfigManager,
  getCreatorLLMConfigManager,
  resetCreatorLLMConfigManager,
} from '../electron/engine/creator-llm-config';
import {
  AICostMonitor,
  getAICostMonitor,
  resetAICostMonitor,
} from '../electron/engine/ai-cost-monitor';

// ── Section 1: Creator Configuration ───────────────────────────────────

describe('Q-58-02-01: Creator LLM Configuration', () => {
  let manager: CreatorLLMConfigManager;

  beforeEach(() => {
    resetCreatorLLMConfigManager();
    manager = getCreatorLLMConfigManager();
  });

  it('01: getCreatorConfig returns valid default', () => {
    const config = manager.getCreatorConfig('default');
    expect(config.provider).toBe('deepseek');
    expect(config.model).toBe('deepseek-v4-pro-cached');
    expect(config.monthlyBudgetUSDT).toBeGreaterThan(0);
    expect(config.autoDowngrade).toBe(true);
  });

  it('02: updateCreatorConfig changes provider/model', () => {
    const updated = manager.updateCreatorConfig('default', {
      provider: 'minimax',
      model: 'MiniMax-M3',
      monthlyBudgetUSDT: 100,
    });
    expect(updated.provider).toBe('minimax');
    expect(updated.model).toBe('MiniMax-M3');
    expect(updated.monthlyBudgetUSDT).toBe(100);
  });

  it('03: updateCreatorConfig with unknown provider throws', () => {
    expect(() => manager.updateCreatorConfig('default', { provider: 'unknown_provider_xyz' }))
      .toThrow('Unknown provider');
  });

  it('04: unknown creator gets default config', () => {
    const config = manager.getCreatorConfig('new_user_999');
    expect(config.creator).toBe('new_user_999');
    expect(config.provider).toBe('deepseek');
  });

  it('05: getProviderCatalog returns all 11 providers', () => {
    const catalog = manager.getProviderCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(11);
    const providers = catalog.map(c => c.provider);
    expect(providers).toContain('deepseek');
    expect(providers).toContain('openai');
    expect(providers).toContain('anthropic');
  });

  it('06: getModelsForProvider returns model list', () => {
    const models = manager.getModelsForProvider('deepseek');
    expect(models.length).toBeGreaterThanOrEqual(3);
  });

  it('07: updateProviderStatus changes online state', () => {
    manager.updateProviderStatus('minimax', { status: 'offline', latencyMs: 9999 });
    const status = manager.getProviderStatus('minimax');
    expect(status?.status).toBe('offline');
  });

  it('08: estimateAnalysisCost returns cost breakdown', () => {
    const estimate = manager.estimateAnalysisCost('AAPL', 4, 3, 2);
    expect(estimate.symbol).toBe('AAPL');
    expect(estimate.cheapest).toBeDefined();
    expect(estimate.recommended).toBeDefined();
    // Recommended is cheapest model — not always 'cached'
    expect(estimate.recommended.provider).toBeTruthy();
    expect(estimate.recommended.model).toBeTruthy();
    expect(estimate.recommended.cost).toBeGreaterThanOrEqual(0);
  });

  it('09: getAllConfigs returns list of configs', () => {
    manager.getCreatorConfig('user_a');
    manager.getCreatorConfig('user_b');
    const all = manager.getAllConfigs();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Section 2: Budget Management ──────────────────────────────────────

describe('Q-58-02-02: Budget Management', () => {
  let monitor: AICostMonitor;

  beforeEach(() => {
    resetAICostMonitor();
    monitor = getAICostMonitor();
  });

  it('10: setCreatorBudget configures monthly budget', () => {
    monitor.setCreatorBudget({
      creator: 'test_creator',
      monthlyLimitUSDT: 50,
      alertThresholdPct: 80,
      stopThresholdPct: 100,
      periodStart: new Date().toISOString(),
    });
    const budget = monitor.getCreatorBudget('test_creator');
    expect(budget).toBeDefined();
    expect(budget!.monthlyLimitUSDT).toBe(50);
    expect(budget!.alertThresholdPct).toBe(80);
    expect(budget!.currentUsageUSDT).toBe(0);
  });

  it('11: recordCost increments budget usage', () => {
    monitor.setCreatorBudget({
      creator: 'test_user',
      monthlyLimitUSDT: 100,
      alertThresholdPct: 80,
      stopThresholdPct: 100,
      periodStart: new Date().toISOString(),
    });
    monitor.recordCost({
      creator: 'test_user',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      inputTokens: 2000,
      outputTokens: 500,
      costUSDT: 0.005,
      agent: 'fundamentals',
      cached: true,
      sessionId: 'sess_01',
      timestamp: new Date().toISOString(),
    });
    const budget = monitor.getCreatorBudget('test_user');
    expect(budget!.currentUsageUSDT).toBeGreaterThan(0);
  });

  it('12: 80%+ usage freezes at 100%', () => {
    monitor.setCreatorBudget({
      creator: 'alert_user',
      monthlyLimitUSDT: 10,
      alertThresholdPct: 80,
      stopThresholdPct: 100,
      periodStart: new Date().toISOString(),
    });
    // Push to 100%+
    monitor.recordCost({
      creator: 'alert_user',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      inputTokens: 2000,
      outputTokens: 500,
      costUSDT: 10.5,
      agent: 'fundamentals',
      cached: false,
      sessionId: 'sess_02',
      timestamp: new Date().toISOString(),
    });
    const budget = monitor.getCreatorBudget('alert_user');
    expect(budget!.active).toBe(false);
    expect(budget!.currentUsageUSDT).toBeGreaterThanOrEqual(10);
  });

  it('13: canAfford returns false when over budget', () => {
    monitor.setCreatorBudget({
      creator: 'broke_user',
      monthlyLimitUSDT: 5,
      alertThresholdPct: 80,
      stopThresholdPct: 100,
      periodStart: new Date().toISOString(),
    });
    monitor.recordCost({
      creator: 'broke_user',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      inputTokens: 2000,
      outputTokens: 500,
      costUSDT: 5.0,
      agent: 'fundamentals',
      cached: false,
      sessionId: 'sess_03',
      timestamp: new Date().toISOString(),
    });
    expect(monitor.canAfford('broke_user', 0.01)).toBe(false);
  });
});

// ── Section 3: Cost Monitoring ────────────────────────────────────────

describe('Q-58-02-03: Cost Monitoring', () => {
  let monitor: AICostMonitor;

  beforeEach(() => {
    resetAICostMonitor();
    monitor = getAICostMonitor();
  });

  it('14: getCostByAgent aggregates by agent type', () => {
    monitor.recordCost({ creator: 'u1', provider: 'deepseek', model: 'deepseek-v4-pro', inputTokens: 2000, outputTokens: 500, costUSDT: 0.005, agent: 'fundamentals', cached: true, sessionId: 'sa', timestamp: new Date().toISOString() });
    monitor.recordCost({ creator: 'u1', provider: 'deepseek', model: 'deepseek-v4-pro', inputTokens: 1000, outputTokens: 300, costUSDT: 0.003, agent: 'technical', cached: true, sessionId: 'sb', timestamp: new Date().toISOString() });
    const byAgent = monitor.getCostByAgent();
    expect(byAgent.fundamentals).toBeDefined();
    expect(byAgent.technical).toBeDefined();
    expect(byAgent.fundamentals.calls).toBe(1);
  });

  it('15: getCostTrend returns 7-day data', () => {
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      monitor.recordCost({
        creator: 'trend_user',
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
        inputTokens: 2000,
        outputTokens: 500,
        costUSDT: 0.005 + d * 0.001,
        agent: 'fundamentals',
        cached: true,
        sessionId: `sess_d${d}`,
        timestamp: date.toISOString(),
      });
    }
    const trend = monitor.getCostTrend(7);
    expect(trend.length).toBe(7);
    expect(typeof trend[0].date).toBe('string');
    expect(typeof trend[0].cost).toBe('number');
  });

  it('16: anomalies detected on cost > $0.1', () => {
    monitor.recordCost({
      creator: 'anomaly_user',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      inputTokens: 50000,
      outputTokens: 20000,
      costUSDT: 0.15, // > $0.1 threshold
      agent: 'sentiment',
      cached: false,
      sessionId: 'sess_anomaly',
      timestamp: new Date().toISOString(),
    });
    const anomalies = monitor.getAnomalies();
    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies[0].costUSDT).toBe(0.15);
  });

  it('17: exportReport produces valid JSON', () => {
    monitor.recordCost({
      creator: 'export_user',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      inputTokens: 2000,
      outputTokens: 500,
      costUSDT: 0.005,
      agent: 'fundamentals',
      cached: true,
      sessionId: 'sess_exp',
      timestamp: new Date().toISOString(),
    });
    const report = monitor.exportReport('json');
    expect(() => JSON.parse(report)).not.toThrow();
    const parsed = JSON.parse(report);
    expect(parsed.totalRecords).toBe(1);
    expect(parsed.byAgent.fundamentals).toBeDefined();
  });
});
