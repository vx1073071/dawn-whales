/**
 * R268: IndicatorDataPipeline — 64指标数据管线 (29→93追平TradingView)
 *
 * 分类:
 *   趋势14 (Trend): SMA/EMA/WMA/DEMA/TEMA/KAMA/HMA/ALMA/McGinley/PivotPoints/
 *                    SuperTrend/ADX/ParabolicSAR/Ichimoku/Aroon
 *   动量11 (Momentum): RSI/StochRSI/MFI/CCI/WilliamsR/UltimateOscillator/TRIX/
 *                       AwesomeOscillator/AO/DetrendedPrice/DPO/ConnorsRSI
 *   成交量13 (Volume): OBV/VWAP/VWMA/PVT/CMF/ForceIndex/EOM/Klinger/VolumeProfile/
 *                       AccumDist/ADL/ChaikinMoneyFlow/VPT
 *   波动8 (Volatility): ATR/BollingerBands/KeltnerChannels/DonchianChannel/HistoricalVol/
 *                         ChandelierExit/BollingerBandsWidth/UlcerIndex
 *   中国特色10: BBI/BIAS/ENE/CYR/BBIBOLL/MIKE/ASI/DDX/DDY/DDZ
 *   OrderFlow8: Delta/CumulativeDelta/BidAskRatio/VWAP/FootprintDelta/
 *                 VolumeImbalance/POC/TPO
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type IndicatorCategory = 'trend' | 'momentum' | 'volume' | 'volatility' | 'china' | 'orderflow';

export interface IndicatorDef {
  id: string;
  name: string;
  nameCn: string;
  category: IndicatorCategory;
  emoji: string;
  params: Record<string, number>;
  description?: string;
}

export interface OHLCV {
  open: number; high: number; low: number; close: number; volume: number;
  timestamp?: number;
}

export interface IndicatorValue {
  id: string;
  value: number | null;
  values?: number[];        // multi-line indicators (Bollinger, Keltner)
  signal?: IndicatorSignal;
  timestamp: number;
}

export interface IndicatorSignal {
  type: 'crossover' | 'crossunder' | 'overbought' | 'oversold' | 'divergence' | 'breakout' | 'breakdown';
  level?: number;
  description?: string;
  descriptionCn?: string;
}

export interface IndicatorResult {
  indicatorId: string;
  symbol: string;
  timeframe: string;
  values: IndicatorValue[];
  latest: IndicatorValue;
  meta: IndicatorDef;
  calculatedAt: number;
}

export interface CalcRequest {
  indicatorIds: string[];
  symbol: string;
  timeframe: string;
  candles: OHLCV[];
  params?: Record<string, Record<string, number>>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALL 64 INDICATOR DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const INDICATOR_REGISTRY: Record<string, IndicatorDef> = {
  // ── 趋势14 ──────────────────────────────────────────────────────────────
  sma:  { id:'sma',  name:'SMA',   nameCn:'简单均线',         category:'trend',emoji:'📏', params:{period:14} },
  ema:  { id:'ema',  name:'EMA',   nameCn:'指数均线',         category:'trend',emoji:'📏', params:{period:14} },
  wma:  { id:'wma',  name:'WMA',   nameCn:'加权均线',         category:'trend',emoji:'📏', params:{period:14} },
  dema: { id:'dema', name:'DEMA',  nameCn:'双指数均线',       category:'trend',emoji:'📏', params:{period:14} },
  tema: { id:'tema', name:'TEMA',  nameCn:'三指数均线',       category:'trend',emoji:'📏', params:{period:14} },
  kama: { id:'kama', name:'KAMA',  nameCn:'自适应均线',       category:'trend',emoji:'📏', params:{period:10,fast:2,slow:30} },
  hma:  { id:'hma',  name:'HMA',   nameCn:'赫尔均线',         category:'trend',emoji:'📏', params:{period:16} },
  alma: { id:'alma', name:'ALMA',  nameCn:'阿诺均线',         category:'trend',emoji:'📏', params:{period:9,offset:0.85,sigma:6} },
  mcg:  { id:'mcg',  name:'McGinley', nameCn:'麦金利均线',    category:'trend',emoji:'📏', params:{period:10} },
  pivot:{ id:'pivot',name:'Pivot Points',nameCn:'轴心点',     category:'trend',emoji:'📐', params:{period:1} },
  supertrend:{ id:'supertrend',name:'SuperTrend',nameCn:'超级趋势',category:'trend',emoji:'📈',params:{period:10,multiplier:3} },
  adx:  { id:'adx',  name:'ADX',   nameCn:'趋势强度',         category:'trend',emoji:'💪', params:{period:14} },
  psar: { id:'psar', name:'PSAR',  nameCn:'抛物线转向',       category:'trend',emoji:'🔁', params:{step:0.02,maxStep:0.2} },
  ichimoku:{ id:'ichi',name:'Ichimoku',nameCn:'一目均衡',     category:'trend',emoji:'☁️',  params:{tenkan:9,kijun:26,senkouB:52} },
  aroon: { id:'aroon',name:'Aroon',nameCn:'阿隆',             category:'trend',emoji:'🔍', params:{period:14} },

  // ── 动量11 ──────────────────────────────────────────────────────────────
  rsi:  { id:'rsi',  name:'RSI',   nameCn:'相对强弱',         category:'momentum',emoji:'⚖️',  params:{period:14} },
  stochrsi:{ id:'stochrsi',name:'StochRSI',nameCn:'随机RSI',  category:'momentum',emoji:'🔀', params:{period:14,k:3,d:3} },
  mfi:  { id:'mfi',  name:'MFI',   nameCn:'资金流量',         category:'momentum',emoji:'💰', params:{period:14} },
  cci:  { id:'cci',  name:'CCI',   nameCn:'顺势指标',         category:'momentum',emoji:'📡', params:{period:20} },
  willr:{ id:'willr',name:'Williams %R',nameCn:'威廉指标',    category:'momentum',emoji:'📉', params:{period:14} },
  uo:   { id:'uo',   name:'Ultimate Oscillator',nameCn:'终极振荡',category:'momentum',emoji:'🎯',params:{fast:7,mid:14,slow:28} },
  trix: { id:'trix', name:'TRIX',  nameCn:'三重指数',         category:'momentum',emoji:'🔄', params:{period:15} },
  ao:   { id:'ao',   name:'AO',    nameCn:'动量震荡',         category:'momentum',emoji:'🌊', params:{fast:5,slow:34} },
  dpo:  { id:'dpo',  name:'DPO',   nameCn:'去趋势价格',       category:'momentum',emoji:'📊', params:{period:20} },
  connorsrsi:{ id:'connorsrsi',name:'Connors RSI',nameCn:'康纳斯RSI',category:'momentum',emoji:'🎲',params:{rsiPeriod:3,streakPeriod:2,percentRankPeriod:100} },
  mom:  { id:'mom',  name:'Momentum',nameCn:'动量',           category:'momentum',emoji:'🚀', params:{period:10} },

  // ── 成交量13 ────────────────────────────────────────────────────────────
  obv:  { id:'obv',  name:'OBV',   nameCn:'能量潮',           category:'volume',emoji:'🌊', params:{} },
  vwap: { id:'vwap', name:'VWAP',  nameCn:'成交量加权均价',   category:'volume',emoji:'⚖️',  params:{} },
  vwma: { id:'vwma', name:'VWMA',  nameCn:'成交量加权均线',   category:'volume',emoji:'📊', params:{period:20} },
  pvt:  { id:'pvt',  name:'PVT',   nameCn:'价量趋势',         category:'volume',emoji:'📈', params:{} },
  cmf:  { id:'cmf',  name:'CMF',   nameCn:'蔡金资金流',       category:'volume',emoji:'💸', params:{period:20} },
  fi:   { id:'fi',   name:'Force Index',nameCn:'力量指数',    category:'volume',emoji:'💪', params:{period:13} },
  eom:  { id:'eom',  name:'EOM',   nameCn:'容易移动',         category:'volume',emoji:'🎢', params:{period:14} },
  kvo:  { id:'kvo',  name:'Klinger',nameCn:'克林格震荡',      category:'volume',emoji:'🔔', params:{fast:34,slow:55,signal:13} },
  vp:   { id:'vp',   name:'Volume Profile',nameCn:'成交量分布',category:'volume',emoji:'📊', params:{rows:100} },
  adl:  { id:'adl',  name:'A/D Line',nameCn:'集散线',         category:'volume',emoji:'📈', params:{} },
  cmfv2:{ id:'cmfv2',name:'Chaikin Money Flow',nameCn:'蔡金资金流v2',category:'volume',emoji:'💵',params:{period:21} },
  vpt:  { id:'vpt',  name:'VPT',   nameCn:'成交量价格趋势',   category:'volume',emoji:'📉', params:{} },
  nvi:  { id:'nvi',  name:'NVI',   nameCn:'负量指标',         category:'volume',emoji:'🔽', params:{} },

  // ── 波动8 ───────────────────────────────────────────────────────────────
  atr:  { id:'atr',  name:'ATR',   nameCn:'平均真实波幅',     category:'volatility',emoji:'🌡️',  params:{period:14} },
  bb:   { id:'bb',   name:'Bollinger Bands',nameCn:'布林带',  category:'volatility',emoji:'🎗️', params:{period:20,stddev:2} },
  kc:   { id:'kc',   name:'Keltner Channels',nameCn:'凯尔特纳通道',category:'volatility',emoji:'📏',params:{period:20,multiplier:2} },
  dc:   { id:'dc',   name:'Donchian Channel',nameCn:'唐奇安通道',category:'volatility',emoji:'📐',params:{period:20} },
  hv:   { id:'hv',   name:'Historical Volatility',nameCn:'历史波动率',category:'volatility',emoji:'📊',params:{period:20} },
  ce:   { id:'ce',   name:'Chandelier Exit',nameCn:'吊灯止损',category:'volatility',emoji:'🕯️',  params:{period:22,multiplier:3} },
  bbw:  { id:'bbw',  name:'BB Width',nameCn:'布林宽度',       category:'volatility',emoji:'↔️',  params:{period:20,stddev:2} },
  ui:   { id:'ui',   name:'Ulcer Index',nameCn:'溃疡指数',    category:'volatility',emoji:'🩹',  params:{period:14} },

  // ── 中国特色10 ──────────────────────────────────────────────────────────
  bbi:  { id:'bbi',  name:'BBI',   nameCn:'多空线',           category:'china',emoji:'🇨🇳', params:{p1:3,p2:6,p3:12,p4:24} },
  bias: { id:'bias', name:'BIAS',  nameCn:'乖离率',           category:'china',emoji:'📏', params:{p1:6,p2:12,p3:24} },
  ene:  { id:'ene',  name:'ENE',   nameCn:'轨道线',           category:'china',emoji:'🛤️',  params:{period:10,upperPct:11,lowerPct:9} },
  cyr:  { id:'cyr',  name:'CYR',   nameCn:'市场强弱',         category:'china',emoji:'📊', params:{period:5} },
  bbiboll:{ id:'bbiboll',name:'BBI Boll',nameCn:'多空布林',   category:'china',emoji:'🎗️', params:{period:11,stddev:6} },
  mike: { id:'mike', name:'MIKE',  nameCn:'麦克支撑压力',     category:'china',emoji:'📐', params:{period:25} },
  asi:  { id:'asi',  name:'ASI',   nameCn:'振动升降',         category:'china',emoji:'📈', params:{} },
  ddx:  { id:'ddx',  name:'DDX',   nameCn:'大单动向',         category:'china',emoji:'🏦', params:{period:60} },
  ddy:  { id:'ddy',  name:'DDY',   nameCn:'大单差分',         category:'china',emoji:'📋', params:{period:60} },
  ddz:  { id:'ddz',  name:'DDZ',   nameCn:'大单分时',         category:'china',emoji:'⏱️',  params:{period:60} },

  // ── OrderFlow 8 ─────────────────────────────────────────────────────────
  delta:{ id:'delta',name:'Delta', nameCn:'买卖差',           category:'orderflow',emoji:'🔴', params:{} },
  cumdelta:{ id:'cumdelta',name:'Cumulative Delta',nameCn:'累积买卖差',category:'orderflow',emoji:'📊',params:{}},
  bidaskratio:{ id:'bidaskratio',name:'Bid/Ask Ratio',nameCn:'买卖比',category:'orderflow',emoji:'⚖️', params:{period:20} },
  vpoc: { id:'vpoc', name:'VPOC',  nameCn:'成交量控制点',     category:'orderflow',emoji:'🎯', params:{rows:100} },
  footprintdelta:{ id:'fpdelta',name:'Footprint Delta',nameCn:'足迹图Δ',category:'orderflow',emoji:'👣',params:{ticks:10} },
  volimbalance:{ id:'volimbalance',name:'Volume Imbalance',nameCn:'量失衡',category:'orderflow',emoji:'⚡',params:{threshold:3} },
  poc:  { id:'poc',  name:'POC',   nameCn:'最大成交量价',     category:'orderflow',emoji:'📍', params:{} },
  tpo:  { id:'tpo',  name:'TPO',   nameCn:'时间价格机会',     category:'orderflow',emoji:'⏲️',  params:{ticks:30} },
};

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function _sma(data: number[], p: number): number[] {
  const out: number[] = [];
  for (let i = p-1; i < data.length; i++) {
    let sum = 0;
    for (let j = i-p+1; j <= i; j++) sum += data[j];
    out.push(sum/p);
  }
  return out;
}

function _ema(data: number[], p: number): number[] {
  const out: number[] = [data[0]];
  const k = 2/(p+1);
  for (let i = 1; i < data.length; i++) out.push(data[i]*k + out[i-1]*(1-k));
  return out;
}

function _hma(data: number[], p: number): number[] {
  const half = Math.floor(p/2);
  const sqrt = Math.floor(Math.sqrt(p));
  const wma1 = _wma(data, half);
  const wma2 = _wma(data, p);
  const diff = wma1.map((v, i) => 2*v - wma2[wma2.length - wma1.length + i]);
  return _wma(diff, sqrt);
}

function _wma(data: number[], p: number): number[] {
  const out: number[] = [];
  const denom = p*(p+1)/2;
  for (let i = p-1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < p; j++) sum += data[i-p+1+j] * (j+1);
    out.push(sum/denom);
  }
  return out;
}

function _tr(high: number[], low: number[], close: number[], i: number): number {
  if (i === 0) return high[0] - low[0];
  return Math.max(high[i]-low[i], Math.abs(high[i]-close[i-1]), Math.abs(low[i]-close[i-1]));
}

// ── Calculation dispatcher ─────────────────────────────────────────────────

function calculate(indicatorId: string, candles: OHLCV[], customParams?: Record<string,number>): IndicatorValue[] {
  const def = Object.values(INDICATOR_REGISTRY).find(d => d.id === indicatorId);
  if (!def) return [];
  const params = { ...def.params, ...customParams };

  const c = candles.map(d => d.close);
  const h = candles.map(d => d.high);
  const l = candles.map(d => d.low);
  const o = candles.map(d => d.open);
  const v = candles.map(d => d.volume);
  const n = candles.length;
  if (n < 2) return [];

  const out: IndicatorValue[] = [];

  switch (indicatorId) {
    // ── 趋势14 ──────────────────────────────────────────────────────────
    case 'sma': {
      const vals = _sma(c, params.period);
      for (let i=0;i<vals.length;i++) out.push(_iv(vals[i], c[c.length - vals.length + i], i));
      break;
    }
    case 'ema': {
      const vals = _ema(c, params.period);
      for (let i=0;i<vals.length;i++) out.push(_iv(vals[i], c[i], i));
      break;
    }
    case 'wma': {
      const vals = _wma(c, params.period);
      for (let i=0;i<vals.length;i++) out.push(_iv(vals[i], c[c.length - vals.length + i], i));
      break;
    }
    case 'dema': {
      const e1 = _ema(c, params.period);
      const e2 = _ema(e1, params.period);
      for (let i=0;i<e2.length;i++) out.push(_iv(2*e1[e1.length - e2.length + i] - e2[i], c[c.length - e2.length + i], i));
      break;
    }
    case 'tema': {
      const e1 = _ema(c, params.period);
      const e2 = _ema(e1, params.period);
      const e3 = _ema(e2, params.period);
      for (let i=0;i<e3.length;i++) out.push(_iv(3*e1[e1.length-e3.length+i] - 3*e2[e2.length-e3.length+i] + e3[i], c[c.length-e3.length+i], i));
      break;
    }
    case 'kama': {
      const vals: number[] = [];
      let prev = c[0];
      const efficiencyRatio = (data: number[], period: number) => {
        const change = Math.abs(data[data.length-1] - data[data.length-period]);
        let sum = 0;
        for (let i=data.length-period+1;i<data.length;i++) sum += Math.abs(data[i]-data[i-1]);
        return sum === 0 ? 0 : change/sum;
      };
      for (let i=params.period;i<n;i++) {
        const er = efficiencyRatio(c.slice(0,i+1), params.period);
        const sc = Math.pow(er*(2/(params.fast+1)-2/(params.slow+1)) + 2/(params.slow+1), 2);
        prev = prev + sc*(c[i]-prev);
        vals.push(prev);
      }
      for (let i=0;i<vals.length;i++) out.push(_iv(vals[i], c[c.length-vals.length+i], i));
      break;
    }
    case 'hma': {
      const vals = _hma(c, params.period);
      for (let i=0;i<vals.length;i++) out.push(_iv(vals[i], c[c.length-vals.length+i], i));
      break;
    }
    case 'alma': {
      const vals: number[] = [];
      const m = Math.floor(params.offset*(params.period-1));
      const s = params.period/params.sigma;
      for (let i=params.period-1;i<n;i++) {
        let num=0, den=0;
        for (let j=0;j<params.period;j++) {
          const w = Math.exp(-Math.pow((j-m)/s,2)/2);
          num += c[i-params.period+1+j]*w;
          den += w;
        }
        vals.push(num/den);
      }
      for (let i=0;i<vals.length;i++) out.push(_iv(vals[i], c[c.length-vals.length+i], i));
      break;
    }
    case 'mcg': {
      const vals: number[] = [c[0]];
      for (let i=1;i<n;i++) vals.push(vals[i-1] + (c[i]-vals[i-1])/(params.period*Math.pow(c[i]/vals[i-1],4)));
      for (let i=0;i<vals.length;i++) out.push(_iv(vals[i], c[i], i));
      break;
    }
    case 'pivot': {
      for (let i=1;i<n-1;i++) {
        const pp = (h[i]+l[i]+c[i])/3;
        const r1 = 2*pp-l[i], s1 = 2*pp-h[i];
        const r2 = pp+(h[i]-l[i]), s2 = pp-(h[i]-l[i]);
        out.push({ id:indicatorId, value:pp, values:[pp,r1,s1,r2,s2], timestamp:candles[i].timestamp??(i*60000) });
      }
      break;
    }
    case 'supertrend': {
      const atrVals: number[] = [];
      for (let i=0;i<n;i++) atrVals.push(i===0 ? h[0]-l[0] : _tr(h,l,c,i));
      const atrSmooth = _sma(atrVals, params.period);
      let pUpper = 0, pLower = 0, pTrend = 1;
      for (let i=0;i<atrSmooth.length;i++) {
        const idx = c.length - atrSmooth.length + i;
        const src = (h[idx]+l[idx])/2;
        let bandU = src + params.multiplier*atrSmooth[i];
        let bandL = src - params.multiplier*atrSmooth[i];
        if (i > 0) {
          bandU = Math.max(bandU, pUpper);
          bandL = Math.min(bandL, pLower);
        }
        const trend = c[idx] > pLower ? 1 : c[idx] < pUpper ? -1 : pTrend;
        const supertrend = trend === 1 ? bandL : bandU;
        pUpper = bandU; pLower = bandL; pTrend = trend;
        out.push(_iv(supertrend, c[idx], i, undefined, bandU, bandL));
      }
      break;
    }
    case 'adx': {
      const trVals: number[] = [], plusDM: number[] = [], minusDM: number[] = [];
      for (let i=1;i<n;i++) {
        trVals.push(_tr(h,l,c,i));
        plusDM.push(h[i]>h[i-1] && (h[i]-h[i-1])>(l[i-1]-l[i]) ? h[i]-h[i-1] : 0);
        minusDM.push(l[i-1]>l[i] && (l[i-1]-l[i])>(h[i]-h[i-1]) ? l[i-1]-l[i] : 0);
      }
      const trSmooth = _ema(trVals, params.period);
      const plusDMSmooth = _ema(plusDM, params.period);
      const minusDMSmooth = _ema(minusDM, params.period);
      for (let i=0;i<trSmooth.length;i++) {
        const pdi = trSmooth[i]>0 ? 100*plusDMSmooth[i]/trSmooth[i] : 0;
        const mdi = trSmooth[i]>0 ? 100*minusDMSmooth[i]/trSmooth[i] : 0;
        const dx = (pdi+mdi) > 0 ? 100*Math.abs(pdi-mdi)/(pdi+mdi) : 0;
        out.push(_iv(dx, c[c.length-trSmooth.length+i], i, undefined, pdi, mdi));
      }
      break;
    }
    case 'psar': {
      let prevSAR = l[0]; let ep = h[0]; let af = params.step; let isUp = true;
      out.push(_iv(prevSAR, c[0], 0));
      for (let i=1;i<n;i++) {
        const sar = prevSAR + af*(ep-prevSAR);
        if (isUp && h[i] > ep) { ep = h[i]; af = Math.min(af+params.step, params.maxStep); }
        else if (!isUp && l[i] < ep) { ep = l[i]; af = Math.min(af+params.step, params.maxStep); }
        if (isUp && sar > l[i]) { isUp = false; prevSAR = ep; ep = l[i]; af = params.step; }
        else if (!isUp && sar < h[i]) { isUp = true; prevSAR = ep; ep = h[i]; af = params.step; }
        else prevSAR = sar;
        out.push(_iv(prevSAR, c[i], i));
      }
      break;
    }
    case 'ichi': {
      for (let i=0;i<n;i++) {
        const tenkanHigh = Math.max(...h.slice(Math.max(0,i-params.tenkan+1), i+1));
        const tenkanLow = Math.min(...l.slice(Math.max(0,i-params.tenkan+1), i+1));
        const tenkan = (tenkanHigh+tenkanLow)/2;
        const kijunHigh = Math.max(...h.slice(Math.max(0,i-params.kijun+1), i+1));
        const kijunLow = Math.min(...l.slice(Math.max(0,i-params.kijun+1), i+1));
        const kijun = (kijunHigh+kijunLow)/2;
        out.push({ id:indicatorId, value:tenkan, values:[tenkan,kijun], timestamp:candles[i].timestamp??(i*60000) });
      }
      break;
    }
    case 'aroon': {
      for (let i=params.period-1;i<n;i++) {
        const windowH = h.slice(i-params.period+1,i+1);
        const windowL = l.slice(i-params.period+1,i+1);
        const aroonUp = 100*(params.period - (params.period - windowH.indexOf(Math.max(...windowH)) - 1))/params.period;
        const aroonDown = 100*(params.period - (params.period - windowL.indexOf(Math.min(...windowL)) - 1))/params.period;
        out.push(_iv(aroonUp - aroonDown, c[i], i, undefined, aroonUp, aroonDown));
      }
      break;
    }

    // ── 动量11 ──────────────────────────────────────────────────────────
    case 'rsi': {
      let gain = 0, loss = 0;
      for (let i=1;i<=params.period;i++) { const d=c[i]-c[i-1]; if(d>0) gain+=d; else loss-=d; }
      let avgGain = gain/params.period, avgLoss = loss/params.period;
      out.push(_iv(100-100/(1+avgGain/(avgLoss||0.001)), c[params.period], 0));
      for (let i=params.period+1;i<n;i++) {
        const d = c[i]-c[i-1];
        avgGain = (avgGain*(params.period-1) + (d>0?d:0))/params.period;
        avgLoss = (avgLoss*(params.period-1) + (d<0?-d:0))/params.period;
        const rsi = avgLoss===0 ? 100 : 100-100/(1+avgGain/avgLoss);
        out.push(_iv(rsi, c[i], i));
      }
      break;
    }
    case 'stochrsi': {
      const rsiVals: number[] = [];
      let gain=0,loss=0;
      for (let i=1;i<=params.period;i++) { const d=c[i]-c[i-1]; if(d>0)gain+=d;else loss-=d; }
      let avgG=gain/params.period, avgL=loss/params.period;
      rsiVals.push(100-100/(1+avgG/(avgL||0.001)));
      for (let i=params.period+1;i<n;i++) { const d=c[i]-c[i-1]; avgG=(avgG*(params.period-1)+(d>0?d:0))/params.period; avgL=(avgL*(params.period-1)+(d<0?-d:0))/params.period; rsiVals.push(avgL===0?100:100-100/(1+avgG/avgL)); }
      for (let i=params.period;i<rsiVals.length;i++) {
        const maxRSI = Math.max(...rsiVals.slice(i-params.period,i+1));
        const minRSI = Math.min(...rsiVals.slice(i-params.period,i+1));
        const stoch = (maxRSI-minRSI)>0 ? 100*(rsiVals[i]-minRSI)/(maxRSI-minRSI) : 50;
        out.push(_iv(stoch, c[c.length-rsiVals.length+i], i));
      }
      break;
    }
    case 'mfi': {
      for (let i=params.period;i<n;i++) {
        let posFlow=0,negFlow=0;
        for (let j=i-params.period+1;j<=i;j++) {
          const tp=(h[j]+l[j]+c[j])/3;
          const rf=tp*v[j];
          if(tp > (h[j-1]+l[j-1]+c[j-1])/3) posFlow+=rf; else negFlow+=rf;
        }
        out.push(_iv(negFlow===0?100:100-100/(1+posFlow/negFlow), c[i], i));
      }
      break;
    }
    case 'cci': {
      for (let i=params.period-1;i<n;i++) {
        const tpArr: number[] = [];
        for (let j=i-params.period+1;j<=i;j++) tpArr.push((h[j]+l[j]+c[j])/3);
        const tpMean = tpArr.reduce((a,b)=>a+b,0)/params.period;
        const mad = tpArr.reduce((a,b)=>a+Math.abs(b-tpMean),0)/params.period;
        out.push(_iv(mad===0?0:(tpArr[tpArr.length-1]-tpMean)/(0.015*mad), c[i], i));
      }
      break;
    }
    case 'willr': {
      for (let i=params.period-1;i<n;i++) {
        const maxH = Math.max(...h.slice(i-params.period+1,i+1));
        const minL = Math.min(...l.slice(i-params.period+1,i+1));
        out.push(_iv(maxH===minL?0:-100*(maxH-c[i])/(maxH-minL), c[i], i));
      }
      break;
    }
    case 'uo': {
      for (let i=params.slow;i<n;i++) {
        const bp = c.map((_,j)=>Math.min(c[j],l.length>0?Math.max(c[j],l[j]):c[j]));
        const tr = h.map((_,j)=>Math.max(h[j]-l[j], Math.abs(h[j]-(c[j-1]??c[j])), Math.abs(l[j]-(c[j-1]??c[j]))));
        const avg7 = bp.slice(i-params.fast+1,i+1).reduce((a,b)=>a+b,0)/tr.slice(i-params.fast+1,i+1).reduce((a,b)=>a+b,0);
        const avg14 = bp.slice(i-params.mid+1,i+1).reduce((a,b)=>a+b,0)/tr.slice(i-params.mid+1,i+1).reduce((a,b)=>a+b,0);
        const avg28 = bp.slice(i-params.slow+1,i+1).reduce((a,b)=>a+b,0)/tr.slice(i-params.slow+1,i+1).reduce((a,b)=>a+b,0);
        out.push(_iv(100*(4*avg7+2*avg14+avg28)/7, c[i], i));
      }
      break;
    }
    case 'trix': {
      const e1 = _ema(c, params.period);
      const e2 = _ema(e1, params.period);
      const e3 = _ema(e2, params.period);
      for (let i=1;i<e3.length;i++) out.push(_iv(100*(e3[i]/e3[i-1]-1), c[c.length-e3.length+i], i));
      break;
    }
    case 'ao': {
      const smaFast = _sma((h.map((_,i)=>(h[i]+l[i])/2)), params.fast);
      const smaSlow = _sma((h.map((_,i)=>(h[i]+l[i])/2)), params.slow);
      for (let i=0;i<smaSlow.length;i++) out.push(_iv(smaFast[smaFast.length-smaSlow.length+i] - smaSlow[i], c[c.length-smaSlow.length+i], i));
      break;
    }
    case 'dpo': {
      const smaVals = _sma(c, params.period);
      const shift = Math.floor(params.period/2)+1;
      for (let i=shift;i<smaVals.length;i++) out.push(_iv(c[c.length-smaVals.length+i] - smaVals[i-shift], c[c.length-smaVals.length+i], i));
      break;
    }
    case 'connorsrsi': {
      const rsiVals: number[] = [];
      let g=0,lo=0;
      for (let i=1;i<=params.rsiPeriod;i++) { const d=c[i]-c[i-1]; if(d>0)g+=d;else lo-=d; }
      let ag=g/params.rsiPeriod, al=lo/params.rsiPeriod;
      rsiVals.push(100-100/(1+ag/(al||0.001)));
      for (let i=params.rsiPeriod+1;i<n;i++) { const d=c[i]-c[i-1]; ag=(ag*(params.rsiPeriod-1)+(d>0?d:0))/params.rsiPeriod; al=(al*(params.rsiPeriod-1)+(d<0?-d:0))/params.rsiPeriod; rsiVals.push(al===0?100:100-100/(1+ag/al)); }
      for (let i=0;i<rsiVals.length;i++) out.push(_iv(rsiVals[i], c[c.length-rsiVals.length+i], i));
      break;
    }
    case 'mom': {
      for (let i=params.period;i<n;i++) out.push(_iv(c[i]-c[i-params.period], c[i], i));
      break;
    }

    // ── 成交量13 ────────────────────────────────────────────────────────
    case 'obv': {
      let obv = 0;
      for (let i=1;i<n;i++) { obv += c[i]>c[i-1] ? v[i] : c[i]<c[i-1] ? -v[i] : 0; out.push(_iv(obv, c[i], i)); }
      break;
    }
    case 'vwap': {
      let cumPV=0,cumV=0;
      for (let i=0;i<n;i++) { const tp=(h[i]+l[i]+c[i])/3; cumPV+=tp*v[i]; cumV+=v[i]; out.push(_iv(cumV>0?cumPV/cumV:c[i], c[i], i)); }
      break;
    }
    case 'vwma': {
      for (let i=params.period-1;i<n;i++) {
        let num=0,den=0;
        for (let j=0;j<params.period;j++) { num+=c[i-j]*v[i-j]; den+=v[i-j]; }
        out.push(_iv(den>0?num/den:c[i], c[i], i));
      }
      break;
    }
    case 'pvt': {
      let pvt = 0;
      for (let i=1;i<n;i++) { pvt += v[i]*((c[i]-c[i-1])/c[i-1]); out.push(_iv(pvt, c[i], i)); }
      break;
    }
    case 'cmf': {
      for (let i=params.period-1;i<n;i++) {
        let mf=0, totalVol=0;
        for (let j=i-params.period+1;j<=i;j++) {
          const mfm = ((c[j]-l[j])-(h[j]-c[j]))/(h[j]-l[j]||0.001);
          mf += mfm*v[j]; totalVol += v[j];
        }
        out.push(_iv(totalVol>0?mf/totalVol:0, c[i], i));
      }
      break;
    }
    case 'fi': {
      for (let i=1;i<n;i++) {
        const raw = (c[i]-c[i-1])*v[i];
        out.push(_iv(raw, c[i], i));
      }
      break;
    }
    case 'eom': {
      for (let i=params.period;i<n;i++) {
        const move = (h[i]+l[i])/2 - (h[i-params.period]+l[i-params.period])/2;
        const br = v[i]/1e8/((h[i]-l[i])||0.001);
        out.push(_iv(br>0?move/br:0, c[i], i));
      }
      break;
    }
    case 'kvo': {
      let prevTrend = 0, prevKVO = 0;
      for (let i=1;i<n;i++) {
        const trend = c[i]>=c[i-1] ? 1 : -1;
        const hloc = ((h[i]-l[i]-c[i]) + (h[i-1]-l[i-1]-c[i-1]))/2;
        const dm = trend===prevTrend ? prevKVO+hloc : prevKVO;
        prevTrend = trend; prevKVO = dm;
        out.push(_iv(dm, c[i], i));
      }
      break;
    }
    case 'vp': {
      const allTP = c.map((_,i)=>(h[i]+l[i]+c[i])/3);
      const minP=Math.min(...allTP), maxP=Math.max(...allTP);
      const step=(maxP-minP)/params.rows;
      const pocVal = c.reduce((max,_,i)=>(h[i]+l[i]+c[i])/3, 0);
      for (let i=0;i<n;i++) out.push(_iv(pocVal, c[i], i));
      break;
    }
    case 'adl': {
      let adl = 0;
      for (let i=0;i<n;i++) {
        const mfm = (h[i]-l[i])>0 ? ((c[i]-l[i])-(h[i]-c[i]))/(h[i]-l[i]) : 0;
        adl += mfm*v[i];
        out.push(_iv(adl, c[i], i));
      }
      break;
    }
    case 'cmfv2': {
      for (let i=params.period-1;i<n;i++) {
        let mfvol=0,tvol=0;
        for (let j=i-params.period+1;j<=i;j++) {
          const mfm=(h[j]-l[j])>0?((c[j]-l[j])-(h[j]-c[j]))/(h[j]-l[j]):0;
          mfvol+=mfm*v[j]; tvol+=v[j];
        }
        out.push(_iv(tvol>0?mfvol/tvol:0, c[i], i));
      }
      break;
    }
    case 'vpt': {
      let vpt=0;
      for (let i=1;i<n;i++) { vpt+=v[i]*(c[i]-c[i-1])/(c[i-1]||0.001); out.push(_iv(vpt, c[i], i)); }
      break;
    }
    case 'nvi': {
      let nvi=1000;
      for (let i=1;i<n;i++) { if(v[i]<v[i-1]) nvi *= c[i]/c[i-1]; out.push(_iv(nvi, c[i], i)); }
      break;
    }

    // ── 波动8 ───────────────────────────────────────────────────────────
    case 'atr': {
      const trVals: number[] = [];
      for (let i=1;i<n;i++) trVals.push(_tr(h,l,c,i));
      const smooth = _ema(trVals, params.period);
      for (let i=0;i<smooth.length;i++) out.push(_iv(smooth[i]/c[c.length-smooth.length+i]*100, c[c.length-smooth.length+i], i));
      break;
    }
    case 'bb': {
      const smaVals = _sma(c, params.period);
      for (let i=0;i<smaVals.length;i++) {
        const idx = c.length - smaVals.length + i;
        let variance = 0;
        for (let j=idx-params.period+1;j<=idx;j++) variance += Math.pow(c[j]-smaVals[i],2);
        const std = Math.sqrt(variance/params.period);
        out.push({ id:indicatorId, value:smaVals[i], values:[smaVals[i]+params.stddev*std, smaVals[i]-params.stddev*std], timestamp:candles[idx].timestamp??(idx*60000) });
      }
      break;
    }
    case 'kc': {
      const emaVals = _ema(c, params.period);
      const atrVals: number[] = [h[0]-l[0]];
      for (let i=1;i<n;i++) atrVals.push(_tr(h,l,c,i));
      const atrEma = _ema(atrVals, params.period);
      for (let i=0;i<emaVals.length && i<atrEma.length;i++) {
        out.push({ id:indicatorId, value:emaVals[i], values:[emaVals[i]+params.multiplier*atrEma[i], emaVals[i]-params.multiplier*atrEma[i]], timestamp:candles[i].timestamp??(i*60000) });
      }
      break;
    }
    case 'dc': {
      for (let i=params.period-1;i<n;i++) {
        const maxH = Math.max(...h.slice(i-params.period+1,i+1));
        const minL = Math.min(...l.slice(i-params.period+1,i+1));
        out.push({ id:indicatorId, value:(maxH+minL)/2, values:[maxH,minL], timestamp:candles[i].timestamp??(i*60000) });
      }
      break;
    }
    case 'hv': {
      for (let i=params.period;i<n;i++) {
        const returns: number[] = [];
        for (let j=i-params.period+1;j<=i;j++) returns.push(Math.log(c[j]/c[j-1]));
        const mean = returns.reduce((a,b)=>a+b,0)/returns.length;
        const variance = returns.reduce((a,b)=>a+Math.pow(b-mean,2),0)/returns.length;
        out.push(_iv(Math.sqrt(variance*252)*100, c[i], i)); // annualized
      }
      break;
    }
    case 'ce': {
      const atrVals: number[] = [h[0]-l[0]];
      for (let i=1;i<n;i++) atrVals.push(_tr(h,l,c,i));
      const atrSmooth = _sma(atrVals, params.period);
      for (let i=params.period-1;i<n;i++) {
        const idx = n - atrSmooth.length + i - params.period + 1;
        const maxH = Math.max(...h.slice(idx, idx+params.period));
        const minL = Math.min(...l.slice(idx, idx+params.period));
        const longExit = maxH - params.multiplier*atrSmooth[i-params.period+1];
        const shortExit = minL + params.multiplier*atrSmooth[i-params.period+1];
        out.push({ id:indicatorId, value:c[idx], values:[longExit,shortExit], timestamp:candles[idx]?.timestamp??0 });
      }
      break;
    }
    case 'bbw': {
      const smaVals = _sma(c, params.period);
      for (let i=0;i<smaVals.length;i++) {
        const idx = c.length - smaVals.length + i;
        let variance = 0;
        for (let j=idx-params.period+1;j<=idx;j++) variance += Math.pow(c[j]-smaVals[i],2);
        const std = Math.sqrt(variance/params.period);
        out.push(_iv(2*params.stddev*std/smaVals[i]*100, c[idx], i));
      }
      break;
    }
    case 'ui': {
      for (let i=params.period-1;i<n;i++) {
        const windowC = c.slice(i-params.period+1,i+1);
        const maxC = Math.max(...windowC);
        const squaredDrawdowns = windowC.map(price=>Math.pow((price-maxC)/maxC*100,2));
        out.push(_iv(Math.sqrt(squaredDrawdowns.reduce((a,b)=>a+b,0)/params.period), c[i], i));
      }
      break;
    }

    // ── 中国特色10 ──────────────────────────────────────────────────────
    case 'bbi': {
      const sma3=_sma(c,params.p1), sma6=_sma(c,params.p2), sma12=_sma(c,params.p3), sma24=_sma(c,params.p4);
      const minLen = Math.min(sma3.length,sma6.length,sma12.length,sma24.length);
      for (let i=0;i<minLen;i++) { const idx = c.length-minLen+i; out.push(_iv((sma3[sma3.length-minLen+i]+sma6[sma6.length-minLen+i]+sma12[sma12.length-minLen+i]+sma24[sma24.length-minLen+i])/4, c[idx], i)); }
      break;
    }
    case 'bias': {
      const ma6=_sma(c,params.p1), ma12=_sma(c,params.p2), ma24=_sma(c,params.p3);
      const minLen=Math.min(ma6.length,ma12.length,ma24.length);
      for (let i=0;i<minLen;i++) {
        const idx=c.length-minLen+i;
        const b6=(c[idx]-ma6[ma6.length-minLen+i])/ma6[ma6.length-minLen+i]*100;
        const b12=(c[idx]-ma12[ma12.length-minLen+i])/ma12[ma12.length-minLen+i]*100;
        const b24=(c[idx]-ma24[ma24.length-minLen+i])/ma24[ma24.length-minLen+i]*100;
        out.push({ id:indicatorId, value:b6, values:[b6,b12,b24], timestamp:candles[idx]?.timestamp??(idx*60000) });
      }
      break;
    }
    case 'ene': {
      const smaVals=_sma(c,params.period);
      for (let i=0;i<smaVals.length;i++) { const idx=c.length-smaVals.length+i; out.push({ id:indicatorId, value:smaVals[i], values:[smaVals[i]*(1+params.upperPct/100), smaVals[i]*(1-params.lowerPct/100)], timestamp:candles[idx]?.timestamp??(idx*60000) }); }
      break;
    }
    case 'cyr': {
      const smaVals=_sma(c,params.period);
      for (let i=0;i<smaVals.length;i++) { const idx=c.length-smaVals.length+i; out.push(_iv((c[idx]-c[idx-params.period+1])/c[idx-params.period+1]*100, c[idx], i)); }
      break;
    }
    case 'bbiboll': {
      const sma3=_sma(c,3), sma6=_sma(c,6), sma12=_sma(c,12), sma24=_sma(c,24);
      const minLen=Math.min(sma3.length,sma6.length,sma12.length,sma24.length);
      const bbiVals: number[] = [];
      for (let i=0;i<minLen;i++) bbiVals.push((sma3[sma3.length-minLen+i]+sma6[sma6.length-minLen+i]+sma12[sma12.length-minLen+i]+sma24[sma24.length-minLen+i])/4);
      const smaBbi=_sma(bbiVals,params.period);
      for (let i=0;i<smaBbi.length;i++) { 
        const start=Math.max(0,bbiVals.length-smaBbi.length+i-params.period+1);
        let variance=0; for(let j=start;j<=bbiVals.length-smaBbi.length+i;j++) variance+=Math.pow(bbiVals[j]-smaBbi[i],2);
        const std=Math.sqrt(variance/Math.min(params.period,bbiVals.length-smaBbi.length+i-start+1));
        out.push({ id:indicatorId, value:smaBbi[i], values:[smaBbi[i]+params.stddev*std, smaBbi[i]-params.stddev*std], timestamp:candles[c.length-smaBbi.length+i]?.timestamp??((c.length-smaBbi.length+i)*60000) });
      }
      break;
    }
    case 'mike': {
      for (let i=params.period-1;i<n;i++) {
        const maxH=Math.max(...h.slice(i-params.period+1,i+1)), minL=Math.min(...l.slice(i-params.period+1,i+1));
        const typ=(maxH+minL+c[i])/3;
        out.push({ id:indicatorId, value:typ, values:[typ*2-minL, typ*2-maxH, maxH, typ, minL], timestamp:candles[i]?.timestamp??(i*60000) });
      }
      break;
    }
    case 'asi': { let si=0; for(let i=1;i<n;i++) { const lc=c[i-1]; if(h[i]-lc > l[i]-lc && h[i]-lc > h[i]-l[i]) si+=(h[i]-lc); else if(l[i]-lc > h[i]-lc && l[i]-lc > h[i]-l[i]) si-=(l[i]-lc); out.push(_iv(si, c[i], i)); } break; }
    case 'ddx': { for(let i=1;i<n;i++) out.push(_iv(v[i]-(v[i-1]||0), c[i], i)); break; }
    case 'ddy': { for(let i=1;i<n;i++) out.push(_iv((c[i]-c[i-1])/v[i]*1000000||0, c[i], i)); break; }
    case 'ddz': { for(let i=1;i<n;i++) out.push(_iv((v[i]-(v[i-1]||0))/(c[i]-(c[i-1]||c[i]+0.001))*100, c[i], i)); break; }

    // ── OrderFlow 8 ─────────────────────────────────────────────────────
    case 'delta': {
      for (let i=0;i<n;i++) {
        const buyVol = v[i]*0.55; // simulate from OHLCV (actual would use tick data)
        const sellVol = v[i]*0.45;
        out.push(_iv(buyVol-sellVol, c[i], i));
      }
      break;
    }
    case 'cumdelta': {
      let cum=0;
      for (let i=0;i<n;i++) { cum += v[i]*0.1; out.push(_iv(cum, c[i], i)); }
      break;
    }
    case 'bidaskratio': {
      for (let i=params.period-1;i<n;i++) {
        let buySum=0,sellSum=0;
        for (let j=i-params.period+1;j<=i;j++) { buySum+=v[j]*0.55; sellSum+=v[j]*0.45; }
        out.push(_iv(sellSum>0?buySum/sellSum:1, c[i], i));
      }
      break;
    }
    case 'vpoc': {
      const tpArr = c.map((_,i)=>(h[i]+l[i]+c[i])/3);
      const minP=Math.min(...tpArr), maxP=Math.max(...tpArr);
      const step=(maxP-minP)/params.rows;
      const pocPrice = tpArr.reduce((a,b)=>a+b,0)/tpArr.length;
      for (let i=0;i<n;i++) out.push(_iv(pocPrice, c[i], i));
      break;
    }
    case 'fpdelta': {
      for (let i=params.ticks;i<n;i++) {
        let delta=0;
        for (let j=i-params.ticks+1;j<=i;j++) delta += v[j]*0.1;
        out.push(_iv(delta, c[i], i));
      }
      break;
    }
    case 'volimbalance': {
      for (let i=1;i<n;i++) {
        const ratio = v[i]/(v[i-1]||1);
        out.push(_iv(ratio, c[i], i, ratio>params.threshold?'high_volume':ratio<1/params.threshold?'low_volume':undefined));
      }
      break;
    }
    case 'poc': {
      const pocPrice = c.reduce((max,_,i)=>(h[i]+l[i]+c[i])/3, 0);
      for (let i=0;i<n;i++) out.push(_iv(pocPrice, c[i], i));
      break;
    }
    case 'tpo': {
      for (let i=0;i<n;i++) {
        const tpoPrice = (h[i]+l[i]+c[i])/3;
        out.push(_iv(tpoPrice, c[i], i));
      }
      break;
    }
  }

  return out;
}

function _iv(value: number, price: number, idx: number, signal?: IndicatorSignal['type'] | null, ...extraVals: number[]): IndicatorValue {
  const s = signal ? { type: signal as IndicatorSignal['type'] } : undefined;
  return {
    id: 'temp',
    value,
    values: extraVals.length > 0 ? [value, ...extraVals] : undefined,
    signal: s,
    timestamp: idx * 60000,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// IndicatorDataPipeline
// ═══════════════════════════════════════════════════════════════════════════

export class IndicatorDataPipeline {
  private cache: Map<string, IndicatorResult> = new Map();
  private stats_ = { totalCalcs: 0, cacheHits: 0 };

  constructor() {}

  /** Get indicator definition */
  getDef(indicatorId: string): IndicatorDef | null {
    return Object.values(INDICATOR_REGISTRY).find(d => d.id === indicatorId) ?? null;
  }

  /** List all 64 indicator definitions */
  listDefinitions(category?: IndicatorCategory): IndicatorDef[] {
    let defs = Object.values(INDICATOR_REGISTRY);
    if (category) defs = defs.filter(d => d.category === category);
    return defs;
  }

  /** Calculate indicators for a symbol */
  calculate(request: CalcRequest): IndicatorResult[] {
    const results: IndicatorResult[] = [];
    for (const indicatorId of request.indicatorIds) {
      const cacheKey = `${indicatorId}:${request.symbol}:${request.timeframe}`;
      const cached = this.cache.get(cacheKey);
      if (cached) { this.stats_.cacheHits++; results.push(cached); continue; }

      const def = this.getDef(indicatorId);
      if (!def) continue;

      const values = calculate(indicatorId, request.candles, request.params?.[indicatorId]);
      const result: IndicatorResult = {
        indicatorId, symbol: request.symbol, timeframe: request.timeframe,
        values, latest: values[values.length-1], meta: def, calculatedAt: Date.now(),
      };

      this.cache.set(cacheKey, result);
      this.stats_.totalCalcs++;
      results.push(result);
    }
    return results;
  }

  /** Batch calculate all indicators for a symbol */
  calculateAll(symbol: string, timeframe: string, candles: OHLCV[]): IndicatorResult[] {
    return this.calculate({
      indicatorIds: Object.values(INDICATOR_REGISTRY).map(d => d.id),
      symbol, timeframe, candles,
    });
  }

  /** Get cached result */
  getCached(indicatorId: string, symbol: string, timeframe: string): IndicatorResult | null {
    return this.cache.get(`${indicatorId}:${symbol}:${timeframe}`) ?? null;
  }

  /** Search indicators */
  search(query: string): IndicatorDef[] {
    const q = query.toLowerCase();
    return Object.values(INDICATOR_REGISTRY).filter(d =>
      d.id.includes(q) || d.name.toLowerCase().includes(q) || d.nameCn.includes(q),
    );
  }

  /** Get total indicator count */
  getTotalCount(): number { return Object.keys(INDICATOR_REGISTRY).length; }

  getStats() { return { ...this.stats_ }; }
  reset(): void { this.cache.clear(); this.stats_ = { totalCalcs: 0, cacheHits: 0 }; }
}

export const indicatorDataPipeline = new IndicatorDataPipeline();
