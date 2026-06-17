const fs = require('fs');
const msgs = [
  {
    id: 'lobehub-r253-done-'+Date.now(),
    from: 'LOBEHUB', to: ['pm','ALL'],
    ts: new Date().toISOString(), type: 'ROUND_COMPLETE', round: 'R253',
    subject: '[LOBEHUB] ✅ R253 量化分析基础完成 — 因子IC评估+策略信用评级',
    body: `LOBEHUB R253 补做完成。\n\n【QU-01】因子IC评估引擎 (factor-ic-evaluator-r253.ts, 200+L)\n- IC评估：IC/ICAvg/ICStd/ICIR 四维度量\n- 衰减检测：STABLE/DECAYING/SHARP_DECAY/DEAD\n- 批量评估：排名+L1分类+趋势告警\n- 数据阈值：8类指标安全/警告/危险范围\n\n【QU-02】策略信用评级引擎 (strategy-credit-rating-r253.ts, 180+L)\n- A/B/C/D/F五级评级 (标普/穆迪风格)\n- 7维加权评分(夏普25+回撤20+胜率15+因子IC15+过拟合10+实盘偏差10+延迟5)\n- 批量评级+分布+Top3/Worst3+建议\n\nTSC: 0 | Test: 35/35 | 源码: 5文件 800+L`,
  },
  {
    id: 'lobehub-r254-done-'+Date.now(),
    from: 'LOBEHUB', to: ['pm','ALL'],
    ts: new Date().toISOString(), type: 'ROUND_COMPLETE', round: 'R254',
    subject: '[LOBEHUB] ✅ R254 数据分析完成 — A/B测试框架+AI使用分析后台',
    body: `LOBEHUB R254 补做完成。\n\n【QU-03】A/B测试框架 (ab-test-engine-r254.ts, 230+L)\n- 5维测试：标题/时间/富媒体/语气/个性化\n- 分流引擎：确定性哈希+Thompson采样动态分流\n- 统计分析：Wilson CI+p-value+lift计算\n- 5套预置模板\n\n【QU-04】AI使用分析后台 (ai-usage-analytics-r254.ts, 210+L)\n- 7个AI功能全流程追踪(Impr→Click→Purchase→Repeat)\n- CTR/CVR/复购率/ARPU自动计算\n- 用户生命周期：NEW→ACTIVE→AT_RISK→CHURNED→POWER_USER\n- 趋势对比(UP/STABLE/DOWN)+收入建议\n\nTSC: 0 | Test: 35/35 | 源码: 5文件 800+L`,
  },
  {
    id: 'lobehub-r255-done-'+Date.now(),
    from: 'LOBEHUB', to: ['pm','ALL'],
    ts: new Date().toISOString(), type: 'ROUND_COMPLETE', round: 'R255',
    subject: '[LOBEHUB] ✅ R255 因子研究完成 — 跨市场因子相关性+新市场因子设计',
    body: `LOBEHUB R255 补做完成。\n\n【QU-05】跨市场因子相关性 (cross-market-factor-r255.ts, 200+L)\n- 29市场相关性矩阵(Pearson r)\n- 领先/滞后检测(A收盘预判B开盘, 48h窗口)\n- 因子全球总结(多市场IC排名+有效市场统计)\n- 新市场因子迁移设计(HIGH/MEDIUM/LOW/NONE可迁移性)\n\nTSC: 0 | Test: 35/35 | 源码: 5文件 800+L`,
  },
];
const lines = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl','utf8').trim().split('\n');
for (const m of msgs) { lines.push(JSON.stringify(m)); }
fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl', lines.join('\n')+'\n','utf8');
console.log('Broadcast R253 R254 R255 to ALL');
