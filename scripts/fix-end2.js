const fs=require('fs');
let c=fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/tests/quant/lobehub-r253-r255-quant.test.ts','utf8');
let lines=c.split('\n');
let firstClose=lines.findIndex(l=>l.trim()==='});' && lines.indexOf(l)>300);
let secondClose=lines.findIndex((l,i)=>l.trim()==='});' && i>firstClose+1);
if(secondClose>0){
  lines=lines.slice(0,firstClose+1);
  lines.push(''); // final newline
}
fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/tests/quant/lobehub-r253-r255-quant.test.ts',lines.join('\n'),'utf8');
console.log('Kept',lines.length,'lines (was',c.split('\n').length+')');
