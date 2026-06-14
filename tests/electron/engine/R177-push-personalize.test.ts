/**
 * R177 JVS: G3-G4续 push frequency control + factor filtering + personalization
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorDailyReport,
  type DailyReport,
  type FactorDaySnapshot,
} from '../../../electron/engine/factors/factor-daily-report';

// ============================================================================
// R177 G3续: Push frequency control
// ============================================================================
describe('R177 G3续: Push frequency control', () => {
  let report: FactorDailyReport;
  let dailyRpt: DailyReport;

  beforeEach(async () => {
    report = FactorDailyReport.getInstance();
    dailyRpt = await report.generateDailyReport('US');
    // Reset all limits before each test
    report.resetDailyLimits();
  });

  it('publishWithRateLimit sends first push successfully', () => {
    const result = report.publishWithRateLimit(dailyRpt, 'user-A', ['telegram']);
    expect(result.sent).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('publishWithRateLimit blocks second same-day push', () => {
    const r1 = report.publishWithRateLimit(dailyRpt, 'user-B', ['telegram']);
    expect(r1.sent).toBe(true);

    const r2 = report.publishWithRateLimit(dailyRpt, 'user-B', ['email']);
    expect(r2.sent).toBe(false);
    expect(r2.reason).toContain('每日推送已达上限');
  });

  it('publishWithRateLimit allows push for different users', () => {
    const r1 = report.publishWithRateLimit(dailyRpt, 'user-C', ['telegram']);
    expect(r1.sent).toBe(true);

    // Reset limit for user-C, allow user-D
    const r2 = report.publishWithRateLimit(dailyRpt, 'user-D', ['telegram']);
    expect(r2.sent).toBe(true);
  });

  it('getPushState returns state after push', () => {
    report.publishWithRateLimit(dailyRpt, 'user-E', ['telegram']);
    const state = report.getPushState('user-E');
    expect(state).not.toBeNull();
    expect(state!.pushCount).toBe(1);

    const today = new Date().toISOString().split('T')[0];
    expect(state!.lastPushDate).toBe(today);
  });

  it('getPushState returns null for unknown user', () => {
    const state = report.getPushState('nobody');
    expect(state).toBeNull();
  });

  it('resetPushState clears specific user', () => {
    report.publishWithRateLimit(dailyRpt, 'user-F', ['telegram']);
    expect(report.getPushState('user-F')).not.toBeNull();

    report.resetPushState('user-F');
    expect(report.getPushState('user-F')).toBeNull();
  });

  it('resetDailyLimits clears all users', () => {
    report.publishWithRateLimit(dailyRpt, 'user-G', ['telegram']);
    report.publishWithRateLimit(dailyRpt, 'user-H', ['telegram']);
    expect(report.getPushState('user-H')).not.toBeNull();

    report.resetDailyLimits();
    expect(report.getPushState('user-G')).toBeNull();
    expect(report.getPushState('user-H')).toBeNull();
  });
});

// ============================================================================
// R177 G4续: Factor filtering + personalization
// ============================================================================
describe('R177 G4续: Factor filtering + personalization', () => {
  let report: FactorDailyReport;
  let dailyRpt: DailyReport;

  beforeEach(async () => {
    report = FactorDailyReport.getInstance();
    dailyRpt = await report.generateDailyReport('US');
  });

  it('personalizeReport filters top5/bottom5 to followed factors', () => {
    const followedIds = dailyRpt.top5.slice(0, 3).map(s => s.factorId);

    const personalized = report.personalizeReport(dailyRpt, {
      factorIds: followedIds,
      style: 'momentum',
      market: 'US',
    });

    expect(personalized.top5.length).toBeLessThanOrEqual(3);
    for (const s of personalized.top5) {
      expect(followedIds).toContain(s.factorId);
    }
    for (const s of personalized.bottom5) {
      expect(followedIds).toContain(s.factorId);
    }
    for (const a of personalized.alerts) {
      expect(followedIds).toContain(a.factorId);
    }
  });

  it('personalizeReport filters all alert types', () => {
    const followedIds = dailyRpt.top5.slice(0, 2).map(s => s.factorId);

    // Force create some alerts
    const snaps: FactorDaySnapshot[] = followedIds.map((id, i) => ({
      factorId: id,
      nameCN: `Test Factor ${i}`,
      rank: i + 1,
      dailyIC: 0.05 - i * 0.01,
      rollingIC_5d: 0.04,
      rollingIC_20d: 0.03,
      decayRate: 0.002 * i,
      crowdingScore: 0.4 + i * 0.2,
      isAnomaly: i === 1,
      trend: i === 0 ? 'up' : 'down',
      changePct: 1.5 - i * 0.5,
    }));

    const personalized = report.personalizeReport(
      { ...dailyRpt, top5: snaps, bottom5: snaps, alerts: [], decayAlerts: [], crowdingAlerts: [], anomalies: [] },
      { factorIds: followedIds, style: 'value', market: 'US' },
    );

    expect(personalized.anomalies.length).toBeLessThanOrEqual(2);
    for (const a of personalized.anomalies) {
      expect(followedIds).toContain(a.factorId);
    }
  });

  it('personalizeReport generates personalized recommendations', () => {
    const factorId = dailyRpt.top5[0]?.factorId || 'MOM_12M';
    const snap: FactorDaySnapshot = {
      factorId,
      nameCN: '12月动量',
      rank: 1,
      dailyIC: 0.055,
      rollingIC_5d: 0.050,
      rollingIC_20d: 0.045,
      decayRate: 0.0005,
      crowdingScore: 0.3,
      isAnomaly: false,
      trend: 'up',
      changePct: 2.0,
    };

    const personalized = report.personalizeReport(
      { ...dailyRpt, top5: [snap], bottom5: [], anomalies: [], alerts: [], decayAlerts: [], crowdingAlerts: [] },
      { factorIds: [factorId], style: 'momentum', market: 'US' },
    );

    expect(personalized.recommendations.length).toBeGreaterThan(0);
    expect(personalized.summary).toContain('12月动量');
  });

  it('personalizeReport warns when following too few factors', () => {
    const personalized = report.personalizeReport(dailyRpt, {
      factorIds: ['MOM_12M'],
      style: 'value',
      market: 'US',
    });

    const hasWarning = personalized.recommendations.some(r => r.includes('添加互补因子'));
    expect(hasWarning).toBe(true);
  });

  it('personalizeReport with empty followed factors returns original summary', () => {
    const personalized = report.personalizeReport(dailyRpt, {
      factorIds: [],
      style: 'balanced',
      market: 'US',
    });

    expect(personalized.top5).toEqual([]);
    expect(personalized.summary).toContain(dailyRpt.summary);
    // Empty followed factors triggers "few factors" warning
    const hasFewWarning = personalized.recommendations.some(r => r.includes('关注因子较少'));
    expect(hasFewWarning).toBe(true);
  });
});

// ============================================================================
// R177 G3-G4续: generateAndPush full pipeline
// ============================================================================
describe('R177 G3-G4续: generateAndPush integrated pipeline', () => {
  let report: FactorDailyReport;

  beforeEach(() => {
    report = FactorDailyReport.getInstance();
    report.resetDailyLimits();
  });

  it('generateAndPush returns report + push result', async () => {
    const result = await report.generateAndPush(
      'US',
      'user-test-1',
      { factorIds: ['MOM_12M', 'QUAL'], style: 'momentum', market: 'US' },
      undefined,
      ['telegram'],
    );

    expect(result.report).toBeDefined();
    expect(result.report.market).toBe('US');
    expect(result.pushResult.sent).toBe(true);

    // Verify rate limit applied
    const state = report.getPushState('user-test-1');
    expect(state).not.toBeNull();
    expect(state!.pushCount).toBe(1);
  });

  it('generateAndPush rate-limits second call same user', async () => {
    // First push
    const r1 = await report.generateAndPush('HK', 'user-test-2', {
      factorIds: ['HML'], style: 'value', market: 'HK',
    });
    expect(r1.pushResult.sent).toBe(true);

    // Second push same day → blocked
    const r2 = await report.generateAndPush('HK', 'user-test-2', {
      factorIds: ['HML'], style: 'value', market: 'HK',
    });
    expect(r2.pushResult.sent).toBe(false);
    expect(r2.pushResult.reason).toContain('每日推送已达上限');
  });

  it('generateAndPush personalizes when user has followed factors', async () => {
    const result = await report.generateAndPush('US', 'user-test-3', {
      factorIds: ['MOM_12M', 'QUAL', 'HML'],
      style: 'quality',
      market: 'US',
    });

    // Report should be personalized (top5 filtered to followed factors)
    for (const s of result.report.top5) {
      expect(['MOM_12M', 'QUAL', 'HML']).toContain(s.factorId);
    }
  });

  it('generateAndPush skips personalization when no followed factors', async () => {
    const result = await report.generateAndPush('US', 'user-test-4', {
      factorIds: [],
      style: 'balanced',
      market: 'US',
    });

    // No personalization => uses default report
    expect(result.report.top5.length).toBe(5);
  });
});
