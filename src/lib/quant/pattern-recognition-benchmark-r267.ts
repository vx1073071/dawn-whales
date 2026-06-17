// ══ R267 LOBEHUB P1: K线形态识别基准 ══
// Pattern Recognition Benchmark — 21种K线形态 vs 人工标注准确率
export type PatternId='DOUBLE_BOTTOM'|'DOUBLE_TOP'|'HEAD_SHOULDERS'|'INV_HEAD_SHOULDERS'|'ASC_TRIANGLE'|'DESC_TRIANGLE'|'SYM_TRIANGLE'|'WEDGE_RISING'|'WEDGE_FALLING'|'FLAG_BULL'|'FLAG_BEAR'|'CUP_HANDLE'|'ROUND_BOTTOM'|'ROUND_TOP'|'BULL_ENGULFING'|'BEAR_ENGULFING'|'DOJI_STAR'|'HAMMER'|'SHOOTING_STAR'|'THREE_WHITE_SOLDIERS'|'THREE_BLACK_CROWS';

export interface PatternSample {
  patternId:PatternId;patternName:string;symbol:string;exchange:string;aiDetected:boolean;humanLabel:boolean;confidence:number;
}
export interface PatternResult {
  patternId:PatternId;patternName:string;samples:number;precision:number;recall:number;f1:number;avgConfidence:number;status:'PASS'|'WARNING'|'FAIL';
}
export interface PatternReport {
  timestamp:number;overallF1:number;totalPatterns:number;passCount:number;byPattern:PatternResult[];
  top3:PatternResult[];worst3:PatternResult[];recommendations:string[];
}

export const PATTERN_NAMES:Record<PatternId,{zh:string;en:string;difficulty:'EASY'|'MEDIUM'|'HARD'}>={
  DOUBLE_BOTTOM:{zh:'双底/W底',en:'Double Bottom',difficulty:'EASY'},DOUBLE_TOP:{zh:'双顶/M顶',en:'Double Top',difficulty:'EASY'},
  HEAD_SHOULDERS:{zh:'头肩顶',en:'Head & Shoulders',difficulty:'MEDIUM'},INV_HEAD_SHOULDERS:{zh:'倒头肩',en:'Inverse H&S',difficulty:'MEDIUM'},
  ASC_TRIANGLE:{zh:'上升三角',en:'Ascending Triangle',difficulty:'MEDIUM'},DESC_TRIANGLE:{zh:'下降三角',en:'Descending Triangle',difficulty:'MEDIUM'},
  SYM_TRIANGLE:{zh:'对称三角',en:'Symmetrical Triangle',difficulty:'MEDIUM'},
  WEDGE_RISING:{zh:'上升楔形',en:'Rising Wedge',difficulty:'HARD'},WEDGE_FALLING:{zh:'下降楔形',en:'Falling Wedge',difficulty:'HARD'},
  FLAG_BULL:{zh:'牛旗',en:'Bull Flag',difficulty:'MEDIUM'},FLAG_BEAR:{zh:'熊旗',en:'Bear Flag',difficulty:'MEDIUM'},
  CUP_HANDLE:{zh:'杯柄',en:'Cup & Handle',difficulty:'HARD'},ROUND_BOTTOM:{zh:'圆底',en:'Rounding Bottom',difficulty:'HARD'},
  ROUND_TOP:{zh:'圆顶',en:'Rounding Top',difficulty:'HARD'},
  BULL_ENGULFING:{zh:'看涨吞没',en:'Bullish Engulfing',difficulty:'EASY'},BEAR_ENGULFING:{zh:'看跌吞没',en:'Bearish Engulfing',difficulty:'EASY'},
  DOJI_STAR:{zh:'十字星',en:'Doji Star',difficulty:'EASY'},HAMMER:{zh:'锤子线',en:'Hammer',difficulty:'EASY'},
  SHOOTING_STAR:{zh:'流星线',en:'Shooting Star',difficulty:'EASY'},
  THREE_WHITE_SOLDIERS:{zh:'三白兵',en:'Three White Soldiers',difficulty:'MEDIUM'},THREE_BLACK_CROWS:{zh:'三乌鸦',en:'Three Black Crows',difficulty:'MEDIUM'},
};

export function evaluatePatternRecognition(samples:PatternSample[]):PatternReport{
  const groups=new Map<PatternId,PatternSample[]>();
  for(const s of samples){const g=groups.get(s.patternId)||[];g.push(s);groups.set(s.patternId,g)}
  const byPattern:PatternResult[]=[];
  for(const [id,ss] of groups){
    const tp=ss.filter(s=>s.aiDetected&&s.humanLabel).length;
    const fp=ss.filter(s=>s.aiDetected&&!s.humanLabel).length;
    const fn=ss.filter(s=>!s.aiDetected&&s.humanLabel).length;
    const precision=tp+fp>0?tp/(tp+fp):0;
    const recall=tp+fn>0?tp/(tp+fn):0;
    const f1=precision+recall>0?2*precision*recall/(precision+recall):0;
    const avgConf=ss.reduce((a,s)=>a+s.confidence,0)/Math.max(1,ss.length);
    let status:PatternResult['status'];
    if(f1>=0.85)status='PASS';else if(f1>=0.7)status='WARNING';else status='FAIL';
    byPattern.push({patternId:id,patternName:PATTERN_NAMES[id].zh,samples:ss.length,precision,recall,f1,avgConfidence:Math.round(avgConf*1000)/1000,status});
  }
  byPattern.sort((a,b)=>b.f1-a.f1);
  const overallF1=byPattern.reduce((s,p)=>s+p.f1,0)/Math.max(1,byPattern.length);
  const recs:string[]=[];
  for(const p of byPattern){if(p.status==='FAIL')recs.push(`❌ ${p.patternName} F1=${(p.f1*100).toFixed(0)}%——需改进`);else if(p.status==='WARNING')recs.push(`⚠️ ${p.patternName} F1=${(p.f1*100).toFixed(0)}%`)}
  return{timestamp:Date.now(),overallF1:Math.round(overallF1*1000)/1000,totalPatterns:groups.size,passCount:byPattern.filter(p=>p.status==='PASS').length,byPattern,top3:byPattern.slice(0,3),worst3:byPattern.slice(-3).reverse(),recommendations:recs};
}

export default PatternReport;
