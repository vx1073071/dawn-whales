const fs=require('fs');
const c=fs.readFileSync('src/lib/bridge-api.ts','utf-8');
const lines=c.split('\n');

let depth=0;
let lastZeroDepth = 0;
for (let i=0; i<lines.length; i++){
   const line = lines[i];
   // Skip GBK-comment lines (they contain random braces)
   if (line.trim().startsWith('//') && /[\u8000-\uffff]{4,}/.test(line)) continue;

   for(const ch of line){
      if (ch==='{') depth++;
      else if (ch==='}') depth--;
   }
   if (depth < 0) {
      console.log(`NEGATIVE depth at L${i+1}: ${line.substring(0,80)}`);
      break;
   }
   if (depth === 0) lastZeroDepth = i+1;
}
console.log(`Final depth: ${depth}`);
console.log(`Last balanced at line: ${lastZeroDepth}`);
