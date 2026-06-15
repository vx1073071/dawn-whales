const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/dawn-whales/electron/engine/factors/';

// Read factor-id-registry.ts and extract all F_XXX IDs
const registry=fs.readFileSync(base+'factor-id-registry.ts','utf-8');
const regIds=new Set();
const regMatches=registry.matchAll(/['"]?(F_[A-Z0-9_]+)['"]?\s*[:=]/g);
for(const m of regMatches)regIds.add(m[1]);
console.log('Registry factor IDs:',regIds.size);

// Read factor-i18n-map.ts  
const i18n=fs.readFileSync(base+'factor-i18n-map.ts','utf-8');
const i18nIds=new Set();
const i18nMatches=i18n.matchAll(/['"]?(F_[A-Z0-9_]+)['"]?\s*:/g);
for(const m of i18nMatches)i18nIds.add(m[1]);
console.log('i18n-map factor IDs:',i18nIds.size);

// Ghosts: in i18n but NOT in registry
const ghosts=[...i18nIds].filter(id=>!regIds.has(id));
console.log('Ghosts (i18n but not registry):',ghosts.length);

// Missing i18n: in registry but NOT in i18n
const missing=[...regIds].filter(id=>!i18nIds.has(id));
console.log('Missing i18n (registry but not i18n):',missing.length);
if(missing.length<50){
  console.log('Missing IDs:',missing.join(', '));
}

// Check which have translations
console.log('\n=== I18n translation coverage ===');
// Look at the factor-i18n-map entries that DO exist in registry
// Count those with zh/en translations
