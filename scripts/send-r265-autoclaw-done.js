const fs = require('fs');
const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/';

const files = [
  'electron/engine/data/shortcut-ipc-bridge.ts',
  'electron/engine/data/multi-chart-sync-bridge.ts',
  'electron/engine/data/flash-chart-ipc-bridge.ts',
  'tests/data/r265-auto-shortcut-multi-flash.test.ts',
];
const sizes = files.map(f => ({ f: f.split('/').pop(), s: fs.statSync(base + f).size }));

const msg = {
  id: `autoclaw-r265-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R265',
  priority: 'HIGH',
  subject: '🔌 R265 autoclaw 3任务完成 — 快捷键+多图同步+闪电图IPC 39/39 ✅',
  body: `🔌 R265 P0图表地基 — autoclaw 三任务全部完成：

【快捷键IPC】(3h) shortcut-ipc-bridge.ts (${(sizes[0].s/1024).toFixed(1)}KB)
- 31个默认快捷键 (TradingView兼容)
  导航: Space/Shift+Space ← → Shift+←→
  周期: 1-9 (1m→月线)
  画线: T/H/F/X  +  Ctrl+Z/Y
  缩放: =/-/0  +  Escape/?
  通用: /搜索 Ctrl+D暗色 Ctrl+Enter全屏
- 上下文感知: chart/watchlist/settings/global
- 冲突检测+优先级裁决
- 全局/分类/单键禁用
- 分类快捷键帮助指南 (中英文)
- 双向注册: 主进程+渲染进程

【多图同步桥接】(2h) multi-chart-sync-bridge.ts (${(sizes[1].s/1024).toFixed(1)}KB)
- 图表组管理 (创建/销毁/添加/移除)
- Symbol同步: 主图改→所有副图自动切换
- Timeframe同步: 周期联动或独立
- Crosshair同步: 十字光标准确时间同步
- 3种同步模式: linked/semi/custom
- Custom: syncSymbol/syncTimeframe/syncCrosshair/syncRange/syncIndicators 独立开关
- Exception机制: 指定图表不同步
- 6个布局预设: 单图/上下双图/左右双图/三周期同列/四宫格/三列横排
- 位置冲突检测 (同row+col不可重复)

【闪电图数据IPC】(1h) flash-chart-ipc-bridge.ts (${(sizes[2].s/1024).toFixed(1)}KB)
- Tick→1min OHLCV聚合
- 背压控制 (1000ms聚合窗口)
- 实时状态: prevClose/todayOpen/High/Low/VWAP
- Sparkline数据 (最近50 tick紧凑格式)
- 批量tick处理+完整快照
- 多symbol并行追踪

【测试】r265-auto-shortcut-multi-flash.test.ts (${(sizes[3].s/1024).toFixed(1)}KB)
- ShortcutIpcBridge: 16 tests
- MultiChartSyncBridge: 15 tests
- FlashChartIpcBridge: 8 tests
- **39/39 ALL PASSING ✅**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总累计: 81引擎模块 / 1,232测试
28轮全过 (R238→R265) QUANT MOO v3.1.0 🔌
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R265 broadcast sent');
