// ══ R268 QClaw Task 1: 64新指标中文名+emoji (5h) ══
// 29→93指标追平TradingView。6大类: 趋势14 + 动量11 + 成交量13 + 波动8 + 中国10 + OrderFlow8
// 每个≤5字中文名 + 1emoji + ≤12字人话
// 交付: 指标注册表 — 直接喂给IndicatorSelector/ChartToolbarCustom

// ═══════════════════════════════════════
// TYPE
// ═══════════════════════════════════════

export interface NewIndicator64Entry {
  id: string;
  name: string;       // ≤5字中文名
  emoji: string;      // 1个emoji
  oneliner: string;   // ≤12字人话
  category: 'trend' | 'momentum' | 'volume' | 'volatility' | 'china' | 'orderflow';
  fullName: string;   // 完整英文名(面板tooltip用)
}

// ═══════════════════════════════════════
// 趋势类 — 14个 (移动平均/趋势判断/自适应)
// ═══════════════════════════════════════

export const TREND_14: NewIndicator64Entry[] = [
  { id: 'hma',        name: '赫尔均线',   emoji: '🚀', oneliner: '零滞后的超快均线',     category: 'trend', fullName: 'Hull Moving Average' },
  { id: 'kama',       name: '考夫曼均线',  emoji: '🧠', oneliner: '震荡市自动降低灵敏度',  category: 'trend', fullName: "Kaufman's Adaptive MA" },
  { id: 'tema',       name: '三重指数均',  emoji: '🔺', oneliner: '三重平滑——几乎无滞后',  category: 'trend', fullName: 'Triple Exponential MA' },
  { id: 'dema',       name: '双重指数均',  emoji: '🔹', oneliner: '比EMA快一倍反应速度',   category: 'trend', fullName: 'Double Exponential MA' },
  { id: 'zlema',      name: '零滞后均线',  emoji: '⚡', oneliner: '消除EMA的固有滞后',    category: 'trend', fullName: 'Zero-Lag EMA' },
  { id: 'alma',       name: '阿诺均线',   emoji: '🎯', oneliner: '高斯分布加权——平滑又灵敏', category: 'trend', fullName: 'Arnaud Legoux MA' },
  { id: 't3',         name: 'T3均线',    emoji: '🔬', oneliner: '最平滑的趋势线——无噪音', category: 'trend', fullName: 'T3 Moving Average' },
  { id: 'vidya',      name: '动态自适应',  emoji: '🌊', oneliner: '波动大时慢——波动小时快', category: 'trend', fullName: 'Variable Index Dynamic Average' },
  { id: 'mama',       name: '自适应均线',  emoji: '📡', oneliner: '检测市场相位自动调整',   category: 'trend', fullName: 'MESA Adaptive MA' },
  { id: 'mcginley',   name: '麦金利动态',  emoji: '🛡️', oneliner: '过滤假突破的利器',     category: 'trend', fullName: 'McGinley Dynamic' },
  { id: 'gmma',       name: '顾比均线组',  emoji: '🌈', oneliner: '12条EMA——大资金vs散户', category: 'trend', fullName: 'Guppy Multiple MA (12-line)' },
  { id: 'rainbow',    name: '彩虹均线',   emoji: '🌈', oneliner: '颜色渐变看趋势强度',     category: 'trend', fullName: 'Rainbow MA' },
  { id: 'jurik',      name: 'JMA均线',   emoji: '🪄', oneliner: '最低噪声——TradingView付费才有的', category: 'trend', fullName: 'Jurik MA' },
  { id: 'lsma',       name: '最小二乘均',  emoji: '📐', oneliner: '拟合趋势——比传统MA更准', category: 'trend', fullName: 'Least Squares MA' },
];

// ═══════════════════════════════════════
// 动量类 — 11个 (震荡/超买超卖/背离)
// ═══════════════════════════════════════

export const MOMENTUM_11: NewIndicator64Entry[] = [
  { id: 'stochrsi',   name: '随机RSI',   emoji: '🔄', oneliner: 'RSI的KD版——更敏感',    category: 'momentum', fullName: 'Stochastic RSI' },
  { id: 'ultosc',     name: '终极震荡',   emoji: '⚖️', oneliner: '三个周期加权——防假信号', category: 'momentum', fullName: 'Ultimate Oscillator' },
  { id: 'williamsr',  name: '威廉指标',   emoji: '🪟', oneliner: '拉里·威廉斯的超买超卖',  category: 'momentum', fullName: 'Williams %R' },
  { id: 'cmo',        name: '钱德动量',   emoji: '📊', oneliner: '比RSI更好的动量指标',    category: 'momentum', fullName: 'Chande Momentum Oscillator' },
  { id: 'rvi',        name: '相对活力',   emoji: '💓', oneliner: '收盘vs开盘的动量强弱',   category: 'momentum', fullName: 'Relative Vigor Index' },
  { id: 'ppo',        name: '百分比震荡',  emoji: '📉', oneliner: 'MACD的百分比版本',     category: 'momentum', fullName: 'Percentage Price Oscillator' },
  { id: 'kst',        name: '确然指标',   emoji: '✅', oneliner: '四个周期ROC确认趋势',   category: 'momentum', fullName: 'Know Sure Thing' },
  { id: 'tsi',        name: '真实强度',   emoji: '🔋', oneliner: '双平滑——比MACD更稳',   category: 'momentum', fullName: 'True Strength Index' },
  { id: 'dpo',        name: '去趋势震荡',  emoji: '🔍', oneliner: '剔除趋势后看纯周期波动', category: 'momentum', fullName: 'Detrended Price Oscillator' },
  { id: 'fisher',     name: '费雪变换',   emoji: '🔮', oneliner: '清晰拐点——数学变换信号', category: 'momentum', fullName: 'Fisher Transform' },
  { id: 'ergodic',    name: '遍历震荡',   emoji: '📻', oneliner: '噪音最低的MACD替代品',  category: 'momentum', fullName: 'Ergodic Oscillator' },
];

// ═══════════════════════════════════════
// 成交量类 — 13个 (量价关系/资金流/机构行为)
// ═══════════════════════════════════════

export const VOLUME_13: NewIndicator64Entry[] = [
  { id: 'ad',         name: '集散指标',   emoji: '📦', oneliner: '钱在收集还是派发筹码',   category: 'volume', fullName: 'A/D Line' },
  { id: 'fi',         name: '力量指数',   emoji: '💪', oneliner: '价×量=真正的趋势力量',  category: 'volume', fullName: 'Force Index' },
  { id: 'volosc',     name: '量能震荡',   emoji: '📢', oneliner: '成交量在放大还是萎缩',   category: 'volume', fullName: 'Volume Oscillator' },
  { id: 'nvi',        name: '缩量指数',   emoji: '🤫', oneliner: '缩量日——聪明钱在行动',  category: 'volume', fullName: 'Negative Volume Index' },
  { id: 'pvi',        name: '放量指数',   emoji: '📣', oneliner: '放量日——散户在跟风',    category: 'volume', fullName: 'Positive Volume Index' },
  { id: 'vwma',       name: '量权均线',   emoji: '⚖️', oneliner: '成交量大时权重高=更真实', category: 'volume', fullName: 'Volume-Weighted MA' },
  { id: 'mfi_vol',    name: '市场促进',   emoji: '🏟️', oneliner: '价与量的"配合度"检测', category: 'volume', fullName: 'Market Facilitation Index' },
  { id: 'vroc',       name: '量变速率',   emoji: '⏱️', oneliner: '成交量变化有多快——爆量信号', category: 'volume', fullName: 'Volume Rate of Change' },
  { id: 'pvt',        name: '量价趋势',   emoji: '📈', oneliner: '量加权的价格趋势线',     category: 'volume', fullName: 'Price Volume Trend' },
  { id: 'mfm',        name: '资金流向',   emoji: '💰', oneliner: '每根K线的真实流入流出',  category: 'volume', fullName: 'Money Flow Multiplier' },
  { id: 'obvm',       name: 'OBV均线',   emoji: '📊', oneliner: '给OBV加条移动平均线',    category: 'volume', fullName: 'OBV with Moving Average' },
  { id: 'twap',       name: '时间加权价',  emoji: '🕐', oneliner: '机构算法交易的基准价',   category: 'volume', fullName: 'Time-Weighted Average Price' },
  { id: 'chaikinvol',  name: '蔡金波幅',  emoji: '🌊', oneliner: '价差与成交量的关系',     category: 'volume', fullName: 'Chaikin Volatility' },
];

// ═══════════════════════════════════════
// 波动类 — 8个 (波动率/风险测量)
// ═══════════════════════════════════════

export const VOLATILITY_8: NewIndicator64Entry[] = [
  { id: 'atrp',       name: 'ATR百分比',  emoji: '📏', oneliner: '波动率归一化——跨股可比', category: 'volatility', fullName: 'ATR Percent' },
  { id: 'hv',         name: '历史波动率',  emoji: '📜', oneliner: '过去N天的实际波动有多大', category: 'volatility', fullName: 'Historical Volatility' },
  { id: 'ulcer',      name: '回撤指数',   emoji: '🩹', oneliner: '痛苦指数——最大回撤等于多少', category: 'volatility', fullName: 'Ulcer Index' },
  { id: 'gkvol',      name: 'G-K波动',   emoji: '📐', oneliner: '含OHLC的最全波动率估计', category: 'volatility', fullName: 'Garman-Klass Volatility' },
  { id: 'parkinson',  name: '日内波动',   emoji: '📏', oneliner: '只靠高低价的波动率',     category: 'volatility', fullName: 'Parkinson Volatility' },
  { id: 'yangzhang',  name: '隔夜波动',   emoji: '🌙', oneliner: '考虑了跳空缺口的波动率',  category: 'volatility', fullName: 'Yang-Zhang Volatility' },
  { id: 'bbwidth',    name: '布林宽度',   emoji: '↔️', oneliner: '布林带的宽窄——何时变盘', category: 'volatility', fullName: 'Bollinger Bandwidth' },
  { id: 'consec',     name: '连涨连跌',   emoji: '🔗', oneliner: '连续涨/跌的天数——极值反转', category: 'volatility', fullName: 'Consecutive Bars Count' },
];

// ═══════════════════════════════════════
// 中国类 — 10个 (A股特色/国内流行指标)
// ═══════════════════════════════════════

export const CHINA_10: NewIndicator64Entry[] = [
  { id: 'bbi',        name: '多空指数',   emoji: '⚔️', oneliner: '4条均线平均——多空分界',  category: 'china', fullName: 'BBI (Bull Bear Index)' },
  { id: 'dkx',        name: '多空线',     emoji: '🎚️', oneliner: '一目了然的持股/持币线',   category: 'china', fullName: 'DKX (Duo Kong Xian)' },
  { id: 'pbx',        name: '瀑布线',     emoji: '🌊', oneliner: '6条EMA——判别趋势强度',   category: 'china', fullName: 'PBX (Pu Bu Xian)' },
  { id: 'mike',       name: '麦克指标',   emoji: '📏', oneliner: '3档压力+3档支撑一目了然', category: 'china', fullName: 'MIKE Indicator' },
  { id: 'cyw',        name: '主力控盘',   emoji: '🕹️', oneliner: '主力控盘程度——越高越要拿住', category: 'china', fullName: 'CYW (Control Your Wealth)' },
  { id: 'cyx',        name: '市场强弱',   emoji: '💪', oneliner: '个股相对于大盘的强弱度',   category: 'china', fullName: 'CYX (Market Strength)' },
  { id: 'zjlj',       name: '资金统计',   emoji: '🏦', oneliner: '主力+散户资金净流向统计',  category: 'china', fullName: 'ZJLJ (Fund Flow Statistics)' },
  { id: 'zlmm',       name: '主力买卖',   emoji: '🐋', oneliner: '主力买入卖出力度对比',     category: 'china', fullName: 'ZLMM (Major Investor Buy/Sell)' },
  { id: 'ddy',        name: '大单动向',   emoji: '🔭', oneliner: '大单净买入/卖出的强度',    category: 'china', fullName: 'DDY (Big Order Dynamics)' },
  { id: 'ddy3',       name: '三日大单',   emoji: '📅', oneliner: '3日累计大单——过滤单日噪声', category: 'china', fullName: 'DDY3 (3-Day Big Order)' },
];

// ═══════════════════════════════════════
// OrderFlow类 — 8个 (订单流/微观结构)
// ═══════════════════════════════════════

export const ORDERFLOW_8: NewIndicator64Entry[] = [
  { id: 'delta',      name: '委托差',     emoji: '⚡', oneliner: '主动买-主动卖的净差值',   category: 'orderflow', fullName: 'Cumulative Delta' },
  { id: 'cdelta',     name: '累计委托差',  emoji: '📊', oneliner: '积累的买卖压力——方向偏哪边', category: 'orderflow', fullName: 'Cumulative Delta (cumulative)' },
  { id: 'bvav',       name: '买卖盘量比',  emoji: '⚖️', oneliner: '买盘vs卖盘的挂单量比',   category: 'orderflow', fullName: 'Bid/Ask Volume Ratio' },
  { id: 'depthr',     name: '深度比',     emoji: '🏔️', oneliner: '前5档买卖深度的力量对比',  category: 'orderflow', fullName: 'Depth Ratio (Top 5 levels)' },
  { id: 'imbalance',  name: '失衡率',     emoji: '📊', oneliner: '逐笔成交中买卖的失衡程度', category: 'orderflow', fullName: 'Trade Imbalance Ratio' },
  { id: 'flowpress',  name: '流向压力',   emoji: '💨', oneliner: '主动买vs主动卖的综合压力', category: 'orderflow', fullName: 'Flow Pressure Index' },
  { id: 'vpoc',       name: '量峰价位',   emoji: '🏔️', oneliner: '成交量最密集的价格——多空共识', category: 'orderflow', fullName: 'Volume POC (Point of Control)' },
  { id: 'vva',       name: '量分布区',    emoji: '📐', oneliner: '高成交量区=强支撑/阻力',  category: 'orderflow', fullName: 'Volume Value Area' },
];

// ═══════════════════════════════════════
// 合并全部64个
// ═══════════════════════════════════════

export const ALL_64_INDICATORS: NewIndicator64Entry[] = [
  ...TREND_14,
  ...MOMENTUM_11,
  ...VOLUME_13,
  ...VOLATILITY_8,
  ...CHINA_10,
  ...ORDERFLOW_8,
];

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function get64ById(id: string): NewIndicator64Entry | undefined {
  return ALL_64_INDICATORS.find(i => i.id === id);
}

export function get64ByCategory(cat: NewIndicator64Entry['category']): NewIndicator64Entry[] {
  return ALL_64_INDICATORS.filter(i => i.category === cat);
}

export function search64(query: string): NewIndicator64Entry[] {
  const q = query.toLowerCase();
  return ALL_64_INDICATORS.filter(i =>
    i.name.includes(q) || i.id.includes(q) || i.oneliner.includes(q) || i.fullName.toLowerCase().includes(q)
  );
}

export function get64CountsByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const i of ALL_64_INDICATORS) {
    counts[i.category] = (counts[i.category] || 0) + 1;
  }
  return counts;
}
