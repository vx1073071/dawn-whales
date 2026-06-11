// R91 Analysis: Categorize ALL remaining CJK chars
// Categories: comment, regex, mock/data, user-visible-string, other-code
const fs = require('fs');
const path = require('path');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const CJK_GLOBAL = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

function countCJK(s) { return (s.match(CJK_GLOBAL) || []).length; }

function categorizeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const cats = { comment: 0, regex: 0, data: 0, userString: 0, other: 0 };
  let inBlock = false;
  
  for (const line of lines) {
    const t = line.trim();
    const cjkCount = countCJK(line);
    if (cjkCount === 0) continue;
    
    // Block comment tracking
    if (t.startsWith('/*')) { inBlock = true; }
    if (t.includes('*/')) { 
      if (inBlock) { cats.comment += cjkCount; inBlock = false; continue; }
    }
    if (inBlock) { cats.comment += cjkCount; continue; }
    
    // Single-line comment
    if (t.startsWith('//')) { cats.comment += cjkCount; continue; }
    
    // Remove inline comment (careful with strings)
    let codePart = line;
    let commentChars = 0;
    let inStr = false, strChar = '', inBT = false;
    for (let i = 0; i < line.length - 1; i++) {
      const ch = line[i];
      if (!inStr && !inBT && (ch === "'" || ch === '"' || ch === '`')) {
        inStr = true; strChar = ch; if (ch === '`') inBT = true;
      } else if (inStr && ch === strChar && line[i-1] !== '\\') {
        inStr = false; if (strChar === '`') inBT = false;
      } else if (!inStr && !inBT && ch === '/' && line[i+1] === '/') {
        codePart = line.substring(0, i);
        commentChars = countCJK(line.substring(i));
        break;
      }
    }
    cats.comment += commentChars;
    
    const codeCJK = countCJK(codePart);
    if (codeCJK === 0) continue;
    
    // Check if it's a regex pattern
    if (/\/[^/]*[\u4e00-\u9fff]/.test(codePart) || /new RegExp/.test(codePart) || /\.match\(/.test(codePart) || /\.test\(/.test(codePart) || /\.replace\(\/[^)]+[\u4e00-\u9fff]/.test(codePart)) {
      // Regex lines
      if (/\/.*[\u4e00-\u9fff].*\/[gimsuy]*/.test(codePart)) {
        cats.regex += codeCJK;
        continue;
      }
    }
    
    // Check if it's mock/data (arrays of Chinese strings for display, test data, etc)
    if (/^\s*(?:'[^']*[\u4e00-\u9fff][^']*'|"[^"]*[\u4e00-\u9fff][^"]*")\s*,?\s*$/.test(codePart)) {
      cats.data += codeCJK;
      continue;
    }
    
    // User-visible string: string literal in JSX, error messages, UI text
    if (/['"`][^'"`]*[\u4e00-\u9fff][^'"`]*['"`]/.test(codePart)) {
      cats.userString += codeCJK;
      continue;
    }
    
    cats.other += codeCJK;
  }
  
  return cats;
}

function scanAll(dir, results = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (['node_modules','dist','.git','coverage'].includes(f.name)) return;
    if (f.isDirectory()) scanAll(p, results);
    else if (/\.(ts|tsx)$/.test(f.name)) {
      try {
        const c = fs.readFileSync(p, 'utf8');
        if (countCJK(c) > 0) {
          const cats = categorizeFile(p);
          const total = Object.values(cats).reduce((a,b) => a+b, 0);
          results.push({ file: path.relative(process.cwd(), p).replace(/\\/g, '/'), ...cats, total });
        }
      } catch {}
    }
  });
  return results;
}

const srcResults = scanAll('src');
const electronResults = scanAll('electron');
const all = [...srcResults, ...electronResults];

const totals = { comment: 0, regex: 0, data: 0, userString: 0, other: 0 };
all.forEach(f => {
  totals.comment += f.comment;
  totals.regex += f.regex;
  totals.data += f.data;
  totals.userString += f.userString;
  totals.other += f.other;
});

console.log('=== CJK Category Breakdown ===');
console.log('Comment:     ', totals.comment);
console.log('Regex:       ', totals.regex);
console.log('Mock/Data:   ', totals.data);
console.log('User String: ', totals.userString);
console.log('Other Code:  ', totals.other);
console.log('TOTAL:       ', Object.values(totals).reduce((a,b) => a+b, 0));
console.log();

// PM says: mock data and comments don't count
const pmRelevant = totals.regex + totals.userString + totals.other;
console.log(`PM-relevant (excl comment+mock): ${pmRelevant}`);
console.log();

// Show top files by PM-relevant chars
console.log('=== Top 30 files by PM-relevant CJK ===');
all.sort((a,b) => (b.regex + b.userString + b.other) - (a.regex + a.userString + a.other));
all.slice(0, 30).forEach(f => {
  const relevant = f.regex + f.userString + f.other;
  if (relevant > 0) {
    console.log(`${relevant.toString().padStart(5)} (regex:${f.regex} str:${f.userString} other:${f.other} cmt:${f.comment}) ${f.file}`);
  }
});
