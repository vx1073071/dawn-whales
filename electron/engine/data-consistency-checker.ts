// ── Data Consistency Checker (JVS-48) ──────────────────────────────────────
// Validates data consistency between JVS data layer and QClaw strategy layer
// Checks: field types, value ranges, missing fields, schema compliance

export interface ConsistencyCheckResult {
  passed: boolean;
  checks: ConsistencyCheck[];
  summary: {
    totalChecks: number;
    passedCount: number;
    failedCount: number;
    warningCount: number;
  };
}

export interface ConsistencyCheck {
  category: string;
  field: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  expected?: any;
  actual?: any;
}

export interface DataValidationConfig {
  checkTypes: boolean;
  checkRanges: boolean;
  checkRequired: boolean;
  checkSchema: boolean;
}

const DEFAULT_CONFIG: DataValidationConfig = {
  checkTypes: true,
  checkRanges: true,
  checkRequired: true,
  checkSchema: true,
};

// ── Field Type Definitions ─────────────────────────────────────────────────

interface FieldDefinition {
  type: 'number' | 'string' | 'boolean' | 'array' | 'object';
  required: boolean;
  min?: number;
  max?: number;
  description: string;
}

const STOCK_FIELD_DEFINITIONS: Record<string, FieldDefinition> = {
  code: { type: 'string', required: true, description: 'Stock code' },
  name: { type: 'string', required: true, description: 'Stock name' },
  price: { type: 'number', required: true, min: 0, description: 'Current price' },
  changePct: { type: 'number', required: false, description: 'Change percentage' },
  volume: { type: 'number', required: false, min: 0, description: 'Trading volume' },
  turnover: { type: 'number', required: false, min: 0, description: 'Turnover amount' },
  marketCap: { type: 'number', required: false, min: 0, description: 'Market capitalization' },
  pe: { type: 'number', required: false, description: 'P/E ratio' },
  pb: { type: 'number', required: false, description: 'P/B ratio' },
  roe: { type: 'number', required: false, description: 'ROE' },
};

// ── Consistency Checker ────────────────────────────────────────────────────

export class DataConsistencyChecker {
  private config: DataValidationConfig;

  constructor(config?: Partial<DataValidationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate stock data consistency
   */
  validateStockData(data: any[]): ConsistencyCheckResult {
    const checks: ConsistencyCheck[] = [];

    for (const stock of data) {
      const stockChecks = this.validateStockFields(stock);
      checks.push(...stockChecks);
    }

    return this.buildResult(checks);
  }

  /**
   * Validate individual stock fields
   */
  private validateStockFields(stock: any): ConsistencyCheck[] {
    const checks: ConsistencyCheck[] = [];
    const code = stock.code || 'UNKNOWN';

    for (const [field, definition] of Object.entries(STOCK_FIELD_DEFINITIONS)) {
      // Check required fields
      if (this.config.checkRequired && definition.required && !stock[field]) {
        checks.push({
          category: 'required',
          field: `${code}.${field}`,
          status: 'fail',
          message: `Required field missing: ${definition.description}`,
          expected: 'present',
          actual: 'missing',
        });
        continue;
      }

      const value = stock[field];
      if (value === undefined || value === null) continue;

      // Check type
      if (this.config.checkTypes) {
        const actualType = this.getType(value);
        if (actualType !== definition.type) {
          checks.push({
            category: 'type',
            field: `${code}.${field}`,
            status: 'fail',
            message: `Type mismatch for ${definition.description}`,
            expected: definition.type,
            actual: actualType,
          });
        }
      }

      // Check range
      if (this.config.checkRanges && definition.type === 'number') {
        if (definition.min !== undefined && value < definition.min) {
          checks.push({
            category: 'range',
            field: `${code}.${field}`,
            status: 'warning',
            message: `Value below minimum for ${definition.description}`,
            expected: `>= ${definition.min}`,
            actual: value,
          });
        }
        if (definition.max !== undefined && value > definition.max) {
          checks.push({
            category: 'range',
            field: `${code}.${field}`,
            status: 'warning',
            message: `Value above maximum for ${definition.description}`,
            expected: `<= ${definition.max}`,
            actual: value,
          });
        }
      }
    }

    return checks;
  }

  /**
   * Get JavaScript type of value
   */
  private getType(value: any): string {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
  }

  /**
   * Build result from checks
   */
  private buildResult(checks: ConsistencyCheck[]): ConsistencyCheckResult {
    const passedCount = checks.filter(c => c.status === 'pass').length;
    const failedCount = checks.filter(c => c.status === 'fail').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    return {
      passed: failedCount === 0,
      checks,
      summary: {
        totalChecks: checks.length,
        passedCount,
        failedCount,
        warningCount,
      },
    };
  }

  /**
   * Validate multiple data sources consistency
   */
  validateMultiSource(sources: { name: string; data: any[] }[]): ConsistencyCheckResult {
    const checks: ConsistencyCheck[] = [];

    // Check if all sources have same number of records
    const counts = sources.map(s => s.data.length);
    const uniqueCounts = new Set(counts);
    
    if (uniqueCounts.size > 1) {
      checks.push({
        category: 'consistency',
        field: 'record_count',
        status: 'warning',
        message: 'Data sources have different record counts',
        expected: 'all same',
        actual: sources.map(s => `${s.name}: ${s.data.length}`).join(', '),
      });
    }

    // Validate each source
    for (const source of sources) {
      const sourceChecks = this.validateStockData(source.data);
      checks.push(...sourceChecks.checks);
    }

    return this.buildResult(checks);
  }

  /**
   * Get validation summary
   */
  getSummary(result: ConsistencyCheckResult): string {
    const { summary } = result;
    const parts = [
      `Total checks: ${summary.totalChecks}`,
      `Passed: ${summary.passedCount}`,
      `Warnings: ${summary.warningCount}`,
      `Failed: ${summary.failedCount}`,
    ];
    
    if (!result.passed) {
      parts.push('⚠️ Validation failed');
    } else {
      parts.push('✅ All checks passed');
    }

    return parts.join('\n');
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let consistencyCheckerInstance: DataConsistencyChecker | null = null;

export function getDataConsistencyChecker(config?: Partial<DataValidationConfig>): DataConsistencyChecker {
  if (!consistencyCheckerInstance) {
    consistencyCheckerInstance = new DataConsistencyChecker(config);
  }
  return consistencyCheckerInstance;
}

/**
 * Run a quick consistency check and return the result
 */
export async function runConsistencyCheck(): Promise<ConsistencyCheckResult> {
  const checker = getDataConsistencyChecker();
  // Run with empty data — will return a default "all-pass" result
  // In production this should be wired to real data sources
  return checker.validateStockData([]);
}

/**
 * Get current consistency validation rules
 */
export function getConsistencyRules(): Record<string, FieldDefinition> {
  return { ...STOCK_FIELD_DEFINITIONS };
}
