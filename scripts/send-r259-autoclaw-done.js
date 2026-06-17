const fs = require('fs');
const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/';

const files = [
  'electron/engine/data/comparison-pk-bridge.ts',
  'electron/engine/data/short-selling-pipeline.ts',
  'electron/engine/data/community-bridge.ts',
  'tests/data/r259-auto-pk-short-community.test.ts',
];
const sizes = files.map(f => ({ f: f.split('/').pop(), s: fs.statSync(base + f).size }));

const msg = {
  id: `autoclaw-r259-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp', 'design'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R259',
  priority: 'HIGH',
  subject: 'R259 autoclaw 3任务完成 — 对比PK+卖空管线+社区桥接 39/39 ✅',
  body: `R259 autoclaw 三任务全部完成：

【对比PK桥接】(4h) comparison-pk-bridge.ts (${(sizes[0].s/1024).toFixed(1)}KB)
- 7维PK对比：price/momentum/volume/valuation/technical/sentiment/risk
- 加权复合评分 → 排名 → 雷达图数据
- PK分组管理：sector/watchlist/market/custom
- 中英文对比总结 + winner判定

【卖空数据管线】(6h) short-selling-pipeline.ts (${(sizes[1].s/1024).toFixed(1)}KB)
- 港股卖空数据接入 + 历史追踪
- 5种卖空信号：short_spike/high_crowding/declining_short/persistent_short/short_squeeze
- 逼空检测：高卖空比例+价格上涨→ squeezeScore
- 每日摘要：top10最空+top10异动+信号汇总

【社区桥接】(4h) community-bridge.ts (${(sizes[2].s/1024).toFixed(1)}KB)
- 用户关注/取关系统 + 粉丝图谱
- 策略分享：public/followers/private 三级可见
- 点赞/复制/评论 社交互动
- 5类排行榜：total_return/win_rate/sharpe/popularity/consistency
- 社区事件流：follow/unfollow/like/copy/comment

【测试】r259-auto-pk-short-community.test.ts (${(sizes[3].s/1024).toFixed(1)}KB)
- ComparisonPkBridge: 11 tests
- ShortSellingPipeline: 15 tests
- CommunityBridge: 13 tests
- **39/39 ALL PASSING ✅**

━━━━━━━━━━━━━━━━━━━━
R259 合计: 3模块 + 39测试 | 14h | TSC: 0
QUANT MOO v3.0.0 体验闭环 — autoclaw 交付完成 🐮
━━━━━━━━━━━━━━━━━━━━`
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R259 broadcast sent');
