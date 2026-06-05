import log from 'electron-log';

// ============================================================================
// JVS-88: Data Formatter - Market Data Format Converter
// Converts between various market data formats (CSV, JSON, Markdown, XML, etc.)
// ============================================================================

// --- Interfaces ---

export interface FormatDefinition {
  id: string;
  name: string;
  mimeType: string;
  extension: string;
  encoder: (data: any[], options?: FormatOptions) => string | Buffer;
  decoder: (input: string | Buffer, options?: FormatOptions) => any[];
}

export interface FormatOptions {
  delimiter?: string;
  quoteChar?: string;
  encoding?: string;
  includeHeader?: boolean;
  dateFormat?: string;
  numberPrecision?: number;
  bom?: boolean;
  columns?: string[];
  rename?: Record<string, string>;
}

export interface ConversionResult {
  success: boolean;
  output?: string | Buffer;
  rowCount: number;
  format: string;
  durationMs: number;
  error?: string;
  warnings: string[];
}

export interface FormatSummary {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

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

function csvEscapeField(value: any, delimiter: string, quoteChar: string): string {
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

function formatNumber(value: any, precision?: number): string {
  if (typeof value === 'number' && precision !== undefined && precision >= 0) {
    return value.toFixed(precision);
  }
  return String(value ?? '');
}

function formatDate(value: any, _dateFormat?: string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value ?? '');
}

function normalizeColumns(row: Record<string, any>, columns?: string[]): string[] {
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
  row: Record<string, any>,
  columns?: string[],
  rename?: Record<string, string>,
): Record<string, any> {
  const cols = columns && columns.length > 0 ? columns : Object.keys(row);
  const result: Record<string, any> = {};
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

function inferColumnTypes(data: any[]): Record<string, string> {
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

function csvEncoder(data: any[], options?: FormatOptions): string {
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

function csvDecoder(input: string | Buffer, options?: FormatOptions): any[] {
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

  const result: any[] = [];

  if (includeHeader) {
    const headers = parseCSVLine(lines[0], delimiter, quoteChar).map((h) => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter, quoteChar);
      const row: Record<string, any> = {};
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

function jsonEncoder(data: any[], options?: FormatOptions): string {
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

function jsonDecoder(input: string | Buffer, options?: FormatOptions): any[] {
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
  const result: any[] = [];
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

function ndjsonEncoder(data: any[], options?: FormatOptions): string {
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

function ndjsonDecoder(input: string | Buffer, options?: FormatOptions): any[] {
  const text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const result: any[] = [];
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

function markdownEncoder(data: any[], options?: FormatOptions): string {
  if (data.length === 0) return '';

  const processed = data.map((row) => filterAndRenameRow(row, options?.columns, options?.rename));
  const precision = options?.numberPrecision;

  const allKeys = new Set<string>();
  for (const row of processed) {
    for (const k of Object.keys(row)) allKeys.add(k);
  }
  const headers = Array.from(allKeys);

  const formatCell = (val: any): string => {
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

function markdownDecoder(input: string | Buffer, options?: FormatOptions): any[] {
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
  const result: any[] = [];

  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue;
    const cells = parseCells(line);
    const row: Record<string, any> = {};
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

function xmlEncoder(data: any[], options?: FormatOptions): string {
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

function xmlDecoder(input: string | Buffer, options?: FormatOptions): any[] {
  const text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  const result: any[] = [];

  // Simple regex-based XML parser for our row format
  const rowRegex = /<row>([\s\S]*?)<\/row>/g;
  const fieldRegex = /<([^>]+)>([\s\S]*?)<\/\1>/g;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(text)) !== null) {
    const rowContent = rowMatch[1];
    const row: Record<string, any> = {};
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

function columnarEncoder(data: any[], options?: FormatOptions): string {
  const processed = data.map((row) => filterAndRenameRow(row, options?.columns, options?.rename));
  const precision = options?.numberPrecision;

  const columns: Record<string, any[]> = {};

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

function columnarDecoder(input: string | Buffer, options?: FormatOptions): any[] {
  const text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  const parsed = JSON.parse(text);

  if (!parsed.columns || typeof parsed.columns !== 'object') {
    throw new Error('Invalid columnar format: missing "columns" object');
  }

  const colNames = Object.keys(parsed.columns);
  const rowCount = parsed.schema?.rowCount ?? (colNames.length > 0 ? parsed.columns[colNames[0]].length : 0);

  const result: any[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, any> = {};
    for (const col of colNames) {
      row[col] = parsed.columns[col][i] ?? null;
    }
    result.push(row);
  }

  return result;
}

// --- Built-in Format: TradingView (Pine Script) ---

function tradingViewEncoder(data: any[], options?: FormatOptions): string {
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

function tradingViewDecoder(input: string | Buffer, options?: FormatOptions): any[] {
  const text = typeof input === 'string' ? input : input.toString(options?.encoding as BufferEncoding ?? 'utf-8');
  const lines = text.split(/\r?\n/);

  const arrays: Record<string, any[]> = {};

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
  const result: any[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, any> = {};
    for (const col of colNames) {
      row[col] = arrays[col][i] ?? null;
    }
    result.push(row);
  }

  return result;
}

// --- Built-in Format: Backtest Engine ---

function backtestEncoder(data: any[], options?: FormatOptions): string {
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

  const bars: any[] = [];
  for (const row of processed) {
    const bar: Record<string, any> = {};
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

function backtestDecoder(input: string | Buffer, options?: FormatOptions): any[] {
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

    return parsed.bars.map((bar: Record<string, any>) => {
      const row: Record<string, any> = {};
      for (const [key, value] of Object.entries(bar)) {
        const expanded = REVERSE_MAPPING[key] ?? key;
        row[expanded] = value;
      }
      return row;
    });
  }

  // Fallback: treat as plain JSON array
  if (Array.isArray(parsed)) return parsed;

  throw new Error('Invalid backtest format: missing "bars" array');
}

// ============================================================================
// DataFormatter Class
// ============================================================================

export class DataFormatter {
  private formats: Map<string, FormatDefinition> = new Map();

  constructor() {
    this.registerBuiltInFormats();
  }

  private registerBuiltInFormats(): void {
    log.info('[DataFormatter] Registering built-in formats');

    this.registerFormat({
      id: 'csv',
      name: 'CSV (Comma-Separated Values)',
      mimeType: 'text/csv',
      extension: '.csv',
      encoder: csvEncoder,
      decoder: csvDecoder,
    });

    this.registerFormat({
      id: 'json',
      name: 'JSON (Array of Objects)',
      mimeType: 'application/json',
      extension: '.json',
      encoder: jsonEncoder,
      decoder: jsonDecoder,
    });

    this.registerFormat({
      id: 'ndjson',
      name: 'NDJSON (Newline-Delimited JSON)',
      mimeType: 'application/x-ndjson',
      extension: '.ndjson',
      encoder: ndjsonEncoder,
      decoder: ndjsonDecoder,
    });

    this.registerFormat({
      id: 'markdown',
      name: 'Markdown Table',
      mimeType: 'text/markdown',
      extension: '.md',
      encoder: markdownEncoder,
      decoder: markdownDecoder,
    });

    this.registerFormat({
      id: 'xml',
      name: 'XML (Simple Row Format)',
      mimeType: 'application/xml',
      extension: '.xml',
      encoder: xmlEncoder,
      decoder: xmlDecoder,
    });

    this.registerFormat({
      id: 'columnar',
      name: 'Parquet-like JSON (Columnar)',
      mimeType: 'application/json',
      extension: '.col.json',
      encoder: columnarEncoder,
      decoder: columnarDecoder,
    });

    this.registerFormat({
      id: 'tradingview',
      name: 'TradingView Pine Script',
      mimeType: 'text/plain',
      extension: '.pine',
      encoder: tradingViewEncoder,
      decoder: tradingViewDecoder,
    });

    this.registerFormat({
      id: 'backtest',
      name: 'Backtest Engine Format',
      mimeType: 'application/json',
      extension: '.bt.json',
      encoder: backtestEncoder,
      decoder: backtestDecoder,
    });

    log.info('[DataFormatter] Registered 8 built-in formats');
  }

  /**
   * Register a custom format definition.
   */
  registerFormat(format: FormatDefinition): void {
    if (!format.id || !format.encoder || !format.decoder) {
      throw new Error('FormatDefinition must have id, encoder, and decoder');
    }
    if (this.formats.has(format.id)) {
      log.warn(`[DataFormatter] Overriding existing format: ${format.id}`);
    }
    this.formats.set(format.id, format);
    log.debug(`[DataFormatter] Registered format: ${format.id} (${format.name})`);
  }

  /**
   * Convert data from one format to another.
   * The `data` parameter is already-parsed row objects.
   * `fromFormat` is informational (used for validation only).
   */
  convert(
    data: any[],
    fromFormat: string,
    toFormat: string,
    options?: FormatOptions,
  ): ConversionResult {
    const startTime = performance.now();
    const warnings: string[] = [];

    log.info(`[DataFormatter] Converting ${data.length} rows from ${fromFormat} to ${toFormat}`);

    // Validate source format exists
    if (!this.formats.has(fromFormat)) {
      const duration = performance.now() - startTime;
      return {
        success: false,
        rowCount: 0,
        format: toFormat,
        durationMs: duration,
        error: `Unknown source format: ${fromFormat}`,
        warnings,
      };
    }

    // Validate target format exists
    const targetFormat = this.formats.get(toFormat);
    if (!targetFormat) {
      const duration = performance.now() - startTime;
      return {
        success: false,
        rowCount: 0,
        format: toFormat,
        durationMs: duration,
        error: `Unknown target format: ${toFormat}`,
        warnings,
      };
    }

    // Validate data
    const validation = this.validate(data, toFormat);
    if (!validation.valid) {
      warnings.push(...validation.errors.map((e) => `Validation warning: ${e}`));
    }

    if (data.length === 0) {
      warnings.push('Input data is empty');
    }

    try {
      const output = targetFormat.encoder(data, options);
      const duration = performance.now() - startTime;

      log.info(`[DataFormatter] Conversion complete: ${data.length} rows in ${duration.toFixed(2)}ms`);

      return {
        success: true,
        output,
        rowCount: data.length,
        format: toFormat,
        durationMs: duration,
        warnings,
      };
    } catch (err: any) {
      const duration = performance.now() - startTime;
      const errorMsg = err?.message ?? String(err);
      log.error(`[DataFormatter] Conversion failed: ${errorMsg}`);

      return {
        success: false,
        rowCount: 0,
        format: toFormat,
        durationMs: duration,
        error: errorMsg,
        warnings,
      };
    }
  }

  /**
   * Encode row data into a specific format.
   */
  encode(
    data: any[],
    formatId: string,
    options?: FormatOptions,
  ): ConversionResult {
    const startTime = performance.now();
    const warnings: string[] = [];

    const format = this.formats.get(formatId);
    if (!format) {
      const duration = performance.now() - startTime;
      return {
        success: false,
        rowCount: 0,
        format: formatId,
        durationMs: duration,
        error: `Unknown format: ${formatId}`,
        warnings,
      };
    }

    if (data.length === 0) {
      warnings.push('Input data is empty');
    }

    try {
      const output = format.encoder(data, options);
      const duration = performance.now() - startTime;

      log.info(`[DataFormatter] Encoded ${data.length} rows to ${formatId} in ${duration.toFixed(2)}ms`);

      return {
        success: true,
        output,
        rowCount: data.length,
        format: formatId,
        durationMs: duration,
        warnings,
      };
    } catch (err: any) {
      const duration = performance.now() - startTime;
      const errorMsg = err?.message ?? String(err);
      log.error(`[DataFormatter] Encoding failed: ${errorMsg}`);

      return {
        success: false,
        rowCount: 0,
        format: formatId,
        durationMs: duration,
        error: errorMsg,
        warnings,
      };
    }
  }

  /**
   * Decode input string/Buffer from a specific format into row objects.
   */
  decode(
    input: string,
    formatId: string,
    options?: FormatOptions,
  ): ConversionResult {
    const startTime = performance.now();
    const warnings: string[] = [];

    const format = this.formats.get(formatId);
    if (!format) {
      const duration = performance.now() - startTime;
      return {
        success: false,
        rowCount: 0,
        format: formatId,
        durationMs: duration,
        error: `Unknown format: ${formatId}`,
        warnings,
      };
    }

    if (!input || (typeof input === 'string' && input.trim().length === 0)) {
      warnings.push('Input is empty');
      const duration = performance.now() - startTime;
      return {
        success: true,
        output: '[]',
        rowCount: 0,
        format: formatId,
        durationMs: duration,
        warnings,
      };
    }

    try {
      const rows = format.decoder(input, options);
      const duration = performance.now() - startTime;

      log.info(`[DataFormatter] Decoded ${rows.length} rows from ${formatId} in ${duration.toFixed(2)}ms`);

      return {
        success: true,
        output: JSON.stringify(rows),
        rowCount: rows.length,
        format: formatId,
        durationMs: duration,
        warnings,
      };
    } catch (err: any) {
      const duration = performance.now() - startTime;
      const errorMsg = err?.message ?? String(err);
      log.error(`[DataFormatter] Decoding failed: ${errorMsg}`);

      return {
        success: false,
        rowCount: 0,
        format: formatId,
        durationMs: duration,
        error: errorMsg,
        warnings,
      };
    }
  }

  /**
   * List all registered formats with summary info.
   */
  listFormats(): FormatSummary[] {
    const result: FormatSummary[] = [];
    for (const fmt of this.formats.values()) {
      result.push({
        id: fmt.id,
        name: fmt.name,
        extension: fmt.extension,
        mimeType: fmt.mimeType,
      });
    }
    return result;
  }

  /**
   * Auto-detect the format of an input string.
   * Returns the format id or null if detection fails.
   */
  detectFormat(input: string): string | null {
    if (!input || input.trim().length === 0) {
      log.debug('[DataFormatter] Cannot detect format of empty input');
      return null;
    }

    const trimmed = input.trim();

    // Check BOM
    const textWithoutBom = trimmed.startsWith(BOM_UTF8) ? trimmed.slice(1).trimStart() : trimmed;

    // XML detection
    if (textWithoutBom.startsWith('<?xml') || textWithoutBom.startsWith('<data>')) {
      log.debug('[DataFormatter] Detected format: XML');
      return 'xml';
    }

    // JSON array detection
    if (textWithoutBom.startsWith('[')) {
      try {
        JSON.parse(textWithoutBom);
        log.debug('[DataFormatter] Detected format: JSON');
        return 'json';
      } catch {
        // Not valid JSON array
      }
    }

    // JSON object detection (columnar or backtest)
    if (textWithoutBom.startsWith('{')) {
      try {
        const parsed = JSON.parse(textWithoutBom);
        if (parsed.columns && parsed.schema) {
          log.debug('[DataFormatter] Detected format: Columnar JSON');
          return 'columnar';
        }
        if (parsed.bars && parsed.format === 'backtest-engine') {
          log.debug('[DataFormatter] Detected format: Backtest Engine');
          return 'backtest';
        }
      } catch {
        // Not valid JSON object
      }
    }

    // NDJSON detection (multiple lines, each is valid JSON)
    const lines = textWithoutBom.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length >= 2) {
      let jsonLineCount = 0;
      for (const line of lines.slice(0, 5)) {
        try {
          JSON.parse(line);
          jsonLineCount++;
        } catch {
          break;
        }
      }
      if (jsonLineCount >= 2) {
        log.debug('[DataFormatter] Detected format: NDJSON');
        return 'ndjson';
      }
    }

    // Pine Script / TradingView detection
    if (textWithoutBom.includes('//@version=') && textWithoutBom.includes('array.from(')) {
      log.debug('[DataFormatter] Detected format: TradingView Pine Script');
      return 'tradingview';
    }

    // Markdown table detection
    if (/^\|.+\|$/m.test(textWithoutBom) && /^\|[\s\-:|]+\|$/m.test(textWithoutBom)) {
      log.debug('[DataFormatter] Detected format: Markdown');
      return 'markdown';
    }

    // CSV detection (heuristic: consistent delimiter across lines)
    const csvDelimiters = [',', '\t', ';', '|'];
    let bestDelimiter = ',';
    let bestScore = 0;

    for (const delim of csvDelimiters) {
      let score = 0;
      let prevFieldCount = -1;
      for (const line of lines.slice(0, 10)) {
        const fields = parseCSVLine(line, delim, '"');
        if (fields.length > 1) {
          if (prevFieldCount === fields.length) {
            score += 2;
          } else if (prevFieldCount === -1) {
            score += 1;
          }
          prevFieldCount = fields.length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = delim;
      }
    }

    if (bestScore >= 3) {
      log.debug(`[DataFormatter] Detected format: CSV (delimiter: ${bestDelimiter === '\t' ? 'TAB' : bestDelimiter})`);
      return 'csv';
    }

    log.debug('[DataFormatter] Could not detect format');
    return null;
  }

  /**
   * Validate data against a specific format.
   * Checks whether the data can be successfully encoded.
   */
  validate(data: any[], formatId: string): ValidationResult {
    const errors: string[] = [];

    const format = this.formats.get(formatId);
    if (!format) {
      errors.push(`Unknown format: ${formatId}`);
      return { valid: false, errors };
    }

    if (!Array.isArray(data)) {
      errors.push('Data must be an array');
      return { valid: false, errors };
    }

    if (data.length === 0) {
      // Empty data is technically valid
      return { valid: true, errors };
    }

    // Check that all items are objects (for structured formats)
    const objectFormats = ['csv', 'json', 'ndjson', 'markdown', 'xml', 'columnar', 'backtest', 'tradingview'];
    if (objectFormats.includes(formatId)) {
      for (let i = 0; i < data.length; i++) {
        if (data[i] === null || data[i] === undefined) {
          errors.push(`Row ${i}: null or undefined`);
        } else if (typeof data[i] !== 'object') {
          errors.push(`Row ${i}: expected object, got ${typeof data[i]}`);
        }
      }
    }

    // Check for consistent keys (warning-level for most formats)
    if (data.length > 1) {
      const firstKeys = new Set(Object.keys(data[0] ?? {}));
      for (let i = 1; i < Math.min(data.length, 20); i++) {
        if (data[i] && typeof data[i] === 'object') {
          const currentKeys = Object.keys(data[i]);
          for (const key of currentKeys) {
            if (!firstKeys.has(key)) {
              errors.push(`Row ${i}: unexpected column "${key}" not in first row`);
              break; // Only report first mismatch per row
            }
          }
        }
      }
    }

    // Backtest-specific validation
    if (formatId === 'backtest') {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || typeof row !== 'object') continue;
        const hasOHLC =
          ('open' in row || 'o' in row) &&
          ('high' in row || 'h' in row) &&
          ('low' in row || 'l' in row) &&
          ('close' in row || 'c' in row);
        if (!hasOHLC && i === 0) {
          errors.push('Row 0: backtest format expects OHLC fields (open, high, low, close)');
        }
      }
    }

    // Try encoding to verify it works
    try {
      format.encoder(data, {});
    } catch (err: any) {
      errors.push(`Encoding test failed: ${err?.message ?? String(err)}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get a specific format definition by ID.
   */
  getFormat(formatId: string): FormatDefinition | undefined {
    return this.formats.get(formatId);
  }

  /**
   * Remove a custom format. Built-in formats can also be removed.
   */
  unregisterFormat(formatId: string): boolean {
    if (this.formats.has(formatId)) {
      this.formats.delete(formatId);
      log.info(`[DataFormatter] Unregistered format: ${formatId}`);
      return true;
    }
    return false;
  }

  /**
   * Batch convert: convert the same data to multiple formats at once.
   */
  batchEncode(
    data: any[],
    formatIds: string[],
    options?: FormatOptions,
  ): Map<string, ConversionResult> {
    const results = new Map<string, ConversionResult>();
    for (const formatId of formatIds) {
      results.set(formatId, this.encode(data, formatId, options));
    }
    return results;
  }

  /**
   * Stream-decode large CSV input using a line-by-line approach.
   * Yields batches of rows for memory-efficient processing.
   */
  *streamDecodeCSV(
    input: string,
    batchSize: number = 1000,
    options?: FormatOptions,
  ): Generator<any[], void, undefined> {
    const delimiter = options?.delimiter ?? ',';
    const quoteChar = options?.quoteChar ?? '"';
    const includeHeader = options?.includeHeader !== false;

    let text = input;
    if (text.startsWith(BOM_UTF8)) {
      text = text.slice(1);
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;

    let headers: string[];
    let startLine: number;

    if (includeHeader) {
      headers = parseCSVLine(lines[0], delimiter, quoteChar).map((h) => h.trim());
      startLine = 1;
    } else {
      headers = [];
      startLine = 0;
    }

    let batch: any[] = [];

    for (let i = startLine; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter, quoteChar);

      if (includeHeader) {
        const row: Record<string, any> = {};
        for (let j = 0; j < headers.length; j++) {
          const raw = j < values.length ? values[j] : '';
          const num = Number(raw);
          row[headers[j]] = raw !== '' && !isNaN(num) ? num : raw;
        }
        batch.push(row);
      } else {
        batch.push(values);
      }

      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }

    if (batch.length > 0) {
      yield batch;
    }
  }

  /**
   * Stream-decode large NDJSON input.
   * Yields batches of parsed JSON objects.
   */
  *streamDecodeNDJSON(
    input: string,
    batchSize: number = 1000,
  ): Generator<any[], void, undefined> {
    const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
    let batch: any[] = [];

    for (const line of lines) {
      try {
        batch.push(JSON.parse(line));
      } catch {
        log.warn(`[DataFormatter] Skipping invalid NDJSON line: ${line.substring(0, 80)}`);
      }

      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }

    if (batch.length > 0) {
      yield batch;
    }
  }

  /**
   * Pretty-print a summary of the data for logging/debugging.
   */
  summarize(data: any[], maxRows: number = 5): string {
    if (data.length === 0) return '(empty dataset)';

    const sample = data.slice(0, maxRows);
    const keys = new Set<string>();
    for (const row of sample) {
      if (row && typeof row === 'object') {
        for (const k of Object.keys(row)) keys.add(k);
      }
    }

    const columns = Array.from(keys);
    const lines: string[] = [];
    lines.push(`Dataset: ${data.length} rows, ${columns.length} columns`);
    lines.push(`Columns: ${columns.join(', ')}`);
    lines.push('');
    lines.push('Sample data:');

    for (let i = 0; i < sample.length; i++) {
      const row = sample[i];
      const preview = columns
        .map((col) => {
          const val = row?.[col];
          const str = typeof val === 'number' ? val.toFixed(2) : String(val ?? '');
          return `${col}=${str.length > 20 ? str.substring(0, 20) + '...' : str}`;
        })
        .join(' | ');
      lines.push(`  [${i}] ${preview}`);
    }

    if (data.length > maxRows) {
      lines.push(`  ... and ${data.length - maxRows} more rows`);
    }

    return lines.join('\n');
  }
}

// Export singleton for convenience
export const dataFormatter = new DataFormatter();

export default DataFormatter;
