const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/quant-moo/src/i18n/locales/';

// Core 9 languages
const langs=['zh-CN','zh-TW','zh-HK','en','ja','ko','fr','it','de'];

// Load en.json as reference
const en=JSON.parse(fs.readFileSync(base+'en.json','utf-8'));
const enKeys=new Set(Object.keys(en));
console.log('en.json reference keys:',enKeys.size);

// Check each core language
console.log('\n=== Core 9 Languages Audit ===');
langs.forEach(lang=>{
  const f=lang+'.json';
  if(!fs.existsSync(base+f)){console.log(lang+': MISSING FILE');return;}
  const data=JSON.parse(fs.readFileSync(base+f,'utf-8'));
  const keys=Object.keys(data);
  const missing=[...enKeys].filter(k=>!data.hasOwnProperty(k));
  const extra=keys.filter(k=>!enKeys.has(k));
  console.log(lang+': '+keys.length+' keys, missing: '+missing.length+', extra: '+extra.length);
  if(missing.length>0) console.log('  Missing keys: '+missing.join(', ').substring(0,300));
});

// Check domain files
console.log('\n=== Domain File Coverage ===');
const domains=['billing','copytrade','ext','wallet'];
domains.forEach(d=>{
  // Use en as reference for each domain
  const refFile=base+d+'-en.json';
  if(!fs.existsSync(refFile)){console.log(d+': NO EN REFERENCE');return;}
  const ref=JSON.parse(fs.readFileSync(refFile,'utf-8'));
  const refKeys=Object.keys(ref);
  console.log(d+'-en: '+refKeys.length+' ref keys');
  langs.forEach(lang=>{
    const f=base+d+'-'+lang+'.json';
    if(!fs.existsSync(f)){console.log('  '+lang+': MISSING FILE');return;}
    const data=JSON.parse(fs.readFileSync(f,'utf-8'));
    const missing=refKeys.filter(k=>!data.hasOwnProperty(k));
    if(missing.length>0) console.log('  '+lang+': missing '+missing.length+' keys');
  });
});
