const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/dawn-whales/electron/engine/strategies/';
const all=fs.readdirSync(base);
let total=0;
const results=[];
all.filter(f=>f.match(/template/)).forEach(f=>{
  const c=fs.readFileSync(base+f,'utf-8');
  const ids=c.match(/templateId:\s*'/g)||[];
  if(ids.length>0){
    results.push(f+': '+ids.length+' templateIds');
    total+=ids.length;
  }
});
results.sort().forEach(r=>console.log(r));
console.log('TOTAL templates:',total);

// Check actual template content format
const crypto=fs.readFileSync(base+'factor-strategy-templates-crypto.ts','utf-8');
console.log('\nSample from crypto:');
console.log(crypto.substring(0,200));
