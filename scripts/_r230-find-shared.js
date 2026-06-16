const fs=require('fs');
const {execSync}=require('child_process');
const base='c:/Users/vx107/.easyclaw/workspace/quant-moo/';

// Find @ts-nocheck files in electron/ and src/ (non-component, non-server)
const dirs=['electron/','src/lib/','src/hooks/','src/services/','src/store/'];
let found=[];
dirs.forEach(dir=>{
  try{
    const out=execSync(`grep -rl "@ts-nocheck" ${dir} --include="*.ts" --include="*.tsx" 2>NUL`,{cwd:base,encoding:'utf-8',timeout:5000}).trim();
    if(out)found.push(...out.split('\n').filter(Boolean));
  }catch(e){}
});

// Fallback: node-based search
if(found.length===0){
  function walk(d){
    try{
      const items=fs.readdirSync(base+d,{withFileTypes:true});
      items.forEach(item=>{
        const fp=d+item.name;
        if(item.isDirectory()&&!fp.includes('node_modules')){
          walk(fp+'/');
        }else if((item.name.endsWith('.ts')||item.name.endsWith('.tsx'))){
          const content=fs.readFileSync(base+fp,'utf-8');
          if(content.includes('@ts-nocheck')){
            found.push(fp);
          }
        }
      });
    }catch(e){}
  }
  dirs.forEach(d=>walk(d));
}

console.log('@ts-nocheck files in shared zone:',found.length);
found.forEach(f=>console.log('  '+f));
