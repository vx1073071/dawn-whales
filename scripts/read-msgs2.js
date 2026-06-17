const fs=require('fs');
const c=fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl','utf8');
const lines=c.trim().split('\n').filter(l=>l.trim());
console.log('Total:',lines.length);
// Last 15
for(let i=Math.max(0,lines.length-15);i<lines.length;i++){
  try{const j=JSON.parse(lines[i]);console.log(i+': from='+j.from+' type='+j.type+' round='+j.round+' subject='+(j.subject||'').substring(0,80))}catch(e){console.log(i+': RAW '+lines[i].substring(0,100))}
}
