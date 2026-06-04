const fs = require('fs');
const path = require('path');

const componentsDir = 'src/components';
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (/[\u4e00-\u9fff]/.test(content)) {
        const matches = [];
        const regex = /['"]([^'"]*[\u4e00-\u9fff][^'"]*)['"]/g;
        let m;
        while ((m = regex.exec(content)) !== null) {
          matches.push(m[1]);
        }
        if (matches.length > 0) {
          files.push({
            path: fullPath.replace(/\\/g, '/'),
            count: matches.length,
            samples: matches.slice(0, 3)
          });
        }
      }
    }
  }
}

walk(componentsDir);
files.sort((a, b) => b.count - a.count);

console.log('Files with Chinese text (sorted by count):');
console.log('==========================================');
for (const f of files.slice(0, 25)) {
  console.log(`${f.count.toString().padStart(3)} ${f.path}`);
  for (const s of f.samples) {
    console.log(`    - ${s.substring(0, 50)}`);
  }
}
console.log(`\nTotal: ${files.length} files`);
