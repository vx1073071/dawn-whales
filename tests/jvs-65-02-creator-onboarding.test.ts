/**
 * J-65-02 Tests: 创作者入驻引导API (R65 FIX)
 *
 * Tests:
 * 01-02: Start onboarding + params
 * 03: Backtest submission
 * 04: Signal publish
 * 05: Free credits
 * 06: Full flow + stats
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreatorOnboardingServer,
  getOnboardingServer,
  resetOnboardingServer,
} from '../electron/engine/portfolio/creator-onboarding-api';

describe('J-65-02: Creator Onboarding API', () => {
  let server: CreatorOnboardingServer;

  beforeEach(() => {
    resetOnboardingServer();
    server = getOnboardingServer();
  });

  it('01: startOnboarding creates profile at step 1', () => {
    const profile = server.startOnboarding('user-1', 'analyst');
    expect(profile.currentStep).toBe(1);
    expect(profile.agent).toBe('analyst');
    expect(profile.params.temperature).toBe(0.7);
  });

  it('02: setAgentParams advances to step 2', () => {
    server.startOnboarding('user-2', 'trader');
    const profile = server.setAgentParams('user-2', { temperature: 0.8 }, 'aggressive');
    expect(profile.currentStep).toBe(2);
    expect(profile.params.temperature).toBe(0.8);
    expect(profile.temperament).toBe('aggressive');
  });

  it('03: submitBacktest advances to step 3', () => {
    server.startOnboarding('user-3', 'strategist');
    server.setAgentParams('user-3', {});
    const profile = server.submitBacktest('user-3', {
      strategyId: 'strat-1', totalReturn: 0.25, sharpeRatio: 1.8, maxDrawdown: 0.15, winRate: 0.62, totalTrades: 42,
      signature: 'server-signed', backtestedAt: new Date().toISOString(),
    });
    expect(profile.currentStep).toBe(3);
    expect(profile.backtestResult!.sharpeRatio).toBe(1.8);
  });

  it('04: full onboarding flow (5 steps) completes successfully', () => {
    server.startOnboarding('user-4', 'analyst');
    server.setAgentParams('user-4', { maxTokens: 4096 }, 'conservative');
    server.submitBacktest('user-4', {
      strategyId: 'strat-4', totalReturn: 0.30, sharpeRatio: 2.1, maxDrawdown: 0.08, winRate: 0.71, totalTrades: 88,
      signature: 'sig-4', backtestedAt: new Date().toISOString(),
    });
    server.configureSignal('user-4', { name: 'TrendMaster', description: 'MA crossover', tier: 'pro', interval: '4h' });
    const { profile, signal } = server.publishSignal('user-4');

    expect(profile.currentStep).toBe(5);
    expect(profile.completedAt).toBeTruthy();
    expect(signal.tier).toBe('pro');
    expect(signal.price).toBe(5);
    expect(server.getPublishedSignal(signal.id)).toBeTruthy();
  });

  it('05: new creator gets 3 free AI credits after onboarding', () => {
    server.startOnboarding('user-5', 'trader');
    server.setAgentParams('user-5', {});
    server.submitBacktest('user-5', {
      strategyId: 's5', totalReturn: 0.1, sharpeRatio: 1.0, maxDrawdown: 0.2, winRate: 0.5, totalTrades: 20,
      signature: 's', backtestedAt: new Date().toISOString(),
    });
    server.configureSignal('user-5', { name: 's', description: 'd', tier: 'free', interval: '1d' });
    server.publishSignal('user-5');

    expect(server.getFreeAICredits('user-5')).toBe(3);
    expect(server.consumeFreeAICredit('user-5')).toBe(true);
    expect(server.getFreeAICredits('user-5')).toBe(2);
  });

  it('06: stats reflect onboarding progress', () => {
    // Complete user-6
    server.startOnboarding('user-6', 'analyst');
    server.setAgentParams('user-6', {});
    server.submitBacktest('user-6', {
      strategyId: 's6', totalReturn: 0.2, sharpeRatio: 1.5, maxDrawdown: 0.1, winRate: 0.6, totalTrades: 30,
      signature: 's', backtestedAt: new Date().toISOString(),
    });
    server.configureSignal('user-6', { name: 'Strategy A', description: 'desc', tier: 'elite', interval: '1h' });
    server.publishSignal('user-6');

    // In-progress user-7
    server.startOnboarding('user-7', 'trader');

    const stats = server.getStats();
    expect(stats.totalOnboarded).toBe(1);
    expect(stats.inProgress).toBe(1);
    expect(stats.publishedSignals).toBe(1);
  });

  it('07: backtest rejected with too few trades', () => {
    server.startOnboarding('user-8', 'analyst');
    server.setAgentParams('user-8', {});
    expect(() => server.submitBacktest('user-8', {
      strategyId: 'bad', totalReturn: 0.1, sharpeRatio: 0.5, maxDrawdown: 0.3, winRate: 0.4, totalTrades: 5,
      signature: 'x', backtestedAt: new Date().toISOString(),
    })).toThrow('at least 10 trades');
  });
});
