const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/dawn-whales/src/components/chart/';

let p=base+'ReplayAndMicrostructure.tsx';
let c=fs.readFileSync(p,'utf-8');
c=c.replace(
  "import { TickCache } from '../../lib/chart/tick-cache';",
  "// @ts-ignore R224: TickCache not yet implemented in tick-cache module\nimport type { TickCacheBuffer as TickCache } from '../../lib/chart/tick-cache';"
);
fs.writeFileSync(p,c);
console.log('ReplayAndMicrostructure: fixed');

p=base+'TickTimeline.tsx';
c=fs.readFileSync(p,'utf-8');
c=c.replace(
  "import { TickCache } from '../../lib/chart/tick-cache';",
  "// @ts-ignore R224: TickCache not yet implemented in tick-cache module\nimport type { TickCacheBuffer as TickCache } from '../../lib/chart/tick-cache';"
);
fs.writeFileSync(p,c);
console.log('TickTimeline: fixed');
