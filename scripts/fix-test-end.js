const fs=require('fs');
let c=fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/tests/quant/lobehub-r253-r255-quant.test.ts','utf8');
// Keep only up to first occurrence of \n}); that ends the test file properly
let idx=c.indexOf('\n});\n},');
if(idx<0) idx=c.indexOf('\n});\n    ];');
if(idx>=0) {
  c=c.substring(0,idx+4)+'\n';
  fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/tests/quant/lobehub-r253-r255-quant.test.ts',c,'utf8');
  console.log('Fixed to',c.length,'chars');
} else {
  console.log('Pattern not found, lines:',c.split('\n').length);
}
