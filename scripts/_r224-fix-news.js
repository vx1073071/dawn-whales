const fs=require('fs');
const p='c:/Users/vx107/.easyclaw/workspace/dawn-whales/src/components/market/NewsDashboardPage.tsx';
let c=fs.readFileSync(p,'utf-8');
c=c.replace(/{article\.summary\s*\&\&/, '{String(article.summary || "") &&');
fs.writeFileSync(p,c);
console.log('done');
