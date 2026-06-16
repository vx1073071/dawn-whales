const fs=require('fs');
const {execSync}=require('child_process');
const base='c:/Users/vx107/.easyclaw/workspace/dawn-whales/';

// Remaining @ts-nocheck files after R230's 21
// Target: 30 more files
const targets=[
  // Broker adapters (7)
  'electron/broker/adapters/eToroAdapter.ts',
  'electron/broker/adapters/ETRADEAdapter.ts',
  'electron/broker/adapters/SchwabAdapter.ts',
  'electron/broker/adapters/WebullAdapter.ts',
  'electron/broker/ib-adapter.ts',
  'electron/broker/longbridge-adapter.ts',
  'electron/broker/moomoo-adapter.ts',
  // Broker utils (4)
  'electron/broker/BrokerManagerV2.ts',
  'electron/broker/execution-reporter.ts',
  'electron/broker/oauth-ipc-registration.ts',
  'electron/broker/unified-account-manager.ts',
  // Broker order (2)
  'electron/broker/opend-order-bridge.ts',
  'electron/broker/opend-signal-fetcher.ts',
  // Engine analysis (3)
  'electron/engine/analysis/trade-executor/core.ts',
  'electron/engine/backtest/walk-forward-report.ts',
  'electron/engine/data/news-sentiment-v2.ts',
  // Engine data (5)
  'electron/engine/data/realtime-news.ts',
  'electron/engine/data/sector-rotation-v2.ts',
  'electron/engine/data/stock-screener.ts',
  'electron/engine/data/multi-market-broker.ts',
  'electron/engine/data/multi-source-aggregator/helpers.ts.ts',
  // Engine portfolio (3)
  'electron/engine/portfolio/adaptive-param-engine.ts',
  'electron/engine/portfolio/bayesian-optimizer.ts',
  'electron/engine/portfolio/performance-monitor.ts',
  // Engine risk (3)
  'electron/engine/risk/risk-engine-v3.ts',
  'electron/engine/risk/risk-strategy-integrator/core.ts',
  'electron/engine/risk/risk-strategy-integrator/helpers.ts',
  'electron/engine/risk/risk-strategy-integrator/types.ts',
  // Extra duplicate files
  'electron/engine/data/multi-source-aggregator/types.ts.ts',
  'electron/engine/risk/risk-strategy-integrator/helpers.ts.ts',
  'electron/engine/risk/risk-strategy-integrator/types.ts.ts',
];

console.log('Targeting',targets.length,'files');
let done=0,skipped=0,missing=0;

targets.forEach(fp=>{
  const fullPath=base+fp;
  if(!fs.existsSync(fullPath)){
    console.log('MISSING:',fp);
    missing++;
    return;
  }
  let content=fs.readFileSync(fullPath,'utf-8');
  if(!content.includes('@ts-nocheck')){
    console.log('ALREADY CLEAN:',fp);
    skipped++;
    return;
  }
  content=content.replace(/\/\/\s*@ts-nocheck\s*\n?/g,'');
  content=content.replace(/\/\*\s*@ts-nocheck\s*\*\/\s*\n?/g,'');
  fs.writeFileSync(fullPath,content);
  done++;
});

console.log('Cleared:',done,'/ Clean:',skipped,'/ Missing:',missing);

// Check if *.ts.ts dupes exist and remove @ts-nocheck
const dupes=['electron/engine/data/multi-source-aggregator/helpers.ts.ts',
  'electron/engine/data/multi-source-aggregator/types.ts.ts',
  'electron/engine/risk/risk-strategy-integrator/helpers.ts.ts',
  'electron/engine/risk/risk-strategy-integrator/types.ts.ts'];
dupes.forEach(dupe=>{
  const p=base+dupe;
  if(fs.existsSync(p)){
    let c=fs.readFileSync(p,'utf-8');
    if(c.includes('@ts-nocheck')){
      c=c.replace(/\/\/\s*@ts-nocheck\s*\n?/g,'');
      fs.writeFileSync(p,c);
      console.log('DUPE CLEARED:',dupe);
    }
  }
});

// TSC
console.log('\nRunning TSC...');
try{
  const o=execSync('npx tsc --noEmit 2>&1',{cwd:base,encoding:'utf-8',timeout:120000});
  console.log('TSC: 0 errors');
}catch(e){
  const o=(e.stdout||'')+(e.stderr||'');
  const errCount=(o.match(/error TS\d+/g)||[]).length;
  console.log('Total TS errors:',errCount);
}
