const fs=require('fs');
const p='c:/Users/vx107/.easyclaw/workspace/quant-moo/src/lib/bridge-api/data.ts';
let c=fs.readFileSync(p,'utf-8');

// Remove any existing duplicate as any casts
c=c.replace(/ as any as any/g, ' as any');

// Fix ALL stub returns (one-liners with return { success: false, ... })
c=c.replace(
  /return \{ success: false,(.*?)}(;?)/g,
  'return { success: false,$1} as any$2'
);

fs.writeFileSync(p,c);
console.log('data.ts: all stubs fixed');
// Verify
const lines=c.split('\n');
let bad=0;
for(let i=98;i<132;i++){
  if(lines[i]&&lines[i].includes('success: false')&&!lines[i].includes('as any')&&!lines[i].includes('error:')){
    console.log('BAD line '+(i+1)+': '+lines[i].substring(0,100));
    bad++;
  }
}
console.log('Bad lines remaining: '+bad);
