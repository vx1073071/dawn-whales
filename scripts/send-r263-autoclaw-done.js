const fs = require('fs');
const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/';

const files = [
  'electron/engine/data/pipeline-integration-verify.ts',
  'electron/engine/data/broker-detector-integration.ts',
  'electron/engine/data/pipeline-load-test.ts',
  'tests/data/r263-auto-integration-broker-load.test.ts',
];
const sizes = files.map(f => ({ f: f.split('/').pop(), s: fs.statSync(base + f).size }));

const msg = {
  id: `autoclaw-r263-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp', 'design'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R263',
  priority: 'HIGH',
  subject: '🔌 R263 autoclaw 3任务完成 — 管线集成+broker集成+压测 31/31 ✅',
  body: `🔌 R263 去mock+核心体验 — autoclaw 三任务全部完成：

【管线接线集成+验证】(4h) pipeline-integration-verify.ts (${(sizes[0].s/1024).toFixed(1)}KB)
- 16节点全注册 (YahooLive/BinanceLive/EastMoney→Pipeline→Agg→Dedup→Alert→Push→Tray)
- 15检查点逐条验证+延迟追踪
- 实时数据流模拟 YahooLive→IPC 全链路
- 降级链自动切换测试 (Yahoo→EastMoney) + 恢复
- 集成报告中英文输出

【broker-detector集成】(3h) broker-detector-integration.ts (${(sizes[1].s/1024).toFixed(1)}KB)
- 7券商适配器注册 (YahooWS/BinanceWS/FutuSDK/EastMoney/IB/Webull/TD)
- 适配器启用/禁用开关
- 最优broker自动检测（延迟最低原则）
- 主broker断开→自动切换 (disconnection/latency/manual/degradation)
- 订阅数追踪+报价统计
- 集成状态报告中英文输出

【管线性能压测】(2h) pipeline-load-test.ts (${(sizes[2].s/1024).toFixed(1)}KB)
- 100只同时订阅压测引擎
- 令牌桶背压控制 (容量/填充率/阻塞数)
- 延迟分布: P50/P75/P90/P95/P99/max/min/avg
- 降级链自动触发 (5次连续错误→降级+冷却10s)
- 每秒吞吐量 (tps) + 成功率
- quickTest(30只) + stressTest(200只) 模式
- 中英文压测报告+优化建议

【测试】r263-auto-integration-broker-load.test.ts (${(sizes[3].s/1024).toFixed(1)}KB)
- PipelineIntegrationVerify: 9 tests
- BrokerDetectorIntegration: 12 tests
- PipelineLoadTest: 10 tests
- **31/31 ALL PASSING 🥇 一次通过！**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
R257-R263 全7轮累计:
  R257: 3模块 53测试
  R258: 3模块 44测试
  R259: 3模块 39测试
  R260: 3模块 40测试
  R261: 3模块 38测试
  R262: 3模块 37测试
  R263: 3模块 31测试
  ─────────────────────
  ∑ 21模块 / 282测试 / 64h / TSC=0

总累计: 75引擎模块 / 1,161测试
26轮全过 (R238→R263) 🐮
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R263 broadcast sent');
