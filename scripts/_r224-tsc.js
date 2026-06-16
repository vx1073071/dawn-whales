const { execSync } = require('child_process');
let out;
try {
  out = execSync('npx tsc --noEmit 2>&1', {
    cwd: 'c:/Users/vx107/.easyclaw/workspace/quant-moo',
    maxBuffer: 10*1024*1024,
    timeout: 90000
  }).toString();
} catch(e) {
  out = e.stdout ? e.stdout.toString() : '';
}

const all = out.split('\n').filter(l => l.includes('error TS'));

// My adapter files
const adapterFiles = [
  'ib-adapter','ICloudBrokerAdapter','opend-base-adapter','adapter-factory',
  'binance-adapter','bitget-adapter','bybit-adapter','etoro-adapter','etrade-adapter',
  'ib-tws-adapter','mt5-adapter','okx-adapter','robinhood-crypto-adapter',
  'schwab-adapter','tiger-adapter','vbkr-adapter','bridge-depth-adapter','lwc-drawing-adapter',
];

const frontendFiles = [
  'bridge-api/app','bridge-api/data','bridge-api/risk','bridge-api/trade',
  'localStorageMigration','parallel-backtest','price-locale',
  'usePatternDetection','copyTradeMockData',
  'SymbolSearch','KLineChart','NewsDashboardPage',
  'TickTimeline','VolumeProfileSpread','OrderBookWaterfall','ReplayAndMicrostructure',
  'PnLOverview','CopyTradeHub','CopyTradeStatusPanel','CopyTradeNotifications','CopyTradeOnboarding',
  'SignalTimeline','AnomalyAlertPanel','EquityChart',
  'PositionMonitor','PnLPanel',
  'StrategyExplainCard','StrategyCompareModal',
  'OrdersPage','APIKeyConfigPanel','GlobalSearch'
];

const myFiles = [...adapterFiles, ...frontendFiles];
const myErrors = all.filter(l => myFiles.some(f => l.includes(f)));

console.log('My files errors:', myErrors.length);
console.log('Total errors:', all.length);

if (myErrors.length > 0) {
  console.log('\nRemaining my errors:');
  myErrors.forEach(e => console.log('  '+e.substring(0,250)));
} else {
  console.log('\nALL MY FILES: 0 errors!');
}
