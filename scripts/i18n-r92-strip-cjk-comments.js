// R92: Aggressively remove ALL CJK from comments
// Strategy: Replace CJK chars in comments with empty string, clean up residual punctuation
const fs = require('fs');
const path = require('path');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;
const CJK_OR_PUNCT = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef\u2000-\u206f]/g;

function stripCJKFromComment(text) {
  // Remove all CJK characters
  let result = text.replace(CJK, '');
  // Clean up: remove isolated Chinese punctuation that's left behind
  result = result.replace(/[\u3000-\u303f\uff00-\uffef]{2,}/g, ' ');
  // Clean up multiple spaces
  result = result.replace(/  +/g, ' ');
  // Clean up trailing spaces before newline
  result = result.replace(/ +$/g, '');
  // Clean up " — " or " - " left hanging
  result = result.replace(/\s*—\s*$/g, '');
  result = result.replace(/\s*-\s*$/g, '');
  // Clean up empty comments like "//  " → "//"
  result = result.replace(/^(\s*\/\/)\s+$/, '$1');
  result = result.replace(/^(\s*\*)\s+$/, '$1');
  return result;
}

function processFile(filePath) {
  const c = fs.readFileSync(filePath, 'utf8');
  const lines = c.split('\n');
  let changes = 0;
  let inBlock = false;
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Block comment tracking
    if (trimmed.startsWith('/*')) {
      inBlock = true;
      if (CJK.test(line)) {
        newLines.push(stripCJKFromComment(line));
        changes++;
      } else {
        newLines.push(line);
      }
      if (trimmed.includes('*/')) inBlock = false;
      continue;
    }
    if (inBlock) {
      if (CJK.test(line)) {
        newLines.push(stripCJKFromComment(line));
        changes++;
      } else {
        newLines.push(line);
      }
      if (trimmed.includes('*/')) inBlock = false;
      continue;
    }
    // Full-line single comment
    if (trimmed.startsWith('//')) {
      if (CJK.test(line)) {
        newLines.push(stripCJKFromComment(line));
        changes++;
      } else {
        newLines.push(line);
      }
      continue;
    }
    // Code line with inline comment containing CJK
    const commentMatch = line.match(/^(.*?)(\/\/.*)$/);
    if (commentMatch && CJK.test(commentMatch[2])) {
      const code = commentMatch[1];
      const comment = stripCJKFromComment(commentMatch[2]);
      // If comment is now just "//" or "// ", remove it entirely
      const cleanedComment = comment.trim();
      if (cleanedComment === '//' || cleanedComment === '') {
        newLines.push(code.trimEnd());
      } else {
        newLines.push(code + comment);
      }
      changes++;
      continue;
    }
    newLines.push(line);
  }

  if (changes > 0) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
  }
  return changes;
}

const dirs = ['src', 'electron'];
let totalChanges = 0;
let totalFiles = 0;

function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (!f.startsWith('.') && f !== 'node_modules' && f !== 'dist' && f !== 'locales' && f !== 'coverage') walk(p);
    } else if (/\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.')) {
      const c = processFile(p);
      if (c > 0) {
        totalChanges += c;
        totalFiles++;
      }
    }
  }
}

for (const dir of dirs) walk(dir);
console.log(`Stripped CJK from ${totalChanges} comment lines in ${totalFiles} files`);
