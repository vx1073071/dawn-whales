const fs=require('fs');
const c=fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl','utf8');
const lines=c.trim().split('\n').filter(l=>l.trim());
// R272
for(let i=lines.length-1;i>=0;i--){
  try{const j=JSON.parse(lines[i]);if(j.round==='R272'&&j.from==='pm'){console.log('=== R272 ===');console.log(JSON.stringify(j,null,2));break}}catch(e){}
}
console.log('\n---\n');
// R273
for(let i=lines.length-1;i>=0;i--){
  try{const j=JSON.parse(lines[i]);if(j.round==='R273'&&j.from==='pm'){console.log('=== R273 ===');console.log(JSON.stringify(j,null,2));break}}catch(e){}
}
