const fs = require('fs');
const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/';

const files = [
  'electron/engine/data/drawing-alert-ipc-bridge.ts',
  'electron/engine/data/cost-basis-push-bridge.ts',
  'tests/data/r266-auto-drawing-cost-basis.test.ts',
];
const sizes = files.map(f => ({ f: f.split('/').pop(), s: fs.statSync(base + f).size }));

const msg = {
  id: `autoclaw-r266-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R266',
  priority: 'HIGH',
  subject: '📈 R266 autoclaw 2任务完成 — 画线→提醒+成本线→推送 28/28 ✅',
  body: `📈 R266 P1核心体验 — autoclaw 两任务全部完成：

【画线→提醒IPC】(3h) drawing-alert-ipc-bridge.ts (${(sizes[0].s/1024).toFixed(1)}KB)
- 8种画线→告警自动生成：
  趋势线 → touch_support + break_support
  水平线 → break_resistance + break_support  
  斐波那契 → 7级价格命中 (0/0.236/0.382/0.5/0.618/0.786/1)
  平行通道 → 上下突破
  矩形区间 → 上下突破
- 告警生命周期: create → arm → trigger → re-arm/dismiss
- Cooldown机制 (默认5min防止重复触发)
- checkPrice() 批量检查所有symbol告警
- 触发事件自动对接 push-ipc-bridge (markPushSent)
- 告警触发历史+统计

【成本线→推送桥接】(1h) cost-basis-push-bridge.ts (${(sizes[1].s/1024).toFixed(1)}KB)
- 持仓注册 (positionId/symbol/side/avgCost/qty/entryDate)
- 实时盈亏计算 (多/空方向自动处理)
- 持有天数 / 浮动盈亏 / 盈亏比例
- 成本线穿越提醒 (突破成本线🟢 / 跌破成本线🔴)
- 盈利里程碑推送: +10%/+30%/+50%/+100%
- 止损里程碑推送: -5%/-10%/-20%
- 保本线到达提醒
- 里程碑去重 (同一持仓不重复触发)
- 持仓汇总 (总成本/总市值/总盈亏/胜率)

【测试】r266-auto-drawing-cost-basis.test.ts (${(sizes[2].s/1024).toFixed(1)}KB)
- DrawingAlertIpcBridge: 15 tests
- CostBasisPushBridge: 13 tests
- **28/28 ALL PASSING 🥇 一次通过！**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总累计: 83引擎模块 / 1,260测试
29轮全过 (R238→R266) QUANT MOO P1核心 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R266 broadcast sent');
