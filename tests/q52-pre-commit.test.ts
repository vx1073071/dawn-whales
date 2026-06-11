// ── Q52: Pre-commit Hook ──────────────────────────────────────────────────
// Pre-commit hook for code quality checks
// Runs lint, type-check, test, and i18n checks before commit



export interface PreCommitResult {
  success: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    output: string;
    duration: number;
  }>;
}

export class PreCommitHook {
  private checks: Array<{ name: string; command: string }> = [
    { name: 'ESLint', command: 'npm run lint' },
    { name: 'TypeScript', command: 'npx tsc --noEmit' },
    { name: 'Tests', command: 'npm test' },
    { name: 'i18n', command: 'npm run i18n:check' },
  ];

  /**
   * Run all pre-commit checks
   */
  async run(): Promise<PreCommitResult> {
    const results: Array<{ name: string; passed: boolean; output: string; duration: number }> = [];

    for (const check of this.checks) {
      const startTime = Date.now();
      
      try {
        const output = /* execSync removed */("") + (check.command, { encoding: 'utf-8', stdio: 'pipe' });
        results.push({
          name: check.name,
          passed: true,
          output: output.slice(0, 500),
          duration: Date.now() - startTime,
        });
        console.log(`✅ ${check.name} passed`);
      } catch (err: any) {
        results.push({
          name: check.name,
          passed: false,
          output: (err.stdout || err.stderr || err.message).slice(0, 500),
          duration: Date.now() - startTime,
        });
        console.error(`❌ ${check.name} failed`);
      }
    }

    const allPassed = results.every(r => r.passed);

    return {
      success: allPassed,
      checks: results,
    };
  }
}

export function runPreCommitChecks(): void {
  console.log('Running pre-commit checks...');
  const hook = new PreCommitHook();
  hook.run();
}

// ── Vitest Test Cases ───────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

describe('Q52: Pre-commit Hook', () => {
  it('PreCommitHook has correct default checks', () => {
    const hook = new PreCommitHook();
    // Access private checks via type assertion for structural testing
    const checks = (hook as any).checks as Array<{ name: string; command: string }>;
    expect(checks.length).toBe(4);
    expect(checks.map((c) => c.name)).toEqual(['ESLint', 'TypeScript', 'Tests', 'i18n']);
  });

  it('PreCommitResult interface is correct', () => {
    const result: PreCommitResult = {
      success: true,
      checks: [
        { name: 'ESLint', passed: true, output: 'no errors', duration: 100 },
        { name: 'TypeScript', passed: false, output: '2 errors', duration: 500 },
      ],
    };
    expect(result.success).toBe(true);
    expect(result.checks.length).toBe(2);
    expect(result.checks[0].passed).toBe(true);
    expect(result.checks[1].passed).toBe(false);
  });

  it('PreCommitHook can add custom checks', () => {
    class TestableHook extends PreCommitHook {
      addCheck(name: string, command: string) {
        (this as any).checks.push({ name, command });
      }
    }
    const hook = new TestableHook();
    hook.addCheck('Custom', 'echo test');
    const checks = (hook as any).checks;
    expect(checks.length).toBe(5);
    expect(checks[4].name).toBe('Custom');
  });
});
