
﻿// T56: Runtime Config Schema Validator
export interface ConfigSchema {
  [key: string]: ConfigField;
}

export interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: any[];
  children?: ConfigSchema;
}

export interface ValidationError {
  path: string;
  message: string;
  expected?: string;
  got?: unknown;
}

export class ConfigValidator {
  private schema: ConfigSchema;

  constructor(schema: ConfigSchema) {
    this.schema = schema;
  }

  validate(config: Record<string, any>): ValidationError[] {
    return this._validateObj(config, this.schema, '');
  }

  validateAndFill(config: Record<string, any>): { errors: ValidationError[]; filled: Record<string, any> } {
    const errors: ValidationError[] = [];
    const filled = this._fillDefaults(config, this.schema, '', errors);
    return { errors, filled };
  }

  private _validateObj(obj: Record<string, any>, schema: ConfigSchema, prefix: string): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [key, field] of Object.entries(schema)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const val = obj[key];

      if (val === undefined) {
        if (field.required && field.default === undefined) {
          errors.push({ path, message: 'Required field missing' });
        }
        continue;
      }

      if (field.type === 'object' && field.children) {
        if (typeof val !== 'object') {
          errors.push({ path, message: `Expected object`, got: typeof val });
        } else {
          errors.push(...this._validateObj(val, field.children, path));
        }
        continue;
      }

      if (field.type === 'string' && typeof val !== 'string') {
        errors.push({ path, message: `Expected string`, got: typeof val });
        continue;
      }

      if (field.type === 'number' && typeof val !== 'number') {
        errors.push({ path, message: `Expected number`, got: typeof val });
        continue;
      }

      if (field.type === 'boolean' && typeof val !== 'boolean') {
        errors.push({ path, message: `Expected boolean`, got: typeof val });
        continue;
      }

      if (field.type === 'array' && !Array.isArray(val)) {
        errors.push({ path, message: `Expected array`, got: typeof val });
        continue;
      }

      if (field.enum && !field.enum.includes(val)) {
        errors.push({ path, message: `Value not in enum`, expected: field.enum.join(', '), got: val });
      }

      if (field.type === 'string' && field.pattern && !new RegExp(field.pattern).test(val)) {
        errors.push({ path, message: `Pattern mismatch`, expected: field.pattern });
      }

      if (field.type === 'number') {
        if (field.min !== undefined && val < field.min) {
          errors.push({ path, message: `Below minimum ${field.min}`, got: val });
        }
        if (field.max !== undefined && val > field.max) {
          errors.push({ path, message: `Above maximum ${field.max}`, got: val });
        }
      }
    }

    return errors;
  }

  private _fillDefaults(obj: Record<string, any>, schema: ConfigSchema, prefix: string, errors: ValidationError[]): Record<string, any> {
    const result: Record<string, any> = { ...obj };
    for (const [key, field] of Object.entries(schema)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (result[key] === undefined && field.default !== undefined) {
        result[key] = field.default;
      }
      if (field.type === 'object' && field.children) {
        result[key] = this._fillDefaults(result[key] || {}, field.children, path, errors);
      }
    }
    return result;
  }
}

export const strategyConfigSchema: ConfigSchema = {
  name: { type: 'string', required: true },
  maxPosition: { type: 'number', required: true, min: 0, max: 1 },
  stopLoss: { type: 'number', default: 0.05, min: 0, max: 1 },
  takeProfit: { type: 'number', default: 0.15, min: 0, max: 10 },
  enabled: { type: 'boolean', default: true },
};
