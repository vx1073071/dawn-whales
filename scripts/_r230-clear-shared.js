const fs=require('fs');
const {execSync}=require('child_process');
const base='c:/Users/vx107/.easyclaw/workspace/quant-moo/';

// Target: 20 files to remove @ts-nocheck from
// Prioritize IPC, broker base classes, and lighter files
const targets=[
  // IPC (4) — mostly stub/bridge patterns already fixed
  'electron/ipc/em-ipc.ts',
  'electron/ipc/report-ipc.ts',
  'electron/ipc/strategy-ipc.ts',
  'electron/main/ipc-setup.ts',
  // Broker base adapters (5) — abstract/base classes
  'electron/broker/adapters/BridgeAdapterBase.ts',
  'electron/broker/adapters/CryptoAdapterBase.ts',
  'electron/broker/adapters/DirectAdapterBase.ts',
  'electron/broker/adapters/OAuthBrokerBase.ts',
  'electron/broker/opend-base-adapter.ts',
  // Engine lighter files (6)
  'electron/engine/analysis/live-trade-bridge.ts',
  'electron/engine/analysis/multi-account-adapter.ts',
  'electron/engine/core/async-io-scheduler.ts',
  'electron/engine/core/sandbox-exec.ts',
  'electron/engine/data/websocket-enhancer.ts',
  'electron/engine/data/opend-health-check.ts',
  // Data utils (3)
  'electron/engine/data/data-quality-scorer-dim-d.ts',
  'electron/engine/data/data-quality-scorer-dimensions1.ts',
  'electron/engine/data/multi-source-aggregator/types.ts',
  'electron/engine/data/multi-source-aggregator/helpers.ts',
  'electron/engine/risk/volatility-models/core.ts',
  // Message aggregator (1)
  'electron/engine/data/multi-source-aggregator/core.ts',
];

console.log('Targeting',targets.length,'files');
let done=0,skipped=0;

targets.forEach(fp=>{
  const fullPath=base+fp;
  if(!fs.existsSync(fullPath)){
    console.log('MISSING:',fp);
    skipped++;
    return;
  }
  let content=fs.readFileSync(fullPath,'utf-8');
  if(!content.includes('@ts-nocheck')){
    console.log('NO @ts-nocheck:',fp);
    skipped++;
    return;
  }
  content=content.replace(/\/\/\s*@ts-nocheck\s*\n?/g,'').replace(/\/\*\s*@ts-nocheck\s*\*\/\s*\n?/g,'');
  fs.writeFileSync(fullPath,content);
  console.log('CLEARED:',fp);
  done++;
});

console.log('\nCleared:',done,'/ Skipped:',skipped,'/ Total:',targets.length);

// TSC check
console.log('\nRunning TSC...');
try{
  const o=execSync('npx tsc --noEmit 2>&1',{cwd:base,encoding:'utf-8',timeout:120000});
  console.log('TSC: 0 errors [PASS]');
}catch(e){
  const o=(e.stdout||'')+(e.stderr||'');
  const sharedErrors=o.split('\n').filter(l=>
    targets.some(t=>l.includes(t.replace('electron/','')))
  );
  console.log('New errors from cleared files:',sharedErrors.length);
  if(sharedErrors.length>0){
    console.log('Sample errors:');
    sharedErrors.slice(0,10).forEach(l=>console.log(l));
  }
  const total=o.split('\n').filter(l=>l.match(/error TS\d+/)).length;
  console.log('Total project TS errors:',total);
}
