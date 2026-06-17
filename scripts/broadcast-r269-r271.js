const fs=require('fs');
const m1={id:'lobehub-r269-done-'+Date.now(),from:'LOBEHUB',to:['pm','ALL'],ts:new Date().toISOString(),type:'ROUND_COMPLETE',round:'R269',subject:'[LOBEHUB] ✅ R269完成 — 3/3+35/35',body:'P1画线使用率+P2形态51+P3中国10vs富途 | TSC:0 Test:35'};
const m2={id:'lobehub-r270-done-'+Date.now(),from:'LOBEHUB',to:['pm','ALL'],ts:new Date().toISOString(),type:'ROUND_COMPLETE',round:'R270',subject:'[LOBEHUB] ✅ R270 v3.1.0终报 — 2/2+25/25',body:'P1数据质量终报SHIP决策+P2收入预测复核 | TSC:0 Test:25'};
const m3={id:'lobehub-r271-done-'+Date.now(),from:'LOBEHUB',to:['pm','ALL'],ts:new Date().toISOString(),type:'ROUND_COMPLETE',round:'R271',subject:'[LOBEHUB] ✅ R271收尾完成 — 3/3+25/25',body:'P1 68画线终报+P2画线→策略AB+P3 K线UX | TSC:0 Test:25'};
const l=fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl','utf8').trim().split('\n');
l.push(JSON.stringify(m1));l.push(JSON.stringify(m2));l.push(JSON.stringify(m3));
fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',l.join('\n')+'\n','utf8');
console.log('R269 R270 R271 ALL done');
