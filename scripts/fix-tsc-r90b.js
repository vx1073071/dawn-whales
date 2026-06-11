// Fix: Re-add EngineError import (only EngineError, not ErrorDomain/ErrorCode)
const fs = require('fs');
const path = require('path');

const files = [
  { file: 'src/components/risk/RiskConfigEditor.tsx', rel: '../../../electron/engine/core/engine-error' },
  { file: 'src/components/settings/PreferencesPage.tsx', rel: '../../../electron/engine/core/engine-error' },
  { file: 'src/components/strategy/StrategyImportExportUI.tsx', rel: '../../../electron/engine/core/engine-error' },
  { file: 'src/components/tools/DataQualityPage.tsx', rel: '../../../electron/engine/core/engine-error' },
  { file: 'src/components/trading/AccountSummary.tsx', rel: '../../../electron/engine/core/engine-error' },
  { file: 'src/components/trading/BrokerConfigSelector.tsx', rel: '../../../electron/engine/core/engine-error' },
  { file: 'src/components/trading/BrokerStatusBar.tsx', rel: '../../../electron/engine/core/engine-error' },
  { file: 'src/components/trading/TradeDashboardPage.tsx', rel: '../../../electron/engine/core/engine-error' },
  { file: 'src/components/trading/TradeExecutionPanel.tsx', rel: '../../../electron/engine/core/engine-error' },
  { file: 'src/hooks/useOpenDStream.ts', rel: '../../electron/engine/core/engine-error' },
  { file: 'src/hooks/useWebSocketQuotes.ts', rel: '../../electron/engine/core/engine-error' },
  { file: 'src/opend/opend-client.ts', rel: '../../electron/engine/core/engine-error' },
];

let fixed = 0;

files.forEach(({ file, rel }) => {
  const fullPath = path.join(process.cwd(), file);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Check if EngineError is used in the file (besides the import)
  const usesEngineError = content.includes('EngineError') && !content.includes("import { EngineError");
  
  // Check if there's already an EngineError import
  const hasImport = content.includes("from '" + rel + "'") || content.includes('from "' + rel + '"');
  
  if (usesEngineError && !hasImport) {
    // Add import at the top, after any existing imports
    const lines = content.split('\n');
    let insertIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ') || lines[i].startsWith('//')) {
        insertIdx = i + 1;
      } else if (lines[i].trim() === '') {
        continue;
      } else {
        break;
      }
    }
    lines.splice(insertIdx, 0, `import { EngineError } from '${rel}';`);
    fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
    console.log(`ADDED: ${file} -> import { EngineError } from '${rel}'`);
    fixed++;
  } else {
    console.log(`SKIP: ${file} (usesEngineError=${usesEngineError}, hasImport=${hasImport})`);
  }
});

// Also fix parallel-backtest.ts - check if it uses EngineError
const pbPath = 'src/lib/parallel-backtest.ts';
const pbContent = fs.readFileSync(pbPath, 'utf8');
if (pbContent.includes('EngineError') && !pbContent.includes("import { EngineError")) {
  const lines = pbContent.split('\n');
  lines.splice(0, 0, "import { EngineError } from '../../electron/engine/core/engine-error';");
  fs.writeFileSync(pbPath, lines.join('\n'), 'utf8');
  console.log('ADDED: parallel-backtest.ts');
  fixed++;
}

console.log(`\nTotal fixed: ${fixed}`);
