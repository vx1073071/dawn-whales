const fs = require('fs');
let content = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');

// Replace navItems array with clean ASCII emojis
const start = content.indexOf('const navItems: NavItem[] = [');
const end = content.indexOf('];', start) + 2;
if (start < 0) { console.log('NOT FOUND'); process.exit(1); }

const newBlock = `const navItems: NavItem[] = [
  { id: 'dashboard', icon: '📊', section: 'overview' },
  { id: 'market', icon: '📈', section: 'trade' },
  { id: 'sectorHeatmap', icon: '🔥' },
  { id: 'macroDashboard', icon: '📉' },
  { id: 'stockScreener', icon: '🔍' },
  { id: 'newsDashboard', icon: '📰' },
  { id: 'sectorRotation', icon: '🔄' },
  { id: 'consumerDashboard', icon: '🛒' },
  { id: 'marginDashboard', icon: '💳' },
  { id: 'dragonTiger', icon: '🐉' },
  { id: 'capitalFlow', icon: '💵' },
  { id: 'fundHoldings', icon: '🏛️' },
  { id: 'dailyReport', icon: '📋' },
  { id: 'stockOverview', icon: '🔬' },
  { id: 'realTimeMarket', icon: '📡' },
  { id: 'dataQuality', icon: '✅' },
  { id: 'cacheExplorer', icon: '🗄️' },
  { id: 'sentimentStream', icon: '💬' },
  { id: 'smartPicker', icon: '🎯' },
  { id: 'tradeExecution', icon: '💼' },
  { id: 'tradeHistory', icon: '📜' },
  { id: 'aiAdvisor', icon: '🤖' },
  { id: 'performanceAttribution', icon: '📊' },
  { id: 'regimeMonitor', icon: '🌊' },
  { id: 'factorExposure', icon: '🧬' },
  { id: 'strategy', icon: '⚙️' },
  { id: 'marketplace', icon: '🏪' },
  { id: 'backtest', icon: '🧪' },
  { id: 'backtestComparison', icon: '📈' },
  { id: 'portfolio', icon: '💎' },
  { id: 'portfolioRebalancer', icon: '⚖️' },
  { id: 'orders', icon: '📝' },
  { id: 'risk', icon: '🛡️' },
  { id: 'paperTrader', icon: '🎮' },
  { id: 'opendHealth', icon: '💚' },
  { id: 'settings', icon: '🔧', section: 'system' },
];`;

content = content.substring(0, start) + newBlock + content.substring(end);
fs.writeFileSync('src/components/layout/Sidebar.tsx', content, 'utf8');
console.log('NavItems replaced: ' + start + ' to ' + end);
