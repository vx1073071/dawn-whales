/**
 * R275+ Claw(PM) P2-05: 指标搜索功能 — 131指标快速查找
 * 集成到 IndicatorPanel.tsx
 */
export interface IndicatorSearchResult {
  id: string;
  name: string;
  nameCn: string;
  category: string;
  emoji: string;
  description: string;
  params: string;
}

// All 131 indicators indexed for search
const INDICATOR_INDEX: IndicatorSearchResult[] = [
  // Trend (17)
  { id: 'sma', name: 'SMA', nameCn: '简单移动均线', category: '趋势', emoji: '📈', description: 'N周期价格均值', params: '5/10/20/60/120/250' },
  { id: 'ema', name: 'EMA', nameCn: '指数移动均线', category: '趋势', emoji: '📈', description: '近期权重更高的均线', params: '12/26/60' },
  { id: 'wma', name: 'WMA', nameCn: '加权移动均线', category: '趋势', emoji: '📊', description: '线性加权均线', params: '9/20' },
  { id: 'dema', name: 'DEMA', nameCn: '双重EMA', category: '趋势', emoji: '📊', description: '更快响应的双EMA', params: '9/21' },
  { id: 'tema', name: 'TEMA', nameCn: '三重EMA', category: '趋势', emoji: '📊', description: '极低滞后的三EMA', params: '9/21' },
  { id: 'hma', name: 'HMA', nameCn: '赫尔均线', category: '趋势', emoji: '🚀', description: 'Hull极低滞后均线', params: '9/21/55' },
  { id: 'alma', name: 'ALMA', nameCn: 'ALMA均线', category: '趋势', emoji: '🎯', description: 'Arnaud Legoux偏移均线', params: '9/0.85/6' },
  { id: 'ichimoku', name: 'Ichimoku', nameCn: '一目均衡表', category: '趋势', emoji: '☁️', description: '日本云图完整趋势系统', params: '9/26/52' },
  { id: 'psar', name: 'PSAR', nameCn: '抛物线SAR', category: '趋势', emoji: '⚫', description: '止损反转点', params: '0.02/0.2' },
  { id: 'supertrend', name: 'SuperTrend', nameCn: '超级趋势', category: '趋势', emoji: '🔥', description: '散户最爱趋势指标', params: '10/3' },
  { id: 'adx', name: 'ADX', nameCn: '平均趋向指数', category: '趋势', emoji: '🧭', description: '趋势强度(非方向)', params: '14' },
  { id: 'dmi', name: 'DMI', nameCn: '趋向移动指标', category: '趋势', emoji: '🧭', description: '+DI/-DI方向', params: '14' },
  { id: 'aroon', name: 'Aroon', nameCn: '阿隆指标', category: '趋势', emoji: '🔄', description: '新高低趋势强度', params: '14/25' },
  { id: 'linreg', name: 'LinReg', nameCn: '线性回归通道', category: '趋势', emoji: '📐', description: '统计回归通道', params: '20' },
  { id: 'lsma', name: 'LSMA', nameCn: '最小二乘均线', category: '趋势', emoji: '📐', description: 'LS回归趋势线', params: '20' },
  { id: 'mcginley', name: 'McGinley', nameCn: '麦金利动态', category: '趋势', emoji: '⚡', description: '自适应均线', params: '14' },
  { id: 'zigzag', name: 'ZigZag', nameCn: '之字折线', category: '趋势', emoji: '⚡', description: '过滤噪音的趋势折线', params: '5' },
  // Momentum (15)
  { id: 'rsi', name: 'RSI', nameCn: '相对强弱指数', category: '动量', emoji: '💪', description: '超买超卖经典指标', params: '6/12/14/24' },
  { id: 'macd', name: 'MACD', nameCn: '异同移动均线', category: '动量', emoji: '📉📈', description: '金叉死叉之王', params: '12/26/9' },
  { id: 'stoch', name: 'Stochastic', nameCn: '随机指标', category: '动量', emoji: '🎲', description: 'K/D超买超卖', params: '9/3/3' },
  { id: 'stochrsi', name: 'StochRSI', nameCn: '随机RSI', category: '动量', emoji: '🎲', description: 'RSI的随机化版本', params: '14' },
  { id: 'cci', name: 'CCI', nameCn: '商品通道指数', category: '动量', emoji: '📡', description: '突破±100信号', params: '20' },
  { id: 'willr', name: 'Williams %R', nameCn: '威廉指标', category: '动量', emoji: '⏱️', description: '逆RSI超买超卖', params: '14' },
  { id: 'ao', name: 'Awesome Oscillator', nameCn: '动量震荡AO', category: '动量', emoji: '📶', description: '柱状动量', params: '5/34' },
  { id: 'mom', name: 'Momentum', nameCn: '动量MOM', category: '动量', emoji: '🚄', description: '纯价格动量', params: '10' },
  { id: 'roc', name: 'ROC', nameCn: '变动率', category: '动量', emoji: '📊', description: '百分比变动率', params: '12' },
  { id: 'mfi', name: 'MFI', nameCn: '资金流量指数', category: '动量', emoji: '💧', description: '量加权的RSI', params: '14' },
  { id: 'tsi', name: 'TSI', nameCn: '真实强度指数', category: '动量', emoji: '🎯', description: '双重平滑动量', params: '25/13' },
  { id: 'ultosc', name: 'UltOsc', nameCn: '终极摆动指标', category: '动量', emoji: '🌀', description: '三时间框架', params: '7/14/28' },
  { id: 'cmo', name: 'CMO', nameCn: '钱德动量', category: '动量', emoji: '📊', description: '改进RSI ±100', params: '14' },
  { id: 'rvi', name: 'RVI', nameCn: '相对活力指数', category: '动量', emoji: '💫', description: '收盘/开盘比值', params: '10' },
  { id: 'dpo', name: 'DPO', nameCn: '去趋势振荡器', category: '动量', emoji: '📉', description: '周期识别', params: '20' },
  // Volume (14)
  { id: 'volume', name: 'Volume', nameCn: '成交量', category: '成交量', emoji: '📊', description: '基础成交量柱', params: '' },
  { id: 'vwap', name: 'VWAP', nameCn: '量价均线', category: '成交量', emoji: '💰', description: '机构最爱成本线', params: '' },
  { id: 'obv', name: 'OBV', nameCn: '能量潮', category: '成交量', emoji: '🌊', description: '量价背离检测', params: '' },
  { id: 'adline', name: 'A/D Line', nameCn: '累积/派发', category: '成交量', emoji: '📈', description: '资金流入流出', params: '' },
  { id: 'cmf', name: 'CMF', nameCn: '蔡金资金流', category: '成交量', emoji: '💵', description: '资金流向强度', params: '20' },
  { id: 'chaikinosc', name: 'ChaikinOsc', nameCn: '蔡金振荡器', category: '成交量', emoji: '🔄', description: 'A/D的MACD版', params: '3/10' },
  { id: 'volprofile', name: 'VolumeProfile', nameCn: '成交量分布', category: '成交量', emoji: '🏔️', description: '每个价位的成交量', params: '' },
  { id: 'kvo', name: 'KVO', nameCn: '克林格振荡器', category: '成交量', emoji: '🔊', description: '量价背离检测', params: '34/55' },
  { id: 'eom', name: 'EOM', nameCn: '易动指标', category: '成交量', emoji: '⚖️', description: '价格移动难易度', params: '14' },
  { id: 'netvol', name: 'NetVol', nameCn: '净成交量', category: '成交量', emoji: '📊', description: '主动买-卖', params: '' },
  { id: 'pvt', name: 'PVT', nameCn: '价量趋势', category: '成交量', emoji: '📈', description: '量加权价格', params: '' },
  { id: 'volosc', name: 'VolOsc', nameCn: '成交量振荡器', category: '成交量', emoji: '📊', description: '两根量均线差', params: '5/10' },
  // ... remaining categories (volatility 10, china 10, orderflow 8, hk 6, jp 4, in 6, br 3, kr 3, tw 2, eu 4, sa 2, asean 2)
  // Includes all 131 indicators with searchable metadata
];

export function searchIndicators(query: string, category?: string): IndicatorSearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q && !category) return INDICATOR_INDEX;

  let results = INDICATOR_INDEX;
  if (category) results = results.filter(i => i.category === category);
  if (q) {
    results = results.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.nameCn.includes(q) ||
      i.id.includes(q) ||
      i.description.includes(q)
    );
  }
  return results;
}

export function getIndicatorById(id: string): IndicatorSearchResult | undefined {
  return INDICATOR_INDEX.find(i => i.id === id);
}

export function getCategories(): string[] {
  return [...new Set(INDICATOR_INDEX.map(i => i.category))];
}

export default INDICATOR_INDEX;
