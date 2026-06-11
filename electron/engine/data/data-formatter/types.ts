export interface FormatDefinition {
  id: string;
  name: string;
  mimeType: string;
  extension: string;
  encoder: (data: unknown[], options?: FormatOptions) => string | Buffer;
  decoder: (input: string | Buffer, options?: FormatOptions) => unknown[];
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
