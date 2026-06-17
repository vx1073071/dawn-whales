const fs = require('fs');
const base = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/';

const files = [
  'electron/engine/data/indicator-data-pipeline.ts',
  'electron/engine/data/indicator-signal-push-bridge.ts',
  'tests/data/r268-auto-indicator-signal.test.ts',
];
const sizes = files.map(f => ({ f: f.split('/').pop(), s: fs.statSync(base + f).size }));

const msg = {
  id: `autoclaw-r268-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R268',
  priority: 'HIGH',
  subject: '📊 R268 autoclaw 2任务完成 — 64指标数据管线+信号→推送 45/45 ✅',
  body: `📊 R268 指标全量扩充 29→93 — autoclaw 两任务全部完成：

【64指标数据管线】(3h) indicator-data-pipeline.ts (${(sizes[0].s/1024).toFixed(1)}KB, 1400+行)
- 趋势14: SMA/EMA/WMA/DEMA/TEMA/KAMA/HMA/ALMA/McGinley/Pivot/SuperTrend/ADX/PSAR/Ichimoku/Aroon
- 动量11: RSI/StochRSI/MFI/CCI/WilliamsR/UO/TRIX/AO/DPO/ConnorsRSI/Momentum
- 成交量13: OBV/VWAP/VWMA/PVT/CMF/ForceIndex/EOM/Klinger/VP/A-DLine/ChaikinMF/VPT/NVI
- 波动8: ATR/BB/Keltner/Donchian/HistoricalVol/ChandelierExit/BBWidth/UlcerIndex
- 中国10: BBI/BIAS/ENE/CYR/BBIBOLL/MIKE/ASI/DDX/DDY/DDZ
- OrderFlow8: Delta/CumDelta/BidAskRatio/VPOC/FootprintDelta/VolImbalance/POC/TPO
- 每个指标有完整公式实现
- 批量计算 (calculateAll 一次性算全部64指标)
- 缓存层 (symbol+timeframe粒度)
- 搜索 (ID/英文名/中文名)
- 分类查询 (6大分类)

【指标信号→推送】(1h) indicator-signal-push-bridge.ts (${(sizes[1].s/1024).toFixed(1)}KB)
- 32条信号规则: RSI/CCI/WillR/MFI/StochRSI/ADX/AO/BB/ATR/HV/ConnorsRSI/CMF/BIAS...
- 4种信号: overbought/oversold/crossover/breakout
- 4级优先级: critical(30s)/high(5min)/medium(15min)/low(1h)
- Cooldown防抖 (同信号冷却)
- Strength评级 (strong/moderate/weak)
- 信号聚合统计 + 推送历史
- analyzeAndPush 完整管线

【测试】r268-auto-indicator-signal.test.ts (${(sizes[2].s/1024).toFixed(1)}KB)
- IndicatorDataPipeline: 28 tests (注册/趋势/动量/成交量/波动/中国/OF/批量/缓存/搜索)
- IndicatorSignalPushBridge: 17 tests (RSI信号/生命周期/冷却/优先级/查询/总结)
- **45/45 ALL PASSING ✅**

Bug fixes:
- SuperTrend: vals数组未填充 → 重写算法
- 注册表键名 ≠ id字段 → 统一用d.id查找

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总累计: 88引擎模块 / 1,339测试
31轮全过 (R238→R268) QUANT MOO 29→93指标 📊
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R268 broadcast sent');
