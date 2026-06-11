// Show "other" CJK lines for top src files
const fs = require('fs');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;

const files = [
  'src/components/billing/onboarding/OnboardingFullKit.tsx',
  'src/common/ErrorBoundary.tsx',
  'src/components/risk/SentimentDashboardPage.tsx',
  'src/components/backtest/BacktestReportPage.tsx',
  'src/components/ai/AgentCollaborationPanel.tsx',
  'src/components/billing/wallet/USDTPaymentPanel.tsx',
  'src/components/billing/community/CreatorLeaderboard.tsx',
  'src/components/billing/core/GAFinalPanel.tsx',
  'src/components/billing/trade/DataSourcePanel.tsx',
  'src/components/ai/LLMCreatorConfigPanel.tsx',
  'src/components/billing/core/GuestModeShell.tsx',
  'src/components/market/StockScreenerPage.tsx',
  'src/components/market/FundHoldingsPage.tsx',
  'src/components/orders/TradingDeskPage.tsx',
  'src/components/billing/trade/FractionalTradePanel.tsx',
  'src/components/marketplace/MarketplacePublishPanel.tsx',
];

for (const file of files) {
  const c = fs.readFileSync(file, 'utf8');
  const lines = c.split('\n');
  let inBlock = false;
  console.log(`\n=== ${file} ===`);
  let shown = 0;
  
  for (let i = 0; i < lines.length && shown < 10; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith('/*')) inBlock = true;
    if (t.includes('*/')) { if (inBlock) { inBlock = false; } continue; }
    if (inBlock) continue;
    if (t.startsWith('//')) continue;
    
    // Remove inline comment
    let codePart = line;
    let inStr = false, strChar = '', inBT = false;
    for (let j = 0; j < line.length - 1; j++) {
      const ch = line[j];
      if (!inStr && !inBT && (ch === "'" || ch === '"' || ch === '`')) {
        inStr = true; strChar = ch; if (ch === '`') inBT = true;
      } else if (inStr && ch === strChar && line[j - 1] !== '\\') {
        inStr = false; if (strChar === '`') inBT = false;
      } else if (!inStr && !inBT && ch === '/' && line[j + 1] === '/') {
        codePart = line.substring(0, j);
        break;
      }
    }
    
    if (CJK.test(codePart)) {
      console.log(`  ${i + 1}: ${codePart.trim().substring(0, 160)}`);
      shown++;
    }
  }
}
