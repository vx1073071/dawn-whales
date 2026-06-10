// JVS-50-02: Error Handler Module
// Comprehensive error handling, boundary condition validation, and error reporting

import { EventEmitter } from 'events';
import log from 'electron-log';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 'validation' | 'boundary' | 'system' | 'network' | 'timeout';

export interface ErrorInfo {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  stack?: string;
}

export interface ErrorHandlerConfig {
  maxErrors: number;
  enableLogging: boolean;
  enableRetry: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

export class ErrorHandler extends EventEmitter {
  private errors: ErrorInfo[] = [];
  private config: ErrorHandlerConfig;
  private retryCount: Map<string, number> = new Map();

  constructor(config?: Partial<ErrorHandlerConfig>) {
    super();
    this.config = {
      maxErrors: config?.maxErrors ?? 1000,
      enableLogging: config?.enableLogging ?? true,
      enableRetry: config?.enableRetry ?? true,
      maxRetries: config?.maxRetries ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 1000,
    };
  }

  /**
   * Handle an error
   */
  handleError(error: Error | string, category: ErrorCategory = 'system'): ErrorInfo {
    const errorObj: ErrorInfo = {
      id: this.generateId(),
      category,
      severity: this.assessSeverity(category),
      message: typeof error === 'string' ? error : error.message,
      timestamp: Date.now(),
      stack: error instanceof Error ? error.stack : undefined,
    };

    this.errors.push(errorObj);

    // Keep only last maxErrors
    if (this.errors.length > this.config.maxErrors) {
      this.errors.shift();
    }

    // Emit error event
    this.emit('error:handled', errorObj);

    // Log if enabled
    if (this.config.enableLogging) {
      this.logError(errorObj);
    }

    return errorObj;
  }

  /**
   * Assess error severity
   */
  private assessSeverity(category: ErrorCategory): ErrorSeverity {
    switch (category) {
      case 'validation':
        return 'low';
      case 'boundary':
        return 'medium';
      case 'network':
        return 'medium';
      case 'timeout':
        return 'high';
      case 'system':
        return 'critical';
      default:
        return 'medium';
    }
  }

  /**
   * Log error
   */
  private logError(error: ErrorInfo): void {
    const logMessage = `[ErrorHandler] [${error.category}] ${error.message}`;
    log.info(logMessage);
  }

  /**
   * Check if operation should be retried
   */
  shouldRetry(operationId: string): boolean {
    if (!this.config.enableRetry) return false;

    const count = this.retryCount.get(operationId) ?? 0;
    return count < this.config.maxRetries;
  }

  /**
   * Record retry attempt
   */
  recordRetry(operationId: string): void {
    const count = this.retryCount.get(operationId) ?? 0;
    this.retryCount.set(operationId, count + 1);
  }

  /**
   * Get retry count for operation
   */
  getRetryCount(operationId: string): number {
    return this.retryCount.get(operationId) ?? 0;
  }

  /**
   * Reset retry count
   */
  resetRetryCount(operationId: string): void {
    this.retryCount.delete(operationId);
  }

  /**
   * Get all errors
   */
  getErrors(): ErrorInfo[] {
    return [...this.errors];
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): ErrorInfo[] {
    return this.errors.filter((e) => e.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): ErrorInfo[] {
    return this.errors.filter((e) => e.severity === severity);
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    totalErrors: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
  } {
    const byCategory: Record<ErrorCategory, number> = {
      validation: 0,
      boundary: 0,
      system: 0,
      network: 0,
      timeout: 0,
    };

    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const error of this.errors) {
      byCategory[error.category]++;
      bySeverity[error.severity]++;
    }

    return {
      totalErrors: this.errors.length,
      byCategory,
      bySeverity,
    };
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = [];
    this.retryCount.clear();
    this.emit('clear');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Validation utilities
export class BoundaryValidator {
  /**
   * Validate number is within range
   */
  static validateRange(
    value: number,
    min: number,
    max: number,
    fieldName: string = 'value'
  ): { valid: boolean; error?: string } {
    if (typeof value !== 'number' || isNaN(value)) {
      return { valid: false, error: `${fieldName} must be a valid number` };
    }

    if (value < min || value > max) {
      return {
        valid: false,
        error: `${fieldName} must be between ${min} and ${max}, got ${value}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate array length
   */
  static validateArrayLength<T>(
    array: T[],
    minLength: number,
    maxLength: number,
    fieldName: string = 'array'
  ): { valid: boolean; error?: string } {
    if (!Array.isArray(array)) {
      return { valid: false, error: `${fieldName} must be an array` };
    }

    if (array.length < minLength || array.length > maxLength) {
      return {
        valid: false,
        error: `${fieldName} length must be between ${minLength} and ${maxLength}, got ${array.length}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate string length
   */
  static validateStringLength(
    value: string,
    minLength: number,
    maxLength: number,
    fieldName: string = 'string'
  ): { valid: boolean; error?: string } {
    if (typeof value !== 'string') {
      return { valid: false, error: `${fieldName} must be a string` };
    }

    if (value.length < minLength || value.length > maxLength) {
      return {
        valid: false,
        error: `${fieldName} length must be between ${minLength} and ${maxLength}, got ${value.length}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate enum value
   */
  static validateEnum<T>(
    value: T,
    validValues: T[],
    fieldName: string = 'value'
  ): { valid: boolean; error?: string } {
    if (!validValues.includes(value)) {
      return {
        valid: false,
        error: `${fieldName} must be one of: ${validValues.join(', ')}, got ${value}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate required field
   */
  static validateRequired(value: any, fieldName: string): { valid: boolean; error?: string } {
    if (value === undefined || value === null) {
      return { valid: false, error: `${fieldName} is required` };
    }

    return { valid: true };
  }

  /**
   * Validate number is positive
   */
  static validatePositive(value: number, fieldName: string = 'value'): { valid: boolean; error?: string } {
    if (typeof value !== 'number' || isNaN(value)) {
      return { valid: false, error: `${fieldName} must be a valid number` };
    }

    if (value <= 0) {
      return { valid: false, error: `${fieldName} must be positive, got ${value}` };
    }

    return { valid: true };
  }

  /**
   * Validate date is in the future
   */
  static validateFutureDate(date: Date, fieldName: string = 'date'): { valid: boolean; error?: string } {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return { valid: false, error: `${fieldName} must be a valid date` };
    }

    if (date.getTime() <= Date.now()) {
      return { valid: false, error: `${fieldName} must be in the future` };
    }

    return { valid: true };
  }
}

// Singleton instance
let errorHandlerInstance: ErrorHandler | null = null;

export function getErrorHandler(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new ErrorHandler(config);
  }
  return errorHandlerInstance;
}
