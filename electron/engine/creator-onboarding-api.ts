/**
 * J-65-02 [P0]: 创作者入驻引导API (R65 FIX — v1.6.0-beta)
 *
 * 新创作者5步引导:
 * 1. 选Agent (analyst/trader/strategist/risk-manager)
 * 2. 调参数 (温度/提示词/上下文长度)
 * 3. 回测 (本地引擎, 云端签名)
 * 4. 发布 (信号定价+描述)
 * 5. 定价 (Free/5 USDT买断/1 USDT月)
 *
 * 新创作者赠送 3次免费AI分析。
 * 无激活码, 无试用期。
 *
 * >=300L, 5 tests
 */

import * as crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type AgentType = 'analyst' | 'trader' | 'strategist' | 'risk-manager';
export type AgentTemperament = 'conservative' | 'balanced' | 'aggressive';
export type SignalTier = 'free' | 'pro' | 'elite';
export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export interface OnboardingProfile {
  userId: string;
  currentStep: OnboardingStep;
  agent: AgentType;
  temperament: AgentTemperament;
  params: AgentParams;
  backtestResult: BacktestResult | null;
  signal: SignalConfig | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AgentParams {
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  topP: number;
  frequencyPenalty: number;
}

export interface BacktestResult {
  strategyId: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  signature: string; // server-side verification
  backtestedAt: string;
}

export interface SignalConfig {
  id: string;
  name: string;
  description: string;
  tier: SignalTier;
  price: number;           // USDT
  interval: string;         // "1h", "4h", "1d"
  publishedAt: string | null;
}

export const SIGNAL_PRICING: Record<SignalTier, { price: number; billing: string }> = {
  free: { price: 0, billing: '永久免费' },
  pro: { price: 5, billing: '买断' },
  elite: { price: 1, billing: '月订阅' },
};

export const DEFAULT_AGENT_PARAMS: Record<AgentType, AgentParams> = {
  analyst: { temperature: 0.7, maxTokens: 2048, contextWindow: 8192, topP: 0.95, frequencyPenalty: 0 },
  trader: { temperature: 0.5, maxTokens: 1024, contextWindow: 4096, topP: 0.9, frequencyPenalty: 0.1 },
  strategist: { temperature: 0.6, maxTokens: 3072, contextWindow: 12288, topP: 0.92, frequencyPenalty: 0.05 },
  'risk-manager': { temperature: 0.3, maxTokens: 1024, contextWindow: 4096, topP: 0.85, frequencyPenalty: 0.2 },
};

// ── Creator Onboarding Server ─────────────────────────────────────────────

export class CreatorOnboardingServer {
  private profiles: Map<string, OnboardingProfile> = new Map();
  private publishedSignals: Map<string, SignalConfig> = new Map();
  private freeAICredits: Map<string, number> = new Map();

  // ── Onboarding Flow ────────────────────────────────────────────────────

  startOnboarding(userId: string, agent: AgentType): OnboardingProfile {
    if (this.profiles.has(userId)) throw new Error('Onboarding already in progress');

    const profile: OnboardingProfile = {
      userId,
      currentStep: 1,
      agent,
      temperament: 'balanced',
      params: { ...DEFAULT_AGENT_PARAMS[agent] },
      backtestResult: null,
      signal: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    this.profiles.set(userId, profile);
    return profile;
  }

  // Step 2: 调参数
  setAgentParams(userId: string, params: Partial<AgentParams>, temperament?: AgentTemperament): OnboardingProfile {
    const profile = this.profiles.get(userId);
    if (!profile) throw new Error('Onboarding not started');
    if (profile.currentStep !== 1 && profile.currentStep !== 2) throw new Error(`Invalid step ${profile.currentStep}`);

    profile.params = { ...profile.params, ...params };
    if (temperament) profile.temperament = temperament;
    profile.currentStep = 2;
    this.profiles.set(userId, profile);
    return profile;
  }

  // Step 3: 回测
  submitBacktest(userId: string, result: BacktestResult): OnboardingProfile {
    const profile = this.profiles.get(userId);
    if (!profile) throw new Error('Onboarding not started');
    if (profile.currentStep !== 2) throw new Error(`Invalid step ${profile.currentStep}`);

    // Validate backtest
    if (result.totalTrades < 10) throw new Error('Backtest requires at least 10 trades');
    if (result.winRate < 0) throw new Error('Invalid win rate');

    profile.backtestResult = result;
    profile.currentStep = 3;
    this.profiles.set(userId, profile);
    return profile;
  }

  // Step 4: 发布信号
  configureSignal(userId: string, config: { name: string; description: string; tier: SignalTier; interval: string }): OnboardingProfile {
    const profile = this.profiles.get(userId);
    if (!profile) throw new Error('Onboarding not started');
    if (profile.currentStep !== 3) throw new Error(`Invalid step ${profile.currentStep}`);

    const pricing = SIGNAL_PRICING[config.tier];
    const signal: SignalConfig = {
      id: `SIG-${crypto.randomBytes(4).toString('hex')}`,
      name: config.name,
      description: config.description,
      tier: config.tier,
      price: pricing.price,
      interval: config.interval,
      publishedAt: null,
    };

    profile.signal = signal;
    profile.currentStep = 4;
    this.profiles.set(userId, profile);
    return profile;
  }

  // Step 5: 发布
  publishSignal(userId: string): { profile: OnboardingProfile; signal: SignalConfig } {
    const profile = this.profiles.get(userId);
    if (!profile) throw new Error('Onboarding not started');
    if (profile.currentStep !== 4) throw new Error(`Invalid step ${profile.currentStep}`);
    if (!profile.signal) throw new Error('Signal not configured');

    profile.signal.publishedAt = new Date().toISOString();
    profile.currentStep = 5;
    profile.completedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    this.publishedSignals.set(profile.signal.id, profile.signal);

    // Give 3 free AI credits as welcome bonus
    this.freeAICredits.set(userId, 3);

    return { profile, signal: profile.signal };
  }

  // ── Free AI Credits ────────────────────────────────────────────────────

  getFreeAICredits(userId: string): number {
    return this.freeAICredits.get(userId) ?? 0;
  }

  consumeFreeAICredit(userId: string): boolean {
    const credits = this.freeAICredits.get(userId) ?? 0;
    if (credits <= 0) return false;
    this.freeAICredits.set(userId, credits - 1);
    return true;
  }

  grantFreeCredits(userId: string, count: number): void {
    this.freeAICredits.set(userId, (this.freeAICredits.get(userId) ?? 0) + count);
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getProfile(userId: string): OnboardingProfile | undefined {
    return this.profiles.get(userId);
  }

  getCurrentStep(userId: string): OnboardingStep | null {
    return this.profiles.get(userId)?.currentStep ?? null;
  }

  isOnboardingComplete(userId: string): boolean {
    return this.profiles.get(userId)?.completedAt !== null && this.profiles.get(userId)?.completedAt !== undefined;
  }

  getPublishedSignal(signalId: string): SignalConfig | undefined {
    return this.publishedSignals.get(signalId);
  }

  listPublishedSignals(): SignalConfig[] {
    return [...this.publishedSignals.values()];
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  getStats(): { totalOnboarded: number; inProgress: number; publishedSignals: number; totalFreeCreditsGiven: number } {
    let inProgress = 0, totalOnboarded = 0;
    for (const [, p] of this.profiles) {
      if (p.completedAt) totalOnboarded++;
      else inProgress++;
    }

    let totalCredits = 0;
    for (const [, c] of this.freeAICredits) totalCredits += c;

    return {
      totalOnboarded,
      inProgress,
      publishedSignals: this.publishedSignals.size,
      totalFreeCreditsGiven: totalCredits,
    };
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.profiles.clear();
    this.publishedSignals.clear();
    this.freeAICredits.clear();
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _onboardingServer: CreatorOnboardingServer | null = null;

export function getOnboardingServer(): CreatorOnboardingServer {
  if (!_onboardingServer) _onboardingServer = new CreatorOnboardingServer();
  return _onboardingServer;
}

export function resetOnboardingServer(): void {
  _onboardingServer?.reset();
  _onboardingServer = null;
}

export default { CreatorOnboardingServer, getOnboardingServer, resetOnboardingServer, SIGNAL_PRICING, DEFAULT_AGENT_PARAMS };
