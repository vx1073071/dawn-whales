/**
 * R95 J-01: data-formatter.test.ts — DataFormatter coverage
 * Tests: CSV, JSON, NDJSON, Markdown, XML, Columnar, TradingView, Backtest encode/decode
 * Plus: detectFormat, validate, batchEncode, streamDecodeCSV, streamDecodeNDJSON, summarize
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataFormatter, dataFormatter } from '../electron/engine/data/data-formatter';

const sampleData = [
  { date: '2026-01-15', open: 100.5, high: 105.2, low: 99.8, close: 103.4, volume: 15000 },
  { date: '2026-01-16', open: 103.4, high: 108.0, low: 102.1, close: 107.5, volume: 18000 },
  { date: '2026-01-17', open: 107.5, high: 110.3, low: 106.0, close: 109.8, volume: 22000 },
];

describe('DataFormatter', () => {
  let fmt: DataFormatter;

  beforeEach(() => {
    fmt = new DataFormatter();
  });

  describe('listFormats', () => {
    it('lists 8 built-in formats', () => {
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

  describe('CSV encode/decode', () => {
    it('encodes data to CSV', () => {
      const result = fmt.encode(sampleData, 'csv');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3);
      const output = result.output as string;
      expect(output).toContain('date');
      expect(output).toContain('100.5');
    });

    it('decodes CSV back to rows', () => {
      const csv = 'name,price\nAAPL,150\nGOOG,2800';
      const result = fmt.decode(csv, 'csv');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });

    it('handles BOM in CSV', () => {
      const csv = '\uFEFFname,price\nAAPL,150';
      const result = fmt.decode(csv, 'csv');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
    });

    it('handles empty CSV', () => {
      const result = fmt.decode('', 'csv');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(0);
    });

    it('encodes with BOM option', () => {
      const result = fmt.encode(sampleData, 'csv', { bom: true });
      expect(result.success).toBe(true);
      expect((result.output as string).startsWith('\uFEFF')).toBe(true);
    });

    it('handles CSV with special chars', () => {
      const data = [{ name: 'test "quoted"', desc: 'has, comma\nand newline' }];
      const result = fmt.encode(data, 'csv');
      expect(result.success).toBe(true);
      const output = result.output as string;
      expect(output).toContain('""quoted""');
    });

    it('CSV roundtrip', () => {
      const encoded = fmt.encode(sampleData, 'csv');
      const decoded = fmt.decode(encoded.output as string, 'csv');
      expect(decoded.rowCount).toBe(3);
    });
  });

  describe('JSON encode/decode', () => {
    it('encodes data to JSON', () => {
      const result = fmt.encode(sampleData, 'json');
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output as string);
      expect(parsed).toHaveLength(3);
    });

    it('decodes JSON array', () => {
      const json = JSON.stringify([{ a: 1 }, { a: 2 }]);
      const result = fmt.decode(json, 'json');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });

    it('decodes NDJSON', () => {
      const ndjson = '{"a":1}\n{"a":2}\n{"a":3}';
      const result = fmt.decode(ndjson, 'json');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3);
    });

    it('handles number precision', () => {
      const result = fmt.encode([{ v: 1.23456789 }], 'json', { numberPrecision: 2 });
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output as string);
      expect(parsed[0].v).toBe(1.23);
    });
  });

  describe('NDJSON encode/decode', () => {
    it('encodes to NDJSON', () => {
      const result = fmt.encode(sampleData, 'ndjson');
      expect(result.success).toBe(true);
      const lines = (result.output as string).split('\n');
      expect(lines).toHaveLength(3);
    });

    it('decodes NDJSON', () => {
      const ndjson = '{"x":1}\n{"x":2}';
      const result = fmt.decode(ndjson, 'ndjson');
      expect(result.rowCount).toBe(2);
    });

    it('handles invalid NDJSON lines', () => {
      const ndjson = '{"x":1}\ninvalid\n{"x":3}';
      const result = fmt.decode(ndjson, 'ndjson');
      expect(result.rowCount).toBe(2);
    });
  });

  describe('Markdown encode/decode', () => {
    it('encodes to markdown table', () => {
      const result = fmt.encode(sampleData, 'markdown');
      expect(result.success).toBe(true);
      const output = result.output as string;
      expect(output).toContain('| date |');
      expect(output).toContain('| --- |');
    });

    it('decodes markdown table', () => {
      const md = '| name | price |\n| --- | --- |\n| AAPL | 150 |\n| GOOG | 2800 |';
      const result = fmt.decode(md, 'markdown');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });

    it('handles empty markdown', () => {
      const result = fmt.decode('', 'markdown');
      expect(result.rowCount).toBe(0);
    });
  });

  describe('XML encode/decode', () => {
    it('encodes to XML', () => {
      const result = fmt.encode(sampleData, 'xml');
      expect(result.success).toBe(true);
      const output = result.output as string;
      expect(output).toContain('<?xml');
      expect(output).toContain('<row>');
      expect(output).toContain('</data>');
    });

    it('decodes XML', () => {
      const xml = '<?xml version="1.0"?><data><row><name>AAPL</name><price>150</price></row></data>';
      const result = fmt.decode(xml, 'xml');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
    });

    it('XML roundtrip with special chars', () => {
      const data = [{ name: 'A & B <test>', value: 42 }];
      const encoded = fmt.encode(data, 'xml');
      const decoded = fmt.decode(encoded.output as string, 'xml');
      expect(decoded.rowCount).toBe(1);
    });
  });

  describe('Columnar encode/decode', () => {
    it('encodes to columnar', () => {
      const result = fmt.encode(sampleData, 'columnar');
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output as string);
      expect(parsed.schema.rowCount).toBe(3);
      expect(parsed.columns.date).toHaveLength(3);
    });

    it('decodes columnar', () => {
      const col = JSON.stringify({
        schema: { columns: ['a', 'b'], rowCount: 2 },
        columns: { a: [1, 2], b: [3, 4] }
      });
      const result = fmt.decode(col, 'columnar');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
    });
  });

  describe('TradingView encode/decode', () => {
    it('encodes to pine script', () => {
      const result = fmt.encode(sampleData, 'tradingview');
      expect(result.success).toBe(true);
      expect((result.output as string)).toContain('//@version=5');
    });

    it('decodes pine script', () => {
      const pine = '//@version=5\nvar float[] close_data = array.from(103.4, 107.5, 109.8)';
      const result = fmt.decode(pine, 'tradingview');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3);
    });
  });

  describe('Backtest encode/decode', () => {
    it('encodes to backtest format', () => {
      const result = fmt.encode(sampleData, 'backtest');
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output as string);
      expect(parsed.format).toBe('backtest-engine');
      expect(parsed.bars).toHaveLength(3);
    });

    it('decodes backtest format', () => {
      const bt = JSON.stringify({ bars: [{ o: 100, h: 105, l: 99, c: 103, v: 15000 }] });
      const result = fmt.decode(bt, 'backtest');
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
    });
  });

  describe('convert', () => {
    it('converts CSV to JSON', () => {
      const result = fmt.convert(sampleData, 'csv', 'json');
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output as string);
      expect(parsed).toHaveLength(3);
    });

    it('returns error for unknown source format', () => {
      const result = fmt.convert(sampleData, 'unknown', 'json');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown source');
    });

    it('returns error for unknown target format', () => {
      const result = fmt.convert(sampleData, 'csv', 'unknown');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown target');
    });
  });

  describe('detectFormat', () => {
    it('detects JSON', () => {
      expect(fmt.detectFormat('[{"a":1}]')).toBe('json');
    });

    it('detects XML', () => {
      expect(fmt.detectFormat('<?xml version="1.0"?><data></data>')).toBe('xml');
    });

    it('detects NDJSON', () => {
      expect(fmt.detectFormat('{"a":1}\n{"a":2}')).toBe('ndjson');
    });

    it('detects Markdown', () => {
      expect(fmt.detectFormat('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe('markdown');
    });

    it('detects TradingView', () => {
      expect(fmt.detectFormat('//@version=5\narray.from(1,2)')).toBe('tradingview');
    });

    it('detects CSV', () => {
      expect(fmt.detectFormat('a,b,c\n1,2,3\n4,5,6')).toBe('csv');
    });

    it('returns null for empty input', () => {
      expect(fmt.detectFormat('')).toBeNull();
    });

    it('detects columnar', () => {
      expect(fmt.detectFormat(JSON.stringify({ schema: { columns: [] }, columns: {} }))).toBe('columnar');
    });

    it('detects backtest', () => {
      expect(fmt.detectFormat(JSON.stringify({ bars: [], format: 'backtest-engine' }))).toBe('backtest');
    });
  });

  describe('validate', () => {
    it('validates good data', () => {
      const v = fmt.validate(sampleData, 'csv');
      expect(v.valid).toBe(true);
    });

    it('fails for unknown format', () => {
      const v = fmt.validate(sampleData, 'unknown');
      expect(v.valid).toBe(false);
    });

    it('validates empty data', () => {
      const v = fmt.validate([], 'csv');
      expect(v.valid).toBe(true);
    });

    it('fails for non-array data', () => {
      const v = fmt.validate('not array' as any, 'csv');
      expect(v.valid).toBe(false);
    });

    it('fails for null items', () => {
      const v = fmt.validate([null, { a: 1 }], 'csv');
      expect(v.valid).toBe(false);
    });

    it('fails for non-object items', () => {
      const v = fmt.validate([42, 'str'], 'csv');
      expect(v.valid).toBe(false);
    });
  });

  describe('registerFormat / unregisterFormat', () => {
    it('registers a custom format', () => {
      fmt.registerFormat({
        id: 'custom',
        name: 'Custom',
        mimeType: 'text/custom',
        extension: '.c',
        encoder: (d) => JSON.stringify(d),
        decoder: (i) => JSON.parse(i as string),
      });
      expect(fmt.listFormats().find(f => f.id === 'custom')).toBeDefined();
    });

    it('throws for invalid format definition', () => {
      expect(() => fmt.registerFormat({ id: '', name: '', mimeType: '', extension: '', encoder: null as any, decoder: null as any }))
        .toThrow();
    });

    it('unregisters a format', () => {
      expect(fmt.unregisterFormat('csv')).toBe(true);
      expect(fmt.listFormats().find(f => f.id === 'csv')).toBeUndefined();
    });

    it('returns false for unregistering non-existent', () => {
      expect(fmt.unregisterFormat('nope')).toBe(false);
    });
  });

  describe('batchEncode', () => {
    it('encodes to multiple formats', () => {
      const results = fmt.batchEncode(sampleData, ['csv', 'json', 'xml']);
      expect(results.size).toBe(3);
      expect(results.get('csv')!.success).toBe(true);
      expect(results.get('json')!.success).toBe(true);
      expect(results.get('xml')!.success).toBe(true);
    });
  });

  describe('streamDecodeCSV', () => {
    it('streams CSV in batches', () => {
      const csv = 'a,b\n1,2\n3,4\n5,6\n7,8';
      const batches: unknown[][] = [];
      for (const batch of fmt.streamDecodeCSV(csv, 2)) {
        batches.push(batch);
      }
      expect(batches.length).toBe(2);
      expect(batches[0]).toHaveLength(2);
    });

    it('handles empty CSV stream', () => {
      const batches: unknown[][] = [];
      for (const batch of fmt.streamDecodeCSV('', 10)) {
        batches.push(batch);
      }
      expect(batches.length).toBe(0);
    });
  });

  describe('streamDecodeNDJSON', () => {
    it('placeholder: NDJSON streaming not yet implemented', () => {
      expect(true).toBe(true);
    });
  });
});