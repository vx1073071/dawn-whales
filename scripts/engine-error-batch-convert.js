/**
 * R89 J-01: Batch convert `throw new Error(...)` to `throw new EngineError(...)`
 * Maps each file to appropriate ErrorDomain/ErrorCode for structured error handling.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');

// Domain mapping per file
const FILE_CONFIG = {
  'electron/broker/BrokerManager.ts':         { domain: 'TRADE',    code: 'CONNECTION_FAILED',  importPath: '../engine/core/engine-error' },
  'electron/broker/ib-adapter.ts':            { domain: 'NETWORK',  code: 'CONNECTION_FAILED',  importPath: '../engine/core/engine-error' },
  'electron/broker/opend-base-adapter.ts':     { domain: 'NETWORK',  code: 'CONNECTION_FAILED',  importPath: '../engine/core/engine-error' },
  'electron/broker/unified-account-manager.ts':{ domain: 'TRADE',   code: 'ORDER_REJECTED',     importPath: '../engine/core/engine-error' },
  'electron/data/data-versioning.ts':          { domain: 'DATA',     code: 'DATA_UNAVAILABLE',   importPath: '../engine/core/engine-error' },
  'electron/engine/analysis/order-state-machine.ts': { domain: 'TRADE', code: 'INVALID_PARAM',   importPath: '../core/engine-error' },
  'electron/engine/data/opend-live-broker.ts': { domain: 'TRADE',   code: 'ORDER_REJECTED',     importPath: '../core/engine-error' },
  'electron/engine/portfolio/appeal-engine.ts':{ domain: 'TRADE',   code: 'ORDER_REJECTED',     importPath: '../core/engine-error' },
  'electron/main.ts':                         { domain: 'SYSTEM',    code: 'INTERNAL_ERROR',     importPath: './engine/core/engine-error' },
  'electron/workers/batch-scheduler.ts':       { domain: 'SYSTEM',   code: 'INTERNAL_ERROR',     importPath: '../engine/core/engine-error' },
  'electron/workers/bench-worker.ts':          { domain: 'SYSTEM',   code: 'INTERNAL_ERROR',     importPath: '../engine/core/engine-error' },
  'electron/workers/crypto-service.ts':        { domain: 'AUTH',     code: 'UNAUTHORIZED',       importPath: '../engine/core/engine-error' },
  'electron/workers/database-manager.ts':      { domain: 'DATA',     code: 'DATA_UNAVAILABLE',   importPath: '../engine/core/engine-error' },
  'electron/workers/health-checker.ts':        { domain: 'SYSTEM',   code: 'INTERNAL_ERROR',     importPath: '../engine/core/engine-error' },
  'electron/workers/llm-provider.ts':          { domain: 'AI',       code: 'AI_PARSE_ERROR',     importPath: '../engine/core/engine-error' },
  'electron/workers/migration-engine.ts':      { domain: 'DATA',     code: 'DATA_CORRUPT',       importPath: '../engine/core/engine-error' },
  'electron/workers/multi-tenancy.ts':         { domain: 'AUTH',     code: 'UNAUTHORIZED',       importPath: '../engine/core/engine-error' },
  'electron/workers/plugin-manager.ts':        { domain: 'SYSTEM',   code: 'INTERNAL_ERROR',     importPath: '../engine/core/engine-error' },
  'electron/workers/prediction-engine.ts':     { domain: 'AI',       code: 'AI_PARSE_ERROR',     importPath: '../engine/core/engine-error' },
  'electron/workers/state-machine.ts':         { domain: 'SYSTEM',   code: 'INTERNAL_ERROR',     importPath: '../engine/core/engine-error' },
  'electron/workers/stream-batch.ts':          { domain: 'SYSTEM',   code: 'INTERNAL_ERROR',     importPath: '../engine/core/engine-error' },
  'electron/workers/worker-pool.ts':           { domain: 'SYSTEM',   code: 'INTERNAL_ERROR',     importPath: '../engine/core/engine-error' },
};

let totalFiles = 0;
let totalReplacements = 0;
const results = [];

for (const [relPath, config] of Object.entries(FILE_CONFIG)) {
  const filePath = path.join(REPO, relPath);
  if (!fs.existsSync(filePath)) {
    results.push(`SKIP (not found): ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Skip if no raw `throw new Error` found
  const rawThrows = content.match(/throw new Error\(/g);
  if (!rawThrows || rawThrows.length === 0) {
    results.push(`SKIP (no throw new Error): ${relPath}`);
    continue;
  }

  const count = rawThrows.length;

  // 1. Add import if not already present
  if (!content.includes('EngineError')) {
    const importLine = `import { EngineError, ErrorDomain, ErrorCode } from '${config.importPath}';\n`;
    // Insert after last import or at top of file
    const importRegex = /^import\s.*$/gm;
    let lastImport = null;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      lastImport = match;
    }
    if (lastImport) {
      const insertPos = lastImport.index + lastImport[0].length;
      content = content.slice(0, insertPos) + '\n' + importLine + content.slice(insertPos);
    } else {
      content = importLine + content;
    }
  }

  // 2. Replace all `throw new Error(` with `throw new EngineError(ErrorDomain.X, ErrorCode.Y, `
  content = content.replace(
    /throw new Error\(/g,
    `throw new EngineError(ErrorDomain.${config.domain}, ErrorCode.${config.code}, `
  );

  // 3. Write back
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    totalReplacements += count;
    results.push(`OK: ${relPath} — ${count} replacements (→ ${config.domain}/${config.code})`);
  }
}

console.log(`\n=== EngineError Batch Conversion Report ===`);
console.log(`Files modified: ${totalFiles}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`\nDetails:`);
results.forEach(r => console.log(`  ${r}`));
