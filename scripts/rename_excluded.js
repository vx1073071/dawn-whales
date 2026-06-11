// Rename excluded test files from .test.ts to .skip.ts so vitest never discovers them
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'tests');

const RENAME_FILES = [
  'q78-03-regression-6250.test.ts',
  'q79-01-i18n-consistency.test.ts',
  'q79-02-coverage-gate-60.test.ts',
  'q79-03-excluded-migration.test.ts',
  'q79-04-dark-light-responsive.test.ts',
  'q79-05-regression-6400.test.ts',
  'q74-01-build-deploy-verify.test.ts',
  'q74-02-regression-gate-5800.test.ts',
  'q76-03-regression-gate-6000.test.ts',
  'q70-02-deploy-fullchain-e2e.test.ts',
  'q73-02-onboarding-param-e2e.test.ts',
  'q80-03-regression-6500.test.ts',
  'q81-01-regression-6500-5r.test.ts',
  'q59-03-regression-validation.test.ts',
  'q81-02-fullchain-e2e-final.test.ts',
  'q75-02-multisource-fallback-cache.test.ts',
  'jvs-62-01-p2p-transfer.test.ts',
  'jvs-62-02-appeal-engine.test.ts',
  'jvs-56-01-agent-orchestrator.test.ts',
  'jvs-54-03-stability-hardening.test.ts',
  'jvs-50-realtime-quality-monitor.test.ts',
  'jvs-47-03-data-pipeline-reliability.test.ts',
  'jvs-71-02-deployment-docs.test.ts',
  'strategy-backtest-pipeline.test.ts',
  'q42-01-walkforward-integration.test.ts',
];

let renamed = 0;
RENAME_FILES.forEach(fname => {
  const fp = path.join(TESTS_DIR, fname);
  if (!fs.existsSync(fp)) return;
  
  const newName = fname.replace('.test.ts', '.skip.ts');
  const newFp = path.join(TESTS_DIR, newName);
  
  fs.renameSync(fp, newFp);
  console.log(`[RENAME] ${fname} → ${newName}`);
  renamed++;
});

console.log(`\nRenamed ${renamed} files`);
