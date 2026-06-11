// R90: Add translations for M-02 keys to all locale files
const fs = require('fs');
const path = require('path');

const keysFile = 'scripts/i18n-r90-m02-keys.json';
if (!fs.existsSync(keysFile)) { console.log('No keys file found'); process.exit(0); }

const newKeys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
const keyCount = Object.keys(newKeys).length;
console.log(`Adding ${keyCount} keys to locale files...`);

// Simple translation map (zh-CN as base, others translated)
const locales = ['zh-CN', 'en', 'zh-HK', 'zh-TW', 'ja', 'ko', 'fr', 'de', 'it', 'es', 'ru'];
const localeDir = 'src/i18n/locales';

// Basic translation function
function translate(text, locale) {
  if (locale === 'zh-CN') return text;
  if (locale === 'zh-HK' || locale === 'zh-TW') return text; // Same for now
  if (locale === 'en') {
    // Common translations
    const map = {
      '今日': 'Today', '涨跌幅排名': 'Change Ranking', '涨跌幅': 'Change %',
      '买入': 'Buy', '卖出': 'Sell', '持有': 'Hold',
      '止损': 'Stop Loss', '止盈': 'Take Profit', '目标': 'Target',
      '均线': 'Moving Average', '金叉': 'Golden Cross', '死叉': 'Death Cross',
      '上穿': 'Cross Above', '下穿': 'Cross Below', '突破': 'Breakthrough',
      '涨': 'Up', '跌': 'Down', '新高': 'New High', '新低': 'New Low',
      '超过': 'Exceeds', '高于': 'Above', '低于': 'Below',
      '快线': 'Fast Line', '慢线': 'Slow Line', '信号线': 'Signal Line',
      '超买': 'Overbought', '超卖': 'Oversold',
      '布林': 'Bollinger', '上轨': 'Upper Band', '下轨': 'Lower Band',
      '日': 'Day', '日ATR': 'Day ATR', '倍': 'x',
      '股份': 'Shares', '控股': 'Holdings', '集团': 'Group',
      '科技': 'Technology', '电子': 'Electronics', '生物': 'Bio',
      '医药': 'Pharma', '银行': 'Banking', '证券': 'Securities',
      '保险': 'Insurance', '地产': 'Real Estate', '能源': 'Energy',
      '汽车': 'Automotive', '半导体': 'Semiconductor', '芯片': 'Chip',
      '新能源': 'New Energy', '人工智能': 'AI',
      '描述': 'Description', '行数': 'Rows',
      '适用于': 'Applicable to',
      '策略': 'Strategy', '回测': 'Backtest', '交易': 'Trade',
      '信号': 'Signal', '自选股': 'Watchlist', '设置': 'Settings',
      '索引': 'Index', '评论': 'Comment', '评分': 'Rating',
    };
    let result = text;
    for (const [zh, en] of Object.entries(map)) {
      result = result.replace(new RegExp(zh, 'g'), en);
    }
    return result;
  }
  // Other locales: return zh-CN for now (can be translated later)
  return text;
}

for (const locale of locales) {
  const filePath = path.join(localeDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) continue;
  
  let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let added = 0;
  
  for (const [key, value] of Object.entries(newKeys)) {
    // Split key into namespace and k
    const parts = key.split('.');
    const ns = parts[0];
    const k = parts.slice(1).join('.');
    
    if (!data[ns]) data[ns] = {};
    if (!data[ns][k]) {
      data[ns][k] = translate(value, locale);
      added++;
    }
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`  ${locale}: +${added} keys`);
}

console.log('Done.');
