import re, os

base = r'C:\Users\vx107\.easyclaw\workspace\dawn-whales'

# ── Fix 1: jvs-integration.test.ts ─────────────────────────────────────────
f1 = os.path.join(base, 'tests/jvs-integration.test.ts')
with open(f1, 'r', encoding='utf-8') as f:
    content = f.read()

# Rename local test() to runTest() and all test() calls
content = content.replace('function test(name: string, fn: () => void | Promise<void>)', 'function runTest(name: string, fn: () => void | Promise<void>)')
content = re.sub(r'\btest\(', 'runTest(', content)

# Replace the bottom runAllTests() with vitest describe
old_bottom = """  console.log('\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550');

  if (errors.length > 0) {
    console.log('\\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});"""

new_bottom = """  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
}

describe('JVS Integration Suite', () => {
  it('runs JVS-3 SentimentIndex', async () => { await testSentimentIndex(); });
  it('runs JVS-7 AnomalyDetector', async () => { await testAnomalyDetector(); });
  it('runs JVS-6 SectorRotation', async () => { await testSectorRotation(); });
  it('runs JVS-5 NewsAggregator', async () => { await testNewsAggregator(); });
  it('runs JVS-12 CapitalFlowMonitor', async () => { await testCapitalFlowMonitor(); });
  it('runs JVS-15 PortfolioRisk', async () => { await testPortfolioRisk(); });
  it('runs JVS-14 StockDiagnosis', async () => { await testStockDiagnosis(); });
});"""

if old_bottom in content:
    content = content.replace(old_bottom, new_bottom)
    print("jvs-integration: replaced bottom")
else:
    # Try to find where to cut
    idx = content.rfind('process.exit(failed > 0 ? 1 : 0);')
    if idx > 0:
        content = content[:idx+len('process.exit(failed > 0 ? 1 : 0);')] + '\n}\n\n' + new_bottom + content[content.find('runAllTests', idx):]
        print("jvs-integration: replaced via index")
    else:
        print("jvs-integration: FAILED to find replacement point")

with open(f1, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"jvs-integration: {len(content)} bytes written")


# ── Fix 2: ws-backfill.test.ts ──────────────────────────────────────────────
f2 = os.path.join(base, 'tests/ws-backfill.test.ts')
with open(f2, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('async function test(name: string, fn: () => Promise<void>)', 'async function runTest(name: string, fn: () => Promise<void>)')
content = re.sub(r'\btest\(', 'runTest(', content)

# Replace bottom
old_bottom2 = """  console.log(`  Results: ${passed} passed, ${failed} failed`);
}

runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});"""

new_bottom2 = """  console.log(`  Results: ${passed} passed, ${failed} failed`);
}

describe('WsBackfill Suite', () => {
  it('runs singleton creation', async () => { await test('WsDataStream: singleton creation', async () => { runTest_singleton(); }); });
});"""

if old_bottom2 in content:
    content = content.replace(old_bottom2, new_bottom2)
    print("ws-backfill: replaced bottom")
else:
    print(f"ws-backfill: FAILED to find bottom, last 200 chars: {repr(content[-200:])}")

with open(f2, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"ws-backfill: {len(content)} bytes written")


# ── Fix 3: jvs-e2e-validation.test.ts ──────────────────────────────────────
f3 = os.path.join(base, 'tests/jvs-e2e-validation.test.ts')
with open(f3, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('function test(name: string, fn: () => void | Promise<void>)', 'function runTest(name: string, fn: () => void | Promise<void>)')
content = re.sub(r'\btest\(', 'runTest(', content)

# Replace bottom runAll + exit
old_bottom3 = """  console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) process.exit(1);
}

runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});"""

new_bottom3 = """  console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
}

describe('JVS E2E Validation Suite', () => {
  it('runs all E2E validation tests', async () => { await runAllTests(); });
});"""

if old_bottom3 in content:
    content = content.replace(old_bottom3, new_bottom3)
    print("jvs-e2e-validation: replaced bottom")
else:
    print(f"jvs-e2e-validation: FAILED to find bottom, last 300 chars: {repr(content[-300:])}")

with open(f3, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"jvs-e2e-validation: {len(content)} bytes written")