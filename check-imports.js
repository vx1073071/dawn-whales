const fs=require('fs');
const d='C:/Users/vx107/.easyclaw/workspace/dawn-whales/electron/engine/strategies';
fs.readdirSync(d).filter(f=>f.endsWith('.ts')).forEach(f=>{
  const c=fs.readFileSync(d+'/'+f,'utf8');
  const im=c.match(/from\s+['"][^'"]+['"]/g);
  if(im&&im.some(i=>/factor/i.test(i))){
    const factorImports=im.filter(i=>/factor/i.test(i));
    console.log(f.padEnd(50)+factorImports.join(', ').slice(0,250));
  }
});
