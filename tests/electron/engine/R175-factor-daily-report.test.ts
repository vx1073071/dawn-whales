// ── Vitest tests: R175 G3 — Factor Daily Report ──────────────────────
import { describe, it, expect } from 'vitest';
import { FactorDailyReport, getFactorDailyReport } from '../../../electron/engine/factors/factor-daily-report';
import type { FactorDaySnapshot, DailyReport } from '../../../electron/engine/factors/factor-daily-report';

describe('R175 G3: FactorDailyReport', () => {
  const report = FactorDailyReport.getInstance();

  // ── Daily Report ──
  describe('generateDailyReport()', () => {
    it('generates daily report for US market', async () => {
      const rpt = await report.generateDailyReport('US');
      expect(rpt.reportId).toContain('US');
      expect(rpt.type).toBe('daily');
      expect(rpt.top5.length).toBe(5);
      expect(rpt.bottom5.length).toBe(5);
      expect(rpt.summary.length).toBeGreaterThan(10);
      expect(rpt.marketContext.length).toBeGreaterThan(5);
      expect(rpt.recommendations.length).toBeGreaterThanOrEqual(1);
    });

    it('generates daily report for HK market', async () => {
      const rpt = await report.generateDailyReport('HK');
      expect(rpt.market).toBe('HK');
      expect(rpt.marketContext).toContain('港股');
    });

    it('generates daily report for CRYPTO market', async () => {
      const rpt = await report.generateDailyReport('CRYPTO');
      expect(rpt.market).toBe('CRYPTO');
      expect(rpt.marketContext).toContain('加');
    });

    it('top5 are sorted by dailyIC descending', async () => {
      const rpt = await report.generateDailyReport('US');
      for (let i = 1; i < rpt.top5.length; i++) {
        expect(rpt.top5[i - 1].dailyIC).toBeGreaterThanOrEqual(rpt.top5[i].dailyIC);
      }
    });

    it('bottom5 are sorted by dailyIC ascending (worst first)', async () => {
      const rpt = await report.generateDailyReport('US');
      for (let i = 1; i < rpt.bottom5.length; i++) {
        expect(rpt.bottom5[i - 1].dailyIC).toBeLessThanOrEqual(rpt.bottom5[i].dailyIC);
      }
    });
  });

  describe('generateDailyReport() with custom snapshots', () => {
    const customSnaps: FactorDaySnapshot[] = [
      { factorId: 'MOM_12M', nameCN: '12月动量', rank: 0, dailyIC: 0.055, rollingIC_5d: 0.050, rollingIC_20d: 0.040, decayRate: 0.0007, crowdingScore: 0.6, isAnomaly: false, trend: 'up', changePct: 10 },
      { factorId: 'QUAL', nameCN: '质量', rank: 0, dailyIC: 0.038, rollingIC_5d: 0.042, rollingIC_20d: 0.045, decayRate: 0.0005, crowdingScore: 0.3, isAnomaly: false, trend: 'down', changePct: -9.5 },
      { factorId: 'HML', nameCN: '价值', rank: 0, dailyIC: 0.008, rollingIC_5d: 0.020, rollingIC_20d: 0.035, decayRate: 0.0060, crowdingScore: 0.85, isAnomaly: true, trend: 'down', changePct: -60 },
      { factorId: 'CRYPTO_FUNDING', nameCN: '资金费率', rank: 0, dailyIC: 0.072, rollingIC_5d: 0.058, rollingIC_20d: 0.050, decayRate: 0.0005, crowdingScore: 0.92, isAnomaly: false, trend: 'up', changePct: 24.1 },
      { factorId: 'GROWTH', nameCN: '成长性', rank: 0, dailyIC: 0.005, rollingIC_5d: 0.030, rollingIC_20d: 0.032, decayRate: 0.0055, crowdingScore: 0.15, isAnomaly: true, trend: 'down', changePct: -83.3 },
    ];

    it('detects anomalies', async () => {
      const rpt = await report.generateDailyReport('US', customSnaps);
      expect(rpt.anomalies.length).toBeGreaterThanOrEqual(2);
      expect(rpt.anomalies.some(a => a.factorId === 'HML')).toBe(true);
    });

    it('detects decay alerts', async () => {
      const rpt = await report.generateDailyReport('US', customSnaps);
      expect(rpt.decayAlerts.length).toBeGreaterThanOrEqual(2);
      expect(rpt.decayAlerts.some(a => a.factorId === 'HML' && a.severity === 'critical')).toBe(true);
    });

    it('detects crowding alerts', async () => {
      const rpt = await report.generateDailyReport('US', customSnaps);
      expect(rpt.crowdingAlerts.length).toBeGreaterThanOrEqual(2);
      expect(rpt.crowdingAlerts.some(a => a.factorId === 'CRYPTO_FUNDING')).toBe(true);
    });

    it('top5 contains best performers', async () => {
      const rpt = await report.generateDailyReport('US', customSnaps);
      expect(rpt.top5[0].factorId).toBe('CRYPTO_FUNDING'); // IC 0.072
      expect(rpt.top5[1].factorId).toBe('MOM_12M');       // IC 0.055
    });

    it('bottom5 contains worst performers', async () => {
      const rpt = await report.generateDailyReport('US', customSnaps);
      expect(rpt.bottom5[0].factorId).toBe('GROWTH');   // IC 0.005
    });

    it('has actionable recommendations', async () => {
      const rpt = await report.generateDailyReport('US', customSnaps);
      expect(rpt.recommendations.length).toBeGreaterThanOrEqual(3);
      expect(rpt.recommendations.some(r => r.includes('衰减'))).toBe(true);
      expect(rpt.recommendations.some(r => r.includes('拥挤'))).toBe(true);
    });
  });

  // ── Weekly Report ──
  describe('generateWeeklyReport()', () => {
    it('generates weekly report', async () => {
      const daily = await report.generateDailyReport('US');
      const weekly = await report.generateWeeklyReport('US', [daily]);

      expect(weekly.type).toBe('weekly');
      expect(weekly.bestDay).toBeDefined();
      expect(weekly.worstDay).toBeDefined();
      expect(weekly.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(weekly.consistencyScore).toBeLessThanOrEqual(1);
      expect(weekly.weeklyTrend.length).toBeGreaterThan(0);
    });

    it('weekly trend contains slope data', async () => {
      // Generate 7 days of data
      const dailyReports: DailyReport[] = [];
      for (let i = 0; i < 7; i++) {
        dailyReports.push(await report.generateDailyReport('US'));
      }

      const weekly = await report.generateWeeklyReport('US', dailyReports);
      for (const t of weekly.weeklyTrend) {
        expect(t.trendSlope).toBeDefined();
        expect(t.icByDay.length).toBeLessThanOrEqual(7);
      }
    });
  });

  // ── Publish ──
  describe('publish()', () => {
    it('publishes without throwing', async () => {
      const rpt = await report.generateDailyReport('US');
      expect(() => report.publish(rpt)).not.toThrow();
    });

    it('publishes with channels', async () => {
      const rpt = await report.generateDailyReport('US');
      expect(() => report.publish(rpt, ['telegram', 'discord'])).not.toThrow();
    });
  });

  // ── Singleton ──
  describe('singleton', () => {
    it('getFactorDailyReport returns singleton', () => {
      const a = getFactorDailyReport();
      const b = getFactorDailyReport();
      expect(a).toBe(b);
    });
  });
});
