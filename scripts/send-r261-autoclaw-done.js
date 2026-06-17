const fs = require('fs');
const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/';

const files = [
  'electron/engine/data/pipeline-wiring-bridge.ts',
  'electron/engine/data/broker-quote-priority-detector.ts',
  'electron/engine/data/crash-alert-wiring.ts',
  'tests/data/r261-auto-wiring-broker-crash.test.ts',
];
const sizes = files.map(f => ({ f: f.split('/').pop(), s: fs.statSync(base + f).size }));

const msg = {
  id: `autoclaw-r261-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp', 'design'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R261',
  priority: 'HIGH',
  subject: '🔌 R261 autoclaw 3任务完成 — 去mock管线接线 38/38 ✅',
  body: `🔌 R261 去mock+真实数据流 — autoclaw 三任务全部完成：

【P0-02 管线接线】(6h) pipeline-wiring-bridge.ts (${(sizes[0].s/1024).toFixed(1)}KB)
- Yahoo→Agg→Dedup→Alert→Push→IPC 6层16节点全拓扑
- 15个接线检查点逐条验证
- 数据包路由：BFS最短路径，自动延迟追踪
- 节点健康监控 + 降级状态标记
- 中英文接线报告

【broker-quote-priority真实检测】(2h) broker-quote-priority-detector.ts (${(sizes[1].s/1024).toFixed(1)}KB)
- 10家券商适配器检测 (Yahoo/IB/Futu/Tiger/Webull/Moomoo/Robinhood/TD/EastMoney/Binance)
- 多券商报价聚合：最优bid/ask + 成交量加权共识价
- 4种优选策略：最低延迟/最优价/最高频/综合评分
- 5维优先级评分 (延迟35% + 连接类型15% + 报单频20% + 市场覆盖10% + 在线率20%)
- 券商健康：online/degraded/offline/no_quotes

【crash-push-bridge接线】(2h) crash-alert-wiring.ts (${(sizes[2].s/1024).toFixed(1)}KB)
- AlertPushEngine→CrashPushBridge→PushIpcBridge→DesktopNotification 3层接线
- 5级崩盘检测：watch(-3%)/alert(-5%)/critical(-10%)/emergency(-15%)/armageddon(-25%)
- 全链路processTick：监控→检测→推送 (1次调用)
- V型反转检测 (50%回补即判定恢复)
- 中英文接线报告

【测试】r261-auto-wiring-broker-crash.test.ts (${(sizes[3].s/1024).toFixed(1)}KB)
- PipelineWiringBridge: 12 tests
- BrokerQuotePriorityDetector: 13 tests
- CrashAlertWiring: 13 tests
- **38/38 ALL PASSING ✅**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
R257-R261 累计: 15模块 + 214测试
总累计: 69引擎模块 + 1,093测试
TSC: 0 | 24轮全过 (R238→R261)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R261 broadcast sent');
