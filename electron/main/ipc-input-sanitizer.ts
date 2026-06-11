// ── DAWN WHALES — IPC Input Sanitizer (R92 J-01) ──────────────────────────
// Universal input validation and sanitization for all IPC handlers.
// Applied as a middleware layer before handler execution.

import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';

// ── Configuration ─────────────────────────────────────────────────────────

export interface SanitizerConfig {
  /** Max string length (default: 10000) */
  maxStringLength?: number;
  /** Max array length (default: 1000) */
  maxArrayLength?: number;
  /** Max object depth (default: 10) */
  maxDepth?: number;
  /** Strip HTML tags from strings (default: true) */
  stripHtml?: boolean;
  /** Allowed HTML tags (default: none) */
  allowedTags?: string[];
}

const DEFAULT_CONFIG: SanitizerConfig = {
  maxStringLength: 10000,
  maxArrayLength: 1000,
  maxDepth: 10,
  stripHtml: true,
  allowedTags: [],
};

// ── HTML Sanitization ─────────────────────────────────────────────────────

/** Strip all HTML tags from a string */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/** Escape HTML special characters */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitize a string for safe usage in IPC context.
 * - Strips HTML tags (configurable)
 * - Enforces length limits
 * - Removes null bytes and control characters
 */
export function sanitizeString(input: string, config: SanitizerConfig = DEFAULT_CONFIG): string {
  // Remove null bytes and control characters (except \n, \r, \t)
  let result = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Strip HTML tags
  if (config.stripHtml) {
    result = stripHtmlTags(result);
  }

  // Enforce length limit
  const maxLen = config.maxStringLength ?? 10000;
  if (result.length > maxLen) {
    result = result.substring(0, maxLen);
  }

  return result;
}

// ── Deep Sanitization ─────────────────────────────────────────────────────

/**
 * Deep-sanitize an IPC argument object.
 * - Recursively sanitizes all string values
 * - Enforces depth limits
 * - Enforces array length limits
 * - Throws EngineError on malformed input
 */
export function sanitizeInput<T>(input: unknown, config: SanitizerConfig = DEFAULT_CONFIG): T {
  const maxDepth = config.maxDepth ?? 10;
  const maxArrayLen = config.maxArrayLength ?? 1000;

  function sanitize(value: unknown, depth: number): unknown {
    if (depth > maxDepth) {
      throw new EngineError(
        ErrorDomain.VALIDATION,
        ErrorCode.INVALID_PARAM,
        `IPC input exceeds maximum nesting depth (${maxDepth})`,
        { context: { depth } }
      );
    }

    if (value === null || value === undefined) return value;

    if (typeof value === 'string') {
      return sanitizeString(value, config);
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new EngineError(
          ErrorDomain.VALIDATION,
          ErrorCode.INVALID_PARAM,
          `IPC input contains non-finite number: ${value}`,
          { context: { value: String(value) } }
        );
      }
      return value;
    }

    if (typeof value === 'boolean') return value;

    if (Array.isArray(value)) {
      if (value.length > maxArrayLen) {
        throw new EngineError(
          ErrorDomain.VALIDATION,
          ErrorCode.INVALID_PARAM,
          `IPC input array exceeds maximum length (${maxArrayLen})`,
          { context: { arrayLength: value.length } }
        );
      }
      return value.map((item) => sanitize(item, depth + 1));
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        // Sanitize keys too (prevent prototype pollution)
        const safeKey = sanitizeString(String(key), { ...config, stripHtml: true, maxStringLength: 256 });
        if (safeKey === '__proto__' || safeKey === 'constructor' || safeKey === 'prototype') {
          throw new EngineError(
            ErrorDomain.VALIDATION,
            ErrorCode.INVALID_PARAM,
            `IPC input contains forbidden key: ${safeKey}`,
            { context: { key: safeKey } }
          );
        }
        result[safeKey] = sanitize(val, depth + 1);
      }
      return result;
    }

    // Functions, symbols, etc. are not allowed
    throw new EngineError(
      ErrorDomain.VALIDATION,
      ErrorCode.INVALID_PARAM,
      `IPC input contains unsupported type: ${typeof value}`,
      { context: { type: typeof value } }
    );
  }

  return sanitize(input, 0) as T;
}

// ── Validation Helpers ────────────────────────────────────────────────────

/** Validate that a value is a non-empty string */
export function requireString(value: unknown, fieldName: string, maxLength = 256): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EngineError(
      ErrorDomain.VALIDATION,
      ErrorCode.INVALID_PARAM,
      `'${fieldName}' must be a non-empty string`,
      { context: { fieldName, receivedType: typeof value } }
    );
  }
  if (value.length > maxLength) {
    throw new EngineError(
      ErrorDomain.VALIDATION,
      ErrorCode.INVALID_PARAM,
      `'${fieldName}' exceeds maximum length (${maxLength})`,
      { context: { fieldName, length: value.length, maxLength } }
    );
  }
  return sanitizeString(value);
}

/** Validate that a value is a valid number within range */
export function requireNumber(value: unknown, fieldName: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new EngineError(
      ErrorDomain.VALIDATION,
      ErrorCode.INVALID_PARAM,
      `'${fieldName}' must be a finite number`,
      { context: { fieldName, receivedType: typeof value } }
    );
  }
  if (value < min || value > max) {
    throw new EngineError(
      ErrorDomain.VALIDATION,
      ErrorCode.INVALID_PARAM,
      `'${fieldName}' out of range [${min}, ${max}]: ${value}`,
      { context: { fieldName, value, min, max } }
    );
  }
  return value;
}

/** Validate that a value is a boolean */
export function requireBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new EngineError(
      ErrorDomain.VALIDATION,
      ErrorCode.INVALID_PARAM,
      `'${fieldName}' must be a boolean`,
      { context: { fieldName, receivedType: typeof value } }
    );
  }
  return value;
}

/** Validate that a value is an array with length constraints */
export function requireArray<T>(value: unknown, fieldName: string, maxLength = 1000): T[] {
  if (!Array.isArray(value)) {
    throw new EngineError(
      ErrorDomain.VALIDATION,
      ErrorCode.INVALID_PARAM,
      `'${fieldName}' must be an array`,
      { context: { fieldName, receivedType: typeof value } }
    );
  }
  if (value.length > maxLength) {
    throw new EngineError(
      ErrorDomain.VALIDATION,
      ErrorCode.INVALID_PARAM,
      `'${fieldName}' exceeds maximum length (${maxLength})`,
      { context: { fieldName, length: value.length, maxLength } }
    );
  }
  return value as T[];
}

/** Validate symbol/stock code format (alphanumeric + dots/hyphens) */
export function requireSymbol(value: unknown, fieldName = 'symbol'): string {
  const str = requireString(value, fieldName, 32);
  if (!/^[A-Za-z0-9.\-_]+$/.test(str)) {
    throw new EngineError(
      ErrorDomain.VALIDATION,
      ErrorCode.INVALID_PARAM,
      `'${fieldName}' contains invalid characters: ${str}`,
      { context: { fieldName, value: str } }
    );
  }
  return str.toUpperCase();
}
