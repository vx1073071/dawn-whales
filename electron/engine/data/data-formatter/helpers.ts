import log from 'electron-log';
import { EngineError, ErrorCode } from '../../errors';


// ============================================================================
// JVS-88: Data Formatter - Market Data Format Converter
// Converts between various market data formats (CSV, JSON, Markdown, XML, etc.)
// ============================================================================

// --- Interfaces ---






// --- Utility Functions ---

const BOM_UTF8 = '\uFEFF';

function escapeXmlEntities(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function csvEscapeField(value: unknown, delimiter: string, quoteChar: string): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  const needsQuoting =
    str.includes(delimiter) ||
    str.includes(quoteChar) ||
    str.includes('\n') ||
    str.includes('\r');
  if (needsQuoting) {
    const escaped = str.replace(new RegExp(escapeRegExp(quoteChar), 'g'), quoteChar + quoteChar);
    return `${quoteChar}${escaped}${quoteChar}`;
  }
  return str;
}

function csvUnescapeField(field: string, quoteChar: string): string {
  if (field.length >= 2 && field.startsWith(quoteChar) && field.endsWith(quoteChar)) {
    const inner = field.slice(1, -1);
    return inner.replace(new RegExp(escapeRegExp(quoteChar) + escapeRegExp(quoteChar), 'g'), quoteChar);
  }
  return field;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatNumber(value: unknown, precision?: number): string {
  if (typeof value === 'number' && precision !== undefined && precision >= 0) {
    return value.toFixed(precision);
  }
  return String(value ?? '');
}

function formatDate(value: unknown, _dateFormat?: string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value ?? '');
}

function normalizeColumns(row: Record<string, unknown>, columns?: string[]): string[] {
  if (columns && columns.length > 0) {
    return columns;
  }
  return Object.keys(row);
}

function applyRename(key: string, rename?: Record<string, string>): string {
  if (rename && rename[key]) {
    return rename[key];
  }
  return key;
}

function filterAndRenameRow(
  row: Record<string, unknown>,
  columns?: string[],
  rename?: Record<string, string>,
): Record<string, unknown> {
  const cols = columns && columns.length > 0 ? columns : Object.keys(row);
  const result: Record<string, unknown> = {};
  for (const col of cols) {
    if (col in row) {
      const newKey = applyRename(col, rename);
      result[newKey] = row[col];
    }
  }
  return result;
}

function parseCSVLine(line: string, delimiter: string, quoteChar: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === quoteChar) {
        if (i + 1 < line.length && line[i + 1] === quoteChar) {
          current += quoteChar;
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === quoteChar) {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  fields.push(current);
  return fields;
}

function inferColumnTypes(data: unknown[]): Record<string, string> {
  const types: Record<string, string> = {};
  if (data.length === 0) return types;

  const sampleSize = Math.min(data.length, 100);
  for (let i = 0; i < sampleSize; i++) {
    const row = data[i];
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      const val = row[key];
      if (val === null || val === undefined || val === '') continue;
      const currentType = types[key];
      if (!currentType) {
        if (typeof val === 'number') {
          types[key] = 'number';
        } else if (typeof val === 'boolean') {
          types[key] = 'boolean';
        } else if (!isNaN(Number(val)) && String(val).trim() !== '') {
          types[key] = 'number';
        } else {
          types[key] = 'string';
        }
      } else if (currentType === 'number') {
        if (typeof val !== 'number' && isNaN(Number(val))) {
          types[key] = 'string';
        }
      } else if (currentType === 'boolean') {
        if (typeof val !== 'boolean') {
          types[key] = 'string';
        }
      }
    }
  }
  return types;
}

// --- Built-in Format: CSV ---

function csvEncoder(data: unknown[], options?: FormatOptions): string {
  const delimiter = options?.delimiter ?? ',';
  const quoteChar = options?.quoteChar ?? '"';
  const includeHeader = options?.includeHeader !== false;
  const useBom = options?.bom ?? false;
  const precision = options?.numberPrecision;

  if (data.length === 0) {
    return useBom ? BOM_UTF8 : '';
  }

  const processed = data.map((row) => filterAndRenameRow(row, options?.columns, options?.rename));
  const allKeys = new Set<string>();
  for (const row of processed) {
    for (const k of Object.keys(row)) allKeys.add(k);
  }
  const headers = Array.from(allKeys);

  const lines: string[] = [];

  if (includeHeader) {
    lines.push(headers.map((h) => csvEscapeField(h, delimiter, quoteChar)).join(delimiter));
  }

  for (const row of processed) {
    const fields = headers.map((h) => {
      const val = row[h];
      if (typeof val === 'number') {
        return formatNumber(val, precision);
      }
      return csvEscapeField(val, delimiter, quoteChar);
    });
    lines.push(fields.join(delimiter));
  }

  const content = lines.join('\n');
  return useBom ? BOM_UTF8 + content : content;
}

function csvDecoder(input: string | Buffer, options?: FormatOptions): unknown[] {
  let text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  if (text.startsWith(BOM_UTF8)) {
    text = text.slice(1);
  }

  const delimiter = options?.delimiter ?? ',';
  const quoteChar = options?.quoteChar ?? '"';
  const includeHeader = options?.includeHeader !== false;

  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];
  let buffer = '';
  let inQuotes = false;

  for (const rawLine of rawLines) {
    if (buffer) {
      buffer += '\n' + rawLine;
    } else {
      buffer = rawLine;
    }
    for (const ch of buffer) {
      if (ch === quoteChar) inQuotes = !inQuotes;
    }
    if (!inQuotes) {
      if (buffer.trim().length > 0) {
        lines.push(buffer);
      }
      buffer = '';
      inQuotes = false;
    }
  }
  if (buffer.trim().length > 0) {
    lines.push(buffer);
  }

  if (lines.length === 0) return [];

  const result: unknown[] = [];

  if (includeHeader) {
    const headers = parseCSVLine(lines[0], delimiter, quoteChar).map((h) => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter, quoteChar);
      const row: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        const raw = j < values.length ? values[j] : '';
        const num = Number(raw);
        row[headers[j]] = raw !== '' && !isNaN(num) ? num : raw;
      }
      result.push(row);
    }
  } else {
    for (const line of lines) {
      const values = parseCSVLine(line, delimiter, quoteChar);
      result.push(values);
    }
  }

  return result;
}

// --- Built-in Format: JSON ---

function jsonEncoder(data: unknown[], options?: FormatOptions): string {
  const processed = data.map((row) => filterAndRenameRow(row, options?.columns, options?.rename));
  const precision = options?.numberPrecision;

  if (precision !== undefined && precision >= 0) {
    for (const row of processed) {
      for (const key of Object.keys(row)) {
        if (typeof row[key] === 'number') {
          row[key] = Number(row[key].toFixed(precision));
        }
      }
    }
  }

  return JSON.stringify(processed, null, 2);
}

function jsonDecoder(input: string | Buffer, options?: FormatOptions): unknown[] {
  const text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  const trimmed = text.trim();

  if (!trimmed) return [];

  // Try standard JSON array first
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  // Try NDJSON (newline-delimited JSON)
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const result: unknown[] = [];
  for (const line of lines) {
    try {
      result.push(JSON.parse(line));
    } catch {
      log.warn(`[DataFormatter] Failed to parse NDJSON line: ${line.substring(0, 80)}`);
    }
  }
  return result;
}

// --- Built-in Format: NDJSON ---

function ndjsonEncoder(data: unknown[], options?: FormatOptions): string {
  const processed = data.map((row) => filterAndRenameRow(row, options?.columns, options?.rename));
  const precision = options?.numberPrecision;

  const lines: string[] = [];
  for (const row of processed) {
    if (precision !== undefined && precision >= 0) {
      for (const key of Object.keys(row)) {
        if (typeof row[key] === 'number') {
          row[key] = Number(row[key].toFixed(precision));
        }
      }
    }
    lines.push(JSON.stringify(row));
  }
  return lines.join('\n');
}

function ndjsonDecoder(input: string | Buffer, options?: FormatOptions): unknown[] {
  const text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const result: unknown[] = [];
  for (const line of lines) {
    try {
      result.push(JSON.parse(line));
    } catch {
      log.warn(`[DataFormatter] Failed to parse NDJSON line: ${line.substring(0, 80)}`);
    }
  }
  return result;
}

// --- Built-in Format: Markdown ---

function markdownEncoder(data: unknown[], options?: FormatOptions): string {
  if (data.length === 0) return '';

  const processed = data.map((row) => filterAndRenameRow(row, options?.columns, options?.rename));
  const precision = options?.numberPrecision;

  const allKeys = new Set<string>();
  for (const row of processed) {
    for (const k of Object.keys(row)) allKeys.add(k);
  }
  const headers = Array.from(allKeys);

  const formatCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') return formatNumber(val, precision);
    return String(val).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  };

  const headerLine = '| ' + headers.join(' | ') + ' |';
  const separatorLine = '| ' + headers.map(() => '---').join(' | ') + ' |';

  const rows = processed.map((row) => {
    const cells = headers.map((h) => formatCell(row[h]));
    return '| ' + cells.join(' | ') + ' |';
  });

  return [headerLine, separatorLine, ...rows].join('\n');
}

function markdownDecoder(input: string | Buffer, options?: FormatOptions): unknown[] {
  const text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) return [];

  // Find header line and separator
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const next = i + 1 < lines.length ? lines[i + 1].trim() : '';
      if (/^\|[\s\-:|]+\|$/.test(next)) {
        headerIndex = i;
        break;
      }
    }
  }

  if (headerIndex === -1) {
    log.warn('[DataFormatter] Could not find markdown table header');
    return [];
  }

  const parseCells = (line: string): string[] => {
    return line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim().replace(/\\\|/g, '|'));
  };

  const headers = parseCells(lines[headerIndex]);
  const result: unknown[] = [];

  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue;
    const cells = parseCells(line);
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const raw = j < cells.length ? cells[j] : '';
      const num = Number(raw);
      row[headers[j]] = raw !== '' && !isNaN(num) ? num : raw;
    }
    result.push(row);
  }

  return result;
}

// --- Built-in Format: XML ---

function xmlEncoder(data: unknown[], options?: FormatOptions): string {
  const processed = data.map((row) => filterAndRenameRow(row, options?.columns, options?.rename));
  const precision = options?.numberPrecision;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<data>');

  for (const row of processed) {
    lines.push('  <row>');
    for (const key of Object.keys(row)) {
      const safeKey = escapeXmlEntities(key);
      let val = row[key];
      if (typeof val === 'number') {
        val = formatNumber(val, precision);
      }
      const safeVal = escapeXmlEntities(String(val ?? ''));
      lines.push(`    <${safeKey}>${safeVal}</${safeKey}>`);
    }
    lines.push('  </row>');
  }

  lines.push('</data>');
  return lines.join('\n');
}

function xmlDecoder(input: string | Buffer, options?: FormatOptions): unknown[] {
  const text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  const result: unknown[] = [];

  // Simple regex-based XML parser for our row format
  const rowRegex = /<row>([\s\S]*?)<\/row>/g;
  const fieldRegex = /<([^>]+)>([\s\S]*?)<\/\1>/g;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(text)) !== null) {
    const rowContent = rowMatch[1];
    const row: Record<string, unknown> = {};
    let fieldMatch: RegExpExecArray | null;
    fieldRegex.lastIndex = 0;
    while ((fieldMatch = fieldRegex.exec(rowContent)) !== null) {
      const key = unescapeXmlEntities(fieldMatch[1]);
      const rawVal = unescapeXmlEntities(fieldMatch[2]);
      const num = Number(rawVal);
      row[key] = rawVal !== '' && !isNaN(num) ? num : rawVal;
    }
    result.push(row);
  }

  return result;
}

// --- Built-in Format: Parquet-like JSON (Columnar) ---

function columnarEncoder(data: unknown[], options?: FormatOptions): string {
  const processed = data.map((row) => filterAndRenameRow(row, options?.columns, options?.rename));
  const precision = options?.numberPrecision;

  const columns: Record<string, unknown[]> = {};

  // Collect all keys
  const allKeys = new Set<string>();
  for (const row of processed) {
    for (const k of Object.keys(row)) allKeys.add(k);
  }

  // Initialize columns
  for (const key of allKeys) {
    columns[key] = [];
  }

  // Fill column arrays
  for (const row of processed) {
    for (const key of allKeys) {
      let val = row[key] ?? null;
      if (typeof val === 'number' && precision !== undefined && precision >= 0) {
        val = Number(val.toFixed(precision));
      }
      columns[key].push(val);
    }
  }

  const output = {
    schema: {
      columns: Array.from(allKeys),
      rowCount: processed.length,
    },
    columns,
  };

  return JSON.stringify(output, null, 2);
}

function columnarDecoder(input: string | Buffer, options?: FormatOptions): unknown[] {
  const text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  const parsed = JSON.parse(text);

  if (!parsed.columns || typeof parsed.columns !== 'object') {
    throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, 'Invalid columnar format: missing "columns" object');
  }

  const colNames = Object.keys(parsed.columns);
  const rowCount = parsed.schema?.rowCount ?? (colNames.length > 0 ? parsed.columns[colNames[0]].length : 0);

  const result: unknown[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, unknown> = {};
    for (const col of colNames) {
      row[col] = parsed.columns[col][i] ?? null;
    }
    result.push(row);
  }

  return result;
}

// --- Built-in Format: TradingView (Pine Script) ---

function tradingViewEncoder(data: unknown[], options?: FormatOptions): string {
  const processed = data.map((row) => filterAndRenameRow(row, options?.columns, options?.rename));
  const precision = options?.numberPrecision ?? 2;

  if (processed.length === 0) return '';

  const lines: string[] = [];
  lines.push('// TradingView Pine Script Data Export');
  lines.push('// Generated by DataFormatter');
  lines.push(`//@version=5`);
  lines.push('');

  // Emit data as Pine Script arrays
  const allKeys = new Set<string>();
  for (const row of processed) {
    for (const k of Object.keys(row)) allKeys.add(k);
  }
  const headers = Array.from(allKeys);

  for (const col of headers) {
    const safeName = col.replace(/[^a-zA-Z0-9_]/g, '_');
    const values = processed.map((row) => {
      const val = row[col];
      if (typeof val === 'number') return formatNumber(val, precision);
      if (val === null || val === undefined) return 'na';
      return `"${String(val).replace(/"/g, '\\"')}"`;
    });

    lines.push(`var float[] ${safeName}_data = array.from(${values.join(', ')})`);
  }

  lines.push('');
  lines.push('// Access data with: array.get(column_data, bar_index)');

  return lines.join('\n');
}

function tradingViewDecoder(input: string | Buffer, options?: FormatOptions): unknown[] {
  const text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  const lines = text.split(/\r?\n/);

  const arrays: Record<string, unknown[]> = {};

  const arrayRegex = /var\s+(?:float|int|string)\[\]\s+(\w+)_data\s*=\s*array\.from\((.+)\)/;

  for (const line of lines) {
    const match = line.match(arrayRegex);
    if (match) {
      const name = match[1];
      const valuesStr = match[2];
      const values = valuesStr.split(',').map((v) => {
        const trimmed = v.trim();
        if (trimmed === 'na') return null;
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          return trimmed.slice(1, -1).replace(/\\"/g, '"');
        }
        const num = Number(trimmed);
        return !isNaN(num) ? num : trimmed;
      });
      arrays[name] = values;
    }
  }

  // Convert columnar back to rows
  const colNames = Object.keys(arrays);
  if (colNames.length === 0) return [];

  const rowCount = arrays[colNames[0]].length;
  const result: unknown[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, unknown> = {};
    for (const col of colNames) {
      row[col] = arrays[col][i] ?? null;
    }
    result.push(row);
  }

  return result;
}

// --- Built-in Format: Backtest Engine ---

function backtestEncoder(data: unknown[], options?: FormatOptions): string {
  const processed = data.map((row) => filterAndRenameRow(row, options?.columns, options?.rename));

  // Backtest engine expects a structured JSON with metadata
  const columnTypes = inferColumnTypes(processed);

  // Normalize OHLCV fields
  const OHLCV_MAPPING: Record<string, string> = {
    open: 'o',
    high: 'h',
    low: 'l',
    close: 'c',
    volume: 'v',
    time: 't',
    date: 't',
    timestamp: 't',
  };

  const bars: unknown[] = [];
  for (const row of processed) {
    const bar: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const mapped = OHLCV_MAPPING[key.toLowerCase()] ?? key;
      if (mapped === 't') {
        // Normalize timestamp
        if (value instanceof Date) {
          bar[mapped] = value.getTime();
        } else if (typeof value === 'string') {
          const parsed = new Date(value);
          bar[mapped] = isNaN(parsed.getTime()) ? value : parsed.getTime();
        } else {
          bar[mapped] = value;
        }
      } else if (mapped === 'o' || mapped === 'h' || mapped === 'l' || mapped === 'c' || mapped === 'v') {
        bar[mapped] = typeof value === 'number' ? value : Number(value) || 0;
      } else {
        bar[mapped] = value;
      }
    }
    bars.push(bar);
  }

  const output = {
    version: 1,
    format: 'backtest-engine',
    generated: new Date().toISOString(),
    schema: {
      columns: Object.keys(columnTypes).map((name) => ({
        name,
        mapped: OHLCV_MAPPING[name.toLowerCase()] ?? name,
        type: columnTypes[name],
      })),
    },
    rowCount: bars.length,
    bars,
  };

  return JSON.stringify(output);
}

function backtestDecoder(input: string | Buffer, options?: FormatOptions): unknown[] {
  const text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  const parsed = JSON.parse(text);

  if (parsed.bars && Array.isArray(parsed.bars)) {
    // Reverse OHLCV mapping
    const REVERSE_MAPPING: Record<string, string> = {
      o: 'open',
      h: 'high',
      l: 'low',
      c: 'close',
      v: 'volume',
      t: 'time',
    };

    return parsed.bars.map((bar: Record<string, unknown>) => {
      const row: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(bar)) {
        const expanded = REVERSE_MAPPING[key] ?? key;
        row[expanded] = value;
      }
      return row;
    });
  }

  // Fallback: treat as plain JSON array
  if (Array.isArray(parsed)) return parsed;

  throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, 'Invalid backtest format: missing "bars" array');
}

// ============================================================================
// DataFormatter Class
// ============================================================================

