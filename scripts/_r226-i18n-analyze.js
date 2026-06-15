const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/dawn-whales/electron/engine/factors/';

// Read registry for Chinese/English names
const registry=fs.readFileSync(base+'factor-id-registry.ts','utf-8');
const regMap={};
const regex=/\[['"]([\w_]+)['"],\s*['"]([\w_]+)['"],\s*['"]([^'"]+)['"],\s*['"]([\w_]+)['"],\s*['"](\w+)['"]\]/g;
let m;
while((m=regex.exec(registry))!==null){
  regMap[m[1]]={engName:m[2],zhName:m[3],l1:m[4],l2:m[5]};
}
console.log('Registry entries:',Object.keys(regMap).length);

// Read i18n-map
const i18n=fs.readFileSync(base+'factor-i18n-map.ts','utf-8');

// Count existing i18n entries that match registry
let existingCount=0,ghostCount=0;
for(const id of Object.keys(regMap)){
  if(i18n.includes(`factorId: '${id}'`)) existingCount++;
}
console.log('Existing registry factors with i18n:',existingCount);
console.log('Missing i18n:',240-existingCount);

// Count ghost entries (in i18n but not registry)
const i18nIds=i18n.match(/factorId:\s*'(\w+)'/g)||[];
const allI18nIds=i18nIds.map(m=>m.match(/'(\w+)'/)[1]);
allI18nIds.forEach(id=>{if(!regMap[id])ghostCount++});
console.log('Ghost entries (i18n not in registry):',ghostCount);
console.log('Total i18n entries:',allI18nIds.length);

// List ghost IDs
const ghosts=allI18nIds.filter(id=>!regMap[id]);
console.log('\nGhost factorIds:',ghosts.slice(0,20).join(', '),ghosts.length>20?'...':'');
