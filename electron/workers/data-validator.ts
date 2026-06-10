// T101: Schema + Business Rule Data Validator
export interface ValidationRule {
  field: string;
  rule: 'required' | 'type' | 'range' | 'pattern' | 'custom' | 'unique' | 'foreign_key';
  params?: unknown;
  message: string;
}

export interface ValidationError {
  field: string;
  rule: string;
  message: string;
  row?: number;
  value?: unknown;
}

export interface ValidationReport {
  valid: boolean;
  totalRows: number;
  errorCount: number;
  errors: ValidationError[];
  warnings: string[];
  stats: {
    nullCount: Record<string, number>;
    uniqueCount: Record<string, number>;
    typeDistribution: Record<string, Record<string, number>>;
  };
}

export class DataValidator {
  private rules: ValidationRule[] = [];
  private validators = new Map<string, (value: unknown, params: unknown) => boolean>();

  constructor() {
    this.validators.set('required', (v) => v != null && v !== '');
    this.validators.set('type', (v, t) => typeof v === t);
    this.validators.set('range', (v, [min, max]) => v >= min && v <= max);
    this.validators.set('pattern', (v, regex) => new RegExp(regex).test(String(v)));
    this.validators.set('unique', () => true); // requires external tracking
    this.validators.set('foreign_key', () => true);
  }

  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  addCustomValidator(name: string, fn: (value: unknown, params: unknown) => boolean): void {
    this.validators.set(name, fn);
  }

  validate(rows: Record<string, any>[]): ValidationReport {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const stats = {
      nullCount: {} as Record<string, number>,
      uniqueCount: {} as Record<string, number>,
      typeDistribution: {} as Record<string, Record<string, number>>,
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      for (const rule of this.rules) {
        const value = row[rule.field];
        const validator = this.validators.get(rule.rule === 'custom' ? rule.params?.name : rule.rule);

        if (!validator) continue;

        if (rule.rule === 'required') {
          if (!validator(value, null)) {
            errors.push({ field: rule.field, rule: rule.rule, message: rule.message, row: i, value });
          }
          if (value == null || value === '') {
            stats.nullCount[rule.field] = (stats.nullCount[rule.field] || 0) + 1;
          }
        } else if (value != null) {
          if (!validator(value, rule.params)) {
            errors.push({ field: rule.field, rule: rule.rule, message: rule.message, row: i, value });
          }
          // Track type distribution
          const type = typeof value;
          if (!stats.typeDistribution[rule.field]) stats.typeDistribution[rule.field] = {};
          stats.typeDistribution[rule.field][type] = (stats.typeDistribution[rule.field][type] || 0) + 1;
        }

        // Track unique
        if (rule.rule === 'unique' && value != null) {
          stats.uniqueCount[rule.field] = (stats.uniqueCount[rule.field] || 0) + 1;
        }
      }
    }

    // Check for type inconsistencies
    for (const [field, dist] of Object.entries(stats.typeDistribution)) {
      const types = Object.keys(dist);
      if (types.length > 1) {
        warnings.push(`Field "${field}" has mixed types: ${types.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      totalRows: rows.length,
      errorCount: errors.length,
      errors: errors.slice(0, 100), // cap at 100
      warnings,
      stats,
    };
  }

  quickCheck(row: Record<string, any>): ValidationError[] {
    return this.validate([row]).errors;
  }
}
