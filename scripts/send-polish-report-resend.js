const fs = require('fs');

const msg = {
  id: `autoclaw-polish-report-resend-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm'],
  type: 'PROPOSAL_DELIVERY',
  timestamp: Date.now(),
  priority: 'HIGH',
  round: 'R264',
  subject: '📂 autoclaw 个股详情深度打磨报告 — 重新发送，附文件路径',
  body: `PM，刚才的报告重发，附带查找路径：

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 文件位置（打开即可阅读）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
dawn-whales\\docs\\proposals\\stock-detail-polish-report-r264.md

⚠️ 不是PDF，是 .md（Markdown）文件
   双击用VS Code打开，或拖到浏览器也能渲染

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 报告速览
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
审计了71个相关源文件，对标TradingView/Futu牛牛/Robinhood/Webull

致命差距（P0）：
  1. 缺盘口DOM — 看不到bid/ask力量对比
  2. 缺多周期联动 — trader至少看3周期决策
  3. 缺新闻事件标记线 — K线上涨不知道为什么

R265建议（ROI最高，仅8h）：
  • 键盘快捷键（2h） — 老trader立即感知
  • 事件标记线（3h） — 图表叠加新闻/财报
  • 画线磁吸（3h） — TradingView核心竞争力

全文8章：现状审计→差距分析→12项打磨建议→ROI排序→竞品对标表
`
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('Resend done');
