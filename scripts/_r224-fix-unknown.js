const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/quant-moo/src/';

// Fix SignalTimeline.tsx - unknown → any in callbacks
let p=base+'components/risk/SignalTimeline.tsx';
let c=fs.readFileSync(p,'utf-8');
c=c.replace(/\(s: unknown\)/g, '(s: any)');
fs.writeFileSync(p,c);
console.log('SignalTimeline: unknown→any');

// Fix EquityChart.tsx
p=base+'components/risk/EquityChart.tsx';
c=fs.readFileSync(p,'utf-8');
c=c.replace(/\(p: unknown\)/g, '(p: any)');
fs.writeFileSync(p,c);
console.log('EquityChart: unknown→any');

// Fix PnLPanel.tsx
p=base+'components/trading/PnLPanel.tsx';
c=fs.readFileSync(p,'utf-8');
c=c.replace(/\(p: unknown\)/g, '(p: any)');
fs.writeFileSync(p,c);
console.log('PnLPanel: unknown→any');

// Fix PositionMonitor.tsx
p=base+'components/trading/PositionMonitor.tsx';
c=fs.readFileSync(p,'utf-8');
c=c.replace(/\(p: unknown\)/g, '(p: any)');
fs.writeFileSync(p,c);
console.log('PositionMonitor: unknown→any');

console.log('\nDone');
