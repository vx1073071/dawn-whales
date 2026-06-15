const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/dawn-whales/src/';

// Fix StrategyCompareModal.tsx — check actual lines
let p=base+'components/strategy/StrategyCompareModal.tsx';
let c=fs.readFileSync(p,'utf-8');
let l=c.split('\n');
console.log('=== StrategyCompareModal.tsx ===');
console.log('L43: '+l[42]);
console.log('L45: '+l[44]);
console.log('L125: '+l[124]);
console.log('L149: '+l[148]);
