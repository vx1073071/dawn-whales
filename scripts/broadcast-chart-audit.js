const fs=require('fs');
const msg={
  id:'lobehub-chart-audit-'+Date.now(),
  from:'LOBEHUB',to:['pm'],
  ts:new Date().toISOString(),
  type:'AUDIT_REPORT',
  round:'R264',
  subject:'🔬 图表/指标/画线/个股详情全面审计 + 赚钱优化建议',
  body:`PM好，图表全线审计完成。

📊 审计范围: K线图表×技术指标×自动画线×个股详情页×指标面板×画线工具
🔍 代码审计: 37个文件全量检查
🌐 网络研究: 12次WebSearch, 竞品对标 TradingView/富途/Moomoo/Robinhood/eToro

📁 完整Markdown报告位置:
C:\\Users\\vx107\\.easyclaw\\workspace\\chat-bridge\\lobehub-chart-audit-r264.md

💡 怎么找到:
→ 复制上面路径
→ 打开文件资源管理器(Windows+E)
→ 粘贴到地址栏 → 回车
→ 或按Ctrl+F搜索 "lobehub-chart-audit-r264"

📈 核心发现:
- K线页全mock(致命) → 接YahooLive真实数据
- Volume Profile成交量分布(TradingView #1功能我们缺失) → $4.99/月订阅机会
- 指标AI解读: 空白市场, 预估$5,880/月
- 移动端K线: 420M零售交易者未触达
- 8条赚钱建议, P0→P2分三阶段

🦐 LOBEHUB`
};
const l=fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl','utf8').trim().split('\n');
l.push(JSON.stringify(msg));
fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',l.join('\n')+'\n','utf8');
console.log('Chart audit sent to pm');
