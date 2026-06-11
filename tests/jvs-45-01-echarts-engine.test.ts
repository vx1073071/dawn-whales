/**
 * JVS-45-01: ECharts Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EChartsEngine, getEChartsEngine, resetEChartsEngine } from '../electron/engine/analysis/echarts-engine';

describe('JVS-45-01: ECharts Engine', () => {
  let engine: EChartsEngine;

  beforeEach(() => {
    resetEChartsEngine();
    engine = getEChartsEngine();
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const e1 = getEChartsEngine();
      const e2 = getEChartsEngine();
      expect(e1).toBe(e2);
    });

    it('should reset instance', () => {
      const e1 = getEChartsEngine();
      resetEChartsEngine();
      const e2 = getEChartsEngine();
      expect(e1).not.toBe(e2);
    });
  });

  describe('K-Line Chart', () => {
    it('should generate kline chart', () => {
      const data = [
        { time: Date.now() - 60000, open: 100, high: 105, low: 99, close: 103, volume: 1000 },
        { time: Date.now(), open: 103, high: 108, low: 102, close: 106, volume: 1200 },
      ];

      const result = engine.generateKlineChart(data, 'Test K-Line');

      expect(result).toBeDefined();
      expect(result.type).toBe('kline');
      expect(result.title).toBe('Test K-Line');
      expect(result.series.length).toBe(2); // OHLC + volume
    });

    it('should handle empty data', () => {
      const result = engine.generateKlineChart([], 'Empty');
      expect(result).toBeDefined();
      expect(result.series.length).toBe(2);
    });

    it('should include dataZoom for large datasets', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        time: Date.now() - (100 - i) * 60000,
        open: 100 + i,
        high: 105 + i,
        low: 99 + i,
        close: 103 + i,
        volume: 1000 + i * 10,
      }));

      const result = engine.generateKlineChart(data);
      expect(result.dataZoom).toBeDefined();
      expect(result.dataZoom!.length).toBeGreaterThan(0);
    });
  });

  describe('Line Chart', () => {
    it('should generate line chart', () => {
      const labels = ['Jan', 'Feb', 'Mar'];
      const series = [
        { name: 'Series A', data: [10, 20, 30] },
      ];

      const result = engine.generateLineChart(labels, series, 'Test Line');

      expect(result.type).toBe('line');
      expect(result.title).toBe('Test Line');
      expect(result.series.length).toBe(1);
      expect(result.series[0].data).toEqual([10, 20, 30]);
    });

    it('should handle multiple series', () => {
      const labels = ['Jan', 'Feb', 'Mar'];
      const series = [
        { name: 'Series A', data: [10, 20, 30] },
        { name: 'Series B', data: [15, 25, 35] },
      ];

      const result = engine.generateLineChart(labels, series);
      expect(result.series.length).toBe(2);
      expect(result.legend?.show).toBe(true);
    });
  });

  describe('Bar Chart', () => {
    it('should generate bar chart', () => {
      const labels = ['A', 'B', 'C'];
      const series = [{ name: 'Values', data: [10, 20, 30] }];

      const result = engine.generateBarChart(labels, series, 'Test Bar');

      expect(result.type).toBe('bar');
      expect(result.title).toBe('Test Bar');
      expect(result.series.length).toBe(1);
    });
  });

  describe('Pie Chart', () => {
    it('should generate pie chart', () => {
      const data = [
        { name: 'A', value: 30 },
        { name: 'B', value: 70 },
      ];

      const result = engine.generatePieChart(data, 'Test Pie');

      expect(result.type).toBe('pie');
      expect(result.title).toBe('Test Pie');
      expect(result.series[0].data.length).toBe(2);
    });
  });

  describe('Radar Chart', () => {
    it('should generate radar chart', () => {
      const indicators = [
        { name: 'Speed', max: 100 },
        { name: 'Power', max: 100 },
        { name: 'Defense', max: 100 },
      ];
      const series = [{ name: 'Stats', data: [80, 70, 60] }];

      const result = engine.generateRadarChart(indicators, series, 'Test Radar');

      expect(result.type).toBe('radar');
      expect(result.title).toBe('Test Radar');
      expect(result.series[0].data[0].value).toEqual([80, 70, 60]);
    });
  });

  describe('Compare Performance', () => {
    it('should compare multiple strategies', () => {
      const compareData = {
        labels: ['Day 1', 'Day 2', 'Day 3'],
        series: [
          { name: 'Strategy A', data: [0, 5, 10] },
          { name: 'Strategy B', data: [0, 3, 8] },
        ],
      };

      const result = engine.comparePerformance(compareData);

      expect(result.type).toBe('line');
      expect(result.title).toBe('策略收益对比');
      expect(result.series.length).toBe(2);
    });
  });

  describe('Portfolio Allocation', () => {
    it('should generate portfolio pie chart', () => {
      const positions = [
        { symbol: 'AAPL', value: 50000 },
        { symbol: 'GOOGL', value: 30000 },
        { symbol: 'MSFT', value: 20000 },
      ];

      const result = engine.generatePortfolioAllocation(positions);

      expect(result.type).toBe('pie');
      expect(result.title).toBe('资产配置');
      expect(result.series[0].data.length).toBe(3);
    });
  });

  describe('Statistics', () => {
    it('should calculate statistics', () => {
      const data = [10, 20, 30, 40, 50];
      const stats = engine.calculateStats(data);

      expect(stats.mean).toBe(30);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.std).toBeGreaterThan(0);
    });

    it('should handle empty data', () => {
      const stats = engine.calculateStats([]);
      expect(stats.mean).toBe(0);
      expect(stats.std).toBe(0);
    });
  });

  describe('Returns Calculation', () => {
    it('should calculate returns', () => {
      const prices = [100, 110, 105, 115];
      const returns = engine.calculateReturns(prices);

      expect(returns.length).toBe(3);
      expect(returns[0]).toBeCloseTo(0.1, 2);
      expect(returns[1]).toBeCloseTo(-0.0455, 2);
    });
  });

  describe('Moving Average', () => {
    it('should calculate moving average', () => {
      const data = [10, 20, 30, 40, 50];
      const ma = engine.calculateMovingAverage(data, 3);

      expect(ma.length).toBe(3);
      expect(ma[0]).toBe(20); // (10+20+30)/3
      expect(ma[1]).toBe(30); // (20+30+40)/3
      expect(ma[2]).toBe(40); // (30+40+50)/3
    });

    it('should handle insufficient data', () => {
      const data = [10, 20];
      const ma = engine.calculateMovingAverage(data, 5);
      expect(ma.length).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should validate kline data', () => {
      const valid = [
        { time: 1000, open: 100, high: 105, low: 99, close: 103, volume: 1000 },
      ];
      expect(engine.validateKlineData(valid)).toBe(true);

      const invalid = [{ time: 1000, open: 100 }];
      expect(engine.validateKlineData(invalid)).toBe(false);
    });

    it('should validate chart data', () => {
      expect(engine.validateChartData([1, 2, 3])).toBe(true);
      expect(engine.validateChartData([])).toBe(false);
    });
  });

  describe('Chart Types', () => {
    it('should return available chart types', () => {
      const types = engine.getChartTypes();
      expect(types).toContain('kline');
      expect(types).toContain('line');
      expect(types).toContain('bar');
      expect(types).toContain('pie');
      expect(types).toContain('radar');
    });
  });
});
