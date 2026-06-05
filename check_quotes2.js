const fs=require('fs');
const c=fs.readFileSync('src/lib/bridge-api.ts','utf-8');

// Find all unique quote-like chars
const quotes = new Set();
for (const ch of c) {
   const code = ch.charCodeAt(0);
   if ((code >= 0x2018 && code <= 0x201F) || (code >= 0x300C && code <= 0x300F)) {
      quotes.add(ch + ' (U+' + code.toString(16) + ')');
   }
}
console.log('Non-ASCII quotes found:', [...quotes]);

// Find first instance of a non-ASCII quote
for (let i=0; i<c.length; i++) {
   const code = c.charCodeAt(i);
   if (code > 127 && code < 0x10000) {
      const line = c.substring(0,i).split('\n').length;
      console.log('First non-ASCII at line', line, 'char', code.toString(16), ':', c.substring(i-5, i+10));
      break;
   }
}
