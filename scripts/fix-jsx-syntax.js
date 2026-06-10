/**
 * Fix broken JSX attributes from v3 batch fix
 * Pattern: Number(attr)={...} → attr={...}
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let fixes = 0;

function fix(fp) {
  if (!fs.existsSync(fp)) return;
  let c = fs.readFileSync(fp, 'utf-8');
  const orig = c;
  // Fix Number(attrName)= → attrName=
  c = c.replace(/Number\((\w+)\)=/g, '$1=');
  if (c !== orig) {
    fs.writeFileSync(fp, c, 'utf-8');
    const count = (orig.match(/Number\(\w+\)=/g) || []).length;
    fixes += count;
    console.log(`FIXED ${count}: ${path.relative(root, fp)}`);
  }
}

// Fix MonteCarloPage
fix(path.join(root, 'src/components/backtest/MonteCarloPage.tsx'));
// Fix PnLPanel
fix(path.join(root, 'src/components/trading/PnLPanel.tsx'));
// Fix DashboardPage
fix(path.join(root, 'src/components/dashboard/DashboardPage.tsx'));
// Fix TradingDeskPage
fix(path.join(root, 'src/components/orders/TradingDeskPage.tsx'));
// Fix PositionMonitor
fix(path.join(root, 'src/components/trading/PositionMonitor.tsx'));
// Fix PositionMonitorPanel
fix(path.join(root, 'src/components/trading/PositionMonitorPanel.tsx'));

console.log(`Total fixes: ${fixes}`);
