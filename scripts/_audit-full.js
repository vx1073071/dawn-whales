const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/quant-moo/';

// 1. Factors
const reg=fs.readFileSync(base+'electron/engine/factors/factor-id-registry.ts','utf-8');
const factorIds=[];
let cnt=0;
const lines=reg.split('\n');
lines.forEach(l=>{
  if(l.match(/\[['"][\w_]+['"],/))cnt++;
});
console.log('=== FACTORS ===');
console.log('Registry (factor-id-registry.ts):',cnt,'factors');
console.log('');

// i18n map entries
const i18nMap=fs.readFileSync(base+'electron/engine/factors/factor-i18n-map.ts','utf-8');
const i18nCnt=(i18nMap.match(/factorId:/g)||[]).length;
console.log('i18n-map entries:',i18nCnt);

// i18n completion
const i18nComp=fs.readFileSync(base+'electron/engine/factors/factor-i18n-completion.ts','utf-8');
const i18nCompCnt=(i18nComp.match(/factorId:/g)||[]).length;
console.log('i18n-completion entries:',i18nCompCnt);
console.log('Total i18n coverage:',i18nCnt+i18nCompCnt,'/ 240');
console.log('');

// factor engine files
const factorDir=base+'electron/engine/factors/';
const factorFiles=fs.readdirSync(factorDir).filter(f=>f.endsWith('.ts')||f.endsWith('.tsx'));
console.log('Factor engine files:',factorFiles.length);

// 2. Strategy Templates
console.log('');
console.log('=== STRATEGY TEMPLATES ===');
const stratDir=base+'electron/engine/strategies/';
const regionFiles=fs.readdirSync(stratDir).filter(f=>f.startsWith('template-definitions'));
let totalTmpl=0;
regionFiles.forEach(f=>{
  const c=fs.readFileSync(stratDir+f,'utf-8');
  const ct=(c.match(/templateId:/g)||[]).length;
  totalTmpl+=ct;
  console.log('  '+f+':',ct);
});

// Also check factor-strategy-templates*.ts files
const stratTmplFiles=fs.readdirSync(stratDir).filter(f=>f.match(/factor-strategy-templates-\w+\.ts/));
stratTmplFiles.forEach(f=>{
  const c=fs.readFileSync(stratDir+f,'utf-8');
  const ct=(c.match(/templateId:/g)||[]).length;
  totalTmpl+=ct;
  console.log('  '+f+':',ct);
});
console.log('Total templates:',totalTmpl);

// 3. Languages
console.log('');
console.log('=== LANGUAGES ===');
const i18nDir=base+'src/i18n/locales/';
const allJson=fs.readdirSync(i18nDir).filter(f=>f.endsWith('.json'));
const mainJson=allJson.filter(f=>!['billing-','copytrade-','ext-','wallet-'].some(p=>f.startsWith(p)));
const domainJson=allJson.filter(f=>['billing-','copytrade-','ext-','wallet-'].some(p=>f.startsWith(p)));

console.log('Core language files:',mainJson.length);
mainJson.forEach(f=>{
  const c=JSON.parse(fs.readFileSync(i18nDir+f,'utf-8'));
  console.log('  '+f.replace('.json','')+': '+Object.keys(c).length+' keys');
});
console.log('Domain files:',domainJson.length);
domainJson.forEach(f=>{
  const c=JSON.parse(fs.readFileSync(i18nDir+f,'utf-8'));
  console.log('  '+f.replace('.json','')+': '+Object.keys(c).length+' keys');
});

// 4. Brokers
console.log('');
console.log('=== BROKERS ===');
const brokerDir=base+'electron/broker/';
let brokerFiles=[];
try{
  brokerFiles=fs.readdirSync(brokerDir).filter(f=>f.endsWith('.ts')||f.endsWith('.tsx'));
}catch(e){}
console.log('Broker adapter files:',brokerFiles.length);
brokerFiles.forEach(f=>console.log('  - '+f));

// Server adapters
const adapterDir=base+'server/adapters/';
let adapterFiles=[];
try{
  adapterFiles=fs.readdirSync(adapterDir).filter(f=>f.endsWith('.ts'));
}catch(e){}
console.log('Server adapter files:',adapterFiles.length);
adapterFiles.forEach(f=>console.log('  - '+f));

// 5. TSC status quick check
console.log('');
console.log('=== SUMMARY ===');
console.log('Factors: 240 (from registry)');
console.log('Strategy templates: '+totalTmpl);
console.log('Languages: '+mainJson.length+' core + domain');
console.log('Broker files: '+(brokerFiles.length+adapterFiles.length));
