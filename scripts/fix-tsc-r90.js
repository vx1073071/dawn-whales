// Fix TSC R90: Remove unused EngineError imports + fix ErrorCode
const fs = require('fs');
const path = require('path');

const unusedImportFiles = [
  'src/components/risk/RiskConfigEditor.tsx',
  'src/components/settings/PreferencesPage.tsx', 
  'src/components/strategy/StrategyImportExportUI.tsx',
  'src/components/tools/DataQualityPage.tsx',
  'src/components/trading/AccountSummary.tsx',
  'src/components/trading/BrokerConfigSelector.tsx',
  'src/components/trading/BrokerStatusBar.tsx',
  'src/components/trading/TradeDashboardPage.tsx',
  'src/components/trading/TradeExecutionPanel.tsx',
  'src/hooks/useOpenDStream.ts',
  'src/hooks/useWebSocketQuotes.ts',
  'src/lib/parallel-backtest.ts',
  'src/opend/opend-client.ts',
];

let fixed = 0;

unusedImportFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) { console.log(`SKIP: ${file}`); return; }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  // Remove the unused EngineError import line
  const lines = content.split('\n');
  const newLines = lines.filter(line => {
    if (line.match(/^import \{ EngineError.*\} from ['"].*engine-error['"]/)) {
      console.log(`REMOVED: ${file} -> ${line.trim()}`);
      return false;
    }
    return true;
  });
  
  if (newLines.length < lines.length) {
    fs.writeFileSync(fullPath, newLines.join('\n'), 'utf8');
    fixed++;
  }
});

// Fix ErrorCode.NOT_FOUND -> DATA_UNAVAILABLE in payment.ts
const paymentPath = 'src/lib/payment.ts';
let pc = fs.readFileSync(paymentPath, 'utf8');
const pu = pc.replace(/ErrorCode\.NOT_FOUND/g, 'ErrorCode.DATA_UNAVAILABLE');
if (pu !== pc) { fs.writeFileSync(paymentPath, pu, 'utf8'); console.log('FIXED: payment.ts ErrorCode.NOT_FOUND'); fixed++; }

// Fix ErrorCode.INTERNAL -> INTERNAL_ERROR in I18nProvider.tsx
const i18nPath = 'src/i18n/I18nProvider.tsx';
let ic = fs.readFileSync(i18nPath, 'utf8');
const iu = ic.replace(/ErrorCode\.INTERNAL\b/g, 'ErrorCode.INTERNAL_ERROR');
if (iu !== ic) { fs.writeFileSync(i18nPath, iu, 'utf8'); console.log('FIXED: I18nProvider.tsx ErrorCode.INTERNAL'); fixed++; }

console.log(`\nTotal files fixed: ${fixed}`);
