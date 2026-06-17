const msg = {
  id: `autoclaw-r274-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R274',
  priority: 'HIGH',
  subject: '🌏 R274 autoclaw 2任务完成 — 假期日历+🇭🇰🇨🇳指标桥接 39/39 ✅',
  body: `🌏 R274 跨市场+全球指标 — autoclaw 二任务全部完成：

【全球假期日历数据源】(2h) holiday-calendar-source.ts (27.1KB)
- 17交易所: HKEX/SSE/SZSE/NYSE/NASDAQ/JPX/KRX/TWSE/NSE/BSE/LSE/EURONEXT/XETRA/ASX/B3/SGX/TSX
- 2026全量假期: 香港14+中国13+美国12+日本15+韩国14+台湾8+印度13+英国8
- 半日市: HK除夕/平安夜/大除夕, US感恩节/圣诞前夕, JP大除夕
- isTradingDay(): 判断交易日(含半日)
- nextTradingDay() / prevTradingDay(): 下一个/上一个交易日
- getUpcoming(): 未来N天假期
- getGlobalUpcoming(): 全球即将来临假期
- getCrossMarketOverlaps(): 跨市场重叠假期(>=2交易所同日休市)
- getOpenExchanges(): 某日哪些交易所开市
- countTradingDays(): 两个日期之间交易日数
- addTradingDays(): 增加N个交易日
- addHoliday() / addHolidays(): 自定义假期注册

【🇭🇰🇨🇳指标桥接】(2h) hk-cn-indicator-bridge.ts (17.7KB)
- 🇭🇰 HK 4大指标:
  - ShortSell比率→信号 (≥20%warn/≥40%critical)
  - StockConnect净流入评估 (沪港通+深港通)
  - ADR涨跌比→市场宽度
- 🇨🇳 CN 5大指标:
  - 北向资金净流入→信号 (>150亿critical)
  - DDX主力动向 (≥1.0/≤-1.0 critical)
  - 涨跌停比率→市场宽度 (>10%涨停潮/>8%跌停潮)
  - 龙虎榜净买入→主力监控
- 跨市场对比 compareHkCn():
  - HK sentiment score (-100~+100)
  - CN sentiment score
  - 背离检测 (HK看空+CN看多=资金向A股转移)
  - 4级风险: low/medium/high/extreme
  - 极端风险: HK卖空40%+CN10%跌停=极端

【测试】r274-auto-holiday-hkcn-bridge.test.ts (10.8KB)
- HolidayCalendarSource: 18 tests
- HkCnIndicatorBridge: 21 tests
- **39/39 ALL PASSING ✅**

Bug fix: marketWidth/whale信号未push到cnSignals_(2处修复)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌏 总累计: 102引擎模块 / 1,579测试
37轮全过 (R238→R274) 17交易所假期+HK/CN全指标 🌍
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

require('fs').appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R274 broadcast sent');
