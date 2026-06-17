const fs = require('fs');
let c = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/bridge-api-types.ts', 'utf8');

// Find line "import type {" and remove everything until the closing "} from 'bridge-api-defs';"
let startIdx = c.indexOf('import type {');
let endIdx = c.indexOf("} from './bridge-api-defs';");
if (startIdx >= 0 && endIdx >= 0) {
  // Include the closing line too
  endIdx = endIdx + "} from './bridge-api-defs';".length;
  // Remove the whole block plus trailing newline
  let newlineEnd = c.indexOf('\n', endIdx);
  if (newlineEnd >= 0) endIdx = newlineEnd + 1;
  // Also remove preceding newline if any
  let pre = c.substring(0, startIdx).replace(/\n\s*$/, '\n');
  let post = c.substring(endIdx).replace(/^\n+/, '\n');
  c = pre + post;
  fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/bridge-api-types.ts', c, 'utf8');
  console.log('FIXED: removed import block');
} else {
  console.log('Import block not found');
}
