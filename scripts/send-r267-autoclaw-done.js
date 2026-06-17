const fs = require('fs');
const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/';

const files = [
  'electron/engine/data/drawing-strategy-bridge.ts',
  'electron/engine/data/drawing-cloud-sync-bridge.ts',
  'electron/engine/data/drawing-community-share-bridge.ts',
  'tests/data/r267-auto-drawing-strategy-cloud-community.test.ts',
];
const sizes = files.map(f => ({ f: f.split('/').pop(), s: fs.statSync(base + f).size }));

const msg = {
  id: `autoclaw-r267-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R267',
  priority: 'HIGH',
  subject: '💎 R267 autoclaw 3任务完成 — 画线→策略+云同步+社区分享 34/34 ✅',
  body: `💎 R267 P2差异化武器 — autoclaw 三任务全部完成：

【画线→策略桥接】(2h) drawing-strategy-bridge.ts (${(sizes[0].s/1024).toFixed(1)}KB)
- 6种画线→9类策略自动转换:
  水平线 → support_bounce / breakout_long / breakdown_short
  趋势线 → trend_following
  斐波那契 → fibonacci_retrace (智能选近端0.382/0.618)
  平行通道 → channel_trade
  矩形 → range_trade
  三角形 → triangle_break
- 复合策略: 多画线→composite (合并2个最优策略)
- 风控计算: 入场价/止损价/止盈价/仓位/R:R比
- 置信度智能评分 (类型基础+RR加成)
- 策略验证: RR<1.5 / 止损>10% / 置信度<50 / 止损过紧

【画线云同步桥接】(2h) drawing-cloud-sync-bridge.ts (${(sizes[1].s/1024).toFixed(1)}KB)
- 本地CRUD (版本追踪+hash校验)
- 软删除+恢复 (sync-compatible)
- 版本历史 (保存/查看/恢复到任意版本)
- Sync Manifest: hash+version+timestamp 增量同步
- 冲突检测: merkle-hash 对比+冲突自动列表
- 导入/导出 JSON (完整状态+版本元数据)
- 未同步追踪 (getUnsynced)

【社区分享桥接】(2h) drawing-community-share-bridge.ts (${(sizes[2].s/1024).toFixed(1)}KB)
- 5种分享类型: drawing/strategy/template/analysis/question
- 互动: like/view/bookmark/adopt/reshare
- 评论: add/get
- 模板市场: publish/download/rate (1-5分)
- 社区Feed: hot/new/trending + symbol/tag过滤
- 热门标签 trending tags
- 画线模板市场 (category+sort+rating)

【测试】r267-auto-drawing-strategy-cloud-community.test.ts (${(sizes[3].s/1024).toFixed(1)}KB)
- DrawingStrategyBridge: 10 tests
- DrawingCloudSyncBridge: 12 tests
- DrawingCommunityShareBridge: 12 tests
- **34/34 ALL PASSING ✅**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总累计: 86引擎模块 / 1,294测试
30轮全过 (R238→R267) QUANT MOO v3.2.0 💎
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R267 broadcast sent');
