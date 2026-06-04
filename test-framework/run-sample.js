/**
 * QTest - Sample tests (plain JS, no TS needed)
 * Run: node --input-type=module --eval "import('./test-framework/qtest.js').then(m => m.default.runFiles(['test-framework/sample.test.js'])).then(r => m.default.printReport(r))"
 * Or:  node --import tsx --eval "..." for .ts tests
 */

// Use dynamic import to load qtest.js (ESM)
async function main() {
  const qtest = await import('./qtest.js');

  const { describe, it, expect, qmock, qmockSpyOn } = qtest;

  // Re-register globals so the test file can use describe/it/expect
  globalThis.describe = describe;
  globalThis.it = it;
  globalThis.expect = expect;
  globalThis.qmock = qmock;
  globalThis.qmockSpyOn = qmockSpyOn;

  // Now run the test file
  const result = await qtest.runFiles(['test-framework/sample.test.js']);
  qtest.printReport(result);

  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
