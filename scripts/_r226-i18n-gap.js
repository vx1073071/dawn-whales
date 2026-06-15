const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/dawn-whales/electron/engine/factors/';

// Extract all factor IDs from registry (4th column in map entries)
const registry=fs.readFileSync(base+'factor-id-registry.ts','utf-8');
const regEntries=[];
const regex=/\[['"]([\w_]+)['"],\s*['"]([\w_]+)['"],\s*['"]([^'"]+)['"],\s*['"]([\w_]+)['"],\s*['"](\w+)['"]\]/g;
let m;
while((m=regex.exec(registry))!==null){
  regEntries.push({
    id:m[1],
    engName:m[2],
    zhName:m[3],
    l1:m[4],
    l2:m[5]
  });
}
console.log('Registry factor IDs:',regEntries.length);

// Extract all factor IDs from i18n-map
const i18nMap=fs.readFileSync(base+'factor-i18n-map.ts','utf-8');
const i18nEntries={};
const i18nRegex=/(\w+)\s*:\s*\{[^}]*name:\s*['"]([^'"]+)['"][^}]*short:\s*['"]([^'"]+)['"][^}]*\}/g;
while((m=i18nRegex.exec(i18nMap))!==null){
  i18nEntries[m[1]]={name:m[2],short:m[3]};
}
console.log('i18n-map entries:',Object.keys(i18nEntries).length);

// Ghost IDs: in i18n but NOT in registry
const regIdSet=new Set(regEntries.map(e=>e.id));
const i18nIdSet=new Set(Object.keys(i18nEntries));
const ghosts=[...i18nIdSet].filter(id=>!regIdSet.has(id));
console.log('Ghosts (i18n not in registry):',ghosts.length);

// Missing i18n: in registry but NOT in i18n
const missing=regEntries.filter(e=>!i18nIdSet.has(e.id));
console.log('Missing i18n (registry not in i18n):',missing.length);
console.log('\nMissing factor IDs:');
missing.forEach(m=>console.log('  '+m.id+' = '+m.zhName+' ('+m.engName+')'));

// Write missing to file for processing
fs.writeFileSync(
  base+'factor-i18n-missing.json',
  JSON.stringify(missing.map(m=>({id:m.id,engName:m.engName,zhName:m.zhName})),null,2)
);
console.log('\nWritten factor-i18n-missing.json');
