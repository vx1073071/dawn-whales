// ══ R269 LOBEHUB P3: 中国10指标 vs 富途对标 ══
// China Top 10 Indicators vs Futu Benchmark — 中国特色指标准确性
export interface ChinaIndicatorSample {
  id:string;name:string;category:string; // 'china_market'|'money_flow'|'sentiment'
  ourValue:number;futuValue:number;diffPct:number;directionMatch:boolean;
  status:'MATCH'|'TOLERABLE'|'DEVIATED';
}

export interface ChinaFutuReport {
  timestamp:number;totalIndicators:number;matchRate:number;directionMatchRate:number;
  avgDiffPct:number;indicators:ChinaIndicatorSample[];overall:'PASS'|'WARNING'|'FAIL';
  score:number;recommendations:string[];
}

export const CHINA_10_INDICATORS=['BBI','DKX','CYW','CYX','PBX','MIKE','ASI','CYF','JAX','LWR'];

export function compareChinaToFutu(samples:ChinaIndicatorSample[]):ChinaFutuReport{
  if(samples.length===0)return{timestamp:Date.now(),totalIndicators:0,matchRate:0,directionMatchRate:0,avgDiffPct:0,indicators:[],overall:'FAIL',score:0,recommendations:['无样本']};

  const match=samples.filter(s=>s.status==='MATCH'||s.status==='TOLERABLE').length;
  const matchRate=match/samples.length*100;
  const dirMatch=samples.filter(s=>s.directionMatch).length;
  const dirRate=dirMatch/samples.length*100;
  const avgDiff=samples.reduce((a,s)=>a+Math.abs(s.diffPct),0)/samples.length;

  let score=100;
  if(matchRate<80)score-=25;else if(matchRate<90)score-=12;
  if(dirRate<85)score-=20;
  if(avgDiff>5)score-=20;else if(avgDiff>2)score-=10;

  const recs:string[]=[];
  for(const s of samples){if(s.status==='DEVIATED')recs.push(`❌ ${s.name}偏差${Math.abs(s.diffPct).toFixed(1)}%`)}
  if(dirRate<90)recs.push(`⚠️ 方向匹配率${dirRate.toFixed(0)}%——信号方向可能相反`);

  return{timestamp:Date.now(),totalIndicators:samples.length,matchRate:Math.round(matchRate),directionMatchRate:Math.round(dirRate),avgDiffPct:Math.round(avgDiff*100)/100,indicators:samples,overall:score>=80?'PASS':score>=60?'WARNING':'FAIL',score:Math.max(0,score),recommendations:recs};
}

export default ChinaFutuReport;
