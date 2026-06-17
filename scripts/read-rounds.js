const fs = require('fs');
const c = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl', 'utf8');
const lines = c.trim().split('\n');
// Get R253-R255 PM start messages
for (let i = lines.length - 1; i >= 0; i--) {
  try {
    const j = JSON.parse(lines[i]);
    if (j.from === 'pm' && (j.round === 'R253' || j.round === 'R254' || j.round === 'R255')) {
      console.log('LINE ' + i + ' ROUND=' + j.round + ' TYPE=' + j.type);
      console.log('SUBJECT:', j.subject);
      console.log('BODY:', (j.body || '').substring(0, 500));
      console.log('---');
    }
  } catch (e) {}
}
// Also get all round completions for these rounds
console.log('\n=== COMPLETIONS ===');
for (let i = lines.length - 1; i >= 0; i--) {
  try {
    const j = JSON.parse(lines[i]);
    if (j.round === 'R253' || j.round === 'R254' || j.round === 'R255') {
      console.log('LINE ' + i + ': from=' + j.from + ' round=' + j.round + ' subject=' + (j.subject || '').substring(0, 100));
    }
  } catch (e) {}
}
