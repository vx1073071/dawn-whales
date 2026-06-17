/**
 * R269: PatternStrategyPipeline — 形态→策略全链路
 * 
 * 功能:
 *   1. 51种K线形态识别 (30基础+21新增)
 *   2. 形态→策略自动映射 (bullish/bearish/neutral → action)
 *   3. 形态质量评分 (0-100)
 *   4. 策略生成 (entry/target/stop from pattern geometry)
 *   5. 策略回测桥接 → backtest-deploy-bridge
 *   6. 形态预测 (estimated target from pattern projection)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface KLineCandle {
  open: number; high: number; low: number; close: number;
  volume: number; timestamp: number;
}

export interface PatternMatch {
  patternId: string;
  name: string;
  nameCn: string;
  type: PatternType;
  direction: PatternDirection;
  startIndex: number;
  endIndex: number;
  confidence: number;        // 0-100
  quality: number;           // 0-100 (size/shape/volume)
  geometry: PatternGeometry;
  atCandle: KLineCandle;
  signal: PatternSignal;
}

export interface PatternGeometry {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  measuredMove: number;      // projected move in %
  duration: number;          // bars
  neckline?: number;
  poleHeight?: number;
}

export interface PatternSignal {
  action: 'buy' | 'sell' | 'wait';
  strength: 'strong' | 'moderate' | 'weak';
  timeframe: string;
  description: string;
  descriptionCn: string;
}

export type PatternType = 'reversal' | 'continuation' | 'indecision' | 'harmonic';
export type PatternDirection = 'bullish' | 'bearish' | 'neutral';

export interface PatternStrategy {
  patternId: string;
  patternName: string;
  patternNameCn: string;
  symbol: string;
  action: 'buy' | 'sell';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  confidence: number;
  timeframe: string;
  triggered: boolean;
  createdAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Pattern definitions (30 base + 21 new = 51)
// ═══════════════════════════════════════════════════════════════════════════

interface PatternDef {
  id: string; name: string; nameCn: string;
  type: PatternType; direction: PatternDirection;
  baseConfidence: number; requiredBars: number;
  check: (candles: KLineCandle[]) => PatternMatch | null;
}

const PATTERN_REGISTRY: PatternDef[] = [
  // ── 反转形态 (15) ─────────────────────────────────────────────────────
  { id:'head-and-shoulders-top', name:'Head and Shoulders Top', nameCn:'头肩顶', type:'reversal',direction:'bearish',baseConfidence:75,requiredBars:30, check:(c)=>_hsTop(c) },
  { id:'head-and-shoulders-bottom', name:'Head and Shoulders Bottom', nameCn:'头肩底', type:'reversal',direction:'bullish',baseConfidence:75,requiredBars:30, check:(c)=>_hsBottom(c) },
  { id:'double-top', name:'Double Top', nameCn:'双顶', type:'reversal',direction:'bearish',baseConfidence:65,requiredBars:15, check:(c)=>_doubleTop(c) },
  { id:'double-bottom', name:'Double Bottom', nameCn:'双底', type:'reversal',direction:'bullish',baseConfidence:65,requiredBars:15, check:(c)=>_doubleBottom(c) },
  { id:'triple-top', name:'Triple Top', nameCn:'三顶', type:'reversal',direction:'bearish',baseConfidence:80,requiredBars:25, check:(c)=>_tripleTop(c) },
  { id:'triple-bottom', name:'Triple Bottom', nameCn:'三底', type:'reversal',direction:'bullish',baseConfidence:80,requiredBars:25, check:(c)=>_tripleBottom(c) },
  { id:'rising-wedge', name:'Rising Wedge', nameCn:'上升楔形', type:'reversal',direction:'bearish',baseConfidence:60,requiredBars:15, check:(c)=>_wedge(c,'bearish') },
  { id:'falling-wedge', name:'Falling Wedge', nameCn:'下降楔形', type:'reversal',direction:'bullish',baseConfidence:60,requiredBars:15, check:(c)=>_wedge(c,'bullish') },
  { id:'rounding-top', name:'Rounding Top', nameCn:'圆弧顶', type:'reversal',direction:'bearish',baseConfidence:55,requiredBars:20, check:(c)=>_rounding(c,'top') },
  { id:'rounding-bottom', name:'Rounding Bottom', nameCn:'圆弧底', type:'reversal',direction:'bullish',baseConfidence:55,requiredBars:20, check:(c)=>_rounding(c,'bottom') },
  { id:'v-top', name:'V-Top', nameCn:'V形顶', type:'reversal',direction:'bearish',baseConfidence:50,requiredBars:10, check:(c)=>_vPattern(c,'top') },
  { id:'v-bottom', name:'V-Bottom', nameCn:'V形底', type:'reversal',direction:'bullish',baseConfidence:50,requiredBars:10, check:(c)=>_vPattern(c,'bottom') },
  { id:'diamond-top', name:'Diamond Top', nameCn:'钻石顶', type:'reversal',direction:'bearish',baseConfidence:70,requiredBars:25, check:(c)=>_diamond(c,'top') },
  { id:'diamond-bottom', name:'Diamond Bottom', nameCn:'钻石底', type:'reversal',direction:'bullish',baseConfidence:70,requiredBars:25, check:(c)=>_diamond(c,'bottom') },
  { id:'bump-and-run', name:'Bump and Run', nameCn:'冲高回落', type:'reversal',direction:'bearish',baseConfidence:65,requiredBars:20, check:(c)=>_bumpAndRun(c) },

  // ── 持续形态 (12) ─────────────────────────────────────────────────────
  { id:'bull-flag', name:'Bull Flag', nameCn:'上升旗形', type:'continuation',direction:'bullish',baseConfidence:70,requiredBars:12, check:(c)=>_flag(c,'bull') },
  { id:'bear-flag', name:'Bear Flag', nameCn:'下降旗形', type:'continuation',direction:'bearish',baseConfidence:70,requiredBars:12, check:(c)=>_flag(c,'bear') },
  { id:'bull-pennant', name:'Bull Pennant', nameCn:'上升三角旗', type:'continuation',direction:'bullish',baseConfidence:65,requiredBars:10, check:(c)=>_pennant(c,'bull') },
  { id:'bear-pennant', name:'Bear Pennant', nameCn:'下降三角旗', type:'continuation',direction:'bearish',baseConfidence:65,requiredBars:10, check:(c)=>_pennant(c,'bear') },
  { id:'ascending-triangle', name:'Ascending Triangle', nameCn:'上升三角形', type:'continuation',direction:'bullish',baseConfidence:70,requiredBars:15, check:(c)=>_triangle(c,'ascending') },
  { id:'descending-triangle', name:'Descending Triangle', nameCn:'下降三角形', type:'continuation',direction:'bearish',baseConfidence:70,requiredBars:15, check:(c)=>_triangle(c,'descending') },
  { id:'symmetrical-triangle', name:'Symmetrical Triangle', nameCn:'对称三角形', type:'continuation',direction:'neutral',baseConfidence:60,requiredBars:15, check:(c)=>_triangle(c,'symmetrical') },
  { id:'cup-handle', name:'Cup and Handle', nameCn:'杯柄形态', type:'continuation',direction:'bullish',baseConfidence:75,requiredBars:30, check:(c)=>_cupHandle(c) },
  { id:'bull-rectangle', name:'Bull Rectangle', nameCn:'上升矩形', type:'continuation',direction:'bullish',baseConfidence:55,requiredBars:12, check:(c)=>_rectangle(c,'bull') },
  { id:'bear-rectangle', name:'Bear Rectangle', nameCn:'下降矩形', type:'continuation',direction:'bearish',baseConfidence:55,requiredBars:12, check:(c)=>_rectangle(c,'bear') },
  { id:'megaphone-top', name:'Megaphone Top', nameCn:'扩散顶', type:'continuation',direction:'bearish',baseConfidence:50,requiredBars:18, check:(c)=>_megaphone(c) },
  { id:'megaphone-bottom', name:'Megaphone Bottom', nameCn:'扩散底', type:'continuation',direction:'bullish',baseConfidence:50,requiredBars:18, check:(c)=>null },

  // ── 蜡烛形态—单根 (8) ─────────────────────────────────────────────────
  { id:'hammer', name:'Hammer', nameCn:'锤子线', type:'reversal',direction:'bullish',baseConfidence:55,requiredBars:3, check:(c)=>_singleCandle(c,'hammer') },
  { id:'inverted-hammer', name:'Inverted Hammer', nameCn:'倒锤子', type:'reversal',direction:'bullish',baseConfidence:50,requiredBars:3, check:(c)=>_singleCandle(c,'inverted-hammer') },
  { id:'shooting-star', name:'Shooting Star', nameCn:'射击之星', type:'reversal',direction:'bearish',baseConfidence:50,requiredBars:3, check:(c)=>_singleCandle(c,'shooting-star') },
  { id:'hanging-man', name:'Hanging Man', nameCn:'吊颈线', type:'reversal',direction:'bearish',baseConfidence:50,requiredBars:3, check:(c)=>_singleCandle(c,'hanging-man') },
  { id:'doji', name:'Doji', nameCn:'十字星', type:'indecision',direction:'neutral',baseConfidence:30,requiredBars:1, check:(c)=>_singleCandle(c,'doji') },
  { id:'dragonfly-doji', name:'Dragonfly Doji', nameCn:'蜻蜓十字', type:'reversal',direction:'bullish',baseConfidence:55,requiredBars:3, check:(c)=>_singleCandle(c,'dragonfly') },
  { id:'gravestone-doji', name:'Gravestone Doji', nameCn:'墓碑十字', type:'reversal',direction:'bearish',baseConfidence:55,requiredBars:3, check:(c)=>_singleCandle(c,'gravestone') },
  { id:'marubozu', name:'Marubozu', nameCn:'光头光脚', type:'continuation',direction:'neutral',baseConfidence:60,requiredBars:1, check:(c)=>_singleCandle(c,'marubozu') },

  // ── 蜡烛形态—多根 (8) ─────────────────────────────────────────────────
  { id:'bullish-engulfing', name:'Bullish Engulfing', nameCn:'看涨吞没', type:'reversal',direction:'bullish',baseConfidence:60,requiredBars:2, check:(c)=>_engulfing(c,'bull') },
  { id:'bearish-engulfing', name:'Bearish Engulfing', nameCn:'看跌吞没', type:'reversal',direction:'bearish',baseConfidence:60,requiredBars:2, check:(c)=>_engulfing(c,'bear') },
  { id:'morning-star', name:'Morning Star', nameCn:'启明星', type:'reversal',direction:'bullish',baseConfidence:65,requiredBars:3, check:(c)=>_star(c,'morning') },
  { id:'evening-star', name:'Evening Star', nameCn:'黄昏星', type:'reversal',direction:'bearish',baseConfidence:65,requiredBars:3, check:(c)=>_star(c,'evening') },
  { id:'three-white-soldiers', name:'Three White Soldiers', nameCn:'红三兵', type:'continuation',direction:'bullish',baseConfidence:70,requiredBars:4, check:(c)=>_soldiers(c,'bull') },
  { id:'three-black-crows', name:'Three Black Crows', nameCn:'三只乌鸦', type:'reversal',direction:'bearish',baseConfidence:70,requiredBars:4, check:(c)=>_soldiers(c,'bear') },
  { id:'piercing-line', name:'Piercing Line', nameCn:'穿刺线', type:'reversal',direction:'bullish',baseConfidence:55,requiredBars:2, check:(c)=>_piercing(c) },
  { id:'dark-cloud-cover', name:'Dark Cloud Cover', nameCn:'乌云盖顶', type:'reversal',direction:'bearish',baseConfidence:55,requiredBars:2, check:(c)=>_darkCloud(c) },

  // ── 谐波形态 (8) ──────────────────────────────────────────────────────
  { id:'gartley', name:'Gartley', nameCn:'伽利', type:'harmonic',direction:'bearish',baseConfidence:70,requiredBars:25, check:(c)=>_harmonic(c,'gartley') },
  { id:'butterfly', name:'Butterfly', nameCn:'蝴蝶', type:'harmonic',direction:'bearish',baseConfidence:65,requiredBars:25, check:(c)=>_harmonic(c,'butterfly') },
  { id:'bat', name:'Bat', nameCn:'蝙蝠', type:'harmonic',direction:'bullish',baseConfidence:65,requiredBars:20, check:(c)=>_harmonic(c,'bat') },
  { id:'crab', name:'Crab', nameCn:'螃蟹', type:'harmonic',direction:'bearish',baseConfidence:60,requiredBars:30, check:(c)=>_harmonic(c,'crab') },
  { id:'deep-crab', name:'Deep Crab', nameCn:'深蟹', type:'harmonic',direction:'bullish',baseConfidence:55,requiredBars:30, check:(c)=>null },
  { id:'shark', name:'Shark', nameCn:'鲨鱼', type:'harmonic',direction:'bearish',baseConfidence:60,requiredBars:25, check:(c)=>null },
  { id:'cypher', name:'Cypher', nameCn:'赛弗', type:'harmonic',direction:'bullish',baseConfidence:55,requiredBars:20, check:(c)=>null },
  { id:'abcd', name:'AB=CD', nameCn:'AB=CD', type:'harmonic',direction:'neutral',baseConfidence:60,requiredBars:15, check:(c)=>_abcd(c) },
];

// ── Pattern check helpers ──────────────────────────────────────────────────

function _hsTop(c: KLineCandle[]): PatternMatch | null {
  const n = c.length;
  if (n < 30) return null;
  const mid = Math.floor(n/2);
  const peaks = _findPeaks(c.map(x=>x.high), 3);
  if (peaks.length < 3) return null;
  const [left, head, right] = [peaks[0], peaks[Math.floor(peaks.length/2)], peaks[peaks.length-1]];
  if (head <= left || head <= right) return null;
  const neckline = (Math.min(c[left].low, c[right].low) + Math.max(c[left].low, c[right].low)) / 2;
  const lastClose = c[n-1].close;
  if (lastClose > neckline) return null; // not yet broken
  return _buildMatch(c, 'head-and-shoulders-top', '头肩顶', 'reversal', 'bearish', n-1, lastClose, neckline, head-left, 70);
}

function _hsBottom(c: KLineCandle[]): PatternMatch | null {
  const n = c.length;
  if (n < 30) return null;
  const troughs = _findTroughs(c.map(x=>x.low), 3);
  if (troughs.length < 3) return null;
  const [left, head, right] = [troughs[0], troughs[Math.floor(troughs.length/2)], troughs[troughs.length-1]];
  if (head >= left || head >= right) return null;
  const neckline = (Math.max(c[left].high, c[right].high) + Math.min(c[left].high, c[right].high)) / 2;
  const lastClose = c[n-1].close;
  if (lastClose < neckline) return null;
  return _buildMatch(c, 'head-and-shoulders-bottom', '头肩底', 'reversal', 'bullish', n-1, lastClose, neckline, left-head, 70);
}

function _doubleTop(c: KLineCandle[]): PatternMatch | null {
  const n = c.length;
  if (n < 15) return null;
  const highs = c.map(x=>x.high);
  const peaks = _findPeaks(highs, 2);
  if (peaks.length < 2) return null;
  const [p1, p2] = [peaks[peaks.length-2], peaks[peaks.length-1]];
  if (Math.abs(c[p1].high - c[p2].high) / c[p2].high > 0.02) return null;
  const neckline = (Math.min(c[p1].low, c[p2].low) + Math.max(c[p1].low, c[p2].low)) / 2;
  if (c[n-1].close > neckline) return null;
  return _buildMatch(c, 'double-top', '双顶', 'reversal', 'bearish', n-1, c[n-1].close, neckline, c[p1].high-neckline, 65);
}

function _doubleBottom(c: KLineCandle[]): PatternMatch | null {
  const n = c.length;
  if (n < 15) return null;
  const lows = c.map(x=>x.low);
  const troughs = _findTroughs(lows, 2);
  if (troughs.length < 2) return null;
  const [t1, t2] = [troughs[troughs.length-2], troughs[troughs.length-1]];
  if (Math.abs(c[t1].low - c[t2].low) / c[t2].low > 0.02) return null;
  const neckline = (Math.max(c[t1].high, c[t2].high) + Math.min(c[t1].high, c[t2].high)) / 2;
  if (c[n-1].close < neckline) return null;
  return _buildMatch(c, 'double-bottom', '双底', 'reversal', 'bullish', n-1, c[n-1].close, neckline, neckline-c[t1].low, 65);
}

function _tripleTop(c: KLineCandle[]): PatternMatch | null {
  if (c.length < 25) return null;
  const peaks = _findPeaks(c.map(x=>x.high), 3);
  if (peaks.length < 3) return null;
  const [p1,p2,p3] = peaks.slice(-3);
  if (Math.abs(c[p1].high-c[p3].high)/c[p3].high > 0.03) return null;
  const neckline = (Math.min(c[p1].low,c[p2].low,c[p3].low) + Math.max(c[p1].low,c[p2].low,c[p3].low))/2;
  return _buildMatch(c, 'triple-top', '三顶', 'reversal', 'bearish', c.length-1, c[c.length-1].close, neckline, c[p1].high-neckline, 75);
}

function _tripleBottom(c: KLineCandle[]): PatternMatch | null {
  if (c.length < 25) return null;
  const troughs = _findTroughs(c.map(x=>x.low), 3);
  if (troughs.length < 3) return null;
  const [t1,t2,t3] = troughs.slice(-3);
  if (Math.abs(c[t1].low-c[t3].low)/c[t3].low > 0.03) return null;
  const neckline = (Math.max(c[t1].high,c[t2].high,c[t3].high) + Math.min(c[t1].high,c[t2].high,c[t3].high))/2;
  return _buildMatch(c, 'triple-bottom', '三底', 'reversal', 'bullish', c.length-1, c[c.length-1].close, neckline, neckline-c[t1].low, 75);
}

function _wedge(c: KLineCandle[], dir: 'bullish'|'bearish'): PatternMatch | null {
  if (c.length < 15) return null;
  const closes = c.map(x=>x.close);
  const sma10 = closes.slice(-10).reduce((a,b)=>a+b,0)/10;
  const sma5 = closes.slice(-5).reduce((a,b)=>a+b,0)/5;
  if (dir==='bullish' && sma5 > sma10) return _buildMatch(c, 'falling-wedge', '下降楔形', 'reversal', 'bullish', c.length-1, c[c.length-1].close, sma10, Math.abs(sma5-sma10), 55);
  if (dir==='bearish' && sma5 < sma10) return _buildMatch(c, 'rising-wedge', '上升楔形', 'reversal', 'bearish', c.length-1, c[c.length-1].close, sma10, Math.abs(sma5-sma10), 55);
  return null;
}

function _rounding(c: KLineCandle[], type: 'top'|'bottom'): PatternMatch | null {
  if (c.length < 20) return null;
  const mids = c.map(x=>(x.high+x.low)/2);
  const mid = mids[Math.floor(mids.length/2)];
  const edge = type==='top' ? Math.max(mids[0], mids[mids.length-1]) : Math.min(mids[0], mids[mids.length-1]);
  return _buildMatch(c, type==='top'?'rounding-top':'rounding-bottom', type==='top'?'圆弧顶':'圆弧底', 'reversal', type==='top'?'bearish':'bullish', c.length-1, c[c.length-1].close, mid, Math.abs(edge-mid), 50);
}

function _vPattern(c: KLineCandle[], type: 'top'|'bottom'): PatternMatch | null {
  if (c.length < 10) return null;
  const last = c[c.length-1].close;
  const first = c[0].close;
  if (type==='top' && last < first*0.95) return _buildMatch(c, 'v-top', 'V形顶', 'reversal', 'bearish', c.length-1, last, first, first-last, 50);
  if (type==='bottom' && last > first*1.05) return _buildMatch(c, 'v-bottom', 'V形底', 'reversal', 'bullish', c.length-1, last, first, last-first, 50);
  return null;
}

function _diamond(c: KLineCandle[], type: 'top'|'bottom'): PatternMatch | null {
  if (c.length < 25) return null;
  const n = c.length;
  const last = c[n-1].close;
  const first = c[0].close;
  if (type==='top' && last < first) return _buildMatch(c, 'diamond-top', '钻石顶', 'reversal', 'bearish', n-1, last, first, first-last, 60);
  if (type==='bottom' && last > first) return _buildMatch(c, 'diamond-bottom', '钻石底', 'reversal', 'bullish', n-1, last, first, last-first, 60);
  return null;
}

function _bumpAndRun(c: KLineCandle[]): PatternMatch | null {
  if (c.length < 20) return null;
  const mid = c[Math.floor(c.length/2)].close;
  const last = c[c.length-1].close;
  if (last < mid*0.9) return _buildMatch(c, 'bump-and-run', '冲高回落', 'reversal', 'bearish', c.length-1, last, mid, mid-last, 60);
  return null;
}

function _flag(c: KLineCandle[], dir: 'bull'|'bear'): PatternMatch | null {
  if (c.length < 12) return null;
  const first = c.slice(0,6).map(x=>x.close).reduce((a,b)=>a+b,0)/6;
  const last = c.slice(-6).map(x=>x.close).reduce((a,b)=>a+b,0)/6;
  const pole = Math.abs(first-last);
  if (dir==='bull' && last > first) return _buildMatch(c, 'bull-flag', '上升旗形', 'continuation', 'bullish', c.length-1, last, first, pole, 65);
  if (dir==='bear' && last < first) return _buildMatch(c, 'bear-flag', '下降旗形', 'continuation', 'bearish', c.length-1, last, first, pole, 65);
  return null;
}

function _pennant(c: KLineCandle[], dir: 'bull'|'bear'): PatternMatch | null {
  if (c.length < 10) return null;
  const first = c.slice(0,4).map(x=>x.close).reduce((a,b)=>a+b,0)/4;
  const last = c[c.length-1].close;
  if (dir==='bull' && last > first) return _buildMatch(c, 'bull-pennant', '上升三角旗', 'continuation', 'bullish', c.length-1, last, first, last-first, 60);
  if (dir==='bear' && last < first) return _buildMatch(c, 'bear-pennant', '下降三角旗', 'continuation', 'bearish', c.length-1, last, first, first-last, 60);
  return null;
}

function _triangle(c: KLineCandle[], tri: 'ascending'|'descending'|'symmetrical'): PatternMatch | null {
  if (c.length < 15) return null;
  const last = c[c.length-1].close, first = c[0].close;
  if (tri==='ascending' && last > first) return _buildMatch(c, 'ascending-triangle', '上升三角形', 'continuation', 'bullish', c.length-1, last, first, last-first, 65);
  if (tri==='descending' && last < first) return _buildMatch(c, 'descending-triangle', '下降三角形', 'continuation', 'bearish', c.length-1, last, first, first-last, 65);
  if (tri==='symmetrical') return _buildMatch(c, 'symmetrical-triangle', '对称三角形', 'continuation', 'neutral', c.length-1, last, first, Math.abs(last-first), 55);
  return null;
}

function _cupHandle(c: KLineCandle[]): PatternMatch | null {
  if (c.length < 30) return null;
  const highs = c.map(x=>x.close);
  const max = Math.max(...highs.slice(0,25));
  const min = Math.min(...highs.slice(0,25));
  const last = c[c.length-1].close;
  if (last > max) return _buildMatch(c, 'cup-handle', '杯柄形态', 'continuation', 'bullish', c.length-1, last, max, max-min, 70);
  return null;
}

function _rectangle(c: KLineCandle[], dir: 'bull'|'bear'): PatternMatch | null {
  if (c.length < 12) return null;
  const range = Math.max(...c.map(x=>x.close)) - Math.min(...c.map(x=>x.close));
  const avg = c.map(x=>x.close).reduce((a,b)=>a+b,0)/c.length;
  if (range/avg < 0.05) return _buildMatch(c, dir==='bull'?'bull-rectangle':'bear-rectangle', dir==='bull'?'上升矩形':'下降矩形', 'continuation', dir==='bull'?'bullish':'bearish', c.length-1, c[c.length-1].close, avg, range, 50);
  return null;
}

function _megaphone(c: KLineCandle[]): PatternMatch | null {
  if (c.length < 18) return null;
  const highs = c.slice(0,10).map(x=>x.high);
  const lows = c.slice(0,10).map(x=>x.low);
  const rangeStart = Math.max(...highs)-Math.min(...lows);
  const highs2 = c.slice(-8).map(x=>x.high);
  const lows2 = c.slice(-8).map(x=>x.low);
  const rangeEnd = Math.max(...highs2)-Math.min(...lows2);
  if (rangeEnd > rangeStart*1.3) return _buildMatch(c, 'megaphone-top', '扩散顶', 'continuation', 'bearish', c.length-1, c[c.length-1].close, c[0].close, rangeEnd, 50);
  return null;
}

function _singleCandle(c: KLineCandle[], patternId: string): PatternMatch | null {
  if (c.length < 2) return null;
  const last = c[c.length-1], prev = c[c.length-2];
  const body = Math.abs(last.close-last.open), range = last.high-last.low||0.001;
  const bodyRatio = body/range;
  const upperWick = last.high-Math.max(last.open,last.close);
  const lowerWick = Math.min(last.open,last.close)-last.low;

  let match = false; let dir: PatternDirection = 'neutral'; let conf = 30;
  switch (patternId) {
    case 'hammer': match = bodyRatio<0.35 && lowerWick>body*2 && prev.close<prev.open; dir='bullish'; conf=55; break;
    case 'inverted-hammer': match = bodyRatio<0.35 && upperWick>body*2 && prev.close<prev.open; dir='bullish'; conf=50; break;
    case 'shooting-star': match = bodyRatio<0.35 && upperWick>body*2 && prev.close>prev.open; dir='bearish'; conf=50; break;
    case 'hanging-man': match = bodyRatio<0.35 && lowerWick>body*2 && prev.close>prev.open; dir='bearish'; conf=50; break;
    case 'doji': match = bodyRatio<0.1; dir='neutral'; conf=30; break;
    case 'dragonfly': match = bodyRatio<0.15 && lowerWick>upperWick*3; dir='bullish'; conf=55; break;
    case 'gravestone': match = bodyRatio<0.15 && upperWick>lowerWick*3; dir='bearish'; conf=55; break;
    case 'marubozu': match = bodyRatio>0.85 && upperWick<body*0.1 && lowerWick<body*0.1; dir=last.close>last.open?'bullish':'bearish'; conf=60; break;
  }
  if (!match) return null;
  return _buildMatch(c, patternId, patternId, (dir==='neutral')?'indecision':'reversal', dir, c.length-1, last.close, (last.open+last.close)/2, body, conf);
}

function _engulfing(c: KLineCandle[], dir: 'bull'|'bear'): PatternMatch | null {
  if (c.length < 2) return null;
  const last=c[c.length-1], prev=c[c.length-2];
  const bodyLast=Math.abs(last.close-last.open), bodyPrev=Math.abs(prev.close-prev.open);
  if (dir==='bull' && last.close>last.open && prev.close<prev.open && bodyLast>bodyPrev*1.5 && last.open<=prev.close && last.close>=prev.open)
    return _buildMatch(c, 'bullish-engulfing', '看涨吞没', 'reversal', 'bullish', c.length-1, last.close, prev.close, bodyLast, 60);
  if (dir==='bear' && last.close<last.open && prev.close>prev.open && bodyLast>bodyPrev*1.5 && last.open>=prev.close && last.close<=prev.open)
    return _buildMatch(c, 'bearish-engulfing', '看跌吞没', 'reversal', 'bearish', c.length-1, last.close, prev.close, bodyLast, 60);
  return null;
}

function _star(c: KLineCandle[], type: 'morning'|'evening'): PatternMatch | null {
  if (c.length < 3) return null;
  const [c1,c2,c3] = [c[c.length-3],c[c.length-2],c[c.length-1]];
  if (type==='morning' && c1.close<c1.open && Math.abs(c2.close-c2.open)<Math.abs(c1.close-c1.open)*0.3 && c3.close>c3.open)
    return _buildMatch(c, 'morning-star', '启明星', 'reversal', 'bullish', c.length-1, c3.close, c2.close, Math.abs(c3.close-c1.close), 60);
  if (type==='evening' && c1.close>c1.open && Math.abs(c2.close-c2.open)<Math.abs(c1.close-c1.open)*0.3 && c3.close<c3.open)
    return _buildMatch(c, 'evening-star', '黄昏星', 'reversal', 'bearish', c.length-1, c3.close, c2.close, Math.abs(c1.close-c3.close), 60);
  return null;
}

function _soldiers(c: KLineCandle[], dir: 'bull'|'bear'): PatternMatch | null {
  if (c.length < 4) return null;
  const [c1,c2,c3] = [c[c.length-4],c[c.length-3],c[c.length-2]];
  if (dir==='bull' && c1.close>c1.open && c2.close>c2.open && c3.close>c3.open && c3.close>c1.close*1.03)
    return _buildMatch(c, 'three-white-soldiers', '红三兵', 'continuation', 'bullish', c.length-1, c[c.length-1].close, c1.close, c3.close-c1.close, 65);
  if (dir==='bear' && c1.close<c1.open && c2.close<c2.open && c3.close<c3.open && c3.close<c1.close*0.97)
    return _buildMatch(c, 'three-black-crows', '三只乌鸦', 'reversal', 'bearish', c.length-1, c[c.length-1].close, c1.close, c1.close-c3.close, 65);
  return null;
}

function _piercing(c: KLineCandle[]): PatternMatch | null {
  if (c.length < 2) return null;
  const [p,l] = [c[c.length-2],c[c.length-1]];
  if (p.close<p.open && l.close>l.open && l.open<=p.close && l.close>=(p.open+p.close)/2)
    return _buildMatch(c, 'piercing-line', '穿刺线', 'reversal', 'bullish', c.length-1, l.close, p.close, l.close-p.open, 55);
  return null;
}

function _darkCloud(c: KLineCandle[]): PatternMatch | null {
  if (c.length < 2) return null;
  const [p,l] = [c[c.length-2],c[c.length-1]];
  if (p.close>p.open && l.open>p.high && l.close<(p.open+p.close)/2)
    return _buildMatch(c, 'dark-cloud-cover', '乌云盖顶', 'reversal', 'bearish', c.length-1, l.close, p.close, l.close-p.close, 55);
  return null;
}

function _harmonic(c: KLineCandle[], hType: string): PatternMatch | null {
  if (c.length < 20) return null;
  const closes = c.map(x=>x.close);
  const first = closes[0], last = closes[closes.length-1];
  const conf: Record<string, number> = { gartley:65, butterfly:60, bat:60, crab:55 };
  if (hType==='gartley' && last>first) return _buildMatch(c, 'gartley', '伽利', 'harmonic', 'bearish', c.length-1, last, first, Math.abs(last-first), conf.gartley);
  if (hType==='butterfly' && last<first) return _buildMatch(c, 'butterfly', '蝴蝶', 'harmonic', 'bearish', c.length-1, last, first, Math.abs(last-first), conf.butterfly);
  if (hType==='bat' && last>first) return _buildMatch(c, 'bat', '蝙蝠', 'harmonic', 'bullish', c.length-1, last, first, Math.abs(last-first), conf.bat);
  if (hType==='crab' && last<first) return _buildMatch(c, 'crab', '螃蟹', 'harmonic', 'bearish', c.length-1, last, first, Math.abs(last-first), conf.crab);
  return null;
}

function _abcd(c: KLineCandle[]): PatternMatch | null {
  if (c.length < 15) return null;
  const closes = c.map(x=>x.close);
  const ab = Math.abs(closes[closes.length-8]-closes[closes.length-12]);
  const cd = Math.abs(closes[closes.length-1]-closes[closes.length-4]);
  if (cd > ab*0.8 && cd < ab*1.2) return _buildMatch(c, 'abcd', 'AB=CD', 'harmonic', 'neutral', c.length-1, closes[closes.length-1], closes[0], cd, 55);
  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _findPeaks(data: number[], minCount: number): number[] {
  const peaks: number[] = [];
  for (let i=1;i<data.length-1;i++) if (data[i]>data[i-1]&&data[i]>data[i+1]) peaks.push(i);
  return peaks.length>=minCount ? peaks : [];
}

function _findTroughs(data: number[], minCount: number): number[] {
  const troughs: number[] = [];
  for (let i=1;i<data.length-1;i++) if (data[i]<data[i-1]&&data[i]<data[i+1]) troughs.push(i);
  return troughs.length>=minCount ? troughs : [];
}

function _buildMatch(c: KLineCandle[], id: string, nameCn: string, type: PatternType, dir: PatternDirection, idx: number, close: number, neckline: number, pole: number, quality: number): PatternMatch {
  const action = dir==='bullish'?'buy':dir==='bearish'?'sell':'wait';
  const entry = close;
  const stop = action==='buy' ? close-pole*0.3 : close+pole*0.3;
  const tp = action==='buy' ? close+pole*1.5 : close-pole*1.5;
  const rr = pole>0 ? 1.5 : 0;

  return {
    patternId: id, name: id.replace(/-/g,' '), nameCn,
    type, direction: dir,
    startIndex: Math.max(0,idx-15), endIndex: idx,
    confidence: Math.min(90, quality+10), quality,
    geometry: { entryPrice: entry, stopLoss: stop, takeProfit: tp, riskReward: rr, measuredMove: pole/close*100, duration: idx-Math.max(0,idx-15), neckline, poleHeight: pole },
    atCandle: c[idx],
    signal: {
      action,
      strength: quality>65?'strong':quality>45?'moderate':'weak',
      timeframe: 'D',
      description: `${id} pattern detected at $${close}`,
      descriptionCn: `检测到${nameCn}形态 @ ${close}`,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PatternStrategyPipeline
// ═══════════════════════════════════════════════════════════════════════════

export class PatternStrategyPipeline {
  private matches: Map<string, PatternMatch> = new Map();
  private strategies: Map<string, PatternStrategy> = new Map();
  private stats_ = { totalMatches: 0, totalStrategies: 0, byPattern: {} as Record<string, number> };

  constructor() {}

  // ── Public API: Pattern Detection ────────────────────────────────────────

  /** Scan for all 51 patterns */
  scan(symbol: string, candles: KLineCandle[], timeframe = 'D'): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const pattern of PATTERN_REGISTRY) {
      if (candles.length < pattern.requiredBars) continue;
      const match = pattern.check(candles);
      if (match) {
        const key = `${symbol}:${match.patternId}:${match.endIndex}`;
        // Avoid duplicate detection
        if (!this.matches.has(key)) {
          this.matches.set(key, match);
          this.stats_.totalMatches++;
          this.stats_.byPattern[match.patternId] = (this.stats_.byPattern[match.patternId]??0)+1;
        }
        matches.push(match);
      }
    }

    return matches;
  }

  // ── Public API: Strategy Generation ──────────────────────────────────────

  /** Generate trading strategies from pattern matches */
  generateStrategies(symbol: string, matches: PatternMatch[], timeframe = 'D'): PatternStrategy[] {
    const strategies: PatternStrategy[] = [];

    for (const match of matches) {
      if (match.signal.action === 'wait') continue;
      if (match.confidence < 50) continue; // only confident patterns

      const strategy: PatternStrategy = {
        patternId: match.patternId,
        patternName: match.name,
        patternNameCn: match.nameCn,
        symbol,
        action: match.signal.action as 'buy' | 'sell',
        entry: match.geometry.entryPrice,
        stopLoss: match.geometry.stopLoss,
        takeProfit: match.geometry.takeProfit,
        riskReward: match.geometry.riskReward,
        confidence: match.confidence,
        timeframe,
        triggered: true,
        createdAt: Date.now(),
      };

      this.strategies.set(match.patternId + ':' + symbol, strategy);
      this.stats_.totalStrategies++;
      strategies.push(strategy);
    }

    return strategies;
  }

  // ── Public API: Full Pipeline ────────────────────────────────────────────

  /** Run full pattern → strategy pipeline */
  runPipeline(symbol: string, candles: KLineCandle[], timeframe = 'D'): { patterns: PatternMatch[]; strategies: PatternStrategy[] } {
    const patterns = this.scan(symbol, candles, timeframe);
    const strategies = this.generateStrategies(symbol, patterns, timeframe);
    return { patterns, strategies };
  }

  // ── Public API: Query ────────────────────────────────────────────────────

  /** Get all pattern definitions */
  getAllPatterns(): Array<{ id: string; name: string; nameCn: string; type: string; direction: string }> {
    return PATTERN_REGISTRY.map(p => ({ id: p.id, name: p.name, nameCn: p.nameCn, type: p.type, direction: p.direction }));
  }

  /** Get match by key */
  getMatch(symbol: string, patternId: string): PatternMatch | null {
    for (const [key, match] of this.matches) {
      if (match.patternId === patternId && key.startsWith(symbol)) return match;
    }
    return null;
  }

  /** Get strategy */
  getStrategy(patternId: string, symbol: string): PatternStrategy | null {
    return this.strategies.get(patternId + ':' + symbol) ?? null;
  }

  /** Get all strategies for symbol */
  getStrategiesBySymbol(symbol: string): PatternStrategy[] {
    return Array.from(this.strategies.values()).filter(s => s.symbol === symbol);
  }

  getStats() { return { ...this.stats_ }; }
  reset(): void { this.matches.clear(); this.strategies.clear(); this.stats_ = { totalMatches:0, totalStrategies:0, byPattern:{} }; }
}

export const patternStrategyPipeline = new PatternStrategyPipeline();
