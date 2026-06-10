/**
 * Fix useTranslation duplicate: remove it from 'react' import, keep in 'react-i18next'
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const files = [
  'src/components/market/DataQualityMonitorPage.tsx',
  'src/components/market/SmartPickerPage.tsx',
  'src/components/risk/EconomicCalendar.tsx',
  'src/components/risk/MarketBreadth.tsx',
  'src/components/risk/MarketMovers.tsx',
  'src/components/risk/NotificationCenter.tsx',
  'src/components/risk/PortfolioStressTest.tsx',
  'src/components/risk/RiskConfigEditor.tsx',
  'src/components/risk/SentimentGauge.tsx',
  'src/components/risk/SystemLog.tsx',
];

let total = 0;
files.forEach(rel => {
  const fp = path.join(root, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(fp)) { console.log('SKIP: ' + rel); return; }
  let c = fs.readFileSync(fp, 'utf-8');
  
  // Remove useTranslation from react import
  const reactMatch = c.match(/import\s*\{([^}]+)\}\s*from\s*['"]react['"]/);
  if (reactMatch) {
    const items = reactMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    const cleaned = items.filter(i => i !== 'useTranslation');
    if (cleaned.length !== items.length) {
      if (cleaned.length > 0) {
        c = c.replace(/import\s*\{[^}]+\}\s*from\s*['"]react['"]/, `import { ${cleaned.join(', ')} } from 'react'`);
      } else {
        c = c.replace(/import\s*\{\s*\}\s*from\s*['"]react['"]\s*;?\s*\n?/, '');
      }
      fs.writeFileSync(fp, c, 'utf-8');
      total++;
      console.log(`FIXED: ${rel} (react: ${items.join(',')} → ${cleaned.join(',')})`);
    }
  }
});
console.log(`\nTotal: ${total}`);
