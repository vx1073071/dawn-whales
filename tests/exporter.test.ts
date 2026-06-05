// ── JVS-106: Data Exporter Tests (vitest) ──────────────────────────────────
import { describe, it, expect } from 'vitest';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function toCsv(headers: string[], rows: any[][]): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsv).join(','));
  return '\uFEFF' + lines.join('\n');
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

describe('CSV Escape', () => {
  it('plain string unchanged', () => expect(escapeCsv('hello')).toBe('hello'));
  it('number to string', () => expect(escapeCsv(123)).toBe('123'));
  it('null becomes empty', () => expect(escapeCsv(null)).toBe(''));
  it('comma triggers quoting', () => expect(escapeCsv('a,b')).toBe('"a,b"'));
  it('double quote escaped', () => expect(escapeCsv('a"b')).toBe('"a""b"'));
  it('newline triggers quoting', () => expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"'));
});

describe('CSV Generation', () => {
  const headers = ['ID', 'Symbol', 'PnL'];
  const data = [['t1', 'US.TQQQ', '250'], ['t2', 'US.AAPL', '-25']];

  it('starts with BOM', () => expect(toCsv(headers, data).startsWith('\uFEFF')).toBe(true));
  it('correct line count', () => expect(toCsv(headers, data).split('\n').length).toBe(3));
  it('contains data', () => expect(toCsv(headers, data)).toContain('US.TQQQ'));
  it('handles empty rows', () => expect(toCsv(headers, []).split('\n').length).toBe(1));
});

describe('File Size Formatting', () => {
  it('0 bytes', () => expect(formatFileSize(0)).toBe('0 B'));
  it('1 KB', () => expect(formatFileSize(1024)).toBe('1.0 KB'));
  it('1 MB', () => expect(formatFileSize(1048576)).toBe('1.0 MB'));
  it('512 bytes', () => expect(formatFileSize(512)).toBe('512.0 B'));
});

describe('Filter Validation', () => {
  function validateFilters(f: any): boolean {
    if (f.startDate && f.endDate && f.startDate > f.endDate) return false;
    if (f.limit !== undefined && f.limit <= 0) return false;
    return true;
  }
  it('empty filters valid', () => expect(validateFilters({})).toBe(true));
  it('valid date range', () => expect(validateFilters({ startDate: '2026-01-01', endDate: '2026-12-31' })).toBe(true));
  it('invalid date range', () => expect(validateFilters({ startDate: '2026-12-31', endDate: '2026-01-01' })).toBe(false));
  it('negative limit invalid', () => expect(validateFilters({ limit: -1 })).toBe(false));
  it('positive limit valid', () => expect(validateFilters({ limit: 100 })).toBe(true));
});
