const fs=require('fs');
const c=fs.readFileSync('src/lib/bridge-api.ts','utf-8');
const lines=c.split('\n');

let depth=0;
for (let i=0; i<200; i++){
   const line = lines[i];
   if (line.trim().startsWith('//') && /[\u8000-\uffff]{4,}/.test(line)) {
      // Still track depth but show which line we skipped
   } else {
      for(const ch of line){
         if (ch==='{') depth++;
         else if (ch==='}') depth--;
      }
   }
   if (i < 60 || (depth > 0 && i < 200)) {
      console.log(`L${i+1} d=${depth}: ${line.substring(0,80)}`);
   }
}
