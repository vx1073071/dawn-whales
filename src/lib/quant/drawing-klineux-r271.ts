// ══ R271 LOBEHUB P2+P3 ══
export interface DTStrategyReport{
  timestamp:number;winner:'A'|'B'|'TIE';lift:number;recommendation:string;
}
export function analyzeDrawingToStrategy(ctrA:number,ctrB:number,cvrA:number,cvrB:number):DTStrategyReport{
  let aW=0,bW=0;
  if(ctrA>ctrB*1.05)aW++;else if(ctrB>ctrA*1.05)bW++;
  if(cvrA>cvrB*1.05)aW++;else if(cvrB>cvrA*1.05)bW++;
  let winner:'A'|'B'|'TIE'='TIE';
  if(aW>bW)winner='A';else if(bW>aW)winner='B';
  const lift=ctrB>0?(ctrA-ctrB)/ctrB:0;
  return{timestamp:Date.now(),winner,lift,recommendation:winner==='A'?'A胜出→启用一键生成策略':winner==='B'?'B胜出' :'不显著'};
}
export default DTStrategyReport;

export interface KLineUXReport{
  timestamp:number;overallScore:number;overall:'EXCELLENT'|'GOOD'|'FAIR'|'POOR';
  avgLoadMs:number;avgSessionMs:number;retention7d:number;avgRating:number;recommendations:string[];
}
export function evaluateKLineUX(loadMs:number,sessionMs:number,retention:number,rating:number):KLineUXReport{
  let score=100;
  if(loadMs>3000)score-=20;else if(loadMs>1500)score-=10;
  if(retention<40)score-=25;else if(retention<60)score-=12;
  if(rating<3)score-=15;
  let overall:KLineUXReport['overall'];
  if(score>=85)overall='EXCELLENT';else if(score>=70)overall='GOOD';else if(score>=50)overall='FAIR';else overall='POOR';
  const recs:string[]=[];
  if(loadMs>1500)recs.push('加载时间>1500ms——优化目标<1000ms');
  if(retention<50)recs.push('7日留存<50%');
  return{timestamp:Date.now(),overallScore:Math.max(0,score),overall,avgLoadMs:loadMs,avgSessionMs:sessionMs,retention7d:retention,avgRating:rating,recommendations:recs};
}
export { evaluateKLineUX as evaluateKLineUXScore };
