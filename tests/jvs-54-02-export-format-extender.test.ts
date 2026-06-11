/**
 * @vitest-environment node
 * J-54-02: Export Format Extender Tests (15+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExportFormatExtender,
  getExportFormatExtender,
  resetExportFormatExtender,
} from '../electron/engine/analysis/export-format-extender';

const sampleStrategies = [
  { name: 'Alpha Momentum', author: 'Alice', category: 'momentum', sharpe: 2.1, maxDrawdown: -8.5, winRate: 65.2, rating: 4.8, downloads: 1200 },
  { name: 'Beta Reversion', author: 'Bob', category: 'mean-reversion', sharpe: 1.5, maxDrawdown: -12.3, winRate: 58.1, rating: 4.2, downloads: 800 },
  { name: 'Gamma Scalper', author: 'Carol', category: 'scalping', sharpe: 0.9, maxDrawdown: -5.1, winRate: 72.0, rating: 3.9, downloads: 450 },
];

const strategyColumns = [
  { key: 'name', label: 'Strategy' },
  { key: 'author', label: 'Author' },
  { key: 'sharpe', label: 'Sharpe', format: 'number' as const, precision: 2 },
  { key: 'winRate', label: 'Win Rate', format: 'percent' as const, precision: 1 },
  { key: 'rating', label: 'Rating', format: 'number' as const, precision: 1 },
];

// ── Section 1: CSV Export ──────────────────────────────────────────────────

describe('J-54-02-01: CSV Export', () => {
  let ext: ExportFormatExtender;

  beforeEach(() => {
    resetExportFormatExtender();
    ext = getExportFormatExtender();
  });

  it('01: CSV export includes headers and data', () => {
    const result = ext.export(sampleStrategies, {
      format: 'csv', filename: 'test.csv', columns: strategyColumns, includeHeaders: true,
    });
    const lines = result.content.trim().split('\n');
    expect(lines.length).toBe(4); // header + 3 rows
    expect(lines[0]).toContain('Strategy');
    expect(lines[1]).toContain('Alpha Momentum');
  });

  it('02: CSV without headers', () => {
    const result = ext.export(sampleStrategies, {
      format: 'csv', filename: 'test.csv', columns: strategyColumns, includeHeaders: false,
    });
    const lines = result.content.trim().split('\n');
    expect(lines.length).toBe(3); // no header
  });

  it('03: CSV formats numbers with precision', () => {
    const result = ext.export(sampleStrategies, {
      format: 'csv', filename: 'test.csv', columns: strategyColumns,
    });
    expect(result.content).toContain('2.10'); // sharpe 2.10
    expect(result.content).toContain('65.2%'); // win rate
  });

  it('04: CSV sort by column', () => {
    const result = ext.export(sampleStrategies, {
      format: 'csv', filename: 'test.csv', columns: strategyColumns,
      sortBy: 'rating', sortDirection: 'desc',
    });
    const lines = result.content.trim().split('\n');
    expect(lines[1]).toContain('Alpha Momentum'); // highest rating first
  });

  it('05: CSV maxRows limits output', () => {
    const result = ext.export(sampleStrategies, {
      format: 'csv', filename: 'test.csv', columns: strategyColumns, maxRows: 2,
    });
    const lines = result.content.trim().split('\n');
    expect(lines.length).toBe(3); // header + 2 rows
    expect(result.rowCount).toBe(2);
  });

  it('06: TSV uses tab delimiter', () => {
    const result = ext.export(sampleStrategies, {
      format: 'tsv', filename: 'test.tsv', columns: strategyColumns,
    });
    expect(result.content).toContain('\t');
    expect(result.content).not.toContain(',');
  });
});

// ── Section 2: XLSX-XML Export ────────────────────────────────────────────

describe('J-54-02-02: XLSX-XML Export', () => {
  let ext: ExportFormatExtender;

  beforeEach(() => {
    resetExportFormatExtender();
    ext = getExportFormatExtender();
  });

  it('07: XLSX-XML produces valid XML structure', () => {
    const result = ext.export(sampleStrategies, {
      format: 'xlsx-xml', filename: 'test.xml', columns: strategyColumns, title: 'Strategies',
    });
    expect(result.content).toContain('<?xml version');
    expect(result.content).toContain('<Workbook');
    expect(result.content).toContain('<Worksheet');
    expect(result.content).toContain('Alpha Momentum');
  });

  it('08: XLSX-XML numeric cells use Number type', () => {
    const result = ext.export([{ value: 42 }], {
      format: 'xlsx-xml', filename: 'test.xml',
      columns: [{ key: 'value', label: 'Value', format: 'number' }],
    });
    expect(result.content).toContain('ss:Type="Number"');
    expect(result.content).toContain('>42<');
  });
});

// ── Section 3: PDF-HTML Export ─────────────────────────────────────────────

describe('J-54-02-03: PDF-HTML Export', () => {
  let ext: ExportFormatExtender;

  beforeEach(() => {
    resetExportFormatExtender();
    ext = getExportFormatExtender();
  });

  it('09: PDF-HTML produces valid HTML', () => {
    const result = ext.export(sampleStrategies, {
      format: 'pdf-html', filename: 'test.html', columns: strategyColumns,
      title: 'Strategy Report', subtitle: 'Q2 2026',
    });
    expect(result.content).toContain('<!DOCTYPE html>');
    expect(result.content).toContain('Strategy Report');
    expect(result.content).toContain('Q2 2026');
    expect(result.content).toContain('<table>');
  });

  it('10: PDF-HTML negative values get negative class', () => {
    const data = [{ name: 'Test', pnl: -500 }];
    const result = ext.export(data, {
      format: 'pdf-html', filename: 'test.html',
      columns: [{ key: 'name', label: 'Name' }, { key: 'pnl', label: 'P&L', format: 'currency' }],
    });
    expect(result.content).toContain('negative');
    expect(result.content).toContain('-$500.00');
  });
});

// ── Section 4: JSON Export ────────────────────────────────────────────────

describe('J-54-02-04: JSON Export', () => {
  let ext: ExportFormatExtender;

  beforeEach(() => {
    resetExportFormatExtender();
    ext = getExportFormatExtender();
  });

  it('11: JSON export uses column labels as keys', () => {
    const result = ext.export(sampleStrategies, {
      format: 'json', filename: 'test.json', columns: strategyColumns,
    });
    const parsed = JSON.parse(result.content);
    expect(parsed.length).toBe(3);
    expect(parsed[0]).toHaveProperty('Strategy');
    expect(parsed[0]).toHaveProperty('Sharpe');
  });
});

// ── Section 5: Templates ──────────────────────────────────────────────────

describe('J-54-02-05: Templates', () => {
  let ext: ExportFormatExtender;

  beforeEach(() => {
    resetExportFormatExtender();
    ext = getExportFormatExtender();
  });

  it('12: built-in templates are loaded', () => {
    const templates = ext.getAllTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(5);
    expect(templates.some(t => t.type === 'strategy-list')).toBe(true);
    expect(templates.some(t => t.type === 'trade-history')).toBe(true);
  });

  it('13: exportWithTemplate works', () => {
    const result = ext.exportWithTemplate(sampleStrategies, 'tpl-strategy-list');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('csv');
    expect(result!.rowCount).toBe(3);
  });

  it('14: exportWithTemplate with format override', () => {
    const result = ext.exportWithTemplate(sampleStrategies, 'tpl-strategy-list', 'pdf-html');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('pdf-html');
    expect(result!.content).toContain('<!DOCTYPE html>');
  });

  it('15: exportWithTemplate nonexistent template returns null', () => {
    expect(ext.exportWithTemplate([], 'nonexistent')).toBeNull();
  });

  it('16: custom template can be added', () => {
    ext.addTemplate({
      id: 'custom-1',
      name: 'Custom',
      type: 'custom',
      description: 'My custom template',
      columns: [{ key: 'x', label: 'X' }],
      defaultFormat: 'json',
      options: {},
    });
    expect(ext.getTemplate('custom-1')).not.toBeNull();
    const result = ext.exportWithTemplate([{ x: 1 }], 'custom-1');
    expect(result).not.toBeNull();
    expect(result!.format).toBe('json');
  });
});

// ── Section 6: History & Meta ──────────────────────────────────────────────

describe('J-54-02-06: Export History', () => {
  let ext: ExportFormatExtender;

  beforeEach(() => {
    resetExportFormatExtender();
    ext = getExportFormatExtender();
  });

  it('17: export history tracks exports', () => {
    ext.export([], { format: 'csv', filename: 'a.csv', columns: [] });
    ext.export([], { format: 'json', filename: 'b.json', columns: [] });
    expect(ext.getExportHistory().length).toBe(2);
  });

  it('18: sizeBytes is positive', () => {
    const result = ext.export(sampleStrategies, {
      format: 'csv', filename: 'test.csv', columns: strategyColumns,
    });
    expect(result.sizeBytes).toBeGreaterThan(0);
  });
});
