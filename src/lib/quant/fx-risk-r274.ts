// ══ R274 LOBEHUB P3: 汇率风险精度 ══
export interface FXExposure{pair:string;position:number;pnl:number;hedgeRatio:number;var95:number;stressLoss:number;correlationToMarket:number}
export interface FXRiskReport{timestamp:number;totalExposure:number;netPnl:number;hedgeEffectiveness:number;var95Total:number;stressTestMaxLoss:number;topExposures:{pair:string;position:number;pnl:number;var95:number}[];overall:'PASS'|'WARNING'|'FAIL';recommendations:string[]}
export function evaluateFXRisk(exposures:FXExposure[],benchmarkRate:number=0.95):FXRiskReport{
  if(exposures.length===0)return{timestamp:Date.now(),totalExposure:0,netPnl:0,hedgeEffectiveness:0,var95Total:0,stressTestMaxLoss:0,topExposures:[],overall:'FAIL',recommendations:['数据为空——检查汇率风险引擎']};
  const totalExp=exposures.reduce((s,x)=>s+Math.abs(x.position),0);
  const netPnl=exposures.reduce((s,x)=>s+x.pnl,0);
  const var95=exposures.reduce((s,x)=>s+x.var95,0);
  const stress=exposures.reduce((s,x)=>s+Math.abs(x.stressLoss),0);
  const avgHedge=exposures.reduce((s,x)=>s+x.hedgeRatio,0)/exposures.length;
  const top=[...exposures].sort((a,b)=>Math.abs(b.position)-Math.abs(a.position)).slice(0,5).map(e=>({pair:e.pair,position:e.position,pnl:e.pnl,var95:e.var95}));
  let o:'PASS'|'WARNING'|'FAIL';
  if(avgHedge>=benchmarkRate&&var95<totalExp*0.05&&stress<totalExp*0.1)o='PASS';
  else if(avgHedge>=0.7&&var95<totalExp*0.1)o='WARNING';
  else o='FAIL';
  const recs:string[]=[];
  if(avgHedge<benchmarkRate)recs.push(`对冲率${(avgHedge*100).toFixed(0)}%不足——目标${(benchmarkRate*100).toFixed(0)}%`);
  if(var95>=totalExp*0.05)recs.push(`VaR95=${var95.toLocaleString()}超过敞口5%=${Math.round(totalExp*0.05).toLocaleString()}`);
  if(stress>=totalExp*0.1)recs.push(`压力损失=${stress.toLocaleString()}超过敞口10%`);
  return{timestamp:Date.now(),totalExposure:totalExp,netPnl,hedgeEffectiveness:Math.round(avgHedge*10000)/100,var95Total:var95,stressTestMaxLoss:stress,topExposures:top,overall:o,recommendations:recs};
}
export default FXRiskReport;
