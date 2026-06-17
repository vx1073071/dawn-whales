const fs = require('fs');
let c = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/bridge-api-types.ts', 'utf8');

// Remove the import block and replace with comment
c = c.replace(
  /import type \{\n[\s\S]*?\} from '\.\/bridge-api-defs';\n\n\/\/ R256/,
  '// R256: type imports removed (Window.api now in bridge-api.ts + window.d.ts)\n// R256'
);

fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src/lib/bridge-api-types.ts', c, 'utf8');
console.log('DONE: bridge-api-types.ts imports removed');
