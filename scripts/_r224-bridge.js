const fs=require('fs');
const base='c:/Users/vx107/.easyclaw/workspace/quant-moo/src/lib/bridge-api/';

const files=['app.ts','data.ts','risk.ts','trade.ts'];

files.forEach(f=>{
  let c=fs.readFileSync(base+f,'utf-8');
  
  // Check if already has the api cast
  if(c.includes('const api = (window as any).api')) {
    console.log(f+': already patched');
    return;
  }
  
  // Replace all window.api.xxx with api.xxx
  c=c.replace(/window\.api\./g, 'api.');
  
  // Replace all window.api with api (for bare references)
  c=c.replace(/window\.api\b/g, 'api');
  
  // Add the cast line after the last import (before any code)
  const lastImport=c.lastIndexOf('import ');
  const endOfLastImport=c.indexOf('\n',c.lastIndexOf('from',lastImport))+1;
  c=c.substring(0,endOfLastImport)+'\n// R224: Bridge IPC types are approximate — cast through any at boundary\nconst api = (window as any).api;\nif (!api) {/* not in Electron */}\n'+c.substring(endOfLastImport);
  
  fs.writeFileSync(base+f,c);
  console.log(f+': patched');
});
