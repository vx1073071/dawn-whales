const fs = require('fs');

// ─── 1. Fix bridge-api-types.ts ───
// Remove the Window.api declaration (keep utility functions, import only)
// bridge-api.ts and window.d.ts already declare Window.api
let btypes = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/bridge-api-types.ts', 'utf8');

// Remove the entire declare global block, keeping only imports and utility functions
// Strategy: replace "declare global {" through the closing "}" that ends the interface Window block
// But must keep hasIPC() at bottom
let pos = btypes.indexOf('declare global {');
if (pos >= 0) {
  // Find matching closing brace
  let depth = 0;
  let endPos = pos;
  for (let i = pos; i < btypes.length; i++) {
    if (btypes[i] === '{') depth++;
    if (btypes[i] === '}') {
      depth--;
      if (depth === 0) {
        endPos = i + 1;
        break;
      }
    }
  }
  if (endPos > pos) {
    // Replace entire declare global block with a comment
    let before = btypes.substring(0, pos);
    let after = btypes.substring(endPos);
    // Trim empty lines
    before = before.replace(/\n\s*\n\s*$/g, '\n\n');
    btypes = before + '// R256: Window.api declared in bridge-api.ts (canonical) and window.d.ts\n' + after;
    fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/bridge-api-types.ts', btypes, 'utf8');
    console.log('PATCHED: bridge-api-types.ts (removed duplicate Window.api)');
  }
}

// ─── 2. Fix stock-comparison-r255.ts r.label → r.dimension ───
let scr = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/ai/stock-comparison-r255.ts', 'utf8');
let count = 0;
// Find: ${r.label} and replace with ${r.dimension}
scr = scr.replace(/\$\{r\.label\}/g, function() { count++; return '${r.dimension}'; });
if (count > 0) {
  fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/ai/stock-comparison-r255.ts', scr, 'utf8');
  console.log('PATCHED: stock-comparison-r255.ts (' + count + ' x r.label->r.dimension)');
} else {
  console.log('SKIP: stock-comparison-r255.ts (no r.label found)');
}

console.log('\n=== R256 final fixes applied ===');
