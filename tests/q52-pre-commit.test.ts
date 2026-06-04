// ── Q52: Pre-commit Hook ──────────────────────────────────────────────────
// Pre-commit hook for code quality checks
// Runs lint, type-check, test, and i18n checks before commit

import { execSync } from 'child_process';

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
        const output = execSync(check.command, { encoding: 'utf-8', stdio: 'pipe' });
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
