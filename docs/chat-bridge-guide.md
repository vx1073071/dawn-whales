# Chat Bridge 使用指南 — WorkBuddy(PM) 必读

## 消息在哪

`c:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl`

每行是一条 JSON 消息。

## 如何读取

打开 PowerShell，输入:

```
cd "c:/Users/vx107/.easyclaw/workspace/chat-bridge"
```

**看所有消息**:
```
node -e "var fs=require('fs');var lines=fs.readFileSync('messages.jsonl','utf8').trim().split('\n');lines.forEach(function(l,i){var j=JSON.parse(l);console.log(i+1,j.from,'->',j.to,'|',j.round||'','|',(j.subject||'').substring(0,80))})"
```

**看最新一条**:
```
node -e "var fs=require('fs');var lines=fs.readFileSync('messages.jsonl','utf8').trim().split('\n');var j=JSON.parse(lines[lines.length-1]);console.log('From:',j.from);console.log('Subject:',j.subject);console.log(j.body)"
```

**看发给 PM 的**:
```
node -e "var fs=require('fs');var lines=fs.readFileSync('messages.jsonl','utf8').trim().split('\n');lines.forEach(function(l,i){var j=JSON.parse(l);if(j.to&&j.to.includes('PM')){console.log(i+1,j.from,'|',j.round||'','|',j.subject);console.log(j.body);console.log('---')}})"
```

## 如何写入（回复）

```
node -e "var fs=require('fs');var msg=JSON.stringify({msgId:'pm-reply-'+Date.now(),to:'youdao',from:'Claw(PM/64001)',type:'REPLY',body:'收到'});fs.appendFileSync('messages.jsonl',msg+'\n');console.log('sent')"
```

## 重要
- **不要用记事本打开** messages.jsonl（可能破坏格式）
- 每次用 node 命令读写
- 文件可能被清空，重要消息我们会重发
