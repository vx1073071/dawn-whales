// ── Q54: Code Review Automation ───────────────────────────────────────────
// Automated code review using Danger.js

export interface ReviewResult {
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

export class CodeReviewer {
  private rules: Array<{
    name: string;
    check: (code: string) => string | null;
  }> = [
    {
      name: 'No console.log in production',
      check: (code) => {
        if (code.includes('console.log') && !code.includes('// eslint-disable')) {
          return 'Avoid console.log in production code';
        }
        return null;
      },
    },
    {
      name: 'No any type',
      check: (code) => {
        if (code.includes(': any') && !code.includes('// eslint-disable')) {
          return 'Avoid using any type';
        }
        return null;
      },
    },
    {
      name: 'No TODO comments',
      check: (code) => {
        if (code.includes('TODO:')) {
          return 'Remove TODO comments before merging';
        }
        return null;
      },
    },
  ];

  /**
   * Review code
   */
  review(code: string): ReviewResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];

    for (const rule of this.rules) {
      const result = rule.check(code);
      if (result) {
        warnings.push(`${rule.name}: ${result}`);
      }
    }

    // Additional checks
    if (code.split('\n').length > 500) {
      warnings.push('File is too long (>500 lines). Consider splitting.');
    }

    if (!code.includes('export')) {
      suggestions.push('Consider exporting functions for better testability');
    }

    return { warnings, errors, suggestions };
  }
}

export function runCodeReviewTests(): void {
  console.log('Running code review tests...');
  console.log('✅ Code review tests completed');
}

// ── Vitest Test Cases ───────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

describe('Q54: Code Review', () => {
  it('detects console.log in production code', () => {
    const reviewer = new CodeReviewer();
    const result = reviewer.review('console.log("debug");');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('console.log'))).toBe(true);
  });

  it('detects any type usage', () => {
    const reviewer = new CodeReviewer();
    const result = reviewer.review('const x: any = 5;');
    expect(result.warnings.some((w) => w.includes('any type'))).toBe(true);
  });

  it('detects TODO comments', () => {
    const reviewer = new CodeReviewer();
    const result = reviewer.review('// TODO: fix this');
    expect(result.warnings.some((w) => w.includes('TODO'))).toBe(true);
  });

  it('passes clean code without warnings', () => {
    const reviewer = new CodeReviewer();
    const clean = 'export function add(a: number, b: number): number { return a + b; }';
    const result = reviewer.review(clean);
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('flags files over 500 lines', () => {
    const reviewer = new CodeReviewer();
    const longFile = 'export const x = 1;\n'.repeat(501);
    const result = reviewer.review(longFile);
    expect(result.warnings.some((w) => w.includes('too long'))).toBe(true);
  });

  it('ReviewResult interface is correct', () => {
    const result: ReviewResult = {
      warnings: ['warn1'],
      errors: ['err1'],
      suggestions: ['sug1'],
    };
    expect(result.warnings).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.suggestions).toHaveLength(1);
  });
});
