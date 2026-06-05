const fs=require('fs');
const c=fs.readFileSync('src/lib/bridge-api.ts','utf-8');
const lines=c.split('\n');

// The file has GBK comments everywhere. Try to find the unclosed brace
// Strategy: remove ALL GBK lines and re-check
let clean = '';
let inGbkComment = false;
for (const line of lines) {
    const trimmed = line.trim();
    // Skip full GBK comments (Chinese garbage lines)
    if (trimmed.startsWith('//') && trimmed.length > 10 && /[\u8000-\uffff]{3,}/.test(trimmed)) {
        continue;
    }
    clean += line + '\n';
}

let depth = 0;
const cleanLines = clean.split('\n');
for (let i=0; i<cleanLines.length; i++) {
    const line = cleanLines[i];
    for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
    }
    if (depth < 0) {
        console.log(`NEGATIVE at clean line ${i+1}: ${line.substring(0,60)}`);
        break;
    }
}
console.log('Final depth (without GBK comments):', depth);
