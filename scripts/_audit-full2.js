const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/quant-moo/electron/engine/strategies/';
const all=fs.readdirSync(base);
let total=0;
const counts={};
all.filter(f=>f.match(/template/)&&!f.includes('types')&&!f.includes('param')&&!f.includes('version')).forEach(f=>{
  const c=fs.readFileSync(base+f,'utf-8');
  // Count id: 'xx' patterns (template IDs)
  const ids=c.match(/id:\s*'([^']+)'/g)||[];
  const uniqueIds=new Set(ids.map(s=>s.match(/'([^']+)'/)[1]));
  counts[f]=uniqueIds.size;
  total+=uniqueIds.size;
});
Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).forEach(([f,c])=>console.log(f+': '+c+' templates'));
console.log('TOTAL: '+total+' templates');
console.log('');

// Brokers: list actual adapter names
const brokerDir='c:/Users/vx107/.easyclaw/workspace/quant-moo/server/adapters/';
let adapters=[];
try{adapters=fs.readdirSync(brokerDir).filter(f=>f.endsWith('.ts'))}catch(e){}
console.log('=== BROKER ADAPTERS (server/adapters/) ===');
adapters.forEach(f=>console.log('  '+f.replace('-adapter.ts','').replace('.ts','')));

// Also check broker dir for adapter names
const bd='c:/Users/vx107/.easyclaw/workspace/quant-moo/electron/broker/';
let bfiles=[];
try{bfiles=fs.readdirSync(bd).filter(f=>f.endsWith('adapter.ts')||f.endsWith('adapter.tsx'))}catch(e){}
console.log('\nBroker adapters (electron/broker/):');
bfiles.forEach(f=>console.log('  '+f));

// Count @ts-nocheck
console.log('\n=== @ts-nocheck remaining ===');
const {execSync}=require('child_process');
try{
  const o=execSync('rg -l "@ts-nocheck" --include="*.ts" --include="*.tsx" electron/ src/ server/ 2>&1',{cwd:'c:/Users/vx107/.easyclaw/workspace/quant-moo',encoding:'utf-8',timeout:10000});
  const files=o.trim().split('\n').filter(Boolean);
  console.log('Files with @ts-nocheck:',files.length);
  files.slice(0,15).forEach(f=>console.log('  '+f));
  if(files.length>15)console.log('  ... and '+(files.length-15)+' more');
}catch(e){
  // rg not available, try node-based search
  console.log('(rg not available)');
}
