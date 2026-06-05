const fs=require('fs');
const c=fs.readFileSync('src/lib/bridge-api.ts','utf-8');
const lines=c.split('\n');

let depth=0;
for (let i=715; i<lines.length; i++){
   const line = lines[i];
   let open=0, close=0;
   for(const ch of line){
      if (ch==='{') { depth++; open++; }
      else if (ch==='}') { depth--; close++; }
   }
   console.log(`L${i+1} depth=${depth} (+${open} -${close}): ${line.substring(0,70)}`);
}
