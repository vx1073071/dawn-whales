const fs = require('fs');
const path = require('path');

// Module mapping: flat name → new subdir path (from find-modules.js output)
const moduleMap = {
  'creator-llm-config': 'portfolio/creator-llm-config',
  'ai-cost-monitor': 'agents/ai-cost-monitor',
  'data-versioning-enhanced': 'data/data-versioning-enhanced',
  'realtime-quality-monitor': 'data/realtime-quality-monitor',
  'realtime-aggregator': 'data/realtime-aggregator',
  'sentiment-index': 'analysis/sentiment-index',
  'stock-anomaly-detector': 'data/stock-anomaly-detector',
  'news-aggregator': 'data/news-aggregator',
  'sector-rotation': 'data/sector-rotation',
  'market-hotspot': 'data/market-hotspot',
  'capital-flow-monitor': 'analysis/capital-flow-monitor',
  'portfolio-risk': 'portfolio/portfolio-risk',
  'stock-diagnosis': 'data/stock-diagnosis',
  'market-breadth': 'data/market-breadth',
  'consumer-data': 'data/consumer-data',
  'margin-data': 'data/margin-data',
  'unlock-calendar': 'data/unlock-calendar',
  'dividend-calendar': 'data/dividend-calendar',
  'earnings-calendar': 'data/earnings-calendar',
  'data-quality-monitor': 'data/data-quality-monitor',
  'emi-unified': 'core/emi-unified',
  'backtest-engine': 'backtest/backtest-engine',
  'nl-parser': 'agents/nl-parser',
  'data-cleaning-pipeline': 'data/data-cleaning-pipeline',
  'data-warehouse': 'data/data-warehouse',
  'multi-source-aggregator': 'data/multi-source-aggregator',
  'genetic-algorithm': 'agents/genetic-algorithm',
  'monte-carlo-simulator': 'backtest/monte-carlo-simulator',
  'volatility-models': 'risk/volatility-models',
  'technical-indicators': 'analysis/technical-indicators',
  'calendar-effects': 'data/calendar-effects',
  'dynamic-sizer': 'portfolio/dynamic-sizer',
  'smart-picker': 'agents/smart-picker',
};

// All R89-excluded test files to fix
const testFiles = [
  'tests/q56-01-four-agent-collaboration.test.ts',
  'tests/q56-03-e2e-4agent-flow.test.ts',
  'tests/q58-02-creator-cost-e2e.test.ts',
  'tests/q58-03-regression-validation.test.ts',
  'tests/q59-02-commission-topup-e2e.test.ts',
  'tests/q69-02-guest-perf-e2e.test.ts',
  'tests/q70-02-deploy-fullchain-e2e.test.ts',
  'tests/q72-02-factor-compare-portfolio.test.ts',
  'tests/q73-01-realdata-draw-pattern.test.ts',
  'tests/q73-02-onboarding-param-e2e.test.ts',
  'tests/q74-01-build-deploy-verify.test.ts',
  'tests/q74-02-regression-gate-5800.test.ts',
  'tests/q75-01-real-vs-mock-compare.test.ts',
  'tests/q75-02-multisource-fallback-cache.test.ts',
  'tests/q76-01-usemock-crash-recovery.test.ts',
  'tests/q76-02-content-safety-gdpr.test.ts',
  'tests/q77-02-etimedout-fix.test.ts',
  'tests/q78-01-three-engine-tests.test.ts',
  'tests/q78-03-regression-6250.test.ts',
  'tests/q79-02-coverage-gate-60.test.ts',
  'tests/q50-03-coverage-boost.test.ts',
  'tests/t53-crypto-service.test.ts',
  'tests/t61-t62-error-metrics.test.ts',
  'tests/jvs-49-data-versioning.test.ts',
  'tests/jvs-50-realtime-quality-monitor.test.ts',
  'tests/jvs-83-data-aggregator.test.ts',
  'tests/jvs-83-benchmark.test.ts',
  'tests/jvs-100-e2e-validation.test.ts',
  'tests/jvs-115-aggregator.test.ts',
  'tests/jvs-integration.test.ts',
  'tests/ws-backfill.test.ts',
  'tests/integration-full-pipeline.test.ts',
  'tests/benchmark-engines.test.ts',
  'tests/q47-property-testing.test.ts',
];

let totalFixed = 0;
let filesFixed = 0;
let filesSkipped = 0;
let notFound = [];

testFiles.forEach(function(tf) {
  if (!fs.existsSync(tf)) {
    console.log('SKIP (missing):', tf);
    filesSkipped++;
    return;
  }
  let content = fs.readFileSync(tf, 'utf8');
  let original = content;
  let fixCount = 0;

  // Fix imports: from '../electron/engine/xxx' → from '../electron/engine/subdir/xxx'
  Object.keys(moduleMap).forEach(function(mod) {
    // Match various import patterns
    const patterns = [
      // from '../electron/engine/mod'
      new RegExp("from\\s+['\"]\\.\\.\\/electron\\/engine\\/" + mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]", 'g'),
      // from '../../electron/engine/mod'
      new RegExp("from\\s+['\"]\\.\\.\\/\\.\\.\\/electron\\/engine\\/" + mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]", 'g'),
      // import('electron/engine/mod')
      new RegExp("import\\(['\"]\\.\\.\\/electron\\/engine\\/" + mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]\\)", 'g'),
    ];
    const newPath = moduleMap[mod];
    patterns.forEach(function(pat) {
      const matches = content.match(pat);
      if (matches) {
        content = content.replace(pat, function(m) {
          return m.replace('electron/engine/' + mod, 'electron/engine/' + newPath);
        });
        fixCount += matches.length;
      }
    });
  });

  // Fix readdirSync('electron/engine') flat path checks
  // Replace readdirSync with recursive glob or update expected counts
  // This is more complex - for now just fix the import paths

  if (content !== original) {
    fs.writeFileSync(tf, content, 'utf8');
    totalFixed += fixCount;
    filesFixed++;
    console.log('FIXED', fixCount, 'imports in', tf);
  } else {
    console.log('NO CHANGES:', tf);
  }
});

console.log('\n=== SUMMARY ===');
console.log('Files processed:', testFiles.length);
console.log('Files fixed:', filesFixed);
console.log('Files skipped (missing):', filesSkipped);
console.log('Total import fixes:', totalFixed);
console.log('Files with no changes:', testFiles.length - filesFixed - filesSkipped);
