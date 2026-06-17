// ══ R276 QClaw Task 2: 因子订阅推送文案 (2h) ══
// 覆盖: 订阅管理UI文案 + 推送通知模板 + 因子异动告警文案
// 交付: src/lib/push/factor-subscription-push-copy-r276.ts
//
// 设计原则: 推送要「有数据、可行动、不骚扰」
// 每条推送必须有: 具体数值 + 方向 + 一个可执行的建议
// 禁止: "XX信号触发请注意" 这种无信息量的推送

export const FACTOR_SUB_PUSH_COPY = {

  // ══ 订阅管理 UI 文案 ══
  subscriptionUI: {
    title: "📡 因子订阅",
    subtitle: "选你关心的因子，到阈值了我提醒你",
    empty: {
      title: "还没订阅任何因子",
      body: "去因子列表，点一下你想追踪的因子旁边的🔔铃铛，就订阅了。每个因子可以单独设置推送频率和阈值。",
      cta: "去选因子",
    },
    frequency: {
      realtime: { label: "实时", desc: "因子信号触发即推送（仅限重要信号）" },
      daily: { label: "每日", desc: "每天收盘后汇总推送一次" },
      weekly: { label: "每周", desc: "周末推送本周因子回顾" },
    },
    threshold: {
      any: { label: "任何变化", desc: "有信号就推——适合高频交易" },
      strongOnly: { label: "仅强烈信号", desc: "只在极值区域推——适合低频关注" },
      custom: { label: "自定义", desc: "自己设定参数阈值" },
    },
    channel: {
      push: { label: "App推送", desc: "手机通知栏" },
      email: { label: "邮件", desc: "每周汇总，不骚扰" },
      inapp: { label: "站内", desc: "打开App后的消息中心" },
    },
    bulkActions: {
      enableAll: "一键开启全部",
      disableAll: "一键关闭全部",
      resetDefaults: "恢复默认设置",
    },
    stats: {
      subscribed: "已订阅",
      total: "个因子",
      lastPush: "上次推送",
      todayPushed: "今日已推",
      weeklySummary: "本周汇总",
    },
  },

  // ══ 推送通知模板 (按频率) ══
  templates: {

    // ── 实时: 强烈信号触发 ──
    realtime: {
      strongBullish: {
        title: "🟢 [{symbol}] {factorName} 极强看多",
        body: "{factorName}={value}{unit}，处于{percentile}%分位。{oneliner}。\n历史相似信号出现{count}次，未来{horizon}天平均回报{avgReturn}%。",
        action: "查看详情",
        category: "factor_signal",
      },
      strongBearish: {
        title: "🔴 [{symbol}] {factorName} 极强看空",
        body: "{factorName}={value}{unit}，处于{percentile}%分位——比历史上{percentile}%的时候都差。{oneliner}。",
        action: "查看详情",
        category: "factor_signal",
      },
      momentumReversal: {
        title: "🔄 [{symbol}] {factorName} 反转信号",
        body: "{factorName}从{oldSignal}翻转到{newSignal}。此因子过去12个月翻转{flipCount}次，准确率{accuracy}%。",
        action: "查看反转详情",
      },
      thresholdCross: {
        title: "⚠️ [{symbol}] {factorName} 突破{thresholdName}",
        body: "当前值{value}{unit}已突破你设定的{thresholdName}线（{thresholdValue}）。",
        action: "查看",
      },
    },

    // ── 每日: 收盘汇总 ──
    daily: {
      summary: {
        title: "📊 因子日报 | {date}",
        body: "你订阅的{total}个因子中，今日{triggered}个触发信号:\n{tops}",
        format: "  • {emoji} {factorName}: {value}{unit} ({percentile}%分位) — {oneliner}",
        empty: "今日你关注的{symbolCount}只股票{total}个因子无异常信号。",
        action: "查看完整日报",
      },
      marketBreadth: {
        title: "📏 市场宽度 | {date}",
        body: "全市场{marketCount}只股票:\n🟢 {bullish}只看多 (vs 昨天{bullishPrev})\n🔴 {bearish}只看空 (vs 昨天{bearishPrev})\n⚪ {neutral}只中性",
        action: "查看宽度详情",
      },
    },

    // ── 每周: 周末回顾 ──
    weekly: {
      recap: {
        title: "📋 因子周报 | {startDate}~{endDate}",
        body: "本周表现最好的3因子:\n{tops}\n\n本周表现最差的3因子:\n{bottoms}",
        format: "  {emoji} {factorName}: 信号正确率{accuracy}%，平均收益{avgReturn}%",
        action: "查看完整周报",
        highlight: "💡 本周建议: {recommendation}",
      },
      watchlistHealth: {
        title: "💚 自选股因子健康 | {date}",
        body: "你的自选股中:\n{healthy}只因子全面健康\n{caution}只有预警信号\n{danger}只有危险信号",
        action: "查看健康报告",
      },
    },
  },

  // ══ 因子异动告警（跨时间对比） ══
  anomalyAlerts: {
    suddenChange: {
      title: "⚡ [{symbol}] {factorName} 24h突变",
      body: "{factorName}从{yesterday}{unit}→{today}{unit} ({changePercent}%)。\n过去1年这种幅度的突变出现{similarEvents}次，{direction}信号准确率{accuracy}%。",
    },
    divergence: {
      title: "🔀 [{symbol}] {factorNameA} vs {factorNameB} 背离",
      body: "{factorNameA}看{bullBearA}，{factorNameB}看{bullBearB}——两者方向相反。\n{explanation}。上次类似背离({lastDate})后{symbol}涨跌为{lastResult}%。",
    },
    extremeReading: {
      title: "🌡️ [{symbol}] {factorName} 触及历史极值",
      body: "{factorName}={value}{unit}，这是{lookbackPeriod}内的{rank}（最高/最低）。\n上次触及此水平是{lastExtremeDate}，之后{symbol}的{horizon}天回报为{lastReturn}%。",
    },
  },

  // ══ 批量事件通知 ══
  batchNotifications: {
    multiSignal: {
      title: "🎯 [{symbol}] {count}个因子同步看{signal}",
      body: "{factorList}——{count}个因子同时指向同一方向。历史上{count}+因子共振时，{horizon}天方向正确率为{accuracy}%。",
      action: "查看共振分析",
    },
    sectorAlert: {
      title: "🏭 {sectorName}板块因子异动",
      body: "{sectorName}内{stockCount}只股票的{topFactor}因子集体触发。板块资金可能在流入/流出。",
      action: "查看板块详情",
    },
    watchlistDanger: {
      title: "🚨 自选股警戒: {dangerCount}只触发危险信号",
      body: "{dangerList}的因子指标出现异常。建议逐只检查。",
      action: "查看自选股",
    },
  },

  // ══ 不骚扰设计 ══
  antiSpam: {
    cooldown: {
      title: "推送已暂停",
      body: "同一因子24小时内不再重复推送。如需查看高频信号，请切换到「实时」模式。",
    },
    digestMode: {
      title: "摘要模式已开启",
      body: "你当前处于摘要模式——强烈信号实时推送，普通信号每日汇总。这样每天大约收到2-5条推送。",
    },
    frequencyLimit: {
      warning: "你今天从这个因子收到{count}条推送了。要暂时静音这个因子吗？",
      action: "静音24h",
    },
    rateLimit: "同一因子1小时内最多推送{maxPerHour}次——超出的信号会合并到下次推送。",
  },

  // ══ 快捷操作文案 ══
  quickActions: {
    viewChart: "看K线",
    viewFactor: "看因子详情",
    adjustThreshold: "调阈值",
    mute: "静音",
    unsubscribe: "取消订阅",
    addToWatchlist: "加自选",
    createStrategy: "基于此信号创建策略",
  },

  // ══ 因子信号→策略转化文案 ══
  signalToStrategy: {
    banner: {
      title: "💡 发现交易思路",
      body: "[{symbol}] {factorName}触发{signal}信号。系统可自动基于此信号生成策略模板。要试试吗？",
      yes: "生成策略",
      no: "暂不需要",
    },
    generated: {
      title: "✅ 策略已生成",
      body: "「{strategyName}」——基于{signalCount}个因子信号自动生成。含止损/止盈/仓位建议。",
      action: "去回测",
      cost: "回测消耗1 USDT积分",
    },
  },

  // ── 导出 ──
};

// ── 推送模板参数类型 ──
export interface FactorPushParams {
  symbol: string;
  factorName: string;
  value: number;
  unit: string;
  percentile: number;
  oneliner: string;
  signal?: string;
  horizon?: number;
  avgReturn?: number;
  count?: number;
  accuracy?: number;
}

// ── 生成实时推送 ──
export function generateRealtimePush(
  type: 'strongBullish' | 'strongBearish' | 'momentumReversal' | 'thresholdCross',
  params: FactorPushParams & Record<string, any>
): { title: string; body: string; category: string } {
  const t = FACTOR_SUB_PUSH_COPY.templates.realtime[type];
  return {
    title: t.title.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`),
    body: t.body.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`),
    category: t.category,
  };
}

export default FACTOR_SUB_PUSH_COPY;
