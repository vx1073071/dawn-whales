// JVS-46-02: TypeScript Strict Utilities
// Type-safe utilities for strict mode compliance and type safety

import log from 'electron-log';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for non-null values
 */
export function isNonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for defined values (not undefined)
 */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Type guard for non-empty strings
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard for positive numbers
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value > 0;
}

/**
 * Type guard for valid dates
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Type guard for arrays
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Type guard for non-empty arrays
 */
export function isNonEmptyArray<T>(value: unknown): value is [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Type guard for objects
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for plain objects (not class instances)
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

// ============================================================================
// Type-Safe Property Access
// ============================================================================

/**
 * Safely access nested object properties
 */
export function getProperty<T>(
  obj: Record<string, unknown> | undefined,
  path: string,
  defaultValue?: T
): T | undefined {
  if (!obj) return defaultValue;
  
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (!isObject(current)) return defaultValue;
    current = current[key];
  }
  
  return (current as T) ?? defaultValue;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as T;
  }
  
  const cloned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    cloned[key] = deepClone(value);
  }
  
  return cloned as T;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Partial<T>>
): T {
  const result = deepClone(target);
  
  for (const source of sources) {
    if (!source) continue;
    
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      
      if (isPlainObject(value) && isPlainObject(result[key])) {
        (result as Record<string, unknown>)[key] = deepMerge(
          result[key] as Record<string, unknown>,
          value
        );
      } else {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }
  
  return result;
}

// ============================================================================
// Validation Utilities
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate an object against a schema
 */
export function validateObject(
  obj: Record<string, unknown>,
  schema: Record<string, (value: unknown) => boolean>
): ValidationResult {
  const errors: string[] = [];
  
  for (const [key, validator] of Object.entries(schema)) {
    const value = obj[key];
    if (!validator(value)) {
      errors.push(`Invalid value for field: ${key}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a validator for string length
 */
export function stringLengthValidator(min: number, max: number) {
  return (value: unknown): boolean => {
    return typeof value === 'string' && value.length >= min && value.length <= max;
  };
}

/**
 * Create a validator for number range
 */
export function numberRangeValidator(min: number, max: number) {
  return (value: unknown): boolean => {
    return typeof value === 'number' && !Number.isNaN(value) && value >= min && value <= max;
  };
}

/**
 * Create a validator for enum values
 */
export function enumValidator<T>(allowedValues: T[]) {
  return (value: unknown): boolean => {
    return allowedValues.includes(value as T);
  };
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(json: string, defaultValue?: T): T | undefined {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    log.warn('[TypeScriptStrict] JSON parse error:', error);
    return defaultValue;
  }
}

/**
 * Wrap async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    log.error('[TypeScriptStrict] Async error:', error);
    return defaultValue;
  }
}

/**
 * Retry async function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log.warn(`[TypeScriptStrict] Retry attempt ${attempt + 1}/${maxRetries + 1} failed:`, lastError);
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Group array by key
 */
export function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  
  for (const item of array) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  
  return result;
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  
  return chunks;
}

/**
 * Unique array values
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Unique array by key
 */
export function uniqueBy<T>(
  array: T[],
  keyFn: (item: T) => string
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  
  for (const item of array) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return result;
}

/**
 * Sort array by multiple keys
 */
export function sortBy<T>(
  array: T[],
  ...comparators: Array<(a: T, b: T) => number>
): T[] {
  return [...array].sort((a, b) => {
    for (const comparator of comparators) {
      const result = comparator(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Format date to ISO string (safe)
 */
export function formatDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return isValidDate(d) ? d.toISOString() : '';
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Get days between two dates
 */
export function daysBetween(start: Date, end: Date): number {
  const diff = Math.abs(end.getTime() - start.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert camelCase to kebab-case
 */
export function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

// ============================================================================
// Singleton
// ============================================================================

let instance: TypeScriptStrictUtilities | null = null;

export class TypeScriptStrictUtilities {
  constructor() {
    log.info('[TypeScriptStrictUtilities] initialized');
  }

  // Expose all utilities as instance methods
  isNonNull = isNonNull;
  isDefined = isDefined;
  isNonEmptyString = isNonEmptyString;
  isPositiveNumber = isPositiveNumber;
  isValidDate = isValidDate;
  isArray = isArray;
  isNonEmptyArray = isNonEmptyArray;
  isObject = isObject;
  isPlainObject = isPlainObject;
  getProperty = getProperty;
  deepClone = deepClone;
  deepMerge = deepMerge;
  validateObject = validateObject;
  safeJsonParse = safeJsonParse;
  withErrorHandling = withErrorHandling;
  withRetry = withRetry;
  groupBy = groupBy;
  chunk = chunk;
  unique = unique;
  uniqueBy = uniqueBy;
  sortBy = sortBy;
  formatDate = formatDate;
  isToday = isToday;
  daysBetween = daysBetween;
  truncate = truncate;
  capitalize = capitalize;
  camelToKebab = camelToKebab;
  kebabToCamel = kebabToCamel;
}

export function getTypeScriptStrictUtilities(): TypeScriptStrictUtilities {
  if (!instance) {
    instance = new TypeScriptStrictUtilities();
  }
  return instance;
}

export default TypeScriptStrictUtilities;
