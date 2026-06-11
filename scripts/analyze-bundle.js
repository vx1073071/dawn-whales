const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist', 'assets');
const files = fs.readdirSync(distPath).filter(f => f.startsWith('index-') && f.endsWith('.js'));

console.log('Main bundle:', files[0]);
const content = fs.readFileSync(path.join(distPath, files[0]), 'utf8');
const size = Buffer.byteLength(content, 'utf8');
console.log('Size:', (size / 1024).toFixed(2), 'KB');

// Find large string literals (potential inline data)
const largeStrings = content.match(/"[^"]{1000,}"/g) || [];
console.log('Large strings (>1KB):', largeStrings.length);

// Count import statements
const imports = content.match(/from ['"][^'"]+['"]/g) || [];
console.log('Import count:', imports.length);

// Find potential optimization targets
console.log('\nOptimization suggestions:');
if (size > 300 * 1024) {
  console.log('- Main bundle exceeds 300KB target');
  console.log('- Consider lazy loading for large components');
  console.log('- Split vendor chunks more aggressively');
}
