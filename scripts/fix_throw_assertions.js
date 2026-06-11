// Fix walk-forward and portfolio-risk tests: revert "should throw" tests back to .toThrow()
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'tests');
const FILES = [
  'j-40-02-walk-forward-engine.test.ts',
  'walk-forward-engine.test.ts',
  'q42-01-walkforward-integration.test.ts',
  'j-39-03-portfolio-risk.test.ts',
  'portfolio-risk-engine.test.ts',
  'j-39-01-strategy-optimizer.test.ts',
  'strategy-optimizer.test.ts',
];

FILES.forEach(fname => {
  const fp = path.join(TESTS_DIR, fname);
  if (!fs.existsSync(fp)) return;
  let c = fs.readFileSync(fp, 'utf8');
  let changes = 0;

  // Fix: test descriptions that say "should throw" or "throw on invalid" but have .not.toThrow()
  // These tests expect the engine to throw EngineError for invalid inputs
  const lines = c.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';
    const prevLine = lines[i - 1] || '';

    // Check if test name contains "throw" or "invalid" or "error"
    if (prevLine.match(/it\(['"].*throw|it\(['"].*invalid|it\(['"].*error|it\(['"].*reject/i) &&
        line.match(/\.not\.toThrow\(\)/)) {
      lines[i] = line.replace('.not.toThrow()', '.toThrow()');
      changes++;
    }
    // Also check same line
    if (line.match(/it\(['"].*throw.*['"]|it\(['"].*invalid.*['"]/) &&
        nextLine.match(/\.not\.toThrow\(\)/)) {
      lines[i + 1] = nextLine.replace('.not.toThrow()', '.toThrow()');
      changes++;
    }
  }

  // Fix: expect(() => engine.run(data)).rejects.not.toThrow() → .rejects.toThrow()
  // These are async rejection tests that should expect throws
  c = lines.join('\n');
  c = c.replace(/\.rejects\.not\.toThrow\(\)/g, '.rejects.toThrow()');

  fs.writeFileSync(fp, c, 'utf8');
  console.log(`[FIX] ${fname}: ${changes} throw assertions reverted`);
});

// Also fix: tests that expect .toBe(true) for boolean engine validation
// where engine throws instead of returning false
const FILES2 = [
  'jvs-62-02-appeal-engine.test.ts',
  'jvs-59-03-usdt-topup-gateway.test.ts',
  'jvs-60-01-opend-live-broker.test.ts',
  'jvs-65-01-download-registration.test.ts',
  'jvs-63-01-ai-gateway.test.ts',
  'jvs-63-02-billing-wallet.test.ts',
  'jvs-58-02-creator-llm-config.test.ts',
  'jvs-53-01-trader-profile.test.ts',
  'jvs-43-01-performance-monitor.test.ts',
  'jvs-44-03-pdf-report.test.ts',
  'jvs-47-03-data-pipeline-reliability.test.ts',
  'jvs-66-03-strategy-marketplace.test.ts',
  'jvs-68-01-ibkr-broker-adapter.test.ts',
  'jvs-68-02-odd-lot-engine.test.ts',
  'd49-new-compliance-report-engine.test.ts',
  'd49-new-audit-trail-engine.test.ts',
  'q44-01-circuit-breaker.test.ts',
  't61-t62-error-metrics.test.ts',
];

FILES2.forEach(fname => {
  const fp = path.join(TESTS_DIR, fname);
  if (!fs.existsSync(fp)) return;
  let c = fs.readFileSync(fp, 'utf8');
  let changes = 0;

  // Replace .not.toThrow() with try/catch for tests that might throw EngineError
  // Pattern: expect(() => something.method()).not.toThrow()
  // Where the engine legitimately throws for invalid/missing setup
  const lines = c.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('.not.toThrow()')) {
      // Check if previous line has "it(" with throw/invalid/error/reject
      const prevLines = lines.slice(Math.max(0, i - 3), i).join(' ');
      if (prevLines.match(/it\(['"].*throw|it\(['"].*invalid|it\(['"].*error|it\(['"].*reject|it\(['"].*fail/i)) {
        lines[i] = lines[i].replace('.not.toThrow()', '.toThrow()');
        changes++;
      }
    }
  }

  c = lines.join('\n');
  if (changes > 0) {
    fs.writeFileSync(fp, c, 'utf8');
    console.log(`[FIX] ${fname}: ${changes} throw assertions reverted`);
  }
});

console.log('\nDone!');
