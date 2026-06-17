// ══ R267 QClaw Task 1: 主力追踪文案 (2h) ══
// P2-03: 主力资金追踪 — 跟大钱走。大单/资金流向/经纪商/异常检测全链路文案
// 交付: 主力追踪面板 + 资金流向告警 + 主力行为解读

// ═══════════════════════════════════════
// TYPE: 主力追踪面板
// ═══════════════════════════════════════

export interface SmartMoneyCopy {
  panel: {
    title: string;
    subtitle: string;
    empty: string;
    loading: string;
    dataSource: string;
    disclaimer: string;
  };
  summary: SmartMoneySummary;
  dimensions: SmartMoneyDimension[];
  alerts: Record<string, unknown>;
  interpretation: Record<string, unknown>;
}

interface SmartMoneySummary {
  title: string;
  netFlow: string;           // "今日主力净流入"
  bigOrderRatio: string;     // "大单占比"
  brokerSignal: string;      // "经纪商信号"
  verdicts: {                // 综合判断
    strongInflow: string;    // "主力大幅买入"
    inflow: string;          // "主力偏多"
    neutral: string;         // "主力观望"
    outflow: string;         // "主力偏空"
    strongOutflow: string;   // "主力大幅卖出"
  };
}

interface SmartMoneyDimension {
  id: string;
  name: string;
  description: string;
  empty: string;
  labels: Record<string, string>;
}

// ═══════════════════════════════════════
// 完整文案
// ═══════════════════════════════════════

export const SMART_MONEY_COPY: SmartMoneyCopy = {

  panel: {
    title: '主力追踪',
    subtitle: '跟大钱走 — 看主力在干什么',
    empty: '还没有加载股票。打开个股后这里会显示主力资金动向。',
    loading: '正在分析资金流向…',
    dataSource: '数据来自交易所公开数据 — 大单/超大单分类',
    disclaimer: '主力追踪基于公开订单大小分类——大型订单不一定来自"主力"，可能来自多个散户同时下单。仅供参考。',
  },

  summary: {
    title: '今日主力动向',
    netFlow: '主力净流入',
    bigOrderRatio: '大单占比',
    brokerSignal: '经纪商信号',
    verdicts: {
      strongInflow: '主力大幅买入',
      inflow: '主力偏多',
      neutral: '主力观望',
      outflow: '主力偏空',
      strongOutflow: '主力大幅卖出',
    },
  },

  dimensions: [
    {
      id: 'big-order',
      name: '大单分析',
      description: '按订单大小分类——特大单(≥100万)/大单(20-100万)/中单(4-20万)/小单(≤4万)',
      empty: '暂无大单数据',
      labels: {
        superLargeBuy: '特大单买入',
        superLargeSell: '特大单卖出',
        largeBuy: '大单买入',
        largeSell: '大单卖出',
        midBuy: '中单买入',
        midSell: '中单卖出',
        smallBuy: '小单买入',
        smallSell: '小单卖出',
        netSuperLarge: '特大单净额',
        netLarge: '大单净额',
        superLargeRatio: '特大单占比',
        interpretation: '特大单净买入 > 大单净卖出 = 主力在收集筹码。反之 = 主力在出货。',
      },
    },
    {
      id: 'capital-flow',
      name: '资金流向',
      description: '分时资金流入流出——每一分钟主力在买还是卖',
      empty: '暂无资金流向数据',
      labels: {
        inflow: '主力流入',
        outflow: '主力流出',
        netFlow: '净流向',
        cumulative: '累计净流入',
        todayPeak: '今日峰值',
        trend: '流向趋势',
        interpretation: '主力持续净流入 = 建仓中。主力先买后卖 = 拉高出货。主力先卖后买 = 洗盘。',
      },
    },
    {
      id: 'broker-tracking',
      name: '经纪商追踪',
      description: '追踪前5大买卖经纪商——谁在买、谁在卖',
      empty: '暂无经纪商数据',
      labels: {
        topBuyer: '最大买家',
        topSeller: '最大卖家',
        brokerName: '经纪商',
        buyAmount: '买入金额',
        sellAmount: '卖出金额',
        netPosition: '净仓位',
        institutionType: '机构类型',
        interpretation: '前2大买家是外资/机构 → 机构建仓信号。前2大卖家是外资→机构减仓。散户为主的买卖→无方向。',
      },
    },
  ],

  alerts: {
    title: '主力异常提醒',
    description: '当主力行为异常时提醒你——以下信号出现时会自动推送',
    items: [
      {
        id: 'big-order-surge',
        name: '大单异动',
        condition: '特大单净买入 > 1亿 且 买卖金额相差 > 1倍',
        message: '⚠️ {symbol} 出现特大单异动: 净买入{amount}——大资金在行动',
        action: '查看详情',
      },
      {
        id: 'capital-flow-reverse',
        name: '流向逆转',
        condition: '连续3天净流出后突然净流入 > 5000万',
        message: '🔄 {symbol} 资金流向逆转: 结束{days}天流出,今日净流入{amount}',
        action: '查看详情',
      },
      {
        id: 'broker-whale',
        name: '大户进场',
        condition: '前2大买家均为外资/机构 且 合计买入 > 5000万',
        message: '🐋 {symbol} 外资机构大举买入: {broker1}买{buy1} + {broker2}买{buy2}',
        action: '查看详情',
      },
      {
        id: 'distribution',
        name: '疑似出货',
        condition: '特大单净卖出 > 5000万 且 小单净买入 > 3000万',
        message: '📉 {symbol} 疑似主力出货: 大单卖出{largeSell}但小单买入{smallBuy}——散户在接盘',
        action: '查看详情',
      },
    ],
  },

  interpretation: {
    title: '主力行为解读',
    patterns: [
      {
        id: 'accumulation',
        name: '悄悄建仓',
        scenario: '价格横盘 + 特大单持续净买入 + 成交量温和放大',
        meaning: '主力在低位收集筹码——不急不慢地买。此时价格不会大涨——主力不想让你发现。',
        action: '注意，但不要跟风抢——主力建仓的时间比你想象的长。',
        confidence: 'medium',
      },
      {
        id: 'pump-up',
        name: '拉升出货',
        scenario: '价格快速上涨 + 大单先买后卖 + 成交量暴增',
        meaning: '主力拉高价格吸引跟风盘——然后在高位悄悄卖出。散户看到"涨了"追进去，主力在卖给你。',
        action: '警惕追高。如果持有——注意大单是否开始转为净卖出。',
        confidence: 'high',
      },
      {
        id: 'distribution',
        name: '高位派发',
        scenario: '价格高位震荡 + 特大单净卖出 + 小单净买入 + 成交缩量',
        meaning: '主力在高位把筹码卖给散户。价格"不跌"是因为散户在接——不是因为有支撑。',
        action: '如果持有——考虑减仓。如果想买——等主力操作完成再动。',
        confidence: 'high',
      },
      {
        id: 'wash-out',
        name: '洗盘',
        scenario: '价格下跌 + 中单小单卖出 + 特大单买入 + 成交缩量',
        meaning: '用下跌吓出散户——然后主力在低位接货。跌是假的——是主力在"洗"。',
        action: '如果你被洗出去了——等企稳后可以再入场。如果没被洗——坚持持有。',
        confidence: 'medium',
      },
    ],
  },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getSmartMoneyVerdict(netFlow: number, bigOrderRatio: number): string {
  const copy = SMART_MONEY_COPY.summary.verdicts;
  if (netFlow > 50000000 && bigOrderRatio > 0.6) return copy.strongInflow;
  if (netFlow > 10000000 && bigOrderRatio > 0.4) return copy.inflow;
  if (netFlow < -50000000 && bigOrderRatio > 0.6) return copy.strongOutflow;
  if (netFlow < -10000000 && bigOrderRatio > 0.4) return copy.outflow;
  return copy.neutral;
}

export function getInterpretationPattern(id: string) {
  return (SMART_MONEY_COPY.interpretation as any).patterns?.find((p: any) => p.id === id);
}

export function getSmartMoneyDimension(id: string) {
  return SMART_MONEY_COPY.dimensions.find(d => d.id === id);
}

export default SMART_MONEY_COPY;
