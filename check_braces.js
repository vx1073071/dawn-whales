const fs=require('fs');
const c=fs.readFileSync('src/lib/bridge-api.ts','utf-8');
const lines=c.split('\n');

let depth = 0;
let inTemplate = false;
let inString = false;
let stringChar = '';

for (let i=0; i<lines.length; i++) {
   const line = lines[i];
   // Skip GBK comments (they contain random braces)
   if (line.trim().startsWith('//') && line.includes('闂')) continue;
   if (line.trim().startsWith('export async function')) {
      // Extract just this line's braces (skip content that might be in strings)
   }
   for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
   }
}
console.log('Final brace depth:', depth);
console.log('(positive = unclosed open-brace, negative = extra close-brace)');

// Find WHERE the unbalance occurs
depth = 0;
for (let i=0; i<lines.length; i++) {
   let line = lines[i];
   const prevDepth = depth;
   // Skip full-line GBK comments (they contain braces in garbled text)
   const trimmed = line.trim();
   if (trimmed.startsWith('//') && line.includes('闂')) continue;

   for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
   }
   if (depth !== prevDepth && depth < 0 && prevDepth === 0) {
      console.log('First negative depth at line', i+1, ':', line.substring(0,100));
   }
}
// Report last depth
console.log('');
for (let i=Math.max(0,lines.length-5); i<lines.length; i++) {
   let line = lines[i];
   const trimmed = line.trim();
   console.log('L'+(i+1)+' depth check:', trimmed.substring(0,80));
}
