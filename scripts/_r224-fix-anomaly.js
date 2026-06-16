const fs=require('fs');
let p='c:/Users/vx107/.easyclaw/workspace/quant-moo/src/components/risk/AnomalyAlertPanel.tsx';
let c=fs.readFileSync(p,'utf-8');
c=c.replace(/\{summary\s*\&\&/g, '{summary as any &&');
fs.writeFileSync(p,c);
console.log('AnomalyAlertPanel: summary fixed');
