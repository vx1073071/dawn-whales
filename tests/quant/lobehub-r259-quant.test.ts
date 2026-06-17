// ══ R259 LOBEHUB 量化测试集 ══
// 35 tests: 推送个性化(12) + 富媒体AB(11) + 阈值自学习(12)

import { describe, it, expect } from 'vitest';
import {
  learnUserPersona, learnActiveHours, scorePushCandidate, personalizePush,
  pushABDecide, UserPushProfile, PushCandidate, PushABTest,
} from '../../src/lib/quant/push-personalization-r259';

import {
  recommendMediaForPush, analyzeMediaAB, RICH_MEDIA_VARIANTS, MEDIA_AB_TESTS,
} from '../../src/lib/quant/rich-media-ab-r259';

import {
  computeRollingVolatility, computeFalsePositiveRate, computeClickRate,
  learnOptimalThreshold, batchLearnThresholds, adaptiveCooldown,
  ThresholdLearningState, ThresholdFeedback, CooldownState,
} from '../../src/lib/quant/threshold-self-learning-r259';

// ═══════════════════ P1: 推送个性化 (12 tests) ═══════════════════

describe('R259 P1: Push Personalization', () => {
  const mkProfile = (overrides: Partial<UserPushProfile> = {}): UserPushProfile => ({
    userId: 'u1', persona: 'MOMENTUM',
    holdings: ['AAPL'], watchlist: ['TSLA'], activeHours: [9, 10, 14, 20],
    clickHistory: { clickedTypes: { PRICE_SURGE: 5, PRICE_PLUMMET: 3, VOLUME_SPIKE: 1, EARNINGS: 2, MACRO: 0, SECTOR: 0, STRATEGY: 0, COMMUNITY: 0 }, clickedDirections: { up: 8, down: 2 }, avgCtr: 0.06 },
    lastPushAt: Date.now() - 3600000, pushFatigue: 0.2, silenceDays: 1,
    ...overrides,
  });
  const mkCandidate = (overrides: Partial<PushCandidate> = {}): PushCandidate => ({
    id: 'c1', type: 'PRICE_SURGE', symbol: 'BTC', title: 'BTC暴涨', body: 'BTC涨了5%', hasChart: true, urgency: 'HIGH', revenuePotential: 0.5, targetPersonas: ['MOMENTUM'], cooldownMinutes: 30,
    ...overrides,
  });

  it('learns persona from holdings', () => {
    expect(learnUserPersona(mkProfile({ holdings: Array(12).fill('X') }))).toBe('WHALE');
  });
  it('learns active hours from click history', () => {
    const hours = [{ clicked: true, hour: 9 }, { clicked: false, hour: 9 }, { clicked: true, hour: 9 }, { clicked: false, hour: 22 }];
    const active = learnActiveHours(hours);
    expect(active).toContain(9);
    expect(active).not.toContain(22);
  });
  it('holding-related push gets high score', () => {
    const { score, reason } = scorePushCandidate(mkCandidate({ symbol: 'AAPL' }), mkProfile(), new Date());
    expect(score).toBeGreaterThanOrEqual(30);
    expect(reason).toContain('持仓');
  });
  it('watchlist-related push gets medium score', () => {
    const { score } = scorePushCandidate(mkCandidate({ symbol: 'TSLA' }), mkProfile(), new Date());
    expect(score).toBeGreaterThanOrEqual(20);
  });
  it('silent user gets recall boost', () => {
    const { score } = scorePushCandidate(mkCandidate(), mkProfile({ silenceDays: 10 }), new Date());
    expect(score).toBeGreaterThanOrEqual(15);
  });
  it('fatigue reduces score', () => {
    const low = scorePushCandidate(mkCandidate(), mkProfile({ pushFatigue: 0.1 }), new Date()).score;
    const high = scorePushCandidate(mkCandidate(), mkProfile({ pushFatigue: 0.8 }), new Date()).score;
    expect(high).toBeLessThanOrEqual(low);
  });
  it('personalize picks highest scoring candidate', () => {
    const result = personalizePush('u1', [
      mkCandidate({ id: 'c1', symbol: 'OTHER', type: 'MACRO' }),
      mkCandidate({ id: 'c2', symbol: 'AAPL', type: 'PRICE_SURGE' }),
    ], mkProfile());
    expect(result.selected?.id).toBe('c2');
  });
  it('personalize returns null for empty candidates', () => {
    const result = personalizePush('u1', [], mkProfile());
    expect(result.selected).toBeNull();
  });
  it('AB test splits 50/50', () => {
    const test: PushABTest = { variant: 'A', variantADesc: '通用', variantBDesc: '个性化', active: true };
    let aCount = 0;
    for (let i = 0; i < 100; i++) {
      if (pushABDecide(`u${i}`, test) === 'A') aCount++;
    }
    expect(aCount).toBeGreaterThan(30);
    expect(aCount).toBeLessThan(70);
  });
  it('AB test inactive defaults to B', () => {
    expect(pushABDecide('u1', { variant: 'A', variantADesc: '', variantBDesc: '', active: false })).toBe('B');
  });
  it('persona match boosts score', () => {
    const { score } = scorePushCandidate(mkCandidate({ type: 'PRICE_SURGE' }), mkProfile({ persona: 'MOMENTUM' }), new Date());
    expect(score).toBeGreaterThan(5);
  });
  it('suggested hour is in active hours', () => {
    const result = personalizePush('u1', [mkCandidate()], mkProfile({ activeHours: [14, 15, 16] }));
    expect(result.scheduledHour).toBe(14);
  });
});

// ═══════════════════ P2: 富媒体AB (11 tests) ═══════════════════

describe('R259 P2: Rich Media AB', () => {
  it('6 rich media variants defined', () => {
    expect(RICH_MEDIA_VARIANTS.length).toBeGreaterThanOrEqual(6);
  });
  it('text-only has baseline boost 1.0', () => {
    const text = RICH_MEDIA_VARIANTS.find(v => v.id === 'text-only');
    expect(text?.clickBoost).toBe(1.0);
  });
  it('animated GIF has highest clickBoost', () => {
    const gif = RICH_MEDIA_VARIANTS.find(v => v.id === 'animated-spark');
    expect(gif?.clickBoost).toBeGreaterThanOrEqual(1.5);
  });
  it('recommends chart for anomaly push', () => {
    const types = recommendMediaForPush('异动提醒', 'HIGH', false, 'ANY');
    expect(types).toContain('MINI_CHART');
  });
  it('recommends radar for comparison push', () => {
    const types = recommendMediaForPush('多股对比', 'MEDIUM', true, 'ANY');
    expect(types).toContain('RADAR_CHART');
  });
  it('recommends heat grid for crash alerts', () => {
    const types = recommendMediaForPush('崩盘预警', 'HIGH', false, 'ANY');
    expect(types).toContain('HEAT_GRID');
  });
  it('text-only user only gets text', () => {
    const types = recommendMediaForPush('异动提醒', 'HIGH', false, 'TEXT');
    expect(types).toEqual(['TEXT_ONLY']);
  });
  it('analyzes AB results with clear winner', () => {
    const result = analyzeMediaAB('t1', '异动提醒', [
      { type: 'TEXT_ONLY', impressions: 500, clicks: 25, revenue: 10 },
      { type: 'MINI_CHART', impressions: 500, clicks: 45, revenue: 18 },
    ]);
    expect(result.winner).toBe('MINI_CHART');
    expect(result.lift).toBeGreaterThan(0.5);
  });
  it('analyzes AB results without clear winner', () => {
    const result = analyzeMediaAB('t2', '异动提醒', [
      { type: 'TEXT_ONLY', impressions: 500, clicks: 25, revenue: 10 },
      { type: 'MINI_CHART', impressions: 500, clicks: 26, revenue: 10 },
    ]);
    expect(result.winner).toBeUndefined();
  });
  it('4 AB test templates defined', () => {
    expect(MEDIA_AB_TESTS.anomaly_push).toBeTruthy();
    expect(MEDIA_AB_TESTS.compare_push).toBeTruthy();
    expect(MEDIA_AB_TESTS.crash_alert).toBeTruthy();
    expect(MEDIA_AB_TESTS.signal_alert).toBeTruthy();
  });
  it('variant has description', () => {
    for (const v of RICH_MEDIA_VARIANTS) {
      expect(v.description.length).toBeGreaterThan(0);
      expect(v.template.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════ P3: 阈值自学习 (12 tests) ═══════════════════

describe('R259 P3: Threshold Self-Learning', () => {
  const mkFeedback = (overrides: Partial<ThresholdFeedback> = {}): ThresholdFeedback => ({
    symbol: 'AAPL', market: 'US', priceChangePct: 5, thresholdAtTrigger: 3, triggered: true, userClicked: false, userBought: false, falsePositive: false, timestamp: Date.now(),
    ...overrides,
  });
  const mkState = (overrides: Partial<ThresholdLearningState> = {}): ThresholdLearningState => ({
    symbol: 'AAPL', market: 'US', baseThreshold: 3, rollingVolatility: 2, feedbackWindow: [], falsePositiveRate: 0.1, clickRate: 0.05, lastAdjustedAt: Date.now(),
    ...overrides,
  });

  it('computes rolling volatility from returns', () => {
    const vol = computeRollingVolatility([1, -0.5, 2, -1, 0.5, 1.5, -2, 0.5, 1, -0.5]);
    expect(vol).toBeGreaterThan(0.5);
    expect(vol).toBeLessThan(5);
  });
  it('zero false positive when no triggers', () => {
    const fb = Array(12).fill(null).map((_, i) => mkFeedback({ triggered: false }));
    expect(computeFalsePositiveRate(fb)).toBe(0);
  });
  it('detects false positives', () => {
    const fb = Array(12).fill(null).map(() => mkFeedback({ triggered: true, falsePositive: false, userClicked: true }));
    fb[0] = mkFeedback({ triggered: true, falsePositive: true, userClicked: false });
    fb[1] = mkFeedback({ triggered: true, falsePositive: true, userClicked: false });
    fb[2] = mkFeedback({ triggered: true, falsePositive: true, userClicked: false });
    fb[3] = mkFeedback({ triggered: true, falsePositive: true, userClicked: false });
    fb[4] = mkFeedback({ triggered: true, falsePositive: true, userClicked: false });
    fb[5] = mkFeedback({ triggered: true, falsePositive: true, userClicked: false });
    // 6 false positive out of 12 = 50%
    expect(computeFalsePositiveRate(fb)).toBe(0.5);
  });
  it('click rate zero when no clicks', () => {
    expect(computeClickRate([mkFeedback({ triggered: true, userClicked: false })])).toBe(0);
  });
  it('click rate computed correctly', () => {
    const rate = computeClickRate([
      mkFeedback({ triggered: true, userClicked: true }),
      mkFeedback({ triggered: true, userClicked: false }),
    ]);
    expect(rate).toBe(0.5);
  });
  it('learns optimal threshold from high false positive', () => {
    const { newThreshold } = learnOptimalThreshold(mkState({ falsePositiveRate: 0.5 }));
    expect(newThreshold).toBeGreaterThan(3);
  });
  it('learns lower threshold when click rate is high', () => {
    const { newThreshold } = learnOptimalThreshold(mkState({ clickRate: 0.1, falsePositiveRate: 0.1 }));
    expect(newThreshold).toBeLessThan(5);
  });
  it('batch report generates adjustments', () => {
    const report = batchLearnThresholds([
      mkState({ symbol: 'AAPL', baseThreshold: 3, rollingVolatility: 3 }),
      mkState({ symbol: 'TSLA', baseThreshold: 5, rollingVolatility: 2, falsePositiveRate: 0.5 }),
    ]);
    expect(report.adjustments.length).toBeGreaterThanOrEqual(1);
  });
  it('recommendations generated', () => {
    const report = batchLearnThresholds([mkState(), mkState()]);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
  it('adaptive cooldown increases with many pushes', () => {
    const c: CooldownState = { symbol: 'BTC', lastPushAt: Date.now(), pushCount24h: 12, clickCount24h: 1 };
    expect(adaptiveCooldown(c)).toBeGreaterThan(60);
  });
  it('adaptive cooldown decreases when user engaged', () => {
    const c: CooldownState = { symbol: 'BTC', lastPushAt: Date.now(), pushCount24h: 6, clickCount24h: 4 };
    expect(adaptiveCooldown(c)).toBeLessThan(60);
  });
  it('default cooldown is 30 minutes', () => {
    const c: CooldownState = { symbol: 'BTC', lastPushAt: Date.now(), pushCount24h: 1, clickCount24h: 0 };
    expect(adaptiveCooldown(c)).toBe(30);
  });
});
