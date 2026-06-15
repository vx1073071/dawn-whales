// ── R228 auto-2.4a: Template Parameter Human Labels ─────────────────────
// 46 templates × 3-5 parameters → zh-CN/en/ja human-readable labels
// Used by ParameterPanel (ML-2.4b) and factor detail pages
//
// Design: Each template has 3-5 "exposed parameters" that users can
// tweak. These are factor weights, iron-rule thresholds, stop-loss
// levels, and time-horizon settings — translated into plain language.

export interface ParamHumanLabel {
  /** Parameter key (used in code / URL params) */
  key: string;
  /** zh-CN display name */
  nameCN: string;
  /** English display name */
  nameEN: string;
  /** Japanese display name */
  nameJA: string;
  /** One-line description in Chinese */
  descCN: string;
  /** One-line description in English */
  descEN: string;
  /** One-line description in Japanese */
  descJA: string;
  /** Type for UI rendering */
  type: 'slider' | 'toggle' | 'select' | 'number';
  /** Slider range [min, max, step] */
  range?: [number, number, number];
  /** Default value */
  defaultValue: number | boolean | string;
  /** Unit suffix */
  unit?: string;
}

export interface TemplateParamSet {
  templateId: string;
  templateNameCn: string;
  params: ParamHumanLabel[];
}

// ═══════════ Shared Parameter Library ════════════════════════════════════

const P = {
  // ─── Factor Weight ────────────────────────────────────────────────
  FACTOR_WEIGHT: (factorName: string, factorNameEn: string, factorNameJa: string): ParamHumanLabel => ({
    key: `weight_${factorNameEn.toLowerCase().replace(/\s+/g, '_')}`,
    nameCN: `${factorName}权重`,
    nameEN: `${factorNameEn} Weight`,
    nameJA: `${factorNameJa}の重み`,
    descCN: `${factorName}因子在组合中的占比`,
    descEN: `Weight of ${factorNameEn} factor in the portfolio`,
    descJA: `ポートフォリオにおける${factorNameJa}ファクターの割合`,
    type: 'slider',
    range: [0, 100, 1],
    defaultValue: 25,
    unit: '%',
  }),

  STOP_LOSS: (defaultPct: number = 8): ParamHumanLabel => ({
    key: 'stop_loss',
    nameCN: '止损线',
    nameEN: 'Stop Loss',
    nameJA: '損切りライン',
    descCN: `触发止损的价格下跌百分比(${defaultPct}%)`,
    descEN: `Price drop percentage that triggers stop loss (${defaultPct}%)`,
    descJA: `損切りを発動する価格下落率(${defaultPct}%)`,
    type: 'slider',
    range: [1, 25, 1],
    defaultValue: defaultPct,
    unit: '%',
  }),

  TAKE_PROFIT: (defaultPct: number = 15): ParamHumanLabel => ({
    key: 'take_profit',
    nameCN: '止盈线',
    nameEN: 'Take Profit',
    nameJA: '利確ライン',
    descCN: `触发止盈的价格上涨百分比(${defaultPct}%)`,
    descEN: `Price increase percentage that triggers take profit (${defaultPct}%)`,
    descJA: `利確を発動する価格上昇率(${defaultPct}%)`,
    type: 'slider',
    range: [5, 100, 1],
    defaultValue: defaultPct,
    unit: '%',
  }),

  HOLDING_DAYS: (min: number, max: number): ParamHumanLabel => ({
    key: 'holding_days',
    nameCN: '持仓天数',
    nameEN: 'Holding Days',
    nameJA: '保有日数',
    descCN: `建议持仓${min}-${max}天`,
    descEN: `Recommended holding period of ${min}-${max} days`,
    descJA: `推奨保有期間${min}-${max}日`,
    type: 'slider',
    range: [min, max, 1],
    defaultValue: Math.round((min + max) / 2),
    unit: '天',
  }),

  IC_THRESHOLD: (defaultIC: number = 0.3): ParamHumanLabel => ({
    key: 'ic_threshold',
    nameCN: 'IC阈值',
    nameEN: 'IC Threshold',
    nameJA: 'ICしきい値',
    descCN: `因子信息系数最低要求(${defaultIC})`,
    descEN: `Minimum Information Coefficient for factor selection (${defaultIC})`,
    descJA: `ファクター選択のIC最低基準(${defaultIC})`,
    type: 'slider',
    range: [0.1, 0.8, 0.05],
    defaultValue: defaultIC,
  }),

  MAX_DRAWDOWN: (defaultMDD: number = 15): ParamHumanLabel => ({
    key: 'max_drawdown',
    nameCN: '最大回撤限制',
    nameEN: 'Max Drawdown Limit',
    nameJA: '最大ドローダウン制限',
    descCN: `组合最大可接受回撤(${defaultMDD}%)`,
    descEN: `Maximum acceptable portfolio drawdown (${defaultMDD}%)`,
    descJA: `許容可能な最大ドローダウン(${defaultMDD}%)`,
    type: 'slider',
    range: [5, 50, 1],
    defaultValue: defaultMDD,
    unit: '%',
  }),

  POSITION_SIZE: (defaultPct: number = 10): ParamHumanLabel => ({
    key: 'position_size',
    nameCN: '仓位比例',
    nameEN: 'Position Size',
    nameJA: 'ポジションサイズ',
    descCN: `单笔交易占总资金比例(${defaultPct}%)`,
    descEN: `Percentage of total capital per trade (${defaultPct}%)`,
    descJA: `取引あたりの総資金割合(${defaultPct}%)`,
    type: 'slider',
    range: [1, 100, 1],
    defaultValue: defaultPct,
    unit: '%',
  }),

  LEVERAGE: (): ParamHumanLabel => ({
    key: 'leverage',
    nameCN: '杠杆倍数',
    nameEN: 'Leverage',
    nameJA: 'レバレッジ',
    descCN: '交易杠杆倍数(1=无杠杆)',
    descEN: 'Trading leverage multiplier (1 = no leverage)',
    descJA: '取引レバレッジ倍率(1=レバなし)',
    type: 'select',
    defaultValue: 1,
  }),

  CORRELATION_MAX: (): ParamHumanLabel => ({
    key: 'correlation_max',
    nameCN: '最大相关性',
    nameEN: 'Max Correlation',
    nameJA: '最大相関',
    descCN: '因子间最大允许相关性(避免过度集中)',
    descEN: 'Maximum allowed correlation between factors (avoid overconcentration)',
    descJA: 'ファクター間の最大許容相関(過集中回避)',
    type: 'slider',
    range: [0.3, 1.0, 0.05],
    defaultValue: 0.7,
  }),

  REBALANCE_FREQ: (): ParamHumanLabel => ({
    key: 'rebalance_freq',
    nameCN: '再平衡频率',
    nameEN: 'Rebalance Frequency',
    nameJA: 'リバランス頻度',
    descCN: '多久重新评估因子权重',
    descEN: 'How often factor weights are re-evaluated',
    descJA: 'ファクター重みを再評価する頻度',
    type: 'select',
    defaultValue: 'weekly',
  }),

  MARKET_REGIME: (): ParamHumanLabel => ({
    key: 'market_regime',
    nameCN: '市场风格偏好',
    nameEN: 'Market Regime Preference',
    nameJA: '市場レジーム選好',
    descCN: '策略偏好的市场风格(防守/均衡/进攻)',
    descEN: 'Preferred market regime for strategy (defensive/balanced/offensive)',
    descJA: '戦略の市場レジーム選好(防御/均衡/攻撃)',
    type: 'select',
    defaultValue: 'balanced',
  }),
};

// ═══════════ 46 Template Parameter Sets ══════════════════════════════════

export const TEMPLATE_PARAM_SETS: TemplateParamSet[] = [
  // ═══ HK (6) ═══
  {
    templateId: 'hk-ah-premium',
    templateNameCn: 'AH溢价套利',
    params: [
      P.FACTOR_WEIGHT('AH溢价', 'AH Premium', 'AHプレミアム'),
      P.STOP_LOSS(5),
      P.TAKE_PROFIT(12),
      P.POSITION_SIZE(8),
      P.REBALANCE_FREQ(),
    ],
  },
  {
    templateId: 'hk-warrant-trading',
    templateNameCn: '涡轮交易',
    params: [
      P.FACTOR_WEIGHT('涡轮IV', 'Warrant IV', 'ワラントIV'),
      P.STOP_LOSS(8),
      P.LEVERAGE(),
      P.POSITION_SIZE(5),
      P.HOLDING_DAYS(1, 7),
    ],
  },
  {
    templateId: 'hk-dividend-value',
    templateNameCn: '港股高息价值',
    params: [
      P.FACTOR_WEIGHT('股息率', 'Dividend Yield', '配当利回り'),
      P.FACTOR_WEIGHT('价值', 'Value', 'バリュー'),
      P.HOLDING_DAYS(30, 180),
      P.TAKE_PROFIT(20),
      P.STOP_LOSS(10),
    ],
  },
  {
    templateId: 'hk-reit-yield',
    templateNameCn: 'REIT收息策略',
    params: [
      P.FACTOR_WEIGHT('REIT收益', 'REIT Yield', 'REIT利回り'),
      P.HOLDING_DAYS(60, 365),
      P.TAKE_PROFIT(15),
      P.POSITION_SIZE(12),
    ],
  },
  {
    templateId: 'hk-ipo-flip',
    templateNameCn: '港股打新',
    params: [
      P.STOP_LOSS(3),
      P.TAKE_PROFIT(10),
      P.POSITION_SIZE(5),
      P.HOLDING_DAYS(1, 5),
      P.MARKET_REGIME(),
    ],
  },
  {
    templateId: 'hk-short-sell',
    templateNameCn: '港股沽空',
    params: [
      P.FACTOR_WEIGHT('沽空比率', 'Short Sell Ratio', '空売り比率'),
      P.STOP_LOSS(5),
      P.TAKE_PROFIT(10),
      P.LEVERAGE(),
      P.HOLDING_DAYS(1, 14),
    ],
  },

  // ═══ Crypto (8) ═══
  {
    templateId: 'crypto-funding-rate',
    templateNameCn: '资金费率套利',
    params: [
      P.FACTOR_WEIGHT('资金费率', 'Funding Rate', 'ファンディングレート'),
      P.HOLDING_DAYS(1, 3),
      P.LEVERAGE(),
      P.POSITION_SIZE(10),
    ],
  },
  {
    templateId: 'crypto-momentum-breakout',
    templateNameCn: '加密动量突破',
    params: [
      P.FACTOR_WEIGHT('动量', 'Momentum', 'モメンタム'),
      P.STOP_LOSS(7),
      P.TAKE_PROFIT(25),
      P.HOLDING_DAYS(3, 14),
      P.IC_THRESHOLD(0.25),
    ],
  },
  {
    templateId: 'crypto-onchain-flow',
    templateNameCn: '链上资金流跟踪',
    params: [
      P.FACTOR_WEIGHT('交易所流', 'Exchange Flow', '取引所フロー'),
      P.FACTOR_WEIGHT('聪明钱', 'Smart Money', 'スマートマネー'),
      P.HOLDING_DAYS(7, 30),
      P.CORRELATION_MAX(),
    ],
  },
  {
    templateId: 'crypto-btc-dominance',
    templateNameCn: 'BTC主导轮动',
    params: [
      P.FACTOR_WEIGHT('BTC相关', 'BTC Correlation', 'BTC相関'),
      P.HOLDING_DAYS(14, 60),
      P.POSITION_SIZE(15),
      P.MARKET_REGIME(),
    ],
  },
  {
    templateId: 'crypto-alt-season',
    templateNameCn: '山寨季策略',
    params: [
      P.FACTOR_WEIGHT('Alt-Season', 'Alt Season', 'アルトシーズン'),
      P.FACTOR_WEIGHT('社交情绪', 'Social Sentiment', 'ソーシャル感情'),
      P.HOLDING_DAYS(7, 30),
      P.STOP_LOSS(10),
      P.TAKE_PROFIT(40),
    ],
  },
  {
    templateId: 'crypto-whale-tracking',
    templateNameCn: '大户跟踪',
    params: [
      P.FACTOR_WEIGHT('大户累积', 'Whale Accum', 'ホエール蓄積'),
      P.HOLDING_DAYS(7, 30),
      P.STOP_LOSS(8),
      P.TAKE_PROFIT(20),
      P.POSITION_SIZE(10),
    ],
  },
  {
    templateId: 'crypto-defi-yield',
    templateNameCn: 'DeFi收益聚合',
    params: [
      P.FACTOR_WEIGHT('质押收益', 'Staking Yield', 'ステーキング利回り'),
      P.FACTOR_WEIGHT('TVL增长', 'TVL Growth', 'TVL成長'),
      P.HOLDING_DAYS(30, 180),
      P.MAX_DRAWDOWN(20),
    ],
  },
  {
    templateId: 'crypto-nft-bluechip',
    templateNameCn: 'NFT蓝筹',
    params: [
      P.FACTOR_WEIGHT('社交情绪', 'Social Sentiment', 'ソーシャル感情'),
      P.HOLDING_DAYS(14, 90),
      P.STOP_LOSS(15),
      P.POSITION_SIZE(5),
    ],
  },

  // ═══ JP/KR/TW (5) ═══
  {
    templateId: 'jp-value-repair',
    templateNameCn: '日股价值修复',
    params: [
      P.FACTOR_WEIGHT('市净率', 'P/B Ratio', 'PBR'),
      P.HOLDING_DAYS(30, 180),
      P.TAKE_PROFIT(20),
      P.MAX_DRAWDOWN(15),
    ],
  },
  {
    templateId: 'jp-nisa-toushin',
    templateNameCn: 'NISA定投',
    params: [
      P.FACTOR_WEIGHT('ROE', 'ROE', 'ROE'),
      P.HOLDING_DAYS(365, 1825),
      P.POSITION_SIZE(20),
      P.REBALANCE_FREQ(),
    ],
  },
  {
    templateId: 'kr-momentum-sector',
    templateNameCn: '韩国动量板块',
    params: [
      P.FACTOR_WEIGHT('动量', 'Momentum', 'モメンタム'),
      P.HOLDING_DAYS(14, 60),
      P.STOP_LOSS(8),
      P.TAKE_PROFIT(20),
    ],
  },
  {
    templateId: 'kr-export-cycle',
    templateNameCn: '韩国出口周期',
    params: [
      P.FACTOR_WEIGHT('出口数据', 'Export Data', '輸出データ'),
      P.HOLDING_DAYS(30, 180),
      P.POSITION_SIZE(12),
      P.MARKET_REGIME(),
    ],
  },
  {
    templateId: 'tw-dividend-ex',
    templateNameCn: '台股除权息',
    params: [
      P.FACTOR_WEIGHT('股息率', 'Dividend Yield', '配当利回り'),
      P.HOLDING_DAYS(30, 60),
      P.TAKE_PROFIT(10),
      P.STOP_LOSS(5),
    ],
  },

  // ═══ SG/AU/IN (4) ═══
  {
    templateId: 'sg-financial-yield',
    templateNameCn: '新加坡金融高息',
    params: [
      P.FACTOR_WEIGHT('股息率', 'Dividend Yield', '配当利回り'),
      P.HOLDING_DAYS(60, 365),
      P.TAKE_PROFIT(15),
      P.POSITION_SIZE(10),
    ],
  },
  {
    templateId: 'au-resource-franking',
    templateNameCn: '澳洲资源+Franking',
    params: [
      P.FACTOR_WEIGHT('资源', 'Resources', '資源'),
      P.FACTOR_WEIGHT('Franking', 'Franking Credits', 'フランキング'),
      P.HOLDING_DAYS(60, 365),
    ],
  },
  {
    templateId: 'in-it-outsource',
    templateNameCn: '印度IT外包',
    params: [
      P.FACTOR_WEIGHT('增长', 'Growth', 'グロース'),
      P.HOLDING_DAYS(90, 365),
      P.STOP_LOSS(10),
      P.POSITION_SIZE(10),
    ],
  },
  {
    templateId: 'in-inflation-hedge',
    templateNameCn: '印度通胀对冲',
    params: [
      P.FACTOR_WEIGHT('黄金', 'Gold', 'ゴールド'),
      P.FACTOR_WEIGHT('REIT', 'REIT', 'REIT'),
      P.HOLDING_DAYS(90, 365),
      P.MAX_DRAWDOWN(12),
    ],
  },

  // ═══ EU (1) ═══
  {
    templateId: 'eu-esg-premium',
    templateNameCn: '欧洲ESG溢价',
    params: [
      P.FACTOR_WEIGHT('ESG评分', 'ESG Score', 'ESGスコア'),
      P.HOLDING_DAYS(90, 365),
      P.TAKE_PROFIT(15),
      P.REBALANCE_FREQ(),
    ],
  },

  // ═══ Cross-market (4) ═══
  {
    templateId: 'xm-fx-carry',
    templateNameCn: '外汇利差交易',
    params: [
      P.FACTOR_WEIGHT('利差', 'Carry', 'キャリー'),
      P.HOLDING_DAYS(14, 90),
      P.STOP_LOSS(5),
      P.LEVERAGE(),
    ],
  },
  {
    templateId: 'xm-gold-silver',
    templateNameCn: '金银比套利',
    params: [
      P.FACTOR_WEIGHT('金银比', 'Gold/Silver', '金銀比率'),
      P.HOLDING_DAYS(7, 30),
      P.STOP_LOSS(3),
      P.TAKE_PROFIT(8),
    ],
  },
  {
    templateId: 'xm-commodity-spread',
    templateNameCn: '商品期现套利',
    params: [
      P.FACTOR_WEIGHT('期现价差', 'Term Structure', '期間構造'),
      P.HOLDING_DAYS(7, 30),
      P.STOP_LOSS(5),
      P.POSITION_SIZE(8),
    ],
  },
  {
    templateId: 'xm-correlation-harvest',
    templateNameCn: '相关性轮动',
    params: [
      P.CORRELATION_MAX(),
      P.HOLDING_DAYS(14, 60),
      P.REBALANCE_FREQ(),
      P.POSITION_SIZE(10),
    ],
  },

  // ═══ AI (10) ═══
  {
    templateId: 'ai-sentiment-synth',
    templateNameCn: 'AI情绪合成',
    params: [
      P.FACTOR_WEIGHT('情绪', 'Sentiment', 'センチメント'),
      P.HOLDING_DAYS(3, 14),
      P.IC_THRESHOLD(0.2),
      P.STOP_LOSS(5),
    ],
  },
  {
    templateId: 'ai-pattern-detect',
    templateNameCn: 'AI形态识别',
    params: [
      P.FACTOR_WEIGHT('形态', 'Pattern', 'パターン'),
      P.HOLDING_DAYS(1, 7),
      P.STOP_LOSS(3),
      P.TAKE_PROFIT(8),
      P.POSITION_SIZE(5),
    ],
  },
  {
    templateId: 'ai-anomaly-hunt',
    templateNameCn: 'AI异常检测',
    params: [
      P.FACTOR_WEIGHT('异常', 'Anomaly', '異常'),
      P.HOLDING_DAYS(1, 7),
      P.STOP_LOSS(4),
      P.TAKE_PROFIT(12),
    ],
  },
  {
    templateId: 'ai-nlp-news',
    templateNameCn: 'AI新闻NLP',
    params: [
      P.FACTOR_WEIGHT('新闻', 'News', 'ニュース'),
      P.HOLDING_DAYS(1, 7),
      P.STOP_LOSS(4),
      P.IC_THRESHOLD(0.15),
    ],
  },
  {
    templateId: 'ai-regime-switch',
    templateNameCn: 'AI体制切换',
    params: [
      P.MARKET_REGIME(),
      P.HOLDING_DAYS(7, 30),
      P.STOP_LOSS(6),
      P.MAX_DRAWDOWN(15),
    ],
  },
  {
    templateId: 'ai-factor-orchestra',
    templateNameCn: 'AI因子交响',
    params: [
      P.IC_THRESHOLD(0.25),
      P.CORRELATION_MAX(),
      P.HOLDING_DAYS(7, 30),
      P.REBALANCE_FREQ(),
      P.MAX_DRAWDOWN(12),
    ],
  },
  {
    templateId: 'ai-crowding-evade',
    templateNameCn: 'AI拥挤回避',
    params: [
      P.FACTOR_WEIGHT('拥挤度', 'Crowding', 'クラウディング'),
      P.HOLDING_DAYS(7, 30),
      P.STOP_LOSS(6),
      P.CORRELATION_MAX(),
    ],
  },
  {
    templateId: 'ai-earnings-predict',
    templateNameCn: 'AI财报预测',
    params: [
      P.FACTOR_WEIGHT('盈利', 'Earnings', '収益'),
      P.HOLDING_DAYS(14, 30),
      P.STOP_LOSS(5),
      P.TAKE_PROFIT(15),
      P.IC_THRESHOLD(0.2),
    ],
  },
  {
    templateId: 'ai-macro-nowcast',
    templateNameCn: 'AI宏观Nowcasting',
    params: [
      P.FACTOR_WEIGHT('宏观', 'Macro', 'マクロ'),
      P.HOLDING_DAYS(14, 60),
      P.STOP_LOSS(8),
      P.MAX_DRAWDOWN(15),
    ],
  },
  {
    templateId: 'ai-tail-risk',
    templateNameCn: 'AI尾部风险',
    params: [
      P.MAX_DRAWDOWN(10),
      P.STOP_LOSS(5),
      P.POSITION_SIZE(5),
      P.HOLDING_DAYS(3, 14),
    ],
  },

  // ═══ Supplement (8) ═══
  {
    templateId: 'supply-hk-southbound-leader',
    templateNameCn: '南向资金领先',
    params: [
      P.FACTOR_WEIGHT('南向资金', 'Southbound', 'サウスバウンド'),
      P.HOLDING_DAYS(7, 30),
      P.STOP_LOSS(6),
      P.POSITION_SIZE(10),
    ],
  },
  {
    templateId: 'supply-crypto-defi-bluechip',
    templateNameCn: 'DeFi蓝筹组合',
    params: [
      P.FACTOR_WEIGHT('TVL', 'TVL', 'TVL'),
      P.HOLDING_DAYS(30, 180),
      P.MAX_DRAWDOWN(20),
      P.REBALANCE_FREQ(),
    ],
  },
  {
    templateId: 'supply-ai-deepseek-conv',
    templateNameCn: 'DeepSeek对话策略',
    params: [
      P.IC_THRESHOLD(0.15),
      P.HOLDING_DAYS(1, 14),
      P.STOP_LOSS(5),
      P.TAKE_PROFIT(10),
      P.POSITION_SIZE(8),
    ],
  },
  {
    templateId: 'supply-in-nifty50-rotation',
    templateNameCn: 'Nifty50轮动',
    params: [
      P.FACTOR_WEIGHT('动量', 'Momentum', 'モメンタム'),
      P.HOLDING_DAYS(30, 90),
      P.STOP_LOSS(8),
      P.REBALANCE_FREQ(),
    ],
  },
  {
    templateId: 'supply-xm-bond-spread',
    templateNameCn: '债券利差',
    params: [
      P.FACTOR_WEIGHT('利差', 'Spread', 'スプレッド'),
      P.HOLDING_DAYS(30, 180),
      P.STOP_LOSS(5),
      P.MAX_DRAWDOWN(10),
    ],
  },
  {
    templateId: 'supply-xm-vol-arb',
    templateNameCn: '波动率套利',
    params: [
      P.FACTOR_WEIGHT('波动率', 'Volatility', 'ボラティリティ'),
      P.HOLDING_DAYS(3, 14),
      P.STOP_LOSS(4),
      P.LEVERAGE(),
    ],
  },
  {
    templateId: 'supply-crypto-layer2',
    templateNameCn: 'L2生态',
    params: [
      P.FACTOR_WEIGHT('开发者', 'Developer Activity', '開発者活動'),
      P.HOLDING_DAYS(30, 180),
      P.STOP_LOSS(12),
      P.POSITION_SIZE(8),
    ],
  },
  {
    templateId: 'supply-ai-risk-parity',
    templateNameCn: 'AI风险平价',
    params: [
      P.MAX_DRAWDOWN(8),
      P.CORRELATION_MAX(),
      P.HOLDING_DAYS(14, 60),
      P.REBALANCE_FREQ(),
      P.IC_THRESHOLD(0.2),
    ],
  },
];

// ═══════════ Lookup API ══════════════════════════════════════════════════

const paramMap = new Map<string, TemplateParamSet>();
TEMPLATE_PARAM_SETS.forEach(t => paramMap.set(t.templateId, t));

/** Get parameter labels for a template */
export function getTemplateParams(templateId: string): ParamHumanLabel[] {
  return paramMap.get(templateId)?.params || [];
}

/** Get all parameter sets */
export function getAllTemplateParams(): TemplateParamSet[] {
  return TEMPLATE_PARAM_SETS;
}

/** Get param by key from a specific template */
export function getTemplateParam(templateId: string, paramKey: string): ParamHumanLabel | undefined {
  const set = paramMap.get(templateId);
  return set?.params.find(p => p.key === paramKey);
}

/** Total templates with parameter labels */
export const TEMPLATE_PARAM_COVERAGE = {
  templates: TEMPLATE_PARAM_SETS.length,
  totalParams: TEMPLATE_PARAM_SETS.reduce((sum, t) => sum + t.params.length, 0),
  languages: 3,
};
