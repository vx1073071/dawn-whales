// JVS-50-02: Error Handler Tests
// 15+ tests for error handling and boundary validation

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ErrorHandler,
  BoundaryValidator,
  getErrorHandler,
} from '../electron/engine/core/error-handler';

describe('JVS-50-02: ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler({
      maxErrors: 100,
      enableLogging: false,
      enableRetry: true,
      maxRetries: 3,
      retryDelayMs: 1000,
    });
  });

  afterEach(() => {
    handler.clear();
  });

  describe('Error Handling', () => {
    it('should handle string error', () => {
      const error = handler.handleError('Test error', 'system');
      expect(error).toBeDefined();
      expect(error.message).toBe('Test error');
      expect(error.category).toBe('system');
    });

    it('should handle Error object', () => {
      const error = handler.handleError(new Error('Test error'), 'validation');
      expect(error).toBeDefined();
      expect(error.message).toBe('Test error');
      expect(error.category).toBe('validation');
      expect(error.stack).toBeDefined();
    });

    it('should generate unique IDs', () => {
      const error1 = handler.handleError('Error 1', 'system');
      const error2 = handler.handleError('Error 2', 'system');
      expect(error1.id).not.toBe(error2.id);
    });

    it('should keep only maxErrors', () => {
      const smallHandler = new ErrorHandler({ maxErrors: 5 });

      for (let i = 0; i < 10; i++) {
        smallHandler.handleError(`Error ${i}`, 'system');
      }

      const errors = smallHandler.getErrors();
      expect(errors.length).toBe(5);
    });

    it('should emit error:handled event', () => {
      let emitted = false;
      handler.on('error:handled', () => {
        emitted = true;
      });

      handler.handleError('Test error', 'system');
      expect(emitted).toBe(true);
    });
  });

  describe('Error Severity', () => {
    it('should assess validation errors as low severity', () => {
      const error = handler.handleError('Validation error', 'validation');
      expect(error.severity).toBe('low');
    });

    it('should assess boundary errors as medium severity', () => {
      const error = handler.handleError('Boundary error', 'boundary');
      expect(error.severity).toBe('medium');
    });

    it('should assess network errors as medium severity', () => {
      const error = handler.handleError('Network error', 'network');
      expect(error.severity).toBe('medium');
    });

    it('should assess timeout errors as high severity', () => {
      const error = handler.handleError('Timeout error', 'timeout');
      expect(error.severity).toBe('high');
    });

    it('should assess system errors as critical severity', () => {
      const error = handler.handleError('System error', 'system');
      expect(error.severity).toBe('critical');
    });
  });

  describe('Retry Logic', () => {
    it('should allow retry when under max retries', () => {
      const shouldRetry = handler.shouldRetry('op1');
      expect(shouldRetry).toBe(true);
    });

    it('should record retry attempts', () => {
      handler.recordRetry('op1');
      handler.recordRetry('op1');
      const count = handler.getRetryCount('op1');
      expect(count).toBe(2);
    });

    it('should prevent retry when max retries reached', () => {
      handler.recordRetry('op1');
      handler.recordRetry('op1');
      handler.recordRetry('op1');
      const shouldRetry = handler.shouldRetry('op1');
      expect(shouldRetry).toBe(false);
    });

    it('should reset retry count', () => {
      handler.recordRetry('op1');
      handler.recordRetry('op1');
      handler.resetRetryCount('op1');
      const count = handler.getRetryCount('op1');
      expect(count).toBe(0);
    });

    it('should return 0 for non-existent retry count', () => {
      const count = handler.getRetryCount('nonexistent');
      expect(count).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate statistics', () => {
      handler.handleError('Error 1', 'validation');
      handler.handleError('Error 2', 'system');
      handler.handleError('Error 3', 'network');

      const stats = handler.getStatistics();
      expect(stats.totalErrors).toBe(3);
      expect(stats.byCategory.validation).toBe(1);
      expect(stats.byCategory.system).toBe(1);
      expect(stats.byCategory.network).toBe(1);
    });

    it('should calculate severity statistics', () => {
      handler.handleError('Error 1', 'validation'); // low
      handler.handleError('Error 2', 'system'); // critical
      handler.handleError('Error 3', 'timeout'); // high

      const stats = handler.getStatistics();
      expect(stats.bySeverity.low).toBe(1);
      expect(stats.bySeverity.high).toBe(1);
      expect(stats.bySeverity.critical).toBe(1);
    });

    it('should filter errors by category', () => {
      handler.handleError('Error 1', 'validation');
      handler.handleError('Error 2', 'system');
      handler.handleError('Error 3', 'validation');

      const validationErrors = handler.getErrorsByCategory('validation');
      expect(validationErrors.length).toBe(2);
    });

    it('should filter errors by severity', () => {
      handler.handleError('Error 1', 'validation'); // low
      handler.handleError('Error 2', 'system'); // critical
      handler.handleError('Error 3', 'validation'); // low

      const lowErrors = handler.getErrorsBySeverity('low');
      expect(lowErrors.length).toBe(2);
    });
  });

  describe('Clear', () => {
    it('should clear all errors', () => {
      handler.handleError('Error 1', 'system');
      handler.handleError('Error 2', 'system');

      handler.clear();
      const errors = handler.getErrors();
      expect(errors.length).toBe(0);
    });

    it('should emit clear event', () => {
      let cleared = false;
      handler.on('clear', () => {
        cleared = true;
      });

      handler.clear();
      expect(cleared).toBe(true);
    });
  });
});

describe('JVS-50-02: BoundaryValidator', () => {
  describe('validateRange', () => {
    it('should validate number within range', () => {
      const result = BoundaryValidator.validateRange(50, 0, 100, 'value');
      expect(result.valid).toBe(true);
    });

    it('should reject number below min', () => {
      const result = BoundaryValidator.validateRange(-1, 0, 100, 'value');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be between');
    });

    it('should reject number above max', () => {
      const result = BoundaryValidator.validateRange(150, 0, 100, 'value');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be between');
    });

    it('should reject invalid number', () => {
      const result = BoundaryValidator.validateRange(NaN, 0, 100, 'value');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a valid number');
    });
  });

  describe('validateArrayLength', () => {
    it('should validate array within length range', () => {
      const result = BoundaryValidator.validateArrayLength([1, 2, 3], 1, 5, 'array');
      expect(result.valid).toBe(true);
    });

    it('should reject array below min length', () => {
      const result = BoundaryValidator.validateArrayLength([], 1, 5, 'array');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('length must be between');
    });

    it('should reject array above max length', () => {
      const result = BoundaryValidator.validateArrayLength([1, 2, 3, 4, 5, 6], 1, 5, 'array');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('length must be between');
    });

    it('should reject non-array', () => {
      const result = BoundaryValidator.validateArrayLength('not an array' as any, 1, 5, 'array');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be an array');
    });
  });

  describe('validateStringLength', () => {
    it('should validate string within length range', () => {
      const result = BoundaryValidator.validateStringLength('test', 1, 10, 'string');
      expect(result.valid).toBe(true);
    });

    it('should reject string below min length', () => {
      const result = BoundaryValidator.validateStringLength('', 1, 10, 'string');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('length must be between');
    });

    it('should reject string above max length', () => {
      const result = BoundaryValidator.validateStringLength('very long string', 1, 10, 'string');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('length must be between');
    });

    it('should reject non-string', () => {
      const result = BoundaryValidator.validateStringLength(123 as any, 1, 10, 'string');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a string');
    });
  });

  describe('validateEnum', () => {
    it('should validate valid enum value', () => {
      const result = BoundaryValidator.validateEnum('a', ['a', 'b', 'c'], 'value');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid enum value', () => {
      const result = BoundaryValidator.validateEnum('d', ['a', 'b', 'c'], 'value');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });
  });

  describe('validateRequired', () => {
    it('should validate required field', () => {
      const result = BoundaryValidator.validateRequired('value', 'field');
      expect(result.valid).toBe(true);
    });

    it('should reject undefined required field', () => {
      const result = BoundaryValidator.validateRequired(undefined, 'field');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('is required');
    });

    it('should reject null required field', () => {
      const result = BoundaryValidator.validateRequired(null, 'field');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('is required');
    });
  });

  describe('validatePositive', () => {
    it('should validate positive number', () => {
      const result = BoundaryValidator.validatePositive(10, 'value');
      expect(result.valid).toBe(true);
    });

    it('should reject zero', () => {
      const result = BoundaryValidator.validatePositive(0, 'value');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be positive');
    });

    it('should reject negative number', () => {
      const result = BoundaryValidator.validatePositive(-10, 'value');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be positive');
    });
  });

  describe('validateFutureDate', () => {
    it('should validate future date', () => {
      const futureDate = new Date(Date.now() + 86400000); // 1 day from now
      const result = BoundaryValidator.validateFutureDate(futureDate, 'date');
      expect(result.valid).toBe(true);
    });

    it('should reject past date', () => {
      const pastDate = new Date(Date.now() - 86400000); // 1 day ago
      const result = BoundaryValidator.validateFutureDate(pastDate, 'date');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be in the future');
    });

    it('should reject invalid date', () => {
      const result = BoundaryValidator.validateFutureDate(new Date('invalid'), 'date');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a valid date');
    });
  });
});
