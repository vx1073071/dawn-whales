const fs = require('fs');
const msg = {
  id: 'lobehub-market-audit-20260617-0545',
  from: 'LOBEHUB',
  to: ['pm'],
  ts: new Date().toISOString(),
  type: 'AUDIT_REPORT',
  round: 'R256',
  subject: '🔬 行情系统全面审计 + 赚钱优化建议（12次搜索/8页深度/14引用）',
  body: `[LobeHUB] QUANT MOO行情系统独立审计完成。

📊 竞品对标：Robinhood($1B Q1)/eToro($258M)/Webull($571M) vs 我们($0)
🧠 行为经济学研究：9个UX模式→推送CTR 4-8%，个性化+40%，富媒体+56%
🔧 代码审计：1390行AI文案 TSC=0 ✅ | 缺失：实时行情管线/推送引擎/AB测试/数据后台
💰 赚钱优化：4推+4价+5建 = 月收预估$1,734→$12,000(8周路线图)

完整md报告：C:\\Users\\vx107\\.easyclaw\\workspace\\chat-bridge\\lobehub-market-audit-r256.md

等待PM批示。🦐`
};
const lines = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl', 'utf8').trim().split('\n');
lines.push(JSON.stringify(msg));
fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl', lines.join('\n') + '\n', 'utf8');
console.log('BROADCAST to pm');
