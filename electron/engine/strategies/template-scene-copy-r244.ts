// ══ R244 QClaw P0-02 + P1-20: Template Humanization + Scene Reclassification ══
// Consumable by ML StrategyBrowser + JVS TemplateEngine
// P0-02: 23 templates with human-readable one-liner (<=24 chars)
// P1-20: Templates reclassified from 11-market to 6 user-scenario categories

/** P1-20: User-facing scene categories replacing market-based classification */
export type StrategyScene =
  | 'value_discovery'    // 🔍 找低估好公司
  | 'trend_chasing'      // 📈 追涨强势股
  | 'contrarian'         // 💸 抄底反弹
  | 'income_stable'      // 🛡️ 躺平收息
  | 'event_catalyst'     // 🎯 抓特殊机会
  | 'advanced_play';     // 🧪 高级玩法

export const SCENE_META: Record<StrategyScene, { emoji: string; label: string; desc: string; count: number }> = {
  value_discovery:  { emoji: '🔍', label: '找低估好公司', desc: '买便宜的好货，等市场给公道价', count: 4 },
  trend_chasing:    { emoji: '📈', label: '追涨强势股',   desc: '强者恒强，顺势而为，不猜顶不抄底', count: 6 },
  contrarian:       { emoji: '💸', label: '抄底反弹',     desc: '跌太多了该反弹了，别人恐惧我贪婪', count: 3 },
  income_stable:    { emoji: '🛡️', label: '躺平收息',     desc: '不想盯盘，定期收钱，睡得着觉', count: 4 },
  event_catalyst:   { emoji: '🎯', label: '抓特殊机会',   desc: '分红回购指数调入AH价差——催化剂来了', count: 3 },
  advanced_play:    { emoji: '🧪', label: '高级玩法',     desc: '对冲套利多资产——不是新手村', count: 3 },
};

/** P0-02 + P1-20 combined: template humanization + scene mapping */
export interface TemplateSceneCopy {
  templateId: string;
  /** New user-facing name */
  displayName: string;
  /** <=24 chars one-liner, "我/你" first-person, zero jargon */
  humanPitch: string;
  /** Scene classification */
  scene: StrategyScene;
  /** Difficulty 1-5 */
  difficulty: number;
  /** Holding period */
  holdingPeriod: string;
  /** Suitable for */
  suitableFor: string;
}

export const TEMPLATE_SCENE_COPY: Record<string, TemplateSceneCopy> = {
  // ── 🔍 Scene 1: Value Discovery (4) ──
  'hk-ah-premium': {
    templateId: 'hk-ah-premium',
    displayName: 'AH差价猎人',
    humanPitch: '我在AH股之间套差价，A股贵就买H股等回归',
    scene: 'value_discovery',
    difficulty: 3,
    holdingPeriod: '1-6个月',
    suitableFor: '能等、不追涨杀跌的人',
  },
  'hk-dividend-ladder': {
    templateId: 'hk-dividend-ladder',
    displayName: '港股股息阶梯',
    humanPitch: '我在港股里挑分红最高的好公司，定期收钱',
    scene: 'value_discovery',
    difficulty: 2,
    holdingPeriod: '3-12个月',
    suitableFor: '喜欢稳定现金流的人',
  },
  'hk-red-chip-return': {
    templateId: 'hk-red-chip-return',
    displayName: '红筹回归捕手',
    humanPitch: '我买在港股上市的内地国企，等估值修复',
    scene: 'value_discovery',
    difficulty: 3,
    holdingPeriod: '3-12个月',
    suitableFor: '相信国企价值被低估的人',
  },
  'hk-southbound-track': {
    templateId: 'hk-southbound-track',
    displayName: '北水追踪器',
    humanPitch: '我跟内地资金一起买港股，大钱去哪我去哪',
    scene: 'value_discovery',
    difficulty: 2,
    holdingPeriod: '2周-3个月',
    suitableFor: '不想自己研究、想看钱往哪流的人',
  },

  // ── 📈 Scene 2: Trend Chasing (6) ──
  'crypto-btc-trend': {
    templateId: 'crypto-btc-trend',
    displayName: '比特币趋势王',
    humanPitch: '我专做比特币趋势，涨就跟涨，跌就休息',
    scene: 'trend_chasing',
    difficulty: 3,
    holdingPeriod: '2周-3个月',
    suitableFor: '能承受30%回撤、不情绪化的人',
  },
  'crypto-momentum-rotation': {
    templateId: 'crypto-momentum-rotation',
    displayName: 'BTC/ETH左右横跳',
    humanPitch: '我在比特币和以太坊之间来回换，谁强我买谁',
    scene: 'trend_chasing',
    difficulty: 3,
    holdingPeriod: '1-4周',
    suitableFor: '会看相对强弱、能频繁操作的人',
  },
  'us-tech-momentum': {
    templateId: 'us-tech-momentum',
    displayName: '美股科技动量',
    humanPitch: '我专买美国科技龙头，强者恒强不猜顶',
    scene: 'trend_chasing',
    difficulty: 2,
    holdingPeriod: '1-6个月',
    suitableFor: '相信科技是未来、不怕波动的人',
  },
  'kr-krx-momentum': {
    templateId: 'kr-krx-momentum',
    displayName: '韩国出口动量',
    humanPitch: '我追韩国出口导向的强势股，出口好就涨',
    scene: 'trend_chasing',
    difficulty: 3,
    holdingPeriod: '2周-2个月',
    suitableFor: '关注全球贸易和半导体周期的人',
  },
  'jp-jpx-value-reform': {
    templateId: 'jp-jpx-value-reform',
    displayName: '日股改革红利',
    humanPitch: '我买日本正在改革的好公司，改革=催化剂',
    scene: 'trend_chasing',
    difficulty: 3,
    holdingPeriod: '3-12个月',
    suitableFor: '相信日本公司治理改善故事的人',
  },
  'in-nifty50-rotation': {
    templateId: 'in-nifty50-rotation',
    displayName: '印度龙头轮动',
    humanPitch: '我在印度50大龙头里轮动，印度增长我吃红利',
    scene: 'trend_chasing',
    difficulty: 3,
    holdingPeriod: '1-6个月',
    suitableFor: '看好印度长期增长的人',
  },

  // ── 💸 Scene 3: Contrarian (3) ──
  'crypto-liquidation-hunt': {
    templateId: 'crypto-liquidation-hunt',
    displayName: '爆仓捡尸队',
    humanPitch: '我专抓爆仓踩踏后的反弹，别人爆仓我捡钱',
    scene: 'contrarian',
    difficulty: 4,
    holdingPeriod: '几小时-3天',
    suitableFor: '反应快、敢在别人恐慌时出手的人',
  },
  'crypto-funding-arb': {
    templateId: 'crypto-funding-arb',
    displayName: '资金费率温度计',
    humanPitch: '我用资金费率判断市场太热还是太冷，逆向操作',
    scene: 'contrarian',
    difficulty: 3,
    holdingPeriod: '1天-2周',
    suitableFor: '会看永续合约数据、有耐心的人',
  },
  'in-nse-inflation-hedge': {
    templateId: 'in-nse-inflation-hedge',
    displayName: '印度通胀护盾',
    humanPitch: '我在印度通胀高的时候买能抗通胀的股票',
    scene: 'contrarian',
    difficulty: 3,
    holdingPeriod: '3-12个月',
    suitableFor: '关注印度经济和通胀数据的人',
  },

  // ── 🛡️ Scene 4: Stable Income (4) ──
  'tw-twse-dividend': {
    templateId: 'tw-twse-dividend',
    displayName: '台股除权息日历',
    humanPitch: '我在台湾市场专做除权息行情，每年6-8月收钱',
    scene: 'income_stable',
    difficulty: 2,
    holdingPeriod: '2-4周(季节性)',
    suitableFor: '喜欢规律性交易机会的人',
  },
  'sg-sgx-reit': {
    templateId: 'sg-sgx-reit',
    displayName: '新加坡收租王',
    humanPitch: '我买新加坡REITs+金融股，收稳定的新币分红',
    scene: 'income_stable',
    difficulty: 1,
    holdingPeriod: '6-24个月',
    suitableFor: '喜欢稳定高分红、不折腾的人',
  },
  'au-asx-franking': {
    templateId: 'au-asx-franking',
    displayName: '澳洲Franking加成',
    humanPitch: '我买澳洲矿和银行股，还有Franking退税加成',
    scene: 'income_stable',
    difficulty: 2,
    holdingPeriod: '6-24个月',
    suitableFor: '想持有澳元资产、享受税务优惠的人',
  },
  'crypto-hodl-enhance': {
    templateId: 'crypto-hodl-enhance',
    displayName: '比特币增强定投',
    humanPitch: '我长期持有比特币，用少量仓位做波段增强收益',
    scene: 'income_stable',
    difficulty: 2,
    holdingPeriod: '长期持有+周度调仓',
    suitableFor: '相信比特币长期价值、不想频繁操作的人',
  },

  // ── 🎯 Scene 5: Event Catalyst (3) ──
  'crypto-whale-track': {
    templateId: 'crypto-whale-track',
    displayName: '巨鲸追踪者',
    humanPitch: '我跟踪巨鲸钱包地址，大户在买什么我买什么',
    scene: 'event_catalyst',
    difficulty: 3,
    holdingPeriod: '几小时-1周',
    suitableFor: '会看链上数据、反应快的人',
  },
  'hk-warrant-direction': {
    templateId: 'hk-warrant-direction',
    displayName: '涡轮罗盘',
    humanPitch: '我通过港股涡轮数据预判大资金意图',
    scene: 'event_catalyst',
    difficulty: 4,
    holdingPeriod: '1天-2周',
    suitableFor: '有港股经验、懂涡轮和牛熊证的人',
  },
  'crypto-onchain-3lights': {
    templateId: 'crypto-onchain-3lights',
    displayName: '链上三灯信号',
    humanPitch: '我看链上的三个灯：活跃地址+NVT+交易所余额',
    scene: 'event_catalyst',
    difficulty: 3,
    holdingPeriod: '1-4周',
    suitableFor: '会看链上数据、有一定技术背景的人',
  },

  // ── 🧪 Scene 6: Advanced Play (3) ──
  'cross-currency-carry': {
    templateId: 'cross-currency-carry',
    displayName: '外汇利差收割',
    humanPitch: '我借低息货币买高息货币，赚利差不用看方向',
    scene: 'advanced_play',
    difficulty: 4,
    holdingPeriod: '1-6个月',
    suitableFor: '懂外汇、会管理双边敞口的人',
  },
  'commodity-spread-pair': {
    templateId: 'commodity-spread-pair',
    displayName: '商品配对套利',
    humanPitch: '我同时买卖两种相关商品，赌价差回归正常',
    scene: 'advanced_play',
    difficulty: 4,
    holdingPeriod: '1-8周',
    suitableFor: '懂商品期货、会双边交易的人',
  },
  'cross-bond-carry': {
    templateId: 'cross-bond-carry',
    displayName: '全球债券利差',
    humanPitch: '我买高息国债卖低息国债，锁定利差收入',
    scene: 'advanced_play',
    difficulty: 4,
    holdingPeriod: '3-12个月',
    suitableFor: '懂固定收益、会跨市场操作的人',
  },
};

/** Quick-lookup: templateId -> scene */
export const TEMPLATE_SCENE_MAP: Record<string, StrategyScene> = {};
for (const [id, copy] of Object.entries(TEMPLATE_SCENE_COPY)) {
  TEMPLATE_SCENE_MAP[id] = copy.scene;
}

/** Quick-lookup: scene -> template count */
export function getTemplateCountByScene(scene: StrategyScene): number {
  return Object.values(TEMPLATE_SCENE_COPY).filter(t => t.scene === scene).length;
}

/** Get all template IDs for a scene */
export function getTemplatesByScene(scene: StrategyScene): string[] {
  return Object.entries(TEMPLATE_SCENE_COPY)
    .filter(([, t]) => t.scene === scene)
    .map(([id]) => id);
}

export default TEMPLATE_SCENE_COPY;
