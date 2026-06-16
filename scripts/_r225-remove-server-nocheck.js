const fs=require('fs');
const path='c:/Users/vx107/.easyclaw/workspace/quant-moo/server/';

const files=[
  'copy-trade-executor.ts',
  'daily-limit-engine.ts',
  'dead-letter-queue.ts',
  'notification-store.ts',
  'paper-copy-trade-engine.ts',
  'routes/admin-market.ts',
  'routes/wallet.ts',
  'services/ai-cache.ts',
  'services/ai-fallback.ts',
  'services/chain-monitor-v2.ts',
  'services/creator-level.ts',
  'services/ws-push-service.ts',
  'ws-push-enhancer.ts',
  'ws-push-service.ts'
];

let total=0;
files.forEach(f=>{
  const fp=path+f;
  if(!fs.existsSync(fp)){console.log('MISSING: '+f);return;}
  let c=fs.readFileSync(fp,'utf-8');
  if(!c.includes('@ts-nocheck')){console.log('NO @ts-nocheck: '+f);return;}
  c=c.replace(/\/\/ @ts-nocheck.*\n?/g,'');
  c=c.replace(/\/\/ @ts-nocheck.*\r?\n?/g,'');
  // Also remove standalone @ts-nocheck without comment
  c=c.replace(/^\/\/ @ts-nocheck\s*$/gm,'');
  fs.writeFileSync(fp,c);
  console.log('Removed: '+f);
  total++;
});
console.log('\nTotal removed: '+total);
