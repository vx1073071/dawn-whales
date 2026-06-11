/**
 * R95 J-01: engine/data 覆盖率 — DataFormatter
 * 覆盖: data-formatter.ts (1469行)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataFormatter, dataFormatter } from '../../../../electron/engine/data/data-formatter';

describe('DataFormatter', () => {
  let fmt: DataFormatter;

  beforeEach(() => {
    fmt = new DataFormatter();
  });

  // ── Utility functions (via class) ─────────────────────────────────────

  describe('listFormats', () => {
    it('should list 8 built-in formats', () => {
      const list = fmt.listFormats();
      expect(list.length).toBe(8);
      const ids = list.map(f => f.id);
      expect(ids).toContain('csv');
      expect(ids).toContain('json');
      expect(ids).toContain('ndjson');
      expect(ids).toContain('markdown');
      expect(ids).toContain('xml');
      expect(ids).toContain('columnar');
      expect(ids).toContain('tradingview');
      expect(ids).toContain('backtest');
    });
  });

  describe('getFormat', () => {
    it('should return format definition by id', () => {
      const csv = fmt.getFormat('csv');
      expect(csv).toBeDefined();
      expect(csv!.id).toBe('csv');
      expect(csv!.extension).toBe('.csv');
      expect(csv!.mimeType).toBe('text/csv');
    });

    it('should return undefined for unknown format', () => {
      expect(fmt.getFormat('nonexistent')).toBeUndefined();
    });
  });

  // ── CSV Encode/Decode ──────────────────────────────────────────────────

  describe('CSV encoder', () => {
    it('should encode simple data to CSV', () => {
      const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
      const result = fmt.encode(data, 'csv');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
      expect(typeof result.output).toBe('string');
      const output = result.output as string;
      expect(output).toContain('name');
      expect(output).toContain('Alice');
      expect(output).toContain('Bob');
    });

    it('should handle empty data', () => {
      const result = fmt.encode([], 'csv');
      expect(result.success).toBe(true);
      expect(result.output).toBe('');
    });

    it('should handle empty data with BOM', () => {
      const result = fmt.encode([], 'csv', { bom: true });
      expect(result.success).toBe(true);
      expect(result.output).toBe('\uFEFF');
    });

    it('should escape special characters in CSV fields', () => {
      const data = [{ note: 'hello, world', value: 'has "quotes"' }];
      const result = fmt.encode(data, 'csv');
      expect(result.success).toBe(true);
      const output = result.output as string;
      expect(output).toContain('"hello, world"');
      expect(output).toContain('"has ""quotes"""');
    });

    it('should handle newlines in CSV fields', () => {
      const data = [{ text: 'line1\nline2' }];
      const result = fmt.encode(data, 'csv');
      const output = result.output as string;
      expect(output).toContain('"line1\nline2"');
    });

    it('should apply column selection', () => {
      const data = [{ a: 1, b: 2, c: 3 }];
      const result = fmt.encode(data, 'csv', { columns: ['a', 'c'] });
      const output = result.output as string;
      expect(output).toContain('a');
      expect(output).toContain('c');
      expect(output).not.toContain(',b,');
    });

    it('should apply rename mapping', () => {
      const data = [{ oldName: 'value' }];
      const result = fmt.encode(data, 'csv', { rename: { oldName: 'newName' } });
      const output = result.output as string;
      expect(output).toContain('newName');
      expect(output).not.toContain('oldName');
    });

    it('should apply number precision', () => {
      const data = [{ price: 123.456789 }];
      const result = fmt.encode(data, 'csv', { numberPrecision: 2 });
      const output = result.output as string;
      expect(output).toContain('123.46');
    });

    it('should encode with custom delimiter', () => {
      const data = [{ a: 1, b: 2 }];
      const result = fmt.encode(data, 'csv', { delimiter: '\t' });
      const output = result.output as string;
      expect(output).toContain('a\tb');
    });

    it('should skip header when includeHeader=false', () => {
      const data = [{ a: 1, b: 2 }];
      const result = fmt.encode(data, 'csv', { includeHeader: false });
      const output = result.output as string;
      expect(output).toBe('1,2');
    });
  });

  describe('CSV decoder', () => {
    it('should decode CSV string to objects', () => {
      const csv = 'name,age\nAlice,30\nBob,25';
      const result = fmt.decode(csv, 'csv');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
      const rows = JSON.parse(result.output as string);
      expect(rows[0].name).toBe('Alice');
      expect(rows[0].age).toBe(30);
    });

    it('should handle BOM prefix', () => {
      const csv = '\uFEFFname,age\nAlice,30';
      const result = fmt.decode(csv, 'csv');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
    });

    it('should handle quoted fields with commas', () => {
      const csv = 'name,note\nAlice,"hello, world"';
      const result = fmt.decode(csv, 'csv');
      const rows = JSON.parse(result.output as string);
      expect(rows[0].note).toBe('hello, world');
    });

    it('should handle escaped quotes', () => {
      const csv = 'text\n"He said ""hi"""';
      const result = fmt.decode(csv, 'csv');
      const rows = JSON.parse(result.output as string);
      expect(rows[0].text).toBe('He said "hi"');
    });

    it('should decode without header', () => {
      const csv = 'Alice,30\nBob,25';
      const result = fmt.decode(csv, 'csv', { includeHeader: false });
      expect(result.success).toBe(true);
      const rows = JSON.parse(result.output as string);
      expect(rows[0]).toEqual(['Alice', '30']);
    });

    it('should handle multiline quoted fields', () => {
      const csv = 'name,bio\nAlice,"line1\nline2"';
      const result = fmt.decode(csv, 'csv');
      const rows = JSON.parse(result.output as string);
      expect(rows[0].bio).toBe('line1\nline2');
    });
  });

  // ── JSON Encode/Decode ────────────────────────────────────────────────

  describe('JSON encoder', () => {
    it('should encode data as JSON array', () => {
      const data = [{ a: 1 }, { a: 2 }];
      const result = fmt.encode(data, 'json');
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output as string);
      expect(parsed).toEqual([{ a: 1 }, { a: 2 }]);
    });

    it('should apply number precision', () => {
      const data = [{ val: 3.14159 }];
      const result = fmt.encode(data, 'json', { numberPrecision: 2 });
      const parsed = JSON.parse(result.output as string);
      expect(parsed[0].val).toBe(3.14);
    });

    it('should apply column filtering', () => {
      const data = [{ a: 1, b: 2, c: 3 }];
      const result = fmt.encode(data, 'json', { columns: ['a'] });
      const parsed = JSON.parse(result.output as string);
      expect(parsed[0]).toEqual({ a: 1 });
    });
  });

  describe('JSON decoder', () => {
    it('should decode JSON array', () => {
      const json = '[{"a":1},{"a":2}]';
      const result = fmt.decode(json, 'json');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });

    it('should decode NDJSON (newline-delimited)', () => {
      const ndjson = '{"a":1}\n{"a":2}\n{"a":3}';
      const result = fmt.decode(ndjson, 'json');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3);
    });

    it('should handle empty input', () => {
      const result = fmt.decode('', 'json');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(0);
    });

    it('should skip invalid NDJSON lines', () => {
      const ndjson = '{"a":1}\ninvalid\n{"a":2}';
      const result = fmt.decode(ndjson, 'json');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });
  });

  // ── NDJSON Encode/Decode ──────────────────────────────────────────────

  describe('NDJSON encoder', () => {
    it('should encode as newline-delimited JSON', () => {
      const data = [{ a: 1 }, { a: 2 }];
      const result = fmt.encode(data, 'ndjson');
      expect(result.success).toBe(true);
      const lines = (result.output as string).split('\n');
      expect(lines.length).toBe(2);
      expect(JSON.parse(lines[0])).toEqual({ a: 1 });
    });
  });

  describe('NDJSON decoder', () => {
    it('should decode NDJSON', () => {
      const input = '{"x":1}\n{"x":2}';
      const result = fmt.decode(input, 'ndjson');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });

    it('should skip invalid lines gracefully', () => {
      const input = '{"x":1}\nbroken\n{"x":3}';
      const result = fmt.decode(input, 'ndjson');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });
  });

  // ── Markdown Encode/Decode ────────────────────────────────────────────

  describe('Markdown encoder', () => {
    it('should encode as markdown table', () => {
      const data = [{ name: 'A', val: 1 }, { name: 'B', val: 2 }];
      const result = fmt.encode(data, 'markdown');
      expect(result.success).toBe(true);
      const output = result.output as string;
      expect(output).toContain('| name | val |');
      expect(output).toContain('| --- | --- |');
      expect(output).toContain('| A | 1 |');
    });

    it('should return empty string for empty data', () => {
      const result = fmt.encode([], 'markdown');
      expect(result.output).toBe('');
    });

    it('should escape pipe characters', () => {
      const data = [{ text: 'a|b' }];
      const result = fmt.encode(data, 'markdown');
      const output = result.output as string;
      expect(output).toContain('a\\|b');
    });
  });

  describe('Markdown decoder', () => {
    it('should decode markdown table', () => {
      const md = '| name | val |\n| --- | --- |\n| A | 1 |\n| B | 2 |';
      const result = fmt.decode(md, 'markdown');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
      const rows = JSON.parse(result.output as string);
      expect(rows[0].name).toBe('A');
    });

    it('should handle insufficient lines', () => {
      const md = '| name |';
      const result = fmt.decode(md, 'markdown');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(0);
    });
  });

  // ── XML Encode/Decode ─────────────────────────────────────────────────

  describe('XML encoder', () => {
    it('should encode as XML', () => {
      const data = [{ name: 'Alice', age: 30 }];
      const result = fmt.encode(data, 'xml');
      expect(result.success).toBe(true);
      const output = result.output as string;
      expect(output).toContain('<?xml version="1.0"');
      expect(output).toContain('<data>');
      expect(output).toContain('<name>Alice</name>');
    });

    it('should escape XML entities', () => {
      const data = [{ text: '<script>alert("xss")</script>' }];
      const result = fmt.encode(data, 'xml');
      const output = result.output as string;
      expect(output).toContain('&lt;script&gt;');
    });
  });

  describe('XML decoder', () => {
    it('should decode XML rows', () => {
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n  <row>\n    <name>Alice</name>\n    <age>30</age>\n  </row>\n</data>';
      const result = fmt.decode(xml, 'xml');
      expect(result.success).toBe(true);
      const rows = JSON.parse(result.output as string);
      expect(rows[0].name).toBe('Alice');
      expect(rows[0].age).toBe(30);
    });

    it('should handle XML entity unescaping', () => {
      const xml = '<data>\n  <row>\n    <text>&lt;b&gt;bold&lt;/b&gt;</text>\n  </row>\n</data>';
      const result = fmt.decode(xml, 'xml');
      const rows = JSON.parse(result.output as string);
      expect(rows[0].text).toBe('<b>bold</b>');
    });
  });

  // ── Columnar Encode/Decode ────────────────────────────────────────────

  describe('Columnar encoder', () => {
    it('should encode as columnar JSON', () => {
      const data = [{ a: 1, b: 'x' }, { a: 2, b: 'y' }];
      const result = fmt.encode(data, 'columnar');
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output as string);
      expect(parsed.schema.columns).toContain('a');
      expect(parsed.columns.a).toEqual([1, 2]);
    });
  });

  describe('Columnar decoder', () => {
    it('should decode columnar JSON', () => {
      const col = JSON.stringify({
        schema: { columns: ['a', 'b'], rowCount: 2 },
        columns: { a: [1, 2], b: ['x', 'y'] }
      });
      const result = fmt.decode(col, 'columnar');
      expect(result.success).toBe(true);
      const rows = JSON.parse(result.output as string);
      expect(rows[0]).toEqual({ a: 1, b: 'x' });
    });

    it('should throw on invalid columnar format', () => {
      const bad = JSON.stringify({ notColumns: true });
      const result = fmt.decode(bad, 'columnar');
      expect(result.success).toBe(false);
    });
  });

  // ── TradingView Encode/Decode ─────────────────────────────────────────

  describe('TradingView encoder', () => {
    it('should encode as Pine Script arrays', () => {
      const data = [{ price: 100.5, volume: 1000 }];
      const result = fmt.encode(data, 'tradingview');
      expect(result.success).toBe(true);
      const output = result.output as string;
      expect(output).toContain('//@version=5');
      expect(output).toContain('array.from');
    });

    it('should return empty for empty data', () => {
      const result = fmt.encode([], 'tradingview');
      expect(result.output).toBe('');
    });
  });

  describe('TradingView decoder', () => {
    it('should decode Pine Script arrays', () => {
      const pine = '//@version=5\nvar float[] price_data = array.from(100.50, 200.00)\nvar float[] volume_data = array.from(1000, 2000)';
      const result = fmt.decode(pine, 'tradingview');
      expect(result.success).toBe(true);
      const rows = JSON.parse(result.output as string);
      expect(rows.length).toBe(2);
      expect(rows[0].price).toBe(100.5);
    });
  });

  // ── Backtest Encode/Decode ────────────────────────────────────────────

  describe('Backtest encoder', () => {
    it('should encode with OHLCV mapping', () => {
      const data = [{ open: 100, high: 110, low: 95, close: 105, volume: 1000, time: '2024-01-01' }];
      const result = fmt.encode(data, 'backtest');
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output as string);
      expect(parsed.format).toBe('backtest-engine');
      expect(parsed.bars.length).toBe(1);
      expect(parsed.bars[0].o).toBe(100);
      expect(parsed.bars[0].h).toBe(110);
    });
  });

  describe('Backtest decoder', () => {
    it('should decode backtest format with reverse mapping', () => {
      const bt = JSON.stringify({
        format: 'backtest-engine',
        bars: [{ o: 100, h: 110, l: 95, c: 105, v: 1000, t: 1704067200000 }]
      });
      const result = fmt.decode(bt, 'backtest');
      expect(result.success).toBe(true);
      const rows = JSON.parse(result.output as string);
      expect(rows[0].open).toBe(100);
      expect(rows[0].close).toBe(105);
    });

    it('should fallback to plain JSON array', () => {
      const bt = JSON.stringify([{ a: 1 }, { a: 2 }]);
      const result = fmt.decode(bt, 'backtest');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });

    it('should throw on invalid backtest format', () => {
      const bt = JSON.stringify({ noBars: true });
      const result = fmt.decode(bt, 'backtest');
      expect(result.success).toBe(false);
    });
  });

  // ── Convert ───────────────────────────────────────────────────────────

  describe('convert', () => {
    it('should convert data between formats', () => {
      const data = [{ a: 1, b: 2 }];
      const result = fmt.convert(data, 'json', 'csv');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
    });

    it('should fail with unknown source format', () => {
      const result = fmt.convert([{ a: 1 }], 'unknown', 'csv');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown source format');
    });

    it('should fail with unknown target format', () => {
      const result = fmt.convert([{ a: 1 }], 'json', 'unknown');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown target format');
    });

    it('should warn on empty data', () => {
      const result = fmt.convert([], 'json', 'csv');
      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Input data is empty');
    });
  });

  // ── detectFormat ──────────────────────────────────────────────────────

  describe('detectFormat', () => {
    it('should detect XML', () => {
      expect(fmt.detectFormat('<?xml version="1.0"?>\n<data></data>')).toBe('xml');
    });

    it('should detect JSON array', () => {
      expect(fmt.detectFormat('[{"a":1}]')).toBe('json');
    });

    it('should detect Columnar JSON', () => {
      const col = JSON.stringify({ columns: { a: [1] }, schema: { columns: ['a'], rowCount: 1 } });
      expect(fmt.detectFormat(col)).toBe('columnar');
    });

    it('should detect Backtest JSON', () => {
      const bt = JSON.stringify({ bars: [], format: 'backtest-engine' });
      expect(fmt.detectFormat(bt)).toBe('backtest');
    });

    it('should detect NDJSON', () => {
      expect(fmt.detectFormat('{"a":1}\n{"a":2}')).toBe('ndjson');
    });

    it('should detect TradingView', () => {
      expect(fmt.detectFormat('//@version=5\narray.from(1,2)')).toBe('tradingview');
    });

    it('should detect Markdown', () => {
      expect(fmt.detectFormat('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe('markdown');
    });

    it('should detect CSV', () => {
      expect(fmt.detectFormat('a,b,c\n1,2,3\n4,5,6')).toBe('csv');
    });

    it('should return null for empty input', () => {
      expect(fmt.detectFormat('')).toBeNull();
    });

    it('should return null for whitespace', () => {
      expect(fmt.detectFormat('   ')).toBeNull();
    });
  });

  // ── validate ──────────────────────────────────────────────────────────

  describe('validate', () => {
    it('should validate valid data', () => {
      const v = fmt.validate([{ a: 1 }], 'csv');
      expect(v.valid).toBe(true);
    });

    it('should fail for unknown format', () => {
      const v = fmt.validate([{ a: 1 }], 'unknown');
      expect(v.valid).toBe(false);
    });

    it('should validate empty data as valid', () => {
      const v = fmt.validate([], 'csv');
      expect(v.valid).toBe(true);
    });

    it('should detect non-array data', () => {
      const v = fmt.validate('not array' as any, 'csv');
      expect(v.valid).toBe(false);
    });

    it('should detect null rows', () => {
      const v = fmt.validate([null, { a: 1 }], 'csv');
      expect(v.valid).toBe(false);
    });

    it('should detect non-object rows', () => {
      const v = fmt.validate([42], 'csv');
      expect(v.valid).toBe(false);
    });

    it('should detect backtest missing OHLC', () => {
      const v = fmt.validate([{ foo: 'bar' }], 'backtest');
      expect(v.valid).toBe(false);
      expect(v.errors[0]).toContain('OHLC');
    });
  });

  // ── registerFormat / unregisterFormat ─────────────────────────────────

  describe('registerFormat', () => {
    it('should register a custom format', () => {
      fmt.registerFormat({
        id: 'custom',
        name: 'Custom',
        mimeType: 'text/plain',
        extension: '.txt',
        encoder: (data) => JSON.stringify(data),
        decoder: (input) => JSON.parse(input as string),
      });
      expect(fmt.getFormat('custom')).toBeDefined();
    });

    it('should throw if missing id/encoder/decoder', () => {
      expect(() => fmt.registerFormat({ id: '', name: '', mimeType: '', extension: '', encoder: null as any, decoder: null as any }))
        .toThrow();
    });
  });

  describe('unregisterFormat', () => {
    it('should remove a format', () => {
      expect(fmt.unregisterFormat('csv')).toBe(true);
      expect(fmt.getFormat('csv')).toBeUndefined();
    });

    it('should return false for non-existent format', () => {
      expect(fmt.unregisterFormat('nope')).toBe(false);
    });
  });

  // ── batchEncode ───────────────────────────────────────────────────────

  describe('batchEncode', () => {
    it('should encode to multiple formats', () => {
      const data = [{ a: 1 }];
      const results = fmt.batchEncode(data, ['csv', 'json']);
      expect(results.size).toBe(2);
      expect(results.get('csv')!.success).toBe(true);
      expect(results.get('json')!.success).toBe(true);
    });
  });

  // ── streamDecodeCSV ───────────────────────────────────────────────────

  describe('streamDecodeCSV', () => {
    it('should yield batches of rows', () => {
      const csv = 'a,b\n1,2\n3,4\n5,6';
      const batches: unknown[][] = [];
      for (const batch of fmt.streamDecodeCSV(csv, 2)) {
        batches.push(batch);
      }
      expect(batches.length).toBe(2);
      expect(batches[0].length).toBe(2);
      expect(batches[1].length).toBe(1);
    });

    it('should handle empty CSV', () => {
      const batches: unknown[][] = [];
      for (const batch of fmt.streamDecodeCSV('')) {
        batches.push(batch);
      }
      expect(batches.length).toBe(0);
    });
  });

  // ── streamDecodeNDJSON ────────────────────────────────────────────────

  describe('streamDecodeNDJSON', () => {
    it('should yield batches of JSON objects', () => {
      const ndjson = '{"a":1}\n{"a":2}\n{"a":3}';
      const batches: unknown[][] = [];
      for (const batch of fmt.streamDecodeNDJSON(ndjson, 2)) {
        batches.push(batch);
      }
      expect(batches.length).toBe(2);
    });

    it('should skip invalid lines', () => {
      const ndjson = '{"a":1}\ninvalid\n{"a":3}';
      const batches: unknown[][] = [];
      for (const batch of fmt.streamDecodeNDJSON(ndjson, 10)) {
        batches.push(batch);
      }
      expect(batches.length).toBe(1);
      expect(batches[0].length).toBe(2);
    });
  });

  // ── summarize ─────────────────────────────────────────────────────────

  describe('summarize', () => {
    it('should produce a summary string', () => {
      const data = [{ a: 1, b: 'hello' }, { a: 2, b: 'world' }];
      const s = fmt.summarize(data);
      expect(s).toContain('2 rows');
      expect(s).toContain('2 columns');
    });

    it('should handle empty data', () => {
      expect(fmt.summarize([])).toBe('(empty dataset)');
    });

    it('should truncate long values', () => {
      const data = [{ text: 'a'.repeat(50) }];
      const s = fmt.summarize(data);
      expect(s).toContain('...');
    });
  });

  // ── singleton ─────────────────────────────────────────────────────────

  describe('singleton', () => {
    it('dataFormatter should be an instance', () => {
      expect(dataFormatter).toBeInstanceOf(DataFormatter);
    });
  });

  // ── decode error handling ─────────────────────────────────────────────

  describe('decode error handling', () => {
    it('should return success:false for unknown format', () => {
      const result = fmt.decode('data', 'nonexistent');
      expect(result.success).toBe(false);
    });

    it('should return success:true for empty input', () => {
      const result = fmt.decode('', 'csv');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(0);
    });

    it('should handle Buffer input for csv', () => {
      const buf = Buffer.from('a,b\n1,2');
      const result = fmt.decode(buf.toString(), 'csv');
      expect(result.success).toBe(true);
    });
  });

  // ── encode error handling ─────────────────────────────────────────────

  describe('encode error handling', () => {
    it('should return success:false for unknown format', () => {
      const result = fmt.encode([{ a: 1 }], 'nonexistent');
      expect(result.success).toBe(false);
    });
  });

  // ── Infer column types ────────────────────────────────────────────────

  describe('backtest encoder with type inference', () => {
    it('should handle Date timestamps', () => {
      const data = [{ open: 100, high: 110, low: 95, close: 105, volume: 1000, time: new Date('2024-01-01') }];
      const result = fmt.encode(data, 'backtest');
      const parsed = JSON.parse(result.output as string);
      expect(parsed.bars[0].t).toBe(new Date('2024-01-01').getTime());
    });

    it('should handle string timestamps', () => {
      const data = [{ open: 100, high: 110, low: 95, close: 105, volume: 1000, time: '2024-01-01T00:00:00Z' }];
      const result = fmt.encode(data, 'backtest');
      const parsed = JSON.parse(result.output as string);
      expect(typeof parsed.bars[0].t).toBe('number');
    });
  });
});
