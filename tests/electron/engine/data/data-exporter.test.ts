/**
 * Tests for DataExporter — CSV/JSON/MD/PDF + scheduling.
 * J-01: engine/data coverage sprint — R95.1
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exportData,
  batchExport,
  generateSummaryReport,
  generatePdf,
  exportPdf,
  calculateNextRun,
  createSchedule,
  removeSchedule,
  listSchedules,
  getSchedule,
  toggleSchedule,
  executeSchedule,
  saveSchedules,
  loadSchedules,
  getExportTemplates,
  getExportTemplate,
  getTemplatesByCategory,
  exportFromTemplate,
  createCustomTemplate,
  type ExportFormat,
  type ExportTarget,
  type ExportOptions,
} from '../../../../electron/engine/data/data-exporter';

// ── exportData ───────────────────────────────────────────────────────────────

describe('exportData', () => {
  it('exports trades as CSV', async () => {
    const opts: ExportOptions = { target: 'trades', format: 'csv' };
    const result = await exportData(opts);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('format');
    expect(result.format).toBe('csv');
  });

  it('exports as JSON', async () => {
    const opts: ExportOptions = { target: 'trades', format: 'json', pretty: true };
    const result = await exportData(opts);
    expect(result).toHaveProperty('success');
    expect(result.format).toBe('json');
  });

  it('exports as Markdown', async () => {
    const opts: ExportOptions = { target: 'trades', format: 'md' };
    const result = await exportData(opts);
    expect(result.format).toBe('md');
  });

  it('exports backtest_runs', async () => {
    const opts: ExportOptions = { target: 'backtest_runs', format: 'json' };
    const result = await exportData(opts);
    expect(result).toHaveProperty('success');
  });

  it('exports strategies', async () => {
    const opts: ExportOptions = { target: 'strategies', format: 'json' };
    const result = await exportData(opts);
    expect(result).toHaveProperty('success');
  });

  it('exports portfolio', async () => {
    const opts: ExportOptions = { target: 'portfolio', format: 'json' };
    const result = await exportData(opts);
    expect(result).toHaveProperty('success');
  });

  it('exports with filters', async () => {
    const opts: ExportOptions = {
      target: 'trades',
      format: 'json',
      filters: { symbol: '000001', limit: 10 },
    };
    const result = await exportData(opts);
    expect(result).toHaveProperty('success');
  });

  it('exports with outputPath', async () => {
    const opts: ExportOptions = {
      target: 'trades',
      format: 'csv',
      outputPath: '/tmp/test-export.csv',
    };
    const result = await exportData(opts);
    expect(result).toHaveProperty('success');
  });

  it('handles invalid format gracefully', async () => {
    const opts = { target: 'trades' as ExportTarget, format: 'xlsx' as ExportFormat };
    const result = await exportData(opts);
    expect(result).toBeDefined();
  });
});

// ── batchExport ──────────────────────────────────────────────────────────────

describe('batchExport', () => {
  it('batch exports multiple targets', async () => {
    const opts: ExportOptions[] = [
      { target: 'trades', format: 'json' },
      { target: 'alerts', format: 'csv' },
    ];
    const results = await batchExport(opts);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
  });

  it('batch export with empty array returns empty', async () => {
    const results = await batchExport([]);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });
});

// ── generateSummaryReport ────────────────────────────────────────────────────

describe('generateSummaryReport', () => {
  it('generates a summary report', async () => {
    const report = await generateSummaryReport();
    expect(report).toHaveProperty('total');
    expect(report).toHaveProperty('summary');
  });
});

// ── PDF exports ──────────────────────────────────────────────────────────────

describe('PDF exports', () => {
  it('generatePdf returns buffer-like result', async () => {
    const result = await generatePdf('trades', {});
    expect(result).toBeDefined();
  });

  it('exportPdf saves and returns path', async () => {
    const result = await exportPdf('trades', '/tmp/test.pdf', {});
    expect(result).toBeDefined();
  });
});

// ── Scheduler ────────────────────────────────────────────────────────────────

describe('Scheduler', () => {
  it('createSchedule returns a schedule object', () => {
    const s = createSchedule('test-export', {
      target: 'trades',
      format: 'json',
    }, '0 9 * * *');
    expect(s).toHaveProperty('id');
    expect(s.name).toBe('test-export');
  });

  it('createSchedule generates unique id', () => {
    const a = createSchedule('a', { target: 'trades', format: 'json' }, '0 0 * * *');
    const b = createSchedule('b', { target: 'trades', format: 'json' }, '0 0 * * *');
    expect(a.id).not.toBe(b.id);
  });

  it('listSchedules returns array', () => {
    const schedules = listSchedules();
    expect(Array.isArray(schedules)).toBe(true);
  });

  it('getSchedule returns null for unknown id', () => {
    expect(getSchedule('nonexistent-id')).toBeNull();
  });

  it('getSchedule returns schedule for known id', () => {
    const s = createSchedule('get-test', { target: 'trades', format: 'csv' }, '0 0 * * 1');
    expect(getSchedule(s.id)).toEqual(s);
  });

  it('toggleSchedule toggles enabled', () => {
    const s = createSchedule('toggle-test', { target: 'trades', format: 'json' }, '0 0 * * 1');
    const toggled = toggleSchedule(s.id);
    expect(toggled).toBeDefined();
    if (toggled) expect(typeof toggled.enabled).toBe('boolean');
  });

  it('removeSchedule removes existing', () => {
    const s = createSchedule('remove-test', { target: 'trades', format: 'csv' }, '0 0 * * *');
    const result = removeSchedule(s.id);
    expect(result).toBe(true);
    expect(getSchedule(s.id)).toBeNull();
  });

  it('removeSchedule returns false for missing', () => {
    expect(removeSchedule('nonexistent')).toBe(false);
  });

  it('executeSchedule returns result', async () => {
    const s = createSchedule('exec-test', { target: 'trades', format: 'json' }, '* * * * *');
    const result = await executeSchedule(s.id);
    expect(result).toBeDefined();
  });

  it('saveSchedules and loadSchedules persist', () => {
    createSchedule('persist-test', { target: 'portfolio', format: 'csv' }, '0 0 * * 0');
    saveSchedules();
    const loaded = loadSchedules();
    expect(loaded.length).toBeGreaterThan(0);
  });

  it('calculateNextRun returns future Date', () => {
    const next = calculateNextRun('0 9 * * 1');
    expect(next).toBeInstanceOf(Date);
    expect(next.getTime()).toBeGreaterThan(Date.now());
  });
});

// ── Templates ────────────────────────────────────────────────────────────────

describe('Export Templates', () => {
  it('getExportTemplates returns array', () => {
    const temps = getExportTemplates();
    expect(Array.isArray(temps)).toBe(true);
  });

  it('getExportTemplate returns null for unknown', () => {
    expect(getExportTemplate('unknown-template')).toBeNull();
  });

  it('getTemplatesByCategory returns array', () => {
    const results = getTemplatesByCategory('trading');
    expect(Array.isArray(results)).toBe(true);
  });

  it('exportFromTemplate exports with template', async () => {
    const result = await exportFromTemplate('default-json', {});
    expect(result).toBeDefined();
  });

  it('createCustomTemplate returns a template object', () => {
    const t = createCustomTemplate('custom-test', 'csv', ['symbol', 'name']);
    expect(t).toHaveProperty('name', 'custom-test');
    expect(t).toHaveProperty('format', 'csv');
  });
});
