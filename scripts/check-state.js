const fs = require('fs');
const files = [
  'electron/engine/agents/nl-parser.ts',
  'electron/engine/risk/risk-engine.ts',
  'electron/engine/agents/ai-report-generator.ts',
  'electron/engine/analysis/live-trade-bridge.ts',
  'electron/engine/analysis/technical-indicators.ts',
  'electron/data/marketplace-service.ts',
  'electron/data/data-provider.ts',
  'electron/engine/analysis/template-compatibility-engine.ts',
  'electron/engine/agents/agent-macro.ts',
  'electron/engine/core/i18n-data.ts',
];
files.forEach(f => {
  const c = fs.readFileSync(f, 'utf-8');
  const cn = (c.match(/[\u4e00-\u9fff]/g) || []).length;
  const hasT = c.includes('i18n.t(');
  const hasImport = c.includes("import i18n from");
  console.log(f.split('/').pop() + ': ' + cn + ' cn, t()=' + hasT + ', imp=' + hasImport);
});
