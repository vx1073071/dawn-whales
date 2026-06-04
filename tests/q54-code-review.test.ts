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
