const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/dawn-whales/src/i18n/locales/';
const en=JSON.parse(fs.readFileSync(base+'en.json','utf-8'));
const enKeys=Object.keys(en);

// Fill es.json
const es=JSON.parse(fs.readFileSync(base+'es.json','utf-8'));
const esMissing=enKeys.filter(k=>!es.hasOwnProperty(k));
esMissing.forEach(k=>{es[k]=en[k]});
const esSorted={};
Object.keys(es).sort().forEach(k=>{esSorted[k]=es[k]});
fs.writeFileSync(base+'es.json',JSON.stringify(esSorted,null,2)+'\n');
console.log('es.json:',Object.keys(esSorted).length,'keys (was 1614, filled',esMissing.length,'missing)');

// Fill ru.json
const ru=JSON.parse(fs.readFileSync(base+'ru.json','utf-8'));
const ruMissing=enKeys.filter(k=>!ru.hasOwnProperty(k));
ruMissing.forEach(k=>{ru[k]=en[k]});
const ruSorted={};
Object.keys(ru).sort().forEach(k=>{ruSorted[k]=ru[k]});
fs.writeFileSync(base+'ru.json',JSON.stringify(ruSorted,null,2)+'\n');
console.log('ru.json:',Object.keys(ruSorted).length,'keys (was 1408, filled',ruMissing.length,'missing)');

// Verify
console.log('\n=== Final Verification ===');
const it2=JSON.parse(fs.readFileSync(base+'it.json','utf-8'));
const es2=JSON.parse(fs.readFileSync(base+'es.json','utf-8'));
const ru2=JSON.parse(fs.readFileSync(base+'ru.json','utf-8'));
console.log('it:',Object.keys(it2).length,'/ 1619');
console.log('es:',Object.keys(es2).length,'/ 1619');
console.log('ru:',Object.keys(ru2).length,'/ 1619');
