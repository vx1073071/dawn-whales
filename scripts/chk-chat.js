const fs = require('fs');
const msgs = fs.readFileSync('c:\\Users\\vx107\\.easyclaw\\workspace\\chat-bridge\\messages.jsonl','utf-8').split('\n').filter(l=>l.trim());
const r216 = msgs.filter(l=>l.includes('R216'));
const last5 = msgs.slice(-5);
fs.writeFileSync('c:\\Users\\vx107\\.easyclaw\\workspace\\dawn-whales\\.tmp-chat-check.json', JSON.stringify({r216_count: r216.length, r216_lines: r216, last5_lines: last5}, null, 2), 'utf-8');
console.log('OK', r216.length, 'R216 messages');
