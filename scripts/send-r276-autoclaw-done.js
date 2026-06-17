const msg = {
  id: `autoclaw-r276-done-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm'],
  type: 'ROUND_COMPLETE',
  timestamp: Date.now(),
  round: 'R276',
  priority: 'HIGH',
  subject: '[autoclaw] R276 COMPLETE — AShareFactorBridge + FactorSubscriptionPushBridge (56 tests, TSC=0)',
  body: `R276 autoclaw 2/2 ALL DONE ✅ (4h)

─────────────────────────────────────────
auto#1: A股数据源→因子桥接 (2h) ✅
─────────────────────────────────────────
ashare-factor-bridge.ts (27.9KB)
- 10大A股特色信号: DDX/DDY/DDZ/北向/龙虎榜/融资融券/板块资金/涨跌停/市场宽度/主力追踪
- 上游桥接: eastmoney-fetcher.ts + china-data-sources.ts → 因子系统
- 下游输出: FactorSignalPipeline → PushIpcBridge
- 29 tests: snapshot ingestion(3)+smartMoney(5)+northbound(3)+dragonGate(3)+margin(3)+sectorFlow(3)+limitBreadth(3)+compositeScoring(3)+signalStreaming(1)+configReset(2)
- 核心功能: ingest 8种A股数据 → 自动检测信号 → computeCompositeSentiment(-100~+100) → computeStockScore(0~100)
- 信号检测规则: DDX>0.5流入/<-0.5流出, 北向连续≥3天, 机构买入>1亿, 融资余额>1.5万亿, 涨停>80家热市, 跌停>50家恐慌, 炸板>10封板率<50%

─────────────────────────────────────────
auto#2: 因子订阅→推送IPC桥接 (2h) ✅
─────────────────────────────────────────
factor-subscription-push-bridge.ts (22.0KB)
- 订阅管理: subscribe/unsubscribe/toggle/list/getSubscription/upgradeTier
- 三级定价: free(3因子/7天试用/30条信号) / basic(2.9U月/因子) / premium(19.9U月/无限)
- 推送功能: 信号→推送适配, 频控(globalMaxPerHour=15)+去重, minSeverity过滤, threshold过滤, cooldown
- Digest模式: 批量合并 → 15分钟定时flush → 摘要通知
- 配额追踪: free trial 30条信号配额, 5条以下预警
- 27 tests: subscription(7)+dispatch(5)+batch(1)+quota(2)+digest(3)+updates(4)+stats(3)+digestHandler(1)+reset(1)

─────────────────────────────────────────
R276 autoclaw 汇总:
- 2 modules: ashare-factor-bridge.ts (27.9KB) + factor-subscription-push-bridge.ts (22.0KB)
- 1 test: r276-auto-ashare-sub-push.test.ts (36.9KB, 56 tests)
- TSC: 0 errors (autoclaw files)
- index.ts: exports added

Cumulative: 105 modules, 1,665 tests, TSC=0, 39 rounds (R238→R276)`
};

require('fs').appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('R276 autoclaw completion broadcast sent');
