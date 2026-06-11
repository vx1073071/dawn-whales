const fs = require('fs');
const path = require('path');

// Modules that tests import as flat (electron/engine/xxx) but are now in subdirs
const notFoundModules = [
  'creator-llm-config', 'ai-cost-monitor', 'data-versioning-enhanced',
  'realtime-quality-monitor', 'realtime-aggregator', 'sentiment-index',
  'stock-anomaly-detector', 'news-aggregator', 'sector-rotation',
  'market-hotspot', 'capital-flow-monitor', 'portfolio-risk',
  'stock-diagnosis', 'market-breadth', 'consumer-data', 'margin-data',
  'unlock-calendar', 'dividend-calendar', 'earnings-calendar',
  'data-quality-monitor', 'emi-unified', 'backtest-engine',
  'nl-parser', 'data-cleaning-pipeline', 'data-warehouse',
  'multi-source-aggregator', 'genetic-algorithm', 'monte-carlo-simulator',
  'volatility-models', 'technical-indicators', 'calendar-effects', 'dynamic-sizer',
  'smart-picker'
];

const engineDir = 'electron/engine';
const subdirs = fs.readdirSync(engineDir).filter(function(f) {
  return fs.statSync(path.join(engineDir, f)).isDirectory();
});

console.log('Engine subdirs:', subdirs.join(', '));
console.log('');

notFoundModules.forEach(function(mod) {
  let found = null;
  subdirs.forEach(function(sub) {
    const candidate = path.join(engineDir, sub, mod + '.ts');
    if (fs.existsSync(candidate)) {
      found = 'electron/engine/' + sub + '/' + mod;
    }
  });
  if (!found) {
    // Also check src/ and electron/ root
    const altPaths = [
      'electron/' + mod + '.ts',
      'src/lib/' + mod + '.ts',
      'src/' + mod + '.ts',
      'electron/engine/' + mod + '.ts',
    ];
    altPaths.forEach(function(p) {
      if (fs.existsSync(p)) found = p.replace('.ts', '');
    });
  }
  if (!found) {
    // Try partial match
    subdirs.forEach(function(sub) {
      const dir = path.join(engineDir, sub);
      fs.readdirSync(dir).forEach(function(f) {
        if (f.includes(mod) || mod.includes(f.replace('.ts', ''))) {
          if (!found) found = 'electron/engine/' + sub + '/' + f.replace('.ts', '') + ' (partial)';
        }
      });
    });
  }
  console.log(mod + ':', found || 'NOT FOUND');
});
