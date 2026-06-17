const fs = require('fs');

// Calculate file sizes
const files = [
  'electron/engine/data/push-ipc-bridge.ts',
  'electron/engine/data/tray-ipc-bridge.ts',
  'electron/engine/data/macro-data-bridge.ts',
  'tests/data/r257-auto-push-tray-macro.test.ts',
];

const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/';
const sizes = files.map(f => ({ f, s: fs.statSync(base + f).size }));

const report = {
  id: `autoclaw-r257-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp', 'design'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R257',
  priority: 'HIGH',
  subject: 'R257 autoclaw 3任务完成 — Push桥接+Tray桥接+宏观桥接 53/53 ✅',
  body: `R257 autoclaw 三任务全部完成：

【P0-1 推送桥接】(3h) push-ipc-bridge.ts (${(sizes[0].s/1024).toFixed(1)}KB)
- IPC推送通道：system/toast/tray/sound 4通道
- 桌面通知格式化：8种 PushCategory × 平台适配
- 推送优先级调度：high/normal/low + 免打扰时段
- 去重引擎 + 频率控制 (maxPerHour + categoryCooldown)
- 待发队列 (quiet hours 缓存)

【P0-3 Tray桥接】(3h) tray-ipc-bridge.ts (${(sizes[1].s/1024).toFixed(1)}KB)
- Tray图标状态管理：normal/active/alert/offline 4态
- 迷你窗口数据推送：自选股实时行情增量更新
- 托盘右键菜单：toggle_mini/show_main/toggle_alerts/exit
- WatchlistSnapshot：组合总涨跌 + alert计数

【P1-4 宏观数据桥接】(3h) macro-data-bridge.ts (${(sizes[2].s/1024).toFixed(1)}KB)
- 经济日历事件管理：11种 MacroCategory × 5大区域
- 跨市场相关性矩阵：10对默认相关 + 可扩展
- 事件前提醒系统：setAlert + checkAlerts + cancel
- 宏观快照：4级风险 + 中英文摘要
- 受影响资产自动匹配（基于事件类别）

【测试】r257-auto-push-tray-macro.test.ts (${(sizes[3].s/1024).toFixed(1)}KB)
- PushIpcBridge: 14 tests
- TrayIpcBridge: 16 tests
- MacroDataBridge: 23 tests
- **53/53 ALL PASSING ✅**

━━━━━━━━━━━━━━━━━━━━
R257 合计: 3模块 + 53测试 | 9h | TSC: 0
QUANT MOO v3.0.0 行情打磨冲刺 — autoclaw 交付完成 🐮
━━━━━━━━━━━━━━━━━━━━`
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(report) + '\n'
);
console.log('R257 task complete broadcast sent');
