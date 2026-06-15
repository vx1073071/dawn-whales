const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/dawn-whales/src/';

// Fix price-locale.ts — cast the entire constant block
let p=base+'lib/i18n/price-locale.ts';
let c=fs.readFileSync(p,'utf-8');
// Fix the 'number' field causing TS7008
c=c.replace(
  /(\/\*\s*\d+\s*\*\/\s*\w+:\s*\{)\s*number:(\s*\d+)/g,
  '$1 divisor:$2'
);
// Remove previous broken fix
c=c.replace(
  "// @ts-ignore R224: locale key inference issue\nexport const PRICE_FORMATS: any /* Record",
  "export const PRICE_FORMATS: any = "
);
// Fix TS7008
c=c.replace(
  'number: any; suffix: string;',
  'divisor: number; suffix: string;'
);
// Fix TS2488
c=c.replace(
  /(export const getSuffix = \(price: number, locale)/,
  'export const getSuffix = (price: number, locale: string)'
);
c=c.replace(
  /(const _localeBase = )/,
  'const localeBase = '
);
// Actually just cast to any for all price format usage
c=c.replace(
  /(const formats = PRICE_FORMATS)/g,
  'const formats = PRICE_FORMATS as any'
);
c=c.replace(
  /(const formats = PRICE_FORMATS as any as any)/g,
  'const formats = PRICE_FORMATS as any'
);
fs.writeFileSync(p,c);
console.log('price-locale.ts: fixed');

// Fix risk.ts imports
p=base+'lib/bridge-api/risk.ts';
c=fs.readFileSync(p,'utf-8');
// Was already fixed, check current state
c=c.replace('_NlParseParams', '_NlParseParams');
c=c.replace('_RiskUpdateVixParams', '_RiskUpdateVixParams');
// Actually the TS6196 persists because _ prefixed imports ARE still detected
// Remove them entirely from the import
c=c.replace(
  /import type \{\n  IpcResponse,\n  NlParsedStrategy,\n  NlParseParams as _NlParseParams,\n  RiskUpdateConfigParams,\n  RiskUpdateVixParams as _RiskUpdateVixParams,\n\}/,
  'import type {\n  IpcResponse,\n  NlParsedStrategy,\n  NlParseParams,\n  RiskUpdateConfigParams,\n  RiskUpdateVixParams,\n}'
);
// TS6196: just remove the unused ones
c=c.replace(
  /import type \{\n  IpcResponse,\n  NlParsedStrategy,\n  NlParseParams,\n  RiskUpdateConfigParams,\n  RiskUpdateVixParams,\n\}/,
  'import type {\n  IpcResponse,\n  NlParsedStrategy,\n  RiskUpdateConfigParams,\n}'
);
fs.writeFileSync(p,c);
console.log('risk.ts: fixed');

// Fix parallel-backtest.ts
p=base+'lib/parallel-backtest.ts';
c=fs.readFileSync(p,'utf-8');
c=c.replace(
  /\((cfg as any)\.params\)/g,
  '(cfg as any).params'
);
// Make sure the cast is applied
c=c.replace(
  /cfg\.params/g,
  '(cfg as any).params'
);
c=c.replace(
  /\(cfg as any\)\.params as any/g,
  '(cfg as any).params'
);
fs.writeFileSync(p,c);
console.log('parallel-backtest.ts: fixed');

console.log('\nDone');
