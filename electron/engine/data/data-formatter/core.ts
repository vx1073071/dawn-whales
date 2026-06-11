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
      throw new EngineError(ErrorCode.DATA_SOURCE_ERROR, 'FormatDefinition must have id, encoder, and decoder');
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
    data: unknown[],
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
    } catch (err: unknown) {
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
    data: unknown[],
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
  validate(data: unknown[], formatId: string): ValidationResult {
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
    } catch (err: unknown) {
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
    data: unknown[],
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
  ): Generator<unknown[], void, undefined> {
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

    let batch: unknown[] = [];

    for (let i = startLine; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter, quoteChar);

      if (includeHeader) {
        const row: Record<string, unknown> = {};
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
  ): Generator<unknown[], void, undefined> {
    const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
    let batch: unknown[] = [];

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
  summarize(data: unknown[], maxRows: number = 5): string {
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

