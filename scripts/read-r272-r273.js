const fs=require('fs');
const c=fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl','utf8');
const lines=c.trim().split('\n').filter(l=>l.trim());
for(let i=lines.length-1;i>=0;i--){
  try{const j=JSON.parse(lines[i]);if(j.round==='R272'&&j.from==='pm'){console.log('R272:',j.subject);console.log(j.body.substring(0,500));break}}catch(e){}
}
for(let i=lines.length-1;i>=0;i--){
  try{const j=JSON.parse(lines[i]);if(j.round==='R273'&&j.from==='pm'){console.log('R273:',j.subject);console.log(j.body.substring(0,500));break}}catch(e){}
}
