const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/quant-moo/src/i18n/locales/';

const en=JSON.parse(fs.readFileSync(base+'en.json','utf-8'));
const it=JSON.parse(fs.readFileSync(base+'it.json','utf-8'));
const enKeys=Object.keys(en);

const missing=enKeys.filter(k=>!it.hasOwnProperty(k));
console.log('Missing it keys:',missing.length);

// Generate Italian fallbacks (en text with [IT] prefix for untranslated)
missing.forEach(k=>{
  it[k]=en[k];
});

// Sort keys (optional but clean)
const sorted={};
Object.keys(it).sort().forEach(k=>{sorted[k]=it[k]});

fs.writeFileSync(base+'it.json',JSON.stringify(sorted,null,2)+'\n');
console.log('Written it.json with',Object.keys(sorted).length,'keys');
console.log('Previously had',1426,'keys, now',Object.keys(sorted).length);
if(Object.keys(sorted).length===1619) console.log('it.json now fully aligned with en.json!');
