// ── QClaw R40: DataExporter Tests ───────────────────────────────────────────
// Tests exportData(), batchExport(), generateSummaryReport().
// app.getPath is unavailable in jsdom — use outputPath to avoid Electron dependency.
// The DB layer returns empty rows without crashing when getDb() is null.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportData, batchExport, generateSummaryReport, type ExportTarget, type ExportFormat } from '../electron/engine/data/data-exporter';

// All targets and formats supported by data-exporter
const allTargets: ExportTarget[] = ['trades', 'backtest_runs', 'strategies', 'kline_cache', 'alerts', 'portfolio'];
const allFormats: ExportFormat[] = ['csv', 'json', 'md'];

// ── Helpers ────────────────────────────────────────────────────────────────

function tempDir(): string {
  return 'C:\\temp\\dawn-whales-test-exports';
}

// ── 1. exportData: basic shape ───────────────────────────────────────────

describe('DataExporter: exportData basic shape', () => {
  for (const target of allTargets) {
    for (const format of allFormats) {
      it(`${target} × ${format} returns ExportResult with required fields`, () => {
        // Use outputPath to bypass app.getPath (Electron unavailable in jsdom)
        const result = exportData({ target, format, outputPath: tempDir() });
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('rowCount');
        expect(result).toHaveProperty('fileSizeBytes');
        expect(result).toHaveProperty('format', format);
        expect(result).toHaveProperty('target', target);
      });
    }
  }
});

// ── 2. exportData: success with empty data ───────────────────────────────

describe('DataExporter: exportData with no DB (empty rows)', () => {
  // When getDb() is null the function queries → [] → still writes an empty file
  for (const target of allTargets) {
    for (const format of allFormats) {
      it(`${target} × ${format} succeeds with 0 rows (file written)`, () => {
        const result = exportData({ target, format, outputPath: tempDir() });
        // The operation succeeds: file is written (even if empty)
        expect(result.success).toBe(true);
        expect(result.rowCount).toBe(0);
        expect(result.fileSizeBytes).toBeGreaterThanOrEqual(0);
      });
    }
  }
});

// ── 3. Filters ─────────────────────────────────────────────────────────

describe('DataExporter: filters', () => {
  it('accepts symbol filter', () => {
    const r = exportData({ target: 'trades', format: 'csv', filters: { symbol: 'US.AAPL' }, outputPath: tempDir() });
    expect(r.success).toBe(true);
  });

  it('accepts strategyId filter', () => {
    const r = exportData({ target: 'backtest_runs', format: 'json', filters: { strategyId: 'strat-42' }, outputPath: tempDir() });
    expect(r.success).toBe(true);
  });

  it('accepts date range', () => {
    const r = exportData({ target: 'trades', format: 'csv', filters: { startDate: '2024-01-01', endDate: '2024-12-31' }, outputPath: tempDir() });
    expect(r.success).toBe(true);
  });

  it('accepts combined filters', () => {
    const r = exportData({ target: 'trades', format: 'json', filters: { symbol: 'US.AAPL', strategyId: 's1', startDate: '2024-01-01' }, outputPath: tempDir() });
    expect(r.success).toBe(true);
  });

  it('accepts limit filter', () => {
    const r = exportData({ target: 'alerts', format: 'json', filters: { limit: 10 }, outputPath: tempDir() });
    expect(r.success).toBe(true);
    expect(r.rowCount).toBeLessThanOrEqual(10);
  });

  it('handles limit: 0', () => {
    const r = exportData({ target: 'alerts', format: 'json', filters: { limit: 0 }, outputPath: tempDir() });
    expect(r.success).toBe(true);
  });

  it('handles large limit gracefully', () => {
    const r = exportData({ target: 'alerts', format: 'json', filters: { limit: 999999 }, outputPath: tempDir() });
    expect(r.success).toBe(true);
  });
});

// ── 4. Format options ───────────────────────────────────────────────────

describe('DataExporter: format options', () => {
  it('pretty: true for JSON', () => {
    const r = exportData({ target: 'strategies', format: 'json', pretty: true, outputPath: tempDir() });
    expect(r.success).toBe(true);
  });

  it('pretty: false for JSON', () => {
    const r = exportData({ target: 'strategies', format: 'json', pretty: false, outputPath: tempDir() });
    expect(r.success).toBe(true);
  });

  it('works without pretty option', () => {
    const r = exportData({ target: 'strategies', format: 'json', outputPath: tempDir() });
    expect(r.success).toBe(true);
  });
});

// ── 5. batchExport ──────────────────────────────────────────────────────

describe('DataExporter: batchExport', () => {
  it('exports multiple targets', () => {
    const r = batchExport({ targets: ['trades', 'strategies'], format: 'csv', outputDir: tempDir() });
    expect(r).toHaveProperty('success');
    expect(r).toHaveProperty('results');
    expect(Array.isArray(r.results)).toBe(true);
    expect(r.results.length).toBe(2);
  });

  it('exports all targets', () => {
    const r = batchExport({ targets: allTargets, format: 'json', outputDir: tempDir() });
    expect(r.results.length).toBe(allTargets.length);
  });

  it('computes totalFiles and totalSizeBytes', () => {
    const r = batchExport({ targets: ['trades', 'alerts'], format: 'csv', outputDir: tempDir() });
    expect(typeof r.totalFiles).toBe('number');
    expect(typeof r.totalSizeBytes).toBe('number');
    // Empty DB → no files written → totalFiles: 0 (only non-empty writes are counted)
    expect(r.totalFiles).toBe(0);
  });

  it('returns outputDir', () => {
    const r = batchExport({ targets: ['trades'], format: 'csv', outputDir: tempDir() });
    expect(typeof r.outputDir).toBe('string');
  });

  it('accepts custom outputDir', () => {
    const customDir = 'C:\\temp\\custom-test-dir';
    const r = batchExport({ targets: ['strategies'], format: 'json', outputDir: customDir });
    expect(r.outputDir).toContain('custom-test-dir');
  });

  it('accepts filters in batch', () => {
    const r = batchExport({ targets: ['trades'], format: 'csv', filters: { symbol: 'US.TQQQ' }, outputDir: tempDir() });
    expect(r.success).toBe(true);
  });

  it('handles empty targets array', () => {
    const r = batchExport({ targets: [], format: 'csv', outputDir: tempDir() });
    expect(r.results.length).toBe(0);
    expect(r.totalFiles).toBe(0);
    expect(r.totalSizeBytes).toBe(0);
  });

  it('batchExport with csv and md formats', () => {
    const rCsv = batchExport({ targets: ['trades'], format: 'csv', outputDir: tempDir() });
    expect(rCsv.results[0]?.format).toBe('csv');
    const rMd = batchExport({ targets: ['strategies'], format: 'md', outputDir: tempDir() });
    expect(rMd.results[0]?.format).toBe('md');
  });
});

// ── 6. generateSummaryReport ────────────────────────────────────────────

describe('DataExporter: generateSummaryReport', () => {
  it('returns a non-empty string', () => {
    const report = generateSummaryReport();
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });

  it('returns markdown formatted text', () => {
    const report = generateSummaryReport();
    // Markdown headings
    expect(report).toMatch(/^#\s+/m);
  });

  it('contains database or summary info', () => {
    const report = generateSummaryReport();
    expect(report).toMatch(/数据|摘要|Database|Summary|数据库|报告/i);
  });
});

// ── 7. Result shape validation ─────────────────────────────────────────

describe('DataExporter: ExportResult shape', () => {
  it('always includes all required fields', () => {
    const result = exportData({ target: 'trades', format: 'csv', outputPath: tempDir() });
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('rowCount');
    expect(result).toHaveProperty('fileSizeBytes');
    expect(result).toHaveProperty('format', 'csv');
    expect(result).toHaveProperty('target', 'trades');
  });
});

// ── 8. Edge cases ──────────────────────────────────────────────────────

describe('DataExporter: edge cases', () => {
  it('handles all valid targets without crashing', () => {
    for (const target of allTargets) {
      expect(() => exportData({ target, format: 'csv', outputPath: tempDir() })).not.toThrow();
    }
  });

  it('handles empty filters object', () => {
    const r = exportData({ target: 'trades', format: 'csv', filters: {}, outputPath: tempDir() });
    expect(r).toHaveProperty('success');
  });
});
