const fs = require('fs');
const content = fs.readFileSync('src/lib/bridge-api.ts', 'utf-8');
let depth = 0;
for (let i = 0; i < content.length; i++) {
  const ch = content[i];
  if (ch === '"' || ch === "'" || ch === '`') {
    i++;
    while (i < content.length && content[i] !== ch) {
      if (content[i] === '\') i++;
      i++;
    }
    continue;
  }
  if (ch === '/' && content[i+1] === '/') {
    while (i < content.length && content[i] !== '\n') i++;
    continue;
  }
  if (ch === '/' && content[i+1] === '*') {
    i += 2;
    while (i < content.length && !(content[i] === '*' && content[i+1] === '/')) i++;
    i++;
    continue;
  }
  if (ch === '{') depth++;
  if (ch === '}') depth--;
}
console.log('Final depth:', depth);
