const {execSync}=require('child_process');
const base='c:/Users/vx107/.easyclaw/workspace/dawn-whales';

// Find ALL @ts-nocheck files across the project
const findstr='findstr /s /m @ts-nocheck *.ts *.tsx 2>nul';
try{
  const o=execSync(findstr,{cwd:base,shell:'cmd.exe',encoding:'utf-8'});
  const files=o.trim().split(/\r?\n/).filter(Boolean);
  console.log('Total @ts-nocheck files:',files.length);
  
  // Categorize
  const categories={server:[],electron:[],src_comps:[],src_other:[],scripts:[],other:[]};
  files.forEach(f=>{
    if(f.includes('server'+require('path').sep)) categories.server.push(f);
    else if(f.includes('electron'+require('path').sep)) categories.electron.push(f);
    else if(f.includes('src'+require('path').sep+'components'+require('path').sep)) categories.src_comps.push(f);
    else if(f.includes('src'+require('path').sep)) categories.src_other.push(f);
    else if(f.includes('scripts'+require('path').sep)) categories.scripts.push(f);
    else categories.other.push(f);
  });
  
  for(const [cat,list] of Object.entries(categories)) {
    console.log('\n=== '+cat+' ('+list.length+') ===');
    list.sort().forEach(f=>console.log('  '+require('path').normalize(f)));
  }
}catch(e){
  if(e.stdout) {
    const files=e.stdout.trim().split(/\r?\n/).filter(Boolean);
    console.log('Total @ts-nocheck files:',files.length);
  } else {
    console.log('Error/no results');
  }
}
