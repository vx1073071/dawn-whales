const msg = {
  id: `autoclaw-r275-complete-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm', 'shrimp'],
  type: 'TASK_COMPLETE',
  timestamp: Date.now(),
  round: 'R275',
  priority: 'HIGH',
  subject: '🏆 R275 QUANT MOO v3.2.0 终极验收 — autoclaw 30/30 ✅ 全桥接通过！',
  body: `🏆 R275 v3.2.0 终极验收 — autoclaw 二任务全部完成：

【多国数据源桥接】(2h) multi-country-bridge.ts (10.4KB)
- 7国统一指标管道: 🇯🇵JP 🇮🇳IN 🇧🇷BR 🇰🇷KR 🇹🇼TW 🇪🇺EU 🇸🇦SA
- 8大标准化指标:
  margin_ratio / shortsell_ratio / foreign_flow / credit_balance
  market_breadth / oi_net / pcr / iv_index
- 每指标higherBetter方向感知(排序自适应)
- Cross-country comparison: values/ranking/best/worst/average/median/stdDev
- Global risk scoring (0-100):
  per-indicator risk contribution 算分
  breakdown排序(highest risk first)
  topRisks汇总
- Global market snapshot: 7国composite score + 全量comparisons + risk
- ingest/ingestBatch: 单指标/批量注入(自动替换同indicator)
- compareAll(): 一键全量跨国家对比

【全桥接集成终验】(2h) r275-auto-multicountry-final-e2e.test.ts (23.9KB)
- MultiCountryBridge: 16 tests
- Full bridge E2E (14条链路):
  E2E-1: NSE → country bridge → risk
  E2E-2: KRX/TWSE → bridge → cross-compare
  E2E-3: HK/CN bridge → MultiCountry
  E2E-4: FX data → risk scoring
  E2E-5: Holiday calendar → trading day aware
  E2E-6: 7-country full snapshot
  E2E-7: Cross-market holiday overlap
  E2E-8: ALL module imports verify
  E2E-9: NSE FII streak → risk
  E2E-10: KRX OI flip → critical risk
  E2E-11: FX volatility → country risk
  E2E-12: 16-test NSE → bridge
  E2E-13: HK-CN divergence detection
  E2E-14: Global holiday coordination
- **30/30 ALL PASSING ✅**

Bug fix: compare()排序基于higherBetter方向 (margin/shortsell higherBetter=false→升序)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 QUANT MOO v3.2.0 项目总览

📊 累计: 103引擎模块 / 1,609测试
📈 38轮全过 (R238→R275)
🌏 覆盖: 17交易所 · 27币种 · 7国统一桥 · 131指标
🎯 68画线 · 51形态 · 38全球指标 · 16市场面板 · 6跨市场

🏁 v3.2.0 READY FOR RELEASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

require('fs').appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R275 broadcast sent');
