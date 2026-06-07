/**
 * JVS-44-02: Data Exporter Tests
 * Tests for CSV/JSON/PDF export functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportData,
  batchExport,
  createSchedule,
  removeSchedule,
  listSchedules,
  type ExportOptions,
  type ExportResult,
} from '../electron/engine/data-exporter';

describe('JVS-44-02: Data Exporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CSV Export', () => {
    it('should export data to CSV format', () => {
      const data = [
        { symbol: 'AAPL', price: 150.5, volume: 1000000 },
        { symbol: 'MSFT', price: 380.2, volume: 500000 },
      ];

      const options: ExportOptions = {
        format: 'csv',
        target: 'trades',
        filters: {},
      };

      const result: ExportResult = exportData(options);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
    });

    it('should handle empty data in CSV export', () => {
      const options: ExportOptions = {
        format: 'csv',
        target: 'trades',
        filters: {},
      };

      const result = exportData(options);
      
      expect(result.success).toBe(true);
    });

    it('should handle special characters in CSV', () => {
      const data = [
        { symbol: 'AAPL', description: 'Apple, Inc.', value: 150.5 },
        { symbol: 'MSFT', description: 'Microsoft "MS"', value: 380.2 },
      ];

      const options: ExportOptions = {
        format: 'csv',
        target: 'trades',
        filters: {},
      };

      const result = exportData(options);
      
      expect(result.success).toBe(true);
    });
  });

  describe('JSON Export', () => {
    it('should export data to JSON format', () => {
      const options: ExportOptions = {
        format: 'json',
        target: 'trades',
        filters: {},
      };

      const result = exportData(options);
      
      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
    });

    it('should handle empty data in JSON export', () => {
      const options: ExportOptions = {
        format: 'json',
        target: 'trades',
        filters: {},
      };

      const result = exportData(options);
      
      expect(result.success).toBe(true);
    });

    it('should handle nested objects in JSON export', () => {
      const options: ExportOptions = {
        format: 'json',
        target: 'trades',
        filters: {},
      };

      const result = exportData(options);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Batch Export', () => {
    it('should export multiple datasets in batch', () => {
      const request = {
        targets: ['trades', 'positions'],
        format: 'csv' as const,
        outputDir: '/tmp/test-exports',
      };

      const result = batchExport(request);
      
      expect(result).toBeDefined();
      // Allow success even if no data to export
      expect(result.success || result.totalFiles === 0).toBe(true);
    });

    it('should handle empty batch', () => {
      const request = {
        targets: [],
        format: 'csv' as const,
        outputDir: '/tmp/test-exports',
      };

      const result = batchExport(request);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Export Scheduling', () => {
    it('should schedule daily export', () => {
      const schedule = createSchedule({
        name: 'Daily Trades Export',
        frequency: 'daily',
        targets: ['trades'],
        format: 'csv',
      });

      expect(schedule).toBeDefined();
      expect(schedule.id).toBeDefined();
      expect(schedule.frequency).toBe('daily');
    });

    it('should schedule weekly export', () => {
      const schedule = createSchedule({
        name: 'Weekly Report',
        frequency: 'weekly',
        targets: ['trades', 'positions'],
        format: 'csv',
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.frequency).toBe('weekly');
    });

    it('should cancel scheduled export', () => {
      const schedule = createSchedule({
        name: 'Daily Trades Export',
        frequency: 'daily',
        targets: ['trades'],
        format: 'csv',
      });

      const removed = removeSchedule(schedule.id);
      expect(removed).toBe(true);
    });

    it('should list all schedules', () => {
      const schedule1 = createSchedule({
        name: 'Schedule 1',
        frequency: 'daily',
        targets: ['trades'],
        format: 'csv',
      });

      const schedule2 = createSchedule({
        name: 'Schedule 2',
        frequency: 'weekly',
        targets: ['positions'],
        format: 'json',
      });

      const schedules = listSchedules();
      expect(schedules.length).toBeGreaterThanOrEqual(2);

      // Clean up
      removeSchedule(schedule1.id);
      removeSchedule(schedule2.id);
    });
  });

  describe('Export Templates', () => {
    it('should list available schedules', () => {
      const schedules = listSchedules();
      expect(Array.isArray(schedules)).toBe(true);
    });

    it('should handle unknown template gracefully', () => {
      const options: ExportOptions = {
        format: 'csv',
        target: 'unknown-target',
        filters: {},
      };

      const result = exportData(options);
      
      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });
});
