const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist', 'assets');
const files = fs.readdirSync(distPath).filter(f => f.startsWith('index-') && f.endsWith('.js'));

console.log('Main bundle:', files[0]);
const content = fs.readFileSync(path.join(distPath, files[0]), 'utf8');
const size = Buffer.byteLength(content, 'utf8');
console.log('Size:', (size / 1024).toFixed(2), 'KB');

// Find large string literals
const largeStrings = content.match(/"[^"]{1000,}"/g) || [];
console.log('\nLarge strings (>1KB):', largeStrings.length);
largeStrings.forEach((s, i) => {
  console.log(`  ${i + 1}. Length: ${s.length} chars, Preview: ${s.substring(0, 80)}...`);
});

// Check for inline JSON
const jsonMatches = content.match(/\{[^{}]{500,}\}/g) || [];
console.log('\nLarge JSON objects (>500 chars):', jsonMatches.length);

// Check for base64 data
const base64Matches = content.match(/data:[^;]+;base64,[A-Za-z0-9+/=]{100,}/g) || [];
console.log('Base64 data URLs:', base64Matches.length);

console.log('\nOptimization suggestions:');
if (size > 300 * 1024) {
  console.log('- Main bundle exceeds 300KB target by', ((size - 300 * 1024) / 1024).toFixed(2), 'KB');
  console.log('- Consider extracting large strings to separate files');
  console.log('- Use dynamic imports for non-critical code');
}
