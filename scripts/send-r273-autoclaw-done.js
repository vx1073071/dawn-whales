const msg = {
  id: `autoclaw-r273-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R273',
  priority: 'HIGH',
  subject: '🌏 R273 autoclaw 3任务完成 — NSE+KRX/TWSE+24币种汇率 46/46 ✅',
  body: `🌏 R273 全球新兴市场+跨市场 — autoclaw 三任务全部完成：

【NSE印度数据源】(3h) nse-data-source.ts (13.2KB)
- F&O完整数据: 期货OI/成交/成本(cost-of-carry)/展期率(rollover)
- 期权数据: Call/Put OI + PCR + MaxPain + IV(ATM)
- FII/DII: 外资/内资净买卖 + 指数期货/个股期货/指数期权细分
- 现金交割: 交割量/交割率(>70%=资金建仓)
- 板块指数: Nifty 50/Bank Nifty等
- 5大信号: OI buildup(>20%增仓)/unwinding/PCR极端(>1.5/<0.5)/IV spike(>35%)/高交割
- 展期提醒: rollover>80%
- FII streak追踪: 连续净买/卖天数
- 市场总OI/active contracts统计

【KRX/TWSE韩台数据源】(2h) krx-twse-data-source.ts (13.5KB)
- KRX+TWSE双市场统一接口
- 三大法人: 外资/投信/自营商 买超卖超(含避险)
- 外资期货OI: long/short/net + OI翻转检测(>5000口翻空/翻多)
- 融资融券: 余额/新买/偿还 + margin ratio极端检测(>80x/<0.2x)
- 指数追踪: KOSPI/KOSDAQ/TAIEX/TPEx
- 5信号: foreign_surge/exit + trust_surge + oi_flip + margin_extreme + divergence
- 跨市场比较: compareMarkets() KRX vs TWSE
- 外资连续买超/卖超 streak

【多币种汇率】 (2h) fx-data-source.ts (14.8KB)
- 27币种: 8主要+11亚洲+5新兴+2加密
- 24标准货币对
- 实时汇率 + bid/ask spread
- 反向汇率 (automatic inverse via 1/rate)
- 三角计算 (cross via USD)
- 三角套利检测: 7主要货币×210种组合
- 波动率: daily/weekly/monthly/annualized + ATR20
- 相关性矩阵: Pearson 30天
- USD指数 (DXY-style weighted)
- 货币转换 (含0.05%手续费)
- Strongest/Weakest货币追踪

【测试】r273-auto-emerging-fx.test.ts (26.6KB)
- NseDataSource: 15 tests
- KrxTwseDataSource: 14 tests
- FxDataSource: 17 tests
- **46/46 ALL PASSING ✅**

Bug fix: futOI→futOpenInterest字段名不匹配(11处修复)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌏 总累计: 100引擎模块 / 1,540测试
36轮全过 (R238→R273) 覆盖6大洲27币种 🌍
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

require('fs').appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R273 broadcast sent');
