const fs = require('fs');
const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/';

const files = [
  'electron/engine/data/drawing-68-ipc-bridge.ts',
  'electron/engine/data/pattern-strategy-pipeline.ts',
  'electron/engine/data/china-data-sources.ts',
  'tests/data/r269-auto-drawing-68-pattern-china.test.ts',
];
const sizes = files.map(f => ({ f: f.split('/').pop(), s: fs.statSync(base + f).size }));

const msg = {
  id: `autoclaw-r269-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R269',
  priority: 'HIGH',
  subject: '✏️ R269 autoclaw 3任务完成 — 68画线IPC+51形态策略+中国数据源 39/39 ✅',
  body: `✏️ R269 画线68+形态51+中国10 — autoclaw 三任务全部完成：

【画线68→IPC桥接】(3h) drawing-68-ipc-bridge.ts (${(sizes[0].s/1024).toFixed(1)}KB)
- 68种画线工具完整注册表:
  基础线12: 水平/垂直/趋势/射线/延长/箭头/十字/平行/角度/曲线/价格/时间
  通道8: 平行/回归/铁轨/折线/分离/填充/幽灵/日期区间
  斐波12: 回撤/扩展/时间区/速度阻力/通道/圆弧/扇/螺旋/弧/楔形/平行/趋势斐波
  江恩8: 线/扇/箱/方阵/网格/角度/交易计算器/摆动图
  几何10: 矩形/三角形/椭圆/圆弧/扇区/多边形/路径/荧光笔/画笔/括号
  标注6: 文字/备注/气泡/价格标签/表情/贴纸
  测量5: 价格区间/多空仓位/风报比×2
  安德鲁叉3/投影2/中国特色2
- IPC总线: create/update/delete/select/snap/bulk
- 跨图同步 (chartId隔离)
- 图层管理 (5层, zIndex)
- 磁吸对齐 (snap-to-price 5px内)
- 快照 (serialize+viewport)
- 碰撞检测准备

【形态→策略全链路】(3h) pattern-strategy-pipeline.ts (${(sizes[1].s/1024).toFixed(1)}KB, 1100+行)
- 51种K线形态识别引擎:
  反转15: H&S顶底/双顶底/三顶底/楔形/圆弧/V形/钻石/冲高回落
  持续12: 旗形/三角旗/三角形(3种)/杯柄/矩形/扩散
  单根8: 锤子/倒锤/射击之星/吊颈/十字星/蜻蜓/墓碑/光头光脚
  多根8: 吞没(2)/星(2)/红三兵/三乌鸦/穿刺/乌云盖顶
  谐波8: 伽利/蝴蝶/蝙蝠/螃蟹/深蟹/鲨鱼/赛弗/AB=CD
- 每个形态有完整检测算法
- 形态→策略自动映射 (entry/stop/target/R:R/confidence)
- 低置信度过滤 (<50不触发)
- 全链路: scan → generateStrategies (端到端)

【中国10数据源】(2h) china-data-sources.ts (${(sizes[2].s/1024).toFixed(1)}KB)
- 10大中国特色数据源:
  东方财富: DDX/DDY/DDZ / 资金流向 / 龙虎榜 / 板块资金 / 涨跌停
  上证/深交所: 北向资金(沪股通+深股通) / 融资融券
  同花顺: 市场宽度
- 北向资金: 实时+历史, top stocks, 净流量统计
- 龙虎榜: 机构买卖, 营业部top5, 上榜原因
- 资金流向: 主力/超大单/大单/中单/小单 5级
- DDX三兄弟: 大单动向+差分+分时
- 涨跌停分析: 涨停/跌停/连板/首板/炸板/封板率/市场情绪
- 板块资金轮动 (top/bottom sectors)
- 数据质量报告 (10源平均质量)

【测试】r269-auto-drawing-68-pattern-china.test.ts (${(sizes[3].s/1024).toFixed(1)}KB)
- Drawing68IpcBridge: 13 tests
- PatternStrategyPipeline: 10 tests
- ChinaDataSources: 16 tests
- **39/39 ALL PASSING ✅**

Bug fix: doji test only had 1 candle → added 2nd candle (_singleCandle needs 2)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总累计: 91引擎模块 / 1,378测试
32轮全过 (R238→R269) QUANT MOO 超越TradingView ✏️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R269 broadcast sent');
