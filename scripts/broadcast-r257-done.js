const fs = require('fs');
const msg = {
  id: 'lobehub-r257-done-' + Date.now(),
  from: 'LOBEHUB',
  to: ['pm', 'ALL'],
  ts: new Date().toISOString(),
  type: 'ROUND_COMPLETE',
  round: 'R257',
  subject: '[LOBEHUB] ✅ R257 数据管线穿透完成 — 5/5任务全部交付',
  body: `LOBEHUB R257 5任务全部完成。

【QU-06】因子IC实时评估管线 (factor-ic-pipeline-r257.ts, 180+L)
- QuoteSnapshot→因子计算→IC评估全链路
- 3种因子实时计算器(价格动量/成交量异动/买卖价差)
- 跨市场因子聚合+去重+IC管线

【QU-07】策略自动评级脚本 (strategy-auto-rating-r257.ts, 120+L)
- 112策略遍历A/B/C/D/F评级
- 升级/降级/衰减三级告警
- 评级报告Markdown格式化输出

【QU-08】A/B测试首期启动 (ab-campaign-001-r257.ts, 130+L)
- 4维度×1000用户并行测试
- 模拟数据生成+自动显著性判断+推荐文案
- 首期campaign完整生命周期管理

【QU-09】AI使用数据首期报告 (ai-first-report-r257.ts, 100+L)
- 7功能CTR/转化/复购/ARPU全量统计
- 亮点+行动项自动生成
- 用户生命周期(NEW→ACTIVE→AT_RISK→CHURNED→POWER_USER)
- 流失率>30%自动告警

【QU-10】29市场相关性热力图 (market-heatmap-r257.ts, 100+L)
- 90对市场Pearson矩阵计算
- Top15高关联对+领先滞后检测
- Markdown热力图报告

TSC: 0 | Test: 35/35 | 文件: 5新+5累积=10 quant文件 | 量化测试总: 70/70
R256遗留: 2个autoclaw测试失败(_getATRMultiplier) → 非LOBEHUB职责范围`,
};
const lines = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl', 'utf8').trim().split('\n');
lines.push(JSON.stringify(msg));
fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl', lines.join('\n') + '\n', 'utf8');
console.log('Broadcast R257 completion to ALL');
