// R214 autoclaw transform script — applies both U8 + P8 to factor-strategy-templates.ts
const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\vx107\\.easyclaw\\workspace\\quant-moo\\electron\\engine\\strategies\\factor-strategy-templates.ts';
let src = fs.readFileSync(filePath, 'utf-8');

let changes = 0;

// ═══════════════════════════════════════════════════════════════════════════
// P8: expectedHoldingDays standardization
// Add holdingDays: { min, max, unit } to FactorStrategyTemplate interface
// and populate for all 44 templates
// ═══════════════════════════════════════════════════════════════════════════

// Step 1: Add HoldingDays type + add field to interface
const holdingDaysType = `
/** Structured holding days for filtering/sorting */
export interface HoldingDays {
  min: number;
  max: number;
  unit: 'day' | 'month' | 'year';
}`;

// Insert after AiTriggerPoint interface (before TemplateFourIronRules)
src = src.replace(
  /export interface DeepSeekChatConfig \{/,
  holdingDaysType + '\n\nexport interface DeepSeekChatConfig {'
);

// Add holdingDays field to FactorStrategyTemplate interface
src = src.replace(
  /(\/\*\* R206: DeepSeek conversational chat trigger.*?\*\/\n\s+deepSeekChat\?\: DeepSeekChatConfig;)/s,
  '$1\n\n  /** R214: Structured holding days for filtering/sorting (P8) */\n  holdingDays: HoldingDays;'
);
changes++;

// Step 2: Add holdingDays to each template after expectedHoldingDays line
// Mapping from expectedHoldingDays string → structured
const dayMap = {
  '1-2天':     { min: 1,  max: 2,   unit: 'day' },
  '1-3天':     { min: 1,  max: 3,   unit: 'day' },
  '1-7天':     { min: 1,  max: 7,   unit: 'day' },
  '1-14天':    { min: 1,  max: 14,  unit: 'day' },
  '1-21天':    { min: 1,  max: 21,  unit: 'day' },
  '3-14天':    { min: 3,  max: 14,  unit: 'day' },
  '5-20天':    { min: 5,  max: 20,  unit: 'day' },
  '7-21天':    { min: 7,  max: 21,  unit: 'day' },
  '7-30天':    { min: 7,  max: 30,  unit: 'day' },
  '7-60天':    { min: 7,  max: 60,  unit: 'day' },
  '7-90天':    { min: 7,  max: 90,  unit: 'day' },
  '14-60天':   { min: 14, max: 60,  unit: 'day' },
  '14-90天':   { min: 14, max: 90,  unit: 'day' },
  '30-90天':   { min: 30, max: 90,  unit: 'day' },
  '30-180天':  { min: 30, max: 180, unit: 'day' },
  '90-365天':  { min: 3,  max: 12,  unit: 'month' },
  '180-730天': { min: 6,  max: 24,  unit: 'month' },
  '实时监控':  { min: 0,  max: 1,   unit: 'day' },
  '自动执行':  { min: 0,  max: 1,   unit: 'day' },
  '上市首日-7天': { min: 0, max: 7, unit: 'day' },
};

for (const [text, struct] of Object.entries(dayMap)) {
  const regex = new RegExp(`(expectedHoldingDays:\\s*'${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}')`, 'g');
  const replacement = `$1,\n    holdingDays: { min: ${struct.min}, max: ${struct.max}, unit: '${struct.unit}' }`;
  const oldSrc = src;
  src = src.replace(regex, replacement);
  if (src !== oldSrc) changes++;
}

// ═══════════════════════════════════════════════════════════════════════════
// U8: Signal push coverage 41%→80% — add AI_FACTOR_SIGNAL_PUSH to 17 templates
// ═══════════════════════════════════════════════════════════════════════════

// Templates to add signal push (each with a fitting description)
const signalPushAdditions = {
  'crypto-btc-trend':           'BTC趋势信号+资金费率异动实时推送',
  'crypto-eth-btc-rotation':    'ETH/BTC轮动信号+Gas费异常推送',
  'crypto-funding-arbitrage':   '资金费率异动触发套利窗口推送',
  'crypto-liquidation-hunt':    '大额爆仓事件实时推送',
  'crypto-futures-spot-arb':    '期现价差异常扩大推送',
  'crypto-hodl-dca-enhanced':   'DCA加仓时机+链上指标异动推送',
  'jp-jpx-value-repair':        'JPX价值股催化剂事件推送',
  'tw-twse-electronic-exdiv':   '除权息日历+填息概率信号推送',
  'au-asx-resource-franking':   '大宗商品价格突破+Franking变化推送',
  'eu-stoxx-esg-premium':       'ESG评级变动+碳价异动推送',
  'in-nse-inflation-hedge':     '印度CPI/WPI数据异动+商品价格推送',
  'kr-krx-export-cycle':        '韩国出口数据+汇率异动推送',
  'hk-ah-premium':              'AH溢价突破阈值实时推送',
  'hk-redchip-homecoming':      '红筹回A进度+价差信号推送',
  'hk-warrant-direction':       '窝轮街货量异常+散户情绪反转推送',
  'ai-value-hunter':            '价值因子信号+估值修复触发推送',
  'ai-stock-screener':          'AI筛选结果更新+新股票信号推送',
};

const signalPushEntry = (desc) =>
  `    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '${desc}' },`;

for (const [templateId, description] of Object.entries(signalPushAdditions)) {
  // Find the template block and locate its last aiTriggerPoints entry before ],
  const blockRegex = new RegExp(`(id:\\s*'${templateId}'[\\s\\S]*?aiTriggerPoints:\\s*\\[[\\s\\S]*?)(\\s*\\],)`, 'm');
  const match = src.match(blockRegex);
  if (match) {
    // Insert signal push entry as the first item in the array (after the opening bracket)
    src = src.replace(
      new RegExp(`(id:\\s*'${templateId}'[\\s\\S]*?aiTriggerPoints:\\s*\\[)\\s*\\n`),
      `$1\n${signalPushEntry(description)}\n`
    );
    changes++;
  } else {
    console.log(`WARNING: Could not find template ${templateId} for signal push insertion`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Export registration update — add HoldingDays type to exports
// ═══════════════════════════════════════════════════════════════════════════

// Check exports already have FactorStrategyTemplate — yes they do.

// Write back
fs.writeFileSync(filePath, src, 'utf-8');
console.log(`Applied ${changes} transformations to: ${path.basename(filePath)}`);

// Quick validation
const final = fs.readFileSync(filePath, 'utf-8');
const signalCount = (final.match(/AI_FACTOR_SIGNAL_PUSH/g) || []).length;
const holdingCount = (final.match(/holdingDays:/g) || []).length;
console.log(`Signal push touchpoints: ${signalCount} (target: 35, was: 18)`);
console.log(`holdingDays entries: ${holdingCount} (target: 44)`);
console.log(`Total lines: ${final.split('\n').length}`);
