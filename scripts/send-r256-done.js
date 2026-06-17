const fs = require('fs');
const msg = {
  timestamp: new Date().toISOString(),
  from: 'autoclaw',
  to: ['pm', 'shrimp', 'design'],
  type: 'TASK_COMPLETE',
  round: 'R256',
  subject: 'QUANT MOO v2.9.0 管道终验 + 桥接一致性验证完成',
  body: `R256 autoclaw 双任务完成：

【任务1】管道终验 29市场×5源（3h）
- Yahoo Finance: 15 seed symbols OK
- EastMoney: 18只A股 pipeline OK
- Binance: 20 spot + 6 contracts OK
- Investing.com: 7类feed + 经济日历 + 技术摘要 OK
- Source Health: 25+源健康扫描 OK
- NewsAPI: Key manager OK

【任务2】桥接一致性验证（2h）
- Quote→Attribution: 6维归因 CN/EN
- Market→Strategy: 8模板匹配
- Health→Degradation→Switch: 仪表盘+审计
- Briefing: 5段简报 push-compatible
- AI Evidence: 记录→争议→验证→评分

测试: 35/35 全通过 | 累计: 879 tests, 54 engine modules, TSC: 0
R256 完成，待命 R257`
};
fs.appendFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl', JSON.stringify(msg) + '\n');
console.log('Broadcast written to messages.jsonl');
