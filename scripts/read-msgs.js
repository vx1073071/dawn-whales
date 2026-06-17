const fs = require('fs');
const c = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl', 'utf8');
const lines = c.trim().split('\n');
const recent = lines.slice(-30);
recent.forEach(function(l, i) {
  try {
    const j = JSON.parse(l);
    console.log((lines.length - 30 + i) + ': from=' + j.from + ' type=' + j.type + ' round=' + j.round + ' subject=' + (j.subject || '').substring(0, 80));
  } catch (e) {
    console.log((lines.length - 30 + i) + ': RAW ' + l.substring(0, 100));
  }
});
