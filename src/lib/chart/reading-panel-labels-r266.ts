// ══ R266 QClaw Task 2: 读数面板标签文案 (1h) ══
// P1-06: 图表右侧指标读数面板 — 每个指标的名字/数值/信号/状态全部中文标签
// 交付: 面板配置 — 接入即将到来的读数面板UI组件

// ═══════════════════════════════════════
// TYPE: 面板配置
// ═══════════════════════════════════════

export interface ReadingPanelConfig {
  header: {
    title: string;              // 面板标题
    collapse: string;           // 折叠按钮tooltip
    expand: string;             // 展开按钮tooltip
    settings: string;           // 设置按钮tooltip
    empty: string;              // 无指标时的提示
    addIndicator: string;       // "添加指标"按钮
  };
  indicator: {
    valueLabel: string;         // "当前值"
    changeLabel: string;        // "变化"
    signalLabel: string;        // "信号"
    prevLabel: string;          // "上根K线"
    maLabel: string;            // "MA20参考"
  };
  trends: {
    up: string;                 // 上涨趋势文本
    upStrong: string;           // 大幅上涨
    down: string;               // 下跌
    downStrong: string;         // 大幅下跌
    flat: string;               // 持平
  };
  signals: SignalLabelSet;
  unitLabels: Record<string, string>; // 单位标注
  tooltips: Record<string, string>;   // hover解释
}

export interface SignalLabelSet {
  // MACD
  macdGoldenCross: string;     // "金叉↑"
  macdDeadCross: string;       // "死叉↓"
  macdAboveZero: string;       // "零轴上方"
  macdBelowZero: string;       // "零轴下方"
  macdDivergence: string;      // "背离⚠️"

  // RSI
  rsiOverbought: string;       // "超买"
  rsiOversold: string;         // "超卖"
  rsiNeutral: string;          // "正常"
  rsiExtreme: string;          // "极端"

  // KDJ
  kdjOverbought: string;       // "超买区"
  kdjOversold: string;         // "超卖区"
  kdjGoldenCross: string;      // "金叉↑"
  kdjDeadCross: string;        // "死叉↓"
  kdjNeutral: string;          // "正常区"

  // BOLL
  bollAtUpper: string;         // "上轨附近"
  bollAtLower: string;         // "下轨附近"
  bollAtMiddle: string;        // "中轨附近"
  bollAboveUpper: string;      // "突破上轨"
  bollBelowLower: string;      // "跌破下轨"

  // MA
  maBullishAlign: string;      // "多头排列"
  maBearishAlign: string;      // "空头排列"
  maGoldenCross: string;       // "金叉↑"
  maDeadCross: string;         // "死叉↓"

  // Volume
  volSurge: string;            // "放量"
  volShrink: string;           // "缩量"
  volNormal: string;           // "正常"
  volExtreme: string;          // "天量"

  // ADX
  adxTrending: string;         // "有趋势"
  adxRanging: string;          // "震荡"
  adxStrong: string;           // "强趋势"

  // Supertrend
  stLong: string;              // "多头(绿)"
  stShort: string;             // "空头(红)"

  // Generic
  neutral: string;             // "等待"
  unknown: string;             // "—"
}

// ═══════════════════════════════════════
// 完整面板文案
// ═══════════════════════════════════════

export const READING_PANEL_COPY: ReadingPanelConfig = {

  header: {
    title: '指标读数',
    collapse: '收起面板',
    expand: '展开面板',
    settings: '面板设置',
    empty: '还没有加载指标\n按 I 打开指标面板 或 按 1-5 加载模板',
    addIndicator: '添加指标',
  },

  indicator: {
    valueLabel: '当前值',
    changeLabel: '较上根',
    signalLabel: '信号',
    prevLabel: '上根: {value}',
    maLabel: 'MA20: {value}',
  },

  trends: {
    up: '上涨',
    upStrong: '大涨',
    down: '下跌',
    downStrong: '大跌',
    flat: '持平',
  },

  signals: {
    // MACD
    macdGoldenCross: '金叉↑',
    macdDeadCross: '死叉↓',
    macdAboveZero: '零轴上方',
    macdBelowZero: '零轴下方',
    macdDivergence: '背离⚠️',

    // RSI
    rsiOverbought: '超买',
    rsiOversold: '超卖',
    rsiNeutral: '正常',
    rsiExtreme: '极度',

    // KDJ
    kdjOverbought: '超买区',
    kdjOversold: '超卖区',
    kdjGoldenCross: '金叉↑',
    kdjDeadCross: '死叉↓',
    kdjNeutral: '正常区',

    // BOLL
    bollAtUpper: '上轨附近',
    bollAtLower: '下轨附近',
    bollAtMiddle: '中轨附近',
    bollAboveUpper: '突破上轨↑',
    bollBelowLower: '跌破下轨↓',

    // MA
    maBullishAlign: '多头排列',
    maBearishAlign: '空头排列',
    maGoldenCross: '金叉↑',
    maDeadCross: '死叉↓',

    // Volume
    volSurge: '放量',
    volShrink: '缩量',
    volNormal: '正常',
    volExtreme: '天量',

    // ADX
    adxTrending: '有趋势',
    adxRanging: '震荡中',
    adxStrong: '强趋势',

    // Supertrend
    stLong: '多头',
    stShort: '空头',

    // Generic
    neutral: '等待',
    unknown: '—',
  },

  unitLabels: {
    price: '',               // 价格无后缀
    percentage: '%',
    volume: '',              // 成交量单位由前端格式化
    index: '',               // 指标值无后缀
    ratio: '',               // 比率无后缀
    days: '天',
  },

  tooltips: {
    value: '当前K线的指标数值',
    changeVsPrev: '与上一根K线相比的变化',
    signal: '该指标的当前方向信号',
    maReference: 'MA20作为中期趋势参考线',
    clickDetail: '点击查看该指标的完整详情',
    clickRemove: '点击×移除此指标',
    dragReorder: '拖动指标可调整排序',
  },
};

// ═══════════════════════════════════════
// 每个指标的个性化标签映射
// ═══════════════════════════════════════

export interface IndicatorReadingLabel {
  id: string;
  shortName: string;     // ≤4字缩写 (面板用)
  unit: string;          // 单位类型: 'price'|'percentage'|'index'|'ratio'
  valueFormat: string;   // 数值格式: 'price'|'pct'|'int'|'float2'|'float4'
  signalPrefix: string;  // 信号前缀 (如 "DIF:")
  subLines?: {           // 多线指标的子线标签
    key: string;
    label: string;
  }[];
}

export const INDICATOR_READING_LABELS: Record<string, IndicatorReadingLabel> = {

  ma:    { id: 'ma',    shortName: 'MA',   unit: 'price', valueFormat: 'price', signalPrefix: '', subLines: [{key:'period',label:'周期'}] },
  ema:   { id: 'ema',   shortName: 'EMA',  unit: 'price', valueFormat: 'price', signalPrefix: '' },
  boll:  { id: 'boll',  shortName: 'BOLL', unit: 'price', valueFormat: 'price', signalPrefix: '', subLines: [
    {key:'upper',label:'上轨'},{key:'middle',label:'中轨'},{key:'lower',label:'下轨'}] },
  macd:  { id: 'macd',  shortName: 'MACD', unit: 'index', valueFormat: 'float4', signalPrefix: 'DIF:', subLines: [
    {key:'dif',label:'DIF'},{key:'dea',label:'DEA'},{key:'hist',label:'柱'}] },
  rsi:   { id: 'rsi',   shortName: 'RSI',  unit: 'index', valueFormat: 'float2', signalPrefix: '' },
  kdj:   { id: 'kdj',   shortName: 'KDJ',  unit: 'index', valueFormat: 'float2', signalPrefix: '', subLines: [
    {key:'k',label:'K'},{key:'d',label:'D'},{key:'j',label:'J'}] },
  wr:    { id: 'wr',    shortName: 'WR',   unit: 'index', valueFormat: 'float2', signalPrefix: '' },
  cci:   { id: 'cci',   shortName: 'CCI',  unit: 'index', valueFormat: 'float2', signalPrefix: '' },
  atr:   { id: 'atr',   shortName: 'ATR',  unit: 'price', valueFormat: 'float4', signalPrefix: '' },
  obv:   { id: 'obv',   shortName: 'OBV',  unit: '',      valueFormat: 'int',    signalPrefix: '' },
  vwap:  { id: 'vwap',  shortName: 'VWAP', unit: 'price', valueFormat: 'price', signalPrefix: '' },
  mfi:   { id: 'mfi',   shortName: 'MFI',  unit: 'index', valueFormat: 'float2', signalPrefix: '' },
  sar:   { id: 'sar',   shortName: 'SAR',  unit: 'price', valueFormat: 'price', signalPrefix: '' },
  ichimoku: { id: 'ichimoku', shortName: '一目', unit: 'price', valueFormat: 'price', signalPrefix: '', subLines: [
    {key:'tenkan',label:'转折'},{key:'kijun',label:'基准'},{key:'senkouA',label:'先行A'},{key:'senkouB',label:'先行B'}] },
  adx:   { id: 'adx',   shortName: 'ADX',  unit: 'index', valueFormat: 'float2', signalPrefix: '', subLines: [
    {key:'adx',label:'ADX'},{key:'pdi',label:'+DI'},{key:'mdi',label:'-DI'}] },
  stoch: { id: 'stoch', shortName: 'KD',   unit: 'index', valueFormat: 'float2', signalPrefix: '', subLines: [
    {key:'k',label:'K'},{key:'d',label:'D'}] },
  cmf:   { id: 'cmf',   shortName: 'CMF',  unit: 'ratio', valueFormat: 'float4', signalPrefix: '' },
  chaikin: { id: 'chaikin', shortName: 'CHKO', unit: 'index', valueFormat: 'float4', signalPrefix: '' },
  aroon: { id: 'aroon', shortName: 'ARO',  unit: 'index', valueFormat: 'float2', signalPrefix: '', subLines: [
    {key:'up',label:'上'},{key:'down',label:'下'}] },
  bbb:   { id: 'bbb',   shortName: '%B',   unit: 'ratio', valueFormat: 'float4', signalPrefix: '' },
  donchian: { id: 'donchian', shortName: 'DC', unit: 'price', valueFormat: 'price', signalPrefix: '', subLines: [
    {key:'upper',label:'上轨'},{key:'lower',label:'下轨'}] },
  supertrend: { id: 'supertrend', shortName: 'ST', unit: 'price', valueFormat: 'price', signalPrefix: '' },
  keltner: { id: 'keltner', shortName: 'KC', unit: 'price', valueFormat: 'price', signalPrefix: '', subLines: [
    {key:'upper',label:'上轨'},{key:'middle',label:'中轨'},{key:'lower',label:'下轨'}] },
  elder:  { id: 'elder', shortName: 'ELD',  unit: 'price', valueFormat: 'float4', signalPrefix: '', subLines: [
    {key:'bull',label:'多头力'},{key:'bear',label:'空头力'}] },
  volume: { id: 'volume', shortName: '量',  unit: '', valueFormat: 'int', signalPrefix: '' },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getReadingLabel(id: string): IndicatorReadingLabel | undefined {
  // 先精确匹配
  if (INDICATOR_READING_LABELS[id]) return INDICATOR_READING_LABELS[id];
  // 再匹配短名
  return Object.values(INDICATOR_READING_LABELS).find(l => l.shortName === id);
}

export function getSignalText(signal: keyof ReadingPanelConfig['signals']): string {
  return READING_PANEL_COPY.signals[signal] || READING_PANEL_COPY.signals.unknown;
}

export default READING_PANEL_COPY;
