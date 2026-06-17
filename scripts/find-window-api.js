const fs = require('fs');
const path = require('path');

// Find all files that declare Window.api
function findWindowApi(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === 'dist' || item === '.git') continue;
    const fp = path.join(dir, item);
    const st = fs.statSync(fp);
    if (st.isDirectory()) {
      findWindowApi(fp);
    } else if (st.isFile() && /\.(ts|tsx|d\.ts)$/.test(item)) {
      const content = fs.readFileSync(fp, 'utf8');
      if (content.includes('declare global') && content.includes('interface Window') && content.includes('api:')) {
        console.log(fp);
      }
    }
  }
}

findWindowApi('C:/Users/vx107/.easyclaw/workspace/dawn-whales/src');
