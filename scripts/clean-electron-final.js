/**
 * Final pass: remove all remaining literal CJK from electron/
 */
const fs = require('fs');

function fixFile(filePath, replaceMap) {
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const newLines = lines.map(line => {
    const trimmed = line.trim();
    // Skip actual comments (not regex comments which are inline)
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('/**')) return line;
    let result = line;
    for (const [cn, replacement] of Object.entries(replaceMap)) {
      result = result.split(cn).join(replacement);
    }
    return result;
  });
  fs.writeFileSync(filePath, newLines.join('\n'));
}

// nl-parser.ts - remaining literal CJK + fix doubled unicode escapes
(function(){
  let c = fs.readFileSync('electron/engine/agents/nl-parser.ts', 'utf8');
  // Fix doubled backslash in unicode escapes: \\\\uXXXX -> \\uXXXX
  c = c.replace(/\\\\\\\\u([0-9a-f]{4})/gi, (_, hex) => {return '\\\\u' + hex});
  const nlMap = {
    '小于': '\\\\u5c0f\\\\u4e8e',
    '大于': '\\\\u5927\\\\u4e8e',
    '涨幅': '\\\\u6da8\\\\u5e45',
    '突破': '\\\\u7a81\\\\u7834',
    '价格': '\\\\u4ef7\\\\u683c',
    '涨破': '\\\\u6da8\\\\u7834',
    '跌破': '\\\\u8dcc\\\\u7834',
    '跌穿': '\\\\u8dcc\\\\u7a7f',
    '止损': '\\\\u6b62\\\\u635f',
    '亏': '\\\\u4e8f',
    '损': '\\\\u635f',
  };
  const lines = c.split('\n');
  const newLines = lines.map(l => {const t=l.trim();if(t.startsWith('//')||t.startsWith('*')||t.startsWith('/*')||t.startsWith('/**'))return l;let r=l;for(const[k,v]of Object.entries(nlMap))r=r.split(k).join(v);return r});
  fs.writeFileSync('electron/engine/agents/nl-parser.ts', newLines.join('\n'));
  console.log('nl-parser.ts done');
})();

// market-hotspot.ts
fixFile('electron/engine/data/market-hotspot.ts', {
  '股份': '\\\\u80a1\\\\u4efd',
  '科技': '\\\\u79d1\\\\u6280',
  '电子': '\\\\u7535\\\\u5b50',
  '集团': '\\\\u96c6\\\\u56e2',
  '控股': '\\\\u63a7\\\\u80a1',
  '医药': '\\\\u533b\\\\u836f',
  '能源': '\\\\u80fd\\\\u6e90',
  '汽车': '\\\\u6c7d\\\\u8f66',
  '银行': '\\\\u94f6\\\\u884c',
});
console.log('market-hotspot.ts done');

// stock-screener.ts
fixFile('electron/engine/data/stock-screener.ts', {
  '描述': '\\\\u63cf\\\\u8ff0',
  '行数': '\\\\u884c\\\\u6570',
});
console.log('stock-screener.ts done');

// data-quality files - remove mojibake 锟
for (const f of ['electron/engine/data/data-quality-scorer-dim-b.ts','electron/engine/data/data-quality-scorer-dim-c.ts']) {
  let c = fs.readFileSync(f, 'utf8');
  // Remove all 锟 chars (mojibake)
  c = c.replace(/\u951f/g, '');
  fs.writeFileSync(f, c);
  console.log(f.split('/').pop(), 'done');
}

// nlp-sentiment-engine.ts - fix partial replacements
(function(){
  let c = fs.readFileSync('electron/engine/agents/nlp-sentiment-engine.ts', 'utf8');
  const nlpMap = {
    '新': '\\\\u65b0',
    '半': '\\\\u534a',
    '东': '\\\\u4e1c',
    '发': '\\\\u53d1',
    '产': '\\\\u4ea7',
    '战': '\\\\u6218',
    '投': '\\\\u6295',
    '签': '\\\\u7b7e',
    '能': '\\\\u80fd',
    '源': '\\\\u6e90',
    '聆': '\\\\u542c',
    '证': '\\\\u8bc1',
    '扩': '\\\\u6269',
    '张': '\\\\u5f20',
    '仪': '\\\\u4eea',
    '式': '\\\\u5f0f',
    '创': '\\\\u521b',
    '始': '\\\\u59cb',
    '人': '\\\\u4eba',
    '监': '\\\\u76d1',
    '事': '\\\\u4e8b',
    '席': '\\\\u4e3b',
  };
  const lines = c.split('\n');
  const newLines = lines.map(l => {const t=l.trim();if(t.startsWith('//')||t.startsWith('*')||t.startsWith('/*')||t.startsWith('/**'))return l;let r=l;for(const[k,v]of Object.entries(nlpMap))r=r.split(k).join(v);return r});
  fs.writeFileSync('electron/engine/agents/nlp-sentiment-engine.ts', newLines.join('\n'));
  console.log('nlp-sentiment-engine.ts done');
})();

// Final count
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
let total = 0;
function walk(dd) {
  for (const f of fs.readdirSync(dd)) {
    const p = dd + '/' + f;
    try {
      const s = fs.statSync(p);
      if (s.isDirectory()) { if (!f.startsWith('.') && !['node_modules','dist','coverage'].includes(f)) walk(p); }
      else if (/\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.')) {
        const content = fs.readFileSync(p, 'utf8');
        const m = content.match(CJK);
        if (m) { total += m.length; console.log(m.length + ' ' + p.replace(/\\/g,'/').split('dawn-whales/')[1]); }
      }
    } catch(e) {}
  }
}
walk('electron');
console.log('\nTOTAL CJK:', total);
