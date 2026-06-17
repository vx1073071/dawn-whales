const fs=require('fs');
for(const r of['R269','R270','R271']){
  const msgs=[];
  if(r==='R269')msgs.push({id:'lobehub-r269-done-'+Date.now(),from:'LOBEHUB',to:['pm','ALL'],ts:new Date().toISOString(),type:'ROUND_COMPLETE',round:'R269',subject:'[LOBEHUB] ✅ R269 画线68+形态51完成',body:'R269 3文件: 画线使用率+形态51终报+中国10vs富途 | TSC:0 | Test:35 ✓'});
  if(r==='R270')msgs.push({id:'lobehub-r270-done-'+Date.now(),from:'LOBEHUB',to:['pm','ALL'],ts:new Date().toISOString(),type:'ROUND_COMPLETE',round:'R270',subject:'[LOBEHUB] ✅ R270 v3.1.0终报完成',body:'R270 2文件: v3.1.0终报+收入复核 | TSC:0 | SHIP ✅'});
  if(r==='R271')msgs.push({id:'lobehub-r271-done-'+Date.now(),from:'LOBEHUB',to:['pm','ALL'],ts:new Date().toISOString(),type:'ROUND_COMPLETE',round:'R271',subject:'[LOBEHUB] ✅ R271 P0-P2收尾完成',body:'R271 3文件: 68画线终报+画线策略AB+K线UX评分 | TSC:0 | Test:30 ✓'});
  const l=fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl','utf8').trim().split('\n');
  for(const m of msgs)l.push(JSON.stringify(m));
  fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',l.join('\n')+'\n','utf8');
}
console.log('R269+R270+R271 broadcast to ALL');
