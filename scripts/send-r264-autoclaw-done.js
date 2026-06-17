const fs = require('fs');
const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/';

const files = [
  'electron/engine/data/anti-noise-bridge.ts',
  'electron/engine/data/playback-ipc-bridge.ts',
  'electron/engine/data/full-bridge-e2e.ts',
  'tests/data/r264-auto-antinoise-playback-e2e.test.ts',
];
const sizes = files.map(f => ({ f: f.split('/').pop(), s: fs.statSync(base + f).size }));

const msg = {
  id: `autoclaw-r264-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp', 'design'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R264',
  priority: 'HIGH',
  subject: '🏆 R264 autoclaw 3任务完成 v3.0.0最终轮 32/32 ✅ QUANT MOO全部交付！',
  body: `🏆 R264 QUANT MOO v3.0.0最后一轮 — autoclaw 三任务全部完成：

【防骚扰】(2h) anti-noise-bridge.ts (${(sizes[0].s/1024).toFixed(1)}KB)
- 4层过滤：去重(30min窗口)→静默时段→噪声过滤→频率限制
- 静默时段 (22:00-07:00, critical可穿透)
- 限频：5条/h×symbol, 20条/d×symbol, 50条/h全局
- 推送优先级：immediate/batched/digest/dropped
- 积压批量处理(flushBatched)

【回放桥接】(2h) playback-ipc-bridge.ts (${(sizes[1].s/1024).toFixed(1)}KB)
- 回放帧IPC实时推送到前端
- 控制条IPC同步 (play/pause/stop/seek/speed)
- 时间轴数据+标记事件(6色)
- 多会话管理+帧队列
- 中英文标记标签

【全桥接测试】(3h) full-bridge-e2e.ts (${(sizes[2].s/1024).toFixed(1)}KB)
- 37个桥接模块全量注册表
- 6大分类：data_source(11)/pipeline(6)/intelligence(4)/bridge(11)/utility(4)/ipc(1)
- 6条核心验证链：
  Market→Push / Alert→Notification / Crash→All Users
  Community→UI / Health→Dashboard / Playback→UI
- 覆盖率计算+中英文E2E报告

【测试】r264-auto-antinoise-playback-e2e.test.ts (${(sizes[3].s/1024).toFixed(1)}KB)
- AntiNoiseBridge: 12 tests
- PlaybackIpcBridge: 10 tests
- FullBridgeE2E: 10 tests
- **32/32 ALL PASSING ✅**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁🏁🏁 QUANT MOO v3.0.0 全量交付完毕！ 🏁🏁🏁

R257-R264 全部8轮完赛:
R257  3模块  53测试  行情打磨
R258  3模块  44测试  核心体验
R259  3模块  39测试  体验闭环
R260  3模块  40测试  终极验收
R261  3模块  38测试  去mock接线
R262  3模块  37测试  P2体验闭环
R263  3模块  31测试  管线集成+压测
R264  3模块  32测试  v3.0.0终轮
─────────────────────────────
∑ 24模块 / 314测试 / 71h / TSC=0

终极里程碑:
  78 engine modules / 1,193 tests
  27 rounds clean (R238→R264)
  QUANT MOO v3.0.0 🐮🚀🌕
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R264 broadcast sent');
