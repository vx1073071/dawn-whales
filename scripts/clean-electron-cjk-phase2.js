/**
 * Phase 2: Clean CJK from regex patterns and remaining comments
 */
const fs = require('fs');
const path = require('path');

const REPLACEMENTS = {
  // market-hotspot.ts - CJK regex patterns → Unicode escapes in hotspots
  'electron/engine/analysis/market-hotspot.ts': [
    [/(?:股份\|)/g, ()=>'(?:股份|)'],
    [/板块/, ()=>'\u677f\u5757'],
    [/行业/, ()=>'\u884c\u4e1a'],
    [/产业/, ()=>'\u4ea7\u4e1a'],
  ],
  // python-proxy.ts - regex patterns
  'electron/engine/core/python-proxy.ts': [
    [/描述\|Description\|描述/g, ()=>'\u63cf\u8ff0|Description|\u63cf\u8ff0'],
    [/行数\|Rows\|行数/g, ()=>'\u884c\u6570|Rows|\u884c\u6570'],
  ],
  // stock-screener.ts - regex patterns  
  'electron/engine/data/stock-screener.ts': [
    [/描述\|Description\|描述/g, ()=>'\u63cf\u8ff0|Description|\u63cf\u8ff0'],
    [/行数\|Rows\|行数/g, ()=>'\u884c\u6570|Rows|\u884c\u6570'],
    [/\[BW元%\]/g, '[BW%]'],
  ],
  // news-sentiment-v2.ts
  'electron/engine/analysis/news-sentiment-v2.ts': [
    [/经济日报/g, 'Economic Daily'],
  ],
  // ai-drawing-engine.ts
  'electron/engine/agents/ai-drawing-engine.ts': [
    [/次/g, ' hits'],
  ],
  // data-quality-scorer-dim-b.ts - corrupted CJK (already mojibake, remove)
  'electron/engine/data/data-quality-scorer-dim-b.ts': [
    [/锟絥o contradictions, stable schema across rows./g, 'no contradictions, stable schema across rows.'],
    [/锟絘ll rows should have the same keys/g, 'all rows should have the same keys'],
    [/锟絜nsure all rows have the same fields./g, 'ensure all rows have the same fields.'],
    [/锟絛uplicate detection by timestamp./g, 'duplicate detection by timestamp.'],
    [/锟絟eep the latest or merge records./g, 'keep the latest or merge records.'],
    [/锟絚annot check uniqueness./g, 'cannot check uniqueness.'],
  ],
  // data-quality-scorer-dim-c.ts - corrupted CJK
  'electron/engine/data/data-quality-scorer-dim-c.ts': [
    [/锟絧rices must be positive./g, 'prices must be positive.'],
    [/锟絤ay indicate data feed errors or genuine market events./g, 'may indicate data feed errors or genuine market events.'],
    [/锟絭alues should be within 2000-2050./g, 'values should be within 2000-2050.'],
    [/锟絚onsistent formatting, no mixed types in fields./g, 'consistent formatting, no mixed types in fields.'],
    [/锟絚ast all values in a field to the same type./g, 'cast all values in a field to the same type.'],
  ],
};

let totalCleaned = 0;
for (const [file, replacements] of Object.entries(REPLACEMENTS)) {
  const fp = path.resolve(file);
  if (!fs.existsSync(fp)) {
    console.log(`  SKIP ${file} (not found)`);
    // Try to find it
    const name = path.basename(file);
    const {execSync}=require('child_process');
    try{
      const found=execSync('cd quant-moo && dir /s /b '+name,{encoding:'utf8',cwd:'C:/Users/vx107/.easyclaw/workspace'}).trim();
      if(found) console.log(`    found at: ${found}`);
    }catch(e){}
    continue;
  }
  let content = fs.readFileSync(fp, 'utf8');
  let modified = false;
  for (const [pattern, replacement] of replacements) {
    const newContent = content.replace(pattern, typeof replacement === 'function' ? replacement() : replacement);
    if (newContent !== content) {
      modified = true;
      content = newContent;
    }
  }
  if (modified) {
    fs.writeFileSync(fp, content);
    totalCleaned++;
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  - ${file} (no changes)`);
  }
}
console.log(`\nCleaned ${totalCleaned} files`);
