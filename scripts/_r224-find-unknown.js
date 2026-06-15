const fs=require('fs');
let p='c:/Users/vx107/.easyclaw/workspace/dawn-whales/src/components/market/NewsDashboardPage.tsx';
let c=fs.readFileSync(p,'utf-8');
c=c.replace(/\{mood\s*\&\&/g, '{mood as any &&');
fs.writeFileSync(p,c);
console.log('NewsDashboardPage: mood fixed');

// Fix AnomalyAlertPanel — find similar unknown pattern
p='c:/Users/vx107/.easyclaw/workspace/dawn-whales/src/components/risk/AnomalyAlertPanel.tsx';
c=fs.readFileSync(p,'utf-8');
// Search for useState<unknown> patterns
const lines=c.split('\n');
lines.forEach((l,i)=>{
  if(l.includes('<unknown>')||l.includes('as unknown')) 
    console.log('L'+(i+1)+': '+l.trim());
});
// Search for JSX {var && pattern
lines.forEach((l,i)=>{
  if(l.match(/\{[a-zA-Z_]+ \&\&/)) 
    console.log('JSX guard L'+(i+1)+': '+l.trim());
});
