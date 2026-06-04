#!/usr/bin/env node
/**
 * QTest CLI - command line interface
 * Q44: 测试框架自建
 *
 * Usage:
 *   qtest run [files...] [options]
 *   qtest watch [files...]
 *   qtest init
 *
 * Options:
 *   --concurrency <n>   max parallel workers (default: 4)
 *   --isolate            run each file in isolated worker (default: true)
 *   --no-isolate         run in-process (faster, less isolation)
 *   --timeout <ms>      per-test timeout (default: 5000)
 *   --bail <n>          stop after N failures (0 = don't bail)
 *   --reporter <type>   text|json|html|junit (default: text)
 *   --coverage           enable coverage (placeholder)
 *   --update-snapshots   update snapshot files
 *   --verbose            verbose output
 *   --silent             suppress output
 */

import { parseArgs } from 'node:util';
import { resolve, join, dirname } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { run } from './runner.js';
import { generateHtmlReport } from './runner.js';
import type { RunnerConfig, RunResult } from './types.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    concurrency: { type: 'string', short: 'c' },
    isolate: { type: 'boolean', default: true },
    'no-isolate': { type: 'boolean', default: false },
    timeout: { type: 'string', short: 't' },
    bail: { type: 'string', short: 'b' },
    reporter: { type: 'string', short: 'r', default: 'text' },
    coverage: { type: 'boolean', default: false },
    'update-snapshots': { type: 'boolean', default: false },
    verbose: { type: 'boolean', short: 'v', default: false },
    silent: { type: 'boolean', short: 's', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
});

async function main() {
  const command = positionals[0] || 'run';
  const files = positionals.slice(1);

  if (values.help) {
    printHelp();
    return;
  }

  if (command === 'init') {
    await initProject();
    return;
  }

  if (command !== 'run') {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error('No test files specified. Usage: qtest run <files...> [options]');
    console.error('Glob patterns supported: e.g. "**/*.test.ts"');
    process.exit(1);
  }

  const config: RunnerConfig = {
    concurrency: parseInt(values.concurrency as string || '4', 10),
    isolate: !values['no-isolate'],
    workerType: 'thread',
    timeout: parseInt(values.timeout as string || '5000', 10),
    retry: 0,
    bail: parseInt(values.bail as string || '0', 10),
    updateSnapshots: !!values['update-snapshots'],
    verbose: !!values.verbose,
    silent: !!values.silent,
    coverage: !!values.coverage,
  };

  const result: RunResult = await run(files, config);

  // Generate additional reports
  if (values.reporter === 'html' || values.reporter === 'all') {
    const htmlPath = await generateHtmlReport(result);
    console.log(`\nHTML report generated: ${htmlPath}`);
  }

  if (values.reporter === 'json' || values.reporter === 'all') {
    const jsonPath = resolve('test-framework/qtest-report.json');
    await writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`JSON report generated: ${jsonPath}`);
  }

  // Exit code
  process.exit(result.failed > 0 ? 1 : 0);
}

async function initProject(): Promise<void> {
  const pkg = {
    name: 'qtest-project',
    version: '0.1.0',
    scripts: {
      test: 'qtest run **/*.test.ts',
      'test:watch': 'qtest watch **/*.test.ts',
    },
    devDependencies: {
      typescript: '^5.0.0',
      tsx: '^4.0.0',
    },
  };

  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      esModuleInterop: true,
      strict: true,
      outDir: 'dist',
      sourceMap: true,
    },
    include: ['**/*.ts'],
    exclude: ['node_modules', 'dist'],
  };

  const qtestConfig = {
    include: ['**/*.test.ts'],
    exclude: ['node_modules'],
    runner: {
      concurrency: 4,
      isolate: true,
      timeout: 5000,
      bail: 0,
    },
  };

  await writeFile(resolve('package.json'), JSON.stringify(pkg, null, 2), 'utf-8');
  await writeFile(resolve('tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf-8');
  await writeFile(
    resolve('qtest.config.json'),
    JSON.stringify(qtestConfig, null, 2),
    'utf-8'
  );

  // Sample test
  const sampleDir = resolve('tests');
  await mkdir(sampleDir, { recursive: true });
  const sampleTest = `import { describe, it, expect } from '../test-framework/core.js';
import { qmock, qmockSpyOn } from '../test-framework/mock.js';

describe('QTest Sample', () => {
  it('basic matchers work', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toBeType('string');
    expect([1, 2, 3]).toContain(2);
    expect({ a: 1 }).toEqual({ a: 1 });
  });

  it('async support', async () => {
    const promise = Promise.resolve(42);
    await expect(promise).resolves.toBe(42);
  });

  it('mock functions', () => {
    const fn = qmock((a: number, b: number) => a + b);
    fn(1, 2);
    expect(fn).toHaveBeenCalledWith([1, 2]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('spy on objects', () => {
    const obj = { method: (x: number) => x * 2 };
    const spy = qmockSpyOn(obj, 'method');
    obj.method(5);
    expect(spy).toHaveBeenCalledWith([5]);
  });
});
`;
  await writeFile(join(sampleDir, 'sample.test.ts'), sampleTest, 'utf-8');

  console.log('✅ QTest project initialized!');
  console.log('   - package.json');
  console.log('   - tsconfig.json');
  console.log('   - qtest.config.json');
  console.log('   - tests/sample.test.ts');
  console.log('\nRun: npx tsx qtest.cli.ts run tests/**/*.test.ts');
}

function printHelp(): void {
  console.log(`
QTest - Lightweight standalone test framework (no Vitest/Jest)

Usage:
  qtest run [files...] [options]
  qtest watch [files...]
  qtest init

Options:
  -c, --concurrency <n>    Max parallel workers (default: 4)
  --isolate                 Run in isolated workers (default: true)
  --no-isolate              Run in-process
  -t, --timeout <ms>       Per-test timeout (default: 5000)
  -b, --bail <n>           Stop after N failures (0 = off)
  -r, --reporter <type>     text|json|html|junit (default: text)
  --coverage                Enable coverage
  --update-snapshots        Update snapshot files
  -v, --verbose             Verbose output
  -s, --silent              Suppress output
  -h, --help                Show help

Examples:
  qtest run tests/**/*.test.ts
  qtest run tests/**/*.test.ts -c 8 --reporter html
  qtest init
`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
