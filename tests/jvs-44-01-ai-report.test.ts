/**
 * JVS-44-01: AI Report Generator Tests
 * Tests for daily/weekly/monthly report generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  type DailyReportData,
  type WeeklyReportData,
  type MonthlyReportData,
} from '../electron/engine/ai-report-generator';

describe('JVS-44-01: AI Report Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Daily Report Generation', () => {
    const dailyData: DailyReportData = {
      date: '2026-06-07',
      portfolioValue: 150000,
      dailyPnl: 2500,
      dailyPnlPct: 1.67,
      topPerformers: [
        { symbol: 'AAPL', pnl: 1200, pnlPct: 3.2 },
        { symbol: 'MSFT', pnl: 800, pnlPct: 2.1 },
        { symbol: 'NVDA', pnl: 600, pnlPct: 4.5 },
      ],
      worstPerformers: [
        { symbol: 'TSLA', pnl: -500, pnlPct: -2.1 },
        { symbol: 'META', pnl: -200, pnlPct: -0.8 },
      ],
      signals: { buy: 5, sell: 3, hold: 10 },
      riskLevel: 'medium',
      alertsTriggered: 2,
    };

    it('should generate daily report with fallback (no API key)', async () => {
      const report = await generateDailyReport(dailyData);
      
      expect(report).toBeDefined();
      expect(report.title).toContain('Daily Report');
      expect(report.title).toContain('2026-06-07');
      expect(report.fallback).toBe(true);
      expect(report.sections.length).toBeGreaterThan(0);
    });

    it('should include portfolio summary in daily report', async () => {
      const report = await generateDailyReport(dailyData);
      
      const summarySection = report.sections.find(s => s.heading.includes('Daily Summary'));
      expect(summarySection).toBeDefined();
      expect(summarySection?.content).toContain('150000');
      expect(summarySection?.content).toContain('2500');
      expect(summarySection?.content).toContain('1.67');
    });

    it('should include top performers in daily report', async () => {
      const report = await generateDailyReport(dailyData);
      
      const topSection = report.sections.find(s => s.heading.includes('Top Performers'));
      expect(topSection).toBeDefined();
      expect(topSection?.content).toContain('AAPL');
      expect(topSection?.content).toContain('1200');
    });

    it('should include risk status in daily report', async () => {
      const report = await generateDailyReport(dailyData);
      
      const riskSection = report.sections.find(s => s.heading.includes('Risk'));
      expect(riskSection).toBeDefined();
      expect(riskSection?.content).toContain('medium');
      expect(riskSection?.content).toContain('2');
    });

    it('should handle high risk level correctly', async () => {
      const highRiskData = { ...dailyData, riskLevel: 'high' as const };
      const report = await generateDailyReport(highRiskData);
      
      const riskSection = report.sections.find(s => s.heading.includes('Risk'));
      expect(riskSection?.content).toContain('high');
      expect(riskSection?.content).toContain('reducing exposure');
    });
  });

  describe('Weekly Report Generation', () => {
    const weeklyData: WeeklyReportData = {
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      weeklyPnl: 8500,
      weeklyPnlPct: 5.67,
      weeklyWinRate: 65.5,
      bestStrategies: [
        { name: 'MA Cross', pnl: 3500, pnlPct: 8.2 },
        { name: 'RSI Reversal', pnl: 2800, pnlPct: 6.1 },
      ],
      worstStrategies: [
        { name: 'Momentum', pnl: -800, pnlPct: -2.3 },
      ],
      weekOverWeekChange: 3.2,
    };

    it('should generate weekly report with fallback', async () => {
      const report = await generateWeeklyReport(weeklyData);
      
      expect(report).toBeDefined();
      expect(report.title).toContain('Weekly Report');
      expect(report.title).toContain('2026-06-01');
      expect(report.title).toContain('2026-06-07');
      expect(report.fallback).toBe(true);
    });

    it('should include weekly summary', async () => {
      const report = await generateWeeklyReport(weeklyData);
      
      const summarySection = report.sections.find(s => s.heading.includes('Weekly Summary'));
      expect(summarySection).toBeDefined();
      expect(summarySection?.content).toContain('8500');
      expect(summarySection?.content).toContain('5.67');
      expect(summarySection?.content).toContain('65.5');
    });

    it('should show week-over-week change', async () => {
      const report = await generateWeeklyReport(weeklyData);
      
      const summarySection = report.sections.find(s => s.heading.includes('Weekly Summary'));
      expect(summarySection?.content).toContain('+3.2');
    });

    it('should include best strategies', async () => {
      const report = await generateWeeklyReport(weeklyData);
      
      const bestSection = report.sections.find(s => s.heading.includes('Best Strategies'));
      expect(bestSection).toBeDefined();
      expect(bestSection?.content).toContain('MA Cross');
      expect(bestSection?.content).toContain('3500');
    });
  });

  describe('Monthly Report Generation', () => {
    const monthlyData: MonthlyReportData = {
      month: '2026-06',
      monthlyPnl: 25000,
      monthlyPnlPct: 16.67,
      monthlySharpe: 1.85,
      monthlySortino: 2.15,
      maxDrawdown: 8.5,
      strategyRanking: [
        { name: 'MA Cross', pnl: 8500, pnlPct: 12.5, sharpe: 2.1 },
        { name: 'RSI Reversal', pnl: 6200, pnlPct: 9.8, sharpe: 1.8 },
        { name: 'Momentum', pnl: 4800, pnlPct: 7.2, sharpe: 1.5 },
      ],
      monthOverMonthChange: 5.8,
    };

    it('should generate monthly report with fallback', async () => {
      const report = await generateMonthlyReport(monthlyData);
      
      expect(report).toBeDefined();
      expect(report.title).toContain('Monthly Report');
      expect(report.title).toContain('2026-06');
      expect(report.fallback).toBe(true);
    });

    it('should include monthly performance metrics', async () => {
      const report = await generateMonthlyReport(monthlyData);
      
      const perfSection = report.sections.find(s => s.heading.includes('Monthly Performance'));
      expect(perfSection).toBeDefined();
      expect(perfSection?.content).toContain('25000');
      expect(perfSection?.content).toContain('16.67');
      expect(perfSection?.content).toContain('1.85');
      expect(perfSection?.content).toContain('2.15');
      expect(perfSection?.content).toContain('8.5');
    });

    it('should include strategy ranking', async () => {
      const report = await generateMonthlyReport(monthlyData);
      
      const rankSection = report.sections.find(s => s.heading.includes('Strategy Ranking'));
      expect(rankSection).toBeDefined();
      expect(rankSection?.content).toContain('MA Cross');
      expect(rankSection?.content).toContain('2.1');
    });

    it('should provide risk assessment', async () => {
      const report = await generateMonthlyReport(monthlyData);
      
      const riskSection = report.sections.find(s => s.heading.includes('Risk'));
      expect(riskSection).toBeDefined();
      expect(riskSection?.content).toContain('LOW');
      expect(riskSection?.content).toContain('Drawdown within acceptable range');
    });

    it('should show month-over-month change', async () => {
      const report = await generateMonthlyReport(monthlyData);
      
      const perfSection = report.sections.find(s => s.heading.includes('Monthly Performance'));
      expect(perfSection?.content).toContain('+5.8');
    });

    it('should handle low drawdown correctly', async () => {
      const lowDrawdownData = { ...monthlyData, maxDrawdown: 5.0 };
      const report = await generateMonthlyReport(lowDrawdownData);
      
      const riskSection = report.sections.find(s => s.heading.includes('Risk'));
      expect(riskSection?.content).toContain('acceptable range');
    });
  });
});
