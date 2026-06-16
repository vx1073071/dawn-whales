const {execSync}=require('child_process');
const findstr='findstr /s /m @ts-nocheck server\\*.ts server\\*\\*.ts server\\*\\*\\*.ts';
try{
  const o=execSync(findstr,{cwd:'c:/Users/vx107/.easyclaw/workspace/quant-moo',shell:'cmd.exe',encoding:'utf-8'});
  const files=o.trim().split(/\r?\n/).filter(Boolean);
  console.log('Server @ts-nocheck files:',files.length);
  files.sort().forEach(f=>console.log(f));
}catch(e){
  // findstr returns non-zero on empty results
  if(e.stdout) {
    const files=e.stdout.trim().split(/\r?\n/).filter(Boolean);
    console.log('Server @ts-nocheck files:',files.length);
    files.sort().forEach(f=>console.log(f));
  } else if(e.stderr) {
    console.log('stderr:',e.stderr);
  } else {
    console.log('No @ts-nocheck files found in server/');
  }
}
