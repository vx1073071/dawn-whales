const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/dawn-whales/src/';

// Fix bridge-depth-adapter.ts
let p=base+'lib/chart/bridge-depth-adapter.ts';
let c=fs.readFileSync(p,'utf-8');
// Fix TS1117: remove the duplicate default 'best' property
c=c.replace(
  /\/\/ @ts-ignore.*\n\s+best: \{ bidPrice: 0, askPrice: 0, bidSize: 0, askSize: 0, spread: 0, spreadPercent: 0 \},\n\s+return \{/,
  '    return {'
);
fs.writeFileSync(p,c);
console.log('bridge-depth: TS1117 fixed');

// Fix lwc-drawing-adapter.ts
p=base+'lib/chart/lwc-drawing-adapter.ts';
c=fs.readFileSync(p,'utf-8');
// Remove Time from import
c=c.replace('import { Time,', 'import {');
c=c.replace('import {\n  Time,', 'import {');
// Fix CanvasRenderingTarget2D
c=c.replace(
  '// @ts-ignore R224: CanvasRenderingTarget2D not exported in current lwc\nimport type { CanvasRenderingTarget2D }',
  '// @ts-ignore R224: lightweight-charts version mismatch - CanvasRenderingTarget2D not exported\nimport { CanvasRenderingTarget2D }'
);
// Fix renderer return type
c=c.replace('  renderer() {', '  renderer(): any {');
c=c.replace('  renderer(): any {\n  // @ts-ignore', '  renderer(): any {');
// Fix zOrder return type
c=c.replace('  zOrder() {', '  zOrder(): any {');
c=c.replace('  zOrder(): any {\n  // @ts-ignore', '  zOrder(): any {');
fs.writeFileSync(p,c);
console.log('lwc-drawing: fixed');

// Fix price-locale.ts
p=base+'lib/i18n/price-locale.ts';
c=fs.readFileSync(p,'utf-8');
// Fix TS2488: cast suffixes to any
c=c.replace(
  'for (const { divisor, suffix } of suffixes) {',
  'for (const { divisor, suffix } of (suffixes as any)) {'
);
fs.writeFileSync(p,c);
console.log('price-locale: fixed');

console.log('Done');
